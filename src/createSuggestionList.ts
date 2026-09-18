import invariant from 'invariant';
import type {
    OnInsert,
    RenderInsert,
    Suggestion,
    SuggestionGenerator,
    SuggestionInput,
    SuggestionList,
    SuggestionListOptions
} from './types.js';
import { escapeRegExp } from './utils.js';

let listCounter = 0;

const isSuggestion = (input: unknown): input is Suggestion =>
    typeof input === 'object' && input !== null && typeof (input as Suggestion).value === 'string';

/** Turns strings and partial objects into complete `{ value, label }` suggestions. */
export const normalizeSuggestions = (inputs: SuggestionInput[] | SuggestionInput): Suggestion[] =>
    ([] as SuggestionInput[]).concat(inputs).map(input => {
        if (typeof input === 'string') {
            return { value: input, label: input };
        }
        invariant(isSuggestion(input), 'AutoSuggest: Invalid Type for Suggestion.value, expected string');
        const label = (input as Partial<Suggestion>).label;
        invariant(
            label === undefined || typeof label === 'string',
            'AutoSuggest: Invalid Type for Suggestion.label, expected string'
        );
        return { value: input.value, label: label ?? input.value };
    });

/**
 * Keeps suggestions whose `label` or `value` starts with `keyword` (optionally prefixed by the trigger)
 * and are not already fully typed out. Label matches are listed first, value-only matches after them;
 * the original order is preserved within each group.
 */
export const filterSuggestions = (
    suggestions: Suggestion[],
    keyword: string,
    trigger: string | undefined,
    caseSensitive: boolean
): Suggestion[] => {
    const flags = caseSensitive ? '' : 'i';
    const triggerRegex = trigger ? `(?:${escapeRegExp(trigger)})?` : '';
    const commonRegex = '^' + triggerRegex + escapeRegExp(keyword);

    const matcher = new RegExp(commonRegex, flags);
    const exactMatcher = new RegExp(commonRegex + '$', flags);

    const matches = (entry: string) => matcher.test(entry) && !exactMatcher.test(entry);

    const labelMatches: Suggestion[] = [];
    const valueMatches: Suggestion[] = [];
    suggestions.forEach(suggestion => {
        if (matches(suggestion.label)) labelMatches.push(suggestion);
        else if (matches(suggestion.value)) valueMatches.push(suggestion);
    });

    return labelMatches.concat(valueMatches);
};

const createStaticGetter = (source: SuggestionInput[], trigger: string | undefined): SuggestionList['getSuggestions'] => {
    const staticSuggestions = normalizeSuggestions(source);
    return async (keyword, _element, { caseSensitive }) => filterSuggestions(staticSuggestions, keyword, trigger, caseSensitive);
};

const createGeneratorGetter =
    (source: SuggestionGenerator): SuggestionList['getSuggestions'] =>
    async (keyword, element) =>
        normalizeSuggestions(await source(keyword, element));

/**
 * Creates a `SuggestionList` entity: everything the `useAutoSuggest` hook and the provider's menu
 * placeholder need to match keywords, resolve suggestions, render the dropdown and react to inserts.
 */
export const createSuggestionList = (options: SuggestionListOptions): SuggestionList => {
    invariant(options && typeof options === 'object', 'AutoSuggest: Missing required parameter, SuggestionList.options');
    invariant(
        typeof options.suggestions !== 'undefined',
        'AutoSuggest: Missing required parameter, SuggestionList.suggestions'
    );
    invariant(
        typeof options.trigger === 'undefined' || typeof options.trigger === 'string',
        'AutoSuggest: Invalid Type for SuggestionList.trigger, expected string'
    );
    invariant(
        typeof options.suggestions === 'function' || Array.isArray(options.suggestions),
        'AutoSuggest: Invalid Type for SuggestionList.suggestions, expected array or function'
    );

    const trigger = options.trigger || undefined;
    const regex = trigger
        ? new RegExp(`(?:\\W+|^)${escapeRegExp(trigger)}(\\S*)$`)
        : new RegExp('(?:^|\\s+)(\\S+)$');

    const getSuggestions = Array.isArray(options.suggestions)
        ? createStaticGetter(options.suggestions, trigger)
        : createGeneratorGetter(options.suggestions);

    const list: SuggestionList = {
        id: `autosuggest-list-${++listCounter}`,
        trigger,
        isTriggerMatch: value => regex.test(value),
        getMatch: value => {
            const match = value.match(regex);
            return match ? (match[1] ?? '') : null;
        },
        getSuggestions
    };

    // Only copy defined overrides so provider defaults can fall through with `??`.
    if (options.caseSensitive !== undefined) list.caseSensitive = options.caseSensitive;
    if (options.maxSuggestions !== undefined) list.maxSuggestions = options.maxSuggestions;
    if (options.renderGroup) list.renderGroup = options.renderGroup;
    if (options.renderMenuItem) list.renderMenuItem = options.renderMenuItem;
    const mutable = list as { renderInsert?: RenderInsert; onInsert?: OnInsert };
    if (options.renderInsert) mutable.renderInsert = options.renderInsert;
    if (options.onInsert) mutable.onInsert = options.onInsert;

    return list;
};
