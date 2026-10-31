# Baltic — backlog issues warstwy danych

> Rozpisanie [`baltic-data-plan.md`](./baltic-data-plan.md) na zadania wykonawcze.
> **4 epiki / 35 zadań.** Tytuły po angielsku (spójne z commitami i publicznym repo `kmd-labs/baltic`), treść po polsku.
> Dokument żywy — aktualizowany razem z planem. Odsyłacze `§x.y` wskazują sekcje planu.

> **Zmiana zakresu (2026-10-31):** aplikacja wizualizuje **wyłącznie postglacjał, 20 ka → dziś**. Usunięte epiki: `A` (fanerozoik), `B` (czwartorzęd), `D` (mikroskala czterech wybrzeży) oraz zadania walidacyjne zależne tylko od nich (`V-04`, `V-05`, `V-09`, `V-10`). Identyfikatory pozostałych zadań się nie zmieniają, więc w numeracji są luki.

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
0-01 ──> 0-04 ──> 0-05 ──> C-01 ──> C-02 ──> C-03 ──> C-04 ──> C-11 ──> I-01 ──> I-02     ★ M3 (fazy morskie)
                                               ▲                 ▲
0-02 ──────────────────────────────────────────┤                 │
0-06 ──────────────────────────────────────────┘    C-09 ──> C-08┘
                                                                         C-14 ──> C-15      M4 (fazy jeziorne)
                                    C-05 ──> C-06 ──────────────────────────▲
                                                └──> V-02   (ilościowa bramka na §0.1 / §0.2)
```

Trzy rzeczy nieobejściowe: **`0-01`** (bez submodułu nie ma builda), **`0-02`** (wybór źródła GIA zasila `C-03`; ścieżka Steffen & Kaufmann 2025 jest odblokowana już teraz), **`0-06`** (bez obowiązkowego `datum` poprawka §0.2 pozostaje deklaracją).

## Epiki

| Epik | Nazwa | Zadań | Charakter |
| :-- | :-- | --: | :-- |
| **0** | Fundamenty i blokery | 8 | musi być pierwsze; dwa zadania to decyzje, nie kod |
| **C** | Postglacjał, 20–0 ka | 15 | rdzeń produktu; fazy morskie (M3) przed jeziornymi (M4) |
| **V** | Walidacja | 8 | jedna bramka ilościowa (`V-03`), resztę da się liczyć wcześnie |
| **I** | Kontrakt, emisja, integracja | 4 | `I-03` od pierwszego commita, nie na końcu |

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

## `0-02` Confirm ICE-6G_C redistribution terms, pick GIA fallback

**Epik:** 0 · **Blokuje:** `C-03` · **Labels:** `blocker`, `licensing`

**Żaden model GIA z paleotopografią nie ma licencji.** ICE-6G_C, GLAC-1D i ANU-ICE mają tylko prośbę o cytowanie, a brak licencji oznacza brak zgody na publikację pochodnych. Jedyna ścieżka z czystą licencją na pełny zakres 20–0 ka to **pola RSL Steffena i Kaufmanna 2025** (Zenodo `10.5281/zenodo.15481755`, CC BY 4.0; ANU-ICE 1998, 1°, 21,4 ka → 0, 8 modeli Ziemi). Paleo-DEM: `H_paleo = H_now − RSL(t)` — §0.1 nie jest naruszony, bo RSL zawiera już człon eustatyczny i geoidalny.

Ustalenia techniczne: ICE-6G_C w dystrybucji PMIP4 ma siatkę **10′** (nie 1°) i krok 500 lat do 21 ka; GLAC-1D ma krok **100 lat**, więc przekroje zdarzeniowe nie wymagałyby interpolacji. ESD 16, 585 (2025) **nie jest pełnym fallbackiem** — obejmuje tylko 11,7–0 ka i bazuje na ICE-5G; zostaje jako kontrola w `V-12`.

**Kolejność fallbacków:** ICE-6G_C → GLAC-1D → **Steffen & Kaufmann 2025** → ESD 2025 (tylko 11,7–0 ka). Reżim prac: **start na Steffenie i Kaufmannie**, podmiana źródła po zgodzie.

**Zakres**
- Wysłać zapytania z [`licensing-inquiries.md`](./licensing-inquiries.md) (Peltier, Tarasov; Lambeck niżej w priorytecie). Kluczowe: czy publikacja KMD Labs jest niekomercyjna.
- Ustalić przy okazji źródło **pola współczesnej prędkości wypiętrzania** z wybranego modelu (osobny produkt, nie `Topo`) — potrzebne do `V-08`.
- Decyzja zapisana z datą i treścią zgody/licencji.

**DoD**
- [ ] Wpis w `SOURCES.md`: model, licencja, data ustalenia, osoba
- [ ] Wybrany model wpisany jako wartość `gia.source` w kontrakcie
- [ ] Żadna pochodna modelu bez licencji nie jest zacommitowana przed tym wpisem

**Plan:** §0.1, §3.2, §8

## `0-03` Audit licences of all remaining sources, write SOURCES.md

**Epik:** 0 · **Blokuje:** `I-04` · **Labels:** `licensing`, `docs`

Prawie każdy zbiór w §3 to CC BY, co nakłada wymóg atrybucji — a atrybucja jest warunkiem legalności publikacji. Pozycje nierozstrzygnięte: **EMODnet DTM 2024** (DataCite nie podaje licencji), **BSBD/BSHC** (CC BY 3.0 **z ograniczeniami**), **NKG2016LU** (licencja siatek u Lantmäteriet), batymetrie jezior, SGU, HELCOM, IntCal20.

**Zakres**
- Przegląd wszystkich pozycji z §3.1–3.4: licencja, wersja, format, DOI/URL.
- Gotowy tekst atrybucji per zbiór, dokładnie taki, jaki wymaga licencja.
- `SOURCES.md` jako jedyne źródło prawdy dla generowanego `sources.json`.

**DoD**
- [x] `SOURCES.md` pokrywa 100% zbiorów z §3
- [ ] Zero pozycji ze statusem „do weryfikacji"
- [ ] Każda pozycja ma pełne cytowanie i tekst atrybucji

**Plan:** §3, §5, §9

## `0-04` Scaffold tools/data pipeline and npm run data:build

**Epik:** 0 · **Zależy od:** `0-01` · **Blokuje:** `0-05`, cały epik C · **Labels:** `data-pipeline`

**Zakres**
- Struktura z §6: `fetch.py`, `postglacial.py`, `curves.py`, `calibrate.py`, `validate.py`, `emit.py`.
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

Tura 1 gotowa: `gebco2024`, `steffen2025_rsl`, `dated1` — minimum do pierwszego paleo-DEM-u faz morskich. Kolejne tury dopisywane do `tools/data/registry.json`.

**Zakres**
- Pobieranie po DOI / URL dla każdego zbioru z §3.
- Weryfikacja sum kontrolnych **przed** użyciem pliku; sumy trafiają do `manifest.json`.
- Cache w `data/raw/`, pomijanie już pobranych.

**DoD**
- [ ] Każdy zbiór z §3 pobieralny jednym wywołaniem
- [x] Niezgodna suma kontrolna przerywa build z czytelnym komunikatem
- [x] Powtórny run nie pobiera ponownie

**Plan:** §6

## `0-06` Define frame and manifest JSON contract with mandatory `datum`

**Epik:** 0 · **Blokuje:** każdą emisję klatek · **Labels:** `blocker`, `contract`

Kontrakt z §5: `schemaVersion`, `tBP`, `t14C`, `calCurve`, **`datum`**, `stageId`, `water`, `salinity`, `ice`, `gia`, `metrics`, `dataQuality`, `frame`, `sources`.

Pole `datum` jest obowiązkowe w manifeście **i w każdej klatce**. Powód jest ilościowy: poziomy faz jeziornych (+25 m BIL, +10 m Ancylus) jako skalary są poprawne **wyłącznie** względem geoidy współczesnej danemu *t*. Zalanie DEM-u w dzisiejszym układzie wysokościowym tą samą liczbą daje wynik jawnie fałszywy, bo rebound jest silnie zróżnicowany przestrzennie — **>285 m w Zatoce Botnickiej vs ~0 m na wybrzeżu Polski**.

**Zakres**
- JSON Schema dla klatki, manifestu, `timeline.json`, `sills.json`, `taxa.json`, `curves/*`.
- Fixture'y testowe (poprawne i celowo zepsute) obok schematu.
- `schemaVersion` z polityką wersjonowania.
- Enum `datum`: `contemporaneous-geoid` dla klatek. Transformacja do dzisiejszego układu (potrzebna przy porównaniu z obserwacjami RSL w `V-03`) opisana w `0-07`.
- `ice` może być `null` (brak lądolodu w klatce, ~9,5–0 ka).
- `gia.source` + `gia.earthModel` — z którego modelu GIA i wariantu lepkości policzono klatkę.

Egzekwowanie schematu w pipeline'ie to `V-01`, w CI — `0-08`.

**DoD**
- [ ] Schemat odrzuca fixture klatki bez `datum`
- [ ] Enum `dataQuality` = `modelled | interpolated | qualitative`
- [ ] `ice: null` dopuszczalne, `ice: {}` bez `source` — nie
- [ ] `gia.source` obowiązkowe i zgodne z decyzją `0-02`

**Plan:** §0.2, §5

## `0-07` Write methodology and data-catalog docs

**Epik:** 0 · **Labels:** `docs`

Dwa artefakty z §9. `paleo-reconstruction-methodology.md` to specyfikacja matematyczna i geoprzestrzenna — **musi wskazywać konkretny plik i nazwę zmiennej** modelu GIA (`RSL` w `rsl_SK05_skan_<model>.nc`; po zgodzie `Topo` / `HDC`), nie pojęcie. To nie formalizm: plan wejściowy liczył eustatykę podwójnie **właśnie dlatego**, że formuła nie nazywała pola, które konsumuje.

`baltic-data-catalog.md` to raport z researchu: bezpośrednie linki, licencje, formaty, **tabela korelacji wiekowej** cal yr BP ↔ ¹⁴C BP ↔ BCE/CE dla wszystkich 7 faz, parametry liczbowe per przekrój, katalog współrzędnych punktów kluczowych.

**DoD**
- [ ] Formuła `H_paleo = H_now − RSL(t)` (i wariant `H_now + [Topo(t) − Topo(0)]`) z nazwami plików i zmiennych
- [ ] Jawnie zapisane, dlaczego **nie ma** osobnego członu eustatycznego
- [ ] Metoda interpolacji w czasie między nierównymi krokami RSL (21,4; 20,2; … 0,9; 0 ka)
- [ ] Tabela korelacji kompletna dla 7 faz
- [ ] Odstępstwa źródeł od Andréna i in. 2011 wypisane, nie uśrednione
- [ ] Transformacja `contemporaneous-geoid` ↔ dzisiejszy poziom morza zapisana jako formuła z nazwami pól

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

**Epik:** C · **Zależy od:** `0-05` · **Blokuje:** `C-02` · **Labels:** `data-pipeline`, `regime-c`

Baza z tury 1: **GEBCO 2024** (15″, okno = 5760 × 3360 komórek, min −739 m w Rowie Norweskim). Ulepszenia, gdy licencje zostaną potwierdzone: EMODnet DTM 2024 na dno, Copernicus DEM na ląd.

**Zakres**
- GEBCO 2024 jako baza dla całego okna.
- EMODnet Digital Bathymetry **DTM 2024** (1/16′ ≈ 115 m, 59 kafli) na dno Bałtyku, Cieśnin Duńskich i Kattegatu — po rozstrzygnięciu licencji (`0-03`).
- Przetwarzanie w **EPSG:3035** (ETRS89-LAEA, konwencja HELCOM), eksport w EPSG:4326.
- Kontrola wobec BSBD (BSHC) i IOWTOPO2.

**DoD**
- [ ] Mozaika bez szwów i dziur w całym oknie
- [ ] Raport pokrycia i rozdzielczości per źródło
- [ ] Udokumentowana metoda łączenia na linii brzegowej

**Plan:** §3.3, §4.1

## `C-02` Integrate great-lake bathymetry (Ladoga, Onega, Vänern, Vättern)

**Epik:** C · **Zależy od:** `C-01` · **Blokuje:** `C-03` · **Labels:** `data-pipeline`, `regime-c`

Batymetria wielkich jezior nie jest dodatkiem. **Vänern i Vättern leżą na trasie Rzeki Svea i korytarza Billingen**, Ładoga była częścią basenu w kilku fazach. Bez nich drenaży nie da się zamodelować — pipeline wygeneruje jeziora bez odpływu. **To jedyne dane na ścieżce krytycznej bez wskazanego zbioru** — źródła ustalić równolegle z M2.

**Zakres**
- Krajowe batymetrie jeziorne dla Ładogi, Onegi, Vänern, Vättern.
- Wtopienie w mozaikę `C-01` ze spójnym datum.

**DoD**
- [ ] Cztery batymetrie w mozaice
- [ ] Progi odpływowe widoczne w profilu wysokościowym
- [ ] Licencje per jezioro w `SOURCES.md`

**Plan:** §3.3

## `C-03` Compute GIA paleo-DEM frames

**Epik:** C · **Zależy od:** `0-02`, `0-06`, `C-02` · **Blokuje:** `C-04`, `V-02`, `V-03`, `V-08` · **Labels:** `data-pipeline`, `regime-c`, `blocker`

Obowiązuje formuła zależna od źródła (decyzja `0-02`):

```
H_paleo(x,y,t) = H_now(x,y) − RSL(x,y,t)               # Steffen & Kaufmann 2025, start
H_paleo(x,y,t) = H_now(x,y) + [Topo(t) − Topo(0)]       # ICE-6G_C / GLAC-1D, po zgodzie
```

**Bez osobnego członu eustatycznego.** Plan wejściowy podawał `+ ΔGIA − ΔEustatic`, co liczy eustatykę drugi raz — na dziesiątki metrów — bo zarówno RSL, jak i `Topo` są już wyrażone względem współczesnej sobie powierzchni morza. Znak przy `ΔGIA` był dodatkowo dwuznaczny.

Kontrola punktowa na danych z tury 1 (model `sk1`): Umeå ~282 m przy 11,3 ka (najwyższa linia brzegowa ~286 m); Gdańsk −25 m przy 8,9 ka i −14 m przy 7,8 ka.

**Zakres**
- Odczyt `RSL(time, lat, lon)` z `rsl_SK05_skan_<model>.nc` (1°, 19 nierównych kroków 21,4 ka → 0).
- Wybór wiodącego modelu Ziemi spośród 8 wariantów; pozostałe jako pas niepewności lub kontrola.
- Resampling 1° → siatka robocza, metoda udokumentowana.
- 41 klatek 20–0 ka co 500 lat + 6 przekrojów zdarzeniowych — interpolacja w czasie między krokami modelu.

**DoD**
- [ ] 41 klatek + 6 przekrojów zdarzeniowych z `datum: "contemporaneous-geoid"`
- [ ] Klatki poza krokami modelu z `dataQuality: "interpolated"`
- [ ] `gia.source` i `gia.earthModel` w każdej klatce
- [ ] Nazwa pliku i zmiennej GIA zapisana w `paleo-reconstruction-methodology.md`
- [ ] Zero wystąpień osobnego członu eustatycznego w kodzie

**Plan:** §0.1, §1, §4.1

## `C-04` Implement connectivity-aware water mask (flood-fill) for marine phases

**Epik:** C · **Zależy od:** `C-03` · **Blokuje:** `C-11`, `C-13`, `C-14` · **Labels:** `data-pipeline`, `regime-c`, `blocker`

Prosty próg `H < poziom` tworzy fałszywe jeziora w każdym zamkniętym obniżeniu terenu. Zbiornik musi być **hydrologicznie połączony z odpływem** — analiza spójnych składowych z zasiewem. Przy ~47 przekrojach to krok obowiązkowy, nie optymalizacja.

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

Rzędne progów **Närke i Billingen** brać z **SGU Strandförskjutningsmodell** — baza Rosentaua ma lukę właśnie w Szwecji. Jeśli `V-02` / `V-03` wykażą problem w fazach jeziornych, pierwszym podejrzanym jest ta część katalogu.

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

**Epik:** C · **Zależy od:** `0-05` · **Blokuje:** `C-11` · **Labels:** `data-pipeline`, `regime-c`

**DATED-1** (Hughes i in. 2016, CC BY 3.0) jako **geometria wiodąca** (wariant `mc`) i jednocześnie pas min. / maks. przeniesiony **do danych**, nie do opisu. Dane z tury 1: `DATED-1_TimeSlices_shp.zip`, 58 × `TS<ka>_{min,mc,max}.shp`.

**⛔ Stroeven i in. 2016** (izochrony 22,0–9,7 ka cal BP, gęstsze i dokładniejsze w niecce bałtyckiej) ma licencję **CC BY-NC-ND 4.0** — klauzula ND zakazuje publikacji uproszczonej, interpolowanej geometrii. Do czasu zgody autorów (`licensing-inquiries.md` #4) Stroeven jest **wyłącznie wewnętrzną kontrolą** w `validate.py`. Po zgodzie wchodzi jako geometria wiodąca, a DATED-1 zostaje pasem.

Grubość lodu (kopuła 2500–3000 m → 0 m na czole) tylko z ICE-6G_C lub GLAC-1D, czyli po zgodzie z `0-02`. Do tego czasu warstwa bez grubości.

Zasięg danych: DATED-1 kończy się na **10 ka**. Klatki młodsze nie mają lądolodu — `ice: null` (`0-06`), nie pusta geometria.

**DoD**
- [ ] Warstwa `ice` w każdej klatce ≥ 10 ka; `ice: null` w klatkach bez lądolodu
- [ ] `ice.interpolated: true` na każdej klatce interpolowanej między przekrojami DATED-1
- [ ] `ice.band: "dated1"` z geometrią min. / maks. (25–10 ka)
- [ ] `ice.source: "dated1"` do czasu zgody na Stroevena; zero geometrii Stroevena w `src/assets/data/`

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

Jednolite **500 lat dla całego 20–0 ka** (41 klatek). Plan wejściowy proponował 1000 lat dla 8–0 ka — odrzucone, bo transgresja littorynowa, formowanie mierzei i jezior przybrzeżnych mieszczą się właśnie w 8–0 ka.

Ten etap emituje klatki **faz morskich** (Yoldia, Mastogloia, Littorina, post-Littorina) plus przekroje zdarzeniowe littorynowe (początek ingresji, maksimum). To wystarcza do M3 — pierwszej działającej aplikacji. Fazy jeziorne i pozostałe przekroje to `C-15`.

**DoD**
- [ ] Klatki faz morskich w `frames/`, z kompletem pól kontraktu
- [ ] `dataQuality` w każdej klatce
- [ ] Zrealizowane w kolejności dziś → 8 ka, potem Yoldia (§6, Kolejność prac, p. 2)

**Plan:** §1, §2

## `C-12` curves.py — RSL sites and NKG uplift

**Epik:** C · **Zależy od:** `0-05` · **Blokuje:** `V-03`, `V-08` · **Labels:** `data-pipeline`, `regime-c`

Pliki w `curves/` pochodzące wprost ze źródeł — **nie zależą od paleo-DEM-u ani od licencji GIA**, więc mogą powstać zaraz po `0-05`:

| Plik | Źródło |
| :-- | :-- |
| `rsl-sites` | Rosentau i in. 2021 — 1099 wskaźników RSL, format HOLSEA, 3 klastry (regresja / transgresja / przejściowe) |
| `uplift-nkg` | NKG2016LU, Vestøl i in. 2019 — po rozstrzygnięciu licencji siatek (`0-03`) |

`basin-metrics` powstaje w `C-13`.

**DoD**
- [ ] Dwa pliki w `curves/`
- [ ] Klastry Rosentaua zachowane jako pole, nie spłaszczone
- [ ] Daty w cal yr BP, z oryginalną datą ¹⁴C tam, gdzie baza ją podaje

**Plan:** §3.2, §5

## `C-13` Compute basin metrics for every cross-section

**Epik:** C · **Zależy od:** `C-04`, `C-14` · **Labels:** `data-pipeline`, `regime-c`

**Metryki bilansowe** per przekrój (§4.2): powierzchnia (km²), objętość (km³), średnia i maksymalna głębokość, szacowany czas wymiany wód. Liczone z maski wody (`C-04`, `C-14`), nie z samego paleo-DEM-u. Niemal darmowe, a dają cztery dodatkowe krzywe i kontrolę sensowności.

**DoD**
- [ ] `curves/basin-metrics`
- [ ] `metrics` wypełnione w każdej klatce

**Plan:** §4.2, §5

## `C-14` Extend water mask to lake phases with sill-seeded outlets

**Epik:** C · **Zależy od:** `C-04`, `C-05`, `C-06` · **Blokuje:** `C-13`, `C-15`, `V-06` · **Labels:** `data-pipeline`, `regime-c`, `blocker`

Fazy jeziorne (BIL, Ancylus) i `deglaciation`: zasiew w **aktywnym progu** z `sills.json`, poziom z rzędnej progu (`C-06`). Rozstrzyganie przypadków z wieloma aktywnymi odpływami jednocześnie (np. Svea → Dana).

**DoD**
- [ ] Maska dla wszystkich przekrojów faz jeziornych i deglacjacji
- [ ] Raport: zero zbiorników bez połączenia z odpływem
- [ ] Test przypadku z dwoma aktywnymi odpływami

**Plan:** §0.3, §4.1

## `C-15` Emit lake-phase frames and remaining event cross-sections

**Epik:** C · **Zależy od:** `C-11`, `C-14` · **Blokuje:** `V-12` · **Labels:** `data-pipeline`, `regime-c`

Klatki faz `deglaciation`, `bil`, `ancylus` oraz przekroje zdarzeniowe: przed i po drenażu Billingen, maksimum ancylusowe, próg regresji ancylusowej. Razem z `C-11` daje komplet 47 klatek.

**DoD**
- [ ] 47 klatek w `frames/` łącznie z `C-11`
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

Wymaga **pola współczesnej prędkości wypiętrzania** z modelu GIA — to osobny produkt, nie `Topo` ani RSL; źródło ustalane w `0-02`. Przy samym Steffenie i Kaufmannie można je przybliżyć gradientem RSL między krokami 0,9 ka i 0 — z jawną adnotacją, że to przybliżenie.

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

Nałożenie klatek na mapy etapów z **Björcka 1995 / Andréna i in. 2011** dla 11,7 / 11,1 / 10,5 ka BP oraz na paleo-DEM-y z **ESD 16, 585 (2025)** — niezależną implementację tej samej metody (paleo-DEM-y co 500 lat na GEBCO_2023 z korektą ancylusową za Uścinowiczem, CC BY). ESD obejmuje tylko **11,7–0 ka** — dla BIL i deglacjacji zostają mapy Björcka / Andréna.

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

## `I-01` emit.py — TopoJSON, not rasters

**Epik:** I · **Zależy od:** `C-11` · **Blokuje:** `I-02`, `V-11` · **Labels:** `data-pipeline`, `contract`

Plan wejściowy proponował wystawić rastrowe „Paleo-DEM Time Slices / Delta Grids" jako artefakt runtime'owy. W zakresie 9–33°E / 53–67°N przy rozdzielczości EMODnet (~115 m) to siatka rzędu **20 000 × 15 000 komórek na przekrój** — przy ~47 przekrojach to nie jest aplikacja webowa.

Obowiązuje: warstwy `land` / `water` / `ice` / `lake` / `rivers` jako **kwantyzowany, uproszczony TopoJSON**; raster (hipsometria) tylko jako opcjonalny, leniwy chunk w obniżonej rozdzielczości. Eksport w EPSG:4326.

**DoD**
- [ ] Kwantyzacja i uproszczenie z parametrami w `manifest.json`
- [ ] Brak rastrów w ścieżce krytycznej ładowania
- [ ] `emit.py` sprawdza topologię po uproszczeniu lokalnie (bramka CI to `V-11`, które zależy od tego zadania)

**Plan:** §5

## `I-02` Wire src/assets/data into the app with lazy per-phase chunks

**Epik:** I · **Zależy od:** `I-01` · **Labels:** `app`

Katalog `src/assets/data/` jest objęty `assets` w `angular.json`. Chunki **per faza**, ładowane leniwie — na starcie wystarczy klatka bieżąca i jej sąsiedzi na osi czasu.

**Zakres**
- Serwis ładujący reaktywnie (sygnały), z mapą chunków z `manifest.json`.
- Kontrola `schemaVersion` przy starcie.
- Zgodność z układem HUD z `AGENTS.md` §2: suwak osi czasu 20 ka → 0 w dolnym docku (`.dock-wrap`, `app-timeline-slider` z markerami faz), przełącznik widoków (np. warstwy / zasolenie / lód) w prawym górnym (`app-dropdown align="right"`).

**DoD**
- [ ] Pierwsze wejście ładuje ≤ 4 MB
- [ ] Przewinięcie osi czasu do innej fazy dociąga chunk bez blokowania wizualizacji
- [ ] Niezgodny `schemaVersion` daje czytelny błąd, nie pustą scenę

**Plan:** §5

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
- [ ] Każda pozycja z `SOURCES.md` użyta w opublikowanych danych obecna w panelu z pełną atrybucją
- [ ] Każda karta zdarzenia linkuje do co najmniej jednego źródła
- [ ] Test: żadne `sources: []` w kontrakcie

**Plan:** §5, §9

---

# Niezależność i zależności

## Co można prowadzić równolegle

| Tor | Zadania | Warunek wejścia |
| :-- | :-- | :-- |
| **Fazy morskie** | `C-01` → `C-02` → `C-03` → `C-04` → `C-11` | `0-02` (ścieżka Steffena odblokowana), `0-06` |
| **Fazy jeziorne** | `C-05` → `C-06` → `C-14` → `C-15` → `C-13` | `C-05` startuje razem z `C-03` |
| **Lądolód** | `C-07` | tylko `0-05`; DATED-1 już pobrany |
| **Krzywe** | `C-12` | tylko `0-05`; nie zależy od paleo-DEM-u ani licencji GIA |
| **Dokumentacja** | `0-03`, `0-07` | nic — można pisać od pierwszego dnia |
| **i18n** | `I-03` | `0-06`; **musi startować najwcześniej**, nie najpóźniej |
| **CI** | `0-08` | `0-01`, `0-06` |
| **Batymetria jezior** | research źródeł do `C-02` | nic — jedyne dane na ścieżce krytycznej bez wskazanego zbioru |

## Co jest sztywno sekwencyjne

```
0-01 ──> 0-04 ──> 0-05 ──> C-01 ──> C-02 ──> C-03 ──> C-04 ──> C-11 ──> I-01 ──> I-02
                                               ▲        │        ▲
0-02 ──────────────────────────────────────────┤        │   C-07, C-08, C-10
0-06 ──────────────────────────────────────────┘        ▼
                                  C-05 ──> C-06 ──> C-14 ──> C-15
                                             └────> V-02
```

- `0-01` przed czymkolwiek — bez submodułu nie ma builda.
- `0-02` przed `C-03` — źródło GIA musi być wybrane i wpisane, zanim pochodne wejdą do repo.
- `0-06` przed każdą emisją klatek — `datum` jest w kontrakcie, nie w komentarzu.
- `C-05` przed `C-06`, `C-10` i `C-14` — flood-fill faz jeziornych potrzebuje zasiewu w progu, poziom jeziorny rzędnej progu, zasolenie stanów progów.
- `C-09` przed `C-08` — granice faz podaje się w cal yr BP, więc kalibracja jest wcześniej niż oś czasu.
- `V-01` przed resztą epiku V.
- `I-01` przed `I-02` i `V-11` — budżet 25/4 MB liczy się na wyjściu `emit.py`.

## Ryzyka sprzęgnięć

| Sprzęgnięcie | Dlaczego boli | Reakcja |
| :-- | :-- | :-- |
| `C-05` ↔ SGU | rzędne Närke i Billingen z SGU, gdzie baza Rosentaua ma lukę | jeśli `V-02`/`V-03` padną na fazach jeziornych, najpierw zweryfikować rzędne SGU |
| `C-05` vs kolejność z §6 | `C-10` i `C-14` potrzebują progów w kroku 2 | `C-05` w M2, w pakiecie z `C-03` |
| `I-03` vs cały content | karty bez równoległości EN/PL = przepisywanie | `content/{lang}/` od pierwszego commita |
| `0-02` vs start C | odmowa licencji ICE-6G_C / GLAC-1D | start na Steffenie i Kaufmannie (CC BY); podmiana źródła bez zmiany kontraktu |
| `C-07` ↔ Stroeven | ND zakazuje publikacji pochodnej geometrii | DATED-1 wiodący; Stroeven tylko w `validate.py` |

## Kamienie milowe

| | Kamień | Zadania | Bramka |
| :-- | :-- | :-- | :-- |
| **M1** | Pipeline stoi | `0-01`…`0-08` | `npm run data:build` przechodzi na puste wyjście, CI na PR-ach działa |
| **M2** | Dziś → 8 ka | `C-01`, `C-02`, `C-03`, `C-05`, `C-07`, `C-08`, `C-09` | paleo-DEM-y z `datum`, oś czasu w cal yr BP |
| **M3** | ★ **Pierwsza działająca aplikacja** | `C-04`, `C-10`, `C-11`, `I-01`, `I-02`, `I-03` | oś czasu klikalna dla faz morskich, ≤ 4 MB przy wejściu |
| **M4** | Fazy jeziorne | `C-06`, `C-14`, `C-15`, `C-13` | BIL i Ancylus z poziomem z progu, 47 klatek |
| **M5** | Walidacja ilościowa | `C-12`, `V-01`, `V-02`, `V-03`, `V-11` | sill-check zielony, RMSE w progu |
| **M6** | Domknięcie | `I-04`, `V-06`, `V-07`, `V-08`, `V-12` | panel źródeł, nakładki kontrolne |

**M3 jest celem, nie etapem.** Kolejność prac z §6 jest dobrana tak, by działająca aplikacja powstała **przed** ukończeniem całości — praca od końca ku początkowi istnieje właśnie po to. Dlatego maska wody i emisja są rozbite na etap morski (`C-04`, `C-11`) i jeziorny (`C-14`, `C-15`): M3 nie może zależeć od niczego z M4.
