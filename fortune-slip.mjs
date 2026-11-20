import * as THREE from './assets/three.module.js';

export const BLESSINGS = Object.freeze([
  '暴美', '暴富', '暴甜', '暴白', '暴顺', '暴桃花', '暴好运', '暴开心', '暴有钱',
  '暴脱单', '暴暴富', '暴好看', '暴自由', '暴健康', '暴强',
  '上岸', '上岸成功', '逢考必过', '金榜题名', '稳过', '拿 offer', '录取', '一战成硕',
  '上岸稳了', '过线', '通关', '得偿所愿', '一举上岸', '高分上岸', '成功上岸',
  '发财', '搞钱', '财源滚滚', '有钱', '招财', '存款暴涨', '进财', '日进斗金', '钱多', '不愁钱',
  '瘦', '变美', '显瘦', '瘦下来', '颜值飙升', '不长痘', '皮肤变好', '体态变好', '暴瘦',
  '脱单', '正缘', '桃花', '被爱', '双向奔赴', '遇良人', '偏爱', '不委屈', '良缘',
  '不挂科', '翻盘', '顺遂', '平安', '喜乐', '万事胜意', '如愿', '好运常在', '无灾',
  '无忧', '少内耗', '多欢喜', '不加班', '升职加薪'
]);

export class FortuneSlip {
  constructor(outputScene) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 480;
    this.canvas.height = 176;
    this.context = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;
    this.material = new THREE.MeshBasicMaterial({
      map: this.texture, transparent: true, depthTest: false, depthWrite: false, toneMapped: false
    });
    this.card = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.material);
    this.card.frustumCulled = false;
    this.card.renderOrder = 1;
    this.card.visible = false;
    outputScene.add(this.card);
    this.anchor = new THREE.Vector3();
    this.edge = new THREE.Vector3();
    this.product = null;
  }

  draw(word, gift) {
    const c = this.context;
    c.clearRect(0, 0, 480, 176);
    c.beginPath();
    c.moveTo(36, 8);
    c.lineTo(444, 8);
    c.lineTo(470, 34);
    c.lineTo(470, 142);
    c.lineTo(444, 168);
    c.lineTo(36, 168);
    c.lineTo(10, 142);
    c.lineTo(10, 34);
    c.closePath();
    const paper = c.createLinearGradient(0, 0, 480, 176);
    paper.addColorStop(0, '#451c23');
    paper.addColorStop(.55, gift ? '#982f26' : '#69262a');
    paper.addColorStop(1, '#36151d');
    c.fillStyle = paper;
    c.fill();
    c.lineWidth = gift ? 7 : 4;
    c.strokeStyle = gift ? '#ffe498' : '#d7a563';
    c.stroke();
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#ffd68e';
    c.font = '700 30px "Microsoft YaHei", sans-serif';
    c.fillText('✧  出炉好运签  ✧', 240, 46);
    c.fillStyle = '#fff4d3';
    c.font = '900 72px "Microsoft YaHei", sans-serif';
    c.fillText(word, 240, 113, 406);
    this.texture.needsUpdate = true;
  }

  reveal(product, gift) {
    const word = BLESSINGS[Math.floor(Math.random() * BLESSINGS.length)];
    this.product = product;
    this.startedAt = performance.now();
    this.draw(word, gift);
    return word;
  }

  update(now, camera) {
    const product = this.product;
    if (!product) return;
    const age = Math.max(0, (now - this.startedAt) / 1000);
    if (age >= 1.85 || product.disposed) {
      this.card.visible = false;
      this.product = null;
      return;
    }
    camera.updateWorldMatrix(true, false);
    this.anchor.set(0, 2.58, .05);
    product.g.localToWorld(this.anchor).project(camera);
    const {x, y, z} = this.anchor;
    this.card.visible = Math.abs(x) < 1 && y > -.96 && Math.abs(z) < 1;
    if (!this.card.visible) return;
    const pop = THREE.MathUtils.smoothstep(age, 0, .22);
    const scale = .80 + .20 * pop + .10 * Math.sin(Math.PI * pop);
    const width = (camera.aspect < 1 ? .44 : .28) * scale;
    const height = width * camera.aspect * 176 / 480;
    let cardX = THREE.MathUtils.clamp(x, -.96 + width / 2, .96 - width / 2);
    let cardY = y + height / 2 + .035;
    if (cardY + height / 2 > .96) {
      // If a close-up leaves no room above the portrait, try the side with more space.
      const direction = x > 0 ? -1 : 1;
      this.edge.set(direction * .82, 2.08, .05);
      product.g.localToWorld(this.edge).project(camera);
      cardX = this.edge.x + direction * (width / 2 + .035);
      cardY = Math.min(this.edge.y, .96 - height / 2);
      if (Math.abs(cardX) + width / 2 > .96) {
        this.card.visible = false;
        return;
      }
    }
    this.card.position.set(cardX, cardY, 0);
    this.card.scale.set(width, height, 1);
    this.material.opacity = Math.min(age / .09, 1) * (1 - THREE.MathUtils.smoothstep(age, 1.5, 1.85));
  }
}
