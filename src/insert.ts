import invariant from 'invariant';
import type { AutoSuggestElement, InsertContent } from './types.js';
import { renderToNode } from './renderToNode.js';
import { getCursorPosition, getFirstChildNode, getSelectedTextNodes, isTextInput, stripTriggerAndKeyword } from './utils.js';

const getNextNode = (node: Node, root?: Node): Node | undefined => {
    let nextNode: Node | null;
    if (node.nextSibling) {
        nextNode = node.nextSibling;
    } else {
        nextNode = node.parentNode;
        while (nextNode && nextNode !== root && !nextNode.nextSibling) nextNode = nextNode.parentNode;
        if (nextNode && nextNode !== root) nextNode = nextNode.nextSibling;
        else return undefined;
    }

    return nextNode ? getFirstChildNode(nextNode) : undefined;
};

const removeNodesBetween = (startContainer: Node, endContainer: Node): void => {
    if (startContainer === endContainer) return;
    let node = getNextNode(startContainer);
    while (node && node !== endContainer) {
        node.parentNode?.removeChild(node);
        node = getNextNode(startContainer);
    }
};

/**
 * Sets `value` through the prototype setter so React's value tracker sees the change
 * and a following `input` event is not swallowed for controlled inputs.
 */
const setNativeValue = (element: HTMLInputElement | HTMLTextAreaElement, value: string): void => {
    const prototype = Object.getPrototypeOf(element) as object;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
    if (descriptor?.set) {
        descriptor.set.call(element, value);
    } else {
        element.value = value;
    }
};

/**
 * Replaces `trigger + keyword` (and any selected text) in `element` with `content` and places the
 * caret right after the inserted content.
 *
 * - input / textarea receive `content.text` (required).
 * - contenteditable receives `content.node` rendered to DOM, or `content.text` as a Text node.
 *
 * @returns the inserted node for contenteditable elements, or the `input` / `textarea` element
 *          itself. `null` when nothing was inserted.
 */
export const insertSuggestion = (
    element: AutoSuggestElement,
    content: InsertContent,
    trigger?: string
): Node | null => {
    if (isTextInput(element)) {
        invariant(content.text, 'AutoSuggest: renderInsert must return a non-empty `text` for input and textarea elements');
        const [startPosition, endPosition] = getCursorPosition(element);
        const originalValue = element.value;

        const value = stripTriggerAndKeyword(originalValue.slice(0, startPosition), trigger) + content.text;
        setNativeValue(element, value + originalValue.slice(endPosition));
        element.focus();
        element.setSelectionRange(value.length, value.length);
        // Notify React (and any other listener) that the value changed programmatically.
        element.dispatchEvent(new Event('input', { bubbles: true }));
        return element;
    }

    invariant(
        content.node != null || content.text,
        'AutoSuggest: renderInsert must return `node` or a non-empty `text` for contenteditable elements'
    );

    const selected = getSelectedTextNodes();
    const selection = window.getSelection();
    if (!selected || !selection || !selected.startContainer) return null;

    const { startContainer, startOffset, endContainer, endOffset } = selected;
    const parentNode = startContainer.parentNode;
    if (!parentNode) return null;
    const preValue = stripTriggerAndKeyword((startContainer.nodeValue ?? '').slice(0, startOffset), trigger);

    if (endContainer && startContainer !== endContainer) {
        startContainer.nodeValue = preValue;
        removeNodesBetween(startContainer, endContainer);
        if (endContainer.nodeValue) {
            endContainer.nodeValue = endContainer.nodeValue.slice(endOffset);
        }
    } else {
        const remainingText = (startContainer.nodeValue ?? '').slice(endOffset);
        if (remainingText) {
            const remainingTextNode = document.createTextNode(remainingText);
            parentNode.insertBefore(remainingTextNode, startContainer.nextSibling);
        }
        startContainer.nodeValue = preValue;
    }

    const insertedNode = content.node != null ? renderToNode(content.node) : document.createTextNode(content.text ?? '');
    parentNode.insertBefore(insertedNode, startContainer.nextSibling);

    const range = document.createRange();
    if (insertedNode.nodeType === Node.TEXT_NODE) {
        const length = insertedNode.nodeValue?.length ?? 0;
        range.setStart(insertedNode, length);
        range.setEnd(insertedNode, length);
    } else {
        range.setStartAfter(insertedNode);
        range.setEndAfter(insertedNode);
    }
    selection.removeAllRanges();
    selection.addRange(range);
    element.dispatchEvent(new Event('input', { bubbles: true }));

    return insertedNode;
};
