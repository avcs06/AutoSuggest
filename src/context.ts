import invariant from 'invariant';
import { createContext, useContext } from 'react';
import type { AutoSuggestElement, CaretPosition, CommonOptions, RenderMenu, Suggestion, SuggestionList } from './types.js';

export interface ResolvedDefaults extends CommonOptions {
    caseSensitive: boolean;
    maxSuggestions: number;
    renderMenu?: RenderMenu;
}

/** Results of one matching list. */
export interface MenuGroup {
    list: SuggestionList;
    keyword: string;
    suggestions: Suggestion[];
    isLoading: boolean;
}

/** State of the currently open dropdown menu. */
export interface MenuState {
    /** `useAutoSuggest` instance that owns this menu. */
    ownerId: string;
    element: AutoSuggestElement;
    position: CaretPosition;
    /** One group per matching list, in list order. */
    groups: MenuGroup[];
    insert: (suggestion: Suggestion, list: SuggestionList) => void;
}

export interface AutoSuggestContextValue {
    defaults: ResolvedDefaults;
    menu: MenuState | null;
    setMenu: (menu: MenuState | null) => void;
}

export const AutoSuggestContext = createContext<AutoSuggestContextValue | null>(null);

export const useAutoSuggestContext = (): AutoSuggestContextValue => {
    const context = useContext(AutoSuggestContext);
    invariant(context, 'AutoSuggest: useAutoSuggest must be used inside an <AutoSuggestProvider>');
    return context;
};
