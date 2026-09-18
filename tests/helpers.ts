/** Places a collapsed caret (or a selection) inside a text node of a contenteditable element. */
export const setCaret = (node: Node, start: number, end: number = start): void => {
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, end);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
};

export const setInputCaret = (input: HTMLInputElement | HTMLTextAreaElement, start: number, end: number = start): void => {
    input.focus();
    input.setSelectionRange(start, end);
};

export const flushPromises = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));
