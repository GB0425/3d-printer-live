import test from 'node:test';import assert from 'node:assert/strict';
import {giftPlan,InteractionGate,referenceRules} from './interaction-plan.mjs';
import {PRINT_DEFAULTS} from './print-settings.mjs';
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
 const s=settings();assert.deepEqual([giftPlan({raw:'加油鸭'},s).size,giftPlan({raw:'加油鸭'},s).giftLevel],['huge',3]);
 const love=giftPlan({raw:'爱你哟'},s);assert.equal(love.count,5);assert.equal(love.giftLevel,4);
 assert.equal(giftPlan({raw:'未知礼物',diamondCount:10,count:1},s).kind,'price10');
 assert.equal(giftPlan({raw:'未知礼物',diamondCount:5},s).kind,'price5');
 assert.equal(giftPlan({raw:'未知礼物',diamondCount:1,count:10},s).kind,'other');
 assert.equal(giftPlan({raw:'未知礼物'},s).kind,'other');s.giftPriority=false;assert.equal(giftPlan({raw:'爱你哟'},s).priority,false);assert.equal(giftPlan({raw:'爱你哟'},s).giftLevel,4);
});
