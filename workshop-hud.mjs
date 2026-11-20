// Shared audience layer: main scene, direct scene and isolated OBS window.
// All user strings are assigned through textContent, never interpolated as HTML.
export function mountWorkshopHUD(host, getAspect = () => 16/9) {
  const root = document.createElement('div'); root.className = 'workshop-hud';
  root.innerHTML = `<div class="wh-counters"><div><b data-wh="completed">0</b><span>已完成作品</span></div></div>
    <div class="wh-rule-stack"><div class="wh-interaction-panel"><div class="wh-section"><b>互动打印</b></div><div class="wh-interactions"></div></div>
    <div class="wh-rules"><div class="wh-section"><b>礼物打印</b></div><div class="wh-gift-rules"></div></div></div>
    <div class="wh-current"><span class="wh-pixel-mark" aria-hidden="true"></span><div class="wh-person"><strong>打印转运中</strong><small class="wh-recipient"></small></div><div class="wh-progress"><b>0%</b><span></span></div></div>
    <div class="wh-queue-count"><span>排队人数</span><b>0</b><small>人</small></div>`;
  host.append(root);
  const nodes=new Map();
  const node=selector=>{if(!nodes.has(selector))nodes.set(selector,root.querySelector(selector));return nodes.get(selector)};
  const text = (selector,value) => {const el=node(selector),next=String(value);if(el.textContent!==next)el.textContent=next};
  const current = node('.wh-current'), ruleStack = node('.wh-rule-stack');
  function layout() {
    const a=getAspect()||16/9,w=Math.min(host.clientWidth,host.clientHeight*a),h=w/a;
    Object.assign(root.style,{width:w+'px',height:h+'px',left:(host.clientWidth-w)/2+'px',top:(host.clientHeight-h)/2+'px'});
    root.classList.toggle('wh-portrait',a<1);
    const currentHost = a<1 ? ruleStack : root;
    if(current.parentElement!==currentHost)currentHost.append(current);
  }
  const observer=new ResizeObserver(layout);observer.observe(host);layout();
  let ruleKey='';
  function render(s) {
    layout(); root.classList.toggle('wh-is-live',!!s.live);
    text('[data-wh="completed"]',s.completed||0);
    text('.wh-queue-count b',s.waitingPeople??s.waiting??0);
    const job=s.active;
    text('.wh-person strong','打印转运中');
    text('.wh-recipient',job?.name ? '正在为 '+job.name+' 制作' : '');
    root.querySelector('.wh-current').classList.toggle('wh-has-recipient',!!job?.name);
    root.querySelector('.wh-current').dataset.phase=s.paused?'paused':s.phase||'idle';
    root.querySelector('.wh-current').title=job?.name||'';
    const pct=job?Math.max(0,Math.min(100,s.progress||0)):0;
    text('.wh-progress b',s.paused?'暂停':job?(s.phase==='printing'?pct+'%':'完成'):'待命');
    root.querySelector('.wh-progress span').style.setProperty('--progress',pct+'%');
    root.querySelector('.wh-current').classList.toggle('wh-premium',!!job?.priority);
    if(ruleKey!==JSON.stringify(s.rules)) {
      ruleKey=JSON.stringify(s.rules); const r=s.rules||{lines:[],gifts:[]};
      const rows=(selector,entries,icon)=>{const box=root.querySelector(selector);box.replaceChildren();for(const row of entries){if(row.enabled===false)continue;const el=document.createElement('div');el.className='wh-rule';if(row.enabled===false)el.classList.add('wh-disabled');const mark=document.createElement('i');mark.textContent=row.icon||icon;const label=document.createElement('span');label.textContent=row.label;const detail=document.createElement('b');detail.textContent=row.detail;el.append(mark,label,detail);box.append(el)}if(!box.children.length){const p=document.createElement('p');p.textContent='当前未开启打印触发';box.append(p)}};
      rows('.wh-interactions',r.lines,'↗');
      rows('.wh-gift-rules',r.gifts,'✦');
    }
  }
  return {root,render,destroy(){observer.disconnect();root.remove()}};
}
