import test from 'node:test';import assert from 'node:assert/strict';
import * as THREE from './assets/three.module.js';
import {decorateGift,LABEL_LAYOUT,GIFT_STYLES} from './gift-product.mjs';
test('gift levels have distinct physical bases and crown geometry',()=>{
 const counts=[];for(const level of [1,2,3,4]){const g=new THREE.Group();decorateGift(THREE,g,new THREE.Plane(new THREE.Vector3(0,-1,0),100),level);counts.push(g.children.length);assert.equal(g.userData.giftStyle,GIFT_STYLES[level].name);if(level===4)assert.ok(g.children.some(m=>m.geometry.type==='ExtrudeGeometry'));g.traverse(m=>{m.geometry?.dispose();m.material?.dispose()})}assert.equal(new Set(counts).size,4);
});
test('gift description baseline is above the front ledge and placed in front of it',()=>{
 const y=LABEL_LAYOUT.y+(.5-LABEL_LAYOUT.detailY/420)*LABEL_LAYOUT.height*Math.cos(.16);
 assert.ok(y>.80);assert.ok(LABEL_LAYOUT.z>.43);
});
test('flowing highlights and gemstone breathing animate, freeze and disable without covering the label',()=>{
 const g=new THREE.Group(),fx=decorateGift(THREE,g,new THREE.Plane(new THREE.Vector3(0,-1,0),100),4);
 fx.update(.5,true);assert.equal(fx.phase,.5);fx.update(0,true);assert.equal(fx.phase,.5);fx.update(.5,false);assert.equal(fx.phase,.5);assert.equal(g.children.at(-1).visible,false);
});
