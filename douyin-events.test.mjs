import test from 'node:test';import assert from 'node:assert/strict';
import {decodeInteraction,ProtocolEventFilter} from './douyin-events.mjs';
import {pbDecode,parseChatLine,parsePageEventRow,mapGift,_handleWSFrameForTest,_injectHubForTest} from './douyin-bridge.mjs';
import {giftPlan} from './interaction-plan.mjs';
import {BridgeDelivery} from './bridge-delivery.mjs';
const varint=n=>{const bytes=[];let v=BigInt(n);do{let b=Number(v&127n);v>>=7n;if(v)b|=128;bytes.push(b)}while(v);return Buffer.from(bytes)};
const n=(field,value)=>Buffer.concat([varint(field*8),varint(value)]);
const b=(field,value)=>{const buf=Buffer.isBuffer(value)?value:Buffer.from(value);return Buffer.concat([varint(field*8+2),varint(buf.length),buf])};
const user=Buffer.concat([n(1,123),b(3,'协议观众'),b(9,b(1,'https://p3.douyinpic.com/aweme-avatar/test.jpeg'))]);
test('share action 2 and fansclub join type 2 are decoded separately from follow and upgrades',()=>{
 assert.equal(decodeInteraction('WebcastSocialMessage',Buffer.concat([b(2,user),n(4,2)]),pbDecode).type,'share');
 assert.equal(decodeInteraction('WebcastSocialMessage',Buffer.concat([b(2,user),n(4,1)]),pbDecode).type,'follow');
 assert.equal(decodeInteraction('WebcastFansclubMessage',Buffer.concat([n(2,2),b(4,user)]),pbDecode).type,'fansclub');
 assert.equal(decodeInteraction('WebcastFansclubMessage',Buffer.concat([n(2,1),b(4,user)]),pbDecode),null);
 assert.equal(decodeInteraction('WebcastLikeMessage',Buffer.concat([b(5,user),n(2,30)]),pbDecode).count,30);
});
test('gift price metadata and combo deltas survive protobuf decoding without duplicates',()=>{
 const filter=new ProtocolEventFilter(),got=[];
 for(const [id,count]of [[100,1],[101,2],[102,2]]){const gift=Buffer.concat([n(10,1),n(12,10),b(16,'测试礼物')]);const pl=Buffer.concat([b(1,n(2,id)),n(2,12345),n(5,count),b(7,user),n(11,999),b(15,gift)]);const ev=filter.accept(decodeInteraction('WebcastGiftMessage',pl,pbDecode));if(ev)got.push(ev)}
 assert.deepEqual(got.map(e=>e.count),[1,1]);assert.ok(got.every(e=>e.diamondCount===10));assert.equal(filter.matchSource({type:'gift',name:'协议观众',raw:'测试礼物'},'page'),false);
});
test('DOM fallback distinguishes actual share, follow and fanclub lines',()=>{
 assert.equal(parseChatLine('小雨：加入了粉丝团').kind,'fansclub');assert.equal(parseChatLine('小雨分享了直播间').kind,'share');assert.equal(parseChatLine('小雨推荐了直播').kind,'share');assert.equal(parseChatLine('小雨关注了主播').kind,'follow');assert.equal(mapGift('加油鸭'),'duck');assert.equal(mapGift('爱你哟'),'other');
});

test('popularity tickets decode and deduplicate across page and protocol aliases',()=>{
 const filter=new ProtocolEventFilter();
 const gift=Buffer.concat([n(12,1),b(16,'人气票')]);
 const packet=Buffer.concat([b(1,n(2,600)),n(5,3),b(7,user),b(15,gift)]);
 const event=decodeInteraction('WebcastGiftMessage',packet,pbDecode);
 assert.equal(event.count,3);
 assert.equal(giftPlan(event,{}).kind,'popularity');
 assert.equal(filter.matchSource({type:'gift',name:event.name,raw:'红色人气票',count:3},'page'),true);
 assert.equal(filter.accept(event),null);
});

test('an unpriced page gift does not hide a later priced protocol gift',()=>{
 const filter=new ProtocolEventFilter();
 const page={type:'gift',name:'协议观众',raw:'未知规则礼物'};
 assert.equal(filter.matchSource(page,'page'),true);
 assert.equal(giftPlan(page,{}),null);
 const event=filter.accept({...page,diamondCount:9,msgId:'601'});
 assert.equal(giftPlan(event,{}).kind,'price5');
});

test('combo snapshots and cross-source messages are reconciled by quantity',()=>{
 const make=(count,msgId)=>({type:'gift',name:'送礼观众',raw:'人气票',count,msgId});
 const pageFirst=new ProtocolEventFilter();
 assert.equal(pageFirst.acceptPage(make(1)).count,1);
 assert.equal(pageFirst.accept(make(3,'p1')).count,2);
 assert.equal(pageFirst.accept(make(3,'p1')),null);
 const protocolFirst=new ProtocolEventFilter();
 assert.equal(protocolFirst.accept(make(1,'p2')).count,1);
 assert.equal(protocolFirst.acceptPage(make(3)).count,2);
 assert.equal(protocolFirst.accept(make(1,'p3')),null);
 assert.equal(protocolFirst.accept(make(1,'p4')),null);
 assert.equal(protocolFirst.accept(make(1,'p5')).count,1);
 assert.equal(parsePageEventRow({text:'送礼观众送出人气票 ×3',previousText:'送礼观众送出人气票 ×1'}).count,2);
});

test('combo fields carry late totals, and light gifts require a verified sender',()=>{
 const filter=new ProtocolEventFilter();
 const combo=(id,fields)=>decodeInteraction('WebcastGiftMessage',Buffer.concat([
  b(1,n(2,id)),n(2,2002),b(7,user),n(11,99),b(15,n(10,1)),...fields
 ]),pbDecode);
 assert.equal(filter.accept(combo(100,[n(6,2)])).count,2);
 assert.equal(filter.accept(combo(101,[n(9,1),n(29,5)])).count,3);
 assert.equal(filter.accept(combo(102,[n(9,1),n(29,5)])),null);
 const packet=Buffer.concat([b(1,n(2,103)),n(5,123),b(7,Buffer.concat([n(1,3992),n(3,1)])),n(10,4)]);
 const decode=sender=>decodeInteraction('WebcastLightGiftMessage',packet,pbDecode,sender);
 assert.equal(decode({userId:'999',name:'他人'}),null);
 const light=decode({userId:'123',name:'协议观众'});
 assert.equal(light.count,4);
 assert.equal(giftPlan(light,{}).kind,'popularity');
 assert.equal(filter.accept(light).count,4);
 assert.equal(filter.accept(light),null);
});

test('wrapped light gift reaches the bridge, survives replay, and retains quantity and type',()=>{
 const delivered=[], bridge=new BridgeDelivery(32);
 _injectHubForTest({broadcast:event=>delivered.push(bridge.record(event))});
 const frame=(method,payload)=>b(1,Buffer.concat([b(1,method),b(2,payload)]));
 try{
  _handleWSFrameForTest(frame('WebcastChatMessage',Buffer.concat([b(1,n(2,701)),b(2,user),b(3,'666')])));
  const packet=Buffer.concat([b(1,n(2,702)),n(5,123),b(7,Buffer.concat([n(1,3992),n(3,1)])),n(10,4)]);
  _handleWSFrameForTest(frame('WebcastLightGiftMessage',packet));
  _handleWSFrameForTest(frame('WebcastLightGiftMessage',packet));
  assert.equal(delivered.length,2);
  const replay=[];
  bridge.resume({startSequence:0},{id:bridge.id,after:1},event=>replay.push(event));
  const gift=replay[1], plan=giftPlan(gift,{});
  assert.equal(gift.userId,'123');
  assert.equal(gift.gift,'popularity');
  assert.equal(gift.count*plan.count,4);
  assert.equal(plan.size,'large');
 }finally{_injectHubForTest(null)}
});

test('同一人重复 666 独立接收，跨来源镜像各抵消一次',()=>{
 const filter=new ProtocolEventFilter();
 const message=id=>decodeInteraction('WebcastChatMessage',Buffer.concat([b(1,n(2,id)),b(2,user),b(3,'666')]),pbDecode);
 const first=message(500),second=message(501);
 assert.equal(filter.accept(first)?.text,'666');
 assert.equal(filter.accept(first),null);
 assert.equal(filter.accept(second)?.text,'666');
 assert.equal(filter.matchSource(first,'page'),false);
 assert.equal(filter.matchSource(second,'page'),false);
 assert.equal(filter.matchSource(first,'page'),true);
 assert.equal(filter.accept(message(502)),null);
 assert.equal(filter.accept(message(503))?.text,'666');
});
