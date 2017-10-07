function SuggestionDropdown(options) {
    this.width = 0;
    this.hidden = true;
    this.setValue = options.setValue;

    this.dropdownContent = $('<ul class="dropdown-menu dropdown-menu-left"></ul>');
    this.dropdown = $('<div class="dropdown open as-dropdown" style="display:none; position: absolute;"></div>');
    $('body').append(this.dropdown.append(this.dropdownContent));
    this.hide();
}

SuggestionDropdown.prototype.show = function(position) {
    if (position) {
        this.dropdown[0].style.left = position.left + "px";
        this.dropdown[0].style.top = position.top + "px";

        if ((position.left + this.width) > $('body').width()) {
            this.dropdown.find('.dropdown-menu').removeClass('dropdown-menu-left').addClass('dropdown-menu-right');
        } else {
            this.dropdown.find('.dropdown-menu').removeClass('dropdown-menu-right').addClass('dropdown-menu-left');
        }
    }
    this.dropdown.find('li').removeClass('active');
    this.dropdown.find('li:first-child').addClass('active');
    this.dropdown.show();
    this.hidden = false;
};

SuggestionDropdown.prototype.hide = function() {
    this.dropdown.hide();
    this.hidden = true;
};

SuggestionDropdown.prototype.setWidth = function() {
    this.width = this.dropdownContent.width();
};

SuggestionDropdown.prototype.fill = function(suggestions, suggestionList) {
    var self = this;
    this.dropdownContent.empty();

    $.each(suggestions, function (i, suggestion) {
        var visual = '';
        if (typeof suggestion === 'string') {
            visual = suggestion;
        } else {
            if(suggestion.beforeShow && typeof suggestion.beforeShow === 'function') {
                visual = suggestion.beforeShow(suggestion);
            } else {
                visual = suggestionList.getVisual(suggestion);
            }
        }

        var dropdownLink = $('<li><a>' + visual + '</a></li>');
        dropdownLink.data('as-linkcontent', suggestion);
        dropdownLink.mousedown(function() {
            self.setValue(suggestion, suggestionList);
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
};

SuggestionDropdown.prototype.getValue = function() {
    return this.dropdown.find('li.active').data('as-linkcontent');
};

SuggestionDropdown.prototype.next = function() {
    var activeLink = this.dropdown.find('li.active');
    var nextLink = activeLink.next();

    activeLink.removeClass('active');
    if(nextLink.length) {
        nextLink.addClass('active');
    } else {
        this.dropdown.find('li:first-child').addClass('active');
    }

    return this.getValue();
};

SuggestionDropdown.prototype.prev = function() {
    var activeLink = this.dropdown.find('li.active');
    var prevLink = activeLink.prev();

    activeLink.removeClass('active');
    if(prevLink.length) {
        prevLink.addClass('active');
    } else {
        this.dropdown.find('li:last-child').addClass('active');
    }

    return this.getValue();
};
