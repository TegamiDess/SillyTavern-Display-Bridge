// Retain only the most recently read serialized card, not a cache of the library.
// Callers treat returned nested metadata as read-only and clone before editing.
export function createCardDataReader(parse = JSON.parse) {
    let lastSource, stored = {};
    const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    return character => {
        const source = typeof character?.json_data === 'string' ? character.json_data : null;
        if (source !== lastSource) {
            lastSource = source;
            try { stored = source === null ? {} : object(parse(source)); }
            catch { stored = {}; }
        }
        // Read live data on every call: other ST extensions can edit it in place.
        const direct = object(character?.data), data = object(stored.data);
        return { ...data, ...direct, extensions: { ...object(data.extensions), ...object(direct.extensions) } };
    };
}
