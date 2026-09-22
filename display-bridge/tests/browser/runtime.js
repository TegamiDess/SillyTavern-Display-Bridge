export const characters = [{ avatar: 'test-a.png', name: 'Sample A', data: { extensions: { regex_scripts: [] } } }, { avatar: 'test-b.png', name: 'Sample B', data: { extensions: { regex_scripts: [] } } }];
export const extension_settings = { disabledExtensions: [], regex: [], character_allowed_regex: ['test-a.png'] };
const listeners = new Map();
export const event_types = Object.fromEntries(['APP_READY','CHAT_CHANGED','CHARACTER_MESSAGE_RENDERED','USER_MESSAGE_RENDERED','MESSAGE_EDITED','MESSAGE_UPDATED','MESSAGE_SWIPED','MESSAGE_DELETED','MORE_MESSAGES_LOADED','GENERATION_ENDED','SETTINGS_UPDATED','CHARACTER_DELETED','CHARACTER_RENAMED','CHARACTER_EDITED','CHAT_CREATED'].map(x=>[x,x]));
export const eventSource = {
    on(type, callback) { const set = listeners.get(type) ?? new Set(); set.add(callback); listeners.set(type,set); },
    removeListener(type, callback) { listeners.get(type)?.delete(callback); },
    emit(type,...args) { for(const callback of listeners.get(type) ?? []) callback(...args); },
};
export const ctx = { characters, characterId: 0, chat: [], eventSource, eventTypes: event_types, event_types };
export const substituteParams = text => text.replaceAll('{{char}}','Sample A');
export const substituteParamsExtended = substituteParams;
