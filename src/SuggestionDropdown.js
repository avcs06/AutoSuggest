import jQuery from 'jquery';
const $ = jQuery;

class SuggestionDropdown {
    constructor(options) {
        this.width = 0;
        this.hidden = true;

        this.dropdownContent = $('<ul class="dropdown-menu dropdown-menu-left"></ul>');
        this.dropdown = $('<div class="dropdown open as-dropdown" style="display:none; position: absolute;"></div>');
        $('body').append(this.dropdown.append(this.dropdownContent));
        this.hide();
    }

    show(position) {
        if (position) {
            this.dropdown[0].style.left = `${position.left}px`;
            this.dropdown[0].style.top = `${position.top}px`;

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
    }

    hide() {
        this.dropdown.hide();
        this.hidden = true;
    }

    setWidth() {
        this.width = this.dropdownContent.width();
    }

    fill(suggestions, onSet) {
        const self = this;
        this.dropdownContent.empty();

        suggestions.forEach(suggestion => {
            const dropdownLink = $(`<li><a>${suggestion.show}</a></li>`);
            dropdownLink.data('as-linkcontent', suggestion);
            dropdownLink.mousedown(() => {
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

    getValue() {
        return this.dropdown.find('li.active').data('as-linkcontent');
    }

    next() {
        const activeLink = this.dropdown.find('li.active');
        const nextLink = activeLink.next();

        activeLink.removeClass('active');
        if(nextLink.length) {
            nextLink.addClass('active');
        } else {
            this.dropdown.find('li:first-child').addClass('active');
        }

        return this.getValue();
    }

    prev() {
        const activeLink = this.dropdown.find('li.active');
        const prevLink = activeLink.prev();

        activeLink.removeClass('active');
        if(prevLink.length) {
            prevLink.addClass('active');
        } else {
            this.dropdown.find('li:last-child').addClass('active');
        }

        return this.getValue();
    }
}

export default SuggestionDropdown;
