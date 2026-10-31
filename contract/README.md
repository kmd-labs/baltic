# Kontrakt danych (`0-06`)

Umowa między pipeline'em (`tools/data/`) a aplikacją (`src/`). Opisuje wszystko, co trafia do `src/assets/data/`. Plan: [`docs/research/baltic-data-plan.md`](../docs/research/baltic-data-plan.md) §5.

| Plik w `src/assets/data/` | Schemat |
| :-- | :-- |
| `manifest.json` | [`schema/manifest.schema.json`](schema/manifest.schema.json) |
| `frames/f-<tBP>.json` | [`schema/frame.schema.json`](schema/frame.schema.json) |
| `timeline.json` | [`schema/timeline.schema.json`](schema/timeline.schema.json) |
| `sills.json` | [`schema/sills.schema.json`](schema/sills.schema.json) |
| `taxa.json` | [`schema/taxa.schema.json`](schema/taxa.schema.json) |
| `curves/<id>.json` | [`schema/curve.schema.json`](schema/curve.schema.json) |
| `grid/*.bin.gz` | format KMDG/1 — niżej |

Wspólne definicje (`datum`, `stageId`, `gia`, `dataQuality`, `psuRange` …) są w [`schema/common.schema.json`](schema/common.schema.json). Schematy: JSON Schema draft 2020-12.

## Reguły, których pilnują schematy

- **`datum` jest obowiązkowy** w manifeście i w każdej klatce (plan §0.2). Klatki paleo mają `contemporaneous-geoid`.
- **`gia.source` + `gia.earthModel` są obowiązkowe.** Jedyne dozwolone źródło to `steffen2025_rsl` (`0-02`).
- **`ice: null`** oznacza brak lądolodu w klatce. Obiekt `ice` musi mieć `source: "dated1"`, więc `ice: {}` jest odrzucany.
- **`dataQuality`** ∈ `modelled | interpolated | qualitative`.
- **`psuRange` i tolerancje taksonów to przedziały `[min, max]`**, nigdy skalary.
- **Data ¹⁴C wymaga `calCurve: "IntCal20"`** (`C-09`).
- **Faza jeziorna wymaga odpływu:** przy `water.type: "lake"` pole `water.outlet` musi wskazywać próg.
- **`sources` nigdy nie jest puste.**
- **Dane noszą wyłącznie identyfikatory** (`I-03`), a teksty dla użytkownika leżą w `src/assets/content/{lang}/`.
- **Nieznane pola są błędem** (`additionalProperties: false`). Nowe pole wymaga zmiany schematu.
- **Manifest nie zawiera znaczników czasu.** Ponowny przebieg pipeline'u daje identyczny plik.

## Wersjonowanie (`schemaVersion`)

Semver `MAJOR.MINOR.PATCH`, dziś `1.0.0`.

| Zmiana | Wersja | Przykład |
| :-- | :-- | :-- |
| Aplikacja nie odczyta starego pliku albo stara aplikacja nie odczyta nowego | **MAJOR** | zmiana nazwy pola, nowe pole obowiązkowe, zmiana znaczenia jednostki |
| Nowe pole opcjonalne, nowa wartość w enum | MINOR | `metrics.residenceTimeYr` |
| Opis, przykład, poprawka bez zmiany walidacji | PATCH | |

Aplikacja odmawia odczytu pliku z innym **MAJOR** i pokazuje czytelny błąd (`I-02`). Schemat dopuszcza wyłącznie `1.x.y`. Przy podbiciu MAJOR zmieniamy wzorzec w `common.schema.json`, wszystkie fixture'y i czytnik w aplikacji.

## Format siatek KMDG/1

Siatki wysokości (`dem-*`), kostka RSL (`rsl`) i grubość lodu (`ice-h-*`). Plik `*.bin.gz` jest skompresowany gzipem z `mtime = 0`, więc zapis jest deterministyczny. Wzorowany na `relief.bin.gz` z `kmd-labs/el-nino`, ale z georeferencją, skalą i wieloma warstwami.

| Offset | Typ | Pole |
| --: | :-- | :-- |
| 0 | `u32` BE | magic `KMDG` (`0x4B4D4447`) |
| 4 | `u8` | wersja = `1` |
| 5 | `u8` | typ: `1` = `uint8`, `2` = `int16`, `3` = `float32` |
| 6 | `u16` | `nx` — kolumny (długość geograficzna) |
| 8 | `u16` | `ny` — wiersze (szerokość geograficzna) |
| 10 | `u16` | `nt` — warstwy (czas) |
| 12 | `u16` | `headerBytes` = 68 + 4·`nt` — początek danych |
| 14 | `u16` | flagi, dziś `0` |
| 16 | `f64` ×4 | `west`, `south`, `east`, `north` — **zewnętrzne krawędzie komórek**, stopnie, EPSG:4326 |
| 48 | `f64` | `scale` |
| 56 | `f64` | `offset` |
| 64 | `i32` | `nodata` (wartość surowa; dla `float32` brak danych to `NaN`) |
| 68 | `f32` ×`nt` | czas każdej warstwy, ka BP |
| `headerBytes` | dane | `nt × ny × nx`, little-endian |

Poza magic wszystkie pola są little-endian.

**Konwencje:**
- Wartość fizyczna = `raw × scale + offset`, w metrach. Dla `float32` wartość surowa jest wartością fizyczną.
- **Siatka komórkowa (cell-registered):** środek komórki `(row, col)` leży w `lon = west + (col + ½)·dx`, `lat = north − (row + ½)·dy`. Źródło węzłowe (np. RSL co 1° w −10…70°E) zapisujemy z bbox poszerzonym o pół komórki (−10,5…70,5°E).
- **Wiersz 0 to północ**, kolumna 0 to zachód. Kolejność warstw: `[t][row][col]`.
- Warstwy RSL są w kolejności źródła (21,4 → 0 ka). Interpolacja liniowa w czasie i interpolacja przestrzenna zapisana w `manifest.gia.spatialInterpolation` muszą działać tak samo w pipeline'ie i w aplikacji (`I-01`: `H_paleo` z błędem ≤ 1 m).
- `headerBytes` jest wielokrotnością 4, więc dane `int16` i `float32` można czytać tablicami typowanymi bez kopiowania.

**Rozmiary:** RSL 81 × 41 × 19 jako `int16` ze skalą 0,01 m (zakres ±327 m; w źródle −217…242 m) to ~126 KB przed kompresją. Plan zakładał `float16`, ale `int16` ze skalą daje stałą precyzję 1 cm i nie wymaga dekodera połówkowej precyzji.

Zapis: [`tools/data/kmdg.py`](../tools/data/kmdg.py). Odczyt: [`src/app/core/data/kmdg.ts`](../src/app/core/data/kmdg.ts).

## Fixture'y i testy

```
fixtures/valid/<kind>/*.json      # muszą przejść
fixtures/invalid/<kind>/*.json    # każdy łamie jedną regułę — nazwa pliku mówi którą
fixtures/grid/<name>.kmdg.gz      # siatki zapisane przez kmdg.py
fixtures/grid/<name>.expected.json  # wartości, które musi odtworzyć czytnik TypeScript
```

Wartości w fixture'ach są ilustracyjne. Testują schemat, nie paleogeografię.

```powershell
npm run test:data                        # Python: schematy + KMDG (wymaga .venv z requirements.txt)
npm run test:contract                    # TypeScript: czytnik KMDG na fixture'ach + tsc
npm run contract:validate -- frame <plik.json> …   # walidacja dowolnych plików
python -m tools.data.tests.grid_fixtures # przebudowa fixture'ów siatek po zmianie formatu
```

Egzekwowanie schematu w pipeline'ie to `V-01`, a w CI na PR-ach `0-08`.
