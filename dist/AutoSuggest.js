(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(global.AutoSuggest = factory());
}(this, (function () { 'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
  return typeof obj;
} : function (obj) {
  return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
};











var classCallCheck = function (instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
};

var createClass = function () {
  function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  return function (Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);
    if (staticProps) defineProperties(Constructor, staticProps);
    return Constructor;
  };
}();

var ensure = function ensure(context, object, keys) {
    [].concat(keys).forEach(function (key) {
        if (typeof object[key] === 'undefined') {
            throw new Error('AutoSuggest: Missing required parameter, ' + context + '.' + key);
        }
    });
};
var ensureType = function ensureType(context, object, key, type) {
    [].concat(object[key]).forEach(function (value) {
        if ((typeof value === 'undefined' ? 'undefined' : _typeof(value)) !== type) {
            throw new TypeError('AutoSuggest: Invalid Type for ' + context + '.' + key + ', expected ' + type);
        }
    });
};

var cloneStyle = function cloneStyle(element1, element2) {
    var allStyles = window.getComputedStyle(element1);
    for (var style in allStyles) {
        if (allStyles.hasOwnProperty(style)) {
            element2.style.setProperty(style, allStyles[style]);
        }
    }
};

var getComputedStyle = function getComputedStyle(element, style) {
    return window.getComputedStyle(element).getPropertyValue(style);
};

var getGlobalOffset = function getGlobalOffset($0) {
    var node = $0,
        top = 0,
        left = 0;

    do {
        left += node.offsetLeft;
        top += node.offsetTop;
    } while (node = node.offsetParent);

    return { left: left, top: top };
};

var getScrollLeftForInput = function getScrollLeftForInput(input) {
    if (input.createTextRange) {
        var range = input.createTextRange();
        var inputStyle = window.getComputedStyle(input);
        var paddingLeft = parseFloat(inputStyle.paddingLeft);
        var rangeRect = range.getBoundingClientRect();
        return input.getBoundingClientRect().left + input.clientLeft + paddingLeft - rangeRect.left;
    } else {
        return input.scrollLeft;
    }
};

var getCursorPosition = function getCursorPosition(input) {
    var position = 0;

    if (typeof input.selectionDirection !== 'undefined') {
        position = input.selectionDirection === 'backward' ? input.selectionStart : input.selectionEnd;
    } else if (document.selection) {
        input.focus();
        var selection = document.selection.createRange();
        selection.moveStart('character', -input.value.length);
        position = selection.text.length;
    }

    return position;
};

var getContainerTextNode = function getContainerTextNode() {
    var selection = window.getSelection();
    var cursorPosition = selection.focusOffset;
    var containerTextNode = selection.focusNode;

    if (containerTextNode.nodeType !== containerTextNode.TEXT_NODE) {
        containerTextNode = containerTextNode.childNodes[cursorPosition];
        while (containerTextNode && containerTextNode.nodeType !== containerTextNode.TEXT_NODE) {
            containerTextNode = containerTextNode.firstChild;
        }

        cursorPosition = 0;
    }

    return { cursorPosition: cursorPosition, containerTextNode: containerTextNode };
};

var makeAsyncQueueRunner = function makeAsyncQueueRunner() {
    var i = 0;
    var queue = [];

    return function (f, j) {
        queue[j - i] = f;
        while (queue[0]) {
            ++i, queue.shift()();
        }
    };
};

var data = function data(element, key, value) {
    key = 'autosuggest_' + key;
    if (typeof value !== 'undefined') {
        element.dataset[key] = JSON.stringify(value);
    } else {
        value = element.dataset[key];
        return typeof value !== 'undefined' ? JSON.parse(element.dataset[key]) : value;
    }
};

var createNode = function createNode(html) {
    var div = document.createElement('div');
    div.innerHTML = html.trim();
    return div.firstChild;
};

function validateSuggestions(suggestions) {
    return [].concat(suggestions).map(function (suggestion) {
        var type = typeof suggestion === 'undefined' ? 'undefined' : _typeof(suggestion);
        if (type === 'string') {
            suggestion = {
                on: [suggestion],
                show: suggestion,
                use: suggestion,
                focus: [0, 0]
            };
        } else if (type === 'object') {
            try {
                ensure('Suggestion', suggestion, 'value');
                ensureType('Suggestion', suggestion, 'value', 'string');
            } catch (e1) {
                if (e1 instanceof TypeError) throw e1;

                try {
                    ensure('Suggestion', suggestion, ['on', 'show', 'use']);
                } catch (e2) {
                    if (suggestion.on || suggestion.show || suggestion.use) {
                        throw e2;
                    } else {
                        throw e1;
                    }
                }

                ensureType('Suggestion', suggestion, 'on', 'string');
                ensureType('Suggestion', suggestion, 'use', 'string');
                ensureType('Suggestion', suggestion, 'show', 'string');
            }

            suggestion.show = suggestion.show || suggestion.value;
            suggestion.use = suggestion.use || suggestion.value;
            suggestion.on = [suggestion.show].concat(suggestion.on || suggestion.value);

            suggestion.focus = suggestion.focus || [0, 0];
            if (suggestion.focus.constructor !== Array) {
                suggestion.focus = [suggestion.focus, suggestion.focus];
            }
        }

        return suggestion;
    });
}

function SuggestionList(options) {
    // validate options
    if (options && !options.values) {
        options = {
            values: options
        };
    }

    try {
        ensure('SuggestionList', options, 'trigger');
        ensureType('Suggestion', options, 'trigger', 'string');
    } catch (e) {
        if (e instanceof TypeError) throw e;
    }

    ensure('SuggestionList', options, 'values');
    options.caseSensitive = Boolean(options.caseSensitive);

    if (typeof options.values === 'function') {
        this.getSuggestions = function (keyword, callback) {
            options.values(keyword, function (values) {
                return callback(validateSuggestions(values));
            });
        };
    } else if (options.values.constructor === Array || typeof options.values === 'string') {
        options.values = validateSuggestions(options.values);
        this.getSuggestions = function (keyword, callback) {
            var matcher = new RegExp('^' + keyword, !options.caseSensitive ? 'i' : '');
            callback(options.values.filter(function (value) {
                var matchFound = false;
                for (var i = 0; i < value.on.length; i++) {
                    if (matchFound = matcher.test(value.on[i])) {
                        break;
                    }
                }

                return matchFound;
            }));
        };
    }

    this.trigger = options.trigger;
    if (this.trigger) {
        var escapedTrigger = '\\' + this.trigger.split('').join('\\');
        this.regex = new RegExp('(?:^|[^' + escapedTrigger + ']+?)' + escapedTrigger + '(\\S*)$');
    } else {
        this.regex = new RegExp('(?:^|\\W+)(\\w+)$');
    }
}

SuggestionList.prototype.getMatch = function (value) {
    return value.match(this.regex)[1];
};

var SuggestionDropdown = function () {
    function SuggestionDropdown() {
        classCallCheck(this, SuggestionDropdown);

        this.width = 0;
        this.isEmpty = true;
        this.isActive = false;

        this.dropdownContent = document.createElement('ul');
        this.dropdownContent.className = 'dropdown-menu dropdown-menu-left';

        this.dropdown = document.createElement('div');
        this.dropdown.className = 'dropdown open';
        this.dropdown.style.position = 'absolute';

        this.hide();
        this.dropdown.appendChild(this.dropdownContent);
        document.body.appendChild(this.dropdown);
    }

    createClass(SuggestionDropdown, [{
        key: 'show',
        value: function show(position) {
            if (position) {
                this.dropdown.style.left = position.left + 'px';
                this.dropdown.style.top = position.top + 'px';

                if (position.left + this.width > document.body.offsetWidth) {
                    this.dropdownContent.classList.remove('dropdown-menu-left');
                    this.dropdownContent.classList.add('dropdown-menu-right');
                } else {
                    this.dropdownContent.classList.remove('dropdown-menu-right');
                    this.dropdownContent.classList.add('dropdown-menu-left');
                }
            }

            this.dropdown.style.display = 'block';
            this.isActive = true;
        }
    }, {
        key: 'hide',
        value: function hide() {
            this.dropdown.style.display = 'none';
            this.isActive = false;
        }
    }, {
        key: 'empty',
        value: function empty() {
            this.dropdownContent.innerHTML = '';
            this.isEmpty = true;
        }
    }, {
        key: 'fill',
        value: function fill(suggestions, onSet) {
            var _this = this;

            this.empty();
            suggestions.forEach(function (suggestion) {
                var dropdownLink = createNode('<li><a>' + suggestion.show + '</a></li>');
                _this.dropdownContent.append(dropdownLink);
                data(dropdownLink, 'suggestion', suggestion);

                dropdownLink.addEventListener('mouseenter', function () {
                    _this.getActive().classList.remove('active');
                    dropdownLink.classList.add('active');
                });

                dropdownLink.addEventListener('mousedown', function (e) {
                    onSet(suggestion);
                    _this.hide();
                    e.preventDefault();
                    e.stopPropagation();
                });
            });

            // Calculate width
            if (!this.isActive) {
                this.show();
            }

            this.width = this.dropdownContent.offsetWidth;

            if (!this.isActive) {
                this.hide();
            }

            this.setActive();
            this.isEmpty = false;
        }
    }, {
        key: 'showLoader',
        value: function showLoader(position) {
            this.empty();
            this.dropdownContent.innerHTML = '<div class="autosuggest-loader">Loading...</div>';
            this.show(position);
        }
    }, {
        key: 'getActive',
        value: function getActive() {
            var activeLinks = Array.prototype.slice.call(this.dropdownContent.querySelectorAll('li.active'), 0);
            while (activeLinks[1]) {
                activeLinks.pop().classList.remove('active');
            }

            return activeLinks[0];
        }
    }, {
        key: 'getValue',
        value: function getValue(element) {
            return data(element || this.getActive(), 'suggestion');
        }
    }, {
        key: 'setActive',
        value: function setActive() {
            var element = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : this.dropdownContent.firstElementChild;
            var activeLink = arguments[1];

            activeLink && activeLink.classList.remove('active');
            element.classList.add('active');
        }
    }, {
        key: 'selectNext',
        value: function selectNext() {
            var activeLink = this.getActive();
            var nextLink = activeLink.nextElementSibling || this.dropdownContent.firstElementChild;
            this.setActive(nextLink, activeLink);
        }
    }, {
        key: 'selectPrev',
        value: function selectPrev() {
            var activeLink = this.getActive();
            var prevLink = activeLink.previousElementSibling || this.dropdownContent.lastElementChild;
            this.setActive(prevLink, activeLink);
        }
    }]);
    return SuggestionDropdown;
}();

function splitValue(originalValue, cursorPosition, trigger) {
    var value = originalValue.slice(0, cursorPosition);
    var textAfterTrigger = value.split(trigger || /\W/).pop();
    var textUptoTrigger = textAfterTrigger.length ? value.slice(0, 0 - textAfterTrigger.length) : value;
    textAfterTrigger += originalValue.slice(cursorPosition);
    return { textAfterTrigger: textAfterTrigger, textUptoTrigger: textUptoTrigger };
}

// Invisible character
var POSITIONER_CHARACTER = '\uFEFF';
function getCaretPosition(element, trigger) {
    if (data(element, 'isInput')) {
        var cursorPosition = getCursorPosition(element);

        var _splitValue = splitValue(element.value, cursorPosition, trigger),
            textAfterTrigger = _splitValue.textAfterTrigger,
            textUptoTrigger = _splitValue.textUptoTrigger;

        // pre to retain special characters


        var clone = document.createElement('pre');
        clone.id = 'autosuggest-positionclone';

        var positioner = document.createElement('span');
        positioner.appendChild(document.createTextNode(POSITIONER_CHARACTER));

        clone.appendChild(document.createTextNode(textUptoTrigger.replace(/ /g, '\xA0')));
        clone.appendChild(positioner);
        clone.appendChild(document.createTextNode(textAfterTrigger.replace(/ /g, '\xA0')));
        cloneStyle(element, clone);

        var elementPosition = getGlobalOffset(element);
        clone.style.opacity = 0;
        clone.style.position = 'absolute';
        clone.style.top = elementPosition.top + 'px';
        clone.style.left = elementPosition.left + 'px';
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

        var caretPosition = getGlobalOffset(positioner);
        caretPosition.left -= clone.scrollLeft;

        var charHeight = parseFloat(getComputedStyle(positioner, 'line-height'));
        caretPosition.top += charHeight - clone.scrollTop;

        document.body.removeChild(clone);
        return caretPosition;
    } else {
        var _window$getSelection$ = window.getSelection().getRangeAt(0),
            startContainer = _window$getSelection$.startContainer,
            startOffset = _window$getSelection$.startOffset,
            endContainer = _window$getSelection$.endContainer,
            endOffset = _window$getSelection$.endOffset;

        var _getContainerTextNode = getContainerTextNode(),
            _cursorPosition = _getContainerTextNode.cursorPosition,
            containerTextNode = _getContainerTextNode.containerTextNode;

        var _splitValue2 = splitValue(containerTextNode.nodeValue, _cursorPosition, trigger),
            _textAfterTrigger = _splitValue2.textAfterTrigger,
            _textUptoTrigger = _splitValue2.textUptoTrigger;

        var parentNode = containerTextNode.parentNode;
        var referenceNode = containerTextNode.nextSibling;

        var _positioner = document.createElement("span");
        _positioner.appendChild(document.createTextNode(POSITIONER_CHARACTER));
        parentNode.insertBefore(_positioner, referenceNode);

        if (_textAfterTrigger) {
            containerTextNode.nodeValue = _textUptoTrigger;
            var remainingTextNode = document.createTextNode(_textAfterTrigger);
            parentNode.insertBefore(remainingTextNode, referenceNode);
        }

        var _caretPosition = getGlobalOffset(_positioner);
        var _charHeight = parseFloat(getComputedStyle(_positioner, 'line-height'));
        _caretPosition.top += _charHeight;

        // Reset DOM to the state before changes
        parentNode.removeChild(_positioner);
        if (_textAfterTrigger) {
            parentNode.removeChild(containerTextNode.nextSibling);
            containerTextNode.nodeValue = _textUptoTrigger + _textAfterTrigger;
        }

        var selection = window.getSelection().getRangeAt(0);
        selection.setStart(startContainer, startOffset);
        selection.setEnd(endContainer, endOffset);

        return _caretPosition;
    }
}

var getModifiedValue = function getModifiedValue(originalValue, insertText, cursorPosition, trigger) {
    var value = originalValue.slice(0, cursorPosition);
    var currentValue = value.split(trigger || /\W/).pop();
    value = value.slice(0, 0 - currentValue.length - (trigger || '').length);
    return value + insertText + originalValue.slice(cursorPosition);
};

var getFocusPosition = function getFocusPosition(originalValue, modifiedValue, cursorPosition, focus) {
    var cursorStartPosition = modifiedValue.length - (originalValue.length - cursorPosition);
    return [cursorStartPosition + focus[0], cursorStartPosition + focus[1]];
};

var setValue = function setValue(_ref) {
    var element = _ref.element,
        trigger = _ref.trigger,
        suggestion = _ref.suggestion,
        onChange = _ref.onChange;

    var insertText = suggestion.use;

    if (data(element, 'isInput')) {
        var cursorPosition = getCursorPosition(element);
        var originalValue = element.value;
        var modifiedValue = getModifiedValue(originalValue, insertText, cursorPosition, trigger);
        element.value = modifiedValue;
        element.focus();

        var focusPostion = getFocusPosition(originalValue, modifiedValue, cursorPosition, suggestion.focus);
        element.setSelectionRange(focusPostion[0], focusPostion[1]);
    } else {
        var _getContainerTextNode2 = getContainerTextNode(),
            _cursorPosition2 = _getContainerTextNode2.cursorPosition,
            containerTextNode = _getContainerTextNode2.containerTextNode;

        if (!containerTextNode) return null;

        var _originalValue = containerTextNode.nodeValue;
        var _modifiedValue = getModifiedValue(_originalValue, insertText, _cursorPosition2, trigger);
        containerTextNode.nodeValue = _modifiedValue;

        var _focusPostion = getFocusPosition(_originalValue, _modifiedValue, _cursorPosition2, suggestion.focus);
        var selection = window.getSelection().getRangeAt(0);
        selection.setStart(containerTextNode, _focusPostion[0]);
        selection.setEnd(containerTextNode, _focusPostion[1]);
    }

    onChange(element, suggestion);
};

var AutoSuggest = function () {
    function AutoSuggest(options) {
        classCallCheck(this, AutoSuggest);

        if (!options) {
            throw new Error('AutoSuggest: Missing required parameter, options');
        }

        this.inputs = [];
        this.dropdown = new SuggestionDropdown();
        this.onChange = options.onChange || Function.prototype;
        this.maxSuggestions = options.maxSuggestions || 10;

        // validate suggestions
        this.suggestionLists = options.suggestions || [];
        for (var i = 0; i < this.suggestionLists.length; i++) {
            var suggestionList = this.suggestionLists[i];
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
            var self = this;
            var activeSuggestionList = null;
            var handledInKeyDown = false;

            this.onBlurHandler = function () {
                self.dropdown.hide();
            };

            this.onKeyDownHandler = function (e) {
                handledInKeyDown = false;
                if (self.dropdown.isActive) {
                    var preventDefaultAction = function preventDefaultAction() {
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

            var keyUpIndex = 0;
            this.onKeyUpHandler = function (e) {
                var _this = this;

                if (handledInKeyDown) return;

                var value = void 0;
                if (data(this, 'isInput')) {
                    var cursorPosition = getCursorPosition(this);
                    if (/[a-zA-Z_0-9]/.test(this.value.charAt(cursorPosition) || ' ')) {
                        self.dropdown.hide();
                        return;
                    }

                    value = this.value.slice(0, cursorPosition);
                } else {
                    var _getContainerTextNode3 = getContainerTextNode(),
                        _cursorPosition3 = _getContainerTextNode3.cursorPosition,
                        containerTextNode = _getContainerTextNode3.containerTextNode;

                    if (!containerTextNode || /[a-zA-Z_0-9]/.test(containerTextNode.nodeValue.charAt(_cursorPosition3) || ' ')) {
                        self.dropdown.hide();
                        return;
                    }

                    value = containerTextNode.nodeValue.slice(0, _cursorPosition3);
                }

                handleDropdown: {
                    (function () {
                        keyUpIndex++;
                        self.dropdown.empty();

                        var executeQueue = makeAsyncQueueRunner();
                        var i = 0,
                            timer = void 0,
                            triggerMatchFound = false;

                        var _loop = function _loop(_suggestionList) {
                            if (_suggestionList.regex.test(value)) {
                                triggerMatchFound = true;

                                (function (i, asyncReference) {
                                    var match = _suggestionList.getMatch(value);
                                    var caretPosition = getCaretPosition(_this, _suggestionList.trigger);

                                    if (self.dropdown.isEmpty) {
                                        timer && clearTimeout(timer);
                                        timer = setTimeout(function () {
                                            self.dropdown.showLoader(caretPosition);
                                        }, 0);
                                    }

                                    _suggestionList.getSuggestions(match, function (results) {
                                        if (asyncReference !== keyUpIndex) return;

                                        executeQueue(function () {
                                            timer && clearTimeout(timer);
                                            if (self.dropdown.isEmpty) {
                                                if (results.length) {
                                                    activeSuggestionList = _suggestionList;
                                                    self.dropdown.fill(results.slice(0, self.maxSuggestions), function (suggestion) {
                                                        setValue({
                                                            element: _this,
                                                            trigger: _suggestionList.trigger,
                                                            suggestion: suggestion,
                                                            onChange: self.onChange
                                                        });
                                                    });

                                                    self.dropdown.show(caretPosition);
                                                } else {
                                                    self.dropdown.hide();
                                                }
                                            }
                                        }, i);
                                    });
                                })(i++, keyUpIndex);
                            }
                        };

                        var _iteratorNormalCompletion = true;
                        var _didIteratorError = false;
                        var _iteratorError = undefined;

                        try {
                            for (var _iterator = self.suggestionLists[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                                var _suggestionList = _step.value;

                                _loop(_suggestionList);
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

                        if (!triggerMatchFound) {
                            self.dropdown.hide();
                        }
                    })();
                }
            };
        }

        // initialize events on inputs

        for (var _len = arguments.length, inputs = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
            inputs[_key - 1] = arguments[_key];
        }

        this.addInputs.apply(this, inputs);
    }

    createClass(AutoSuggest, [{
        key: 'addInputs',
        value: function addInputs() {
            var _this2 = this;

            for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
                args[_key2] = arguments[_key2];
            }

            var inputs = Array.prototype.concat.apply([], args.map(function (d) {
                return d[0] ? Array.prototype.slice.call(d, 0) : d;
            }));

            inputs.forEach(function (input) {
                // validate element
                if (input.isContentEditable) {
                    data(input, 'isInput', false);
                } else if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT' && input.type === 'text') {
                    data(input, 'isInput', true);
                } else {
                    throw new Error('AutoSuggest: Invalid input: only input[type = text], textarea and contenteditable elements are supported');
                }

                // init events
                input.addEventListener('blur', _this2.onBlurHandler);
                input.addEventListener('keyup', _this2.onKeyUpHandler);
                input.addEventListener('keydown', _this2.onKeyDownHandler, true);

                data(input, 'index', _this2.inputs.push(input) - 1);
            });
        }
    }, {
        key: 'removeInputs',
        value: function removeInputs() {
            var _this3 = this;

            for (var _len3 = arguments.length, args = Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
                args[_key3] = arguments[_key3];
            }

            var inputs = Array.prototype.concat.apply([], args.map(function (d) {
                return d[0] ? Array.prototype.slice.call(d, 0) : d;
            }));

            inputs.forEach(function (input) {
                var index = data(input, 'index');
                if (!isNaN(index)) {
                    _this3.inputs.splice(index, 1);

                    // destroy events
                    input.removeEventListener('blur', _this3.onBlurHandler);
                    input.removeEventListener('keyup', _this3.onKeyUpHandler);
                    input.removeEventListener('keydown', _this3.onKeyDownHandler, true);
                }
            });
        }
    }, {
        key: 'destroy',
        value: function destroy() {
            this.removeInputs(this.inputs);
        }
    }]);
    return AutoSuggest;
}();

return AutoSuggest;

})));
//# sourceMappingURL=AutoSuggest.js.map
