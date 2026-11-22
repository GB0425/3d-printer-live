import test from 'node:test';
import assert from 'node:assert/strict';
import {WorkshopSession,eventAmount,workshopRules,countWaitingInteractions,FreePrintDraw} from './workshop-state.mjs';

test('milestone draw counts machine prints and waits for an eligible real viewer in live mode',()=>{
  const session=new WorkshopSession(), draw=new FreePrintDraw();
  const machine={live:false}, viewer={live:true,name:'观众甲'};
  for(let n=0;n<29;n++)session.complete(machine);
  draw.remember('viewer',viewer,0);
  assert.equal(draw.draw(session.totalCompleted,true,[machine],0),null);
  session.complete(viewer);
  assert.equal(session.totalCompleted,30);
  assert.equal(draw.draw(session.totalCompleted,true,[machine],300000),null);
  draw.remember('viewer',viewer,300001);
  assert.equal(draw.draw(session.totalCompleted,true,[machine],300001),viewer);
  assert.equal(draw.draw(session.totalCompleted,true,[machine],300001),null);
  assert.equal(draw.draw(60,false,[machine]),machine);
});

test('queued interactions count triggers, including repeat viewers and multi-copy gifts',()=>{
  const queued=[
    {userId:'same',transactionId:'tx-1'},
    {userId:'same',transactionId:'tx-2'},
    {userId:'same',transactionId:'tx-2'},
    {freePrint:true}, {source:'空闲补位'}
  ];
  assert.equal(countWaitingInteractions(queued),2);
  assert.equal(countWaitingInteractions([]),0);
});
import {PRINT_DEFAULTS,printOptions} from './print-settings.mjs';
import {InteractionGate} from './interaction-plan.mjs';
import {DemoRules} from './demo-rules.mjs';

test('large live gift and like batches retain their full counts and one gift transaction',()=>{
  const session=new WorkshopSession();
  session.observe({type:'gift',name:'甲',count:250});
  session.observe({type:'like',name:'甲',count:3051});
  assert.equal(session.snapshot(true).gifts,250);
  assert.equal(session.snapshot(true).likes,3051);
  const gate=new InteractionGate();
  const rules={...PRINT_DEFAULTS,like:true,likeThreshold:30};
  assert.equal(gate.accept({type:'like',userId:'1',count:3051},rules),101);
  assert.equal(gate.accept({type:'like',userId:'1',count:9},rules),1);
  const engine=new DemoRules();
  engine.event('like',{name:'普通'},null);
  const batch=engine.event('beer',{name:'甲'},null,250,{live:true});
  assert.equal(batch.added,500);
  assert.equal(engine.queue.at(-1).name,'普通');
  assert.ok(batch.jobs.every((job,index)=>job.copy===index+1&&job.transactionId===batch.jobs[0].transactionId));
});

test('demo events and completed test jobs never inflate real counters',()=>{
  const s=new WorkshopSession();
  s.observe({type:'gift',name:'测试',count:3},false);s.observe({type:'comment'},false);s.complete({live:false});
  assert.deepEqual([s.snapshot(true).gifts,s.snapshot(true).comments,s.snapshot(true).completed],[0,0,0]);
  s.observe({type:'gift',name:'观众甲',raw:'小心心',count:5});s.observe({type:'comment'});s.complete({live:true});
  assert.deepEqual([s.snapshot(true).gifts,s.snapshot(true).comments,s.snapshot(true).completed],[5,1,1]);
  assert.equal(s.snapshot(true).recent.gift,'小心心');assert.equal(s.snapshot(true).supporters[0].count,5);
  s.resetDemo();assert.equal(s.snapshot(false).gifts,0);assert.equal(s.snapshot(true).gifts,5);
});
test('gift combo uses item count, with finite integer event quantities',()=>{
  assert.equal(eventAmount(2.7),2);assert.equal(eventAmount(Infinity),1);assert.equal(eventAmount('3'),3);assert.equal(eventAmount(-9),1);
  const s=new WorkshopSession();s.observe({type:'gift',name:'甲',count:3});s.observe({type:'gift',name:'乙',count:2});s.observe({type:'gift',name:'甲',count:1});
  assert.equal(s.snapshot(true).gifts,6);assert.deepEqual(s.snapshot(true).supporters,[{name:'甲',count:4},{name:'乙',count:2}]);
});
test('audience rules reflect the exact editable print settings and disabled switches',()=>{
  const settings={...PRINT_DEFAULTS,comment:true,like:false,gift:true,commentCount:3,commentSize:'large',giftSize:'small',beerCount:5};
  const r=workshopRules(settings);assert.equal(r.lines.filter(row=>row.enabled).length,1);assert.equal(r.lines[0].detail,'3 张大头像');
  assert.equal(r.gifts.find(row=>row.label==='大啤酒').detail,'2 张大头像');
  assert.equal(r.gifts.find(row=>row.label==='人气票').detail,'1 张大头像');
  assert.equal(r.gifts.find(row=>row.label==='棒棒糖').detail,'1 张至尊头像');
  assert.equal(r.gifts.find(row=>row.label==='其他礼物'),undefined);
  assert.equal(r.gifts.find(row=>row.label==='加油鸭').detail,'3 张至尊头像');
  assert.deepEqual(r.gifts.slice(-2).map(row=>row.key),['price5','price10']);
  assert.equal(printOptions(settings,'other').size,'huge');
  settings.gift=false;settings.comment=false;assert.deepEqual(workshopRules(settings).gifts,[]);assert.equal(workshopRules(settings).lines.filter(row=>row.enabled).length,0);
});
