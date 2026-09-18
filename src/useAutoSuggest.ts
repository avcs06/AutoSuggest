import { useCallback, useId, useMemo, useRef, type SyntheticEvent } from 'react';
import { getCaretPosition } from './caret.js';
import { useAutoSuggestContext, type MenuGroup, type MenuState } from './context.js';
import { insertSuggestion } from './insert.js';
import type { AutoSuggestElement, Suggestion, SuggestionList } from './types.js';
import { getCursorPosition, getSelectedTextNodes, isTextInput } from './utils.js';

/** Event handlers to spread on the input, textarea or contenteditable element. */
export interface AutoSuggestInputProps<T extends AutoSuggestElement = AutoSuggestElement> {
    onKeyUp: (event: SyntheticEvent<T>) => void;
    onMouseUp: (event: SyntheticEvent<T>) => void;
    onBlur: (event: SyntheticEvent<T>) => void;
}

export interface UseAutoSuggestResult {
    /** Returns the props that wire a field to the suggestion lists. */
    getInputProps: <T extends AutoSuggestElement = AutoSuggestElement>() => AutoSuggestInputProps<T>;
    /** `true` while the dropdown owned by this hook is open (loading or showing suggestions). */
    isOpen: boolean;
    close: () => void;
}

/**
 * Reads the text before the caret. Returns `null` when the dropdown should stay closed, e.g.
 * when the character right after the selection is a word character.
 */
const getValueBeforeCaret = (element: AutoSuggestElement): string | null => {
    if (isTextInput(element)) {
        const [startPosition, endPosition] = getCursorPosition(element);
        if (/\w/.test(element.value.charAt(endPosition) || ' ')) return null;
        return element.value.slice(0, startPosition);
    }

    const selected = getSelectedTextNodes();
    if (!selected) return null;
    const { startContainer, startOffset, endContainer, endOffset } = selected;
    if (
        !startContainer ||
        !endContainer ||
        !startContainer.nodeValue ||
        !element.contains(startContainer) ||
        /\w/.test((endContainer.nodeValue || '').charAt(endOffset) || ' ')
    ) {
        return null;
    }
    return startContainer.nodeValue.slice(0, startOffset);
};

/**
 * Headless autosuggest behaviour for a single field. Spread `getInputProps()` on the element;
 * the dropdown itself is rendered by the nearest `AutoSuggestProvider`.
 */
export const useAutoSuggest = (suggestionLists: SuggestionList[]): UseAutoSuggestResult => {
    const { defaults, menu, setMenu } = useAutoSuggestContext();
    const ownerId = useId();
    const requestIndex = useRef(0);

    const listsRef = useRef(suggestionLists);
    listsRef.current = suggestionLists;
    const defaultsRef = useRef(defaults);
    defaultsRef.current = defaults;

    const isOpen = menu !== null && menu.ownerId === ownerId;

    const close = useCallback(() => {
        requestIndex.current++;
        setMenu(null);
    }, [setMenu]);

    const handleChange = useCallback(
        (event: SyntheticEvent<AutoSuggestElement>) => {
            const element = event.currentTarget;
            const value = getValueBeforeCaret(element);
            if (value === null) return close();

            const matching = listsRef.current.filter(list => list.isTriggerMatch(value));
            if (!matching.length) return close();

            const asyncReference = ++requestIndex.current;
            const isStale = () => asyncReference !== requestIndex.current;
            const defaults = defaultsRef.current;

            const insert = (suggestion: Suggestion, list: SuggestionList) => {
                const content = list.renderInsert ? list.renderInsert(suggestion) : { text: suggestion.value };
                const node = insertSuggestion(element, content, list.trigger);
                close();
                if (node) list.onInsert?.(suggestion, node);
            };

            // One group per matching list; every lookup starts now and fills its group when it resolves.
            const groups: MenuGroup[] = matching.map(list => ({
                list,
                keyword: list.getMatch(value) ?? '',
                suggestions: [],
                isLoading: true
            }));

            const first = groups[0] as MenuGroup;
            const base: Omit<MenuState, 'groups'> = {
                ownerId,
                element,
                position: getCaretPosition(element, first.list.trigger),
                insert
            };
            setMenu({ ...base, groups });

            groups.forEach(async (group, index) => {
                const { list, keyword } = group;
                const caseSensitive = list.caseSensitive ?? defaults.caseSensitive;
                const maxSuggestions = list.maxSuggestions ?? defaults.maxSuggestions;

                const suggestions = await list.getSuggestions(keyword, element, { caseSensitive }).catch(() => [] as Suggestion[]);
                if (isStale()) return;

                groups[index] = { ...group, suggestions: suggestions.slice(0, maxSuggestions), isLoading: false };
                const settled = groups.every(g => !g.isLoading);
                const empty = groups.every(g => g.suggestions.length === 0);
                if (settled && empty) return setMenu(null);
                setMenu({ ...base, groups: [...groups] });
            });
        },
        [close, ownerId, setMenu]
    );

    const handleBlur = useCallback(() => close(), [close]);

    const getInputProps = useCallback(
        <T extends AutoSuggestElement = AutoSuggestElement>(): AutoSuggestInputProps<T> => ({
            onKeyUp: handleChange as (event: SyntheticEvent<T>) => void,
            onMouseUp: handleChange as (event: SyntheticEvent<T>) => void,
            onBlur: handleBlur
        }),
        [handleChange, handleBlur]
    );

    return useMemo(() => ({ getInputProps, isOpen, close }), [getInputProps, isOpen, close]);
};
