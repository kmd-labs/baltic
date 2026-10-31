# SOURCES

Rejestr wszystkich zbiorów danych i publikacji, z których korzysta warstwa danych Bałtyku. **Jedyne źródło prawdy** dla generowanego `src/assets/data/sources.json` (`I-04`) i warunek legalności publikacji (`0-03`).

Zasada: **wpis powstaje razem z pobraniem zbioru** (`fetch.py`, `0-05`), nie na końcu. Zbioru bez wpisu nie wolno użyć w pipeline'ie; zbioru ze statusem ⛔ lub ❓ nie wolno opublikować w żadnej postaci pochodnej.

## Status

| | Znaczenie | Publikacja pochodnych |
| :-: | :-- | :-- |
| ✅ | licencja zweryfikowana u źródła, wpis kompletny | dozwolona z atrybucją |
| ⚠️ | licencja znana, ale z ograniczeniem wpływającym na projekt | tylko w zakresie opisanym w uwagach |
| ❓ | licencja nieustalona albo niezweryfikowana | **zakazana** do czasu rozstrzygnięcia |
| ⛔ | licencja wyklucza planowane użycie | **zakazana** bez zgody autorów |

## Pola wpisu

`id` — klucz w `sources.json` i w polu `sources[]` klatek · **Zbiór** · **DOI / URL** · **Licencja** · **Weryfikacja** (data, gdzie sprawdzono) · **Atrybucja** (tekst wymagany przez licencję) · **Uwagi** (ograniczenia, wersja, wpływ na zadania).

Daty weryfikacji w formacie ISO. „DataCite” oznacza pole `rightsList` w metadanych DOI (`api.datacite.org`).

---

## Decyzja licencyjna modelu GIA (`0-02`)

**Stan na 2026-10-30: nierozstrzygnięta. Żadna pochodna GIA nie może wejść do repo.**

Żaden z trzech kandydatów nie ma licencji — jest wyłącznie prośba o cytowanie. Brak licencji oznacza brak zgody na redystrybucję, także pochodnych. Wysłane zapytania i odpowiedzi: [`docs/research/licensing-inquiries.md`](docs/research/licensing-inquiries.md).

| Kandydat | Co faktycznie jest dostępne | Licencja | Ocena |
| :-- | :-- | :-- | :-- |
| **ICE-6G_C (VM5a)** | PMIP4: 48 plików `I6_C.VM5a_10min.<t>.nc`, siatka **10′** (nie 1°, jak zakłada plan), zmienne `Topo`, `Orog`, `sftlf`, `sftgif`; 0–21 ka co 500 lat, dalej co 1000 lat do 26 ka. Strona Peltiera dodatkowo: pola współczesnych prędkości (dsea/dt, przemieszczenie radialne) 1° i 0,2° — potrzebne do `V-08` | ❓ brak; prośba o cytowanie Argus i in. 2014 + Peltier i in. 2015 | wybór pierwszy merytorycznie, wymaga zgody |
| **GLAC-1D** | PMIP4: `TOPicemsk.GLACD26kN9894GE90227A6005GGrBgic.nc`, siatka 0,5°, 26 ka → 0 **co 100 lat**; `HDC` = wysokość względem współczesnego sobie poziomu morza (ta sama semantyka co `Topo`), `ICEM` = maska lodu | ❓ brak; prośba o cytowanie 5 prac | technicznie atrakcyjny: krok 100 lat usuwa interpolację przekrojów zdarzeniowych w `C-03`; wymaga zgody |
| **ANU-ICE (Lambeck)** | brak publicznej dystrybucji siatek topografii | ❓ brak | tylko przez kontakt |
| **Steffen & Kaufmann 2025 (ANU-ICE / ICE-5G → RSL)** | Zenodo: pola **RSL** względem 1950, 1°, 10°W–70°E / 45–85°N, 21,4 ka, 19 kroków, 8 modeli Ziemi (`rsl_SK05_skan_*.nc`, ~2 MB) | ✅ CC BY 4.0 | **jedyna ścieżka z czystą licencją na pełny zakres 20–0 ka**; paleo-DEM jako `H_now − RSL(t)` (RSL zawiera człon eustatyczny i geoidalny, więc §0.1 nie jest naruszony); wada: krok ~1 ka i starsza wersja ANU-ICE (1998) |
| **ESD 16, 585 (2025)** | paleo-DEM-y 0,01° w suplemencie artykułu, 9,5–31°E / 52–66,5°N | ✅ CC BY 4.0 (artykuł i suplement) | **nie jest pełnym fallbackiem**: obejmuje tylko **11,7–0 ka** (brak BIL i deglacjacji), a SELEN jest napędzany ICE-5G Peltiera; zostaje jako kontrola w `V-12` |

**Kolejność fallbacku** (przyjęta w `0-02`): ICE-6G_C → GLAC-1D → **Steffen & Kaufmann 2025 (CC BY, bez czekania na odpowiedź)** → ESD 2025 tylko dla 11,7–0 ka. ANU-ICE w postaci siatek topografii wypada — jego licencjonowana pochodna jest już dostępna jako RSL.

---

## Postglacjał, 20 ka → dziś

Zakres aplikacji od 2026-10-31. Zbiory dla usuniętych reżimów (fanerozoik, czwartorzęd, mikroskala czterech wybrzeży) zostały wykreślone z rejestru.

### Model GIA i poziom morza

| id | Zbiór | DOI / URL | Licencja | Weryfikacja | Status |
| :-- | :-- | :-- | :-- | :-- | :-: |
| `ice6g_c` | ICE-6G_C (VM5a), Peltier, Argus & Drummond 2015 | https://pmip4.lsce.ipsl.fr/doku.php/data:ice_ice6g_c | brak | 2026-10-30, strona PMIP4 | ❓ |
| `glac1d` | GLAC-1D, Tarasov i in. | https://pmip4.lsce.ipsl.fr/doku.php/data:ice_glac_1d | brak | 2026-10-30, strona PMIP4 | ❓ |
| `anu_ice` | ANU-ICE, Lambeck i in. | — | brak | 2026-10-30, brak publicznej dystrybucji | ❓ |
| `steffen2025_rsl` | Steffen & Kaufmann 2025, RSL northern Europe (ANU-ICE, ICE-5G) | `10.5281/zenodo.15481755` | CC BY 4.0 | 2026-10-30, DataCite | ✅ |
| `steffen2025_rsl_sbaltic` | Steffen & Kaufmann 2025, RSL southern Baltic (ANU-ICE, ICE-5G), 5–25°E / 52–60°N | `10.5281/zenodo.15488259` | CC BY 4.0 | 2026-10-30, DataCite | ✅ |
| `esd2025` | Miluch i in. 2025, *Paleogeographic numerical modeling of marginal seas for the Holocene*, ESD 16, 585–605 | `10.5194/esd-16-585-2025` | CC BY 4.0 | 2026-10-30, strona artykułu | ✅ |
| `zhang2024_sed` | Zhang 2024, Holocene sediment thickness map for the Baltic Sea | `10.17632/k45mff2ccy.1` | CC BY 4.0 | 2026-10-30, DataCite | ✅ |
| `rosentau2021` | Rosentau i in. 2021, A Holocene relative sea-level database for the Baltic Sea (1099 wskaźników, HOLSEA) | `10.5880/GFZ.1.3.2020.003` | CC BY 4.0 | 2026-10-30, DataCite | ✅ |
| `nkg2016lu` | NKG2016LU, Vestøl i in. 2019, J. Geod. 93, 1759–1779 | `10.1007/s00190-019-01280-8` | CC BY 4.0 (artykuł) | 2026-10-30, repozytorium DUO; **licencja samych siatek** (`_abs`, `_lev`) u Lantmäteriet do sprawdzenia | ❓ |
| `sgu_strand` | SGU Strandförskjutningsmodell | — | — | — | ❓ |
| `sincos` | Projekt SINCOS, RSL SW Bałtyku | — | — | — | ❓ |

**Atrybucja (✅):**
- `steffen2025_rsl` — Steffen, H., Kaufmann, G. (2025). *Relative sea level changes in northern Europe from glacial isostatic adjustment modelling…* Zenodo. https://doi.org/10.5281/zenodo.15481755. CC BY 4.0.
- `steffen2025_rsl_sbaltic` — Steffen, H., Kaufmann, G. (2025). *Relative sea level changes in the southern Baltic Sea…* Zenodo. https://doi.org/10.5281/zenodo.15488259. CC BY 4.0.
- `esd2025` — Miluch, J., Zhang, W., Harff, J., Groh, A., Arlinghaus, P., Denker, H. (2025). Earth Syst. Dynam., 16, 585–605. https://doi.org/10.5194/esd-16-585-2025. CC BY 4.0.
- `zhang2024_sed` — Zhang, W. (2024). *Holocene sediment thickness map for the Baltic Sea*. Mendeley Data. https://doi.org/10.17632/k45mff2ccy.1. CC BY 4.0.
- `rosentau2021` — Rosentau, A., Klemann, V., Bennike, O. i in. (2021). *A Holocene relative sea-level database for the Baltic Sea*. GFZ Data Services. https://doi.org/10.5880/GFZ.1.3.2020.003. CC BY 4.0.

### Lądolód

| id | Zbiór | DOI / URL | Licencja | Weryfikacja | Status |
| :-- | :-- | :-- | :-- | :-- | :-: |
| `stroeven2016` | Stroeven i in. 2016, Deglaciation of Fennoscandia, QSR 147, 91–121 — izochrony (shapefile), 22–13 ka co 1000 lat, 11,6–9,7 ka co 100 lat | https://bolin.su.se/data/stroeven-2016 · `10.1016/j.quascirev.2015.09.016` | **CC BY-NC-ND 4.0** | 2026-10-30, Bolin Centre | ⛔ |
| `dated1` | DATED-1, Hughes i in. 2016 — marginesy min. / mc / maks., 40–10 ka | `10.1594/PANGAEA.848117` | CC BY 3.0 | 2026-10-30, PANGAEA | ✅ |

> **⛔ `stroeven2016` — bloker dla `C-07`.** Klauzula **ND** zakazuje rozpowszechniania utworów zależnych: uproszczone, kwantyzowane i interpolowane izochrony w TopoJSON są utworem zależnym. Klauzula **NC** wymaga ustalenia, czy publikacja KMD jest niekomercyjna. Bez zgody autorów Stroeven nie może być „geometrią wiodącą” — może być tylko wewnętrzną kontrolą w `validate.py`. Fallback: DATED-1 (CC BY 3.0) jako geometria, kosztem rozdzielczości czasowej (co 1000 lat zamiast 100 lat w 11,6–9,7 ka). Zapytanie: [`licensing-inquiries.md`](docs/research/licensing-inquiries.md#4-stroeven-2016--cc-by-nc-nd).

**Atrybucja (✅):**
- `dated1` — Hughes, A. L. C., Gyllencreutz, R., Lohne, Ø. S., Mangerud, J., Svendsen, J. I. (2015). *DATED-1: compilation of dates and time-slice reconstruction of the build-up and retreat of the last Eurasian Ice Sheets 40–10 ka*. PANGAEA. https://doi.org/10.1594/PANGAEA.848117. CC BY 3.0. Opis: Hughes i in. 2016, *Boreas* 45, 1–45, https://doi.org/10.1111/bor.12142.

### Batymetria i topografia bazowa

| id | Zbiór | DOI / URL | Licencja | Weryfikacja | Status |
| :-- | :-- | :-- | :-- | :-- | :-: |
| `emodnet_dtm2024` | EMODnet Digital Bathymetry (DTM 2024), 1/16′ | `10.12770/cf51df64-56f9-4a99-b1aa-36b8d7b743a1` | plan zakłada CC BY 4.0 — **DataCite nie podaje licencji** | 2026-10-30, DataCite; do potwierdzenia na portalu EMODnet | ❓ |
| `gebco2024` | GEBCO_2024 Grid, 15″ — kafel GeoTIFF 0–90°N / 0–90°E z archiwum CEDA | `10.5285/1c44ce99-0a0d-5f4f-e063-7086abc0ea0f` | **domena publiczna** z obowiązkiem atrybucji (*Terms of Use of The GEBCO Grid*) | 2026-10-30, `GEBCO_Grid_terms_of_use.pdf` z CEDA | ✅ |
| `copdem_glo30` | Copernicus DEM GLO-30 | https://spacedata.copernicus.eu | licencja Copernicus DEM (atrybucja DLR / Airbus) | niezweryfikowane | ❓ |
| `bsbd` | Baltic Sea Bathymetry Database (BSHC) | https://bshc.pro/data | CC BY 3.0 **z ograniczeniami** | niezweryfikowane — treść ograniczeń nieznana | ❓ |
| `iowtopo2` | IOWTOPO2 (IOW) | — | — | — | ❓ |
| `lakes_ladoga` | batymetria Ładogi | **źródło nieustalone** | — | — | ❓ |
| `lakes_onega` | batymetria Onegi | **źródło nieustalone** | — | — | ❓ |
| `lakes_vanern` | batymetria Vänern | **źródło nieustalone** | — | — | ❓ |
| `lakes_vattern` | batymetria Vättern | **źródło nieustalone** | — | — | ❓ |

**Atrybucja (✅):**
- `gebco2024` — GEBCO Compilation Group (2024). *GEBCO 2024 Grid*. https://doi.org/10.5285/1c44ce99-0a0d-5f4f-e063-7086abc0ea0f. Warunki: wolno kopiować, adaptować i wykorzystywać komercyjnie. Nie wolno sugerować oficjalnego statusu ani poparcia GEBCO, IHO lub IOC. Nie do nawigacji.

> **Batymetria jezior (`C-02`)** — plan nie podaje źródeł. To jedyne dane na ścieżce krytycznej bez wskazanego zbioru.

### Zasolenie, cieśniny, baseny

| id | Zbiór | DOI / URL | Licencja | Weryfikacja | Status |
| :-- | :-- | :-- | :-- | :-- | :-: |
| `kotthoff2022` | Kotthoff i in. 2022, IODP Exp. 347 Site M0059 — palinomorfy, okrzemki, geochemia (~8 ka) | `10.1594/PANGAEA.943832` | CC BY 4.0 | 2026-10-30, DataCite | ✅ |
| `helcom_basins` | HELCOM — podział na baseny (ETRS89-LAEA) | https://metadata.helcom.fi | — | — | ❓ |

**Atrybucja (✅):**
- `kotthoff2022` — Kotthoff, U., Bauersachs, T., Quintana Krupinski, N. B. i in. (2022). *Data from a multi-proxy comparison from the Little Belt (IODP Expedition 347, Site M0059)*. PANGAEA. https://doi.org/10.1594/PANGAEA.943832. CC BY 4.0.

### Kalibracja

| id | Zbiór | DOI / URL | Licencja | Weryfikacja | Status |
| :-- | :-- | :-- | :-- | :-- | :-: |
| `intcal20` | IntCal20, Reimer i in. 2020, Radiocarbon 62 | `10.1017/RDC.2020.41` | — | — | ❓ |

---

## Literatura cytowana w kartach i klatkach

Publikacje, których **liczby** (granice faz, rzędne, poziomy) trafiają do kontraktu. Fakty i wartości liczbowe nie podlegają prawu autorskiemu, ale każda musi mieć cytowanie w `sources.json`.

| id | Publikacja |
| :-- | :-- |
| `andren2011` | Andrén, T. i in. 2011 — źródło wiodące chronologii faz (`C-08`) |
| `bjorck1995` | Björck, S. 1995 |
| `bjorck2008` | Björck, S. 2008 |
| `uscinowicz2014` | Uścinowicz, Sz. 2014 — odstępstwa chronologii (`C-08`) |
| `argus2014` | Argus, D. F. i in. 2014, GJI 198, 537–563, `10.1093/gji/ggu140` |
| `peltier2015` | Peltier, W. R., Argus, D. F., Drummond, R. 2015, JGR Solid Earth 120, 450–487, `10.1002/2014JB011176` |
| `steffen2005` | Steffen, H., Kaufmann, G. 2005, GJI 163, 801–812, `10.1111/j.1365-246X.2005.02740.x` |
| `steffen2014` | Steffen, H., Kaufmann, G., Lampe, R. 2014, Solid Earth 5, 447–459, `10.5194/se-5-447-2014` |
| `hughes2016` | Hughes, A. L. C. i in. 2016, Boreas 45, 1–45, `10.1111/bor.12142` |
