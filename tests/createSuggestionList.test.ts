import { describe, expect, it, vi } from 'vitest';
import { createSuggestionList, filterSuggestions, normalizeSuggestions } from '../src/createSuggestionList';

const element = document.createElement('input');

describe('normalizeSuggestions', () => {
    it('converts strings into { value, label } pairs', () => {
        expect(normalizeSuggestions(['hello', 'world'])).toEqual([
            { value: 'hello', label: 'hello' },
            { value: 'world', label: 'world' }
        ]);
    });

    it('defaults label to value and keeps explicit labels', () => {
        expect(normalizeSuggestions([{ value: '@john' }, { value: '@ann', label: 'Ann Lee' }])).toEqual([
            { value: '@john', label: '@john' },
            { value: '@ann', label: 'Ann Lee' }
        ]);
    });

    it('accepts a single suggestion instead of an array', () => {
        expect(normalizeSuggestions('one')).toEqual([{ value: 'one', label: 'one' }]);
    });

    it('rejects suggestions without a string value', () => {
        expect(() => normalizeSuggestions([{ label: 'x' } as never])).toThrow(/Suggestion\.value/);
        expect(() => normalizeSuggestions([42 as never])).toThrow(/Suggestion\.value/);
        expect(() => normalizeSuggestions([{ value: 'x', label: 1 } as never])).toThrow(/Suggestion\.label/);
    });
});

describe('filterSuggestions', () => {
    const suggestions = normalizeSuggestions(['hello', 'Help', { value: '@amb', label: 'Ambula' }]);

    it('matches suggestions that start with the keyword, ignoring case by default', () => {
        expect(filterSuggestions(suggestions, 'he', undefined, false).map(s => s.value)).toEqual(['hello', 'Help']);
        expect(filterSuggestions(suggestions, 'H', undefined, false).map(s => s.value)).toEqual(['hello', 'Help']);
    });

    it('respects caseSensitive', () => {
        expect(filterSuggestions(suggestions, 'H', undefined, true).map(s => s.value)).toEqual(['Help']);
    });

    it('lists label matches before value-only matches, keeping order inside each group', () => {
        const mixed = normalizeSuggestions([
            { value: 'jo1', label: 'Zed' },      // value match
            { value: 'x2', label: 'John' },      // label match
            { value: 'jo3', label: 'Yara' },     // value match
            { value: 'jo4', label: 'Joan' },     // label match (value would match too)
            { value: 'nope', label: 'nope' }
        ]);
        expect(filterSuggestions(mixed, 'jo', undefined, false).map(s => s.value)).toEqual(['x2', 'jo4', 'jo1', 'jo3']);
    });

    it('matches on value or label and tolerates the trigger in the keyword', () => {
        expect(filterSuggestions(suggestions, 'am', '@', false).map(s => s.value)).toEqual(['@amb']);
        expect(filterSuggestions(suggestions, '@am', '@', false).map(s => s.value)).toEqual(['@amb']);
    });

    it('excludes suggestions that are already fully typed', () => {
        expect(filterSuggestions(suggestions, 'hello', undefined, false)).toEqual([]);
        expect(filterSuggestions(suggestions, '', undefined, false)).toHaveLength(3);
    });

    it('escapes regex special characters in the keyword', () => {
        const special = normalizeSuggestions(['with:^sp[e]c<i>(a)l ch{a}rs?$']);
        expect(filterSuggestions(special, 'with:^sp[e]c<i>(a)', undefined, false)).toHaveLength(1);
    });
});

describe('createSuggestionList', () => {
    it('requires a suggestions source', () => {
        expect(() => createSuggestionList({} as never)).toThrow(/SuggestionList\.suggestions/);
        expect(() => createSuggestionList(undefined as never)).toThrow(/SuggestionList\.options/);
    });

    it('validates option types', () => {
        expect(() => createSuggestionList({ trigger: 1 as never, suggestions: [] })).toThrow(/trigger/);
        expect(() => createSuggestionList({ suggestions: 'nope' as never })).toThrow(/suggestions/);
    });

    it('matches "trigger + keyword" at the end of the value', () => {
        const list = createSuggestionList({ trigger: '#', suggestions: [] });
        expect(list.isTriggerMatch('hello #wo')).toBe(true);
        expect(list.isTriggerMatch('hello#wo')).toBe(false);
        expect(list.isTriggerMatch('hello wo')).toBe(false);
        expect(list.getMatch('hello #wo')).toBe('wo');
        expect(list.getMatch('#')).toBe('');
        expect(list.getMatch('hello#wo')).toBeNull();
        expect(list.getMatch('hello wo')).toBeNull();
    });

    it('supports multi character and regex-special triggers', () => {
        const list = createSuggestionList({ trigger: '//', suggestions: [] });
        expect(list.getMatch('a //he')).toBe('he');
        expect(list.getMatch('a /he')).toBeNull();

        const dollar = createSuggestionList({ trigger: '$(', suggestions: [] });
        expect(dollar.getMatch('x $(fo')).toBe('fo');
    });

    it('uses whitespace as trigger when none is given', () => {
        const list = createSuggestionList({ suggestions: [] });
        expect(list.trigger).toBeUndefined();
        expect(list.isTriggerMatch('hello wor')).toBe(true);
        expect(list.isTriggerMatch('hello ')).toBe(false);
        expect(list.getMatch('hello wor')).toBe('wor');
        expect(list.getMatch('wor')).toBe('wor');
        expect(list.getMatch('hello ')).toBeNull();
    });

    it('treats an empty trigger as no trigger', () => {
        expect(createSuggestionList({ trigger: '', suggestions: [] }).trigger).toBeUndefined();
    });

    it('filters static suggestions and resolves them as a promise', async () => {
        const list = createSuggestionList({ trigger: '@', suggestions: ['alpha', 'beta', 'Alps'] });
        const result = list.getSuggestions('al', element, { caseSensitive: false });
        expect(result).toBeInstanceOf(Promise);
        expect((await result).map(s => s.value)).toEqual(['alpha', 'Alps']);
        await expect(list.getSuggestions('al', element, { caseSensitive: true })).resolves.toEqual([{ value: 'alpha', label: 'alpha' }]);
    });

    it('awaits async generators and passes the element', async () => {
        const generator = vi.fn(
            (keyword: string, _element: HTMLElement) =>
                new Promise<string[]>(resolve => setTimeout(() => resolve([keyword + '1', keyword + '2']), 0))
        );
        const list = createSuggestionList({ suggestions: generator });
        const result = list.getSuggestions('ab', element, { caseSensitive: false });
        expect(result).toBeInstanceOf(Promise);
        await expect(result).resolves.toEqual([
            { value: 'ab1', label: 'ab1' },
            { value: 'ab2', label: 'ab2' }
        ]);
        expect(generator.mock.calls[0]?.[1]).toBe(element);
    });

    it('accepts generators that return synchronously', async () => {
        const list = createSuggestionList({ suggestions: keyword => [{ value: keyword, label: 'L' }] });
        await expect(list.getSuggestions('x', element, { caseSensitive: false })).resolves.toEqual([
            { value: 'x', label: 'L' }
        ]);
    });

    it('rejects when a generator produces invalid suggestions or throws', async () => {
        const invalid = createSuggestionList({ suggestions: () => [{} as never] });
        await expect(invalid.getSuggestions('x', element, { caseSensitive: false })).rejects.toThrow(/Suggestion\.value/);
        const throwing = createSuggestionList({
            suggestions: () => {
                throw new Error('boom');
            }
        });
        await expect(throwing.getSuggestions('x', element, { caseSensitive: false })).rejects.toThrow('boom');
    });

    it('only carries overrides that were explicitly provided', () => {
        const renderGroup = () => null;
        const renderInsert = () => ({ text: 'x' });
        const onInsert = vi.fn();
        const bare = createSuggestionList({ suggestions: [] });
        expect(bare.caseSensitive).toBeUndefined();
        expect(bare.maxSuggestions).toBeUndefined();
        expect(bare.renderGroup).toBeUndefined();
        expect(bare.renderInsert).toBeUndefined();
        expect(bare.onInsert).toBeUndefined();

        const full = createSuggestionList({ suggestions: [], caseSensitive: true, maxSuggestions: 3, renderGroup, renderInsert, onInsert });
        expect(full.caseSensitive).toBe(true);
        expect(full.maxSuggestions).toBe(3);
        expect(full.renderGroup).toBe(renderGroup);
        expect(full.renderInsert).toBe(renderInsert);
        expect(full.onInsert).toBe(onInsert);
    });

    it('gives every list a unique id', () => {
        expect(createSuggestionList({ suggestions: [] }).id).not.toBe(createSuggestionList({ suggestions: [] }).id);
    });
});
