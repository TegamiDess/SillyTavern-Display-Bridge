import { getContext } from '../foundation/context.js';
import { describeAutoWork } from '../core/summarization-routes.js';
import { getEffectiveMemoryUsage } from '../core/memory-budget.js';

const identities = new WeakMap();
let nextIdentity = 0;
function identity(value) {
    if (typeof value !== 'function' && (typeof value !== 'object' || value === null)) {
        return value;
    }
    if (!identities.has(value)) {
        identities.set(value, ++nextIdentity);
    }
    return identities.get(value);
}
function containsEstimate(value) {
    return (
        value &&
        typeof value === 'object' &&
        Object.entries(value).some(
            ([key, item]) =>
                (key.toLowerCase().endsWith('estimated') && item === true) ||
                containsEstimate(item),
        )
    );
}

/**
 * A bounded display-only cache. Engine planning and prompt injection never use it.
 * @returns {{read: Function, clear: Function, stats: Function}} Cache controls.
 */
export function createDisplayCalculationCache() {
    const entries = new Map();
    let hits = 0,
        builds = 0;
    return {
        read(kind, identity, key, build) {
            const reusable = key !== null;
            const previous = entries.get(kind);
            if (reusable && previous?.identity === identity && previous.key === key) {
                hits++;
                return previous.promise;
            }
            builds++;
            const entry = { identity, key, promise: /** @type {Promise<any> | null} */ (null) };
            entry.promise = Promise.resolve()
                .then(build)
                .then(
                    (value) => {
                        // Failed tokenizer lookups may recover; don't retain estimates.
                        if (containsEstimate(value)) {
                            if (entries.get(kind) === entry) {
                                entries.delete(kind);
                            }
                        }
                        return value;
                    },
                    (error) => {
                        if (entries.get(kind) === entry) {
                            entries.delete(kind);
                        }
                        throw error;
                    },
                );
            if (reusable) {
                entries.set(kind, entry);
                if (entries.size > 3) {
                    entries.delete(entries.keys().next().value);
                }
            }
            return entry.promise;
        },
        clear() {
            entries.clear();
        },
        stats() {
            return { hits, builds, entries: entries.size };
        },
    };
}

const cache = createDisplayCalculationCache();

/**
 * Clear display estimates after host settings/tokenizer changes.
 * @returns {void}
 */
export function invalidateUICalculations() {
    cache.clear();
}

/**
 * Read cache counters without exposing chat or prompt contents.
 * @returns {{hits:number, builds:number, entries:number}} Display diagnostics.
 */
export function getUICalculationStats() {
    return cache.stats();
}

/**
 * Capture immutable display inputs. Message token memo fields are excluded.
 * @param {ChatMessage[]} chat - Active history.
 * @param {SummaryceptionStore} store - Active memory.
 * @param {ExtensionSettings} settings - Effective options.
 * @returns {object} Snapshot shared by Easy/Advanced/Memory displays.
 */
export function captureUIInputs(chat, store, settings) {
    const ctx = getContext();
    const host = /** @type {any} */ (ctx);
    const tokenizer = JSON.stringify([
        host.chatId,
        identity(host.getTokenCountAsync),
        host.mainApi,
        host.chatCompletionSettings,
        host.textCompletionSettings,
        host.powerUserSettings,
    ]);
    const memoryKey = JSON.stringify([
        tokenizer,
        settings.injectCurrentState,
        settings.injectionTemplate,
        store.mutationEpoch,
        store.layers,
        chat.map((m) => m.sc_id),
    ]);
    const needsWork = settings.enabled;
    const messages = needsWork
        ? chat.map((m) => ({
              mes: m.mes,
              name: m.name,
              is_user: m.is_user,
              is_system: m.is_system,
              is_hidden: m.is_hidden,
              sc_id: m.sc_id,
              swipe_id: m.swipe_id,
              extra: { type: m.extra?.type },
          }))
        : [];
    // UI complexity is not an input to the calculation, so both views reuse it.
    const { uiMode: _uiMode, configMode: _configMode, ...calculationSettings } = settings;
    const workKey = needsWork
        ? JSON.stringify([tokenizer, calculationSettings, messages, store])
        : '';
    return {
        chat,
        store,
        ctxId: host.chatId,
        tokenizerFn: host.getTokenCountAsync,
        memoryKey,
        workKey,
        settings: { ...settings },
        messages,
        layers: structuredClone(store.layers),
        storeCopy: structuredClone(store),
    };
}

/**
 * Load the expensive values only when the active display needs them.
 * @param {ReturnType<typeof captureUIInputs>} inputs - Captured inputs.
 * @param {boolean} needMemory - Whether a memory budget/preview is visible.
 * @returns {Promise<{work:any, memory:any}>} Display values.
 */
export async function calculateUIValues(inputs, needMemory) {
    const work = inputs.settings.enabled
        ? cache.read(
              'work',
              inputs.chat,
              inputs.settings.applyRegexScripts ? null : inputs.workKey,
              () =>
                  describeAutoWork(
                      inputs.settings.applyRegexScripts ? inputs.chat : inputs.messages,
                      inputs.storeCopy,
                      inputs.settings,
                  ),
              // Regex scripts may depend on external macros/preset state. Their
              // work plan is deliberately recalculated rather than cached blindly.
          )
        : Promise.resolve(null);
    const memory = needMemory
        ? cache.read('memory', inputs.chat, inputs.memoryKey, () =>
              getEffectiveMemoryUsage(inputs.layers, inputs.settings),
          )
        : Promise.resolve(null);
    const [workValue, memoryValue] = await Promise.all([
        work.catch(() => null),
        memory.catch(() => null),
    ]);
    return { work: workValue, memory: memoryValue };
}

/**
 * Prevent an async calculation for a previous chat/settings revision painting UI.
 * @param {ReturnType<typeof captureUIInputs>} before - Starting inputs.
 * @param {ReturnType<typeof captureUIInputs>} after - Current inputs.
 * @returns {boolean} Whether results still describe the current display.
 */
export function sameUIInputs(before, after) {
    return (
        before.chat === after.chat &&
        before.store === after.store &&
        before.ctxId === after.ctxId &&
        before.tokenizerFn === after.tokenizerFn &&
        before.memoryKey === after.memoryKey &&
        before.workKey === after.workKey &&
        before.settings.uiMode === after.settings.uiMode &&
        before.settings.configMode === after.settings.configMode
    );
}
