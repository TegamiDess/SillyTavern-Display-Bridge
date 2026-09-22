// Report data is descriptive only: never return templates, prompts, Lua or URLs.
export const panelNames = {'media-panel':'Stream window',gallery:'Streamer gallery',witchcure:'Witchcure','portrait-dialogue':'Portrait and dialogue'};
export function sourceOrigin(value) {
    if (!value || typeof value !== 'object') return null;
    const count = n => Number.isInteger(n) && n >= 0 ? Math.min(n,100000) : null;
    return {format:['charx','json','png','jpeg','jpg','profile','attached-json'].includes(value.format)?value.format:'unknown',
        inlineRules:count(value.inlineRules),module:['decoded','failed','absent','not-applicable'].includes(value.module)?value.module:'unknown',
        moduleRules:count(value.moduleRules),moduleEffects:count(value.moduleEffects)};
}

export function createCompatibilityView(recover) {
    const host=document.createElement('section'); host.className='db-compatibility';
    host.setAttribute('aria-label','Compatibility and recovery');
    let signature='', selected=null;
    const node=(tag,text)=>{const el=document.createElement(tag);el.textContent=text;return el;};
    const status=node('p','');status.setAttribute('aria-live','polite');
    function update(report) {
        const next=JSON.stringify(report); if (next===signature) return;
        signature=next;
        const open=[...host.querySelectorAll('details[open]')].map(x=>x.dataset.section);
        const same=selected===report.avatar; selected=report.avatar;
        if(!same) status.textContent='';
        host.replaceChildren(node('h4','Compatibility and recovery'));
        if (!report.avatar) {host.append(node('p','Select a single-character chat to inspect its import.'));return;}
        const section=(title)=>{const el=node('details','');el.dataset.section=title;el.open=same&&open.includes(title);el.append(node('summary',title));host.append(el);return el;};
        const lines=(parent,items)=>{const list=node('ul','');for(const text of items)list.append(node('li',text));parent.append(list);};
        const action=(parent,label,id)=>{
            const button=node('button',label);button.type='button';button.className='menu_button';
            button.addEventListener('click',async()=>{
                button.disabled=true;
                try {const result=await recover(id,report.avatar,report);if(selected===report.avatar)status.textContent=result || 'Done.';}
                catch(error){if(selected===report.avatar)status.textContent=error.message;}
                finally {button.disabled=false;}
            });parent.append(button);
        };
        const origin=report.source;
        host.append(node('p',origin?`Last inspected source: ${origin.format}. Inline rules: ${origin.inlineRules??'not recorded'}. Module: ${origin.module}${origin.module==='decoded'?` (${origin.moduleRules} rules, ${origin.moduleEffects} effects)`:''}.`:'Source: not recorded by this version. Attach the original card to inspect it.'));
        host.append(node('p',`Saved UI profile result: ${report.importStatus}. Bridge: ${report.enabled?'on':'off'}.`));
        if(report.delivery) host.append(node('p',`Importer delivery: ${report.delivery.status}. ${report.delivery.error||''}`));
        const attention=report.panels.filter(p=>p.state==='missing or incompatible').map(p=>`${p.name}: ${p.reason}`);
        if(report.provider.status==='available') {
            if(report.provider.assets.missingCount) attention.push(`${report.provider.assets.missingCount} declared images need a mapping. See Images and image rules.`);
            if(report.provider.regex.installed&&!report.provider.regex.allowed) attention.push('Installed image rules do not currently have active character regex permission.');
        }
        if(report.imageIssues.some(x=>x.status==='load-failed')) attention.push('A mapped panel image failed to load. See Images and image rules.');
        if(attention.length) lines(host,attention);
        const panels=section('Panel readiness and actions');
        lines(panels,report.panels.map(p=>`${p.name}: ${p.state}. ${p.reason}`));
        lines(panels,report.actions);
        if(report.pending) host.append(node('p','An imported profile is waiting for review. Use Apply imported UI profile or Keep current panels above.'));
        const images=section('Images and image rules');
        const provider=report.provider;
        if(provider.status!=='available') images.append(node('p',`Image report: ${provider.status}. Install the matching V3 Asset Sprites release for recovery and named-image details.`));
        else {
            const a=provider.assets,r=provider.regex;
            images.append(node('p',`Image mapping ${provider.enrolled?'enabled':'not enabled'}; ${a.mapped}/${a.declared} declared images mapped. Mapping does not verify that files still load.`));
            if(a.missingCount) lines(images,[`${a.missingCount} declared images have no usable mapping (showing up to 100):`,...a.missing]);
            images.append(node('p',`Native regex permission: ${r.allowed?'allowed':'not active'}. Regex extension: ${r.extensionEnabled?'on':'off'}. Image rules: ${r.installed} installed; ${r.active} approved and active; ${r.disabled} disabled; ${r.unapproved} modified or unapproved.`));
            if(!r.allowed) images.append(node('p','In SillyTavern’s Regex settings, review this character’s rules and allow character regex if appropriate. Display Bridge panel toggles do not grant that permission.'));
            images.append(node('p',`Last image-rule installation: ${r.lastSync?.status??'not recorded'}. Image-rule exclusions below are separate from panel support; larger panels can be handled successfully by Display Bridge.`));
            if(r.lastSync?.issues?.length) lines(images,r.lastSync.issues.map(issue=>{
                const match=/^Card rule (\d+):/.exec(issue);
                const adapted=report.discovery?.rules?.find(rule=>rule.number===Number(match?.[1])&&rule.status==='adapted');
                return adapted?`${issue} Panel handled by ${panelNames[adapted.adapter]}.`:issue;
            }));
        }
        if(report.imageIssues.length) lines(images,report.imageIssues.map(x=>`${x.reference}: ${x.status}`));
        if(report.recoveryAvailable) {
            action(images,'Rescan local images','rescan');action(images,'Review / reinstall image rules','resync');
        }
        const discovery=section('Imported rules and effects');
        if(!report.discovery) discovery.append(node('p','Per-rule results were not recorded. Attach the original card to generate them.'));
        else {
            if(report.discovery.explicitProfile) discovery.append(node('p','An explicit UI profile supplied the panels. Other source rules were not translated by discovery.'));
            lines(discovery,report.discovery.rules.map(r=>`${r.number}. ${r.label} [${r.type}]: ${r.status}. ${r.reason}${r.macros?.length?` Source macro names: ${r.macros.join(', ')}. Only reviewed adapter behaviour is available.`:''}`));
            lines(discovery,report.discovery.effects.map(e=>`Effect ${e.number} [${e.type}]: ${e.reason}`));
            if(!report.discovery.rules.length&&!report.discovery.effects.length) discovery.append(node('p','No source rules or trigger effects were included.'));
        }
        const runtime=section('Current display and potential conflicts');
        lines(runtime,[`${report.runtime.mounted} visible panels; ${report.runtime.incomplete} incomplete and ${report.runtime.unsupported} unsupported blocks.`,
            ...report.runtime.conflicts,...report.conflicts.map(x=>`Potential overlapping native rule: ${x}. Check its placement and permission in Regex settings.`),...report.notes]);
        runtime.append(node('p','Panels use matching message text; supported automatic roster placement can supply a roster without a marker. Witchcure roster/map use the latest two messages; status uses the latest six.'));
        if(report.persistence){
            const prefs=section('Saved view preferences');
            prefs.append(node('p',report.persistence.chat?`Roster/report choice is saved for this chat: ${report.persistence.mode}. New chats and branches start independently.`:'This chat has no stable saved name yet. Its view choice is temporary.'));
            prefs.append(node('p','Portrait preset choices are saved per chat, including one undo step. Gallery posts, Witchcure portrait details and map popups remain temporary. Preference files include chat names but no message text.'));
            action(prefs,'Reset this chat’s view choice','reset-chat');action(prefs,'Reset all view choices for this character','reset-card');
            action(prefs,'Export view preferences','export-preferences');action(prefs,'Load view preferences','import-preferences');
        }
        const recovery=section('Recovery');
        recovery.open=same?open.includes('Recovery'):true;
        recovery.append(node('p','Attach the original card to recover embedded assets or missing UI source without creating another character. Rescan uses retained metadata and local files; it cannot recover missing archive bytes.'));
        if(report.recoveryAvailable) {
            action(recovery,'Attach original card images and UI','attach');
            if(provider.replacementRecovery?.supported) {
                action(recovery,'Repair images from original source','repair');
                action(recovery,'Replace selected card with recovery backup','replace');
                const point=provider.replacementRecovery;
                recovery.append(node('p',`Card replacement recovery: ${point.status}. New imports keep embedded images separate from other cards’ native asset folders.`));
                if(point.status!=='none') {
                    if(!['restored','kept','unavailable','writing','restoring'].includes(point.status))action(recovery,'Restore card from recovery point','undo');
                    if(point.status!=='unavailable')action(recovery,'Export recovery backup','backup');
                    if(!['restored','kept','unavailable'].includes(point.status))action(recovery,'Keep current card; close recovery point','keep');
                    if(point.error)recovery.append(node('p',point.error));
                    recovery.append(node('p','Restoring checks for later card/settings edits. Recovery backups contain card text and local image paths. Keep them private. Chats and old image files are retained.'));
                }
            }
            if(report.delivery?.status==='pending') action(recovery,'Retry this card’s UI delivery','retry');
            for(const item of report.provider.unboundImports??[])action(recovery,`Review unassigned source: ${item.name}`,`bind-pending:${item.id}`);
        }
        if(report.delivery?.status==='mapping') recovery.append(node('p','Mapping is unfinished. If the import is no longer running, attach the original card again.'));
        action(recovery,'Rebuild current panels','rebuild');
        if(report.canRestore) action(recovery,'Restore previous panel settings','restore');
        recovery.append(node('p','Applying a UI profile saves one previous set of panel settings. Restore affects only panels and templates; image files and native regex rules have separate ownership.'));
        action(recovery,'Export compatibility report','export');
        recovery.append(node('p','The report contains character identity, asset/rule labels and diagnostic messages. It excludes prompts, chat text, source scripts and image file paths. Review labels before sharing.'));
        host.append(status);
    }
    return {host,update};
}
