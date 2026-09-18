import invariant from 'invariant';
import type { ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

/**
 * Renders a ReactNode synchronously into a detached container and returns a deep clone of the
 * single root DOM node it produced. The temporary React root is unmounted, so the returned node
 * is plain DOM without React event handlers (suitable for contenteditable content).
 */
export const renderToNode = (node: ReactNode): Node => {
    const container = document.createElement('div');
    const root = createRoot(container);
    try {
        flushSync(() => root.render(node));
        invariant(
            container.childNodes.length === 1,
            'AutoSuggest: renderInsert `node` must render exactly one root DOM node, got %s',
            container.childNodes.length
        );
        return (container.firstChild as Node).cloneNode(true);
    } finally {
        root.unmount();
    }
};
