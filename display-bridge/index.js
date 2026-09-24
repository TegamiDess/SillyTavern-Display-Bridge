// SPDX-License-Identifier: AGPL-3.0-only
import { getContext, extension_settings } from '../../../extensions.js';
import { saveSettingsDebounced, addCopyToCodeBlocks, getRequestHeaders } from '../../../../script.js';
import { createChatReferenceSaver } from './integrations/chat-reference.js';
import { createDisplayBridge } from './core/bridge.js';
import { css } from '../../../../lib.js';

window.displayBridge?.stop?.();
const post = async (url, body) => {
    const response = await fetch(url, {method:'POST', headers:getRequestHeaders(), body:JSON.stringify(body)});
    if (!response.ok) throw Error(`Could not save the current chat reference (HTTP ${response.status}).`);
    return response;
};
const rememberChat = createChatReferenceSaver({
    getContext,
    readCharacter: async avatar => (await post('/api/characters/get', {avatar_url:avatar})).json(),
    writeReference: (avatar, chat) => post('/api/characters/merge-attributes', {avatar, chat}),
    report: () => window.toastr?.warning?.('Display choices were saved, but ST could not remember the current chat. Retry a display choice before refreshing.', 'Display Bridge'),
});
const bridge = createDisplayBridge({
    getContext,
    extensionSettings: extension_settings,
    saveSettings: saveSettingsDebounced,
    rememberChat,
    cssParser: css,
    afterRender: element => { if (element) addCopyToCodeBlocks(globalThis.jQuery(element)); },
});
window.displayBridge = bridge;
globalThis.displayBridgeSceneRequest = (...args) => bridge.interceptRequest(...args);
bridge.start();
