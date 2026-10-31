"""JSON Schema validation of the Baltic data contract (0-06).

    python tools/data/contract.py frame src/assets/data/frames/f-0.json
    python tools/data/contract.py manifest src/assets/data/manifest.json

Schemas live in contract/schema/. Pipeline enforcement is V-01, the CI gate 0-08.
"""

from __future__ import annotations

import json
import sys
from functools import cache
from pathlib import Path

from jsonschema import Draft202012Validator
from referencing import Registry, Resource

ROOT = Path(__file__).resolve().parents[2]
SCHEMA_DIR = ROOT / "contract" / "schema"
KINDS = ("frame", "manifest", "timeline", "sills", "taxa", "curve")


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


def main(argv: list[str]) -> int:
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
