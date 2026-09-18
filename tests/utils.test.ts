import { describe, expect, it } from 'vitest';
import { isTextInput, splitValue, stripTriggerAndKeyword, escapeRegExp, getCursorPosition } from '../src/utils';

describe('isTextInput', () => {
    it('recognises text inputs and textareas', () => {
        const input = document.createElement('input');
        input.type = 'text';
        expect(isTextInput(input)).toBe(true);
        expect(isTextInput(document.createElement('textarea'))).toBe(true);
    });

    it('recognises contenteditable elements via property or attribute', () => {
        const div = document.createElement('div');
        div.setAttribute('contenteditable', '');
        expect(isTextInput(div)).toBe(false);
        div.setAttribute('contenteditable', 'true');
        expect(isTextInput(div)).toBe(false);
    });

    it('throws for anything else', () => {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        expect(() => isTextInput(checkbox)).toThrow(/Invalid input/);
        expect(() => isTextInput(document.createElement('div'))).toThrow(/Invalid input/);
        const off = document.createElement('div');
        off.setAttribute('contenteditable', 'false');
        expect(() => isTextInput(off)).toThrow(/Invalid input/);
    });
});

describe('splitValue / stripTriggerAndKeyword', () => {
    it('splits at the trigger closest to the caret', () => {
        expect(splitValue('hi #wo rld', 6, '#')).toEqual({ textUptoTrigger: 'hi #', textAfterTrigger: 'wo rld' });
        expect(splitValue('hi wo rld', 5)).toEqual({ textUptoTrigger: 'hi ', textAfterTrigger: 'wo rld' });
    });

    it('removes trigger and keyword from the end of the text', () => {
        expect(stripTriggerAndKeyword('hi #wo', '#')).toBe('hi ');
        expect(stripTriggerAndKeyword('hi //wo', '//')).toBe('hi ');
        expect(stripTriggerAndKeyword('hi wo')).toBe('hi ');
    });
});

describe('escapeRegExp', () => {
    it('escapes special characters', () => {
        const escaped = escapeRegExp('a.b?c+d*e^f$g[h{i(j)k|l\\m');
        expect(new RegExp('^' + escaped + '$').test('a.b?c+d*e^f$g[h{i(j)k|l\\m')).toBe(true);
    });
});

describe('getCursorPosition', () => {
    it('returns start and end regardless of selection direction', () => {
        const input = document.createElement('input');
        input.type = 'text';
        document.body.appendChild(input);
        input.value = 'abcdef';
        input.setSelectionRange(1, 4, 'backward');
        expect(getCursorPosition(input)).toEqual([1, 4]);
        input.setSelectionRange(2, 2);
        expect(getCursorPosition(input)).toEqual([2, 2]);
        input.remove();
    });
});
