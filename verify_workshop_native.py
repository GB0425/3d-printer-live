"""Run explicitly: native verification using a local synthetic WebSocket bridge."""
import sys,json,time,subprocess,traceback,base64
from pathlib import Path
import webview
import launch
sys.stdout.reconfigure(encoding='utf-8')
OUT=Path('.workshop-test');OUT.mkdir(exist_ok=True)
url,server=launch.ensure_server()
api=launch.DesktopApi()
w=webview.create_window('工坊整体验收',url,js_api=api,width=1450,height=1100)
viewer=None;bridge=None;checks=[];failed=False
def wait(code,timeout=30,window=None):
    deadline=time.monotonic()+timeout
    while time.monotonic()<deadline:
        try:
            value=(window or w).evaluate_js(code)
            if value:return value
        except Exception:pass
        time.sleep(.15)
    raise AssertionError('Timed out: '+code)
def check(name,condition):
    assert condition,name
    checks.append(name);print('PASS '+name,flush=True)
def emit(event):
    bridge.stdin.write(json.dumps(event,ensure_ascii=False)+'\n');bridge.stdin.flush()

def varint(value):
    out=bytearray()
    while value>127:
        out.append((value&127)|128);value>>=7
    out.append(value);return bytes(out)
def number(field,value):return varint(field*8)+varint(value)
def binary(field,value):
    if isinstance(value,str):value=value.encode('utf-8')
    return varint(field*8+2)+varint(len(value))+value
protocol_id=90000
def emit_protocol(method,name,extra,user_field=2):
    global protocol_id
    protocol_id+=1
    user=number(1,123456)+binary(3,name)
    payload=binary(1,number(2,protocol_id))+binary(user_field,user)+extra
    response=binary(1,binary(1,method)+binary(2,payload))
    emit({'__protocol':base64.b64encode(response).decode('ascii')})
def run():
    global viewer,bridge,failed
    try:
        wait("typeof workshopDiagnostics==='function'")
        wait("document.querySelector('#avatar-source').textContent.includes('已载入')")
        w.evaluate_js("localStorage.clear();localStorage.setItem('printer-sound','off');location.reload()")
        wait("typeof workshopDiagnostics==='function'&&document.querySelector('.quick-sound').getAttribute('aria-pressed')==='false'")
        check('saved mute preference boots without initialization errors',not w.evaluate_js('workshopDiagnostics().pageErrors.length'))
        w.evaluate_js("if(window.__autoDemoButton.getAttribute('aria-pressed')==='true')window.__autoDemoButton.click();document.querySelector('#reset-demo').click();document.querySelector('#workshop-comment').click()")
        wait("workshopDiagnostics().state.active?.source==='评论'")
        check('comment preview creates a test job, real comment count stays zero',w.evaluate_js('workshopDiagnostics().real.comments===0&&workshopDiagnostics().demo.comments===1'))
        w.evaluate_js("document.querySelector('#workshop-gift').click()")
        wait("workshopDiagnostics().state.active?.priority")
        check('gift preview preempts ordinary job and keeps it queued',w.evaluate_js("workshopDiagnostics().state.active.size==='large'&&workshopDiagnostics().state.waiting>=1"))
        wait("document.querySelector('.wh-current').classList.contains('wh-premium')")
        check('gift printing status is visibly highlighted',True)
        wait("workshopDiagnostics().cameraMode==='near'")
        check('gift automatically selects the close camera',True)
        check('label uses a 2048-pixel sharp texture',w.evaluate_js('workshopDiagnostics().product.label.texture[0]===2048'))
        # Rule edit must update the exact same public rule card.
        w.evaluate_js("const s=document.querySelectorAll('.print-setting-group')[1].querySelectorAll('select')[1];s.value='3';s.dispatchEvent(new Event('change'))")
        wait("document.querySelector('.wh-gift-rules').textContent.includes('3 张大头像')")
        check('rule edits propagate to audience layer',True)
        w.evaluate_js("document.querySelector('#demo-speed').value='12';document.querySelector('#demo-speed').dispatchEvent(new Event('change'))")
        wait('workshopDiagnostics().demo.completed>=2',30)
        check('test jobs actually complete without inflating real completions',w.evaluate_js('workshopDiagnostics().real.completed===0'))
        wait("workshopDiagnostics().cameraMode==='far'")
        check('completed gift returns camera to wide shot',True)
        w.evaluate_js("document.querySelector('#test-reset').click();document.querySelector('[data-test=follow]').click();document.querySelector('[data-test=fansclub]').click();document.querySelector('[data-test=share]').click();document.querySelector('[data-test=like29]').click()")
        check('follow, fansclub, share and under-threshold like self tests use the common event path',w.evaluate_js("workshopDiagnostics().state.active.source==='关注'&&workshopDiagnostics().state.waiting===2&&document.querySelector('#complete-test-log').firstChild.textContent.includes('新增 0')"))
        w.evaluate_js("document.querySelector('[data-test=like]').click()")
        check('the thirtieth like produces exactly one job',w.evaluate_js("document.querySelector('#complete-test-log').firstChild.textContent.includes('新增 1')"))
        for key,level,size in [('heart',1,'large'),('beer',2,'large'),('duck',3,'huge'),('love',4,'huge'),('price5',2,'large'),('price10',4,'huge')]:
            w.evaluate_js("document.querySelector('#test-reset').click();document.querySelector('[data-test="+key+"]').click()")
            check('gift self test creates correct physical pedestal: '+key,w.evaluate_js("workshopDiagnostics().product.giftLevel==="+str(level)+"&&workshopDiagnostics().state.active.size==='"+size+"'&&workshopDiagnostics().product.label.z>.43"))
        check('4K output is real rather than CSS enlargement',w.evaluate_js('printerDiagnostics().output[0]===3840&&printerDiagnostics().output[1]===2160'))
        check('one viewer with several pending gift copies counts as one person',w.evaluate_js('workshopDiagnostics().state.waitingPeople<=1'))
        # A local fake bridge exercises the production discovery, socket and event path.
        (OUT/'bridge.mjs').write_text("import {startWSServer} from '../bridge-ws.mjs';import {_injectHubForTest,_handleWSFrameForTest} from '../douyin-bridge.mjs';import readline from 'node:readline';const s=startWSServer(8774,{identity:process.cwd()});_injectHubForTest(s);readline.createInterface({input:process.stdin}).on('line',line=>{const e=JSON.parse(line);if(e.__protocol)_handleWSFrameForTest(Buffer.from(e.__protocol,'base64'));else s.broadcast(e)});",encoding='utf-8')
        bridge=subprocess.Popen(['node',str(OUT/'bridge.mjs')],stdin=subprocess.PIPE,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,text=True,encoding='utf-8')
        wait('workshopDiagnostics().state.live',40)
        emit({'type':'comment','name':'本地验收观众甲'})
        emit({'type':'gift','name':'本地验收观众乙','gift':'beer','raw':'大啤酒','count':2})
        wait('workshopDiagnostics().real.gifts===2&&workshopDiagnostics().real.comments===1')
        check('production WebSocket path counts gift items and comments',True)
        wait('workshopDiagnostics().state.active?.live&&workshopDiagnostics().state.active?.priority')
        check('live gift creates four large jobs using beer multiplier',w.evaluate_js('workshopDiagnostics().state.active.total===4&&workshopDiagnostics().state.active.size==="large"'))
        for method,name,extra,field,event_type in [
            ('WebcastSocialMessage','协议关注观众',number(4,1),2,'follow'),
            ('WebcastSocialMessage','协议分享观众',number(4,2),2,'share'),
            ('WebcastFansclubMessage','协议粉丝观众',number(2,2),4,'fansclub'),
            ('WebcastLikeMessage','协议点赞观众',number(2,30),5,'like')]:
            emit_protocol(method,name,extra,field)
            wait("workshopDiagnostics().audit.some(e=>e.source==='抖音协议'&&e.type==='"+event_type+"'&&e.added===1)")
            check('protobuf-to-WebSocket-to-print verification: '+event_type,True)
        gift=binary(16,'协议单价10礼物')+number(10,1)+number(12,10)
        for repeat in [1,2,2]:emit_protocol('WebcastGiftMessage','协议礼物观众',number(2,456)+number(5,repeat)+number(11,888)+binary(15,gift),7)
        wait('workshopDiagnostics().real.gifts===4')
        check('protocol combo emits two deltas with exact unit price and no duplicate third job',w.evaluate_js("workshopDiagnostics().audit.filter(e=>e.source==='抖音协议'&&e.type==='gift'&&e.unitPrice===10&&e.added===1).length===2"))
        before=w.evaluate_js('workshopDiagnostics().demo.gifts')
        w.evaluate_js("document.querySelector('#workshop-gift').click()")
        check('preview buttons are blocked while bridge is live',w.evaluate_js('workshopDiagnostics().demo.gifts')==before)
        viewer=webview.create_window('工坊镜像验收',url+'live-view.html',width=1280,height=720)
        wait("document.querySelector('video').videoWidth>0",40,viewer)
        wait("document.querySelector('.wh-mode').textContent==='直播'",15,viewer)
        check('OBS mirror carries real event overlay alongside video',viewer.evaluate_js("document.querySelectorAll('canvas').length===0&&!document.querySelector('.workshop-hud').hidden"))
        w.evaluate_js("document.querySelector('#workshop-portrait').click()")
        wait("document.querySelector('video').videoWidth===2160&&document.querySelector('video').videoHeight===3840",30,viewer)
        wait("document.querySelector('.workshop-hud').classList.contains('wh-portrait')",10,viewer)
        check('portrait output and overlay switch together',True)
        w.evaluate_js("document.querySelector('#workshop-overlay').click()")
        wait("document.querySelector('.workshop-hud').hidden",10,viewer)
        check('overlay visibility synchronizes to OBS mirror',True)
        check('no runtime page errors',not w.evaluate_js('workshopDiagnostics().pageErrors.length'))
        check('both rule panels are complete without promotional clutter',w.evaluate_js("document.querySelector('.workshop-hud').children.length===5&&document.querySelectorAll('.wh-interactions .wh-rule').length>=5&&document.querySelectorAll('.wh-gift-rules .wh-rule').length===8&&!document.querySelector('.wh-heading,.wh-spotlight,.wh-thanks')"))
        check('four Chinese female neural voices are available',w.evaluate_js("document.querySelectorAll('#speech-voice option[value^=\"edge:\"]').length===4"))
        for voice in ['zh-CN-XiaoxiaoNeural','zh-CN-XiaoyiNeural']:
            w.evaluate_js("document.querySelector('#speech-voice').value='edge:"+voice+"';document.querySelector('#speech-voice').dispatchEvent(new Event('change'));document.querySelector('#speech-test').click()")
            wait("speechDiagnostics().provider==='online'&&speechDiagnostics().audioTime>.3&&speechDiagnostics().audioReady>=2",30)
            check('neural female speech plays in WebView: '+voice,True)
            w.evaluate_js("document.querySelector('#speech-toggle').click()")
        (OUT/'results.json').write_text(json.dumps({'passed':checks,'state':w.evaluate_js('workshopDiagnostics()')},ensure_ascii=False,indent=2),encoding='utf-8')
        print('ALL '+str(len(checks))+' CHECKS PASSED',flush=True)
    except Exception:
        failed=True
        (OUT/'failure.txt').write_text(traceback.format_exc(),encoding='utf-8');traceback.print_exc()
        try:(OUT/'failure-state.json').write_text(json.dumps(w.evaluate_js('workshopDiagnostics()'),ensure_ascii=False,indent=2),encoding='utf-8')
        except Exception:pass
    finally:
        if bridge:bridge.terminate()
        if viewer:viewer.destroy()
        w.destroy()
webview.start(run,gui='edgechromium',private_mode=False,storage_path=str(OUT/'profile'))
if server:server.shutdown()
if failed:raise SystemExit(1)
