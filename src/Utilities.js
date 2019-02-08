export const ensure = (context, object, keys) => {
    [].concat(keys).forEach(key => {
        if (typeof object[key] === 'undefined') {
            throw new Error(`AutoSuggest: Missing required parameter, ${context}.${key}`);
        }
    });
};
export const ensureType = (context, object, key, type) => {
    [].concat(object[key]).forEach(value => {
        if (typeof value !== type) {
            throw new TypeError(`AutoSuggest: Invalid Type for ${context}.${key}, expected ${type}`);
        }
    });
};

export const cloneStyle = (element1, element2) => {
    const allStyles = window.getComputedStyle(element1);
    for (let style in allStyles) {
        if (allStyles.hasOwnProperty(style)) {
            element2.style.setProperty(style, allStyles[style]);
        }
    }
};
export const getGlobalOffset = $0 => {
    let node = $0, top = 0, left = 0;

    do {
        left += node.offsetLeft;
        top += node.offsetTop;
    } while (node = node.offsetParent);

    return {left, top};
};

export const getScrollLeftForInput = element => {
    if(element.createTextRange) {
        const range = element.createTextRange();
        const inputStyle = window.getComputedStyle(element);
        const paddingLeft = parseFloat(inputStyle.paddingLeft);
        const rangeRect = range.getBoundingClientRect();
        return element.getBoundingClientRect().left + element.clientLeft + paddingLeft - rangeRect.left;
    } else {
        return element.scrollLeft;
    }
};
export const getCursorPosition = input => {
    let position = 0;

    if (typeof input.selectionDirection !== 'undefined') {
        position = input.selectionDirection === 'backward' ? input.selectionStart : input.selectionEnd;
    } else if (document.selection) {
        input.focus();
        const selection = document.selection.createRange();
        selection.moveStart('character', - input.value.length);
        position = selection.text.length;
    }

    return position;
};

export const makeAsyncQueueRunner = () => {
    let i = 0;
    const queue = [];

    return (f, j) => {
        queue[j - i] = f;
        while (queue[0]) ++i, queue.shift()();
    };
};

export const data = (element, key, value) => {
    key = 'autosuggest_' + key;
    if (typeof value !== 'undefined') {
        element.dataset[key] = JSON.stringify(value);
    } else {
        value = element.dataset[key];
        return typeof value !== 'undefined' ? JSON.parse(element.dataset[key]) : value;
    }
};

export const createNode = html => {
    var div = document.createElement('div');
    div.innerHTML = html.trim();
    return div.firstChild; 
}
