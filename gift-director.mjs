// Smooth, reversible camera cuts driven only by the real printing phase.
export class GiftDirector{
 constructor(camera,controls,far,{savedView=false}={}){this.camera=camera;this.controls=controls;this.savedView=savedView;this.landscapeFar={p:[...far.p],t:[...far.t]};this.far=this.poseForAspect(this.landscapeFar,camera.aspect);this.mode='far';this.transition=null;this.aspect=camera.aspect;if(!savedView)this.move(this.far)}
 poseForAspect(pose,aspect){if(this.savedView)return {p:[...pose.p],t:[...pose.t]};const portrait=aspect<1,target=[2.45,portrait?2.15:pose.t[1],pose.t[2]],zoom=portrait?1.28:1;return {p:pose.p.map((v,i)=>target[i]+(v-pose.t[i])*zoom),t:target}}
 move(pose){if(!this.transition)this.damping=this.controls.enableDamping;this.transition={from:{p:this.camera.position.toArray(),t:this.controls.target.toArray()},to:pose,time:0};this.controls.enableDamping=false}
 tick(dt,job,phase,factor=1){
  const gift=job&&(job.giftLevel||job.priority||String(job.source||'').startsWith('礼物'));
  const desired=gift&&phase==='printing'?'near':'far';
  if(desired!==this.mode||Math.abs(this.camera.aspect-this.aspect)>.01){
   const aspectChanged=Math.abs(this.camera.aspect-this.aspect)>.01;
   if(aspectChanged&&this.mode==='far'&&this.aspect>=1&&this.camera.aspect<1)this.landscapeFar={p:this.camera.position.toArray(),t:this.controls.target.toArray()};
   if(aspectChanged&&desired==='far')this.far=this.poseForAspect(this.landscapeFar,this.camera.aspect);
   if(desired==='near'){
    if(this.mode==='far'&&!aspectChanged)this.far={p:this.camera.position.toArray(),t:this.controls.target.toArray()};
    const aspect=this.camera.aspect,tan=Math.tan((this.camera.fov||36)*Math.PI/360),height=2.35*factor,width=2.05*factor,distance=Math.max(height/(2*tan),width/(2*tan*aspect))*1.17;
    const center=.57*(1-factor)+1.48*factor+(aspect<1?height*.12:0);
    this.move({p:[.25+distance*.24,center+distance*.16,distance*.96],t:[.25,center,0]});
   }else this.move(this.far);
   this.mode=desired;this.aspect=this.camera.aspect;
  }
  if(!this.transition)return;
  const tr=this.transition;tr.time+=Math.min(dt,.1);const f=Math.min(1,tr.time/.85),ease=f*f*(3-2*f);
  this.camera.position.set(...tr.from.p.map((v,i)=>v+(tr.to.p[i]-v)*ease));this.controls.target.set(...tr.from.t.map((v,i)=>v+(tr.to.t[i]-v)*ease));
  if(f===1){this.transition=null;this.controls.enableDamping=this.damping}
 }
}
