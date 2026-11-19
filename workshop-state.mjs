import {PRINT_DEFAULTS} from './print-settings.mjs';
import {GIFT_KINDS,giftPlan,sizeLabel} from './interaction-plan.mjs';
// Counts represent received events in this page session, never room-wide totals.
export function eventAmount(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(1, Math.min(100, Math.floor(n))) : 1;
}

export class WorkshopSession {
  constructor() {
    this.live = this.empty(); this.demo = this.empty(); this.sequence = 0;
  }
  empty() { return {comments:0, likes:0, gifts:0, completed:0, supporters:new Map(), top:[], topDirty:false, recent:null}; }
  observe(event, live = true) {
    const bucket = live ? this.live : this.demo;
    const name = String(event.name || event.nickname || '直播观众').slice(0,40);
    const amount = eventAmount(event.count);
    if (event.type === 'comment') bucket.comments++;
    if (event.type === 'like') bucket.likes += amount;
    if (event.type === 'gift') {
      bucket.gifts += amount;
      bucket.supporters.set(name, (bucket.supporters.get(name) || 0) + amount);
      bucket.topDirty = true;
      bucket.recent = {id:++this.sequence, name, gift:String(event.raw || event.gift || '礼物').slice(0,32), amount, live, at:Date.now()};
    }
  }
  complete(job) { (job.live ? this.live : this.demo).completed++; }
  resetDemo() { this.demo = this.empty(); }
  snapshot(live) {
    const b = live ? this.live : this.demo;
    if(b.topDirty){
      const top=[];
      for(const entry of b.supporters){
        const index=top.findIndex(other=>other[1]<entry[1]);
        if(index>=0)top.splice(index,0,entry);
        else if(top.length<3)top.push(entry);
        if(top.length>3)top.pop();
      }
      b.top=top.map(([name,count])=>({name,count}));
      b.topDirty=false;
    }
    return {comments:b.comments, likes:b.likes, gifts:b.gifts, completed:b.completed,
      supporters:b.top, recent:b.recent};
  }
}

export function workshopRules(settings) {
  const size = sizeLabel;
  const count = key => Number.isInteger(Number(settings[key])) && Number(settings[key])>=1 && Number(settings[key])<=10 ? Number(settings[key]) : PRINT_DEFAULTS[key];
  const lines = [];
  for (const [key,label] of [['comment',String(settings.commentKeyword||'').trim()?'评论“'+settings.commentKeyword+'”':'评论'],['like','点赞 '+(settings.likeThreshold||1)+' 下'],['follow','关注'],['fansclub','加粉丝团'],['share','分享'],['join','进场']]) {
    if(key==='join'&&!settings[key])continue;
    lines.push({icon:key==='comment'?'▣':key==='like'?'♡':'+',label,enabled:!!settings[key],detail:settings[key]?`${count(key+'Count')} 张${size(settings[key+'Size'])}`:'已关闭'});
  }
  const giftOrder={heart:1,beer:2,lollipop:3,price5:4,price10:5,duck:6,love:7,other:8};
  const giftLabels={duck:'加油鸭',love:'爱你呦',price5:'单价5–9抖币',price10:'单价10抖币以上'};
  const gifts = settings.gift ? GIFT_KINDS.filter(([key])=>key!=='other').map(([key,label])=>{const plan=giftPlan({gift:key,raw:label},settings);return {key,label:giftLabels[key]||label,detail:key==='other'?`${plan.count} 张${plan.size==='huge'?'至尊大头像':size(plan.size)}`:key==='duck'?`${plan.count} 张${plan.size==='huge'?'至尊头像':size(plan.size)}`:key==='love'?`${plan.count} 张${plan.size==='huge'?'至尊头像':size(plan.size)}`:`${plan.count} 张${size(plan.size)}`}}).sort((a,b)=>giftOrder[a.key]-giftOrder[b.key]) : [];
  return {lines,gifts,priority:settings.giftPriority!==false,giftVoice:!!settings.giftVoice};
}
