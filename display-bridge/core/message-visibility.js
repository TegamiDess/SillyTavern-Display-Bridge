import {MESSAGE_KEY, STORY_KEY} from './story-journal.js';

// is_system also means "excluded from the prompt" in ST. Rendering may retain
// a known assistant scene, but must never infer its role from scene-like text.
export function displayProvenance(metadata = {}) {
    const records=metadata?.[STORY_KEY]?.records;
    const ghosts=metadata?.summaryception?.ghostedMessageIds;
    const valid=id=>typeof id==='string'&&id.length>0;
    return {
        journal: new Set((Array.isArray(records)?records:[]).map(record=>record?.message).filter(valid)),
        summary: new Set((Array.isArray(ghosts)?ghosts:[]).filter(valid)),
    };
}

export function isDisplayAssistant(message, provenance) {
    if (!message || message.is_user || message.extra?.type) return false;
    return !message.is_system || provenance.journal.has(message[MESSAGE_KEY])
        || provenance.summary.has(message.sc_id);
}
