// The configuration window contains DOM controls only. The original page owns
// all state, live connections, rendering and printing.
export function createControlBridge(doc=document,{shareState=false}={}){
 const ids=new WeakMap(),nodes=new Map(),statusCache=new Map();
 const statusSelectors=['#status','#mode','#live-status','#room-open-status','#live-fetch','#capture-status','#complete-test-log','#interaction-audit','#queue','#print-history','#stat-likes','#stat-comments','#stat-gifts','#count','#waiting','#print-progress','#yield-note','#speech-caption','#workshop-preview-note'];
 const statusSelector=statusSelectors.join(','),dirtyStatuses=new WeakSet();
 function markStatusChanges(records){
  for(const {target} of records){
   const status=(target.nodeType===1?target:target.parentElement)?.closest(statusSelector);
   if(status)dirtyStatuses.add(status);
  }
 }
 const Observer=doc.defaultView?.MutationObserver;
 const observer=Observer?new Observer(markStatusChanges):null;
 let sequence=0,head='',revision=0;
 function cloneControls(el){
  const copy=el.cloneNode(false);
  if(el.nodeType!==1||el.matches(statusSelector))return copy;
  for(const child of el.childNodes){
   if(child.nodeType===1&&child.matches('script,#stage,.ad-strip'))continue;
   copy.append(cloneControls(child));
  }
  return copy;
 }
 function identify(el){if(!ids.has(el))ids.set(el,String(++sequence));const id=ids.get(el);if(el.dataset.remoteId!==id)el.dataset.remoteId=id;nodes.set(id,el);return id}
 const bridge={
  snapshot(previous){
   const elements=[...doc.querySelectorAll('button,input,select,textarea,summary,details,.output-settings')],live=new Set(),fields=elements.map(el=>{const id=identify(el);live.add(id);return {id,tag:el.tagName,value:el.type==='file'?'':el.value,checked:el.checked,disabled:el.disabled,hidden:el.hidden,open:el.open,text:el.tagName==='BUTTON'?el.textContent:undefined}});
   for(const id of nodes.keys())if(!live.has(id))nodes.delete(id);
   const fieldSignature=fields.map(f=>f.id).join(',');
   let cursor;
   try{cursor=JSON.parse(previous)}catch{}
   let html=null;
   if(cursor?.fields!==fieldSignature){
    html=cloneControls(doc.body).innerHTML;
    if(!head){
     const clone=doc.head.cloneNode(true);
     clone.querySelectorAll('script,title,meta').forEach(el=>el.remove());
     head=clone.innerHTML;
    }
   }
   const statuses={},versions={};
   let historyTop='',historyRows=null;
   if(observer)markStatusChanges(observer.takeRecords());
   for(const selector of statusSelectors){
    const el=doc.querySelector(selector);
    if(!el)continue;
    if(selector==='#print-history'){
     historyTop=el.firstElementChild?.dataset.historyId||'';
     if(html!==null||cursor?.historyTop!==historyTop){
      const rows=[...el.children];
      const previous=cursor?.historyTop?rows.findIndex(row=>row.dataset.historyId===cursor.historyTop):-1;
      if(html===null&&previous>=0)historyRows=rows.slice(0,previous).map(row=>row.outerHTML).join('');
      else statuses[selector]=el.innerHTML;
     }
     continue;
    }
    let cached=statusCache.get(selector);
    if(cached?.element!==el||!observer||dirtyStatuses.has(el)){
     if(cached?.element!==el)observer?.observe(el,{childList:true,subtree:true,characterData:true,attributes:true});
     dirtyStatuses.delete(el);
     const content=el.innerHTML;
     if(cached?.element!==el||cached.content!==content){
      cached={element:el,content,version:++revision};
      statusCache.set(selector,cached);
     }
    }
    versions[selector]=cached.version;
    if(html!==null||cursor?.statuses?.[selector]!==cached.version)statuses[selector]=cached.content;
   }
   const signature=JSON.stringify({fields:fieldSignature,statuses:versions,historyTop});
   return {signature,head:html===null?null:head,html,fields,statuses,historyRows};
  },
  async action(command){
   doc.defaultView?.dispatchEvent(new Event('control-gesture'));const el=nodes.get(String(command?.id));if(!el?.isConnected)throw Error('配置已更新，请稍后重试');
   if(command.type==='click'){if(!['BUTTON','SUMMARY'].includes(el.tagName))throw Error('无效按钮');el.click()}
   else if(['input','change','enter'].includes(command.type)){
    if(!['INPUT','SELECT','TEXTAREA'].includes(el.tagName)||el.type==='file')throw Error('无效配置');
    if(typeof command.checked==='boolean')el.checked=command.checked;
    if(command.value!==undefined)el.value=String(command.value).slice(0,10000);
    if(command.type==='enter')el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));else el.dispatchEvent(new Event(command.type,{bubbles:true}));
   }else if(command.type==='files'&&el.type==='file'){
    const transfer=new DataTransfer();for(const file of command.files||[]){if(!String(file.data).startsWith('data:image/'))throw Error('仅支持图片');const blob=await(await fetch(file.data)).blob();transfer.items.add(new File([blob],file.name,{type:blob.type}))}el.files=transfer.files;el.dispatchEvent(new Event('change',{bubbles:true}));
   }else throw Error('无效操作');
   return {ok:true};
  }
 };
 if(shareState&&doc.defaultView?.BroadcastChannel){
  const channel=new doc.defaultView.BroadcastChannel('printer-control-state');
  channel.onmessage=({data})=>{
   if(data?.type!=='request'||typeof data.id!=='string')return;
   if(data.signature!==null&&(typeof data.signature!=='string'||data.signature.length>100000))return;
   channel.postMessage({type:'snapshot',id:data.id,state:bridge.snapshot(data.signature)});
  };
  doc.defaultView.addEventListener('pagehide',()=>channel.close(),{once:true});
 }
 return bridge;
}
