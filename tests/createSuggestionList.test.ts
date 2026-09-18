import { describe, expect, it, vi } from 'vitest';
import { createSuggestionList } from '../src';
import type { Suggestion, SuggestionList } from '../src';

const element = document.createElement('input');

function query(list: SuggestionList, keyword: string, caseSensitive = false): Promise<Suggestion[]> {
    return list.getSuggestions(keyword, { element, caseSensitive });
}

describe('createSuggestionList', () => {
    it('converts strings into { value, label } suggestions', async () => {
        const list = createSuggestionList({ trigger: '#', values: ['hello', 'world'] });
        expect(await query(list, '')).toEqual([
            { value: 'hello', label: 'hello' },
            { value: 'world', label: 'world' }
        ]);
    });

    it('accepts values directly instead of options', async () => {
        expect(await query(createSuggestionList(['hello', 'world']), 'w')).toEqual([{ value: 'world', label: 'world' }]);
        expect(await query(createSuggestionList('hello'), 'h')).toEqual([{ value: 'hello', label: 'hello' }]);
    });

    it('uses value as label when label is missing and drops any other property', async () => {
        const values = [{ value: '@john', label: 'Peter John', insertHtml: '<b>john</b>' }, { value: '@jane' }];
        expect(await query(createSuggestionList({ trigger: '@', values }), '')).toEqual([
            { value: '@john', label: 'Peter John' },
            { value: '@jane', label: '@jane' }
        ]);
    });

    it('matches the keyword against the start of both label and value, with or without trigger', async () => {
        const list = createSuggestionList({ trigger: '@', values: [{ value: '@AmbulaV', label: 'Chandrasekhar' }] });
        expect(await query(list, 'cha')).toHaveLength(1);
        expect(await query(list, 'amb')).toHaveLength(1);
        expect(await query(list, '@amb')).toHaveLength(1);
        expect(await query(list, 'sekhar')).toHaveLength(0);
    });

    it('gives more weight to the label based matches over the value based matches', async () => {
        const list = createSuggestionList({
            trigger: '@',
            values: [
                { value: '@john', label: 'Peter Parker' },
                { value: '@joe', label: 'Joe Root' },
                { value: '@peter', label: 'John Doe' },
                { value: '@jon', label: 'Jon Snow' },
                { value: '@other', label: 'Other' }
            ]
        });

        // label matches in the order of the list, followed by the matches based only on value
        expect((await query(list, 'jo')).map(s => s.label)).toEqual(['Joe Root', 'John Doe', 'Jon Snow', 'Peter Parker']);
        expect((await query(list, 'pe')).map(s => s.label)).toEqual(['Peter Parker', 'John Doe']);
    });

    it('does not suggest an exact match', async () => {
        const list = createSuggestionList(['simillar1', 'simillar12']);
        expect((await query(list, 'simillar1')).map(s => s.value)).toEqual(['simillar12']);
    });

    it('ignores case unless caseSensitive is passed while querying', async () => {
        const list = createSuggestionList(['hello']);
        expect(await query(list, 'H')).toHaveLength(1);
        expect(await query(list, 'H', true)).toHaveLength(0);
        expect(await query(list, 'h', true)).toHaveLength(1);
    });

    it('escapes special characters of keyword and trigger', async () => {
        const special = 'with:^sp[e]c<i>(a)l ch{a}rs?$';
        const list = createSuggestionList({ trigger: '$(', values: [special, 'world'] });
        expect((await query(list, 'with:^sp[')).map(s => s.value)).toEqual([special]);
        expect(await query(list, '.')).toHaveLength(0);
        expect(list.getMatch('foo $(wo')).toBe('wo');
    });

    describe('isTriggerMatch', () => {
        it('tells if the value ends with "trigger + keyword"', async () => {
            const list = createSuggestionList({ trigger: '#', values: [] });
            expect(list.isTriggerMatch('#')).toBe(true);
            expect(list.isTriggerMatch('say #he')).toBe(true);
            expect(list.isTriggerMatch('say #he llo')).toBe(false);
            expect(list.isTriggerMatch('say#he')).toBe(false);

            const noTrigger = createSuggestionList(['hello']);
            expect(noTrigger.isTriggerMatch('say he')).toBe(true);
            expect(noTrigger.isTriggerMatch('say ')).toBe(false);
        });
    });

    describe('getMatch', () => {
        it('returns the keyword after trigger', async () => {
            const list = createSuggestionList({ trigger: '#', values: [] });
            expect(list.getMatch('#')).toBe('');
            expect(list.getMatch('say #he')).toBe('he');
            expect(list.getMatch('say #he llo')).toBeNull();
            expect(list.getMatch('say#he')).toBeNull();
            expect(list.getMatch('say he')).toBeNull();
        });

        it('supports triggers with multiple characters', async () => {
            const list = createSuggestionList({ trigger: '##', values: [] });
            expect(list.getMatch('say ##he')).toBe('he');
            expect(list.getMatch('say #he')).toBeNull();
        });

        it('uses space as trigger when there is no trigger', async () => {
            const list = createSuggestionList(['hello']);
            expect(list.trigger).toBeUndefined();
            expect(list.getMatch('he')).toBe('he');
            expect(list.getMatch('say he')).toBe('he');
            expect(list.getMatch('say ')).toBeNull();
        });
    });

    describe('suggestion generator', () => {
        it('receives keyword and element, results are normalized', async () => {
            const values = vi.fn((keyword: string) => [keyword + '1']);
            const list = createSuggestionList({ trigger: '#', values });

            expect(await query(list, 'gen')).toEqual([{ value: 'gen1', label: 'gen1' }]);
            expect(values).toHaveBeenCalledWith('gen', element);
        });

        it('can be async', async () => {
            const list = createSuggestionList(async (keyword: string) => [{ value: keyword + '2', label: 'Two' }]);
            expect(await query(list, 'gen')).toEqual([{ value: 'gen2', label: 'Two' }]);
        });

        it('rejects when the generator fails or returns invalid suggestions', async () => {
            const failing = createSuggestionList(() => Promise.reject(new Error('network')));
            await expect(query(failing, 'gen')).rejects.toThrow('network');

            // @ts-expect-error value should be a string
            const invalid = createSuggestionList(() => [{ value: 1 }]);
            await expect(query(invalid, 'gen')).rejects.toThrow('Suggestion.value');
        });
    });

    it('carries the options needed to render the dropdown and register events', async () => {
        const renderMenuItem = () => null;
        const onInsert = () => undefined;
        const renderInsert = () => ({ text: '' });
        const list = createSuggestionList({
            trigger: '#', values: [], caseSensitive: true, maxSuggestions: 3, renderMenuItem, renderInsert, onInsert
        });

        expect(list).toMatchObject({
            trigger: '#', caseSensitive: true, maxSuggestions: 3, renderMenuItem, renderInsert, onInsert
        });
    });

    it('validates options and suggestions', async () => {
        // @ts-expect-error values is required
        expect(() => createSuggestionList({ trigger: '#' })).toThrow('SuggestionList.values');
        // @ts-expect-error trigger should be a string
        expect(() => createSuggestionList({ trigger: 1, values: [] })).toThrow('SuggestionList.trigger');
        // @ts-expect-error value is required
        expect(() => createSuggestionList({ values: [{ label: 'hello' }] })).toThrow('Suggestion.value');
        // @ts-expect-error value should be a string
        expect(() => createSuggestionList({ values: [{ value: 1 }] })).toThrow('Suggestion.value');
        // @ts-expect-error label should be a string
        expect(() => createSuggestionList({ values: [{ value: 'hello', label: 1 }] })).toThrow('Suggestion.label');
    });
});
