import invariant from 'invariant';
import type { AutoSuggestElement, CaretPosition } from './types.js';

export type TextInputElement = HTMLInputElement | HTMLTextAreaElement;

const isContentEditable = (element: HTMLElement): boolean => {
    if (element.isContentEditable) return true;
    // Fallback for detached elements and DOM implementations without `isContentEditable` (e.g. jsdom).
    const attribute = element.getAttribute('contenteditable');
    return attribute !== null && attribute !== 'false';
};

/** `true` for `input[type=text]` and `textarea`, `false` for contenteditable elements. Throws otherwise. */
export const isTextInput = (element: AutoSuggestElement): element is TextInputElement => {
    if (element.tagName === 'TEXTAREA' || (element.tagName === 'INPUT' && (element as HTMLInputElement).type === 'text')) {
        return true;
    }
    invariant(
        isContentEditable(element),
        'AutoSuggest: Invalid input: only input[type = text], textarea and contenteditable elements are supported'
    );
    return false;
};

export const getComputedStyleValue = (element: Element, style: string): string =>
    window.getComputedStyle(element).getPropertyValue(style);

export const getGlobalOffset = (element: HTMLElement): CaretPosition => {
    let node: HTMLElement | null = element;
    let top = 0;
    let left = 0;

    do {
        left += node.offsetLeft;
        top += node.offsetTop;
        node = node.offsetParent as HTMLElement | null;
    } while (node);

    return { left, top };
};

interface LegacyTextRangeInput extends HTMLInputElement {
    createTextRange?: () => { getBoundingClientRect: () => DOMRect };
}

export const getScrollLeftForInput = (input: TextInputElement): number => {
    const legacy = input as LegacyTextRangeInput;
    if (legacy.createTextRange) {
        const range = legacy.createTextRange();
        const inputStyle = window.getComputedStyle(input);
        const paddingLeft = parseFloat(inputStyle.paddingLeft);
        const rangeRect = range.getBoundingClientRect();
        return input.getBoundingClientRect().left + input.clientLeft + paddingLeft - rangeRect.left;
    }
    return input.scrollLeft;
};

export const getCursorPosition = (input: TextInputElement): [number, number] => {
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? start;
    return start <= end ? [start, end] : [end, start];
};

export interface SelectedTextNodes {
    startContainer: Node | null;
    startOffset: number;
    endContainer: Node | null;
    endOffset: number;
    /** `true` when the selection anchor is at the start (selection made left-to-right). */
    direction: boolean;
}

export const getSelectedTextNodes = (): SelectedTextNodes | null => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);

    let { startContainer, startOffset, endContainer, endOffset }: {
        startContainer: Node | null;
        startOffset: number;
        endContainer: Node | null;
        endOffset: number;
    } = range;

    const direction = selection.anchorNode === startContainer && selection.anchorOffset === startOffset;

    if (startContainer && startContainer.nodeType !== Node.TEXT_NODE) {
        startContainer = startContainer.childNodes[startOffset - 1] ?? null;
        if (startContainer) {
            startContainer = getLastChildNode(startContainer);
            startOffset = startContainer.nodeValue ? startContainer.nodeValue.length : 0;
        }
    }

    if (endContainer && endContainer.nodeType !== Node.TEXT_NODE) {
        endContainer = endContainer.childNodes[endOffset] ?? null;
        if (endContainer) {
            endContainer = getFirstChildNode(endContainer);
            endOffset = 0;
        }
    }

    return { startContainer, startOffset, endContainer, endOffset, direction };
};

export const getFirstChildNode = (node: Node): Node => {
    let nextNode = node;
    while (nextNode.firstChild) nextNode = nextNode.firstChild;
    return nextNode;
};

export const getLastChildNode = (node: Node): Node => {
    let nextNode = node;
    while (nextNode.lastChild) nextNode = nextNode.lastChild;
    return nextNode;
};

export const escapeRegExp = (string: string): string =>
    string.replace(/[.?+*^$[{()|\\]/g, '\\$&'); // $& means the whole matched string

/**
 * Splits `originalValue` at the trigger closest to `cursorPosition`.
 * `textUptoTrigger` includes the trigger, `textAfterTrigger` is the keyword plus everything after the cursor.
 */
export const splitValue = (originalValue: string, cursorPosition: number, trigger?: string) => {
    const value = originalValue.slice(0, cursorPosition);
    let textAfterTrigger = value.split(trigger || /\W/).pop() ?? '';
    const textUptoTrigger = textAfterTrigger.length ? value.slice(0, 0 - textAfterTrigger.length) : value;
    textAfterTrigger += originalValue.slice(cursorPosition);
    return { textAfterTrigger, textUptoTrigger };
};

/** Removes `trigger + keyword` from the end of `text`. */
export const stripTriggerAndKeyword = (text: string, trigger?: string): string => {
    const keyword = text.split(trigger || /\W/).pop() ?? '';
    return text.slice(0, text.length - keyword.length - (trigger || '').length);
};
