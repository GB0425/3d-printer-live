// Field references and sampled payload documentation:
// https://github.com/opedium/douyin-live-proto/blob/master/docs/complete_payload_reference.md
import {namedGiftKey,namedGiftLabelForId} from './douyin-gifts.mjs';

const normalize=value=>String(value??'').replace(/[\u200B\uFEFF]/g,'').replace(/\s+/g,' ').trim();
const MATCH_WINDOW_MS=2500;

export function decodeInteraction(method,payload,decode,fallbackUser){
 const fields=decode(payload),number=(items,n)=>Number(items.find(f=>f.n===n&&f.wire===0)?.num||0n),bytes=(items,n)=>items.find(f=>f.n===n&&f.wire===2)?.buf;
 const str=(items,n)=>bytes(items,n)?.toString('utf8')||'';
 const id=(items,n)=>String(items.find(f=>f.n===n&&f.wire===0)?.num||'');
 const common=decode(bytes(fields,1)||new Uint8Array());
 if(method==='WebcastLightGiftMessage'){
  const gift=decode(bytes(fields,7)||new Uint8Array());
  const giftId=id(gift,1),raw=namedGiftLabelForId(giftId),userId=id(fields,5);
  const sender=userId&&fallbackUser?.userId===userId?fallbackUser:null;
  const count=number(fields,10);
  if(!raw||!sender?.name||!Number.isSafeInteger(count)||count<1)return null;
  return {...sender,msgId:id(common,2),protocol:true,lightGift:true,type:'gift',gift:raw,raw,giftId,
   count,diamondCount:number(gift,3)||null};
 }
 const userField=method==='WebcastGiftMessage'?7:method==='WebcastLikeMessage'?5:method==='WebcastFansclubMessage'?4:2;
 const uf=decode(bytes(fields,userField)||new Uint8Array());
 const senderId=id(uf,1);
 const fallback=method==='WebcastGiftMessage'
  ? (senderId&&senderId===fallbackUser?.userId?fallbackUser:null) : fallbackUser;
 const name=str(uf,3)||fallback?.name;if(!name)return null;
 const image=decode(bytes(uf,11)||bytes(uf,10)||bytes(uf,9)||new Uint8Array());
 const user={name,avatar:str(image,1)||fallback?.avatar||'',userId:senderId||fallback?.userId||''};
 const base={...user,msgId:id(common,2),protocol:true};
 if(method==='WebcastChatMessage'){const text=str(fields,3);return text?{...base,type:'comment',text}:null}
 if(method==='WebcastSocialMessage'){const action=number(fields,4);return action===1?{...base,type:'follow'}:action===2?{...base,type:'share'}:null}
 if(method==='WebcastFansclubMessage')return number(fields,2)===2?{...base,type:'fansclub'}:null;
 if(method==='WebcastMemberMessage')return {...base,type:'join'};
 if(method==='WebcastLikeMessage')return {...base,type:'like',count:Math.max(1,number(fields,2)),attribution:'protocol'};
 if(method==='WebcastGiftMessage'){
  const gift=decode(bytes(fields,15)||new Uint8Array());
  const giftId=id(fields,2)||id(gift,5),raw=str(gift,16)||namedGiftLabelForId(giftId);
  if(!raw)return null;
  const repeatEnd=!!number(fields,9),groupId=id(fields,11);
  const repeatCount=Math.max(number(fields,5),number(fields,6),repeatEnd?number(fields,29):0);
  return {...base,type:'gift',raw,gift:raw,count:repeatCount||number(fields,4)||1,
   diamondCount:number(gift,12)||null,giftId,groupId,
   combo:!!number(gift,10)||!!(groupId&&repeatEnd),repeatEnd};
 }
 return null;
}

export class ProtocolEventFilter{
 constructor(){this.reset()}
 reset(){this.ids=new Set();this.combos=new Map();this.pending={protocol:new Map(),page:new Map()};this.pendingGifts={protocol:new Map(),page:new Map()}}
 accept(event){
  if(!event)return null;
  if(event.msgId){const id=event.type+':'+event.msgId;if(this.ids.has(id))return null;this.ids.add(id);if(this.ids.size>2000)this.ids.delete(this.ids.values().next().value)}
  if(event.type==='gift'&&event.combo&&event.groupId){const key=[event.userId||event.name,event.giftId||event.raw,event.groupId].join(':');const old=this.combos.get(key)||0;this.combos.delete(key);this.combos.set(key,Math.max(old,event.count));if(this.combos.size>512)this.combos.delete(this.combos.keys().next().value);if(event.count<=old)return null;event={...event,count:event.count-old}}
  if(event.type==='gift')return this.reconcileGift(event,'protocol');
  return this.matchSource(event,'protocol')?event:null;
 }
 acceptPage(event){
  if(event.type==='gift')return this.reconcileGift(event,'page');
  return this.matchSource(event,'page')?event:null;
 }
 reconcileGift(event,source){
  let count=Number(event.count??1);
  if(!Number.isSafeInteger(count)||count<1)return null;
  const raw=normalize(event.raw||event.gift);
  const named=namedGiftKey(raw);
  const key=JSON.stringify([normalize(event.name),named||raw]);
  const now=Date.now(),own=this.pendingGifts[source],other=this.pendingGifts[source==='page'?'protocol':'page'];
  const outstanding=(other.get(key)||[]).filter(entry=>now-entry.at<=MATCH_WINDOW_MS);
  while(count>0&&outstanding.length){
   const entry=outstanding[0],matched=Math.min(count,entry.count);
   count-=matched;entry.count-=matched;
   if(!entry.count)outstanding.shift();
  }
  if(outstanding.length)other.set(key,outstanding);else other.delete(key);
  if(!count)return null;
  // Unpriced page-only gifts cannot trigger the generic price rules or mask a later priced message.
  if(source!=='page'||named||Number(event.diamondCount)>0){
   const recent=(own.get(key)||[]).filter(entry=>now-entry.at<=MATCH_WINDOW_MS);
   recent.push({at:now,count});
   own.delete(key);own.set(key,recent);
   if(own.size>1000)own.delete(own.keys().next().value);
  }
  return count===event.count?event:{...event,count};
 }
 matchSource(event,source){
  if(event.type==='gift')return !!this.reconcileGift(event,source);
  const key=JSON.stringify([event.type,normalize(event.name),normalize(event.text??event.raw)]);
  const own=this.pending[source],other=this.pending[source==='protocol'?'page':'protocol'];
  const now=Date.now();
  const outstanding=(other.get(key)||[]).filter(time=>now-time<=MATCH_WINDOW_MS);
  if(outstanding.length){
   outstanding.shift();
   if(outstanding.length)other.set(key,outstanding);else other.delete(key);
   return false;
  }
  other.delete(key);
  const latest=(own.get(key)||[]).filter(time=>now-time<=MATCH_WINDOW_MS);
  latest.push(now);
  own.delete(key);
  own.set(key,latest);
  while(own.size>1000)own.delete(own.keys().next().value);
  return true;
 }
}
