'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

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

exports.default = Utilities;