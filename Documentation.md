# Documentation
### Installation
```bash
npm i @avcs/autosuggest react react-dom --save
```

## `<AutoSuggestProvider>`
Provides global defaults to every `useAutoSuggest` hook underneath and renders the placeholder in which the dropdown
menu is drawn. The placeholder itself renders nothing; only the output of `renderMenu` is rendered.

```tsx
<AutoSuggestProvider caseSensitive={false} maxSuggestions={10} renderMenu={renderMenu} renderMenuItem={renderMenuItem}>
    {children}
</AutoSuggestProvider>
```

### Props
**`caseSensitive`**: `boolean` *(default: `false`)*
Match only when the case of the keyword matches the suggestion.

**`maxSuggestions`**: `number` *(default: `10`)*
Maximum number of suggestions handed to `renderMenu`, taken from the top of the list.

**`renderMenu`**: `(args: RenderMenuArgs) => ReactNode` *(required for anything to show)*
```ts
interface RenderMenuArgs {
    menuProps: { role: 'listbox'; style: CSSProperties; onMouseDown(e): void }; // spread on the menu container
    children: ReactNode[];     // every group, already rendered via renderGroup, in list order
    groups: RenderGroupArgs[]; // one per matching list, in list order
    suggestions: Suggestion[]; // flat, across all groups
    isLoading: boolean;        // at least one list is still pending
    position: { top: number; left: number }; // document coordinates below the trigger of the first list
    element: HTMLElement;      // the field the menu belongs to
    close(): void;
}
```
`menuProps.style` positions the menu absolutely in document coordinates. `menuProps.onMouseDown` prevents the field
from losing focus. Render it wherever you like, e.g. through `createPortal`.

**`renderGroup`**: `(args: RenderGroupArgs) => ReactNode` *(default: the group's items as they are)*
```ts
interface RenderGroupArgs {
    list: SuggestionList;
    keyword: string;
    suggestions: Suggestion[];
    items: ReactNode[];  // already rendered via the list's (or the provider's) renderMenuItem
    isLoading: boolean;  // this list is still pending
}
```
Use it for section headings, dividers or per-list loading indicators.

**`renderMenuItem`**: `(args: RenderMenuItemArgs) => ReactNode`
```ts
interface RenderMenuItemArgs {
    suggestion: Suggestion;
    index: number;         // inside its group
    list: SuggestionList;  // the list it came from
    keyword: string;
    itemProps: { role: 'option'; onMouseDown(e): void }; // inserts the suggestion
    insert(): void;                                        // same, for custom events
}
```
Keys are handled by the library; do not add your own.

## `useAutoSuggest(suggestionLists)`
```tsx
const { getInputProps, isOpen, close } = useAutoSuggest([list1, list2]);
<input type="text" {...getInputProps<HTMLInputElement>()} />
```

**`suggestionLists`**: `SuggestionList[]` — entities created with `createSuggestionList`. Every list whose trigger
matches contributes a group to the menu, in this order. Groups appear as soon as their lookup resolves; the menu closes
when every list resolved empty. All behaviour options (including `onInsert`) live on the provider or on the lists;
the hook only wires a field to them.

### Returns
**`getInputProps()`**: `{ onKeyUp, onMouseUp, onBlur }` — spread on an `input[type=text]`, `textarea` or
contenteditable element. Anything else throws.

**`isOpen`**: `boolean` — the dropdown owned by this hook is open (loading or showing).

**`close()`**: closes the dropdown.

## `createSuggestionList(options)`
Generator utility that turns options into a `SuggestionList` entity. The entity carries everything needed to match
keywords, resolve suggestions, render its group in the dropdown (`renderGroup` / `renderMenuItem` overrides) and
register the `onInsert` event.

```ts
const list = createSuggestionList({
    trigger: '@',
    suggestions: ['alpha', { value: 'beta', label: 'Beta (β)' }],
    caseSensitive: true,
    maxSuggestions: 5,
    renderGroup: ({ items }) => <><li className="heading">People</li>{items}</>,
    renderMenuItem: ({ suggestion, itemProps }) => <li {...itemProps}>{suggestion.label}</li>,
    renderInsert: suggestion => ({ text: `${suggestion.value} `, node: <a href={`/u/${suggestion.value}`}>{suggestion.label}</a> }),
    onInsert: (suggestion, node) => {}
});
```

### Options
**`trigger`**: `string | undefined` *(default: `undefined`)*
Activates the list; the text typed after it is the `keyword`. Without a trigger, whitespace is used and is **not**
removed on insert.

**`suggestions`**: `SuggestionInput[] | SuggestionGenerator` *required*
```ts
type SuggestionInput = string | { value: string; label?: string };
type SuggestionGenerator = (keyword: string, element: HTMLElement) => SuggestionInput[] | Promise<SuggestionInput[]>;
```
Static arrays are filtered by "starts with keyword" on `label` or `value` (exact matches are excluded). Label
matches are ordered before value-only matches; within each group the original order is kept. Generators receive the
keyword and the field and return suggestions (or a Promise of them); results are used as-is.

Validation errors are raised through [`invariant`](https://www.npmjs.com/package/invariant); messages are stripped in
production builds (`process.env.NODE_ENV === 'production'`).

**`renderInsert`**: `(suggestion: Suggestion) => { text?: string; node?: ReactNode }`
Decides what gets inserted instead of `suggestion.value`.
- `input` / `textarea` insert `text`; it must be a non-empty string or an error is thrown.
- contenteditable inserts `node`, rendered to real DOM (it must produce exactly one root node, e.g. an `<a>` or a
  `<span>`), and falls back to `text` as a Text node when `node` is omitted. Omitting both throws.
- The rendered node is static DOM: React event handlers on it are not preserved.

**`onInsert`**: `(suggestion: Suggestion, node: Node) => void`
`node` is what was inserted into a contenteditable field (a `Text` node, or the root node rendered from
`renderInsert().node`), or the `input` / `textarea` element itself.

**`caseSensitive`**, **`maxSuggestions`**, **`renderGroup`**, **`renderMenuItem`**
Same meaning as on the provider; when set they override the provider value for this list only. `maxSuggestions`
applies per list, not to the whole menu.

### Entity
```ts
interface SuggestionList {
    id: string;
    trigger: string | undefined;
    isTriggerMatch(value: string): boolean;              // text before the caret ends with "trigger + keyword"
    getMatch(value: string): string | null;              // keyword or null
    getSuggestions(keyword, element, { caseSensitive }): Promise<Suggestion[]>;
    caseSensitive?: boolean; maxSuggestions?: number;
    renderGroup?: RenderGroup; renderMenuItem?: RenderMenuItem;
    renderInsert?: RenderInsert; onInsert?: OnInsert;
}
```

## `Suggestion`
```ts
interface Suggestion {
    value: string; // inserted into the field
    label: string; // shown by renderMenuItem
}
```

## Low level helpers
**`insertSuggestion(element, content, trigger?)`**: `Node | null` — replaces "trigger + keyword" (and the current
selection) with `content` (`{ text?, node? }`, same rules as `renderInsert`), places the caret after it and dispatches
an `input` event.

**`renderToNode(node)`**: `Node` — renders a ReactNode synchronously into a detached React root and returns a clone of
its single root DOM node.

**`getCaretPosition(element, trigger?)`**: `{ top, left }` — document coordinates below the trigger character
(below the field for `input`).

## Migrating from v1
| v1 | v2 |
|----|----|
| `new AutoSuggest(options, ...inputs)` | `useAutoSuggest(lists, options)` + `<AutoSuggestProvider>` |
| `new SuggestionList(options)` | `createSuggestionList(options)` |
| `values` | `suggestions` |
| `values(keyword, callback)` with `this` = element | `suggestions(keyword, element)` returning array or Promise |
| `on` / `show` | `value` / `label` |
| `insertText` / `insertHtml` | `renderInsert(suggestion) => { text, node }` |
| `focusText` / `focusHtml` | removed, caret goes after the inserted content |
| `onChange(suggestion)` | `onInsert(suggestion, node)` |
| bundled dropdown + `dropdown.css` | `renderMenu` / `renderGroup` / `renderMenuItem` |
| first matching list shown | every matching list shown as a group |
| Enter / Tab / Esc / arrow keys | removed (bring your own) |
