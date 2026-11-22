import test from 'node:test';import assert from 'node:assert/strict';
import {decodeInteraction,ProtocolEventFilter} from './douyin-events.mjs';
import {pbDecode,parseChatLine,mapGift} from './douyin-bridge.mjs';
import {giftPlan} from './interaction-plan.mjs';
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
 assert.equal(filter.matchSource({type:'gift',name:event.name,raw:'红色人气票'},'page'),true);
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
