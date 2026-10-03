export function createSceneSetupForm() {
    const host=document.createElement('fieldset'),title=document.createElement('legend'),fields=document.createElement('div'),reset=document.createElement('button');
    reset.type='button';reset.className='menu_button';reset.textContent='Reset setup fields';
    host.className='db-scene-setup';host.append(title,fields,reset);
    let signature=null,config=null,inputs=new Map();
    const write=(input,definition,value)=>{if(definition.type==='boolean')input.checked=value===true;else input.value=value===null?'':String(value);};
    reset.addEventListener('click',()=>{
        for(const f of config.setup.fields)if(f.reset)write(inputs.get(f.key),config.variables[f.key],config.variables[f.key].initial);
        // Reset is a draft edit too; notify consumers so obsolete feedback clears.
        host.dispatchEvent(new Event('input',{bubbles:true}));
    });
    return {host,
        update(state,saved,identity){
            host.hidden=!state?.setup;if(!state?.setup){signature=null;config=null;return;}
            const next=JSON.stringify([identity,state,saved]);if(signature===next)return;
            signature=next;config=state;inputs=new Map();fields.replaceChildren();title.textContent=state.setup.title;
            for(const f of state.setup.fields){
                const definition=state.variables[f.key],value=saved&&Object.hasOwn(saved,f.key)?saved[f.key]:definition.initial,label=document.createElement('label'),caption=document.createElement('span');caption.textContent=f.label+(f.required?' *':'');
                const input=document.createElement(definition.type==='enum'?'select':definition.type==='string'?'textarea':'input');
                input.className='text_pole';input.setAttribute('aria-label',f.label);input.required=f.required;
                if(definition.type==='enum'){
                    if(definition.initial===null||value===null){const o=document.createElement('option');o.value='';o.textContent='Choose…';input.append(o);}
                    for(const value of definition.values){const o=document.createElement('option');o.value=value;o.textContent=value;input.append(o);}
                }else if(definition.type==='boolean')input.type='checkbox';
                else if(definition.type==='number'){input.type='number';input.min=definition.min;input.max=definition.max;}
                else {input.rows=2;input.maxLength=definition.maxLength??256;}
                write(input,definition,value);inputs.set(f.key,input);label.append(caption,input);fields.append(label);
            }
        },
        values(){return config?Object.fromEntries(config.setup.fields.map(f=>{const d=config.variables[f.key],input=inputs.get(f.key);return [f.key,d.type==='boolean'?input.checked:d.type==='number'?(input.value===''?null:Number(input.value)):d.type==='enum'&&input.value===''?null:input.value];})):null;},
    };
}
