"""JSON Schema validation of the Baltic data contract (0-06).

    python tools/data/contract.py                  # every JSON in src/assets/data/, kind by path
    python tools/data/contract.py frame src/assets/data/frames/f-0.json
    python tools/data/contract.py manifest src/assets/data/manifest.json

Schemas live in contract/schema/. Pipeline enforcement is V-01, the CI gate 0-08.
"""

from __future__ import annotations

import json
import re
import sys
from functools import cache
from pathlib import Path

from jsonschema import Draft202012Validator
from referencing import Registry, Resource

ROOT = Path(__file__).resolve().parents[2]
SCHEMA_DIR = ROOT / "contract" / "schema"
ASSET_DIR = ROOT / "src" / "assets" / "data"
KINDS = ("frame", "manifest", "timeline", "sills", "taxa", "curve")

# Path conventions from contract/README.md, as patterns on the path relative to src/assets/data.
LAYOUT: tuple[tuple[str, str], ...] = (
    (r"^manifest\.json$", "manifest"),
    (r"^timeline\.json$", "timeline"),
    (r"^sills\.json$", "sills"),
    (r"^taxa\.json$", "taxa"),
    (r"^frames/f-\d+\.json$", "frame"),
    (r"^curves/[a-z0-9-]+\.json$", "curve"),
)

# Assets that predate the contract and have no schema. Listed one by one, with the task that
# retires each, so a new unrecognised file fails the walk instead of slipping past it.
UNCONTRACTED: dict[str, str] = {
    "prototype/ice-dated1.json": "DATED-1 outlines, prototype shape — contract form lands with I-01",
    "prototype/checkpoints.json": "H_paleo control points consumed by test:contract, not by the app",
}


@cache
def _registry() -> Registry:
    resources = []
    for p in sorted(SCHEMA_DIR.glob("*.schema.json")):
        schema = json.loads(p.read_text(encoding="utf-8"))
        res = Resource.from_contents(schema)
        resources += [(schema["$id"], res), (p.name, res)]
    return Registry().with_resources(resources)


@cache
def validator(kind: str) -> Draft202012Validator:
    if kind not in KINDS:
        raise ValueError(f"unknown contract kind {kind!r}; expected one of {KINDS}")
    schema = json.loads((SCHEMA_DIR / f"{kind}.schema.json").read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema, registry=_registry())


def errors(kind: str, instance) -> list[str]:
    """Human-readable violations, empty when the instance is valid."""
    out = []
    for e in sorted(validator(kind).iter_errors(instance), key=lambda e: list(e.absolute_path)):
        where = "/".join(str(p) for p in e.absolute_path) or "(root)"
        out.append(f"{where}: {e.message}")
    return out


def kind_of(rel: str) -> str | None:
    """Contract kind for a path relative to src/assets/data, or None when nothing claims it."""
    for pattern, kind in LAYOUT:
        if re.match(pattern, rel):
            return kind
    return None


def walk() -> int:
    """Validate every JSON under src/assets/data/ against the schema its path implies (0-08).

    An unrecognised JSON is a failure, not a skip: the gate is only worth having if adding a file
    to the asset directory forces a decision about which schema describes it.
    """
    if not ASSET_DIR.is_dir():
        print(f"✗ {ASSET_DIR.relative_to(ROOT)} does not exist")
        return 1
    checked = bad = 0
    for p in sorted(ASSET_DIR.rglob("*.json")):
        rel = p.relative_to(ASSET_DIR).as_posix()
        if rel in UNCONTRACTED:
            print(f"– {rel} — no schema: {UNCONTRACTED[rel]}")
            continue
        kind = kind_of(rel)
        if kind is None:
            print(f"✗ {rel}: no schema claims this path; add it to LAYOUT or to UNCONTRACTED")
            bad += 1
            continue
        errs = errors(kind, json.loads(p.read_text(encoding="utf-8")))
        print(f"{'✗' if errs else '✓'} {rel} ({kind})")
        for e in errs:
            print(f"    {e}")
        checked += 1
        bad += bool(errs)
    print(f"\n{checked} file(s) against the contract, {len(UNCONTRACTED)} exempt, {bad} failing")
    return 1 if bad else 0


def main(argv: list[str]) -> int:
    if not argv:
        return walk()
    if len(argv) < 2:
        print(__doc__.strip())
        return 2
    kind, files = argv[0], argv[1:]
    bad = 0
    for f in files:
        errs = errors(kind, json.loads(Path(f).read_text(encoding="utf-8")))
        print(f"{'✗' if errs else '✓'} {f}")
        for e in errs:
            print(f"    {e}")
        bad += bool(errs)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.exit(main(sys.argv[1:]))
