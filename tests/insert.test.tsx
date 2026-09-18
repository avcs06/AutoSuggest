import { describe, expect, it, vi } from 'vitest';
import { insertSuggestion } from '../src/insert';
import { renderToNode } from '../src/renderToNode';
import { setCaret, setInputCaret } from './helpers';

const suggestion = { text: 'world' };

describe('insertSuggestion – input / textarea', () => {
    it('replaces trigger + keyword and moves the caret after the inserted value', () => {
        const input = document.createElement('input');
        input.type = 'text';
        document.body.appendChild(input);
        input.value = 'hello #wo and more';
        setInputCaret(input, 9);

        const node = insertSuggestion(input, suggestion, '#');

        expect(input.value).toBe('hello world and more');
        expect(input.selectionStart).toBe(11);
        expect(input.selectionEnd).toBe(11);
        expect(node).toBe(input);
        input.remove();
    });

    it('keeps the whitespace trigger when no trigger is configured', () => {
        const textarea = document.createElement('textarea');
        document.body.appendChild(textarea);
        textarea.value = 'say wo';
        setInputCaret(textarea, 6);

        insertSuggestion(textarea, suggestion);
        expect(textarea.value).toBe('say world');
        textarea.remove();
    });

    it('drops selected text and dispatches an input event', () => {
        const input = document.createElement('input');
        input.type = 'text';
        document.body.appendChild(input);
        input.value = '@wo123 tail';
        setInputCaret(input, 3, 6);
        const onInput = vi.fn();
        input.addEventListener('input', onInput);

        insertSuggestion(input, suggestion, '@');
        expect(input.value).toBe('world tail');
        expect(onInput).toHaveBeenCalledTimes(1);
        input.remove();
    });

    it('throws for unsupported elements', () => {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        expect(() => insertSuggestion(checkbox, suggestion)).toThrow(/Invalid input/);
    });

    it('requires non-empty text and ignores node', () => {
        const input = document.createElement('input');
        input.type = 'text';
        document.body.appendChild(input);
        input.value = '#wo';
        setInputCaret(input, 3);
        expect(() => insertSuggestion(input, { node: <b>bold</b> }, '#')).toThrow(/non-empty `text` for input/);
        expect(() => insertSuggestion(input, { text: '' }, '#')).toThrow(/non-empty `text` for input/);
        insertSuggestion(input, { text: 'plain', node: <b>bold</b> }, '#');
        expect(input.value).toBe('plain');
        input.remove();
    });
});

describe('insertSuggestion – contenteditable', () => {
    const makeEditable = (html: string) => {
        const div = document.createElement('div');
        div.setAttribute('contenteditable', 'true');
        div.innerHTML = html;
        document.body.appendChild(div);
        return div;
    };

    it('inserts a new text node in place of trigger + keyword and returns it', () => {
        const div = makeEditable('hello #wo');
        setCaret(div.firstChild!, 9);

        const node = insertSuggestion(div, suggestion, '#');

        expect(div.textContent).toBe('hello world');
        expect(node).toBeInstanceOf(Text);
        expect(node?.nodeValue).toBe('world');
        expect(node?.parentNode).toBe(div);

        const range = window.getSelection()!.getRangeAt(0);
        expect(range.startContainer).toBe(node);
        expect(range.startOffset).toBe(5);
        expect(range.collapsed).toBe(true);
        div.remove();
    });

    it('preserves text after the caret in a separate node', () => {
        const div = makeEditable('a @wo b');
        setCaret(div.firstChild!, 5);

        insertSuggestion(div, suggestion, '@');
        expect(div.textContent).toBe('a world b');
        expect(div.childNodes.length).toBe(3);
        div.remove();
    });

    it('removes nodes spanned by a multi-node selection', () => {
        const div = makeEditable('#wo<b>bold</b>tail');
        const first = div.firstChild!;
        const last = div.lastChild!;
        const range = document.createRange();
        range.setStart(first, 3);
        range.setEnd(last, 2);
        const selection = window.getSelection()!;
        selection.removeAllRanges();
        selection.addRange(range);

        insertSuggestion(div, suggestion, '#');
        expect(div.textContent).toBe('worldil');
        expect(div.querySelector('b')).toBeNull();
        div.remove();
    });

    it('renders a ReactNode into the field, returns the root node and places the caret after it', () => {
        const div = makeEditable('hi @am tail');
        setCaret(div.firstChild!, 6);

        const node = insertSuggestion(div, { text: '@ambula', node: <a href="/u/ambula" className="mention">@AmbulaV</a> }, '@');

        expect(node).toBeInstanceOf(HTMLAnchorElement);
        expect((node as HTMLAnchorElement).getAttribute('href')).toBe('/u/ambula');
        expect((node as HTMLAnchorElement).className).toBe('mention');
        expect(div.innerHTML).toBe('hi <a href="/u/ambula" class="mention">@AmbulaV</a> tail');

        const range = window.getSelection()!.getRangeAt(0);
        expect(range.collapsed).toBe(true);
        expect(range.startContainer).toBe(div);
        expect(range.startOffset).toBe(Array.from(div.childNodes).indexOf(node as ChildNode) + 1);
        div.remove();
    });

    it('falls back to text when node is omitted and requires one of them', () => {
        const div = makeEditable('#wo');
        setCaret(div.firstChild!, 3);
        const node = insertSuggestion(div, { text: 'from-text' }, '#');
        expect(node).toBeInstanceOf(Text);
        expect(div.textContent).toBe('from-text');

        setCaret(node!, 0);
        expect(() => insertSuggestion(div, {}, '#')).toThrow(/`node` or a non-empty `text` for contenteditable/);
        div.remove();
    });

    it('returns null when there is no selection', () => {
        const div = makeEditable('text');
        window.getSelection()!.removeAllRanges();
        expect(insertSuggestion(div, suggestion)).toBeNull();
        div.remove();
    });
});

describe('renderToNode', () => {
    it('returns a detached clone of the rendered root without a live React root', () => {
        const node = renderToNode(<span data-x="1">hey <b>there</b></span>) as HTMLElement;
        expect(node.parentNode).toBeNull();
        expect(node.outerHTML).toBe('<span data-x="1">hey <b>there</b></span>');
    });

    it('renders strings to text nodes', () => {
        const node = renderToNode('plain');
        expect(node).toBeInstanceOf(Text);
        expect(node.nodeValue).toBe('plain');
    });

    it('rejects output with more or less than one root node', () => {
        expect(() => renderToNode(<><b>a</b><i>b</i></>)).toThrow(/exactly one root DOM node, got 2/);
        expect(() => renderToNode(null)).toThrow(/exactly one root DOM node, got 0/);
    });
});
