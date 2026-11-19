import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from './assets/three.module.js';

test('departed products release points, textures and shared product materials exactly once',()=>{
 const source=fs.readFileSync('index.html','utf8'),start=source.indexOf('function disposeProduct(p)'),end=source.indexOf('let autoDemo=',start),wood=new THREE.Texture(),grain=new THREE.Texture();
 const dispose=new Function('wood','grain',source.slice(start,end)+';return disposeProduct')(wood,grain),group=new THREE.Group(),scene=new THREE.Scene();scene.add(group);
 const geometry=new THREE.BoxGeometry(),map=new THREE.Texture(),material=new THREE.MeshBasicMaterial({map}),pointsGeo=new THREE.BufferGeometry(),star=new THREE.Texture(),pointsMat=new THREE.PointsMaterial({map:star});
 group.add(new THREE.Mesh(geometry,material),new THREE.Mesh(geometry,material),new THREE.Points(pointsGeo,pointsMat));
 const sharedMat=new THREE.MeshBasicMaterial({map:wood});group.add(new THREE.Mesh(new THREE.BoxGeometry(),sharedMat));
 const sharedGeometry=new THREE.BoxGeometry();sharedGeometry.userData.sharedProduct=true;
 group.add(new THREE.Mesh(sharedGeometry,sharedMat));
 const counts=new Map();for(const resource of [geometry,map,material,pointsGeo,star,pointsMat,wood,grain,sharedGeometry])resource.addEventListener('dispose',()=>counts.set(resource,(counts.get(resource)||0)+1));
 const product={g:group};dispose(product);assert.equal(product.disposed,true);assert.equal(group.parent,null);for(const resource of [geometry,map,material,pointsGeo,star,pointsMat])assert.equal(counts.get(resource),1);assert.equal(counts.has(wood),false);assert.equal(counts.has(grain),false);assert.equal(counts.has(sharedGeometry),false);
});
