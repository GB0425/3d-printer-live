import test from 'node:test';
import assert from 'node:assert/strict';
import {GiftSpeech} from './gift-speech.mjs';

function localVoiceFixture() {
  const oldSynth=globalThis.speechSynthesis,oldUtterance=globalThis.SpeechSynthesisUtterance,oldFetch=globalThis.fetch;
  let spoken=0;
  globalThis.speechSynthesis={getVoices:()=>[{name:'Microsoft Huihui',lang:'zh-CN',voiceURI:'huihui'}],speak:u=>{spoken++;queueMicrotask(()=>u.onend())},cancel(){}};
  globalThis.SpeechSynthesisUtterance=class{constructor(text){this.text=text}};
  return {get spoken(){return spoken},restore(){globalThis.fetch=oldFetch;globalThis.speechSynthesis=oldSynth;globalThis.SpeechSynthesisUtterance=oldUtterance}};
}
const tick=()=>new Promise(resolve=>setTimeout(resolve,10));

test('online failure preserves every gift and merges pending combo counts',async()=>{
 const fixture=localVoiceFixture();const s=new GiftSpeech();
 let attempts=0;
 try{globalThis.fetch=async()=>{attempts++;throw new Error('offline')};s.say('甲','小心心',1);await tick();s.say('乙','啤酒',2);await tick();s.say('乙','啤酒',3);await tick();assert.equal(attempts,1);assert.equal(fixture.spoken,0);assert.ok(s.queue.some(x=>x.name==='甲'));assert.equal(s.queue.find(x=>x.name==='乙').amount,5);assert.ok(s.lastError.includes('offline'))}finally{s.stop();fixture.restore()}
});

test('stopping a pending online utterance never plays stale local fallback',async()=>{
  const fixture=localVoiceFixture();
  try {
    globalThis.fetch=(_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true}));
    const s=new GiftSpeech();s.enqueue('这段已取消');s.stop();await tick();
    assert.equal(fixture.spoken,0);assert.equal(s.speaking,false);assert.equal(s.queue.length,0);assert.equal(s.lastError,'');
  } finally {fixture.restore()}
});
