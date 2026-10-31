# Baltic — warstwa danych: postglacjalna ewolucja Morza Bałtyckiego

> Plan researchu i inżynierii danych. Dokument żywy — aktualizowany w miarę weryfikacji źródeł.

## Context

W repozytorium stoi scaffold KMD (Angular 21): `AppComponent`, i18n EN/PL, submoduł design-systemu, a od `0-05` także `tools/data/fetch.py` z pierwszą turą danych. UI jest przesądzone przez `AGENTS.md` i **świadomie poza zakresem tego planu**. Plan odpowiada na jedno pytanie: skąd wziąć dane, jak je przetworzyć i w jakim kontrakcie wystawić aplikacji.

Dokument jest scaleniem dwóch planów: wcześniejszego (kontrakt danych, budżety) i zewnętrznego planu researchu (7 faz postglacjalnych, katalog progów, biostratygrafia, sill-check). Z obu wzięte są mocne strony; z drugiego usunięty jest błąd w formule paleo-DEM (§0).

**Ustalenia zakresowe:**
- Zakres czasowy: **wyłącznie postglacjał, 20 ka → dziś**. *(Decyzja z 2026-10-31: wcześniejsze reżimy fanerozoiczny (541–2,6 Ma) i czwartorzędowy (2,6 Ma–20 ka) oraz mikroskala czterech wybrzeży na krajowym LiDAR-ze zostały usunięte z zakresu, razem z ich zadaniami.)*
- Paleogeografia: **hybrydowo** — policzony paleo-DEM weryfikowany literaturą.
- Warstwy: **lądolód**, **zasolenie i połączenie z oceanem**, **krzywe poziomu wody i wypiętrzania**. Archeologia i paleoklimat — poza zakresem.
- Rozdzielczość: **500 lat** na jednej siatce dla całego Bałtyku (okno 9–33°E / 53–67°N).

Kolejność prac w §6 jest dobrana tak, by działająca aplikacja (fazy morskie) powstała przed fazami jeziornymi.

---

## 0. Poprawki blokujące wobec planu wejściowego

Trzy rzeczy do naprawienia, zanim powstanie pierwsza linia kodu ETL.

### 0.1 Formuła paleo-DEM podwójnie liczy eustatykę

Plan wejściowy podaje:

```
H_paleo(x,y,t) = H_now(x,y) + ΔGIA(x,y,t) − ΔEustatic(t)        ← BŁĘDNE
```

Formuła nie nazywa pola modelu GIA, które konsumuje. Przy najbardziej naturalnym odczycie — `Topo` z ICE-6G_C — paleotopografia jest podana **względem współczesnej sobie powierzchni morza**, czyli już zawiera składnik eustatyczny i geoidalny. Odjęcie `ΔEustatic(t)` liczy ten sam sygnał drugi raz, na dziesiątki metrów. Znak przy `ΔGIA` jest dodatkowo dwuznaczny: jeśli to wypiętrzenie od czasu *t*, cofając się w czasie trzeba je odjąć, nie dodać.

Obowiązuje — w zależności od źródła GIA (§3.2, decyzja `0-02`):

```
H_paleo(x,y,t) = H_now(x,y) − RSL(x,y,t)                       ← Steffen & Kaufmann 2025, zmienna RSL
H_paleo(x,y,t) = H_now(x,y) + [Topo(t) − Topo(0)]               ← ICE-6G_C `Topo` / GLAC-1D `HDC`
```

W obu wariantach **nie ma osobnego członu eustatycznego**: RSL i `Topo` są już wyrażone względem współczesnego sobie poziomu morza. RSL Steffena i Kaufmanna jest w metrach względem 1950, **dodatnie = morze wyżej niż dziś**. Osobny człon eustatyczny byłby uprawniony **tylko** przy czystym polu odkształcenia bez członu oceanicznego. W `paleo-reconstruction-methodology.md` (§9) formuła musi wskazywać **plik i nazwę zmiennej**, nie pojęcie.

### 0.2 Datum wyniku musi być zapisany w kontrakcie

Poziomy faz jeziornych (+25 m BIL, +10 m Ancylus) jako skalary są poprawne **wyłącznie** dla paleo-DEM-u wyrażonego względem współczesnej sobie geoidy — powierzchnia jeziora jest wtedy powierzchnią ekwipotencjalną, czyli stałą. Zalanie DEM-u w **dzisiejszym** układzie wysokościowym tą samą liczbą daje wynik jawnie fałszywy, bo rebound jest silnie zróżnicowany przestrzennie (>285 m w Zatoce Botnickiej vs ~0 na wybrzeżu Polski). Pole `datum` jest obowiązkowe w `manifest.json` i w każdej klatce; klatki mają `contemporaneous-geoid`. Porównania z obserwacjami RSL (wyrażonymi względem dzisiejszego poziomu, `V-03`) wymagają jawnej transformacji, opisanej w `paleo-reconstruction-methodology.md`.

### 0.3 Maska wody wymaga flood-fill, nie progu

Prosty próg `H < poziom` tworzy fałszywe jeziora w każdym zamkniętym obniżeniu terenu. Zbiornik musi być **hydrologicznie połączony z progiem odpływu** — analiza spójnych składowych z zasiewem w cieśninie aktywnej dla danego *t*. Przy ~47 przekrojach to krok obowiązkowy, nie optymalizacja.

---

## 1. Oś czasu i klatki

| Czas | Krok | Klatki | Charakter |
| :-- | :-- | :-- | :-- |
| 20 ka → 0 | 500 lat | 41 + ~6 zdarzeniowych | własny paleo-DEM z modelu GIA, lądolód, zasolenie |

**Decyzja o kroku.** Plan wejściowy proponował 500 lat dla 20–8 ka i 1000 lat dla 8–0 ka. Odrzucone: transgresja littorynowa, formowanie mierzei i jezior przybrzeżnych mieszczą się w 8–0 ka. Obowiązuje **jednolite 500 lat dla 20–0 ka** (41 klatek) plus przekroje zdarzeniowe: przed i po drenażu Billingen, maksimum ancylusowe, próg regresji ancylusowej, początek ingresji littorynowej, maksimum littorynowe.

**Klatki gęstsze niż model są interpolowane.** Pola RSL Steffena i Kaufmanna mają 19 **nierównych** kroków (21,4; 20,2; 19,1; 17,9; 16,8; 15,6; 14,1; 13,0; 11,3; 10,2; 8,9; 7,8; 6,8; 5,7; 4,4; 3,2; 2,0; 0,9; 0 ka), więc niemal każda klatka 500-letnia powstaje z interpolacji w czasie i dostaje `dataQuality: "interpolated"`. ICE-6G_C (0–21 ka co 500 lat) albo GLAC-1D (co 100 lat) usunęłyby ten problem — po uzyskaniu zgody (`0-02`).

**Uczciwość wobec niepewności jest wymogiem, nie ozdobą.** Flaga `dataQuality` i pas min./maks. lądolodu są w danych, nie tylko w opisie — inaczej aplikacja sugeruje precyzję, której źródła nie mają.

---

## 2. Chronologia: siedem faz

Osnowa: **cal yr BP** (Present = 1950). Wszystkie daty ¹⁴C ze starszej literatury kalibrowane **IntCal20** — bez tego daty z Björcka 1995 przesuwają się o ~1000–1500 lat w późnym glacjale. W `timeline.json` trzymamy obie wartości plus użytą krzywą.

| ID | Faza | cal yr BP | Zbiornik | Procesy |
| :-- | :-- | :-- | :-- | :-- |
| `deglaciation` | Maksimum zlodowacenia i recesja SIS | ~20 000 – 16 000 | lądolód / zastoiska | wycofywanie lądolodu skandynawskiego (fazy pomorska, gardzieńska), pierwsze zastoiska marginalne |
| `bil` | Bałtyckie Jezioro Lodowe | ~16 000 – 11 700 | słodkowodny zaporowy | spiętrzenie do **+25 m** nad ówczesnym oceanem; **dwa** drenaże w rejonie Billingen — pierwszy ~13 000 BP (~10 m), ponowne zatamowanie w młodszym dryasie, finalny ~11 620–11 700 BP ze spadkiem **25–28 m** |
| `yoldia` | Morze Yoldiowe | ~11 700 – 10 700 | słonawy (krótka faza) → słodki | połączenie przez Cieśninę Närke w środkowej Szwecji; napływ zimnych wód słonych tylko w ~11 700–11 100; wypiętrzanie izostatyczne zamyka cieśninę |
| `ancylus` | Jezioro Ancylusowe | ~10 700 – 9 800 | słodkowodny | izolacja wskutek wypiętrzania; poziom **+10 m**; transgresja na południu; odpływ najpierw **Rzeką Svea** (Degerfors), potem **Rzeką Dana** przez Cieśniny Duńskie → regresja |
| `mastogloia` | Morze Mastogloiowe (initial Littorina) | ~9 800 – 8 500 | przejściowy słonawy | eustatyczny wzrost oceanu przekracza progi Wielkiego Bełtu i Øresundu; powolna ingresja |
| `littorina` | Morze Litorynowe | ~8 500 – 4 000 | morski (optimum) | maksymalna transgresja; zasolenie wyraźnie wyższe niż dziś; zatopienie równin południowych przy jednoczesnym wynurzaniu Zatoki Botnickiej |
| `post-littorina` | Morze Limneowe i Myowe → Bałtyk współczesny | ~4 000 – 0 | słonawy | wypłycenie Cieśnin Duńskich ogranicza wlewy; spadek zasolenia do stanu obecnego |

**Granice faz do rozstrzygnięcia jednym źródłem.** Koniec fazy ancylusowej jest podawany jako 9 800 albo 9 500 cal BP w zależności od autora. Przyjmujemy wartości za **Andrén i in. 2011** i zapisujemy odstępstwa innych syntez w `baltic-data-catalog.md` — nie uśredniamy.

**Dane do oznaczenia jako sporne, nie jako fakt:**
- czas trwania finalnego drenażu Billingen — „1–2 lata" to jedno z oszacowań, nie konsensus;
- zawleczenie *Mya arenaria* — datowania muszli z Danii wskazują ~1245–1295 n.e. (hipoteza nordycka), nie XVI/XVII w.;
- zasolenie littorynowe — „12–18 PSU" to górna granica publikowanych wartości dla Bałtyku właściwego; wymaga rozbicia na baseny.

---

## 3. Rejestr źródeł

Licencje i statusy: [`SOURCES.md`](../../SOURCES.md) (źródło prawdy). Tu tylko rola każdego zbioru w planie.

### 3.1 Lądolód

| Dane | Źródło | Rola |
| :-- | :-- | :-- |
| Zasięg SIS 25–10 ka co 1000 lat, warianty min. / najbardziej prawdopodobny / maks. | DATED-1, Hughes i in. 2016, PANGAEA `10.1594/PANGAEA.848117` (CC BY 3.0) | **geometria wiodąca** + pas niepewności |
| Izochrony deglacjacji Fennoskandii, 22,0–9,7 ka cal BP | Stroeven i in. 2016, *QSR* (**CC BY-NC-ND 4.0** ⛔) | gęstsze i dokładniejsze w niecce bałtyckiej (moment otwarcia Billingen), ale klauzula ND zakazuje publikacji pochodnych — **tylko wewnętrzna kontrola** w `validate.py`, dopóki autorzy nie wyrażą zgody |
| Grubość lodu | ICE-6G_C / GLAC-1D (po zgodzie, `0-02`) | kopuła 2500–3000 m w centrum → 0 m na czole; bez zgody warstwa bez grubości |

### 3.2 Model GIA i poziom wody

| Dane | Źródło | Rola |
| :-- | :-- | :-- |
| Pola RSL, 1°, 10°W–70°E / 45–85°N, 21,4 ka → 0, 8 modeli Ziemi | **Steffen & Kaufmann 2025**, Zenodo `10.5281/zenodo.15481755` (CC BY 4.0) | **podstawa paleo-DEM-u bez czekania na licencje**; ANU-ICE (1998) |
| Paleotopografia `Topo`, siatka 10′, 0–21 ka co 500 lat | ICE-6G_C (VM5a), Peltier i in. 2015 — dystrybucja PMIP4 | ulepszenie jakości po zgodzie; także pole współczesnej prędkości wypiętrzania do `V-08` |
| `HDC` + `ICEM`, 0,5°, 26 ka → 0 co 100 lat | GLAC-1D, Tarasov i in. — PMIP4 | ulepszenie po zgodzie; krok 100 lat usuwa interpolację przekrojów zdarzeniowych |
| Paleo-DEM-y 0,01°, 11,7–0 ka | ESD 16, 585 (2025), Miluch i in. (CC BY 4.0) | **tylko kontrola** (`V-12`) — nie obejmuje BIL ani deglacjacji, SELEN napędzany ICE-5G |
| Rekonstrukcje linii brzegowych Szwecji | SGU Strandförskjutningsmodell | rzędne progów Närke i Billingen do `sills.json` — luka bazy Rosentaua jest właśnie w Szwecji |
| Walidacja ilościowa (1099 wskaźników RSL) | **Rosentau i in. 2021**, GFZ `10.5880/GFZ.1.3.2020.003` | format HOLSEA; klastry: regresja / transgresja / przejściowe |
| Współczesne wypiętrzanie | NKG2016LU, Vestøl i in. 2019 | maks. 10,3 mm/rok przy Umeå; linia zerowa na wybrzeżu DE/PL |
| Projekt SINCOS | RSL dla SW Bałtyku | uzupełnienie dla strefy niemieckiej |

**Kolejność fallbacków GIA:** ICE-6G_C → GLAC-1D → **Steffen & Kaufmann 2025** → ESD 2025 (tylko 11,7–0 ka). Ponieważ ICE-6G_C, GLAC-1D i ANU-ICE nie mają licencji (tylko prośbę o cytowanie), **praca startuje na Steffenie i Kaufmannie**, a lepsze modele wchodzą jako podmiana źródła, gdy przyjdzie zgoda.

### 3.3 Batymetria i topografia bazowa — zakres **9°E–33°E, 53°N–67°N**

| Dane | Źródło | Rozdz. |
| :-- | :-- | :-- |
| Ląd i dno — baza | GEBCO 2024 (pobrane, tura 1) | 15″ |
| Dno Bałtyku, Cieśnin Duńskich, Kattegatu — ulepszenie | EMODnet Digital Bathymetry **DTM 2024** (licencja do potwierdzenia) | 1/16′ ≈ 115 m, 59 kafli |
| Ląd — ulepszenie | Copernicus DEM GLO-30 | 30 m |
| **Ładoga, Onega, Vänern, Vättern** | krajowe batymetrie jeziorne — **źródła nieustalone** | — |
| Kontrola | BSBD (BSHC) `bshc.pro/data`; IOWTOPO2 | 500 m |

> Batymetria wielkich jezior nie jest dodatkiem. Vänern i Vättern leżą na trasie Rzeki Svea i korytarza Billingen, Ładoga była częścią basenu w kilku fazach. Bez nich drenaży nie da się zamodelować — pipeline wygeneruje jeziora bez odpływu.

### 3.4 Zasolenie i cieśniny

| Dane | Źródło |
| :-- | :-- |
| Proxy zasolenia i temperatury | **IODP Exp. 347, Site M0059** — Kotthoff i in. 2022, PANGAEA `10.1594/PANGAEA.943832` (okrzemki, palinomorfy, geochemia); przejście do Littoriny w ~200 lat około 7,4 ka cal BP |
| Katalog progów i cieśnin | współrzędne + rzędne progowe + okresy aktywności: **Billingen** (58,4°N 13,8°E), **Närke** (59,1°N 15,0°E), **Svea / Degerfors**, **Dana / Wielki Bełt**, **Darss**, **Drogden / Øresund**; przesmyk karelsko-białomorski oznaczony jako *hipoteza historyczna, nie konsensus* |
| Gatunki wskaźnikowe | *Portlandia (Yoldia) arctica*, *Ancylus fluviatilis*, okrzemki *Mastogloia*, *Littorina littorea*, *Limnaea (Radix) balthica*, *Mya arenaria* — tolerancja zasolenia i temperatury jako **niezależna kontrola** rekonstrukcji |
| Zlewnia i podział na baseny | HELCOM `metadata.helcom.fi` (ETRS89-LAEA) |

---

## 4. Metoda

### 4.1 Paleo-DEM co 500 lat

```python
paleo_dem(t)   = modern_dem − resample(interp_t(RSL, t))         # §0.1, Steffen & Kaufmann; datum: geoida współczesna t
               # | modern_dem + resample(Topo(t) − Topo(0))      # wariant ICE-6G_C / GLAC-1D po zgodzie
level(t)       = sill_elevation(active_outlet(t), t)            # fazy jeziorne
               | 0                                              # fazy morskie: paleo-DEM jest już względem morza w t
water_mask(t)  = flood_fill(paleo_dem(t), level(t),
                            seed=active_outlet(t))              # §0.3, nie próg
```

Sedno poprawności: w fazach jeziornych powierzchnia wody **nie jest** globalnym poziomem morza — wyznaczał ją próg odpływu. Fazy morskie (Yoldia, Mastogloia, Littorina, współczesna) → poziom morza z modelu GIA. Fazy jeziorne (BIL, Ancylus) → rzędna progu w ramie `t` + wartości z literatury.

Lądolód: DATED-1 jako geometria wiodąca (wariant `mc`) z pasem min./maks. przeniesionym **do danych**. Każda klatka interpolowana między przekrojami DATED-1 dostaje `ice.interpolated: true`. DATED-1 kończy się na 10 ka — klatki młodsze mają `ice: null`. Gdy Stroeven dostanie zgodę, zostaje geometrią wiodącą (gęstsze kroki 11,6–9,7 ka), a DATED-1 pasem.

Zasolenie: klasa reżimu (słodki / słonawy / morski) per faza z IODP 347 i okrzemek, plus **stan każdego progu** (otwarty/zamknięty) i profil przestrzenny Cieśniny Duńskie → Basen Gotlandzki → Zatoka Botnicka.

**Projekcje:** przetwarzanie w EPSG:3035 (ETRS89-LAEA, konwencja HELCOM), eksport w EPSG:4326.

### 4.2 Metryki bilansowe

Z maski wody policzyć dla każdego przekroju: **powierzchnię** (km²), **objętość** (km³), średnią i maksymalną głębokość, oraz szacowany **czas wymiany wód**. Niemal darmowe, a dają cztery dodatkowe krzywe i kontrolę sensowności.

---

## 5. Kontrakt danych

Katalog `src/assets/data/` (objęty `assets` w `angular.json`), wersjonowany polem `schemaVersion`:

```
src/assets/data/
  manifest.json          # schemaVersion, datum, budżety, sumy kontrolne, mapa chunków
  timeline.json          # 7 faz — szkielet całej aplikacji
  sources.json           # rejestr źródeł: DOI, licencja, tekst atrybucji
  events.json            # karty zdarzeń → odsyłacze do sources.json
  sills.json             # katalog progów: współrzędne, rzędne, okresy aktywności
  taxa.json              # gatunki wskaźnikowe: tolerancja zasolenia i temperatury
  curves/                # rsl-sites, uplift-nkg, basin-metrics
  frames/                # 41 + ~6 zdarzeniowych, krok 500 lat
```

```jsonc
{
  "id": "ancylus-max",
  "tBP": 10500,                        // cal yr BP
  "t14C": 9300,                        // oryginalna data niekalibrowana, jeśli z literatury
  "calCurve": "IntCal20",
  "datum": "contemporaneous-geoid",    // §0.2 — obowiązkowe
  "stageId": "ancylus",
  "water": { "type": "lake", "levelM": 10.0, "outlet": "svea" },
  "salinity": { "class": "fresh", "psuRange": [0, 0.5] },
  "ice": { "source": "dated1", "interpolated": true, "band": "dated1" },
  "gia": { "source": "steffen2025_rsl", "earthModel": "sk1" },
  "metrics": { "areaKm2": 420000, "volumeKm3": 23000 },
  "dataQuality": "interpolated",       // modelled | interpolated | qualitative
  "frame": "frames/f-10500.topo.json",
  "sources": ["bjorck1995", "andren2011", "rosentau2021", "dated1", "steffen2025_rsl"]
}
```

**Geometria: TopoJSON, nie rastry.** Plan wejściowy proponował wystawić rastrowe „Paleo-DEM Time Slices / Delta Grids" jako artefakt runtime'owy. W zakresie 9–33°E / 53–67°N przy rozdzielczości EMODnet (~115 m) to siatka rzędu 20 000 × 15 000 komórek **na przekrój** — przy ~47 przekrojach to nie jest aplikacja webowa. Obowiązuje: warstwy `land` / `water` / `ice` / `lake` / `rivers` jako kwantyzowany, uproszczony TopoJSON; raster (hipsometria) tylko jako opcjonalny, leniwy chunk w obniżonej rozdzielczości.

**Budżet:** ≤ 25 MB całości, ≤ 4 MB przy pierwszym wejściu. Chunki per faza, ładowane leniwie — na starcie wystarczy klatka bieżąca i jej sąsiedzi. Deploy idzie na GitHub Pages (`npm run build:gh-pages`), więc rozmiar jest realnym ograniczeniem, pilnowanym w CI.

**i18n.** `AGENTS.md` wymaga zera zahardkodowanych stringów i równoległości EN/PL. Przy kilkudziesięciu kartach zdarzeń, progów i taksonów trzymanie wszystkiego w `Dict` rozsadziłoby `en.ts`/`pl.ts`. Obowiązuje: **dane noszą wyłącznie identyfikatory**; chrome UI zostaje w `Dict` (`src/app/core/i18n/i18n.types.ts`, `en.ts`, `pl.ts` — rozszerzyć o klucze faz i warstw), a długie teksty idą do `src/assets/content/{en,pl}/*.json`, ładowane reaktywnie na podstawie sygnału `lang` z `I18nService`. **Brak tłumaczenia = błąd builda.**

**`sources.json` jest obowiązkowy, nie kosmetyczny** — niemal każdy zbiór to CC BY, co nakłada wymóg atrybucji. Ten plik napędza panel „Źródła" i jest warunkiem legalności publikacji.

---

## 6. Pipeline w repo

```
tools/data/
  fetch.py             # pobieranie po DOI + weryfikacja sum kontrolnych   (gotowe, tura 1)
  postglacial.py       # mozaika + jeziora + GIA → paleo-DEM → flood-fill → wektoryzacja
  curves.py            # RSL (Rosentau), NKG2016LU, metryki basenu → curves/
  calibrate.py         # IntCal20: ¹⁴C BP → cal yr BP dla dat z literatury
  validate.py          # raport walidacyjny (§7)
  emit.py              # TopoJSON, kwantyzacja, uproszczenie, manifest
data/raw/              # .gitignore
data/interim/          # .gitignore
SOURCES.md             # pełne cytowania + licencje — źródło prawdy dla sources.json
```

Stack: `xarray` + `netCDF4`, `rasterio`, `geopandas`, `shapely`, `pyogrio`, `scipy.ndimage` (flood-fill), `pyproj`; `mapshaper`/`topojson` do uproszczenia. Wejście: `npm run data:build` (obok istniejącego `data:fetch`). Pipeline **idempotentny i offline po pierwszym pobraniu** — surowe dane poza gitem, assety wyjściowe w gicie.

### Kolejność prac

1. **Sprzątanie startowe** — `git submodule update --init` przed czymkolwiek, inaczej build nie przejdzie.
2. **Od końca ku początkowi** — najpierw dziś → 8 ka (najlepsze dane), potem fazy jeziorne (najtrudniejsze, bo próg zamiast eustatyki). Najszybsza droga do działającej aplikacji. Start na GEBCO 2024 + RSL Steffena i Kaufmanna + DATED-1 — wszystkie ✅, bez czekania na odpowiedzi licencyjne.
3. **Katalogi i krzywe** (`sills.json`, `taxa.json`, `curves/`) — `sills.json` jest warunkiem sill-checku, zasolenia i maski faz jeziornych, więc powstaje razem z paleo-DEM-em (M2).
4. **Ulepszenia jakości po licencjach** — EMODnet, ICE-6G_C / GLAC-1D, Stroeven — jako podmiana źródła bez zmiany kontraktu.

---

## 7. Weryfikacja

`tools/data/validate.py` produkuje raport i kończy się błędem przy przekroczeniu progów.

**Sill-check (bilans wysokościowy na progach).** Dla każdego przekroju sprawdzić, czy rzędna progu zgadza się z kierunkiem przepływu: jezioro zaporowe wymaga progu **powyżej** ówczesnego poziomu oceanu, połączenie morskie **poniżej**. Test wewnętrznie spójnościowy — nie wymaga danych zewnętrznych, a wyłapuje dokładnie tę klasę błędu, która jest tu najgroźniejsza (§0.1–0.2). Uruchamiany dla wszystkich progów z `sills.json`.

**RSL wobec obserwacji.** Policzony poziom w punktach bazy Rosentau i in. 2021 vs. wartości zmierzone; **RMSE raportowane per region**, osobno dla trzech klastrów bazy (regresja / transgresja / przejściowe). To jedyna ilościowa walidacja w całym planie — bez niej zostaje „zgodność z syntezami".

**Kontrola zdarzeń.** Spadek Billingen 25–28 m; środkowoholoceński highstand w strefach przejściowych w 7,5–6,5 ka BP; przejście do Littoriny w Małym Bełcie ~7,4 ka cal BP.

**Zgodność z gatunkami wskaźnikowymi.** Rekonstruowane zasolenie w miejscu i czasie wystąpienia gatunku musi mieścić się w jego tolerancji z `taxa.json`.

**Współczesne wypiętrzanie.** Gradient z modelu GIA vs. NKG2016LU — maks. ~10,3 mm/rok przy Umeå, linia zerowa na wybrzeżu Niemiec i Polski.

**Chronologia.** Granice faz i poziomy wód zgodne z Andrén i in. 2011 (źródło wiodące), z udokumentowanymi odstępstwami Björcka 1995/2008, Stroevena i in. 2016 i Uścinowicza 2014 — wszystko w jednolitej skali cal yr BP.

**Topologia i budżet.** Geometrie poprawne (brak samoprzecięć), spójny CRS, suma assetów ≤ 25 MB, pierwszy chunk ≤ 4 MB, sumy kontrolne w `manifest.json` zgodne.

**Kontrola wizualna.** Nałożenie klatek na mapy etapów z Björcka 1995 / Andréna i in. 2011 dla 11,7 / 11,1 / 10,5 ka BP oraz na paleo-DEM-y z ESD 16, 585 (2025) dla 11,7–0 ka — niezależna implementacja tej samej metody, więc rozbieżność linii brzegowej większa niż kilka kilometrów oznacza błąd u nas.

### End-to-end

```powershell
git submodule update --init
npm ci
npm run data:fetch          # surowe dane → data/raw/, weryfikacja sum
npm run data:build          # → raport walidacyjny + src/assets/data/
npm start                   # wizualna kontrola klatek na osi czasu
npm run build:gh-pages      # kontrola rozmiaru bundle'a i assetów
```

---

## 8. Ryzyka

| Ryzyko | Reakcja |
| :-- | :-- |
| Podwójne liczenie eustatyki w paleo-DEM | §0.1 — formuła nazywa plik i pole; sill-check wyłapie ilościowo |
| Fazy jeziorne policzone eustatycznie | poziom z rzędnej progu + literatura; `datum` obowiązkowy w kontrakcie |
| Fałszywe jeziora w zamkniętych obniżeniach | flood-fill z zasiewem w progu, nie próg wysokościowy |
| Brak licencji ICE-6G_C / GLAC-1D | start na Steffenie i Kaufmannie 2025 (CC BY 4.0); lepsze modele jako podmiana źródła po zgodzie |
| Stroeven 2016 na CC BY-NC-ND | DATED-1 jako geometria wiodąca; Stroeven tylko wewnętrznie do czasu zgody |
| Pozorna precyzja (klatki gęstsze niż modele) | `dataQuality` i `ice.interpolated` w każdej klatce; pas min./maks. DATED-1 w danych |
| Brak batymetrii wielkich jezior | `C-02` na ścieżce krytycznej faz jeziornych; źródła ustalić równolegle z M2 |
| ~47 klatek × warstwy | chunki per faza, ładowanie leniwe, budżet 25/4 MB pilnowany w CI |
| Pełna równoległość EN/PL | `content/{lang}/` od pierwszego commita; brak tłumaczenia = błąd builda |

---

## 9. Artefakty dokumentacyjne

`docs/research/baltic-data-catalog.md` — raport z researchu: bezpośrednie linki (DOI, PANGAEA, EMODnet, SGU, GFZ), licencje i formaty; **tabela korelacji wiekowej** cal yr BP ↔ ¹⁴C BP ↔ BCE/CE dla wszystkich 7 faz; zestawienie parametrów liczbowych per przekrój (poziom wody, zasolenie, powierzchnia, objętość, maksimum izostazji); katalog współrzędnych punktów kluczowych.

`docs/research/paleo-reconstruction-methodology.md` — specyfikacja matematyczna i geoprzestrzenna przekształcania surowych siatek, izochron i pól GIA w warstwy gotowe do interpolacji. **Musi wskazywać konkretne pliki i nazwy zmiennych** modelu GIA, nie pojęcia (§0.1).

`SOURCES.md` — pełne cytowania i licencje; źródło prawdy dla generowanego `sources.json`.
