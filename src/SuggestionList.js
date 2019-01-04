import { ensure, ensureType } from './Utilities';

function validateSuggestions (suggestions, ignoreOn) {
    return [].concat(suggestions).map(suggestion => {
        const type = typeof suggestion;
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
            ensure('Suggestion', suggestion, ['show', 'replaceWith']);
            ensureType('Suggestion', suggestion, 'show', 'string');
            ensureType('Suggestion', suggestion, 'replaceWith', 'string');
            suggestion.cursorPosition = suggestion.cursorPosition || [0, 0];
            if (suggestion.cursorPosition.constructor !== Array) {
                suggestion.cursorPosition = [suggestion.cursorPosition, suggestion.cursorPosition];
            }

            if (!ignoreOn) {
                ensure('Suggestion', suggestion, 'on');
                ensureType('Suggestion', suggestion, 'on', 'string');
                suggestion.on = [].concat(suggestion.on);
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

    ensure('SuggestionList', options, 'values');
    if (typeof options.caseSensitive === 'undefined') {
        options.caseSensitive = true;
    }

    if (typeof options.values === 'function') {
        this.getSuggestions = (keyword, callback) => {
            options.values(keyword, values => callback(validateSuggestions(values, true)));
        };
    } else if (options.values.constructor === Array || typeof options.values === 'string') {
        options.values = validateSuggestions(options.values);
        this.getSuggestions = (keyword, callback) => {
            const matcher = new RegExp(keyword, !options.caseSensitive ? 'i' : '');
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

    const trigger = options.trigger;
    if (trigger && typeof trigger !== 'string') {
        throw new Error('AutoSuggest: Invalid Type, SuggestionList.trigger should be a string');
    }

    if (trigger) {
        const escapedTrigger = `\\${trigger.split('').join('\\')}`;
        this.regex = new RegExp(`(?:^|[^${escapedTrigger}]+)${escapedTrigger}(\\S*)$`);
    } else {
        this.regex = new RegExp('(?:^|\\W+)(\\w+)$');
    }

    this.trigger = trigger;
}

export default SuggestionList;
