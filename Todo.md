# Todo — kandydaci na następną iterację

> **Czym ten plik jest, a czym nie.** Tu leżą **propozycje**, które nie mają jeszcze issue:
> ocenione pod kątem wartości i kosztu, ale nie zatwierdzone. Zadania **śledzone** są w
> [`docs/research/baltic-issues-backlog.md`](docs/research/baltic-issues-backlog.md) i w GitHub
> Issues — i to one są źródłem prawdy o stanie prac. Pozycja stąd, którą się przyjmie, przechodzi
> do backlogu i z niego znika.
>
> Stan: 2026-11-02, po domknięciu `V-03`. Liczby poniżej są zmierzone
> (`npm run validate`, `npm run audit:metrics`), nie oszacowane.

---

## Stan wyjściowy: co faktycznie ogranicza tę rekonstrukcję

Wniosek z `V-03`, od którego zależy cała kolejność niżej:

- RMSE modelowanego poziomu morza wobec 1 099 datowanych wskaźników: **14,26 m**.
- Rozrzut między ośmioma modelami Ziemi: **2,6 m**. Błąd każdego z nich: **11,6–15,0 m**.
- Przyczyna: pole RSL ma **1°**, DEM **0,025°**; sąsiednie węzły pola różnią się do **85 m**.

**Różnica między modelami jest mniejsza niż błąd każdego z nich.** Czyli dobieranie modelu to
optymalizowanie nie tego parametru, który ogranicza wynik. Ograniczeniem jest **rozdzielczość
pola**, nie reologia.

Drugi wniosek, równie ważny, bo dotyczy uczciwości, nie dokładności: **aplikacja rysuje ostry
brzeg, którego położenie we wczesnym holocenie niesie niepewność rzędu dziesiątek kilometrów**
(1 m błędu poziomu ≈ 0,7–1,4 km brzegu). Pas niepewności w UI dotyczy wyłącznie lodu.

---

## Priorytet 1 — pas niepewności linii brzegowej z ośmiu modeli

**Jedyna zmiana, która naprawia najsłabszy punkt merytoryczny i jednocześnie wygląda lepiej niż
stan obecny.**

Osiem pól RSL jest **pobranych**. Każde daje własną linię brzegową; ich obwiednia *jest* pasem
niepewności. Nie trzeba niczego modelować — trzeba przestać wyrzucać siedem z ośmiu wyników.

- **Merytoryka:** domyka audytowe B3 w interfejsie, nie tylko w dokumencie. Obraz przestaje mieć
  większą powagę niż zastrzeżenie pod nim.
- **Wizualnie:** miękki pas zamiast twardej kreski czyta się jako „to jest model". Przy 13 ka pas
  będzie szeroki i **to jest jego treść**.
- **Budżet — sprawdzony:** kostka RSL waży 102 KB, siedem dodatkowych to 716 KB. Pierwsze wejście
  ma 2,58 z 4,00 MiB, więc zostaje ~1,4 MiB zapasu. Wchodzi z marginesem.
- **Koszt:** emisja siedmiu kostek (`--rsl-only` per model), zmiana w shaderze, pozycja w manifeście,
  chip warstwy. Średni.
- **Ryzyko:** `V-03` liczy RMSE dla wysyłanego modelu z zacommitowanej kostki — po publikacji
  pozostałych siedmiu warto, żeby liczył je wszystkie z assetów, nie z tabeli Pythona.

## Priorytet 2 — mapa „kiedy ten ląd wyszedł z wody"

Dla każdej komórki dziś nad wodą: **moment wynurzenia**. Jedna statyczna warstwa streszczająca
20 000 lat — Botnik młody, Dania stara, między nimi gradient wypiętrzania.

- **Najniższy koszt z całej listy.** Worker już liczy wszystkie 27 masek; wystarczy je akumulować.
  Zero nowych danych, zero decyzji modelowych.
- **Merytoryka:** nowa wielkość wyprowadzona, nie ozdoba. Weryfikowalna — gradient wynurzania musi
  zgadzać się z `V-08`.
- **Wizualnie:** natychmiast czytelna dla kogoś, kto nic nie wie o Bałtyku.
- **Uwaga:** rozdzielczość czasowa to 1 ka, więc „moment" ma ziarno tysiąca lat i trzeba to napisać
  na legendzie, a nie zostawić gradientowi.

## Priorytet 3 — obserwacje RSL na wykresie krzywych

Panel krzywych pokazuje modelowany RSL dla Umeå, Sztokholmu i Gdańska. Dołożyć **zmierzone punkty
z bazy Rosentaua** — z paskami błędu, w pobliżu klikniętego punktu.

Przenosi `V-03` z raportu do interfejsu: użytkownik **widzi**, jak model trafia w pomiary. Żadna
liczba w karcie fazy tego nie zrobi.

- **Dane są wyciągnięte** (`tools/validate/data/rsl-observations.json`, 381 KB); trzeba opublikować
  okrojoną wersję do assetów — bez próbkowań ośmiu modeli zmieści się w ~120 KB.
- **Koszt:** niski. Panel, dobór punktów po odległości, legenda.
- **Licencja:** `rosentau2021` to CC BY 4.0, atrybucja już w panelu źródeł.

---

## Wizualne, bez wpływu na merytorykę

| | Opis | Koszt |
| :-- | :-- | :-- |
| **Cieniowanie głębokości paleo-dna** | dziś woda ma jeden kolor per klasa fazy; kolorowanie batymetryczne to mała zmiana w shaderze (ma już `hp` i klasę wody). Przy okazji informacyjne: widać, że Bałtyk to seria basenów rozdzielonych progami, co jest sednem jego historii | niski |
| **Przekrój rysowany przez użytkownika** | przekrój jest przypięty do Umeå → Gdańsk; przeciągnięcie własnej linii zamienia panel z ilustracji w narzędzie | średni |
| **Wkładka z lodem w prawdziwej skali** | przekrój obejmuje 780 m, lądolód ~3000 m, więc pokazuje kształt znormalizowany. Mała wkładka z rzeczywistą skalą pionową pokazałaby proporcję bryły do basenu pod nią | niski |

---

## Czego nie dodawać — i dlaczego

| | Powód |
| :-- | :-- |
| **Strumienie lodowe** | brak danych bez problemu licencyjnego. Dorysowanie „z wyczucia" dodałoby pozornej precyzji do schematu, który już jest schematem |
| **Model zasolenia** | klasy wody to dziś etykiety z literatury i są tak opisane. Prawdziwy model transportu to osobny projekt, nie funkcja |
| **Batymetria jezior** | GEBCO jej nie ma, `GLOBathy` odrzucone (`0-03`), a parametryczna misa z literatury byłaby wymyśleniem dna |
| **Więcej detalu na bryle lodu** | grubość jest profilem plastycznym; każdy dodany detal to precyzja, której nie ma |

---

## Rzecz, która zmieniłaby więcej niż wszystko powyżej

**Gęstsze pole RSL.** Dwie licencyjnie czyste drogi:

1. **Połączenie z polem południowobałtyckim** (`steffen2025_rsl_sbaltic`, **już pobrane**). Na
   wybrzeżu PL/DE/LT jest lepsze o **2,5 m** (7,64 wobec 10,14 m RMSE). Wymaga strefy przejściowej
   między dwiema rozdzielczościami i własnej walidacji — bounded i mierzalne.
2. **`esd2025`** (CC BY 4.0, zarejestrowane, niepobrane) — **niezależna implementacja tej samej
   metody w rozdzielczości 0,01°**, czyli 40× gęstszej, dla 11,7–0 ka. Jako nakładka kontrolna
   byłaby najmocniejszym argumentem wiarygodnościowym, jaki ta aplikacja może dostać: rozbieżność
   linii brzegowej większa niż kilka kilometrów oznaczałaby błąd u nas.

---

## Decyzje czekające na właściciela projektu

Obie są zapisane w dokumentach, obie blokują pracę, żadnej nie podejmę sam.

### 1. Model Ziemi: `sk1` czy `p79`

Pełna argumentacja: [`docs/research/baltic-earth-model.md`](docs/research/baltic-earth-model.md).

| | `sk1` (wysyłany) | `p79` |
| :-- | :-- | :-- |
| RMSE wobec obserwacji | 14,26 m | **11,62 m** |
| wygrywa w regionach | 2 z 13 | **11 z 13** |
| najgorsze odchylenie poziomu BIL | **+13,9 m** | −5,7 m |
| drenaż Billingen przy 11,65 ka | **odtworzony** | **nie zachodzi** |

Jeśli priorytetem jest zgodność poziomów z literaturą — `p79`. Jeśli odtworzenie sekwencji zdarzeń
— `sk1`. Zmiana kosztuje `npm run data:build:rsl -- --model p79` plus przebazowanie tabel audytu i
progów w dwóch testach. **Trzecia droga, merytorycznie najlepsza: gęstsze pole**, po którym to
pytanie przestaje być rozstrzygane przez szum.

### 2. `A-05` (#74): rozkład osadów holoceńskich w czasie

Jedyne otwarte zadanie merytoryczne w backlogu. `zhang2024_sed` to mapa **dzisiejszej** miąższości,
więc rozłożenie jej w czasie jest wyborem modelowym: stałe tempo? wiązane z krzywą RSL? per faza?

Moja rekomendacja: narastanie proporcjonalne do czasu od zalania danej komórki (osad odkłada się
tam, gdzie jest woda), z jawnym `dataQuality: "modelled"`. Ale to decyzja merytoryczna, nie
techniczna.

**Skutek pominięcia, dla jasności:** głębokości i objętość starszych klatek są **systematycznie
zaniżone** — w depocentrach o kilkanaście do kilkudziesięciu metrów.

---

## Drobne, z audytu higieny 2026-11-02

Zapisane, żeby nie zginęły; żadne nie jest pilne.

- **`paleo-data.service.ts` (572 linie) nie ma własnych testów.** Logika czysta jest wyniesiona do
  `core/data/*` i przetestowana, ale `pointInfo`, `transect`, `sceneWater`, `outletOf` i
  `iceThicknessAt` żyją w serwisie i są pokryte tylko pośrednio. **Największa realna luka
  w pokryciu.** Naprawa to wstrzyknięcie zależności zamiast `inject()` — refaktor, nie poprawka.
- **Boilerplate wczytania siatek powtarza się w czterech plikach testów** mimo `tools/lib/frames.ts`
  (~27 linii). Jest kontrargument: `paleo.test.ts` **musi** wczytywać niezależnie, bo to on waliduje
  sam loader wobec pipeline'u. Do rozstrzygnięcia, które testy mają zostać niezależne.
- **`projection.ts` bez testu** — geometria odwzorowania używana przez widok bloku.
- **~8 martwych eksportów** (`OCEAN_SEEDS`, `MASK_HIT`, `lccParams`, `enclosingRect`, `BLOCK_KM`…).
  Część dokumentuje reguły, więc zdejmowanie `export` obniżyłoby czytelność bez zysku.
- **`A-06` (#75) do ręcznego zamknięcia** — jego ostatni punkt DoD (`audit:metrics` w CI) jest
  spełniony od `0-08`, ale commit napisał „Completes", nie „Closes".
