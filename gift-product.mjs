export const GIFT_STYLES={
 1:{name:'心意珍藏',body:0xf2ddd0,metal:0xffc69b},
 2:{name:'星耀珍藏',body:0x183d64,metal:0xe3f3ff},
 3:{name:'鎏金典藏',body:0xf1e5bf,metal:0xffdf83},
 4:{name:'皇冠尊享',body:0x1c1a26,metal:0xffdb69}
};
// The last label baseline stays above the front lip, including at low cameras.
export const LABEL_LAYOUT={width:1.42,height:.46,y:1.005,z:.46,nameY:110,titleY:245,detailY:350};

export function decorateGift(THREE,group,plane,level){
 const style=GIFT_STYLES[level]||GIFT_STYLES[1];group.userData.giftLevel=level;group.userData.giftStyle=style.name;
 const material=(color,metalness=.85)=>new THREE.MeshPhysicalMaterial({color,metalness,roughness:.13,envMapIntensity:3.3,clearcoat:1,clearcoatRoughness:.07,clippingPlanes:[plane]});
 const body=material(style.body,.3),gold=material(style.metal),gem=material(level===4?0xcf3954:0x69c9d7,.5);
 gold.emissive.setHex(style.metal);gold.emissiveIntensity=.16;gem.emissive.copy(gem.color);gem.emissiveIntensity=.35;
 const add=(geometry,mat,x,y,z)=>{const m=new THREE.Mesh(geometry,mat);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;group.add(m);return m};
 const box=(w,h,d,x,y,z,mat=gold)=>add(new THREE.BoxGeometry(w,h,d),mat,x,y,z);
 if(level===1){box(1.9,.09,.96,0,.61,0);box(1.76,.08,.86,0,.69,0,body);box(1.68,.08,.78,0,.78,.02,gold)}
 if(level===2){const base=add(new THREE.CylinderGeometry(1.08,1.16,.17,8),body,0,.64,0);base.scale.z=.52;const trim=add(new THREE.CylinderGeometry(1.10,1.18,.035,8),gold,0,.57,0);trim.scale.z=.52;for(const x of [-.82,.82]){box(.11,.45,.62,x,.91,0);add(new THREE.OctahedronGeometry(.09),gem,x,1.1,.36)}}
 if(level>=3){box(2.16,.09,1.04,0,.60,0);box(2.02,.09,.94,0,.69,0,body);box(1.88,.065,.86,0,.765,0);for(const x of [-.86,.86]){box(.11,.41,.63,x,1.0,0,body);box(.035,.42,.035,x,1.0,.34)}
  for(let side of [-1,1])for(let i=0;i<6;i++){const a=(.08+i*.18)*Math.PI;const leaf=add(new THREE.SphereGeometry(.075,8,6),gold,side*Math.sin(a)*.78,1.7-Math.cos(a)*.78,-.07);leaf.scale.set(.45,1.6,.32);leaf.rotation.z=-side*a}}
 if(level===4){box(2.28,.07,1.12,0,.55,0,body);for(const x of [-.96,.96])add(new THREE.OctahedronGeometry(.10),gem,x,.80,.42);
  const shape=new THREE.Shape();shape.moveTo(-.34,0);shape.lineTo(-.40,.25);shape.lineTo(-.17,.12);shape.lineTo(0,.33);shape.lineTo(.17,.12);shape.lineTo(.4,.25);shape.lineTo(.34,0);shape.closePath();
  add(new THREE.ExtrudeGeometry(shape,{depth:.055,bevelEnabled:true,bevelSize:.012,bevelThickness:.012,bevelSegments:1,steps:1}),gold,0,2.34,-.07);add(new THREE.OctahedronGeometry(.065),gem,0,2.48,.005)}
 const fx=new THREE.Group();fx.position.set(0,1.7,.11);fx.renderOrder=5;fx.visible=false;group.add(fx);
 // The halo sits just outside the portrait and intentionally ignores the print-layer clipping plane.
 const labelGuardBase=new THREE.Plane(new THREE.Vector3(0,1,0),-1.28),labelGuard=labelGuardBase.clone();
 const haloMat=(color,opacity)=>new THREE.MeshBasicMaterial({color,transparent:true,opacity,blending:THREE.AdditiveBlending,depthWrite:false,depthTest:false,toneMapped:false,clippingPlanes:[labelGuard]});
 const power=[0,.28,.48,.72,1][Math.max(1,Math.min(4,level))];
 const outer=new THREE.Mesh(new THREE.TorusGeometry(.775,.012+.012*power,6,64),haloMat(style.metal,.5+.5*power));fx.add(outer);
 const trail=level>=2?new THREE.Mesh(new THREE.TorusGeometry(.738,.016+.018*power,6,64,2.45),haloMat(style.metal,.45+.55*power)):null;if(trail)fx.add(trail);
 const highlight=level>=3?new THREE.Mesh(new THREE.TorusGeometry(.738,.018+.022*power,6,48,.62),haloMat(0xffffdc,.3+.7*power)):null;if(highlight)fx.add(highlight);
 const inner=level>=4?new THREE.Mesh(new THREE.TorusGeometry(.705,.008+.008*power,5,64,4.1),haloMat(0xffffff,.2+.65*power)):null;if(inner){inner.position.z=.004;fx.add(inner)}
 const pulseA=level>=2?new THREE.Mesh(new THREE.TorusGeometry(.84,.012+.028*power,6,64),haloMat(0xffd66e,.18+.75*power)):null;if(pulseA){pulseA.position.z=-.01;fx.add(pulseA)}
 const aura=level>=3?new THREE.Mesh(new THREE.TorusGeometry(.84,.025+.09*power,6,64),haloMat(style.metal,.08+.5*power)):null;if(aura){aura.position.z=-.02;fx.add(aura)}
 const burst=new THREE.Group();burst.position.z=-.025;fx.add(burst);
 const rayCount=[0,0,4,8,12][Math.max(1,Math.min(4,level))];
 for(let i=0;i<rayCount;i++){
  const ray=new THREE.Mesh(new THREE.BoxGeometry(.012+.012*power,.14+.25*power,.01),haloMat(i%3===0?0xffffff:style.metal,.25+.65*power));
  const a=i/12*Math.PI*2;ray.position.set(Math.cos(a)*.99,Math.sin(a)*.99,0);ray.rotation.z=a-Math.PI/2;burst.add(ray)
 }
 const positions=[];const sparkleCount=[0,0,5,10,14][Math.max(1,Math.min(4,level))];for(let i=0;i<sparkleCount;i++){const a=i/sparkleCount*Math.PI*2,r=.79+(i%3)*.025;positions.push(Math.cos(a)*r,Math.sin(a)*r,.005)}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 const data=new Uint8Array(32*32*4);for(let y=0;y<32;y++)for(let x=0;x<32;x++){const dx=(x-15.5)/15.5,dy=(y-15.5)/15.5,a=Math.max(0,Math.min(1,Math.exp(-(dx*dx+dy*dy)*12)+.2*Math.exp(-Math.abs(dx)*35-Math.abs(dy)*3)+.2*Math.exp(-Math.abs(dy)*35-Math.abs(dx)*3))),at=(y*32+x)*4;data[at]=255;data[at+1]=244;data[at+2]=192;data[at+3]=Math.round(a*255)}
 const starMap=new THREE.DataTexture(data,32,32);starMap.needsUpdate=true;
 const sparkles=new THREE.Points(geometry,new THREE.PointsMaterial({map:starMap,size:.035+.08*power,transparent:true,opacity:.25+.7*power,blending:THREE.AdditiveBlending,depthWrite:false,depthTest:false,toneMapped:false}));fx.add(sparkles);
 let time=0;
 return {update(dt,enabled=true){fx.visible=enabled;if(!enabled)return;group.updateWorldMatrix(true,false);labelGuard.copy(labelGuardBase).applyMatrix4(group.matrixWorld);time+=dt;const beat=(Math.sin(time*(2.2+power*2.6))+1)/2;outer.rotation.z=-time*(.12+power*.32);if(trail)trail.rotation.z=time*(.25+power*.9);if(highlight)highlight.rotation.z=-time*(.3+power*1.1)+1.25;if(inner)inner.rotation.z=time*.18;if(pulseA){pulseA.scale.setScalar(.97+beat*(.04+power*.22));pulseA.material.opacity=.12+power*(.16+beat*.6)}if(aura){aura.scale.setScalar(.98+beat*(.04+power*.18));aura.material.opacity=.04+power*(.08+beat*.42)}burst.rotation.z=-time*(.12+power*.4);burst.scale.setScalar(.98+beat*power*.08);for(const ray of burst.children)ray.material.opacity=.12+power*(.15+beat*.5);sparkles.rotation.z=-time*(.08+power*.18);sparkles.material.opacity=.2+power*(.3+.35*Math.sin(time*1.5)**2);gold.emissiveIntensity=.12+.2*power+power*.24*Math.sin(time*.8)**2;gem.emissiveIntensity=.3+power*.8*Math.sin(time*1.2)**2},get phase(){return time}};
}
