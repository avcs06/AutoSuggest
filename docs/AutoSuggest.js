(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory(require('jquery')) :
	typeof define === 'function' && define.amd ? define(['jquery'], factory) :
	(global.AutoSuggest = factory(global.jQuery));
}(this, (function (jQuery) { 'use strict';

jQuery = jQuery && 'default' in jQuery ? jQuery['default'] : jQuery;

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var Utilities = {
    noop: function noop() {},
    noopd: function noopd(data) {
        return data;
    },

    ensure: function ensure(context, object, keys) {
        [].concat(keys).forEach(function (key) {
            if (typeof object[key] === 'undefined') {
                throw new Error('AutoSuggest: Missing required parameter, ' + context + '.' + key);
            }
        });
    },
    ensureType: function ensureType(context, object, key, type) {
        [].concat(object[key]).forEach(function (value) {
            if ((typeof value === 'undefined' ? 'undefined' : _typeof(value)) !== type) {
                throw new Error('AutoSuggest: Invalid Type for ' + context + '.' + key + ', expected ' + type);
            }
        });
    },

    cloneStyle: function cloneStyle(element1, element2) {
        var style1 = window.getComputedStyle($(element1)[0], null);
        var style2 = {};

        Array.prototype.forEach.call(style1, function (property) {
            style2[property] = style1.getPropertyValue(property);
        });
        $(element2).css(style2);
    },
    getGlobalOffset: function getGlobalOffset(element) {
        var obj = element;
        var left = 0;
        var top = 0;
        do {
            left += obj.offsetLeft;
            top += obj.offsetTop;
        } while (obj = obj.offsetParent);
        return { left: left, top: top };
    },
    getScrollLeftForInput: function getScrollLeftForInput(element) {
        if (element.createTextRange) {
            var range = element.createTextRange();
            var inputStyle = window.getComputedStyle(element, undefined);
            var paddingLeft = parseFloat(inputStyle.paddingLeft);
            var rangeRect = range.getBoundingClientRect();
            return element.getBoundingClientRect().left + element.clientLeft + paddingLeft - rangeRect.left;
        } else {
            return $(element).scrollLeft();
        }
    },
    getCursorPosition: function getCursorPosition(input) {
        var position = 0;

        if (typeof input.selectionDirection !== 'undefined') {
            position = input.selectionDirection == 'backward' ? input.selectionStart : input.selectionEnd;
        } else if (document.selection) {
            input.focus();
            var selection = document.selection.createRange();
            selection.moveStart('character', -input.value.length);
            position = selection.text.length;
        }

        return position;
    },

    htmlEncode: function htmlEncode(value) {
        return $('<div/>').text(value).html();
    }
};

var _typeof$1 = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var $$2 = jQuery;
var defaultOptions$1 = {
    trigger: null,
    caseSensitive: true
};

function validateSuggestions(suggestions, ignoreOn) {
    return [].concat(suggestions).map(function (suggestion) {
        var type = typeof suggestion === 'undefined' ? 'undefined' : _typeof$1(suggestion);
        if (type === 'string') {
            suggestion = {
                show: suggestion,
                replaceWith: suggestion,
                cursorPosition: [0, 0]
            };

            if (!ignoreOn) {
                suggestion.on = [suggestion.show];
            }
        } else if (type === 'object') {
            Utilities.ensure('Suggestion', suggestion, ['show', 'replaceWith']);
            Utilities.ensureType('Suggestion', suggestion, 'show', 'string');
            Utilities.ensureType('Suggestion', suggestion, 'replaceWith', 'string');
            suggestion.cursorPosition = suggestion.cursorPosition || [0, 0];
            if (suggestion.cursorPosition.constructor !== Array) {
                suggestion.cursorPosition = [suggestion.cursorPosition, suggestion.cursorPosition];
            }

            if (!ignoreOn) {
                Utilities.ensure('Suggestion', suggestion, 'on');
                Utilities.ensureType('Suggestion', suggestion, 'on', 'string');
                suggestion.on = [].concat(suggestion.on);
            }
        }
        return suggestion;
    });
}

function SuggestionList(options) {
    // validate options
    if (options && !options.suggestions) {
        options = {
            suggestions: options
        };
    }

    options = $$2.extend(true, {}, defaultOptions$1, options || {});
    Utilities.ensure('SuggestionList', options, 'suggestions');

    if (typeof options.suggestions === 'function') {
        this.getSuggestions = function (keyword, callback) {
            options.suggestions(keyword, function (suggestions) {
                return callback(validateSuggestions(suggestions, true));
            });
        };
    } else if (options.suggestions.constructor === Array || typeof options.suggestions === 'string') {
        options.suggestions = validateSuggestions(options.suggestions);
        this.getSuggestions = function (keyword, callback) {
            var match = new RegExp(keyword, !options.caseSensitive ? 'i' : '');
            callback(options.suggestions.filter(function (suggestion) {
                var matchFound = false;
                for (var i = 0; i < suggestion.on.length; i++) {
                    if (matchFound = match.test(suggestion.on[i])) {
                        break;
                    }
                }

                return matchFound;
            }));
        };
    }

    var trigger = options.trigger;
    if (trigger && typeof trigger !== 'string') {
        throw new Error('AutoSuggest: Invalid Type, SuggestionList.trigger should be a string');
    }

    if (trigger) {
        var escapedTrigger = '\\' + trigger.split('').join('\\');
        this.regex = new RegExp('(?:^|[^' + escapedTrigger + ']+)' + escapedTrigger + '(\\S*)$');
    } else {
        this.regex = new RegExp('(?:^|\\W+)(\\w+)$');
    }

    this.trigger = trigger;
}

var _createClass$1 = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck$1(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var $$3 = jQuery;

var SuggestionDropdown = function () {
    function SuggestionDropdown(options) {
        _classCallCheck$1(this, SuggestionDropdown);

        this.width = 0;
        this.hidden = true;

        this.dropdownContent = $$3('<ul class="dropdown-menu dropdown-menu-left"></ul>');
        this.dropdown = $$3('<div class="dropdown open as-dropdown" style="display:none; position: absolute;"></div>');
        $$3('body').append(this.dropdown.append(this.dropdownContent));
        this.hide();
    }

    _createClass$1(SuggestionDropdown, [{
        key: 'show',
        value: function show(position) {
            if (position) {
                this.dropdown[0].style.left = position.left + 'px';
                this.dropdown[0].style.top = position.top + 'px';

                if (position.left + this.width > $$3('body').width()) {
                    this.dropdown.find('.dropdown-menu').removeClass('dropdown-menu-left').addClass('dropdown-menu-right');
                } else {
                    this.dropdown.find('.dropdown-menu').removeClass('dropdown-menu-right').addClass('dropdown-menu-left');
                }
            }
            this.dropdown.find('li').removeClass('active');
            this.dropdown.find('li:first-child').addClass('active');
            this.dropdown.show();
            this.hidden = false;
        }
    }, {
        key: 'hide',
        value: function hide() {
            this.dropdown.hide();
            this.hidden = true;
        }
    }, {
        key: 'setWidth',
        value: function setWidth() {
            this.width = this.dropdownContent.width();
        }
    }, {
        key: 'fill',
        value: function fill(suggestions, onSet) {
            var self = this;
            this.dropdownContent.empty();

            suggestions.forEach(function (suggestion) {
                var dropdownLink = $$3('<li><a>' + suggestion.show + '</a></li>');
                dropdownLink.data('as-linkcontent', suggestion);
                dropdownLink.mousedown(function () {
                    onSet(suggestion);
                    self.hide();
                    return false;
                });

                self.dropdownContent.append(dropdownLink);
            });

            if (this.hidden) {
                this.show();
                this.setWidth();
                this.hide();
            } else {
                this.setWidth();
            }
        }
    }, {
        key: 'getValue',
        value: function getValue() {
            return this.dropdown.find('li.active').data('as-linkcontent');
        }
    }, {
        key: 'next',
        value: function next() {
            var activeLink = this.dropdown.find('li.active');
            var nextLink = activeLink.next();

            activeLink.removeClass('active');
            if (nextLink.length) {
                nextLink.addClass('active');
            } else {
                this.dropdown.find('li:first-child').addClass('active');
            }

            return this.getValue();
        }
    }, {
        key: 'prev',
        value: function prev() {
            var activeLink = this.dropdown.find('li.active');
            var prevLink = activeLink.prev();

            activeLink.removeClass('active');
            if (prevLink.length) {
                prevLink.addClass('active');
            } else {
                this.dropdown.find('li:last-child').addClass('active');
            }

            return this.getValue();
        }
    }]);

    return SuggestionDropdown;
}();

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var $$1 = jQuery;

function extendFromGlobalOptions(currentOptions, globalOptions, optionList) {
    optionList.forEach(function (option) {
        if (typeof globalOptions[option] !== 'undefined' && typeof currentOptions[option] === 'undefined') {
            currentOptions[option] = globalOptions[option];
        }
    });
}

function getCaretPosition(element) {
    if (element.data('as-isinput')) {
        var originalValue = element.val();
        var cursorPosition = Utilities.getCursorPosition(element[0]);
        var value = originalValue.slice(0, cursorPosition);

        //Create a clone of our input field using div and copy value into div
        //Wrap last character in a span to get its position
        $$1('.as-positionclone').remove();

        var clone = $$1('<div class="as-positionclone"/>');
        var cloneContent = $$1('<div style="display:inline-block;">' + Utilities.htmlEncode(value.slice(0, -1)) + '<span id="as-positioner">' + Utilities.htmlEncode(value.slice(-1)) + '</span>' + Utilities.htmlEncode(originalValue.slice(cursorPosition)) + '</div>');

        clone.append(cloneContent);
        Utilities.cloneStyle(element[0], clone[0]);

        //Get position of element and overlap our clone on the element
        var elementPosition = Utilities.getGlobalOffset(element[0]);
        clone.css({
            position: 'absolute',
            opacity: 0,
            left: elementPosition.left + 'px',
            top: elementPosition.top + 'px'
        });

        //append clone and scroll
        $$1('body').append(clone);

        //Extra styles for the clone depending on type of input
        if (element.is('input')) {
            clone.css({ overflowX: 'auto', whiteSpace: 'nowrap' });
            if (cursorPosition === originalValue.length) {
                clone.scrollLeft(cloneContent.width());
            } else {
                clone.scrollLeft(Math.min(Utilities.getScrollLeftForInput(element[0]), cloneContent.width()));
            }
        } else {
            cloneContent.css('max-width', '100%');
            clone.scrollLeft(element.scrollLeft());
            clone.scrollTop(element.scrollTop());
        }

        //Get position of span
        var caretPosition = Utilities.getGlobalOffset($$1('#as-positioner')[0]);
        caretPosition.left += 10 - clone.scrollLeft();
        caretPosition.top += 28 - clone.scrollTop();
        clone.remove();

        return caretPosition;
    }
}

var defaultOptions = {
    suggestions: []
};

var AutoSuggest = function () {
    function AutoSuggest(options, inputs) {
        _classCallCheck(this, AutoSuggest);

        options = $$1.extend(true, {}, defaultOptions, options || {});

        this.isActive = false;
        this.activeElement = null;
        this.activeElementCursorPosition = 0;
        this.activeSuggestionList = null;

        this.dropdown = new SuggestionDropdown();

        // validate suggestions
        this.suggestionLists = [].concat(options.suggestions);

        for (var i = 0; i < this.suggestionLists.length; i++) {
            var currentSuggestionList = this.suggestionLists[i];
            if (!currentSuggestionList) {
                throw new Error('AutoSuggest: invalid suggestion list passed');
            }

            if (!(currentSuggestionList instanceof SuggestionList)) {
                if (!currentSuggestionList.suggestions) {
                    currentSuggestionList = {
                        suggestions: currentSuggestionList
                    };
                }

                extendFromGlobalOptions(currentSuggestionList, options, ['caseSensitive', 'trigger']);
                this.suggestionLists[i] = new SuggestionList(currentSuggestionList);
            }
        }

        inputs && this.addInputs(inputs);
    }

    _createClass(AutoSuggest, [{
        key: 'addInputs',
        value: function addInputs(inputs) {
            inputs = $$1(inputs);
            var self = this;

            // validate element
            inputs.each(function () {
                var that = $$1(this);
                if (this.isContentEditable) {
                    that.data('as-isinput', false);
                } else if (that.is('input[type = text],textarea')) {
                    that.data('as-isinput', true);
                } else {
                    throw new Error('AutoSuggest: Invalid input: only input[type = text], textarea and contenteditable elements are supported');
                }
            });

            // init events
            inputs.on('input', function () {
                var that = $$1(this);
                var value = that.val();

                if (that.data('as-isinput')) {
                    var cursorPosition = Utilities.getCursorPosition(this);
                    self.activeElementCursorPosition = cursorPosition;
                    value = value.slice(0, cursorPosition);
                }

                self.isActive = false;

                var _loop = function _loop(currentSuggestionList) {
                    if (currentSuggestionList.regex.test(value)) {
                        self.activeSuggestionList = currentSuggestionList;
                        var match = value.match(currentSuggestionList.regex)[1];
                        currentSuggestionList.getSuggestions(match, function (results) {
                            if (results.length) {
                                self.isActive = true;
                                self.dropdown.fill(results, function (suggestion) {
                                    return self.setValue(suggestion, currentSuggestionList);
                                });
                                self.dropdown.show(getCaretPosition(that));
                            } else {
                                self.dropdown.hide();
                            }
                        });
                        return 'break';
                    }
                };

                var _iteratorNormalCompletion = true;
                var _didIteratorError = false;
                var _iteratorError = undefined;

                try {
                    for (var _iterator = self.suggestionLists[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                        var currentSuggestionList = _step.value;

                        var _ret = _loop(currentSuggestionList);

                        if (_ret === 'break') break;
                    }
                } catch (err) {
                    _didIteratorError = true;
                    _iteratorError = err;
                } finally {
                    try {
                        if (!_iteratorNormalCompletion && _iterator.return) {
                            _iterator.return();
                        }
                    } finally {
                        if (_didIteratorError) {
                            throw _iteratorError;
                        }
                    }
                }

                if (!self.isActive) {
                    self.dropdown.hide();
                }
            });

            inputs.keydown(function (event, originalEvent) {
                if (self.isActive) {
                    var newValue = void 0;
                    var e = originalEvent || event;
                    if (e.keyCode === 13 || e.keyCode === 9) {
                        self.setValue(self.dropdown.getValue(), self.activeSuggestionList);
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
                self.isActive = false;
                self.dropdown.hide();
            }).focus(function () {
                self.activeElement = $$1(this);
            });
        }
    }, {
        key: 'setValue',
        value: function setValue(suggestion, suggestionList) {
            var self = this;
            var element = this.activeElement;
            var insertText = suggestion.replaceWith;

            if (element) {
                if (element.data('as-isinput')) {
                    var originalValue = element.val();
                    var cursorPosition = self.activeElementCursorPosition;
                    var value = originalValue.slice(0, cursorPosition);
                    var currentValue = value.split(suggestionList.trigger || /\W/).pop();

                    value = value.slice(0, 0 - currentValue.length - (suggestionList.trigger || '').length);
                    var cursorStartPosition = value.length;

                    element.val(value + insertText + originalValue.slice(cursorPosition));
                    element.focus();

                    var newCursorPositions = suggestion.cursorPosition;
                    var newPosition = cursorStartPosition + insertText.length;
                    var newPosition1 = newPosition + newCursorPositions[0];
                    var newPosition2 = newPosition + newCursorPositions[1];

                    element[0].setSelectionRange(newPosition1, newPosition2);
                }
            }
            this.isActive = false;
        }
    }]);

    return AutoSuggest;
}();

$$1.fn.autoSuggest = function (options) {
    if (options instanceof AutoSuggest) {
        options.addInputs(this);
        return options;
    } else {
        return new AutoSuggest(options, this);
    }
};

return AutoSuggest;

})));
//# sourceMappingURL=AutoSuggest.js.map
