// SPDX-License-Identifier: AGPL-3.0-only
// Opt-in compatibility patch for the existing Snapshot 3.3.0 source shape.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const MARKER = '// Display Bridge snapshot compatibility v1';
export function patchSnapshot(source) {
    if (source.includes(MARKER)) return source;
    const newline = source.includes('\r\n') ? '\r\n' : '\n';
    const anchors = [
        ['    try {\n        //First of all,', `    ${MARKER}\n    const dbSnapshot = window.displayBridge?.api?.snapshot;\n    const snapshotHelper = dbSnapshot?.apiVersion === 1 ? dbSnapshot : null;\n\n    try {\n        //First of all,`],
        ['const clone = el.cloneNode(true);', 'const clone = snapshotHelper ? snapshotHelper.cloneMessage(el) : el.cloneNode(true);'],
        ['        document.body.appendChild(containerDiv);\n\n        //Thankfully', `        document.body.appendChild(containerDiv);\n        try {\n            await snapshotHelper?.prepare(containerDiv);\n        } catch (error) {\n            containerDiv.remove();\n            throw error;\n        }\n\n        //Thankfully`],
    ];
    let text = source.replaceAll('\r\n', '\n');
    for (const [before, after] of anchors) {
        if (text.split(before).length !== 2) throw Error('Snapshot source does not match the supported 3.3.0 layout; no files changed.');
        text = text.replace(before, after);
    }
    return text.replaceAll('\n', newline);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        const args = process.argv.slice(2), check = args.includes('--check'), files = args.filter(x => x !== '--check');
        if (files.length !== 1) throw Error('Usage: node tools/patch-snapshot.mjs [--check] /path/to/STExtension-Snapshot/index.js');
        const target = path.resolve(files[0]);
        if (path.basename(target) !== 'index.js') throw Error('Provide the Snapshot extension index.js file.');
        const source = fs.readFileSync(target, 'utf8'), updated = patchSnapshot(source);
        if (updated === source) console.log('Snapshot compatibility patch is already installed.');
        else if (check) console.log('Snapshot source is compatible. No files changed.');
        else {
            const backup = target + '.before-display-bridge';
            fs.writeFileSync(backup, source, {flag:'wx'});
            fs.writeFileSync(target, updated);
            console.log(`Snapshot compatibility installed. Original saved at ${backup}. Refresh SillyTavern.`);
        }
    } catch (error) {console.error(error.message);process.exitCode = 1;}
}
