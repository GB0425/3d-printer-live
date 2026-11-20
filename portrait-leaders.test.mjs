import {test} from 'node:test';
import assert from 'node:assert/strict';
import {updatePortraitLeaders,expirePortraitLeaders} from './workshop-machinery.mjs';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

test('two distinct viewers remain ranked through repeated copies and new high scores',()=>{
  const leaders=[];
  const add=(userId,name,score)=>updatePortraitLeaders(leaders,{userId,name,score});
  assert.equal(add('1','观众甲',90),true);
  assert.equal(add('1','观众甲',90),false);
  add('2','观众乙',94);
  assert.equal(add('3','观众丙',90),false);
  add('3','观众丙',96);
  assert.deepEqual(leaders.map(x=>x.userId),['3','2']);
  add('2','改名的观众乙',98);
  assert.deepEqual(leaders.map(x=>x.userId),['2','3']);
  assert.deepEqual(leaders.map(x=>x.score),[98,96]);
  assert.equal(add(undefined,'改名的观众乙',98),false);
  assert.equal(add('4','改名的观众乙',100),true);
  assert.deepEqual(leaders.map(x=>x.userId),['4','2']);
});

test('a nickname without a stable viewer id cannot merge or promote live records',()=>{
  const leaders=[];
  assert.equal(updatePortraitLeaders(leaders,{name:'同名观众',score:91}),false);
  assert.equal(leaders.length,0);
});

test('machine portraits enter the live top two using a unique synthetic identity',()=>{
  const html=readFileSync(new URL('./index.html',import.meta.url),'utf8');
  const start=html.indexOf('function recordCompletedLeader(');
  const end=html.indexOf('\nfunction drawProductLabel',start);
  const leaders={live:[],demo:[]};
  const context={champions:leaders,updatePortraitLeaders,showChampion(){},Image:class{}};
  runInNewContext(html.slice(start,end),context);
  context.recordCompletedLeader({live:false,transactionId:'tx-12',name:'AI观众',score:90},{avatarMat:{map:{image:{}}}});
  assert.deepEqual(leaders.live.map(entry=>[entry.userId,entry.score]),[['machine:tx-12',90]]);
  assert.equal(leaders.demo.length,0);
});

test('live leaders expire after five minutes without real interaction and the next rank moves up',()=>{
  const leaders=[
    {userId:'one',score:99,lastActiveAt:1000},
    {userId:'two',score:96,lastActiveAt:1000}
  ];
  const activity=new Map([['one',1000],['two',301000]]);
  assert.equal(expirePortraitLeaders(leaders,activity,300999),false);
  assert.deepEqual(leaders.map(entry=>entry.userId),['one','two']);
  activity.set('one',301000);
  assert.equal(expirePortraitLeaders(leaders,activity,301000),false);
  activity.set('two',601000);
  assert.equal(expirePortraitLeaders(leaders,activity,601000),true);
  assert.deepEqual(leaders.map(entry=>entry.userId),['two']);
});
