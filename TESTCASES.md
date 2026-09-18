# Test cases
Automated tests live in `tests/` and run with `npm test` (Vitest + jsdom). This file lists the behaviours they cover
plus the manual checks that need a real browser (`npm run demo`).

## Automated
### `createSuggestionList` (tests/createSuggestionList.test.ts)
1. Strings become `{ value, label }`; `label` defaults to `value`; invalid types throw.
2. Static lists match "starts with keyword" on `label` or `value`, case-insensitive by default, exact matches excluded.
   Label matches are listed before value-only matches, original order kept within each group.
3. Regex special characters in keywords and triggers are escaped.
4. `getMatch` returns the keyword for `trigger + keyword` at the end of the text, `null` otherwise. Multi-character
   triggers work. No trigger → whitespace.
5. `getSuggestions` always returns a Promise; generators may return sync or async and receive the element.
   Generator errors reject.
6. Only explicitly provided overrides are stored, so provider defaults fall through.

### `insertSuggestion` / `renderToNode` (tests/insert.test.tsx)
1. input / textarea: trigger + keyword replaced, caret placed after text, selection dropped, `input` event fired.
   Empty or missing `text` throws; `node` is ignored.
2. contenteditable: `node` is rendered to DOM and inserted (caret after it), `text` is used as a Text node when `node`
   is omitted; omitting both throws. Trailing text is kept; multi-node selections are removed.
3. `renderToNode` returns a detached clone, renders strings to Text nodes, and rejects 0 or 2+ root nodes.
4. Unsupported elements throw; missing selection returns `null`.

### `useAutoSuggest` + `AutoSuggestProvider` (tests/useAutoSuggest.test.tsx)
1. Throws outside a provider.
2. Opens with matching suggestions on keyup / mouseup; `menuProps` has `role="listbox"` and absolute positioning.
3. Global `caseSensitive` / `maxSuggestions` apply; list-level values override them.
4. Stays closed when the character after the caret is a word character; opens when part of the keyword is selected.
5. Closes when no list matches, all lists are empty, or on blur.
6. Mousedown on an item inserts, prevents default, closes, and calls the list `onInsert` once with
   `(suggestion, node)`.
7. Controlled React inputs receive `onChange` after insert.
7b. `renderInsert` text goes into inputs, its node into contenteditable; `onInsert` receives the rendered node.
8. Every lookup passes through `isLoading` (static lists included), then results; stale results are ignored;
   failures close the menu.
9. Every matching list is shown as a group in list order; resolved groups appear while slower lists still load;
   `maxSuggestions` applies per list.
10. Each group uses its list's `renderMenuItem` and `renderGroup`, falling back to the provider's; without a provider
    `renderMenu` nothing renders.
11. Render args expose `groups`, `suggestions`, `element`, `position`, `close`; `insert` helper works. Inserting from
    a group uses that list's trigger and `onInsert`.
12. Only one field owns the menu at a time.
13. contenteditable: opens on the current text node, inserts a Text node, ignores selections outside the field.

## Manual (browser)
1. Dropdown position tracks the trigger in textarea / contenteditable and sits below the field for input, including
   when the field is scrolled.
2. Inserting into contenteditable keeps the caret visible at the end of the inserted text.
3. Clicking a menu item does not blur the field.
