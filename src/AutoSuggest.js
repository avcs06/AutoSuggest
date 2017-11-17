import Utilities from 'Utilities';
import SuggestionList from 'SuggestionList';
import SuggestionDropdown from 'SuggestionDropdown';

function getCaretPosition(element) {
    if (element.data('as-isinput')) {
        const originalValue = element.val();
        const cursorPosition = Utilities.getCursorPosition(element[0]);
        const value = originalValue.slice(0, cursorPosition).replace(/ /g, '&nbsp;');
        //Create a clone of our input field using div and copy value into div
        //Wrap last character in a span to get its position
        $('.as-positionclone').remove();

        const clone = $('<div class="as-positionclone"/>');
        const cloneContent = $(`<div style="display:inline-block;">${value.slice(0, -1)}<span id="as-positioner">${value.slice(-1)}</span>${originalValue.slice(cursorPosition)}</div>`);

        clone.append(cloneContent);
        Utilities.cloneStyle(element[0], clone[0]);

        //Get position of element and overlap our clone on the element
        const elementPosition = Utilities.getGlobalOffset(element[0]);
        clone.css({
            position: 'absolute',
            opacity: 0,
            left: `${elementPosition.left}px`,
            top: `${elementPosition.top}px`,
        });

        //append clone and scroll
        $('body').append(clone);

        //Extra styles for the clone depending on type of input
        if (element.is('input')) {
            clone.css({ overflowX: 'auto', whiteSpace: 'nowrap' });
            clone.scrollLeft(cursorPosition === originalValue.length ? cloneContent.width() : Utilities.getScrollLeftForInput(element[0]));
        } else {
            cloneContent.css('max-width', '100%');
            clone.scrollLeft(element.scrollLeft());
            clone.scrollTop(element.scrollTop());
        }

        //Get position of span
        const caretPosition = Utilities.getGlobalOffset($('#as-positioner')[0]);
        caretPosition.left += 10 - clone.scrollLeft();
        caretPosition.top += 28 - clone.scrollTop();
        clone.remove();

        return caretPosition;
    }
}

function extendFromGlobalOptions(currentOptions, globalOptions, optionList) {
    optionList.forEach(option => {
        if(typeof globalOptions[option] !== 'undefined' && typeof currentOptions[option] === 'undefined') {
            currentOptions[option] = globalOptions[option];
        }
    });
}

const defaultOptions = {
    suggestions: [],
};

class AutoSuggest {
    constructor(options, inputs) {
        options = $.extend(true, {}, defaultOptions, options || {});

        this.isActive = false;
        this.activeElement = null;
        this.activeElementCursorPosition = 0;
        this.dropdown = new SuggestionDropdown({
            setValue: this.setValue.bind(this)
        });

        // validate suggestions
        this.suggestionLists = [].concat(options.suggestions);

        for (let i = 0; i < this.suggestionLists.length; i++) {
            let currentSuggestionList = this.suggestionLists[i];
            if(!currentSuggestionList) {
                throw new Error('AutoSuggest: invalid suggestion list passed');
            }
            if(!(currentSuggestionList instanceof SuggestionList)) {
                if(!currentSuggestionList.suggestions) {
                    currentSuggestionList = {
                        suggestions: currentSuggestionList
                    };
                }

                extendFromGlobalOptions(currentSuggestionList, options, ['caseSensitive', 'trigger']);
                console.log(currentSuggestionList);
                this.suggestionLists[i] = new SuggestionList(currentSuggestionList);
            }
        }

        inputs && this.addInputs(inputs);
    }

    addInputs(inputs) {
        inputs = $(inputs);
        const self = this;
        // validate element
        inputs.each(function() {
            const that = $(this);
            if (this.isContentEditable) {
                that.data('as-isinput', false);
            } else if (that.is('input[type = text],textarea')) {
                that.data('as-isinput', true);
            } else {
                throw new Error('AutoSuggest: Invalid input: only input[type = text], textarea and contenteditable elements are supported');
            }
        });

        // init events
        inputs.on('input', function() {
            const that = $(this);
            let value = $(`<div>${that.val()}</div>`).text();
            if(that.data('as-isinput')) {
                const cursorPosition = Utilities.getCursorPosition(this);
                self.activeElementCursorPosition = cursorPosition;
                value = value.slice(0, cursorPosition);
            }

            self.isActive = false;

            for (const currentSuggestionList of self.suggestionLists) {
                if(currentSuggestionList.regex.test(value)) {
                    const match = value.match(currentSuggestionList.regex)[1];
                    currentSuggestionList.getSuggestions(match, results => {
                        if(results.length) {
                            self.isActive = true;
                            self.dropdown.fill(results, currentSuggestionList);
                            self.dropdown.show(getCaretPosition(that));
                        } else {
                            self.dropdown.hide();
                        }
                    });
                    break;
                }
            }

            if(!self.isActive) {
                self.dropdown.hide();
            }
        });

        inputs.keydown((event, originalEvent) => {
            if(self.isActive) {
                let newValue;
                const e = originalEvent||event;
                if (e.keyCode === 13 || e.keyCode === 9) {
                    self.setValue(self.dropdown.getValue(), self.dropdown.suggestionList);
                    self.dropdown.hide();
                } else if (e.keyCode == 40) {
                    newValue = self.dropdown.next();
                } else if (e.keyCode == 38) {
                    newValue = self.dropdown.prev();
                } else {
                    return true;
                }
                e.preventDefault();
                event.stopImmediatePropagation();
            }
        });

        inputs.blur(() => {
            self.activeElement = null;
            self.dropdown.hide();
            self.isActive = false;
        }).focus(function () {
            self.activeElement = $(this);
        });
    }

    setValue(suggestion, suggestionList) {
        const self = this;
        const element = this.activeElement;
        const insertText = suggestion.replaceWith;

        if (element) {
            if (element.data('as-isinput')) {
                const originalValue = element.val();
                const cursorPosition = self.activeElementCursorPosition;
                let value = originalValue.slice(0, cursorPosition);
                const currentValue = value.split(suggestionList.trigger || /\s/).pop();

                value = value.slice(0, 0 - currentValue.length);
                const cursorStartPosition = value.length;

                element.val(value + insertText + originalValue.slice(cursorPosition));
                element.focus();

                const newCursorPositions = suggestion.cursorPosition;
                const newPosition = cursorStartPosition + insertText.length;
                const newPosition1 = newPosition + newCursorPositions[0];
                const newPosition2 = newPosition + newCursorPositions[1];

                element[0].setSelectionRange(newPosition1, newPosition2);
            }
        }
        this.isActive = false;
    }
}

$.fn.autoSuggest = function(options) {
    if(options instanceof AutoSuggest) {
        options.addInputs(this);
        return options;
    } else {
        return new AutoSuggest(options, this);
    }
};
