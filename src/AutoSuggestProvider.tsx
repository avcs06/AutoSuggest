import { Fragment, useCallback, useMemo, useState } from 'react';
import type { MouseEvent } from 'react';

import { AutoSuggestContext } from './AutoSuggestContext';
import type { AutoSuggestContextValue, MenuState } from './AutoSuggestContext';
import { mergeProps } from './utils';
import type {
    AutoSuggestProviderProps,
    MenuItemProps,
    MenuProps,
    MenuSection,
    RenderMenu,
    RenderMenuItem
} from './types';

interface MenuPlaceholderProps {
    menu: MenuState | null;
    renderMenu: RenderMenu;
    renderMenuItem: RenderMenuItem;
}

// Placeholder for the dropdown, renders nothing by itself,
// everything inside comes from renderMenu and renderMenuItem
function MenuPlaceholder({ menu, renderMenu, renderMenuItem }: MenuPlaceholderProps) {
    if (!menu) return null;

    const { element, position, loading } = menu;

    const menuProps: MenuProps = {
        style: { position: 'absolute', top: position.top, left: position.left },
        onMouseDown: (e: MouseEvent<HTMLElement>) => {
            e.preventDefault();
        }
    };

    const sections = menu.sections.reduce<MenuSection[]>((result, section) => {
        const { trigger, keyword, suggestions, onSelect } = section;
        const offset = result.reduce((count, previous) => count + previous.items.length, 0);

        const items = suggestions.map((suggestion, sectionIndex) => {
            const index = offset + sectionIndex;
            const itemProps: MenuItemProps = {
                onMouseDown: (e: MouseEvent<HTMLElement>) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onSelect(suggestion);
                }
            };

            return (
                <Fragment key={index}>
                    {(section.renderMenuItem || renderMenuItem)({
                        getItemProps: userProps => mergeProps(itemProps, userProps),
                        suggestion,
                        index,
                        keyword,
                        trigger
                    })}
                </Fragment>
            );
        });

        return result.concat({ trigger, keyword, suggestions, items });
    }, []);

    return (
        <Fragment>
            {(menu.renderMenu || renderMenu)({
                getMenuProps: userProps => mergeProps(menuProps, userProps),
                items: sections.flatMap(section => section.items),
                suggestions: sections.flatMap(section => section.suggestions),
                sections,
                loading,
                position,
                element
            })}
        </Fragment>
    );
}

export function AutoSuggestProvider(props: AutoSuggestProviderProps) {
    const { caseSensitive, maxSuggestions, renderMenu, renderMenuItem, children } = props;
    const [menu, setMenu] = useState<MenuState | null>(null);

    const closeMenu = useCallback((owner: symbol) => {
        setMenu(current => (current && current.owner === owner ? null : current));
    }, []);

    // menu is not part of the context, so the consumers will not rerender along with the dropdown
    const context = useMemo<AutoSuggestContextValue>(() => ({
        defaults: { caseSensitive, maxSuggestions },
        openMenu: setMenu,
        closeMenu
    }), [caseSensitive, maxSuggestions, closeMenu]);

    return (
        <AutoSuggestContext.Provider value={context}>
            {children}
            <MenuPlaceholder menu={menu} renderMenu={renderMenu} renderMenuItem={renderMenuItem} />
        </AutoSuggestContext.Provider>
    );
}
