import {PRINT_DEFAULTS,printOptions} from './print-settings.mjs';
import {NAMED_GIFTS,namedGiftKey} from './douyin-gifts.mjs';

export const GIFT_KINDS=[
 ...Object.entries(NAMED_GIFTS).map(([key,gift])=>[key,gift.label]),
 ['price5','单价5–9抖币'],['price10','单价10抖币以上']
];
const unitPrice=event=>Number(event.diamondCount??event.unitPrice??event.diamond_count??event.price);
export function giftLevelFor(event,kind=giftKind(event)){
 if(Object.hasOwn(NAMED_GIFTS,kind))return NAMED_GIFTS[kind].level;
 const price=unitPrice(event);
 return price>=50?4:kind==='price10'?3:kind==='price5'?2:0;
}
export function giftKind(event){
 const named=namedGiftKey(event.raw||event.giftName)||namedGiftKey(event.gift);
 if(named)return named;
 if(event.gift==='price5'||event.gift==='price10')return event.gift;
 const price=unitPrice(event);
 if(!Number.isFinite(price))return null;
 if(Number.isFinite(price)&&price>=10)return 'price10';
 if(Number.isFinite(price)&&price>=5)return 'price5';
 return null;
}
export function giftPlan(event,settings){
 const kind=giftKind(event);
 if(!kind)return null;
 const named=Object.hasOwn(NAMED_GIFTS,kind)?NAMED_GIFTS[kind]:null;
 const options=named?{count:named.count,size:named.size,priority:settings.giftPriority!==false}:printOptions(settings,kind,'礼物');
 const giftLevel=giftLevelFor(event,kind);
 const receivedPrice=unitPrice(event);
 const price=Number.isFinite(receivedPrice)&&receivedPrice>0?receivedPrice:named?.price??(kind==='price10'?10:5);
 const priceTier=price>=50?4:price>=10?3:price>=5?2:1;
 return {kind,...options,giftLevel,priorityValue:priceTier*1000+Math.min(price,999),giftName:String(event.raw||event.giftName||GIFT_KINDS.find(([k])=>k===kind)?.[1]||'礼物').slice(0,24)};
}
export const sizeLabel=size=>size==='huge'?'超大头像':size==='large'?'大头像':'小头像';

export class InteractionGate{
 constructor(){this.likes=new Map()}
 reset(){this.likes.clear()}
 accept(event,settings,live=true){
  this.reason='';const type=event.type||'comment';if(!settings[type]){this.reason='该互动打印开关已关闭';return 0}
  if(event.attribution==='roster'||event.attribution==='inferred'){this.reason='没有可靠的真实操作人，不触发打印';return 0}
  if(type==='comment'){const word=String(settings.commentKeyword??'').trim();const accepted=!word||String(event.text||'').includes(word);if(!accepted)this.reason='评论不含口令“'+word+'”';return accepted?1:0}
  const key=(live?'live:':'demo:')+String(event.userId||event.name||event.nickname||'观众');
  if(type==='like'){
   const threshold=Math.max(1,Number(settings.likeThreshold)||1);
   const count=Math.floor(Number(event.count));
   const total=(this.likes.get(key)||0)+(Number.isSafeInteger(count)?Math.max(1,count):1);
   const remainder=total%threshold;
   if(remainder)this.likes.set(key,remainder);
   else this.likes.delete(key);
   const jobs=Math.floor(total/threshold);
   if(!jobs)this.reason='已累计 '+total+' / '+threshold+' 赞';
   return live?jobs:Math.min(100,jobs);
  }
  return 1;
 }
}

export function referenceRules(settings){
 Object.assign(settings,{comment:true,commentKeyword:'666',like:true,likeThreshold:30,follow:true,fansclub:true,share:true,gift:true,giftPriority:true,commentCount:1,commentSize:'small',likeCount:1,likeSize:'small',followCount:1,followSize:'small',fansclubCount:1,fansclubSize:'small',shareCount:1,shareSize:'small',price5Count:1,price5Size:'large',price10Count:1,price10Size:'huge'});
 return settings;
}
