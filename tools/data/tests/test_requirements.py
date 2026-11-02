"""The contract-time dependency subset agrees with the frozen pipeline set (`0-08`).

requirements-contract.txt exists so CI can validate committed assets without GDAL-backed wheels.
It is a copy, and a copy claiming to match another file is worth exactly as much as the check that
it does — a comment would let the two drift silently across a dependency bump.
"""

from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
FULL = ROOT / "tools" / "data" / "requirements.txt"
SUBSET = ROOT / "tools" / "data" / "requirements-contract.txt"


def pins(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "==" not in line:
            continue
        name, version = line.split("==", 1)
        out[name.strip().lower()] = version.strip()
    return out


class RequirementsSubset(unittest.TestCase):
    def test_subset_pins_match_the_frozen_set(self) -> None:
        full, subset = pins(FULL), pins(SUBSET)
        self.assertTrue(subset, "requirements-contract.txt has no pins")
        for name, version in sorted(subset.items()):
            self.assertIn(name, full, f"{name} is pinned for the contract but absent from requirements.txt")
            self.assertEqual(
                version,
                full[name],
                f"{name} is {version} in requirements-contract.txt and {full[name]} in requirements.txt",
            )


if __name__ == "__main__":
    unittest.main()
