# Documentation
### Installation
```bash
npm i @avcs/autosuggest --save
```
`react >= 18` and `react-dom >= 18` are peer dependencies.

### Usage
```tsx
import { AutoSuggestProvider, createSuggestionList, useAutoSuggest } from '@avcs/autosuggest';

const tags = createSuggestionList({
    trigger: '#',
    values: ['hello', { value: 'world', label: 'World!' }],
    onInsert: (suggestion, node) => console.log(suggestion.value, node)
});

function Editor() {
    const { getInputProps } = useAutoSuggest({ suggestions: [tags] });
    return <textarea {...getInputProps({ className: 'editor' })} />;
}

function App() {
    return (
        <AutoSuggestProvider
            renderMenu={({ getMenuProps, items, loading }) => (
                <ul {...getMenuProps({ className: 'menu' })}>{loading ? <li>Loading...</li> : items}</ul>
            )}
            renderMenuItem={({ getItemProps, suggestion }) => (
                <li {...getItemProps({ className: 'menu-item' })}>{suggestion.label}</li>
            )}
        >
            <Editor />
        </AutoSuggestProvider>
    );
}
```

The plugin does not render any element or style of its own. `getMenuProps`, `getItemProps` and `getInputProps` return the props
carrying the behavior, pass them to your elements. Your own props can be passed through these methods: event handlers present on
both the sides are composed (yours is called first) and `style` is merged (yours wins).

## Common options
Can be passed to `AutoSuggestProvider`, `useAutoSuggest` and `createSuggestionList`. Priority: SuggestionList > hook > provider.  
Except `renderMenu`: the menu is shared by all the matching SuggestionLists, so it can be passed only to `AutoSuggestProvider` and `useAutoSuggest`.

**`caseSensitive`**: `boolean` *(default: `false`)*  
Setting it to `true` will show suggestions only if the case of search value matches the case of suggestion.

**`maxSuggestions`**: `number` *(default: `10`)*  
Maximum number of suggestions to be shown in the dropdown per SuggestionList, suggestions will be taken from the top of SuggestionList.

**`renderMenu`**: `(props: RenderMenuProps) => ReactNode` *required on the provider, not available on SuggestionList*  
- `getMenuProps(userProps?)`: props for the menu element: `style` (`position: absolute` + `top` and `left` of the caret, relative to the document) and `onMouseDown` (retains the focus on the field).
- `sections`: `Array<{ trigger, keyword, suggestions, items }>`, one section per matching SuggestionList with results, in the order of the lists.
- `items`, `suggestions`: output of `renderMenuItem` and the suggestions of all the sections together, use these if the lists need not be separated.
- `loading`: `true` while waiting for any of the async suggestion generators, results available so far are shown.
- `position: { top, left }`, `element` (the field being edited).

**`renderMenuItem`**: `(props: RenderMenuItemProps) => ReactNode` *required on the provider*  
- `getItemProps(userProps?)`: props for the menu item element: `onMouseDown` (inserts the suggestion).
- `suggestion`, `index` (in the menu, across all the sections), `keyword`, `trigger` (of the list owning the suggestion).

> `renderMenu` and `renderMenuItem` are render methods not components, hooks can not be used inside them.

## AutoSuggestProvider
Configures the global defaults through [Common options](#common-options) and renders the placeholder of the dropdown right after its `children`.
The placeholder does not render anything by itself, it renders the output of `renderMenu` while a dropdown is active.

> Position of the dropdown is relative to the document, render the provider (or portal the menu from `renderMenu`) where there is no positioned ancestor.

## useAutoSuggest
```tsx
const { getInputProps } = useAutoSuggest(options);
```
Should be used inside `AutoSuggestProvider`.

**`suggestions`**: `Array<SuggestionList | Options for createSuggestionList>` *required*  
When multiple lists match, results of all the lists are shown in the order of the lists, position of the dropdown comes from the first list with results. Memoize the array (or create it outside the component), the lists are regenerated whenever the array changes.

Accepts [Common options](#common-options) too.

**`getInputProps(userProps?)`**: props (`onKeyUp`, `onMouseUp`, `onBlur`) for `input[type = text]`, `textarea` or contenteditable elements. Can be passed to any number of fields.

## createSuggestionList
```tsx
const suggestionList = createSuggestionList(options);
```
Returns a `SuggestionList`, an entity with everything needed to register events and render the dropdown of the list:
`trigger`, `isTriggerMatch(value)`, `getMatch(value)`, `async getSuggestions(keyword, context)`, `renderInsert`, `onInsert` and the [Common options](#common-options) of the list.

### Options
**`trigger`**: `string | undefined` *(default: `undefined`)*  
This SuggestionList will be activated on typing the trigger, all the text typed after trigger is used as `keyword` for matching suggestions. If trigger is undefined, space is considered as trigger.

**`values`**: `Array<Suggestion> | (keyword: string, element: HTMLElement) => Array<Suggestion> | Promise<Array<Suggestion>>` *required*  
If the function fails (or the promise is rejected) the list is shown without results and the error is left unhandled, handle the errors inside the function to avoid it.  
`options` can be replaced with `values`, if there are no other options.

**`renderInsert`**: `(props: { suggestion, keyword, trigger, element }) => { text?: string, node?: ReactNode }`  
Decides what is inserted in place of trigger and keyword, `suggestion.value` is inserted if there is no `renderInsert`.
- input and textarea: `text` is inserted, an error is thrown if there is no `text`. `node` is ignored.
- contenteditable: `node` is inserted, `text` is inserted if there is no `node` (or if it renders nothing), an error is thrown if both are missing.

```tsx
renderInsert: ({ suggestion }) => ({
    text: suggestion.value,
    node: <a href={`/users/${suggestion.value}`}>{suggestion.value}</a>
})
```
> Content of a contenteditable is edited by the user, so it can not be managed by React: `node` is rendered once, outside your React tree,
> and inserted as static DOM nodes. It will not rerender, event handlers are not attached and the contexts of your app are not available in it.

**`onInsert`**: `(suggestion: Suggestion, node: Text | Element) => void`  
Called after a suggestion is inserted. `node` is the first inserted node in case of contenteditable and the field itself in case of input and textarea.
An `input` event is dispatched on the field after the insert, so `onChange` of the controlled fields is called.

Accepts [Common options](#common-options) too.

## Suggestion
### Suggestion as Object
**`value`**: `string` *required*  
This value will be inserted into the place of trigger and keyword, unless the SuggestionList has a `renderInsert`.

**`label`**: `string` *(default: `value`)*  
Meant to be shown in the dropdown.

Suggestion will be shown if the keyword matches the start of `label` or `value` (with or without trigger).
Label based matches have more weight: they are shown first in the order of the list, followed by the suggestions matching only by `value`,
so they are the ones retained when the results are limited by `maxSuggestions`.

### Suggestion as String
If Suggestion is passed as string it will be converted into following Suggestion object
```javascript
{
    value: suggestion,
    label: suggestion
}
```
