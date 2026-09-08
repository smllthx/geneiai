import importlib.util
import plistlib
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("configure_backend", ROOT / "scripts" / "configure_backend.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class BackendConfigurationTests(unittest.TestCase):
    def config(self, **changes):
        return dict(version=1, projectRef="a" * 20,
                    supabaseUrl="https://" + "a" * 20 + ".supabase.co",
                    publishableKey="sb_publishable_fixture_not_a_real_key", **changes)

    def test_xcconfig_round_trip_keeps_https_after_comment_parsing(self):
        config = self.config()
        rendered = module.render_settings(config)
        values = {}
        for line in rendered.splitlines():
            line = line.split("//", 1)[0]
            if "=" in line:
                key, value = line.split("=", 1)
                values[key.strip()] = value.strip()
        expand = lambda value: re.sub(r"\$\(([^)]+)\)", lambda match: values[match[1]], value)
        self.assertEqual(expand(values["SUPABASE_URL"]), config["supabaseUrl"])
        self.assertEqual(values["SUPABASE_PUBLISHABLE_KEY"], config["publishableKey"])

    def test_mismatched_or_non_https_endpoint_is_refused(self):
        for url in ["https:", "http://" + "a" * 20 + ".supabase.co", "https://other.supabase.co",
                    "https://" + "a" * 20 + ".supabase.co/path", "https://" + "a" * 20 + ".supabase.co?x=1"]:
            config = self.config()
            config["supabaseUrl"] = url
            with self.subTest(url=url), self.assertRaises(ValueError):
                module.render_settings(config)

    def test_private_empty_unresolved_or_injected_key_is_refused(self):
        for key in ["", "sb_secret_forbidden", "eyJservice_role", "$(UNRESOLVED)",
                    "sb_publishable_ok\nEVIL = value", "sb_publishable_ok//comment"]:
            config = self.config()
            config["publishableKey"] = key
            with self.subTest(key_type=key[:12]), self.assertRaises(ValueError):
                module.render_settings(config)

    def test_invalid_project_and_version_are_refused(self):
        for field, value in [("projectRef", "$(PROJECT)"), ("projectRef", None), ("version", 2)]:
            config = self.config()
            config[field] = value
            with self.subTest(field=field), self.assertRaises(ValueError):
                module.render_settings(config)
        with self.assertRaises(ValueError):
            module.render_settings([])

    def test_plist_reads_generated_settings_and_preserves_app_identity(self):
        info = plistlib.loads((ROOT / "GENAIAApple" / "Info.plist").read_bytes())
        self.assertEqual(info["CFBundleDisplayName"], "GENEAI")
        self.assertEqual(info["GENAIA_SUPABASE_PROJECT_REF"], "$(SUPABASE_PROJECT_REF)")
        self.assertEqual(info["GENAIA_SUPABASE_URL"], "$(SUPABASE_URL)")
        self.assertEqual(info["GENAIA_SUPABASE_PUBLISHABLE_KEY"], "$(SUPABASE_PUBLISHABLE_KEY)")
        self.assertIn("PRODUCT_BUNDLE_IDENTIFIER: com.genaia.app", (ROOT / "project.yml").read_text())

    def test_default_source_is_the_web_repository_config(self):
        self.assertEqual(module.CONFIG_PATH, ROOT.parents[1] / "config" / "geneai-backend.json")


if __name__ == "__main__":
    unittest.main()
