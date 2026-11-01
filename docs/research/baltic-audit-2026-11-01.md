# Baltic — audyt kodu i wartości merytorycznej

> Stan na **2026-11-01**, po scaleniu `ead6d5a` (bryła rzeźby, czas ciągły) i zmianach z tej sesji.
> Zadania do wykonania wynikające z audytu: epik **`A`** w [`baltic-issues-backlog.md`](./baltic-issues-backlog.md).
>
> **Wszystkie liczby w tym dokumencie są odtwarzalne:** `npm run audit:metrics`
> ([`tools/audit/metrics.ts`](../../tools/audit/metrics.ts)). Skrypt czyta zatwierdzone zasoby
> z `src/assets/data` i warstwę danych aplikacji, więc mierzy to, co aplikacja liczy — a nie
> równoległą reimplementację. Po każdej zmianie siatek, kostki RSL albo `water.ts` należy go
> uruchomić i porównać z tabelami poniżej.

## Zakres i ograniczenia audytu

Objęte: warstwa danych (`src/app/core/data`), oba renderery (glob, bryła), shadery, testy kontraktowe,
`SOURCES.md`, `tools/data`. Nieobjęte: `src/design-system` (submoduł), pipeline pythonowy uruchomiony
end-to-end (brak Pythona na maszynie audytu — sprawdzony statycznie).

**Zgodnie z decyzją: pominięte są wszystkie korekty wymagające uzyskania licencji.** Odpadają przez to
zbiory ze statusem ❓ w `SOURCES.md` — lepsza batymetria (`emodnet_dtm2024`, `bsbd`, `iowtopo2`,
`copdem_glo30`), batymetria jezior (`globathy`), walidacja wypiętrzania `V-08` (`nkg2016lu`),
`sgu_strand`, `sincos`. W zakresie zostaje wszystko na ✅ CC BY: `zhang2024_sed`, `esd2025`,
`rosentau2021`, `steffen2025_rsl` wraz z 8 modelami Ziemi, `steffen2025_rsl_sbaltic`, `dated1`.

**Jedno ograniczenie samego skryptu pomiarowego jest zarazem ustaleniem audytu (`A-03`):** maska lodu
dławiąca Bałtyckie Jezioro Lodowe powstaje przez rasteryzację `<canvas>` w przeglądarce, więc poza DOM-em
nie istnieje. Wszystkie wypełnienia w skrypcie liczą się **bez tamy lodowej**; klatki 16–11,7 ka pokazują
przez to poziom 0 i `connected = true`, podczas gdy aplikacja rysuje tam jezioro zaporowe. Te wiersze są
oznaczone `no-ice` i nie wolno ich czytać jako wyjścia aplikacji. Liczby dla BIL w tym dokumencie pochodzą
z panelu przekroju samej aplikacji.

---

# Część I — Kod

## I.1 Co jest dobre

Komentarze konsekwentnie tłumaczą **dlaczego**, nie co — rzadkie i tu utrzymane w całym `src/app`.
Czysty podział worker / wątek główny, kompletne `dispose()` w obu rendererach, zero `TODO`/`FIXME`
w produkcyjnym kodzie, ścieżka błędu danych obsłużona aż do komunikatu w UI. Warstwa danych ma własne
testy kontraktowe (24), w tym porównanie `H_paleo` z pipeline'em z tolerancją 1 m.

## I.2 Ustalenia

Numeracja odpowiada pozycjom `A-xx` w backlogu.

### `A-01` Podpowiedź i przekrój rozjechały się ze sceną — **regresja z tej sesji, naprawiona**

`pointInfo` ([`paleo-data.service.ts:269`](../../src/app/core/data/paleo-data.service.ts)) i `transect`
(`:296`) czytają `f.water[i]` — surową maskę **najbliższej klatki** — oraz `f.lakeLevelM`, czyli poziom
tej klatki. Scena po przejściu na sumę masek używa `union(A,B) ∧ hp(t) < poziom` z poziomem
interpolowanym między klatkami.

Przed zmianą maska renderera wynosiła `(w < 0.5 ? A : B)`, czyli dokładnie najbliższą klatkę — zgadzały
się co do komórki. Teraz nie. Najazd kursorem przy brzegu w środku przedziału potrafi zgłosić „ląd" tam,
gdzie obraz pokazuje wodę; linia wody w panelu przekroju bywa przesunięta względem brzegu na scenie.
Rozbieżność jest największa dokładnie przy brzegu, czyli tam, gdzie ludzie najczęściej najeżdżają.

### `A-02` Reguła wody istnieje w dwóch egzemplarzach

`oceanSide()` jest zapisana dwa razy — [`water.ts:33`](../../src/app/core/data/water.ts) (TS, decyduje
o powierzchni i objętości) i [`paleo-shaders.ts:127`](../../src/app/components/globe/paleo-shaders.ts)
(GLSL, decyduje o kolorze basenu) — z identycznymi magicznymi liczbami, zsynchronizowane wyłącznie
komentarzem. Pomiar: **ta reguła wyklucza 19,9% dzisiejszych komórek wody** z metryk basenu, więc jej
rozjazd po cichu zmieniłby publikowane powierzchnie i objętości.

Ta sama klasa ryzyka dotyczy nowego pierwszeństwa `isLakeAt` / `isOceanAt`, które po zmianie na sumę
masek żyje wyłącznie w GLSL, a strona TS koduje je niejawnie przez odczyt kodu maski.

### `A-03` Jezioro zaporowe jest nieosiągalne dla testów

`iceMask()` (`:376`) rasteryzuje zarys DATED-1 przez `document.createElement('canvas')`. Model fizyczny
zależy więc od API DOM-u i od reguł wypełniania rastra w przeglądarce, a skutek jest poważniejszy niż
estetyczny: **każdy test kontraktowy wywołuje `fillWater(..., null)`**, bo inaczej nie potrafi. Cała faza
BIL — ta, w której tama lodowa *jest* mechanizmem — nie ma żadnego pokrycia testowego. To blokuje też
sensowne domknięcie `V-02` po stronie faz jeziornych.

### `A-04` Test ancylusowy sprawdza za mało

[`tests/contract/water.test.ts:48`](../../tests/contract/water.test.ts) asercja to `level > 0`. Przechodzi
przy rzeczywistych +22 m i przeszedłby przy +100 m. Żaden test nie konfrontuje modelu z literaturą — dziura
dokładnie tam, gdzie merytoryka jest najsłabsza (II.2).

### `A-05` `zhang2024_sed` figuruje jako używany, a nie jest

Wpis ma status ✅ i komplet atrybucji w `SOURCES.md`, a nie występuje nigdzie w `tools/` ani `src/`.
Przy dokumencie deklarującym się jako „jedyne źródło prawdy" to sugeruje użycie, którego nie ma.
Merytoryczna strona tej samej sprawy — brak korekty na osady — w II.2.

### `A-06` Pomiary audytu jako skrypt — **wykonane**

Narzędziowy odpowiednik tego dokumentu: `tools/audit/metrics.ts`, wpięty jako `npm run audit:metrics`.
Liczy z zatwierdzonych zasobów i warstwy danych aplikacji, nie z równoległej reimplementacji. Pozostaje
wpięcie w CI po zmianie zasobów — czeka na `0-08`.

### `A-07` Drobiazg

`rslCache` (`:203`) eksmituje `keys().next()`, czyli w kolejności wstawienia; `get` nie odświeża pozycji,
więc to FIFO, nie LRU. Przy 3 321-komórkowych polach i tym rozmiarze cache bez znaczenia dla działania —
myli tylko nazwą.

---

# Część II — Wartość merytoryczna

## II.1 Co jest solidne

**Łańcuch metodyczny jest poprawny.** `H_paleo = H_now − RSL(t)` z modelem GIA, który zawiera już człon
eustatyczny i geoidalny — `SOURCES.md` jawnie uzasadnia, dlaczego nie ma osobnego członu eustatycznego
i gdzie leżałoby podwójne liczenie. To dokładnie ta pułapka, w którą wpadł plan wejściowy.

**Dyscyplina licencyjna jest wzorowa.** Każdy zbiór ma DOI, licencję, datę i miejsce weryfikacji oraz
gotowy tekst atrybucji. Stroeven i in. 2016 odrzucone z powodu klauzuli ND, mimo że dane byłyby lepsze
od przyjętych — to rzadka konsekwencja.

**Poziom jeziora liczony z analizy przelewu** (priority-flood, `water.ts`) to właściwy mechanizm fizyczny,
a nie wpisana liczba. Model *ma* zatem czym się mylić — i to jest zaleta.

**Profil lodu jest wyprowadzony, nie dobrany.** `ICE_PROFILE_K = √(2τ₀·1000/ρg)` przy τ₀ = 100 kPa daje
149 m·√(d w km), czyli ~2 980 m przy 400 km od krawędzi — klasyczny profil idealnie plastyczny.

**Walidacja na dziś wypada dobrze** — jedyne miejsce, gdzie model da się skonfrontować z pomiarem bez
dokładania zbiorów:

| | model | publikowane | błąd |
| :-- | --: | --: | --: |
| Powierzchnia basenu | 390 tys. km² | 377 tys. km² | +3,4% |
| Objętość | 21,4 tys. km³ | 21,7 tys. km³ | −1,2% |
| Głębokość maks. | 430 m | 459 m | −6,3% |

**I jeden sukces, który warto zapisać osobno:** model otwiera cieśniny duńskie **między 9 a 8 ka**
(Darss +7 → −4 m, Öresund +7 → −2 m, Storebælt +2 → −8 m) — niezależnie trafiając w literaturową
granicę fazy litorynowej ~8,5 ka. Progi są przy tym w DEM-ie oddane wiernie: Darss −17 m przy −18 m
publikowanych, Öresund −9 m przy −8 m.

## II.2 Gdzie wizualizacja mówi więcej, niż wie

### B1 — Modelowane poziomy jezior są wyraźnie za wysokie, i to one są rysowane

| | model | literatura | różnica |
| :-- | --: | --: | --: |
| Ancylus, maksimum 10,3 ka | **+22,1 m** | +10 m | +12,1 m |
| BIL 13 ka *(z panelu aplikacji)* | **+36 m** | +25 m | +11 m |

Scena rysuje `lakeLevelM`, czyli model. Rozbieżność trafia do bocznej karty fazy jako „rozbieżny o X m",
co jest uczciwe, ale nierównoważne: obraz ma pełną powagę wizualną, zastrzeżenie — nie.

→ Pokryte przez **`C-06b` #62** (poziomy faz jeziornych z rzędnych progów) i **`V-06` #45**
(spadek Billingen 25–28 m). Powyższe liczby to materiał dowodowy do obu, nie nowe zadanie.

### B2 — Yoldia i Mastogloia wychodzą jako jeziora bez odpływu

Model przy 11 ka: poziom +7,8 m, `connected = false`. Przy 9 ka: +6,4 m, bez połączenia. Obie fazy są
z definicji brakiczne, czyli połączone z oceanem — aplikacja sama etykietuje je „brakiczny, PSU 3–18".
Pokazuje więc jednocześnie morze brakiczne i brak połączenia z oceanem.

Pierwsza hipoteza — zbyt płytkie progi duńskie w DEM-ie — **jest fałszywa** (II.1: progi oddane wiernie).
Rzeczywista przyczyna jest ciekawsza. Trasą sterującą jest środkowa Szwecja, a model siedzi tam o kilka
metrów od zera przez całe okno Yoldii:

| próg | 16 ka | 13 ka | 11,7 ka | 11 ka | 10,3 ka | 9 ka | 8 ka |
| :-- | --: | --: | --: | --: | --: | --: | --: |
| Närke | −160 | −100 | −86 | −71 | −46 | −24 | −17 |
| Svea (Degerfors) | −97 | −35 | −21 | **−5** | **+22** | +46 | +54 |

Svea przechodzi przez zero między 11 a 10,3 ka — co jest mechanizmem ancylusowym i samo w sobie jest
poprawne. Rzecz w tym, że **margines rozstrzygający pytanie zero-jedynkowe wynosi kilka metrów, a sąsiednie
węzły pola RSL różnią się w tej epoce o ~50 m** (B3). Aplikacja rozstrzyga połączenie precyzją mniejszą
niż szum wejścia.

→ Pokryte przez **`V-02` #41** (bilans rzędnych na progach: „jezioro zaporowe wymaga progu powyżej,
połączenie morskie poniżej") i **`C-05` #19** (`sills.json`). Tabela wyżej to gotowy przypadek testowy.

### B3 — Pozorna precyzja linii brzegowej

Pole RSL ma **1°** (81 × 41 węzłów) i jest interpolowane biliniowo na DEM **0,025°** — 40–80-krotna
różnica rozdzielczości. Zmierzone skoki między sąsiednimi węzłami wewnątrz okna bałtyckiego:

| | 16 ka | 13 ka | 11 ka | 10 ka | 8 ka | 4 ka |
| :-- | --: | --: | --: | --: | --: | --: |
| maks. \|ΔRSL\| | **85,4 m** | 70,5 | 59,4 | 46,8 | 24,4 | 9,1 |
| p95 | 52,4 | 54,0 | 50,8 | 38,2 | 20,9 | 6,2 |
| średnia | 19,5 | 18,3 | 16,5 | 12,9 | 7,1 | 2,2 |

Nachylenia przybrzeżne: 0,724 m/km (południowy Bałtyk), 1,085 (środkowy), 1,447 (Botnik) — czyli
**1 m błędu poziomu ≈ 0,7–1,4 km przesunięcia brzegu**. Komentarz w `paleo-shaders.ts` deklaruje
„the shoreline stays sharp at any zoom": jest ostra, ale jej *położenie* niesie we wczesnym holocenie
niepewność rzędu dziesiątek kilometrów. Pas niepewności w UI dotyczy wyłącznie lodu.

→ Pokryte przez **`V-03` #42**, którego DoD zawiera już RMSE dla każdego z 8 modeli Ziemi oraz
porównanie z `steffen2025_rsl_sbaltic`. To jedyna ilościowa walidacja w planie i audyt potwierdza,
że jest priorytetem właściwym.

### B4 — Brak korekty na osady holoceńskie

`H_now` zawiera holoceńskie osady, których paleo-dno nie miało; w depocentrach to kilkanaście do
kilkudziesięciu metrów. Głębokości i objętość są więc systematycznie **zaniżone** dla starszych klatek,
najmocniej tam, gdzie muł najgrubszy. `zhang2024_sed` (CC BY 4.0, ✅) jest zarejestrowany dokładnie pod
to zastosowanie i nieużywany.

→ **Nie ma pokrycia w backlogu.** Nowe zadanie `A-05`.

### B5 — Lód bez strumieni lodowych

Profil plastyczny zakłada płaskie łoże i jednorodne naprężenie ścinające u podstawy. Bałtyk gościł
Bałtycki Strumień Lodowy, którego profil był znacznie niższy, więc kopuła nad basenem jest prawdopodobnie
za gruba. Uwiera to akurat w widoku bryły, który po zrównaniu skali pionowej (×30) wprost zaprasza do
porównania wysokości lodu z wysokością gór: przy ×30 kopuła 3 km to 0,62 jednostki, a szczyty
skandynawskie 0,41 — lód góruje, i to jest teza, którą ten widok stawia.

→ Pokryte przez **`0-07` #13**, którego DoD wymaga zapisania „profil plastyczny grubości lodu: wzór, τ₀,
uzasadnienie, **ograniczenia**". Audyt dostarcza treść do ostatniego punktu.

## II.3 Zmierzone, ale **nie** rekomendowane do poprawy

**Rozdzielczość DEM-u.** Głębokość maksymalna 430 m przy 459 m publikowanych (−6,3%); rów Landsort
wychodzi w siatce na 18,26°E 58,64°N. Źródłem jest GEBCO 15″ (0,00417°), a siatka bałtycka ma 0,025° —
zagęszczenie jest więc **możliwe bez żadnej nowej licencji**. Mimo to nie warto: dwukrotne zagęszczenie
to czterokrotny wzrost zasobu przy bramce budżetowej `V-11`, a zysk to kilka procent na głębokości
maksymalnej i ~1% na objętości — wielkościach, które i tak są zdominowane przez brak korekty na osady (B4)
i przez niepewność GIA (B3). Rekomendacja: zostawić 0,025° i naprawić B4 najpierw.

---

# Werdykt

To nie jest zabawka — pipeline, dyscyplina licencyjna i walidacja na dziś są na poziomie publikacyjnym,
a model odtwarza niezależnie otwarcie cieśnin duńskich w 9–8 ka. Słabe ogniwo jest jedno i konkretne:

> **Wielkości wyprowadzone — poziom jeziora i połączenie z oceanem — mają na ekranie tę samą powagę
> wizualną co zweryfikowane, a w dwóch przypadkach są demonstracyjnie błędne**: Ancylus dwa razy za wysoki,
> Yoldia i Mastogloia odcięte od oceanu wbrew własnej etykiecie fazy.

Dobra wiadomość jest taka, że aplikacja **już liczy** wszystko, czego potrzeba, żeby to wiedzieć: ma model
i literaturę obok siebie, a marginesy na progach ma w danych. Brakuje nie obliczeń, tylko przeniesienia
tej wiedzy z karty bocznej na scenę — i jednego testu, który nie pozwoli rozbieżności cicho urosnąć.

Kolejność o największym zwrocie:

1. **`A-01`** — żywa regresja, naprawa jest tania.
2. **`A-04`** + **`A-03`** — zamienia B1 z niespodzianki w pilnowany budżet błędu.
3. **`V-02` #41** z tabelą progów z B2 — wyłapie połączenia rozstrzygane poniżej szumu.
4. **`A-05`** — jedyne nowe ustalenie merytoryczne bez pokrycia w planie.
