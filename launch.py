"""Standalone WebView2 printer and isolated live-room login window."""
import argparse
import hashlib
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import threading
import time
import urllib.request
from functools import partial
from scene_relay import SceneRelay
from urllib.parse import urlparse, parse_qs
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SERVER_ID = hashlib.sha256(str(ROOT).casefold().encode('utf-8')).hexdigest()

def room_address(raw):
    value = str(raw).strip()
    if re.fullmatch(r'[0-9]{5,25}', value):
        return value, 'https://live.douyin.com/' + value
    url = urlparse(value)
    paths = {'live.douyin.com': r'/([0-9]{5,25})/?',
             'www.douyin.com': r'/follow/live/([0-9]{5,25})/?'}
    match = re.fullmatch(paths.get(url.netloc, r'(?!)'), url.path)
    if url.scheme not in ('http', 'https') or not match:
        raise ValueError('请输入数字房间号或抖音网页直播间的完整链接')
    return match[1], url._replace(scheme='https').geturl()


def room_id(raw):
    return room_address(raw)[0]


def is_room_page(page, room):
    try:
        return page.get('type') == 'page' and room_id(page.get('url', '')) == room
    except ValueError:
        return False


def listening(port, timeout_s=.3):
    with socket.socket() as sock:
        sock.settimeout(timeout_s)
        return sock.connect_ex(('127.0.0.1', port)) == 0

_LOCAL_OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))

def local_get(url, timeout_s=1.5):
    # 本机健康检查必须直连：系统代理（Clash 等）会拦截 127.0.0.1 请求。
    return _LOCAL_OPENER.open(url, timeout=timeout_s)

def bridge_status(expected_pid=None):
    for port in range(8765, 8775):
        # Closed Windows ports can each stall urlopen for 1.5 seconds. Probe
        # quickly first so discovery fits the page's four-second deadline.
        if not listening(port, .05):
            continue
        try:
            with local_get(f'http://127.0.0.1:{port}/health', 1.5) as response:
                data = json.load(response)
            if data.get('service') == 'avatar-printer' and os.path.normcase(data.get('identity', '')) == os.path.normcase(str(ROOT)):
                if expected_pid is not None and (data.get('pid') != expected_pid or not data.get('attached')):
                    continue
                return dict(ok=True, port=port, url=f'ws://127.0.0.1:{port}')
        except Exception:
            pass
    return dict(ok=False)


def wait_bridge(process, owned=False):
    for _ in range(80 if owned else 30):
        if process.poll() is not None:
            raise RuntimeError('数据桥启动失败，请查看 desktop-bridge.log')
        status = bridge_status(process.pid) if owned else bridge_status()
        if status['ok']:
            return status
        time.sleep(.1)
    raise RuntimeError('数据桥启动超时，请查看 desktop-bridge.log')


ACTIVE_PORT = 8080
ACTIVE_API = None

def claim_desktop_instance(path=None):
    if os.name != 'nt':
        return None
    import msvcrt
    handle = open(path or ROOT / '.printer-instance.lock', 'a+b')
    if handle.tell() == 0:
        handle.write(b'0')
        handle.flush()
    handle.seek(0)
    try:
        msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
    except OSError:
        handle.close()
        return False
    return handle

def activate_existing(url):
    try:
        request = urllib.request.Request(url + '__activate', headers={'Sec-Fetch-Site':'same-origin'})
        with local_get(request, 2) as response:
            return bool(json.load(response).get('ok'))
    except Exception:
        return False

def ensure_server():
    global ACTIVE_PORT
    # 8080 被代理等程序占用时自动换备用端口（8081/8181/8088）。
    for port in (8080, 8081, 8181, 8088, 8090, 8095, 8282, 8388):
        if not listening(port):
            ACTIVE_PORT = port
            break
        try:
            with local_get(f'http://127.0.0.1:{port}/', 3) as response:
                if response.headers.get('X-Avatar-Printer-Id') == SERVER_ID:
                    ACTIVE_PORT = port
                    return f'http://127.0.0.1:{port}/', None
        except Exception:
            pass
    else:
        raise RuntimeError('所有本地服务端口均被占用，请关闭旧程序后重试。')
    relay = SceneRelay()
    bridge_process = None
    class Handler(SimpleHTTPRequestHandler):
        def end_headers(self):
            # Ctrl+R must load edited local pages and their scripts immediately.
            self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Expires', '0')
            self.send_header('X-Avatar-Printer-Id', SERVER_ID)
            super().end_headers()

        # 叠加一个本地控制端点：让浏览器页面也能拉起“独立应用窗口”（无浏览器界面）。
        def _guard(self):
            # 只允许本机页面调用（防其它网站借用本地服务拉进程）。
            if not str(self.headers.get('Host', '')).startswith('127.0.0.1:' + str(ACTIVE_PORT)):
                return False
            return self.headers.get('Sec-Fetch-Site', '') == 'same-origin'

        def _spawn_app(self, url, size=(1280, 720), extra=None):
            exe = None
            for c in (r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
                      r'C:\Program Files\Microsoft\Edge\Application\msedge.exe',
                      r'C:\Program Files\Google\Chrome\Application\chrome.exe',
                      r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe'):
                if os.path.exists(c):
                    exe = c
                    break
            if not exe:
                return False
            args = [exe, '--app=' + url, '--window-size=%d,%d' % size]
            if extra:
                args += extra
            subprocess.Popen(args)
            return True

        def do_POST(self):
            if self.path == '/__speech':
                if not self._guard():
                    return self._json(403, '{"error":"forbidden"}')
                try:
                    length = int(self.headers.get('Content-Length', '0'))
                    if not 0 < length <= 4096:
                        raise ValueError('invalid length')
                    from speech_service import synthesize
                    audio = synthesize(json.loads(self.rfile.read(length)))
                except (ValueError, TypeError) as exc:
                    return self._json(400, json.dumps({'error':str(exc)}))
                except Exception:
                    return self._json(503, '{"error":"online speech unavailable"}')
                try:
                    self.send_response(200)
                    self.send_header('Content-Type', 'audio/wav' if audio[:4] == b'RIFF' else 'audio/mpeg')
                    self.send_header('Content-Length', str(len(audio)))
                    self.end_headers()
                    self.wfile.write(audio)
                except ConnectionError:
                    pass
                return
            if self.path != '/__scene-message' or not self._guard():
                return self._json(403, '{"error":"forbidden"}')
            try:
                length = int(self.headers.get('Content-Length', '0'))
                if not 0 < length <= 65536:
                    raise ValueError('bad length')
                body = json.loads(self.rfile.read(length))
                relay.publish(body['client'], body['message'])
                return self._json(200, '{"ok":true}')
            except (ValueError, KeyError, TypeError):
                return self._json(400, '{"error":"invalid message"}')

        def do_GET(self):
            nonlocal bridge_process
            if self.path == '/__activate':
                if not self._guard():
                    return self._json(403, '{"ok":false}')
                if ACTIVE_API is None:
                    return self._json(200, '{"ok":false}')
                ACTIVE_API.activate()
                return self._json(200, '{"ok":true}')
            if self.path == '/__speech-status':
                from offline_speech import available
                return self._json(200, json.dumps({'offline': available()}))
            if self.path == '/__bridge-status':
                if not self._guard():
                    return self._json(403, '{"ok":false}')
                api = ACTIVE_API
                if api is not None and api._main_window is not None:
                    bridge = api._bridge
                    status = bridge_status(bridge.pid) if bridge and bridge.poll() is None else dict(ok=False)
                else:
                    status = bridge_status()
                return self._json(200, json.dumps(status))
            if self.path.startswith('/__scene-events?'):
                if not self._guard():
                    return self._json(403, '{"error":"forbidden"}')
                try:
                    query = parse_qs(urlparse(self.path).query)
                    client = query['client'][0]
                    after = int(query['after'][0]) if 'after' in query else None
                    return self._json(200, json.dumps(relay.poll(client, after)))
                except (ValueError, KeyError):
                    return self._json(400, '{"error":"invalid cursor"}')
            if self.path.startswith('/__open-live'):
                if not self._guard():
                    return self._json(403, '{"ok":false,"error":"forbidden"}')
                q = parse_qs(urlparse(self.path).query)
                room = ''.join(ch for ch in (q.get('room') or [''])[0] if ch.isdigit())[-25:]
                if not re.fullmatch(r'\d{5,25}', room):
                    return self._json(400, '{"ok":false,"error":"bad room"}')
                size = (720, 1280) if (q.get('portrait') or ['0'])[0] == '1' else (1280, 720)
                extra = None
                if (q.get('debug') or ['0'])[0] == '1':
                    extra = ['--remote-debugging-port=9223', '--user-data-dir=' + str(ROOT / '.bridge-profile'),
                             '--lang=zh-CN', '--no-first-run', '--no-default-browser-check',
                             '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding',
                             '--disable-background-timer-throttling',
                             '--disable-features=IntensiveWakeUpThrottling,CalculateNativeWinOcclusion']
                if not self._spawn_app('https://live.douyin.com/' + room, size, extra):
                    return self._json(500, '{"ok":false,"error":"no browser found"}')
                return self._json(200, '{"ok":true}')
            if self.path.startswith('/__start-bridge'):
                if not self._guard():
                    return self._json(403, '{"ok":false,"error":"forbidden"}')
                q = parse_qs(urlparse(self.path).query)
                room = ''.join(ch for ch in (q.get('room') or [''])[0] if ch.isdigit())[-25:]
                if (q.get('auto') or ['0'])[0] == '1':
                    if ACTIVE_API is not None and ACTIVE_API._main_window is not None:
                        return self._json(200, json.dumps(dict(ok=False, error='请在桌面程序点击开始抓取')))
                    if not listening(9224):
                        return self._json(200, json.dumps(dict(ok=False, error='请先打开直播间窗口')))
                if not re.fullmatch(r'\d{5,25}', room):
                    try:
                        room = ''.join(ch for ch in (ROOT / '.bridge-room').read_text(encoding='utf-8') if ch.isdigit())[-25:]
                    except Exception:
                        room = ''
                if not re.fullmatch(r'\d{5,25}', room):
                    return self._json(400, '{"ok":false,"error":"no room"}')
                if bridge_status()["ok"]:
                    return self._json(200, '{"ok":true,"already":true}')
                node = shutil.which('node')
                if not node:
                    return self._json(500, '{"ok":false,"error":"node not found"}')
                log = open(ROOT / 'desktop-bridge.log', 'ab')
                (ROOT / '.bridge-room').write_text(room, encoding='utf-8')
                env = os.environ.copy()
                if listening(9224):
                    env['PRINTER_CDP_PORT'] = '9224'
                bridge_process = subprocess.Popen([node, str(ROOT / 'douyin-bridge.mjs'), room], cwd=str(ROOT),
                                 env=env, stdout=log, stderr=log,
                                 creationflags=subprocess.CREATE_NO_WINDOW)
                try:
                    return self._json(200, json.dumps(wait_bridge(bridge_process)))
                except RuntimeError as exc:
                    return self._json(500, json.dumps(dict(ok=False, error=str(exc))))
            if self.path.startswith('/__stop-bridge'):
                if not self._guard():
                    return self._json(403, '{"ok":false,"error":"forbidden"}')
                if bridge_process and bridge_process.poll() is None:
                    bridge_process.terminate()
                    bridge_process.wait(timeout=5)
                bridge_process = None
                return self._json(200, '{"ok":true}')
            if self.path.startswith('/__open-scene'):
                if not self._guard():
                    return self._json(403, '{"ok":false,"error":"forbidden"}')
                q = parse_qs(urlparse(self.path).query)
                spath = (q.get('path') or [''])[0]
                orient = (q.get('orient') or ['landscape'])[0]
                sizes = {'landscape': (1280, 720), 'landscape-1080p': (1920, 1080),
                         'portrait': (720, 1280), 'portrait-1080p': (1080, 1920), 'landscape-4k': (3840, 2160), 'portrait-4k': (2160, 3840)}
                w, h = sizes.get(orient, (1280, 720))
                size = f'{w},{h}'
                if not re.fullmatch(r'/[A-Za-z0-9_\-]+\.html\?scene=1', spath):
                    return self._json(400, '{"ok":false,"error":"bad path"}')
                exe = None
                for c in (r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
                          r'C:\Program Files\Microsoft\Edge\Application\msedge.exe',
                          r'C:\Program Files\Google\Chrome\Application\chrome.exe',
                          r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe'):
                    if os.path.exists(c):
                        exe = c
                        break
                if not exe:
                    return self._json(500, '{"ok":false,"error":"no browser found"}')
                subprocess.Popen([exe, '--app=http://127.0.0.1:' + str(ACTIVE_PORT) + spath, '--window-size=' + size])
                return self._json(200, '{"ok":true}')
            # Ignore validators from versions cached before no-store was enabled.
            for header in ('If-Modified-Since', 'If-None-Match'):
                if header in self.headers:
                    del self.headers[header]
            return super().do_GET()

        def _json(self, code, body):
            data = body.encode('utf-8')
            try:
                self.send_response(code)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(data)))
                self.end_headers()
                self.wfile.write(data)
            except ConnectionError:
                # Reloading/closing a window cancels its pending local poll.
                pass

        def log_message(self, *args):
            pass

    server = ThreadingHTTPServer(('127.0.0.1', ACTIVE_PORT), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return f'http://127.0.0.1:{ACTIVE_PORT}/', server

class DesktopApi:
    def __init__(self):
        self._live = None
        self._bridge = None
        self._room = None
        self._scene_windows = []
        self._scene_process = None
        self._lock = threading.RLock()
        self._restart_requested = False
        self._main_window = None
        self._control_window = None
        self._direct_previous_size = None

    def resize_direct_output(self, enabled, width=0, height=0):
        if self._main_window is None:
            return
        if enabled:
            if self._direct_previous_size is None:
                self._direct_previous_size = (self._main_window.width, self._main_window.height)
            self._main_window.resize(max(400, int(width)), max(600, int(height)))
        elif self._direct_previous_size is not None:
            size = self._direct_previous_size
            self._direct_previous_size = None
            self._main_window.resize(*size)

    def open_control_window(self):
        import webview
        with self._lock:
            if self._control_window is not None:
                self._control_window.show()
                self._control_window.restore()
                return '配置窗口已打开'
            self._control_window = webview.create_window(
                '观众造物工坊 · 配置',
                f'http://127.0.0.1:{ACTIVE_PORT}/control-view.html',
                js_api=self, width=1220, height=900, min_size=(850, 600))
            self._control_window.events.closed += self._control_closed
        return '配置与直播画面同时运行'

    def _control_closed(self):
        self._control_window = None

    def control_snapshot(self, signature=None):
        if self._main_window is None:
            return None
        if signature is not None and (not isinstance(signature, str) or len(signature) > 100000):
            raise ValueError('invalid signature')
        return self._main_window.evaluate_js('window.controlBridge?.snapshot(' + json.dumps(signature) + ')')

    def control_action(self, command):
        if not isinstance(command, dict) or self._main_window is None:
            raise ValueError('invalid control')
        return self._main_window.evaluate_js('window.controlBridge.action(' + json.dumps(command) + ')')

    def activate(self):
        def focus():
            try:
                if self._control_window is not None:
                    self._control_window.show()
                    self._control_window.restore()
                elif self._main_window is not None:
                    if self._main_window.evaluate_js("document.body.classList.contains('direct-output')"):
                        self.open_control_window()
                    else:
                        self._main_window.show()
                        self._main_window.restore()
            except Exception:
                pass
        threading.Thread(target=focus, daemon=True).start()

    def restart_program(self):
        with self._lock:
            if self._restart_requested:
                return '正在重启…'
            self._restart_requested = True
        def shutdown():
            import webview
            for win in list(webview.windows)[::-1]:
                win.destroy()
        threading.Timer(0.5, shutdown).start()
        return '正在完整重启程序…'

    def get_capture_compatibility(self):
        return (ROOT / '.capture-compat').exists()

    def set_capture_compatibility(self, enabled):
        if not isinstance(enabled, bool):
            raise ValueError('无效的兼容模式设置')
        config = ROOT / '.capture-compat'
        if enabled:
            config.write_text('software-rendering', encoding='utf-8')
        else:
            config.unlink(missing_ok=True)
        return self.restart_program()

    def save_rules_png(self, data_url):
        import base64
        import webview
        if not isinstance(data_url, str) or not data_url.startswith('data:image/png;base64,') or len(data_url) > 20000000:
            raise ValueError('无效的 PNG 图片')
        data = base64.b64decode(data_url.split(',', 1)[1], validate=True)
        if not data.startswith(b'\x89PNG\r\n\x1a\n'):
            raise ValueError('无效的 PNG 图片')
        result = webview.windows[0].create_file_dialog(webview.FileDialog.SAVE,
            save_filename='直播打印规则.png', file_types=('PNG 图片 (*.png)',))
        if not result:
            return '已取消保存。'
        path = Path(result[0] if isinstance(result, (tuple, list)) else result)
        if path.suffix.lower() != '.png':
            path = path.with_suffix('.png')
        path.write_bytes(data)
        return '已保存 PNG：' + str(path)

    def open_scene_window(self, path=None, orient='landscape'):
        if orient not in {'landscape','landscape-1080p','portrait','portrait-1080p','landscape-4k','portrait-4k'}:
            orient = 'landscape'

        # A separate process prevents process-based capture from selecting the
        # control panel instead of the output window.
        if self._scene_process and self._scene_process.poll() is None:
            return '直播小窗已在独立进程运行，请从任务栏切换到直播小窗。'
        self._scene_process = subprocess.Popen(
            [sys.executable, str(ROOT / 'launch.py'), '--scene-view',
             '--scene-orient', orient, '--server-port', str(ACTIVE_PORT)], cwd=ROOT)
        return '已打开独立进程直播小窗，请重新选择捕获窗口。'


    def close_scene_window(self):
        # Only the viewer process owned by this app is closed; printing stays here.
        if self._scene_process and self._scene_process.poll() is None:
            self._scene_process.terminate()
        return '已切换到免转码直播直出'

    def resize_scene(self, w, h):
        # 场景小窗内切换横竖屏：调整所有由本应用打开的场景窗口尺寸。
        try:
            w, h = max(200, min(int(w), 4096)), max(200, min(int(h), 4096))
        except Exception:
            return 'bad size'
        for win in list(self._scene_windows):
            try:
                if not getattr(win, 'closed', False):
                    preview_scale = min(1, 1280 / w, 860 / h)
                    win.resize(round(w * preview_scale), round(h * preview_scale))
            except Exception:
                pass
        return 'ok'

    def open_live_room(self, raw):
        with self._lock:
            room, url = room_address(raw)
            if self._live and self._live.poll() is None:
                # Reopen even for the same room so a stale closed page can recover.
                try:
                    self._live.terminate()
                    self._live.wait(timeout=5)
                except Exception:
                    pass
                self._live = None
            if listening(9224):
                raise RuntimeError('端口 9224 被占用，请关闭旧直播窗口 / Port 9224 busy — close the old live window')
            self._room = room
            (ROOT / '.bridge-room').write_text(room, encoding='utf-8')
            env = os.environ.copy()
            env['WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS'] = '--remote-debugging-port=9224 --remote-debugging-address=127.0.0.1'
            self._live = subprocess.Popen([sys.executable, str(ROOT / 'launch.py'), '--live-room', url], cwd=ROOT, env=env)
            return '直播窗口已打开，登录后点“开始抓取” / Live window opened — log in, then click Start Capture.'

    def start_capture(self, raw):
        with self._lock:
            room = room_id(raw)
            if not self._live or self._live.poll() is not None or room != self._room:
                raise RuntimeError("请先打开该房间的直播窗口并登录 / Open this room's live window and log in first")
            if self._bridge and self._bridge.poll() is None:
                return '数据桥已在运行 / Bridge already running.'
            with local_get('http://127.0.0.1:9224/json/list', 3) as response:
                pages = json.load(response)
            if not any(is_room_page(page, room) for page in pages):
                raise RuntimeError('直播窗口尚未进入该直播间，请先完成登录或验证')
            node = shutil.which('node')
            if not node:
                raise RuntimeError('未找到 Node.js')
            env = os.environ.copy()
            env['PRINTER_CDP_PORT'] = '9224'
            with open(ROOT / 'desktop-bridge.log', 'ab') as log:
                self._bridge = subprocess.Popen([node, str(ROOT / 'douyin-bridge.mjs'), room], cwd=ROOT,
                    env=env, stdout=log, stderr=log, creationflags=subprocess.CREATE_NO_WINDOW)
            status = wait_bridge(self._bridge, owned=True)
            return f'数据桥已启动，端口 {status["port"]}，正在连接直播评论。'

    def stop_capture(self, raw=None):
        with self._lock:
            if self._bridge and self._bridge.poll() is None:
                self._bridge.terminate()
                self._bridge.wait(timeout=5)
            self._bridge = None
            return '抓取已停止 / Capture stopped.'

    def close(self):
        if self._scene_process and self._scene_process.poll() is None:
            self._scene_process.terminate()
            self._scene_process.wait(timeout=5)
        self.stop_capture()
        if self._live and self._live.poll() is None:
            self._live.terminate()
            self._live.wait(timeout=5)

def main():
    global ACTIVE_API
    # Keep the rendering window active when the detached view is in front.
    browser_flags = os.environ.get('WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS', '')
    os.environ['WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS'] = browser_flags + (
        ' --disable-backgrounding-occluded-windows --disable-renderer-backgrounding'
        ' --disable-background-timer-throttling --autoplay-policy=no-user-gesture-required'
    )
    if (ROOT / '.capture-compat').exists():
        os.environ['WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS'] += (
            ' --disable-gpu --disable-accelerated-video-decode'
        )
    parser = argparse.ArgumentParser()
    parser.add_argument('--live-room')
    parser.add_argument('--server-only', action='store_true')
    parser.add_argument('--room')
    parser.add_argument('--capture', action='store_true')
    parser.add_argument('--scene-view', action='store_true')
    parser.add_argument('--scene-orient', default='landscape')
    parser.add_argument('--server-port', type=int, default=8080)
    args = parser.parse_args()
    if args.scene_view:
        import webview
        sizes = {'landscape': (1280, 720), 'landscape-1080p': (1920, 1080),
                 'portrait': (720, 1280), 'portrait-1080p': (1080, 1920), 'landscape-4k': (1280, 720), 'portrait-4k': (484, 860)}
        width, height = sizes.get(args.scene_orient, (1280, 720))
        api = DesktopApi()
        win = webview.create_window('观众造物工坊 · 直播画面',
            'http://127.0.0.1:' + str(args.server_port) + '/live-view.html', js_api=api,
            width=width, height=height, background_color='#000000', resizable=True)
        api._scene_windows.append(win)
        webview.start(gui='edgechromium', private_mode=False,
            storage_path=str(ROOT / '.scene-webview-profile'))
        return
    if args.live_room:
        import webview
        webview.settings['REMOTE_DEBUGGING_PORT'] = 9224
        room, url = room_address(args.live_room)
        webview.create_window('直播间登录 · ' + room, url, width=1180, height=800)
        webview.start(gui='edgechromium', private_mode=False, storage_path=str(ROOT / '.live-webview-profile'))
        return
    instance_lock = None if args.server_only else claim_desktop_instance()
    if instance_lock is False:
        # Do not start a second renderer, even when the first app is still booting.
        for _ in range(20):
            for port in (8080, 8081, 8181, 8088, 8090, 8095, 8282, 8388):
                if listening(port, .05) and activate_existing(f'http://127.0.0.1:{port}/'):
                    return
            time.sleep(.25)
        return
    url, server = ensure_server()
    if server is None and not args.server_only:
        if activate_existing(url):
            if instance_lock:
                instance_lock.close()
            return
    from offline_speech import warmup
    threading.Thread(target=warmup, daemon=True).start()
    api = DesktopApi()
    ACTIVE_API = api
    try:
        if args.server_only:
            threading.Event().wait()
        else:
            import webview
            api._main_window = webview.create_window('观众造物工坊 · 控制台', url, js_api=api, width=1380, height=960,
                min_size=(400, 600), background_color='#0b0e14')
            def start_requested_room():
                if not args.room:
                    return
                try:
                    print(api.open_live_room(args.room), flush=True)
                    if args.capture:
                        for _ in range(30):
                            if listening(9224):
                                try:
                                    print(api.start_capture(args.room), flush=True)
                                    return
                                except (OSError, RuntimeError):
                                    pass
                            threading.Event().wait(1)
                        print('直播窗口未就绪，请完成登录后点击开始抓取', flush=True)
                except Exception as exc:
                    print(str(exc), flush=True)
            webview.start(start_requested_room, gui='edgechromium', private_mode=False, storage_path=str(ROOT / '.printer-webview-profile'))
    except KeyboardInterrupt:
        pass
    finally:
        api.close()
        if server:
            server.shutdown()
            server.server_close()
        if instance_lock:
            instance_lock.close()
        if api._restart_requested:
            restart_args = [sys.executable, str(ROOT / 'launch.py')]
            if api._room:
                restart_args += ['--room', api._room]
            subprocess.Popen(restart_args, cwd=ROOT)

if __name__ == '__main__':
    main()
