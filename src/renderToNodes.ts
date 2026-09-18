import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import type { ReactNode } from 'react';

/**
 * Renders the ReactNode into static DOM nodes.
 * Content of a contenteditable is edited by the user, so it can not be managed by React after the insert,
 * the nodes are rendered in a detached fragment and copies of them are returned.
 */
export function renderToNodes(node: ReactNode): Node[] {
    const container = document.createDocumentFragment();
    const root = createRoot(container);
    flushSync(() => root.render(node));

    const nodes = Array.from(container.childNodes).map(child => child.cloneNode(true));
    root.unmount();
    return nodes;
}
