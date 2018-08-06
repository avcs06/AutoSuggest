'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _jquery = require('jquery');

var _jquery2 = _interopRequireDefault(_jquery);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var $ = _jquery2.default;

var SuggestionDropdown = function () {
    function SuggestionDropdown(options) {
        _classCallCheck(this, SuggestionDropdown);

        this.width = 0;
        this.hidden = true;

        this.dropdownContent = $('<ul class="dropdown-menu dropdown-menu-left"></ul>');
        this.dropdown = $('<div class="dropdown open as-dropdown" style="display:none; position: absolute;"></div>');
        $('body').append(this.dropdown.append(this.dropdownContent));
        this.hide();
    }

    _createClass(SuggestionDropdown, [{
        key: 'show',
        value: function show(position) {
            if (position) {
                this.dropdown[0].style.left = position.left + 'px';
                this.dropdown[0].style.top = position.top + 'px';

                if (position.left + this.width > $('body').width()) {
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
                var dropdownLink = $('<li><a>' + suggestion.show + '</a></li>');
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

exports.default = SuggestionDropdown;