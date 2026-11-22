import {PRINT_DEFAULTS} from './print-settings.mjs';
import {GIFT_KINDS,giftPlan,sizeLabel} from './interaction-plan.mjs';
export const FREE_PRINT_INTERVAL = 30;

export function countWaitingInteractions(queue) {
  const transactions = new Set();
  for(const job of queue){
    if(job.transactionId)transactions.add(job.transactionId);
  }
  return transactions.size;
}

export class FreePrintDraw {
  constructor() {
    this.viewers = new Map();
    this.awarded = 0;
  }
  remember(key, viewer, now = Date.now(), room = '') {
    this.viewers.delete(key);
    this.viewers.set(key, {viewer, now, room});
    if(this.viewers.size>128)this.viewers.delete(this.viewers.keys().next().value);
  }
  draw(completed, live, demoPeople, now = Date.now(), room = '') {
    if(completed<(this.awarded+1)*FREE_PRINT_INTERVAL)return null;
    const candidates = live
      ? Array.from(this.viewers.values()).filter(entry=>entry.room===room&&now-entry.now<300000).map(entry=>entry.viewer)
      : demoPeople;
    if(!candidates.length)return null;
    this.awarded++;
    return candidates[Math.floor(Math.random()*candidates.length)];
  }
}
// Counts represent received events in this page session, never room-wide totals.
export function eventAmount(value, limit = Infinity) {
  const n = Math.floor(Number(value));
  return Number.isSafeInteger(n) ? Math.max(1, Math.min(limit, n)) : 1;
}

export class WorkshopSession {
  constructor() {
    this.live = this.empty(); this.demo = this.empty(); this.sequence = 0;
  }
  empty() { return {comments:0, likes:0, gifts:0, completed:0, supporters:new Map(), top:[], topDirty:false, recent:null}; }
  observe(event, live = true) {
    const bucket = live ? this.live : this.demo;
    const name = String(event.name || event.nickname || '直播观众').slice(0,40);
    const amount = eventAmount(event.count, live ? Infinity : 100);
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
  get totalCompleted() { return this.live.completed + this.demo.completed; }
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

export function workshopRules(settings,{freePrint=false}={}) {
  const size = sizeLabel;
  const count = key => Number.isInteger(Number(settings[key])) && Number(settings[key])>=1 && Number(settings[key])<=10 ? Number(settings[key]) : PRINT_DEFAULTS[key];
  const lines = [];
  for (const [key,label] of [['comment',String(settings.commentKeyword||'').trim()?'评论“'+settings.commentKeyword+'”':'评论'],['like','点赞 '+(settings.likeThreshold||1)+' 下'],['follow','关注'],['fansclub','加粉丝团'],['share','分享'],['join','进场']]) {
    if(key==='join'&&!settings[key])continue;
    lines.push({icon:key==='comment'?'▣':key==='like'?'♡':'+',label,enabled:!!settings[key],detail:settings[key]?`${count(key+'Count')} 张${size(settings[key+'Size'])}`:'已关闭'});
  }
  if(freePrint)lines.push({icon:'✦',label:'每 '+FREE_PRINT_INTERVAL+' 张抽 1 位',detail:'免费大头像'});
  const giftOrder={heart:1,beer:2,lollipop:3,price5:4,price10:5,duck:6,love:7,other:8};
  const giftLabels={duck:'加油鸭',love:'爱你呦',price5:'单价5–9抖币',price10:'单价10抖币以上'};
  const gifts = settings.gift ? GIFT_KINDS.filter(([key])=>key!=='other').map(([key,label])=>{const plan=giftPlan({gift:key,raw:label},settings);return {key,label:giftLabels[key]||label,detail:key==='other'?`${plan.count} 张${plan.size==='huge'?'至尊大头像':size(plan.size)}`:key==='duck'?`${plan.count} 张${plan.size==='huge'?'至尊头像':size(plan.size)}`:key==='love'?`${plan.count} 张${plan.size==='huge'?'至尊头像':size(plan.size)}`:`${plan.count} 张${size(plan.size)}`}}).sort((a,b)=>giftOrder[a.key]-giftOrder[b.key]) : [];
  return {lines,gifts,priority:settings.giftPriority!==false,giftVoice:!!settings.giftVoice};
}
