import * as THREE from './assets/three.module.js';

// Batch only opaque siblings sharing the exact material and rendering flags.
// Keep groups and moving objects intact, and partition large rooms for culling.
export function batchStaticSiblings(root, excluded=new Set()) {
 const stats={objects:0,batches:0,drawsSaved:0};
 function visit(parent){
  for(const child of [...parent.children])if(!excluded.has(child)&&child.children.length)visit(child);
  const buckets=new Map();
  for(const o of parent.children){
   if(excluded.has(o)||!o.isMesh||o.isInstancedMesh||o.isBatchedMesh||o.children.length||!o.visible||Array.isArray(o.material)||o.material.transparent||o.material.transmission>0||o.onBeforeRender!==THREE.Object3D.prototype.onBeforeRender)continue;
   const g=o.geometry;if(!g?.attributes.position||g.morphAttributes.position||g.drawRange.start!==0||g.drawRange.count!==Infinity)continue;
   const signature=Object.entries(g.attributes).map(([k,a])=>k+':'+a.itemSize+':'+a.normalized).sort().join(',');
   const key=[o.material.uuid,o.castShadow,o.receiveShadow,o.renderOrder,o.layers.mask,signature,Math.floor(o.position.x/6),Math.floor(o.position.y/6),Math.floor(o.position.z/6)].join('|');
   if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(o);
  }
  for(const objects of buckets.values()){
   if(objects.length<3)continue;
   let vertices=0,indices=0;for(const o of objects){vertices+=o.geometry.attributes.position.count;indices+=o.geometry.index?.count??o.geometry.attributes.position.count}
   const first=objects[0],batch=new THREE.BatchedMesh(objects.length,vertices,indices,first.material);batch.name='Static batch';batch.castShadow=first.castShadow;batch.receiveShadow=first.receiveShadow;batch.renderOrder=first.renderOrder;batch.layers.mask=first.layers.mask;batch.matrixAutoUpdate=false;
   // Keep each original bound, matrix, index and vertex. Offscreen parts remain culled.
   for(const o of objects){o.updateMatrix();const id=batch.addInstance(batch.addGeometry(o.geometry));batch.setMatrixAt(id,o.matrix)}batch.computeBoundingBox();batch.computeBoundingSphere();parent.add(batch);
   for(const o of objects){parent.remove(o);o.geometry.dispose()}
   stats.objects+=objects.length;stats.batches++;stats.drawsSaved+=objects.length-1;
  }
 }
 visit(root);return stats;
}
