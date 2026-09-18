import { Fragment, useCallback, useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import { DEFAULT_CASE_SENSITIVE, DEFAULT_MAX_SUGGESTIONS } from './constants.js';
import { AutoSuggestContext, useAutoSuggestContext, type AutoSuggestContextValue, type MenuState } from './context.js';
import type { CommonOptions, RenderGroupArgs, RenderMenu } from './types.js';

export interface AutoSuggestProviderProps extends CommonOptions {
    /** Renders the dropdown container. Without it nothing is rendered. */
    renderMenu?: RenderMenu;
    children?: ReactNode;
}

const preventDefault = (event: MouseEvent) => {
    // Keep focus inside the field so `blur` does not close the menu before an item is clicked.
    event.preventDefault();
};

/**
 * Placeholder rendered by the provider. It renders nothing of its own: the menu, its groups and
 * its items come entirely from `renderMenu` / `renderGroup` / `renderMenuItem`.
 */
const AutoSuggestMenu = () => {
    const { defaults, menu, setMenu } = useAutoSuggestContext();
    const close = useCallback(() => setMenu(null), [setMenu]);

    if (!menu || !defaults.renderMenu) return null;

    const groups: RenderGroupArgs[] = menu.groups.map(group => {
        const renderMenuItem = group.list.renderMenuItem ?? defaults.renderMenuItem;
        const items = renderMenuItem
            ? group.suggestions.map((suggestion, index) => (
                  <Fragment key={`${index}:${suggestion.value}`}>
                      {renderMenuItem({
                          suggestion,
                          index,
                          list: group.list,
                          keyword: group.keyword,
                          insert: () => menu.insert(suggestion, group.list),
                          itemProps: {
                              role: 'option',
                              onMouseDown: event => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  menu.insert(suggestion, group.list);
                              }
                          }
                      })}
                  </Fragment>
              ))
            : [];
        return { list: group.list, keyword: group.keyword, suggestions: group.suggestions, isLoading: group.isLoading, items };
    });

    const children = groups.map(group => {
        const renderGroup = group.list.renderGroup ?? defaults.renderGroup;
        return <Fragment key={group.list.id}>{renderGroup ? renderGroup(group) : group.items}</Fragment>;
    });

    return (
        <>
            {defaults.renderMenu({
                menuProps: {
                    role: 'listbox',
                    style: { position: 'absolute', top: menu.position.top, left: menu.position.left },
                    onMouseDown: preventDefault
                },
                children,
                groups,
                suggestions: groups.flatMap(group => group.suggestions),
                isLoading: groups.some(group => group.isLoading),
                position: menu.position,
                element: menu.element,
                close
            })}
        </>
    );
};

/**
 * Global configuration for every `useAutoSuggest` hook underneath, plus the placeholder in which
 * the dropdown menu is rendered.
 */
export const AutoSuggestProvider = ({
    children,
    caseSensitive = DEFAULT_CASE_SENSITIVE,
    maxSuggestions = DEFAULT_MAX_SUGGESTIONS,
    renderMenu,
    renderGroup,
    renderMenuItem
}: AutoSuggestProviderProps) => {
    const [menu, setMenu] = useState<MenuState | null>(null);

    const value = useMemo<AutoSuggestContextValue>(
        () => ({
            defaults: { caseSensitive, maxSuggestions, renderMenu, renderGroup, renderMenuItem },
            menu,
            setMenu
        }),
        [caseSensitive, maxSuggestions, renderMenu, renderGroup, renderMenuItem, menu]
    );

    return (
        <AutoSuggestContext.Provider value={value}>
            {children}
            <AutoSuggestMenu />
        </AutoSuggestContext.Provider>
    );
};
