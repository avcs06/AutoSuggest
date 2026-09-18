import invariant from 'invariant';
import type {
    Suggestion,
    SuggestionInput,
    SuggestionList,
    SuggestionListInput,
    SuggestionListOptions,
    SuggestionValues
} from './types';

function validateSuggestions(suggestions: SuggestionInput | SuggestionInput[]): Suggestion[] {
    return ([] as SuggestionInput[]).concat(suggestions).map(suggestion => {
        if (typeof suggestion === 'string') {
            return { value: suggestion, label: suggestion };
        }

        invariant(
            suggestion && typeof suggestion.value !== 'undefined',
            'AutoSuggest: Missing required parameter, Suggestion.value'
        );
        invariant(
            typeof suggestion.value === 'string',
            'AutoSuggest: Invalid Type for Suggestion.value, expected string'
        );
        invariant(
            typeof suggestion.label === 'string' || typeof suggestion.label === 'undefined',
            'AutoSuggest: Invalid Type for Suggestion.label, expected string'
        );

        return { value: suggestion.value, label: suggestion.label || suggestion.value };
    });
}

function escapeRegExp(string: string): string {
    return string.replace(/[.?+*^$[{()|\\]/g, '\\$&'); // $& means the whole matched string
}

function isSuggestionListOptions(options: SuggestionListOptions | SuggestionValues): options is SuggestionListOptions {
    // Anything other than a suggestion object
    return Boolean(options) && typeof options === 'object' && !Array.isArray(options) && !('value' in options);
}

export function isSuggestionList(list: SuggestionListInput): list is SuggestionList {
    return Boolean(list) && typeof list === 'object' &&
        typeof (list as SuggestionList).getSuggestions === 'function';
}

export function createSuggestionList(input: SuggestionListOptions | SuggestionValues): SuggestionList {
    // validate options
    const options: SuggestionListOptions = isSuggestionListOptions(input) ? input : { values: input };

    invariant(
        typeof options.values !== 'undefined',
        'AutoSuggest: Missing required parameter, SuggestionList.values'
    );
    invariant(
        typeof options.trigger === 'string' || typeof options.trigger === 'undefined',
        'AutoSuggest: Invalid Type for SuggestionList.trigger, expected string'
    );

    const { trigger, values } = options;

    let getSuggestions: SuggestionList['getSuggestions'];
    if (typeof values === 'function') {
        getSuggestions = async (keyword, { element }) => validateSuggestions(await values(keyword, element));
    } else {
        const suggestions = validateSuggestions(values);
        getSuggestions = async (keyword, { caseSensitive }) => {
            const flags = !caseSensitive ? 'i' : '';
            const triggerRegex = trigger ? `(?:${escapeRegExp(trigger)})?` : '';
            const commonRegex = '^' + triggerRegex + escapeRegExp(keyword);

            const matcher = new RegExp(commonRegex, flags);
            const exactMatcher = new RegExp(commonRegex + '$', flags);

            const isMatch = (entry: string) => matcher.test(entry) && !exactMatcher.test(entry);

            // Label based matches have more weight than the value based matches
            const labelMatches = suggestions.filter(suggestion => isMatch(suggestion.label));
            const valueMatches = suggestions.filter(suggestion => !isMatch(suggestion.label) && isMatch(suggestion.value));
            return labelMatches.concat(valueMatches);
        };
    }

    const regex = trigger
        ? new RegExp(`(?:\\W+|^)${escapeRegExp(trigger)}(\\S*)$`)
        : new RegExp('(?:^|\\s+)(\\S+)$');

    return {
        trigger,
        caseSensitive: options.caseSensitive,
        maxSuggestions: options.maxSuggestions,
        renderMenuItem: options.renderMenuItem,
        renderInsert: options.renderInsert,
        onInsert: options.onInsert,
        isTriggerMatch: value => regex.test(value),
        getMatch: value => {
            const match = value.match(regex);
            return match ? match[1] : null;
        },
        getSuggestions
    };
}

export function toSuggestionList(list: SuggestionListInput): SuggestionList {
    return isSuggestionList(list) ? list : createSuggestionList(list);
}
