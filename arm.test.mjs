import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from './assets/three.module.js';

const source=fs.readFileSync('index.html','utf8');
const code=source.slice(source.indexOf('function solveArm('),source.indexOf('function updateScreen('));
const [,length1,length2]=source.match(/const armL1=([\d.]+),armL2=([\d.]+)/).map(Number);

function setup(factor){
 const scene=new THREE.Scene(),arm=new THREE.Group(),shoulder=new THREE.Group();
 const elbow=new THREE.Group(),wrist=new THREE.Group(),anchor=new THREE.Object3D();
 arm.position.set(-3.7,.95,2.4);
 scene.add(arm);
 arm.add(shoulder);
 shoulder.add(elbow);
 elbow.position.y=length1;
 elbow.add(wrist);
 wrist.position.y=length2;
 wrist.add(anchor);
 anchor.position.y=.55;
 const product={factor,halfWidth:1.14,g:new THREE.Group()};
 product.g.position.set(.25,.57*(1-factor),-.05);
 product.g.scale.setScalar(factor);
 scene.add(product.g);
 const fingers=[new THREE.Object3D(),new THREE.Object3D()],products=[];
 const setupCode=`
 let transferState=null,active={},busy=true,phase='transfer';
 const gripAnchor=anchor,beltSpeed=.21;
 function next(){}
 `+code+`
 return {beginTransfer,runTransfer,solveArm,beltReadyForTransfer,pose:()=>transferTarget};
 `;
 const load=new Function('THREE','scene','arm','shoulder','elbow','wrist','anchor','fingers','armL1','armL2','currentProduct','products',setupCode);
 const motion=load(THREE,scene,arm,shoulder,elbow,wrist,anchor,fingers,length1,length2,product,products);
 return {motion,anchor,product,products};
}

test('the arm reaches and seats all portrait sizes with a continuous handoff pose',()=>{
 for(const factor of [1,1.35,1.6,1.85]){
  const {motion,anchor,product,products}=setup(factor);
  motion.beginTransfer();
  const actual=new THREE.Vector3();
  for(let time=0;time<=4.45;time+=1/240){
   motion.runTransfer(time);
   assert.ok(anchor.getWorldPosition(actual).distanceTo(motion.pose())<1e-6,`factor ${factor}, time ${time}`);
  }
  const before=product.g.getWorldPosition(new THREE.Vector3());
  motion.runTransfer(4.45);
  assert.ok(product.g.getWorldPosition(actual).distanceTo(before)<.002,`factor ${factor}: ${before.toArray()} → ${actual.toArray()}`);
  motion.runTransfer(4.65);
  assert.deepEqual(products,[product]);
 }
});

test('a large portrait leaves room for the next one to land',()=>{
 const {motion,product,products}=setup(1.85);
 assert.equal(motion.beltReadyForTransfer(product),true);
 const previous={factor:1.85,halfWidth:1.14,g:new THREE.Group()};
 products.push(previous);
 previous.g.position.x=3.55;
 assert.equal(motion.beltReadyForTransfer(product),false);
 previous.g.position.x=4;
 assert.equal(motion.beltReadyForTransfer(product),true);
});
