import invariant from 'invariant';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { SyntheticEvent } from 'react';

import {
    ensureSupportedElement,
    getCursorPosition,
    getSelectedTextNodes,
    isInputElement,
    mergeProps
} from './utils';
import { DEFAULT_CASE_SENSITIVE, DEFAULT_MAX_SUGGESTIONS } from './constants';
import { AutoSuggestContext } from './AutoSuggestContext';
import type { MenuStateSection } from './AutoSuggestContext';
import { getCaretPosition } from './getCaretPosition';
import { insertSuggestion } from './insertSuggestion';
import { toSuggestionList } from './createSuggestionList';
import type {
    CaretPosition,
    InputProps,
    Suggestion,
    SuggestionList,
    UseAutoSuggestOptions,
    UseAutoSuggestResult
} from './types';

interface TriggerMatch {
    suggestionList: SuggestionList;
    keyword: string;
    position: CaretPosition;
    // null until the suggestions are available
    section: MenuStateSection | null;
}

// Text before the current selection, null if the dropdown should not be shown for the current selection
function getValueBeforeSelection(element: HTMLElement): string | null {
    if (isInputElement(element)) {
        const [startPosition, endPosition] = getCursorPosition(element);
        if (/\w/.test(element.value.charAt(endPosition) || ' ')) {
            return null;
        }

        return element.value.slice(0, startPosition);
    }

    const selected = getSelectedTextNodes();
    if (!selected) return null;

    const { startContainer, startOffset, endContainer, endOffset } = selected;
    if (!startContainer || !endContainer || !startContainer.nodeValue ||
        /\w/.test((endContainer.nodeValue || '').charAt(endOffset) || ' ')) {
        return null;
    }

    return startContainer.nodeValue.slice(0, startOffset);
}

export function useAutoSuggest(options: UseAutoSuggestOptions): UseAutoSuggestResult {
    const context = useContext(AutoSuggestContext);
    invariant(context, 'AutoSuggest: useAutoSuggest should be used inside AutoSuggestProvider');

    const { suggestions, caseSensitive, maxSuggestions, renderMenu, renderMenuItem } = options;
    const { defaults, openMenu, closeMenu } = context;

    const [owner] = useState(() => Symbol('AutoSuggest'));
    const suggestionLists = useMemo(() => (suggestions || []).map(toSuggestionList), [suggestions]);

    // Results of the older updates are ignored
    const updateIndex = useRef(0);
    // Dropdown is removed on mousedown, so the mouseup of the same click can land on the field
    const isSelecting = useRef(false);

    const close = useCallback(() => {
        updateIndex.current++;
        closeMenu(owner);
    }, [closeMenu, owner]);

    const update = useCallback((element: HTMLElement) => {
        ensureSupportedElement(element);

        const value = getValueBeforeSelection(element);
        if (value === null) {
            close();
            return;
        }

        const currentIndex = ++updateIndex.current;
        const positions = new Map<string | undefined, CaretPosition>();
        const matches = suggestionLists.filter(suggestionList => suggestionList.isTriggerMatch(value)).map(suggestionList => {
            const { trigger } = suggestionList;
            if (!positions.has(trigger)) {
                positions.set(trigger, getCaretPosition(element, trigger));
            }

            const match: TriggerMatch = {
                suggestionList,
                keyword: suggestionList.getMatch(value) || '',
                position: positions.get(trigger)!,
                section: null
            };

            return match;
        });

        if (!matches.length) {
            close();
            return;
        }

        // Shows the results of all the matching lists available so far, in the order of the lists
        const showMenu = () => {
            if (currentIndex !== updateIndex.current) return;

            const matchesWithResults = matches.filter(match => match.section && match.section.suggestions.length);
            const loading = matches.some(match => !match.section);
            if (!matchesWithResults.length && !loading) {
                closeMenu(owner);
                return;
            }

            const [firstMatch] = matchesWithResults.length ? matchesWithResults : matches;
            openMenu({
                owner,
                element,
                position: firstMatch.position,
                loading,
                sections: matchesWithResults.map(match => match.section!),
                renderMenu
            });
        };

        const loadSection = async (match: TriggerMatch) => {
            const { suggestionList, keyword } = match;
            const { trigger } = suggestionList;

            const onSelect = (suggestion: Suggestion) => {
                isSelecting.current = true;
                document.addEventListener('mouseup', () => {
                    setTimeout(() => { isSelecting.current = false; }, 0);
                }, { once: true, capture: true });

                const node = insertSuggestion(element, trigger, suggestionList.renderInsert
                    ? suggestionList.renderInsert({ suggestion, keyword, trigger, element })
                    : { text: suggestion.value });
                close();

                if (node && suggestionList.onInsert) {
                    suggestionList.onInsert(suggestion, node);
                }
            };

            let results: Suggestion[] = [];
            try {
                results = await suggestionList.getSuggestions(keyword, {
                    element,
                    caseSensitive: [
                        suggestionList.caseSensitive, caseSensitive, defaults.caseSensitive, DEFAULT_CASE_SENSITIVE
                    ].find(option => typeof option === 'boolean') as boolean
                });
            } finally {
                // Section stays empty if the list fails, the error is left for the consumer
                match.section = {
                    trigger,
                    keyword,
                    suggestions: results.slice(
                        0, suggestionList.maxSuggestions || maxSuggestions || defaults.maxSuggestions || DEFAULT_MAX_SUGGESTIONS
                    ),
                    renderMenuItem: suggestionList.renderMenuItem || renderMenuItem,
                    onSelect
                };

                showMenu();
            }
        };

        // Loader is not shown for the lists which are resolved immediately
        setTimeout(showMenu, 0);
        matches.forEach(loadSection);
    }, [suggestionLists, caseSensitive, maxSuggestions, renderMenu, renderMenuItem, defaults, openMenu, closeMenu, close, owner]);

    // Close the dropdown if the consumer is unmounted while the dropdown is active
    useEffect(() => close, [close]);

    const getInputProps = useCallback<UseAutoSuggestResult['getInputProps']>(userProps => {
        const onUpdate = (e: SyntheticEvent<HTMLElement>) => update(e.currentTarget);
        const inputProps: InputProps = {
            onKeyUp: onUpdate,
            onMouseUp: e => {
                if (!isSelecting.current) onUpdate(e);
            },
            onBlur: close
        };

        return mergeProps(inputProps, userProps);
    }, [update, close]);

    return { getInputProps };
}
