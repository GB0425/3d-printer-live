export function createPrinterHeat(THREE, scene, head) {
  const capacity=32, positions=new Float32Array(capacity*3);
  const styles=new Float32Array(capacity*2);
  const parts=Array.from({length:capacity},()=>({age:0,life:0,x:0,y:0,z:0,vx:0,vy:0,vz:0,spark:false}));
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('particleStyle',new THREE.BufferAttribute(styles,2).setUsage(THREE.DynamicDrawUsage));
  const material=new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,toneMapped:false,
    uniforms:{pixels:{value:1080}},
    vertexShader:'attribute vec2 particleStyle; uniform float pixels; varying vec2 appearance; void main(){appearance=particleStyle; vec4 p=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*p; gl_PointSize=clamp(pixels*abs(appearance.x)/max(1.,-p.z),1.,96.);}',
    fragmentShader:'varying vec2 appearance; void main(){float r=length(gl_PointCoord-.5)*2.; float a=max(0.,1.-r); vec3 color=appearance.x<0.?vec3(1.,.67,.23):vec3(.68,.76,.83); gl_FragColor=vec4(color,a*a*appearance.y);}'
  });
  const effect=new THREE.Points(geometry,material);
  effect.frustumCulled=false;
  effect.visible=false;
  scene.add(effect);
  const origin=new THREE.Vector3();
  let accumulated=0, emission=0;
  return (dt,count,printing,enabled,pixels)=>{
    effect.visible=enabled&&count>=5;
    if(!effect.visible){
      for(const part of parts)part.life=0;
      emission=accumulated=0;
      return;
    }
    accumulated+=dt;
    if(accumulated<1/30)return;
    dt=accumulated;
    accumulated=0;
    if(printing){
      const intensity=Math.min(1,(count-5)/35);
      emission+=dt*(3+intensity*11);
      while(emission>=1){
        emission--;
        const p=parts.find(part=>part.age>=part.life);
        if(!p)break;
        head.getWorldPosition(origin);
        p.spark=count>=15&&Math.random()<.22+intensity*.36;
        p.age=0;
        p.life=p.spark?.25+Math.random()*.3:1.1+Math.random()*.65;
        p.x=origin.x;p.y=origin.y-.54;p.z=origin.z+.22;
        p.vx=(Math.random()-.5)*(p.spark?3:.6);
        p.vy=p.spark?1.4+Math.random():.65;
        p.vz=(Math.random()-.2)*(p.spark?1.5:.42);
      }
    }else emission=0;
    let active=0;
    for(const p of parts){
      p.age+=dt;
      if(p.age>=p.life)continue;
      const f=p.age/p.life, i=active++;
      positions.set([p.x+p.vx*p.age,p.y+p.vy*p.age-(p.spark?3*p.age*p.age:0),p.z+p.vz*p.age],i*3);
      styles.set([p.spark?-.047:.16+f*.54,(1-f)*(p.spark?.95:.32)],i*2);
    }
    material.uniforms.pixels.value=pixels;
    geometry.setDrawRange(0,active);
    geometry.attributes.position.needsUpdate=true;
    geometry.attributes.particleStyle.needsUpdate=true;
  };
}

export function updatePortraitLeaders(leaders, portrait) {
  if(!portrait.userId)return false;
  const previous=leaders.findIndex(entry=>portrait.userId
    ? entry.userId===portrait.userId : false);
  if(previous!==-1&&leaders[previous].score>=portrait.score)return false;
  const next=leaders.filter((_,index)=>index!==previous);
  const insert=next.findIndex(entry=>entry.score<portrait.score);
  next.splice(insert===-1?next.length:insert,0,portrait);
  const ranked=next.slice(0,2);
  if(!ranked.includes(portrait))return false;
  leaders.splice(0,leaders.length,...ranked);
  return true;
}

export function expirePortraitLeaders(leaders, activityByUser, now, maxIdleMs = 5 * 60 * 1000) {
  const kept = leaders.filter(entry => {
    const lastActive = activityByUser.get(String(entry.userId)) ?? entry.lastActiveAt ?? entry.completedAt;
    return Number.isFinite(lastActive) && now - lastActive < maxIdleMs;
  });
  if (kept.length === leaders.length) return false;
  leaders.splice(0, leaders.length, ...kept);
  return true;
}

export function paintChampion(canvas, job, avatar, rank) {
  const c=canvas.getContext('2d'), w=canvas.width, h=canvas.height;
  const first=rank===1;
  c.clearRect(0,0,w,h);
  c.strokeStyle=first?'#f7e7ff':'#e5b974';
  c.lineWidth=5;
  c.strokeRect(31,31,w-62,h-62);
  c.textAlign='center';
  c.textBaseline='middle';
  c.fillStyle=first?'#fff2ff':'#ffe4a8';
  c.font='bold 64px "Microsoft YaHei",sans-serif';
  c.fillText(first?'本场第一名':'本场第二名',w/2,94);
  c.fillStyle='#283d4a';
  c.beginPath();c.arc(w/2,336,225,0,Math.PI*2);c.fill();
  if(avatar){
    const edge=Math.min(avatar.width,avatar.height);
    c.save();
    c.clip();
    c.drawImage(avatar,(avatar.width-edge)/2,(avatar.height-edge)/2,edge,edge,w/2-225,111,450,450);
    c.restore();
  }
  c.lineWidth=8;
  c.stroke();
  c.fillStyle='#fff4db';
  c.font='bold 54px "Microsoft YaHei",sans-serif';
  if(!job){
    c.fillStyle='#ffe4a8';
    c.font='bold 104px "Microsoft YaHei",sans-serif';
    c.fillText('—',w/2,336);
    c.fillStyle='#d5e4e7';
    c.font='bold 48px "Microsoft YaHei",sans-serif';
    c.fillText('等待作品上榜',w/2,598);
    return;
  }
  const chars=Array.from(job.name||'观众');
  c.fillText(chars.length>9?chars.slice(0,8).join('')+'…':chars.join(''),w/2,608,w-82);
  c.fillStyle=first?'#fff0fd':'#ffe4a8';
  c.font='bold 65px "Microsoft YaHei",sans-serif';
  c.fillText(job.score+' 分',w/2,684);
}
