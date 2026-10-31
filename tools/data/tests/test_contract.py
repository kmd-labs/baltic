"""Contract tests (0-06): schemas accept the valid fixtures and reject every broken one;
the KMDG grid format round-trips and its committed fixtures are reproducible.

    python -m unittest discover -s tools/data/tests -t .
"""

from __future__ import annotations

import gzip
import json
import unittest
from pathlib import Path

import numpy as np

from tools.data import contract, kmdg
from tools.data.tests import grid_fixtures

FIXTURES = Path(__file__).resolve().parents[3] / "contract" / "fixtures"


def load(p: Path):
    return json.loads(p.read_text(encoding="utf-8"))


class SchemaFixtures(unittest.TestCase):
    def test_every_kind_has_valid_and_invalid_fixtures(self):
        for kind in contract.KINDS:
            self.assertTrue(list((FIXTURES / "valid" / kind).glob("*.json")), f"no valid {kind} fixture")
            self.assertTrue(list((FIXTURES / "invalid" / kind).glob("*.json")), f"no invalid {kind} fixture")

    def test_valid_fixtures_pass(self):
        for p in sorted((FIXTURES / "valid").glob("*/*.json")):
            with self.subTest(p.relative_to(FIXTURES).as_posix()):
                self.assertEqual(contract.errors(p.parent.name, load(p)), [])

    def test_invalid_fixtures_fail(self):
        for p in sorted((FIXTURES / "invalid").glob("*/*.json")):
            with self.subTest(p.relative_to(FIXTURES).as_posix()):
                self.assertNotEqual(contract.errors(p.parent.name, load(p)), [])

    def test_frame_without_datum_is_rejected_for_datum(self):
        errs = contract.errors("frame", load(FIXTURES / "invalid" / "frame" / "missing-datum.json"))
        self.assertTrue(any("'datum' is a required property" in e for e in errs), errs)

    def test_data_quality_enum(self):
        schema = load(contract.SCHEMA_DIR / "common.schema.json")
        self.assertEqual(schema["$defs"]["dataQuality"]["enum"], ["modelled", "interpolated", "qualitative"])

    def test_ice_null_allowed_empty_object_not(self):
        frame = load(FIXTURES / "valid" / "frame" / "sea-today.json")
        self.assertIsNone(frame["ice"])
        self.assertEqual(contract.errors("frame", frame), [])
        frame["ice"] = {}
        self.assertNotEqual(contract.errors("frame", frame), [])


class KmdgFormat(unittest.TestCase):
    def test_round_trip(self):
        for name, grid in grid_fixtures.fixtures().items():
            with self.subTest(name):
                back = kmdg.decode(kmdg.encode(grid))
                np.testing.assert_array_equal(back.raw, grid.raw)
                self.assertEqual(back.bbox, grid.bbox)
                np.testing.assert_allclose(back.times, grid.times, rtol=1e-6)

    def test_committed_fixtures_are_reproducible(self):
        for name, grid in grid_fixtures.fixtures().items():
            with self.subTest(name):
                committed = (grid_fixtures.FIXTURE_DIR / f"{name}.kmdg.gz").read_bytes()
                self.assertEqual(committed, gzip.compress(kmdg.encode(grid), compresslevel=9, mtime=0))
                self.assertEqual(load(grid_fixtures.FIXTURE_DIR / f"{name}.expected.json"), grid_fixtures.expected(grid))

    def test_nodata_and_scale(self):
        cube = kmdg.read(grid_fixtures.FIXTURE_DIR / "cube-int16.kmdg.gz")
        v = cube.values()
        self.assertAlmostEqual(v[0, 0, 0], 281.97, places=6)
        self.assertTrue(np.isnan(v[0, 1, 3]))

    def test_rejects_values_that_do_not_fit(self):
        with self.assertRaises(ValueError):
            kmdg.quantize(np.array([400.0]), scale=0.01)

    def test_rejects_truncated_file(self):
        buf = kmdg.encode(grid_fixtures.fixtures()["cube-int16"])
        with self.assertRaises(ValueError):
            kmdg.decode(buf[:-2])
        with self.assertRaises(ValueError):
            kmdg.decode(b"PNG\x00" + buf[4:])


if __name__ == "__main__":
    unittest.main()
