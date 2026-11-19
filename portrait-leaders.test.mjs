import {test} from 'node:test';
import assert from 'node:assert/strict';
import {updatePortraitLeaders} from './workshop-machinery.mjs';

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
