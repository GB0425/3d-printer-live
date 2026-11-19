import test from 'node:test';import assert from 'node:assert/strict';
import {GiftDirector} from './gift-director.mjs';
const vector=a=>({a:[...a],toArray(){return [...this.a]},set(...v){this.a=v}});
function setup(){const camera={position:vector([6,9,24]),fov:36,aspect:16/9},controls={target:vector([3,2,1]),enableDamping:true};const far={p:[6,9,24],t:[3,2,1]};return {camera,controls,far,d:new GiftDirector(camera,controls,far)}}
test('ordinary jobs stay wide, gifts zoom smoothly and return wide on completion/transfer',()=>{
 const {d,camera}=setup();const far={p:[5.45,9,24],t:[2.45,2,1]};for(let i=0;i<40;i++)d.tick(.03,{name:'普通'},'printing',1);assert.equal(d.mode,'far');assert.equal(Math.abs(camera.position.toArray()[0]-far.p[0])<1e-9,true);assert.deepEqual(camera.position.toArray().slice(1),far.p.slice(1));
 d.tick(.03,{giftLevel:4,priority:false},'printing',1.85);assert.equal(d.mode,'near');assert.ok(d.transition);for(let i=0;i<40;i++)d.tick(.03,{giftLevel:4},'printing',1.85);assert.ok(camera.position.a[2]<24);
 for(let i=0;i<40;i++)d.tick(.03,{giftLevel:4},'transfer',1.85);assert.equal(d.mode,'far');assert.equal(Math.abs(camera.position.toArray()[0]-far.p[0])<1e-9,true);assert.deepEqual(camera.position.toArray().slice(1),far.p.slice(1));
});
test('portrait gift framing pulls back enough for the full pedestal; damping restored',()=>{
 const {d,camera,controls}=setup();camera.aspect=9/16;for(let i=0;i<40;i++)d.tick(.03,{giftLevel:4},'printing',1.85);const p=camera.position.toArray(),t=controls.target.toArray(),distance=Math.hypot(...p.map((v,i)=>v-t[i]));assert.ok(2*distance*Math.tan(camera.fov*Math.PI/360)*camera.aspect>2.28*1.85);assert.equal(controls.enableDamping,true);
});
