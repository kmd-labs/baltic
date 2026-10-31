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
| `docs/postglacial-scope` | PR #57 **scalony** (na `8f9c1a0`) | zawężenie zakresu; ostatni commit `a256a8a` dopchnięty po scaleniu i nie trafił do `main` |
| `docs/housekeeping-globe` | PR do `main` | `a256a8a` (licencje, 1 ka, glob) + wymagania globu + poprawki z weryfikacji danych |

PR #2 (submoduł v1.14.1) do zamknięcia jako zbędny — `main` przypina już `137744d` = v1.14.1.

## Makieta

`https://claude.ai/artifact/4mtm5Y44DWh7ufwyXKAKi5` — makieta interakcji z syntetycznym DEM-em. Co z niej zostaje, a co wypada: plan §5.1. Najważniejsze wymagania na dane, które z niej wynikają: wysokość w każdym punkcie (stąd siatka + kostka RSL), poziom „model vs literatura” w karcie fazy (sill-check w UI), linia „ocean −X m” (krzywa eustatyczna `curves/esl`), stany progów per klatka. **Uwaga:** makieta koloruje wodę ciągłym polem PSU — takiego pola nie ma w źródłach; aplikacja koloruje klasą per basen.

## Issues — mapa

`0-01`…`0-08` → #7–#14, `C-01`…`C-15` → #15–#29 (`C-09` = #22, `C-08` = #23, `C-14` = #27, `C-13` = #28), `V-01` = #40, `V-02` = #41, `V-03` = #42, `V-06` = #45, `V-07` = #46, `V-08` = #47, `I-01` = #50, `V-11` = #51, `V-12` = #52, `I-02`…`I-04` → #53–#55, **`I-05` = #58**.

## Co można zacząć dziś

Kryterium: zależności spełnione, dane leżą lokalnie albo są ✅ bez zapytań.

| Kolejność | Issue | Dlaczego dziś |
| :-: | :-- | :-- |
| 1 | #12 `0-06` kontrakt hybrydowy | bez zależności; odblokowuje emisję (`C-03`…`I-01`) i glob (`I-05`) |
| 2 | #15 `C-01` → #17 `C-03` → #18 `C-04` | ścieżka krytyczna; GEBCO i RSL już w `data/raw/`; prototyp można liczyć równolegle z `0-06` |
| 3 | #21 `C-07` lądolód | DATED-1 już pobrany, niezależne od reszty |
| 4 | #11 `0-05` tura 2 | Rosentau, Kotthoff, RSL S-Bałtyku, ESD 2025, kafel GEBCO 90°W–0 — wszystko ✅; odblokowuje `C-12` i `V-03` |
| 5 | #7 `0-01` README i przypięty submoduł | małe, bez zależności; potrzebne do `I-05` i CI |
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

- **Dropdown w prawym górnym rogu** (`AGENTS.md` §2): co przełącza? Propozycja: Paleogeografia / Zasolenie / Lądolód.
- **Tryb 2D z makiety** — zostaje obok globu czy wypada?
- Licencje ❓ do sprawdzenia na stronach: EMODnet, NKG2016LU, SGU, GLOBathy, HELCOM, ETOPO2, Natural Earth.

## Pułapki środowiska (Windows)

- **Tożsamość git nie jest skonfigurowana.** Commity: `git -c user.name=marcinwood -c user.email=derewonko.mm@gmail.com commit …`. Push: `git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push`.
- `gh` jest zalogowany jako `marcinwood`.
- Konsola używa cp1250: skrypty Pythona drukujące znaki spoza tej strony potrzebują `sys.stdout.reconfigure(encoding="utf-8")`.
- Strona danych Peltiera ma uszkodzony certyfikat TLS — nieistotne po decyzji `0-02`.
- Licencje DOI: `https://api.datacite.org/dois/<doi>` (pole `rightsList`).
