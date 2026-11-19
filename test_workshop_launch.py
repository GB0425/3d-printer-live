import io
import json
import unittest
from unittest.mock import patch, MagicMock
import launch


class WorkshopLaunchTests(unittest.TestCase):
    def setUp(self):
        self.old_port = launch.ACTIVE_PORT

    def tearDown(self):
        launch.ACTIVE_PORT = self.old_port

    def test_first_free_port_is_used_instead_of_forcing_8081(self):
        with patch.object(launch, 'listening', return_value=False), patch.object(launch, 'ThreadingHTTPServer') as server, patch.object(launch.threading, 'Thread'):
            url, _ = launch.ensure_server()
        self.assertEqual(url, 'http://127.0.0.1:8080/')
        self.assertEqual(server.call_args.args[0], ('127.0.0.1', 8080))

    def test_busy_port_uses_next_candidate(self):
        with patch.object(launch, 'listening', side_effect=[True, False]), patch.object(launch, 'local_get', side_effect=OSError), patch.object(launch, 'ThreadingHTTPServer') as server, patch.object(launch.threading, 'Thread'):
            url, _ = launch.ensure_server()
        self.assertEqual(url, 'http://127.0.0.1:8081/')
        self.assertEqual(server.call_args.args[0][1], 8081)

    def test_bridge_at_last_fallback_port_uses_fast_probes(self):
        response = io.StringIO(json.dumps({'service':'avatar-printer','identity':str(launch.ROOT)}))
        with patch.object(launch, 'listening', side_effect=lambda port, timeout_s: port == 8774) as probe, patch.object(launch, 'local_get', return_value=response):
            result = launch.bridge_status()
        self.assertEqual(result['url'], 'ws://127.0.0.1:8774')
        self.assertTrue(all(call.args[1] == .05 for call in probe.call_args_list))

    def test_follow_live_url_preserves_anchor_and_is_valid_capture_target(self):
        url = 'https://www.douyin.com/follow/live/167052124032?anchor_id=7695280373785478181'
        self.assertEqual(launch.room_address(url), ('167052124032', url))
        self.assertTrue(launch.is_room_page({'type': 'page', 'url': url}, '167052124032'))
        self.assertFalse(launch.is_room_page({'type': 'iframe', 'url': url}, '167052124032'))

    def test_capture_readiness_ignores_stale_bridges_and_unattached_own_bridge(self):
        def health(url, timeout):
            index = int(url.split(':')[2].split('/')[0]) - 8765
            return io.StringIO(json.dumps({'service':'avatar-printer','identity':str(launch.ROOT),
                                           'pid':100 if index == 0 else 200,'attached':index != 1}))
        with patch.object(launch, 'listening', side_effect=lambda port, timeout_s: port < 8768), patch.object(launch, 'local_get', side_effect=health):
            self.assertEqual(launch.bridge_status(200)['port'], 8767)

    def test_scene_process_inherits_actual_server_port(self):
        launch.ACTIVE_PORT = 8181
        with patch.object(launch.subprocess, 'Popen') as popen:
            launch.DesktopApi().open_scene_window(orient='portrait')
        args = popen.call_args.args[0]
        self.assertEqual(args[-2:], ['--server-port', '8181'])
        self.assertIn('portrait', args)


if __name__ == '__main__':
    unittest.main()
