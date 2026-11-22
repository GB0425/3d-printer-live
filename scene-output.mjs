import * as THREE from './assets/three.module.js';

export const AA_MODES = {
  off: {label:'关闭抗锯齿 · 最省性能', samples:0, scale:1},
  msaa2: {label:'MSAA 2× · 流畅', samples:2, scale:1},
  msaa4: {label:'MSAA 4× · 推荐', samples:4, scale:1},
  msaa8: {label:'MSAA 8× · 高质量', samples:8, scale:1},
  ssaa15: {label:'超采样 1.5× · 精细', samples:0, scale:1.5},
  ssaa2: {label:'超采样 2× · 极精细', samples:0, scale:2}
};

// Render at a bounded internal resolution; present/capture at the exact output size.
// Tone mapping and sRGB conversion occur once, on the final fullscreen pass.
export class SceneOutput {
  constructor(renderer) {
    this.renderer=renderer;
    const gl=renderer.getContext();
    this.hdr=!!gl.getExtension('EXT_color_buffer_float');
    this.supportedSamples=Array.from(gl.getInternalformatParameter(gl.RENDERBUFFER,
      this.hdr?gl.RGBA16F:gl.RGBA8, gl.SAMPLES)||[]);
    this.target=new THREE.WebGLRenderTarget(1,1,{type:this.hdr?THREE.HalfFloatType:THREE.UnsignedByteType,depthBuffer:true});
    // Depth is used for scene visibility, but never sampled by the output pass.
    // Avoid resolving a full 4K multisample depth texture every frame.
    this.target.resolveDepthBuffer=false;
    this.target.resolveStencilBuffer=false;
    this.material=new THREE.ShaderMaterial({
      uniforms:{
        image:{value:this.target.texture},
        inputTexel:{value:new THREE.Vector2()},
        upscaleSharpness:{value:0}
      }, depthTest:false, depthWrite:false,
      vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
      fragmentShader:`uniform sampler2D image; uniform vec2 inputTexel;
      uniform float upscaleSharpness; varying vec2 vUv;
      void main(){gl_FragColor=texture2D(image,vUv);
      if(upscaleSharpness>0.0){
        vec3 center=gl_FragColor.rgb;
        vec3 left=texture2D(image,vUv-vec2(inputTexel.x,0.0)).rgb;
        vec3 right=texture2D(image,vUv+vec2(inputTexel.x,0.0)).rgb;
        vec3 up=texture2D(image,vUv+vec2(0.0,inputTexel.y)).rgb;
        vec3 down=texture2D(image,vUv-vec2(0.0,inputTexel.y)).rgb;
        vec3 lo=min(center,min(min(left,right),min(up,down)));
        vec3 hi=max(center,max(max(left,right),max(up,down)));
        gl_FragColor.rgb=clamp(center+upscaleSharpness*(center-(left+right+up+down)*0.25),lo,hi);
      }
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`
    });
    this.scene=new THREE.Scene();
    const fullscreen=new THREE.BufferGeometry();
    fullscreen.setAttribute('position',new THREE.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));
    fullscreen.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,2,0,0,2],2));
    this.mesh=new THREE.Mesh(fullscreen,this.material);
    this.mesh.frustumCulled=false;this.scene.add(this.mesh);
    this.camera=new THREE.Camera();this.scale=1;this.samples=0;
  }
  configure(width,height,quality,mode,limit=Infinity) {
    const aa=AA_MODES[mode]||AA_MODES.msaa4;
    const max=this.renderer.capabilities.maxTextureSize;
    this.scale=Math.max(0.1,Math.min(quality*aa.scale,limit,2,
      Math.sqrt(8294400/(width*height)),max/width,max/height));
    const samples=Math.max(0,...this.supportedSamples.filter(n=>n<=aa.samples));
    if(this.target.samples!==samples){this.target.dispose();this.target.samples=samples;}
    this.samples=samples;
    this.target.setSize(Math.round(width*this.scale),Math.round(height*this.scale));
    this.material.uniforms.inputTexel.value.set(1/this.target.width,1/this.target.height);
    this.material.uniforms.upscaleSharpness.value=this.scale<.995
      ? Math.min(.22,(1-this.scale)*.55)
      : 0;
    if(this.renderer.domElement.width!==width||this.renderer.domElement.height!==height){
      this.renderer.setPixelRatio(1);this.renderer.setSize(width,height,false);
    }
  }
  render(scene,camera) {
    const r=this.renderer;
    r.setRenderTarget(this.target);
    try {r.render(scene,camera);} finally {r.setRenderTarget(null);}
    r.render(this.scene,this.camera);
  }
}
