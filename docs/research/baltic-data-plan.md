# Baltic — warstwa danych: paleogeograficzna ewolucja Morza Bałtyckiego

> Plan researchu i inżynierii danych. Dokument żywy — aktualizowany w miarę weryfikacji źródeł.

## Context

W repozytorium stoi świeży scaffold KMD (Angular 21, `f3c4f6d`): `AppComponent`, i18n EN/PL, submoduł design-systemu — zero logiki domenowej i zero danych. UI jest przesądzone przez `AGENTS.md` i **świadomie poza zakresem tego planu**. Plan odpowiada na jedno pytanie: skąd wziąć dane, jak je przetworzyć i w jakim kontrakcie wystawić aplikacji.

Dokument jest scaleniem dwóch planów: wcześniejszego (reżimy czasowe, kontrakt danych, budżety) i zewnętrznego planu researchu (7 faz postglacjalnych, katalog progów, biostratygrafia, sill-check). Z obu wzięte są mocne strony; z drugiego usunięty jest błąd w formule paleo-DEM (§0).

**Ustalenia zakresowe:**
- Zakres czasowy: **pełny Fanerozoik, trzy równorzędne reżimy** (541 Ma / czwartorzęd / postglacjał).
- Paleogeografia: **hybrydowo** — policzony paleo-DEM weryfikowany literaturą.
- Warstwy: **lądolód**, **zasolenie i połączenie z oceanem**, **krzywe poziomu wody i wypiętrzania**. Archeologia i paleoklimat jako warstwa narracyjna — poza zakresem (wyjątek: zatopione lasy, patrz §3.4).
- Rozdzielczość postglacjalna: **500 lat**.
- Mikroskala: **symetrycznie dla czterech wybrzeży** — Polska, Szwecja, Estonia, Dania.

To największy z rozważanych zakresów: cztery niezależne pipeline'y i cztery krajowe zbiory wysokościowe do zharmonizowania. Kolejność prac w §6 jest dobrana tak, by działająca aplikacja powstała przed ukończeniem całości.

---

## 0. Poprawki blokujące wobec planu wejściowego

Trzy rzeczy do naprawienia, zanim powstanie pierwsza linia kodu ETL.

### 0.1 Formuła paleo-DEM podwójnie liczy eustatykę

Plan wejściowy podaje:

```
H_paleo(x,y,t) = H_now(x,y) + ΔGIA(x,y,t) − ΔEustatic(t)        ← BŁĘDNE
```

Formuła nie nazywa pola modelu GIA, które konsumuje. Przy najbardziej naturalnym odczycie — `Topo` / `Topo_Diff` z ICE-6G_C — paleotopografia jest podana **względem współczesnej sobie powierzchni morza**, czyli już zawiera składnik eustatyczny i geoidalny. Odjęcie `ΔEustatic(t)` liczy ten sam sygnał drugi raz, na dziesiątki metrów. Znak przy `ΔGIA` jest dodatkowo dwuznaczny: jeśli to wypiętrzenie od czasu *t*, cofając się w czasie trzeba je odjąć, nie dodać.

Obowiązuje:

```
H_paleo(x,y,t) = H_now(x,y) + [Topo(t) − Topo(0)]               ← bez osobnego członu eustatycznego
```

Osobny człon RSL jest uprawniony **tylko** przy czystym polu odkształcenia sprężystego bez członu oceanicznego. W `paleo-reconstruction-methodology.md` (§9) formuła musi wskazywać **plik i nazwę zmiennej**, nie pojęcie.

### 0.2 Datum wyniku musi być zapisany w kontrakcie

Poziomy faz jeziornych (+25 m BIL, +10 m Ancylus) jako skalary są poprawne **wyłącznie** dla paleo-DEM-u wyrażonego względem współczesnej sobie geoidy — powierzchnia jeziora jest wtedy powierzchnią ekwipotencjalną, czyli stałą. Zalanie DEM-u w **dzisiejszym** układzie wysokościowym tą samą liczbą daje wynik jawnie fałszywy, bo rebound jest silnie zróżnicowany przestrzennie (>285 m w Zatoce Botnickiej vs ~0 na wybrzeżu Polski). Pole `datum` jest obowiązkowe w `manifest.json` i w każdej klatce, z wartościami per reżim: `contemporaneous-geoid` (C), `EVRF2007` (D — dzisiejszy układ wysokościowy), paleo-poziom morza PaleoDEM-u (A). Porównania między reżimami C i D wymagają jawnej transformacji, opisanej w `paleo-reconstruction-methodology.md`.

### 0.3 Maska wody wymaga flood-fill, nie progu

Prosty próg `H < poziom` tworzy fałszywe jeziora w każdym zamkniętym obniżeniu terenu. Zbiornik musi być **hydrologicznie połączony z progiem odpływu** — analiza spójnych składowych z zasiewem w cieśninie aktywnej dla danego *t*. Przy ~47 przekrojach × 4 regiony mikroskalowe to krok obowiązkowy, nie optymalizacja.

---

## 1. Cztery reżimy danych

Fanerozoik nie jest „dłuższą osią czasu" — to inna klasa danych. Jeden pipeline ich nie obsłuży.

| Reżim | Czas | Krok | Klatki | Charakter |
| :-- | :-- | :-- | :-- | :-- |
| **A. Fanerozoik** | 541 → 2,6 Ma | 5 Ma | ~108 | gotowe globalne paleo-DEM-y + rotacje płyt; Bałtyku **nie ma** — opowieść o kratonie Baltiki i basenie bałtyckim |
| **B. Czwartorzęd** | 2,6 Ma → 20 ka | zdarzenia | 8–12 kart | **luka danych** — brak rekonstrukcji GIS w tej rozdzielczości; narracja jakościowa + LR04 |
| **C. Postglacjał** | 20 ka → 0 | 500 lat | 41 + ~6 zdarzeniowych | rdzeń: własny paleo-DEM z modelu GIA, lądolód, zasolenie |
| **D. Mikroskala** | 12 ka → 0 | fazowo | ~10 × 4 regiony | PL / SE / EE / DK — formy brzegowe na krajowych danych LiDAR |

**Decyzja o kroku w reżimie C.** Plan wejściowy proponował 500 lat dla 20–8 ka i 1000 lat dla 8–0 ka. Odrzucone: transgresja littorynowa, formowanie mierzei i jezior przybrzeżnych mieszczą się w 8–0 ka, a to właśnie materiał reżimu D. Obowiązuje **jednolite 500 lat dla 20–0 ka** (41 klatek) plus przekroje zdarzeniowe: przed i po drenażu Billingen, maksimum ancylusowe, próg regresji ancylusowej, początek ingresji littorynowej, maksimum littorynowe.

**Uczciwość w reżimach A i B jest wymogiem, nie ozdobą.** W A pokazujemy region, nie morze — nazwa „Bałtyk" przed ~1 Ma jest anachronizmem. W B trzeba oznaczyć niedobór danych flagą `dataQuality`, inaczej aplikacja sugeruje precyzję, której źródła nie mają.

---

## 2. Chronologia reżimu C: siedem faz

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

### 3.1 Reżim A — Fanerozoik

| Dane | Źródło | Format | Licencja |
| :-- | :-- | :-- | :-- |
| Paleo-DEM globalny, 0–540 Ma co 5 Ma (117 siatek) | PALEOMAP PaleoDEMs, Scotese & Wright 2018 — `10.5281/zenodo.5460860` | netCDF 0,1°; txt 1° | CC BY 4.0 |
| Paleolinie brzegowe + krawędź szelfu (izobata −1400 m) | PaleoMAP PaleoCoastlines v7, Kocsis & Scotese 2020 — `10.5281/zenodo.4017820` | Shapefile | CC BY 4.0 |
| Rotacje płyt → trajektoria Baltiki | GPlates 2.5 GeoData bundle (Zenodo): **model PALEOMAP** (ten sam układ co PaleoDEM-y i PaleoCoastlines); Merdith i in. 2021 (1000–0 Ma) jako niezależna kontrola trajektorii | `.rot` + `.gpml` | CC BY 4.0 |
| Rekonstrukcja bez lokalnego GPlates | GPlates Web Service `gws.gplates.org` (`/reconstruct/reconstruct_points/`, `/reconstruct/coastlines/`) | GeoJSON | API |
| Temperatura i CO₂, 485 Ma → 0 | PhanDA, Judd i in. 2024 — `github.com/EJJudd/PhanDA`, `5_Output/PhanDA_GMSTandCO2_percentiles.csv` | CSV, percentyle 5/16/50/84/95 | do weryfikacji |
| Stratygrafia basenu (opcjonalnie) | Macrostrat API | JSON | CC BY 4.0 |

Zdarzenia kamieniste reżimu A — ręcznie opisane z cytowaniami, **nie generowane**: Morze Tornquista i Iapetus, kambryjsko-sylurska pokrywa epikontynentalna, orogeneza kaledońska (~430–400 Ma, Baltika + Laurencja → Laurussia), dewoński Old Red, permski Zechstein, subsydencja i inwersja bruzdy śródpolskiej, kenozoiczne wypiętrzenie Fennoskandii.

### 3.2 Reżim B — Czwartorzęd

| Dane | Źródło | Uwagi |
| :-- | :-- | :-- |
| Cykle glacjalne (δ¹⁸O) | stos bentoniczny LR04, Lisiecki & Raymo 2005 | jedyna gęsta, ciągła krzywa dla tego reżimu |
| Geneza misy bałtyckiej | *Origin of the Baltic Sea basin by Pleistocene glacial erosion*, GFF 2020, `10.1080/11035897.2020.1781246` | erozja ost. 1 Ma: ~20 m w podłożu krystalicznym, ~40 m w osadowym; Rynna Landsort 459 m (strop skalny 518 m) |
| Morze Eemskie (~130–115 ka) | przegląd Gibbard i in. 2026, *Boreas*, `10.1111/bor.70040`; EGQSJ 73, 217 (2024) dla SW Bałtyku | brak gotowych warstw GIS — mapy schematyczne |
| System rzeczny Eridanos (12 Ma → ~1 Ma) | literatura o delcie Eridanos w basenie Morza Północnego | najlepszy pomost narracyjny A→C: rzeka drenująca tarczę przez dzisiejszą misę; zanik ~1 Ma, gdy lądolody wyorały misę |

### 3.3 Reżim C — Postglacjał

**Lądolód**

| Dane | Źródło | Uwaga |
| :-- | :-- | :-- |
| Izochrony deglacjacji Fennoskandii, 22,0–9,7 ka cal BP | **Stroeven i in. 2016**, *QSR* | **źródło pierwszego wyboru** — gęstsze niż DATED-1 i dokładniejsze w niecce bałtyckiej; decyduje o momencie otwarcia Billingen |
| Zasięg SIS 25–10 ka co 1000 lat, warianty min./najbardziej prawdopodobny/maks. | DATED-1, Hughes i in. 2016, PANGAEA `10.1594/PANGAEA.848117` | **pas niepewności**, nie geometria wiodąca |
| Grubość lodu | ICE-6G_C (VM5a) `stgit`; alternatywa **GLAC-1D** | kopuła 2500–3000 m w centrum → 0 m na czole |

**Batymetria i topografia bazowa** — zakres **9°E–33°E, 53°N–67°N**

| Dane | Źródło | Rozdz. | Licencja |
| :-- | :-- | :-- | :-- |
| Dno Bałtyku, Cieśnin Duńskich, Kattegatu | EMODnet Digital Bathymetry **DTM 2024** | 1/16′ ≈ 115 m, 59 kafli | CC BY 4.0 |
| Ląd wokół Bałtyku | Copernicus DEM / GEBCO 2024 | 30 m / 15″ | atrybucja |
| **Ładoga, Onega, Vänern, Vättern** | krajowe batymetrie jeziorne | — | per kraj |
| Kontrola | BSBD (BSHC) `bshc.pro/data`; IOWTOPO2 | 500 m | CC BY 3.0 **+ ograniczenia** |

> Batymetria wielkich jezior nie jest dodatkiem. Vänern i Vättern leżą na trasie Rzeki Svea i korytarza Billingen, Ładoga była częścią basenu w kilku fazach. Bez nich drenaży nie da się zamodelować — pipeline wygeneruje jeziora bez odpływu.

**Izostazja i poziom wody**

| Dane | Źródło | Uwaga |
| :-- | :-- | :-- |
| Model GIA → paleotopografia | ICE-6G_C (VM5a), Peltier i in. 2015, `atmosp.physics.utoronto.ca/~peltier/data.php` | netCDF 1°, `Topo`, `Topo_Diff`; 122 ka → 0. **Licencja do potwierdzenia** |
| Rekonstrukcje linii brzegowych Szwecji | **SGU Strandförskjutningsmodell** | obejmuje Cieśninę Närke i korytarz Billingen — luka bazy Rosentaua jest właśnie w Szwecji |
| Walidacja ilościowa (1099 wskaźników RSL) | **Rosentau i in. 2021**, GFZ Data Services `10.5880/GFZ.1.3.2020.003` | format HOLSEA; klastry: regresja / transgresja / przejściowe |
| Wzorzec metodyczny i cross-check | ESD 16, 585 (2025), paleo-DEM-y co 500 lat na GEBCO_2023 z korektą ancylusową za Uścinowiczem | niezależna implementacja tego samego pipeline'u, CC BY |
| Współczesne wypiętrzanie | NKG2016LU, Vestøl i in. 2019 | maks. 10,3 mm/rok przy Umeå; linia zerowa na wybrzeżu DE/PL |
| Projekt SINCOS | RSL dla SW Bałtyku | uzupełnienie dla strefy niemieckiej |

**Zasolenie i cieśniny**

| Dane | Źródło |
| :-- | :-- |
| Proxy zasolenia i temperatury | **IODP Exp. 347, Site M0059** — Kotthoff i in. 2022, PANGAEA `10.1594/PANGAEA.943832` (okrzemki, palinomorfy, geochemia); przejście do Littoriny w ~200 lat około 7,4 ka cal BP |
| Katalog progów i cieśnin | współrzędne + rzędne progowe + okresy aktywności: **Billingen** (58,4°N 13,8°E), **Närke** (59,1°N 15,0°E), **Svea / Degerfors**, **Dana / Wielki Bełt**, **Darss**, **Drogden / Øresund**; przesmyk karelsko-białomorski oznaczony jako *hipoteza historyczna, nie konsensus* |
| Gatunki wskaźnikowe | *Portlandia (Yoldia) arctica*, *Ancylus fluviatilis*, okrzemki *Mastogloia*, *Littorina littorea*, *Limnaea (Radix) balthica*, *Mya arenaria* — tolerancja zasolenia i temperatury jako **niezależna kontrola** rekonstrukcji |
| Zlewnia i podział na baseny | HELCOM `metadata.helcom.fi` (ETRS89-LAEA) |

### 3.4 Reżim D — mikroskala czterech wybrzeży

Każdy region: krajowy DEM wysokiej rozdzielczości + krajowa rekonstrukcja paleogeograficzna + krzywa RSL.

| Region | DEM | Paleogeografia i RSL | CRS / datum wys. |
| :-- | :-- | :-- | :-- |
| **Polska** | GUGiK NMT z LiDAR (ISOK), 1 m / 5 m | Uścinowicz 2003, 2006, 2014; Sydor & Uścinowicz 2022 (Zalew Szczeciński, Zatoka Pomorska); PIG-PIB | EPSG:2180 / PL-EVRF2007-NH |
| **Szwecja** | Lantmäteriet GSD-Höjddata, 2 m | SGU Strandförskjutningsmodell; Påsse & Andersson | EPSG:3006 / RH 2000 |
| **Estonia** | Maa-amet LiDAR DEM, 1 m / 5 m | rekonstrukcje Rosentaua i zespołu z Tartu (SW Estonia, Pärnu) | EPSG:3301 / EH2000 |
| **Dania** | DHM/Terræn (SDFI Dataforsyningen), 0,4 m | Bennike & Jensen; GEUS — Cieśniny Duńskie | EPSG:25832 / DVR90 |

**Formy do odwzorowania:** Ławica Słupska i Odrzańska, Mierzeja Helska i Wiślana, Zalew Szczeciński, Łebsko i Gardno (PL); wynurzanie szkierów i Höga Kusten (SE); Zatoka Pärnu i Sõrve (EE); otwieranie Wielkiego Bełtu i Øresundu (DK).

**Zatopione lasy reliktowe** — pnie sosen i dębów in situ na 15–30 m w rejonie Czołpina, Rowów, Zatoki Gdańskiej i Puckiej, datowane ¹⁴C na 10 500–8 500 cal BP. Pełnią **podwójną rolę**: są treścią narracyjną i jednocześnie **punktowymi wskaźnikami RSL** do walidacji paleo-DEM-u. Baza SPLASHCOS jako punkt wejścia (projekt SUBLAND — dostępność do weryfikacji). To jedyny element „człowiek i środowisko", który wchodzi do zakresu, i wchodzi jako dane walidacyjne.

> **Granica metodyczna reżimu D.** Model GIA ma siatkę 1°×1°; krajowy LiDAR ma 1 m. Downscaling linii brzegowej sterowanej GIA do rozdzielczości metrowej byłby pozorną precyzją. Reżim D jest więc **zestawem osobnych wstawek** napędzanych krajowymi rekonstrukcjami i krzywymi RSL, a nie zagęszczeniem reżimu C. Klatki tylko dla faz, w których historia regionu się zmienia (~10 na region), nie wszystkie 41.

**Harmonizacja wysokości — łatwy do przeoczenia blocker.** Cztery kraje, cztery układy wysokościowe (PL-EVRF2007-NH, RH 2000, EH2000, DVR90) i cztery CRS. Wszystko musi przejść na **EVRF2007/EVRS** przed jakimkolwiek porównaniem z wyjściem modelu GIA. Rozbieżności między datami to dziesiątki centymetrów — przy rekonstrukcji wybrzeża płaskiego, jak polskie, to metry linii brzegowej.

---

## 4. Metoda

### 4.1 Reżim A: rekonstrukcja regionu, nie wycinanie prostokąta

Najczęstszy błąd przy głębokim czasie: wycięcie stałego okna lat/lon z globalnej siatki. Baltika wędrowała — w kambrze leżała na półkuli południowej — więc stałe okno pokazałoby inny fragment Ziemi.

1. Zdefiniuj poligon ROI (dzisiejsza misa + otaczający kraton), przypisz **plate ID** Baltiki.
2. Dla każdego kroku 5 Ma odwróć rotację ROI do pozycji paleo (pyGPlates/gplately lokalnie, GWS jako fallback).
3. Wytnij `PaleoDEM(t)` zrekonstruowanym ROI.
4. Weź linię brzegową i krawędź szelfu z PaleoCoastlines v7 dla tego samego kroku (spójne — liczone z tych samych DEM-ów).
5. Metryki na klatkę: paleoszerokość centroidu, udział powierzchni zalanej, średnia głębokość.

### 4.2 Reżim B: jawna luka

Bez klatek paleogeograficznych. Produkt: `events.json` + krzywa LR04 + 2–3 mapy schematyczne (Eemian, maksimum Weichselu, Eridanos). W kontrakcie `regime: "quaternary"`, `dataQuality: "qualitative"`.

### 4.3 Reżim C: paleo-DEM co 500 lat

```python
paleo_dem(t)   = modern_dem + resample(Topo(t) − Topo(0))      # §0.1; datum: geoida współczesna t
level(t)       = sill_elevation(active_outlet(t), t)           # fazy jeziorne
               | gia_sea_level(t)                              # fazy morskie
water_mask(t)  = flood_fill(paleo_dem(t), level(t),
                            seed=active_outlet(t))             # §0.3, nie próg
```

Sedno poprawności: w fazach jeziornych powierzchnia wody **nie jest** globalnym poziomem morza — wyznaczał ją próg odpływu. Fazy morskie (Yoldia, Mastogloia, Littorina, współczesna) → poziom z modelu GIA. Fazy jeziorne (BIL, Ancylus) → rzędna progu w ramie `t` + wartości z literatury.

Lądolód: Stroeven jako geometria wiodąca, DATED-1 jako pas min./maks. przeniesiony **do danych**. Każda klatka interpolowana dostaje `ice.interpolated: true` — to najtańszy sposób pokazania, że rekonstrukcja ma margines. Stroeven kończy się na 9,7 ka, DATED-1 na 10 ka — klatki młodsze mają `ice: null`.

Zasolenie: klasa reżimu (słodki / słonawy / morski) per faza z IODP 347 i okrzemek, plus **stan każdego progu** (otwarty/zamknięty) i profil przestrzenny Cieśniny Duńskie → Basen Gotlandzki → Zatoka Botnicka.

**Projekcje:** przetwarzanie reżimu C w EPSG:3035 (ETRS89-LAEA, konwencja HELCOM), eksport w EPSG:4326. Reżim A w EPSG:4326. Reżim D w CRS krajowym, eksport w 4326.

### 4.4 Metryki bilansowe (wszystkie reżimy)

Z paleo-DEM-u policzyć dla każdego przekroju: **powierzchnię** (km²), **objętość** (km³), średnią i maksymalną głębokość, oraz szacowany **czas wymiany wód**. Niemal darmowe, a dają cztery dodatkowe krzywe i kontrolę sensowności.

---

## 5. Kontrakt danych

Katalog `src/assets/data/` (objęty `assets` w `angular.json:23`), wersjonowany polem `schemaVersion`:

```
src/assets/data/
  manifest.json          # schemaVersion, datum, budżety, sumy kontrolne, mapa chunków
  timeline.json          # uporządkowane epoki/fazy — szkielet całej aplikacji
  sources.json           # rejestr źródeł: DOI, licencja, tekst atrybucji
  events.json            # karty zdarzeń → odsyłacze do sources.json
  sills.json             # katalog progów: współrzędne, rzędne, okresy aktywności
  taxa.json              # gatunki wskaźnikowe: tolerancja zasolenia i temperatury
  curves/                # rsl-sites, gmst-co2, uplift-nkg, lr04, basin-metrics
  frames/
    phanerozoic/         # ~108, krok 5 Ma
    postglacial/         # 41 + ~6 zdarzeniowych, krok 500 lat
    regional/{pl,se,ee,dk}/   # ~10 na region
```

```jsonc
{
  "id": "ancylus-max",
  "regime": "postglacial",            // phanerozoic | quaternary | postglacial | regional
  "tBP": 10500,                        // cal yr BP; reżim A: "tMa"
  "t14C": 9300,                        // oryginalna data niekalibrowana, jeśli z literatury
  "calCurve": "IntCal20",
  "datum": "contemporaneous-geoid",    // §0.2 — obowiązkowe
  "stageId": "ancylus",
  "water": { "type": "lake", "levelM": 10.0, "outlet": "svea" },
  "salinity": { "class": "fresh", "psuRange": [0, 0.5] },
  "ice": { "source": "stroeven2016", "interpolated": false, "band": "dated1" },
  "metrics": { "areaKm2": 420000, "volumeKm3": 23000 },
  "dataQuality": "modelled",           // modelled | interpolated | qualitative
  "frame": "frames/postglacial/f-10500.topo.json",
  "sources": ["bjorck1995", "andren2011", "rosentau2021", "stroeven2016"]
}
```

**Geometria: TopoJSON, nie rastry.** Plan wejściowy proponował wystawić rastrowe „Paleo-DEM Time Slices / Delta Grids" jako artefakt runtime'owy. W zakresie 9–33°E / 53–67°N przy rozdzielczości EMODnet (~115 m) to siatka rzędu 20 000 × 15 000 komórek **na przekrój** — przy ~47 przekrojach to nie jest aplikacja webowa. Obowiązuje: warstwy `land` / `water` / `ice` / `lake` / `rivers` jako kwantyzowany, uproszczony TopoJSON; raster (hipsometria) tylko jako opcjonalny, leniwy chunk w obniżonej rozdzielczości.

**Budżet:** ≤ 25 MB całości, ≤ 4 MB przy pierwszym wejściu. Chunki per reżim i per region, ładowane leniwie — nikt nie potrzebuje 108 klatek fanerozoiku ani czterech wybrzeży na starcie. Deploy idzie na GitHub Pages (`npm run build:gh-pages`), więc rozmiar jest realnym ograniczeniem, pilnowanym w CI.

**i18n.** `AGENTS.md` wymaga zera zahardkodowanych stringów i równoległości EN/PL. Przy ~150 kartach zdarzeń, progów i taksonów trzymanie wszystkiego w `Dict` rozsadziłoby `en.ts`/`pl.ts`. Obowiązuje: **dane noszą wyłącznie identyfikatory**; chrome UI zostaje w `Dict` (`src/app/core/i18n/i18n.types.ts`, `en.ts`, `pl.ts` — rozszerzyć o klucze faz i warstw), a długie teksty idą do `src/assets/content/{en,pl}/*.json`, ładowane reaktywnie na podstawie sygnału `lang` z `I18nService`. Litera reguły zachowana, słowniki nie puchną. **Brak tłumaczenia = błąd builda.**

**`sources.json` jest obowiązkowy, nie kosmetyczny** — niemal każdy zbiór to CC BY, co nakłada wymóg atrybucji. Ten plik napędza panel „Źródła" i jest warunkiem legalności publikacji.

---

## 6. Pipeline w repo

```
tools/data/
  fetch.py             # pobieranie po DOI + weryfikacja sum kontrolnych
  phanerozoic.py       # reżim A: pygplates/gplately + PaleoDEM + PaleoCoastlines
  postglacial.py       # reżim C: EMODnet+jeziora + ICE-6G → paleo-DEM → flood-fill → wektoryzacja
  regional.py          # reżim D: 4 krajowe DEM-y, harmonizacja CRS i datum wysokościowego
  curves.py            # RSL, GMST/CO2, NKG2016LU, LR04, metryki basenu → curves/
  calibrate.py         # IntCal20: ¹⁴C BP → cal yr BP dla dat z literatury
  validate.py          # raport walidacyjny (§7)
  emit.py              # TopoJSON, kwantyzacja, uproszczenie, manifest
data/raw/              # .gitignore
data/interim/          # .gitignore
SOURCES.md             # pełne cytowania + licencje — źródło prawdy dla sources.json
```

Stack: `xarray` + `rioxarray`, `rasterio`, `geopandas`, `shapely`, `pyogrio`, `gplately`/`pygplates`, `scipy.ndimage` (flood-fill), `pyproj` (CRS + datum wysokościowy); `mapshaper`/`topojson` do uproszczenia. Wejście: `npm run data:build` (nowy skrypt w `package.json`, obok `setup:github`). Pipeline **idempotentny i offline po pierwszym pobraniu** — surowe dane poza gitem, assety wyjściowe w gicie.

### Kolejność prac

1. **Sprzątanie startowe** — submoduł `src/design-system` jest niezainicjowany (`git submodule status` → `-5f5a67b`, katalog pusty); `git submodule update --init` przed czymkolwiek, inaczej build nie przejdzie.
2. **Reżim C od końca ku początkowi** — najpierw dziś → 8 ka (najlepsze dane), potem fazy jeziorne (najtrudniejsze, bo próg zamiast eustatyki). Najszybsza droga do działającej aplikacji.
3. **Krzywe i katalogi** (`curves/`, `sills.json`, `taxa.json`) — tanie, a natychmiast weryfikowalne wobec literatury; `sills.json` jest warunkiem sill-checku, zasolenia i maski faz jeziornych, więc powstaje razem z paleo-DEM-em (M2), nie po reżimie C.
4. **Reżim A** — osobny, niezależny pipeline.
5. **Reżim D, region po regionie** — kolejność PL → DK → SE → EE (malejąca dostępność gotowych rekonstrukcji). Każdy region to zamknięta porcja pracy, można przerwać po dowolnym.
6. **Reżim B** — ostatni, głównie treść redakcyjna.

---

## 7. Weryfikacja

`tools/data/validate.py` produkuje raport i kończy się błędem przy przekroczeniu progów.

**Sill-check (bilans wysokościowy na progach).** Dla każdego przekroju sprawdzić, czy rzędna progu zgadza się z kierunkiem przepływu: jezioro zaporowe wymaga progu **powyżej** ówczesnego poziomu oceanu, połączenie morskie **poniżej**. Test wewnętrznie spójnościowy — nie wymaga danych zewnętrznych, a wyłapuje dokładnie tę klasę błędu, która jest tu najgroźniejsza (§0.1–0.2). Uruchamiany dla wszystkich progów z `sills.json`.

**RSL wobec obserwacji.** Policzony poziom w punktach bazy Rosentau i in. 2021 vs. wartości zmierzone; **RMSE raportowane per region**, osobno dla trzech klastrów bazy (regresja / transgresja / przejściowe). To jedyna ilościowa walidacja w całym planie — bez niej zostaje „zgodność z syntezami".

**Krzywa dla polskiego brzegu.** Porównanie z Uścinowiczem: oczekiwane trzy wahania o amplitudzie 25–27 m między 13,0 i 8,5 ka BP, poziom ~−28 m przy trwałym połączeniu z oceanem w ~8,5 ka BP, ~−10 m w 7,0 ka BP.

**Zatopione lasy jako punkty kontrolne.** Dla każdego datowanego pnia in situ: paleo-DEM w tym punkcie i czasie musi dawać powierzchnię **powyżej** poziomu wody. Pień rosnący pod wodą oznacza błąd modelu.

**Kontrola zdarzeń.** Spadek Billingen 25–28 m; środkowoholoceński highstand w strefach przejściowych w 7,5–6,5 ka BP; przejście do Littoriny w Małym Bełcie ~7,4 ka cal BP.

**Zgodność z gatunkami wskaźnikowymi.** Rekonstruowane zasolenie w miejscu i czasie wystąpienia gatunku musi mieścić się w jego tolerancji z `taxa.json`.

**Współczesne wypiętrzanie.** Gradient z modelu GIA vs. NKG2016LU — maks. ~10,3 mm/rok przy Umeå, linia zerowa na wybrzeżu Niemiec i Polski.

**Reżim A, sanity check.** Paleoszerokość centroidu ROI vs. dane paleomagnetyczne dla Baltiki; linia brzegowa z PaleoCoastlines spójna z izobatą 0 m z PaleoDEM.

**Reżim D, spójność szwów.** Linia brzegowa wstawki krajowej na granicy z reżimem C nie może odbiegać bardziej niż o uzgodnioną tolerancję; rozjazd oznacza niezharmonizowany datum wysokościowy.

**Chronologia.** Granice faz i poziomy wód zgodne z Andrén i in. 2011 (źródło wiodące), z udokumentowanymi odstępstwami Björcka 1995/2008, Stroevena i in. 2016 i Uścinowicza 2014 — wszystko w jednolitej skali cal yr BP.

**Topologia i budżet.** Geometrie poprawne (brak samoprzecięć), spójny CRS, suma assetów ≤ 25 MB, pierwszy chunk ≤ 4 MB, sumy kontrolne w `manifest.json` zgodne.

**Kontrola wizualna.** Nałożenie klatek na mapy etapów z Björcka 1995 / Andréna i in. 2011 dla 11,7 / 11,1 / 10,5 ka BP oraz na paleo-DEM-y z ESD 16, 585 (2025) — niezależna implementacja tej samej metody, więc rozbieżność linii brzegowej większa niż kilka kilometrów oznacza błąd u nas.

### End-to-end

```powershell
git submodule update --init
npm ci
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
| Warunki redystrybucji ICE-6G_C nieznane | potwierdzić **przed** wejściem pochodnych do repo; fallback: GLAC-1D, ANU/Lambeck lub pochodne SELEN z ESD 2025 (CC BY) |
| Niezharmonizowane datum wysokościowe w reżimie D | wszystko na EVRF2007 w `regional.py`; test spójności szwów |
| Pozorna precyzja (klatki gęstsze niż modele) | `dataQuality` i `ice.interpolated` w każdej klatce; pas min./maks. DATED-1 w danych |
| Downscaling GIA 1° do LiDAR 1 m | reżim D to osobne wstawki na krajowych rekonstrukcjach, nie zagęszczenie reżimu C |
| Reżim B bez danych GIS | jawna flaga `qualitative`; nie udawać klatek |
| „Bałtyk" w fanerozoiku to anachronizm | narracja o kratonie i basenie; rozstrzygnięte w treści, nie w danych |
| 108 + 47 + 40 klatek × warstwy | chunki per reżim i region, ładowanie leniwe, budżet 25/4 MB pilnowany w CI |
| Pełna równoległość EN/PL przy ~150 kartach | `content/{lang}/` od pierwszego commita; brak tłumaczenia = błąd builda |
| Cztery kraje × DEM + rekonstrukcja + RSL | reżim D jako 4 zamknięte porcje w kolejności PL → DK → SE → EE; przerwanie po dowolnej zostawia spójny produkt |

---

## 9. Artefakty dokumentacyjne

`docs/research/baltic-data-catalog.md` — raport z researchu: bezpośrednie linki (DOI, PANGAEA, EMODnet, SGU, GFZ, PIG-PIB, Maa-amet, Dataforsyningen), licencje i formaty; **tabela korelacji wiekowej** cal yr BP ↔ ¹⁴C BP ↔ BCE/CE dla wszystkich 7 faz; zestawienie parametrów liczbowych per przekrój (poziom wody, zasolenie, powierzchnia, objętość, maksimum izostazji); katalog współrzędnych punktów kluczowych.

`docs/research/paleo-reconstruction-methodology.md` — specyfikacja matematyczna i geoprzestrzenna przekształcania surowych siatek, izochron i powierzchni GIA w warstwy gotowe do interpolacji. **Musi wskazywać konkretne pliki i nazwy zmiennych** modelu GIA, nie pojęcia (§0.1).

`SOURCES.md` — pełne cytowania i licencje; źródło prawdy dla generowanego `sources.json`.
