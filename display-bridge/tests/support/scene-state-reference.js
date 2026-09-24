// DESIGN REFERENCE ONLY. Not imported by the extension. This models transactions,
// not an ST persistence adapter, imported-trigger evaluator or production validator.
import {isDeepStrictEqual} from 'node:util';
const clone = value => structuredClone(value);
const fail = message => { throw Error(message); };
const keyOK = key => typeof key === 'string' && /^[a-z][\w.-]{0,127}$/i.test(key)
    && !['__proto__', 'prototype', 'constructor'].includes(key);

export function createSceneStateReference(owner, defaults, saved) {
    if (!Array.isArray(owner) || owner.length !== 3 || !owner.every(x => typeof x === 'string' && x)) fail('owner');
    const identity = JSON.stringify(owner); // character generation, stable chat, state-schema fingerprint
    const initial = clone(defaults);
    for (const [key, value] of Object.entries(initial)) {
        if (!keyOK(key) || !(value === null || typeof value === 'boolean' || typeof value === 'string'
            || typeof value === 'number' && Number.isFinite(value))) fail('default');
    }
    const records = new Map();
    let head = null, pending = null;
    function apply(state, updates) {
        if (!Array.isArray(updates) || updates.length > 256) fail('updates');
        for (const update of updates) {
            if (!update || Object.keys(update).some(k => !['op', 'key', 'value'].includes(k))
                || !keyOK(update.key) || !Object.hasOwn(initial, update.key)) fail('unknown state key');
            if (update.op === 'assign') {
                const value = update.value, base = initial[update.key];
                if (!(value === null || typeof value === 'boolean' || typeof value === 'string'
                    || typeof value === 'number' && Number.isFinite(value))) fail('value');
                if (base !== null && value !== null && typeof value !== typeof base) fail('type');
                state[update.key] = value;
            } else if (update.op === 'delta') {
                if (typeof state[update.key] !== 'number' || !Number.isFinite(update.value)) fail('unknown numeric base');
                state[update.key] += update.value;
                if (!Number.isFinite(state[update.key])) fail('overflow');
            } else fail('unsupported operation');
        }
        return state;
    }
    function view(at = head) {
        const chain = [], seen = new Set();
        while (at !== null) {
            if (!records.has(at) || seen.has(at)) fail('invalid ancestry');
            seen.add(at);
            const record = records.get(at); chain.push(record); at = record.parent;
        }
        const result = clone(initial);
        for (const record of chain.reverse()) apply(result, record.updates);
        return result;
    }
    function add(record) {
        if (!record || Object.keys(record).some(k => !['id', 'parent', 'updates', 'scene'].includes(k)) || !keyOK(record.id)
            || !(record.parent === null || records.has(record.parent))) fail('record');
        apply(view(record.parent), record.updates); // validate privately before any mutation
        if (records.has(record.id)) {
            if (!isDeepStrictEqual(records.get(record.id), record)) fail('event collision');
            return false;
        }
        records.set(record.id, clone(record)); return true;
    }
    if (saved) {
        if (saved.version !== 1 || saved.owner !== identity || !isDeepStrictEqual(saved.defaults, initial)) fail('incompatible state');
        for (const record of saved.records) add(record);
        view(saved.head); head = saved.head;
    }
    return {
        view,
        select(id) { view(id); head = id; pending = null; },
        begin(attempt, parent = head) {
            if (!keyOK(attempt)) fail('attempt');
            view(parent); pending = {attempt, parent, previous: head, scene: null};
        },
        preview(attempt, scene) {
            if (pending?.attempt !== attempt) fail('stale attempt');
            pending.scene = clone(scene); // no updates or media, even for a complete scene
        },
        visibleScene() { return clone(pending ? pending.scene : records.get(head)?.scene ?? null); },
        commit(attempt, record) {
            if (!pending) {
                if (records.has(record.id) && isDeepStrictEqual(records.get(record.id), record)) return false;
                fail('stale attempt');
            }
            if (pending.attempt !== attempt || pending.parent !== record.parent) fail('stale attempt');
            add(record); head = record.id; pending = null; return true;
        },
        fail(attempt) {
            if (pending?.attempt !== attempt) fail('stale attempt');
            head = pending.previous; pending = null;
        },
        save() { return clone({version: 1, owner: identity, defaults: initial, head, records: [...records.values()]}); },
    };
}
