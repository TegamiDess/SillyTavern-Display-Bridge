import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    installSummaryContext,
    makeMessage,
    makeSummarySettings,
    makeSummaryStore,
} from './test-helpers.js';
import {
    captureUIInputs,
    calculateUIValues,
    sameUIInputs,
    createDisplayCalculationCache,
    invalidateUICalculations,
    getUICalculationStats,
} from '../src/entry/ui-calculations.js';
import { getEffectiveMemoryUsage } from '../src/core/memory-budget.js';
import { describeAutoWork } from '../src/core/summarization-routes.js';

beforeEach(invalidateUICalculations);
function setup() {
    const token = vi.fn(async (text) => (text.includes('pear') ? 23 : 17));
    const ctx = installSummaryContext({
        chat: [
            makeMessage({ mes: 'A book', scId: 'a' }),
            makeMessage({ mes: 'Another book', scId: 'b' }),
        ],
        getTokenCountAsync: token,
    });
    const store = makeSummaryStore({ layers: [[{ text: 'apple', sourceMessageIds: ['a'] }]] });
    const settings = makeSummarySettings({ enabled: false, uiMode: 'off', configMode: 'advanced' });
    return {
        ctx,
        store,
        settings,
        token,
        capture: () => captureUIInputs(ctx.chat, store, settings),
    };
}
describe('display-only calculations', () => {
    it('Off skips history planning and token counts, while explicit Memory review remains available', async () => {
        const t = setup();
        await calculateUIValues(t.capture(), false);
        expect(t.token).not.toHaveBeenCalled();
        const result = await calculateUIValues(t.capture(), true);
        expect(t.token).toHaveBeenCalled();
        expect(result.work).toBeNull();
        expect(result.memory.text).toContain('apple');
    });
    it('reuses memory accounting across Easy/Advanced and previews without changing prompts or saved messages', async () => {
        const t = setup(),
            before = JSON.stringify(t.ctx.chat);
        const one = await calculateUIValues(t.capture(), true);
        const calls = t.token.mock.calls.length;
        t.settings.configMode = 'easy';
        const two = await calculateUIValues(t.capture(), true);
        expect(two.memory).toBe(one.memory);
        expect(t.token).toHaveBeenCalledTimes(calls);
        expect(two.memory).toEqual(await getEffectiveMemoryUsage(t.store.layers, t.settings));
        expect(JSON.stringify(t.ctx.chat)).toBe(before);
    });
    it.each(['text', 'template', 'state', 'ids', 'model', 'tokenizer', 'epoch'])(
        'invalidates memory accounting when %s changes',
        async (kind) => {
            const t = setup();
            await calculateUIValues(t.capture(), true);
            const count = t.token.mock.calls.length;
            if (kind === 'text') t.store.layers[0][0].text = 'pears';
            if (kind === 'template') t.settings.injectionTemplate = 'Memory: {{summary}}';
            if (kind === 'state') t.settings.injectCurrentState = true;
            if (kind === 'ids') t.ctx.chat.unshift(makeMessage({ mes: 'New turn', scId: 'new' }));
            if (kind === 'model') t.ctx.chatCompletionSettings = { openai_model: 'changed' };
            if (kind === 'tokenizer') t.ctx.getTokenCountAsync = async (s) => t.token(s);
            if (kind === 'epoch') t.store.mutationEpoch++;
            const result = await calculateUIValues(t.capture(), true);
            expect(t.token.mock.calls.length).toBeGreaterThan(count);
            expect(result.memory).toEqual(
                await getEffectiveMemoryUsage(t.store.layers, t.settings),
            );
        },
    );
    it('shares enabled planning across views and rejects same-length source changes; core memo fields remain untouched', async () => {
        const t = setup();
        t.settings.enabled = true;
        t.settings.uiMode = 'easy';
        const original = JSON.stringify(t.ctx.chat);
        const first = await calculateUIValues(t.capture(), true);
        const count = t.token.mock.calls.length;
        t.settings.uiMode = 'advanced';
        await calculateUIValues(t.capture(), true);
        expect(t.token).toHaveBeenCalledTimes(count);
        const old = t.capture();
        t.ctx.chat[1].mes = 'pear'.padEnd(t.ctx.chat[1].mes.length, '!');
        expect(sameUIInputs(old, t.capture())).toBe(false);
        const next = await calculateUIValues(t.capture(), true);
        expect(next.work).not.toEqual(first.work);
        expect(next.work).toEqual(
            await describeAutoWork(t.capture().messages, t.store, t.settings),
        );
        expect(t.ctx.chat.every((m) => !m.extra.sc_token_count)).toBe(true);
        expect(JSON.parse(original)[0]).toEqual(t.ctx.chat[0]);
    });
    it('does not reuse work plans across arbitrary regex macros', async () => {
        const t = setup();
        t.settings.enabled = true;
        t.settings.applyRegexScripts = true;
        await calculateUIValues(t.capture(), false);
        const count = getUICalculationStats().builds;
        await calculateUIValues(t.capture(), false);
        expect(getUICalculationStats().builds).toBe(count + 1);
    });
    it('rejects an old asynchronous UI result after chat/settings changes', () => {
        const t = setup(),
            old = t.capture();
        t.ctx.chat = [...t.ctx.chat];
        expect(sameUIInputs(old, t.capture())).toBe(false);
    });
    it('deduplicates in-flight work and retries failures and estimates', async () => {
        const c = createDisplayCalculationCache(),
            identity = {},
            build = vi.fn(async () => ({ total: { count: 2, estimated: false } }));
        await Promise.all([
            c.read('memory', identity, 'key', build),
            c.read('memory', identity, 'key', build),
        ]);
        expect(build).toHaveBeenCalledTimes(1);
        const fail = vi.fn(async () => {
            throw Error('temporary');
        });
        await expect(c.read('memory', identity, 'bad', fail)).rejects.toThrow();
        await expect(c.read('memory', identity, 'bad', fail)).rejects.toThrow();
        expect(fail).toHaveBeenCalledTimes(2);
        const estimate = vi.fn(async () => ({ verbatimEstimated: true }));
        await c.read('work', identity, 'e', estimate);
        await c.read('work', identity, 'e', estimate);
        expect(estimate).toHaveBeenCalledTimes(2);
        for (let i = 0; i < 10; i++) await c.read('slot' + i, identity, 'key', build);
        expect(c.stats().entries).toBeLessThanOrEqual(3);
    });
});
