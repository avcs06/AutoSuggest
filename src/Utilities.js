const Utilities = {
    noop: () => {},
    noopd: data => data,

    ensure: (context, object, keys) => {
        [].concat(keys).forEach(key => {
            if (typeof object[key] === 'undefined') {
                throw new Error(`AutoSuggest: Missing required parameter, ${context}.${key}`);
            }
        });
    },
    ensureType: (context, object, key, type) => {
        [].concat(object[key]).forEach(value => {
            if (typeof value !== type) {
                throw new Error(`AutoSuggest: Invalid Type for ${context}.${key}, expected ${type}`);
            }
        });
    },

    cloneStyle: (element1, element2) => {
        const style1 = window.getComputedStyle($(element1)[0], null);
        const style2 = {};

        Array.prototype.forEach.call(style1, property => {
            style2[property] = style1.getPropertyValue(property);
        });
        $(element2).css(style2);
    },
    getGlobalOffset: element => {
        let obj = element;
        let left = 0;
        let top = 0;
        do {
            left += obj.offsetLeft;
            top += obj.offsetTop;
        } while (obj = obj.offsetParent);
        return {left, top};
    },
    getScrollLeftForInput: element => {
        if(element.createTextRange) {
            const range = element.createTextRange();
            const inputStyle = window.getComputedStyle(element, undefined);
            const paddingLeft = parseFloat(inputStyle.paddingLeft);
            const rangeRect = range.getBoundingClientRect();
            return element.getBoundingClientRect().left + element.clientLeft + paddingLeft - rangeRect.left;
        } else {
            return $(element).scrollLeft();
        }
    },
    getCursorPosition: input => {
        let position = 0;
    
        if (typeof input.selectionDirection !== 'undefined') {
            position = input.selectionDirection=='backward' ? input.selectionStart : input.selectionEnd;
        } else if (document.selection) {
            input.focus();
            const selection = document.selection.createRange();
            selection.moveStart('character', -input.value.length);
            position = selection.text.length;
        }
    
        return position;
    }
};
