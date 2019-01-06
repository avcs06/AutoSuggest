import { ensure, ensureType } from './Utilities';

function validateSuggestions (suggestions) {
    return [].concat(suggestions).map(suggestion => {
        const type = typeof suggestion;
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
                if (e1 instanceof TypeError)  throw e1;

                try {
                    ensure('Suggestion', suggestion, ['on', 'show', 'use']);
                } catch(e2) {
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
        this.getSuggestions = (keyword, callback) => {
            options.values(keyword, values => callback(validateSuggestions(values)));
        };
    } else if (options.values.constructor === Array || typeof options.values === 'string') {
        options.values = validateSuggestions(options.values);
        this.getSuggestions = (keyword, callback) => {
            const matcher = new RegExp('^' + keyword, !options.caseSensitive ? 'i' : '');
            callback (
                options.values.filter(value => {
                    let matchFound = false;
                    for (let i = 0; i < value.on.length; i++) {
                        if (matchFound = matcher.test(value.on[i])) {
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
