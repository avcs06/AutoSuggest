'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _jquery = require('jquery');

var _jquery2 = _interopRequireDefault(_jquery);

var _Utilities = require('./Utilities');

var _Utilities2 = _interopRequireDefault(_Utilities);

var _SuggestionList = require('./SuggestionList');

var _SuggestionList2 = _interopRequireDefault(_SuggestionList);

var _SuggestionDropdown = require('./SuggestionDropdown');

var _SuggestionDropdown2 = _interopRequireDefault(_SuggestionDropdown);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var $ = _jquery2.default;

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
        var cursorPosition = _Utilities2.default.getCursorPosition(element[0]);
        var value = originalValue.slice(0, cursorPosition);

        //Create a clone of our input field using div and copy value into div
        //Wrap last character in a span to get its position
        $('.as-positionclone').remove();

        var clone = $('<div class="as-positionclone"/>');
        var cloneContent = $('<div style="display:inline-block;">' + _Utilities2.default.htmlEncode(value.slice(0, -1)) + '<span id="as-positioner">' + _Utilities2.default.htmlEncode(value.slice(-1)) + '</span>' + _Utilities2.default.htmlEncode(originalValue.slice(cursorPosition)) + '</div>');

        clone.append(cloneContent);
        _Utilities2.default.cloneStyle(element[0], clone[0]);

        //Get position of element and overlap our clone on the element
        var elementPosition = _Utilities2.default.getGlobalOffset(element[0]);
        clone.css({
            position: 'absolute',
            opacity: 0,
            left: elementPosition.left + 'px',
            top: elementPosition.top + 'px'
        });

        //append clone and scroll
        $('body').append(clone);

        //Extra styles for the clone depending on type of input
        if (element.is('input')) {
            clone.css({ overflowX: 'auto', whiteSpace: 'nowrap' });
            if (cursorPosition === originalValue.length) {
                clone.scrollLeft(cloneContent.width());
            } else {
                clone.scrollLeft(Math.min(_Utilities2.default.getScrollLeftForInput(element[0]), cloneContent.width()));
            }
        } else {
            cloneContent.css('max-width', '100%');
            clone.scrollLeft(element.scrollLeft());
            clone.scrollTop(element.scrollTop());
        }

        //Get position of span
        var caretPosition = _Utilities2.default.getGlobalOffset($('#as-positioner')[0]);
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

        options = $.extend(true, {}, defaultOptions, options || {});

        this.isActive = false;
        this.activeElement = null;
        this.activeElementCursorPosition = 0;
        this.activeSuggestionList = null;

        this.dropdown = new _SuggestionDropdown2.default();

        // validate suggestions
        this.suggestionLists = [].concat(options.suggestions);

        for (var i = 0; i < this.suggestionLists.length; i++) {
            var currentSuggestionList = this.suggestionLists[i];
            if (!currentSuggestionList) {
                throw new Error('AutoSuggest: invalid suggestion list passed');
            }

            if (!(currentSuggestionList instanceof _SuggestionList2.default)) {
                if (!currentSuggestionList.suggestions) {
                    currentSuggestionList = {
                        suggestions: currentSuggestionList
                    };
                }

                extendFromGlobalOptions(currentSuggestionList, options, ['caseSensitive', 'trigger']);
                this.suggestionLists[i] = new _SuggestionList2.default(currentSuggestionList);
            }
        }

        inputs && this.addInputs(inputs);
    }

    _createClass(AutoSuggest, [{
        key: 'addInputs',
        value: function addInputs(inputs) {
            inputs = $(inputs);
            var self = this;

            // validate element
            inputs.each(function () {
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
            inputs.on('input', function () {
                var that = $(this);
                var value = that.val();

                if (that.data('as-isinput')) {
                    var cursorPosition = _Utilities2.default.getCursorPosition(this);
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
                self.activeElement = $(this);
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

$.fn.autoSuggest = function (options) {
    if (options instanceof AutoSuggest) {
        options.addInputs(this);
        return options;
    } else {
        return new AutoSuggest(options, this);
    }
};

exports.default = AutoSuggest;