import unittest
from unittest.mock import patch
import speech_service as speech


class SpeechServiceTests(unittest.TestCase):
    def test_only_supported_female_voices_and_bounded_text_rate(self):
        valid={'text':'欢迎你','voice':'zh-CN-XiaoxiaoNeural','rate':1.05}
        self.assertEqual(speech.validate_request(valid),('欢迎你','zh-CN-XiaoxiaoNeural',5))
        for field,value in [('voice','zh-CN-YunxiNeural'),('text','x'*241),('rate',float('nan')),('rate',True)]:
            with self.subTest(field=field),self.assertRaises(ValueError):
                speech.validate_request({**valid,field:value})

    def test_repeat_utterance_uses_bounded_in_memory_cache(self):
        async def fake(*args):return b'audio'*200
        speech._cache.clear()
        data={'text':'本地单元测试','voice':'zh-CN-XiaoyiNeural','rate':1}
        with patch.object(speech,'_synthesize',side_effect=fake) as synth:
            self.assertEqual(speech.synthesize(data),speech.synthesize(data))
            self.assertEqual(synth.call_count,1)
        speech._cache.clear()


if __name__=='__main__':unittest.main()
