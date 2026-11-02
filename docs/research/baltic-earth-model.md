# Wybór modelu Ziemi — co mówią obserwacje i czego nie rozstrzygają

> Wynik `V-03` (#42), zmierzony 2026-11-02. Wszystkie liczby odtwarzalne:
> `npm run data:fetch -- --tier 2`, `py -m tools.data.rsl_validation`, `npm run validate`.

Steffen i Kaufmann 2025 publikują pola RSL dla **ośmiu modeli Ziemi**. Aplikacja wysyłała `sk1`,
bo taka była domyślna wartość `--model` w `postglacial.py` — czyli **z braku decyzji, nie z decyzji**.
`V-03` tę decyzję uzasadnia liczbowo, i wynik nie jest tym, co było wysyłane.

## Dane kontrolne

Baza **Rosentau i in. 2021** (GFZ `10.5880/GFZ.1.3.2020.003`, CC BY 4.0): arkusz `Short-form` ma
11 399 wierszy, z czego 204 autorzy odrzucili, a ~10 tys. to wypełniacz (wszystkie komórki
numeryczne zerowe, więc pozycja 0°N 0°E). Po odrzuceniu jednych i drugich zostaje **dokładnie
1 099** wskaźników — liczba, którą podaje plan i issue, więc filtr odtwarza pojęcie „użytecznego
wskaźnika" autorów, a nie wymyślony tutaj próg. Skrypt sprawdza tę liczbę i zatrzymuje się, jeśli
się zmieni.

**Porównanie nie wymaga transformacji datum,** i to jest istotne: baza podaje RSL względem
dzisiejszego lokalnego poziomu, a pole Steffena tę samą wielkość w tej samej konwencji. Gdybyśmy
porównywali *paleo-DEM*, trzeba by przejścia `contemporaneous-geoid` ↔ dziś — a to jest dokładnie
ten krok, w którym §0.1 i §0.2 się mylą. Walidacja pola RSL wprost ten krok omija, zamiast go
wykonywać i mieć nadzieję.

Kontrola spójności: Python próbkuje pole tak samo, jak robi to aplikacja (`bilinear_layer` i
`rsl_at` są pisane jako odpowiedniki `paleo.ts`, a `tests/contract/paleo.test.ts` trzyma je razem).
Zmierzona zgodność na tych samych 1 099 punktach: **maks. 8 mm**. Dlatego tabela liczona w Pythonie
reprezentuje wartości aplikacji.

## Ranking: `sk1` jest szósty z ośmiu

| model | RMSE [m] | mediana \|r\| | bias | p90 \|r\| | najgorszy region |
| :-- | --: | --: | --: | --: | :-- |
| **p79** | **11,62** | 3,69 | +1,34 | 18,1 | środkowa Szwecja 31,7 |
| l79 | 12,38 | 3,68 | +0,49 | 20,1 | Litwa 20,1 |
| sk2 | 12,42 | 3,94 | +1,65 | 18,1 | środkowa Szwecja 26,6 |
| j88 | 12,80 | 5,31 | −2,21 | 19,4 | środkowa Szwecja 35,0 |
| sk3 | 14,23 | 4,44 | +2,65 | 20,6 | Litwa 20,5 |
| **sk1 (wysyłany)** | **14,26** | 5,21 | −0,61 | 23,3 | Litwa 22,7 |
| g76 | 14,30 | 3,85 | +1,46 | 17,9 | Litwa 19,2 |
| f75 | 14,97 | 3,89 | +2,49 | 17,0 | Dania 19,5 |

Wynik jest **odporny**, nie artefaktem jednej statystyki: `p79` ma najniższy RMSE, niską medianę
reszt, **wygrywa w 11 z 13 regionów** i we wszystkich trzech klastrach bazy (regresja 16,1 vs 18,7;
transgresja 6,6 vs 10,9; nieokreślone 12,8 vs 14,7). Po wyłączeniu małej próby z północnej Szwecji
(n = 12, RSL do 269 m) nadal prowadzi (11,56).

## Co `p79` naprawia

Poziomy faz jeziornych — czyli **audytowe ustalenie B1**, które mówiło, że rysowane poziomy są
o 6–14 m za wysokie:

| t [cal BP] | sk1 | **p79** | literatura | sk1 − lit | **p79 − lit** |
| --: | --: | --: | --: | --: | --: |
| 15 000 | 31,8 | 19,3 | 25,0 | +6,8 | −5,7 |
| 14 000 | 38,9 | 25,2 | 25,0 | +13,9 | **+0,2** |
| 13 000 | 36,5 | 23,4 | 25,0 | +11,5 | **−1,6** |
| 12 000 | 32,3 | 20,4 | 25,0 | +7,3 | −4,6 |
| 10 300 | 22,1 | 14,4 | 10,0 | +12,1 | +4,4 |
| 10 000 | 18,6 | 12,2 | 6,0 | +12,6 | +6,2 |
| 9 000 | 6,4 | 1,9 | 0,0 | +6,4 | **+1,9** |

Najgorsze odchylenie w fazie BIL spada z **+13,9 m do −5,7 m**, a przy 14 i 13 ka model trafia w
literaturę z dokładnością do ~1,6 m. B1 przestaje być w dużej mierze problemem.

## Czego `p79` psuje — i dlaczego to nie jest argument przeciw

Przy 11 650 cal BP, czyli po finalnym drenażu Billingen, `sk1` otwiera połączenie z oceanem
(poziom spada 31,3 → 0,0 m), a **`p79` go nie otwiera**: basen zostaje jeziorem na +19,3 m przez
całą Yoldię. Kontrola zdarzeniowa spadku Billingen daje więc 0,3 m zamiast 25–28 m.

Wygląda to jak regres, ale **nie jest dowodem przeciw `p79`** — jest potwierdzeniem B3. Audyt już
zmierzył, że o tym połączeniu rozstrzyga margines kilku metrów, podczas gdy sąsiednie węzły pola
RSL różnią się w tej epoce o ~50 m (p95) do 85 m (maks.). Pytanie „czy przy 11,65 ka jest
połączenie" jest zero-jedynkowe i rozstrzygane z precyzją **mniejszą niż szum wejścia**. Oba modele
odpowiadają na nie w granicach tego szumu — `sk1` przypadkiem zgodnie z literaturą, `p79` przypadkiem
niezgodnie.

Wniosek ogólny, który trzeba zapisać wprost: **drenaż Billingen nie jest rozstrzygalny z pola o
rozdzielczości 1°.** Kontrola `V-06` dla tego zdarzenia mierzy w znacznej części rozdzielczość pola,
nie jakość rekonstrukcji.

## Stan decyzji: `sk1` zostaje, świadomie i widocznie

Aplikacja **nadal wysyła `sk1`**, a `V-03` **raportuje**, że `p79` pasuje lepiej. To nie jest
przeoczenie:

1. Przełączenie modelu to zmiana naukowych twierdzeń aplikacji z realną wadą (utrata drenażu
   Billingen), a nie poprawka techniczna — należy do właściciela projektu, nie do bramki
   arytmetycznej.
2. Decyzja jest teraz **tania i odwracalna**: `py -m tools.data.postglacial --rsl-only --model p79`
   przebudowuje kostkę z 2 MB pobrań (bez 1,87 GB batymetrii), a `npm run data:sills`,
   `data:manifest`, `audit:metrics` i `validate` przeliczają wszystko, co z niej wynika. Właśnie po
   to te generatory powstały.
3. Koszt przełączenia jest znany: trzeba przebazować tabele audytu (opisują `sk1`), progi w
   `validate.test.ts` i `water.test.ts` oraz dwa testy lodu, które przy `p79` padają, bo jezioro
   przy 13 ka nie jest już tamowane lodem w tym samym stopniu.

Jeśli priorytetem jest **zgodność poziomów z literaturą**, przełączyć na `p79`. Jeśli priorytetem
jest **odtworzenie sekwencji zdarzeń** (drenaż Billingen jako widoczne wydarzenie w aplikacji),
zostać przy `sk1`. Trzecia droga, merytorycznie najlepsza i najdroższa: **pole o wyższej
rozdzielczości**, po którym pytanie przestaje być losowane przez szum.

## Pole południowobałtyckie: regionalnie lepsze od globalnego

Porównanie na wybrzeżu PL / DE / LT (307 wskaźników objętych oknem pola regionalnego):

| pole | RMSE [m] |
| :-- | --: |
| `steffen2025_rsl` (sk1), 10°W–70°E | 10,14 |
| `steffen2025_rsl_sbaltic` m71 | **7,64** |
| `steffen2025_rsl_sbaltic` jb9 | 8,23 |
| `steffen2025_rsl_sbaltic` ib9 | 8,26 |
| `steffen2025_rsl_sbaltic` pb9 | 8,15 |
| `steffen2025_rsl_sbaltic` pb7 | 8,69 |
| `steffen2025_rsl_sbaltic` kb6 | 9,77 |
| `steffen2025_rsl_sbaltic` fb6 | 10,01 |
| `steffen2025_rsl_sbaltic` f67 | 11,63 |
| `steffen2025_rsl_sbaltic` f52 | 11,70 |

Pole regionalne jest na południu **o ~2,5 m lepsze** od globalnego. Nie jest wykorzystywane:
łączenie dwóch pól o różnych rozdzielczościach wymagałoby strefy przejściowej i własnej walidacji,
a to osobne zadanie. Zapisane jako ustalenie, nie zrobione.

## Co ten wynik mówi o całej rekonstrukcji

RMSE **11,6–15,0 m** dla wszystkich ośmiu modeli, przy zakresie obserwacji od −51 do +269 m, to
~4% zakresu. Rozstrzygające jest jednak nie to, lecz zgodność tego rzędu wielkości z B3: pole ma
1°, a sąsiednie węzły różnią się do 85 m, więc interpolacja nie może ustawić poziomu lepiej niż
~1/5 tego kroku. **Różnica między modelami (2,6 m) jest mniejsza niż błąd każdego z nich (12–14 m),
a ten błąd pochodzi z rozdzielczości, nie z reologii.**

To jest ilościowa odpowiedź na B1: poziomy jezior rozjeżdżały się z literaturą o 6–14 m, a pole
samo w sobie nie potrafi lepiej niż ~12 m. Rekonstrukcja jest **tak dobra, jak jej pole RSL**, i
dalszy postęp wymaga lepszego pola, nie innego modelu.
