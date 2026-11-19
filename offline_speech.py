"""CPU-only offline Chinese female TTS; one shared model, no network calls."""
import io
import os
import shutil
import threading
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent / 'models' / 'kokoro-int8-multi-lang-v1_1'
_lock = threading.Lock()
_engine = None

def synthesize_local(text, rate=1.0, speaker=3):
    global _engine
    import numpy as np
    import sherpa_onnx as sherpa
    with _lock:
        if _engine is None:
            data_root=Path(os.environ.get("LOCALAPPDATA",str(Path.home())))/"PrinterVoice"/"espeak-ng-data"
            shutil.copytree(ROOT/"espeak-ng-data",data_root,dirs_exist_ok=True)
            config = sherpa.OfflineTtsConfig(
                model=sherpa.OfflineTtsModelConfig(
                    kokoro=sherpa.OfflineTtsKokoroModelConfig(
                        model=str(ROOT/'model.int8.onnx'), voices=str(ROOT/'voices.bin'),
                        tokens=str(ROOT/'tokens.txt'), data_dir=str(data_root), lang='zh',
                        lexicon=','.join(str(ROOT/name) for name in ['lexicon-us-en.txt','lexicon-zh.txt'])),
                    num_threads=4, provider='cpu'),
                rule_fsts=','.join(str(ROOT/name) for name in ['phone-zh.fst','date-zh.fst','number-zh.fst']),
                max_num_sentences=1)
            if not config.validate():
                raise RuntimeError('离线女声模型不完整，请重新安装模型')
            _engine = sherpa.OfflineTts(config)
        audio = _engine.generate(text, sid=speaker, speed=rate)
        pcm=(np.clip(np.asarray(audio.samples),-1,1)*32767).astype('<i2').tobytes()
        if not pcm:raise RuntimeError('离线合成未返回音频')
        output=io.BytesIO()
        with wave.open(output,'wb') as wav:
            wav.setnchannels(1);wav.setsampwidth(2);wav.setframerate(audio.sample_rate);wav.writeframes(pcm)
        return output.getvalue()


def available():
    expected={'model.int8.onnx':114203914,'voices.bin':53790720,'tokens.txt':1111,'phone-zh.fst':88630,'date-zh.fst':59154,'number-zh.fst':64482,'lexicon-zh.txt':2120131,'lexicon-us-en.txt':5956885}
    if not all((ROOT/'espeak-ng-data'/name).is_file() for name in ['phontab','phondata','phonindex','intonations','en_dict','lang/gmw/en']):return False
    return all((ROOT/name).is_file() and (ROOT/name).stat().st_size==size for name,size in expected.items())


def warmup():
    if available():
        try:synthesize_local('你好。')
        except Exception:pass
