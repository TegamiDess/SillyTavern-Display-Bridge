// SPDX-License-Identifier: AGPL-3.0-only
import { audioAssets, sniffAudio, localAudioURL } from './audio-assets.js';
import { createCardDataReader } from './card-data.js';
import { PORTABLE_KEY, portableRules, makePortableCard, packageImages, packageAudio } from './portable-card.js';
import { captureDisplaySource, createDisplayHandoff } from './display-handoff.js';
import { decodeRisuModule, mergeModuleSource, MODULE_LIMIT } from './risu-module.js';
import { namedImageRule } from './named-image-rule.js';
import { createCharacterLifecycle } from './character-lifecycle.js';
import { createRecovery, digest, canonical, isolateNativeCard } from './recovery.js';
import { getCurrentUserHandle } from '../../../user.js';
import {
    eventSource,
    event_types,
    saveSettingsDebounced,
    saveSettings,
    processDroppedFiles,
    getRequestHeaders,
} from '../../../../script.js';

import {
    getContext,
    extension_settings,
} from '../../../extensions.js';

import { uuidv4 } from '../../../utils.js';

const MODULE = 'v3_asset_sprites';
const VERSION = 6;
const LOG = (...args) => console.log(`[${MODULE}]`, ...args);

const IMAGE_EXT = new Set([
    'png', 'jpg', 'jpeg', 'gif', 'webp',
    'apng', 'avif', 'bmp', 'jfif',
]);

const SKIP_TYPES = new Set(['icon', 'user_icon']);
const TOKEN_SOURCE = 'V3ASSETREF_[a-f0-9]{32}_END';

const LEGACY_GLOBAL_IDS = new Set([
    'v3-asset-sprites-img',
    'v3-asset-sprites-tag',
]);

const KNOWN_BUILTIN_IDS = new Set([
    'v3s-builtin-panel',
    'v3s-builtin-panel-lax',
    'v3s-builtin-dc',
    'v3s-builtin-dialogue',
    'v3s-builtin-attr',
    'v3s-builtin-tag',
    'v3s-builtin-audio',
    'v3s-local-macro',
    'v3s-local-tag',
    'v3s-local-named-img',
]);

const BUILTINS = [
    {
        id: 'v3s-local-macro',
        name: 'Image macros',
        source: String.raw`{{\s*(?:img|image|asset|emotion|raw)\s*::\s*([^}\r\n]+?)\s*}}`,
        flags: 'gi',

        output: '<img src="$1">',
    },
    {
        id: 'v3s-local-tag',
        name: 'Image assignment tags',
        source: String.raw`<(?:img|image|sprite|emotion)\s*=\s*["']?([^"'<>]+?)["']?\s*\/?>`,
        flags: 'gi',
        output: '<img src="$1">',
    },
    {
        id: 'v3s-builtin-panel-lax',
        name: 'Assets image reference',
        source: String.raw`\[Assets:([^|\]\r\n]+)\]`,
        flags: 'g',
        output: '<img src="$1">',
    },
    {
        id: 'v3s-builtin-dialogue',
        name: 'Outfit.Emotion.Number image and dialogue',
        source: String.raw`<([\p{L}\p{N}_-]+)\.([\p{L}\p{N}_-]+)\.([1-3])>([\s\S]*?)<\/\1\.\2\.\3>`,
        flags: 'gu',
        output: '<img src="$1.$2.$3">$4',
    },
];

let operationBusy = false;
let zipPromise = null;
let observer = null;
let observedChat = null;
let framePending = false;

const replayCache = new WeakMap();
const lifecycleFields=['extracted','enrolled','metadata','approved','snapshots','displayImports','ruleReports'];
const characterLifecycle=createCharacterLifecycle({state:()=>settings().lifecycle??={},save:saveSettingsDebounced,
    retire(avatar,reason){const s=settings(),data={};for(const key of lifecycleFields){if(has(s[key],avatar)){data[key]=read(s[key],avatar);delete s[key][avatar];}}if(Object.keys(data).length){s.retired??=[];s.retired.push({avatar,reason,data});s.retired=s.retired.slice(-8);}},
    rename(oldAvatar,newAvatar){const s=settings();for(const key of lifecycleFields)if(has(s[key],oldAvatar)){put(s[key],newAvatar,read(s[key],oldAvatar));delete s[key][oldAvatar];}const item=read(s.displayImports,newAvatar);if(item)item.avatar=newAvatar;},
});
function ensureCharacter(character){const matches=(getContext().characters??[]).filter(x=>x.avatar===character?.avatar);if(matches.length!==1||(character.create_date&&matches[0].create_date&&character.create_date!==matches[0].create_date)||!characterLifecycle.ensure(matches[0].create_date?matches[0]:character)?.active)throw new Error('Character changed, was deleted or renamed. Reload the character list.');}

function has(object, key) {
    return object != null
        && Object.prototype.hasOwnProperty.call(object, key);
}

function read(object, key) {
    return has(object, key) ? object[key] : undefined;
}

/**
 * Safely store arbitrary card-provided keys, including "__proto__",
 * as ordinary own properties without invoking inherited setters.
 */
function put(object, key, value) {
    Object.defineProperty(object, key, {
        value,
        enumerable: true,
        configurable: true,
        writable: true,
    });
    return value;
}

function clone(value) {
    return value === undefined
        ? undefined
        : JSON.parse(JSON.stringify(value));
}

function dictionary(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {};
}

function settings() {
    const s = extension_settings[MODULE] ??= {};

    for (const key of [
        'extracted',
        'pending',
        'enrolled',
        'metadata',
        'approved',
        'snapshots',
        'unboundImports',
        'displayImports',
        'ruleReports',
    ]) {
        s[key] = dictionary(s[key]);
    }

    return s;
}

function notify(kind, text) {
    const toast = globalThis.toastr?.[kind];
    if (typeof toast === 'function') {
        toast(text, 'V3 Asset Sprites', { escapeHtml: true });
    } else {
        LOG(text);
    }
}

function currentCharacter() {
    const ctx = getContext();

    // Group-chat attribution needs a separate design.
    if (ctx.groupId !== undefined
        && ctx.groupId !== null
        && ctx.groupId !== '') {
        return null;
    }

    return ctx.characters?.[ctx.characterId] ?? null;
}

function isEnrolled(avatar) {
    const matches=(getContext().characters??[]).filter(x=>x.avatar===avatar);
    return matches.length===1&&characterLifecycle.ensure(matches[0])?.active===true&&read(settings().enrolled, avatar) === true;
}

function isTrusted(avatar) {
    return Array.isArray(extension_settings.character_allowed_regex)
        && extension_settings.character_allowed_regex.includes(avatar)
        && !extension_settings.disabledExtensions?.includes('regex');
}

const LARGE_CARD_WARNING_BYTES = 200_000_000; // 200 MB, warning only

function confirmLargeCard(bytes, description) {
    if (!Number.isFinite(bytes) || bytes <= LARGE_CARD_WARNING_BYTES) {
        return true;
    }

    return window.confirm(
        `${description}: approximately ${(bytes / 1_000_000).toFixed(0)} MB.\n\n`
        + 'Processing this card may slow down your browser and temporarily '
        + 'use considerably more memory than this size. Embedded data saved '
        + 'in settings can also make later settings saves slower.\n\n'
        + 'There is no size limit. Continue?',
    );
}

/**
 * Estimate total uncompressed ZIP contents from central-directory headers.
 * Does not decompress entries.
 *
 * This is an advisory estimate, not a security guarantee:
 * archive headers can be inaccurate. Returns null when unsupported.
 *
 * Input should be the clean archive returned by zipSlice().
 */
function declaredZipBytes(buffer) {
    const view = new DataView(buffer);
    const first = Math.max(0, view.byteLength - 22 - 0xffff);

    for (let end = view.byteLength - 22; end >= first; end--) {
        if (view.getUint32(end, true) !== 0x06054b50) continue;

        const commentLength = view.getUint16(end + 20, true);
        if (end + 22 + commentLength !== view.byteLength) continue;

        const entries = view.getUint16(end + 10, true);
        const directorySize = view.getUint32(end + 12, true);
        let position = view.getUint32(end + 16, true);
        const directoryEnd = position + directorySize;

        if (entries === 0xffff
            || directorySize === 0xffffffff
            || position === 0xffffffff
            || directoryEnd > end) {
            return null;
        }

        let total = 0;

        for (let index = 0; index < entries; index++) {
            if (position + 46 > directoryEnd
                || view.getUint32(position, true) !== 0x02014b50) {
                return null;
            }

            const size = view.getUint32(position + 24, true);
            if (size === 0xffffffff) return null;

            const nameLength = view.getUint16(position + 28, true);
            const extraLength = view.getUint16(position + 30, true);
            const entryCommentLength = view.getUint16(position + 32, true);

            position += 46 + nameLength + extraLength + entryCommentLength;
            if (position > directoryEnd) return null;

            total += size;
        }

        return total;
    }

    return null;
}

const cardData = createCardDataReader();

function scriptsOf(character) {
    const rules = cardData(character).extensions?.regex_scripts;
    return Array.isArray(rules) ? rules : [];
}

function risuScripts(card) {
    const risu = card?.data?.extensions?.risuai
        ?? card?.extensions?.risuai
        ?? cardData(card).extensions?.risuai;

    return Array.isArray(risu?.customScripts)
        ? clone(risu.customScripts)
        : [];
}

function assetsOf(card) {
    const assets = card?.data?.assets ?? cardData(card).assets;
    return Array.isArray(assets) ? clone(assets) : [];
}

function mapFor(avatar) {
    return dictionary(read(settings().extracted, avatar));
}

function normalizeExt(value) {
    return String(value ?? '').trim().toLowerCase().replace(/^\./, '');
}

function extensionOf(value) {
    const match = /\.([a-z0-9]+)$/i.exec(String(value ?? ''));
    return match ? match[1].toLowerCase() : '';
}

function stripImageExtension(value) {
    const text = String(value ?? '');
    const ext = extensionOf(text);
    return IMAGE_EXT.has(ext) ? text.slice(0, -(ext.length + 1)) : text;
}

function normalizedName(value) {
    return String(value ?? '')
        .normalize('NFKC')
        .toLocaleLowerCase()
        .replace(/[\s_.-]+/gu, '');
}

function assetExtension(asset) {
    const declared = normalizeExt(asset?.ext);
    if (declared) return declared;
    return extensionOf(String(asset?.uri ?? '').split(/[?#]/)[0]);
}

function imageAssets(assets) {
    return assets.flatMap((asset, index) => {
        if (!asset || typeof asset.name !== 'string' || !asset.name) {
            return [];
        }

        if (SKIP_TYPES.has(String(asset.type ?? '').toLowerCase())) {
            return [];
        }

        const ext = assetExtension(asset);

        // An absent extension can be resolved by inspecting embedded bytes.
        if (ext && !IMAGE_EXT.has(ext)) return [];

        const uri = String(asset.uri ?? '');
        if (/^data:/i.test(uri) && !/^data:image\//i.test(uri)) return [];

        return [{ asset, index }];
    });
}

function nativeCategory(asset) {
    const type = String(asset.type ?? '').toLowerCase();
    return type === 'emotion' || type === 'expression' ? 'sprite' : 'misc';
}

function nativeBase(asset, index) {
    const category = nativeCategory(asset);
    const separator = category === 'sprite' ? '-' : '_';
    const name = stripImageExtension(asset.name).trim();

    const base = name.toLowerCase()
        .replace(/[^a-z0-9]+/g, separator)
        .replace(new RegExp(`^${separator}|${separator}$`, 'g'), '');

    return base || `${category}-${index}`;
}

function supportedAssets(assets){return [...imageAssets(assets),...audioAssets(assets)];}
function localMediaURL(path){return localImageURL(path)??localAudioURL(path);}
async function mediaFolder(character){
    ensureCharacter(character);
    const id=characterLifecycle.ensure(character).id;
    const name=String(character.name??'Card').normalize('NFKC').replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g,'_').trim().slice(0,70).replace(/[. ]+$/,'')||'Card';
    return `V3 - ${name} - ${(await digest(id)).slice(0,24)}`;
}
async function uploadMediaFile(bytes,ext,folder,prefix){
    const filename=`${prefix}-${uuidv4()}.${ext}`,data=bytesToBase64(bytes);
    // ST's media endpoint supports card folders for both pictures and audio.
    // AVIF is not in older ST media-upload allowlists; retain the file endpoint.
    const response=ext==='avif'?await postJSON('/api/files/upload',{name:filename,data}):await postJSON('/api/images/upload',{image:data,format:ext,filename,ch_name:folder});
    return (await response.json()).path;
}
async function uploadAudio(bytes,folder){const ext=sniffAudio(bytes);if(!ext)throw Error('Audio must be recognizable MP3, WAV or Ogg, up to 32 MB.');const path=await uploadMediaFile(bytes,ext,folder,'v3audio');if(!localAudioURL(path))throw Error('Unsupported audio upload path.');return {path,ext,kind:'audio'};}
async function uploadMedia(bytes,folder){return sniffImage(bytes)?uploadImage(bytes,folder):uploadAudio(bytes,folder);}

function collisionInfo(assets) {
    const names = new Map();
    const diskNames = new Map();
    const duplicateNames = new Set();
    const diskCollisions = new Set();

    for (const { asset, index } of supportedAssets(assets)) {
        if (names.has(asset.name)) {
            duplicateNames.add(asset.name);
        } else {
            names.set(asset.name, index);
        }

        const category = nativeCategory(asset);
        const ext = assetExtension(asset);
        const diskKey = category === 'sprite'
            ? `sprite/${nativeBase(asset, index)}`
            : `misc/${nativeBase(asset, index)}.${ext}`;

        const group = diskNames.get(diskKey) ?? [];
        group.push(asset.name);
        diskNames.set(diskKey, group);
    }

    for (const group of diskNames.values()) {
        if (group.length > 1) {
            for (const name of group) diskCollisions.add(name);
        }
    }

    return { duplicateNames, diskCollisions };
}

/**
 * Accept only explicit local image storage roots.
 * Input is a filesystem-style client-relative path, not an arbitrary URL.
 */
function localImageURL(path) {
    if (typeof path !== 'string' || !path) return null;
    if (/[\u0000-\u001f\u007f\\?#]/u.test(path)) return null;
    if (path.startsWith('//')) return null;

    const clean = path.replace(/^\//, '');

    if (!/^(?:user\/images\/|user\/files\/|characters\/)/.test(clean)) {
        return null;
    }

    const segments = clean.split('/');

    if (segments.some(part => !part || part === '.' || part === '..')) {
        return null;
    }

    if (!IMAGE_EXT.has(extensionOf(segments.at(-1)))) return null;

    const url = '/' + segments.map(encodeURIComponent).join('/');
    return new URL(url, location.origin).origin === location.origin
        ? url
        : null;
}

async function postJSON(url, body) {
    const response = await fetch(url, {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        throw new Error(`${url}: HTTP ${response.status}`);
    }

    return response;
}

async function fullCharacter(avatar) {
    const response = await postJSON('/api/characters/get', {
        avatar_url: avatar,
    });

    const result = await response.json();

    if (!result || typeof result !== 'object' || result.error) {
        throw new Error(`Could not read character: ${avatar}`);
    }

    return { ...result, avatar };
}

async function sanitizedFilename(name) {
    const response = await postJSON('/api/files/sanitize-filename', {
        fileName: String(name),
    });

    const result = await response.json();

    if (typeof result.fileName !== 'string' || !result.fileName) {
        throw new Error('ST returned an empty sanitized filename.');
    }

    return result.fileName;
}

async function listFolders() {
    const response = await postJSON('/api/images/folders', {});
    const result = await response.json();

    if (!Array.isArray(result) || result.some(x => typeof x !== 'string')) {
        throw new Error('Unexpected image-folder response.');
    }

    return result;
}

async function galleryFiles(character) {
    const folders = await listFolders();
    const name = await sanitizedFilename(character.name);

    // Do not call /list for guessed or nonexistent folders:
    // this ST build creates them as a side effect.
    if (!folders.includes(name)) return { folder: name, files: [] };

    const response = await postJSON('/api/images/list', {
        folder: name,
        sortField: 'name',
        sortOrder: 'asc',
    });

    const result = await response.json();

    if (!Array.isArray(result)) {
        throw new Error('Unexpected image-list response.');
    }

    const files = result
        .map(item => typeof item === 'string' ? item : item?.name)
        .filter(item => typeof item === 'string')
        .filter(item => !/[\\/]/.test(item))
        .filter(item => IMAGE_EXT.has(extensionOf(item)));

    return { folder: name, files };
}

function bytesToBase64(bytes) {
    const data = bytes instanceof Uint8Array
        ? bytes
        : new Uint8Array(bytes);

    let result = '';

    for (let i = 0; i < data.length; i += 0x8000) {
        result += String.fromCharCode(...data.subarray(i, i + 0x8000));
    }

    return btoa(result);
}

function base64ToBytes(value) {
    const text = String(value).replace(/\s+/g, '');
    const binary = atob(text);
    return Uint8Array.from(binary, c => c.charCodeAt(0));
}

function sniffImage(bytes) {
    const b = bytes;
    const matches = (offset, value) => [...value].every(
        (char, index) => b[offset + index] === char.charCodeAt(0),
    );

    if (b.length >= 8
        && b[0] === 0x89
        && matches(1, 'PNG\r\n\x1a\n')) return 'png';

    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
    if (matches(0, 'GIF87a') || matches(0, 'GIF89a')) return 'gif';

    if (matches(0, 'RIFF') && matches(8, 'WEBP')) return 'webp';
    if (matches(0, 'BM')) return 'bmp';

    if (matches(4, 'ftyp')) {
        const end = Math.min(b.length, 128);
        for (let i = 8; i + 4 <= end; i += 4) {
            if (matches(i, 'avif') || matches(i, 'avis')) return 'avif';
        }
    }

    return null;
}

function decodeImageDataURI(uri) {
    const match = /^data:image\/[\w.+-]+;base64,([\s\S]+)$/i.exec(uri);
    return match ? base64ToBytes(match[1]) : null;
}

async function uploadImage(bytes,folder) {
    const ext = sniffImage(bytes);

    if (!ext) {
        throw new Error('Embedded data is not a supported recognizable image.');
    }

    const result={path:await uploadMediaFile(bytes,ext,folder,'v3asset')};

    if (!localImageURL(result.path)) {
        throw new Error('Upload returned an unsupported local image path.');
    }

    return { path: result.path, ext };
}

async function getJSZip() {
    if (globalThis.JSZip?.loadAsync) return globalThis.JSZip;

    if (!zipPromise) {
        zipPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = '/lib/jszip.min.js';

            script.onload = () => {
                if (globalThis.JSZip?.loadAsync) {
                    resolve(globalThis.JSZip);
                } else {
                    script.remove();
                    reject(new Error('Local JSZip did not expose its API.'));
                }
            };

            script.onerror = () => {
                script.remove();
                reject(new Error(
                    'Cannot load /lib/jszip.min.js. No CDN fallback is used.',
                ));
            };

            document.head.appendChild(script);
        }).catch(error => {
            zipPromise = null;
            throw error;
        });
    }

    return zipPromise;
}

function pngTextChunks(buffer) {
    const bytes = new Uint8Array(buffer);
    const view = new DataView(buffer);
    const signature = [137, 80, 78, 71, 13, 10, 26, 10];

    if (!signature.every((value, index) => bytes[index] === value)) {
        throw new Error('Invalid PNG signature.');
    }

    const chunks = new Map();
    const decoder = new TextDecoder();

    let position = 8;
    let ended = false;

    while (position + 12 <= bytes.length) {
        const length = view.getUint32(position);
        const end = position + 12 + length;

        if (end > bytes.length) throw new Error('Truncated PNG chunk.');

        const type = String.fromCharCode(
            ...bytes.subarray(position + 4, position + 8),
        );

        if (type === 'tEXt') {
            const data = bytes.subarray(position + 8, position + 8 + length);
            const separator = data.indexOf(0);

            if (separator > 0) {
                const key = decoder.decode(data.subarray(0, separator));
                const value = decoder.decode(data.subarray(separator + 1));

                if (chunks.has(key)) {
                    throw new Error(`Duplicate PNG text key: ${key}`);
                }

                chunks.set(key, value);
            }
        }

        position = end;

        if (type === 'IEND') {
            ended = true;
            break;
        }
    }

    if (!ended) throw new Error('PNG has no complete IEND chunk.');
    return chunks;
}

function parsePNG(buffer) {
    const chunks = pngTextChunks(buffer);
    const encoded = chunks.get('ccv3') ?? chunks.get('chara');

    if (!encoded) {
        throw new Error('PNG has no supported ccv3/chara text chunk.');
    }

    const card = JSON.parse(
        new TextDecoder().decode(base64ToBytes(encoded)),
    );

    const embedded = new Map();

    for (const [key, value] of chunks) {
        const match = /^chara-ext-asset_:?(\d+)$/.exec(key);
        if (match) embedded.set(`__asset:${match[1]}`, value);
    }

    return {
        card,
        format: 'png',
        resolve: async uri => {
            const value = embedded.get(uri);
            return value === undefined ? null : base64ToBytes(value);
        },
    };
}

function zipSlice(buffer) {
    const bytes = new Uint8Array(buffer);
    const view = new DataView(buffer);

    const first = Math.max(0, bytes.length - 22 - 0xffff);

    for (let p = bytes.length - 22; p >= first; p--) {
        if (view.getUint32(p, true) !== 0x06054b50) continue;

        const commentLength = view.getUint16(p + 20, true);
        if (p + 22 + commentLength !== bytes.length) continue;

        const disk = view.getUint16(p + 4, true);
        const directoryDisk = view.getUint16(p + 6, true);
        const diskEntries = view.getUint16(p + 8, true);
        const entries = view.getUint16(p + 10, true);
        const directorySize = view.getUint32(p + 12, true);
        const directoryOffset = view.getUint32(p + 16, true);

        if (disk || directoryDisk || diskEntries !== entries) {
            throw new Error('Multi-volume ZIP archives are not supported.');
        }

        if (entries === 0xffff
            || directorySize === 0xffffffff
            || directoryOffset === 0xffffffff) {
            throw new Error('ZIP64 archives are not supported by this importer.');
        }

        const start = p - directorySize - directoryOffset;
        const directory = start + directoryOffset;

        if (start < 0 || directory < start || directory + directorySize > p) {
            throw new Error('Invalid ZIP directory offsets.');
        }

        if (!entries
            || directory + 4 > bytes.length
            || view.getUint32(directory, true) !== 0x02014b50) {
            throw new Error('ZIP central directory is missing.');
        }

        return buffer.slice(start);
    }

    throw new Error('No supported ZIP end record found.');
}

function embeddedZipPath(uri) {
    const match = /^(?:embeded:\/\/|embedded:\/\/|__asset:)([\s\S]+)$/i.exec(
        String(uri).trim(),
    );

    if (!match) return null;

    const path = match[1].replace(/\\/g, '/').replace(/^\/+/, '');
    const parts = path.split('/');

    if (!path
        || /[\u0000-\u001f:]/u.test(path)
        || parts.some(part => !part || part === '.' || part === '..')) {
        return null;
    }

    return path;
}

async function parseArchive(buffer) {
    const archiveBuffer = zipSlice(buffer);
    const estimatedBytes = declaredZipBytes(archiveBuffer);

    if (!confirmLargeCard(
        estimatedBytes,
        'Estimated uncompressed archive contents',
    )) {
        return null;
    }

    const JSZip = await getJSZip();
    const zip = await JSZip.loadAsync(archiveBuffer);
    const cardFile = zip.file('card.json');

    if (!cardFile) throw new Error('Archive does not contain card.json.');

    let card = JSON.parse(await cardFile.async('string'));
    let displaySourceError;
    const inlineRules = risuScripts(card).length;
    let moduleRules = 0, moduleEffects = 0;
    const moduleFile = zip.file('module.risum');
    if (moduleFile) {
        try {
            if (moduleFile._data?.uncompressedSize > MODULE_LIMIT) throw new Error('module.risum exceeds the supported size');
            const decoded = decodeRisuModule(await moduleFile.async('uint8array'));
            moduleRules = decoded.regex.length;
            moduleEffects = decoded.trigger.reduce((n,t)=>n+(Array.isArray(t.effect)?t.effect.length:0),0);
            card = mergeModuleSource(card,decoded);
        } catch (error) { displaySourceError = String(error.message); }
    }

    return {
        card,
        format: 'charx',
        displaySourceError,
        origin:{format:'charx',inlineRules,module:moduleFile ? (displaySourceError?'failed':'decoded') : 'absent',moduleRules,moduleEffects},
        resolve: async uri => {
            const path = embeddedZipPath(uri);
            if (!path) return null;

            const entry = zip.file(path);
            if (!entry || entry.dir) return null;

            if (entry.unsafeOriginalName) {
                const original = entry.unsafeOriginalName.replace(/\\/g, '/');
                if (original.split('/').includes('..')) {
                    throw new Error('Archive entry contains path traversal.');
                }
            }

            return entry.async('uint8array');
        },
    };
}

async function parseSourceFile(file) {
    const lower = file.name.toLowerCase();

    if (!confirmLargeCard(file.size, 'Source file size')) {
        return null;
    }

    const buffer = await file.arrayBuffer();
    let parsed;
    const avatarFile = lower.endsWith('.png') ? file : null;

    if (lower.endsWith('.png')) {
        parsed = parsePNG(buffer);
    } else if (lower.endsWith('.json')) {
        parsed = {
            card: JSON.parse(new TextDecoder().decode(buffer)),
            format: 'json',
            resolve: async () => null,
        };
    } else if (/\.charx$|\.jpe?g$/.test(lower)) {
        parsed = await parseArchive(buffer);
        if (!parsed) return null;
    } else {
        throw new Error('Supported source files: PNG, JSON, CharX, appended-ZIP JPEG.');
    }

    if (!parsed.card || typeof parsed.card !== 'object') {
        throw new Error('Invalid character JSON.');
    }

    // Reject broken portable rules before any native import/upload occurs.
    const portable = portableRules(cardData(parsed.card).extensions?.[PORTABLE_KEY]);
    if (portable) for (const rule of portable) parseImageTemplate(rule.output);
    const bundle = cardData(parsed.card).extensions?.[PORTABLE_KEY];
    if(bundle?.ui==='profile'&&!cardData(parsed.card).extensions?.display_bridge_profile)throw Error('Configured CHARX is missing its UI profile.');
    if(bundle?.incomplete?.length)notify('warning',`This card was exported with ${bundle.incomplete.length} missing or unsupported asset(s). See its archive notes.`);

    return { ...parsed, avatarFile };
}

function sourceMetadata(parsed, label) {
    return {
        source: label,
        format: parsed.format,
        capturedAt: new Date().toISOString(),
        assets: assetsOf(parsed.card),
        scripts: risuScripts(parsed.card),
        portable: portableRules(cardData(parsed.card).extensions?.[PORTABLE_KEY]),
        origin: parsed.origin ?? {format:parsed.format,inlineRules:risuScripts(parsed.card).length,module:'not-applicable'},
    };
}

function metadataFor(character) {
    const s = settings();
    const saved = read(s.metadata, character.avatar);

    return {
        source: saved?.source ?? 'Existing character',
        format: saved?.format ?? 'unknown',
        capturedAt: saved?.capturedAt ?? new Date().toISOString(),
        ...(saved?.origin ? {origin:clone(saved.origin)} : {}),
        portable: saved?.portable ?? portableRules(cardData(character).extensions?.[PORTABLE_KEY]),

        assets: Array.isArray(saved?.assets)
            ? clone(saved.assets)
            : assetsOf(character),

        scripts: Array.isArray(saved?.scripts)
            ? clone(saved.scripts)
            : (() => {
                const live = risuScripts(character);

                return live.length
                    ? live
                    : clone(
                        read(s.cardScripts, character.avatar)
                        ?? read(s.cardScripts, character.name)
                        ?? [],
                    );
            })(),
    };
}

function takeSnapshot(character) {
    const s = settings();

    if (has(s.snapshots, character.avatar)) return;

    const data = cardData(character);

    put(s.snapshots, character.avatar, {
        capturedAt: new Date().toISOString(),
        name: character.name,
        assets: clone(data.assets ?? []),
        risuScripts: risuScripts(character),
        regexScripts: clone(scriptsOf(character)),
        map: clone(mapFor(character.avatar)),
        metadata: clone(read(s.metadata, character.avatar) ?? null),
        approved: clone(read(s.approved, character.avatar) ?? {}),
        regexWasAllowed: isTrusted(character.avatar),
    });

    saveSettingsDebounced();
}

async function bytesForAsset(asset, parsed) {
    const uri = String(asset.uri ?? '').trim();

    if (/^data:image\//i.test(uri)) return decodeImageDataURI(uri);
    const audio=/^data:audio\/[\w.+-]+;base64,([\s\S]+)$/i.exec(uri);if(audio)return base64ToBytes(audio[1]);

    if (parsed
        && /^(?:embeded:\/\/|embedded:\/\/|__asset:)/i.test(uri)) {
        return parsed.resolve(uri);
    }

    // Deliberately no HTTP(S), arbitrary URL, or filesystem fetch.
    return null;
}

function uniqueNormalizedFile(files, names) {
    const wanted = new Set(
        names.filter(Boolean).map(name => normalizedName(stripImageExtension(name))),
    );

    const matches = files.filter(
        file => wanted.has(normalizedName(stripImageExtension(file))),
    );

    return matches.length === 1 ? matches[0] : null;
}

async function buildMap(character, metadata, parsed = null) {
    const map = parsed?.replaceImages ? {} : clone(mapFor(character.avatar));
    const issues = [];
    const folderName=await mediaFolder(character);
    const { duplicateNames, diskCollisions } = collisionInfo(metadata.assets);

    let folder = '';
    let files = [];

    try {
        ({ folder, files } = await galleryFiles(character));
    } catch (error) {
        issues.push(`Gallery listing unavailable: ${error.message}`);
    }

    for (const { asset, index } of imageAssets(metadata.assets)) {
        if (duplicateNames.has(asset.name)) {
            issues.push(`${asset.name}: duplicate declared asset name; not guessed.`);
            continue;
        }

        const previous = read(map, asset.name);

        // Preserve valid existing mappings.
        if (previous && localImageURL(previous.path)) continue;

        // Archive bytes belong to this import. Never select a same-named file
        // from another card's shared native gallery when bytes are available.
        if (parsed) {
            try {
                const bytes=await bytesForAsset(asset,parsed);
                if(bytes) {put(map,asset.name,await uploadImage(bytes,folderName));continue;}
            } catch(error) {issues.push(`${asset.name}: ${error.message}`);continue;}
            if(parsed.isolatedAssets) {issues.push(`${asset.name}: embedded bytes unavailable; shared gallery was not guessed.`);continue;}
        }

        const ext = assetExtension(asset);
        const candidates = new Set([asset.name]);

        if (ext && IMAGE_EXT.has(ext)) {
            candidates.add(`${stripImageExtension(asset.name)}.${ext}`);
        }

        const nativeCollision = metadata.format === 'charx'
            && diskCollisions.has(asset.name);

        let file = null;

        if (!nativeCollision) {
            if (metadata.format === 'charx'
                && nativeCategory(asset) === 'misc'
                && ext) {
                const expected = `${nativeBase(asset, index)}.${ext}`;
                if (files.includes(expected)) file = expected;
            }

            const exact = files.filter(name => candidates.has(name));

            if (!file && exact.length === 1) file = exact[0];

            if (!file && exact.length === 0) {
                const compatibleFiles = ext
                    ? files.filter(name => extensionOf(name) === ext)
                    : files;

                file = uniqueNormalizedFile(
                    compatibleFiles,
                    [...candidates],
                );
            }
        }

        if (file) {
            const path = `user/images/${folder}/${file}`;

            if (localImageURL(path)) {
                put(map, asset.name, { path, ext: extensionOf(file) });
                continue;
            }
        }

        try {
            const bytes = await bytesForAsset(asset, parsed);

            if (bytes) {
                put(map, asset.name, await uploadImage(bytes,folderName));
            } else {
                const reason = nativeCollision
                    ? 'native filename collision'
                    : 'no unambiguous gallery match or embedded bytes';

                issues.push(`${asset.name}: ${reason}.`);
            }
        } catch (error) {
            issues.push(`${asset.name}: ${error.message}`);
        }
    }

    for(const {asset} of audioAssets(metadata.assets)){
        if(duplicateNames.has(asset.name)){issues.push(`${asset.name}: duplicate media name; not guessed.`);continue;}
        if(localAudioURL(read(map,asset.name)?.path))continue;
        try{const bytes=await bytesForAsset(asset,parsed);if(!bytes)throw Error('local audio bytes unavailable; reattach original archive');put(map,asset.name,await uploadAudio(bytes,folderName));}catch(error){issues.push(`${asset.name}: ${error.message}`);}
    }
    return { map, issues };
}

/**
 * Deliberately limited output grammar:
 * - plain text;
 * - <img src="..."> / <img src='...'> with no other attributes;
 * - Risu image macros.
 *
 * No browser HTML parser is used on card-provided replacements.
 */
function parseImageTemplate(output) {
    const source = String(output ?? '');

    if (/^\s*@@/.test(source)) {
        throw new Error('Risu directive, not a replacement template');
    }

    if (/\$[`']/.test(source)) {
        throw new Error('prefix/suffix replacement tokens are unsupported');
    }

    const token = /<img\s+src\s*=\s*(?:"([^"]*)"|'([^']*)')\s*\/?>|{{(?:img|image|asset|emotion|raw)::([^}]+)}}/gi;

    const parts = [];
    let position = 0;
    let images = 0;

    const addText = text => {
        if (!text) return;

        if (/[<>]/.test(text)) {
            throw new Error('HTML other than a simple image element is unsupported');
        }

        const withoutMatch = text.replace(/{{match}}/gi, '');
        if (/{{|}}/.test(withoutMatch)) {
            throw new Error('unsupported macro in replacement text');
        }

        parts.push({ type: 'text', value: text });
    };

    for (const match of source.matchAll(token)) {
        addText(source.slice(position, match.index));

        const value = match[1] ?? match[2] ?? match[3] ?? '';
        const withoutMatch = value.replace(/{{match}}/gi, '');

        if (/{{|}}/.test(withoutMatch)) {
            throw new Error('unsupported macro in image reference');
        }

        if (/^\s*(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value)) {
            throw new Error('URL-valued image replacement is unsupported');
        }

        parts.push({ type: 'image', value });
        images++;
        position = match.index + match[0].length;
    }

    addText(source.slice(position));

    if (!images) {
        throw new Error('not an image-producing display rule');
    }

    return parts;
}

function regexFromString(value) {
    const match = /^\/([\s\S]*)\/([a-z]*)$/.exec(String(value));
    if (!match) throw new Error('Expected an explicit /pattern/flags regex.');
    return new RegExp(match[1], match[2]);
}

function ownedRule(rule) {
    const id = String(rule?.id ?? '');

    return KNOWN_BUILTIN_IDS.has(id)
        || /^v3s-card-\d+$/.test(id);
}

function ruleSignature(rule) {
    return JSON.stringify([
        rule.id,
        rule.findRegex,
        rule.replaceString,
        rule.placement,
        rule.markdownOnly,
        rule.promptOnly,
        rule.runOnEdit,
        rule.minDepth,
        rule.maxDepth,
        rule.substituteRegex,
        rule.trimStrings,
    ]);
}

function newMarker() {
    return `V3ASSETREF_${uuidv4().replace(/-/g, '').toLowerCase()}_END`;
}

function makeRule(spec, previous, previousApproval) {
    const regex = new RegExp(spec.source, spec.flags);
    const parts = parseImageTemplate(spec.output);

    const marker = typeof previousApproval?.marker === 'string'
        && new RegExp(`^${TOKEN_SOURCE}$`).test(previousApproval.marker)
        ? previousApproval.marker
        : newMarker();

    const rule = {
        id: spec.id,
        uuid: previous?.uuid ?? uuidv4(),
        scriptName: `V3 Asset Sprites: ${spec.name}`,
        findRegex: regex.toString(),

        // Intentionally contains NO capture substitutions and NO HTML.
        replaceString: marker,

        trimStrings: [],
        placement: [1, 2],
        disabled: !!previous?.disabled,
        markdownOnly: true,
        promptOnly: false,
        runOnEdit: true,
        substituteRegex: 0,
        minDepth: null,
        maxDepth: null,
        v3version: VERSION,
    };

    return {
        rule,
        approval: {
            marker,
            parts,
            signature: ruleSignature(rule),
        },
    };
}

function buildRules(character, metadata) {
    const current = scriptsOf(character);
    const previousApproval = dictionary(
        read(settings().approved, character.avatar),
    );

    const wanted = [];
    const specifications = [];
    const approved = {};
    const issues = [];

    const add = spec => {
        try {
            const previous = current.find(rule => rule.id === spec.id);
            const result = makeRule(
                spec,
                previous ?? (typeof spec.disabled === 'boolean' ? {disabled:spec.disabled} : undefined),
                read(previousApproval, spec.id),
            );

            wanted.push(result.rule);
            specifications.push({...spec,flags:spec.flags??'',disabled:result.rule.disabled});
            put(approved, spec.id, result.approval);
        } catch (error) {
            issues.push(`${spec.name}: ${error.message}.`);
        }
    };

    if (metadata.portable) {
        for (const spec of portableRules({version:1,rules:metadata.portable})) add(spec);
        return {wanted,approved,issues,specifications};
    }

    metadata.scripts.forEach((script, index) => {
        const name = `Card rule ${index + 1}`;

        if (!script || typeof script.in !== 'string') {
            issues.push(`${name}: missing regex source.`);
            return;
        }

        if (script.type !== 'editdisplay') {
            issues.push(
                `${name}: ${String(script.type ?? 'unknown')} retained as metadata only.`,
            );
            return;
        }

        const flags = script.ableFlag && typeof script.flag === 'string'
            ? script.flag
            : 'g';

        if (/<[^>]*>/.test(flags)) {
            issues.push(`${name}: Risu placement/control directive; excluded from image-only rules. See Display Bridge compatibility for supported panels.`);
            return;
        }

        add({
            id: `v3s-card-${index}`,
            name,
            source: script.in,
            flags,
            output: script.out,
        });
    });

    for (const builtin of BUILTINS) add(builtin);
    try {
        const spec = namedImageRule(imageAssets(metadata.assets).map(({asset})=>asset.name));
        if (spec) add(spec);
    } catch (error) { issues.push(error.message); }

    return { wanted, approved, issues, specifications };
}

function updateLiveCharacter(avatar, verified, rules) {
    const ctx = getContext();
    const live = ctx.characters?.find(character => character.avatar === avatar);

    if (!live) return;

    live.data ??= {};
    live.data.extensions ??= {};
    live.data.extensions.regex_scripts = clone(rules);

    const verifiedData = cardData(verified);

    if (Array.isArray(verifiedData.assets)) {
        live.data.assets = clone(verifiedData.assets);
    }

    let json;

    try {
        json = JSON.parse(live.json_data || verified.json_data || '{}');
    } catch {
        // Do not invent a partial replacement for an unreadable full card.
        return;
    }

    json.data ??= {};
    json.data.extensions ??= {};
    json.data.extensions.regex_scripts = clone(rules);

    if (Array.isArray(verifiedData.assets)) {
        json.data.assets = clone(verifiedData.assets);
    }

    live.json_data = JSON.stringify(json);

    if (ctx.characters?.[ctx.characterId]?.avatar === avatar) {
        const field = document.getElementById('character_json_data');
        if (field) field.value = live.json_data;
    }
}

async function synchronizeRules(character, metadata) {
    try { return await synchronizeRulesChecked(character,metadata); }
    catch (error) {
        // A completed request for a retired card must not leave a report on
        // a replacement that happens to reuse its filename.
        try { ensureCharacter(character); } catch { throw error; }
        put(settings().ruleReports,character.avatar,{status:'failed',issues:[String(error.message).slice(0,300)]});
        saveSettingsDebounced();
        throw error;
    }
}

async function synchronizeRulesChecked(character, metadata) {
    ensureCharacter(character);
    const initial = await fullCharacter(character.avatar);
    const existing = scriptsOf(initial);
    const { wanted, approved, issues } = buildRules(initial, metadata);
    const ours = existing.filter(ownedRule);

    const legacyGlobalCount = (
        Array.isArray(extension_settings.regex)
            ? extension_settings.regex
            : []
    ).filter(rule => LEGACY_GLOBAL_IDS.has(rule.id)).length;

    const summary = [
        `Install/update ${wanted.length} image-display rules for "${character.name}"?`,
        '',
        `${ours.length} recognized extension-owned character rules will be replaced.`,
        'Existing disabled states are preserved where rule IDs match.',
        'Unrelated rules and ST regex permission will not be changed.',
        '',
        `${issues.length} imported rule(s) or template(s) were excluded from image-only rules.`,
        'Supported UI panels are handled separately by Display Bridge; these exclusions do not mean the whole card is unsupported.',
        'Image-rule text is displayed as text, not reinterpreted as HTML/Markdown.',
    ];

    if (legacyGlobalCount) {
        summary.push(
            '',
            `${legacyGlobalCount} legacy global rule(s) remain untouched.`,
            'Review those separately in ST’s Regex settings.',
        );
    }

    if (issues.length) {
        summary.push('', ...issues.slice(0, 12));

        if (issues.length > 12) {
            summary.push('Additional reasons are listed in the console.');
        }

        LOG('Rules not imported:', issues);
    }

    if (!window.confirm(summary.join('\n'))) {
        put(settings().ruleReports, character.avatar, {status:'declined',issues:issues.slice(0,100).map(x=>String(x).slice(0,300))});
        saveSettingsDebounced();
        return { changed: false, issues };
    }

    // Re-read after approval so unrelated changes are not silently overwritten.
    const latest = await fullCharacter(character.avatar);
    ensureCharacter(character);

    if (JSON.stringify(scriptsOf(latest)) !== JSON.stringify(existing)) {
        throw new Error('Character rules changed during approval. Run synchronization again.');
    }

    takeSnapshot(latest);

    const combined = [
        ...existing.filter(rule => !ownedRule(rule)),
        ...wanted,
    ];

    const latestData = cardData(latest);
    const updateData = {
        extensions: {
            regex_scripts: combined,
        },
    };

    // Restore only missing metadata, never replace an existing asset array.
    if (!Array.isArray(latestData.assets) && metadata.assets.length) {
        updateData.assets = clone(metadata.assets);
    }

    await postJSON('/api/characters/merge-attributes', {
        avatar: character.avatar,
        data: updateData,
    });

    const verified = await fullCharacter(character.avatar);
    ensureCharacter(character);

    if (JSON.stringify(scriptsOf(verified)) !== JSON.stringify(combined)) {
        throw new Error('Saved character rules could not be verified.');
    }

    if (updateData.assets
        && JSON.stringify(cardData(verified).assets)
            !== JSON.stringify(updateData.assets)) {
        throw new Error('Restored asset metadata could not be verified.');
    }

    put(settings().approved, character.avatar, approved);
    put(settings().ruleReports, character.avatar, {status:'installed',issues:issues.slice(0,100).map(x=>String(x).slice(0,300))});
    saveSettingsDebounced();

    updateLiveCharacter(character.avatar, verified, combined);

    if (!isTrusted(character.avatar)) {
        notify(
            'info',
            'Rules were saved but not enabled. Review and allow character regex through ST when ready.',
        );
    }

    return { changed: true, issues };
}

async function refreshCurrent(avatar, changed) {
    if (currentCharacter()?.avatar !== avatar) return;

    if (changed) {
        try {
            await getContext().reloadCurrentChat();
        } catch (error) {
            LOG('Chat reload failed:', error);
            notify('warning', 'Rules saved; reopen this chat to refresh its display.');
        }
    }

    scheduleRender();
}

async function enrollAndMap(character, metadata, parsed = null) {
    ensureCharacter(character);
    takeSnapshot(character);

    const s = settings();

    // A previous version may have left a name-keyed mapping.
    // Adoption is explicit, never inferred from its existence.
    const pending = read(s.pending, character.name);

    if (pending
        && !Object.keys(mapFor(character.avatar)).length
        && window.confirm(
            `Adopt the old name-keyed image mapping for "${character.name}"?\n\n`
            + 'Only approve if it belongs to this character.',
        )) {
        put(s.extracted, character.avatar, clone(pending));
    }

put(s.metadata, character.avatar, clone(metadata));

// Metadata now owns this avatar's scripts.
// Leave legacy name-keyed entries alone: names are not unique identities.
if (has(s.cardScripts, character.avatar)) {
    delete s.cardScripts[character.avatar];
}

if (s.cardScripts && !Object.keys(s.cardScripts).length) {
    delete s.cardScripts;
}
    put(s.enrolled, character.avatar, true);
    saveSettingsDebounced();

    const { map, issues } = await buildMap(character, metadata, parsed);
    ensureCharacter(character);

    put(s.extracted, character.avatar, map);
    saveSettingsDebounced();
    window.dispatchEvent(new CustomEvent('v3sprites:assets-changed', {
        detail: { apiVersion: 1, avatar: character.avatar },
    }));

    if (issues.length) LOG('Asset mapping notes:', issues);

    const usable = imageAssets(metadata.assets)
        .filter(({ asset }) => localImageURL(read(map, asset.name)?.path))
        .length;

    notify(
        issues.length ? 'warning' : 'success',
        `Mapped ${usable}/${imageAssets(metadata.assets).length} declared images.`
        + (issues.length ? ' Unresolved details are in the console.' : ''),
    );

    const result = await synchronizeRules(character, metadata);
    await refreshCurrent(character.avatar, result.changed);

    return { avatar: character.avatar, mapped: usable, issues };
}

async function isolatedNativeFile(parsed, avatarBytes) {
    let bytes=avatarBytes;
    if(!bytes) {
        const icons=assetsOf(parsed.card).filter(a=>String(a.type).toLowerCase()==='icon');
        const icon=icons.find(a=>String(a.name).toLowerCase()==='main')??icons[0];
        if(icon)bytes=await bytesForAsset(icon,parsed);
        if(!bytes&&parsed.format==='png')bytes=new Uint8Array(await parsed.avatarFile.arrayBuffer());
    }
    const ext=bytes&&sniffImage(bytes);
    const zip=new (await getJSZip())();
    zip.file('card.json',JSON.stringify(isolateNativeCard(parsed.card,ext)));
    if(ext)zip.file(`v3-import-avatar.${ext}`,bytes);
    return new File([await zip.generateAsync({type:'uint8array'})],'isolated-import.charx',{type:'application/zip'});
}

async function preflightNativeImport(parsed) {
    const name=parsed.card?.data?.name??parsed.card?.name;
    if(typeof name!=='string'||!name.trim())throw Error('Character name is missing.');
    const duplicates=collisionInfo(assetsOf(parsed.card)).duplicateNames;
    if(duplicates.size)throw Error('Source declares duplicate image names. Resolve those ambiguous names before importing: '+[...duplicates].slice(0,10).join(', '));
    // Only the avatar travels through native CHARX extraction. Auxiliary
    // assets retain original metadata but receive unique provider filenames.
    parsed.importFile=await isolatedNativeFile(parsed);
    parsed.isolatedAssets=true;
    return true;
}

const displayHandoff = createDisplayHandoff({
    records: () => settings().displayImports,
    save: saveSettingsDebounced,
    getBridge: () => window.displayBridge?.api,
    announce: () => window.dispatchEvent(new CustomEvent('v3sprites:display-import-ready')),
    canDeliver:item=>{const matches=(getContext().characters??[]).filter(x=>x.avatar===item.avatar);return matches.length===1&&characterLifecycle.ensure(matches[0])?.active===true&&read(settings().displayImports,item.avatar)?.importId===item.importId;},
});

async function importCard(file) {
    const parsed = await parseSourceFile(file);

    if (!parsed) return null;

    if (!await preflightNativeImport(parsed)) return null;

    const metadata = sourceMetadata(parsed, file.name);
    let displaySource, displaySourceError;
    try { if (parsed.displaySourceError) throw new Error(parsed.displaySourceError); displaySource = captureDisplaySource(parsed.card,metadata.origin); }
    catch (error) { displaySourceError = error.message; }
    const importId = uuidv4();

    // Keep the technical metadata if native import succeeds but cannot be
    // associated unambiguously with one new avatar.
    put(settings().unboundImports, importId, {
        ...clone(metadata),
        intendedName: parsed.card?.data?.name ?? parsed.card?.name,
        displaySource, displaySourceError,
    });

    saveSettingsDebounced();

    const before = new Set(
        getContext().characters.map(character => character.avatar),
    );

    await processDroppedFiles([parsed.importFile]);

    const added = getContext().characters.filter(
        character => !before.has(character.avatar),
    );

    if (added.length !== 1) {
        throw new Error(
            'Native import did not yield exactly one identifiable new character. '
            + 'No character was guessed or modified. Technical metadata was retained.',
        );
    }

    const character = await fullCharacter(added[0].avatar);
    ensureCharacter(character);

    delete settings().unboundImports[importId];
    saveSettingsDebounced();

    return enrollAndHandoff(character,metadata,parsed,importId,displaySource,displaySourceError);
}

async function enrollAndHandoff(character,metadata,parsed,importId,displaySource,displaySourceError) {
    ensureCharacter(character);
    if (displaySource) displayHandoff.queue({avatar:character.avatar,importId,source:displaySource});
    else {
        put(settings().displayImports,character.avatar,{handoffVersion:1,avatar:character.avatar,importId,delivery:'source-error',error:displaySourceError});
        saveSettingsDebounced(); notify('warning', `Character imported; UI setup could not be prepared: ${displaySourceError}`);
    }
    try {
        const mapped = await enrollAndMap(character, metadata, parsed);
        if (displaySource) displayHandoff.complete(character.avatar,importId,{status:'mapped',mapped:mapped.mapped,issues:mapped.issues});
        const ui = read(settings().displayImports,character.avatar);
        if (ui?.delivery === 'pending') notify('info','Images imported. UI setup is pending until Display Bridge is available.');
        else if (ui?.result) notify('info', `UI import: ${ui.result.status}. See Display Bridge settings for the compatibility result.`);
        return {...mapped,ui:clone(ui?.result ?? {status:ui?.delivery ?? 'unavailable'})};
    } catch (error) {
        const mapped = imageAssets(metadata.assets).filter(({asset}) => localImageURL(read(mapFor(character.avatar),asset.name)?.path)).length;
        if (displaySource) displayHandoff.complete(character.avatar,importId,{status:'incomplete',mapped,issues:[String(error.message)]});
        throw error;
    }
}

// Recovery files live in this ST user's local files directory. Names contain
// hashes/UUIDs, never a card-provided path. Old image bytes are never deleted.
const recoveryCache=new Map();
async function recoveryName(avatar) {return `v3recovery-${await digest(avatar)}.json`;}
async function readRecovery(avatar) {
    const path='user/files/'+await recoveryName(avatar);
    const available=await(await postJSON('/api/files/verify',{urls:[path]})).json();
    if(available[path]===false)return null;
    if(available[path]!==true)throw Error('Could not verify recovery journal availability.');
    const response=await fetch('/'+path,{cache:'no-store'});
    if(response.status===404)return null;
    if(!response.ok)throw Error('Could not read the recovery journal.');
    const record=await response.json();
    if(record.version!==1||record.avatar!==avatar||!record.before||!record.expected)throw Error('Recovery journal is invalid.');
    return record;
}
async function saveRecovery(record) {
    const name=await recoveryName(record.avatar),data=bytesToBase64(new TextEncoder().encode(JSON.stringify(record)));
    // Keep the original snapshot separately, even after the active journal is
    // replaced by a subsequent reviewed operation.
    if(record.status==='prepared')await postJSON('/api/files/upload',{name:`v3backup-${record.id}.json`,data});
    await postJSON('/api/files/upload',{name,data});
    const verified=await readRecovery(record.avatar);
    if(canonical(verified)!==canonical(record))throw Error('Recovery journal could not be verified. No further writes will be made.');
    recoveryCache.set(record.avatar,{status:record.status,created:record.created,label:record.label,error:record.error??''});
    window.dispatchEvent(new CustomEvent('v3sprites:assets-changed'));
}
function providerScope(avatar) {
    const s=settings(),fields={};for(const key of lifecycleFields)if(has(s[key],avatar))put(fields,key,clone(read(s[key],avatar)));
    return {fields,identity:clone(s.lifecycle?.entries?.[avatar]),allowed:Array.isArray(extension_settings.character_allowed_regex)&&extension_settings.character_allowed_regex.includes(avatar)};
}
function cardDocument(character) {
    let value;try{value=JSON.parse(character.json_data);}catch{value={...character,data:cardData(character)};}
    delete value.json_data;delete value.avatar;delete value.chat;delete value.date_last_chat;delete value.chat_size;
    return value;
}
async function captureRecovery(avatar,backupImages=false) {
    const character=await fullCharacter(avatar);ensureCharacter(character);
    if(window.displayBridge?.api?.recoveryApiVersion!==1)throw Error('Install the matching Display Bridge before replacing cards.');
    const card=cardDocument(character),provider=providerScope(avatar),bridge=window.displayBridge.api.captureRecovery(avatar);
    const image=await postJSON('/api/characters/export',{avatar_url:avatar,format:'png'});
    const png=new Uint8Array(await image.arrayBuffer());
    if(sniffImage(png)!=='png')throw Error('Could not back up the original character PNG.');
    const images={},imageHashes={};let size=png.length;
    for(const item of Object.values(provider.fields.extracted??{})) {
        if(has(imageHashes,item.path))continue;
        const url=localMediaURL(item.path);if(!url)throw Error('Existing media mapping cannot be backed up safely.');
        const response=await fetch(url,{cache:'no-store'});
        if(response.status===404){put(imageHashes,item.path,'missing');continue;}
        if(!response.ok)throw Error('An existing mapped image could not be read for backup.');
        const bytes=new Uint8Array(await response.arrayBuffer());if(!sniffImage(bytes)&&!sniffAudio(bytes))throw Error('An existing media file could not be verified for backup.');
        size+=bytes.length;if(size>64_000_000)throw Error('This recovery backup exceeds 64 MB of image bytes. Export a manual backup before using a different import path; no replacement was made.');
        put(imageHashes,item.path,await digest(bytes));
        if(backupImages)put(images,item.path,bytesToBase64(bytes));
    }
    return {card,chat:character.chat,provider,bridge,png:bytesToBase64(png),...(backupImages?{images}:{}),
        cardRevision:await digest({card,png:await digest(png)}),imagesRevision:await digest(imageHashes),settingsRevision:await digest({provider,bridge})};
}
async function replaceNative(avatar,parsed,icon) {
    requireSelected(avatar);
    const chat=getContext().getCurrentChatId?.();
    const file=await isolatedNativeFile(parsed,icon);
    const form=new FormData();form.append('avatar',file);form.append('file_type','charx');form.append('preserved_name',avatar);
    const headers={...getRequestHeaders()};delete headers['Content-Type'];delete headers['content-type'];
    const response=await fetch('/api/characters/import',{method:'POST',headers,body:form});
    if(!response.ok)throw Error('Native replacement failed: HTTP '+response.status);
    const imported=await response.json();if(imported.file_name+'.png'!==avatar)throw Error('Native replacement did not acknowledge the selected avatar.');
    requireSelected(avatar);
    // Retain original asset metadata; extraction was deliberately isolated.
    const patch=parsed.restoreStamp?{...clone(parsed.card),avatar}:{avatar,data:{assets:clone(assetsOf(parsed.card))}};
    if(chat)patch.chat=chat;
    if(parsed.restoreStamp)patch.create_date=parsed.restoreStamp;
    if(parsed.restoreChat!==undefined)patch.chat=parsed.restoreChat;
    await postJSON('/api/characters/merge-attributes',patch);
    const character=await fullCharacter(avatar);
    const ctx=getContext(),live=ctx.characters.find(c=>c.avatar===avatar);
    if(!live)throw Error('Replaced character could not be found.');
    Object.assign(live,character);
    ensureCharacter(character);
    await ctx.getCharacters();
    const selectedId=getContext().characters.findIndex(c=>c.avatar===avatar);
    if(selectedId<0)throw Error('Replaced character disappeared during refresh.');
    await getContext().selectCharacterById(selectedId);
    return character;
}
async function restoreReplacement(avatar,before,label='') {
    // Restore backup bytes under new names, so recovery cannot overwrite images
    // another card may now use, including legacy shared-gallery mappings.
    const folderName=await mediaFolder(await fullCharacter(avatar));
    const restoredPaths={};for(const [path,data] of Object.entries(before.images??{}))put(restoredPaths,path,await uploadMedia(base64ToBytes(data),folderName));
    const parsed={card:before.card,format:'charx',restoreStamp:before.card.create_date,restoreChat:getContext().getCurrentChatId?.()??before.chat,resolve:async()=>null};
    const character=label.startsWith('Repair images:')?await fullCharacter(avatar):await replaceNative(avatar,parsed,base64ToBytes(before.png));
    if(canonical(cardDocument(character))!==canonical(before.card))throw Error('Restored card data differs from its backup. Backup retained for manual review.');
    const s=settings();for(const key of lifecycleFields){delete s[key][avatar];if(has(before.provider.fields,key))put(s[key],avatar,clone(before.provider.fields[key]));}
    for(const item of Object.values(read(s.extracted,avatar)??{}))if(has(restoredPaths,item.path))Object.assign(item,restoredPaths[item.path]);
    put(s.lifecycle.entries,avatar,{...clone(before.provider.identity),created:character.create_date});
    const allowed=extension_settings.character_allowed_regex??=[];
    extension_settings.character_allowed_regex=allowed.filter(x=>x!==avatar);
    if(before.provider.allowed)extension_settings.character_allowed_regex.push(avatar);
    window.displayBridge.api.restoreRecovery(avatar,before.bridge);
    await saveSettings();await refreshCurrent(avatar,true);
}
const replacementRecovery=createRecovery({load:readRecovery,save:saveRecovery,capture:captureRecovery,restore:restoreReplacement,
    selected:()=>currentCharacter()?.avatar,
    lock:async(avatar,work)=>{
        if(!navigator.locks?.request)throw Error('This browser cannot coordinate replacement locks. Use a current desktop browser.');
        return navigator.locks.request(`v3-recovery:${getCurrentUserHandle()}:${avatar}`,{ifAvailable:true},lock=>{if(!lock)throw Error('Another tab is replacing this card.');return work();});
    },
    confirm:(label,before,previous)=>window.confirm(label==='keep' ? 'Keep the current card unchanged and close this recovery point?\n\nThe original backup file remains available for export. Automatic restore will no longer be offered for this point.' : label==='restore'
        ? 'Restore the saved card, image mappings, rules and UI settings?\n\nCurrent chat files and all image files stay in place. Later detected card/settings edits block this restore.'
        : `${label}\n\n${label.startsWith('Repair images:')?'Only image mappings and asset metadata will change. Card text, rules, UI choices and chats stay in place.':'The selected card’s prompt, avatar and rules will be replaced. Chats stay in place. Character regex permission will be turned off for review.'} New embedded images use separate files; old image files stay intact. A verified local recovery backup is saved first. Already-missing image bytes cannot be backed up.${previous?'\nThis replaces the active recovery point; the older backup file is retained.':''}`),
});
async function repairImages(file,avatar) {
    requireSelected(avatar);const identity=currentCharacter().create_date;
    const parsed=await parseSourceFile(file);if(!parsed)return null;
    requireSelected(avatar);if(currentCharacter().create_date!==identity)throw Error('Character changed while reading the source.');
    const metadata=sourceMetadata(parsed,file.name);
    if(collisionInfo(metadata.assets).duplicateNames.size)throw Error('Source contains duplicate image names.');
    parsed.isolatedAssets=true;parsed.replaceImages=true;
    const sourceName=parsed.card?.data?.name??parsed.card?.name??'Unnamed source';
    return replacementRecovery.run(avatar,`Repair images: use "${sourceName}" from "${file.name}" for "${currentCharacter().name}"?`,async checkpoint=>{
        const staged=await buildMap(await fullCharacter(avatar),metadata,parsed);
        if(staged.issues.length)throw Error('Image repair is incomplete: '+staged.issues.slice(0,5).join('; '));
        await checkpoint(async()=>{
            put(settings().extracted,avatar,staged.map);
            put(settings().enrolled,avatar,true);
            const existing=metadataFor(await fullCharacter(avatar));existing.assets=metadata.assets;
            put(settings().metadata,avatar,existing);await saveSettings();
        });
        return {repaired:true,mapped:Object.keys(staged.map).length};
    });
}
async function replaceCard(file,avatar) {
    requireSelected(avatar);const identity=currentCharacter().create_date;
    const parsed=await parseSourceFile(file);if(!parsed)return null;
    requireSelected(avatar);if(currentCharacter().create_date!==identity)throw Error('Character changed while reading the source.');
    const duplicates=collisionInfo(assetsOf(parsed.card)).duplicateNames;
    if(duplicates.size)throw Error('Replacement source contains duplicate image names. Resolve these first.');
    parsed.isolatedAssets=true;parsed.replaceImages=true;
    // Stage and validate every supported image before touching the native card.
    // Failed staging can leave unreferenced unique files, but cannot corrupt old assets.
    const metadata=sourceMetadata(parsed,file.name);
    let staged;
    const sourceName=parsed.card?.data?.name??parsed.card?.name;
    if(typeof sourceName!=='string'||!sourceName.trim())throw Error('Source card has no name.');
    let source;if(parsed.displaySourceError)throw Error(parsed.displaySourceError);source=captureDisplaySource(parsed.card,metadata.origin);
    return replacementRecovery.run(avatar,`Replace "${currentCharacter().name}" with "${sourceName}" from "${file.name}"?`,async checkpoint=>{
        staged=await buildMap(await fullCharacter(avatar),metadata,parsed);
        if(staged.issues.length)throw Error('Replacement images are incomplete: '+staged.issues.slice(0,5).join('; '));
        let character;
        await checkpoint(async()=>{
            extension_settings.character_allowed_regex=(extension_settings.character_allowed_regex??[]).filter(x=>x!==avatar);
            window.displayBridge.setEnabled(avatar,false);await saveSettings();
        });
        await checkpoint(async()=>{character=await replaceNative(avatar,parsed);});
        await checkpoint(async()=>{
            const s=settings();put(s.metadata,avatar,clone(metadata));put(s.extracted,avatar,staged.map);put(s.enrolled,avatar,true);
            // Native identity has changed. Old approvals are never transferred.
            delete s.approved[avatar];
            await synchronizeRules(character,metadata);
            const importId=uuidv4();displayHandoff.queue({avatar,importId,source});
            displayHandoff.complete(avatar,importId,{status:'mapped',mapped:Object.keys(staged.map).length,issues:[]});
            await saveSettings();await refreshCurrent(avatar,true);
        });
        notify('success','Card replaced. Review image rules before enabling character regex. Recovery backup is available in Display Bridge.');
        return {avatar,replaced:true};
    });
}
async function exportRecovery(avatar) {
    requireSelected(avatar);const record=await readRecovery(avatar);if(!record)throw Error('No recovery point exists.');
    const zip=new (await getJSZip())();zip.file('original-character.png',base64ToBytes(record.before.png));
    const manifest=[];let imageIndex=0;for(const [path,data] of Object.entries(record.before.images??{})){const bytes=base64ToBytes(data),name=`images/${++imageIndex}.${sniffImage(bytes)??sniffAudio(bytes)??'bin'}`;zip.file(name,bytes);manifest.push({originalPath:path,backupFile:name});}zip.file('images.json',JSON.stringify(manifest,null,2));
    zip.file('recovery.json',JSON.stringify(record,null,2));
    zip.file('README.txt','Local recovery backup. Contains character prompt, rules, image paths and view preferences; review before sharing. Original image files are retained in SillyTavern. Chats are not included. Import the original PNG as a separate character for manual inspection; do not overwrite another card blindly.');
    const url=URL.createObjectURL(await zip.generateAsync({type:'blob'}));const a=document.createElement('a');a.href=url;a.download='character-recovery.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    return {exported:true};
}

async function exportConfiguredCard(avatar=currentCharacter()?.avatar,{download=true}={}) {
    requireSelected(avatar);
    const character=await fullCharacter(avatar);requireSelected(avatar);ensureCharacter(character);
    if(!isEnrolled(avatar))throw Error('Enable / rescan this card’s images before exporting.');
    const metadata=metadataFor(character),mapping=clone(mapFor(avatar)),initial=canonical(cardData(character));
    const bridge=window.displayBridge?.api;
    if(bridge?.exportApiVersion!==1)throw Error('Update and enable Display Bridge before exporting a configured card.');
    const profile=bridge.exportProfile(avatar),profileRevision=canonical(profile);
    const built=buildRules(character,metadata),rules=scriptsOf(character),specifications=[];
    for(const rule of rules.filter(ownedRule)) {
        const expected=built.wanted.find(x=>x.id===rule.id),approval=read(read(settings().approved,avatar),rule.id);
        if(!expected||!approval||approval.signature!==ruleSignature(rule)||ruleSignature(expected)!==ruleSignature(rule))throw Error('An installed image rule was edited or has no verified portable definition. Review/resync image rules before exporting.');
        specifications.push(built.specifications.find(x=>x.id===rule.id));
    }
    const declared=supportedAssets(metadata.assets).map(({asset})=>asset),names=new Set(declared.map(a=>a.name));
    for(const name of Object.keys(mapping))if(!names.has(name)){declared.push({type:localAudioURL(read(mapping,name)?.path)?'audio':'image',name});names.add(name);}
    for(const adapter of profile?.adapters??[]) {
        if(adapter.id!=='portrait-dialogue')continue;
        const source=adapter.source;
        const references=[...Object.values(source.imageMappings??{}),...(source.variants??[]).flatMap(v=>Object.values(v.images)),...(source.format.entries??[]).map(e=>e.portrait).filter(Boolean),...(source.sceneControls?.roster?.entities??[]).flatMap(e=>[e.portrait,...(e.badges??[]).map(b=>b.image)]).filter(Boolean)];
        for(const name of references)if(!names.has(name)){declared.push({type:localAudioURL(read(mapping,name)?.path)?'audio':'image',name});names.add(name);}
    }
    const trackNames=new Set((profile?.adapters??[]).flatMap(a=>(a.source?.sceneControls?.music?.tracks??[]).map(t=>t.asset)));
    for(const name of trackNames)if(!names.has(name)){declared.push({type:'audio',name});names.add(name);}
    const audioNames=new Set([...audioAssets(metadata.assets).map(({asset})=>asset.name),...Object.keys(mapping).filter(n=>localAudioURL(read(mapping,n)?.path)),...trackNames]);
    const excluded=metadata.assets.filter(a=>!declared.includes(a)&&String(a?.type).toLowerCase()!=='icon');
    notify('info','Preparing configured CHARX export. Large asset collections may take a moment.');
    const packaged=await packageImages(declared.filter(a=>!audioNames.has(a.name)).map(asset=>({asset,path:localImageURL(lookupImage(mapping,asset.name)?.path)})),{
        sniffImage,
        readImage:async path=>{
            const response=await fetch(path,{cache:'no-store',redirect:'error'});
            if(response.status===404)return null;
            if(!response.ok)throw Error(`Could not read a mapped image (HTTP ${response.status}).`);
            return new Uint8Array(await response.arrayBuffer());
        },
    });
    const audioPackage=await packageAudio(declared.filter(a=>audioNames.has(a.name)).map(asset=>({asset,path:localAudioURL(read(mapping,asset.name)?.path)})),{readImage:async path=>{const response=await fetch(path,{cache:'no-store',redirect:'error'});if(response.status===404)return null;if(!response.ok)throw Error('Could not read mapped audio.');return new Uint8Array(await response.arrayBuffer());}});
    const imageCount=packaged.assets.length;packaged.assets.push(...audioPackage.assets);packaged.files.push(...audioPackage.files);packaged.totalBytes+=audioPackage.totalBytes;if(packaged.totalBytes>256000000)throw Error('Combined media export exceeds 256 MB.');
    const missing=[...audioPackage.missing.map(name=>'Missing audio: '+name),...packaged.missing.map(name=>`Missing image: ${name}`),...excluded.map(a=>`Unbundled asset: ${a?.name??'unnamed'} (${a?.type??a?.ext??'unknown'})`)];
    const extraIcons=metadata.assets.filter(a=>String(a?.type).toLowerCase()==='icon'&&String(a?.name).toLowerCase()!=='main');
    missing.push(...extraIcons.map(a=>`Unbundled alternate icon: ${a.name}`));
    // Re-encode the current avatar so old PNG character chunks do not carry a
    // second stale card/settings payload inside the exported archive.
    const avatarResponse=await postJSON('/api/characters/export',{avatar_url:avatar,format:'png'});
    const bitmap=await createImageBitmap(await avatarResponse.blob());
    let avatarBlob;
    try{const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;canvas.getContext('2d').drawImage(bitmap,0,0);avatarBlob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));canvas.width=canvas.height=0;}finally{bitmap.close();}
    if(!avatarBlob)throw Error('Could not package the current avatar.');
    const data=clone(cardData(character));data.extensions={...data.extensions,regex_scripts:rules.filter(rule=>!ownedRule(rule))};
    const assets=[{type:'icon',name:'main',ext:'png',uri:'embeded://assets/icon/images/main.png'},...packaged.assets];
    const card=makePortableCard({data,profile,rules:specifications,assets,incomplete:missing});
    // An embedded profile plus retained source can be larger than either alone.
    // Never offer a package that our own UI handoff would reject for its size.
    captureDisplaySource(card,{format:'charx'});
    const notes=[`Export "${data.name}" as a configured CHARX?`,`${imageCount} images, ${audioPackage.assets.length} audio files; ${Math.ceil(packaged.totalBytes/1048576)} MB of media data; ${specifications.length} portable image rules.`,`${profile?.adapters.length??0} UI adapter(s), including their mappings and appearance defaults.`,
        'Includes card prompts, greetings, lorebook and other card-authored metadata. Chats, runtime choices and regex permissions are not included.',
        'The recipient needs V3 Asset Sprites and Display Bridge. Original scripts remain card data; unsupported Lua/state behavior is not converted.'];
    if(data.extensions.world&&!data.character_book)notes.push('No embedded lorebook was found. A separately linked SillyTavern lorebook is not bundled.');
    if(missing.length)notes.push('',`INCOMPLETE: ${missing.length} missing or unsupported asset(s).`,...missing.slice(0,15),'Export an explicitly marked incomplete package anyway?');
    if(!window.confirm(notes.join('\n\n')))return null;
    requireSelected(avatar);ensureCharacter(character);
    const latest=await fullCharacter(avatar);requireSelected(avatar);ensureCharacter(latest);
    if(initial!==canonical(cardData(latest))||canonical(mapFor(avatar))!==canonical(mapping)||profileRevision!==canonical(bridge.exportProfile(avatar)))throw Error('The card, mappings or profile changed during export. Retry with the intended configuration.');
    const zip=new(await getJSZip())();zip.file('card.json',JSON.stringify(card,null,2));zip.file('assets/icon/images/main.png',new Uint8Array(await avatarBlob.arrayBuffer()));
    for(const file of packaged.files)zip.file(file.filename,file.bytes);
    zip.file('DISPLAY-BRIDGE-README.txt','Configured CCV3 export for V3 Asset Sprites and Display Bridge. Use Import card with images and supported UI, then review character regex permission. Card-authored content and scripts are preserved as data, not translated or executed by the exporter. This is not a lossless copy of the original archive.\n'+(missing.length?'INCOMPLETE ASSETS:\n'+missing.join('\n'):'All declared supported images and audio were bundled.'));
    const filename=(data.name.replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').slice(0,100)||'character')+(missing.length?'-incomplete':'')+'.charx';
    const file=new File([await zip.generateAsync({type:'uint8array',compression:'STORE'})],filename,{type:'application/zip'});
    if(download){const url=URL.createObjectURL(file),link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
    notify(missing.length?'warning':'success',missing.length?'Exported an incomplete CHARX. See its included notes.':'Configured CHARX export is ready.');
    return {file,images:imageCount,audio:audioPackage.assets.length,rules:specifications.length,incomplete:missing};
}
let recoveryLoading=null;
async function inspectRecovery(avatar) {
    if(!avatar||recoveryLoading===avatar)return;
    recoveryLoading=avatar;
    try{const r=await readRecovery(avatar);recoveryCache.set(avatar,r?{status:r.status,created:r.created,label:r.label,error:r.error??''}:null);}
    catch(error){recoveryCache.set(avatar,{status:'unavailable',error:String(error.message)});}
    finally{recoveryLoading=null;window.dispatchEvent(new CustomEvent('v3sprites:assets-changed'));}
}

async function enableCurrent() {
    const selected = currentCharacter();

    if (!selected) {
        throw new Error('Select a single-character chat first.');
    }

    const avatar = selected.avatar;
    const character = await fullCharacter(avatar);

    if (!window.confirm(
        `Enable local image mapping for "${character.name}"?\n\n`
        + 'Existing mappings will be preserved. Embedded data-URI images may be uploaded locally.\n'
        + 'Regex installation requires a separate confirmation.',
    )) {
        return null;
    }

    return enrollAndMap(character, metadataFor(character));
}

async function attachSource(file, avatar) {
    const character = await fullCharacter(avatar);
    const parsed = await parseSourceFile(file);
    if (!parsed) return null;
    const sourceName = parsed.card?.data?.name ?? parsed.card?.name ?? '(unnamed)';

    if (!window.confirm(
        `Use "${file.name}" as the image and UI source for "${character.name}"?\n\n`
        + `Source card name: ${sourceName}\n`
        + 'This does not run native character import or replace the character prompt.\n'
        + 'Approve only if this is the correct source card.',
    )) {
        return null;
    }

    let source, sourceError;
    try { if (parsed.displaySourceError) throw new Error(parsed.displaySourceError); source=captureDisplaySource(parsed.card,sourceMetadata(parsed,file.name).origin); }
    catch(error) { sourceError=error.message; }
    return enrollAndHandoff(character,sourceMetadata(parsed,file.name),parsed,uuidv4(),source,sourceError);
}

async function runOperation(work) {
    if (operationBusy) {
        notify('warning', 'Another image import/mapping operation is still running.');
        return null;
    }

    operationBusy = true;

    try {
        return await work();
    } catch (error) {
        console.error(`[${MODULE}]`, error);
        notify('error', error.message ?? String(error));
        return null;
    } finally {
        operationBusy = false;
        scheduleRender();
        window.dispatchEvent(new CustomEvent('v3sprites:assets-changed'));
    }
}

function lookupImage(map, reference) {
    const name = String(reference ?? '').trim();
    if (!name) return null;

    const direct = read(map, name);
    if (direct && localImageURL(direct.path)) return direct;

    const key = normalizedName(stripImageExtension(name));
    if (!key) return null;

    const matches = Object.entries(map).filter(([assetName, record]) => {
        return localImageURL(record?.path)
            && normalizedName(stripImageExtension(assetName)) === key;
    });

    // Never select the first of several normalized aliases.
    return matches.length === 1 ? matches[0][1] : null;
}

function approvedRuntimeRules(character) {
    if (!isTrusted(character.avatar)) return [];

    const approved = dictionary(
        read(settings().approved, character.avatar),
    );

    return scriptsOf(character).flatMap(rule => {
        const approval = read(approved, rule.id);

        if (rule.disabled
            || !approval
            || ruleSignature(rule) !== approval.signature
            || !new RegExp(`^${TOKEN_SOURCE}$`).test(approval.marker)) {
            return [];
        }

        return [{ rule, approval }];
    });
}

function substituteTemplate(template, captures, named) {
    const source = String(template).replace(/{{match}}/gi, '$0');

    return source.replace(/\$\$|\$&|\$(\d+)|\$<([^>]+)>/g, (token, number, name) => {
        if (token === '$$') return '$';
        if (token === '$&') return captures[0] ?? '';

        const value = number !== undefined
            ? captures[Number(number)]
            : named?.[name];

        return typeof value === 'string' ? value : '';
    });
}

/**
 * ST emits only opaque constant markers.
 * Replay extracts values for those markers without inserting captured HTML.
 *
 * This is not a regex sandbox. ST itself also executes these expressions.
 */
function replayRules(raw, rules, isUser) {
    let text = raw;
    const values = new Map();
    const placement = isUser ? 1 : 2;

    for (const { rule, approval } of rules) {
        if (!rule.placement.includes(placement)) continue;

        const queue = [];
        values.set(approval.marker, queue);

        const regex = regexFromString(rule.findRegex);

        text = text.replace(regex, (...args) => {
            const last = args.at(-1);
            const hasNamed = last && typeof last === 'object';
            const captures = args.slice(0, hasNamed ? -3 : -2);
            const named = hasNamed ? last : null;

            queue.push({original:captures[0],parts:approval.parts.map(part => ({
                type: part.type,
                value: substituteTemplate(part.value, captures, named),
            }))});

            return approval.marker;
        });
    }

    const remaining = new Map();

    for (const match of text.matchAll(new RegExp(TOKEN_SOURCE, 'g'))) {
        remaining.set(match[0], (remaining.get(match[0]) ?? 0) + 1);
    }

    // Dependent rules may consume another rule’s marker. Do not guess which
    // original occurrence survives if counts no longer agree.
    for (const [marker, queue] of values) {
        if ((remaining.get(marker) ?? 0) !== queue.length) values.delete(marker);
    }

    return values;
}

function markerTextNodes(root) {
    // Syntax highlighting can split a marker across several spans. Treat an
    // entire code element as one text unit and restore the literal match there.
    const nodes = [...root.querySelectorAll('code')].filter(code=>!code.parentElement?.closest('code,script,style,textarea,.v3as-result')&&code.textContent.includes('V3ASSETREF_'));
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

    while (walker.nextNode()) {
        const node = walker.currentNode;
        const parent = node.parentElement;

        if (!parent
            || parent.closest('script, style, textarea, code, .v3as-result')
            || !node.nodeValue.includes('V3ASSETREF_')) {
            continue;
        }

        nodes.push(node);
    }

    return nodes.sort((a,b)=>a===b?0:a.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING?-1:1);
}

const markerNodeText=node=>node.nodeType===Node.ELEMENT_NODE?node.textContent:node.nodeValue;

function imageResult(parts, map) {
    const wrapper = document.createElement('span');
    wrapper.className = 'v3as-result';

    for (const part of parts) {
        if (part.type === 'text') {
            wrapper.appendChild(document.createTextNode(part.value));
            continue;
        }

        const hit = lookupImage(map, part.value);
        const url = hit ? localImageURL(hit.path) : null;

        if (!url) {
            const missing = document.createElement('span');
            missing.className = 'v3as-missing';
            missing.textContent = `[Image unavailable: ${part.value}]`;
            wrapper.appendChild(missing);
            continue;
        }

        const image = document.createElement('img');
        image.className = 'v3as-image';
        image.alt = part.value;
        image.loading = 'lazy';
        image.decoding = 'async';

        // URL validation is completed before assigning a loading attribute.
        image.src = url;
        wrapper.appendChild(image);
    }

    return wrapper;
}

function renderMarkers(messageElement, character, map, rules) {
    const textRoot = messageElement.querySelector('.mes_text');
    if (!textRoot) return;

    const nodes = markerTextNodes(textRoot);
    if (!nodes.length) return;

    const id = Number(messageElement.getAttribute('mesid'));
    if (!Number.isInteger(id) || id < 0) return;

    const message = getContext().chat?.[id];
    if (typeof message?.mes !== 'string') return;

    // Display Bridge protects whole panels before running the ST formatter.
    // Replay the same display copy so standalone markers cannot consume image
    // captures from inside a panel. Neither extension depends on observer order.
    const bridge = window.displayBridge?.api;
    const presentation = bridge?.apiVersion === 1
        ? bridge.getAssetReplay({ avatar: character.avatar, messageId: id, root: textRoot })
        : null;
    if (presentation && !presentation.ready) return;
    const replaySource = presentation?.source ?? message.mes;

    const signature = JSON.stringify(
        rules.map(({ rule, approval }) => [
            ruleSignature(rule),
            approval.parts,
        ]),
    );

    let cached = replayCache.get(textRoot);

    if (!cached
        || cached.avatar !== character.avatar
        || cached.raw !== replaySource
        || cached.signature !== signature
        || cached.isUser !== !!message.is_user) {
        try {
            cached = {
                avatar: character.avatar,
                raw: replaySource,
                signature,
                isUser: !!message.is_user,
                values: replayRules(replaySource, rules, !!message.is_user),
            };

            replayCache.set(textRoot, cached);
        } catch (error) {
            LOG('Image-rule replay failed:', error);
            return;
        }
    }

    const counts = new Map();

    for (const node of nodes) {
        for (const match of markerNodeText(node).matchAll(new RegExp(TOKEN_SOURCE, 'g'))) {
            counts.set(match[0], (counts.get(match[0]) ?? 0) + 1);
        }
    }

    const queues = new Map();

    for (const [marker, queue] of cached.values) {
        if (queue.length && counts.get(marker) === queue.length) {
            queues.set(marker, { values: queue, index: 0 });
        }
    }

    if (!queues.size) return;

    for (const node of nodes) {
        if (!node.isConnected) continue;

        const source = markerNodeText(node);
        const fragment = document.createDocumentFragment();
        let position = 0;
        let changed = false;

        for (const match of source.matchAll(new RegExp(TOKEN_SOURCE, 'g'))) {
            const queue = queues.get(match[0]);

            fragment.appendChild(document.createTextNode(
                source.slice(position, match.index),
            ));

            if (queue && queue.index < queue.values.length) {
                const captured=queue.values[queue.index++];
                fragment.appendChild(
                    node.nodeType===Node.ELEMENT_NODE?document.createTextNode(captured.original):imageResult(captured.parts, map),
                );
                changed = true;
            } else {
                fragment.appendChild(document.createTextNode(match[0]));
            }

            position = match.index + match[0].length;
        }

        fragment.appendChild(document.createTextNode(source.slice(position)));

        if (changed) {
            if(node.nodeType===Node.ELEMENT_NODE)node.replaceChildren(fragment);
            else node.replaceWith(fragment);
        }
    }
}

function rewriteExistingImages(root, map) {
    for (const image of root.querySelectorAll('.mes_text img[src]')) {
        if (image.closest('.v3as-result')) continue;

        const source = image.getAttribute('src') ?? '';

        // Leave ordinary URLs/paths alone. This pass cannot prevent requests
        // already caused by ST or other extensions.
        if (!source
            || /^(?:[a-z][a-z0-9+.-]*:|\/|\\)/i.test(source)) {
            continue;
        }

        const hit = lookupImage(map, source);
        const url = hit ? localImageURL(hit.path) : null;

        if (!url) continue;

        image.classList.add('v3as-image');
        image.src = url;
    }
}

function renderChat() {
    const character = currentCharacter();
    const chat = document.getElementById('chat');

    if (!character || !chat || !isEnrolled(character.avatar)) return;

    const map = mapFor(character.avatar);
    const rules = approvedRuntimeRules(character);

    for (const message of chat.querySelectorAll('.mes[mesid]')) {
        renderMarkers(message, character, map, rules);
    }

    rewriteExistingImages(chat, map);
}

function scheduleRender() {
    if (framePending) return;
    framePending = true;

    requestAnimationFrame(() => {
        framePending = false;

        try {
            renderChat();
        } catch (error) {
            LOG('Rendering failed:', error);
        }
    });
}

function installObserver() {
    const chat = document.getElementById('chat');
    if (!chat || chat === observedChat) return;

    observer?.disconnect();
    observedChat = chat;
    observer = new MutationObserver(scheduleRender);

    observer.observe(chat, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['src'],
    });
}

function addMenuButton(menu, id, label, handler) {
    if (document.getElementById(id)) return;

    const button = document.createElement('div');
    button.id = id;
    button.tabIndex = 0;
    button.setAttribute('role', 'button');
    button.className = [
        'list-group-item',
        'flex-container',
        'flexGap5',
        'interactable',
        'v3as-menu-button',
    ].join(' ');

    const icon = document.createElement('i');
    icon.className = 'fa-solid fa-images';
    icon.setAttribute('aria-hidden', 'true');

    const text = document.createElement('span');
    text.textContent = label;

    button.append(icon, text);
    button.addEventListener('click', handler);
    button.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handler();
        }
    });

    menu.appendChild(button);
}

function chooseFile(mode, expectedAvatar) {
    if (expectedAvatar !== undefined) requireSelected(expectedAvatar);
    if (operationBusy) {
        notify('warning', 'Wait for the current operation to finish.');
        return;
    }

    const target = ['attach','replace','repair'].includes(mode) ? currentCharacter() : null;

    if (['attach','replace','repair'].includes(mode) && !target) {
        notify('warning', 'Select a single-character chat first.');
        return;
    }

    // Capture identity before opening the file picker.
    const avatar = target?.avatar, stamp=target?.create_date;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.png,.json,.charx,.jpg,.jpeg';
    input.hidden = true;

    input.addEventListener('change', () => {
        const file = input.files?.[0];
        input.remove();

        if (!file) return;

        if(target&&(currentCharacter()?.avatar!==avatar||currentCharacter()?.create_date!==stamp)){notify('warning','Character changed while the file picker was open. Select it again.');return;}
        void runOperation(() => mode === 'attach'
            ? attachSource(file, avatar)
            : mode === 'replace' ? replaceCard(file,avatar) : mode === 'repair' ? repairImages(file,avatar) : importCard(file));
    }, { once: true });

    input.addEventListener('cancel', () => input.remove(), { once: true });

    document.body.appendChild(input);
    input.click();
}

function ensureUI() {
    const menu = document.getElementById('extensionsMenu');
    if (!menu) return;

    addMenuButton(
        menu,
        'v3as-import',
        'Import card with images and supported UI',
        () => chooseFile('import'),
    );

    addMenuButton(menu,'v3as-replace','Replace selected card with recovery backup',()=>chooseFile('replace'));
    addMenuButton(menu,'v3as-export','Export configured card (CHARX)',()=>{void runOperation(()=>exportConfiguredCard());});

    addMenuButton(
        menu,
        'v3as-enable',
        'Enable / rescan current card images',
        () => { void runOperation(enableCurrent); },
    );

    addMenuButton(
        menu,
        'v3as-attach',
        'Attach original card images and UI to current character',
        () => chooseFile('attach'),
    );
}

function lifecycle() {
    ensureUI();
    const avatar=currentCharacter()?.avatar;if(avatar&&!recoveryCache.has(avatar))void inspectRecovery(avatar);
    installObserver();
    scheduleRender();
}

function inventory() {
    const character = currentCharacter();

    return {
        character: character?.avatar ?? null,
        enrolled: character ? isEnrolled(character.avatar) : false,
        regexAllowed: character ? isTrusted(character.avatar) : false,
        ownedCharacterRules: character
            ? clone(scriptsOf(character).filter(ownedRule))
            : [],
        legacyGlobalRules: clone(
            (Array.isArray(extension_settings.regex) ? extension_settings.regex : [])
                .filter(rule => LEGACY_GLOBAL_IDS.has(rule.id)),
        ),
        mappedImages: character
            ? Object.keys(mapFor(character.avatar)).length
            : 0,
        unboundImports: Object.keys(settings().unboundImports),
        snapshotAvailable: character
            ? has(settings().snapshots, character.avatar)
            : false,
    };
}

function requireSelected(avatar) {
    if (!avatar || currentCharacter()?.avatar !== avatar
        || getContext().characters.filter(item=>item.avatar===avatar).length !== 1) {
        throw new Error('Character changed or is ambiguous. Select the intended character and try again.');
    }
}

function compatibilityReport({avatar} = {}) {
    const matches = (getContext().characters ?? []).filter(item=>item.avatar===avatar);
    if (!avatar || matches.length !== 1) return {status:'unavailable'};
    const character = matches[0], s = settings();
    if(!characterLifecycle.ensure(character)?.active)return {status:'character unavailable'};
    const metadata = read(s.metadata,avatar), map = mapFor(avatar);
    const assets = imageAssets(metadata?.assets ?? assetsOf(character));
    const missing = assets.filter(({asset})=>!localImageURL(read(map,asset.name)?.path));
    const rules = scriptsOf(character).filter(ownedRule), approvals = read(s.approved,avatar) ?? {};
    const delivery = read(s.displayImports,avatar);
    return {
        status:'available', replacementRecovery:{supported:true,...clone(recoveryCache.get(avatar)??{status:'none'})}, enrolled:isEnrolled(avatar), origin:metadata?.origin ? clone(metadata.origin) : null,
        audio:{declared:audioAssets(metadata?.assets??assetsOf(character)).length,missing:audioAssets(metadata?.assets??assetsOf(character)).filter(({asset})=>!localAudioURL(read(map,asset.name)?.path)).map(({asset})=>asset.name).slice(0,100)},
        assets:{declared:assets.length,mapped:assets.length-missing.length,missingCount:missing.length,
            missing:missing.slice(0,100).map(({asset})=>String(asset.name).slice(0,160))},
        regex:{allowed:isTrusted(avatar),extensionEnabled:!extension_settings.disabledExtensions?.includes('regex'),
            installed:rules.length,disabled:rules.filter(rule=>rule.disabled).length,
            unapproved:rules.filter(rule=>!read(approvals,rule.id) || ruleSignature(rule)!==read(approvals,rule.id).signature).length,
            active:approvedRuntimeRules(character).length,lastSync:clone(read(s.ruleReports,avatar) ?? null)},
        delivery:delivery ? {importId:delivery.importId,status:delivery.delivery,error:String(delivery.error ?? '').slice(0,300)} : null,
        unboundImports:Object.entries(s.unboundImports).map(([id,item])=>({id,name:String(item.intendedName??'Unidentified import').slice(0,120),format:String(item.format??'unknown').slice(0,20)})),
    };
}

window.v3sprites = {
    // Explicit identity, read-only lookups, no automatic enrollment or uploads.
    api: Object.freeze({
        apiVersion: 1,
        audioApiVersion:1,
        resolveAudio({avatar,reference}={}){const matches=(getContext().characters??[]).filter(c=>c.avatar===avatar);if(typeof avatar!=='string'||matches.length!==1||!isEnrolled(avatar)||!characterLifecycle.ensure(matches[0])?.active)return {status:'not-enrolled'};const url=localAudioURL(read(mapFor(avatar),reference)?.path);return url?{status:'resolved',url}:{status:'missing'};},
        compatibilityApiVersion:1,
        getCompatibility:compatibilityReport,
        listImages({avatar}={}) {
            const matches=(getContext().characters??[]).filter(c=>c.avatar===avatar);
            if(typeof avatar!=='string'||matches.length!==1||!isEnrolled(avatar)||!characterLifecycle.ensure(matches[0])?.active)return {status:'unavailable',images:[],truncated:false};
            const map=mapFor(avatar),metadata=read(settings().metadata,avatar);
            const names=[...new Set([...imageAssets(metadata?.assets??assetsOf(matches[0])).map(({asset})=>asset.name),...Object.keys(map).filter(name=>!localAudioURL(read(map,name)?.path))])].filter(n=>typeof n==='string'&&n.trim()&&n.length<=256);
            return {status:'available',truncated:names.length>2000,images:names.slice(0,2000).map(name=>({name,status:localImageURL(read(map,name)?.path)?'resolved':'missing'}))};
        },
        resolveImage({ avatar, reference } = {}) {
            if (typeof avatar !== 'string' || !isEnrolled(avatar)) {
                return { status: 'not-enrolled' };
            }
            const hit = lookupImage(mapFor(avatar), reference);
            const url = hit ? localImageURL(hit.path) : null;
            return url
                ? { status: 'resolved', url, alt: String(reference ?? '') }
                : { status: 'missing' };
        },
    }),
    inventory,

    map: () => {
        const character = currentCharacter();
        return character ? clone(mapFor(character.avatar)) : {};
    },

    lookup: reference => {
        const character = currentCharacter();

        return character
            ? clone(lookupImage(mapFor(character.avatar), reference))
            : null;
    },

    unmatched: () => {
        const character = currentCharacter();
        if (!character) return [];

        const metadata = read(settings().metadata, character.avatar);
        const map = mapFor(character.avatar);

        return imageAssets(metadata?.assets ?? [])
            .map(({ asset }) => asset.name)
            .filter(name => !localImageURL(read(map, name)?.path));
    },

    metadata: () => {
        const character = currentCharacter();

        return character
            ? clone(read(settings().metadata, character.avatar))
            : null;
    },

    snapshot: () => {
        const character = currentCharacter();

        return character
            ? clone(read(settings().snapshots, character.avatar))
            : null;
    },

    // Read-only rendering; no automatic synchronization.
    rewrite: scheduleRender,
    run: lifecycle,

    // Explicit operations with confirmation.
    rescan: () => runOperation(enableCurrent),
    resync: () => runOperation(async () => {
        const selected = currentCharacter();
        if (!selected) throw new Error('Select a single-character chat first.');

        const character = await fullCharacter(selected.avatar);
        const result = await synchronizeRules(
            character,
            metadataFor(character),
        );

        await refreshCurrent(character.avatar, result.changed);
        return result;
    }),

    import: file => runOperation(() => importCard(file)),
    exportCard: (avatar=currentCharacter()?.avatar,options) => runOperation(() => exportConfiguredCard(avatar,options)),
    attach: (file,avatar=currentCharacter()?.avatar) => runOperation(() => attachSource(file,avatar)),
    recovery: Object.freeze({
        version:1,
        replace({avatar}) { requireSelected(avatar); chooseFile('replace',avatar); },
        repair({avatar}) {requireSelected(avatar);chooseFile('repair',avatar);},
        repairFile:(file,avatar)=>runOperation(()=>repairImages(file,avatar)),
        undo({avatar}) {requireSelected(avatar);return runOperation(()=>replacementRecovery.undo(avatar));},
        keep({avatar}) {requireSelected(avatar);return runOperation(()=>replacementRecovery.keep(avatar));},
        backup({avatar}) {return runOperation(()=>exportRecovery(avatar));},
        inspect:inspectRecovery,
        replaceFile:(file,avatar)=>runOperation(()=>replaceCard(file,avatar)),
        attach({avatar}) { requireSelected(avatar); chooseFile('attach',avatar); },
        rescan({avatar}) { requireSelected(avatar); return runOperation(enableCurrent); },
        resync({avatar}) {
            requireSelected(avatar);
            return runOperation(async()=>{
                const character=await fullCharacter(avatar);
                requireSelected(avatar);
                const result=await synchronizeRules(character,metadataFor(character));
                await refreshCurrent(avatar,result.changed);
                return result;
            });
        },
        retry({avatar}) { requireSelected(avatar); displayHandoff.flush(avatar); },
        bindPending({avatar,importId}) {
            requireSelected(avatar);
            return runOperation(async()=>{
                const record=read(settings().unboundImports,importId);if(!record)throw new Error('That pending source is no longer available.');
                const character=await fullCharacter(avatar);requireSelected(avatar);
                if(!window.confirm(`Attach retained source for "${record.intendedName??'Unidentified import'}" to "${character.name}"?\n\nNo native import or prompt replacement. Original archive bytes are unavailable; attach the original card afterward for any missing images.`))return null;
                const result=await enrollAndHandoff(character,record,undefined,importId,record.displaySource,record.displaySourceError);
                delete settings().unboundImports[importId];saveSettingsDebounced();return result;
            });
        },
    }),
    // Explicit retry for companion updates or a recovered load order.
    retryDisplayImports: () => displayHandoff.flush(),
    displayImportStatus: avatar => {
        const entry = read(settings().displayImports,avatar);
        return entry ? clone({importId:entry.importId,delivery:entry.delivery,result:entry.result,error:entry.error}) : null;
    },

    // No automatic restore/delete helper: snapshots may contain older rules
    // and must be reviewed before restoring character-wide configuration.
};

window.addEventListener('display-bridge:import-ready', () => displayHandoff.flush());
window.addEventListener('v3sprites:display-import-ready', () => displayHandoff.flush());
eventSource.on(event_types.APP_READY, () => displayHandoff.flush());
let reconciledStartup=false;
function reconcileStartup(){
    if(reconciledStartup||operationBusy||!(getContext().characters?.length))return;
    reconciledStartup=true;
    for(const character of getContext().characters)characterLifecycle.ensure(character);
    for(const item of Object.values(settings().displayImports))if(item.delivery==='mapping'&&item.source){
        const character=getContext().characters.find(x=>x.avatar===item.avatar);if(!character||!characterLifecycle.ensure(character)?.active)continue;
        const metadata=read(settings().metadata,item.avatar),map=mapFor(item.avatar);
        const mapped=imageAssets(metadata?.assets??[]).filter(({asset})=>localImageURL(read(map,asset.name)?.path)).length;
        displayHandoff.complete(item.avatar,item.importId,{status:'incomplete',mapped,issues:['Mapping was interrupted. Reattach the original card to recover any missing images.']});
    }
    displayHandoff.flush();
}
for(const [name,handler] of [
    ['CHARACTER_DELETED',({character}={})=>{if(character)characterLifecycle.remove(character);scheduleRender();}],
    ['CHARACTER_RENAMED',(oldAvatar,newAvatar)=>{characterLifecycle.move(oldAvatar,newAvatar);scheduleRender();}],
    ['APP_READY',reconcileStartup],['CHAT_CHANGED',reconcileStartup],
])if(event_types[name])eventSource.on(event_types[name],handler);
reconcileStartup();

window.addEventListener('display-bridge:rendered', scheduleRender);
window.addEventListener('display-bridge:ownership-changed', scheduleRender);
window.dispatchEvent(new CustomEvent('v3sprites:provider-ready', {
    detail: { apiVersion: 1 },
}));

const lifecycleEvents = new Set([
    event_types.APP_READY,
    event_types.CHAT_CHANGED,
    event_types.CHARACTER_MESSAGE_RENDERED,
    event_types.USER_MESSAGE_RENDERED,
    event_types.MESSAGE_EDITED,
    event_types.MESSAGE_SWIPED,
    event_types.MESSAGE_UPDATED,
].filter(Boolean));

for (const event of lifecycleEvents) {
    eventSource.on(event, lifecycle);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', lifecycle, { once: true });
} else {
    lifecycle();
}

LOG('Loaded image-only implementation. Existing characters require explicit enrollment.');
