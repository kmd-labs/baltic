# Baltic — backlog issues warstwy danych

> Rozpisanie [`baltic-data-plan.md`](./baltic-data-plan.md) na zadania wykonawcze.
> **7 epików / 49 zadań.** Tytuły po angielsku (spójne z commitami i publicznym repo `kmd-labs/baltic`), treść po polsku.
> Dokument żywy — aktualizowany razem z planem. Odsyłacze `§x.y` wskazują sekcje planu.

## Jak czytać

| Pole | Znaczenie |
| :-- | :-- |
| **ID** | `<epik>-<nr>`. Epiki: `0` fundamenty, `A` fanerozoik, `B` czwartorzęd, `C` postglacjał, `D` mikroskala, `V` walidacja, `I` integracja |
| **Zależy od** | zadania, które muszą być zamknięte, zanim to się zacznie |
| **Blokuje** | zadania czekające na to |
| **Labels** | proponowane etykiety GitHub |
| **DoD** | Definition of Done — warunek zamknięcia, weryfikowalny |

**Etykiety:** `blocker` · `licensing` · `data-pipeline` · `regime-a` · `regime-b` · `regime-c` · `regime-d` · `validation` · `contract` · `docs` · `i18n` · `app` · `ci`

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

Trzy rzeczy nieobejściowe: **`0-01`** (bez submodułu nie ma builda), **`0-02`** (bez potwierdzonej licencji ICE-6G_C pochodne nie wchodzą do repo, a to zasila `C-03`), **`0-06`** (bez obowiązkowego `datum` poprawka §0.2 pozostaje deklaracją).

## Epiki

| Epik | Nazwa | Zadań | Charakter |
| :-- | :-- | --: | :-- |
| **0** | Fundamenty i blokery | 8 | musi być pierwsze; dwa zadania to decyzje, nie kod |
| **C** | Reżim postglacjalny, 20–0 ka | 15 | rdzeń produktu, najlepsze dane; fazy morskie (M3) przed jeziornymi (M4) |
| **A** | Reżim fanerozoiczny, 541–2,6 Ma | 3 | w pełni niezależny pipeline |
| **D** | Mikroskala czterech wybrzeży | 6 | 4 zamknięte porcje; przerwanie po dowolnej zostawia spójny produkt |
| **B** | Reżim czwartorzędowy | 1 | treść redakcyjna, jawna luka danych |
| **V** | Walidacja | 12 | jedna bramka ilościowa (`V-03`), resztę da się liczyć wcześnie |
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

Warunki redystrybucji ICE-6G_C (VM5a) są nieznane. Pochodne tego modelu **nie mogą** wejść do repo przed potwierdzeniem — a cały reżim C stoi na jego polu `Topo`.

**Zakres**
- Ustalić warunki u źródła (`atmosp.physics.utoronto.ca/~peltier/data.php`), w razie potrzeby kontaktem.
- Jeśli negatywne lub bez odpowiedzi — fallback w kolejności: **GLAC-1D** → **ANU/Lambeck** → pochodne **SELEN** z ESD 16, 585 (2025, CC BY). **GLAC-1D i ANU też nie mają jawnej licencji** — weryfikować tak samo; jedyny fallback o znanej licencji to SELEN/ESD 2025.
- Ustalić przy okazji źródło **pola współczesnej prędkości wypiętrzania** z wybranego modelu (osobny produkt, nie `Topo`) — potrzebne do `V-08`.
- Decyzja zapisana z datą i treścią zgody/licencji.

**DoD**
- [ ] Wpis w `SOURCES.md`: model, licencja, data ustalenia, osoba
- [ ] Wybrany model wpisany jako wartość `ice.source` w kontrakcie
- [ ] Żadna pochodna GIA nie jest zacommitowana przed tym wpisem

**Plan:** §3.3, §8

## `0-03` Audit licences of all remaining sources, write SOURCES.md

**Epik:** 0 · **Blokuje:** `I-04` · **Labels:** `licensing`, `docs`

Prawie każdy zbiór w §3 to CC BY, co nakłada wymóg atrybucji — a atrybucja jest warunkiem legalności publikacji. Dwie pozycje mają status nierozstrzygnięty: **BSBD/BSHC** to CC BY 3.0 **z ograniczeniami**, **PhanDA** jest w planie oznaczony „do weryfikacji". Cztery krajowe DEM-y reżimu D mają osobne reżimy licencyjne.

**Zakres**
- Przegląd wszystkich pozycji z §3.1–3.4: licencja, wersja, format, DOI/URL.
- Gotowy tekst atrybucji per zbiór, dokładnie taki, jaki wymaga licencja.
- `SOURCES.md` jako jedyne źródło prawdy dla generowanego `sources.json`.

**DoD**
- [ ] `SOURCES.md` pokrywa 100% zbiorów z §3
- [ ] Zero pozycji ze statusem „do weryfikacji"
- [ ] Każda pozycja ma pełne cytowanie i tekst atrybucji

**Plan:** §3, §5, §9

## `0-04` Scaffold tools/data pipeline and npm run data:build

**Epik:** 0 · **Zależy od:** `0-01` · **Blokuje:** `0-05`, cały C / A / D · **Labels:** `data-pipeline`

**Zakres**
- Struktura z §6: `fetch.py`, `phanerozoic.py`, `postglacial.py`, `regional.py`, `curves.py`, `calibrate.py`, `validate.py`, `emit.py`.
- `data/raw/` i `data/interim/` w `.gitignore`; assety wyjściowe w gicie.
- Skrypt `data:build` w `package.json`, obok istniejącego `setup:github`.
- Stack: `xarray` + `rioxarray`, `rasterio`, `geopandas`, `shapely`, `pyogrio`, `gplately`/`pygplates`, `scipy.ndimage`, `pyproj`; `mapshaper`/`topojson` do uproszczenia.

**DoD**
- [ ] `npm run data:build` uruchamia pipeline end-to-end
- [ ] Pipeline **idempotentny** — powtórny run nie zmienia wyjścia
- [ ] Pipeline **offline po pierwszym pobraniu**
- [ ] Zamrożone wersje zależności (lock / requirements)

**Plan:** §6

## `0-05` fetch.py — DOI-keyed downloads with checksum verification

**Epik:** 0 · **Zależy od:** `0-04` · **Blokuje:** `C-01`, `C-07`, `C-12`, `A-01`, `D-01` · **Labels:** `data-pipeline`

**Zakres**
- Pobieranie po DOI / URL dla każdego zbioru z §3.
- Weryfikacja sum kontrolnych **przed** użyciem pliku; sumy trafiają do `manifest.json`.
- Cache w `data/raw/`, pomijanie już pobranych.

**DoD**
- [ ] Każdy zbiór z §3 pobieralny jednym wywołaniem
- [ ] Niezgodna suma kontrolna przerywa build z czytelnym komunikatem
- [ ] Powtórny run nie pobiera ponownie

**Plan:** §6

## `0-06` Define frame and manifest JSON contract with mandatory `datum`

**Epik:** 0 · **Blokuje:** każdą emisję klatek · **Labels:** `blocker`, `contract`

Kontrakt z §5: `schemaVersion`, `regime`, `tBP` / `tMa`, `t14C`, `calCurve`, **`datum`**, `stageId`, `water`, `salinity`, `ice`, `metrics`, `dataQuality`, `frame`, `sources`.

Pole `datum` jest obowiązkowe w manifeście **i w każdej klatce**. Powód jest ilościowy: poziomy faz jeziornych (+25 m BIL, +10 m Ancylus) jako skalary są poprawne **wyłącznie** względem geoidy współczesnej danemu *t*. Zalanie DEM-u w dzisiejszym układzie wysokościowym tą samą liczbą daje wynik jawnie fałszywy, bo rebound jest silnie zróżnicowany przestrzennie — **>285 m w Zatoce Botnickiej vs ~0 m na wybrzeżu Polski**.

**Zakres**
- JSON Schema dla klatki, manifestu, `timeline.json`, `sills.json`, `taxa.json`, `curves/*`.
- Fixture'y testowe (poprawne i celowo zepsute) obok schematu.
- `schemaVersion` z polityką wersjonowania.
- Enum `datum`: `contemporaneous-geoid` (reżim C), `EVRF2007` (reżim D — dzisiejszy układ wysokościowy), wartość dla reżimu A (PaleoDEM względem paleo-poziomu morza). Transformacja między `EVRF2007` a `contemporaneous-geoid` opisana w `0-07` — korzystają z niej `V-03`, `V-04`, `V-10`.
- `ice` może być `null` (brak lądolodu w klatce, np. 9,5–0 ka).

Egzekwowanie schematu w pipeline'ie to `V-01`, w CI — `0-08`.

**DoD**
- [ ] Schemat odrzuca fixture klatki bez `datum`
- [ ] Enum `datum` obejmuje reżimy A, C i D
- [ ] Enum `dataQuality` = `modelled | interpolated | qualitative`
- [ ] `ice: null` dopuszczalne, `ice: {}` bez `source` — nie

**Plan:** §0.2, §5

## `0-07` Write methodology and data-catalog docs

**Epik:** 0 · **Labels:** `docs`

Dwa artefakty z §9. `paleo-reconstruction-methodology.md` to specyfikacja matematyczna i geoprzestrzenna — **musi wskazywać konkretny plik i nazwę zmiennej** modelu GIA (`Topo`, `Topo_Diff`), nie pojęcie. To nie formalizm: plan wejściowy liczył eustatykę podwójnie **właśnie dlatego**, że formuła nie nazywała pola, które konsumuje.

`baltic-data-catalog.md` to raport z researchu: bezpośrednie linki, licencje, formaty, **tabela korelacji wiekowej** cal yr BP ↔ ¹⁴C BP ↔ BCE/CE dla wszystkich 7 faz, parametry liczbowe per przekrój, katalog współrzędnych punktów kluczowych.

**DoD**
- [ ] Formuła `H_paleo(x,y,t) = H_now(x,y) + [Topo(t) − Topo(0)]` z nazwami plików i zmiennych
- [ ] Jawnie zapisane, dlaczego **nie ma** osobnego członu eustatycznego
- [ ] Tabela korelacji kompletna dla 7 faz
- [ ] Odstępstwa źródeł od Andréna i in. 2011 wypisane, nie uśrednione
- [ ] Transformacja `EVRF2007` ↔ `contemporaneous-geoid` zapisana jako formuła z nazwami pól

**Plan:** §0.1, §9

## `0-08` Add PR CI workflow that validates committed data assets

**Epik:** 0 · **Zależy od:** `0-01`, `0-06` · **Blokuje:** `V-11` · **Labels:** `ci`, `blocker`

W repo jest tylko `deploy.yml` (push na `main`) i `sync-design-system.yml` — **nic nie uruchamia się na PR-ach**, a `0-06`, `V-01` i `V-11` zakładają bramki w CI. CI **nie może** uruchamiać `npm run data:build`: surowe dane są poza gitem (`data/raw/`), a pobranie wszystkich zbiorów z §3 w CI jest nierealne. CI waliduje więc **zacommitowane assety** w `src/assets/data/`, nie przelicza pipeline'u.

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

# EPIC C · Reżim postglacjalny, 20–0 ka

Rdzeń produktu. Kolejność wewnątrz epiku zgodna z §6 (Kolejność prac, p. 2): **od końca ku początkowi** — najpierw dziś → 8 ka (najlepsze dane), potem fazy jeziorne (najtrudniejsze, bo próg zamiast eustatyki). Dlatego maska wody i emisja są rozbite na dwa etapy: fazy morskie (`C-04`, `C-11` → M3) i fazy jeziorne (`C-14`, `C-15` → M4).

## `C-01` Build base topo-bathy mosaic for 9–33°E / 53–67°N

**Epik:** C · **Zależy od:** `0-05` · **Blokuje:** `C-02` · **Labels:** `data-pipeline`, `regime-c`

**Zakres**
- EMODnet Digital Bathymetry **DTM 2024** (1/16′ ≈ 115 m, 59 kafli) na dno Bałtyku, Cieśnin Duńskich i Kattegatu.
- Copernicus DEM / GEBCO 2024 na ląd wokół Bałtyku.
- Przetwarzanie w **EPSG:3035** (ETRS89-LAEA, konwencja HELCOM), eksport w EPSG:4326.
- Kontrola wobec BSBD (BSHC) i IOWTOPO2.

**DoD**
- [ ] Mozaika bez szwów i dziur w całym oknie
- [ ] Raport pokrycia i rozdzielczości per źródło
- [ ] Udokumentowana metoda łączenia na linii brzegowej

**Plan:** §3.3, §4.3

## `C-02` Integrate great-lake bathymetry (Ladoga, Onega, Vänern, Vättern)

**Epik:** C · **Zależy od:** `C-01` · **Blokuje:** `C-03` · **Labels:** `data-pipeline`, `regime-c`

Batymetria wielkich jezior nie jest dodatkiem. **Vänern i Vättern leżą na trasie Rzeki Svea i korytarza Billingen**, Ładoga była częścią basenu w kilku fazach. Bez nich drenaży nie da się zamodelować — pipeline wygeneruje jeziora bez odpływu.

**Zakres**
- Krajowe batymetrie jeziorne dla Ładogi, Onegi, Vänern, Vättern.
- Wtopienie w mozaikę `C-01` ze spójnym datum.

**DoD**
- [ ] Cztery batymetrie w mozaice
- [ ] Progi odpływowe widoczne w profilu wysokościowym
- [ ] Licencje per jezioro w `SOURCES.md`

**Plan:** §3.3

## `C-03` Compute GIA paleo-DEM frames

**Epik:** C · **Zależy od:** `0-02`, `0-06`, `C-02` · **Blokuje:** `C-04`, `V-02`, `V-03`, `V-05`, `V-08` · **Labels:** `data-pipeline`, `regime-c`, `blocker`

Obowiązuje formuła:

```
H_paleo(x,y,t) = H_now(x,y) + [Topo(t) − Topo(0)]
```

**Bez osobnego członu eustatycznego.** Plan wejściowy podawał `+ ΔGIA − ΔEustatic`, co liczy eustatykę drugi raz — na dziesiątki metrów — bo paleotopografia ICE-6G_C jest już podana względem współczesnej sobie powierzchni morza i zawiera składnik eustatyczny i geoidalny. Znak przy `ΔGIA` był dodatkowo dwuznaczny. Osobny człon RSL jest uprawniony **tylko** przy czystym polu odkształcenia sprężystego bez członu oceanicznego.

**Zakres**
- Odczyt `Topo` / `Topo_Diff` z netCDF 1° (122 ka → 0).
- Resampling 1° → siatka robocza, metoda udokumentowana.
- 41 klatek 20–0 ka co 500 lat.
- 6 przekrojów zdarzeniowych (np. 11 650 BP) wypada poza siatkę 500 lat modelu — interpolacja w czasie między sąsiednimi krokami `Topo`.

**DoD**
- [ ] 41 klatek + 6 przekrojów zdarzeniowych z `datum: "contemporaneous-geoid"`
- [ ] Przekroje zdarzeniowe z `dataQuality: "interpolated"`
- [ ] Nazwa pliku i zmiennej GIA zapisana w `paleo-reconstruction-methodology.md`
- [ ] Zero wystąpień osobnego członu eustatycznego w kodzie

**Plan:** §0.1, §4.3

## `C-04` Implement connectivity-aware water mask (flood-fill) for marine phases

**Epik:** C · **Zależy od:** `C-03` · **Blokuje:** `C-11`, `C-13`, `C-14` · **Labels:** `data-pipeline`, `regime-c`, `blocker`

Prosty próg `H < poziom` tworzy fałszywe jeziora w każdym zamkniętym obniżeniu terenu. Zbiornik musi być **hydrologicznie połączony z odpływem** — analiza spójnych składowych z zasiewem. Przy ~47 przekrojach × 4 regiony mikroskalowe to krok obowiązkowy, nie optymalizacja.

```python
water_mask(t) = flood_fill(paleo_dem(t), level(t), seed=active_outlet(t))
```

Ten etap obejmuje **fazy morskie** (Yoldia, Mastogloia, Littorina, post-Littorina, dziś): poziom z GIA, zasiew na otwartym oceanie (brzeg okna w Skagerraku/Kattegacie) — bez potrzeby katalogu progów. Fazy jeziorne to `C-14`.

**Zakres**
- `scipy.ndimage` — spójne składowe z zasiewem w komórce oceanicznej.
- API gotowe na zasiew w progu i wiele odpływów jednocześnie (`C-14`).

**DoD**
- [ ] Maska dla wszystkich przekrojów faz morskich
- [ ] Raport: zero zbiorników bez połączenia z odpływem
- [ ] Test regresyjny na zamkniętym obniżeniu (musi zostać suche)

**Plan:** §0.3, §4.3

## `C-05` Build sills.json — sill and strait catalogue

**Epik:** C · **Zależy od:** `0-06` · **Blokuje:** `C-06`, `C-10`, `C-14`, `D-03`, `D-04`, `V-02` · **Labels:** `contract`, `regime-c`, `blocker`

Katalog progów: współrzędne, rzędne progowe, okresy aktywności. **Billingen** (58,4°N 13,8°E), **Närke** (59,1°N 15,0°E), **Svea / Degerfors**, **Dana / Wielki Bełt**, **Darss**, **Drogden / Øresund**. Przesmyk karelsko-białomorski oznaczony jako *hipoteza historyczna, nie konsensus*.

> **Uwaga do kolejności z §6.** Plan umieszcza `sills.json` w kroku 3 („krzywe i katalogi"), ale `C-14` potrzebuje zasiewu w aktywnej cieśninie, `C-06` rzędnych progowych, a `C-10` stanów progów (zasolenie w klatkach M3). Ten plik powstaje **razem z `C-03`** (M2), nie po reżimie C.

**DoD**
- [ ] Każdy próg: współrzędne, rzędna, okresy aktywności, źródło
- [ ] Stan otwarty / zamknięty per faza dla wszystkich 7 faz
- [ ] Hipotezy oznaczone flagą, nie podane jako fakt

**Plan:** §3.3, §5

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

**Plan:** §2, §4.3

## `C-07` Assemble ice-sheet layer with uncertainty band

**Epik:** C · **Zależy od:** `0-05` · **Blokuje:** `C-11` · **Labels:** `data-pipeline`, `regime-c`

**Stroeven i in. 2016** (izochrony deglacjacji 22,0–9,7 ka cal BP) jako **geometria wiodąca** — gęstsze niż DATED-1 i dokładniejsze w niecce bałtyckiej, więc decyduje o momencie otwarcia Billingen. **DATED-1** (Hughes i in. 2016) jako pas min. / najbardziej prawdopodobny / maks. przeniesiony **do danych**, nie do opisu. Grubość z ICE-6G_C lub GLAC-1D: kopuła 2500–3000 m w centrum → 0 m na czole.

Zasięg danych jest ograniczony: Stroeven kończy się na **9,7 ka**, DATED-1 na **10 ka**. Klatki młodsze (~9,5–0 ka) nie mają lądolodu — `ice: null` (`0-06`), nie pusta geometria.

**DoD**
- [ ] Warstwa `ice` w każdej klatce reżimu C ≥ 10 ka; `ice: null` w klatkach bez lądolodu
- [ ] `ice.interpolated: true` na każdej klatce interpolowanej
- [ ] `ice.band: "dated1"` z geometrią min. / maks. tam, gdzie DATED-1 ma pokrycie (25–10 ka)
- [ ] `ice.source` zgodne z decyzją z `0-02`

**Plan:** §3.3, §4.3

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

**Epik:** C · **Zależy od:** `0-04` · **Blokuje:** `C-08`, `D-02`, `D-06` · **Labels:** `data-pipeline`, `regime-c`

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

**Plan:** §2, §3.3, §4.3

## `C-11` Emit marine-phase postglacial frames (today → 8 ka first)

**Epik:** C · **Zależy od:** `C-04`, `C-07`, `C-08`, `C-10` · **Blokuje:** `I-01`, `C-15` · **Labels:** `data-pipeline`, `regime-c`

Jednolite **500 lat dla całego 20–0 ka** (41 klatek). Plan wejściowy proponował 1000 lat dla 8–0 ka — odrzucone, bo transgresja littorynowa, formowanie mierzei i jezior przybrzeżnych mieszczą się właśnie w 8–0 ka.

Ten etap emituje klatki **faz morskich** (Yoldia, Mastogloia, Littorina, post-Littorina) plus przekroje zdarzeniowe littorynowe (początek ingresji, maksimum). To wystarcza do M3 — pierwszej działającej aplikacji. Fazy jeziorne i pozostałe przekroje to `C-15`.

**DoD**
- [ ] Klatki faz morskich w `frames/postglacial/`, z kompletem pól kontraktu
- [ ] `dataQuality` w każdej klatce
- [ ] Zrealizowane w kolejności dziś → 8 ka, potem Yoldia (§6, Kolejność prac, p. 2)

**Plan:** §1, §2

## `C-12` curves.py — RSL sites, GMST/CO₂, NKG uplift, LR04

**Epik:** C · **Zależy od:** `0-05` · **Blokuje:** `B-01`, `D-02`, `D-06`, `V-03`, `V-08` · **Labels:** `data-pipeline`, `regime-c`

Cztery pliki w `curves/` pochodzące wprost ze źródeł — **nie zależą od paleo-DEM-u ani od licencji GIA**, więc mogą powstać zaraz po `0-05`:

| Plik | Źródło |
| :-- | :-- |
| `rsl-sites` | Rosentau i in. 2021 — 1099 wskaźników RSL, format HOLSEA, 3 klastry (regresja / transgresja / przejściowe); uzupełniany przez `D-02`, `D-06` |
| `gmst-co2` | PhanDA, Judd i in. 2024 — percentyle 5/16/50/84/95 |
| `uplift-nkg` | NKG2016LU, Vestøl i in. 2019 |
| `lr04` | stos bentoniczny LR04, Lisiecki & Raymo 2005 |

PhanDA zaczyna się od **485 Ma** — dla 541–485 Ma reżimu A krzywej nie ma i ma to być widoczne w danych, nie zamaskowane.

**DoD**
- [ ] Cztery pliki w `curves/`
- [ ] Percentyle PhanDA zachowane, nie spłaszczone do mediany
- [ ] Luka 541–485 Ma w `gmst-co2` jawnie oznaczona

**Plan:** §3, §5

## `C-13` Compute basin metrics for every regime-C cross-section

**Epik:** C · **Zależy od:** `C-04`, `C-14` · **Labels:** `data-pipeline`, `regime-c`

**Metryki bilansowe** per przekrój (§4.4): powierzchnia (km²), objętość (km³), średnia i maksymalna głębokość, szacowany czas wymiany wód. Liczone z maski wody (`C-04`, `C-14`), nie z samego paleo-DEM-u. Niemal darmowe, a dają cztery dodatkowe krzywe i kontrolę sensowności.

Metryki reżimu A powstają w `A-02`, reżimu D w `regional.py` (`D-01`).

**DoD**
- [ ] `curves/basin-metrics`
- [ ] `metrics` wypełnione w każdej klatce reżimu C

**Plan:** §4.4, §5

## `C-14` Extend water mask to lake phases with sill-seeded outlets

**Epik:** C · **Zależy od:** `C-04`, `C-05`, `C-06` · **Blokuje:** `C-13`, `C-15`, `V-06` · **Labels:** `data-pipeline`, `regime-c`, `blocker`

Fazy jeziorne (BIL, Ancylus) i `deglaciation`: zasiew w **aktywnym progu** z `sills.json`, poziom z rzędnej progu (`C-06`). Rozstrzyganie przypadków z wieloma aktywnymi odpływami jednocześnie (np. Svea → Dana).

**DoD**
- [ ] Maska dla wszystkich przekrojów faz jeziornych i deglacjacji
- [ ] Raport: zero zbiorników bez połączenia z odpływem
- [ ] Test przypadku z dwoma aktywnymi odpływami

**Plan:** §0.3, §4.3

## `C-15` Emit lake-phase frames and remaining event cross-sections

**Epik:** C · **Zależy od:** `C-11`, `C-14` · **Blokuje:** `V-10`, `V-12` · **Labels:** `data-pipeline`, `regime-c`

Klatki faz `deglaciation`, `bil`, `ancylus` oraz przekroje zdarzeniowe: przed i po drenażu Billingen, maksimum ancylusowe, próg regresji ancylusowej. Razem z `C-11` daje komplet 47 klatek.

**DoD**
- [ ] 47 klatek w `frames/postglacial/` łącznie z `C-11`
- [ ] `water.type: "lake"` + `water.outlet` w każdej klatce fazy jeziornej
- [ ] `dataQuality` w każdej klatce

**Plan:** §1, §2

---

# EPIC A · Reżim fanerozoiczny, 541–2,6 Ma

W pełni niezależny pipeline — można prowadzić równolegle do całego C. Bałtyku w tym reżimie **nie ma**: to opowieść o kratonie Baltiki i basenie bałtyckim.

## `A-01` phanerozoic.py — reconstruct ROI by plate rotation, not a fixed window

**Epik:** A · **Zależy od:** `0-05` · **Blokuje:** `A-02` · **Labels:** `data-pipeline`, `regime-a`

Najczęstszy błąd przy głębokim czasie: wycięcie stałego okna lat/lon z globalnej siatki. **Baltika wędrowała** — w kambrze leżała na półkuli południowej — więc stałe okno pokazałoby inny fragment Ziemi.

**Zakres**
1. Poligon ROI (dzisiejsza misa + otaczający kraton), przypisany **plate ID** Baltiki.
2. Dla każdego kroku 5 Ma odwrotna rotacja ROI do pozycji paleo — pyGPlates / gplately lokalnie, GWS `gws.gplates.org` jako fallback.
3. Rotacje: **model PALEOMAP** (Scotese), GPlates 2.5 GeoData bundle — ten sam, w którego układzie liczone są PaleoDEM-y i PaleoCoastlines (`A-02`). Rotacja ROI innym modelem i wycinanie w układzie PALEOMAP dałoby niespójne położenie.
4. Merdith i in. 2021 (1000–0 Ma) jako **niezależna kontrola** trajektorii, nie źródło. Pierwotne zestawienie „Merdith 1000–410 + Müller i in. 2019" zostawiało lukę **410–250 Ma** (Müller 2019 obejmuje tylko 250–0 Ma).

**DoD**
- [ ] Trajektoria ROI dla wszystkich ~108 kroków w modelu PALEOMAP
- [ ] Udokumentowany plate ID Baltiki w modelu PALEOMAP
- [ ] Rozbieżność trajektorii PALEOMAP vs Merdith 2021 raportowana per krok
- [ ] Fallback na GWS przetestowany

**Plan:** §3.1, §4.1

## `A-02` Clip PaleoDEM and PaleoCoastlines per 5 Ma step

**Epik:** A · **Zależy od:** `A-01`, `0-06` · **Blokuje:** `V-09` · **Labels:** `data-pipeline`, `regime-a`

PALEOMAP PaleoDEMs (Scotese & Wright 2018, 117 siatek, netCDF 0,1°) + PaleoCoastlines v7 (Kocsis & Scotese 2020, krawędź szelfu = izobata −1400 m) dla **tych samych kroków** — spójne, bo liczone z tych samych DEM-ów.

Metryki na klatkę: paleoszerokość centroidu, udział powierzchni zalanej, średnia głębokość.

**DoD**
- [ ] ~108 klatek w `frames/phanerozoic/`
- [ ] `tMa` zamiast `tBP`, `regime: "phanerozoic"`
- [ ] EPSG:4326
- [ ] Trzy metryki w każdej klatce

**Plan:** §3.1, §4.1

## `A-03` Author regime-A event cards by hand

**Epik:** A · **Zależy od:** `0-03` · **Labels:** `regime-a`, `docs`

Zdarzenia kamieniste opisane ręcznie z cytowaniami, **nie generowane**: Morze Tornquista i Iapetus, kambryjsko-sylurska pokrywa epikontynentalna, orogeneza kaledońska (~430–400 Ma, Baltika + Laurencja → Laurussia), dewoński Old Red, permski Zechstein, subsydencja i inwersja bruzdy śródpolskiej, kenozoiczne wypiętrzenie Fennoskandii.

**Uczciwość w tym reżimie jest wymogiem, nie ozdobą.** Pokazujemy region, nie morze — nazwa „Bałtyk" przed ~1 Ma jest anachronizmem.

**DoD**
- [ ] Karty w `events.json` z odsyłaczami do `sources.json`
- [ ] Zero wystąpień „Bałtyk" / „Baltic Sea" w treści reżimu A
- [ ] Każda karta w EN i PL (`I-03`)

**Plan:** §3.1, §1

---

# EPIC B · Reżim czwartorzędowy, 2,6 Ma – 20 ka

## `B-01` Ship regime B as an explicit data gap, not fake frames

**Epik:** B · **Zależy od:** `0-06`, `C-12` · **Labels:** `regime-b`, `docs`

**Luka danych** — brak rekonstrukcji GIS w tej rozdzielczości. Bez klatek paleogeograficznych. Produkt: 8–12 kart + krzywa LR04 + 2–3 mapy schematyczne.

| Treść | Źródło |
| :-- | :-- |
| Cykle glacjalne δ¹⁸O | stos bentoniczny LR04 — jedyna gęsta, ciągła krzywa dla tego reżimu |
| Geneza misy bałtyckiej | GFF 2020, `10.1080/11035897.2020.1781246` — erozja ost. 1 Ma: ~20 m w podłożu krystalicznym, ~40 m w osadowym; Rynna Landsort 459 m (strop skalny 518 m) |
| Morze Eemskie (~130–115 ka) | Gibbard i in. 2026, *Boreas* `10.1111/bor.70040`; EGQSJ 73, 217 (2024) dla SW Bałtyku — mapy schematyczne, brak warstw GIS |
| System rzeczny Eridanos (12 Ma → ~1 Ma) | literatura o delcie Eridanos — **najlepszy pomost narracyjny A→C**: rzeka drenująca tarczę przez dzisiejszą misę, zanik ~1 Ma, gdy lądolody wyorały misę |

**DoD**
- [ ] `regime: "quaternary"` i `dataQuality: "qualitative"` na każdej karcie
- [ ] **Zero** klatek paleogeograficznych w tym reżimie
- [ ] Niedobór danych widoczny w UI, nie tylko w kontrakcie

**Plan:** §1, §3.2, §4.2

---

# EPIC D · Mikroskala czterech wybrzeży

**Granica metodyczna.** Model GIA ma siatkę 1°×1°, krajowy LiDAR ma 1 m. Downscaling linii brzegowej sterowanej GIA do rozdzielczości metrowej byłby pozorną precyzją. Reżim D jest **zestawem osobnych wstawek** napędzanych krajowymi rekonstrukcjami i krzywymi RSL — nie zagęszczeniem reżimu C. Klatki tylko dla faz, w których historia regionu się zmienia (~10 na region), nie wszystkie 41.

Kolejność **PL → DK → SE → EE** (malejąca dostępność gotowych rekonstrukcji). Każdy region to zamknięta porcja pracy — można przerwać po dowolnym.

## `D-01` regional.py — harmonise four height datums to EVRF2007

**Epik:** D · **Zależy od:** `0-04`, `0-05` · **Blokuje:** `D-02`…`D-05`, `V-10` · **Labels:** `data-pipeline`, `regime-d`, `blocker`

Łatwy do przeoczenia blocker. Cztery kraje, cztery układy wysokościowe (**PL-EVRF2007-NH, RH 2000, EH2000, DVR90**) i cztery CRS (**EPSG:2180, 3006, 3301, 25832**). Wszystko musi przejść na **EVRF2007 / EVRS** przed jakimkolwiek porównaniem z wyjściem modelu GIA. Rozbieżności między datami to dziesiątki centymetrów — przy rekonstrukcji wybrzeża płaskiego, jak polskie, to **metry linii brzegowej**.

**DoD**
- [ ] Transformacje `pyproj` udokumentowane per kraj, z wersją siatki
- [ ] Klatki regionalne z `datum: "EVRF2007"` (`0-06`)
- [ ] `regional.py` liczy `metrics` (§4.4) dla każdej klatki regionalnej
- [ ] ~10 klatek na region, nie 41

Test spójności szwów (`V-10`) jest diagnostyką tego zadania, ale wymaga gotowych regionów — zamyka się w M7.

**Plan:** §3.4

## `D-02` Region PL — Polish coast

**Epik:** D · **Zależy od:** `D-01`, `C-09`, `C-12` · **Blokuje:** `D-06`, `V-04`, `V-10` · **Labels:** `regime-d`

| | |
| :-- | :-- |
| **DEM** | GUGiK NMT z LiDAR (ISOK), 1 m / 5 m |
| **Paleogeografia i RSL** | Uścinowicz 2003, 2006, 2014; Sydor & Uścinowicz 2022 (Zalew Szczeciński, Zatoka Pomorska); PIG-PIB |
| **CRS / datum** | EPSG:2180 / PL-EVRF2007-NH |

**Formy do odwzorowania:** Ławica Słupska i Odrzańska, Mierzeja Helska i Wiślana, Zalew Szczeciński, Łebsko i Gardno.

**DoD**
- [ ] ~10 klatek w `frames/regional/pl/`
- [ ] Wszystkie formy z listy obecne w co najmniej jednej klatce
- [ ] Krzywa RSL dla polskiego brzegu w `curves/rsl-sites`

**Plan:** §3.4

## `D-03` Region DK — Danish straits

**Epik:** D · **Zależy od:** `D-01`, `C-05` · **Blokuje:** `V-10` · **Labels:** `regime-d`

| | |
| :-- | :-- |
| **DEM** | DHM/Terræn (SDFI Dataforsyningen), 0,4 m |
| **Paleogeografia i RSL** | Bennike & Jensen; GEUS — Cieśniny Duńskie |
| **CRS / datum** | EPSG:25832 / DVR90 |

**Formy:** otwieranie Wielkiego Bełtu i Øresundu.

**DoD**
- [ ] ~10 klatek w `frames/regional/dk/`
- [ ] Momenty otwarcia progów spójne z `sills.json` (`C-05`)

**Plan:** §3.4

## `D-04` Region SE — Swedish coast and Billingen corridor

**Epik:** D · **Zależy od:** `D-01`, `C-05` · **Blokuje:** `V-10` · **Labels:** `regime-d`

| | |
| :-- | :-- |
| **DEM** | Lantmäteriet GSD-Höjddata, 2 m |
| **Paleogeografia i RSL** | SGU Strandförskjutningsmodell; Påsse & Andersson |
| **CRS / datum** | EPSG:3006 / RH 2000 |

**Formy:** wynurzanie szkierów, Höga Kusten.

> **Ten region zasila reżim C.** SGU Strandförskjutningsmodell obejmuje Cieśninę Närke i korytarz Billingen — a luka bazy Rosentaua jest właśnie w Szwecji. Kolejność PL → DK → SE → EE jest słuszna pod kątem dostępności rekonstrukcji, ale jeśli `V-02` / `V-03` wykażą problem w fazach jeziornych, **SE trzeba podciągnąć do przodu**.

**DoD**
- [ ] ~10 klatek w `frames/regional/se/`
- [ ] Rzędne progów Närke i Billingen z SGU przeniesione do `sills.json`

**Plan:** §3.3, §3.4

## `D-05` Region EE — Estonian coast

**Epik:** D · **Zależy od:** `D-01` · **Blokuje:** `V-10` · **Labels:** `regime-d`

| | |
| :-- | :-- |
| **DEM** | Maa-amet LiDAR DEM, 1 m / 5 m |
| **Paleogeografia i RSL** | rekonstrukcje Rosentaua i zespołu z Tartu (SW Estonia, Pärnu) |
| **CRS / datum** | EPSG:3301 / EH2000 |

**Formy:** Zatoka Pärnu, Sõrve.

**DoD**
- [ ] ~10 klatek w `frames/regional/ee/`
- [ ] Spójność z punktami RSL Rosentaua dla SW Estonii

**Plan:** §3.4

## `D-06` Submerged relict forests as RSL control points

**Epik:** D · **Zależy od:** `D-02`, `C-09`, `C-12` · **Blokuje:** `V-05` · **Labels:** `regime-d`, `validation`

Pnie sosen i dębów **in situ** na 15–30 m w rejonie Czołpina, Rowów, Zatoki Gdańskiej i Puckiej, datowane ¹⁴C na **10 500–8 500 cal BP**. Pełnią **podwójną rolę**: są treścią narracyjną i jednocześnie **punktowymi wskaźnikami RSL** do walidacji paleo-DEM-u.

To jedyny element „człowiek i środowisko", który wchodzi do zakresu — i wchodzi jako dane walidacyjne. Baza SPLASHCOS jako punkt wejścia (projekt SUBLAND — dostępność do weryfikacji).

**DoD**
- [ ] Punkty z datowaniem, głębokością i źródłem w `curves/rsl-sites`
- [ ] Daty skalibrowane IntCal20 (`C-09`)
- [ ] Zasila test `V-05`

**Plan:** §3.4

---

# EPIC V · Walidacja

`tools/data/validate.py` produkuje raport i **kończy się błędem** przy przekroczeniu progów.

## `V-01` validate.py skeleton and CI gate

**Epik:** V · **Zależy od:** `0-04`, `0-06` · **Blokuje:** `V-02`…`V-12` · **Labels:** `validation`, `ci`

**DoD**
- [ ] Rejestr testów z progami, uruchamiany z `npm run data:build`
- [ ] Raport w czytelnej formie (tabela per test, per reżim)
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

Policzony poziom w punktach bazy Rosentau i in. 2021 (1099 wskaźników, GFZ `10.5880/GFZ.1.3.2020.003`) vs wartości zmierzone. RSL jest wyrażony względem dzisiejszego lokalnego poziomu, a paleo-DEM względem geoidy współczesnej *t* — porównanie wymaga transformacji z `0-07`. **RMSE raportowane per region**, osobno dla trzech klastrów bazy: regresja / transgresja / przejściowe.

> **To jedyna ilościowa walidacja w całym planie.** Bez niej zostaje „zgodność z syntezami".

**DoD**
- [ ] RMSE per region × per klaster w raporcie
- [ ] Ustalony i uzasadniony próg akceptacji
- [ ] Rozkład reszt, nie tylko liczba zbiorcza

**Plan:** §7

## `V-04` Polish coast curve versus Uścinowicz

**Epik:** V · **Zależy od:** `V-01`, `D-02` · **Labels:** `validation`

Oczekiwane: **trzy wahania o amplitudzie 25–27 m** między 13,0 i 8,5 ka BP, poziom **~−28 m** przy trwałym połączeniu z oceanem w ~8,5 ka BP, **~−10 m** w 7,0 ka BP.

**DoD**
- [ ] Trzy wahania odtworzone z amplitudą w tolerancji
- [ ] Dwa punkty kontrolne (−28 m / 8,5 ka, −10 m / 7,0 ka) zaliczone

**Plan:** §7

## `V-05` Submerged forests as control points

**Epik:** V · **Zależy od:** `V-01`, `C-03`, `D-06` · **Labels:** `validation`

Dla każdego datowanego pnia in situ: paleo-DEM w tym punkcie i czasie musi dawać powierzchnię **powyżej** poziomu wody. **Pień rosnący pod wodą oznacza błąd modelu.**

**DoD**
- [ ] Test dla wszystkich punktów z `D-06`
- [ ] Status `blocking` — to warunek zero-jedynkowy, nie statystyczny

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

**Plan:** §3.3, §7, §2

## `V-08` Present-day uplift gradient versus NKG2016LU

**Epik:** V · **Zależy od:** `V-01`, `C-03`, `C-12` · **Labels:** `validation`

Wymaga **pola współczesnej prędkości wypiętrzania** z modelu GIA — to osobny produkt, nie `Topo`; źródło ustalane w `0-02`.

Gradient z modelu GIA vs NKG2016LU: maks. **~10,3 mm/rok przy Umeå**, **linia zerowa na wybrzeżu Niemiec i Polski**.

**DoD**
- [ ] Oba punkty kontrolne zaliczone z tolerancją
- [ ] Mapa reszt gradientu w raporcie

**Plan:** §7

## `V-09` Regime A sanity check

**Epik:** V · **Zależy od:** `V-01`, `A-02` · **Labels:** `validation`, `regime-a`

- Paleoszerokość centroidu ROI vs dane paleomagnetyczne dla Baltiki.
- Linia brzegowa z PaleoCoastlines spójna z izobatą 0 m z PaleoDEM.

**DoD**
- [ ] Krzywa paleoszerokości w tolerancji wobec paleomagnetyki
- [ ] Rozbieżność linia brzegowa vs izobata 0 m raportowana per krok

**Plan:** §7

## `V-10` Regime D seam consistency

**Epik:** V · **Zależy od:** `V-01`, `D-01`, `D-02`, `D-03`, `D-04`, `D-05`, `C-15` · **Labels:** `validation`, `regime-d`

Linia brzegowa wstawki krajowej na granicy z reżimem C nie może odbiegać bardziej niż o uzgodnioną tolerancję. **Rozjazd oznacza niezharmonizowany datum wysokościowy** — ten test jest diagnostyką `D-01`.

**DoD**
- [ ] Test dla każdego z czterech regionów
- [ ] Tolerancja ustalona i uzasadniona
- [ ] Komunikat błędu wskazuje na datum, nie na geometrię

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
- [ ] Raport rozmiaru per chunk per reżim

**Plan:** §5, §7

## `V-12` Visual overlay control

**Epik:** V · **Zależy od:** `V-01`, `C-08`, `C-15` · **Labels:** `validation`

Nałożenie klatek na mapy etapów z **Björcka 1995 / Andréna i in. 2011** dla 11,7 / 11,1 / 10,5 ka BP oraz na paleo-DEM-y z **ESD 16, 585 (2025)** — niezależną implementację tej samej metody (paleo-DEM-y co 500 lat na GEBCO_2023 z korektą ancylusową za Uścinowiczem, CC BY).

> Skoro ESD 2025 to ta sama metoda liczona niezależnie, **rozbieżność linii brzegowej większa niż kilka kilometrów oznacza błąd u nas.**

**Ukryta praca:** mapy Björcka / Andréna istnieją tylko jako rysunki — pomiar liczbowy wymaga ich **georeferencji i cyfryzacji linii brzegowej** (z udokumentowanym błędem georeferencji).

**DoD**
- [ ] Zgeoreferowane i zdigitalizowane linie brzegowe Björcka / Andréna dla 11,7 / 11,1 / 10,5 ka
- [ ] Nakładki dla trzech przekrojów kontrolnych
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

## `I-02` Wire src/assets/data into the app with lazy per-regime chunks

**Epik:** I · **Zależy od:** `I-01` · **Labels:** `app`

Katalog `src/assets/data/` jest objęty `assets` w `angular.json:23`. Chunki **per reżim i per region**, ładowane leniwie — nikt nie potrzebuje 108 klatek fanerozoiku ani czterech wybrzeży na starcie.

**Zakres**
- Serwis ładujący reaktywnie (sygnały), z mapą chunków z `manifest.json`.
- Kontrola `schemaVersion` przy starcie.
- Zgodność z układem HUD z `AGENTS.md` §2: kontrolki osi czasu w dolnym docku (`.dock-wrap`), przełącznik reżimów w prawym górnym (`app-dropdown align="right"`).

**DoD**
- [ ] Pierwsze wejście ładuje ≤ 4 MB
- [ ] Przełączenie reżimu dociąga chunk bez blokowania wizualizacji
- [ ] Niezgodny `schemaVersion` daje czytelny błąd, nie pustą scenę

**Plan:** §5

## `I-03` i18n — ids in data, long-form content in assets/content/{en,pl}

**Epik:** I · **Zależy od:** `0-06` · **Labels:** `i18n`, `blocker`

`AGENTS.md` wymaga **zera zahardkodowanych stringów** i równoległości EN/PL, ale ~150 kart zdarzeń, progów i taksonów rozsadziłoby `en.ts` / `pl.ts`.

Obowiązuje: **dane noszą wyłącznie identyfikatory**. Chrome UI zostaje w `Dict` — najpierw `i18n.types.ts` (żeby TypeScript wymusił kompletność), potem `en.ts` i `pl.ts` **jednocześnie**, rozszerzone o klucze faz i warstw. Długie teksty idą do `src/assets/content/{en,pl}/*.json`, ładowane reaktywnie na podstawie sygnału `lang` z `I18nService`. Litera reguły zachowana, słowniki nie puchną.

> **`content/{lang}/` od pierwszego commita, nie na końcu.** Dorabianie równoległości EN/PL po napisaniu 150 kart to przepisywanie, nie uzupełnianie.

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
- [ ] Każda pozycja z `SOURCES.md` obecna w panelu z pełną atrybucją
- [ ] Każda karta zdarzenia linkuje do co najmniej jednego źródła
- [ ] Test: żadne `sources: []` w kontrakcie

**Plan:** §5, §9

---

# Niezależność i zależności

## Co można prowadzić równolegle

| Tor | Zadania | Warunek wejścia |
| :-- | :-- | :-- |
| **Reżim A** | `A-01` → `A-02` → `A-03` | tylko `0-05`; całkowicie rozłączny z C i D |
| **Reżim C — fazy morskie** | `C-01` → `C-02` → `C-03` → `C-04` → `C-11` | `0-02`, `0-06` |
| **Reżim C — fazy jeziorne** | `C-05` → `C-06` → `C-14` → `C-15` → `C-13` | `C-05` startuje razem z `C-03` |
| **Krzywe** | `C-12` | tylko `0-05`; nie zależy od paleo-DEM-u ani licencji GIA |
| **Mikroskala** | `D-01` → {`D-02` ‖ `D-03` ‖ `D-04` ‖ `D-05`} | `D-01`; cztery regiony wzajemnie niezależne |
| **Dokumentacja** | `0-03`, `0-07`, `A-03` | nic — można pisać od pierwszego dnia |
| **i18n** | `I-03` | `0-06`; **musi startować najwcześniej**, nie najpóźniej |
| **CI** | `0-08` | `0-01`, `0-06` |

Cztery regiony `D-02`…`D-05` są wzajemnie niezależne i każdy jest zamkniętą porcją — przerwanie po dowolnym zostawia spójny produkt. To jedyne miejsce w planie, gdzie można bezkarnie zatrzymać prace w połowie.

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
- `0-02` przed `C-03` — bez licencji pochodne GIA nie wchodzą do repo.
- `0-06` przed każdą emisją klatek — `datum` jest w kontrakcie, nie w komentarzu.
- `C-05` przed `C-06`, `C-10` i `C-14` — flood-fill faz jeziornych potrzebuje zasiewu w progu, poziom jeziorny rzędnej progu, zasolenie stanów progów.
- `C-09` przed `C-08` — granice faz podaje się w cal yr BP, więc kalibracja jest wcześniej niż oś czasu.
- `V-01` przed resztą epiku V.
- `I-01` przed `I-02` i `V-11` — budżet 25/4 MB liczy się na wyjściu `emit.py`.

## Ryzyka sprzęgnięć

| Sprzęgnięcie | Dlaczego boli | Reakcja |
| :-- | :-- | :-- |
| `D-04` (Szwecja) ↔ `C-05`/`C-06` | SGU pokrywa Närke i Billingen, gdzie baza Rosentaua ma lukę | jeśli `V-02`/`V-03` padną na fazach jeziornych, podciągnąć SE przed DK |
| `C-05` vs kolejność z §6 | plan stawia `sills.json` w kroku 3, ale `C-10` i `C-14` go potrzebują w kroku 2 | `C-05` w M2, w pakiecie z `C-03` |
| `A-01` ↔ `A-02` | rotacje innym modelem niż układ PaleoDEM-ów dają przesunięte położenie | rotacje PALEOMAP; Merdith 2021 tylko jako kontrola |
| `I-03` vs cały content | 150 kart bez równoległości EN/PL = przepisywanie | `content/{lang}/` od pierwszego commita |
| `0-02` vs start reżimu C | odmowa licencji przerywa `C-03` w połowie | fallback wybrany **przed** startem C, nie po |

## Kamienie milowe

| | Kamień | Zadania | Bramka |
| :-- | :-- | :-- | :-- |
| **M1** | Pipeline stoi | `0-01`…`0-08` | `npm run data:build` przechodzi na puste wyjście, CI na PR-ach działa |
| **M2** | Dziś → 8 ka | `C-01`, `C-02`, `C-03`, `C-05`, `C-07`, `C-08`, `C-09` | paleo-DEM-y z `datum`, oś czasu w cal yr BP |
| **M3** | ★ **Pierwsza działająca aplikacja** | `C-04`, `C-10`, `C-11`, `I-01`, `I-02`, `I-03` | oś czasu klikalna dla faz morskich, ≤ 4 MB przy wejściu |
| **M4** | Fazy jeziorne | `C-06`, `C-14`, `C-15`, `C-13` | BIL i Ancylus z poziomem z progu, 47 klatek |
| **M5** | Walidacja ilościowa | `C-12`, `V-01`, `V-02`, `V-03`, `V-11` | sill-check zielony, RMSE w progu |
| **M6** | Fanerozoik | `A-01`…`A-03`, `V-09` | 108 klatek, zero „Bałtyku" przed 1 Ma |
| **M7** | Cztery wybrzeża | `D-01`…`D-06`, `V-04`, `V-05`, `V-10` | szwy w tolerancji, lasy nad wodą |
| **M8** | Domknięcie | `B-01`, `I-04`, `V-06`…`V-08`, `V-12` | panel źródeł, nakładki kontrolne |

**M3 jest celem, nie etapem.** Kolejność prac z §6 jest dobrana tak, by działająca aplikacja powstała **przed** ukończeniem całości — reżim C od końca ku początkowi istnieje właśnie po to. Dlatego maska wody i emisja są rozbite na etap morski (`C-04`, `C-11`) i jeziorny (`C-14`, `C-15`): M3 nie może zależeć od niczego z M4.

