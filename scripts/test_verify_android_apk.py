#!/usr/bin/env python3
"""Exercise the APK verifier's real native-result gate with JUnit XML fixtures."""
import ast
from pathlib import Path
import tempfile
import unittest
import xml.etree.ElementTree as ET


# The CLI verifies SDK tools and APK signatures at module load. Load only its
# actual policy and XML checker definitions; do not mock or duplicate either.
verifier = Path(__file__).with_name('verify_android_apk.py')
definitions = [node for node in ast.parse(verifier.read_text()).body if
    isinstance(node, ast.FunctionDef) and node.name == 'verify_native_acceptance'
    or isinstance(node, ast.Assign) and any(isinstance(target, ast.Name) and target.id == 'required' for target in node.targets)]
assert len(definitions) == 2
scope = {'ET': ET}
exec(compile(ast.Module(body=definitions, type_ignores=[]), str(verifier), 'exec'), scope)
required = scope['required']
verify_native_acceptance = scope['verify_native_acceptance']
auto_case = 'verifiedAutoGetsStandardControlsWithoutFrameworkTrustAndOtherControllersKeepTheirPolicy'


class NativeAcceptanceVerifierTest(unittest.TestCase):
    def setUp(self):
        self.assertIn(auto_case, required['AudioPlaybackIntegrationTest'])
        self.folder = tempfile.TemporaryDirectory(prefix='heritage-native-result-fixture-')
        self.addCleanup(self.folder.cleanup)
        self.reports = Path(self.folder.name)
        self.cases = {}
        for classname, names in required.items():
            suite = ET.Element('testsuite')
            for name in sorted(names):
                self.cases[(classname, name)] = ET.SubElement(suite, 'testcase', classname='faith.heritage.app.' + classname, name=name)
            self.cases[classname] = suite
        self.expected = {classname + '.' + name for classname, names in required.items() for name in names}

    def check(self):
        for classname in required:
            ET.ElementTree(self.cases[classname]).write(self.reports / (classname + '.xml'), encoding='utf-8')
        return verify_native_acceptance(self.reports, required)

    def test_complete_passing_reports_are_accepted(self):
        self.assertEqual(self.expected, self.check())

    def test_missing_auto_policy_case_is_rejected(self):
        self.cases['AudioPlaybackIntegrationTest'].remove(self.cases[('AudioPlaybackIntegrationTest', auto_case)])
        with self.assertRaisesRegex(AssertionError, auto_case):
            self.check()

    def test_auto_case_must_not_be_failed_errored_or_skipped(self):
        case = self.cases[('AudioPlaybackIntegrationTest', auto_case)]
        for status in ['failure', 'error', 'skipped']:
            with self.subTest(status=status):
                marker = ET.SubElement(case, status)
                with self.assertRaisesRegex(AssertionError, 'Android test did not pass'):
                    self.check()
                case.remove(marker)

    def test_unrelated_class_cannot_replace_required_auto_case(self):
        self.cases[('AudioPlaybackIntegrationTest', auto_case)].set('classname', 'example.OtherTest')
        with self.assertRaisesRegex(AssertionError, auto_case):
            self.check()

    def test_no_reports_are_rejected(self):
        with self.assertRaisesRegex(AssertionError, 'Missing native acceptance results'):
            verify_native_acceptance(self.reports, required)


if __name__ == '__main__':
    unittest.main()
