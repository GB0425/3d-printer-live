import * as THREE from './assets/three.module.js';

export const BLESSINGS = Object.freeze([
  '上岸', '上岸成功', '逢考必过', '金榜题名', '稳过', '拿 offer', '录取', '一战成硕',
  '上岸稳了', '过线', '通关', '得偿所愿', '一举上岸', '高分上岸', '成功上岸', '面试顺利', '答辩顺利',
  '发财', '搞钱', '财源滚滚', '有钱', '招财', '存款见涨', '进财', '日进斗金', '钱多', '不愁钱',
  '奖金到账', '订单不断', '花得开心', '钱包鼓鼓',
  '瘦', '变美', '显瘦', '瘦下来', '颜值飙升', '不长痘', '皮肤变好', '体态变好',
  '脱单', '正缘', '桃花', '被爱', '双向奔赴', '遇良人', '偏爱', '不委屈', '良缘', '约会顺利',
  '朋友常聚', '遇见知己',
  '不挂科', '翻盘', '顺遂', '平安', '喜乐', '万事胜意', '如愿', '好运常在', '无灾',
  '无忧', '少内耗', '多欢喜', '不加班', '升职加薪', '准点下班', '转正顺利', '项目顺利',
  '假期到手', '一夜好眠', '出门绿灯', '旅途顺利', '家人安康', '心情晴朗', '好事发生',
  '灵感不断', '遇事有解', '努力有回报', '所求皆如愿'
]);

const appearanceBlessings = new Set(['变美', '颜值飙升']);
const generalBlessings = BLESSINGS.filter(word => !appearanceBlessings.has(word));

export class FortuneSlip {
  constructor(outputScene) {
    this.outputScene = outputScene;
    this.geometry = new THREE.PlaneGeometry(1, 1);
    this.active = new Map();
    this.available = [];
    this.portraitCenter = new THREE.Vector3();
    this.anchor = new THREE.Vector3();
    this.edge = new THREE.Vector3();
  }

  createCard() {
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 176;
    const context = canvas.getContext('2d');
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    const material = new THREE.MeshBasicMaterial({
      map: texture, transparent: true, depthTest: false, depthWrite: false, toneMapped: false
    });
    const card = new THREE.Mesh(this.geometry, material);
    card.frustumCulled = false;
    return {card, context, texture, word: '', startedAt: 0};
  }

  draw({context: c, texture, word}, gift) {
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
    texture.needsUpdate = true;
  }

  reveal(product, gift, gender) {
    const existing = this.active.get(product);
    if (existing) return existing.word;
    const slip = this.available.pop() || this.createCard();
    const words = ['female', '女'].includes(String(gender ?? '').trim().toLowerCase())
      ? BLESSINGS : generalBlessings;
    slip.word = words[Math.floor(Math.random() * words.length)];
    slip.startedAt = performance.now();
    slip.card.visible = false;
    slip.card.renderOrder = 1;
    this.draw(slip, gift);
    this.active.set(product, slip);
    this.outputScene.add(slip.card);
    return slip.word;
  }

  release(product) {
    const slip = this.active.get(product);
    if (!slip) return;
    this.active.delete(product);
    slip.card.removeFromParent();
    this.available.push(slip);
  }

  update(now, camera) {
    if (!this.active.size) return;
    camera.updateWorldMatrix(true, false);
    for (const [product, slip] of this.active) this.place(product, slip, now, camera);
  }

  place(product, {card, startedAt}, now, camera) {
    this.portraitCenter.set(0, 1.7, .006);
    product.g.localToWorld(this.portraitCenter).project(camera);
    const center = this.portraitCenter;
    // A sliver of the frame at the edge should not keep a floating card on screen.
    card.visible = product.g.visible && Math.abs(center.x) < 1 &&
      Math.abs(center.y) < 1 && Math.abs(center.z) < 1;
    if (!card.visible) return;
    const age = Math.max(0, (now - startedAt) / 1000);
    this.anchor.set(0, 2.58, .05);
    product.g.localToWorld(this.anchor).project(camera);
    const {x, y} = this.anchor;
    const pop = THREE.MathUtils.smoothstep(age, 0, .22);
    const scale = .80 + .20 * pop + .10 * Math.sin(Math.PI * pop);
    const width = (camera.aspect < 1 ? .36 : .25) * scale;
    const height = width * camera.aspect * 176 / 480;
    let cardX = x;
    let cardY = Math.max(-.96 + height / 2, y + height / 2 + .035);
    if (cardY + height / 2 > .96) {
      const direction = x > 0 ? -1 : 1;
      this.edge.set(direction * .82, 2.08, .05);
      product.g.localToWorld(this.edge).project(camera);
      cardX = this.edge.x + direction * (width / 2 + .035);
      cardY = THREE.MathUtils.clamp(this.edge.y, -.96 + height / 2, .96 - height / 2);
    }
    card.position.set(cardX, cardY, 0);
    card.scale.set(width, height, 1);
    card.material.opacity = Math.min(age / .09, 1);
  }
}
