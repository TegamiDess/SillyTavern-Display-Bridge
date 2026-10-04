/**
 * Find the first descendant of $parent matching selector, creating it via
 * make() when absent. make() owns placement of any node it creates.
 * @param {object} $parent jQuery-wrapped search root
 * @param {string} selector jQuery selector for the child to find
 * @param {function(): object} make Called when absent; owns placement of the created node
 * @returns {object} jQuery-wrapped existing or newly created element
 */
export function ensureChild($parent, selector, make) {
    const $existing = $parent.find(selector).first();
    if ($existing.length) {
        return $existing;
    }
    return make();
}

const shownStates = new WeakMap();

/** Set visibility only on a transition, without repeated layout reads. */
export function setShown($elements, visible) {
    $elements.each(function () {
        if (shownStates.get(this) === visible) {
            return;
        }
        $(this).toggle(visible);
        shownStates.set(this, visible);
    });
}

/**
 * Avoid replacing text nodes when their content is unchanged.
 * @returns {object} The jQuery-wrapped element.
 */
export function setText($element, value) {
    const text = String(value);
    if ($element.text() !== text) {
        $element.text(text);
    }
    return $element;
}

/**
 * Preserve caret/selection when a settings value has not changed.
 * @returns {object} The jQuery-wrapped element.
 */
export function setValue($element, value) {
    if (String($element.val() ?? '') !== String(value ?? '')) {
        $element.val(value);
    }
    return $element;
}
