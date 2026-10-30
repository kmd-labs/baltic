# Stan prac — przekazanie sesji

> Ostatnia aktualizacja: **2026-10-30**. Dokument dla następnej sesji (człowieka lub agenta): gdzie jesteśmy, co jest rozstrzygnięte, co dalej. Aktualizować na końcu każdej sesji.

## TL;DR

- Backlog jest zwalidowany i wypchnięty na GitHuba jako **49 issues (#7–#55)** z milestone'ami M1–M8. Poprawki backlogu, decka i planu są w **PR #6** (gałąź `tellin`), jeszcze **niescalonym**.
- Zaczęte zadania: **#8 `0-02`** (licencje GIA), **#9 `0-03`** (`SOURCES.md`), **#10 `0-04`** (szkielet pipeline'u), **#11 `0-05`** (`fetch.py`). Żadne nie jest zamknięte.
- **Tura 1 danych jest pobrana i zweryfikowana:** GEBCO 2024, pola RSL Steffena i Kaufmanna 2025, DATED-1. Wystarczają do pierwszego paleo-DEM-u faz morskich (M3) bez czekania na odpowiedzi licencyjne.
- Praca z tej sesji jest na gałęzi **`feat/data-fetch-core`**, w PR z bazą `tellin` (link w #8–#11).

## Gałęzie i PR-y

| Gałąź | Stan | Zawartość |
| :-- | :-- | :-- |
| `tellin` | wypchnięta, **PR #6** do `main`, czeka na review | poprawki `baltic-issues-backlog.md` (45 → 49 zadań), `baltic-plan-deck.html`, `baltic-data-plan.md` |
| `feat/data-fetch-core` | wypchnięta, PR z bazą `tellin` | `SOURCES.md`, `docs/research/licensing-inquiries.md`, `tools/data/*`, `.gitignore`, `package.json` (`data:fetch`), ten plik |

PR `feat/data-fetch-core` ma bazę `tellin`. Po scaleniu #6 przestawić bazę na `main`.

## Issues — mapa i stan

Pełny backlog: [`baltic-issues-backlog.md`](baltic-issues-backlog.md) (źródło prawdy dla issues). Numery: `0-01`…`0-08` → #7–#14, `C-01`…`C-15` → #15–#29 (`C-09` = #22, `C-08` = #23, `C-14` = #27, `C-13` = #28), `A-*` → #30–#32, `B-01` → #33, `D-*` → #34–#39, `V-01`…`V-10` → #40–#49, `I-01` → #50, `V-11` → #51, `V-12` → #52, `I-02`…`I-04` → #53–#55.

| Issue | Stan | Odhaczone w DoD | Co zostało |
| :-- | :-- | :-- | :-- |
| #8 `0-02` licencje GIA | research gotowy, maile **niewysłane** | — | wysłać zapytania, zapisać odpowiedzi, wpisać decyzję i `ice.source` |
| #9 `0-03` `SOURCES.md` | rejestr kompletny co do listy zbiorów | pokrycie 100% §3 | rozstrzygnąć pozycje ❓, uzupełnić atrybucje |
| #10 `0-04` szkielet | minimalny | zamrożone zależności | `data:build`, pozostałe skrypty pipeline'u |
| #11 `0-05` `fetch.py` | tura 1 gotowa | błąd przy złej sumie, brak ponownego pobierania | kolejne tury w `registry.json` |
| #17 `C-03`, #21 `C-07` | komentarze z ustaleniami | — | patrz *Ustalenia* niżej |

Postęp jest opisany w komentarzach w tych issues (2026-10-30).

## Ustalenia, które zmieniają plan

1. **Żaden model GIA nie ma licencji.** ICE-6G_C, GLAC-1D i ANU-ICE mają tylko prośbę o cytowanie. Brak licencji = brak zgody na publikację pochodnych.
2. **Fallback z czystą licencją: Steffen & Kaufmann 2025** (`10.5281/zenodo.15481755`, CC BY 4.0). Pola RSL z ANU-ICE (1998), 10°W–70°E / 45–85°N, 21,4 ka → 0. Paleo-DEM: `H_paleo = H_now − RSL(t)`. To nie narusza §0.1, bo RSL zawiera już człon eustatyczny i geoidalny. **Reżim C może ruszyć bez czekania na odpowiedzi.**
3. **ESD 16, 585 (2025) nie jest pełnym fallbackiem.** Obejmuje tylko 11,7–0 ka i bazuje na ICE-5G Peltiera. Zostaje jako kontrola w `V-12`.
4. **ICE-6G_C (PMIP4) ma siatkę 10′**, nie 1°. **GLAC-1D ma krok co 100 lat**, więc przekroje zdarzeniowe nie wymagałyby interpolacji.
5. **⛔ Stroeven 2016 ma licencję CC BY-NC-ND 4.0.** Bez zgody autorów nie może być opublikowaną geometrią lądolodu. Do tego czasu geometrią wiodącą jest DATED-1 (CC BY 3.0).
6. **Proponowana kolejność fallbacków:** ICE-6G_C → GLAC-1D → Steffen & Kaufmann 2025 → ESD 2025 (tylko 11,7–0 ka).
7. **Minimum do pierwszej wizualizacji (M3):** GEBCO 2024 + RSL Steffena i Kaufmanna + DATED-1 + liczby z literatury (Andrén 2011, Uścinowicz). Wszystko ✅. EMODnet, ICE-6G_C, GLAC-1D i Stroeven to późniejsze ulepszenia jakości.

**Nie wprowadzone jeszcze do backlogu ani do opisów issues** (są tylko w komentarzach): pkt 2, 3, 4, 5, 6. Do zrobienia: aktualizacja `baltic-issues-backlog.md` (`0-02`, `C-03`, `C-07`, `V-12`) i ponowna synchronizacja opisów issues.

## Pipeline danych — jak to działa

Szczegóły: [`tools/data/README.md`](../../tools/data/README.md).

```powershell
npm run data:fetch -- --tier 1      # pobranie + weryfikacja (stdlib, bez venv)
npm run data:fetch -- --offline     # tylko weryfikacja cache'u
python -m venv .venv; .venv\Scripts\python -m pip install -r tools/data/requirements.txt   # do przetwarzania
```

- `registry.json` zawiera listę zbiorów z URL-ami, rozmiarami i MD5 ze źródła. `checksums.lock.json` przypina SHA-256 przy pierwszym pobraniu.
- `fetch.py` odmawia pobrania zbioru bez wpisu w `SOURCES.md`.
- Przetestowane: idempotencja, `--offline`, wykrywanie uszkodzonego pliku (kod 1), odrzucanie nieznanego `id`.
- `data/raw/` (~905 MB), `data/interim/` i `.venv/` są w `.gitignore`. Po świeżym klonie trzeba je odtworzyć.

### Dane w `data/raw/`

| `id` | Co | Uwagi do użycia |
| :-- | :-- | :-- |
| `gebco2024` | GeoTIFF 0–90°N / 0–90°E, 15″, `int16`, EPSG:4326 | okno 9–33°E / 53–67°N = 5760 × 3360 komórek; min −739 m (Rów Norweski) |
| `steffen2025_rsl` | 8 × `rsl_SK05_skan_<model>.nc`, zmienna `RSL(time, lat, lon)`, 1° | m względem 1950, **dodatnie = morze wyżej niż dziś**; czas w ka BP, **19 nierównych kroków** (21,4; 20,2; 19,1; 17,9; 16,8; 15,6; 14,1; 13,0; 11,3; 10,2; 8,9; 7,8; 6,8; 5,7; 4,4; 3,2; 2,0; 0,9; 0) → klatki co 500 lat wymagają interpolacji w czasie |
| `dated1` | `DATED-1_TimeSlices_shp.zip`: 58 × `TS<ka>_{min,mc,max}.shp` | geometria lądolodu do czasu zgody na Stroevena |

Kontrola sensowności (model `sk1`):
- Umeå ~282 m przy 11,3 ka (najwyższa linia brzegowa ~286 m);
- Gdańsk −25 m przy 8,9 ka i −14 m przy 7,8 ka (Uścinowicz: ~−28 m / 8,5 ka, ~−10 m / 7,0 ka).

## Następne kroki (w kolejności)

1. **Wysłać zapytania licencyjne** (`docs/research/licensing-inquiries.md`): Peltier (#1) i Tarasov (#2) w pierwszej kolejności, Stroeven (#4). Przed wysłaniem użytkownik uzupełnia `[NADAWCA]`, `[ROLA]` i opis KMD Labs. Kluczowe: **czy projekt jest niekomercyjny**.
2. **Prototyp `C-01` + `C-03` + `C-04` (MVP, fazy morskie)** w `tools/data/postglacial.py`:
   - przyciąć GEBCO do okna;
   - interpolować RSL do siatki i do kroków 500 lat (`dataQuality: "interpolated"`);
   - policzyć `H_now − RSL(t)`;
   - zrobić flood-fill z zasiewem w Skagerraku;
   - sprawdzić Littorinę ~7,8 ka i dziś.
   Przy okazji dodać `data:build` do `package.json` (#10).
3. Zaktualizować backlog o ustalenia z sekcji wyżej i zsynchronizować opisy issues.
4. Równolegle: ustalić źródła batymetrii jezior (#16 `C-02`, Ładoga przede wszystkim). To jedyne dane na ścieżce krytycznej bez wskazanego zbioru.

## Pułapki środowiska (Windows)

- **Tożsamość git nie jest skonfigurowana.** Commity w tej sesji szły z `git -c user.name=marcinwood -c user.email=derewonko.mm@gmail.com commit …`, bez zmiany globalnej konfiguracji. Push: `git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push`.
- `gh` jest zalogowany jako `marcinwood`.
- Konsola używa cp1250: skrypty Pythona, które drukują znaki spoza tej strony kodowej, potrzebują `sys.stdout.reconfigure(encoding="utf-8")`. `python -I` ignoruje `PYTHONIOENCODING`.
- Strona danych Peltiera (`atmosp.physics.utoronto.ca`) ma uszkodzony certyfikat TLS. Pobieranie z wyłączoną weryfikacją jest zablokowane, więc dane ICE-6G_C brać z PMIP4 (`pmip4.lsce.ipsl.fr`, ShareBox LSCE).
- Licencje DOI najszybciej sprawdzać przez `https://api.datacite.org/dois/<doi>` (pole `rightsList`).
