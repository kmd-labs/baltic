# Baltic — backlog issues warstwy danych

> Rozpisanie [`baltic-data-plan.md`](./baltic-data-plan.md) na zadania wykonawcze.
> **5 epików / 43 zadania.** Tytuły po angielsku (spójne z commitami i publicznym repo `kmd-labs/baltic`), treść po polsku.
> Dokument żywy — aktualizowany razem z planem. Odsyłacze `§x.y` wskazują sekcje planu.

> **Zmiany zakresu (2026-10-31):**
> 1. Aplikacja wizualizuje **wyłącznie postglacjał, 20 ka → dziś**. Usunięte epiki `A`, `B`, `D` i zadania `V-04`, `V-05`, `V-09`, `V-10`. Numeracja ma luki.
> 2. **Tylko zbiory bez zapytań licencyjnych.** ICE-6G_C, GLAC-1D, ANU-ICE i Stroeven 2016 nie są używane w żadnej postaci. Model GIA: Steffen & Kaufmann 2025; lądolód: DATED-1.
> 3. **Krok 1000 lat** (21 klatek + ~6 zdarzeniowych) zamiast 500 lat.
> 4. **Scena: glob jak w El Niño**, dane runtime hybrydowe (siatki + kostka RSL + wektory). Nowe zadanie `I-05`.

## Stan issues (przegląd 2026-11-02, po `0-01` + `0-08` i `C-05` + `C-06b`)

Aplikacja liczy wodę, poziomy progów i metryki sama z siatek (Web Worker), więc pipeline nie emituje plików klatek.

| Status | Zadania |
| :-- | :-- |
| **Zamknięte — wykonane** | `0-01` #7, `0-02` #8, `0-06` #12, `0-08` #14, `C-01` #15, `C-04` #18, `C-05` #19, `C-08` #23, `V-01` #40, `V-06` #45, `V-08` #47, `C-06b` #62, `I-03b` #65, `I-05` #58 oraz epik `A`: `A-01` #70, `A-02` #71, `A-03` #72, `A-04` #73, `A-06` #75, `A-07` #76, `A-08` #77, `A-09` #78 |
| **Zamknięte — wykonane z follow-upem** | `C-03` #17 (reszta → `I-01`, `0-07`, `V-03`), `C-06` #20 i `C-14` #27 (→ `C-06b` #62), `C-07` #21 (→ `C-07b` #63), `C-13` #28, `I-02` #53 (→ `I-02b` #64), `I-03` #54 (→ `I-03b` #65), `I-04` #55 (→ `I-04b` #66), `0-05` #11 (→ `0-05b` #67) |
| **Usunięte — nie robimy** | `C-02` #16, `C-09` #22, `C-10` #24, `C-11` #25, `C-12` #26, `C-15` #29, `V-07` #46, `V-12` #52 — decyzja użytkownika; **trwałe skasowanie na GitHubie czeka na uprawnienia** (system zablokował `gh issue delete`) |
| **Zawężone** | `I-01` #50 — siatki, zarysy lodu i manifest, bez plików klatek |
| **Otwarte** | `0-03` #9, `0-04` #10, `0-07` #13, `V-03` #42, `V-11` #51 oraz follow-upy: `C-07b` #63 (zostało τ₀ w manifeście), `I-02b` #64, `I-04b` #66, `0-05b` #67 |
| **Zamknięte — wykonane** (c.d.) | `V-02` #41 — od 2026-11-02 kontrola czyta katalog z `sills.json`, nie z `geo.ts`; niezmienniki blokujące, test negatywny, próg sterujący per klatka |
| **Otwarte w epiku `A`** | `A-05` #74 (korekta na osady — potrzebny Python, pobranie `zhang2024_sed` i decyzja o rozkładzie miąższości w czasie) |

Opisy zadań poniżej są historyczne dla pozycji zamkniętych i usuniętych; aktualny zakres jest w issues.

### Co weszło 2026-11-02

**Tor inżynierski — `0-01` #7 + `0-08` #14.** Repo nie miało żadnego CI na PR-ach: 42 testy kontraktu
uruchamiały się, kiedy ktoś pamiętał. `ci.yml` chodzi teraz na każdym PR do `main` w dwóch jobach —
aplikacja (kontrola submodułu, build, testy, budżet zasobów, `audit:metrics`) i kontrakt danych
(walidacja schematów `src/assets/data`, testy Pythona). `deploy.yml` przestał budować
`git submodule update --remote`, więc wdrożenie odpowiada commitowi zapisanemu w gicie; `README.md`
opisuje czysty klon. Trzy rzeczy musiały wcześniej zacząć działać: `contract:validate` kończył się
kodem 2 (skrypt nie przekazywał argumentów) i teraz obchodzi `src/assets/data`, dobierając schemat
po ścieżce, a nierozpoznany JSON **pada**, nie jest pomijany; `assets:check` waży katalog wobec
budżetu (25 MiB / 4 MiB — dziś 2,58 i 2,57), z listą zasobów startowych wziętą z tej samej stałej,
którą czyta serwis; `requirements-contract.txt` to podzbiór bez GDAL-a, pilnowany testem zgodności
pinów. **Domknęło to ostatni punkt DoD `A-06` #75.**

**Tor danych — `C-05` #19 + `C-06b` #62.** `sills.json` jest generowany (`npm run data:sills`) z
analizy przelewu, nie wpisywany z listy nazw — kolejność odwrotna do zapisanej w backlogu, bo tak
wynika z korekty audytu: o trasie rozstrzyga przelew, nie rzędna w katalogu. Pozycje i nazwy są z
literatury, `elevationM` i `states` mierzone na zacommitowanych siatkach, `activePeriods` puste tam,
gdzie repo nie ma datowanego źródła (pole `method` w pliku mówi, co jest czym — nowe, opcjonalne,
kontrakt `1.1.0`). Trasa z 11 ka dostała własny wpis `gota-alv` z `hypothesis: true`, więc
**najdalsza trasa od swojej nazwy to 21 km zamiast 97**; test z budżetem 30 km zatrzymuje build,
gdy pojawi się trasa bez nazwy. `fillWater` oddawał komórkę sterującą, a worker ją wyrzucał —
teraz dochodzi do `PaleoFrame.outlet` i karta fazy pokazuje nazwę trasy, odległość do punktu
katalogu, rzędną dzisiejszą i odznakę „hipoteza". Sille zniknęły z `geo.ts`: glob, `V-02`,
`audit:metrics` i testy czytają jeden plik.

**Czego to nie ruszyło:** poziomy jezior (B1, +6…+14 m wobec literatury) — przyczyną jest
rozdzielczość pola RSL (B3), więc droga do nich prowadzi przez `V-03`, nie przez katalog progów.

### Co weszło 2026-11-02, część druga — `C-08` #23

W odróżnieniu od progów chronologia nie jest mierzona, więc `timeline.json` nie jest generowany —
jest pisany ręcznie i **jest źródłem**: `timeline.ts` go importuje (`with { type: 'json' }`,
`resolveJsonModule`), zamiast trzymać drugą kopię tych samych liczb obok. Granice faz, czasy
przekrojów zdarzeniowych i lokalne onsety są więc w jednym miejscu, z cytowaniem per granica.
Import, nie `fetch`, bo `phaseAt` jest wołane z szablonów, rendererów i narzędzi node'owych —
3 KB w bundlu kosztuje mniej niż żądanie i asynchroniczna dziura w stu wywołaniach; wciągnięcie
pliku przez `manifest.json` razem z resztą zostaje w `I-02b` #64.

W `timeline.ts` zostaje tylko to, czego kontrakt nie modeluje: klasa wody i flaga jeziora per faza
(zachowanie sceny, nie chronologia) oraz literaturowa krzywa poziomu jeziora.

Kontrakt `1.2.0`: opcjonalne `method` w `timeline.json` (jak w `sills.json`) i `events[].disputed`
— flaga, że zdarzenie niesie twierdzenie sporne; **co** jest sporne jest treścią, nie danymi.

Najmocniejszy z sześciu nowych testów nie dotyczy chronologii, a cytowań: **każdy identyfikator
źródła w `timeline.json` i `sills.json` musi rozwiązywać się do wpisu w `SOURCES.md`**, parsowanego
z pierwszej komórki wiersza tabeli i z nagłówka wypunktowania. Bez tego „każda granica z
cytowaniem" jest ozdobą. Sprawdzone podrzuconym `not_a_real_source` — pada z nazwą granicy.
`kotthoff2022` przestał być „zarejestrowany, nieużywany": to źródło onsetu w Małym Bełcie.

### Co weszło 2026-11-02, część trzecia — `V-01` #40 + `V-06` #45

**Rejestr walidacji jest w TypeScripcie, nie w `validate.py` — i to świadome odstępstwo od §7
planu.** Plan pisano, gdy pipeline emitował gotowe klatki; dziś aplikacja liczy maskę wody, poziom,
próg sterujący i metryki sama, w `src/app/core/data`. Walidator w Pythonie musiałby więc
reimplementować regułę wody, żeby mieć co sprawdzać — a repo zapłaciło za ten błąd już dwa razy
(`A-02` reguła wody w dwóch kopiach, `A-03` mapowanie przekrojów lodu w dwóch; obie się rozjechały).
Kontrola, która sama wyprowadza to, co waliduje, mierzy własną kopię. W Pythonie zostaje to, co do
Pythona należy: czytanie NetCDF-a i zapis siatek.

Dwa statusy: `blocking` przerywa przebieg (niezmiennik modelu albo porównanie z literaturą z
budżetem, który obecny stan spełnia — żeby regresja padła), `reporting` tylko mierzy i drukuje.
Każdy wiersz niesie odchylenie **liczbowo**, także gdy przechodzi: inaczej rozmiar rozbieżności
schowałby się pod zieloną fajką.

Stan: **4 z 4 bramek blokujących zielone, 2 pomiary raportowane.**

| kontrola | model | oczekiwanie | odchylenie |
| :-- | :-- | :-- | :-- |
| `sill-balance` | 27 z 27 klatek | niezmiennik §0.1 / §0.2 | 0 klatek |
| `billingen-drop` | **31,3 m** (31,3 → 0,0 przy 11 750 → 11 650 BP) | 25–28 m | **+3,3 m** poza pasmem, budżet 8 m |
| `holocene-highstand` | Blekinge 5,70 ka, Öland 5,70 ka, **Gotlandia 6,80 ka** | maksimum w 7,5–6,5 ka w pasie przejściowym i nigdzie więcej | najgorsze −0,8 ka, przy węźle pola 1,1 ka |
| `little-belt-littorina` | **7489 cal BP** | 7400 cal BP (onset lokalny) | **+89 lat**, budżet 600 |
| `lake-level-vs-literature` | RMSE 12,2 m / 11 klatek | BIL +25, Ancylus do +10 | najgorsze −25,0 m przy 16 000 BP |
| `outlet-catalogue-distance` | 10 klatek jeziornych | każda trasa z nazwą w pobliżu | 21 km (`darss`, 10 300 BP) |

Trzy rzeczy w tej tabeli warte uwagi:

1. **Mały Bełt wychodzi bardzo dobrze — 89 lat.** Przejście jest rozwiązywane *między* klatkami
   (bisekcja `H_paleo = 0` w widełkach, w których maska przechodzi w wodę połączoną z oceanem), więc
   nie jest przyciągnięte do siatki 1 ka. Porównanie idzie do **lokalnego** onsetu z `timeline.json`,
   nie do granicy basenowej starszej o ~1 ka — czyli dokładnie po to `C-08` rozdzielił te dwa pola.
2. **Highstand ma twardy limit rozdzielczości, nie błąd 0,8 ka.** Maksimum RSL może wypaść tylko na
   węźle pola, a okno 7,5–6,5 ka zawiera dokładnie jeden węzeł (6,8 ka). Gotlandia trafia w okno;
   Blekinge i Öland są o jeden węzeł młodsze. Raportuję to jako „jeden węzeł", bo „0,8 ka" sugeruje
   precyzję, której pole nie ma.
3. **Kontrola highstandu jest różnicująca, nie spełniona przez dowolne pole.** Wymaga też, żeby pas
   był pasem: punkty czystego wypiętrzania (Umeå, Sztokholm) muszą mieć maksimum w deglacjacji, a
   zapadający południe (Gdańsk, Szczecin) nie może mieć holoceńskiego highstandu. Bez tego byłaby to
   bramka, którą przepuszcza wszystko.

Budżety są uzasadnione, nie okrągłe: 8 m na spadek Billingen to połowa budżetu poziomów (20 m,
`A-04`), bo spadek jest różnicą dwóch poziomów i dziedziczy część błędu B1; 600 lat na Mały Bełt
siedzi dobrze poniżej odstępu węzłów RSL w tej epoce (1,0 ka), który jest faktyczną podłogą
precyzji. Oba zacieśnią się, gdy `V-03` wybierze model Ziemi.

### Co weszło 2026-11-02, część czwarta — etap 1 planu domknięcia (`V-08` #47, `C-07b` #63 częściowo, `I-03b` #65)

**`V-08` #47 — piąta bramka blokująca, bez żadnych pobrań.** Korekta wcześniejszego założenia:
gradient liczy się wprost z zacommitowanej kostki (węzły 0,9 i 0 ka), a wartości odniesienia są
publikowane w artykule NKG2016LU. Umeå **8,89 mm/rok** wobec publikowanych maks. 10,3 — i to
niedoszacowanie jest **oczekiwane, nie błędem**: model daje średnią z ostatnich ~900 lat, a średnia
procesu hamującego jest niższa od jego wartości bieżącej, więc model trafiający w 10,3 byłby
podejrzany, nie lepszy. Wybrzeże PL/DE: 0,24–0,39 mm/rok, linia zerowa przy ~10°E i ~22°E.
Punkt DoD „mapa reszt" zostaje **otwarty i oznaczony** — bez siatek NKG2016LU (❓, `0-03` #9) nie ma
wobec czego liczyć reszt; raport daje zamiast tego gradient w nazwanych punktach i skan wzdłuż
54,5°N.

**`C-07b` #63 — grubość lodu w przekroju i tooltipie.** Profil plastyczny był policzony, ale
czytały go tylko shadery. `iceThicknessAt(t, lon, lat)` pyta to samo pole odległości, które globus
ekstruduje, a `iceThickness(d)` w `ice-field.ts` jest jedynym właścicielem wzoru — test tłumaczy
GLSL z powrotem na JS i trzyma oba razem (ten sam wzorzec co reguła wody w `A-02`; sprawdzone
podmianą `sqrt(d)` na `d` — pada). W przekroju **nie rysuję lodu w skali osi** i to jest świadome:
wykres obejmuje 780 m, a lądolód ma ~3000 m. Zamiast tego w paśmie lodu jest **kształt** profilu,
znormalizowany do własnego maksimum i podpisany tym maksimum w metrach — czytelnik dostaje to, co
profil plastyczny faktycznie mówi (lód grubieje w głąb lądu), bez sugerowania, że 3000 m mieści się
w 780 m osi. Pierwszy punkt DoD (przekroje zdarzeniowe z interpolowanym lodem) był już spełniony
przez `A-08`/`A-09`: bryła powstaje z pola interpolowanego między przekrojami, a karta fazy pokazuje
odznakę. **Issue zostaje otwarte** na ostatni punkt — τ₀ w manifeście, czyli `I-01` #50.

**`I-03b` #65 — ostatnie zahardkodowane napisy i bramka w buildzie.** Poszły: `aria-label` przycisku
marki, nazwa aplikacji, `cal BP` i ` ka` w panelach, znaczniki `A ·` / `· B` oraz **zapasowe nazwy
miejsc** w przekroju — te ostatnie usunięte bez zastąpienia, bo wykres narysowany przed wczytaniem
treści ma nie mieć podpisów, a nie mieć angielskie w polskiej sesji. `npm run build` i
`build:gh-pages` wołają teraz `test:i18n`, więc brak tłumaczenia przerywa build (kompletność `Dict`
pilnuje TypeScript, zgodność plików treści — test).

Doszła też **bramka przeciw nawrotom**: test skanuje *sam szablon* (plik `.html` albo ciało
`template:`, nie komentarze w kodzie) i odrzuca dosłowny `aria-label`/`title`/`alt` oraz wklejone
jednostki. Ma własny test, że w ogóle coś znalazł — regex, który po cichu nie pasuje do niczego,
zrobiłby z obu kontroli atrapę. Sprawdzone przywróceniem literału: pada z nazwą pliku.

Testy: **64/64**. Pięć bramek blokujących zielonych.

**Następne w kolejce** (stan 2026-11-02): bez pobrań zostaje **`I-04b` #66** (panel źródeł
generowany z `SOURCES.md` — parser do tego już istnieje w `tests/contract/timeline.test.ts`) oraz
**`V-11` #51** w części topologicznej (budżet rozmiaru już działa, zostaje CRS i samoprzecięcia —
ale to ma sens dopiero z `I-01` #50). Największą wartość merytoryczną nadal ma **`V-03` #42**,
bo zamyka B1 i B3, i nadal wymaga odtworzenia środowiska Pythona oraz ~1 GB pobrań.

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
| **A** | Audyt 2026-11-01 | 9 | ustalenia audytu bez pokrycia w `0`/`C`/`V`/`I` (`A-01`…`A-07`) oraz dwa z sesji naprawczej (`A-08`, `A-09`) |

---

# EPIC 0 · Fundamenty i blokery

## `0-01` Document clean-clone setup and pin design-system in builds — **wykonane 2026-11-02**

**Epik:** 0 · **Blokuje:** `0-04` · **Labels:** `blocker`, `ci`

W świeżej kopii roboczej submoduł `src/design-system` jest niezainicjowany (`git submodule status` → `-137744d`, katalog pusty). Dopóki tak jest, build nie przejdzie, bo `angular.json` wskazuje `src/design-system` w `stylePreprocessorOptions.includePaths`. `deploy.yml` ma już `submodules: recursive`, ale w repo **nie ma README**, a deploy buduje z `git submodule update --remote`, czyli z bieżącego `main` design-systemu, a nie z przypiętego SHA — build nie jest odtwarzalny.

**Zakres**
- `README.md`: klon z `--recurse-submodules` / `git submodule update --init`, `npm ci`, `npm start`.
- `deploy.yml`: budowanie z przypiętego SHA (aktualizacje przychodzą przez PR z `sync-design-system.yml`) albo jawne uzasadnienie `--remote`.
- Weryfikacja, że `sync-design-system.yml` nadal działa po zmianie.

**DoD**
- [x] `README.md` istnieje; `npm run build` zielony na czystym klonie wykonanym wg README
- [x] Deploy buduje z SHA zapisanego w gicie — krok `--remote` usunięty, aktualizacje idą przez `sync-design-system.yml`
- [x] CI nie przechodzi, jeśli submoduł jest pusty (`0-08`)

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

## `0-08` Add PR CI workflow that validates committed data assets — **wykonane 2026-11-02**

**Epik:** 0 · **Zależy od:** `0-01`, `0-06` · **Blokuje:** `V-11` · **Labels:** `ci`, `blocker`

W repo jest tylko `deploy.yml` (push na `main`) i `sync-design-system.yml` — **nic nie uruchamia się na PR-ach**, a `0-06`, `V-01` i `V-11` zakładają bramki w CI. CI **nie może** uruchamiać `npm run data:build`: surowe dane są poza gitem (`data/raw/`, ~905 MB po turze 1). CI waliduje więc **zacommitowane assety** w `src/assets/data/`, nie przelicza pipeline'u.

**Zakres**
- `.github/workflows/ci.yml` na `pull_request`: checkout z submodułem, `npm ci`, `npm run build`.
- Walidacja schematu (`0-06`) wszystkich plików w `src/assets/data/`, zgodność sum kontrolnych z `manifest.json`, budżet rozmiaru (`V-11`).
- Kontrola pustego submodułu (`0-01`).

**DoD**
- [x] Workflow uruchamia się na każdym PR do `main`
- [x] Plik niezgodny ze schematem blokuje merge; nierozpoznany JSON też. **Sumy kontrolne czekają na `manifest.json` (`I-01`)** — dziś nie ma czego sprawdzać
- [x] Brak kroku pobierającego surowe dane

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

## `C-05` Build sills.json — sill and strait catalogue — **wykonane 2026-11-02 z analizy przelewu**

**Epik:** C · **Zależy od:** `0-06` · **Blokuje:** `C-06`, `C-10`, `C-14`, `V-02` · **Labels:** `contract`, `regime-c`, `blocker`

Katalog progów: współrzędne, rzędne progowe, okresy aktywności. **Billingen** (58,4°N 13,8°E), **Närke** (59,1°N 15,0°E), **Svea / Degerfors**, **Dana / Wielki Bełt**, **Darss**, **Drogden / Øresund**. Przesmyk karelsko-białomorski oznaczony jako *hipoteza historyczna, nie konsensus*.

Rzędne progów **Närke i Billingen**: z **SGU Strandförskjutningsmodell**, jeśli licencja okaże się otwarta (`0-03`), inaczej **wartości z publikacji** (fakty z cytowaniem) — bez zapytań. Baza Rosentaua ma lukę właśnie w Szwecji, więc przy problemach w `V-02` / `V-03` pierwszym podejrzanym jest ta część katalogu.

Badanie literatury do katalogu (współrzędne, rzędne, okresy aktywności) może zacząć się od razu; zapis do `sills.json` wymaga schematu z `0-06`.

> **Uwaga do kolejności z §6.** `C-14` potrzebuje zasiewu w aktywnej cieśninie, `C-06` rzędnych progowych, a `C-10` stanów progów (zasolenie w klatkach M3). Ten plik powstaje **razem z `C-03`** (M2), nie po nim.

**DoD**
- [x] Każdy próg: współrzędne, rzędna, źródło; **okresy aktywności tylko tam, gdzie repo ma datowane źródło** — reszta pusta, bo wymyślony wiek byłby gorszy od braku (`sgu_strand` nierozstrzygnięty, `0-03`)
- [x] Stan otwarty / zamknięty per faza dla wszystkich 7 faz — mierzony na modelu, nie przepisany z literatury
- [x] Hipotezy oznaczone flagą, nie podane jako fakt — `gota-alv` z `hypothesis: true`

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

## `C-08` Build timeline.json for the seven postglacial phases — **wykonane 2026-11-02**

**Epik:** C · **Zależy od:** `0-06`, `C-09` · **Blokuje:** `C-11`, `V-12` · **Labels:** `contract`, `regime-c`

Siedem faz: `deglaciation`, `bil`, `yoldia`, `ancylus`, `mastogloia`, `littorina`, `post-littorina`. Osnowa: **cal yr BP** (Present = 1950).

**Andrén i in. 2011 jako źródło wiodące.** Granica końca fazy ancylusowej jest podawana jako 9 800 **albo** 9 500 cal BP w zależności od autora — **nie uśredniamy**; przyjmujemy Andréna, a odstępstwa Björcka 1995/2008, Stroevena i in. 2016 i Uścinowicza 2014 zapisujemy w `baltic-data-catalog.md`.

Granice faz w `timeline.json` są **basenowe**, a przejścia lokalne są nierównoczesne — np. Littorina w Małym Bełcie ~7,4 ka cal BP (IODP M0059) wobec początku fazy ~8 500 BP. Lokalne onsety trzymamy osobno, inaczej `V-06` będzie fałszywie padał.

**DoD**
- [x] `timeline.json` w cal yr BP, 7 faz, każda granica z cytowaniem — test sprawdza, że każde cytowanie rozwiązuje się do wpisu w `SOURCES.md`
- [x] Lokalne onsety faz (miejsce, data, źródło) jako osobne pole, nie nadpisują granic basenowych — Mały Bełt ~7,4 ka (`kotthoff2022`), test pilnuje, że onset nie równa się granicy
- [ ] Tabela odstępstw w katalogu danych — **zostaje w `0-07` #13**: rozbieżność 9 800 / 9 500 jest zapisana w polu `method` pliku, ale przypisanie alternatywy do konkretnych autorów wymaga publikacji w ręku
- [x] Zero uśrednionych granic — test odrzuca 9 650 (średnią z dwóch publikowanych wartości) na granicy ancylusowej

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

## `V-01` validate.py skeleton and CI gate — **wykonane 2026-11-02, w TypeScripcie**

**Epik:** V · **Zależy od:** `0-04`, `0-06` · **Blokuje:** pozostałe zadania V · **Labels:** `validation`, `ci`

**DoD**
- [x] Rejestr testów z progami (`tools/validate/checks.ts`), uruchamiany `npm run validate`; `data:build` zawoła go, gdy powstanie (`0-04` #10)
- [x] Raport w czytelnej formie — wiersz per test: model, oczekiwanie, odchylenie, ograniczenie porównania
- [x] Niezaliczony test o statusie `blocking` przerywa build — sprawdzone zaciśnięciem budżetu, exit 1; w CI jako krok `Validation report'

**Plan:** §7

## `V-02` Sill-check — elevation balance at every sill — **wykonane 2026-11-01 na katalogu `geo.ts`**

**Epik:** V · **Zależy od:** `V-01`, `C-03`, `C-05`, `C-06` · **Labels:** `validation`, `blocker`

Dla każdego przekroju sprawdzić, czy rzędna progu zgadza się z kierunkiem przepływu: **jezioro zaporowe wymaga progu powyżej** ówczesnego poziomu oceanu, **połączenie morskie poniżej**.

Test wewnętrznie spójnościowy — nie wymaga danych zewnętrznych, a wyłapuje **ilościowo** dokładnie tę klasę błędu, która jest tu najgroźniejsza: podwójne liczenie eustatyki (§0.1) i pomylony datum (§0.2). **Najwyższy priorytet w epiku.**

**DoD**
- [x] Uruchamiany dla wszystkich progów katalogu i **wszystkich klatek** — `sill-check.ts` + `tests/contract/sills.test.ts`; źródłem progów jest na razie `geo.ts`, zamiana na `sills.json` razem z `C-05` #19
- [x] Status `blocking`: niezmienniki wywalają test (`assertBalance`) — jezioro z progiem pod poziomem oceanu, poziom przy połączeniu z oceanem, poziom nieodpowiadający progowi, głębia bez wody i bez lodu
- [x] Test negatywny: podniesienie poziomu bez zmiany progu musi zostać wyłapane
- [x] `fillWater` zwraca **komórkę sterującą** (najwyższy punkt na najtańszej drodze z głębi do oceanu), więc kontrola mierzy trasę zamiast ją zgadywać; `audit:metrics` §4b drukuje ją per klatka

**Wynik — i korekta hipotezy z audytu.** Model przelewa: BIL przez **Öresund** (7–9 km od wpisu
katalogu), Yoldia 11 ka przez **zachodnią Szwecję, 12,24°E 58,24°N — 97 km od czegokolwiek w
katalogu**, Ancylus i Mastogloia przez **południową trasę przy Darssie** (21 km). `svea` nie steruje
nigdy, wbrew diagnozie z audytu II.2 B2. Trzy stany basenu rozróżnione jawnie: `lake`, `connected`
i `buried` (20–16 ka — głębie leżą pod lodem, nie ma czego bilansować).

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

## `V-06` Event checks — **wykonane 2026-11-02**

**Epik:** V · **Zależy od:** `V-01`, `C-06`, `C-10`, `C-14` · **Labels:** `validation`

- Spadek Billingen **25–28 m**.
- Środkowoholoceński highstand w strefach przejściowych w **7,5–6,5 ka BP**.
- Przejście do Littoriny w Małym Bełcie **~7,4 ka cal BP** — porównywane z lokalnym onsetem z `timeline.json` (`C-08`), nie z basenową granicą fazy (~8 500 BP).

**DoD**
- [x] Trzy testy z tolerancjami w rejestrze: spadek Billingen, highstand, Mały Bełt
- [x] Odchylenie raportowane liczbowo, nie binarnie — pilnuje tego osobny test (kolumna musi zawierać liczbę)

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

## `V-08` Present-day uplift gradient versus NKG2016LU — **wykonane 2026-11-02**

**Epik:** V · **Zależy od:** `V-01`, `C-03`, `C-12` · **Labels:** `validation`

Steffen i Kaufmann nie publikują pola współczesnej prędkości wypiętrzania, a modele, które je mają (ICE-6G_C), są wykluczone (`0-02`). Prędkość przybliżamy **gradientem RSL między krokami 0,9 ka i 0**, z jawną adnotacją, że to średnia z ostatnich ~900 lat, nie prędkość chwilowa. Odniesienie: NKG2016LU (jeśli ✅) albo wartości z artykułu.

Gradient z modelu GIA vs NKG2016LU: maks. **~10,3 mm/rok przy Umeå**, **linia zerowa na wybrzeżu Niemiec i Polski**.

**DoD**
- [x] Oba punkty kontrolne zaliczone z tolerancją — Umeå 8,89 mm/rok wobec 10,3 (budżet 3), wybrzeże PL/DE ≤ 0,4 mm/rok (tolerancja ±1,5)
- [~] Mapa reszt gradientu w raporcie — **nie da się bez siatek NKG2016LU, które są ❓ (`0-03` #9)**. Raport pokazuje zamiast tego gradient modelu w nazwanych punktach i skan wzdłuż 54,5°N; reszty wobec pola wracają razem z licencją

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
- Prawy górny róg: **lista warstw** zamiast przełącznika widoku (decyzja 2026-10-31, odstępstwo od `AGENTS.md` §2) + pastylka „Samouczek” uruchamiająca 7-krokowy samouczek na żądanie.

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

# Epik `A` — audyt 2026-11-01

> Zadania wynikające z [`baltic-audit-2026-11-01.md`](./baltic-audit-2026-11-01.md).
> **Issues: #70–#78** (etykieta `epic:A`). Zamknięte 2026-11-01: #70, #71, #72, #73, #76, #77, #78. Otwarte: #74 (`A-05`), #75 (`A-06`).
> **Tu są wyłącznie ustalenia bez pokrycia w epikach `0`/`C`/`V`/`I`.** Rzeczy, które audyt
> potwierdził, a które mają już swoje issue — poziomy faz jeziornych (`C-06b` #62), bilans progów
> (`V-02` #41), RSL wobec obserwacji (`V-03` #42), spadek Billingen (`V-06` #45), ograniczenia
> profilu lodu (`0-07` #13) — **nie są tu powtórzone**; audyt dostarcza do nich materiał dowodowy.
>
> Pominięte zgodnie z decyzją: wszystko, co wymagałoby uzyskania licencji, czyli zbiory ❓
> z `SOURCES.md` (lepsza batymetria, batymetria jezior, `V-08` na `nkg2016lu`, `sgu_strand`, `sincos`).
>
> Materiał dowodowy z audytu trafił komentarzami do issues, które go dotyczą: **#41** (`V-02`, tabela rzędnych
> progów w czasie), **#42** (`V-03`, skoki RSL i przełożenie na brzeg), **#45** (`V-06`, przebieg BIL i spadek
> Billingen), **#62** (`C-06b`, poziomy modelu wobec literatury), **#13** (`0-07`, ograniczenia profilu lodu),
> **#14** (`0-08`, `audit:metrics` w CI).

## `A-01` #70 Realign tooltip and transect with the rendered water rule — **wykonane 2026-11-01**

**Epik:** A · **Zależy od:** — · **Blokuje:** — · **Labels:** `app`, `regression`

Regresja wprowadzona razem z synchronizacją wypełniania (2026-11-01). Scena liczy wodę jako
`union(A,B) ∧ hp(t) < poziom` z poziomem interpolowanym między klatkami, a `pointInfo`
(`paleo-data.service.ts:269`) i `transect` (`:296`) nadal czytają surową maskę **najbliższej klatki**
i jej `lakeLevelM`. Przed zmianą maska renderera równała się najbliższej klatce, więc zgadzały się co do
komórki. Rozbieżność jest największa przy brzegu — czyli tam, gdzie użytkownik najczęściej najeżdża.

**DoD**
- [x] `pointInfo` i `transect` dostają bracket i stosują tę samą regułę co shader — przez `sceneWater(t)`, z którego korzystają też oba renderery (jeden właściciel pary klatek i poziomu)
- [x] Poziom w obu ścieżkach interpolowany, nie brany z klatki; RSL też, przez wspólny `RSL_STEP_YR`
- [x] Test `mid-interval water class follows the scene rule, not the nearest frame` — 2 046 z 3 819 próbkowanych komórek brzegowych rozstrzygało się inaczej przy odczycie z najbliższej klatki

**Audyt:** I.2 `A-01`

## `A-02` #71 Single source of truth for the water rule — **wykonane 2026-11-01**

**Epik:** A · **Zależy od:** — · **Blokuje:** — · **Labels:** `app`, `contract`

`oceanSide()` istnieje dwa razy: `water.ts:33` (TS — decyduje o powierzchni i objętości) oraz
`paleo-shaders.ts:127` (GLSL — decyduje o kolorze basenu), z identycznymi magicznymi liczbami i synchronizacją
wyłącznie komentarzem. **Reguła wyklucza 19,9% dzisiejszych komórek wody** z metryk, więc jej rozjazd po cichu
zmieniłby publikowane liczby. Ta sama klasa ryzyka dotyczy pierwszeństwa `isLakeAt`/`isOceanAt`, które po
przejściu na sumę masek żyje tylko w GLSL.

**DoD**
- [x] Jedna definicja: stałe `OCEAN_SIDE` + `MASK_HIT` w `water.ts`, a `WATER_RULE_GLSL` generowany z tych samych liczb i wstrzykiwany do `COMMON` (`paleo-shaders.ts`); `bedAt` w `ice-shaders.ts` przeszedł na `isLakeAt`/`isOceanAt` zamiast trzeciej kopii pierwszeństwa
- [x] Test `GLSL oceanSide equals the TS one across the window` (117 tys. punktów) i `GLSL lake/ocean precedence equals waterKindAt` — tłumaczą **źródło GLSL** z powrotem na JS i porównują z TS; sprawdzone, że usunięcie strażnika `!isLakeAt` w `isOceanAt` test wywala
- [x] `audit:metrics` raportuje udział (19,9%) i wskazuje, że druga strona jest generowana

**Audyt:** I.2 `A-02`

## `A-03` #72 Make the ice-dammed lake reachable from tests — **wykonane 2026-11-01**

**Epik:** A · **Zależy od:** — · **Blokuje:** `A-04` (fazy jeziorne) · **Labels:** `app`, `validation`

`iceMask()` (`:376`) rasteryzuje zarys DATED-1 przez `document.createElement('canvas')`, więc tama lodowa
istnieje wyłącznie w przeglądarce. Skutek: **każdy test kontraktowy wywołuje `fillWater(..., null)`**, bo
inaczej nie potrafi, i cała faza BIL — w której tama *jest* mechanizmem — nie ma pokrycia. To samo blokuje
domknięcie `V-02` po stronie faz jeziornych i ogranicza `npm run audit:metrics` (wiersze `no-ice`).

**DoD**
- [x] `fillPath` / `rasterise` / `iceMaskFor` w `ice-field.ts` — skanlinia nonzero po środkach komórek, zero DOM-u; geometria nadal ze strumienia d3 (to samo przycinanie i zagęszczanie łuków co kontekst `<canvas>`)
- [x] Zgodność na wszystkich przekrojach 10–20 ka: dokładna wobec niezależnego rzutowania promienia (even-odd, punkt po punkcie), a wobec geodezyjnego `geoContains` z tolerancją jednej komórki przy krawędzi (udokumentowana różnica semantyki: proste w lon/lat vs łuki)
- [x] `audit:metrics` liczy z tamą (kolumna `ice_ka`, wybór przekroju przez `iceSliceFor` — jedna definicja z aplikacją), znacznik `no-ice` usunięty
- [x] Pokrycie fazy BIL: test `the Baltic Ice Lake is dammed by the ice, not by topography`

**Audyt:** I.2 `A-03`

## `A-04` #73 Strengthen the water contract tests against literature levels — **wykonane 2026-11-01**

**Epik:** A · **Zależy od:** `A-03` (dla faz zaporowych) · **Labels:** `validation`

`tests/contract/water.test.ts:48` asercja to `level > 0` — przechodzi przy rzeczywistych +22 m i przeszłaby
przy +100 m. Żaden test nie konfrontuje modelu z literaturą, a rozbieżności są duże: Ancylus +22,1 m wobec
+10 m, BIL +36 m wobec +25 m. Zadanie nie polega na wymuszeniu zgodności — tylko na **zamianie rozbieżności
w pilnowany budżet błędu**, żeby nie rosła po cichu.

**DoD**
- [x] Test `modelled lake levels stay inside the error budget against the literature` przechodzi po wszystkich klatkach z poziomem (10 klatek), łącznie z jeziorami Yoldii i Mastogloi, których literatura nie przewiduje (B2)
- [x] Próg 20 m uzasadniony szumem wejścia (średni skok RSL 16–19 m w 16–11 ka, §2 audytu), nie bieżącym wynikiem; aktualny maks. to 13,9 m przy 14 ka
- [x] Raport liczbowy: wiersz per klatka + maks. i RMSE (10,1 m)
- [x] Kontrola negatywna `the budget has teeth: breaking the dam puts 13 ka outside it`
- [x] Klatki fazy jeziornej bez jeziora w modelu są przypięte jawnie (`CONNECTED_IN_LAKE_PHASE` = 16 ka), więc zmiana tego zbioru też wywala test

**Audyt:** I.2 `A-04`, II.2 B1

## `A-05` #74 Apply the Holocene sediment correction to the paleo-DEM

**Epik:** A · **Zależy od:** `C-03` · **Labels:** `data-pipeline`, `regime-c`

`H_now` zawiera holoceńskie osady, których paleo-dno nie miało — w depocentrach kilkanaście do kilkudziesięciu
metrów. Głębokości i objętość są przez to systematycznie **zaniżone** dla starszych klatek, najmocniej tam,
gdzie muł najgrubszy. `zhang2024_sed` (Mendeley Data, CC BY 4.0, ✅) jest zarejestrowany w `SOURCES.md`
dokładnie pod to zastosowanie i **nie jest używany nigdzie w `tools/` ani `src/`** — co samo w sobie jest
usterką dokumentu deklarującego się jako jedyne źródło prawdy.

Jedyne nowe ustalenie merytoryczne audytu bez pokrycia w planie. Licencyjnie czyste — nie wymaga zapytania.

**DoD**
- [ ] Wpis `zhang2024_sed` w `tools/data/registry.json` i przypięcie w `checksums.lock.json`
- [ ] Miąższość osadów odjęta od `H_now` przed `H_paleo`, z jawną zależnością od czasu (osad narasta, nie jest stały)
- [ ] Wpływ na powierzchnię, objętość i głębokość maks. zmierzony i opisany per faza
- [ ] `SOURCES.md`: status wpisu odzwierciedla faktyczne użycie
- [ ] Metodyka w `0-07` rozszerzona o człon osadowy

**Audyt:** I.2 `A-05`, II.2 B4

## `A-06` #75 Ship the audit measurements as a repeatable script — **wykonane 2026-11-01**

**Epik:** A · **Labels:** `validation`, `docs`

Każda liczba cytowana w audycie liczona przez `tools/audit/metrics.ts` (`npm run audit:metrics`) z zatwierdzonych
zasobów i warstwy danych aplikacji, nie z równoległej reimplementacji. Pięć sekcji: poziomy model/literatura
z metrykami basenu, skoki RSL między węzłami, przełożenie błędu poziomu na przesunięcie brzegu, rzędne progów
w czasie, walidacja na dziś.

**DoD**
- [x] Skrypt w repo, wpięty jako `npm run audit:metrics`
- [x] Czyta `src/assets/data` i `src/app/core/data`, bez duplikowania logiki
- [x] Ograniczenie `no-ice` opisane w nagłówku skryptu i powiązane z `A-03`
- [x] Uruchamiany w CI po zmianie zasobów danych (`ci.yml`, job `app`)

## `A-08` #77 Read the ice flag from the field the scene draws — **wykonane 2026-11-01**

**Epik:** A · **Zależy od:** `A-03` · **Labels:** `app` · **Źródło:** ustalenie z sesji naprawczej, nie z audytu

Ten sam rozjazd co `A-01`, warstwę wyżej: bryła lodu powstaje z pola odległości interpolowanego między
przekrojami DATED-1, a podpowiedź i przekrój czytały maskę jednej klatki (tamę wypełniania). Policzone po
`A-03`: 232 tys. km² okna przy 10,5 ka, 2,2 tys. km² przy dokładnym przekroju (sama różnica rastrów).

**DoD**
- [x] `iceDrawnAt(t, lon, lat)` pyta to samo pole i stosuje tę samą regułę co shader (`sdfAt`, `fade`)
- [x] `pointInfo` i `transect` używają go w obu oknach; `geoContains` na zarysie `mc` usunięty
- [x] Maska zostaje wejściem modelu (tama, siatka 1 ka) — udokumentowane w `iceSliceFor` i `iceDrawnAt`
- [x] Testy: pas niezgodności przy dokładnym przekroju i jego wielokrotność w środku przedziału

## `A-09` #78 Fix the scale and the extent of the ice distance field — **wykonane 2026-11-01**

**Epik:** A · **Zależy od:** — · **Labels:** `app`, `regime-c` · **Źródło:** ustalenie z sesji naprawczej

Usterka w `iceSignedDistance` obecna od `C-07`. Prostokąt domeny podawany do `fitWidth`: (1) nawinięty
odwrotnie do konwencji d3-geo (zewnętrzny pierścień mniejszy od półkuli ma być **zgodny** z ruchem
wskazówek — odwrotnie niż RFC 7946), więc d3 czytał „cała sfera minus prostokąt" i skalował kulę do
rastra — **45 km/piksel zamiast 3,4**; (2) niezagęszczony, a brzegi wielokąta sferycznego to łuki
wielkiego koła, więc łuk 50°N wchodził w środku na 57°N i **południowy Bałtyk wypadał poza bounds
domeny** — komórki stamtąd rzutowały się pod raster, a resampling przyciągał je do dolnego wiersza.

**DoD**
- [x] Pierścień domeny nawinięty zgodnie z d3 i zagęszczony co 1°
- [x] Niezgodność maski i pola przy dokładnym przekroju: 9 653 → 486 komórek, wszystkie ≤ 2,5 km od krawędzi
- [x] Kopuła 20 ka: 3 037 m przy 415 km od krawędzi (dokumentowane ~2 980 m); zero komórek „bez danych"
- [x] Oba tryby awarii pilnowane testem (`on an exact slice…`, `the thickest point of the 20 ka sheet…`)

## `A-07` #76 Minor: cache semantics and SOURCES hygiene — **wykonane 2026-11-01**

**Epik:** A · **Labels:** `app`, `docs`

**DoD**
- [x] Prawdziwe LRU: `rsl()` przestawia wpis przy odczycie, więc kolejność `Map` to naprawdę „najdawniej używane pierwsze"; liczy się przy zawróceniu lub skoku playheadu (pole duchowego brzegu z `t + 1000` czytane co tick)
- [x] Przegląd `SOURCES.md`: `zhang2024_sed`, `rosentau2021`, `steffen2025_rsl_sbaltic`, `esd2025` oznaczone jako **zarejestrowane, nieużywane** wraz z zadaniem, pod które czekają; `kotthoff2022` — zadanie (`V-07`) usunięte. Dodana zasada: status ✅ mówi o licencji, nie o użyciu

**Audyt:** I.2 `A-07`

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
