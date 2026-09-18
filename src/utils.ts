import invariant from 'invariant';
import type { CaretPosition } from './types';

export type InputElement = HTMLInputElement | HTMLTextAreaElement;

export interface SelectedTextNodes {
    startContainer: Node | undefined;
    startOffset: number;
    endContainer: Node | undefined;
    endOffset: number;
    direction: boolean;
}

// Legacy IE API, not part of lib.dom
interface LegacyTextRangeInput extends HTMLInputElement {
    createTextRange?: () => { getBoundingClientRect(): DOMRect };
}

export const isInputElement = (element: HTMLElement): element is InputElement => (
    element.tagName === 'TEXTAREA' ||
    (element.tagName === 'INPUT' && (element as HTMLInputElement).type === 'text')
);

export const ensureSupportedElement = (element: HTMLElement): void => {
    invariant(
        isInputElement(element) || element.isContentEditable,
        'AutoSuggest: Invalid input: only input[type = text], textarea and contenteditable elements are supported'
    );
};

export const getComputedStyle = (element: Element, style: string): string =>
    window.getComputedStyle(element).getPropertyValue(style);

export const getGlobalOffset = ($0: HTMLElement): CaretPosition => {
    let node: HTMLElement | null = $0, top = 0, left = 0;

    do {
        left += node.offsetLeft;
        top += node.offsetTop;
    } while ((node = node.offsetParent as HTMLElement | null));

    return { left, top };
};

export const getScrollLeftForInput = (input: LegacyTextRangeInput): number => {
    if (input.createTextRange) {
        const range = input.createTextRange();
        const inputStyle = window.getComputedStyle(input);
        const paddingLeft = parseFloat(inputStyle.paddingLeft);
        const rangeRect = range.getBoundingClientRect();
        return input.getBoundingClientRect().left + input.clientLeft + paddingLeft - rangeRect.left;
    } else {
        return input.scrollLeft;
    }
};

export const getCursorPosition = (input: InputElement): [number, number] => {
    const positions = [input.selectionStart || 0, input.selectionEnd || 0].sort((a, b) => a - b);
    return [positions[0], positions[1]];
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

export const getSelectedTextNodes = (): SelectedTextNodes | null => {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return null;

    const range = selection.getRangeAt(0);
    let startContainer: Node | undefined = range.startContainer;
    let endContainer: Node | undefined = range.endContainer;
    let { startOffset, endOffset } = range;

    const direction = (
        selection.anchorNode === startContainer &&
        selection.anchorOffset === startOffset
    );

    if (startContainer.nodeType !== startContainer.TEXT_NODE) {
        startContainer = startContainer.childNodes[startOffset - 1];
        if (startContainer) {
            startContainer = getLastChildNode(startContainer);
            startOffset = startContainer.nodeValue ? startContainer.nodeValue.length : 0;
        }
    }

    if (endContainer.nodeType !== endContainer.TEXT_NODE) {
        endContainer = endContainer.childNodes[endOffset];
        if (endContainer) {
            endContainer = getFirstChildNode(endContainer);
            endOffset = 0;
        }
    }

    return { startContainer, startOffset, endContainer, endOffset, direction };
};

type AnyFunction = (...args: unknown[]) => void;

// Plugin props win over the consumer props, except event handlers which are
// composed (consumer first) and style which can be overwritten by the consumer
export const mergeProps = <Own extends object, P extends object>(
    own: Own,
    userProps?: P
): Omit<P, keyof Own> & Own => {
    const merged = { ...userProps, ...own } as Record<string, unknown>;

    if (userProps) {
        Object.keys(own).forEach(key => {
            const ownValue = (own as Record<string, unknown>)[key];
            const userValue = (userProps as Record<string, unknown>)[key];

            if (typeof ownValue === 'function' && typeof userValue === 'function') {
                merged[key] = (...args: unknown[]) => {
                    (userValue as AnyFunction)(...args);
                    (ownValue as AnyFunction)(...args);
                };
            } else if (key === 'style' && userValue && typeof userValue === 'object') {
                merged[key] = { ...(ownValue as object), ...userValue };
            }
        });
    }

    return merged as Omit<P, keyof Own> & Own;
};
