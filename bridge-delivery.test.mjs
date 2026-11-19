import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BridgeDelivery} from './bridge-delivery.mjs';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

test('reconnect replays every missed interaction in sequence',()=>{
  const stream=new BridgeDelivery();
  const client={startSequence:0};
  const kinds=['comment','gift','follow','share','fansclub','join','like'];
  for(let i=0;i<1000;i++){
    const event=stream.record({type:kinds[i%kinds.length],name:'同一个人',text:'666'});
    assert.equal(event.delivery.sequence,i+1);
  }
  const messages=[];
  stream.resume(client,{id:stream.id,after:225},event=>messages.push(event));
  assert.deepEqual(messages.shift(),{type:'event-stream',id:stream.id,after:225,missed:0,restarted:false});
  assert.equal(messages.length,775);
  for(const [i,event] of messages.entries()){
    assert.equal(event.delivery.sequence,i+226);
    assert.equal(event.type,kinds[(i+225)%kinds.length]);
  }
});

test('new viewers skip old messages, and overflow and restarts are explicit',()=>{
  const stream=new BridgeDelivery(3);
  for(let i=0;i<5;i++)stream.record({text:String(i)});
  const messages=[];
  const send=event=>messages.push(event);
  stream.resume({startSequence:4},{},send);
  assert.equal(messages.shift().after,4);
  assert.deepEqual(messages.splice(0).map(msg=>msg.text),['4']);
  stream.resume({startSequence:5},{id:stream.id,after:1},send);
  assert.equal(messages.shift().missed,1);
  assert.deepEqual(messages.splice(0).map(msg=>msg.text),['2','3','4']);
  stream.resume({startSequence:5},{id:'previous-process',after:9},send);
  assert.equal(messages.shift().restarted,true);
  assert.deepEqual(messages,[]);
});

test('switching rooms never replays interactions from the previous room',()=>{
  const stream=new BridgeDelivery(3);
  for(let i=0;i<4;i++)stream.record({room:'original'});
  stream.switchRoom();
  stream.record({room:'new'});
  const messages=[];
  stream.resume({startSequence:5},{id:stream.id,after:1},event=>messages.push(event));
  assert.equal(messages.shift().missed,0);
  assert.deepEqual(messages.map(msg=>msg.room),['new']);
});

test('the printing page resumes from its last event and ignores duplicate delivery',async()=>{
  const html=readFileSync(new URL('./index.html',import.meta.url),'utf8');
  const code=html.slice(html.indexOf('const liveDeliveryIds='),html.indexOf('connectBridge();requestAnimate()'));
  const instances=[],added=[],elements=new Map();
  const ws=class {
    constructor(){this.readyState=0;instances.push(this)}
    open(){this.readyState=1;this.onopen()}
    send(message){this.request=JSON.parse(message)}
    close(){this.readyState=3;this.onclose()}
    deliver(message){this.onmessage({data:JSON.stringify(message)})}
  };
  const context={
    Date,AbortSignal,console,queue:[],window:{},WebSocket:ws,socket:undefined,timer:0,liveRoom:'room',
    liveMode:false,liveEverConnected:false,lastLiveMsgAt:0,autoDemo:false,
    fetch:async()=>({json:async()=>({ok:true,url:'ws://test'})}),
    $:id=>{if(!elements.has(id))elements.set(id,{});return elements.get(id)},
    renderQueue(){},updateScreen(){},setLiveStatus(){},clearTimeout(){},setTimeout(){},
    add:event=>added.push(event)
  };
  runInNewContext(code,context);
  const stream=new BridgeDelivery();
  await context.connectBridge();
  instances[0].open();
  stream.resume({startSequence:0},instances[0].request,message=>instances[0].deliver(message));
  const first=stream.record({type:'comment',msgId:'1',text:'666'});
  instances[0].deliver(first);
  instances[0].close();
  const second=stream.record({type:'comment',msgId:'2',text:'666'});
  await context.connectBridge();
  instances[1].open();
  assert.deepEqual(instances[1].request,{type:'resume-events',id:stream.id,after:1});
  instances[1].deliver(second);
  stream.resume({startSequence:2},instances[1].request,message=>instances[1].deliver(message));
  instances[1].deliver(second);
  instances[1].deliver(stream.record({type:'comment',msgId:'3',text:'666'}));
  assert.deepEqual(added.map(event=>event.msgId),['1','2','3']);
});
