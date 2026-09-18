import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom does not implement isContentEditable
Object.defineProperty(HTMLElement.prototype, 'isContentEditable', {
    configurable: true,
    get(this: HTMLElement) {
        const host = this.closest('[contenteditable]');
        return Boolean(host) && host!.getAttribute('contenteditable') !== 'false';
    }
});

afterEach(cleanup);
