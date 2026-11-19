"""Bounded in-memory Chinese female speech synthesis for the local app."""
import asyncio
from collections import OrderedDict
import threading

VOICES = {'kokoro-female', 'zh-CN-XiaoxiaoNeural', 'zh-CN-XiaoyiNeural',
          'zh-CN-liaoning-XiaobeiNeural', 'zh-CN-shaanxi-XiaoniNeural'}
_cache = OrderedDict()
_lock = threading.Lock()
_slots = threading.BoundedSemaphore(2)


def validate_request(data):
    if not isinstance(data, dict):
        raise ValueError('invalid request')
    text = data.get('text')
    voice = data.get('voice')
    rate = data.get('rate', 1.05)
    if not isinstance(text, str) or not text.strip() or len(text) > 240:
        raise ValueError('播报文字应为 1–240 字')
    if voice not in VOICES:
        raise ValueError('请选择支持的中文女声')
    if isinstance(rate, bool) or not isinstance(rate, (int, float)) or not .8 <= rate <= 1.3:
        raise ValueError('语速应为 0.8–1.3')
    return text.strip(), voice, round((rate - 1) * 100)


async def _synthesize(text, voice, rate):
    import edge_tts
    audio = bytearray()
    communicate = edge_tts.Communicate(text, voice, rate=f'{rate:+d}%',
                                     connect_timeout=5, receive_timeout=10)
    async for chunk in communicate.stream():
        if chunk['type'] == 'audio':
            audio.extend(chunk['data'])
            if len(audio) > 2_000_000:
                raise RuntimeError('音频过长')
    if len(audio) < 512:
        raise RuntimeError('语音服务未返回有效音频')
    return bytes(audio)


def synthesize(data):
    key = validate_request(data)
    with _lock:
        if key in _cache:
            _cache.move_to_end(key)
            return _cache[key]
    if not _slots.acquire(blocking=False):
        raise RuntimeError('语音合成忙，请稍后重试')
    try:
        if key[1] == 'kokoro-female':
            from offline_speech import synthesize_local
            audio = synthesize_local(key[0], 1 + key[2]/100)
        else:
            audio = asyncio.run(bounded_online(key))
        with _lock:
            _cache[key] = audio
            while len(_cache) > 32:
                _cache.popitem(last=False)
        return audio
    finally:
        _slots.release()


async def bounded_online(key):
    return await asyncio.wait_for(_synthesize(*key), timeout=15)
