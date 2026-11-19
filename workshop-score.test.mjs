import {test} from 'node:test';
import assert from 'node:assert/strict';
import {scorePortrait} from './workshop-score.mjs';

test('each real non-gift interaction gets an independent 75–84 score',()=>{
  const samples=Array.from({length:1000},()=>scorePortrait(null,0,0,0,{live:true}));
  assert.ok(samples.every(score=>score>=75&&score<=95));
  assert.ok(samples.filter(score=>score<=84).length>samples.filter(score=>score>=85).length*2);
  assert.ok(samples.some(score=>score>=85));
  assert.ok(new Set(samples).size>=18);
});

test('non-gift scores use the common band most of the time and allow rare high scores',()=>{
  const draws=[.1,0,.99,.999];
  const random=()=>draws.shift();
  assert.equal(scorePortrait(null,0,0,0,{live:true,random}),75);
  assert.equal(scorePortrait(null,0,0,0,{live:true,random}),95);
});

test('gift score bands rise with unit price and cap at 100',()=>{
  const prices=[1,5,10,50];
  const expected=[[85,88],[89,92],[93,96],[97,100]];
  for(let i=0;i<prices.length;i++){
    const scores=Array.from({length:100},()=>scorePortrait(null,0,1,0,{live:true,giftValue:prices[i]}));
    assert.ok(scores.every(score=>score>=expected[i][0]&&score<=expected[i][1]));
  }
});

test('named gifts without a price use their configured gift level',()=>{
  for(const [giftLevel,minimum] of [[1,85],[2,89],[3,93],[4,97]]){
    const scores=Array.from({length:20},()=>scorePortrait(null,0,giftLevel,0,{live:true}));
    assert.ok(scores.every(score=>score>=minimum&&score<=minimum+3));
  }
});

test('each trigger may be randomized while copies of one gift share its score',()=>{
  const draws=[.1,0,.1,.999];
  const random=()=>draws.shift();
  const first=scorePortrait(null,0,0,0,{live:true,random});
  const second=scorePortrait(null,0,0,0,{live:true,random});
  assert.equal(first,75);
  assert.equal(second,84);
});
