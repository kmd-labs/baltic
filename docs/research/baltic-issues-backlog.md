# Baltic — backlog issues warstwy danych

> Rozpisanie [`baltic-data-plan.md`](./baltic-data-plan.md) na zadania wykonawcze.
> **4 epiki / 36 zadań.** Tytuły po angielsku (spójne z commitami i publicznym repo `kmd-labs/baltic`), treść po polsku.
> Dokument żywy — aktualizowany razem z planem. Odsyłacze `§x.y` wskazują sekcje planu.

> **Zmiany zakresu (2026-10-31):**
> 1. Aplikacja wizualizuje **wyłącznie postglacjał, 20 ka → dziś**. Usunięte epiki `A`, `B`, `D` i zadania `V-04`, `V-05`, `V-09`, `V-10`. Numeracja ma luki.
> 2. **Tylko zbiory bez zapytań licencyjnych.** ICE-6G_C, GLAC-1D, ANU-ICE i Stroeven 2016 nie są używane w żadnej postaci. Model GIA: Steffen & Kaufmann 2025; lądolód: DATED-1.
> 3. **Krok 1000 lat** (21 klatek + ~6 zdarzeniowych) zamiast 500 lat.
> 4. **Scena: glob jak w El Niño**, dane runtime hybrydowe (siatki + kostka RSL + wektory). Nowe zadanie `I-05`.

## Jak czytać

| Pole | Znaczenie |
| :-- | :-- |
| **ID** | `<epik>-<nr>`. Epiki: `0` fundamenty, `C` postglacjał, `V` walidacja, `I` integracja |
| **Zależy od** | zadania, które muszą być zamknięte, zanim to się zacznie |
| **Blokuje** | zadania czekające na to |
| **Labels** | etykiety GitHub |
| **DoD** | Definition of Done — warunek zamknięcia, weryfikowalny |

**Etykiety:** `blocker` · `licensing` · `data-pipeline` · `regime-c` · `validation` · `contract` · `docs` · `i18n` · `app` · `ci`

## Ścieżka krytyczna

```
0-01 ──> 0-04 ──> 0-05 ──> C-01 ──> C-03 ──> C-04 ──> C-11 ──> I-01 ──> I-02     ★ M3 (fazy morskie na globie)
                                      ▲                 ▲                 ▲
0-06 ─────────────────────────────────┘    C-09 ──> C-08┘        I-05 ────┘
                                                                         C-14 ──> C-15      M4 (fazy jeziorne)
                           C-02 ─────────────────────────────────────────▲
                           C-05 ──> C-06 ────────────────────────────────┘
                                      └──> V-02   (ilościowa bramka na §0.1 / §0.2)
```

Dwie rzeczy nieobejściowe: **`0-01`** (bez submodułu nie ma builda) i **`0-06`** (kontrakt hybrydowy z obowiązkowym `datum`). `0-02` jest rozstrzygnięte decyzją „tylko zbiory bez zapytań” i nie blokuje już niczego. Batymetria jezior (`C-02`) blokuje tylko fazy jeziorne (`C-14`), nie paleo-DEM faz morskich.

## Epiki

| Epik | Nazwa | Zadań | Charakter |
| :-- | :-- | --: | :-- |
| **0** | Fundamenty i blokery | 8 | musi być pierwsze |
| **C** | Postglacjał, 20–0 ka | 15 | rdzeń produktu; fazy morskie (M3) przed jeziornymi (M4) |
| **V** | Walidacja | 8 | jedna bramka ilościowa (`V-03`), resztę da się liczyć wcześnie |
| **I** | Kontrakt, emisja, integracja | 5 | `I-03` od pierwszego commita; glob `I-05` równolegle z danymi |

---

# EPIC 0 · Fundamenty i blokery

## `0-01` Document clean-clone setup and pin design-system in builds

**Epik:** 0 · **Blokuje:** `0-04` · **Labels:** `blocker`, `ci`

W świeżej kopii roboczej submoduł `src/design-system` jest niezainicjowany (`git submodule status` → `-137744d`, katalog pusty). Dopóki tak jest, build nie przejdzie, bo `angular.json` wskazuje `src/design-system` w `stylePreprocessorOptions.includePaths`. `deploy.yml` ma już `submodules: recursive`, ale w repo **nie ma README**, a deploy buduje z `git submodule update --remote`, czyli z bieżącego `main` design-systemu, a nie z przypiętego SHA — build nie jest odtwarzalny.

**Zakres**
- `README.md`: klon z `--recurse-submodules` / `git submodule update --init`, `npm ci`, `npm start`.
- `deploy.yml`: budowanie z przypiętego SHA (aktualizacje przychodzą przez PR z `sync-design-system.yml`) albo jawne uzasadnienie `--remote`.
- Weryfikacja, że `sync-design-system.yml` nadal działa po zmianie.

**DoD**
- [ ] `README.md` istnieje; `npm run build` zielony na czystym klonie wykonanym wg README
- [ ] Deploy buduje z SHA zapisanego w gicie
- [ ] CI nie przechodzi, jeśli submoduł jest pusty (`0-08`)

**Plan:** §6 (Kolejność prac, p. 1)

## `0-02` Record licence policy: licence-free sources only

**Epik:** 0 · **Labels:** `licensing`

**Decyzja (2026-10-31): używamy wyłącznie zbiorów, które nie wymagają zapytania o licencję.** Zapytania do Peltiera, Tarasova, Lambecka i Stroevena **nie są wysyłane**.

Ustalenia, na których stoi decyzja:
- ICE-6G_C, GLAC-1D i ANU-ICE nie mają licencji — tylko prośbę o cytowanie. Brak licencji = brak zgody na publikację pochodnych.
- Stroeven 2016 ma licencję CC BY-NC-ND 4.0 — klauzula ND zakazuje publikacji pochodnej geometrii.
- Pełny zakres 20–0 ka pokrywają pola RSL **Steffena i Kaufmanna 2025** (Zenodo `10.5281/zenodo.15481755`, CC BY 4.0; ANU-ICE 1998, 1°, 8 modeli Ziemi). Paleo-DEM: `H_paleo = H_now − RSL(t)`.
- Lądolód: **DATED-1** (CC BY 3.0), przekroje co 1 ka.
- ESD 16, 585 (2025, CC BY) — tylko kontrola 11,7–0 ka (`V-12`).

Konsekwencje: brak grubości lodu z modelu (profil plastyczny w `C-07`), brak pola współczesnej prędkości wypiętrzania (przybliżenie w `V-08`).

**DoD**
- [x] Decyzja z datą w `SOURCES.md`; odrzucone zbiory wypisane z powodem
- [x] `gia.source: "steffen2025_rsl"` jako jedyna wartość w kontrakcie (`0-06`)
- [x] `licensing-inquiries.md` oznaczony jako zarchiwizowany — nic nie jest wysyłane
- [x] Żadna pochodna zbioru bez licencji nie jest zacommitowana

**Plan:** §3, §8

## `0-03` Audit licences of all remaining sources, write SOURCES.md

**Epik:** 0 · **Blokuje:** `I-04` · **Labels:** `licensing`, `docs`

Reguła z `0-02`: zbiór wchodzi do pipeline'u tylko ze statusem ✅. Pozycje ❓ trzeba **sprawdzić na stronie źródła** (bez zapytań): **EMODnet DTM 2024** (DataCite nie podaje licencji), **NKG2016LU** (licencja siatek u Lantmäteriet), **BSBD/BSHC** (CC BY 3.0 z ograniczeniami), **IOWTOPO2**, **HELCOM**, **SGU Strandförskjutningsmodell**, **GLOBathy**, **IntCal20**. Jeśli któraś wymaga zapytania albo ma ND — zbiór wypada i wchodzi fallback z §3 planu.

Nowe zbiory dla globu (§5.1): kafel GEBCO 0–90°N / 90°W–0, ETOPO2v2c, Natural Earth SR_50M, `world-atlas` land-50m — domena publiczna, do wpisania z atrybucją.

**Zakres**
- Przegląd wszystkich pozycji z §3.1–3.4: licencja, wersja, format, DOI/URL.
- Gotowy tekst atrybucji per zbiór.
- `SOURCES.md` jako jedyne źródło prawdy dla `sources.json`.

**DoD**
- [x] `SOURCES.md` pokrywa 100% zbiorów z §3
- [ ] Zero pozycji ❓ — każda ✅ albo przeniesiona do „Odrzucone”
- [ ] Każda pozycja ✅ ma pełne cytowanie i tekst atrybucji

**Plan:** §3, §5, §9

## `0-04` Scaffold tools/data pipeline and npm run data:build

**Epik:** 0 · **Zależy od:** `0-01` · **Blokuje:** `0-05`, cały epik C · **Labels:** `data-pipeline`

**Zakres**
- Struktura z §6: `fetch.py`, `postglacial.py`, `ice.py`, `curves.py`, `calibrate.py`, `validate.py`, `emit.py`.
- `data/raw/` i `data/interim/` w `.gitignore`; assety wyjściowe w gicie.
- Skrypt `data:build` w `package.json`, obok istniejącego `data:fetch`.
- Stack: `xarray` + `netCDF4`, `rasterio`, `geopandas`, `shapely`, `pyogrio`, `scipy.ndimage`, `pyproj`; `mapshaper`/`topojson` do uproszczenia.

**DoD**
- [ ] `npm run data:build` uruchamia pipeline end-to-end
- [ ] Pipeline **idempotentny** — powtórny run nie zmienia wyjścia
- [ ] Pipeline **offline po pierwszym pobraniu**
- [x] Zamrożone wersje zależności (`tools/data/requirements.txt`)

**Plan:** §6

## `0-05` fetch.py — DOI-keyed downloads with checksum verification

**Epik:** 0 · **Zależy od:** `0-04` · **Blokuje:** `C-01`, `C-07`, `C-12` · **Labels:** `data-pipeline`

Tura 1 gotowa: `gebco2024` (kafel 0–90°E), `steffen2025_rsl`, `dated1`.

**Tura 2** (wszystkie ✅, bez zapytań): `rosentau2021`, `kotthoff2022`, `steffen2025_rsl_sbaltic`, `esd2025` (suplement z paleo-DEM-ami), kafel GEBCO 0–90°N / 90°W–0 (domena RSL sięga 10°W), Natural Earth SR_50M i ETOPO2v2c (tło globu). Zbiory ❓ dopiero po ✅ w `0-03`.

**Zakres**
- Pobieranie po DOI / URL dla każdego zbioru ✅ z §3.
- Weryfikacja sum kontrolnych **przed** użyciem pliku; sumy trafiają do `manifest.json`.
- Cache w `data/raw/`, pomijanie już pobranych.

**DoD**
- [ ] Każdy zbiór ✅ z §3 pobieralny jednym wywołaniem (tura 2 w `registry.json`)
- [x] Niezgodna suma kontrolna przerywa build z czytelnym komunikatem
- [x] Powtórny run nie pobiera ponownie

**Plan:** §3, §6

## `0-06` Define frame and manifest JSON contract with mandatory `datum`

**Epik:** 0 · **Blokuje:** każdą emisję klatek, `I-05` · **Labels:** `blocker`, `contract`

**Kontrakt hybrydowy** (§5): pipeline liczy maski, progi, metryki i walidację; aplikacja dostaje dodatkowo siatki wysokości dziś (`grid/dem-baltic`, `grid/dem-europe`) i kostkę RSL (`grid/rsl`), żeby liczyć rzeźbę 3D na globie, przekrój Umeå → Gdańsk, wysokość w tooltipie i krzywą RSL dla klikniętego punktu (wymagania z makiety, §5.1).

Klatka: `schemaVersion`, `tBP`, `t14C`, `calCurve`, **`datum`**, `stageId`, `water`, `salinity[]` (per basen), `sills[]` (stan per próg), `ice`, `gia`, `eslM`, `metrics`, `dataQuality`, `frame`, `sources`. Oś czasu: **co 1000 lat** (20 → 0 ka) + przekroje zdarzeniowe.

Pole `datum` jest obowiązkowe w manifeście **i w każdej klatce**: poziomy faz jeziornych (+25 m BIL, +10 m Ancylus) są poprawne **wyłącznie** względem geoidy współczesnej *t* — rebound to **>285 m w Zatoce Botnickiej vs ~0 m na wybrzeżu Polski**.

**Zakres**
- JSON Schema dla klatki, manifestu, `timeline.json`, `sills.json`, `taxa.json`, `curves/*`.
- Format binarny siatek (`grid/*.bin.gz`): nagłówek (magic, wersja, wymiary, bbox, skala, typ), wzór jak `relief.bin.gz` w `kmd-labs/el-nino`.
- Fixture'y testowe (poprawne i celowo zepsute) obok schematu.
- `schemaVersion` z polityką wersjonowania.
- `ice` może być `null` (brak lądolodu w klatce, < 10 ka).

Egzekwowanie schematu w pipeline'ie to `V-01`, w CI — `0-08`.

**DoD**
- [x] Schemat odrzuca fixture klatki bez `datum`
- [x] Enum `dataQuality` = `modelled | interpolated | qualitative`
- [x] `ice: null` dopuszczalne, `ice: {}` bez `source` — nie
- [x] `gia.source` + `gia.earthModel` obowiązkowe
- [x] Format `grid/*.bin.gz` opisany i z fixture'em czytanym w teście TypeScript

Realizacja: [`contract/`](../../contract/README.md) — schematy, fixture'y, format KMDG/1; testy `npm run test:data` i `npm run test:contract`.

**Plan:** §0.2, §5

## `0-07` Write methodology and data-catalog docs

**Epik:** 0 · **Labels:** `docs`

Dwa artefakty z §9. `paleo-reconstruction-methodology.md` **musi wskazywać konkretny plik i nazwę zmiennej** (`RSL` w `rsl_SK05_skan_<model>.nc`), nie pojęcie — plan wejściowy liczył eustatykę podwójnie **właśnie dlatego**, że formuła nie nazywała pola.

`baltic-data-catalog.md`: linki, licencje, formaty, **tabela korelacji wiekowej** cal yr BP ↔ ¹⁴C BP ↔ BCE/CE dla 7 faz, parametry liczbowe per przekrój, współrzędne punktów kluczowych, **tabela eustatyki co 1 ka** (Lambeck i in. 2014) z cytowaniem.

**DoD**
- [ ] Formuła `H_paleo = H_now − RSL(t)` z nazwą pliku i zmiennej
- [ ] Jawnie zapisane, dlaczego **nie ma** osobnego członu eustatycznego, a eustatyka służy tylko do odczytu w UI
- [ ] Metoda interpolacji w czasie między nierównymi krokami RSL
- [ ] Profil plastyczny grubości lodu: wzór, τ₀, uzasadnienie, ograniczenia
- [ ] Tabela korelacji kompletna dla 7 faz
- [ ] Odstępstwa źródeł od Andréna i in. 2011 wypisane, nie uśrednione
- [ ] Transformacja `contemporaneous-geoid` ↔ dzisiejszy poziom zapisana jako formuła

**Plan:** §0.1, §9

## `0-08` Add PR CI workflow that validates committed data assets

**Epik:** 0 · **Zależy od:** `0-01`, `0-06` · **Blokuje:** `V-11` · **Labels:** `ci`, `blocker`

W repo jest tylko `deploy.yml` (push na `main`) i `sync-design-system.yml` — **nic nie uruchamia się na PR-ach**, a `0-06`, `V-01` i `V-11` zakładają bramki w CI. CI **nie może** uruchamiać `npm run data:build`: surowe dane są poza gitem (`data/raw/`, ~905 MB po turze 1). CI waliduje więc **zacommitowane assety** w `src/assets/data/`, nie przelicza pipeline'u.

**Zakres**
- `.github/workflows/ci.yml` na `pull_request`: checkout z submodułem, `npm ci`, `npm run build`.
- Walidacja schematu (`0-06`) wszystkich plików w `src/assets/data/`, zgodność sum kontrolnych z `manifest.json`, budżet rozmiaru (`V-11`).
- Kontrola pustego submodułu (`0-01`).

**DoD**
- [ ] Workflow uruchamia się na każdym PR do `main`
- [ ] Plik niezgodny ze schematem lub z sumą w `manifest.json` blokuje merge
- [ ] Brak kroku pobierającego surowe dane

**Plan:** §5, §7

---

# EPIC C · Postglacjał, 20–0 ka

Rdzeń produktu. Kolejność wewnątrz epiku zgodna z §6 (Kolejność prac, p. 2): **od końca ku początkowi** — najpierw dziś → 8 ka (najlepsze dane), potem fazy jeziorne (najtrudniejsze, bo próg zamiast eustatyki). Dlatego maska wody i emisja są rozbite na dwa etapy: fazy morskie (`C-04`, `C-11` → M3) i fazy jeziorne (`C-14`, `C-15` → M4).

## `C-01` Build base topo-bathy mosaic for 9–33°E / 53–67°N

**Epik:** C · **Zależy od:** `0-05` · **Blokuje:** `C-03`, `C-02` · **Labels:** `data-pipeline`, `regime-c`

Baza: **GEBCO 2024** (15″; okno Bałtyku = 5760 × 3360 komórek, min −739 m w Rowie Norweskim). Dwie siatki wyjściowe:
- **okno Bałtyku** (9–33°E / 53–67°N) w rozdzielczości roboczej do flood-fill i metryk, plus wersja ~0,04° do `grid/dem-baltic`;
- **domena RSL** (10°W–70°E / 45–85°N) w ~0,1° do `grid/dem-europe` — tło paleo na globie. Wymaga kafla GEBCO 90°W–0 (tura 2).

EMODnet DTM 2024 tylko po potwierdzeniu licencji (`0-03`).

**Zakres**
- Przycięcie, resampling, przetwarzanie w **EPSG:3035**, eksport w EPSG:4326.
- Kontrola wobec BSBD / IOWTOPO2 tylko jeśli ✅.

**DoD**
- [ ] Mozaika bez szwów i dziur w oknie Bałtyku i w domenie RSL
- [ ] Raport pokrycia i rozdzielczości per źródło
- [ ] Udokumentowana metoda łączenia (jeśli więcej niż jedno źródło)

**Plan:** §3.3, §4.1

## `C-02` Integrate great-lake bathymetry (Ladoga, Onega, Vänern, Vättern)

**Epik:** C · **Zależy od:** `C-01` · **Blokuje:** `C-14` · **Labels:** `data-pipeline`, `regime-c`

**GEBCO 2024 ma dla tych jezior tylko powierzchnię wody** (sprawdzone na danych z tury 1: Vänern płasko 44 m, Vättern 88 m, Onega ~23 m, Ładoga ~1 m). Onega (~35,5°E) leży **poza oknem Bałtyku** (9–33°E) — trafia tylko do siatki domeny RSL (`dem-europe`); okno trzeba poszerzyć, jeśli Onega ma brać udział w flood-fill. Vänern i Vättern leżą na trasie Rzeki Svea i korytarza Billingen, a Ładoga była częścią basenu w kilku fazach — bez batymetrii fazy jeziorne nie dostaną odpływów.

Dotyczy tylko **faz jeziornych** (`C-14`) — paleo-DEM faz morskich (`C-03`) nie czeka na to zadanie.

**Źródła bez zapytań, w kolejności:**
1. **GLOBathy** (Khazaei i in. 2022) — globalna batymetria jezior, CC BY 4.0 do potwierdzenia w `0-03`.
2. Otwarte dane krajowe (Szwecja: Vänern, Vättern) — tylko jeśli licencja otwarta.
3. Fallback: **parametryczna misa** z opublikowanych głębokości maks. i średnich (fakty z literatury), `dataQuality: "modelled"`.

**DoD**
- [ ] Cztery jeziora z batymetrią w mozaice, źródło i `dataQuality` per jezioro
- [ ] Progi odpływowe widoczne w profilu wysokościowym
- [ ] Licencje per jezioro w `SOURCES.md` (✅ albo literatura)

**Plan:** §3.3

## `C-03` Compute GIA paleo-DEM frames

**Epik:** C · **Zależy od:** `0-06`, `C-01` · **Blokuje:** `C-04`, `V-02`, `V-03`, `V-08` · **Labels:** `data-pipeline`, `regime-c`, `blocker`

```
H_paleo(x,y,t) = H_now(x,y) − RSL(x,y,t)        # Steffen & Kaufmann 2025, jedyny model GIA (0-02)
```

**Bez osobnego członu eustatycznego** — RSL zawiera już składnik eustatyczny i geoidalny. Plan wejściowy podawał `+ ΔGIA − ΔEustatic`, co liczy eustatykę drugi raz, na dziesiątki metrów.

Kontrola punktowa na danych z tury 1 (model `sk1`, **najbliższa komórka 1°**): Umeå ~282 m przy 11,3 ka (najwyższa linia brzegowa ~286 m); Gdańsk −25 m przy 8,9 ka i −14 m przy 7,8 ka. Interpolacja dwuliniowa w tych samych punktach daje 274 / −23,7 / −11,9 m — wybór metody przestrzennej ma znaczenie rzędu 10 m.

Rozrzut 8 modeli Ziemi jest duży: maksimum RSL w Umeå od **195 m** (`j88`) do **274 m** (`sk1`, `sk3`). Wybór modelu wiodącego to decyzja merytoryczna, nie formalność.

**Zakres**
- Odczyt `RSL(time, lat, lon)` z `rsl_SK05_skan_<model>.nc` (1°, 19 nierównych kroków 21,4 ka → 0).
- **21 klatek co 1000 lat** (20 → 0 ka) + ~6 przekrojów zdarzeniowych; interpolacja liniowa w czasie między krokami modelu.
- Wybór wiodącego modelu Ziemi spośród 8 wariantów (uzasadnienie w `V-03`); pozostałe jako pas niepewności poziomu.
- Resampling 1° → siatka robocza okna Bałtyku i ~0,1° domeny RSL; **ta sama metoda interpolacji przestrzennej** w pipeline'ie i w aplikacji (warunek ≤ 1 m z `I-01`).
- **Maskowanie lodem:** pod zasięgiem DATED-1 (`C-07`) paleo-DEM nie jest powierzchnią terenu (RSL rośnie pod lądolodem, np. Umeå 21 → 11 ka) — komórki pod lodem oznaczone, nie interpretowane jako ląd ani morze.
- **Prototyp oglądany na globie `I-05`** (tylko glob i relief z El Niño), nie na osobnej mapie 2D.

**DoD**
- [ ] 21 klatek + przekroje zdarzeniowe z `datum: "contemporaneous-geoid"`
- [ ] Klatki poza krokami modelu z `dataQuality: "interpolated"`
- [ ] `gia.source` i `gia.earthModel` w każdej klatce
- [ ] Nazwa pliku i zmiennej zapisana w metodyce
- [ ] Zero wystąpień osobnego członu eustatycznego w kodzie
- [ ] Komórki pod lądolodem (DATED-1 `mc`) oznaczone w każdej klatce ≥ 10 ka
- [ ] Metoda interpolacji przestrzennej zapisana w `manifest.json` i w metodyce

**Plan:** §0.1, §1, §4.1

## `C-04` Implement connectivity-aware water mask (flood-fill) for marine phases

**Epik:** C · **Zależy od:** `C-03` · **Blokuje:** `C-11`, `C-13`, `C-14` · **Labels:** `data-pipeline`, `regime-c`, `blocker`

Prosty próg `H < poziom` tworzy fałszywe jeziora w każdym zamkniętym obniżeniu terenu. Zbiornik musi być **hydrologicznie połączony z odpływem** — analiza spójnych składowych z zasiewem. Przy ~27 przekrojach to krok obowiązkowy, nie optymalizacja.

```python
water_mask(t) = flood_fill(paleo_dem(t), level(t), seed=active_outlet(t))
```

Ten etap obejmuje **fazy morskie** (Yoldia, Mastogloia, Littorina, post-Littorina, dziś): poziom morza z GIA, zasiew na otwartym oceanie (brzeg okna w Skagerraku/Kattegacie) — bez potrzeby katalogu progów. Fazy jeziorne to `C-14`.

**Zakres**
- `scipy.ndimage` — spójne składowe z zasiewem w komórce oceanicznej.
- API gotowe na zasiew w progu i wiele odpływów jednocześnie (`C-14`).

**DoD**
- [ ] Maska dla wszystkich przekrojów faz morskich
- [ ] Raport: zero zbiorników bez połączenia z odpływem
- [ ] Test regresyjny na zamkniętym obniżeniu (musi zostać suche)

**Plan:** §0.3, §4.1

## `C-05` Build sills.json — sill and strait catalogue

**Epik:** C · **Zależy od:** `0-06` · **Blokuje:** `C-06`, `C-10`, `C-14`, `V-02` · **Labels:** `contract`, `regime-c`, `blocker`

Katalog progów: współrzędne, rzędne progowe, okresy aktywności. **Billingen** (58,4°N 13,8°E), **Närke** (59,1°N 15,0°E), **Svea / Degerfors**, **Dana / Wielki Bełt**, **Darss**, **Drogden / Øresund**. Przesmyk karelsko-białomorski oznaczony jako *hipoteza historyczna, nie konsensus*.

Rzędne progów **Närke i Billingen**: z **SGU Strandförskjutningsmodell**, jeśli licencja okaże się otwarta (`0-03`), inaczej **wartości z publikacji** (fakty z cytowaniem) — bez zapytań. Baza Rosentaua ma lukę właśnie w Szwecji, więc przy problemach w `V-02` / `V-03` pierwszym podejrzanym jest ta część katalogu.

Badanie literatury do katalogu (współrzędne, rzędne, okresy aktywności) może zacząć się od razu; zapis do `sills.json` wymaga schematu z `0-06`.

> **Uwaga do kolejności z §6.** `C-14` potrzebuje zasiewu w aktywnej cieśninie, `C-06` rzędnych progowych, a `C-10` stanów progów (zasolenie w klatkach M3). Ten plik powstaje **razem z `C-03`** (M2), nie po nim.

**DoD**
- [ ] Każdy próg: współrzędne, rzędna, okresy aktywności, źródło
- [ ] Stan otwarty / zamknięty per faza dla wszystkich 7 faz
- [ ] Hipotezy oznaczone flagą, nie podane jako fakt

**Plan:** §3.2, §3.4, §5

## `C-06` Derive lake-phase water levels from sill elevations

**Epik:** C · **Zależy od:** `C-05` · **Blokuje:** `C-14`, `V-02`, `V-06` · **Labels:** `data-pipeline`, `regime-c`

Sedno poprawności: w fazach jeziornych powierzchnia wody **nie jest** globalnym poziomem morza — wyznaczał ją próg odpływu.

```
level(t) = sill_elevation(active_outlet(t), t)   # fazy jeziorne: BIL, Ancylus
         | gia_sea_level(t)                      # fazy morskie: Yoldia, Mastogloia, Littorina, dziś
```

BIL **+25 m**, Ancylus **+10 m** — poprawne tylko względem geoidy współczesnej *t*. Dwa drenaże Billingen: pierwszy ~13 000 BP (~10 m), ponowne zatamowanie w młodszym dryasie, finalny 11 620–11 700 BP ze spadkiem **25–28 m**.

**DoD**
- [ ] `water.type` + `water.levelM` + `water.outlet` w każdej klatce
- [ ] Fazy morskie biorą poziom z GIA, jeziorne z rzędnej progu
- [ ] Czas trwania finalnego drenażu oznaczony jako **sporny** (1–2 lata to jedno oszacowanie, nie konsensus)

**Plan:** §2, §4.1

## `C-07` Assemble ice-sheet layer with uncertainty band

**Epik:** C · **Zależy od:** `0-05` · **Blokuje:** `C-11`, `I-05` · **Labels:** `data-pipeline`, `regime-c`

**DATED-1** (Hughes i in. 2016, CC BY 3.0) to **jedyna geometria lądolodu**: wariant `mc` jako zasięg, `min` / `max` jako pas niepewności przeniesiony **do danych**. Dane z tury 1: 25 → 10 ka **co 1 ka** (`TS<ka>_{min,mc,max}.shp`), więc klatki 20 → 10 ka trafiają dokładnie w przekroje źródłowe — `ice.interpolated: false`. Interpolowane są tylko przekroje zdarzeniowe (np. 11 750 / 11 650). DATED-1 obejmuje też lądolody brytyjsko-irlandzki i barencki, widoczne na globie.

Stroeven 2016 nie jest używany (CC BY-NC-ND, `0-02`).

Archiwum zawiera 58 shapefile'i (sprawdzone 2026-10-31). Do ich odczytu trzeba dodać `pyogrio` (lub `geopandas`) do `tools/data/requirements.in` i `requirements.txt` — dziś ich tam nie ma. DATED-1 kończy się na 10 ka, a resztki lądolodu w Skandynawii przetrwały do ~9,7 ka; klatka 9 ka z `ice: null` jest uproszczeniem, które trzeba opisać w metodyce.

**Grubość lodu** (rzeźba 3D na globie, tooltip): **profil plastyczny** od krawędzi `mc`: `h(d) = √(2·τ₀·d / (ρ_i·g))`, τ₀ ≈ 100 kPa → ~3000 m przy ~400 km od czoła. `ice.thickness: "plastic-profile"`, `dataQuality: "modelled"`, opis w UI jako schemat. Nie wchodzi do paleo-DEM-u (RSL zawiera już obciążenie lodem).

**DoD**
- [ ] Warstwa `ice` (mc + min / max) w każdej klatce ≥ 10 ka; `ice: null` w młodszych
- [ ] `ice.interpolated: false` w klatkach co 1 ka, `true` w przekrojach zdarzeniowych
- [ ] Siatka grubości z profilu plastycznego, parametr τ₀ w `manifest.json`
- [ ] `ice.source: "dated1"`

**Plan:** §3.1, §4.1

## `C-08` Build timeline.json for the seven postglacial phases

**Epik:** C · **Zależy od:** `0-06`, `C-09` · **Blokuje:** `C-11`, `V-12` · **Labels:** `contract`, `regime-c`

Siedem faz: `deglaciation`, `bil`, `yoldia`, `ancylus`, `mastogloia`, `littorina`, `post-littorina`. Osnowa: **cal yr BP** (Present = 1950).

**Andrén i in. 2011 jako źródło wiodące.** Granica końca fazy ancylusowej jest podawana jako 9 800 **albo** 9 500 cal BP w zależności od autora — **nie uśredniamy**; przyjmujemy Andréna, a odstępstwa Björcka 1995/2008, Stroevena i in. 2016 i Uścinowicza 2014 zapisujemy w `baltic-data-catalog.md`.

Granice faz w `timeline.json` są **basenowe**, a przejścia lokalne są nierównoczesne — np. Littorina w Małym Bełcie ~7,4 ka cal BP (IODP M0059) wobec początku fazy ~8 500 BP. Lokalne onsety trzymamy osobno, inaczej `V-06` będzie fałszywie padał.

**DoD**
- [ ] `timeline.json` w cal yr BP, 7 faz, każda granica z cytowaniem
- [ ] Lokalne onsety faz (miejsce, data, źródło) jako osobne pole, nie nadpisują granic basenowych
- [ ] Tabela odstępstw w katalogu danych
- [ ] Zero uśrednionych granic

**Plan:** §2

## `C-09` calibrate.py — IntCal20 recalibration of literature dates

**Epik:** C · **Zależy od:** `0-04` · **Blokuje:** `C-08` · **Labels:** `data-pipeline`, `regime-c`

Wszystkie daty ¹⁴C ze starszej literatury muszą przejść kalibrację **IntCal20** — bez tego daty z Björcka 1995 przesuwają się o **~1000–1500 lat** w późnym glacjale. Trzymamy **obie** wartości plus użytą krzywą.

**DoD**
- [ ] `t14C`, `tBP` i `calCurve: "IntCal20"` w każdej klatce i karcie opartej na dacie ¹⁴C
- [ ] Żadna data z literatury nie trafia do kontraktu bez kalibracji
- [ ] Test na dacie referencyjnej z Björcka 1995

**Plan:** §2

## `C-10` Model salinity regimes and sill states

**Epik:** C · **Zależy od:** `C-05` · **Blokuje:** `C-11`, `V-06`, `V-07` · **Labels:** `data-pipeline`, `regime-c`

Klasa reżimu (słodki / słonawy / morski) per faza z **IODP Exp. 347, Site M0059** (Kotthoff i in. 2022 — okrzemki, palinomorfy, geochemia; przejście do Littoriny w ~200 lat około 7,4 ka cal BP), plus **stan każdego progu** i profil przestrzenny Cieśniny Duńskie → Basen Gotlandzki → Zatoka Botnicka. Podział na baseny z HELCOM (ETRS89-LAEA).

**Dane sporne:** „12–18 PSU" dla zasolenia littorynowego to **górna granica publikowanych wartości dla Bałtyku właściwego**. Wymaga rozbicia na baseny — nie wolno podać jako jednej liczby dla całego morza.

**DoD**
- [ ] `salinity.class` + `salinity.psuRange` per basen per faza
- [ ] `psuRange` nigdy nie jest skalarem
- [ ] Stan każdego progu z `sills.json` spójny z klasą reżimu

**Plan:** §2, §3.4, §4.1

## `C-11` Emit marine-phase postglacial frames (today → 8 ka first)

**Epik:** C · **Zależy od:** `C-04`, `C-07`, `C-08`, `C-10` · **Blokuje:** `I-01`, `C-15` · **Labels:** `data-pipeline`, `regime-c`

Krok **1000 lat** (§1): klatki 0 → 11 ka faz morskich (Yoldia, Mastogloia, Littorina, post-Littorina) plus przekroje zdarzeniowe littorynowe (początek ingresji ~8 350, maksimum ~6 750). Szybkie zdarzenia, których krok 1 ka nie złapie, niosą przekroje zdarzeniowe. To wystarcza do M3 — pierwszej działającej aplikacji. Fazy jeziorne i pozostałe przekroje to `C-15`.

**DoD**
- [ ] Klatki faz morskich w `frames/`, z kompletem pól kontraktu
- [ ] `dataQuality` w każdej klatce
- [ ] Zrealizowane w kolejności dziś → 8 ka, potem Yoldia
- [ ] `eslM` (eustatyka z `curves/esl`) w każdej klatce — tylko do odczytu w UI

**Plan:** §1, §2

## `C-12` curves.py — RSL sites, eustatic curve and uplift

**Epik:** C · **Zależy od:** `0-05` · **Blokuje:** `V-03`, `V-08`, `C-11` · **Labels:** `data-pipeline`, `regime-c`

Pliki w `curves/` pochodzące wprost ze źródeł — **nie zależą od paleo-DEM-u**:

| Plik | Źródło |
| :-- | :-- |
| `rsl-sites` | Rosentau i in. 2021 — 1099 wskaźników RSL, HOLSEA, 3 klastry (CC BY 4.0) |
| `esl` | eustatyka co 1 ka — **wartości z literatury** (Lambeck i in. 2014, PNAS) z cytowaniem; linia „ocean” na wykresie krzywych i odczyt „ocean −X m” w karcie fazy |
| `uplift` | NKG2016LU, jeśli licencja siatek ✅ (`0-03`); inaczej wartości punktowe z artykułu (CC BY) |

`basin-metrics` powstaje w `C-13`.

**DoD**
- [ ] Trzy pliki w `curves/`
- [ ] Klastry Rosentaua zachowane jako pole, nie spłaszczone
- [ ] Daty w cal yr BP, z oryginalną datą ¹⁴C tam, gdzie baza ją podaje
- [ ] `esl` z cytowaniem i opisem sposobu odczytu wartości

**Plan:** §3.2, §5

## `C-13` Compute basin metrics for every cross-section

**Epik:** C · **Zależy od:** `C-04`, `C-14` · **Labels:** `data-pipeline`, `regime-c`

**Metryki bilansowe** per przekrój (§4.2): powierzchnia (km²), objętość (km³), średnia i maksymalna głębokość, szacowany czas wymiany wód. Liczone z maski wody (`C-04`, `C-14`), nie z samego paleo-DEM-u. Niemal darmowe, a dają cztery dodatkowe krzywe i kontrolę sensowności.

**DoD**
- [ ] `curves/basin-metrics`
- [ ] `metrics` wypełnione w każdej klatce

**Plan:** §4.2, §5

## `C-14` Extend water mask to lake phases with sill-seeded outlets

**Epik:** C · **Zależy od:** `C-02`, `C-04`, `C-05`, `C-06` · **Blokuje:** `C-13`, `C-15`, `V-06` · **Labels:** `data-pipeline`, `regime-c`, `blocker`

Fazy jeziorne (BIL, Ancylus) i `deglaciation`: zasiew w **aktywnym progu** z `sills.json`, poziom z rzędnej progu (`C-06`). Rozstrzyganie przypadków z wieloma aktywnymi odpływami jednocześnie (np. Svea → Dana).

**DoD**
- [ ] Maska dla wszystkich przekrojów faz jeziornych i deglacjacji
- [ ] Raport: zero zbiorników bez połączenia z odpływem
- [ ] Test przypadku z dwoma aktywnymi odpływami

**Plan:** §0.3, §4.1

## `C-15` Emit lake-phase frames and remaining event cross-sections

**Epik:** C · **Zależy od:** `C-11`, `C-14` · **Blokuje:** `V-12` · **Labels:** `data-pipeline`, `regime-c`

Klatki faz `deglaciation`, `bil`, `ancylus` (12 → 20 ka co 1 ka) oraz przekroje zdarzeniowe: przed i po drenażu Billingen, maksimum ancylusowe, próg regresji ancylusowej. Razem z `C-11` daje komplet: 21 klatek + ~6 zdarzeniowych.

**DoD**
- [ ] 21 klatek + przekroje zdarzeniowe w `frames/` łącznie z `C-11`
- [ ] `water.type: "lake"` + `water.outlet` w każdej klatce fazy jeziornej
- [ ] `dataQuality` w każdej klatce

**Plan:** §1, §2

---

# EPIC V · Walidacja

`tools/data/validate.py` produkuje raport i **kończy się błędem** przy przekroczeniu progów.

## `V-01` validate.py skeleton and CI gate

**Epik:** V · **Zależy od:** `0-04`, `0-06` · **Blokuje:** pozostałe zadania V · **Labels:** `validation`, `ci`

**DoD**
- [ ] Rejestr testów z progami, uruchamiany z `npm run data:build`
- [ ] Raport w czytelnej formie (tabela per test)
- [ ] Niezaliczony test o statusie `blocking` przerywa build

**Plan:** §7

## `V-02` Sill-check — elevation balance at every sill

**Epik:** V · **Zależy od:** `V-01`, `C-03`, `C-05`, `C-06` · **Labels:** `validation`, `blocker`

Dla każdego przekroju sprawdzić, czy rzędna progu zgadza się z kierunkiem przepływu: **jezioro zaporowe wymaga progu powyżej** ówczesnego poziomu oceanu, **połączenie morskie poniżej**.

Test wewnętrznie spójnościowy — nie wymaga danych zewnętrznych, a wyłapuje **ilościowo** dokładnie tę klasę błędu, która jest tu najgroźniejsza: podwójne liczenie eustatyki (§0.1) i pomylony datum (§0.2). **Najwyższy priorytet w epiku.**

**DoD**
- [ ] Uruchamiany dla wszystkich progów z `sills.json`, wszystkich przekrojów
- [ ] Status `blocking`
- [ ] Test negatywny: celowo zepsuta formuła musi go wywalić

**Plan:** §7, §0.1, §0.2

## `V-03` RSL versus Rosentau et al. 2021 — RMSE per region per cluster

**Epik:** V · **Zależy od:** `V-01`, `C-03`, `C-12` · **Labels:** `validation`

Policzony poziom w punktach bazy Rosentau i in. 2021 (1099 wskaźników, GFZ `10.5880/GFZ.1.3.2020.003`) vs wartości zmierzone. Obserwacje RSL są wyrażone względem dzisiejszego lokalnego poziomu, a paleo-DEM względem geoidy współczesnej *t* — porównanie wymaga transformacji z `0-07`. **RMSE raportowane per region**, osobno dla trzech klastrów bazy: regresja / transgresja / przejściowe.

> **To jedyna ilościowa walidacja w całym planie.** Bez niej zostaje „zgodność z syntezami".

**DoD**
- [ ] RMSE per region × per klaster w raporcie
- [ ] Ustalony i uzasadniony próg akceptacji
- [ ] Rozkład reszt, nie tylko liczba zbiorcza
- [ ] RMSE dla każdego z 8 modeli Ziemi Steffena i Kaufmanna — uzasadnia wybór wiodącego w `C-03`
- [ ] Porównanie z polem południowobałtyckim (`steffen2025_rsl_sbaltic`) na wybrzeżu PL/DE

**Plan:** §7

## `V-06` Event checks

**Epik:** V · **Zależy od:** `V-01`, `C-06`, `C-10`, `C-14` · **Labels:** `validation`

- Spadek Billingen **25–28 m**.
- Środkowoholoceński highstand w strefach przejściowych w **7,5–6,5 ka BP**.
- Przejście do Littoriny w Małym Bełcie **~7,4 ka cal BP** — porównywane z lokalnym onsetem z `timeline.json` (`C-08`), nie z basenową granicą fazy (~8 500 BP).

**DoD**
- [ ] Trzy testy z tolerancjami w `validate.py`
- [ ] Odchylenie raportowane liczbowo, nie binarnie

**Plan:** §7

## `V-07` Build taxa.json and validate salinity against species tolerances

**Epik:** V · **Zależy od:** `V-01`, `C-10`, `0-06` · **Labels:** `validation`, `contract`

Gatunki wskaźnikowe jako **niezależna kontrola** rekonstrukcji: *Portlandia (Yoldia) arctica*, *Ancylus fluviatilis*, okrzemki *Mastogloia*, *Littorina littorea*, *Limnaea (Radix) balthica*, *Mya arenaria*. Rekonstruowane zasolenie w miejscu i czasie wystąpienia gatunku musi mieścić się w jego tolerancji.

**Sporne, do oznaczenia:** zawleczenie *Mya arenaria* — datowania muszli z Danii wskazują **~1245–1295 n.e.** (hipoteza nordycka), **nie** XVI/XVII w.

**DoD**
- [ ] `taxa.json`: tolerancja zasolenia i temperatury per gatunek, ze źródłem
- [ ] Test zgodności dla każdego udokumentowanego wystąpienia
- [ ] *Mya arenaria* z flagą sporności i oboma datowaniami

**Plan:** §3.4, §7, §2

## `V-08` Present-day uplift gradient versus NKG2016LU

**Epik:** V · **Zależy od:** `V-01`, `C-03`, `C-12` · **Labels:** `validation`

Steffen i Kaufmann nie publikują pola współczesnej prędkości wypiętrzania, a modele, które je mają (ICE-6G_C), są wykluczone (`0-02`). Prędkość przybliżamy **gradientem RSL między krokami 0,9 ka i 0**, z jawną adnotacją, że to średnia z ostatnich ~900 lat, nie prędkość chwilowa. Odniesienie: NKG2016LU (jeśli ✅) albo wartości z artykułu.

Gradient z modelu GIA vs NKG2016LU: maks. **~10,3 mm/rok przy Umeå**, **linia zerowa na wybrzeżu Niemiec i Polski**.

**DoD**
- [ ] Oba punkty kontrolne zaliczone z tolerancją
- [ ] Mapa reszt gradientu w raporcie

**Plan:** §7

## `V-11` Topology, CRS and asset-budget gate

**Epik:** V · **Zależy od:** `V-01`, `I-01`, `0-08` · **Labels:** `validation`, `ci`

- Geometrie poprawne — brak samoprzecięć.
- Spójny CRS w całym wyjściu.
- **Suma assetów ≤ 25 MB**, **pierwszy chunk ≤ 4 MB**.
- Sumy kontrolne w `manifest.json` zgodne.

Deploy idzie na GitHub Pages (`npm run build:gh-pages`), więc rozmiar jest realnym ograniczeniem — pilnowanym w CI, nie w dobrych intencjach.

**DoD**
- [ ] Bramka w CI, status `blocking`
- [ ] Raport rozmiaru per chunk

**Plan:** §5, §7

## `V-12` Visual overlay control

**Epik:** V · **Zależy od:** `V-01`, `C-08`, `C-15` · **Labels:** `validation`

Nałożenie klatek na mapy etapów z **Björcka 1995 / Andréna i in. 2011** dla przekrojów najbliższych 11,7 / 11,1 / 10,5 ka BP oraz na paleo-DEM-y z **ESD 16, 585 (2025)** — niezależną implementację tej samej metody (paleo-DEM-y co 500 lat na GEBCO_2023 z korektą ancylusową za Uścinowiczem, CC BY). ESD obejmuje tylko **11,7–0 ka** — dla BIL i deglacjacji zostają mapy Björcka / Andréna.

> Skoro ESD 2025 to ta sama metoda liczona niezależnie, **rozbieżność linii brzegowej większa niż kilka kilometrów oznacza błąd u nas.**

**Ukryta praca:** mapy Björcka / Andréna istnieją tylko jako rysunki — pomiar liczbowy wymaga ich **georeferencji i cyfryzacji linii brzegowej** (z udokumentowanym błędem georeferencji).

**DoD**
- [ ] Zgeoreferowane i zdigitalizowane linie brzegowe Björcka / Andréna dla 11,7 / 11,1 / 10,5 ka
- [ ] Nakładki ESD 2025 dla przekrojów 11,7–0 ka
- [ ] Rozbieżność zmierzona liczbowo, nie oceniona wzrokowo
- [ ] Wynik w raporcie `validate.py`, nie tylko jako obrazek

**Plan:** §7

---

# EPIC I · Kontrakt, emisja, integracja

## `I-01` emit.py — grids, RSL cube and vector frames

**Epik:** I · **Zależy od:** `C-11` · **Blokuje:** `I-02`, `V-11` · **Labels:** `data-pipeline`, `contract`

**Emisja hybrydowa** (§5, decyzja z 2026-10-31). Pełnorozdzielczy raster per klatka byłby za duży (20 000 × 15 000 komórek przy ~115 m), ale makieta potrzebuje wysokości w każdym punkcie: rzeźba 3D na globie, przekrój Umeå → Gdańsk, tooltip, krzywa RSL dla klikniętego punktu. Rozwiązanie: **jedna siatka dziś + kostka RSL**, z których aplikacja liczy `H_now − RSL(t)` sama, oraz **wektory** z wynikami, które wymagają flood-fill i walidacji.

| Plik | Zawartość | Szacunek |
| :-- | :-- | :-- |
| `grid/dem-baltic.bin.gz` | H_now, okno Bałtyku, ~0,04°, int16 | ~200–400 KB |
| `grid/dem-europe.bin.gz` | H_now, domena RSL, ~0,1°, int16 | ~400–600 KB |
| `grid/rsl.bin.gz` | RSL wiodącego modelu, 1°, 19 kroków, int16 × 0,01 m (KMDG/1) | ~30 KB |
| `grid/ice-h-<tBP>.bin.gz` | grubość lodu z profilu plastycznego (≥ 10 ka) | małe, tylko klatki z lodem |
| `frames/f-<tBP>.topo.json` | `water` / `lake` / `ice` (mc, min, max) / `coast`, kwantyzowany TopoJSON | ~100–200 KB / klatkę |
| `frames/f-<tBP>.json` | poziom, odpływ, stany progów, zasolenie per basen, metryki | < 5 KB |

**DoD**
- [ ] Format siatek zgodny z `0-06`, parametry kwantyzacji i uproszczenia w `manifest.json`
- [ ] Aplikacja odtwarza `H_paleo` z siatki i kostki RSL z błędem ≤ 1 m wobec pipeline'u (test)
- [ ] `emit.py` sprawdza topologię po uproszczeniu lokalnie (bramka CI to `V-11`)
- [ ] Pierwsze wejście ≤ 4 MB

**Plan:** §5

## `I-02` Wire src/assets/data into the app with lazy per-frame loading

**Epik:** I · **Zależy od:** `I-01`, `I-05` · **Labels:** `app`

Siatki i kostka RSL ładowane na starcie (potrzebne do każdej klatki); klatki wektorowe leniwie — bieżąca i sąsiednie na osi czasu.

**Zakres**
- Serwis danych reaktywny (sygnały), z mapą plików z `manifest.json`, kontrolą `schemaVersion`.
- Oś czasu w dolnym docku (`app-timeline-slider`): 20 ka → 0 co 1 ka, markery przekrojów zdarzeniowych, pasma faz, play / kroki — jak w makiecie.
- Panele z makiety: **Faza** (nazwa, typ wody, PSU, `dataQuality`, `datum`, sporne, poziom model vs literatura, odpływ, powierzchnia, objętość, ocean −X m), **Przekrój** Umeå → Gdańsk, **Krzywe** (RSL w Umeå, Sztokholmie, Gdańsku + kliknięty punkt + ocean).
- Tooltip: współrzędne, typ wody, PSU, grubość lodu, wysokość wzgl. ówczesnego oceanu i dziś; progi ze stanem.
- Chipy warstw: lądolód, pas niepewności, brzeg dziś, brzeg −1000 lat, progi, linia przekroju, nazwy.

**DoD**
- [ ] Pierwsze wejście ładuje ≤ 4 MB
- [ ] Przewinięcie osi czasu dociąga klatkę bez blokowania wizualizacji
- [ ] Niezgodny `schemaVersion` daje czytelny błąd, nie pustą scenę
- [ ] Wszystkie panele i tooltip z makiety działają na danych z `src/assets/data/`

**Plan:** §5, §5.1

## `I-03` i18n — ids in data, long-form content in assets/content/{en,pl}

**Epik:** I · **Zależy od:** `0-06` · **Labels:** `i18n`, `blocker`

`AGENTS.md` wymaga **zera zahardkodowanych stringów** i równoległości EN/PL, ale kilkadziesiąt kart zdarzeń, progów i taksonów rozsadziłoby `en.ts` / `pl.ts`.

Obowiązuje: **dane noszą wyłącznie identyfikatory**. Chrome UI zostaje w `Dict` — najpierw `i18n.types.ts` (żeby TypeScript wymusił kompletność), potem `en.ts` i `pl.ts` **jednocześnie**, rozszerzone o klucze faz i warstw. Długie teksty idą do `src/assets/content/{en,pl}/*.json`, ładowane reaktywnie na podstawie sygnału `lang` z `I18nService`. Litera reguły zachowana, słowniki nie puchną.

> **`content/{lang}/` od pierwszego commita, nie na końcu.** Dorabianie równoległości EN/PL po napisaniu wszystkich kart to przepisywanie, nie uzupełnianie.

Zakres językowy: `Lang = 'en' | 'pl'` (stan `i18n.types.ts`). `AGENTS.md` dopuszcza dodatkowe locale (np. `es`) — **poza zakresem** tego zadania; mechanizm `content/{lang}/` ma je przyjąć bez zmian w kodzie.

**DoD**
- [ ] **Brak tłumaczenia = błąd builda** (test pokrycia kluczy EN↔PL)
- [ ] Zero stringów użytkownika w `.ts` i `.html` poza `Dict`
- [ ] Canvas / WebGL używa `i18n.t()` oraz `ThemeService.getFontFamily()`, nie hardkodowanych fontów

**Plan:** §5, §8; `AGENTS.md` §1, §4

## `I-04` sources.json and the Sources panel

**Epik:** I · **Zależy od:** `0-03` · **Labels:** `app`, `licensing`

`sources.json` jest **obowiązkowy, nie kosmetyczny** — niemal każdy zbiór to CC BY, co nakłada wymóg atrybucji. Ten plik napędza panel „Źródła" i jest **warunkiem legalności publikacji**.

**Zakres**
- Generowanie `sources.json` z `SOURCES.md` jako źródła prawdy.
- Panel w dolnym docku (`PopupService`, zgodnie z `AGENTS.md` §2.3).
- Odsyłacze z kart `events.json` do pozycji źródłowych.

**DoD**
- [ ] Każda pozycja z `SOURCES.md` użyta w opublikowanych danych (w tym tło globu: GEBCO, ETOPO2, Natural Earth) obecna w panelu z pełną atrybucją
- [ ] Każda karta zdarzenia linkuje do co najmniej jednego źródła
- [ ] Test: żadne `sources: []` w kontrakcie

**Plan:** §5, §9

## `I-05` Globe scene ported from el-nino, centred on the Baltic

**Epik:** I · **Zależy od:** `0-01`, `0-06` · **Blokuje:** `I-02` · **Labels:** `app`

Decyzja z 2026-10-31: scena to **glob z `kmd-labs/el-nino` — tylko glob i relief, cała reszta pominięta**. Widok jest zbliżony na obszar zainteresowania, a próba obrócenia globu kończy się powrotem kamery na Bałtyk.

**Zakres**
- **Bierzemy z El Niño** (`src/app/components/globe/globe.component.ts`): renderer, scena, kamera i `OrbitControls`; sfera z teksturą lądu malowaną na płótnie equirectangular (`d3-geo`, `topojson-client`); `displacementMap` (`loadElevation`); cieniowanie reliefu (`reliefLayer`); poświata; kolory z `ThemeService.getTokenColor()`, napisy przez `i18n.t()` i `ThemeService.getFontFamily()`.
- **Pomijamy:** pole SST i `recolorTexture`, `CurrentWeatherLayer`, regiony wpływu i `ImpactModalComponent`, bokeh, autoobrót, `EnsoStateService` / `EnsoMathService` (poza potrzebną matematyką sfery), `AnalyticsService`, tooltipy ENSO.
- **Kamera:** start zbliżony na okno Bałtyku (~20°E / 58°N); `enablePan = false`; bez autoobrotu; zoom w zakresie „okno Bałtyku” ↔ „cała Europa”; **azymut i biegun ograniczone** (`minAzimuthAngle` / `maxAzimuthAngle`, `minPolarAngle` / `maxPolarAngle`) — przeciągnięcie daje lekkie przechylenie, a po puszczeniu kamera sprężyście wraca i **centruje się na Bałtyku**. Obrót globu poza Europę jest niemożliwy.
- **Tło:** ETOPO2v2c (`displacementMap`, `scripts/fetch-elevation.mjs`), Natural Earth SR_50M (cieniowanie, `scripts/fetch-relief.mjs`), `world-atlas` land-50m — domena publiczna, jak w El Niño; poza domeną RSL przygaszone.
- **Najpierw prototyp:** glob z reliefem na danych „dziś” służy od razu do oglądania prototypu `C-03` (paleo-DEM `H_now − RSL(t)` jako podmieniana tekstura / przemieszczenie w oknie Bałtyku).
- **Paleo:** w domenie RSL tekstura i przemieszczenie generowane per klatka z `grid/dem-*` − RSL(t), z maską wody, lodu i zasoleniem z klatki; przewyższenie regulowane suwakiem.
- Tryb 2D z makiety — do decyzji; domyślnie tylko glob.
- Dropdown w prawym górnym rogu (`AGENTS.md` §2) — **do rozstrzygnięcia**; propozycja: Paleogeografia / Zasolenie / Lądolód.

**DoD**
- [ ] Glob działa na danych dziś (klatka 0) zanim powstaną klatki paleo
> **Decyzja (2026-10-31, wieczór):** zamiast całego globu rysujemy tylko wycinek kuli z domeną RSL (10°W–70°E / 45–85°N); siatka Europy 1/20°, Bałtyku 1/40°; woda modelowana tylko w Bałtyku. Tło ETOPO2 / Natural Earth / world-atlas wypada.
>
> **Prototyp (2026-10-31, PR #61):** `src/app/components/globe/` — glob i relief z El Niño; region paleo to osobna gęsta łatka liczona na GPU (`paleo-shaders.ts`): `H_now − RSL(t)` per piksel z siatek `dem-europe` (0,05°) i `dem-baltic` (1/40°), woda z wypełnienia od oceanu i *priority-flood* basenu (lód = ściana), rzeźba 3D z przewyższeniem, brzeg dziś i −1000 lat, lód DATED-1 z pasem niepewności, progi, przekrój. Dock z makiety: karta fazy z sill-check (model vs literatura), przekrój Umeå → Gdańsk, krzywe RSL z punktem po kliknięciu, tooltip, warstwy, pasma faz i zdarzenia, odtwarzanie, słowniczek / źródła / o prototypie (`src/assets/content/{en,pl}`). `?t=` w URL. Assety tła w `src/assets/data/globe/` (licencje ✅ w `SOURCES.md`).

- [ ] Start zbliżony na Bałtyk; nie da się obrócić globu poza Europę — próba daje przechylenie, a po puszczeniu kamera wraca i centruje się na Bałtyku
- [ ] Z El Niño przeniesione tylko glob i relief — żadnych warstw SST, pogody, wpływów ani bokehu
- [ ] Zmiana klatki podmienia teksturę i przemieszczenie bez przeładowania sceny
- [ ] Desktop i mobile (`BreakpointService`) — tekstury 2k na mobile jak w El Niño

**Plan:** §5.1

---

# Niezależność i zależności

## Co można prowadzić równolegle

| Tor | Zadania | Warunek wejścia |
| :-- | :-- | :-- |
| **Fazy morskie** | `C-01` → `C-03` → `C-04` → `C-11` | `0-06`; dane z tury 1 już lokalnie |
| **Fazy jeziorne** | `C-05` → `C-06` → `C-14` → `C-15` → `C-13` | `C-02` i `C-05`; research literatury od razu |
| **Lądolód** | `C-07` | tylko `0-05`; DATED-1 już pobrany |
| **Krzywe** | `C-12` | tura 2 w `0-05` |
| **Glob** | `I-05` | `0-01`, `0-06`; działa na klatce „dziś” przed paleo |
| **Dokumentacja i licencje** | `0-03`, `0-07` | nic |
| **i18n** | `I-03` | `0-06`; **musi startować najwcześniej** |
| **CI** | `0-08` | `0-01`, `0-06` |
| **Batymetria jezior** | `C-02` | research od razu; integracja po `C-01` |

## Co jest sztywno sekwencyjne

```
0-01 ──> 0-04 ──> 0-05 ──> C-01 ──> C-03 ──> C-04 ──> C-11 ──> I-01 ──> I-02
                                      ▲                 ▲                 ▲
0-06 ─────────────────────────────────┘          C-07, C-08, C-10     I-05
                      C-01 ──> C-02 ──────────────────┐
                               C-05 ──> C-06 ──> C-14 ──> C-15
                                          └────> V-02
```

- `0-01` przed czymkolwiek — bez submodułu nie ma builda.
- `0-06` przed każdą emisją i przed `I-05` — format siatek i `datum` są w kontrakcie.
- `C-02` przed `C-14` — fazy jeziorne bez batymetrii jezior nie mają odpływów.
- `C-05` przed `C-06`, `C-10` i `C-14`.
- `C-09` przed `C-08`.
- `V-01` przed resztą epiku V.
- `I-01` przed `I-02` i `V-11`.

## Ryzyka sprzęgnięć

| Sprzęgnięcie | Dlaczego boli | Reakcja |
| :-- | :-- | :-- |
| `C-03` ↔ jeden model GIA | Steffen & Kaufmann (ANU-ICE 1998, 1°) to jedyny dozwolony model | 8 modeli Ziemi jako pas niepewności; `V-03` i ESD 2025 jako kontrola |
| `C-05` ↔ SGU | rzędne Närke i Billingen; luka Rosentaua w Szwecji | SGU tylko jeśli ✅, inaczej liczby z publikacji |
| `C-02` ↔ licencje jezior | GLOBathy / dane krajowe mogą okazać się ❓ | parametryczna misa z literatury |
| `I-05` ↔ `I-01` | glob potrzebuje formatu siatek | format w `0-06` przed obydwoma |
| `I-03` vs cały content | karty bez równoległości EN/PL = przepisywanie | `content/{lang}/` od pierwszego commita |

## Kamienie milowe

| | Kamień | Zadania | Bramka |
| :-- | :-- | :-- | :-- |
| **M1** | Pipeline stoi | `0-01`…`0-08` | `npm run data:build` przechodzi na puste wyjście, CI na PR-ach działa |
| **M2** | Dziś → 8 ka | `C-01`, `C-02`, `C-03`, `C-05`, `C-07`, `C-08`, `C-09` | paleo-DEM-y co 1 ka z `datum`, lądolód z DATED-1, oś czasu w cal yr BP |
| **M3** | ★ **Pierwsza działająca aplikacja** | `C-04`, `C-10`, `C-11`, `I-01`, `I-02`, `I-03`, `I-05` | glob z fazami morskimi, oś czasu klikalna, ≤ 4 MB przy wejściu |
| **M4** | Fazy jeziorne | `C-06`, `C-14`, `C-15`, `C-13` | BIL i Ancylus z poziomem z progu, komplet klatek |
| **M5** | Walidacja ilościowa | `C-12`, `V-01`, `V-02`, `V-03`, `V-11` | sill-check zielony, RMSE w progu |
| **M6** | Domknięcie | `I-04`, `V-06`, `V-07`, `V-08`, `V-12` | panel źródeł, nakładki kontrolne |

**M3 jest celem, nie etapem.** Dlatego maska wody i emisja są rozbite na etap morski (`C-04`, `C-11`) i jeziorny (`C-14`, `C-15`), a batymetria jezior blokuje tylko M4.
