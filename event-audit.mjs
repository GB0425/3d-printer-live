export class EventAudit{
 constructor(limit=120){this.rows=[];this.limit=limit;this.sequence=0}
 record(event,live,added,reason=''){
  const row={sequence:++this.sequence,time:new Date().toISOString(),mode:live?'真实接收':'测试',source:live?(event.protocol?'抖音协议':event.attribution==='roster'?'名单分配（不触发）':event.attribution==='inferred'?'推测事件（不触发）':'数据桥页面事件'):'自测',type:String(event.type||'comment'),name:String(event.name||event.nickname||'直播观众').slice(0,40),messageId:String(event.msgId||''),text:event.type==='comment'?String(event.text||'').slice(0,100):'',gift:String(event.raw||event.gift||''),count:Number(event.count)||1,unitPrice:Number(event.diamondCount??event.unitPrice)||null,added,reason:reason||'已进入制作队列'};
  this.rows.unshift(row);if(this.rows.length>this.limit)this.rows.pop();return row;
 }
 export(){return {schema:1,note:'本机接收及触发记录；测试记录不证明真实直播通过。',events:this.rows}}
}
