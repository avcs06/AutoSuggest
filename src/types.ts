import type { CSSProperties, MouseEvent, ReactNode } from 'react';

/** A single suggestion. `value` is inserted into the field, `label` is what a menu item should display. */
export interface Suggestion {
    value: string;
    label: string;
}

/** Suggestions can be supplied as plain strings (`value === label`) or as objects; `label` defaults to `value`. */
export type SuggestionInput = string | { value: string; label?: string };

/** Elements the plugin knows how to read from and write into. */
export type AutoSuggestElement = HTMLInputElement | HTMLTextAreaElement | HTMLElement;

/**
 * Suggestion generator: receives the keyword typed after the trigger and the field, and returns
 * suggestions synchronously or as a Promise. Results are used as-is (no filtering).
 */
export type SuggestionGenerator = (
    keyword: string,
    element: AutoSuggestElement
) => SuggestionInput[] | Promise<SuggestionInput[]>;

export type SuggestionSource = SuggestionInput[] | SuggestionGenerator;

/**
 * Called after a suggestion is inserted.
 * `node` is the node created inside a contenteditable (a Text node, or the root node rendered from
 * `renderInsert().node`), or the input/textarea element itself.
 */
export type OnInsert = (suggestion: Suggestion, node: Node) => void;

/**
 * What gets inserted for a suggestion. `text` is used by input / textarea (required there),
 * `node` is used by contenteditable elements and falls back to `text` when omitted.
 * `node` must render to a single root DOM node.
 */
export interface InsertContent {
    text?: string;
    node?: ReactNode;
}

/** Decides what a selected suggestion inserts. Without it `suggestion.value` is inserted as text. */
export type RenderInsert = (suggestion: Suggestion) => InsertContent;

/** Document-relative coordinates of the caret (bottom-left of the trigger character). */
export interface CaretPosition {
    top: number;
    left: number;
}

/** Props to spread on whichever element renders the dropdown menu. */
export interface MenuProps {
    role: 'listbox';
    style: CSSProperties;
    onMouseDown: (event: MouseEvent) => void;
}

/** Props to spread on whichever element renders a dropdown item. */
export interface MenuItemProps {
    role: 'option';
    onMouseDown: (event: MouseEvent) => void;
}

export interface RenderMenuItemArgs {
    suggestion: Suggestion;
    /** Index of the suggestion inside its list's group. */
    index: number;
    /** The list this suggestion came from. */
    list: SuggestionList;
    keyword: string;
    itemProps: MenuItemProps;
    /** Insert this suggestion into the active field. */
    insert: () => void;
}

/** Results of one suggestion list, as handed to `renderGroup` and `renderMenu`. */
export interface RenderGroupArgs {
    list: SuggestionList;
    keyword: string;
    suggestions: Suggestion[];
    /** Items of this group, already rendered via the list's (or the provider's) `renderMenuItem`. */
    items: ReactNode[];
    /** True while this list's lookup is still pending. */
    isLoading: boolean;
}

export interface RenderMenuArgs {
    /** Props to spread onto the menu container element. */
    menuProps: MenuProps;
    /** All groups rendered (via `renderGroup`), in list order. */
    children: ReactNode[];
    /** One entry per matching list, in list order. */
    groups: RenderGroupArgs[];
    /** Flat list of every suggestion across groups. */
    suggestions: Suggestion[];
    /** True while at least one list is still pending. */
    isLoading: boolean;
    position: CaretPosition;
    /** The field that the menu belongs to. */
    element: AutoSuggestElement;
    close: () => void;
}

export type RenderMenu = (args: RenderMenuArgs) => ReactNode;
export type RenderGroup = (args: RenderGroupArgs) => ReactNode;
export type RenderMenuItem = (args: RenderMenuItemArgs) => ReactNode;

/** Options shared by the provider and by individual suggestion lists. */
export interface CommonOptions {
    /** Match only when the case of the keyword matches the suggestion. Default: `false`. */
    caseSensitive?: boolean;
    /** Maximum number of suggestions a list contributes to the menu. Default: `10`. */
    maxSuggestions?: number;
    /** Renders one list's section inside the menu. Default: the items as they are. */
    renderGroup?: RenderGroup;
    /** Renders a single suggestion. */
    renderMenuItem?: RenderMenuItem;
}

export interface SuggestionListOptions extends CommonOptions {
    /** Text that activates this list. When omitted, whitespace acts as the trigger. */
    trigger?: string;
    suggestions: SuggestionSource;
    renderInsert?: RenderInsert;
    onInsert?: OnInsert;
}

/** Entity produced by `createSuggestionList`. */
export interface SuggestionList extends CommonOptions {
    readonly id: string;
    readonly trigger: string | undefined;
    readonly renderInsert?: RenderInsert;
    readonly onInsert?: OnInsert;
    /** `true` when `value` (text before the caret) ends with `trigger + keyword`. */
    isTriggerMatch(value: string): boolean;
    /** Returns the keyword after the trigger, or `null` when the list is not active for `value`. */
    getMatch(value: string): string | null;
    getSuggestions(
        keyword: string,
        element: AutoSuggestElement,
        options: { caseSensitive: boolean }
    ): Promise<Suggestion[]>;
}
