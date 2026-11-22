import {test} from 'node:test';import assert from 'node:assert/strict';import {DemoRules} from './demo-rules.mjs';
test('gift score stays 85–99 across copies and priority insertion preserves the active transaction',()=>{for(let n=0;n<100;n++){const r=new DemoRules();const a=r.event('love',{name:'甲'},'a',1,{priorityValue:4000});assert.equal(a.added,3);assert.equal(new Set(a.jobs.map(j=>j.score)).size,1);assert.ok(a.jobs[0].score>=85&&a.jobs[0].score<=99);const active=r.queue.shift();r.event('heart',{name:'乙'},'b',1,{priorityValue:1000,protectTransactionId:active.transactionId});r.event('love',{name:'丙'},'c',1,{priorityValue:4050,protectTransactionId:active.transactionId});assert.deepEqual(r.queue.map(j=>j.name),['甲','甲','丙','丙','丙','乙']);assert.ok(r.queue.filter(j=>j.name==='甲').every(j=>j.score===active.score))}});

test('直播入队保留普通互动顺序，礼物按价格排在已开工礼物之后',async()=>{
 const {readFileSync}=await import('node:fs');
 const {runInNewContext}=await import('node:vm');
 const {PRINT_DEFAULTS,printOptions}=await import('./print-settings.mjs');
 const {scorePortrait}=await import('./workshop-score.mjs');
 const {giftPlan}=await import('./interaction-plan.mjs');
 const html=readFileSync(new URL('./index.html',import.meta.url),'utf8');
 const code=html.slice(html.indexOf('function liveEvent('),html.indexOf('\nlet liveRoom='));
 const engine=new DemoRules();
 let preemptions=0;
 const state={demoEngine:engine,printOptions,scorePortrait,viewerSince:{live:new Map()},printRules:PRINT_DEFAULTS,busy:false,lastLiveMsgAt:0,
  machineAudio:{cue(){}},preemptForGift(){preemptions++},renderQueue(){},updateScreen(){},next(){}};
 runInNewContext(code,state);
 const push=(name,source)=>{
  if(!source.startsWith('礼物·'))return state.liveEvent('like',{name},1,source,true);
  const plan=giftPlan({raw:source.slice(3)},PRINT_DEFAULTS);
  return state.liveEvent(plan.kind,{name},1,source,true,plan);
 };
 assert.equal(push('已开工','礼物·鲜花'),2);
 state.active=engine.queue.shift();
 state.busy=true;
 push('先关注','关注');
 push('后评论','评论');
 push('低价','礼物·人气票');
 push('高价','礼物·加油鸭');
 push('再评论','评论');
 assert.deepEqual(engine.queue.map(job=>job.name),[
  '已开工','高价','高价','高价','低价','先关注','后评论','再评论'
 ]);
 assert.ok(engine.queue.filter(job=>job.source.startsWith('礼物')).every(job=>job.score>=96));
 assert.equal(engine.queue.find(job=>job.name==='低价').size,'large');
 assert.equal(engine.queue.find(job=>job.name==='高价').size,'huge');
 assert.equal(preemptions,3);
});
