import Utilities from './Utilities';

class SuggestionDropdown {
    constructor() {
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

    show(position) {
        if (position) {
            this.dropdown.style.left = `${position.left}px`;
            this.dropdown.style.top = `${position.top}px`;

            if ((position.left + this.width) > document.body.offsetWidth) {
                this.dropdownContent.classList.remove('dropdown-menu-left');
                this.dropdownContent.classList.add('dropdown-menu-right');
            } else {
                this.dropdownContent.classList.remove('dropdown-menu-right');
                this.dropdownContent.classList.add('dropdown-menu-left');
            }
        }

        const activeElement = this.getActive();
        activeElement && activeElement.classList.remove('active');
        this.dropdownContent.firstElementChild.classList.add('active');

        this.dropdown.style.display = 'block';
        this.isActive = true;
    }

    hide() {
        this.dropdown.style.display = 'none';
        this.isActive = false;
    }

    empty() {
        this.dropdownContent.innerHTML = '';
        this.isEmpty = true;
    }

    fill(suggestions, onSet) {
        suggestions.forEach(suggestion => {
            const dropdownLinkHTML = `<li><a>${suggestion.show}</a></li>`;
            this.dropdownContent.innerHTML += dropdownLinkHTML;

            const dropdownLink = this.dropdownContent.lastElementChild;
            Utilities.data(dropdownLink, 'suggestion', suggestion);

            dropdownLink.addEventListener('mouseenter', () => {
                this.getActive().classList.remove('active');
                dropdownLink.classList.add('active');
            });

            dropdownLink.addEventListener('mousedown', (e) => {
                onSet(suggestion);
                this.hide();
                e.preventDefault();
                e.stopPropagation();
            });
        });

        // Calculate width
        if (this.isActive) {
            this.setWidth();
            if (this.dropdown.style.top);
        } else {
            this.show();
            this.setWidth();
            this.hide();
        }

        this.isEmpty = false;
    }

    setWidth() {
        this.width = this.dropdownContent.offsetWidth;
    }

    getActive() {
        const activeLinks = Array.prototype.slice.call(this.dropdownContent.querySelectorAll('li.active'), 0);
        while (activeLinks[1]) {
            activeLinks.pop().classList.remove('active');
        }

        return activeLinks[0];
    }

    getValue(element) {
        return Utilities.data((element || this.getActive()), 'suggestion');
    }

    next() {
        const activeLink = this.getActive();
        const nextLink = activeLink.nextElementSibling || this.dropdownContent.firstElementChild;

        activeLink.classList.remove('active');
        nextLink.classList.add('active');

        return this.getValue(nextLink);
    }

    prev() {
        const activeLink = this.getActive();
        const prevLink = activeLink.prevElementSibling || this.dropdownContent.lastElementChild;

        activeLink.classList.remove('active');
        prevLink.classList.add('active');

        return this.getValue(prevLink);
    }
}

export default SuggestionDropdown;
