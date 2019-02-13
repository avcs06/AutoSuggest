import {
    data, cloneStyle,
    getGlobalOffset,
    getCursorPosition,
    getScrollLeftForInput,
    makeAsyncQueueRunner,
    getSelectedTextNodes,
    getComputedStyle
} from './Utilities';

import SuggestionList from './SuggestionList';
import SuggestionDropdown from './SuggestionDropdown';

function splitValue(originalValue, cursorPosition, trigger) {
    const value = originalValue.slice(0, cursorPosition);
    let textAfterTrigger = value.split(trigger || /\W/).pop();
    const textUptoTrigger = textAfterTrigger.length ? value.slice(0, 0 - textAfterTrigger.length) : value;
    textAfterTrigger += originalValue.slice(cursorPosition);
    return { textAfterTrigger, textUptoTrigger };
}

// Invisible character
const POSITIONER_CHARACTER = "\ufeff";
function getCaretPosition(element, trigger) {
    if (data(element, 'isInput')) {
        const [cursorPosition] = getCursorPosition(element);
        const { textAfterTrigger, textUptoTrigger } = splitValue(element.value, cursorPosition, trigger);

        // pre to retain special characters
        const clone = document.createElement('pre');
        clone.id = 'autosuggest-positionclone';

        const positioner = document.createElement('span');
        positioner.appendChild(document.createTextNode(POSITIONER_CHARACTER));

        clone.appendChild(document.createTextNode(textUptoTrigger.replace(/ /g, '\u00A0')));
        clone.appendChild(positioner);
        clone.appendChild(document.createTextNode(textAfterTrigger.replace(/ /g, '\u00A0')));
        cloneStyle(element, clone);

        const elementPosition = getGlobalOffset(element);
        clone.style.opacity = 0;
        clone.style.position = 'absolute';
        clone.style.top = `${elementPosition.top}px`;
        clone.style.left = `${elementPosition.left}px`;
        document.body.appendChild(clone);

        // Extra styles for the clone depending on type of input
        if (element.tagName === 'INPUT') {
            clone.style.overflowX = 'auto';
            clone.style.whiteSpace = 'nowrap';
            if (cursorPosition === element.value.length) {
                clone.scrollLeft = clone.scrollWidth - clone.clientWidth;
            } else {
                clone.scrollLeft = Math.min(getScrollLeftForInput(element), clone.scrollWidth - clone.clientWidth);
            }
        } else {
            clone.style.maxWidth = '100%';
            clone.style.whiteSpace = 'pre-wrap';
            clone.scrollTop = element.scrollTop;
            clone.scrollLeft = element.scrollLeft;
        }

        const caretPosition = getGlobalOffset(positioner);
        caretPosition.left -= clone.scrollLeft;

        const charHeight = parseFloat(getComputedStyle(positioner, 'line-height'));
        caretPosition.top += charHeight - clone.scrollTop;

        document.body.removeChild(clone);
        return caretPosition;
    } else {
        const { startContainer, startOffset, endContainer, endOffset } = window.getSelection().getRangeAt(0);
        const { startContainer: containerTextNode, startOffset: cursorPosition } = getSelectedTextNodes();
        const { textAfterTrigger, textUptoTrigger } = splitValue(containerTextNode.nodeValue, cursorPosition, trigger);

        const parentNode = containerTextNode.parentNode;
        const referenceNode = containerTextNode.nextSibling;

        const positioner = document.createElement("span");
        positioner.appendChild(document.createTextNode(POSITIONER_CHARACTER));
        parentNode.insertBefore(positioner, referenceNode);

        if (textAfterTrigger) {
            containerTextNode.nodeValue = textUptoTrigger;
            const remainingTextNode = document.createTextNode(textAfterTrigger);
            parentNode.insertBefore(remainingTextNode, referenceNode);
        }

        const caretPosition = getGlobalOffset(positioner);
        const charHeight = parseFloat(getComputedStyle(positioner, 'line-height'));
        caretPosition.top += charHeight;

        // Reset DOM to the state before changes
        parentNode.removeChild(positioner);
        if (textAfterTrigger) {
            parentNode.removeChild(containerTextNode.nextSibling);
            containerTextNode.nodeValue = textUptoTrigger + textAfterTrigger;
        }

        const selection = window.getSelection().getRangeAt(0);
        selection.setStart(startContainer, startOffset);
        selection.setEnd(endContainer, endOffset);

        return caretPosition;
    }
}

const getNextNode = node => {
    let nextNode = node.nextSibling || node.parentNode.nextSibling;
    while (nextNode.firstChild) nextNode = nextNode.firstChild;
    return nextNode;
};

const setValue = ({ element, trigger, suggestion, onChange }) => {
    const insertText = suggestion.use;
    const focus = suggestion.focus;

    if (data(element, 'isInput')) {
        const [startPosition, endPosition] = getCursorPosition(element);
        const originalValue = element.value;
        let value = originalValue.slice(0, startPosition);
        const currentValue = value.split(trigger || /\W/).pop();
        value = value.slice(0, 0 - currentValue.length - (trigger || '').length) + insertText;
        element.value = value + originalValue.slice(endPosition);
        element.focus();

        const cursorStartPosition = value.length;
        element.setSelectionRange(cursorStartPosition + focus[0], cursorStartPosition + focus[1]);
    } else {
        const { startContainer, startOffset, endContainer, endOffset } = getSelectedTextNodes();
        let value = startContainer.nodeValue.slice(0, startOffset);
        const currentValue = value.split(trigger || /\W/).pop();
        value = value.slice(0, 0 - currentValue.length - (trigger || '').length) + insertText;
        startContainer.nodeValue = value + endContainer.nodeValue.slice(endOffset);

        let node = startContainer;
        if (node !== endContainer) {
            node = getNextNode(startContainer);
        }
        while (node !== endContainer) {
            node.parentNode.removeChild(node);
            node = getNextNode(startContainer);
        }
        endContainer.parentNode.removeChild(endContainer);

        const cursorStartPosition = value.length;
        const selection = window.getSelection().getRangeAt(0);
        selection.setStart(startContainer, cursorStartPosition + focus[0]);
        selection.setEnd(startContainer, cursorStartPosition + focus[1]);
    }

    onChange(element, suggestion);
};

class AutoSuggest {
    constructor(options, ...inputs) {
        if (!options) {
            throw new Error(`AutoSuggest: Missing required parameter, options`);
        }

        this.inputs = [];
        this.dropdown = new SuggestionDropdown();
        this.onChange = options.onChange || Function.prototype;
        this.maxSuggestions = options.maxSuggestions || 10;

        // validate suggestions
        this.suggestionLists = options.suggestions || [];
        for (let i = 0; i < this.suggestionLists.length; i++) {
            let suggestionList = this.suggestionLists[i];
            if (!(suggestionList instanceof SuggestionList)) {
                if (suggestionList.constructor !== Object) {
                    suggestionList = { values: suggestionList };
                }

                if (!suggestionList.hasOwnProperty('caseSensitive') && options.hasOwnProperty('caseSensitive')) {
                    suggestionList.caseSensitive = options.caseSensitive;
                }

                this.suggestionLists[i] = new SuggestionList(suggestionList);
            }
        }

        events: {
            const self = this;
            let activeSuggestionList = null;
            let handledInKeyDown = false;

            this.onBlurHandler = function() {
                self.dropdown.hide();
            };

            this.onKeyDownHandler = function(e) {
                handledInKeyDown = false;
                if (self.dropdown.isActive) {
                    const preventDefaultAction = () => {
                        e.preventDefault();
                        handledInKeyDown = true;
                    };

                    if (e.keyCode === 13 || e.keyCode === 9) {
                        setValue({
                            element: this,
                            trigger: activeSuggestionList.trigger,
                            suggestion: self.dropdown.getValue(),
                            onChange: self.onChange
                        });
                        self.dropdown.hide();
                        return preventDefaultAction();
                    } else if (e.keyCode === 40) {
                        self.dropdown.selectNext();
                        return preventDefaultAction();
                    } else if (e.keyCode === 38) {
                        self.dropdown.selectPrev();
                        return preventDefaultAction();
                    } else if (e.keyCode === 27) {
                        self.dropdown.hide();
                        return preventDefaultAction();
                    }
                }
            };

            let keyUpIndex = 0;
            this.onKeyUpHandler = function() {
                if (handledInKeyDown) return;

                let value;
                if (data(this, 'isInput')) {
                    const [startPosition, endPosition] = getCursorPosition(this);
                    if (/[a-zA-Z_0-9]/.test(this.value.charAt(endPosition) || ' ')) {
                        self.dropdown.hide();
                        return;
                    }

                    value = this.value.slice(0, startPosition);
                } else {
                    const { startContainer, startOffset, endContainer, endOffset } = getSelectedTextNodes();
                    if (
                        !startContainer || !endContainer ||
                        /[a-zA-Z_0-9]/.test(endContainer.nodeValue.charAt(endOffset) || ' ')
                    ) {
                        self.dropdown.hide();
                        return;
                    }

                    value = startContainer.nodeValue.slice(0, startOffset);
                }

                handleDropdown: {
                    keyUpIndex++;
                    self.dropdown.empty();

                    const executeQueue = makeAsyncQueueRunner();
                    let i = 0, timer, triggerMatchFound = false;
                    for (let suggestionList of self.suggestionLists) {
                        if (suggestionList.regex.test(value)) {
                            triggerMatchFound = true;

                            ((i, asyncReference) => {
                                const match = suggestionList.getMatch(value);
                                const caretPosition = getCaretPosition(this, suggestionList.trigger);

                                if (self.dropdown.isEmpty) {
                                    timer && clearTimeout(timer);
                                    timer = setTimeout(() => {
                                        self.dropdown.showLoader(caretPosition);
                                    }, 0);
                                }

                                suggestionList.getSuggestions(match, results => {
                                    if (asyncReference !== keyUpIndex) return;

                                    executeQueue(() => {
                                        timer && clearTimeout(timer);
                                        if (self.dropdown.isEmpty) {
                                            if (results.length) {
                                                activeSuggestionList = suggestionList;
                                                self.dropdown.fill(
                                                    results.slice(0, self.maxSuggestions),
                                                    suggestion => {
                                                        setValue({
                                                            element: this,
                                                            trigger: suggestionList.trigger,
                                                            suggestion: suggestion,
                                                            onChange: self.onChange
                                                        });
                                                    }
                                                );

                                                self.dropdown.show(caretPosition);
                                            } else {
                                                self.dropdown.hide();
                                            }
                                        }
                                    }, i);
                                });
                            })(i++, keyUpIndex);
                        }
                    }

                    if (!triggerMatchFound) {
                        self.dropdown.hide();
                    }
                }
            };
        }

        // initialize events on inputs
        this.addInputs(...inputs);
    }

    addInputs(...args) {
        const inputs = Array.prototype.concat.apply([], args.map(d => d[0] ? Array.prototype.slice.call(d, 0) : d));

        inputs.forEach(input => {
            // validate element
            if (input.isContentEditable) {
                data(input, 'isInput', false)
            } else if (input.tagName === 'TEXTAREA' || (input.tagName === 'INPUT' && input.type === 'text')) {
                data(input, 'isInput', true)
            } else {
                throw new Error('AutoSuggest: Invalid input: only input[type = text], textarea and contenteditable elements are supported');
            }

            // init events
            input.addEventListener('blur', this.onBlurHandler);
            input.addEventListener('keyup', this.onKeyUpHandler);
            input.addEventListener('click', this.onKeyUpHandler);
            input.addEventListener('keydown', this.onKeyDownHandler, true);

            data(input, 'index', this.inputs.push(input) - 1);
        });
    }

    removeInputs(...args) {
        const inputs = Array.prototype.concat.apply([], args.map(d => d[0] ? Array.prototype.slice.call(d, 0) : d));

        inputs.forEach(input => {
            const index = data(input, 'index');
            if (!isNaN(index)) {
                this.inputs.splice(index, 1);

                // destroy events
                input.removeEventListener('blur', this.onBlurHandler);
                input.removeEventListener('keyup', this.onKeyUpHandler);
                input.removeEventListener('click', this.onKeyUpHandler);
                input.removeEventListener('keydown', this.onKeyDownHandler, true);
            }
        });
    }

    destroy() {
        this.removeInputs(this.inputs);
    }
}

export default AutoSuggest;
