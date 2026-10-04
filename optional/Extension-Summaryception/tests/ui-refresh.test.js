import { describe, expect, it, vi } from 'vitest';
import { createUIRefreshQueue } from '../src/entry/ui-refresh.js';
import { setShown, setText, setValue } from '../src/entry/ui-dom.js';
import { createJQueryHarness } from './test-helpers.js';

describe('UI refresh scheduling', () => {
    it('coalesces a burst and resolves every caller after the shared render', async () => {
        const render = vi.fn(async () => {});
        const request = createUIRefreshQueue(render);
        await Promise.all(Array.from({ length: 50 }, request));
        expect(render).toHaveBeenCalledTimes(1);
    });

    it('serializes asynchronous work and makes one trailing pass for newer state', async () => {
        let release;
        let state = 'old';
        const seen = [];
        const render = vi.fn(async () => {
            seen.push(state);
            if (seen.length === 1)
                await new Promise((resolve) => {
                    release = resolve;
                });
        });
        const request = createUIRefreshQueue(render);
        const first = request();
        await Promise.resolve();
        state = 'new';
        const trailing = Array.from({ length: 20 }, request);
        expect(render).toHaveBeenCalledTimes(1);
        release();
        await Promise.all([first, ...trailing]);
        expect(seen).toEqual(['old', 'new']);
    });

    it('can refresh again after an error', async () => {
        const render = vi
            .fn()
            .mockRejectedValueOnce(new Error('render failed'))
            .mockResolvedValue();
        const request = createUIRefreshQueue(render);
        await expect(request()).rejects.toThrow('render failed');
        await request();
        expect(render).toHaveBeenCalledTimes(2);
    });
});

describe('unchanged UI controls', () => {
    it('changes visibility only when requested state changes', () => {
        const dom = createJQueryHarness();
        globalThis.$ = dom.$;
        const element = dom.element('#route');
        const toggle = vi.spyOn(element, 'toggle');
        setShown(element, true);
        setShown(element, true);
        setShown(element, false);
        expect(toggle.mock.calls).toEqual([[true], [false]]);
        expect(element.isVisible()).toBe(false);
    });

    it('leaves identical text/value nodes alone and applies changed values', () => {
        const dom = createJQueryHarness();
        const element = dom.element('#text');
        element.text('hello').val('10');
        const text = vi.spyOn(element, 'text');
        const value = vi.spyOn(element, 'val');
        setText(element, 'hello');
        setValue(element, 10);
        expect(text.mock.calls.filter((args) => args.length)).toEqual([]);
        expect(value.mock.calls.filter((args) => args.length)).toEqual([]);
        setText(element, 'updated');
        setValue(element, 20);
        expect(element.text()).toBe('updated');
        expect(element.val()).toBe(20);
    });
});
