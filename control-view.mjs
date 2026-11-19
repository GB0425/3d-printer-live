const root=document.getElementById('config'),notice=document.getElementById('notice');let signature=null,polling=false,pending=0,installedHead=false,chain=Promise.resolve();
const api=()=>window.pywebview?.api;
let stateChannel=globalThis.BroadcastChannel?new BroadcastChannel('printer-control-state'):null;
async function getSnapshot(){
 if(stateChannel){
  const channel=stateChannel,id=crypto.randomUUID();
  const state=await new Promise(resolve=>{
   const timeout=setTimeout(()=>{channel.onmessage=null;resolve(null)},400);
   channel.onmessage=({data})=>{
    if(data?.type!=='snapshot'||data.id!==id)return;
    clearTimeout(timeout);
    channel.onmessage=null;
    resolve(data.state);
   };
   channel.postMessage({type:'request',id,signature});
  });
  if(state)return state;
  channel.close();
  stateChannel=null;
 }
 return api().control_snapshot(signature);
}
function command(data){pending++;chain=chain.catch(()=>{}).then(()=>api().control_action(data)).catch(e=>{notice.textContent='操作未完成：'+e.message}).finally(()=>{pending--});return chain}
async function refresh(){if(polling||pending||!api())return;polling=true;try{
 const state=await getSnapshot();if(!state)return;
 if(state.html!==null){if(!installedHead){document.head.insertAdjacentHTML('beforeend',state.head);installedHead=true}root.innerHTML=state.html;root.querySelector('#direct-output')?.remove();}
 for(const field of state.fields){const el=root.querySelector('[data-remote-id="'+field.id+'"]');if(!el)continue;el.hidden=field.hidden;if(field.disabled!==undefined)el.disabled=field.disabled;if(field.open!==undefined)el.open=field.open;if(el!==document.activeElement&&el.type!=='file'){if(field.value!==undefined)el.value=field.value;if(field.checked!==undefined)el.checked=field.checked}if(field.tag==='BUTTON'&&el.textContent!==field.text)el.textContent=field.text}
 for(const [selector,html]of Object.entries(state.statuses)){const el=root.querySelector(selector);if(el&&el.innerHTML!==html)el.innerHTML=html}
 if(state.historyRows){
  const history=root.querySelector('#print-history');
  if(history){
   history.insertAdjacentHTML('afterbegin',state.historyRows);
   while(history.childElementCount>30)history.lastElementChild.remove();
  }
 }
 signature=state.signature;
 notice.textContent='配置与直播画面同时运行 · 修改会实时生效';
}catch(e){notice.textContent='等待打印主窗口连接…'}finally{polling=false}}
root.addEventListener('click',e=>{const el=e.target.closest('button,summary');if(el?.dataset.remoteId){e.preventDefault();command({id:el.dataset.remoteId,type:'click'})}});
function change(e){const el=e.target;if(!el.dataset.remoteId||el.type==='file')return;command({id:el.dataset.remoteId,type:e.type,value:el.value,checked:['checkbox','radio'].includes(el.type)?el.checked:undefined})}
root.addEventListener('input',change);root.addEventListener('change',async e=>{const el=e.target;if(el.type==='file'){const files=await Promise.all([...el.files].map(file=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve({name:file.name,data:r.result});r.onerror=reject;r.readAsDataURL(file)})));command({id:el.dataset.remoteId,type:'files',files})}else change(e)});
root.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches('input,textarea')){e.preventDefault();command({id:e.target.dataset.remoteId,type:'enter',value:e.target.value})}});
window.addEventListener('pywebviewready',refresh);setInterval(refresh,1000);refresh();
