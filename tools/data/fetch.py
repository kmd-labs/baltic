#!/usr/bin/env python3
"""Download raw datasets listed in registry.json into data/raw/<id>/ and verify them.

Integrity model:
  - size and md5 are checked when the registry declares them (published by the source);
  - every file's sha256 is pinned in checksums.lock.json on first download (trust on first use)
    and enforced on every later run, so a silently changed upstream file aborts the build.

Policy: a dataset may only be fetched if its id is registered in SOURCES.md (task 0-03).

Usage:
  python tools/data/fetch.py                 # all datasets
  python tools/data/fetch.py --tier 1        # one tier
  python tools/data/fetch.py dated1 gebco2024
  python tools/data/fetch.py --offline       # verify the local cache only, never download
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TOOLS = Path(__file__).resolve().parent
REGISTRY = TOOLS / "registry.json"
LOCK = TOOLS / "checksums.lock.json"
SOURCES = ROOT / "SOURCES.md"
RAW = ROOT / "data" / "raw"

CHUNK = 1 << 20
USER_AGENT = "kmd-labs-baltic-fetch/1.0 (+https://github.com/kmd-labs/baltic)"


class FetchError(Exception):
    pass


def digest(path: Path, algo: str) -> str:
    h = hashlib.new(algo)
    with path.open("rb") as f:
        for block in iter(lambda: f.read(CHUNK), b""):
            h.update(block)
    return h.hexdigest()


def load_json(path: Path, default):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else default


def save_lock(lock: dict) -> None:
    tmp = LOCK.with_suffix(".tmp")
    tmp.write_text(json.dumps(lock, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    os.replace(tmp, LOCK)


def registered_source_ids() -> set[str]:
    if not SOURCES.exists():
        return set()
    text = SOURCES.read_text(encoding="utf-8")
    return set(re.findall(r"^\| `([a-z0-9_]+)` \|", text, flags=re.M))


def download(url: str, dest: Path, expected_size: int | None) -> None:
    part = dest.with_name(dest.name + ".part")
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    started, done, last = time.monotonic(), 0, 0.0
    with urllib.request.urlopen(req, timeout=120) as resp, part.open("wb") as out:
        total = expected_size or int(resp.headers.get("Content-Length") or 0)
        for block in iter(lambda: resp.read(CHUNK), b""):
            out.write(block)
            done += len(block)
            now = time.monotonic()
            if total and now - last > 2:
                rate = done / max(now - started, 1e-6) / 1e6
                print(f"    {done / 1e6:8.1f} / {total / 1e6:.1f} MB  ({rate:.1f} MB/s)", file=sys.stderr)
                last = now
    os.replace(part, dest)


def verify_declared(path: Path, spec: dict) -> None:
    if "size" in spec and path.stat().st_size != spec["size"]:
        raise FetchError(f"{path.name}: size {path.stat().st_size} != declared {spec['size']}")
    if "md5" in spec and digest(path, "md5") != spec["md5"]:
        raise FetchError(f"{path.name}: md5 does not match the value published by the source")


def fetch_file(ds_id: str, spec: dict, lock: dict, offline: bool) -> str:
    dest = RAW / ds_id / spec["name"]
    pinned = lock.get(ds_id, {}).get(spec["name"])

    if not dest.exists():
        if offline:
            raise FetchError(f"{ds_id}/{spec['name']}: missing from data/raw/ and --offline is set")
        dest.parent.mkdir(parents=True, exist_ok=True)
        print(f"  ↓ {spec['name']}", file=sys.stderr)
        download(spec["url"], dest, spec.get("size"))
        status = "downloaded"
    else:
        status = "cached"

    try:
        verify_declared(dest, spec)
        sha = digest(dest, "sha256")
        if pinned and pinned["sha256"] != sha:
            raise FetchError(
                f"{ds_id}/{spec['name']}: sha256 {sha[:12]}… differs from checksums.lock.json "
                f"({pinned['sha256'][:12]}…). The source file changed or the cache is corrupt. "
                f"Delete data/raw/{ds_id}/{spec['name']} to retry; if the source was updated on purpose, "
                f"remove its lock entry and review the change."
            )
    except FetchError:
        if status == "downloaded":
            dest.unlink(missing_ok=True)
        raise

    if not pinned:
        lock.setdefault(ds_id, {})[spec["name"]] = {"sha256": sha, "size": dest.stat().st_size, "url": spec["url"]}
        status += ", pinned"
    return status


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("ids", nargs="*", help="dataset ids from registry.json (default: all)")
    ap.add_argument("--tier", type=int, help="only datasets of this tier")
    ap.add_argument("--offline", action="store_true", help="never download, only verify data/raw/")
    args = ap.parse_args()
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")  # Windows consoles default to a legacy code page

    datasets = load_json(REGISTRY, {})["datasets"]
    known = {d["id"] for d in datasets}
    unknown = set(args.ids) - known
    if unknown:
        print(f"error: unknown dataset id(s): {', '.join(sorted(unknown))}", file=sys.stderr)
        return 2
    selected = [d for d in datasets
                if (not args.ids or d["id"] in args.ids) and (args.tier is None or d.get("tier") == args.tier)]

    registered = registered_source_ids()
    unregistered = [d["id"] for d in selected if d["id"] not in registered]
    if unregistered:
        print(f"error: not registered in SOURCES.md: {', '.join(unregistered)} — add the entry before fetching",
              file=sys.stderr)
        return 2

    lock = load_json(LOCK, {})
    failures = 0
    for ds in selected:
        print(f"{ds['id']}: {ds['title']}", file=sys.stderr)
        for spec in ds["files"]:
            try:
                status = fetch_file(ds["id"], spec, lock, args.offline)
                print(f"  ✓ {spec['name']} ({status})", file=sys.stderr)
            except (FetchError, OSError) as e:
                failures += 1
                print(f"  ✗ {e}", file=sys.stderr)
            save_lock(lock)

    if failures:
        print(f"\n{failures} file(s) failed verification", file=sys.stderr)
        return 1
    print(f"\nok — {sum(len(d['files']) for d in selected)} file(s) verified", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
