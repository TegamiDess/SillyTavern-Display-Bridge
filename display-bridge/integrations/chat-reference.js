// ST can generate a new chat name on every read of a card whose raw JSON has
// no chat field. Saving preferences alone cannot make that generated name stable.
// Only an explicit display interaction may initialize the missing native pointer.
export function createChatReferenceSaver({ getContext, readCharacter, writeReference, report = () => {} }) {
    const pending = new Map();
    const raw = character => {
        try { const value = JSON.parse(character?.json_data); return value && typeof value === 'object' && !Array.isArray(value) ? value : null; }
        catch { return null; }
    };
    const named = value => typeof value === 'string' && value.trim().length > 0;
    return function remember(avatar, chat) {
        const context = getContext(), selected = context.characters?.[context.characterId];
        const original = raw(selected), stamp = selected?.create_date;
        if (context.groupId || selected?.avatar !== avatar || !named(chat) || chat.length > 500 || !original || named(original.chat) || !named(stamp)) return Promise.resolve(false);
        const current = () => {
            const ctx = getContext(), matches = ctx.characters?.filter(c => c.avatar === avatar) ?? [];
            return !ctx.groupId && matches.length === 1 && ctx.characters[ctx.characterId] === matches[0]
                && matches[0].create_date === stamp && (ctx.chatId ?? ctx.getCurrentChatId?.()) === chat;
        };
        const key = JSON.stringify([avatar, stamp, chat]);
        if (pending.has(key)) return pending.get(key);
        const work = (async () => {
            const fresh = await readCharacter(avatar), data = raw(fresh);
            // Do not overwrite a saved pointer, guess malformed metadata, or
            // retarget a request after chat switching/replacement.
            if (!current() || fresh?.create_date !== stamp || !data || named(data.chat)) return false;
            await writeReference(avatar, chat);
            const verified = await readCharacter(avatar);
            if (verified?.create_date !== stamp || raw(verified)?.chat !== chat) throw Error('Current chat reference could not be verified.');
            if (current()) {
                const live = getContext().characters[getContext().characterId], latest = raw(live);
                if (latest && !named(latest.chat)) live.json_data = JSON.stringify({ ...latest, chat });
            }
            return true;
        })().catch(error => { report(error); return false; }).finally(() => pending.delete(key));
        pending.set(key, work);
        return work;
    };
}
