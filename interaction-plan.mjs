import {PRINT_DEFAULTS,printOptions} from './print-settings.mjs';

export const GIFT_KINDS=[['heart','小心心 / 爱心'],['duck','加油鸭'],['love','爱你呦'],['beer','大啤酒'],['lollipop','棒棒糖'],['price5','单个 5–9 抖币礼物'],['price10','单个 10 抖币及以上'],['other','其他礼物']];
export const GIFT_LEVELS={heart:1,beer:2,lollipop:2,duck:3,love:4,price5:2,price10:3,other:1};
export function giftLevelFor(event,kind=giftKind(event)){
 const value=Number(event.diamondCount??event.unitPrice??event.diamond_count??event.price);
 if(Number.isFinite(value)&&value>0)return value>=50?4:value>=10?3:value>=5?2:1;
 return GIFT_LEVELS[kind]||1;
}
export function giftKind(event){
 const name=String(event.raw||event.giftName||event.gift||'');
 if(/爱你哟|爱你呦/.test(name)||event.gift==='love')return 'love';
 if(/加油鸭/.test(name)||event.gift==='duck')return 'duck';
 if(/啤酒/.test(name)||event.gift==='beer')return 'beer';
 if(/棒棒糖/.test(name)||event.gift==='lollipop')return 'lollipop';
 if(/爱心|红心|心心/.test(name)||event.gift==='heart')return 'heart';
 if(event.gift==='price5'||event.gift==='price10')return event.gift;
 const price=Number(event.diamondCount??event.unitPrice);
 if(Number.isFinite(price)&&price>=10)return 'price10';
 if(Number.isFinite(price)&&price>=5)return 'price5';
 return 'other';
}
export function giftPlan(event,settings){
 const kind=giftKind(event),options=printOptions(settings,kind,'礼物');
 const giftLevel=giftLevelFor(event,kind);
 const price=Number(event.diamondCount??event.unitPrice??event.diamond_count??event.price);
 return {kind,...options,giftLevel,priorityValue:giftLevel*1000+(Number.isFinite(price)&&price>0?Math.min(price,999):0),giftName:String(event.raw||event.giftName||GIFT_KINDS.find(([k])=>k===kind)?.[1]||'礼物').slice(0,24)};
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
 Object.assign(settings,{comment:true,commentKeyword:'666',like:true,likeThreshold:30,follow:true,fansclub:true,share:true,gift:true,giftPriority:true,commentCount:1,commentSize:'small',likeCount:1,likeSize:'small',followCount:1,followSize:'small',fansclubCount:1,fansclubSize:'small',shareCount:1,shareSize:'small',heartCount:1,beerCount:2,lollipopCount:3,duckCount:2,duckSize:'huge',loveCount:5,loveSize:'huge',price5Count:1,price5Size:'large',price10Count:1,price10Size:'huge',otherCount:5,otherSize:'huge'});
 return settings;
}
