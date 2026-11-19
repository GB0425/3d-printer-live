import unittest
from unittest.mock import MagicMock, patch
import launch
import io
import os
import tempfile
from pathlib import Path

class ControlWindowTests(unittest.TestCase):
    def test_configuration_reuses_window_and_never_spawns_an_engine(self):
        api=launch.DesktopApi();window=MagicMock()
        with patch('webview.create_window', return_value=window) as create:
            api.open_control_window();api.open_control_window()
        self.assertEqual(create.call_count,1)
        self.assertIn('/control-view.html',create.call_args.args[1])
        window.restore.assert_called_once()
        self.assertIsNone(api._scene_process)

    def test_commands_target_only_original_print_window(self):
        api=launch.DesktopApi();api._main_window=MagicMock();api._control_window=MagicMock()
        api.control_action({'id':'12','type':'click'});api.control_snapshot('12,13')
        self.assertEqual(api._main_window.evaluate_js.call_count,2)
        api._control_window.evaluate_js.assert_not_called()
        with self.assertRaises(ValueError):api.control_action('bad')

    def test_closed_configuration_can_be_reopened(self):
        api=launch.DesktopApi();api._control_window=MagicMock();api._control_closed()
        self.assertIsNone(api._control_window)

    def test_duplicate_launch_activates_authenticated_local_endpoint(self):
        with patch.object(launch,'local_get',return_value=io.StringIO('{"ok":true}')) as get:
            self.assertTrue(launch.activate_existing('http://127.0.0.1:8080/'))
        request=get.call_args.args[0]
        self.assertEqual(request.full_url,'http://127.0.0.1:8080/__activate')
        self.assertEqual(request.get_header('Sec-fetch-site'),'same-origin')

    @unittest.skipUnless(os.name=='nt','Windows locking')
    def test_only_one_desktop_instance_can_hold_the_lock(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'instance.lock';first=launch.claim_desktop_instance(path)
            self.assertIsNot(first,False)
            try:self.assertIs(launch.claim_desktop_instance(path),False)
            finally:first.close()
            again=launch.claim_desktop_instance(path)
            self.assertIsNot(again,False);again.close()

if __name__=='__main__':unittest.main()
