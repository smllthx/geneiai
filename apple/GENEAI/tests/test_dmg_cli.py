"""Portable CLI/guardrail tests. These do NOT test Xcode or create a real DMG."""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "crear_dmg.sh"


class DMGCommandTests(unittest.TestCase):
    def invoke(self, *args):
        # Force a non-Mac host regardless of the computer running the tests.
        with tempfile.TemporaryDirectory() as directory:
            fake_uname = Path(directory) / "uname"
            fake_uname.write_text("#!/bin/sh\nprintf 'Linux\\n'\n")
            fake_uname.chmod(0o755)
            environment = dict(os.environ)
            environment["PATH"] = directory + os.pathsep + environment.get("PATH", "")
            return subprocess.run(
                ["bash", str(SCRIPT), *args], env=environment,
                text=True, capture_output=True, timeout=10, check=False,
            )

    def test_shell_syntax(self):
        result = subprocess.run(["bash", "-n", str(SCRIPT)], capture_output=True, timeout=10)
        self.assertEqual(result.returncode, 0, result.stderr.decode())

    def test_help_does_not_require_mac(self):
        result = self.invoke("--help")
        self.assertEqual(result.returncode, 0)
        self.assertIn("--check", result.stdout)

    def test_unknown_argument_is_rejected(self):
        self.assertEqual(self.invoke("--force").returncode, 2)

    def test_extra_arguments_are_rejected(self):
        self.assertEqual(self.invoke("--check", "--force").returncode, 2)

    def test_build_refuses_non_mac(self):
        result = self.invoke()
        self.assertEqual(result.returncode, 3)
        self.assertIn("no se ha compilado", result.stderr)

    def test_check_refuses_non_mac(self):
        result = self.invoke("--check")
        self.assertEqual(result.returncode, 3)
        self.assertIn("macOS real", result.stderr)


if __name__ == "__main__":
    unittest.main()
