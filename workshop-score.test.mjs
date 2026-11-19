import {test} from 'node:test';
import assert from 'node:assert/strict';
import {scorePortrait} from './workshop-score.mjs';

test('AI, live, and gift score bands stay within the agreed ranges',()=>{
  for(let seed=60;seed<=99;seed++){
    const ai=scorePortrait(null,0,0,seed,{live:false});
    const live=scorePortrait(null,0,0,seed,{live:true});
    const gift=scorePortrait(null,0,4,seed,{live:true,giftValue:50});
    assert.ok(ai>=65&&ai<=74);
    assert.ok(live>=75&&live<=87);
    assert.ok(gift>=88&&gift<=92);
  }
});

test('gift scores do not decrease as gift value or stay time increases',()=>{
  const values=[0,1,5,10,50,100,500];
  const scores=values.map(giftValue=>scorePortrait(null,0,3,72,{live:true,giftValue}));
  for(let i=1;i<scores.length;i++)assert.ok(scores[i]>=scores[i-1]);
  assert.ok(scorePortrait(null,0,3,72,{live:true,giftValue:10,stayMinutes:15})>=scorePortrait(null,0,3,72,{live:true,giftValue:10}));
});
