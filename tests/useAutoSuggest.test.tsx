import { useState } from 'react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AutoSuggestProvider, createSuggestionList, useAutoSuggest } from '../src';
import type {
    AutoSuggestProviderProps,
    RenderMenu,
    RenderMenuItem,
    SuggestionInput,
    UseAutoSuggestOptions
} from '../src';

const renderMenu: RenderMenu = ({ getMenuProps, items, loading }) => (
    <ul data-testid="menu" {...getMenuProps()}>
        {items}
        {loading && <li data-testid="loader">Loading</li>}
    </ul>
);

const renderMenuItem: RenderMenuItem = ({ getItemProps, suggestion }) => (
    <li data-testid="item" {...getItemProps()}>{suggestion.label}</li>
);

type FieldType = 'input' | 'textarea' | 'contenteditable';

interface FieldProps {
    type?: FieldType;
    options: UseAutoSuggestOptions;
    userProps?: Record<string, unknown>;
}

function Field({ type = 'input', options, userProps }: FieldProps) {
    const { getInputProps } = useAutoSuggest(options);
    const props = { 'data-testid': 'field', ...getInputProps(userProps) };

    if (type === 'input') return <input type="text" {...props} />;
    if (type === 'textarea') return <textarea {...props} />;
    return <div contentEditable suppressContentEditableWarning {...props} />;
}

function setup(field: ReactNode, providerProps?: Partial<AutoSuggestProviderProps>) {
    const result = render(
        <AutoSuggestProvider renderMenu={renderMenu} renderMenuItem={renderMenuItem} {...providerProps}>
            {field}
        </AutoSuggestProvider>
    );

    return { ...result, user: userEvent.setup(), field: screen.getByTestId('field') };
}

const labels = () => screen.queryAllByTestId('item').map(item => item.textContent);
const getValue = (field: HTMLElement) => (
    'value' in field ? (field as HTMLInputElement).value : field.textContent
);

// Type into contenteditable: jsdom has no editing support, so set the text and the caret manually
async function typeIntoContentEditable(field: HTMLElement, text: string, caret = text.length) {
    field.focus();
    field.textContent = text;
    window.getSelection()!.collapse(field.firstChild, caret);
    await act(async () => { fireEvent.keyUp(field); });
}

// Suggestions are resolved asynchronously
async function mouseUp(field: HTMLElement) {
    await act(async () => { fireEvent.mouseUp(field); });
}

const hashList = { trigger: '#', values: ['hello', 'world'] };

describe('headless', () => {
    it('renders nothing but the elements of the consumer', async () => {
        const { container, user, field } = setup(<Field options={{ suggestions: [hashList] }} />);
        expect(container.innerHTML).toBe('<input data-testid="field" type="text">');

        await user.type(field, '#');
        expect(container.children).toHaveLength(2);
        expect(container.lastElementChild).toBe(screen.getByTestId('menu'));
        expect(document.body.children).toHaveLength(1);

        // the clone used to measure the caret position is removed
        expect(document.getElementById('autosuggest-positionclone')).toBeNull();
    });

    it('throws when used outside the provider', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        expect(() => render(<Field options={{ suggestions: [] }} />)).toThrow('AutoSuggestProvider');
        error.mockRestore();
    });

    it('throws for unsupported elements', async () => {
        function Unsupported() {
            const { getInputProps } = useAutoSuggest({ suggestions: [hashList] });
            return <input type="email" data-testid="field" {...getInputProps()} />;
        }

        // errors thrown from React event handlers are reported on window
        const errors: string[] = [];
        const onError = (e: ErrorEvent) => { errors.push(e.message); e.preventDefault(); };
        window.addEventListener('error', onError);

        const { field } = setup(<Unsupported />);
        fireEvent.keyUp(field);
        window.removeEventListener('error', onError);

        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain('only input[type = text], textarea and contenteditable elements are supported');
    });
});

describe.each<FieldType>(['input', 'textarea'])('%s', type => {
    it('shows all the values on typing the trigger', async () => {
        const { user, field } = setup(<Field type={type} options={{ suggestions: [hashList] }} />);
        await user.type(field, 'say #');
        expect(labels()).toEqual(['hello', 'world']);
    });

    it('filters the values by keyword, ignoring the case', async () => {
        const { user, field } = setup(<Field type={type} options={{ suggestions: [hashList] }} />);
        await user.type(field, '#H');
        expect(labels()).toEqual(['hello']);

        await user.type(field, 'x');
        expect(screen.queryByTestId('menu')).toBeNull();
    });

    it('does not show the dropdown when the next character belongs to the word', async () => {
        const { user, field } = setup(<Field type={type} options={{ suggestions: [hashList] }} />);
        await user.type(field, '#he');
        expect(labels()).toEqual(['hello']);

        await user.keyboard('{ArrowLeft}');
        expect(screen.queryByTestId('menu')).toBeNull();
    });

    it('shows the dropdown when the rest of the keyword is selected', async () => {
        const { user, field } = setup(<Field type={type} options={{ suggestions: [hashList] }} />);
        await user.type(field, '#he');
        (field as HTMLInputElement).setSelectionRange(2, 3);
        await mouseUp(field);
        expect(labels()).toEqual(['hello']);
    });

    it('replaces "trigger + keyword" with the value and calls onInsert with the field', async () => {
        const onInsert = vi.fn();
        const { user, field } = setup(<Field type={type} options={{ suggestions: [{ ...hashList, onInsert }] }} />);
        await user.type(field, 'say #he');
        fireEvent.mouseDown(screen.getByText('hello'));

        expect(getValue(field)).toBe('say hello');
        expect((field as HTMLInputElement).selectionStart).toBe(9);
        expect(document.activeElement).toBe(field);
        expect(screen.queryByTestId('menu')).toBeNull();
        expect(onInsert).toHaveBeenCalledTimes(1);
        expect(onInsert).toHaveBeenCalledWith({ value: 'hello', label: 'hello' }, field);
    });

    it('retains the text after the caret and replaces the selection', async () => {
        const { user, field } = setup(<Field type={type} options={{ suggestions: [hashList] }} />);
        await user.type(field, '#wor !');
        (field as HTMLInputElement).setSelectionRange(2, 4);
        await mouseUp(field);
        fireEvent.mouseDown(screen.getByText('world'));

        expect(getValue(field)).toBe('world !');
    });

    it('supports triggers with multiple characters', async () => {
        const list = { trigger: '##', values: ['hello'] };
        const { user, field } = setup(<Field type={type} options={{ suggestions: [list] }} />);
        await user.type(field, '#h');
        expect(screen.queryByTestId('menu')).toBeNull();

        await user.clear(field);
        await user.type(field, '##h');
        fireEvent.mouseDown(screen.getByText('hello'));
        expect(getValue(field)).toBe('hello');
    });

    it('uses space as trigger when the list has no trigger', async () => {
        const { user, field } = setup(<Field type={type} options={{ suggestions: [['hello', 'world']] }} />);
        await user.type(field, 'say wo');
        fireEvent.mouseDown(screen.getByText('world'));
        expect(getValue(field)).toBe('say world');
    });
});

describe('contenteditable', () => {
    it('shows and filters the values', async () => {
        const { field } = setup(<Field type="contenteditable" options={{ suggestions: [hashList] }} />);
        await typeIntoContentEditable(field, 'say #');
        expect(labels()).toEqual(['hello', 'world']);

        await typeIntoContentEditable(field, 'say #W');
        expect(labels()).toEqual(['world']);

        await typeIntoContentEditable(field, 'say #he', 6);
        expect(screen.queryByTestId('menu')).toBeNull();
    });

    it('leaves the content and selection untouched after measuring the caret position', async () => {
        const { field } = setup(<Field type="contenteditable" options={{ suggestions: [hashList] }} />);
        await typeIntoContentEditable(field, 'say #he !', 7);

        expect(labels()).toEqual(['hello']);
        expect(field.innerHTML).toBe('say #he !');
        expect(window.getSelection()!.anchorNode).toBe(field.firstChild);
        expect(window.getSelection()!.anchorOffset).toBe(7);
    });

    it('inserts the value as a text node and calls onInsert with the inserted node', async () => {
        const onInsert = vi.fn();
        const onInput = vi.fn();
        const { field } = setup(
            <Field type="contenteditable" options={{ suggestions: [{ ...hashList, onInsert }] }} userProps={{ onInput }} />
        );

        await typeIntoContentEditable(field, 'say #he !', 7);
        fireEvent.mouseDown(screen.getByText('hello'));

        expect(field.textContent).toBe('say hello !');
        expect(screen.queryByTestId('menu')).toBeNull();
        expect(onInput).toHaveBeenCalledTimes(1);

        const [suggestion, node] = onInsert.mock.calls[0];
        expect(suggestion).toEqual({ value: 'hello', label: 'hello' });
        expect(node.nodeType).toBe(Node.TEXT_NODE);
        expect(node.nodeValue).toBe('hello');
        expect(field.contains(node)).toBe(true);

        // caret is placed right after the inserted value
        const selection = window.getSelection()!;
        expect(selection.isCollapsed).toBe(true);
        expect(selection.anchorNode).toBe(node);
        expect(selection.anchorOffset).toBe(5);
    });

    it('allows replacing the inserted node with custom DOM from onInsert', async () => {
        const list = createSuggestionList({
            trigger: '@',
            values: [{ value: '@John', label: 'Peter John' }],
            onInsert: (suggestion, node) => {
                const link = document.createElement('a');
                link.textContent = suggestion.value;
                node.parentNode!.replaceChild(link, node);
            }
        });

        const { field } = setup(<Field type="contenteditable" options={{ suggestions: [list] }} />);
        await typeIntoContentEditable(field, 'hi @pe');
        fireEvent.mouseDown(screen.getByText('Peter John'));

        expect(field.innerHTML).toBe('hi <a>@John</a>');
    });
});

describe('renderInsert', () => {
    // errors thrown from React event handlers are reported on window
    function captureErrors() {
        const errors: string[] = [];
        const onError = (e: ErrorEvent) => { errors.push(e.message); e.preventDefault(); };
        window.addEventListener('error', onError);
        return { errors, release: () => window.removeEventListener('error', onError) };
    }

    const mention = { value: '@John', label: 'Peter John' };

    it.each<FieldType>(['input', 'textarea'])('inserts the text into %s and ignores the node', async type => {
        const renderInsert = vi.fn(() => ({ text: '[John]', node: <a href="/john">@John</a> }));
        const onInsert = vi.fn();
        const list = { trigger: '@', values: [mention], renderInsert, onInsert };

        const { user, field } = setup(<Field type={type} options={{ suggestions: [list] }} />);
        await user.type(field, 'hi @pe');
        fireEvent.mouseDown(screen.getByText('Peter John'));

        expect(getValue(field)).toBe('hi [John]');
        expect((field as HTMLInputElement).selectionStart).toBe(9);
        expect(renderInsert).toHaveBeenCalledWith({ suggestion: mention, keyword: 'pe', trigger: '@', element: field });
        expect(onInsert).toHaveBeenCalledWith(mention, field);
    });

    it.each<FieldType>(['input', 'textarea'])('throws when there is no text for %s, without touching the field', async type => {
        const list = { trigger: '@', values: [mention], renderInsert: () => ({ node: <a>@John</a> }) };
        const { user, field } = setup(<Field type={type} options={{ suggestions: [list] }} />);
        await user.type(field, 'hi @pe');

        const { errors, release } = captureErrors();
        fireEvent.mouseDown(screen.getByText('Peter John'));
        release();

        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain('renderInsert should return text for input and textarea');
        expect(getValue(field)).toBe('hi @pe');
    });

    it('inserts the node into contenteditable as static DOM and places the caret after it', async () => {
        const onInsert = vi.fn();
        const onInput = vi.fn();
        const list = {
            trigger: '@',
            values: [mention],
            onInsert,
            renderInsert: ({ suggestion }: { suggestion: { value: string } }) => ({
                text: 'ignored',
                node: <a href="/john" className="mention">{suggestion.value}</a>
            })
        };

        const { field } = setup(<Field type="contenteditable" options={{ suggestions: [list] }} userProps={{ onInput }} />);
        await typeIntoContentEditable(field, 'hi @pe !', 6);
        fireEvent.mouseDown(screen.getByText('Peter John'));

        expect(field.innerHTML).toBe('hi <a href="/john" class="mention">@John</a> !');
        expect(onInput).toHaveBeenCalledTimes(1);
        expect(screen.queryByTestId('menu')).toBeNull();

        const link = field.querySelector('a')!;
        expect(onInsert).toHaveBeenCalledWith(mention, link);

        const selection = window.getSelection()!;
        expect(selection.isCollapsed).toBe(true);
        expect(selection.anchorNode).toBe(field);
        expect(selection.anchorOffset).toBe(Array.from(field.childNodes).indexOf(link) + 1);
    });

    it('inserts all the nodes of a fragment, caret goes to the end of a trailing text', async () => {
        const onInsert = vi.fn();
        const list = {
            trigger: '@',
            values: [mention],
            onInsert,
            renderInsert: () => ({ node: <><b>@John</b>{' '}<i>(Peter)</i>{', '}</> })
        };

        const { field } = setup(<Field type="contenteditable" options={{ suggestions: [list] }} />);
        await typeIntoContentEditable(field, '@pe');
        fireEvent.mouseDown(screen.getByText('Peter John'));

        expect(field.innerHTML).toBe('<b>@John</b> <i>(Peter)</i>, ');
        expect(onInsert.mock.calls[0][1]).toBe(field.querySelector('b'));

        const selection = window.getSelection()!;
        expect(selection.anchorNode).toBe(field.lastChild);
        expect(selection.anchorOffset).toBe(2);
    });

    it.each([
        ['undefined', undefined],
        ['null', null],
        ['rendering nothing', false]
    ])('uses the text for contenteditable when the node is %s', async (_name, node) => {
        const list = { trigger: '@', values: [mention], renderInsert: () => ({ text: '[John]', node }) };
        const { field } = setup(<Field type="contenteditable" options={{ suggestions: [list] }} />);
        await typeIntoContentEditable(field, 'hi @pe');
        fireEvent.mouseDown(screen.getByText('Peter John'));

        expect(field.innerHTML).toBe('hi [John]');
    });

    it('throws when there is neither text nor node for contenteditable, without touching the field', async () => {
        const list = { trigger: '@', values: [mention], renderInsert: () => ({}) };
        const { field } = setup(<Field type="contenteditable" options={{ suggestions: [list] }} />);
        await typeIntoContentEditable(field, 'hi @pe');

        const { errors, release } = captureErrors();
        fireEvent.mouseDown(screen.getByText('Peter John'));
        release();

        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain('renderInsert should return text or node for contenteditable');
        expect(field.innerHTML).toBe('hi @pe');
    });

    it('belongs to the list, the other lists insert the value', async () => {
        const lists = [
            { trigger: '#', values: ['hello'], renderInsert: () => ({ text: '<hello>' }) },
            { trigger: '#', values: ['help'] }
        ];

        const { user, field } = setup(<Field options={{ suggestions: lists }} />);
        await user.type(field, '#he');
        fireEvent.mouseDown(screen.getByText('help'));
        expect(getValue(field)).toBe('help');

        await user.clear(field);
        await user.type(field, '#he');
        fireEvent.mouseDown(screen.getByText('hello'));
        expect(getValue(field)).toBe('<hello>');
    });
});

describe('controlled input', () => {
    it('notifies React about the inserted value', async () => {
        const onChange = vi.fn();
        function Controlled() {
            const [value, setValue] = useState('');
            const { getInputProps } = useAutoSuggest({ suggestions: [hashList] });
            return (
                <input
                    type="text"
                    data-testid="field"
                    value={value}
                    onChange={e => { onChange(e.target.value); setValue(e.target.value); }}
                    {...getInputProps()}
                />
            );
        }

        const { user, field } = setup(<Controlled />);
        await user.type(field, 'say #he');
        fireEvent.mouseDown(screen.getByText('hello'));

        expect(onChange).toHaveBeenLastCalledWith('say hello');
        expect(getValue(field)).toBe('say hello');
        expect((field as HTMLInputElement).selectionStart).toBe(9);
    });
});

describe('options', () => {
    const many = Array.from({ length: 15 }, (_, i) => `item${i}`);

    it('shows 10 suggestions by default', async () => {
        const { user, field } = setup(<Field options={{ suggestions: [{ trigger: '#', values: many }] }} />);
        await user.type(field, '#');
        expect(labels()).toHaveLength(10);
    });

    it('resolves maxSuggestions from list, then hook, then provider', async () => {
        const lists = [
            { trigger: '#', values: many },
            { trigger: '@', values: many, maxSuggestions: 2 }
        ];

        const { user, field, unmount } = setup(<Field options={{ suggestions: lists }} />, { maxSuggestions: 5 });
        await user.type(field, '#');
        expect(labels()).toHaveLength(5);
        await user.type(field, ' @');
        expect(labels()).toHaveLength(2);
        unmount();

        const next = setup(<Field options={{ suggestions: lists, maxSuggestions: 3 }} />, { maxSuggestions: 5 });
        await next.user.type(next.field, '#');
        expect(labels()).toHaveLength(3);
    });

    it('keeps the label based matches when the suggestions are limited by maxSuggestions', async () => {
        const list = {
            trigger: '@',
            maxSuggestions: 1,
            values: [{ value: '@john', label: 'Peter Parker' }, { value: '@peter', label: 'John Doe' }]
        };

        const { user, field } = setup(<Field options={{ suggestions: [list] }} />);
        await user.type(field, '@jo');
        expect(labels()).toEqual(['John Doe']);
    });

    it('resolves caseSensitive from list, then hook, then provider', async () => {
        const lists = [
            { trigger: '#', values: ['hello'] },
            { trigger: '@', values: ['hello'], caseSensitive: false }
        ];

        const { user, field } = setup(<Field options={{ suggestions: lists }} />, { caseSensitive: true });
        await user.type(field, '#H');
        expect(screen.queryByTestId('menu')).toBeNull();
        await user.type(field, ' #h');
        expect(labels()).toEqual(['hello']);
        await user.type(field, ' @H');
        expect(labels()).toEqual(['hello']);
    });

    it('prefers renderMenuItem of the list, then hook, then provider', async () => {
        const item = (id: string): RenderMenuItem => ({ getItemProps, suggestion, keyword, trigger, index }) => (
            <li data-testid={id} {...getItemProps()}>{`${index}:${trigger}${keyword}:${suggestion.value}`}</li>
        );

        const list = createSuggestionList({ trigger: '@', values: ['hello'], renderMenuItem: item('list-item') });
        const { user, field, unmount } = setup(<Field options={{ suggestions: [hashList, list] }} />);
        await user.type(field, '@he');
        expect(screen.getByTestId('list-item').textContent).toBe('0:@he:hello');

        await user.type(field, ' #he');
        expect(screen.queryByTestId('list-item')).toBeNull();
        expect(labels()).toEqual(['hello']);
        unmount();

        const next = setup(<Field options={{ suggestions: [hashList, list], renderMenuItem: item('hook-item') }} />);
        await next.user.type(next.field, '#he');
        expect(screen.getByTestId('hook-item').textContent).toBe('0:#he:hello');
        await next.user.type(next.field, ' @he');
        expect(screen.getByTestId('list-item')).toBeTruthy();
    });

    it('prefers renderMenu of the hook over the provider, lists can not have their own menu', async () => {
        const hookMenu: RenderMenu = ({ getMenuProps, items }) => <ol data-testid="hook-menu" {...getMenuProps()}>{items}</ol>;
        const { user, field } = setup(<Field options={{ suggestions: [hashList], renderMenu: hookMenu }} />);
        await user.type(field, '#he');
        expect(screen.queryByTestId('menu')).toBeNull();
        expect(screen.getByTestId('hook-menu').textContent).toBe('hello');

        // @ts-expect-error renderMenu is not an option of the list
        const list = createSuggestionList({ trigger: '#', values: [], renderMenu: hookMenu });
        expect(list).not.toHaveProperty('renderMenu');
    });
});

describe('multiple matching lists', () => {
    it('shows the results of all the matching lists, in the order of the lists', async () => {
        const lists = [
            { trigger: '#', values: ['nomatch'] },
            { trigger: '#', values: ['hello-second'] },
            { trigger: '#', values: ['hello-third', 'help-third'] }
        ];

        const { user, field } = setup(<Field options={{ suggestions: lists }} />);
        await user.type(field, '#he');
        expect(screen.getAllByTestId('menu')).toHaveLength(1);
        expect(labels()).toEqual(['hello-second', 'hello-third', 'help-third']);

        await user.type(field, 'lp');
        expect(labels()).toEqual(['help-third']);

        await user.type(field, 'x');
        expect(screen.queryByTestId('menu')).toBeNull();
    });

    it('never renders the loading state for the lists without a generator', async () => {
        const loadingStates: boolean[] = [];
        const menu: RenderMenu = props => {
            loadingStates.push(props.loading);
            return renderMenu(props);
        };

        const lists = [{ trigger: '#', values: ['hello'] }, { trigger: '#', values: ['help'] }];
        const { user, field } = setup(<Field options={{ suggestions: lists }} />, { renderMenu: menu });
        await user.type(field, '#he');

        expect(labels()).toEqual(['hello', 'help']);
        expect(loadingStates.length).toBeGreaterThan(0);
        expect(loadingStates).not.toContain(true);
    });

    it('passes the sections to renderMenu, without the lists having no results', async () => {
        const menu: RenderMenu = ({ getMenuProps, sections, items, suggestions }) => (
            <div data-testid="menu" data-total={`${items.length}:${suggestions.map(s => s.value)}`} {...getMenuProps()}>
                {sections.map((section, index) => (
                    <ul key={index} data-testid="section" data-info={`${section.trigger}:${section.keyword}:${section.suggestions.length}`}>
                        {section.items}
                    </ul>
                ))}
            </div>
        );

        const lists = [
            { trigger: '@', values: ['world'] },
            { trigger: '@', values: ['nomatch'] },
            { trigger: 'w', values: ['word', 'zebra'] }
        ];

        const { user, field } = setup(<Field options={{ suggestions: lists }} />, { renderMenu: menu });
        await user.type(field, '@wo');

        expect(screen.getByTestId('menu').dataset.total).toBe('2:world,word');
        expect(screen.getAllByTestId('section').map(section => section.dataset.info)).toEqual(['@:wo:1', 'w:o:1']);
        expect(screen.getAllByTestId('section').map(section => section.textContent)).toEqual(['world', 'word']);
    });

    it('inserts with the trigger and onInsert of the list owning the suggestion', async () => {
        const onInsertAt = vi.fn();
        const onInsertW = vi.fn();
        const lists = [
            { trigger: '@', values: ['world'], onInsert: onInsertAt },
            { trigger: 'w', values: ['word'], onInsert: onInsertW }
        ];

        const { user, field } = setup(<Field options={{ suggestions: lists }} />);
        await user.type(field, '@wo');
        fireEvent.mouseDown(screen.getByText('word'));
        expect(getValue(field)).toBe('@word');
        expect(onInsertW).toHaveBeenCalledTimes(1);
        expect(onInsertAt).not.toHaveBeenCalled();

        await user.clear(field);
        await user.type(field, '@wo');
        fireEvent.mouseDown(screen.getByText('world'));
        expect(getValue(field)).toBe('world');
        expect(onInsertAt).toHaveBeenCalledTimes(1);
    });

    it('applies maxSuggestions and renderMenuItem per list, index runs across the lists', async () => {
        const many = Array.from({ length: 5 }, (_, i) => `item${i}`);
        const lists = [
            { trigger: '#', values: many, maxSuggestions: 2 },
            {
                trigger: '#',
                values: many,
                renderMenuItem: (({ getItemProps, suggestion, index }) => (
                    <li data-testid="item" {...getItemProps()}>{`${index}-${suggestion.label}`}</li>
                )) as RenderMenuItem
            }
        ];

        const { user, field } = setup(<Field options={{ suggestions: lists, maxSuggestions: 3 }} />);
        await user.type(field, '#');
        expect(labels()).toEqual(['item0', 'item1', '2-item0', '3-item1', '4-item2']);
    });

    it('does not reopen the dropdown with the mouseup of the click which inserted the suggestion', async () => {
        const { user, field } = setup(<Field options={{ suggestions: [['simillar1', 'simillar12']] }} />);
        await user.type(field, 'simi');
        fireEvent.mouseDown(screen.getByText('simillar1'));

        // dropdown is gone, so the mouseup lands on the field
        await mouseUp(field);
        expect(screen.queryByTestId('menu')).toBeNull();

        await new Promise(resolve => setTimeout(resolve, 0));
        await mouseUp(field);
        expect(labels()).toEqual(['simillar12']);
    });
});

describe('menu props', () => {
    it('places the menu at the caret position and lets the consumer extend the props', async () => {
        const onMouseDown = vi.fn();
        const menu: RenderMenu = ({ getMenuProps, items, position, element, sections, suggestions }) => (
            <ul
                data-testid="menu"
                data-info={`${element.tagName}:${sections[0].trigger}:${sections[0].keyword}:${suggestions.length}:${position.top}:${position.left}`}
                {...getMenuProps({ className: 'menu', style: { zIndex: 5 }, onMouseDown })}
            >
                {items}
            </ul>
        );

        const { user, field } = setup(<Field options={{ suggestions: [hashList] }} />, { renderMenu: menu });
        await user.type(field, '#w');

        const element = screen.getByTestId('menu');
        expect(element.className).toBe('menu');
        expect(element.style.position).toBe('absolute');
        expect(element.style.zIndex).toBe('5');
        expect(element.style.top).toMatch(/^\d+(\.\d+)?px$/);
        expect(element.style.left).toMatch(/^\d+(\.\d+)?px$/);
        expect(element.dataset.info).toMatch(/^INPUT:#:w:1:/);

        // mousedown on the menu should not move the focus out of the field
        expect(fireEvent.mouseDown(element)).toBe(false);
        expect(onMouseDown).toHaveBeenCalledTimes(1);
    });

    it('composes the consumer handlers of input and closes the dropdown on blur', async () => {
        const onBlur = vi.fn();
        const onKeyUp = vi.fn();
        const { user, field } = setup(<Field options={{ suggestions: [hashList] }} userProps={{ onBlur, onKeyUp }} />);

        await user.type(field, '#');
        expect(onKeyUp).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId('menu')).toBeTruthy();

        await user.tab();
        expect(onBlur).toHaveBeenCalledTimes(1);
        expect(screen.queryByTestId('menu')).toBeNull();
    });

    it('closes the dropdown when the field is unmounted', async () => {
        function Toggle() {
            const [show, setShow] = useState(true);
            return (
                <>
                    <button onMouseDown={e => e.preventDefault()} onClick={() => setShow(false)}>hide</button>
                    {show && <Field options={{ suggestions: [hashList] }} />}
                </>
            );
        }

        const { user, field } = setup(<Toggle />);
        await user.type(field, '#');
        expect(screen.getByTestId('menu')).toBeTruthy();

        fireEvent.click(screen.getByText('hide'));
        expect(screen.queryByTestId('menu')).toBeNull();
    });
});

describe('keyboard navigation', () => {
    it('is not handled by the plugin', async () => {
        const { user, field } = setup(<Field type="textarea" options={{ suggestions: [hashList] }} />);
        await user.type(field, '#');

        expect(fireEvent.keyDown(field, { key: 'ArrowDown', keyCode: 40 })).toBe(true);
        expect(fireEvent.keyDown(field, { key: 'Tab', keyCode: 9 })).toBe(true);
        expect(fireEvent.keyDown(field, { key: 'Escape', keyCode: 27 })).toBe(true);
        expect(labels()).toEqual(['hello', 'world']);

        await user.keyboard('{Enter}');
        expect(getValue(field)).toBe('#\n');
    });
});

describe('async suggestion generator', () => {
    function deferred() {
        const calls: Array<{ keyword: string; resolve: (suggestions: SuggestionInput[]) => void }> = [];
        const values = (keyword: string) => new Promise<SuggestionInput[]>(resolve => { calls.push({ keyword, resolve }); });
        return { calls, values };
    }

    it('renders the menu in loading state until the suggestions are available', async () => {
        const { calls, values } = deferred();
        const { user, field } = setup(<Field options={{ suggestions: [{ trigger: '#', values }] }} />);

        await user.type(field, '#h');
        expect(await screen.findByTestId('loader')).toBeTruthy();
        expect(labels()).toEqual([]);

        await act(async () => calls[calls.length - 1].resolve(['hello', { value: 'hi', label: 'Hi there' }]));
        expect(screen.queryByTestId('loader')).toBeNull();
        expect(labels()).toEqual(['hello', 'Hi there']);

        fireEvent.mouseDown(screen.getByText('Hi there'));
        expect(getValue(field)).toBe('hi');
    });

    it('closes the loader when there are no suggestions', async () => {
        const { calls, values } = deferred();
        const { user, field } = setup(<Field options={{ suggestions: [{ trigger: '#', values }] }} />);

        await user.type(field, '#');
        await screen.findByTestId('loader');

        await act(async () => calls[0].resolve([]));
        expect(screen.queryByTestId('menu')).toBeNull();
    });

    it('ignores the results of older keywords', async () => {
        const { calls, values } = deferred();
        const { user, field } = setup(<Field options={{ suggestions: [{ trigger: '#', values }] }} />);

        await user.type(field, '#he');
        expect(calls.map(call => call.keyword)).toEqual(['', 'h', 'he']);

        await act(async () => calls[1].resolve(['stale']));
        expect(labels()).toEqual([]);

        await act(async () => calls[2].resolve(['fresh']));
        expect(labels()).toEqual(['fresh']);
    });

    it('ignores the results arriving after blur', async () => {
        const { calls, values } = deferred();
        const { user, field } = setup(<Field options={{ suggestions: [{ trigger: '#', values }] }} />);

        await user.type(field, '#');
        await user.tab();
        await act(async () => calls[0].resolve(['late']));

        await waitFor(() => expect(screen.queryByTestId('menu')).toBeNull());
    });

    it('shows the results as they arrive, in the order of the lists, loading until all the lists are done', async () => {
        const first = deferred();
        const third = deferred();
        const lists = [
            { trigger: '#', values: first.values },
            { trigger: '#', values: ['hello-sync'] },
            { trigger: '#', values: third.values }
        ];

        const { user, field } = setup(<Field options={{ suggestions: lists }} />);
        await user.type(field, '#');
        expect(labels()).toEqual(['hello-sync']);
        expect(screen.getByTestId('loader')).toBeTruthy();

        await act(async () => third.calls[0].resolve(['hello-third']));
        expect(labels()).toEqual(['hello-sync', 'hello-third']);
        expect(screen.getByTestId('loader')).toBeTruthy();

        await act(async () => first.calls[0].resolve(['hello-first']));
        expect(labels()).toEqual(['hello-first', 'hello-sync', 'hello-third']);
        expect(screen.queryByTestId('loader')).toBeNull();
    });

    it('closes the dropdown when none of the lists have results', async () => {
        const { calls, values } = deferred();
        const lists = [{ trigger: '#', values }, { trigger: '#', values: ['hello'] }];
        const { user, field } = setup(<Field options={{ suggestions: lists }} />);

        await user.type(field, '#x');
        expect(labels()).toEqual([]);
        expect(screen.getByTestId('loader')).toBeTruthy();

        await act(async () => calls[calls.length - 1].resolve([]));
        expect(screen.queryByTestId('menu')).toBeNull();
    });

    it('shows the other lists when a generator fails, the error is left unhandled for the consumer', async () => {
        // vitest fails the run for unhandled rejections, take over for this test
        const listeners = process.listeners('unhandledRejection');
        const unhandled = vi.fn();
        process.removeAllListeners('unhandledRejection');
        process.on('unhandledRejection', unhandled);

        const lists = [
            { trigger: '#', values: () => Promise.reject(new Error('network')) },
            { trigger: '#', values: ['hello'] }
        ];

        const { user, field } = setup(<Field options={{ suggestions: lists }} />);
        await user.type(field, '#');
        await new Promise(resolve => setTimeout(resolve, 0));

        process.removeAllListeners('unhandledRejection');
        listeners.forEach(listener => process.on('unhandledRejection', listener));

        expect(labels()).toEqual(['hello']);
        expect(screen.queryByTestId('loader')).toBeNull();
        expect(unhandled).toHaveBeenCalledTimes(1);
        expect(unhandled.mock.calls[0][0].message).toBe('network');
    });

    it('passes the field to the generator', async () => {
        const values = vi.fn(async (keyword: string, element: HTMLElement) => (
            [`${keyword}-${element.tagName}`]
        ));

        const { user, field } = setup(<Field type="textarea" options={{ suggestions: [{ trigger: '#', values }] }} />);
        await user.type(field, '#x');
        expect(await screen.findByText('x-TEXTAREA')).toBeTruthy();
    });
});
