# Baltic

Interaktywna rekonstrukcja Morza Bałtyckiego od ostatniego maksimum zlodowacenia do dziś —
**20 000 lat BP → 0**, krok 1000 lat plus przekroje zdarzeniowe. Glob w stylu
[El Niño](https://github.com/kmd-labs/el-nino): paleo-DEM, lądolód z DATED-1, maska wody liczona
w przeglądarce, przekrój Umeå → Gdańsk i krzywe RSL.

Aplikacja **nie odtwarza gotowych klatek** — dostaje siatkę wysokości dzisiejszych i kostkę RSL,
a `H_paleo = H_now − RSL(t)`, maskę wody (flood-fill), poziom jeziora i metryki basenu liczy sama
w Web Workerze. Dlatego `src/assets/data/` waży ~2,7 MB, a nie setki megabajtów.

## Start na czystym klonie

Repo używa submodułu `src/design-system` ([`kmd-labs/design-system`](https://github.com/kmd-labs/design-system)).
**Bez niego build nie przejdzie** — `angular.json` wskazuje `src/design-system` w
`stylePreprocessorOptions.includePaths`.

```bash
git clone --recurse-submodules https://github.com/kmd-labs/baltic.git
cd baltic
npm ci
npm start                 # http://localhost:4200
```

Klon bez `--recurse-submodules` (albo świeża gałąź, która przesunęła wskaźnik submodułu):

```bash
git submodule update --init --recursive
```

Sprawdzenie, czy submoduł stoi na commicie zapisanym w gicie:

```bash
git submodule status      # bez wiodącego '-' i '+' przy SHA
```

## Skrypty

| Komenda | Co robi |
| :-- | :-- |
| `npm start` | serwer deweloperski |
| `npm run build` | build produkcyjny do `dist/baltic/` |
| `npm run build:gh-pages` | build pod `https://kmd-labs.github.io/baltic/` |
| `npm run test:contract` | testy czytnika danych i reguły wody (Node, `node --test`) + `tsc` na kontrakcie |
| `npm run contract:validate` | walidacja JSON-ów z `src/assets/data/` schematami z `contract/schema/` |
| `npm run audit:metrics` | przelicza liczby cytowane w audycie z zacommitowanych zasobów |
| `npm run data:fetch` | pobiera surowe zbiory do `data/raw/` (poza gitem) |
| `npm run test:data` | testy pipeline'u (Python) |

Cztery pierwsze i `audit:metrics` działają na samym `npm ci` — nie wymagają Pythona ani surowych
danych.

### Python (tylko pipeline danych)

`data:fetch`, `test:data` i `contract:validate` wołają `python`. Na Windowsie `python` na PATH bywa
zaślepką ze Sklepu, która nic nie uruchamia — wtedy trzeba użyć `py` albo venv z
[`tools/data/README.md`](tools/data/README.md):

```powershell
py -m venv .venv
.venv\Scripts\python -m pip install -r tools/data/requirements.txt
```

## Układ repo

| Katalog | Zawartość |
| :-- | :-- |
| `src/app/core/data/` | czytnik siatek KMDG, paleo-DEM, reguła wody, pole lodu, sill-check — czyste funkcje bez DOM-u, współdzielone z workerem i testami |
| `src/app/components/` | glob, blok rzeźby, dolny dok, karty faz, przekrój, samouczek |
| `src/assets/data/` | zacommitowane zasoby: siatki `grid/*.bin.gz` i prototyp `prototype/*.json` |
| `contract/` | kontrakt danych (`0-06`): schematy JSON i fixture'y |
| `tools/data/` | pipeline (`fetch.py`, `postglacial.py`, `contract.py`, `kmdg.py`) |
| `tools/audit/` | `metrics.ts` — liczby audytu jako skrypt |
| `tests/contract/` | testy kontraktu i reguły wody |
| `docs/research/` | plan danych, backlog issues, audyt, handoff |

## Dane i licencje

**Do pipeline'u wchodzą wyłącznie zbiory, które nie wymagają zapytania o licencję** (decyzja
`0-02`). ICE-6G_C, GLAC-1D, ANU-ICE i Stroeven 2016 nie są używane w żadnej postaci. Model GIA:
Steffen & Kaufmann 2025 (CC BY 4.0); lądolód: DATED-1 (CC BY 3.0); batymetria: GEBCO 2024.

Jedyne źródło prawdy o licencjach i atrybucji: [`SOURCES.md`](SOURCES.md). Status ✅ mówi o
licencji, **nie** o tym, że zbiór jest już używany.

## Dokumentacja

- [`docs/research/baltic-data-plan.md`](docs/research/baltic-data-plan.md) — plan warstwy danych
- [`docs/research/baltic-issues-backlog.md`](docs/research/baltic-issues-backlog.md) — backlog, zależności, kamienie milowe
- [`docs/research/baltic-audit-2026-11-01.md`](docs/research/baltic-audit-2026-11-01.md) — audyt kodu i wartości merytorycznej
- [`contract/README.md`](contract/README.md) — kontrakt danych
- [`AGENTS.md`](AGENTS.md) — konwencje UI i inżynierskie KMD

## CI i deploy

- **`ci.yml`** — na każdym PR do `main`: build, testy kontraktu, walidacja zasobów danych i budżet
  rozmiaru. Pusty submoduł zatrzymuje workflow w pierwszym kroku.
- **`deploy.yml`** — po merge'u do `main` buduje **przypięty commit** submodułu i publikuje na
  GitHub Pages. Aktualizacje design-systemu przychodzą osobno, przez PR z `sync-design-system.yml`,
  więc to, co wdrożone, zawsze odpowiada stanowi zapisanemu w gicie.
