import { resolveWitchcureImage } from '../integrations/witchcure-assets.js';
import { bindCaptures } from '../adapters/witchcure-auxiliary.js';
import { checkboxActions, imageBindings } from './controls.js';

const CSS_FIXES = `
:host{all:initial;display:block;width:100%;margin:12px 0;contain:layout paint;container-type:inline-size;color:#eee;font:14px/1.5 system-ui;color-scheme:dark}
:host([hidden]),[hidden]{display:none!important}*{box-sizing:border-box}img{max-width:100%}input[type=checkbox]{display:none!important}
.db-image-placeholder{display:flex;min-height:70px;padding:10px;align-items:center;justify-content:center;background:#283448;color:#ddd;text-align:center;overflow-wrap:anywhere}
label[role=button],button{cursor:pointer}label:focus-visible,button:focus-visible{outline:3px solid #e4c987}
.map-buttons-container,.btn-map,#map-toggle:checked + .map-buttons-container .btn-map{position:relative!important;inset:auto!important;transform:none!important;width:100%!important;height:auto!important;min-height:0!important;border-radius:10px!important}
.btn-map{display:block!important;padding:15px!important}.btn-map>.icon{display:none}.map-content{width:100%;max-width:100%;opacity:1!important;transform:none!important;pointer-events:auto!important}
.map-popup,.region-detail-popup{position:relative!important;inset:auto!important;width:100%!important;height:auto!important;opacity:1!important;pointer-events:auto!important;display:block!important;background:transparent!important}
.map-popup-content,.region-detail-content{width:100%!important;max-width:100%!important;max-height:70vh}
.region-detail-popup{grid-column:1/-1}.region-grid{grid-template-columns:repeat(3,minmax(0,1fr))!important}.region-item{min-width:0}
.regex-witch-counsel-status-wrapper{width:100%!important;max-width:100%!important;margin:0!important}.session-info{flex-wrap:wrap}.session-value,.goal-value,.message-box{overflow-wrap:anywhere}
.db-map-header{background:#283a54;color:#fff;border:1px solid #506787;padding:8px 14px;border-radius:6px;font:inherit;margin-bottom:8px}
@container(max-width:480px){.top-section,.assistant-section{flex-direction:column!important}.witch-image,.assistant-image-box{margin:auto!important}.witch-metrics,.assistant-left-section{width:100%!important;min-width:0!important}.middle-section{flex-direction:column!important}.region-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}.assistant-gauges{flex-wrap:wrap}}
[hidden]{display:none!important}
@media(prefers-reduced-motion:reduce){*{transition:none!important}}
`;

export function createWitchcureAuxiliary(data, { witchcure, avatar, resolver, stateFor } = {}) {
    const kind = data.type.slice('witchcure-'.length);
    const compiled = witchcure[kind];
    const host = document.createElement('span'); host.className = 'display-bridge-widget'; host.dataset.adapter = data.type; host.hidden = data.suppressed;
    const shadow = host.attachShadow({ mode:'open' });
    const style = document.createElement('style'); style.textContent = compiled.css + CSS_FIXES;
    shadow.append(style, bindCaptures(compiled.html, data.fields));
    let controls;
    if (kind === 'map') {
        // The source nests interactive labels inside an outer label. Give the
        // outer panel a dedicated control so inner clicks cannot toggle it too.
        const outer = shadow.querySelector('.btn-map');
        const content = document.createElement('div'); content.className = outer.className; content.append(...outer.childNodes); outer.replaceWith(content);
        const button = document.createElement('button'); button.type = 'button'; button.className = 'db-map-header'; button.dataset.dbControl = 'map-toggle'; button.textContent = '🧭 탐험 지도';
        shadow.insertBefore(button, shadow.querySelector('#map-toggle'));
        const regionIds = [...shadow.querySelectorAll('input[id^=region-]')].map(x => x.id);
        controls = checkboxActions(shadow, { namespace:'witchcure-map', stateFor, groups:[regionIds], defaults:{'map-toggle':true}, onSync(values) {
            shadow.querySelector('.map-buttons-container').hidden = !values['map-toggle'];
            shadow.querySelector('.map-popup').hidden = !values['map-toggle'] || !values['map-popup-toggle'];
            const selected = regionIds.find(id => values[id]);
            for (const id of regionIds) {
                const n = /^region-(\d+)-/.exec(id)[1];
                const page = shadow.querySelector(`.region-detail-popup-${n}`);
                page.hidden = !values[id]; page.inert = !values[id];
                shadow.querySelector(`label[for="${id}"]`).hidden = !!selected;
            }
        } });
        shadow.addEventListener('keydown', event => {
            if (event.key !== 'Escape') return;
            const values = controls.state.read();
            const id = regionIds.find(id => values[id]) ?? (values['map-popup-toggle'] ? 'map-popup-toggle' : values['map-toggle'] ? 'map-toggle' : null);
            if (id) { event.preventDefault(); controls.state.dispatch(id); controls.sync(); (shadow.querySelector(`label[for="${id}"]`) ?? button).focus(); }
        });
    }
    const images = imageBindings(shadow, avatar, (who, name) => resolveWitchcureImage(who,name,resolver));
    function refresh() { if (!data.suppressed) { controls?.sync(); images.refresh(); } }
    refresh();
    return { host, refresh, missingImages: images.missingImages, imageIssues: images.imageIssues };
}
