export const RULES={like:{count:1,size:'small',label:'点赞'},heart:{count:1,size:'large',priority:true,label:'爱心'},beer:{count:2,size:'large',priority:true,label:'啤酒'},lollipop:{count:3,size:'large',priority:true,label:'棒棒糖'},other:{count:1,size:'large',priority:true,label:'礼物'}};
Object.assign(RULES,{duck:{count:1,size:'huge',priority:true,label:'加油鸭'},love:{count:3,size:'huge',priority:true,label:'爱你呦'},price5:{count:1,size:'large',priority:true,label:'5–9抖币礼物'},price10:{count:1,size:'huge',priority:true,label:'10抖币以上礼物'}});
export class DemoRules{
 constructor(){this.queue=[];this.likes=new Map();this.seen=new Set();this.follows=new Set();this.transactionSeq=0}
 event(type,user,id,amount=1,options={}){
  if(!RULES[type])throw Error('未知规则');
  if(!user?.name)throw Error('缺少用户');
  if(!Number.isSafeInteger(amount)||amount<1||(!options.live&&amount>100))throw Error('互动数量无效');
  if(id&&this.seen.has(id))return {added:0,duplicate:true};
  const rule={...RULES[type],...options};
  const count=rule.count*amount;
  if(!Number.isSafeInteger(count)||count+this.queue.length>0xffffffff)throw Error('打印数量超出队列容量');
  const transactionId='tx-'+(++this.transactionSeq);
  const score=type!=='like'?85+Math.floor(Math.random()*15):Number.isFinite(rule.score)?rule.score:60+Math.floor(Math.random()*36);
  const priorityValue=Number(rule.priorityValue)||0;
  const jobs=Array.from({length:count},(_,i)=>({...user,size:rule.size,priority:!!rule.priority,priorityValue,transactionId,score,source:rule.label,copy:i+1,total:count,giftLevel:rule.giftLevel||0}));
  let index=this.queue.length;
  if(rule.priority){
   index=options.protectTransactionId
    ? this.queue.findLastIndex(job=>job.transactionId===options.protectTransactionId)+1
    : 0;
   while(index<this.queue.length){
    const first=this.queue[index];
    if(!first.priority||first.priorityValue<priorityValue)break;
    do{index++}while(index<this.queue.length&&first.transactionId&&this.queue[index].transactionId===first.transactionId);
   }
  }
  // Move the tail once, without spreading a large batch into function arguments.
  if(index<this.queue.length){
   const end=this.queue.length;
   this.queue.length=end+count;
   this.queue.copyWithin(index+count,index,end);
  }
  for(let i=0;i<jobs.length;i++)this.queue[index+i]=jobs[i];
  if(id)this.seen.add(id);
  return {added:count,size:rule.size,index,jobs};
 }
}
