/**
 * Coalesce display requests in a microtask and serialize asynchronous renders.
 * A request during a render gets one trailing pass, using current state.
 * Prompt injection deliberately does not pass through this queue.
 * @param {() => Promise<void>} render
 * @returns {() => Promise<void>}
 */
export function createUIRefreshQueue(render) {
    let dirty = false;
    /** @type {Promise<void> | null} */
    let pending = null;
    return function request() {
        dirty = true;
        if (!pending) {
            pending = Promise.resolve().then(async () => {
                try {
                    while (dirty) {
                        dirty = false;
                        await render();
                    }
                } finally {
                    pending = null;
                }
            });
        }
        return pending;
    };
}
