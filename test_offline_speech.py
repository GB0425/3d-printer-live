import unittest
from unittest.mock import patch
import speech_service as speech

class OfflineSpeechTests(unittest.TestCase):
    def test_offline_voice_uses_no_online_synthesis_and_caches(self):
        speech._cache.clear()
        request={'text':'测试观众，轮到你啦。','voice':'kokoro-female','rate':1}
        with patch('offline_speech.synthesize_local',return_value=b'RIFF'+b'0'*600) as local, patch.object(speech,'_synthesize',side_effect=AssertionError('must not connect')):
            a=speech.synthesize(request)
            self.assertEqual(a,speech.synthesize(request))
            local.assert_called_once_with(request['text'],1.0)
        speech._cache.clear()

if __name__=='__main__':unittest.main()
