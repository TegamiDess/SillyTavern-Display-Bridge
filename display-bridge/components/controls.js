import { compileActions, createActionStore } from '../core/actions.js';
import { resolveImage } from '../integrations/assets.js';

export function checkboxActions(root, { namespace, stateFor, groups = [], defaults = {}, onSync = () => {} }) {
    const inputs = [...root.querySelectorAll('input[type=checkbox]')];
    const variables = {}, actions = {};
    for (const input of inputs) variables[input.id] = { type:'boolean', default: defaults[input.id] ?? input.checked };
    for (const input of inputs) {
        const peers = groups.find(group => group.includes(input.id)) ?? [];
        actions[input.id] = [{ op:'toggle', variable:input.id }, ...peers.filter(id => id !== input.id).map(variable => ({ op:'set', variable, value:false }))];
    }
    const bindings = Object.fromEntries(inputs.map(input => [input.id, { event:'activate', action:input.id }]));
    const definition = compileActions({ schemaVersion:1, namespace, variables, actions, bindings });
    const state = stateFor ? stateFor(definition, () => root.host.isConnected) : createActionStore().bind(definition,'preview');
    function sync() {
        const values = state.read();
        inputs.forEach(input => { input.checked = values[input.id]; });
        for (const label of root.querySelectorAll('[data-db-control],label[for]')) {
            const id = label.dataset.dbControl ?? label.htmlFor;
            label.setAttribute('aria-expanded', String(values[id]));
        }
        onSync(values);
    }
    for (const input of inputs) input.addEventListener('change', () => { state.dispatch(input.id); sync(); });
    for (const label of root.querySelectorAll('[data-db-control],label[for]')) {
        label.tabIndex = 0; label.setAttribute('role','button');
        label.addEventListener('click', event => {
            if (event.target.closest('[data-db-control],label[for]') !== label) return;
            event.preventDefault(); event.stopPropagation();
            state.dispatch(definition.bindings[label.dataset.dbControl ?? label.htmlFor].action); sync();
        });
        label.addEventListener('keydown', event => {
            if (event.target === label && ['Enter',' '].includes(event.key)) { event.preventDefault(); label.click(); }
        });
    }
    sync();
    return { sync, state };
}

export function imageBindings(root, avatar, resolver = resolveImage) {
    const records = [...root.querySelectorAll('img[data-db-asset]')].map(img => {
        const placeholder = document.createElement('span'); placeholder.className = 'db-image-placeholder';
        placeholder.textContent = img.alt || img.dataset.dbAsset; img.after(placeholder);
        const record = { img, placeholder, status:'missing', url:null };
        img.addEventListener('load', () => { img.hidden = false; placeholder.hidden = true; record.status = 'resolved'; window.dispatchEvent(new CustomEvent('display-bridge:image-status')); });
        img.addEventListener('error', () => { img.hidden = true; placeholder.hidden = false; record.status = 'load-failed'; window.dispatchEvent(new CustomEvent('display-bridge:image-status')); });
        return record;
    });
    function refresh() {
        for (const record of records) {
            const result = resolver(avatar, record.img.dataset.dbAsset);
            if (result.status === 'resolved') {
                if (record.url !== result.url) {
                    record.url = result.url; record.status = 'resolved'; record.img.hidden = true; record.placeholder.hidden = false; record.img.src = result.url;
                }
            } else {
                record.url = null; record.status = result.status; record.img.removeAttribute('src'); record.img.hidden = true; record.placeholder.hidden = false;
            }
        }
    }
    return { refresh, imageIssues: () => records.filter(x=>x.status!=='resolved').map(x=>({reference:x.img.dataset.dbAsset,status:x.status})), missingImages: () => records.filter(x => x.status !== 'resolved').length };
}
