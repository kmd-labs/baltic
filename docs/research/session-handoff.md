# Stan prac — przekazanie sesji

> Ostatnia aktualizacja: **2026-10-31**. Dokument dla następnej sesji (człowieka lub agenta): gdzie jesteśmy, co jest rozstrzygnięte, co dalej. Aktualizować na końcu każdej sesji.

## TL;DR

Decyzje z 2026-10-31:
1. **Zakres: wyłącznie postglacjał, 20 ka → dziś.** Fanerozoik, czwartorzęd i mikroskala wybrzeży usunięte (issues skasowane).
2. **Tylko zbiory bez zapytań licencyjnych.** ICE-6G_C, GLAC-1D, ANU-ICE i Stroeven 2016 nie są używane w żadnej postaci. Model GIA: **Steffen & Kaufmann 2025** (CC BY 4.0); lądolód: **DATED-1** (CC BY 3.0). `licensing-inquiries.md` zarchiwizowany — nic nie jest wysyłane.
3. **Krok 1000 lat** — 21 klatek + ~6 przekrojów zdarzeniowych. DATED-1 ma przekroje co 1 ka, więc lód 20 → 10 ka nie jest interpolowany.
4. **Scena: z `kmd-labs/el-nino` tylko glob i relief** — cała reszta El Niño pominięta. Start zbliżony na Bałtyk; próba obrotu daje przechylenie, a po puszczeniu kamera wraca i centruje się na Bałtyku. **Prototypy danych (już `C-03`) oglądamy na tym globie.** Zadanie `I-05` (#58).
5. **Dane runtime hybrydowe:** siatki wysokości dziś + kostka RSL (rzeźba 3D, przekrój, tooltip, sonda punktowa) oraz TopoJSON/JSON per klatka z wynikami flood-fill i walidacji.

Backlog: **36 zadań w 4 epikach** (0, C, V, I), kamienie M1–M6. Wszystkie opisy issues zsynchronizowane z backlogiem.

## Gałęzie i PR-y

| Gałąź | Stan | Zawartość |
| :-- | :-- | :-- |
| `docs/housekeeping-globe` | PR #59 **scalony** | decyzje z 2026-10-31 w `main`, wymagania globu, poprawki z weryfikacji danych; #8 zamknięte |
| `feat/contract-0-06` | **PR #60** do `main` | kontrakt `0-06`: schematy JSON, 33 fixture'y, format siatek KMDG/1 (Python + TS), `npm run test:data` / `test:contract`; zamyka #12 |
| `feat/globe-prototype` | PR do `main` (na bazie #60) | prototyp `C-01`/`C-03`/`C-07` + glob `I-05`: `tools/data/postglacial.py`, `src/app/components/globe/`, suwak 20 → 0 ka, `?ka=` w URL |

PR #2 zamknięty jako zbędny. Opisy #58, #17, #21, #16 zsynchronizowane z backlogiem; #58 przemianowane na „…centred on the Baltic”.

## Prototyp na globie — stan

- **Wersja 5 (2026-10-31, noc), po pytaniach do użytkownika:** warstwy przeniesione do pastylki z listą w prawym górnym rogu — **zastępuje przełącznik widoku** (miał jedną opcję). To świadome odstępstwo od `AGENTS.md` §2 (prawy górny róg = przełącznik widoków, warstwy w docku), decyzja użytkownika. Pod nią pastylka „Samouczek”: 7 kroków (play, warstwy, słowniczek, źródła, faza, przekrój, KMD) z podświetleniem i wyszarzeniem reszty, uruchamiany **tylko na żądanie** (zgodnie z `AGENTS.md` §1 — nic nie blokuje wizualizacji przy starcie); Esc / × zamykają, strzałki przewijają kroki. Panele Faza i Przekrój o połowę niższe (165 px), karta fazy się przewija.

- **Wersja 4 (2026-10-31, noc), po pytaniach do użytkownika:** linia „brzeg −1000 lat” liczona w shaderze z tej samej reguły co raster wody klatki t+1000 (pokrywa się co do piksela; działa w całej Europie i na przekrojach zdarzeniowych; wygaszona przy granicy okna Bałtyku). Bez pinów zdarzeń na osi — zdarzenia są przyciskami w karcie fazy. Panel krzywych RSL i suwak przewyższenia usunięte; rzeźba płaska (×1). Dock: Faza 2/5 (bez przewijania) i przekrój 3/5. „Źródła” opisują każdy zbiór: użycie, pochodzenie z DOI, licencja, zmiany (DOI Andrén 2011 i Hughes 2016 sprawdzone w Crossref).

- **Wersja 3 (2026-10-31, noc):** po pytaniach do użytkownika — tylko wycinek kuli z domeną RSL (10°W–70°E / 45–85°N), siatka Europy 1/20° z mozaiki dwóch kafli GEBCO (kafel 90°W–0 pobrany), Bałtyk 1/40°, woda modelowana tylko w Bałtyku. Tło globu (ETOPO2, Natural Earth, world-atlas) usunięte; pierwsze wejście ok. 2,8 MB. Wydajność: liczenie wody w Web Workerze (krok osi czasu 4–13 ms), render tylko przy zmianach.

- Uruchomienie: `npm start`, potem `http://localhost:4200/?t=11650` (cal BP, 0–20 000; działa też `?ka=11`).
- **Wersja 2 (wieczór 2026-10-31):** region paleo liczony per piksel na GPU (ostra linia brzegowa przy zbliżeniu), siatka Bałtyku 1/40°, woda: wypełnienie od Skagerraku + *priority-flood* basenu do najniższego progu (lód = ściana). Model sam daje BIL ok. +31…+39 m (literatura +25), drenaż Billingen, Ancylus +22 m (lit. +10), dziś 390 tys. km² / 21,4 tys. km³ (rzeczywiście ok. 377 tys. / 21,7 tys.). Panele z makiety w docku; treści w `src/assets/content/{en,pl}` (`I-03`).
- Test interakcji przez DevTools (`chromium` headless, CDP): przeciągnięcie przechyla do ~16°, po puszczeniu kamera wraca nad Bałtyk.
- Dane: `python -m tools.data.postglacial` (sk1) → `src/assets/data/grid/` i `prototype/`. Deterministyczne.
- Aplikacja liczy `H_now − RSL(t)` i zgadza się z pipeline'em < 5 cm (`tests/contract/paleo.test.ts`).
- Pierwsze wejście na desktopie ~3,8 MB (limit 4 MB) — relief 4k z El Niño to 1,7 MB; przy dokładaniu klatek trzeba to obciąć.
- **Znane ograniczenia:** domena DEM 0–50°E (szew na 0° w Morzu Północnym do czasu kafla GEBCO z tury 2); brak flood-fill (`C-04`) — zamknięte obniżenia i poldery wyglądają jak woda; fazy jeziorne na poziomie oceanu (`C-06`); lód bez grubości; ocean poza domeną bez batymetrii, więc głęboka woda w domenie jest ciemniejsza niż reszta oceanu.
- **Niezweryfikowane na prawdziwym sprzęcie:** płynność na słabszych telefonach (łatka ma 140 tys. wierzchołków; headless bez GPU daje ~2,6 kl./s) — układ mobilny 390 px sprawdzony w emulacji DevTools.
- Licencje tła globu (ETOPO2, Natural Earth, world-atlas) sprawdzone u źródła i oznaczone ✅ w `SOURCES.md`.

## Makieta

`https://claude.ai/artifact/4mtm5Y44DWh7ufwyXKAKi5` — makieta interakcji z syntetycznym DEM-em. Co z niej zostaje, a co wypada: plan §5.1. Najważniejsze wymagania na dane, które z niej wynikają: wysokość w każdym punkcie (stąd siatka + kostka RSL), poziom „model vs literatura” w karcie fazy (sill-check w UI), linia „ocean −X m” (krzywa eustatyczna `curves/esl`), stany progów per klatka. **Uwaga:** makieta koloruje wodę ciągłym polem PSU — takiego pola nie ma w źródłach; aplikacja koloruje klasą per basen.

## Issues — mapa

`0-01`…`0-08` → #7–#14, `C-01`…`C-15` → #15–#29 (`C-09` = #22, `C-08` = #23, `C-14` = #27, `C-13` = #28), `V-01` = #40, `V-02` = #41, `V-03` = #42, `V-06` = #45, `V-07` = #46, `V-08` = #47, `I-01` = #50, `V-11` = #51, `V-12` = #52, `I-02`…`I-04` → #53–#55, **`I-05` = #58**.

## Co można zacząć dziś

Kryterium: zależności spełnione, dane leżą lokalnie albo są ✅ bez zapytań.

| Kolejność | Issue | Dlaczego dziś |
| :-: | :-- | :-- |
| ✅ | #12 `0-06` kontrakt hybrydowy | PR #60 |
| 1 | #15 `C-01` → #17 `C-03` → #18 `C-04` | prototyp `C-01`/`C-03` gotowy na globie; dalej: kafel GEBCO 90°W–0, flood-fill `C-04`, wybór modelu Ziemi |
| 2 | #21 `C-07` lądolód | DATED-1 już pobrany, niezależne od reszty |
| 3 | #11 `0-05` tura 2 | Rosentau, Kotthoff, RSL S-Bałtyku, ESD 2025, kafel GEBCO 90°W–0 — wszystko ✅; odblokowuje `C-12` i `V-03` |
| 4 | #7 `0-01` README i przypięty submoduł | małe, bez zależności; potrzebne do `I-05` i CI |
| równolegle | #9 `0-03`, #16 `C-02` (research), #13 `0-07`, #19 `C-05` (literatura) | tylko research i dokumenty, bez kodu |

Formalnie `0-04` zależy od `0-01`, ale skrypty Pythona nie potrzebują builda Angulara — prototyp `postglacial.py` może iść od razu.

## Pipeline danych — jak to działa

Szczegóły: [`tools/data/README.md`](../../tools/data/README.md).

```powershell
npm run data:fetch -- --tier 1      # pobranie + weryfikacja (stdlib, bez venv)
npm run data:fetch -- --offline     # tylko weryfikacja cache'u
python -m venv .venv; .venv\Scripts\python -m pip install -r tools/data/requirements.txt   # do przetwarzania
```

### Dane w `data/raw/`

| `id` | Co | Uwagi do użycia |
| :-- | :-- | :-- |
| `gebco2024` | GeoTIFF 0–90°N / 0–90°E, 15″, `int16`, EPSG:4326 | okno 9–33°E / 53–67°N = 5760 × 3360 komórek; min −739 m; **jeziora tylko jako powierzchnia** (Vänern 44 m, Vättern 88 m) |
| `steffen2025_rsl` | 8 × `rsl_SK05_skan_<model>.nc`, zmienna `RSL(time, lat, lon)`, 1° | m względem 1950, **dodatnie = morze wyżej niż dziś**; 19 nierównych kroków 21,4 → 0 ka |
| `dated1` | `DATED-1_TimeSlices_shp.zip` | `TS10`…`TS25` × `{min,mc,max}` — **co 1 ka**; starsze jako `TS_27…`, `TS_3835…` |

Kontrola sensowności (model `sk1`, najbliższa komórka): Umeå ~282 m przy 11,3 ka; Gdańsk −25 m przy 8,9 ka i −14 m przy 7,8 ka. Dwuliniowo: 274 / −23,7 / −11,9 m.

### Weryfikacja z 2026-10-31

Wszystkie liczby z planu i backlogu sprawdzone na plikach z `data/raw/` (12/12 sum kontrolnych OK). Ustalenia wpisane do backlogu:
- `C-03`: wartości kontrolne dotyczą najbliższej komórki; rozrzut modeli w Umeå 195 (`j88`) – 274 m (`sk1`, `sk3`); RSL pod lądolodem wymaga maskowania zasięgiem DATED-1.
- `C-07`: 58 shapefile'i; brak `pyogrio` / `geopandas` w `requirements.txt`; DATED-1 kończy się na 10 ka.
- `C-02`: Onega leży poza oknem Bałtyku (9–33°E); Ładoga w GEBCO płaska (~1 m).

## Otwarte pytania

- ~~Dropdown w prawym górnym rogu~~ — rozstrzygnięte 2026-10-31: lista warstw (odstępstwo od `AGENTS.md` §2).
- **Tryb 2D z makiety** — zostaje obok globu czy wypada?
- Licencje ❓ do sprawdzenia na stronach: EMODnet, NKG2016LU, SGU, GLOBathy, HELCOM, ETOPO2, Natural Earth.

## Pułapki środowiska (Windows)

- **Tożsamość git nie jest skonfigurowana.** Commity: `git -c user.name=marcinwood -c user.email=derewonko.mm@gmail.com commit …`. Push: `git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push`.
- `gh` jest zalogowany jako `marcinwood`.
- Konsola używa cp1250: skrypty Pythona drukujące znaki spoza tej strony potrzebują `sys.stdout.reconfigure(encoding="utf-8")`.
- Strona danych Peltiera ma uszkodzony certyfikat TLS — nieistotne po decyzji `0-02`.
- Licencje DOI: `https://api.datacite.org/dois/<doi>` (pole `rightsList`).
