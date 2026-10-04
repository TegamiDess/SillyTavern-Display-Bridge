import { getChat } from '../foundation/context.js';

// Visibility is intentionally absent: hiding a source does not rewrite it.
const revisions = new WeakMap();
function revision(message) {
    const fields = [
        message.mes,
        message.name,
        !!message.is_user,
        message.swipe_id ?? 0,
        message.extra?.type ?? '',
    ];
    const cached = revisions.get(message);
    if (cached && fields.every((v, i) => v === cached.fields[i])) {
        return cached.hash;
    }
    const text = JSON.stringify(fields);
    let a = 2166136261,
        b = 5381;
    for (let i = 0; i < text.length; i++) {
        const c = text.charCodeAt(i);
        a = Math.imul(a ^ c, 16777619);
        b = Math.imul(b, 33) ^ c;
    }
    const hash = `${text.length}:${a >>> 0}:${b >>> 0}`;
    revisions.set(message, { fields, hash });
    return hash;
}

/**
 * Build cached content revisions independently of message visibility.
 * @param {ChatMessage[]} [chat] - Current saved history.
 * @returns {Map<string, string>} Revisions keyed by stable source ID.
 */
export function sourceRevisionIndex(chat = getChat()) {
    const index = new Map();
    for (const message of chat) {
        if (typeof message.sc_id === 'string') {
            index.set(message.sc_id, revision(message));
        }
    }
    return index;
}

/**
 * Capture the exact source identities represented by a snippet.
 * @param {SummaryceptionSnippet} snippet - Memory with source IDs.
 * @param {Map<string, string | null>} [index] - Revisions to retain.
 * @returns {Array<[string, string | null]>} Persistable source baseline.
 */
export function captureSnippetSources(snippet, index = sourceRevisionIndex()) {
    return snippet.sourceMessageIds.map((id) => [id, index.get(id) ?? null]);
}

/**
 * Compare saved source provenance without rewriting or dropping memory.
 * @param {SummaryceptionSnippet} snippet - Memory to inspect.
 * @param {Map<string, string>} [index] - Current content revisions.
 * @returns {'unknown'|'current'|'stale'} Review status.
 */
export function snippetFreshness(snippet, index = sourceRevisionIndex()) {
    const saved = snippet.sourceRevisions;
    if (!Array.isArray(saved) || saved.length !== snippet.sourceMessageIds.length) {
        return 'unknown';
    }
    return saved.every(
        (entry, i) =>
            Array.isArray(entry) &&
            entry[0] === snippet.sourceMessageIds[i] &&
            entry[1] !== null &&
            entry[1] === index.get(entry[0]),
    )
        ? 'current'
        : 'stale';
}

// New and explicitly edited snippets get a baseline. Promotions inherit the
// old source revisions so merging cannot accidentally bless stale memory.
/**
 * Add baselines only at the snippet transaction seam.
 * @param {SummaryceptionStore} store - Mutated destination store.
 * @param {SummaryceptionSnippet[][]} previousLayers - Pre-mutation objects.
 * @returns {void}
 */
export function recordSnippetSources(store, previousLayers) {
    const previous = new Set(previousLayers.flat().filter(Boolean));
    const inherited = new Map();
    for (const snippet of previous) {
        for (const entry of Array.isArray(snippet.sourceRevisions) ? snippet.sourceRevisions : []) {
            if (
                Array.isArray(entry) &&
                typeof entry[0] === 'string' &&
                (typeof entry[1] === 'string' || entry[1] === null)
            ) {
                inherited.set(entry[0], entry[1]);
            }
        }
    }
    const current = sourceRevisionIndex();
    for (const snippet of store.layers.flat().filter(Boolean)) {
        if (previous.has(snippet)) {
            continue;
        }
        if (snippet.sourceRevisions) {
            continue;
        }
        const index = snippet.promoted || snippet.fromLayer !== undefined ? inherited : current;
        if (index === inherited && snippet.sourceMessageIds.some((id) => !inherited.has(id))) {
            continue;
        }
        snippet.sourceRevisions = captureSnippetSources(snippet, index);
    }
}
