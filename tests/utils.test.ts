import { describe, expect, it } from 'vitest';
import { mergeProps } from '../src/utils';

describe('mergeProps', () => {
    it('returns plugin props when there are no consumer props', () => {
        const own = { onBlur: () => undefined };
        expect(mergeProps(own)).toEqual(own);
    });

    it('composes event handlers, consumer first', () => {
        const calls: string[] = [];
        const merged = mergeProps(
            { onBlur: (e: string) => calls.push('plugin:' + e) },
            { onBlur: (e: string) => calls.push('consumer:' + e), className: 'field' }
        );

        merged.onBlur('blur');
        expect(calls).toEqual(['consumer:blur', 'plugin:blur']);
        expect(merged.className).toBe('field');
    });

    it('lets the consumer overwrite styles', () => {
        const merged = mergeProps(
            { style: { position: 'absolute', top: 10 } },
            { style: { top: 20, color: 'red' } }
        );
        expect(merged.style).toEqual({ position: 'absolute', top: 20, color: 'red' });
    });
});
