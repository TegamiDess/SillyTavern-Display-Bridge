import { getChat, getContext } from '../foundation/context.js';
import { resolveScIdsToIndices } from '../foundation/message-identity.js';
import { getChatStore } from '../foundation/state.js';
import { buildPassageFromRangeWithStats } from '../core/chatutils.js';
import { validateSummarizerOutputIntegrity } from '../core/summarizer-output.js';
import { commitSnippetMutation } from '../core/snippet-commit.js';
import { buildSnippetMetadataFromState } from '../core/snippet-metadata.js';
import { parseSnippet } from '../core/summarizer-state.js';
import { callSummarizer } from '../core/summarizer-request.js';
import { beginRun, isBusy } from '../core/summarizer-queue.js';
import { withUsageRun } from '../core/summarizer-usage.js';
import { buildSnapshotBasis, isSnapshotStoreCurrent } from '../core/summarizer-snapshot.js';
import { captureSnippetSources, sourceRevisionIndex } from '../core/snippet-freshness.js';
import { isPromptMutationFrozen } from '../core/summarizer-commit.js';

/**
 * @typedef {{ status: 'ready', snippet: SummaryceptionSnippet, range: [number, number], context?: string }} RegenerationTarget
 * @typedef {{ status: 'missing' } | { status: 'unsupported' } | { status: 'busy' }} RegenerationUnavailable
 * @typedef {{ status: 'regenerated', range: [number, number] } | { status: 'empty-source' } | { status: 'unsupported' } | { status: 'failed' } | { status: 'aborted' } | { status: 'blocked' }} RegenerationRunResult
 * @typedef {{ status: 'regenerated', range: [number, number] } | { status: 'missing' | 'unsupported' | 'busy' | 'empty-source' | 'failed' | 'aborted' | 'blocked' }} RegenerateSnippetResult
 */

/**
 * @param {number} layerIndex
 * @param {number} snippetIndex
 * @returns {{ status: 'found', text: string } | { status: 'missing', text: '' }}
 */
export function getSnippetTextAt(layerIndex, snippetIndex) {
    const snippet = getSnippetAt(getChatStore(), layerIndex, snippetIndex);
    if (!snippet) {
        return { status: 'missing', text: '' };
    }
    return { status: 'found', text: snippet.text };
}

/**
 * @param {number} layerIndex
 * @param {number} snippetIndex
 * @returns {RegenerationTarget | RegenerationUnavailable}
 */
export function getSnippetRegenerationTarget(layerIndex, snippetIndex) {
    return resolveRegenerationTarget(getChatStore(), getChat(), { layerIndex, snippetIndex });
}

/**
 * True for a contiguous Layer 0 source range. Also true while
 * summarization is busy, so the caller can report the busy status.
 * @param {number} layerIndex
 * @param {number} snippetIndex
 * @returns {boolean}
 */
export function isRegenerationCandidate(layerIndex, snippetIndex) {
    const target = resolveRegenerationTarget(
        getChatStore(),
        getChat(),
        { layerIndex, snippetIndex },
        {
            includeContext: false,
        },
    );
    return target.status === 'ready' || target.status === 'busy';
}

/**
 * @param {number} layerIndex
 * @param {number} snippetIndex
 * @param {string} text
 * @returns {Promise<{ status: 'updated' | 'missing' | 'empty' | 'unchanged' }>}
 */
export async function updateSnippetTextAt(layerIndex, snippetIndex, text) {
    const store = getChatStore();
    const snippet = getSnippetAt(store, layerIndex, snippetIndex);
    if (!snippet) {
        return { status: 'missing' };
    }

    const newText = String(text).trim();
    if (!newText) {
        return { status: 'empty' };
    }
    if (newText === snippet.text) {
        return { status: 'unchanged' };
    }

    await commitSnippetMutation(store, () => {
        snippet.text = newText;
        snippet.sourceRevisions = captureSnippetSources(snippet);
        if (layerIndex === 0) {
            Object.assign(snippet, buildSnippetMetadataFromState(parseSnippet(newText).state));
        }
    });
    return { status: 'updated' };
}

/**
 * Deletion also repairs any Layer 0 ghosting ownership.
 * @param {number} layerIndex
 * @param {number} snippetIndex
 * @returns {Promise<{ status: 'deleted', layerIndex: number } | { status: 'missing' }>}
 */
export async function deleteSnippetAt(layerIndex, snippetIndex) {
    const store = getChatStore();
    const layer = store.layers[layerIndex];
    if (!layer || !layer[snippetIndex]) {
        return { status: 'missing' };
    }

    await commitSnippetMutation(store, () => {
        layer.splice(snippetIndex, 1);
    });
    return { status: 'deleted', layerIndex };
}

/**
 * @param {number} layerIndex
 * @param {number} snippetIndex
 * @param {import('../core/notify.js').NotifyAdapter} [notify] - Adapter for regeneration notices; absent runs stay silent.
 * @returns {Promise<RegenerateSnippetResult>}
 */
export async function regenerateSnippetAt(layerIndex, snippetIndex, notify) {
    const target = resolveRegenerationTarget(getChatStore(), getChat(), {
        layerIndex,
        snippetIndex,
    });
    if (target.status !== 'ready') {
        return target;
    }

    const run = beginRun('regeneration');
    try {
        return await withUsageRun('snippet regeneration', async () => {
            return await regenerateSnippetWithTarget(target, notify);
        });
    } finally {
        run.end();
    }
}

/**
 * @param {RegenerationTarget} target
 * @param {import('../core/notify.js').NotifyAdapter} [notify] - Adapter for regeneration notices.
 * @returns {Promise<RegenerationRunResult>}
 */
async function regenerateSnippetWithTarget(target, notify) {
    const chat = getChat();
    const store = getChatStore();
    const basis = buildSnapshotBasis({ chatRef: chat, store, ctx: getContext() });
    const capturedSources = JSON.stringify(captureSnippetSources(target.snippet));
    const passage = await buildSnippetRegenerationPassage(target);
    if (!passage.text.trim()) {
        return { status: 'empty-source' };
    }

    const outcome = await callSummarizer(
        passage.text,
        /** @type {string} */ (target.context),
        {
            kind: 'regenerate',
            sourceRange: target.range,
            regexStats: passage.stats,
        },
        notify,
    );

    if (outcome.status !== 'completed') {
        return { status: outcome.status };
    }
    const newSummary = /** @type {string} */ (outcome.text);
    const integrityResult = validateSummarizerOutputIntegrity(newSummary, {
        kind: 'regenerate',
        sourceRange: target.range,
        regexStats: passage.stats,
    });
    if (!integrityResult.valid) {
        return { status: 'failed' };
    }
    if (
        !isSnapshotStoreCurrent(basis, getContext(), getChatStore()) ||
        !store.layers.some((layer) => layer.includes(target.snippet)) ||
        JSON.stringify(captureSnippetSources(target.snippet, sourceRevisionIndex())) !==
            capturedSources
    ) {
        return { status: 'aborted' };
    }
    // Manual regeneration is an explicit action: if the user began generating
    // meanwhile, leave the existing summary alone and let them retry.
    if (isPromptMutationFrozen()) {
        return { status: 'blocked' };
    }

    await commitSnippetMutation(getChatStore(), () => {
        target.snippet.text = newSummary;
        target.snippet.timestamp = Date.now();
        target.snippet.regenerated = true;
        target.snippet.sourceRevisions = captureSnippetSources(target.snippet);
        Object.assign(
            target.snippet,
            buildSnippetMetadataFromState(parseSnippet(newSummary).state),
        );
    });
    return { status: 'regenerated', range: target.range };
}

/**
 * Build a source passage without lifting hidden flags on the saved chat.
 * @param {RegenerationTarget} target - Validated owned source range.
 * @returns {Promise<import('../core/chatutils.js').PassageWithStats>} Passage and token statistics.
 */
export async function buildSnippetRegenerationPassage(target) {
    const sourceIds = new Set(target.snippet.sourceMessageIds);
    const ownedIds = new Set(getChatStore().ghostedMessageIds);
    const passageChat = getChat().map((m) =>
        typeof m.sc_id === 'string' &&
        sourceIds.has(m.sc_id) &&
        ownedIds.has(m.sc_id) &&
        !m.extra?.type
            ? { ...m, is_system: false, is_hidden: false }
            : m,
    );
    return await buildPassageFromRangeWithStats(passageChat, ...target.range);
}

/**
 * Single source of truth for regeneration targets, shared by the UI check
 * and the regeneration runner. A target is ready only for a contiguous
 * Layer 0 source range while no summarization is running.
 * @param {SummaryceptionStore} store
 * @param {ChatMessage[]} chat
 * @param {{ layerIndex: number, snippetIndex: number }} position
 * @param {{ includeContext?: boolean }} [options] - Skip context building for status-only callers.
 * @returns {RegenerationTarget | RegenerationUnavailable}
 */
function resolveRegenerationTarget(store, chat, position, { includeContext = true } = {}) {
    const { layerIndex, snippetIndex } = position;
    const snippet = getSnippetAt(store, layerIndex, snippetIndex);
    if (!snippet) {
        return { status: 'missing' };
    }
    const indices = Array.isArray(snippet.sourceMessageIds)
        ? resolveScIdsToIndices(chat, snippet.sourceMessageIds)
        : [];
    if (
        layerIndex !== 0 ||
        indices.length === 0 ||
        indices[indices.length - 1] - indices[0] + 1 !== indices.length
    ) {
        return { status: 'unsupported' };
    }
    if (isBusy()) {
        return { status: 'busy' };
    }

    return {
        status: 'ready',
        snippet,
        range: /** @type {[number, number]} */ ([indices[0], indices[indices.length - 1]]),
        ...(includeContext
            ? { context: buildSnippetContext(store, layerIndex, snippetIndex) }
            : {}),
    };
}

function getSnippetAt(store, layerIndex, snippetIndex) {
    if (!Number.isInteger(layerIndex) || !Number.isInteger(snippetIndex)) {
        return null;
    }
    return store.layers[layerIndex]?.[snippetIndex] || null;
}

function buildSnippetContext(store, excludeLayerIndex, excludeSnippetIndex) {
    const contextParts = [];
    for (let i = store.layers.length - 1; i >= 0; i--) {
        const layer = store.layers[i];
        if (!layer) {
            continue;
        }
        collectLayerContext({
            contextParts,
            layer,
            layerIndex: i,
            excludeLayerIndex,
            excludeSnippetIndex,
        });
    }
    return contextParts.length > 0 ? contextParts.join(' ') : '(none yet)';
}

function collectLayerContext({
    contextParts,
    layer,
    layerIndex,
    excludeLayerIndex,
    excludeSnippetIndex,
}) {
    for (let i = 0; i < layer.length; i++) {
        if (layerIndex === excludeLayerIndex && i === excludeSnippetIndex) {
            continue;
        }
        contextParts.push(layer[i].text);
    }
}
