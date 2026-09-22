// Versioned, typed presentation actions. No executable strings or host calls.
const identifier = x => typeof x === 'string' && /^[a-zA-Z][\w-]{0,79}$/.test(x) && !['constructor', 'prototype', '__proto__'].includes(x);
const fail = text => { throw new Error(`Display actions: ${text}`); };
const own = (o, key) => Object.hasOwn(o, key);
function keys(value, allowed) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !allowed.includes(key))) fail('unsupported declaration fields');
}
function checkValue(spec, value) {
    if (spec.type === 'boolean' && typeof value === 'boolean') return value;
    if (spec.type === 'number' && typeof value === 'number' && Number.isFinite(value) && value >= spec.min && value <= spec.max) return value;
    if (spec.type === 'enum' && spec.values.includes(value)) return value;
    if (spec.type === 'string' && typeof value === 'string' && value.length <= spec.maxLength) return value;
    return fail('value outside its declared type or bounds');
}
function expressionType(expr, variables, dependencies, depth = 0) {
    if (depth > 24) fail('expression too deep');
    if (['boolean', 'string', 'number'].includes(typeof expr)) {
        if (typeof expr === 'number' && !Number.isFinite(expr)) fail('non-finite literal');
        if (typeof expr === 'string' && expr.length > 4096) fail('literal too long');
        return typeof expr;
    }
    if (!expr || typeof expr !== 'object' || Array.isArray(expr)) fail('invalid expression');
    if (own(expr, 'var')) {
        keys(expr, ['var']);
        if (!own(variables, expr.var)) fail(`undefined variable ${expr.var}`);
        dependencies.add(expr.var);
        return variables[expr.var].type === 'enum' ? 'string' : variables[expr.var].type;
    }
    const signatures = { not: ['boolean',1,'boolean'], and:['boolean',2,'boolean'], or:['boolean',2,'boolean'], add:['number',2,'number'], subtract:['number',2,'number'], multiply:['number',2,'number'], divide:['number',2,'number'], lt:['number',2,'boolean'], lte:['number',2,'boolean'], gt:['number',2,'boolean'], gte:['number',2,'boolean'], eq:[null,2,'boolean'], ne:[null,2,'boolean'] };
    keys(expr, ['op','args']);
    const signature = own(signatures,expr.op) && signatures[expr.op];
    if (!signature || !Array.isArray(expr.args) || expr.args.length !== signature[1]) fail('unknown expression operator or arity');
    const types = expr.args.map(arg => expressionType(arg, variables, dependencies, depth + 1));
    if (types.some(type => type !== (signature[0] ?? types[0]))) fail('expression type mismatch');
    return signature[2];
}
function evaluate(expr, state) {
    if (typeof expr !== 'object') return expr;
    if (own(expr, 'var')) return state[expr.var];
    const [a,b] = expr.args.map(arg => evaluate(arg, state));
    switch (expr.op) {
        case 'not': return !a; case 'and': return a && b; case 'or': return a || b;
        case 'eq': return a === b; case 'ne': return a !== b;
        case 'lt': return a < b; case 'lte': return a <= b; case 'gt': return a > b; case 'gte': return a >= b;
        case 'add': return a + b; case 'subtract': return a - b; case 'multiply': return a * b;
        case 'divide': if (!b) fail('division by zero'); return a / b;
    }
}
export function compileActions(input) {
    keys(input, ['schemaVersion','namespace','variables','actions','bindings']);
    if (!input || input.schemaVersion !== 1 || !identifier(input.namespace)) fail('unsupported schema or namespace');
    const definition = JSON.parse(JSON.stringify(input));
    const variables = definition.variables;
    if (!variables || !definition.actions || Object.keys(variables).length > 256 || Object.keys(definition.actions).length > 512) fail('invalid definition size');
    for (const [name, spec] of Object.entries(variables)) {
        keys(spec, ['type','default','min','max','maxLength','values']);
        if (!identifier(name) || !spec || !['boolean','number','enum','string'].includes(spec.type)) fail('invalid variable');
        if (spec.type === 'number' && (!Number.isFinite(spec.min) || !Number.isFinite(spec.max) || spec.min > spec.max)) fail('numeric bounds required');
        if (spec.type === 'string' && (!Number.isInteger(spec.maxLength) || spec.maxLength < 1 || spec.maxLength > 4096)) fail('string bound required');
        if (spec.type === 'enum' && (!Array.isArray(spec.values) || !spec.values.length || spec.values.length > 256 || spec.values.some(x => typeof x !== 'string' || x.length > 256))) fail('invalid enum');
        checkValue(spec, spec.default);
    }
    const dependencies = new Set();
    for (const [name, steps] of Object.entries(definition.actions)) {
        if (!identifier(name) || !Array.isArray(steps) || !steps.length || steps.length > 256) fail('invalid action');
        for (const step of steps) {
            keys(step, ['op','variable',...(['set','increment'].includes(step?.op) ? ['value'] : [])]);
            const spec = own(variables, step.variable) && variables[step.variable];
            if (!spec || !['set','toggle','increment','reset'].includes(step.op)) fail('unknown variable or operation');
            if (step.op === 'toggle' && spec.type !== 'boolean') fail('toggle needs boolean');
            if (step.op === 'increment' && spec.type !== 'number') fail('increment needs number');
            if (step.op === 'set' || step.op === 'increment') {
                const type = expressionType(step.value, variables, dependencies);
                if (type !== (spec.type === 'enum' ? 'string' : spec.type)) fail('assignment type mismatch');
            }
        }
    }
    for (const binding of Object.values(definition.bindings ?? {})) {
        keys(binding, ['event','action']);
        if (binding.event !== 'activate' || !own(definition.actions, binding.action)) fail('unresolved control binding');
    }
    function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
    return freeze({ ...definition, dependencies: [...dependencies] });
}
export function initialState(definition) {
    return Object.freeze(Object.fromEntries(Object.entries(definition.variables).map(([name, spec]) => [name, spec.default])));
}
export function reduceAction(definition, state, action) {
    if (!own(definition.actions, action)) fail(`unknown action ${action}`);
    const next = { ...state };
    for (const step of definition.actions[action]) {
        const spec = definition.variables[step.variable];
        let value;
        if (step.op === 'reset') value = spec.default;
        if (step.op === 'toggle') value = !next[step.variable];
        if (step.op === 'set') value = evaluate(step.value, next);
        if (step.op === 'increment') value = next[step.variable] + evaluate(step.value, next);
        next[step.variable] = checkValue(spec, value);
    }
    return Object.freeze(next); // Commit only after every step succeeds.
}
export function createActionStore({ limit = 300, onChange = () => {} } = {}) {
    const scopes = new Map();
    return {
        bind(definition, scope, isCurrent = () => true) {
            const key = JSON.stringify([scope, definition.namespace]);
            const signature = JSON.stringify(definition);
            function record() {
                let entry = scopes.get(key);
                if (!entry || entry.signature !== signature) {
                    entry = { signature, state: initialState(definition) }; scopes.set(key, entry);
                    if (scopes.size > limit) scopes.delete(scopes.keys().next().value);
                }
                return entry;
            }
            return {
                read: () => record().state,
                dispatch(action) {
                    if (!isCurrent()) return false;
                    const entry = record();
                    const next = reduceAction(definition, entry.state, action);
                    if (Object.keys(next).some(key => next[key] !== entry.state[key])) { entry.state = next; onChange(); }
                    return true;
                },
            };
        },
        clear: () => scopes.clear(),
    };
}
export const WITCH_MODE = compileActions({ schemaVersion: 1, namespace: 'witchcure-mode',
    variables: { mode: { type: 'enum', values: ['auto','roster','report'], default: 'auto' } },
    actions: { roster: [{ op:'set', variable:'mode', value:'roster' }], report: [{ op:'set', variable:'mode', value:'report' }] },
});
