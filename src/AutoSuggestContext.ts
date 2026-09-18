import { createContext } from 'react';
import type { CaretPosition, CommonOptions, RenderMenu, RenderMenuItem, Suggestion } from './types';

/** Results of a matching suggestion list */
export interface MenuStateSection {
    trigger: string | undefined;
    keyword: string;
    suggestions: Suggestion[];
    // Override for the global render method
    renderMenuItem: RenderMenuItem | undefined;
    onSelect: (suggestion: Suggestion) => void;
}

/** State of the active dropdown, owned by one of the useAutoSuggest hooks */
export interface MenuState {
    owner: symbol;
    element: HTMLElement;
    position: CaretPosition;
    loading: boolean;
    sections: MenuStateSection[];
    // Override for the global render method
    renderMenu: RenderMenu | undefined;
}

export interface AutoSuggestContextValue {
    defaults: Pick<CommonOptions, 'caseSensitive' | 'maxSuggestions'>;
    openMenu: (menu: MenuState) => void;
    /** Closes the menu only if it is owned by the given owner */
    closeMenu: (owner: symbol) => void;
}

export const AutoSuggestContext = createContext<AutoSuggestContextValue | null>(null);
