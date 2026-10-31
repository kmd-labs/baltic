# Baltic — warstwa danych: postglacjalna ewolucja Morza Bałtyckiego

> Plan researchu i inżynierii danych. Dokument żywy — aktualizowany w miarę weryfikacji źródeł.

## Context

W repozytorium stoi scaffold KMD (Angular 21): `AppComponent`, i18n EN/PL, submoduł design-systemu, a od `0-05` także `tools/data/fetch.py` z pierwszą turą danych. Plan odpowiada na pytanie: skąd wziąć dane, jak je przetworzyć i w jakim kontrakcie wystawić aplikacji. Scenę aplikacji opisuje §5.1 tylko w zakresie, w jakim narzuca wymagania na dane.

Dokument jest scaleniem dwóch planów: wcześniejszego (kontrakt danych, budżety) i zewnętrznego planu researchu (7 faz postglacjalnych, katalog progów, biostratygrafia, sill-check). Z drugiego usunięty jest błąd w formule paleo-DEM (§0).

**Ustalenia zakresowe** (stan na 2026-10-31):
- Zakres czasowy: **wyłącznie postglacjał, 20 ka → dziś**. Fanerozoik, czwartorzęd i mikroskala czterech wybrzeży są poza zakresem.
- **Wyłącznie zbiory, które nie wymagają zapytania o licencję** — licencja otwarta (CC BY, CC0, domena publiczna) zweryfikowana u źródła albo liczby z literatury z cytowaniem. Zbiory bez licencji lub z klauzulą ND (ICE-6G_C, GLAC-1D, ANU-ICE, Stroeven 2016) **nie są używane w żadnej postaci**, także do walidacji. Zapytania licencyjne nie są wysyłane.
- Krok czasowy: **1000 lat** (21 klatek 20 → 0 ka) plus ~6 przekrojów zdarzeniowych.
- Scena: **glob 3D z reliefem**, wzięty z `kmd-labs/el-nino` (tylko glob i relief, reszta pominięta), zbliżony na Bałtyk; próba obrotu wraca sprężyście do Bałtyku (§5.1).
- Dane runtime: **hybrydowo** — pipeline liczy maski, progi, metryki i walidację; aplikacja dostaje siatkę wysokości dziś + kostkę RSL (do rzeźby 3D, przekroju i sondy punktowej) oraz wektory i JSON-y per klatka (§5).
- Paleogeografia: policzony paleo-DEM weryfikowany literaturą.
- Warstwy: **lądolód**, **zasolenie i połączenie z oceanem**, **krzywe poziomu wody i wypiętrzania**. Archeologia i paleoklimat — poza zakresem.

---

## 0. Poprawki blokujące wobec planu wejściowego

### 0.1 Formuła paleo-DEM podwójnie liczy eustatykę

Plan wejściowy podaje:

```
H_paleo(x,y,t) = H_now(x,y) + ΔGIA(x,y,t) − ΔEustatic(t)        ← BŁĘDNE
```

Formuła nie nazywa pola modelu GIA, które konsumuje. Pola RSL i paleotopografii z modeli GIA są podane **względem współczesnej sobie powierzchni morza**, czyli już zawierają składnik eustatyczny i geoidalny. Odjęcie `ΔEustatic(t)` liczy ten sam sygnał drugi raz, na dziesiątki metrów.

Obowiązuje:

```
H_paleo(x,y,t) = H_now(x,y) − RSL(x,y,t)        ← Steffen & Kaufmann 2025, zmienna RSL w rsl_SK05_skan_<model>.nc
```

RSL jest w metrach względem 1950, **dodatnie = morze wyżej niż dziś**. **Nie ma osobnego członu eustatycznego.** Krzywa eustatyczna (§3.2) służy wyłącznie do odczytu „ocean −X m względem dziś” w UI, nigdy do liczenia paleo-DEM-u. W `paleo-reconstruction-methodology.md` formuła musi wskazywać **plik i nazwę zmiennej**, nie pojęcie.

### 0.2 Datum wyniku musi być zapisany w kontrakcie

Poziomy faz jeziornych (+25 m BIL, +10 m Ancylus) jako skalary są poprawne **wyłącznie** dla paleo-DEM-u wyrażonego względem współczesnej sobie geoidy — powierzchnia jeziora jest wtedy ekwipotencjalna, czyli stała. Zalanie DEM-u w **dzisiejszym** układzie tą samą liczbą daje wynik jawnie fałszywy, bo rebound jest silnie zróżnicowany przestrzennie (>285 m w Zatoce Botnickiej vs ~0 na wybrzeżu Polski). Pole `datum` jest obowiązkowe w `manifest.json` i w każdej klatce; klatki mają `contemporaneous-geoid`. Porównania z obserwacjami RSL (`V-03`) wymagają jawnej transformacji, opisanej w metodyce.

### 0.3 Maska wody wymaga flood-fill, nie progu

Prosty próg `H < poziom` tworzy fałszywe jeziora w każdym zamkniętym obniżeniu terenu. Zbiornik musi być **hydrologicznie połączony z progiem odpływu** — analiza spójnych składowych z zasiewem w cieśninie aktywnej dla danego *t*.

---

## 1. Oś czasu i klatki

| Czas | Krok | Klatki | Charakter |
| :-- | :-- | :-- | :-- |
| 20 ka → 0 | 1000 lat | 21 + ~6 zdarzeniowych | paleo-DEM z RSL Steffena i Kaufmanna, lądolód DATED-1, zasolenie per basen |

**Decyzja o kroku: 1000 lat** (zmiana z 500 lat, 2026-10-31). Uzasadnienie:
- **Lądolód przestaje być interpolowany.** DATED-1 ma przekroje dokładnie co 1 ka (25 → 10 ka), więc klatki 20 → 10 ka trafiają w dane źródłowe (`ice.interpolated: false`).
- **Rozdzielczość źródła RSL** to 19 nierównych kroków (21,4; 20,2; 19,1; 17,9; 16,8; 15,6; 14,1; 13,0; 11,3; 10,2; 8,9; 7,8; 6,8; 5,7; 4,4; 3,2; 2,0; 0,9; 0 ka), średnio ~1,1 ka. Krok 500 lat sugerowałby precyzję, której model nie ma. Klatki RSL nadal są interpolowane w czasie (`dataQuality: "interpolated"` poza 0 ka).
- Mniej klatek = mniejszy budżet i szybsza walidacja.

**Koszt:** transgresja littorynowa i drenaż Billingen dzieją się szybciej niż 1 ka. Dlatego zostają **przekroje zdarzeniowe**: przed i po drenażu Billingen (~11 750 / 11 650), maksimum ancylusowe (~10 300), próg regresji ancylusowej (~10 050), początek ingresji littorynowej (~8 350), maksimum littorynowe (~6 750). Te przekroje mają lód interpolowany między przekrojami DATED-1 albo `ice: null`.

**Uczciwość wobec niepewności jest wymogiem, nie ozdobą.** Flaga `dataQuality` i pas min./maks. lądolodu są w danych, nie tylko w opisie.

---

## 2. Chronologia: siedem faz

Osnowa: **cal yr BP** (Present = 1950). Wszystkie daty ¹⁴C ze starszej literatury kalibrowane **IntCal20**. W `timeline.json` trzymamy obie wartości plus użytą krzywą.

| ID | Faza | cal yr BP | Zbiornik | Procesy |
| :-- | :-- | :-- | :-- | :-- |
| `deglaciation` | Maksimum zlodowacenia i recesja SIS | ~20 000 – 16 000 | lądolód / zastoiska | wycofywanie lądolodu skandynawskiego, pierwsze zastoiska marginalne |
| `bil` | Bałtyckie Jezioro Lodowe | ~16 000 – 11 700 | słodkowodny zaporowy | spiętrzenie do **+25 m** nad ówczesnym oceanem; **dwa** drenaże w rejonie Billingen — pierwszy ~13 000 BP (~10 m), finalny ~11 620–11 700 BP ze spadkiem **25–28 m** |
| `yoldia` | Morze Yoldiowe | ~11 700 – 10 700 | słonawy (krótko) → słodki | połączenie przez Cieśninę Närke; napływ słonych wód tylko w ~11 700–11 100 |
| `ancylus` | Jezioro Ancylusowe | ~10 700 – 9 800 | słodkowodny | izolacja wskutek wypiętrzania; poziom **+10 m**; odpływ **Rzeką Svea**, potem **Rzeką Dana** → regresja |
| `mastogloia` | Morze Mastogloiowe (initial Littorina) | ~9 800 – 8 500 | przejściowy słonawy | eustatyczny wzrost oceanu przekracza progi Wielkiego Bełtu i Øresundu |
| `littorina` | Morze Litorynowe | ~8 500 – 4 000 | morski (optimum) | maksymalna transgresja; zasolenie wyższe niż dziś |
| `post-littorina` | Morze Limneowe i Myowe → Bałtyk współczesny | ~4 000 – 0 | słonawy | wypłycenie Cieśnin Duńskich ogranicza wlewy |

**Granice faz jednym źródłem:** **Andrén i in. 2011**; odstępstwa innych syntez w `baltic-data-catalog.md`, bez uśredniania.

**Sporne, nie fakt:** czas trwania finalnego drenażu Billingen („1–2 lata” to jedno oszacowanie); zawleczenie *Mya arenaria* (~1245–1295 n.e. vs XVI/XVII w.); zasolenie littorynowe „12–18 PSU” to górna granica dla Bałtyku właściwego — rozbijać na baseny.

---

## 3. Rejestr źródeł

Licencje i statusy: [`SOURCES.md`](../../SOURCES.md) (źródło prawdy). **Reguła:** zbiór wchodzi do pipeline'u tylko ze statusem ✅. Status ❓ oznacza „licencja do sprawdzenia na stronie źródła”; jeśli okaże się, że wymaga zapytania albo ma klauzulę ND — zbiór wypada.

### 3.1 Lądolód

| Dane | Źródło | Rola |
| :-- | :-- | :-- |
| Zasięg SIS i innych lądolodów eurazjatyckich, 25–10 ka co 1000 lat, warianty min. / mc / maks. | DATED-1, Hughes i in. 2016, PANGAEA `10.1594/PANGAEA.848117` (CC BY 3.0) ✅ | **jedyna geometria lądolodu** + pas niepewności; obejmuje też lądolód brytyjsko-irlandzki i barencki, widoczne na globie |
| Grubość lodu | **profil plastyczny** liczony od krawędzi DATED-1: `h(d) = √(2·τ₀·d / (ρ_i·g))`, τ₀ ≈ 100 kPa | kopuła ~3000 m przy ~400 km od czoła; `dataQuality: "modelled"`, oznaczona jako schematyczna. Służy wyłącznie do rzeźby 3D i tooltipa — nie wchodzi do paleo-DEM-u (RSL zawiera już obciążenie) |

### 3.2 Model GIA, poziom wody, krzywe

| Dane | Źródło | Rola |
| :-- | :-- | :-- |
| Pola RSL, 1°, 10°W–70°E / 45–85°N, 21,4 ka → 0, 8 modeli Ziemi | **Steffen & Kaufmann 2025**, Zenodo `10.5281/zenodo.15481755` (CC BY 4.0) ✅ | **jedyny model GIA**; obejmuje niemal całą widoczną na globie Europę |
| RSL południowego Bałtyku, 5–25°E / 52–60°N | Steffen & Kaufmann 2025, `10.5281/zenodo.15488259` (CC BY 4.0) ✅ | kontrola zgodności z polem głównym na południowym wybrzeżu |
| Paleo-DEM-y 0,01°, 11,7–0 ka | ESD 16, 585 (2025), Miluch i in. (CC BY 4.0) ✅ | **kontrola** (`V-12`) |
| Walidacja ilościowa (1099 wskaźników RSL) | Rosentau i in. 2021, GFZ `10.5880/GFZ.1.3.2020.003` (CC BY 4.0) ✅ | `V-03`, wybór wiodącego modelu Ziemi |
| Globalny poziom oceanu (eustatyka) co 1 ka | **liczby z literatury**: Lambeck i in. 2014, PNAS 111, 15296 — wartości ESL odczytane z tabeli/wykresu, z cytowaniem | tylko odczyt „ocean −X m” w karcie fazy i linia „ocean” na wykresie krzywych |
| Współczesne wypiętrzanie | NKG2016LU, Vestøl i in. 2019 — licencja siatek ❓ do sprawdzenia u Lantmäteriet | `V-08`; jeśli wymaga zapytania, `V-08` porównuje z wartościami z artykułu (CC BY) |
| Rzędne progów Närke i Billingen | SGU Strandförskjutningsmodell ❓ albo wartości z literatury | `sills.json`; jeśli licencja SGU wymaga zapytania — tylko liczby z publikacji |

**Odrzucone (wymagają zapytania lub mają ND):** ICE-6G_C, GLAC-1D, ANU-ICE (brak licencji), Stroeven i in. 2016 (CC BY-NC-ND). Konsekwencje: brak grubości lodu z modelu (zastąpiona profilem plastycznym), brak pola współczesnej prędkości wypiętrzania (przybliżenie gradientem RSL 0,9 ka → 0), izochrony deglacjacji tylko co 1 ka.

### 3.3 Batymetria, topografia i tło globu

| Dane | Źródło | Rola |
| :-- | :-- | :-- |
| Ląd i dno, okno Bałtyku i domena RSL | GEBCO 2024, 15″ (domena publiczna z atrybucją) ✅ — kafle 0–90°N / 0–90°E (pobrany) i **0–90°N / 90°W–0** (do pobrania, dla 10°W–0) | `H_now` paleo-DEM-u |
| Dno Bałtyku — ulepszenie | EMODnet DTM 2024, 1/16′ ❓ (DataCite nie podaje licencji; sprawdzić na portalu EMODnet) | tylko jeśli licencja otwarta potwierdzi się na stronie |
| Tło globu poza domeną RSL | jak w El Niño: ETOPO2v2c (NOAA, domena publiczna) jako `displacementMap`, Natural Earth SR_50M (domena publiczna) jako cieniowanie, `world-atlas` land-50m (Natural Earth) jako kontur lądu | współczesna Ziemia, przygaszona poza domeną paleo |
| **Ładoga, Onega, Vänern, Vättern** | **GEBCO ma tylko powierzchnię jezior** (sprawdzone: Vänern płasko 44 m, Vättern 88 m). Kandydaci bez zapytania: GLOBathy (Khazaei i in. 2022, CC BY 4.0 — do potwierdzenia), krajowe dane otwarte (Szwecja). Fallback: **parametryczna misa** z opublikowanych głębokości maks./średnich (fakty z literatury), `dataQuality: "modelled"` | progi i odpływy faz jeziornych |
| Kontrola | BSBD (BSHC) ❓ CC BY 3.0 z ograniczeniami; IOWTOPO2 ❓ | tylko jeśli ograniczenia nie wymagają zapytania |

### 3.4 Zasolenie i cieśniny

| Dane | Źródło |
| :-- | :-- |
| Proxy zasolenia i temperatury | IODP Exp. 347, Site M0059 — Kotthoff i in. 2022, PANGAEA `10.1594/PANGAEA.943832` (CC BY 4.0) ✅ |
| Katalog progów | Billingen (58,4°N 13,8°E), Närke (59,1°N 15,0°E), Svea / Degerfors, Dana / Wielki Bełt, Darss, Drogden / Øresund — współrzędne i rzędne z literatury; przesmyk karelsko-białomorski jako hipoteza |
| Gatunki wskaźnikowe | *Portlandia (Yoldia) arctica*, *Ancylus fluviatilis*, *Mastogloia*, *Littorina littorea*, *Limnaea (Radix) balthica*, *Mya arenaria* — tolerancje z literatury |
| Podział na baseny | HELCOM ❓ (sprawdzić licencję na `metadata.helcom.fi`); fallback: własne poligony basenów narysowane z GEBCO |

**Zasolenie jest klasą per basen, nie ciągłym polem.** Makieta koloruje wodę ciągłym gradientem PSU — takiego pola nie ma w żadnym źródle. Aplikacja koloruje wodę klasą basenu (słodki / słonawy / morski) z zakresem `psuRange`, a gradient może być co najwyżej schematycznym przejściem między basenami z flagą `qualitative`.

---

## 4. Metoda

### 4.1 Paleo-DEM co 1000 lat

```python
rsl_t          = interp_time(RSL[model], t)                     # liniowo między nierównymi krokami modelu
paleo_dem(t)   = H_now − resample(rsl_t)                        # §0.1; datum: geoida współczesna t
level(t)       = sill_elevation(active_outlet(t), t)            # fazy jeziorne (BIL, Ancylus)
               | 0                                              # fazy morskie: paleo-DEM już względem morza w t
water_mask(t)  = flood_fill(paleo_dem(t), level(t), seed=active_outlet(t))   # §0.3
ice(t)         = DATED1[t] (mc + min/max)                       # 20–10 ka; młodsze: null
ice_h(t)       = plastic_profile(distance_to_margin(ice(t)))    # tylko do wizualizacji
```

Wybór wiodącego modelu Ziemi spośród 8 wariantów Steffena i Kaufmanna — na podstawie RMSE wobec Rosentaua (`V-03`). Pozostałe warianty mogą dać pas niepewności poziomu wody.

**Domena przestrzenna:** paleo-DEM liczony dla **całej domeny RSL** (10°W–70°E / 45–85°N) w niskiej rozdzielczości (tło globu: Morze Północne jako Doggerland, lądolód brytyjski) i dla **okna Bałtyku** (9–33°E / 53–67°N) w rozdzielczości roboczej. Maska wody, progi, metryki i walidacja — tylko w oknie Bałtyku.

**Projekcje:** przetwarzanie w EPSG:3035 (ETRS89-LAEA), eksport w EPSG:4326.

### 4.2 Metryki bilansowe

Dla każdego przekroju z maski wody: **powierzchnia** (km²), **objętość** (km³), średnia i maksymalna głębokość, szacowany **czas wymiany wód**.

---

## 5. Kontrakt danych (hybrydowy)

Pipeline liczy wszystko, co ma wynik binarny lub wymaga walidacji (maski, progi, metryki). Aplikacja dostaje dodatkowo siatkę wysokości i kostkę RSL, żeby bez kolejnych plików liczyć rzeźbę 3D, przekrój Umeå → Gdańsk, wysokość w tooltipie i krzywą RSL dla klikniętego punktu.

```
src/assets/data/
  manifest.json          # schemaVersion, datum, budżety, sumy kontrolne, siatki, lista klatek
  timeline.json          # 7 faz + przekroje zdarzeniowe
  sources.json           # z SOURCES.md
  events.json            # karty zdarzeń → sources.json
  sills.json             # progi: współrzędne, rzędne, stan per klatka
  taxa.json              # gatunki wskaźnikowe
  grid/
    dem-baltic.bin.gz    # H_now, okno Bałtyku, ~0,04° (~600 × 350, int16) — rzeźba, przekrój, tooltip
    dem-europe.bin.gz    # H_now, domena RSL, ~0,1° — tło paleo na globie
    rsl.bin.gz           # RSL wiodącego modelu, 1°, 19 kroków źródłowych (int16 × 0,01 m, KMDG/1) — app interpoluje
  curves/                # rsl-sites (Rosentau), esl (eustatyka), basin-metrics, uplift
  frames/
    f-<tBP>.json         # poziom, odpływ, stany progów, zasolenie per basen, metryki, dataQuality
    f-<tBP>.topo.json    # water / lake / ice (mc, min, max) / coast — kwantyzowany TopoJSON
```

```jsonc
{
  "id": "f-11000",
  "tBP": 11000,
  "calCurve": "IntCal20",
  "datum": "contemporaneous-geoid",
  "stageId": "yoldia",
  "water": { "type": "sea", "levelM": 0, "outlet": "narke" },
  "salinity": [{ "basin": "gotland", "class": "brackish", "psuRange": [1, 5] }],
  "sills": [{ "id": "billingen", "state": "open", "heightM": -12 }],
  "ice": { "source": "dated1", "interpolated": false, "band": true, "thickness": "plastic-profile" },
  "gia": { "source": "steffen2025_rsl", "earthModel": "sk1" },
  "eslM": -50,
  "metrics": { "areaKm2": 380000, "volumeKm3": 21000 },
  "dataQuality": "interpolated",
  "frame": "frames/f-11000.topo.json",
  "sources": ["andren2011", "dated1", "steffen2025_rsl", "lambeck2014"]
}
```

**Budżet:** ≤ 25 MB całości, ≤ 4 MB przy pierwszym wejściu. Szacunek: siatki i kostka RSL < 1,5 MB, ~27 klatek wektorowych po ~100–200 KB — mieści się z zapasem. Siatki ładowane od razu (potrzebne do każdej klatki), klatki leniwie wokół bieżącej.

**i18n.** Dane noszą wyłącznie identyfikatory; chrome UI w `Dict`, długie teksty w `src/assets/content/{en,pl}/*.json`. **Brak tłumaczenia = błąd builda.**

**`sources.json` jest obowiązkowy** — wymóg atrybucji CC BY i domeny publicznej GEBCO.

### 5.1 Scena: glob jak w El Niño — wymagania na dane

Na podstawie makiety (`claude.ai/artifact/4mtm5Y44DWh7ufwyXKAKi5`) i decyzji z 2026-10-31.

- **Z `kmd-labs/el-nino` bierzemy wyłącznie glob i relief** (decyzja z 2026-10-31): renderer, scena i kamera three.js z `OrbitControls`, sfera z teksturą lądu na płótnie equirectangular (`world-atlas` land-50m przez `d3-geo`), `displacementMap` z ETOPO2v2c (`elevation.png`), cieniowanie rzeźby z Natural Earth SR_50M (`relief.bin.gz` / `relief-2k.bin.gz`), poświata, kolory z `ThemeService`. **Cała reszta El Niño jest pomijana:** pole SST i przekolorowanie tekstury, warstwa bieżącej pogody, regiony wpływu i ich modale, bokeh, autoobrót, serwisy ENSO, analytics.
- **Tylko wycinek kuli (decyzja z 2026-10-31, wieczór):** rysowana jest wyłącznie domena RSL Steffena i Kaufmanna (10°W–70°E / 45–85°N) jako zakrzywiony płat sfery na tle strony; reszta globu jest wycięta, a ETOPO2 / Natural Earth / world-atlas nie są już używane. Siatki: `dem-europe` 1/20° dla całej domeny (mozaika dwóch kafli GEBCO) i `dem-baltic` 1/40°. Wypełnianie wody i poziom progów — tylko w oknie Bałtyku; poza nim woda to `H_paleo < 0`.
- **Kamera wycentrowana na Bałtyku:** start zbliżony na obszar zainteresowania (okno Bałtyku, ~20°E / 58°N), zoom tylko w zakresie od „okno Bałtyku” do „cała Europa” (`minDistance` / `maxDistance`), `enablePan = false`, bez autoobrotu. **Próba obrócenia globu nie obraca go:** przeciągnięcie daje lekkie przechylenie (`minAzimuthAngle` / `maxAzimuthAngle`, `minPolarAngle` / `maxPolarAngle`), a po puszczeniu kamera sprężyście wraca i **centruje się z powrotem na Bałtyku**.
- **Prototypy danych oglądamy na globie.** Już pierwszy prototyp paleo-DEM-u (`C-03`) jest wizualizowany na tym globie, nie na osobnej mapie 2D.
- **Paleo na globie:** w domenie RSL tekstura i `displacementMap` są generowane per klatka z `dem-europe` / `dem-baltic` − RSL(t), z maską wody i lodu z klatki; poza domeną — współczesna Ziemia, przygaszona.
- **Z makiety zostaje:** dock z osią czasu (play, kroki, markery zdarzeń, pasma faz), karta fazy (nazwa, typ wody, PSU, `dataQuality`, `datum`, flaga „sporne”, poziom model vs literatura, odpływ, powierzchnia, objętość, ocean −X m), przekrój Umeå → Gdańsk, krzywe RSL (Umeå, Sztokholm, Gdańsk + kliknięty punkt + ocean), tooltip (współrzędne, typ wody, PSU, grubość lodu, wysokość wzgl. ówczesnego oceanu i dziś), progi z tooltipem stanu, przewyższenie 3D, słowniczek, źródła.
- **Z makiety wypada:** widoki Fanerozoik / Czwartorzęd / Wybrzeża, warstwa „Zatopione lasy”, lista źródeł z ICE-6G_C, Stroevenem, LR04, PALEOMAP i PhanDA. „Brzeg −500 lat” → „Brzeg −1000 lat”.
- **Do rozstrzygnięcia:** co przełącza dropdown w prawym górnym rogu (wymagany przez `AGENTS.md` §2). Propozycja: tryby kolorowania globu — Paleogeografia / Zasolenie / Lądolód.

---

## 6. Pipeline w repo

```
tools/data/
  fetch.py             # pobieranie + sumy kontrolne (gotowe, tura 1)
  postglacial.py       # mozaika + jeziora + RSL → paleo-DEM → flood-fill → wektoryzacja
  ice.py               # DATED-1 → geometria per klatka + profil plastyczny grubości
  curves.py            # Rosentau, eustatyka, NKG / gradient RSL, metryki → curves/
  calibrate.py         # IntCal20: ¹⁴C BP → cal yr BP
  validate.py          # raport walidacyjny (§7)
  emit.py              # siatki, kostka RSL, TopoJSON, manifest
```

Stack: `xarray` + `netCDF4`, `rasterio`, `geopandas`, `shapely`, `pyogrio`, `scipy.ndimage`, `pyproj`; `mapshaper`/`topojson` do uproszczenia. Pipeline **idempotentny i offline po pierwszym pobraniu**.

### Kolejność prac

1. **Dziś, bez zależności:** decyzja licencyjna (`0-02`), kontrakt hybrydowy (`0-06`), czysty klon (`0-01`), tura 2 pobierania (`0-05`).
2. **Ścieżka krytyczna faz morskich:** mozaika (`C-01`) → paleo-DEM co 1 ka (`C-03`) → flood-fill (`C-04`) → emisja (`C-11`, `I-01`) → glob (`I-05`, `I-02`). Dane z tury 1 już leżą lokalnie.
3. **Równolegle:** lądolód z DATED-1 (`C-07`), krzywe (`C-12`), katalog progów (`C-05`), research batymetrii jezior (`C-02`).
4. **Fazy jeziorne** (`C-06`, `C-14`, `C-15`) po katalogu progów i jeziorach.

---

## 7. Weryfikacja

`tools/data/validate.py` produkuje raport i kończy się błędem przy przekroczeniu progów. Używa **wyłącznie** zbiorów ✅ — także walidacja nie korzysta z ICE-6G_C ani ze Stroevena.

- **Sill-check:** jezioro zaporowe wymaga progu **powyżej** ówczesnego oceanu, połączenie morskie **poniżej**. Najgroźniejsza klasa błędu (§0.1–0.2).
- **RSL wobec Rosentaua 2021:** RMSE per region i per klaster; jednocześnie wybór wiodącego modelu Ziemi.
- **Kontrola zdarzeń:** spadek Billingen 25–28 m; highstand 7,5–6,5 ka BP; Littorina w Małym Bełcie ~7,4 ka cal BP.
- **Gatunki wskaźnikowe:** zasolenie w miejscu i czasie wystąpienia w tolerancji z `taxa.json`.
- **Współczesne wypiętrzanie:** gradient RSL 0,9 ka → 0 jako przybliżenie prędkości vs NKG2016LU (lub wartości z artykułu): maks. ~10,3 mm/rok przy Umeå, linia zerowa na wybrzeżu DE/PL.
- **Chronologia:** zgodność z Andrén i in. 2011.
- **Topologia i budżet:** brak samoprzecięć, spójny CRS, ≤ 25 / 4 MB, sumy w `manifest.json`.
- **Kontrola wizualna:** nakładki na mapy Björcka 1995 / Andréna 2011 (11,7 / 11,1 / 10,5 ka) i na paleo-DEM-y ESD 2025 (11,7–0 ka).

### End-to-end

```powershell
git submodule update --init
npm ci
npm run data:fetch
npm run data:build          # → raport walidacyjny + src/assets/data/
npm start
npm run build:gh-pages
```

---

## 8. Ryzyka

| Ryzyko | Reakcja |
| :-- | :-- |
| Podwójne liczenie eustatyki | §0.1; eustatyka tylko do odczytu w UI; sill-check |
| Fazy jeziorne policzone eustatycznie | poziom z rzędnej progu; `datum` obowiązkowy |
| Fałszywe jeziora | flood-fill z zasiewem, nie próg |
| Jeden model GIA (ANU-ICE 1998, 1°) bez alternatywy | 8 modeli Ziemi jako pas niepewności; RMSE wobec Rosentaua; ESD 2025 jako niezależna kontrola 11,7–0 ka |
| Krok 1 ka gubi szybkie zdarzenia | przekroje zdarzeniowe (Billingen, Ancylus, Littorina) |
| Brak grubości lodu z modelu | profil plastyczny z DATED-1, oznaczony jako schematyczny |
| Brak batymetrii jezior | GLOBathy po weryfikacji licencji albo parametryczna misa z literatury |
| Zbiór ❓ okaże się wymagać zapytania | wypada; każdy ma fallback z literatury lub GEBCO (§3) |
| Ciągłe pole zasolenia sugerowane przez makietę | klasa per basen; gradient tylko schematyczny z flagą `qualitative` |
| Szew domeny paleo / współczesnej na globie | przygaszenie poza domeną RSL, jawna granica w legendzie |

---

## 9. Artefakty dokumentacyjne

`docs/research/baltic-data-catalog.md` — linki, licencje, formaty; tabela korelacji cal yr BP ↔ ¹⁴C BP ↔ BCE/CE dla 7 faz; parametry liczbowe per przekrój; współrzędne punktów kluczowych; tabela eustatyki co 1 ka z cytowaniem.

`docs/research/paleo-reconstruction-methodology.md` — specyfikacja: plik i zmienna RSL, interpolacja w czasie, resampling, profil plastyczny lodu, transformacja datum dla `V-03`.

`SOURCES.md` — pełne cytowania i licencje; źródło prawdy dla `sources.json`.
