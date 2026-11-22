import fs from 'node:fs';import assert from 'node:assert/strict';import {scorePortrait} from './workshop-score.mjs';
import vm from 'node:vm';
const s=fs.readFileSync('index.html','utf8');
const liveEventCode=s.slice(s.indexOf('function liveEvent('),s.indexOf('\nlet liveRoom='));
for(const [type,sourceTag] of [['like','评论'],['like','关注'],['heart','礼物·小心心']]){
 const context={
  Date:{now:()=>123456},lastLiveMsgAt:0,printRules:{},busy:false,scorePortrait,viewerSince:{live:new Map()},
  printOptions:()=>({priority:type==='heart'}),
  demoEngine:{event:()=>({added:1,jobs:[{}]})},machineAudio:{cue(){}},
  preemptForGift(){},renderQueue(){},updateScreen(){},next(){}
 };
 vm.runInNewContext(liveEventCode,context);
 context.liveEvent(type,{name:'测试'},1,sourceTag,false);
 assert.equal(context.lastLiveMsgAt,0);
 context.liveEvent(type,{name:'观众'},1,sourceTag,true);
 assert.equal(context.lastLiveMsgAt,123456);
}
assert.ok(s.match(/connection\.onopen=\(\)=>\{[\s\S]*?lastLiveMsgAt=Date\.now\(\);/),'连接数据桥应重置空闲补位计时');
assert.ok(s.includes('setInterval(idleTestFill,1000);'),'应每秒检查一次空闲填充');
const code=s.slice(s.indexOf('function idleTestFill(){'),s.indexOf('function preemptForGift(){'));
const person={name:'测试观众',avatar:'test'};const q=[];const calls=[];
let now=1000000;const realNow=Date.now;Date.now=()=>now;
try{
 const context={printRules:{idleFill:true,idleSeconds:30},paused:false,demoPeople:[person],queue:q,busy:false,lastLiveMsgAt:now,Date,printAllowed:()=>true,randomPerson:()=>person,machineAudio:{cue(){}},renderQueue(){},next(){calls.push(q.at(-1))}};
 const fill=()=>vm.runInNewContext(code+'idleTestFill();',context);
 now+=29999;fill();assert.equal(calls.length,0);
 now++;fill();assert.equal(calls.length,1);assert.equal(calls[0].live,false);
 now+=60000;fill();assert.equal(calls.length,1,'已有排队任务时不补');
 q.length=0;context.busy=true;now+=60000;fill();assert.equal(calls.length,1,'正在打印时不补');
 context.busy=false;now+=29999;fill();assert.equal(calls.length,1);
 now++;fill();assert.equal(calls.length,2);
 q.length=0;context.printRules.idleFill=false;now+=60000;fill();assert.equal(calls.length,2);
}finally{Date.now=realNow}
