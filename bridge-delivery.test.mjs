import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BridgeDelivery} from './bridge-delivery.mjs';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {startWSServer} from './bridge-ws.mjs';

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

test('paced replay catches up with a full backlog and live arrivals in order',async()=>{
  const stream=new BridgeDelivery();
  const client={startSequence:16000};
  const sequences=[];
  for(let i=0;i<16000;i++)stream.record({type:'comment',text:'666'});
  let batches=0;
  const headers=[];
  await stream.replay(client,{id:stream.id,after:0},event=>{
    assert.equal(client.replaying,true);
    if(event.delivery)sequences.push(event.delivery.sequence);
    else headers.push(event);
  },async()=>{
    if(++batches>1&&batches<=50)stream.record({type:'gift'});
    return true;
  });
  assert.equal(client.replaying,false);
  assert.equal(headers.length,1);
  assert.equal(headers[0].missed,0);
  assert.equal(sequences.length,16049);
  assert.ok(sequences.every((sequence,index)=>sequence===index+1));
});

test('large recovery delivers over the actual loopback WebSocket', {timeout:15000}, async t=>{
  const stream=new BridgeDelivery();
  const body='x'.repeat(1024);
  let hub;
  const port=await new Promise(resolve=>{
    hub=startWSServer(0,{
      onStatus:resolve,
      onConnect:client=>{client.startSequence=stream.sequence},
      onMessage:(raw,client)=>stream.replay(client,JSON.parse(raw),event=>hub.send(client,event),
        async()=>{
          do{await new Promise(resolve=>setTimeout(resolve,1))}
          while(!client.sock.destroyed&&client.sock.writableLength>512*1024);
          return !client.sock.destroyed;
        })
    });
  });
  t.after(()=>hub.close());
  const socket=new WebSocket('ws://127.0.0.1:'+port);
  let received=0;
  const full=12000;
  for(let i=0;i<full;i++)stream.record({type:'comment',text:body});
  await new Promise((resolve,reject)=>{
    socket.addEventListener('open',()=>socket.send(JSON.stringify({id:stream.id,after:0})));
    socket.addEventListener('error',()=>reject(new Error('Loopback socket failed')));
    socket.addEventListener('close',()=>reject(new Error('Loopback socket closed before completion')));
    socket.addEventListener('message',message=>{
      try {
        const event=JSON.parse(message.data);
        if(event.type==='event-stream')assert.equal(event.missed,0);
        else {
          assert.equal(event.delivery.sequence,++received);
          assert.equal(event.text,body);
          if(received===full)resolve();
        }
      } catch(error){reject(error)}
    });
  });
  assert.equal(received,full);
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
