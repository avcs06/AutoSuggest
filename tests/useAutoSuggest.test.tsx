import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
    AutoSuggestProvider,
    createSuggestionList,
    useAutoSuggest,
    type AutoSuggestProviderProps,
    type RenderMenu,
    type RenderMenuItem,
    type SuggestionList
} from '../src';
import { flushPromises, setCaret, setInputCaret } from './helpers';

const renderMenu: RenderMenu = ({ menuProps, children, isLoading }) => (
    <ul data-testid="menu" data-loading={String(isLoading)} {...menuProps}>
        {children}
    </ul>
);

const renderMenuItem: RenderMenuItem = ({ suggestion, itemProps }) => (
    <li data-testid="item" {...itemProps}>
        {suggestion.label}
    </li>
);

interface FieldProps {
    lists: SuggestionList[];
    testId?: string;
}

const Field = ({ lists, testId = 'field' }: FieldProps) => {
    const { getInputProps, isOpen } = useAutoSuggest(lists);
    return <input type="text" data-testid={testId} data-open={String(isOpen)} {...getInputProps<HTMLInputElement>()} />;
};

const Editable = ({ lists }: FieldProps) => {
    const { getInputProps } = useAutoSuggest(lists);
    return <div contentEditable="true" data-testid="editable" suppressContentEditableWarning {...getInputProps<HTMLDivElement>()} />;
};

const setup = (ui: React.ReactElement, providerProps: Partial<AutoSuggestProviderProps> = {}) =>
    render(
        <AutoSuggestProvider renderMenu={renderMenu} renderMenuItem={renderMenuItem} {...providerProps}>
            {ui}
        </AutoSuggestProvider>
    );

/** Types into the field and lets the (always async) suggestion lookup settle. */
const typeInto = async (input: HTMLInputElement, value: string, caret = value.length) => {
    input.value = value;
    setInputCaret(input, caret);
    await act(async () => {
        fireEvent.keyUp(input);
    });
};

/** Fires an event and flushes pending suggestion lookups. */
const fire = (dispatch: () => unknown) =>
    act(async () => {
        dispatch();
    });

const itemLabels = () => screen.queryAllByTestId('item').map(item => item.textContent);

describe('useAutoSuggest', () => {
    it('throws when used outside of a provider', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        expect(() => renderHook(() => useAutoSuggest([]))).toThrow(/inside an <AutoSuggestProvider>/);
        spy.mockRestore();
    });

    it('opens the menu with matching suggestions when a trigger is typed', async () => {
        const list = createSuggestionList({ trigger: '#', suggestions: ['hello', 'world'] });
        setup(<Field lists={[list]} />);
        const input = screen.getByTestId<HTMLInputElement>('field');

        await typeInto(input, 'say #');
        expect(itemLabels()).toEqual(['hello', 'world']);
        expect(input.dataset.open).toBe('true');
        const menu = screen.getByTestId('menu');
        expect(menu.getAttribute('role')).toBe('listbox');
        expect(menu.style.position).toBe('absolute');

        await typeInto(input, 'say #h');
        expect(itemLabels()).toEqual(['hello']);
    });

    it('ignores case by default and honours the global caseSensitive flag', async () => {
        const list = createSuggestionList({ trigger: '#', suggestions: ['hello'] });
        const { unmount } = setup(<Field lists={[list]} />);
        await typeInto(screen.getByTestId<HTMLInputElement>('field'), '#H');
        expect(itemLabels()).toEqual(['hello']);
        unmount();

        setup(<Field lists={[list]} />, { caseSensitive: true });
        await typeInto(screen.getByTestId<HTMLInputElement>('field'), '#H');
        expect(screen.queryByTestId('menu')).toBeNull();
    });

    it('lets a list override the global caseSensitive and maxSuggestions', async () => {
        const insensitive = createSuggestionList({ trigger: '#', suggestions: ['Hello', 'help', 'hero'], caseSensitive: false, maxSuggestions: 2 });
        setup(<Field lists={[insensitive]} />, { caseSensitive: true, maxSuggestions: 10 });
        await typeInto(screen.getByTestId<HTMLInputElement>('field'), '#h');
        expect(itemLabels()).toEqual(['Hello', 'help']);
    });

    it('limits the number of suggestions to the global maxSuggestions', async () => {
        const list = createSuggestionList({ trigger: '#', suggestions: ['a1', 'a2', 'a3', 'a4'] });
        setup(<Field lists={[list]} />, { maxSuggestions: 3 });
        await typeInto(screen.getByTestId<HTMLInputElement>('field'), '#a');
        expect(itemLabels()).toEqual(['a1', 'a2', 'a3']);
    });

    it('does not open when the character after the caret is a word character', async () => {
        const list = createSuggestionList({ trigger: '#', suggestions: ['hello'] });
        setup(<Field lists={[list]} />);
        const input = screen.getByTestId<HTMLInputElement>('field');

        await typeInto(input, '#he', 2);
        expect(screen.queryByTestId('menu')).toBeNull();

        await typeInto(input, '#he ', 3);
        expect(itemLabels()).toEqual(['hello']);
    });

    it('opens when part of the keyword is selected', async () => {
        const list = createSuggestionList({ trigger: '#', suggestions: ['hello'] });
        setup(<Field lists={[list]} />);
        const input = screen.getByTestId<HTMLInputElement>('field');
        input.value = '#he';
        setInputCaret(input, 2, 3);
        await fire(() => fireEvent.mouseUp(input));
        expect(itemLabels()).toEqual(['hello']);
    });

    it('closes when no list matches, when every list is empty and on blur', async () => {
        const list = createSuggestionList({ trigger: '#', suggestions: ['hello'] });
        setup(<Field lists={[list]} />);
        const input = screen.getByTestId<HTMLInputElement>('field');

        await typeInto(input, '#h');
        expect(screen.getByTestId('menu')).toBeTruthy();
        await typeInto(input, 'plain text');
        expect(screen.queryByTestId('menu')).toBeNull();

        await typeInto(input, '#h');
        await typeInto(input, '#zzz');
        expect(screen.queryByTestId('menu')).toBeNull();

        await typeInto(input, '#h');
        fireEvent.blur(input);
        expect(screen.queryByTestId('menu')).toBeNull();
        expect(input.dataset.open).toBe('false');
    });

    it('inserts the clicked suggestion, closes the menu and calls the list onInsert', async () => {
        const listInsert = vi.fn();
        const list = createSuggestionList({ trigger: '#', suggestions: ['hello', 'world'], onInsert: listInsert });
        setup(<Field lists={[list]} />);
        const input = screen.getByTestId<HTMLInputElement>('field');

        await typeInto(input, 'say #wo');
        const item = screen.getByTestId('item');
        expect(item.getAttribute('role')).toBe('option');
        const event = fireEvent.mouseDown(item);

        expect(event).toBe(false); // default prevented → field keeps focus
        expect(input.value).toBe('say world');
        expect(input.selectionStart).toBe(9);
        expect(screen.queryByTestId('menu')).toBeNull();
        expect(listInsert).toHaveBeenCalledWith({ value: 'world', label: 'world' }, input);
        expect(listInsert).toHaveBeenCalledTimes(1);
    });

    it('inserts renderInsert text into inputs and the rendered node into contenteditable', async () => {
        const onInsert = vi.fn();
        const list = createSuggestionList({
            trigger: '@',
            suggestions: [{ value: '@ambula', label: 'Ambula V' }],
            renderInsert: suggestion => ({ text: `${suggestion.value} `, node: <a href="/u/ambula">{suggestion.label}</a> }),
            onInsert
        });
        setup(
            <>
                <Field lists={[list]} />
                <Editable lists={[list]} />
            </>
        );

        const input = screen.getByTestId<HTMLInputElement>('field');
        await typeInto(input, 'hi @am');
        fireEvent.mouseDown(screen.getByTestId('item'));
        expect(input.value).toBe('hi @ambula ');
        expect(onInsert).toHaveBeenLastCalledWith({ value: '@ambula', label: 'Ambula V' }, input);

        const editable = screen.getByTestId('editable');
        editable.textContent = 'yo @am';
        setCaret(editable.firstChild!, 6);
        await fire(() => fireEvent.keyUp(editable));
        fireEvent.mouseDown(screen.getByTestId('item'));
        expect(editable.innerHTML).toBe('yo <a href="/u/ambula">Ambula V</a>');
        const [, node] = onInsert.mock.calls[1]!;
        expect(node).toBeInstanceOf(HTMLAnchorElement);
        expect(editable.contains(node as Node)).toBe(true);
    });

    it('keeps the whitespace trigger when the list has none', async () => {
        const list = createSuggestionList({ suggestions: ['world'] });
        setup(<Field lists={[list]} />);
        const input = screen.getByTestId<HTMLInputElement>('field');
        await typeInto(input, 'hello wo');
        fireEvent.mouseDown(screen.getByTestId('item'));
        expect(input.value).toBe('hello world');
    });

    it('updates controlled React inputs through onChange', async () => {
        const list = createSuggestionList({ trigger: '@', suggestions: ['@ambula'] });
        const Controlled = () => {
            const [value, setValue] = useState('');
            const { getInputProps } = useAutoSuggest([list]);
            return (
                <>
                    <input type="text" data-testid="field" value={value} onChange={e => setValue(e.target.value)} {...getInputProps<HTMLInputElement>()} />
                    <output data-testid="state">{value}</output>
                </>
            );
        };
        setup(<Controlled />);
        const input = screen.getByTestId<HTMLInputElement>('field');
        fireEvent.change(input, { target: { value: 'hi @am' } });
        setInputCaret(input, 6);
        await fire(() => fireEvent.keyUp(input));
        fireEvent.mouseDown(screen.getByTestId('item'));
        expect(screen.getByTestId('state').textContent).toBe('hi @ambula');
        expect(input.value).toBe('hi @ambula');
    });

    it('passes through a loading state even for static lists', () => {
        const spy = vi.fn<RenderMenu>(() => null);
        const list = createSuggestionList({ trigger: '#', suggestions: ['hello'] });
        setup(<Field lists={[list]} />, { renderMenu: spy });
        const input = screen.getByTestId<HTMLInputElement>('field');
        input.value = '#h';
        setInputCaret(input, 2);
        fireEvent.keyUp(input);
        expect(spy.mock.calls[0]![0].isLoading).toBe(true);
    });

    it('shows a loading state for async lists and then the results', async () => {
        let resolve!: (values: string[]) => void;
        const list = createSuggestionList({
            trigger: '#',
            suggestions: () => new Promise<string[]>(r => { resolve = r; })
        });
        setup(<Field lists={[list]} />);
        const input = screen.getByTestId<HTMLInputElement>('field');

        await typeInto(input, '#x');
        expect(screen.getByTestId('menu').dataset.loading).toBe('true');
        expect(itemLabels()).toEqual([]);

        await act(async () => {
            resolve(['xylophone']);
            await flushPromises();
        });
        expect(screen.getByTestId('menu').dataset.loading).toBe('false');
        expect(itemLabels()).toEqual(['xylophone']);
    });

    it('ignores async results that arrive after a newer keystroke', async () => {
        const callbacks: Array<(values: string[]) => void> = [];
        const list = createSuggestionList({
            trigger: '#',
            suggestions: () => new Promise<string[]>(r => { callbacks.push(r); })
        });
        setup(<Field lists={[list]} />);
        const input = screen.getByTestId<HTMLInputElement>('field');

        await typeInto(input, '#a');
        await typeInto(input, '#ab');
        await act(async () => {
            callbacks[0]!(['stale']);
            await flushPromises();
        });
        expect(itemLabels()).toEqual([]);

        await act(async () => {
            callbacks[1]!(['fresh']);
            await flushPromises();
        });
        expect(itemLabels()).toEqual(['fresh']);
    });

    it('closes the loading menu when the generator fails', async () => {
        let reject!: (error: Error) => void;
        const list = createSuggestionList({ trigger: '#', suggestions: () => new Promise<string[]>((_, r) => { reject = r; }) });
        setup(<Field lists={[list]} />);
        await typeInto(screen.getByTestId<HTMLInputElement>('field'), '#a');
        expect(screen.getByTestId('menu').dataset.loading).toBe('true');
        await act(async () => {
            reject(new Error('boom'));
            await flushPromises();
        });
        expect(screen.queryByTestId('menu')).toBeNull();
    });

    it('shows every matching list as a group, in list order', async () => {
        const first = createSuggestionList({ trigger: '#', suggestions: ['nomatch'] });
        const second = createSuggestionList({ trigger: '#', suggestions: ['second-a', 'second-b'] });
        const third = createSuggestionList({ trigger: '#', suggestions: ['s-third'] });
        setup(<Field lists={[first, second, third]} />);
        await typeInto(screen.getByTestId<HTMLInputElement>('field'), '#s');
        expect(itemLabels()).toEqual(['second-a', 'second-b', 's-third']);
    });

    it('renders each group with its own renderMenuItem and applies maxSuggestions per list', async () => {
        const plain = createSuggestionList({ trigger: '#', suggestions: ['p1', 'p2', 'p3'], maxSuggestions: 2 });
        const fancy = createSuggestionList({
            trigger: '#',
            suggestions: ['f1', 'f2'],
            renderMenuItem: ({ suggestion, itemProps }) => <li data-testid="fancy" {...itemProps}>*{suggestion.label}</li>
        });
        setup(<Field lists={[plain, fancy]} />);
        await typeInto(screen.getByTestId<HTMLInputElement>('field'), '#');
        expect(itemLabels()).toEqual(['p1', 'p2']);
        expect(screen.getAllByTestId('fancy').map(item => item.textContent)).toEqual(['*f1', '*f2']);
    });

    it('wraps a group with the list renderGroup, falling back to the provider renderGroup', async () => {
        const custom = createSuggestionList({
            trigger: '#',
            suggestions: ['c1'],
            renderGroup: ({ items, keyword }) => <li data-testid="custom-group" data-keyword={keyword}><ul>{items}</ul></li>
        });
        const plain = createSuggestionList({ trigger: '#', suggestions: ['d1'] });
        setup(<Field lists={[custom, plain]} />, {
            renderGroup: ({ items, list }) => <li data-testid="default-group" data-list={list.id}><ul>{items}</ul></li>
        });
        await typeInto(screen.getByTestId<HTMLInputElement>('field'), '#');
        const customGroup = screen.getByTestId('custom-group');
        expect(customGroup.dataset.keyword).toBe('');
        expect(customGroup.querySelector('[data-testid="item"]')?.textContent).toBe('c1');
        const defaultGroup = screen.getByTestId('default-group');
        expect(defaultGroup.dataset.list).toBe(plain.id);
        expect(defaultGroup.querySelector('[data-testid="item"]')?.textContent).toBe('d1');
    });

    it('shows resolved groups immediately while slower lists keep loading', async () => {
        let resolve!: (values: string[]) => void;
        const slow = createSuggestionList({ trigger: '#', suggestions: () => new Promise<string[]>(r => { resolve = r; }) });
        const fast = createSuggestionList({ trigger: '#', suggestions: ['fast'] });
        const spy = vi.fn<RenderMenu>(renderMenu);
        setup(<Field lists={[slow, fast]} />, { renderMenu: spy });
        await typeInto(screen.getByTestId<HTMLInputElement>('field'), '#');

        expect(itemLabels()).toEqual(['fast']);
        let args = spy.mock.calls[spy.mock.calls.length - 1]![0];
        expect(args.isLoading).toBe(true);
        expect(args.groups.map(g => g.isLoading)).toEqual([true, false]);

        await act(async () => {
            resolve(['slow']);
            await flushPromises();
        });
        expect(itemLabels()).toEqual(['slow', 'fast']);
        args = spy.mock.calls[spy.mock.calls.length - 1]![0];
        expect(args.isLoading).toBe(false);
        expect(args.suggestions.map(s => s.value)).toEqual(['slow', 'fast']);
    });

    it('inserts with the trigger and onInsert of the list the item came from', async () => {
        const singleInsert = vi.fn();
        const doubleInsert = vi.fn();
        const single = createSuggestionList({ trigger: '#', suggestions: ['#tag'], onInsert: singleInsert });
        const double = createSuggestionList({ trigger: '##', suggestions: ['team'], onInsert: doubleInsert });
        setup(<Field lists={[single, double]} />);
        const input = screen.getByTestId<HTMLInputElement>('field');
        await typeInto(input, 'see ##t');
        expect(itemLabels()).toEqual(['#tag', 'team']);

        // "##" list strips both hashes, the "#" list would have kept one.
        fireEvent.mouseDown(screen.getAllByTestId('item')[1]!);
        expect(input.value).toBe('see team');
        expect(doubleInsert).toHaveBeenCalledWith({ value: 'team', label: 'team' }, input);
        expect(singleInsert).not.toHaveBeenCalled();
    });

    it('renders nothing at all when no renderMenu is configured', async () => {
        const list = createSuggestionList({ trigger: '#', suggestions: ['hello'] });
        const { container } = render(
            <AutoSuggestProvider>
                <Field lists={[list]} />
            </AutoSuggestProvider>
        );
        await typeInto(screen.getByTestId<HTMLInputElement>('field'), '#h');
        expect(container.querySelectorAll('*').length).toBe(1); // only the input
    });

    it('exposes render arguments: groups, suggestions, element, position and close', async () => {
        const spy = vi.fn<RenderMenu>(() => null);
        const list = createSuggestionList({ trigger: '#', suggestions: ['hello'] });
        setup(<Field lists={[list]} />, { renderMenu: spy });
        const input = screen.getByTestId<HTMLInputElement>('field');
        await typeInto(input, 'a #he');

        const args = spy.mock.calls[spy.mock.calls.length - 1]![0];
        expect(args.groups).toHaveLength(1);
        expect(args.groups[0]!.keyword).toBe('he');
        expect(args.groups[0]!.list).toBe(list);
        expect(args.suggestions).toEqual([{ value: 'hello', label: 'hello' }]);
        expect(args.element).toBe(input);
        expect(args.position).toEqual({ top: expect.any(Number), left: expect.any(Number) });

        act(() => args.close());
        expect(input.dataset.open).toBe('false');
    });

    it('supports the insert helper passed to renderMenuItem', async () => {
        const list = createSuggestionList({
            trigger: '#',
            suggestions: ['hello'],
            renderMenuItem: ({ suggestion, insert }) => <button data-testid="btn" onClick={insert}>{suggestion.label}</button>
        });
        setup(<Field lists={[list]} />);
        const input = screen.getByTestId<HTMLInputElement>('field');
        await typeInto(input, '#h');
        fireEvent.click(screen.getByTestId('btn'));
        expect(input.value).toBe('hello');
    });

    it('only one field owns the menu at a time', async () => {
        const list = createSuggestionList({ trigger: '#', suggestions: ['hello'] });
        setup(
            <>
                <Field lists={[list]} testId="one" />
                <Field lists={[list]} testId="two" />
            </>
        );
        const one = screen.getByTestId<HTMLInputElement>('one');
        const two = screen.getByTestId<HTMLInputElement>('two');
        await typeInto(one, '#h');
        expect(one.dataset.open).toBe('true');
        expect(two.dataset.open).toBe('false');
        await typeInto(two, '#h');
        expect(one.dataset.open).toBe('false');
        expect(two.dataset.open).toBe('true');
        expect(screen.getAllByTestId('menu')).toHaveLength(1);
    });

});

describe('useAutoSuggest – contenteditable', () => {
    it('opens on the current text node and inserts a text node', async () => {
        const onInsert = vi.fn();
        const list = createSuggestionList({ trigger: '@', suggestions: [{ value: '@ambula', label: 'Ambula V' }], onInsert });
        setup(<Editable lists={[list]} />);
        const editable = screen.getByTestId('editable');
        editable.textContent = 'hi @am';
        setCaret(editable.firstChild!, 6);
        await fire(() => fireEvent.keyUp(editable));

        expect(itemLabels()).toEqual(['Ambula V']);
        fireEvent.mouseDown(screen.getByTestId('item'));

        expect(editable.textContent).toBe('hi @ambula');
        const [suggestion, node] = onInsert.mock.calls[0]!;
        expect(suggestion).toEqual({ value: '@ambula', label: 'Ambula V' });
        expect(node).toBeInstanceOf(Text);
        expect((node as Text).nodeValue).toBe('@ambula');
        expect(editable.contains(node as Node)).toBe(true);
    });

    it('stays closed when the selection is outside the field', async () => {
        const list = createSuggestionList({ trigger: '@', suggestions: ['@x'] });
        setup(
            <>
                <Editable lists={[list]} />
                <p data-testid="outside">@x</p>
            </>
        );
        setCaret(screen.getByTestId('outside').firstChild!, 2);
        await fire(() => fireEvent.keyUp(screen.getByTestId('editable')));
        expect(screen.queryByTestId('menu')).toBeNull();
    });
});
