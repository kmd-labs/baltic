# SOURCES

Rejestr wszystkich zbiorów danych i publikacji, z których korzysta warstwa danych Bałtyku. **Jedyne źródło prawdy** dla generowanego `src/assets/data/sources.json` (`I-04`) i warunek legalności publikacji (`0-03`).

Zasada: **wpis powstaje razem z pobraniem zbioru** (`fetch.py`, `0-05`), nie na końcu. Zbioru bez wpisu nie wolno użyć w pipeline'ie; zbioru ze statusem ⛔ lub ❓ nie wolno opublikować w żadnej postaci pochodnej.

Status ✅ mówi o licencji, nie o użyciu. Wpis, którego nie ma jeszcze w `tools/` ani `src/`, nosi adnotację **zarejestrowany, nieużywany** razem z zadaniem, pod które czeka — przegląd z 2026-11-01 (`A-07`), żeby dokument nie sugerował użycia, którego nie ma.

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

## Decyzja licencyjna (`0-02`)

**Stan na 2026-10-31: rozstrzygnięta. Używamy wyłącznie zbiorów, które nie wymagają zapytania o licencję.** Zapytania nie są wysyłane ([`licensing-inquiries.md`](docs/research/licensing-inquiries.md) jest zarchiwizowany).

- **Model GIA:** wyłącznie `steffen2025_rsl` (CC BY 4.0). Paleo-DEM: `H_now − RSL(t)`; RSL zawiera człon eustatyczny i geoidalny, więc nie ma podwójnego liczenia.
- **Lądolód:** wyłącznie `dated1` (CC BY 3.0), przekroje co 1 ka.
- **Kontrola:** `esd2025` (CC BY 4.0, tylko 11,7–0 ka), `rosentau2021`.
- **Zbiory ❓** wchodzą tylko po sprawdzeniu licencji **na stronie źródła** (`0-03`). Jeśli okaże się, że wymagają zapytania albo mają klauzulę ND — przechodzą do sekcji „Odrzucone” i wchodzi fallback z planu (§3).

---

## Postglacjał, 20 ka → dziś

Zakres aplikacji od 2026-10-31. Zbiory dla usuniętych reżimów (fanerozoik, czwartorzęd, mikroskala czterech wybrzeży) zostały wykreślone z rejestru.

### Model GIA i poziom morza

| id | Zbiór | DOI / URL | Licencja | Weryfikacja | Status |
| :-- | :-- | :-- | :-- | :-- | :-: |
| `steffen2025_rsl` | Steffen & Kaufmann 2025, RSL northern Europe (ANU-ICE, ICE-5G) — 1°, 10°W–70°E / 45–85°N, 21,4 ka → 0, 19 kroków, 8 modeli Ziemi | `10.5281/zenodo.15481755` | CC BY 4.0 | 2026-10-30, DataCite | ✅ |
| `steffen2025_rsl_sbaltic` | Steffen & Kaufmann 2025, RSL southern Baltic (ANU-ICE, ICE-5G), 5–25°E / 52–60°N | `10.5281/zenodo.15488259` | CC BY 4.0 | 2026-10-30, DataCite | ✅ · **używany** od 2026-11-02 — porównanie regionalne na wybrzeżu PL/DE/LT w `V-03` (RMSE 7,6–11,7 m wobec 10,1 m pola globalnego) |
| `esd2025` | Miluch i in. 2025, *Paleogeographic numerical modeling of marginal seas for the Holocene*, ESD 16, 585–605 — paleo-DEM-y 0,01°, 11,7–0 ka | `10.5194/esd-16-585-2025` | CC BY 4.0 | 2026-10-30, strona artykułu | ✅ · **zarejestrowany, nieużywany** — kontrola paleo-DEM-u (`V-03`) |
| `zhang2024_sed` | Zhang 2024, Holocene sediment thickness map for the Baltic Sea | `10.17632/k45mff2ccy.1` | CC BY 4.0 | 2026-10-30, DataCite | ✅ · **zarejestrowany, nieużywany** — wejście do `A-05` (korekta na osady); nie ma go też w `registry.json` |
| `rosentau2021` | Rosentau i in. 2021, A Holocene relative sea-level database for the Baltic Sea (1099 wskaźników, HOLSEA) | `10.5880/GFZ.1.3.2020.003` | CC BY 4.0 | 2026-10-30, DataCite | ✅ · **używany** od 2026-11-02 — 1 099 wskaźników, podstawa `V-03`; wyciąg w `tools/validate/data/rsl-observations.json` |

**Atrybucja (✅):**
- `steffen2025_rsl` — Steffen, H., Kaufmann, G. (2025). *Relative sea level changes in northern Europe from glacial isostatic adjustment modelling…* Zenodo. https://doi.org/10.5281/zenodo.15481755. CC BY 4.0.
- `steffen2025_rsl_sbaltic` — Steffen, H., Kaufmann, G. (2025). *Relative sea level changes in the southern Baltic Sea…* Zenodo. https://doi.org/10.5281/zenodo.15488259. CC BY 4.0.
- `esd2025` — Miluch, J., Zhang, W., Harff, J., Groh, A., Arlinghaus, P., Denker, H. (2025). Earth Syst. Dynam., 16, 585–605. https://doi.org/10.5194/esd-16-585-2025. CC BY 4.0.
- `zhang2024_sed` — Zhang, W. (2024). *Holocene sediment thickness map for the Baltic Sea*. Mendeley Data. https://doi.org/10.17632/k45mff2ccy.1. CC BY 4.0.
- `rosentau2021` — Rosentau, A., Klemann, V., Bennike, O. i in. (2021). *A Holocene relative sea-level database for the Baltic Sea*. GFZ Data Services. https://doi.org/10.5880/GFZ.1.3.2020.003. CC BY 4.0.

### Lądolód

| id | Zbiór | DOI / URL | Licencja | Weryfikacja | Status |
| :-- | :-- | :-- | :-- | :-- | :-: |
| `dated1` | DATED-1, Hughes i in. 2016 — marginesy min. / mc / maks.; przekroje co 1 ka 25 → 10 ka (`TS<ka>_{min,mc,max}.shp`) oraz starsze | `10.1594/PANGAEA.848117` | CC BY 3.0 | 2026-10-30, PANGAEA; lista przekrojów sprawdzona 2026-10-31 na pobranym archiwum | ✅ |

Grubość lodu nie pochodzi z żadnego zbioru — to profil plastyczny liczony od krawędzi `dated1` (metodyka, `C-07`).

**Atrybucja (✅):**
- `dated1` — Hughes, A. L. C., Gyllencreutz, R., Lohne, Ø. S., Mangerud, J., Svendsen, J. I. (2015). *DATED-1: compilation of dates and time-slice reconstruction of the build-up and retreat of the last Eurasian Ice Sheets 40–10 ka*. PANGAEA. https://doi.org/10.1594/PANGAEA.848117. CC BY 3.0. Opis: Hughes i in. 2016, *Boreas* 45, 1–45, https://doi.org/10.1111/bor.12142.

### Batymetria, topografia i tło globu

| id | Zbiór | DOI / URL | Licencja | Weryfikacja | Status |
| :-- | :-- | :-- | :-- | :-- | :-: |
| `gebco2024` | GEBCO_2024 Grid, 15″ — kafle GeoTIFF 0–90°N / 0–90°E (pobrany) i 0–90°N / 90°W–0 (tura 2, domena RSL od 10°W) z archiwum CEDA. **Jeziora tylko jako powierzchnia wody** (sprawdzone 2026-10-31: Vänern 44 m, Vättern 88 m) | `10.5285/1c44ce99-0a0d-5f4f-e063-7086abc0ea0f` | **domena publiczna** z obowiązkiem atrybucji (*Terms of Use of The GEBCO Grid*) | 2026-10-30, `GEBCO_Grid_terms_of_use.pdf` z CEDA | ✅ |
| `emodnet_dtm2024` | EMODnet Digital Bathymetry (DTM 2024), 1/16′ | `10.12770/cf51df64-56f9-4a99-b1aa-36b8d7b743a1` | **CC BY 4.0** — „data products created by EMODnet are owned by the EU and therefore licensed under Creative Commons CC-BY 4.0"; wymagana adnotacja (niżej). Produkty **agregowane** od innych dostawców mogą mieć inną licencję — przy użyciu sprawdzić metadane pobranego wycinka | 2026-11-02, *Terms of use of EMODnet online services, data and data products* | ✅ · **zarejestrowany, nieużywany** — lepsza batymetria Bałtyku niż GEBCO (1/16′ wobec 15″ globalnie); podmiana bazy to osobne zadanie |
| `etopo2` | ETOPO2v2c, NOAA NGDC 2006 — `displacementMap` tła globu (`src/assets/data/globe/elevation*.png`, z `kmd-labs/el-nino`) | `10.7289/V5J1012Q` | „Not subject to copyright protection within the United States”; cytowanie: National Geophysical Data Center 2006, *2-minute Gridded Global Relief Data (ETOPO2) v2* | 2026-10-31, metadane NCEI (`gov.noaa.ngdc.mgg.dem:301`) | ✅ · **nieużywany** od 2026-10-31 (scena to wycinek kuli w domenie RSL) |
| `ne_sr50m` | Natural Earth 50m Shaded Relief (`SR_50M`) — cieniowanie rzeźby na globie (`src/assets/data/globe/relief-2k.bin.gz`, z `kmd-labs/el-nino`) | https://www.naturalearthdata.com/ | domena publiczna; atrybucja nieobowiązkowa („Made with Natural Earth”) | 2026-10-31, naturalearthdata.com/about/terms-of-use | ✅ · **nieużywany** od 2026-10-31 (scena to wycinek kuli w domenie RSL) |
| `world_atlas_land50m` | `world-atlas@2` `land-50m.json` (TopoJSON z Natural Earth 4.1.0) — kontur lądu (`src/assets/data/globe/land-50m.json`) | https://github.com/topojson/world-atlas | ISC (pakiet) + Natural Earth (domena publiczna) | 2026-10-31, licencja repozytorium (GitHub API: ISC) i README | ✅ · **nieużywany** od 2026-10-31 (scena to wycinek kuli w domenie RSL) |

**Atrybucja (✅):**
- `gebco2024` — GEBCO Compilation Group (2024). *GEBCO 2024 Grid*. https://doi.org/10.5285/1c44ce99-0a0d-5f4f-e063-7086abc0ea0f. Warunki: wolno kopiować, adaptować i wykorzystywać komercyjnie. Nie wolno sugerować oficjalnego statusu ani poparcia GEBCO, IHO lub IOC. Nie do nawigacji.
- `emodnet_dtm2024` — wymagana adnotacja dosłowna: *"This data product was created by EMODnet (https://emodnet.ec.europa.eu/en/), and is owned by the EU and licensed under the Creative Commons Attribution 4.0 International (CC BY 4.0) license."*
- `rosentau2021` — Rosentau, A. i in. (2021). *A Holocene relative sea-level database for the Baltic Sea*. GFZ Data Services. https://doi.org/10.5880/GFZ.1.3.2020.003. CC BY 4.0. Pochodna (wyciąg 1 099 wskaźników z próbkowaniem modeli) jest zacommitowana w `tools/validate/data/rsl-observations.json`.
- `steffen2025_rsl_sbaltic` — Steffen, H., Kaufmann, G. (2025). *Relative sea level changes in the southern Baltic Sea…*. Zenodo. https://doi.org/10.5281/zenodo.15488259. CC BY 4.0.

> **Batymetria jezior** — GEBCO jej nie ma, a zadanie `C-02` zostało usunięte 2026-10-31. Jeziora są w DEM-ie powierzchniami wody (Vänern 44 m, Vättern 88 m), co jest ograniczeniem opisanym w metodyce, nie błędem danych.

### Zasolenie, cieśniny, baseny

| id | Zbiór | DOI / URL | Licencja | Weryfikacja | Status |
| :-- | :-- | :-- | :-- | :-- | :-: |
| `kotthoff2022` | Kotthoff i in. 2022, IODP Exp. 347 Site M0059 — palinomorfy, okrzemki, geochemia (~8 ka) | `10.1594/PANGAEA.943832` | CC BY 4.0 | 2026-10-30, DataCite | ✅ · **używany** od 2026-11-02 — lokalny onset Littoriny w Małym Bełcie (~7,4 ka cal BP) w `timeline.json` (`C-08`). Zadanie, pod które był pierwotnie zarejestrowany (`V-07`, taksony i zasolenie), zostało usunięte 2026-10-31 |

**Atrybucja (✅):**
- `kotthoff2022` — Kotthoff, U., Bauersachs, T., Quintana Krupinski, N. B. i in. (2022). *Data from a multi-proxy comparison from the Little Belt (IODP Expedition 347, Site M0059)*. PANGAEA. https://doi.org/10.1594/PANGAEA.943832. CC BY 4.0.

### Kalibracja

| id | Zbiór | DOI / URL | Licencja | Weryfikacja | Status |
| :-- | :-- | :-- | :-- | :-- | :-: |

---

## Odrzucone

Zbiory, które **nie są używane w żadnej postaci** (także do walidacji) — bo wymagałyby zapytania o licencję, bo licencja wyklucza publikację pochodnych, bo licencji nie dało się ustalić, albo bo zadanie, pod które były zarejestrowane, zostało usunięte. Decyzje: 2026-10-31 (`0-02`) i 2026-11-02 (`0-03`).

### Rozstrzygnięcie pozycji ❓ (`0-03`, 2026-11-02)

Osiem pozycji czekało na sprawdzenie licencji na stronie źródła. Wynik: **jedna ✅** (`emodnet_dtm2024`, wyżej), **siedem odrzuconych** — poniżej z powodem. Zasada, którą zastosowałem konsekwentnie: *ograniczenie, którego nie da się przeczytać, jest ograniczeniem, którego nie da się dochować* — tak samo jak „brak licencji = brak zgody na pochodne" z `0-02`.

| id | Zbiór | Powód odrzucenia | Co tracimy | Zastępstwo |
| :-- | :-- | :-- | :-- | :-- |
| `nkg2016lu` | NKG2016LU, Vestøl i in. 2019 | **licencji samych siatek nie dało się ustalić** — strony Lantmäteriet z warunkami otwartych danych zwracały 404 (2026-11-02); artykuł jest CC BY 4.0, siatki to osobny produkt | mapa reszt gradientu wypiętrzania w `V-08` | wartości publikowane w artykule (maks. ~10,3 mm/rok przy Umeå, linia zerowa na wybrzeżu DE/PL) — `V-08` porównuje się z nimi i oznacza punkt DoD „mapa reszt" jako niewykonalny |
| `sgu_strand` | SGU Strandförskjutningsmodell | **nie ma czego licencjonować** — SGU deklaruje dane geologiczne jako otwarte, ale model przesunięcia linii brzegowej nie figuruje wśród produktów do pobrania (2026-11-02) | datowane okresy aktywności progów Närke, Svea, Wielkiego Bełtu | rzędne progów z DEM-u (`gebco2024`) i pozycje z publikacji; `activePeriods` pozostają puste tam, gdzie repo nie ma datowanego źródła (`C-05`) |
| `sincos` | Projekt SINCOS, RSL SW Bałtyku | licencji nie ustalono; zbiór nie był potrzebny po wejściu pola regionalnego | — | `steffen2025_rsl_sbaltic` (CC BY 4.0, pobrane) |
| `bsbd` | Baltic Sea Bathymetry Database (BSHC) | CC BY 3.0 **z ograniczeniami o nieznanej treści**; domena `bshc.pro` nie odpowiada (2026-11-02) | lepsza batymetria Bałtyku | `emodnet_dtm2024` (✅) jako droga poprawy, `gebco2024` jako baza |
| `iowtopo2` | IOWTOPO2 (IOW) | brak jakiegokolwiek oświadczenia licencyjnego | jak wyżej | jak wyżej |
| `globathy` | GLOBathy, Khazaei i in. 2022 — batymetria jezior | zadanie `C-02` (batymetria jezior) usunięte 2026-10-31 | głębokości Ładogi, Onegi, Vänern, Vättern | jeziora jako powierzchnie wody w GEBCO |
| `copdem_glo30` | Copernicus DEM GLO-30 | niepotrzebny przy GEBCO jako bazie; licencja Copernicus niezweryfikowana | — | `gebco2024` |
| `helcom_basins` | HELCOM — podział na baseny | zadanie `C-10` (zasolenie per basen) usunięte 2026-10-31 | — | — |
| `intcal20` | IntCal20, Reimer i in. 2020 | zadanie `C-09` (rekalibracja) usunięte 2026-10-31 — daty z literatury bierzemy w cal BP, skalibrowane przez autorów | własna rekalibracja ¹⁴C | granice faz w cal BP za Andrénem i in. 2011 (`C-08`) |

| id | Zbiór | Powód | Co tracimy | Zastępstwo |
| :-- | :-- | :-- | :-- | :-- |
| `ice6g_c` | ICE-6G_C (VM5a), Peltier, Argus & Drummond 2015 — PMIP4, siatka 10′, `Topo` | brak licencji, tylko prośba o cytowanie | nowszy model GIA, siatka 10′, pole współczesnej prędkości wypiętrzania | `steffen2025_rsl`; prędkość z gradientu RSL (`V-08`) |
| `glac1d` | GLAC-1D, Tarasov i in. — PMIP4, 0,5°, co 100 lat | brak licencji | krok 100 lat, grubość lodu | przekroje zdarzeniowe; profil plastyczny lodu |
| `anu_ice` | ANU-ICE, Lambeck i in. — siatki topografii | brak publicznej dystrybucji i licencji | nowsza wersja niż 1998 | `steffen2025_rsl` (ANU-ICE 1998) |
| `stroeven2016` | Stroeven i in. 2016 — izochrony deglacjacji Fennoskandii | **CC BY-NC-ND 4.0** — ND zakazuje utworów zależnych | izochrony co 100 lat w 11,6–9,7 ka | `dated1` co 1 ka; daty z artykułu cytowane jako fakty w chronologii (`C-08`) |

---

## Literatura cytowana w kartach i klatkach

Publikacje, których **liczby** (granice faz, rzędne, poziomy) trafiają do kontraktu. Fakty i wartości liczbowe nie podlegają prawu autorskiemu, ale każda musi mieć cytowanie w `sources.json`.

| id | Publikacja |
| :-- | :-- |
| `andren2011` | Andrén, T. i in. 2011 — źródło wiodące chronologii faz (`C-08`); periody i pozycje progów w `sills.json` (`C-05`) |
| `lambeck2014` | Lambeck, K., Rouby, H., Purcell, A., Sun, Y., Sambridge, M. 2014, PNAS 111, 15296–15303, `10.1073/pnas.1411762111` — eustatyka co 1 ka (`curves/esl`, `C-12`) |
| `khazaei2022` | Khazaei, B. i in. 2022, Sci. Data 9, 36 — opis GLOBathy (`C-02`) |
| `bjorck1995` | Björck, S. 1995 — pozycje i nazwy progów w `sills.json` (`C-05`) |
| `bjorck2008` | Björck, S. 2008 |
| `uscinowicz2014` | Uścinowicz, Sz. 2014 — odstępstwa chronologii (`C-08`) |
| `steffen2005` | Steffen, H., Kaufmann, G. 2005, GJI 163, 801–812, `10.1111/j.1365-246X.2005.02740.x` |
| `steffen2014` | Steffen, H., Kaufmann, G., Lampe, R. 2014, Solid Earth 5, 447–459, `10.5194/se-5-447-2014` |
| `hughes2016` | Hughes, A. L. C. i in. 2016, Boreas 45, 1–45, `10.1111/bor.12142` |
