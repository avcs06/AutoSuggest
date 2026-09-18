import { useCallback, useMemo, useState } from 'react';
import {
    AutoSuggestProvider,
    createSuggestionList,
    useAutoSuggest,
    type OnInsert,
    type RenderGroup,
    type RenderMenu,
    type RenderMenuItem,
    type Suggestion,
    type SuggestionList
} from '../src';

const renderMenu: RenderMenu = ({ menuProps, children, isLoading }) => (
    <ul className="menu" {...menuProps}>
        {children}
        {isLoading && <li className="menu-loading">Loading…</li>}
    </ul>
);

/** Default section renderer: a small heading per list, only when the list has results. */
const renderGroup: RenderGroup = ({ list, items }) =>
    items.length ? (
        <>
            <li className="menu-heading">{list.trigger ? `${list.trigger} …` : 'words'}</li>
            {items}
        </>
    ) : null;

const renderMenuItem: RenderMenuItem = ({ suggestion, itemProps }) => (
    <li className="menu-item" {...itemProps}>
        {suggestion.label}
        {suggestion.label !== suggestion.value && <small>{suggestion.value}</small>}
    </li>
);

const describeNode = (node: Node): string => {
    if (node instanceof HTMLElement) return `<${node.tagName.toLowerCase()}${node.id ? `#${node.id}` : ''}>`;
    return `${node.nodeName} "${node.nodeValue}"`;
};

/** Builds suggestions out of words already present in the field, with an artificial delay. */
const wordsInField = async (keyword: string, element: HTMLElement): Promise<string[]> => {
    const lower = keyword.toLowerCase();
    const text = (element as HTMLInputElement).value ?? element.textContent ?? '';
    const results: string[] = [];
    text.toLowerCase().split(/[^a-zA-Z0-9_]+/).forEach(word => {
        if (word.length >= 4 && word.startsWith(lower) && word !== lower && !results.includes(word)) {
            results.push(word);
        }
    });
    await new Promise(resolve => setTimeout(resolve, 1000));
    return results;
};

/** Every list logs its inserts; `onInsert` is a list level option, not a hook option. */
const useLists = (log: OnInsert): SuggestionList[] =>
    useMemo(
        () => [
            createSuggestionList({
                trigger: '@',
                suggestions: [
                    { value: '@AmbulaV', label: 'Chandrasekhar Ambula V' },
                    { value: '@John', label: 'Peter John' },
                    { value: '@Ann', label: 'Ann Lee' }
                ],
                // input / textarea get plain text, contenteditable gets a link
                renderInsert: suggestion => ({
                    text: `${suggestion.value} `,
                    node: (
                        <a className="mention" href={`/${suggestion.value.slice(1)}`} title={suggestion.label} contentEditable={false}>
                            {suggestion.value}
                        </a>
                    )
                }),
                onInsert: (suggestion, node) => log({ ...suggestion, label: `[mention] ${suggestion.label}` }, node)
            }),
            createSuggestionList({
                trigger: '#',
                maxSuggestions: 3,
                suggestions: ['#react', '#typescript', '#headless', '#hooks', '#autosuggest'],
                // text only: contenteditable falls back to it
                renderInsert: suggestion => ({ text: `${suggestion.value} ` }),
                renderMenuItem: ({ suggestion, itemProps }) => (
                    <li className="menu-item" {...itemProps}>
                        <span className="menu-tag">{suggestion.label}</span>
                    </li>
                ),
                onInsert: log
            }),
            createSuggestionList({
                trigger: '//',
                caseSensitive: true,
                suggestions: ['hello', 'Hello', 'world', 'simillar1', 'simillar12', 'with:^sp[e]c<i>(a)l ch{a}rs?$'],
                onInsert: log
            }),
            createSuggestionList({ suggestions: ['hello', 'world', 'simillar1', 'simillar12'], onInsert: log }),
            createSuggestionList({ suggestions: wordsInField, onInsert: log })
        ],
        [log]
    );

const ControlledInput = ({ lists }: { lists: SuggestionList[] }) => {
    const [value, setValue] = useState('');
    const { getInputProps, isOpen } = useAutoSuggest(lists);
    return (
        <>
            <input
                id="input"
                type="text"
                className="field"
                value={value}
                onChange={event => setValue(event.target.value)}
                {...getInputProps<HTMLInputElement>()}
            />
            <p className="hint">
                Controlled input. React state: <code>{JSON.stringify(value)}</code> · menu open: {String(isOpen)}
            </p>
        </>
    );
};

const Textarea = ({ lists }: { lists: SuggestionList[] }) => {
    const { getInputProps } = useAutoSuggest(lists);
    return <textarea id="textarea" className="field" rows={4} {...getInputProps<HTMLTextAreaElement>()} />;
};

const ContentEditable = ({ lists }: { lists: SuggestionList[] }) => {
    const { getInputProps } = useAutoSuggest(lists);
    return <div id="contenteditable" className="field" contentEditable suppressContentEditableWarning {...getInputProps<HTMLDivElement>()} />;
};

export const App = () => {
    const [entries, setEntries] = useState<string[]>([]);
    const log = useCallback<OnInsert>(
        (suggestion: Suggestion, node: Node) =>
            setEntries(previous => [`${new Date().toLocaleTimeString()} inserted "${suggestion.value}" (${suggestion.label}) into ${describeNode(node)}`, ...previous]),
        []
    );

    const lists = useLists(log);

    return (
        <AutoSuggestProvider caseSensitive={false} maxSuggestions={10} renderMenu={renderMenu} renderGroup={renderGroup} renderMenuItem={renderMenuItem}>
            <h1>AutoSuggest – headless React demo</h1>
            <p className="hint">
                Triggers: <code>@</code> mentions · <code>#</code> tags (max 3, custom item) · <code>//</code> case sensitive ·
                whitespace + <code>hel</code>/<code>wor</code>/<code>sim</code> · words already typed (async, 1s)
            </p>

            <h3>Input</h3>
            <ControlledInput lists={lists} />

            <h3>Textarea</h3>
            <Textarea lists={lists} />

            <h3>Contenteditable</h3>
            <ContentEditable lists={lists} />

            <div className="log">
                {entries.length === 0 ? <p>Insert a suggestion to see onInsert callbacks here.</p> : entries.map((entry, i) => <p key={i}>{entry}</p>)}
            </div>
        </AutoSuggestProvider>
    );
};
