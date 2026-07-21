#!/usr/bin/env python3
"""Packages the extension into a ZIP for the Chrome Web Store.

The archive contains the contents of src/ at its root, not the src/ folder
itself — the Web Store rejects an upload where manifest.json is not at the top
level of the ZIP.

Validates before packaging, so a broken manifest fails here rather than after
an upload.

Usage: python3 tools/build.py
Output: dist/<name>-<version>.zip
"""

import json
import os
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src")
DIST = os.path.join(ROOT, "dist")

# Never ship editor/OS noise, even if it appears inside src/.
EXCLUDED_NAMES = {".DS_Store", "Thumbs.db", "desktop.ini"}
EXCLUDED_SUFFIXES = (".map", ".orig", ".rej", "~")

# Local-only scaffolding. preview-*.html pages stub out the chrome.* APIs so the
# popup can be opened in a plain browser for screenshots; shipping them would put
# dead pages and a fake API shim inside the published extension.
EXCLUDED_PREFIXES = ("preview-",)

errors = []
warnings = []


def fail(msg):
    errors.append(msg)


def warn(msg):
    warnings.append(msg)


def collect_files():
    """Every file under src/, as (absolute path, path inside the archive)."""
    found = []
    skipped = []
    for dirpath, dirnames, filenames in os.walk(SRC):
        dirnames[:] = sorted(d for d in dirnames if not d.startswith("."))
        for name in sorted(filenames):
            if name.startswith(".") or name in EXCLUDED_NAMES:
                continue
            if name.endswith(EXCLUDED_SUFFIXES):
                continue
            if name.startswith(EXCLUDED_PREFIXES):
                skipped.append(name)
                continue
            absolute = os.path.join(dirpath, name)
            # Forward slashes: ZIP entry names are not OS paths.
            arcname = os.path.relpath(absolute, SRC).replace(os.sep, "/")
            found.append((absolute, arcname))
    for name in skipped:
        print(f"skipped (local-only): {name}")
    return found


def validate(manifest, files):
    arcnames = {arc for _, arc in files}

    if "manifest.json" not in arcnames:
        fail("src/manifest.json is missing")
        return

    if manifest.get("manifest_version") != 3:
        fail(f"manifest_version is {manifest.get('manifest_version')}, expected 3")

    for field in ("name", "version", "description"):
        if not manifest.get(field):
            fail(f"manifest is missing required field: {field}")

    # The Web Store rejects a version it has seen before, and a version that
    # disagrees with package.json makes the release ambiguous.
    try:
        with open(os.path.join(ROOT, "package.json"), encoding="utf-8") as fh:
            package_version = json.load(fh).get("version")
        if package_version and package_version != manifest.get("version"):
            warn(
                f"version mismatch: manifest.json {manifest.get('version')} "
                f"vs package.json {package_version}"
            )
    except FileNotFoundError:
        pass

    # Every path the manifest points at must actually be in the archive.
    referenced = []
    if "action" in manifest:
        if "default_popup" in manifest["action"]:
            referenced.append(manifest["action"]["default_popup"])
        referenced.extend(manifest["action"].get("default_icon", {}).values())
    referenced.extend(manifest.get("icons", {}).values())
    if "background" in manifest:
        referenced.append(manifest["background"].get("service_worker"))

    for ref in filter(None, referenced):
        if ref not in arcnames:
            fail(f"manifest references {ref}, which is not in src/")

    if not manifest.get("icons", {}).get("128"):
        warn("no 128px icon — the Web Store requires one for the listing")


def main():
    if not os.path.isdir(SRC):
        print(f"error: {SRC} does not exist", file=sys.stderr)
        return 1

    with open(os.path.join(SRC, "manifest.json"), encoding="utf-8") as fh:
        try:
            manifest = json.load(fh)
        except json.JSONDecodeError as exc:
            print(f"error: src/manifest.json is not valid JSON: {exc}", file=sys.stderr)
            return 1

    files = collect_files()
    validate(manifest, files)

    for message in warnings:
        print(f"warning: {message}")
    if errors:
        for message in errors:
            print(f"error: {message}", file=sys.stderr)
        print(f"\n{len(errors)} error(s), not packaging.", file=sys.stderr)
        return 1

    os.makedirs(DIST, exist_ok=True)
    slug = manifest["name"].lower().replace(" ", "-")
    out = os.path.join(DIST, f"{slug}-{manifest['version']}.zip")

    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for absolute, arcname in files:
            zf.write(absolute, arcname)

    for _, arcname in files:
        print(f"  {arcname}")
    size_kb = os.path.getsize(out) / 1024
    print(f"\n{len(files)} files -> {os.path.relpath(out, ROOT)} ({size_kb:.1f} KB)")
    print(f"Upload at https://chrome.google.com/webstore/devconsole")
    return 0


if __name__ == "__main__":
    sys.exit(main())
