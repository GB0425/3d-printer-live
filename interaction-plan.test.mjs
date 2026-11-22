import test from 'node:test';import assert from 'node:assert/strict';
import {giftPlan,InteractionGate,referenceRules} from './interaction-plan.mjs';
import {PRINT_DEFAULTS} from './print-settings.mjs';
import {DemoRules} from './demo-rules.mjs';
const settings=()=>referenceRules({...PRINT_DEFAULTS});
test('comment keyword, follow, fansclub and share use actual event types',()=>{
 const g=new InteractionGate(),s=settings();
 assert.equal(g.accept({type:'comment',text:'路过'},s),0);assert.equal(g.accept({type:'comment',text:'666'},s),1);
 for(const type of ['follow','fansclub','share'])assert.equal(g.accept({type,name:'观众'},s),1);
 assert.equal(g.accept({type:'follow',name:'观众'},s),1);assert.equal(g.accept({type:'fansclub',name:'观众'},s),1);
 assert.equal(g.accept({type:'comment',name:'观众',text:'666'},s),1);assert.equal(g.accept({type:'comment',name:'观众',text:'666'},s),1);
 assert.equal(g.accept({type:'share',name:'观众'},s),1);s.share=false;assert.equal(g.accept({type:'share',name:'观众'},s),0);
});
test('likes accumulate per real actor, demo counters isolated, roster guesses never print',()=>{
 const g=new InteractionGate(),s=settings();assert.equal(g.accept({type:'like',name:'甲',count:29},s),0);
 assert.equal(g.accept({type:'like',name:'甲',count:1},s,false),0);assert.equal(g.accept({type:'like',name:'甲',count:1},s),1);
 assert.equal(g.accept({type:'like',name:'乙',count:30,attribution:'roster'},s),0);
});
test('named gifts have explicit tiers and price tiers use unit price, never combo spend',()=>{
 const s=settings();
 for(const [raw,count,size] of [['小心心',1,'large'],['人气票',1,'large'],['玫瑰',1,'large'],['大啤酒',2,'large'],['你最好看',2,'large'],['你真好看',2,'large'],['棒棒糖',1,'huge'],['鲜花',2,'huge'],['加油鸭',3,'huge']]){
  const plan=giftPlan({raw},s);
  assert.deepEqual([plan.count,plan.size],[count,size]);
  const result=new DemoRules().event(plan.kind,{name:'观众'},null,2,plan);
  assert.equal(result.added,count*2);
  assert.ok(result.jobs.every(job=>job.size===size));
 }
 assert.equal(giftPlan({raw:'爱你哟'},s),null);
 assert.equal(giftPlan({raw:'爱你哟',diamondCount:52},s).kind,'price10');
 assert.equal(giftPlan({raw:'未知礼物',diamondCount:10,count:1},s).kind,'price10');
 assert.equal(giftPlan({raw:'未知礼物',diamondCount:5},s).kind,'price5');
 assert.equal(giftPlan({raw:'未知礼物',diamondCount:1,count:10},s),null);
 assert.equal(giftPlan({raw:'未知礼物'},s),null);
 s.giftPriority=false;
 assert.equal(giftPlan({raw:'鲜花'},s).priority,false);
 assert.equal(giftPlan({raw:'鲜花'},s).giftLevel,4);
});
