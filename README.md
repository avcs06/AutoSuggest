# AutoSuggest
A headless React + TypeScript plugin to implement IDE like autocompletion in input, textarea or contenteditable fields.

### [Demo](https://avcs.pro/autosuggest) | [Documentation](Documentation.md)

```bash
npm run demo    # run the demo locally
npm test        # run the test cases
```

# Features
### General
1. Supports input, textarea and contenteditable fields
2. Headless: the plugin does not render any markup or styles, it only provides the behavior through props that should be passed to your own elements from the render methods.
3. No dependencies other than React (and `invariant`)
4. Written in TypeScript, types are shipped along with the package.
5. Same hook can be used with any number of fields.

### Trigger
1. Can use any character or any sequence of characters as a trigger.
2. If no trigger is passed will use space as a trigger.
3. Trigger character will also be removed when inserting a suggestion except for the above case.

### Suggestions
1. Can supply an array of strings as [Suggestions](Documentation.md#suggestion-as-string).
2. Can supply an array of `{ value, label }` objects as [Suggestions](Documentation.md#suggestion-as-object), `label` is meant to be shown in the dropdown and `value` is inserted into the field.
3. Can pass a `Function` in [SuggestionList.values](Documentation.md#createsuggestionlist) which will receive the keyword and generates [Suggestions](Documentation.md#suggestion) dynamically.
    - Supports `async` functions allowing you to fetch suggestions over API calls, the menu is rendered with `loading: true` until the suggestions of all the matching lists are available.
    - By default the plugin matches all suggestions that starts with keyword, if you want more control over matching, like fuzzy search, you can use `Function` to plug the behavior into the plugin.
4. `renderInsert` of the SuggestionList can return `{ text, node }` to decide what is inserted: `text` for input and textarea, `node` (any ReactNode, inserted as static DOM) for contenteditable.
5. `onInsert` of the SuggestionList is called with the inserted suggestion and the inserted DOM node.

### Dropdown
1. The dropdown is rendered by your `renderMenu` and `renderMenuItem` methods, inside a placeholder rendered by `AutoSuggestProvider`.
2. When multiple lists match, results of all the lists are shown in the same dropdown, in the order of the lists.
3. Current scroll states are considered when calculating the position of dropdown.
4. Considers `line-height` of the trigger character (height in case of input) to determine the position of dropdown.
5. Dropdown will be shown on keyup or mouseup inside the field, when the value before the current selection ends with "trigger + keyword" (without spaces) and the immediate character after the selection does not belong to `a-zA-Z0-9_` (Anything inside the selection will not be considered inside keyword)
6. In case of contenteditable, if the selection spans over multiple nodes with different styles, the suggestion will be inserted into the first node, hence follows the style of the first node.
7. Keyboard navigation is not part of the plugin.
