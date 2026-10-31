# Stan prac — przekazanie sesji

> Ostatnia aktualizacja: **2026-10-31**. Dokument dla następnej sesji (człowieka lub agenta): gdzie jesteśmy, co jest rozstrzygnięte, co dalej. Aktualizować na końcu każdej sesji.

## TL;DR

- **Zakres zawężony (2026-10-31): aplikacja wizualizuje wyłącznie postglacjał, 20 ka → dziś.** Usunięte: fanerozoik (epik A), czwartorzęd (B), mikroskala czterech wybrzeży (D) i zależne od nich testy `V-04`, `V-05`, `V-09`, `V-10`. Backlog: **35 zadań w 4 epikach** (0, C, V, I), kamienie milowe M1–M6.
- Odpowiadające issues **usunięte z GitHuba** (14 sztuk), milestone'y „Fanerozoik” i „Cztery wybrzeża” usunięte, „Domknięcie” przemianowane na M6. Opisy pozostałych 35 issues zsynchronizowane z backlogiem.
- Ustalenia licencyjne z 2026-10-30 są już **w planie i backlogu** (nie tylko w komentarzach): start na RSL Steffena i Kaufmanna 2025, DATED-1 jako geometria lądolodu, Stroeven tylko wewnętrznie.
- **Tura 1 danych jest pobrana i zweryfikowana:** GEBCO 2024, pola RSL Steffena i Kaufmanna 2025, DATED-1. Wystarczają do pierwszego paleo-DEM-u faz morskich (M3) bez czekania na odpowiedzi licencyjne.

## Gałęzie i PR-y

| Gałąź | Stan | Zawartość |
| :-- | :-- | :-- |
| `tellin` | PR #6 scalony do `main`; potem PR #56 scalony do `tellin` | `tellin` ma 2 commity, których nie ma na `main` (`fetch.py`, `SOURCES.md`, sync decka) |
| `docs/postglacial-scope` | PR do `main` (zawiera też commity z `tellin`) | zawężenie zakresu: plan, backlog, deck, `SOURCES.md`, zapytania licencyjne, ten plik |

## Issues — mapa i stan

Pełny backlog: [`baltic-issues-backlog.md`](baltic-issues-backlog.md) (źródło prawdy dla issues). Numery: `0-01`…`0-08` → #7–#14, `C-01`…`C-15` → #15–#29 (`C-09` = #22, `C-08` = #23, `C-14` = #27, `C-13` = #28), `V-01` = #40, `V-02` = #41, `V-03` = #42, `V-06` = #45, `V-07` = #46, `V-08` = #47, `I-01` = #50, `V-11` = #51, `V-12` = #52, `I-02`…`I-04` → #53–#55. Numery #30–#39, #43, #44, #48, #49 należały do usuniętych zadań.

| Issue | Stan | Odhaczone w DoD | Co zostało |
| :-- | :-- | :-- | :-- |
| #8 `0-02` licencje GIA | research gotowy, maile **niewysłane** | — | wysłać zapytania, zapisać odpowiedzi, wpisać decyzję i `gia.source` |
| #9 `0-03` `SOURCES.md` | rejestr ograniczony do postglacjału | — | rozstrzygnąć pozycje ❓, uzupełnić atrybucje |
| #10 `0-04` szkielet | minimalny | zamrożone zależności | `data:build`, pozostałe skrypty pipeline'u |
| #11 `0-05` `fetch.py` | tura 1 gotowa | błąd przy złej sumie, brak ponownego pobierania | kolejne tury w `registry.json` |

## Ustalenia, które zmieniły plan (2026-10-30, wprowadzone 2026-10-31)

1. **Żaden model GIA z paleotopografią nie ma licencji.** ICE-6G_C, GLAC-1D i ANU-ICE mają tylko prośbę o cytowanie.
2. **Start: Steffen & Kaufmann 2025** (`10.5281/zenodo.15481755`, CC BY 4.0). Pola RSL z ANU-ICE (1998), 10°W–70°E / 45–85°N, 21,4 ka → 0. Paleo-DEM: `H_paleo = H_now − RSL(t)`. Kontrakt dostał pole `gia.source` + `gia.earthModel`.
3. **ESD 16, 585 (2025)** obejmuje tylko 11,7–0 ka — zostaje jako kontrola w `V-12`.
4. **ICE-6G_C (PMIP4) ma siatkę 10′**, **GLAC-1D krok co 100 lat** — ulepszenia po zgodzie.
5. **⛔ Stroeven 2016 ma licencję CC BY-NC-ND 4.0.** Geometrią wiodącą jest DATED-1 (CC BY 3.0).
6. **Kolejność fallbacków:** ICE-6G_C → GLAC-1D → Steffen & Kaufmann 2025 → ESD 2025 (tylko 11,7–0 ka).

## Pipeline danych — jak to działa

Szczegóły: [`tools/data/README.md`](../../tools/data/README.md).

```powershell
npm run data:fetch -- --tier 1      # pobranie + weryfikacja (stdlib, bez venv)
npm run data:fetch -- --offline     # tylko weryfikacja cache'u
python -m venv .venv; .venv\Scripts\python -m pip install -r tools/data/requirements.txt   # do przetwarzania
```

- `registry.json` zawiera listę zbiorów z URL-ami, rozmiarami i MD5 ze źródła. `checksums.lock.json` przypina SHA-256 przy pierwszym pobraniu.
- `fetch.py` odmawia pobrania zbioru bez wpisu w `SOURCES.md`.
- `data/raw/` (~905 MB), `data/interim/` i `.venv/` są w `.gitignore`. Po świeżym klonie trzeba je odtworzyć.

### Dane w `data/raw/`

| `id` | Co | Uwagi do użycia |
| :-- | :-- | :-- |
| `gebco2024` | GeoTIFF 0–90°N / 0–90°E, 15″, `int16`, EPSG:4326 | okno 9–33°E / 53–67°N = 5760 × 3360 komórek; min −739 m (Rów Norweski) |
| `steffen2025_rsl` | 8 × `rsl_SK05_skan_<model>.nc`, zmienna `RSL(time, lat, lon)`, 1° | m względem 1950, **dodatnie = morze wyżej niż dziś**; czas w ka BP, **19 nierównych kroków** (21,4; 20,2; 19,1; 17,9; 16,8; 15,6; 14,1; 13,0; 11,3; 10,2; 8,9; 7,8; 6,8; 5,7; 4,4; 3,2; 2,0; 0,9; 0) → klatki co 500 lat wymagają interpolacji w czasie |
| `dated1` | `DATED-1_TimeSlices_shp.zip`: 58 × `TS<ka>_{min,mc,max}.shp` | geometria wiodąca lądolodu |

Kontrola sensowności (model `sk1`):
- Umeå ~282 m przy 11,3 ka (najwyższa linia brzegowa ~286 m);
- Gdańsk −25 m przy 8,9 ka i −14 m przy 7,8 ka (Uścinowicz: ~−28 m / 8,5 ka, ~−10 m / 7,0 ka).

## Następne kroki (w kolejności)

1. **Scalić PR `docs/postglacial-scope`** do `main` (zawiera też niescalone commity z `tellin`).
2. **Wysłać zapytania licencyjne** (`docs/research/licensing-inquiries.md`): Peltier (#1) i Tarasov (#2), potem Stroeven (#4). Przed wysłaniem uzupełnić `[NADAWCA]`, `[ROLA]` i opis KMD Labs. Kluczowe: **czy projekt jest niekomercyjny**.
3. **Prototyp `C-01` + `C-03` + `C-04` (MVP, fazy morskie)** w `tools/data/postglacial.py`:
   - przyciąć GEBCO do okna;
   - interpolować RSL do siatki i do kroków 500 lat (`dataQuality: "interpolated"`);
   - policzyć `H_now − RSL(t)`;
   - zrobić flood-fill z zasiewem w Skagerraku;
   - sprawdzić Littorinę ~7,8 ka i dziś.
   Przy okazji dodać `data:build` do `package.json` (#10).
4. Równolegle: ustalić źródła batymetrii jezior (#16 `C-02`, Ładoga przede wszystkim). To jedyne dane na ścieżce krytycznej bez wskazanego zbioru.

## Pułapki środowiska (Windows)

- **Tożsamość git nie jest skonfigurowana.** Commity idą z `git -c user.name=marcinwood -c user.email=derewonko.mm@gmail.com commit …`, bez zmiany globalnej konfiguracji. Push: `git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push`.
- `gh` jest zalogowany jako `marcinwood`.
- Konsola używa cp1250: skrypty Pythona, które drukują znaki spoza tej strony kodowej, potrzebują `sys.stdout.reconfigure(encoding="utf-8")`. `python -I` ignoruje `PYTHONIOENCODING`.
- Strona danych Peltiera (`atmosp.physics.utoronto.ca`) ma uszkodzony certyfikat TLS. Pobieranie z wyłączoną weryfikacją jest zablokowane, więc dane ICE-6G_C brać z PMIP4 (`pmip4.lsce.ipsl.fr`, ShareBox LSCE).
- Licencje DOI najszybciej sprawdzać przez `https://api.datacite.org/dois/<doi>` (pole `rightsList`).
