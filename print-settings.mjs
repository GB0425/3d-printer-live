import {NAMED_GIFTS} from './douyin-gifts.mjs';
export const PRINT_DEFAULTS={giftPriority:true,idleSeconds:30,demoGapMs:30000,commentCount:1,commentSize:'small',joinCount:1,joinSize:'small',likeCount:1,likeSize:'small',followCount:1,followSize:'small',fansclubCount:1,fansclubSize:'small',shareCount:1,shareSize:'small',giftSize:'large',heartCount:1,beerCount:2,lollipopCount:3,duckCount:2,duckSize:'huge',loveCount:5,loveSize:'huge',price5Count:1,price5Size:'large',price10Count:1,price10Size:'huge',otherCount:5,otherSize:'huge'};
export function printOptions(settings,type,source){
 const key=type!=='like'?type:({'评论':'comment','进场':'join','点赞':'like','关注':'follow','粉丝团':'fansclub','分享':'share',comment:'comment',join:'join',like:'like',follow:'follow',fansclub:'fansclub',share:'share',Comment:'comment',Join:'join',Like:'like',Follow:'follow'}[source]);
 if(!key)return {};
 const gift=['heart','beer','lollipop','duck','love','price5','price10','other'].includes(key);const count=Number(settings[key+'Count']);
 const value=settings[(gift&&['duck','love','price5','price10','other'].includes(key)?key:gift?'gift':key)+'Size'];
 return {count:Number.isInteger(count)&&count>=1&&count<=10?count:PRINT_DEFAULTS[key+'Count'],size:value==='huge'?'huge':value==='large'?'large':'small',priority:gift&&settings.giftPriority!==false};
}
export function renderPrintSettings(body,settings,save,{completionSpeechOnly=false,douyinGiftRules=false}={}){
 body.replaceChildren();
 const section=title=>{const group=document.createElement('section');group.className='print-setting-group';const h=document.createElement('h4');h.textContent=title;group.append(h);body.append(group);return group};
 const toggle=(group,key,title,description)=>{const label=document.createElement('label');label.className='print-setting-toggle';const text=document.createElement('span');text.textContent=title;if(description){const small=document.createElement('small');small.textContent=description;text.append(small)}const input=document.createElement('input');input.type='checkbox';input.checked=!!settings[key];input.onchange=()=>{settings[key]=input.checked;save()};label.append(text,input);group.append(label)};
 const select=(group,key,title,options)=>{const label=document.createElement('label');label.className='print-setting-field';const span=document.createElement('span');span.textContent=title;const input=document.createElement('select');for(const [value,text] of options){const o=document.createElement('option');o.value=String(value);o.textContent=text;input.append(o)}input.value=String(settings[key]);input.onchange=()=>{settings[key]=key.endsWith('Count')||key==='idleSeconds'||key==='demoGapMs'?Number(input.value):input.value;save()};label.append(span,input);group.append(label)};
 const sizes=[['small','小头像'],['large','大头像'],['huge','超大头像']];const counts=[1,2,3,5,10].map(n=>[n,n+' 张']);
 const trigger=section('打印触发');
 for(const [key,title] of [['comment','评论打印'],['join','进场打印'],['like','点赞打印'],['follow','关注打印'],['fansclub','加粉丝团打印'],['share','分享打印']]){const card=document.createElement('div');card.className='print-setting-card';trigger.append(card);toggle(card,key,title);if(key==='comment'){const label=document.createElement('label');label.className='print-setting-field';label.append(document.createTextNode('评论口令'));const input=document.createElement('input');input.value=settings.commentKeyword??'';input.placeholder='留空为所有评论';input.style.width='130px';input.onchange=()=>{settings.commentKeyword=input.value.slice(0,24);save()};label.append(input);card.append(label)}if(key==='like')select(card,'likeThreshold','累计点赞数',[[1,'每 1 赞'],[10,'每 10 赞'],[30,'每 30 赞'],[50,'每 50 赞']]);select(card,key+'Count','每次张数',counts);select(card,key+'Size','头像大小',sizes)}
 const gifts=section('礼物打印');toggle(gifts,'gift','礼物触发打印');toggle(gifts,'giftPriority','礼物优先插队','立即切换到礼物；未完成的普通任务保留后重打，礼物之间按顺序处理');
 if(douyinGiftRules){
  for(const gift of Object.values(NAMED_GIFTS)){
   const row=document.createElement('p');
   row.className='print-setting-field';
   row.textContent=gift.label+' · '+gift.count+' 张'+(gift.size==='huge'?'至尊头像':'大头像');
   gifts.append(row);
  }
 }else{
  select(gifts,'giftSize','头像大小',sizes);
  for(const [key,title] of [['heart','爱心'],['beer','啤酒'],['lollipop','棒棒糖']])select(gifts,key+'Count',title+' / 每个',counts);
  for(const [key,title] of [['other','其他礼物'],['duck','加油鸭'],['love','爱你呦']]){select(gifts,key+'Count',title+' / 每个',counts);select(gifts,key+'Size','头像大小',sizes)}
 }
 for(const [key,title] of [['price5','其他单价 5–9 抖币'],['price10','其他单价 10 抖币以上']]){select(gifts,key+'Count',title+' / 每个',counts);select(gifts,key+'Size','头像大小',sizes)}
 if(!completionSpeechOnly){
  const voice=section('语音播报');
  toggle(voice,'giftVoice','礼物答谢');
  toggle(voice,'joinVoice','进场欢迎');
 }
 const idle=section('空闲补位');toggle(idle,'idleFill','无互动时补测试头像');select(idle,'idleSeconds','等待时间',[5,15,30,60,120].map(n=>[n,n+' 秒']));
 const demo=section('自动演示');select(demo,'demoGapMs','自动演示补位间隔',[[0,'关闭'],[3000,'3 秒'],[5000,'5 秒'],[10000,'10 秒'],[15000,'15 秒'],[30000,'30 秒'],[60000,'60 秒'],[120000,'120 秒']]);
 const note=document.createElement('p');note.className='print-setting-note';note.textContent='自动保存 · 打印规则对新收到的互动生效，已排队任务保持不变。';body.append(note);
}
