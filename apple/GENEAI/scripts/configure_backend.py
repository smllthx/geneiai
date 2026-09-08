#!/usr/bin/env python3
"""Generate Apple build settings from the same public backend file as the web."""
import argparse
import json
import re
from pathlib import Path
from urllib.parse import urlsplit

APPLE_ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = APPLE_ROOT.parents[1] / "config" / "geneai-backend.json"


def render_settings(config: dict) -> str:
    if not isinstance(config, dict):
        raise ValueError("Backend configuration must be an object")
    if config.get("version") != 1:
        raise ValueError("Unsupported backend configuration version")
    project = config.get("projectRef", "")
    if not isinstance(project, str) or not re.fullmatch(r"[a-z]{20}", project):
        raise ValueError("Invalid backend project reference")
    raw_url = config.get("supabaseUrl", "")
    if not isinstance(raw_url, str):
        raise ValueError("Invalid backend URL")
    url = urlsplit(raw_url)
    if (url.scheme != "https" or url.netloc != f"{project}.supabase.co"
            or url.path not in ("", "/") or url.query or url.fragment):
        raise ValueError("Backend URL must match the canonical HTTPS project")
    key = config.get("publishableKey", "")
    if not isinstance(key, str) or not re.fullmatch(r"sb_publishable_[A-Za-z0-9_-]+", key):
        raise ValueError("A public publishable key is required; secret/service-role keys are refused")
    # Expansion happens after xcconfig comment parsing; never write raw https://.
    return (
        "// Generated from config/geneai-backend.json. Do not edit.\n"
        "GENEAI_URL_SLASH = /\n"
        f"SUPABASE_PROJECT_REF = {project}\n"
        f"SUPABASE_URL = https:$(GENEAI_URL_SLASH)$(GENEAI_URL_SLASH){url.netloc}\n"
        f"SUPABASE_PUBLISHABLE_KEY = {key}\n"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Validate without writing build settings")
    args = parser.parse_args()
    try:
        settings = render_settings(json.loads(CONFIG_PATH.read_text()))
        if not args.check:
            target = APPLE_ROOT / "Config" / "Local.xcconfig"
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(settings)
    except (OSError, ValueError, TypeError) as error:
        parser.exit(1, f"Backend configuration unavailable: {error}\n")
    print("Shared backend configuration validated." if args.check else "Apple backend settings generated.")


if __name__ == "__main__":
    main()
