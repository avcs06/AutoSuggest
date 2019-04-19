import { ensure, ensureType } from './Utilities';

function validateSuggestions (suggestions) {
    return [].concat(suggestions).map(suggestion => {
        const type = typeof suggestion;
        if (type === 'string') {
            suggestion = {
                on: [suggestion],
                show: suggestion,
                insertText: suggestion,
                focusText: [0, 0]
            };
        } else if (type === 'object') {
            try {
                ensure('Suggestion', suggestion, 'value');
                ensureType('Suggestion', suggestion, 'value', 'string');
            } catch (e1) {
                if (e1 instanceof TypeError)  throw e1;

                if (!(suggestion.on && suggestion.show && (suggestion.insertText || suggestion.insertHtml))) {
                    try {
                        ensure('Suggestion', suggestion, ['on', 'show', 'insertText']);
                    } catch (e2) {
                        if (suggestion.on || suggestion.show || suggestion.insertText) {
                            throw e2;
                        } else {
                            throw e1;
                        }
                    }
                }

                ensureType('Suggestion', suggestion, 'on', 'string');
                ensureType('Suggestion', suggestion, 'show', 'string');
                ensureType('Suggestion', suggestion, 'insertText', 'string');
                ensureType('Suggestion', suggestion, 'insertHtml', 'string');
            }

            suggestion.show = suggestion.show || suggestion.value;
            suggestion.insertText = suggestion.insertText || suggestion.value;
            suggestion.on = [suggestion.show].concat(suggestion.on || suggestion.value);

            suggestion.focusText = suggestion.focusText || [0, 0];
            if (suggestion.focusText.constructor !== Array) {
                suggestion.focusText = [suggestion.focusText, suggestion.focusText];
            }

            if (suggestion.insertHtml) {
                suggestion.focusHtml = suggestion.focusHtml || [0, 0];
                if (suggestion.focusHtml.constructor !== Array) {
                    suggestion.focusHtml = [suggestion.focusHtml, suggestion.focusHtml];
                }
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
            options.values.call(this, keyword, values => callback(validateSuggestions(values)));
        };
    } else if (options.values.constructor === Array || typeof options.values === 'string') {
        options.values = validateSuggestions(options.values);
        this.getSuggestions = (keyword, callback) => {
            const matcher = new RegExp('^' + keyword, !options.caseSensitive ? 'i' : '');
            callback (
                options.values.filter(value => {
                    let matchFound = false;
                    for (let i = 0; i < value.on.length; i++) {
                        if (value.on[i] !== keyword && (matchFound = matcher.test(value.on[i]))) {
                            break;
                        }
                    }

                    return matchFound;
                })
            );
        };
    }

    this.trigger = options.trigger;
    if (this.trigger) {
        const escapedTrigger = `\\${this.trigger.split('').join('\\')}`;
        this.regex = new RegExp(`(?:^|[^${escapedTrigger}]+?)${escapedTrigger}(\\S*)$`);
    } else {
        this.regex = new RegExp('(?:^|\\W+)(\\w+)$');
    }
}

SuggestionList.prototype.getMatch = function (value) {
    return value.match(this.regex)[1];
};

export default SuggestionList;
