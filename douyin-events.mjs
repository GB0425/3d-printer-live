// Field references and sampled payload documentation:
// https://github.com/opedium/douyin-live-proto/blob/master/docs/complete_payload_reference.md
import {namedGiftKey} from './douyin-gifts.mjs';

export function decodeInteraction(method,payload,decode,fallbackUser){
 const fields=decode(payload),number=(items,n)=>Number(items.find(f=>f.n===n&&f.wire===0)?.num||0n),bytes=(items,n)=>items.find(f=>f.n===n&&f.wire===2)?.buf;
 const str=(items,n)=>bytes(items,n)?.toString('utf8')||'';
 const common=decode(bytes(fields,1)||new Uint8Array());
 const userField=method==='WebcastGiftMessage'?7:method==='WebcastLikeMessage'?5:method==='WebcastFansclubMessage'?4:2;
 const uf=decode(bytes(fields,userField)||new Uint8Array());
 const name=str(uf,3)||fallbackUser?.name;if(!name)return null;
 const image=decode(bytes(uf,11)||bytes(uf,10)||bytes(uf,9)||new Uint8Array());
 const user={name,avatar:str(image,1)||fallbackUser?.avatar||'',userId:String(uf.find(f=>f.n===1&&f.wire===0)?.num||'')};
 const base={...user,msgId:String(common.find(f=>f.n===2&&f.wire===0)?.num||''),protocol:true};
 if(method==='WebcastChatMessage'){const text=str(fields,3);return text?{...base,type:'comment',text}:null}
 if(method==='WebcastSocialMessage'){const action=number(fields,4);return action===1?{...base,type:'follow'}:action===2?{...base,type:'share'}:null}
 if(method==='WebcastFansclubMessage')return number(fields,2)===2?{...base,type:'fansclub'}:null;
 if(method==='WebcastMemberMessage')return {...base,type:'join'};
 if(method==='WebcastLikeMessage')return {...base,type:'like',count:Math.max(1,number(fields,2)),attribution:'protocol'};
 if(method==='WebcastGiftMessage'){
  const gift=decode(bytes(fields,15)||new Uint8Array());const raw=str(gift,16);if(!raw)return null;
  return {...base,type:'gift',raw,gift:raw,count:Math.max(1,number(fields,5)||number(fields,4)||1),diamondCount:number(gift,12)||null,giftId:String(fields.find(f=>f.n===2&&f.wire===0)?.num||''),groupId:String(fields.find(f=>f.n===11&&f.wire===0)?.num||''),combo:!!number(gift,10),repeatEnd:!!number(fields,9)};
 }
 return null;
}

export class ProtocolEventFilter{
 constructor(){this.reset()}
 reset(){this.ids=new Set();this.combos=new Map();this.pending={protocol:new Map(),page:new Map()}}
 accept(event){
  if(!event)return null;
  if(event.msgId){const id=event.type+':'+event.msgId;if(this.ids.has(id))return null;this.ids.add(id);if(this.ids.size>2000)this.ids.delete(this.ids.values().next().value)}
  if(event.type==='gift'&&event.combo&&event.groupId){const key=[event.userId||event.name,event.giftId,event.groupId].join(':');const old=this.combos.get(key)||0;this.combos.set(key,Math.max(old,event.count));if(this.combos.size>512)this.combos.delete(this.combos.keys().next().value);if(event.count<=old)return null;event={...event,count:event.count-old}}
  return this.matchSource(event,'protocol')?event:null;
 }
 matchSource(event,source){
  const normalize=value=>String(value??'').replace(/[\u200B\uFEFF]/g,'').replace(/\s+/g,' ').trim();
  const raw=normalize(event.text??event.raw);
  const named=event.type==='gift'?namedGiftKey(raw):null;
  const key=JSON.stringify([event.type,normalize(event.name),named||raw]);
  const own=this.pending[source],other=this.pending[source==='protocol'?'page':'protocol'];
  const now=Date.now(),windowMs=2500;
  const outstanding=(other.get(key)||[]).filter(time=>now-time<=windowMs);
  if(outstanding.length){
   outstanding.shift();
   if(outstanding.length)other.set(key,outstanding);else other.delete(key);
   return false;
  }
  other.delete(key);
  // An unpriced page row cannot trigger a generic price rule. Keep the priced protocol event.
  if(event.type==='gift'&&source==='page'&&!named&&!Number(event.diamondCount))return true;
  const latest=(own.get(key)||[]).filter(time=>now-time<=windowMs);
  latest.push(now);
  own.delete(key);
  own.set(key,latest);
  while(own.size>1000)own.delete(own.keys().next().value);
  return true;
 }
}
