// Runs a neutral fixture in a browser; never opens user settings, cards or chats.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const extension = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const st = process.argv[2];
if (!st) throw new Error('Usage: node tests/integration-server.mjs <SillyTavern directory> [V3 index.js]');
const sibling = path.resolve(extension, '../v3-asset-sprites/index.js');
const provider = process.argv[3] || (fs.existsSync(sibling) ? sibling : path.join(st, 'data/default-user/extensions/v3-asset-sprites/index.js'));
const read = p => fs.readFileSync(p, 'utf8').replaceAll('\r\n', '\n');
// Include ST's real button/header rules: the min-content button default is
// essential to reproduce narrow extension-settings layouts faithfully.
const nativeStyles = read(path.join(st,'public/style.css'));
const settingsStyles = ['.menu_button {','#extensions_settings .inline-drawer-toggle.inline-drawer-header,','.inline-drawer-header {','.inline-drawer-icon {'].map(marker=>{
    const start=nativeStyles.indexOf('\n'+marker),end=nativeStyles.indexOf('}',start);
    if(start<0||end<0) throw new Error('Settings CSS boundary changed: '+marker);
    return nativeStyles.slice(start,end+1);
}).join('\n');
const source = read(path.join(st, 'public/script.js'));
const start = source.indexOf('export function messageFormatting(');
const end = source.indexOf('\n/**\n * Inserts or replaces an SVG', start);
if (start < 0 || end < 0) throw new Error('Formatter source boundary changed; update the fixture for this ST version.');
const formatter = `
import { ctx, extension_settings, substituteParams } from './runtime.js';
import { getRegexedString, regex_placement } from './regex-engine.js';
const power_user = { reasoning: {}, auto_fix_generated_markdown: false, encode_tags: false, allow_name2_display: true };
window.testPowerUser = power_user;
const COMMENT_NAME_DEFAULT = 'Comment', systemUserName = 'System';
const converter = new showdown.Converter({emoji:true,literalMidWordUnderscores:true,parseImgDimensions:true,tables:true,underline:true,simpleLineBreaks:true,strikethrough:true});
const fixMarkdown = x => x, canUseNegativeLookbehind = () => true;
const escapeHtml = x => x.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const escapeRegex = x => x.replace(/[.*+?^\u0024{}()|[\\]\\\\]/g, '\\\\$&');
const encodeStyleTags = x => x, decodeStyleTags = x => x;
let mesForShowdownParse;
` + source.slice(start, end).replace('{\n    if (!mes)', '{\n    const chat = ctx.chat;\n    if (!mes)');
const regex = `
import { characters, extension_settings, substituteParams, substituteParamsExtended } from './runtime.js';
const this_chid = 0, saveSettingsDebounced = () => {}, writeExtensionField = () => {};
const getPresetManager = () => null, lodash = { set: () => {} };
function regexFromString(value) { const m = /^\\/(.*)\\/([a-z]*)$/.exec(value); return m ? new RegExp(m[1], m[2]) : new RegExp(value); }
` + read(path.join(st, 'public/scripts/extensions/regex/engine.js')).replace(/^import .+;\n/gm, '');
const assets = `
import {ctx, extension_settings, eventSource, event_types} from './runtime.js';
import {captureDisplaySource, createDisplayHandoff} from './display-handoff.js';
import {decodeRisuModule, mergeModuleSource, MODULE_LIMIT} from './risu-module.js';
import {namedImageRule} from './named-image-rule.js';
import {createCharacterLifecycle} from './character-lifecycle.js';
import {createRecovery,digest,canonical,isolateNativeCard} from './recovery.js';
const getCurrentUserHandle=()=> 'fixture',saveSettings=async()=>{};
const getContext = () => ctx, saveSettingsDebounced = () => {}, processDroppedFiles = files => window.fixtureImport?.drop(files);
const getRequestHeaders = () => ({}), uuidv4 = () => crypto.randomUUID();
const fetch = (...args) => window.fixtureImport ? window.fixtureImport.fetch(...args) : globalThis.fetch(...args);
const fixtureConfirm = message => window.fixtureImport?.confirm?.(message) ?? false;
` + read(provider).replace(/^import \{[\s\S]*?\} from [^;]+;\n/gm, '').replaceAll('window.confirm(', 'fixtureConfirm(') + '\nwindow.testRuleSignature = ruleSignature; window.testBuildRules = buildRules; window.testReconcileProviderStartup=()=>{reconciledStartup=false;reconcileStartup();};\n';
const generated = { '/fixtures/formatter.js': formatter, '/fixtures/regex-engine.js': regex, '/fixtures/v3-runtime.js': assets,
    '/fixtures/recovery.js':read(path.join(path.dirname(provider),'recovery.js')),
    '/fixtures/character-lifecycle.js':read(path.join(path.dirname(provider),'character-lifecycle.js')),
    '/fixtures/display-handoff.js':read(path.join(path.dirname(provider),'display-handoff.js')),
    '/fixtures/risu-module.js':read(path.join(path.dirname(provider),'risu-module.js')),
    '/fixtures/named-image-rule.js':read(path.join(path.dirname(provider),'named-image-rule.js')) };
const vendors = {
    '/css/fontawesome.min.css':path.join(st,'public/css/fontawesome.min.css'),
    '/css/solid.min.css':path.join(st,'public/css/solid.min.css'),
    '/webfonts/fa-solid-900.woff2':path.join(st,'public/webfonts/fa-solid-900.woff2'),
    '/vendor/showdown.js': path.join(st, 'node_modules/showdown/dist/showdown.min.js'),
    '/vendor/purify.js': path.join(st, 'node_modules/dompurify/dist/purify.min.js'),
    '/vendor/css.js': path.join(st, 'node_modules/@adobe/css-tools/dist/umd/adobe-css-tools.js'),
    '/lib/jszip.min.js': path.join(st, 'public/lib/jszip.min.js'),
};
const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64');
const server = http.createServer((req,res) => {
    const url = new URL(req.url, 'http://localhost');
    const name = url.pathname;
    res.setHeader('Cache-Control','no-store');
    if(name==='/fixtures/settings-theme.css') {res.setHeader('Content-Type','text/css');res.end(settingsStyles);return;}
    if (name === '/test-results' && req.method === 'POST') {
        let text = '';
        req.on('data', chunk => { text += chunk; if (text.length > 100000) req.destroy(); });
        req.on('end', () => {
            try {
                const results = JSON.parse(text);
                console.log(`${results.filter(x=>x.passed).length}/${results.length} browser checks passed.`);
                for (const item of results.filter(x=>!x.passed)) console.error(item.name, item.error);
                res.end('ok');
            } catch { res.writeHead(400); res.end(); }
        });
        return;
    }
    if (name.startsWith('/user/files/')) { res.setHeader('Content-Type','image/png'); if(name==='/user/files/slow-hover.png')setTimeout(()=>res.end(pixel),1000);else res.end(pixel); return; }
    if (Object.hasOwn(generated, name)) { res.setHeader('Content-Type','text/javascript'); res.end(generated[name]); return; }
    let filename = vendors[name];
    if (!filename) {
        const prefix = name.startsWith('/fixtures/') ? '/fixtures/' : name.startsWith('/extension/') ? '/extension/' : null;
        if (!prefix) { res.writeHead(404); res.end(); return; }
        const base = prefix === '/fixtures/' ? path.join(extension, 'tests/browser') : extension;
        try { filename = path.resolve(base, decodeURIComponent(name.slice(prefix.length))); }
        catch { res.writeHead(400); res.end(); return; }
        if (!filename.startsWith(base + path.sep)) { res.writeHead(403); res.end(); return; }
    }
    if (!fs.existsSync(filename) || !fs.statSync(filename).isFile()) { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type', ({'.js':'text/javascript','.html':'text/html','.css':'text/css'})[path.extname(filename)] || 'text/plain');
    fs.createReadStream(filename).pipe(res);
});
server.listen(0, '127.0.0.1', () => console.log(`Open http://127.0.0.1:${server.address().port}/fixtures/harness.html`));
