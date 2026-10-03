// Bounded, explicitly reviewed setup data. No source actions or expressions run.
const fail = message => { throw Error('Scene setup: ' + message); };
const own = (o, k) => Object.hasOwn(o, k);
const id = s => typeof s === 'string' && /^[A-Za-z][\w-]{0,59}$/.test(s) && !['__proto__', 'prototype', 'constructor'].includes(s);
const object = x => x && typeof x === 'object' && !Array.isArray(x);
const text = (s, max = 256) => typeof s === 'string' && s.length <= max && !/[{}\x00-\x08\x0b-\x1f]/.test(s);
const shape = (x, keys) => { if (!object(x) || Object.keys(x).some(k => !keys.includes(k))) fail('unknown declaration fields'); };

export function validateSetup(setup, variables) {
    shape(setup, ['version', 'title', 'fields', 'unique', 'context', 'screen']);
    if (setup.version !== 1 || !text(setup.title, 80) || !setup.title.trim() || !Array.isArray(setup.fields) || !setup.fields.length || setup.fields.length > 32) fail('invalid form');
    const seen = new Set();
    for (const f of setup.fields) {
        shape(f, ['key', 'label', 'required', 'unset', 'reset', 'native']);
        if (!id(f.key) || !own(variables, f.key) || seen.has(f.key) || !text(f.label, 80) || !f.label.trim()) fail('invalid field');
        seen.add(f.key);
        if (typeof f.required !== 'boolean' || typeof f.reset !== 'boolean' || typeof f.native !== 'boolean') fail('field policies required');
        if (!Array.isArray(f.unset) || f.unset.length > 8 || f.unset.some(v => v !== null && !text(v))) fail('invalid unset values');
    }
    if (!Array.isArray(setup.unique) || setup.unique.length > 8) fail('invalid uniqueness groups');
    for (const group of setup.unique) {
        if (!Array.isArray(group) || group.length < 2 || group.length > 8 || new Set(group).size !== group.length || group.some(k => !seen.has(k))) fail('invalid uniqueness group');
    }
    if (setup.context !== undefined) validateTemplate(setup.context, variables);
    if (setup.screen !== undefined) {
        const screen=setup.screen;
        shape(screen,['marker','description','greeting']);
        if(typeof screen.marker!=='string'||!text(screen.marker.replace(/\r\n/g,'\n'),4096)||!screen.marker.trim()||!text(screen.description,512))fail('invalid startup screen');
        if(!Array.isArray(screen.greeting)||!screen.greeting.length)fail('startup greeting required');
        // Saved greeting text must not run host macros during first-message formatting.
        validateTemplate(screen.greeting,variables,0,{nodes:0,chars:0},false);
        const visit=nodes=>{for(const n of nodes)if(typeof n!=='string'){if(n.read&&!seen.has(n.read)||n.when?.some(c=>!seen.has(c.key)))fail('startup screen reads must use setup fields');if(n.when){visit(n.then);visit(n.else);}}};
        visit(screen.greeting);
    }
    return structuredClone(setup);
}

function validateTemplate(nodes, variables, depth = 0, budget = {nodes: 0, chars: 0}, placeholders = true) {
    if (!Array.isArray(nodes) || depth > 8) fail('invalid template depth');
    for (const node of nodes) {
        if (++budget.nodes > 256) fail('template too large');
        if (typeof node === 'string') {
            budget.chars += node.length;
            // ST owns these placeholders. Other macros cannot enter a template.
            if (budget.chars > 12000 || !text(placeholders?node.replace(/\{\{(?:user|char)\}\}/g, ''):node, 12000)) fail('invalid template text');
        } else if (own(node ?? {}, 'read')) {
            shape(node, ['read']); if (!id(node.read) || !own(variables, node.read)) fail('unknown template variable');
        } else {
            shape(node, ['when', 'then', 'else']);
            if (!Array.isArray(node.when) || !node.when.length || node.when.length > 8) fail('invalid condition');
            for (const c of node.when) {
                shape(c, ['key', 'equals']);
                if (!id(c.key) || !own(variables, c.key) || !['string', 'number', 'boolean'].includes(typeof c.equals) || typeof c.equals === 'number' && !Number.isFinite(c.equals) || typeof c.equals === 'string' && !text(c.equals)) fail('invalid equality');
                const v=variables[c.key];
                if (v.type==='enum' ? !v.values.includes(c.equals) : typeof c.equals !== v.type) fail('condition type mismatch');
            }
            validateTemplate(node.then, variables, depth + 1, budget, placeholders);
            validateTemplate(node.else, variables, depth + 1, budget, placeholders);
        }
    }
}

export function renderSetupContext(nodes, values, budget = {chars: 0}) {
    const append = value => { budget.chars += value.length; if (budget.chars > 30000) fail('rendered context too large'); return value; };
    return (nodes ?? []).map(n => {
        if (typeof n === 'string') return append(n);
        if (own(n, 'read')) { if (!own(values, n.read) || values[n.read] === null) fail('unset template value: ' + n.read); return append(String(values[n.read])); }
        // Unset is not false: it cannot quietly choose the else branch.
        for (const c of n.when) if (!own(values, c.key) || values[c.key] === null) fail('unset condition value: ' + c.key);
        return renderSetupContext(n.when.every(c => values[c.key] === c.equals) ? n.then : n.else, values, budget);
    }).join('');
}

export function checkSetup(values, setup) {
    for (const f of setup.fields) if (!own(values, f.key) || f.required && (f.unset.includes(values[f.key]) || values[f.key] === null || String(values[f.key]).trim() === '')) fail('choose ' + f.label);
    for (const group of setup.unique) {
        const selected = group.map(k => ({f: setup.fields.find(f => f.key === k), value: values[k]})).filter(({f, value}) => value !== null && !f.unset.includes(value));
        if (new Set(selected.map(x => x.value)).size !== selected.length) fail('participants must be unique');
    }
    setupContext(values, setup);
}

export function setupContext(values, setup) {
    const resolved={...values};
    for(const f of setup.fields)if(f.unset.includes(resolved[f.key]))resolved[f.key]=null;
    return renderSetupContext(setup.context,resolved);
}

export function setupGreeting(values, setup) {
    const greeting=setupContext(values,{...setup,context:setup.screen.greeting});
    if(!greeting.trim()||sameSetupText(greeting,setup.screen.marker))fail('startup greeting must replace the menu marker');
    return greeting;
}

// Native card import may convert LF to Windows CRLF. No trimming, substring
// matching or macro expansion: all other greeting content must match exactly.
export const sameSetupText=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.replace(/\r\n/g,'\n')===b.replace(/\r\n/g,'\n');

export function coveredSetupMacros(source, setup) {
    const fields = new Set((setup?.fields ?? []).filter(f => f.native).map(f => f.key));
    return !!setup && source.contextSourceVersion === 1 && Array.isArray(source.macroReferences) && source.macroReferences.length > 0 && source.macroReferences.length < 1000
        && source.requiredMacros?.every(k => k === 'getvar') && source.macroReferences.every(r => r.field === 'prompt' && r.kind === 'getvar' && fields.has(r.name));
}

// Native getvar reads these chat-local values before the request interceptor.
// All bindings are explicit; collisions and subsequent external writes reject.
export function setupNativeValues(values, setup) {
    checkSetup(values, setup);
    return Object.fromEntries(setup.fields.filter(f => f.native).map(f => {
        const value=values[f.key];
        if(value===null)fail('native value is unset: '+f.key);
        if(typeof value==='string'&&value.trim()!==''&&Number.isFinite(Number(value))&&String(Number(value))!==value)fail('native numeric-text coercion would change '+f.key);
        return [f.key, typeof value==='boolean' ? String(value) : value];
    }));
}

const bindingKey='display_bridge_setup_bindings';
export function verifySetupBindings(metadata, expected, owner) {
    const saved=metadata[bindingKey];
    if(!saved||saved.owner!==owner||JSON.stringify(saved.values)!==JSON.stringify(expected))fail('native bindings need initialization or rebuild');
    for(const [k,v] of Object.entries(expected))if(!own(metadata.variables??{},k)||metadata.variables[k]!==v)fail('native variable changed outside setup: '+k);
}

export function commitSetupBindings(metadata, expected, owner) {
    const previous=metadata[bindingKey], oldVariables=metadata.variables;
    if(oldVariables!==undefined&&!object(oldVariables))fail('invalid native variable storage');
    if(previous){
        if(previous.owner!==owner||!object(previous.values))fail('native bindings belong to another configuration');
        verifySetupBindings(metadata,previous.values,owner);
        if(Object.keys(previous.values).some(k=>!own(expected,k)))fail('native bindings changed; review the existing setup');
    }
    for(const k of Object.keys(expected))if(own(oldVariables??{},k)&&!own(previous?.values??{},k))fail('native variable already exists: '+k);
    metadata.variables={...oldVariables,...expected};metadata[bindingKey]={owner,values:{...expected}};
    return ()=>{if(oldVariables===undefined)delete metadata.variables;else metadata.variables=oldVariables;if(previous===undefined)delete metadata[bindingKey];else metadata[bindingKey]=previous;};
}
