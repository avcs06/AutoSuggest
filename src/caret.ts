import { CLONE_PROPERTIES, POSITIONER_CHARACTER } from './constants.js';
import type { AutoSuggestElement, CaretPosition } from './types.js';
import {
    getComputedStyleValue,
    getCursorPosition,
    getGlobalOffset,
    getScrollLeftForInput,
    getSelectedTextNodes,
    isTextInput,
    splitValue
} from './utils.js';

const getCharHeight = (...elements: Element[]): number =>
    Math.max(...elements.map(element => parseFloat(getComputedStyleValue(element, 'line-height')) || 0));

const ZERO: CaretPosition = { top: 0, left: 0 };

/**
 * Returns the document-relative position right below the trigger character of the active keyword.
 * For `input` elements the vertical position is right below the field.
 */
export const getCaretPosition = (element: AutoSuggestElement, trigger?: string): CaretPosition => {
    if (isTextInput(element)) {
        const [cursorPosition] = getCursorPosition(element);
        const { textAfterTrigger, textUptoTrigger } = splitValue(element.value, cursorPosition, trigger);

        // pre to retain special characters
        const clone = document.createElement('pre');
        clone.id = 'autosuggest-positionclone';

        const positioner = document.createElement('span');
        positioner.appendChild(document.createTextNode(POSITIONER_CHARACTER));

        const computed = window.getComputedStyle(element);
        CLONE_PROPERTIES.forEach(prop => {
            (clone.style as unknown as Record<string, string>)[prop] = computed[prop as keyof CSSStyleDeclaration] as string;
        });

        const elementPosition = getGlobalOffset(element);
        clone.style.opacity = '0';
        clone.style.position = 'absolute';
        clone.style.top = `${elementPosition.top}px`;
        clone.style.left = `${elementPosition.left}px`;
        document.body.appendChild(clone);

        if (element.scrollHeight > parseInt(computed.height, 10)) {
            clone.style.overflowY = 'scroll';
        } else {
            clone.style.overflow = 'hidden';
        }

        // Extra styles for the clone depending on type of input
        let charHeight: number;
        if (element.tagName === 'INPUT') {
            clone.appendChild(document.createTextNode(textUptoTrigger.replace(/ /g, ' ')));
            clone.appendChild(positioner);
            clone.appendChild(document.createTextNode(textAfterTrigger.replace(/ /g, ' ')));

            clone.style.overflowX = 'auto';
            clone.style.whiteSpace = 'nowrap';
            if (cursorPosition === element.value.length) {
                clone.scrollLeft = clone.scrollWidth - clone.clientWidth;
            } else {
                clone.scrollLeft = Math.min(getScrollLeftForInput(element), clone.scrollWidth - clone.clientWidth);
            }
            charHeight = clone.offsetHeight - parseFloat(computed.paddingTop) - parseFloat(computed.paddingBottom);
        } else {
            clone.appendChild(document.createTextNode(textUptoTrigger));
            clone.appendChild(positioner);
            clone.appendChild(document.createTextNode(textAfterTrigger));

            clone.style.maxWidth = '100%';
            clone.scrollTop = element.scrollTop;
            clone.scrollLeft = element.scrollLeft;
            charHeight = getCharHeight(clone, positioner);
        }

        const caretPosition = getGlobalOffset(positioner);
        const inputPosition = getGlobalOffset(element);

        caretPosition.top += charHeight - clone.scrollTop;
        caretPosition.left -= clone.scrollLeft;

        const diff = caretPosition.left - inputPosition.left;
        if (diff < 0 || diff > element.clientWidth) caretPosition.left = inputPosition.left;

        document.body.removeChild(clone);
        return caretPosition;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return ZERO;

    const { startContainer, startOffset, endContainer, endOffset } = selection.getRangeAt(0);
    const selected = getSelectedTextNodes();
    if (!selected || !selected.startContainer) return ZERO;

    const { startContainer: containerTextNode, startOffset: cursorPosition, direction } = selected;
    const parentNode = containerTextNode.parentNode;
    if (!parentNode) return ZERO;

    const { textAfterTrigger, textUptoTrigger } = splitValue(containerTextNode.nodeValue ?? '', cursorPosition, trigger);
    const referenceNode = containerTextNode.nextSibling;

    const positioner = document.createElement('span');
    positioner.appendChild(document.createTextNode(POSITIONER_CHARACTER));
    parentNode.insertBefore(positioner, referenceNode);

    if (textAfterTrigger) {
        containerTextNode.nodeValue = textUptoTrigger;
        const remainingTextNode = document.createTextNode(textAfterTrigger);
        parentNode.insertBefore(remainingTextNode, referenceNode);
    }

    const caretPosition = getGlobalOffset(positioner);
    caretPosition.top += getCharHeight(positioner);

    // Reset DOM to the state before changes
    parentNode.removeChild(positioner);
    if (textAfterTrigger && containerTextNode.nextSibling) {
        parentNode.removeChild(containerTextNode.nextSibling);
        containerTextNode.nodeValue = textUptoTrigger + textAfterTrigger;
    }

    if (selection.setBaseAndExtent) {
        if (direction) {
            selection.setBaseAndExtent(startContainer, startOffset, endContainer, endOffset);
        } else {
            selection.setBaseAndExtent(endContainer, endOffset, startContainer, startOffset);
        }
    } else {
        const range = document.createRange();
        range.setStart(startContainer, startOffset);
        range.setEnd(endContainer, endOffset);
        selection.removeAllRanges();
        selection.addRange(range);
    }

    return caretPosition;
};
