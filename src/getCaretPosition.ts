import {
    getGlobalOffset,
    getCursorPosition,
    getScrollLeftForInput,
    getSelectedTextNodes,
    getComputedStyle,
    isInputElement
} from './utils';
import { CLONE_PROPERTIES } from './constants';
import type { CaretPosition } from './types';

export function splitValue(originalValue: string, cursorPosition: number, trigger?: string) {
    const value = originalValue.slice(0, cursorPosition);
    let textAfterTrigger = value.split(trigger || /\W/).pop() || '';
    const textUptoTrigger = textAfterTrigger.length ? value.slice(0, 0 - textAfterTrigger.length) : value;
    textAfterTrigger += originalValue.slice(cursorPosition);
    return { textAfterTrigger, textUptoTrigger };
}

function getCharHeight(...elements: HTMLElement[]): number {
    return Math.max(...elements.map(element => {
        const lineHeight = parseFloat(getComputedStyle(element, 'line-height'));
        // line-height: normal
        return isNaN(lineHeight) ? (parseFloat(getComputedStyle(element, 'font-size')) || 0) * 1.2 : lineHeight;
    }));
}

// Invisible character
const POSITIONER_CHARACTER = '\ufeff';

// The elements created here are used only to measure the position of caret,
// they are removed from the DOM before returning.
export function getCaretPosition(element: HTMLElement, trigger?: string): CaretPosition {
    if (isInputElement(element)) {
        const [cursorPosition] = getCursorPosition(element);
        const { textAfterTrigger, textUptoTrigger } = splitValue(element.value, cursorPosition, trigger);

        // pre to retain special characters
        const clone = document.createElement('pre');
        clone.id = 'autosuggest-positionclone';

        const positioner = document.createElement('span');
        positioner.appendChild(document.createTextNode(POSITIONER_CHARACTER));

        const computed = window.getComputedStyle(element);
        const cloneStyle = clone.style as unknown as Record<string, string>;
        CLONE_PROPERTIES.forEach(prop => {
            cloneStyle[prop] = (computed as unknown as Record<string, string>)[prop];
        });

        const elementPosition = getGlobalOffset(element);
        clone.style.opacity = '0';
        clone.style.position = 'absolute';
        clone.style.top = `${elementPosition.top}px`;
        clone.style.left = `${elementPosition.left}px`;
        document.body.appendChild(clone);

        if (element.scrollHeight > parseInt(computed.height)) {
            clone.style.overflowY = 'scroll';
        } else {
            clone.style.overflow = 'hidden';
        }

        // Extra styles for the clone depending on type of input
        let charHeight;
        if (element.tagName === 'INPUT') {
            clone.appendChild(document.createTextNode(textUptoTrigger.replace(/ /g, '\u00A0')));
            clone.appendChild(positioner);
            clone.appendChild(document.createTextNode(textAfterTrigger.replace(/ /g, '\u00A0')));

            clone.style.overflowX = 'auto';
            clone.style.whiteSpace = 'nowrap';
            if (cursorPosition === element.value.length) {
                clone.scrollLeft = clone.scrollWidth - clone.clientWidth;
            } else {
                clone.scrollLeft = Math.min(getScrollLeftForInput(element as HTMLInputElement), clone.scrollWidth - clone.clientWidth);
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
        if (diff < 0 || diff > element.clientWidth) {
            caretPosition.left = inputPosition.left;
        }

        document.body.removeChild(clone);
        return caretPosition;
    } else {
        const selection = window.getSelection();
        const selected = getSelectedTextNodes();
        if (!selection || !selected || !selected.startContainer || !selected.startContainer.parentNode) {
            return getGlobalOffset(element);
        }

        const { startContainer, startOffset, endContainer, endOffset } = selection.getRangeAt(0);
        const { startContainer: containerTextNode, startOffset: cursorPosition, direction } = selected;
        const { textAfterTrigger, textUptoTrigger } = splitValue(containerTextNode.nodeValue || '', cursorPosition, trigger);

        const parentNode = selected.startContainer.parentNode;
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
        const charHeight = getCharHeight(positioner);
        caretPosition.top += charHeight;

        // Reset DOM to the state before changes
        parentNode.removeChild(positioner);
        if (textAfterTrigger) {
            parentNode.removeChild(containerTextNode.nextSibling!);
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
    }
}
