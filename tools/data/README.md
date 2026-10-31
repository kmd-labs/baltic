# tools/data — pipeline danych

Plan: [`docs/research/baltic-data-plan.md`](../../docs/research/baltic-data-plan.md) §6. Rejestr źródeł i licencji: [`SOURCES.md`](../../SOURCES.md).

## Pobieranie (`0-05`)

```powershell
npm run data:fetch                 # wszystkie zbiory z registry.json
npm run data:fetch -- --tier 1     # jedna tura
npm run data:fetch -- --offline    # tylko weryfikacja lokalnego cache'u, bez sieci
```

`fetch.py` używa wyłącznie biblioteki standardowej. Pliki trafiają do `data/raw/<id>/` (poza gitem).

- **Integralność:** rozmiar i MD5 są sprawdzane tam, gdzie publikuje je źródło. SHA-256 każdego pliku jest przypinany w `checksums.lock.json` przy pierwszym pobraniu i wymuszany przy każdym kolejnym uruchomieniu. Zmieniony plik u źródła albo uszkodzony cache przerywa build.
- **Idempotencja:** pliki obecne w cache'u nie są pobierane ponownie.
- **Rejestr źródeł:** zbioru nie da się pobrać, jeśli jego `id` nie ma wpisu w `SOURCES.md`.

Nowy zbiór: wpis w `SOURCES.md` → wpis w `registry.json` (z `md5`, jeśli źródło go podaje) → `npm run data:fetch -- <id>` → commit `checksums.lock.json`.

## Tury

| Tura | Zbiory | Cel |
| :-: | :-- | :-- |
| 1 | `gebco2024`, `steffen2025_rsl`, `dated1` | minimum do pierwszego paleo-DEM-u i maski wody faz morskich (M3) — wszystkie z licencją ✅ |

## Przetwarzanie

Kolejne kroki (`postglacial.py`, `emit.py` …) wymagają bibliotek naukowych:

```powershell
python -m venv .venv
.venv\Scripts\python -m pip install -r tools/data/requirements.txt
```

`requirements.in` zawiera bezpośrednie zależności, a `requirements.txt` zamrożony zestaw wersji.

## Kontrakt (`0-06`)

`contract.py` waliduje pliki JSON schematami z [`contract/schema/`](../../contract/README.md), a `kmdg.py` zapisuje i czyta siatki KMDG/1. Testy: `npm run test:data` (Python) i `npm run test:contract` (czytnik TypeScript).

## Ustalenia z tury 1

- **RSL Steffena i Kaufmanna:** zmienna `RSL(time, lat, lon)`, metry względem 1950, dodatnie = morze wyżej niż dziś. Paleo-DEM: `H_paleo = H_now − RSL(t)`. Oś czasu w ka BP ma **nierówne** kroki (21,4; 20,2; 19,1; … 0,9; 0), więc klatki co 500 lat wymagają interpolacji w czasie.
- **Kontrola punktowa (model `sk1`):** Umeå ~282 m przy 11,3 ka (najwyższa linia brzegowa ~286 m); rejon Gdańska −25 m przy 8,9 ka i −14 m przy 7,8 ka (Uścinowicz: ~−28 m przy 8,5 ka, ~−10 m przy 7,0 ka).
- **GEBCO 2024:** EPSG:4326, 15″, `int16`; okno 9–33°E / 53–67°N to 5760 × 3360 komórek.
- **DATED-1:** 58 shapefile'i `TS<ka>_{min,mc,max}.shp`.
