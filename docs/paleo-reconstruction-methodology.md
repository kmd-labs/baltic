# Metodyka rekonstrukcji paleogeograficznej

> `0-07` (#13). Opisuje, jak liczone jest wszystko, co aplikacja rysuje, i **czego nie liczy**.
> Każda liczba w tym dokumencie jest odtwarzalna: `npm run audit:metrics`, `npm run validate`.

## 1. Paleo-wysokość

```
H_paleo(x, t) = H_now(x) − RSL(x, t)
```

**Nazwy pliku i zmiennej, nie pojęcia** — i to jest celowe. Plan wejściowy liczył eustatykę
podwójnie **właśnie dlatego**, że formuła nazywała „poziom morza" zamiast wskazać pole:

| symbol | skąd | plik | zmienna |
| :-- | :-- | :-- | :-- |
| `H_now` | GEBCO_2024 (`gebco2024`), średnia blokowa 15″ → 0,05° / 1/40° | `src/assets/data/grid/dem-europe.bin.gz`, `grid/dem-baltic.bin.gz` | warstwa 0 siatki KMDG |
| `RSL` | Steffen i Kaufmann 2025 (`steffen2025_rsl`) | `data/raw/steffen2025_rsl/rsl_SK05_skan_<model>.nc` → `grid/rsl.bin.gz` | **`RSL`** (`time`, `lat`, `lon`) |

`RSL` to **relatywny poziom morza w metrach względem 1950**, dodatnie = morze wyżej niż dziś.

### Dlaczego nie ma osobnego członu eustatycznego

Bo `RSL` już go zawiera. Pole Steffena i Kaufmanna jest rozwiązaniem równania poziomu morza:
zawiera człon eustatyczny (zmiana objętości oceanu), izostatyczny (ugięcie litosfery pod lodem i
jego relaksacja) **oraz** samograwitacyjną deformację geoidy. Dodanie krzywej eustatycznej do
`H_now − RSL` policzyłoby topnienie lądolodów **dwa razy**.

Eustatyka (Lambeck i in. 2014) służy w aplikacji **wyłącznie do odczytu w UI** — wiersz „ocean −X m"
na karcie fazy, żeby czytelnik widział, ile z lokalnej zmiany pochodzi z globalnego poziomu, a ile
z wypiętrzania. Nie wchodzi do żadnego rachunku.

### Interpolacja w czasie między nierównymi krokami

Oś czasu pola RSL **nie jest równomierna**:

```
21,4  20,2  19,1  17,9  16,8  15,6  14,1  13,0  11,3  10,2  8,9  7,8  6,8  5,7  4,4  3,2  2,0  0,9  0,0   [ka BP]
```

Interpolacja liniowa między dwoma najbliższymi węzłami, z przycięciem na krańcach
(`rslAt` w `src/app/core/data/paleo.ts`; odpowiednik w Pythonie: `rsl_at` w
`tools/data/postglacial.py`; `tests/contract/paleo.test.ts` trzyma oba razem).

**Konsekwencja, którą trzeba znać:** kroki sięgają 1,4 ka (między 15,6 i 14,1 ka). Klatka
aplikacji co 1000 lat jest więc **gęstsza niż dane**, a `dataQuality: "interpolated"` na karcie
fazy mówi o tym wprost. Odznaka „modelled" pojawia się tylko tam, gdzie klatka trafia w węzeł.

### Interpolacja w przestrzeni

Pole RSL ma **1°** (81 × 41 węzłów); DEM Bałtyku ma **1/40°** (0,025°). Próbkowanie biliniowe,
na komórkach wyrównanych do środka, z przycięciem na krawędzi (`bilinear` / `buildResampler`).
Stosunek rozdzielczości to **40–80×**, i to jest najpoważniejsze ograniczenie całej rekonstrukcji
— patrz §5.

## 2. Datum: `contemporaneous-geoid` wobec dzisiejszego poziomu

To jest pułapka §0.2 planu i powód, dla którego `datum` jest polem **obowiązkowym** w kontrakcie.

Niech `g(x, t)` będzie geoidą chwili *t*, a `g(x, 0)` dzisiejszą. Wtedy:

```
H_paleo(x, t)  jest wysokością nad g(x, t)          ← datum: contemporaneous-geoid
H_now(x)       jest wysokością nad g(x, 0)          ← datum: present-day
RSL(x, t)      jest różnicą poziomu morza:  RSL = [poziom morza przy t] − [poziom morza dziś],
               oba mierzone w tym samym punkcie x
```

Przejście między datum **nie jest dodaniem stałej**: `g(x, t) − g(x, 0)` zależy od położenia, bo
geoida deformuje się pod obciążeniem lodem. Dlatego:

- **Poziomy faz jeziornych (BIL +25 m, Ancylus +10 m) są poprawne tylko względem geoidy chwili *t***.
  Liczba „+25 m" bez tego zastrzeżenia jest bez znaczenia.
- **Porównanie z obserwacjami RSL nie wymaga tej transformacji** — i w `V-03` jej nie wykonujemy.
  Baza Rosentaua podaje RSL w tej samej konwencji co pole Steffena, więc porównujemy RSL z RSL.
  Porównywanie *paleo-DEM-u* z obserwacjami wymagałoby przejścia przez `g(x, t) − g(x, 0)`, którego
  nie mamy — i to jest dokładnie ten krok, w którym rekonstrukcje się mylą. Walidujemy pole, nie
  pochodną.

## 3. Woda: maska, poziom i próg sterujący

Aplikacja **nie progu je** `H_paleo < 0`. To by pokazywało każde zamknięte zagłębienie jako morze.

1. **Ocean:** zalewanie od zasiewów w Skagerraku i od zachodniej krawędzi okna (`OCEAN_SEEDS`),
   warunek `H_paleo < 0`, lód jako ściana.
2. **Basen:** *priority-flood* od oceanu nadaje każdej komórce **poziom przelewu**. Gdzie poziom
   przelewu głębi jest powyżej jej dna, basen jest jeziorem na tym poziomie — ustala go próg
   odpływu, nie ocean.
3. **Próg sterujący:** najwyższa komórka na najtańszej drodze z głębi do oceanu. Zwracana przez
   `fillWater` i pokazywana na karcie fazy (`C-06b`).

Reguła wody istnieje **raz** (`src/app/core/data/water.ts`), a GLSL dla GPU jest z niej
**generowany** (`WATER_RULE_GLSL`) — nie przepisywany. Kontrola: `tests/contract/water.test.ts`
tłumaczy GLSL z powrotem na JS i porównuje na siatce punktów.

Niezmiennik, który musi zachodzić i jest bramką CI (`V-02`): **jezioro zaporowe wymaga progu
powyżej ówczesnego oceanu, połączenie morskie poniżej.** Łamie się przy dwóch błędach, które
inaczej są niewidoczne: podwójnej eustatyce i pomylonym datum.

## 4. Lądolód

**Zasięg:** DATED-1 (`dated1`), warianty `min` / `mc` / `max`, przekroje co 1 ka dla 20 → 10 ka.
Klatki co 1 ka trafiają dokładnie w przekroje źródłowe; przekroje zdarzeniowe (11 750, 11 650)
są interpolowane i oznaczone odznaką.

Bryła na globie powstaje z **pola odległości ze znakiem** do marginesu, interpolowanego między
przekrojami — nie z morfowania wierzchołków. Powód: liczba pierścieni wariantów DATED-1 zmienia
się między przekrojami (1 → 16 → 5 w 20 → 10 ka), więc wierzchołki nie mają stabilnej
odpowiedniości. Interpolacja pola odległości morfuje zarys **i** wysokość razem, i znosi łączenie
oraz rozpadanie się lobów.

**Grubość: profil plastyczny**, nie dane.

```
h(d) = sqrt( 2 · τ₀ · d / (ρ_i · g) ) ,   τ₀ = 100 kPa,  ρ_i = 917 kg/m³,  g = 9,81 m/s²
```

`d` — odległość od marginesu w metrach. Daje ~149 m przy 1 km i **~2 982 m przy 400 km**.
τ₀ jest zapisane w `manifest.json` (`ice.tau0Pa`), więc czytelnik publikowanych danych może tę
liczbę zinterpretować.

**Uzasadnienie:** to kształt, jaki ma lądolód w równowadze z naprężeniem ścinającym u podstawy.
τ₀ ≈ 100 kPa to wartość typowa dla lądolodów plejstoceńskich.

**Ograniczenia — ważniejsze od wzoru:**
- DATED-1 publikuje **marginesy, nie grubość**. Modele, które mają grubość (ICE-6G_C, GLAC-1D), są
  wykluczone licencyjnie (`0-02`). Profil jest więc **schematem**, oznaczonym `dataQuality: "modelled"`.
- Zakłada równowagę i jednorodne τ₀. Realny lądolód ma **strumienie lodowe**, w których jest
  znacznie cieńszy niż profil plastyczny przewiduje — Bałtycki Strumień Lodowy biegł przez środek
  basenu i jest pominięty.
- **Nie wchodzi do paleo-DEM-u.** RSL zawiera już obciążenie lodem; dodanie grubości liczyłoby je
  drugi raz.
- DATED-1 kończy się na 10 ka, a resztki w Skandynawii przetrwały do ~9,7 ka. Bryła wygasza się
  liniowo w tym przedziale (`ICE_FADE_KA`) — wygaszanie dotyczy **przezroczystości, nie geometrii**,
  więc grubość raportowana poniżej 10 ka to profil przekroju 10 ka.

## 5. Co ogranicza całość: rozdzielczość pola RSL

Zmierzone skoki RSL między sąsiednimi węzłami 1° wewnątrz okna bałtyckiego:

| | 16 ka | 13 ka | 11 ka | 10 ka | 8 ka | 4 ka |
| :-- | --: | --: | --: | --: | --: | --: |
| maks. \|ΔRSL\| | **85,4 m** | 70,5 | 59,4 | 46,8 | 24,4 | 9,1 |
| p95 | 52,4 | 54,0 | 50,8 | 38,2 | 20,9 | 6,2 |

Nachylenia przybrzeżne: 0,724 m/km (południowy Bałtyk), 1,085 (środkowy), 1,447 (Botnik), czyli
**1 m błędu poziomu ≈ 0,7–1,4 km przesunięcia brzegu**.

Zmierzony skutek (`V-03`, 1 099 wskaźników): **RMSE 11,6–15,0 m** dla ośmiu modeli Ziemi.
Różnica między modelami (2,6 m) jest **mniejsza niż błąd każdego z nich**, a ten błąd pochodzi
z rozdzielczości, nie z reologii. Szczegóły i wybór modelu:
[`baltic-earth-model.md`](research/baltic-earth-model.md).

**Wniosek, który trzeba czytać razem z każdą linią brzegową w aplikacji:** linia jest ostra przy
każdym przybliżeniu, ale jej *położenie* niesie we wczesnym holocenie niepewność rzędu dziesiątek
kilometrów. Pas niepewności w UI dotyczy wyłącznie lodu, nie brzegu.

## 6. Chronologia i korelacja wiekowa

Osnowa: **cal yr BP**, Present = 1950. Granice faz za Andrénem i in. 2011
(`src/assets/data/timeline.json`, cytowanie per granica).

| faza | cal BP (od → do) | BCE / CE |
| :-- | --: | :-- |
| deglacjacja | 20 000 → 16 000 | 18 050 → 14 050 BCE |
| Bałtyckie Jezioro Lodowe | 16 000 → 11 700 | 14 050 → 9 750 BCE |
| Morze Yoldiowe | 11 700 → 10 700 | 9 750 → 8 750 BCE |
| Jezioro Ancylusowe | 10 700 → 9 800 | 8 750 → 7 850 BCE |
| Morze Mastogloia | 9 800 → 8 500 | 7 850 → 6 550 BCE |
| Morze Littorynowe | 8 500 → 4 000 | 6 550 → 2 050 BCE |
| post-littoryna | 4 000 → 0 | 2 050 BCE → 1950 CE |

Przeliczenie BCE/CE jest arytmetyczne: `rok = 1950 − t`, z przejściem przez rok 0 (`calendarYear`).

**Kolumny ¹⁴C BP w tej tabeli nie ma, i to jest decyzja, nie brak.** Rekalibracja (`C-09`) została
usunięta, a `intcal20` odrzucone — daty z literatury bierzemy **w cal BP, skalibrowane przez
autorów**. Dopisanie kolumny ¹⁴C wymagałoby odwrócenia kalibracji, co jest niejednoznaczne
(jednej dacie kalendarzowej może odpowiadać kilka dat radiowęglowych) i nie wniosłoby niczego poza
pozorem precyzji.

### Odstępstwa źródeł — wypisane, nie uśrednione

| granica | Andrén i in. 2011 (przyjęte) | inne wartości w literaturze |
| :-- | --: | :-- |
| koniec fazy ancylusowej | **9 800** cal BP | 9 500 cal BP u części autorów |

Zasada: **nie uśredniamy.** Średnia z 9 800 i 9 500 to 9 650 — wartość, której nie podaje nikt, i
test w `tests/contract/timeline.test.ts` ją wprost odrzuca. Rozbieżność jest zapisana w polu
`method` pliku `timeline.json`.

> **Czego tu brakuje i dlaczego.** Przypisanie wartości 9 500 do konkretnych autorów wymaga
> publikacji w ręku — backlog wymienia Björcka 1995/2008, Stroevena i in. 2016 oraz Uścinowicza
> 2014 **zbiorczo**, nie który z nich podaje którą liczbę. Wymyślona atrybucja byłaby gorsza od
> zapisanego braku. Podobnie brakuje **tabeli eustatyki co 1 ka** (Lambeck i in. 2014): wartości
> trzeba odczytać z publikacji, a nie z drugiej ręki.

### Granice basenowe wobec lokalnych

Granice w `timeline.json` są **basenowe**, a przejścia lokalne nie były równoczesne. Zapisane
osobno (`localOnsets`), bo porównanie kontroli zdarzeniowej z niewłaściwą z tych dwóch liczb
jest sposobem, w jaki walidacja pada z błędnego powodu:

| miejsce | onset lokalny | granica basenowa | źródło |
| :-- | --: | --: | :-- |
| Mały Bełt (IODP M0059) | **7 400** cal BP | 8 500 cal BP (Littoryna) | `kotthoff2022` |

Model trafia w ten onset z dokładnością **+89 lat** — przejście jest rozwiązywane *między*
klatkami (bisekcja `H_paleo = 0`), a nie przyciągane do siatki 1 ka.

## 7. Czego aplikacja nie liczy

Lista jest częścią metodyki, nie przypisem:

- **Korekty na osady holoceńskie** (`A-05`, #74). `H_now` zawiera osady, których paleo-dno nie
  miało — w depocentrach kilkanaście do kilkudziesięciu metrów. Głębokości i objętość starszych
  klatek są więc **systematycznie zaniżone**. Zbiór (`zhang2024_sed`, CC BY 4.0) jest
  zarejestrowany i nieużywany; rozłożenie dzisiejszej miąższości w czasie jest decyzją modelową,
  która nie została podjęta.
- **Batymetrii jezior.** Vänern, Vättern, Ładoga i Onega mają w GEBCO tylko powierzchnię wody
  (Vänern 44 m, Vättern 88 m), więc ich misy nie istnieją w modelu.
- **Zasolenia.** Klasy wody na kartach faz (`fresh` / `brackish` / `marine`, zakresy PSU) pochodzą
  z literatury i są **etykietami**, nie wynikiem modelu transportu.
- **Strumieni lodowych** (§4).
- **Pola współczesnej prędkości wypiętrzania.** `V-08` przybliża ją gradientem RSL między węzłami
  0,9 i 0 ka — to **średnia z ostatnich ~900 lat**, nie prędkość chwilowa, i dlatego wychodzi
  niżej (8,89 mm/rok przy Umeå) od publikowanego maksimum (~10,3).
