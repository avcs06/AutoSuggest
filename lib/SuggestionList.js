'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _jquery = require('jquery');

var _jquery2 = _interopRequireDefault(_jquery);

var _Utilities = require('./Utilities');

var _Utilities2 = _interopRequireDefault(_Utilities);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var $ = _jquery2.default;
var defaultOptions = {
    trigger: null,
    caseSensitive: true
};

function validateSuggestions(suggestions, ignoreOn) {
    return [].concat(suggestions).map(function (suggestion) {
        var type = typeof suggestion === 'undefined' ? 'undefined' : _typeof(suggestion);
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
            _Utilities2.default.ensure('Suggestion', suggestion, ['show', 'replaceWith']);
            _Utilities2.default.ensureType('Suggestion', suggestion, 'show', 'string');
            _Utilities2.default.ensureType('Suggestion', suggestion, 'replaceWith', 'string');
            suggestion.cursorPosition = suggestion.cursorPosition || [0, 0];
            if (suggestion.cursorPosition.constructor !== Array) {
                suggestion.cursorPosition = [suggestion.cursorPosition, suggestion.cursorPosition];
            }

            if (!ignoreOn) {
                _Utilities2.default.ensure('Suggestion', suggestion, 'on');
                _Utilities2.default.ensureType('Suggestion', suggestion, 'on', 'string');
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

    options = $.extend(true, {}, defaultOptions, options || {});
    _Utilities2.default.ensure('SuggestionList', options, 'suggestions');

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

exports.default = SuggestionList;