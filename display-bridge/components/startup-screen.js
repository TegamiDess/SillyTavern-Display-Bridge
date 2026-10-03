import {createSceneSetupForm} from './scene-setup-form.js';

// Local controls only. Imported HTML, scripts and trigger names are not executed.
export function createStartupScreen({state,identity,start,current,generating,settled=()=>{}}) {
    const host=document.createElement('form'),description=document.createElement('p'),help=document.createElement('p'),status=document.createElement('p'),button=document.createElement('button');
    const form=createSceneSetupForm();
    host.className='db-startup-screen';host.setAttribute('aria-label',state.setup.title);host.noValidate=true;
    description.textContent=state.setup.screen.description;
    help.textContent='Choose your settings, then start. This saves the setup; send a message afterwards to begin the conversation.';
    help.className='db-startup-help';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    button.type='submit';button.className='menu_button';button.textContent='Start conversation';
    form.update(state,null,identity);host.append(description,form.host,help,button,status);
    let pending=false,disposed=false;
    for(const event of ['input','change'])host.addEventListener(event,()=>{if(!pending)status.textContent='';});
    const refresh=()=>{const disabled=disposed||pending||!current()||generating();form.host.disabled=disabled;button.disabled=disabled;};
    host.addEventListener('submit',async event=>{
        event.preventDefault();
        if(disposed||pending||!current()||generating())return;
        pending=true;status.textContent='Saving setup…';refresh();
        try{await start(form.values());if(!disposed)status.textContent='Setup saved. Send a message to begin.';}
        catch(e){if(!disposed)status.textContent=e.message;}
        finally{pending=false;refresh();settled();}
    });
    return {host,refresh,isSaving:()=>pending,missingImages:()=>0,dispose(){disposed=true;refresh();}};
}
