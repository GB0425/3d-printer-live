import {test} from 'node:test';import assert from 'node:assert/strict';import {DemoRules} from './demo-rules.mjs';
test('gift score stays 85–99 across copies and priority insertion preserves the active transaction',()=>{for(let n=0;n<100;n++){const r=new DemoRules();const a=r.event('love',{name:'甲'},'a',1,{priorityValue:4000});assert.equal(a.added,3);assert.equal(new Set(a.jobs.map(j=>j.score)).size,1);assert.ok(a.jobs[0].score>=85&&a.jobs[0].score<=99);const active=r.queue.shift();r.event('heart',{name:'乙'},'b',1,{priorityValue:1000,protectTransactionId:active.transactionId});r.event('love',{name:'丙'},'c',1,{priorityValue:4050,protectTransactionId:active.transactionId});assert.deepEqual(r.queue.map(j=>j.name),['甲','甲','丙','丙','丙','乙']);assert.ok(r.queue.filter(j=>j.name==='甲').every(j=>j.score===active.score))}});

test('直播入队保留普通互动顺序，礼物按价格排在已开工礼物之后',async()=>{
 const {readFileSync}=await import('node:fs');
 const {runInNewContext}=await import('node:vm');
 const {PRINT_DEFAULTS,printOptions}=await import('./print-settings.mjs');
 const {scorePortrait}=await import('./workshop-score.mjs');
 const html=readFileSync(new URL('./index.html',import.meta.url),'utf8');
 const code=html.slice(html.indexOf('function liveEvent('),html.indexOf('\nlet liveRoom='));
 const engine=new DemoRules();
 let preemptions=0;
 const state={demoEngine:engine,printOptions,scorePortrait,viewerSince:{live:new Map()},printRules:PRINT_DEFAULTS,busy:false,lastLiveMsgAt:0,
  machineAudio:{cue(){}},preemptForGift(){preemptions++},renderQueue(){},updateScreen(){},next(){}};
 runInNewContext(code,state);
 const push=(type,name,source,price=0)=>state.liveEvent(type,{name},1,null,source,true,{priorityValue:price});
 assert.equal(push('love','已开工','礼物·爱你呦',4000),5);
 state.active=engine.queue.shift();
 state.busy=true;
 push('like','先关注','关注');
 push('like','后评论','评论');
 push('heart','低价','礼物·小心心',1000);
 push('duck','高价','礼物·加油鸭',3000);
 push('like','再评论','评论');
 assert.deepEqual(engine.queue.map(job=>job.name),[
  '已开工','已开工','已开工','已开工','高价','高价','低价','先关注','后评论','再评论'
 ]);
 assert.equal(preemptions,3);
});
