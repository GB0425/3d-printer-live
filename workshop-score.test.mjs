import {test} from 'node:test';
import assert from 'node:assert/strict';
import {scorePortrait} from './workshop-score.mjs';

test('non-gift interactions mostly score 75–84 and occasionally score 85–95',()=>{
  const samples=Array.from({length:1000},(_,i)=>{
    const draws=[i/1000,(i%11)/11];
    return scorePortrait(null,0,0,0,{live:true,random:()=>draws.shift()});
  });
  assert.ok(samples.every(score=>score>=75&&score<=95));
  const high=samples.filter(score=>score>=85).length;
  assert.equal(high,20);
  assert.ok(samples.some(score=>score>=85));
  assert.ok(new Set(samples).size>=18);
});

test('non-gift high scores start at the two percent boundary',()=>{
  const draws=[.979,0,.98,0];
  const random=()=>draws.shift();
  assert.equal(scorePortrait(null,0,0,0,{live:true,random}),75);
  assert.equal(scorePortrait(null,0,0,0,{live:true,random}),85);
});

test('gift score bands rise with unit price and cap at 100',()=>{
  const ordinaryMax=scorePortrait(null,0,0,0,{live:true,random:()=>.99999});
  assert.equal(ordinaryMax,95);
  for(const [giftValue,expected] of [[1,96],[2,97],[5,98],[10,99],[50,100],[9999,100]]){
    for(const live of [true,false]){
      const score=scorePortrait(null,0,1,0,{live,giftValue});
      assert.equal(score,expected);
      assert.ok(score>ordinaryMax);
    }
  }
});

test('named gifts without a price use their configured gift level',()=>{
  for(const [giftLevel,expected] of [[1,96],[2,97],[3,98],[4,99]]){
    assert.equal(scorePortrait(null,0,giftLevel,0,{live:true}),expected);
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
