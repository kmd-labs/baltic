# Baltic

Interaktywna rekonstrukcja Morza Bałtyckiego od ostatniego maksimum zlodowacenia do dziś —
**20 000 lat BP → 0**, krok 1000 lat plus sześć przekrojów zdarzeniowych. Glob 3D z paleo-DEM-em,
lądolodem, maską wody liczoną w przeglądarce, przekrojem Umeå → Gdańsk i krzywymi poziomu morza.

**Co to prezentuje, skąd dane, jakie licencje i jak działa w środku:** [`docs/ABOUT.md`](docs/ABOUT.md).
Metodyka liczbowa: [`docs/paleo-reconstruction-methodology.md`](docs/paleo-reconstruction-methodology.md).

Aplikacja **nie odtwarza gotowych klatek.** Dostaje siatkę dzisiejszych wysokości i kostkę
relatywnego poziomu morza, a `H_paleo = H_now − RSL(t)`, maskę wody (flood-fill), poziom jeziora,
próg odpływu i metryki basenu liczy sama w Web Workerze. Dlatego `src/assets/data/` waży 2,6 MB,
a nie setki megabajtów.

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

Klon bez `--recurse-submodules`, albo gałąź, która przesunęła wskaźnik submodułu:

```bash
git submodule update --init --recursive
git submodule status      # bez wiodącego '-' lub '+' przy SHA
```

## Skrypty

### Nie wymagają Pythona ani surowych danych

| Komenda | Co robi |
| :-- | :-- |
| `npm start` | serwer deweloperski |
| `npm run build` | build produkcyjny (woła `test:i18n`, więc brak tłumaczenia przerywa build) |
| `npm run build:gh-pages` | build pod `https://kmd-labs.github.io/baltic/` |
| `npm run test:contract` | 86 testów: czytniki danych, reguła wody, kontrakt, walidacja + `tsc` |
| `npm run test:i18n` | zgodność kluczy treści EN↔PL i brak zahardkodowanych napisów |
| `npm run validate` | **raport walidacyjny** — 7 bramek blokujących i 2 pomiary, każdy z odchyleniem liczbowym |
| `npm run audit:metrics` | przelicza każdą liczbę cytowaną w audycie z zacommitowanych zasobów |
| `npm run assets:check` | budżet rozmiaru: 25 MiB całość, 4 MiB pierwsze wejście |
| `npm run data:sources` | generuje `sources.json` z `SOURCES.md` |
| `npm run data:sills` | generuje `sills.json` z analizy przelewu |
| `npm run data:manifest` | generuje `manifest.json` — indeks z sumami SHA-256 i parametrami |
| `npm run data:build` | cały łańcuch generatorów + walidacja + budżet, jedną komendą |

### Wymagają Pythona

| Komenda | Co robi | Potrzebuje |
| :-- | :-- | :-- |
| `npm run contract:validate` | walidacja JSON-ów z `src/assets/data/` schematami | `jsonschema` |
| `npm run test:data` | testy pipeline'u | `numpy`, `jsonschema` |
| `npm run data:fetch` | pobiera surowe zbiory do `data/raw/` (poza gitem) | — |
| `npm run data:build:rsl` | przebudowa kostki RSL (zmiana modelu Ziemi) | `xarray`, `netCDF4` + 2 MB pobrań |
| `npm run data:rsl-validation` | wyciąg bazy HOLSEA i próbkowanie 8 modeli (wejście `V-03`) | + `openpyxl` + 8 MB pobrań |
| `npm run data:build:grids` | **pełna** przebudowa siatek z GEBCO | + `rasterio`, `pyogrio` + **1,87 GB** pobrań |

Pełna przebudowa siatek to jedyna rzecz wymagająca ciężkich pobrań. Wszystko inne — w tym
walidacja ilościowa i wszystkie generatory — działa na zacommitowanych zasobach.

```powershell
py -m venv .venv
.venv\Scripts\python -m pip install -r tools/data/requirements.txt
```

Na Windowsie `python` na PATH bywa zaślepką ze Sklepu, która nic nie uruchamia — wtedy `py` albo
venv. Podzbiór potrzebny samemu CI jest w `tools/data/requirements-contract.txt` (bez GDAL-a).

## Układ repo

| Katalog | Zawartość |
| :-- | :-- |
| `src/app/core/data/` | paleo-DEM, reguła wody, pole lodu, katalog progów, chronologia, sill-check — **czyste funkcje bez DOM-u**, współdzielone z workerem, testami i narzędziami |
| `src/app/components/` | glob, blok rzeźby, dolny dok, karty faz, przekrój, samouczek |
| `src/assets/data/` | **publikowane dane i nic więcej**, wszystko rozliczone w `manifest.json` |
| `src/assets/content/{en,pl}` | treści długie, per język (`I-03`) |
| `contract/` | kontrakt danych (`0-06`): schematy JSON i fixture'y |
| `tools/data/` | pipeline w Pythonie: `fetch.py`, `postglacial.py`, `rsl_validation.py`, `contract.py`, `kmdg.py` |
| `tools/lib/` | `frames.ts` — wczytanie zasobów i klatka liczona tak, jak liczy ją aplikacja |
| `tools/{sources,sills,manifest}/` | generatory publikowanych plików |
| `tools/validate/` | rejestr walidacji, raport, kontrole geometrii i `V-03` |
| `tools/audit/` | `metrics.ts` — liczby audytu jako skrypt |
| `tests/contract/` | 86 testów kontraktu, reguły wody, chronologii i walidacji |
| `docs/` | metodyka, opis aplikacji, badania i backlog |

## Dane i licencje

**Do pipeline'u wchodzą wyłącznie zbiory, które nie wymagają zapytania o licencję** (decyzja
`0-02`). ICE-6G_C, GLAC-1D, ANU-ICE i Stroeven 2016 nie są używane w żadnej postaci.

| Zbiór | Rola | Licencja |
| :-- | :-- | :-- |
| GEBCO_2024 | dzisiejsza rzeźba i dno (`H_now`) | domena publiczna z atrybucją |
| Steffen i Kaufmann 2025 | relatywny poziom morza, 8 modeli Ziemi | CC BY 4.0 |
| DATED-1 | zasięg lądolodu, przekroje co 1 ka | CC BY 3.0 |
| Rosentau i in. 2021 (HOLSEA) | 1 099 wskaźników do walidacji ilościowej | CC BY 4.0 |
| Steffen i Kaufmann 2025 (pd. Bałtyk) | porównanie regionalne | CC BY 4.0 |
| Kotthoff i in. 2022 (IODP M0059) | lokalny onset Littoryny w Małym Bełcie | CC BY 4.0 |

Jedyne źródło prawdy: [`SOURCES.md`](SOURCES.md) — z niego generowany jest `sources.json`, a panel
„Źródła" w aplikacji renderuje licencje i atrybucje stamtąd, nie z własnego przepisania. Status ✅
mówi o licencji, **nie** o tym, że zbiór jest używany.

## Walidacja

`npm run validate` — siedem bramek blokujących i dwa pomiary. Każdy wiersz niesie odchylenie
**liczbowo**, także gdy przechodzi: inaczej rozmiar rozbieżności schowałby się pod zieloną fajką.

| kontrola | co sprawdza |
| :-- | :-- |
| `sill-balance` | jezioro zaporowe wymaga progu powyżej ówczesnego oceanu, połączenie poniżej (`V-02`) |
| `rsl-vs-observations` | RMSE wobec 1 099 wskaźników, per region i per klaster (`V-03`) |
| `billingen-drop` | spadek przy finalnym drenażu Billingen wobec 25–28 m |
| `holocene-highstand` | maksimum RSL w 7,5–6,5 ka **i tylko** w pasie przejściowym |
| `little-belt-littorina` | onset lokalny wobec 7 400 cal BP |
| `uplift-gradient` | gradient 0,9 → 0 ka wobec publikowanych wartości NKG2016LU |
| `topology-crs-checksums` | brak samoprzecięć, EPSG:4326, sumy zgodne z plikami (`V-11`) |

Wyniki i ich interpretacja: [`docs/ABOUT.md`](docs/ABOUT.md) oraz
[`docs/research/baltic-earth-model.md`](docs/research/baltic-earth-model.md).

## Dokumentacja

- [`docs/ABOUT.md`](docs/ABOUT.md) — co aplikacja prezentuje, dane, licencje, rozwiązania techniczne
- [`docs/paleo-reconstruction-methodology.md`](docs/paleo-reconstruction-methodology.md) — metodyka i ograniczenia
- [`docs/research/baltic-earth-model.md`](docs/research/baltic-earth-model.md) — wybór modelu Ziemi (`V-03`)
- [`docs/research/baltic-audit-2026-11-01.md`](docs/research/baltic-audit-2026-11-01.md) — audyt kodu i wartości merytorycznej
- [`docs/research/baltic-issues-backlog.md`](docs/research/baltic-issues-backlog.md) — backlog, zależności, kamienie milowe
- [`contract/README.md`](contract/README.md) — kontrakt danych
- [`AGENTS.md`](AGENTS.md) — konwencje UI i inżynierskie KMD

## CI i deploy

- **`ci.yml`** — na każdym PR do `main`: build, testy kontraktu, budżet zasobów, `audit:metrics`,
  raport walidacyjny, regeneracja plików generowanych (i diff), walidacja schematów, testy Pythona.
  Pusty submoduł zatrzymuje workflow w pierwszym kroku. **Nie pobiera surowych danych** — sprawdza
  zacommitowane zasoby.
- **`deploy.yml`** — po merge'u do `main` buduje **przypięty commit** submodułu i publikuje na
  GitHub Pages. Aktualizacje design-systemu przychodzą osobno, przez PR z `sync-design-system.yml`,
  więc to, co wdrożone, odpowiada stanowi zapisanemu w gicie.
