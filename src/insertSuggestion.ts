import {
    getCursorPosition,
    getSelectedTextNodes,
    getFirstChildNode,
    isInputElement
} from './utils';
import type { InputElement } from './utils';
import invariant from 'invariant';
import { renderToNodes } from './renderToNodes';
import type { InsertedNode, RenderInsertResult } from './types';

const getNextNode = (node: Node, root?: Node): Node | undefined => {
    let nextNode: Node | null;
    if (node.nextSibling) {
        nextNode = node.nextSibling;
    } else {
        nextNode = node.parentNode;
        while (nextNode && nextNode !== root && !nextNode.nextSibling) {
            nextNode = nextNode.parentNode;
        }

        if (!nextNode || nextNode === root || !nextNode.nextSibling) return;
        nextNode = nextNode.nextSibling;
    }

    return getFirstChildNode(nextNode);
};

const removeNodesBetween = (startContainer: Node, endContainer: Node): void => {
    if (startContainer === endContainer) return;
    let node = getNextNode(startContainer);
    while (node && node !== endContainer) {
        node.parentNode!.removeChild(node);
        node = getNextNode(startContainer);
    }
};

// Going through the native setter, so that React picks up the change for controlled fields
const setNativeValue = (element: InputElement, value: string): void => {
    const prototype = element.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
    if (descriptor && descriptor.set) {
        descriptor.set.call(element, value);
    } else {
        element.value = value;
    }
};

const notifyInput = (element: HTMLElement): void => {
    element.dispatchEvent(new Event('input', { bubbles: true }));
};

/**
 * Replaces "trigger + keyword" before the caret (and the current selection) with the text or node.
 * Returns the first inserted node, the field itself in case of input and textarea
 * or `null` if nothing could be inserted.
 */
export function insertSuggestion(element: HTMLElement, trigger: string | undefined, insert: RenderInsertResult): InsertedNode | null {
    const { text, node } = insert || {};

    if (isInputElement(element)) {
        invariant(
            typeof text === 'string',
            'AutoSuggest: Missing required parameter, renderInsert should return text for input and textarea'
        );

        const [startPosition, endPosition] = getCursorPosition(element);
        const originalValue = element.value;

        let value = originalValue.slice(0, startPosition);
        const currentValue = value.split(trigger || /\W/).pop() || '';
        value = value.slice(0, value.length - currentValue.length - (trigger || '').length) + text;
        setNativeValue(element, value + originalValue.slice(endPosition));
        notifyInput(element);
        element.focus();

        const cursorPosition = value.length;
        element.setSelectionRange(cursorPosition, cursorPosition);
        return element;
    }

    // node can render nothing, text is used in that case
    let insertedNodes = typeof node !== 'undefined' && node !== null ? renderToNodes(node) : [];
    if (!insertedNodes.length) {
        invariant(
            typeof text === 'string',
            'AutoSuggest: Missing required parameter, renderInsert should return text or node for contenteditable'
        );
        insertedNodes = [document.createTextNode(text)];
    }

    const selected = getSelectedTextNodes();
    const selection = window.getSelection();
    if (!selection || !selected) return null;

    const { startContainer, startOffset, endContainer, endOffset } = selected;
    if (!startContainer || !startContainer.parentNode || !element.contains(startContainer)) return null;

    let preValue = (startContainer.nodeValue || '').slice(0, startOffset);
    const replaceValue = preValue.split(trigger || /\W/).pop() || '';
    preValue = preValue.slice(0, preValue.length - replaceValue.length - (trigger || '').length);

    if (endContainer && startContainer !== endContainer) {
        startContainer.nodeValue = preValue;
        removeNodesBetween(startContainer, endContainer);
        if (endContainer.nodeValue) {
            endContainer.nodeValue = endContainer.nodeValue.slice(endOffset);
        }
    } else {
        const remainingText = (startContainer.nodeValue || '').slice(endOffset);
        if (remainingText) {
            const remainingTextNode = document.createTextNode(remainingText);
            startContainer.parentNode.insertBefore(remainingTextNode, startContainer.nextSibling);
        }
        startContainer.nodeValue = preValue;
    }

    // Text goes into a node of its own, so that it can be manipulated from onInsert
    const referenceNode = startContainer.nextSibling;
    insertedNodes.forEach(insertedNode => {
        startContainer.parentNode!.insertBefore(insertedNode, referenceNode);
    });

    const range = document.createRange();
    const lastNode = insertedNodes[insertedNodes.length - 1];
    if (lastNode.nodeType === lastNode.TEXT_NODE) {
        range.setStart(lastNode, (lastNode.nodeValue || '').length);
    } else {
        range.setStartAfter(lastNode);
    }
    range.collapse(true);

    selection.removeAllRanges();
    selection.addRange(range);

    notifyInput(element);
    return insertedNodes[0] as InsertedNode;
}
