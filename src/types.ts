import type {
    CSSProperties,
    FocusEventHandler,
    KeyboardEventHandler,
    MouseEventHandler,
    ReactNode
} from 'react';

export interface Suggestion {
    /** Inserted in place of "trigger + keyword", also used for matching */
    value: string;
    /** Meant to be shown in the dropdown, also used for matching */
    label: string;
}

/** A string will be converted into `{ value: string, label: string }` */
export type SuggestionInput = string | { value: string; label?: string };

/** Generates suggestions for the keyword, can be async */
export type SuggestionGenerator = (
    keyword: string,
    element: HTMLElement
) => SuggestionInput | SuggestionInput[] | PromiseLike<SuggestionInput | SuggestionInput[]>;

export type SuggestionValues = SuggestionInput | SuggestionInput[] | SuggestionGenerator;

/** The first inserted node in case of contenteditable, the field itself for input and textarea */
export type InsertedNode = Text | Element;

export interface RenderInsertProps {
    suggestion: Suggestion;
    keyword: string;
    trigger: string | undefined;
    /** The field being edited */
    element: HTMLElement;
}

export interface RenderInsertResult {
    /** Required for input and textarea, used for contenteditable when there is no `node` */
    text?: string;
    /** Inserted into contenteditable as static DOM nodes, ignored for input and textarea */
    node?: ReactNode;
}

/** Decides what is inserted in place of "trigger + keyword", `suggestion.value` is inserted by default */
export type RenderInsert = (props: RenderInsertProps) => RenderInsertResult;

export interface CaretPosition {
    top: number;
    left: number;
}

/**
 * Merges the behavior props of the plugin into the props of the consumer,
 * event handlers present on both the sides are composed (consumer first).
 */
export type PropGetter<Own extends object> = <P extends object = object>(
    userProps?: P
) => Omit<P, keyof Own> & Own;

export interface InputProps {
    onKeyUp: KeyboardEventHandler<HTMLElement>;
    onMouseUp: MouseEventHandler<HTMLElement>;
    onBlur: FocusEventHandler<HTMLElement>;
}

export interface MenuProps {
    /** Places the menu right below the caret, relative to the document */
    style: CSSProperties;
    /** Retains the focus on the field while interacting with the menu */
    onMouseDown: MouseEventHandler<HTMLElement>;
}

export interface MenuItemProps {
    /** Inserts the suggestion */
    onMouseDown: MouseEventHandler<HTMLElement>;
}

/** Results of one of the matching suggestion lists */
export interface MenuSection {
    trigger: string | undefined;
    keyword: string;
    suggestions: Suggestion[];
    /** Output of `renderMenuItem` for each of the suggestions in this section */
    items: ReactNode[];
}

export interface RenderMenuProps {
    /** Props to be passed to the menu element */
    getMenuProps: PropGetter<MenuProps>;
    /** Output of `renderMenuItem` for the suggestions of all the sections */
    items: ReactNode[];
    /** Suggestions of all the sections */
    suggestions: Suggestion[];
    /** One section per matching suggestion list with results, in the order of the lists */
    sections: MenuSection[];
    /** `true` while waiting for any of the async suggestion generators, results available so far are in `sections` */
    loading: boolean;
    /** Position right below the caret, relative to the document */
    position: CaretPosition;
    /** The field being edited */
    element: HTMLElement;
}

export interface RenderMenuItemProps {
    /** Props to be passed to the menu item element */
    getItemProps: PropGetter<MenuItemProps>;
    suggestion: Suggestion;
    /** Index of the suggestion in the menu, across all the sections */
    index: number;
    keyword: string;
    trigger: string | undefined;
}

export type RenderMenu = (props: RenderMenuProps) => ReactNode;
export type RenderMenuItem = (props: RenderMenuItemProps) => ReactNode;

/** Properties that can be configured globally, per hook or per suggestion list */
export interface CommonOptions {
    /** default: `false` */
    caseSensitive?: boolean;
    /** Maximum number of suggestions shown per suggestion list, default: `10` */
    maxSuggestions?: number;
    renderMenuItem?: RenderMenuItem;
}

/** Menu is shared by all the matching suggestion lists, so it can be configured only globally or per hook */
export interface MenuOptions extends CommonOptions {
    renderMenu?: RenderMenu;
}

export interface SuggestionListOptions extends CommonOptions {
    /** Text typed after the trigger is used as keyword, space is the trigger if undefined */
    trigger?: string;
    values: SuggestionValues;
    renderInsert?: RenderInsert;
    /** Called after a suggestion from this list is inserted */
    onInsert?: (suggestion: Suggestion, node: InsertedNode) => void;
}

export interface SuggestionQueryContext {
    element: HTMLElement;
    caseSensitive: boolean;
}

/** Everything needed to register events for a list and to render its dropdown */
export interface SuggestionList extends CommonOptions {
    readonly trigger: string | undefined;
    /** `true` if the value (text before the caret) ends with "trigger + keyword" */
    isTriggerMatch(value: string): boolean;
    readonly renderInsert?: RenderInsert;
    readonly onInsert?: (suggestion: Suggestion, node: InsertedNode) => void;
    /** Returns the keyword if the value ends with "trigger + keyword", `null` otherwise */
    getMatch(value: string): string | null;
    getSuggestions(keyword: string, context: SuggestionQueryContext): Promise<Suggestion[]>;
}

export type SuggestionListInput = SuggestionList | SuggestionListOptions | SuggestionValues;

export interface AutoSuggestProviderProps extends MenuOptions {
    renderMenu: RenderMenu;
    renderMenuItem: RenderMenuItem;
    children?: ReactNode;
}

export interface UseAutoSuggestOptions extends MenuOptions {
    suggestions: SuggestionListInput[];
}

export interface UseAutoSuggestResult {
    /** Props to be passed to input[type = text], textarea or contenteditable elements */
    getInputProps: PropGetter<InputProps>;
}
