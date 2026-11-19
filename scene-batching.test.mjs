import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from './assets/three.module.js';
import {batchStaticSiblings} from './scene-batching.mjs';

test('batch preserves original vertices, transforms, material, shadows and moving exclusions',()=>{
 const scene=new THREE.Scene(),mat=new THREE.MeshStandardMaterial(),objects=[];
 for(let i=0;i<5;i++){const m=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),mat);m.position.set(i*.3,1,0);m.rotation.y=i*.1;m.castShadow=m.receiveShadow=true;scene.add(m);objects.push(m)}
 const excluded=objects.pop(),original=objects.map(o=>{o.updateMatrix();return {matrix:o.matrix.clone(),positions:o.geometry.attributes.position.array.slice(),index:o.geometry.index.array.slice()}});
 const stats=batchStaticSiblings(scene,new Set([excluded]));assert.equal(stats.drawsSaved,3);assert.equal(excluded.parent,scene);
 const batch=scene.children.find(o=>o.isBatchedMesh);assert.equal(batch.material,mat);assert.equal(batch.castShadow,true);assert.equal(batch.receiveShadow,true);assert.equal(batch.perObjectFrustumCulled,true);
 for(let i=0;i<original.length;i++){const matrix=new THREE.Matrix4();batch.getMatrixAt(i,matrix);for(let n=0;n<16;n++)assert.ok(Math.abs(matrix.elements[n]-original[i].matrix.elements[n])<1e-6);const range=batch.getGeometryRangeAt(i);assert.deepEqual([...batch.geometry.attributes.position.array.slice(range.vertexStart*3,(range.vertexStart+range.vertexCount)*3)],[...original[i].positions])}
 excluded.position.x=50;assert.equal(excluded.position.x,50);
});
test('transparent, hidden and custom render objects stay independent',()=>{
 const scene=new THREE.Scene(),mat=new THREE.MeshBasicMaterial({transparent:true});for(let i=0;i<3;i++)scene.add(new THREE.Mesh(new THREE.BoxGeometry(),mat));
 assert.equal(batchStaticSiblings(scene).batches,0);assert.equal(scene.children.length,3);
 mat.transparent=false;for(const o of scene.children)o.visible=false;assert.equal(batchStaticSiblings(scene).batches,0);
 for(const o of scene.children){o.visible=true;o.onBeforeRender=()=>{}}assert.equal(batchStaticSiblings(scene).batches,0);
});
