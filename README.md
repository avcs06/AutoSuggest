# AutoSuggest
A headless React + TypeScript hook to implement IDE like autocompletion in input, textarea or contenteditable fields.

The library renders **no markup and ships no CSS**. It provides behaviour through props that you spread on your own
elements via `renderMenu` / `renderMenuItem`.

### [Documentation](Documentation.md)

```tsx
import { AutoSuggestProvider, createSuggestionList, useAutoSuggest } from '@avcs/autosuggest';

const mentions = createSuggestionList({
    trigger: '@',
    suggestions: [{ value: '@ambula', label: 'Chandrasekhar Ambula V' }, '@john'],
    onInsert: (suggestion, node) => console.log(suggestion.value, node)
});

const Field = () => {
    const { getInputProps } = useAutoSuggest([mentions]);
    return <textarea {...getInputProps<HTMLTextAreaElement>()} />;
};

const App = () => (
    <AutoSuggestProvider
        maxSuggestions={5}
        renderMenu={({ menuProps, children, isLoading }) => <ul {...menuProps}>{children}{isLoading && <li>Loading…</li>}</ul>}
        renderMenuItem={({ suggestion, itemProps }) => <li {...itemProps}>{suggestion.label}</li>}
    >
        <Field />
    </AutoSuggestProvider>
);
```

# Features
### General
1. Supports input, textarea and contenteditable fields
2. Headless: no DOM, no styles, no dependencies besides React
3. Fully typed (TypeScript)
4. Works with controlled React inputs: inserting a suggestion fires the field's `onChange`

### Trigger
1. Can use any character or any sequence of characters as a trigger.
2. If no trigger is passed, whitespace is used as the trigger.
3. Trigger characters are removed when inserting a suggestion, except for the whitespace case.

### Suggestions
1. A suggestion is `{ value, label }`. `value` is inserted, `label` is what your menu item shows.
   A list can override what is inserted with `renderInsert`: plain `text` for input / textarea and a React `node`
   (rendered to DOM) for contenteditable.
2. Plain strings are accepted and expand to `{ value: s, label: s }`.
3. Static lists match "starts with keyword" on `label` first, then `value`; label matches are listed first.
4. Suggestions can be a static array or a generator function `(keyword, element)` returning an array or a Promise.
   Use it for API calls, fuzzy search, etc.
5. Multiple suggestion lists per field; every matching list shows up as its own group, in order, each rendered with
   its own `renderMenuItem` / `renderGroup`. Groups appear as soon as their lookup resolves.

### Dropdown
1. `renderMenu` receives `menuProps` (absolute document coordinates right below the trigger / keyword) plus the
   rendered `children` (one per group), `groups`, `suggestions`, `isLoading`, `element` and `close`.
2. `renderGroup` wraps one list's items (headings, dividers, per-list loading state).
3. `renderMenuItem` receives `itemProps` (mousedown handler that inserts and keeps focus in the field), `insert` and
   the `list` the suggestion came from.
4. Global defaults (`caseSensitive`, `maxSuggestions`, `renderGroup`, `renderMenuItem`) live on the provider and can
   be overridden per list; `renderMenu` is provider-only.
5. The menu opens on keyup / mouseup inside the field when the text before the selection ends with
   "trigger + keyword" and the character after the selection is not `[a-zA-Z0-9_]`. It closes on blur.

# Development
```bash
npm install
npm test          # vitest (jsdom)
npm run demo      # local demo at http://localhost:5173
npm run build     # emits ESM + d.ts to lib/
```
