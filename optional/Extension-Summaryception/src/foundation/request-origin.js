// Object identity distinguishes our raw prompts even when a foreground request
// is running concurrently. No flags or marker text are sent to the provider.
const ownedPrompts = new WeakSet();
const ownedMessages = new WeakSet();

/**
 * Retain local ownership without adding provider-visible markers.
 * @param {unknown} prompt - Outgoing raw prompt.
 * @returns {unknown} Original prompt.
 */
export function markSummaryPrompt(prompt) {
    if (Array.isArray(prompt)) {
        ownedPrompts.add(prompt);
        for (const message of prompt) {
            if (message && typeof message === 'object') {
                ownedMessages.add(message);
            }
        }
    }
    return prompt;
}

/**
 * Check the prompt or its retained message identities.
 * @param {unknown} prompt - Host event prompt.
 * @returns {boolean} Whether it belongs to Summaryception.
 */
export function isSummaryPrompt(prompt) {
    return (
        Array.isArray(prompt) &&
        (ownedPrompts.has(prompt) ||
            prompt.some(
                (message) => message && typeof message === 'object' && ownedMessages.has(message),
            ))
    );
}
