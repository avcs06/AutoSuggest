import { useMemo, useState } from 'react';
import { AutoSuggestProvider, createSuggestionList, useAutoSuggest } from '@avcs/autosuggest';
import type { RenderMenu, RenderMenuItem, SuggestionGenerator, SuggestionList } from '@avcs/autosuggest';

const SPECIAL = 'with:^sp[e]c<i>(a)l ch{a}rs?$';

// Global render methods, all the markup and styles belong to the consumer
// Results of all the matching lists are shown, one section per list
const renderMenu: RenderMenu = ({ getMenuProps, sections, loading }) => (
    <ul {...getMenuProps({ className: 'menu' })}>
        {sections.map((section, index) => (
            <li key={index} className="menu-section">
                <div className="menu-heading">{section.trigger || 'space'} {section.keyword}</div>
                <ul>{section.items}</ul>
            </li>
        ))}
        {loading && <li className="menu-loader">Loading...</li>}
    </ul>
);

const renderMenuItem: RenderMenuItem = ({ getItemProps, suggestion }) => (
    <li {...getItemProps({ className: 'menu-item' })}>{suggestion.label}</li>
);

// Words (4+ characters) already typed in the field, resolved after a second
const wordsInField: SuggestionGenerator = async (keyword, element) => {
    const search = keyword.toLowerCase();
    const text = 'value' in element ? String(element.value) : element.textContent || '';
    const words = text.toLowerCase().split(/[^a-zA-Z0-9_]+/).filter((word, index, all) => (
        word.length >= 4 && word.startsWith(search) && word !== search && all.indexOf(word) === index
    ));

    await new Promise(resolve => setTimeout(resolve, 1000));
    return words;
};

// Lists which do not depend on the state of a component can be created once
const staticLists: SuggestionList[] = [
    createSuggestionList({ trigger: 'w', values: ['word', 'world', SPECIAL] }),
    createSuggestionList({ trigger: '//', caseSensitive: true, values: ['hello', 'world', 'simillar1', 'simillar12', SPECIAL] }),
    createSuggestionList({
        trigger: '#',
        maxSuggestions: 3,
        values: ['one', 'two', 'three', 'four', 'five'],
        // List specific render method
        renderMenuItem: ({ getItemProps, suggestion, index }) => (
            <li {...getItemProps({ className: 'menu-item' })}>
                {suggestion.label}<small>item {index + 1} of the menu, max 3 from this list</small>
            </li>
        )
    }),
    createSuggestionList(['hello', 'world', 'simillar1', 'simillar12', SPECIAL]),
    createSuggestionList(wordsInField)
];

function useDemoSuggestions(log: (message: string) => void) {
    const suggestions = useMemo(() => [
        createSuggestionList({
            trigger: '@',
            values: [
                { value: '@AmbulaV', label: 'Chandrasekhar Ambula V' },
                { value: '@John', label: 'Peter John' }
            ],
            // text goes into input and textarea, node goes into contenteditable
            renderInsert: ({ suggestion }) => ({
                text: suggestion.value,
                node: <><a href="/" target="_blank">{suggestion.value}</a>{'\u00A0'}</>
            }),
            onInsert: (suggestion, node) => {
                log(`"${suggestion.value}" inserted as <${node.nodeName.toLowerCase()}>`);
            }
        }),
        ...staticLists
    ], [log]);

    return useAutoSuggest({ suggestions });
}

function Fields() {
    const [messages, setMessages] = useState<string[]>([]);
    const log = useMemo(() => (message: string) => setMessages(current => [message, ...current].slice(0, 5)), []);

    // Same hook can serve any number of fields
    const { getInputProps } = useDemoSuggestions(log);
    const [value, setValue] = useState('');

    return (
        <div className="page">
            <p className="hint">
                Triggers: <code>@</code> (label and value differ, <code>renderInsert</code> inserts a link in contenteditable), <code>#</code> (max 3, custom item),{' '}
                <code>w</code>, <code>//</code> (case sensitive), no trigger (<code>hello</code>, <code>world</code>, ...) and an
                async list of 4+ letter words already typed in the field. All the matching lists are shown together,
                try <code>wo</code> or type <code>world</code> first and then <code>wo</code>.
            </p>

            <h3>Input Demo (controlled)</h3>
            <input type="text" value={value} onChange={e => setValue(e.target.value)} {...getInputProps({ className: 'field' })} />
            <p className="hint">State: {JSON.stringify(value)}</p>

            <h3>Textarea Demo</h3>
            <textarea rows={4} {...getInputProps({ className: 'field' })} />

            <h3>Contenteditable Demo</h3>
            <div contentEditable suppressContentEditableWarning {...getInputProps({ className: 'field' })} />

            <h3>onInsert log</h3>
            <ol className="log">
                {messages.map((message, index) => <li key={index}>{message}</li>)}
            </ol>
        </div>
    );
}

export function App() {
    return (
        <AutoSuggestProvider maxSuggestions={10} caseSensitive={false} renderMenu={renderMenu} renderMenuItem={renderMenuItem}>
            <Fields />
        </AutoSuggestProvider>
    );
}
