'use strict';
(function (root, factory) {
    if (typeof define === "function" && define.amd) {
        define('suggest', ["jquery"], factory);
    } else if (typeof module === "object" && module.exports) {
        module.exports = factory(require("jquery"));
    } else {
        root.AutoSuggest = factory(root.jQuery || root.$);
    }
}(this, function($) {
    if(!$) {
        throw new Error("AutoSuggest: dependencies not met - jQuery is not defined");
    }

    // Utilities
    function noop() {}

    function cloneStyle(e1, e2) {
        var style1 = window.getComputedStyle($(e1)[0], null);
        var style2 = {};

        Array.prototype.forEach.call(style1, function(property) {
            style2[property] = style1.getPropertyValue(property);
        });
        $(e2).css(style2);
    }

    function getGlobalOffset(element) {
        var obj = element;
        var left = 0, top = 0;
        do {
            left += obj.offsetLeft;
            top += obj.offsetTop;
        } while (obj = obj.offsetParent);
        return {'left': left, 'top': top};
    }

    function getScrollLeftForInput(element) {
        if(element.createTextRange) {
            var range = element.createTextRange();
            var inputStyle = window.getComputedStyle(element, undefined);
            var paddingLeft = parseFloat(inputStyle.paddingLeft);
            var rangeRect = range.getBoundingClientRect();
            return element.getBoundingClientRect().left + element.clientLeft + paddingLeft - rangeRect.left;
        } else {
            return $(element).scrollLeft();
        }
    }

    function getCursorPosition(input) {
        var position = 0;

        if (typeof input.selectionDirection !== 'undefined') {
            position = input.selectionDirection=='backward' ? input.selectionStart : input.selectionEnd;
        } else if (document.selection) {
            input.focus();
            var selection = document.selection.createRange();
            selection.moveStart('character', -input.value.length);
            position = selection.text.length;
        }

        return position;
    }

    function getCaretPosition(element) {
        if (element.data('as-isinput')) {
            var originalValue = element.val();
            var cursorPosition = getCursorPosition(element[0]);
            var value = originalValue.slice(0, cursorPosition).replace(/ /g, '&nbsp;');
            //Create a clone of our input field using div and copy value into div
            //Wrap last character in a span to get its position
            $('.as-positionclone').remove();
            let clone = $('<div class="as-positionclone"/>');
            clone.html('<div style="display:inline-block;">' + value.slice(0, -1) + '<span id="as-positioner">' + value.slice(-1) + '</span>' + originalValue.slice(cursorPosition) + '</div>');
            cloneStyle(element[0], clone[0]);

            //Get position of element and overlap our clone on the element
            let elementPosition = getGlobalOffset(element[0]);
            clone.css({
                position: 'absolute',
                opacity: 0,
                left: elementPosition.left + 'px',
                top: elementPosition.top + 'px',
            });

            //append clone and scroll
            $('body').append(clone);

            //Extra styles for the clone depending on type of input
            if (element.is('input')) {
                clone.css({
                    overflowX: 'auto',
                    whiteSpace: 'nowrap'
                });
                clone.scrollLeft(cursorPosition === originalValue.length ? clone.children().width() : getScrollLeftForInput(element[0]));
            } else {
                clone.scrollLeft(element.scrollLeft());
                clone.scrollTop(element.scrollTop());
            }

            //Get position of span
            var caretPosition = getGlobalOffset($('#as-positioner')[0]);
            caretPosition.left += 10 - clone.scrollLeft();
            caretPosition.top += 28 - clone.scrollTop();
            clone.remove();

            return caretPosition;
        }
    }

    function extendFromGlobalOptions(currentOptions, globalOptions, optionList) {
        optionList.forEach(function(option) {
            if(typeof globalOptions[option] !== 'undefined' && typeof currentOptions[option] === 'undefined') {
                currentOptions[option] = globalOptions[option];
            }
        });
    }

    var defaultOptions = {
        suggestions: [],
    };

    function AutoSuggest(options, inputs) {
        options = $.extend(true, {}, defaultOptions, options || {});

        this.isActive = false;
        this.activeElement = null;
        this.activeElementCursorPosition = 0;
        this.textcomplete = new SuggestionTextComplete();
        this.dropdown = new SuggestionDropdown({
            setValue: this.setValue.bind(this)
        });

        // validate suggestions
        this.suggestionLists = [].concat(options.suggestions);
        for(var i = 0; i < this.suggestionLists.length; i++) {
            var currentSuggestionList = this.suggestionLists[i];
            if(!currentSuggestionList) {
                throw new Error('AutoSuggest: invalid suggestion list passed');
            }
            if(!(currentSuggestionList instanceof SuggestionList)) {
                if(!currentSuggestionList.suggestions) {
                    currentSuggestionList = {
                        suggestions: currentSuggestionList
                    };
                }

                extendFromGlobalOptions(currentSuggestionList, options, ['beforeShow', 'beforeAppend', 'caseSensitive', 'trigger', 'wrap']);
                this.suggestionLists[i] = new SuggestionList(currentSuggestionList);
            }
        }

        inputs && this.addInputs(inputs);
    }

    AutoSuggest.prototype.addInputs = function(inputs) {
        inputs = $(inputs);
        var self = this;
        // validate element
        inputs.each(function() {
            var that = $(this);
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
            var that = $(this);
            var value = $('<div>' + that.val() + '</div>').text();
            if(that.data('as-isinput')) {
                var cursorPosition = getCursorPosition(this);
                self.activeElementCursorPosition = cursorPosition;
                value = value.slice(0, cursorPosition);
            }

            self.isActive = false;
            for(var i = 0; i < self.suggestionLists.length; i++) {
                var currentSuggestionList = self.suggestionLists[i];
                if(currentSuggestionList.regex.test(value)) {
                    var match = value.match(currentSuggestionList.regex)[1];
                    currentSuggestionList.getSuggestions(match, function(results) {
                        if(results.length > 1) {
                            self.dropdown.fill(results, currentSuggestionList);
                            var cursorPosition = getCaretPosition(that, currentSuggestionList.trigger);
                            self.dropdown.show(cursorPosition);
                        } else {
                            self.dropdown.hide();
                        }

                        if(results[0]) {
                            self.isActive = true;
                            // textcomplete area
                        }
                    });
                    break;
                }
            }

            if(!self.isActive) {
                self.dropdown.hide();
            }
        });

        inputs.keydown(function (event, originalEvent) {
            if(self.isActive) {
                var newValue;
                var e = originalEvent||event;
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

        inputs.blur(function () {
            self.activeElement = null;
            self.dropdown.hide();
            self.isActive = false;
        }).focus(function () {
            self.activeElement = $(this);
        });
    };

    AutoSuggest.prototype.setValue = function(suggestion, suggestionList) {
        var self = this;
        var element = this.activeElement;
        var insertText = suggestionList.getOutput(suggestion);
        var getCursorPosition = function () { return 0; };

        if (suggestion.getCursorPosition && typeof suggestion.getCursorPosition === 'function') {
            getCursorPosition = suggestion.getCursorPosition;
        }

        if (element) {
            var isEditor = !element.data('as-isinput');
            if (isEditor) {
                var selection = getSelection();
                if (!selection.isCollapsed) {
                    selection.deleteFromDocument();
                    selection = getSelection();
                }

                var anchor = selection.anchorNode;
                var oldValue = anchor.nodeValue;
                var offset = selection.anchorOffset;
                if (oldValue == null) {
                    var range = selection.getRangeAt(0);
                    var newNode = document.createTextNode(insertText);
                    range.insertNode(newNode);
                    range.setStartAfter(newNode);
                    range.setEndAfter(newNode);
                    selection.removeAllRanges();
                    selection.addRange(range);
                }
                else {
                    if (check) {
                        var value = oldValue.split('{{');
                        var excluded = value.pop();
                        value.push('');
                        oldValue = value.join('{{');
                        offset -= excluded.length;
                    }
                    anchor.nodeValue = oldValue.substring(0, offset) + insertText + oldValue.substring(offset);
                    anchor.nodeValue = anchor.nodeValue.replace(new RegExp(String.fromCharCode(160), "g"), ' ');
                    selection.extend(anchor, offset + insertText.length);
                    selection.collapseToEnd();
                }
                that.currentFocus.val(that.currentFocus.summernote('code'));
            } else {
                var originalValue = element.val();
                var cursorPosition = self.activeElementCursorPosition;
                var value = originalValue.slice(0, cursorPosition);
                var currentValue = value.split(suggestionList.trigger || /\s/).pop();

                value = value.slice(0, 0 - currentValue.length);
                var cursorStartPosition = value.length;

                element.val(value + insertText + originalValue.slice(cursorPosition));
                element.focus();

                var newPosition = cursorStartPosition + insertText.length + getCursorPosition(suggestion);
                element[0].setSelectionRange(newPosition, newPosition);
            }
        }
        this.isActive = false;
    };

    $.fn.autoSuggest = function(options) {
        if(options instanceof AutoSuggest) {
            options.addInputs(this);
            return options;
        } else {
            return new AutoSuggest(options, this);
        }
    };

    return AutoSuggest;
}));