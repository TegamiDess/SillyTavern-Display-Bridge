import {
    MEMORY_MODES,
    MEMORY_POSITIONS,
    UI_MODES,
    layerLabel,
    listNonEmptyLayers,
} from '../foundation/constants.js';
import { getChat } from '../foundation/context.js';
import { warn } from '../foundation/logger.js';
import {
    getEffectiveSettings,
    getSettings,
    getChatStore,
    getCurrentSummarizedBoundary,
} from '../foundation/state.js';
import { countGhostedMessages } from '../core/ghosting.js';
import { isBusy } from '../core/summarizer-queue.js';
import { formatCompactTokenCount } from '../core/token-count.js';

import { estimateContextPreview } from '../core/token-budget.js';
import { syncAllSettingsToDOM, syncRoleMaskModeControl } from './ui-bind.js';
import { updateSnippetBrowser } from './ui-snippets.js';
import { syncConnectionPanels } from './ui-connection.js';
import {
    buildContextBudgetViewModel,
    buildTriggerGaugeModel,
    formatBudgetTokenLabel,
    getContextColorClass,
} from './ui-view-models.js';

import { setShown, setText, setValue } from './ui-dom.js';
import { createUIRefreshQueue } from './ui-refresh.js';
import { captureUIInputs, calculateUIValues, sameUIInputs } from './ui-calculations.js';

const CONTEXT_COLOR_CLASSES = 'sc-ctx-safe sc-ctx-warn sc-ctx-caution sc-ctx-danger';

/**
 * Re-render the entire Summaryception UI from current settings and chat store.
 * @returns {Promise<void>}
 */
export const updateUI = createUIRefreshQueue(renderUI);

let visibilityObserver;

/** Wake the deferred UI when the host drawer or extension drawer opens. */
export function initUIVisibility() {
    visibilityObserver?.disconnect();
    const content = $('.sc-settings > .inline-drawer > .inline-drawer-content')[0];
    if (!content) {
        return;
    }
    let wasVisible = false;
    visibilityObserver = new ResizeObserver(() => {
        const visible = $(content).is(':visible');
        if (visible && !wasVisible) {
            void updateUI();
        }
        wasVisible = visible;
    });
    visibilityObserver.observe(content);
}

async function renderUI() {
    try {
        // One layout read before any writes. No planning/token counting while closed.
        if (!$('.sc-settings > .inline-drawer > .inline-drawer-content').is(':visible')) {
            return;
        }
        const s = getSettings();
        const effectiveSettings = getEffectiveSettings();
        const store = getChatStore();

        syncSettingsInputs(s, effectiveSettings);
        syncEnabledContent(s);

        syncRoleMaskModeControl(s.maskUserRoleAsAssistant);
        // alwaysOn category: markup disables the input, so show it as
        // permanently ticked. The persisted flag for this category is ignored.
        $('#sc_state_cat_date_time').prop('checked', true);
        const complexity = s.uiMode === UI_MODES.OFF ? s.configMode || UI_MODES.EASY : s.uiMode;
        const tab = $('.sc-tab-button.active').attr('data-sc-tab');
        const inputs = captureUIInputs(getChat(), store, effectiveSettings);
        const needMemory =
            complexity === UI_MODES.EASY
                ? effectiveSettings.enabled
                : tab === 'memory' || (tab === 'status' && effectiveSettings.enabled);
        const { work, memory } = await calculateUIValues(inputs, needMemory);
        if (
            !sameUIInputs(
                inputs,
                captureUIInputs(getChat(), getChatStore(), getEffectiveSettings()),
            ) ||
            tab !== $('.sc-tab-button.active').attr('data-sc-tab')
        ) {
            void updateUI();
            return;
        }
        const ghostedCount = countGhostedMessages();
        const metrics = {
            totalSnippets: listNonEmptyLayers(store).reduce((n, { layer }) => n + layer.length, 0),
        };

        const overview = { settings: effectiveSettings, work, ghostedCount, metrics };
        if (complexity === UI_MODES.EASY) {
            await renderStatusOverview('sc_easy_status', 'mode', overview);
            if (effectiveSettings.enabled) {
                await renderMemoryBudget(effectiveSettings, memory, 'easy_memory');
            } else {
                renderOffBudgets(['easy_memory']);
            }
        } else {
            await renderStatusOverview('sc_status', 'enabled', overview);
            if (tab === 'status') {
                if (effectiveSettings.enabled) {
                    await renderBudgetStatus(effectiveSettings, memory, work);
                } else {
                    renderOffBudgets(['verbatim', 'trigger', 'memory']);
                }
            }
            if (tab === 'memory') {
                renderLayerStats(effectiveSettings, store, ghostedCount);
                renderPreview(memory);
                updateSnippetBrowser();
            }
        }
    } catch (e) {
        warn('updateUI error:', e);
    }
}

/**
 * Sync all static settings inputs from the settings object.
 * @param {ReturnType<typeof getSettings>} s
 * @param {ReturnType<typeof getEffectiveSettings>} effectiveSettings
 * @returns {void}
 */
function syncSettingsInputs(s, effectiveSettings) {
    syncAllSettingsToDOM(s);
    syncEasyPayloadSchematic(effectiveSettings);
    syncMemoryModeControls(s);
    syncLLMContextPreview(s);
    syncConnectionPanels(s);
}

function syncEnabledContent(s) {
    // Off shows the banner and keeps the complexity panel (from configMode)
    // visible, so configuration stays editable while the extension is off.
    const off = s.uiMode === UI_MODES.OFF;
    const complexity = off ? s.configMode || UI_MODES.EASY : s.uiMode;
    setShown($('#sc_off_content'), off);
    setShown($('#sc_easy_content'), complexity === UI_MODES.EASY);
    setShown($('#sc_enabled_content'), complexity === UI_MODES.ADVANCED);
    // Stop sets the autoPaused latch. Show Resume while paused so users can
    // continue without re-triggering automatic work.
    const paused = Boolean(s.autoPaused);
    setShown($('#sc_stop_summarize, #sc_easy_stop_summarize'), s.enabled && !paused);
    setShown($('#sc_resume_summarize, #sc_easy_resume_summarize'), s.enabled && paused);
}

function syncEasyPayloadSchematic(s = getEffectiveSettings()) {
    setText($('#sc_easy_payload_memory_budget'), formatBudgetTokenLabel(s.memoryTokenBudget));
    setText($('#sc_easy_payload_verbatim_budget'), formatBudgetTokenLabel(s.verbatimTokenBudget));
    setText($('#sc_easy_payload_queued_budget'), formatBudgetTokenLabel(s.queuedTokenBudget));
}

/**
 * Sync the request-context preview lines from the shared core estimator.
 * @param {ReturnType<typeof getSettings>} [s]
 * @returns {void}
 */
export function syncLLMContextPreview(s = getEffectiveSettings()) {
    const model = estimateContextPreview(s);
    const $mainValue = $('#sc_llm_context_main');
    const $l0Value = $('#sc_llm_context_l0');
    const $l1Value = $('#sc_llm_context_l1');
    setText(
        $mainValue,
        `${formatCompactTokenCount(model.mainMin)} → ${formatCompactTokenCount(model.mainMax)} + ST prompt`,
    );
    setText(
        $l0Value,
        `~${formatCompactTokenCount(model.l0Typical)} (Max ~${formatCompactTokenCount(model.l0Max)})`,
    );
    setText($l1Value, `Max ~${formatCompactTokenCount(model.l1Total)} tokens`);
    setContextValueColor($mainValue, model.mainMax);
    setContextValueColor($l0Value, model.l0Typical);
    setContextValueColor($l1Value, model.l1Total);
}

function setContextValueColor($element, tokens) {
    const color = getContextColorClass(tokens);
    if (!$element.hasClass(color)) {
        $element.removeClass(CONTEXT_COLOR_CLASSES).addClass(color);
    }
}

async function renderStatusOverview(prefix, modeField, overview) {
    const { settings: s, work, ghostedCount, metrics } = overview;
    setText($(`#${prefix}_${modeField}`), getModeLabel(s));
    setText($(`#${prefix}_worker`), await getWorkerLabel(s, work));
    setText($(`#${prefix}_snippets`), String(metrics.totalSnippets));
    setText($(`#${prefix}_ghosted`), String(ghostedCount));
}

function getModeLabel(s) {
    if (s.uiMode === UI_MODES.EASY) {
        return 'Easy';
    }
    if (s.uiMode === UI_MODES.ADVANCED) {
        return 'Advanced';
    }
    return 'Off';
}

/**
 * Build the worker status label from the auto work read model.
 * @param {ReturnType<typeof getEffectiveSettings>} s
 * @param {import('../core/summarization-routes.js').AutoWorkReadModel | null} work
 * @returns {Promise<string>}
 */
async function getWorkerLabel(s, work) {
    if (isBusy()) {
        return 'Running';
    }
    if (!s.enabled) {
        return 'Off';
    }

    const backlogCount = work?.ready ? work.backlog : 0;
    return backlogCount > 0 ? `Backlog ${backlogCount}` : 'Idle';
}

function syncMemoryModeControls(s) {
    const isPrefixCache = s.memoryMode === MEMORY_MODES.PREFIX_CACHE;
    const isMacroOnly = s.customMemoryPosition === MEMORY_POSITIONS.MACRO_ONLY;
    setShown($('#sc_custom_memory_depth_row'), s.customMemoryPosition === MEMORY_POSITIONS.IN_CHAT);
    setShown($('#sc_custom_memory_role_row'), !isMacroOnly);
    setShown($('#sc_macro_memory_note'), isMacroOnly);
    setShown($('#sc_memory_help_balanced'), s.memoryMode === MEMORY_MODES.BALANCED);
    setShown($('#sc_memory_help_prefix_cache'), isPrefixCache);
    setShown($('#sc_manual_cache_warning'), isPrefixCache);
    setShown($('.sc-cache-mode-row'), isPrefixCache);
}

async function renderBudgetStatus(s, usage, work) {
    await renderVerbatimBudget(s, work);
    await renderTriggerGauge(s, work);
    await renderMemoryBudget(s, usage);
}

/**
 * Render a context budget card into the `#sc_<prefix>_budget_{total,bar,legend}`
 * selector triple, clearing it when the view model cannot be built.
 * @param {string} prefix
 * @param {Function} build - Returns the buildContextBudgetViewModel inputs.
 * @returns {Promise<void>}
 */
async function renderBudgetCard(prefix, build) {
    const total = `#sc_${prefix}_budget_total`;
    const bar = `#sc_${prefix}_budget_bar`;
    const legend = `#sc_${prefix}_budget_legend`;
    try {
        renderBudgetView(buildContextBudgetViewModel(await build()), { total, bar, legend });
    } catch (e) {
        warn(`${prefix} budget render error:`, e);
        clearBudgetView(total, bar, legend);
    }
}

/**
 * Render the verbatim budget card from the auto work read model.
 * @param {ReturnType<typeof getEffectiveSettings>} s
 * @param {import('../core/summarization-routes.js').AutoWorkReadModel | null} work
 * @returns {Promise<void>}
 */
async function renderVerbatimBudget(s, work) {
    await renderBudgetCard('verbatim', () => {
        if (!work) {
            throw new Error('Summary work read model unavailable');
        }
        return {
            budget: s.verbatimTokenBudget,
            verbatim: {
                label: 'Recent Chat',
                kind: 'verbatim',
                count: work.verbatimTokens,
                estimated: work.verbatimEstimated,
            },
            layers: [],
        };
    });
}

/**
 * Render the queued-chat trigger gauge from the auto work read model.
 * @param {ReturnType<typeof getEffectiveSettings>} s
 * @param {import('../core/summarization-routes.js').AutoWorkReadModel | null} work
 * @returns {Promise<void>}
 */
async function renderTriggerGauge(s, work) {
    await renderBudgetCard('trigger', () => {
        if (!work) {
            throw new Error('Summary work read model unavailable');
        }
        const model = buildTriggerGaugeModel(work, s);
        return {
            budget: model.triggerTokens,
            verbatim: {
                label: 'Queued',
                kind: 'pending',
                count: model.queuedTokens,
                estimated: model.queuedEstimated,
            },
            layers: [],
            marker: { positionTokens: model.triggerTokens, label: model.label },
        };
    });
}

async function renderMemoryBudget(s, usage, prefix = 'memory') {
    await renderBudgetCard(prefix, async () => {
        return {
            budget: s.memoryTokenBudget,
            verbatim: { label: 'Live Chat', kind: 'verbatim', count: 0, estimated: false },
            layers: orderMemoryBudgetParts(usage.parts),
        };
    });
}

function orderMemoryBudgetParts(parts) {
    return [...parts].sort((a, b) => getMemoryBudgetPartOrder(a) - getMemoryBudgetPartOrder(b));
}

function getMemoryBudgetPartOrder(part) {
    if (part.kind === 'state') {
        return -1;
    }
    if (part.kind === 'wrapper') {
        return Number.MAX_SAFE_INTEGER;
    }
    if (Number.isInteger(part.layerIndex)) {
        return part.layerIndex;
    }
    return Number.MAX_SAFE_INTEGER - 1;
}

const budgetViews = new WeakMap();

function renderBudgetView(view, targets) {
    const element = $(targets.bar)[0];
    const signature = JSON.stringify(view);
    if (element && budgetViews.get(element) === signature) {
        return;
    }
    if (element) {
        budgetViews.set(element, signature);
    }
    const showOver = view.overage > 0;
    $(targets.total)
        .text(getContextBudgetTotalText(view))
        .toggleClass('sc-context-total-over', showOver);
    const bar = $(targets.bar).empty().toggleClass('sc-context-bar-over', showOver);
    const legend = $(targets.legend).empty();

    for (const segment of view.segments) {
        $('<div></div>')
            .addClass(`sc-context-segment sc-context-${segment.kind}`)
            .toggleClass('sc-context-segment-small', segment.small)
            .css('flex', `${Math.max(segment.count, 1)} 1 0`)
            .attr('title', getBudgetSegmentTitle(segment))
            .text(`${segment.label} (${formatBudgetTokenLabel(segment.count, segment.estimated)})`)
            .appendTo(bar);
        renderBudgetLegendItem(legend, segment);
    }

    if (view.marker) {
        $('<div class="sc-context-trigger-marker"></div>')
            .css('left', `${view.marker.percent}%`)
            .attr('title', view.marker.label)
            .append($('<span class="sc-context-trigger-flag"></span>').text(view.marker.label))
            .appendTo(bar);
    }
}

function clearBudgetView(totalSelector, barSelector, legendSelector) {
    const element = $(barSelector)[0];
    if (element) {
        budgetViews.delete(element);
    }
    setText($(totalSelector), 'Unavailable');
    $(barSelector).empty();
    $(legendSelector).empty();
}

function renderBudgetLegendItem(legend, segment) {
    const item = $('<div class="sc-context-legend-item"></div>');
    $('<span class="sc-context-swatch"></span>')
        .addClass(`sc-context-${segment.kind}`)
        .appendTo(item);
    $('<span class="sc-context-legend-text"></span>')
        .text(`${segment.label}: ${formatBudgetTokenLabel(segment.count, segment.estimated)}`)
        .attr('title', getBudgetSegmentTitle(segment))
        .appendTo(item);
    item.appendTo(legend);
}

function getContextBudgetTotalText(view) {
    if (view.overage > 0) {
        return `${view.totalLabel} (+${formatBudgetTokenLabel(view.overage, false)})`;
    }
    return view.totalLabel;
}

function getBudgetSegmentTitle(segment) {
    return `${segment.label}: ${formatBudgetTokenLabel(segment.count, segment.estimated)} tokens`;
}

/**
 * Build and render the layer statistics panel.
 * @param {ReturnType<typeof getSettings>} s
 * @param {ReturnType<typeof getChatStore>} store
 * @param {number} ghostedCount - Ghosted message count, computed once per updateUI.
 * @returns {void}
 */
function renderLayerStats(s, store, ghostedCount) {
    let statsHtml = `<div class="sc-layer-stat"><strong>${ghostedCount}</strong> messages ghosted (hidden from LLM, visible to you)</div>`;
    const nonEmptyLayers = listNonEmptyLayers(store);
    for (const { index, layer } of nonEmptyLayers) {
        statsHtml += `<div class="sc-layer-stat">
        <span class="sc-layer-label">${layerLabel(index)}:</span>
        <strong>${layer.length}</strong> / ${s.snippetsPerLayer} memories
        </div>`;
    }
    const boundary = getCurrentSummarizedBoundary(getChat(), store);
    if (boundary >= 0) {
        statsHtml += `<div class="sc-layer-stat sc-muted">Current summarized boundary: ${boundary}</div>`;
    }
    if (nonEmptyLayers.length === 0) {
        statsHtml = '<div class="sc-layer-stat sc-muted">No summaries yet for this chat.</div>';
    }

    const stats = $('#sc_layer_stats');
    if (stats.html() !== statsHtml) {
        stats.html(statsHtml);
    }
}

/**
 * Build and render the injection preview textarea and token count.
 * @param {any} usage - Shared displayed memory accounting.
 * @returns {void}
 */
function renderPreview(usage) {
    if (!usage) {
        setValue($('#sc_preview'), 'Preview unavailable');
        setText($('#sc_preview_token_count'), 'Unavailable');
        return;
    }
    const preview = usage?.text ?? '';
    setValue($('#sc_preview'), preview || '(empty - no summaries yet)');
    if (!preview) {
        setText($('#sc_preview_token_count'), '0 tokens');
        return;
    }

    const tokens = usage.total;
    setText(
        $('#sc_preview_token_count'),
        `${formatBudgetTokenLabel(tokens.count, tokens.estimated)} tokens`,
    );
}

// Off retains configuration and explicit Memory review. Live history budget
// planning resumes when enabled; never show stale graphs as current values.
function renderOffBudgets(prefixes) {
    for (const prefix of prefixes) {
        setText($(`#sc_${prefix}_budget_total`), 'Off — enable for live budget');
        for (const part of ['bar', 'legend']) {
            const target = $(`#sc_${prefix}_budget_${part}`);
            if (target.children().length) {
                target.empty();
            }
            if (part === 'bar' && target[0]) {
                budgetViews.delete(target[0]);
            }
        }
    }
}
