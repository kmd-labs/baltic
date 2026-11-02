# Baltic — co to pokazuje i jak jest zrobione

## 1. Co prezentuje aplikacja

Dwadzieścia tysięcy lat historii Morza Bałtyckiego, od chwili, gdy cały basen leżał pod
lądolodem skandynawskim, do dziś. Oś czasu jest **ciągła**: przeciąganie suwaka nie przeskakuje
między ilustracjami, tylko przelicza scenę — brzeg przesuwa się, bryła lodu morfuje, poziom wody
w basenie rośnie i opada.

### Siedem faz

Bałtyk nie był przez ten czas jednym zbiornikiem. Przechodził przez cykl jezioro → morze →
jezioro → morze, zależnie od tego, czy wypiętrzająca się Skandynawia zdążyła zamknąć połączenie z
oceanem, zanim podnoszący się po topnieniu lądolodów ocean zdążył je otworzyć:

| faza | cal BP | woda | co się dzieje |
| :-- | --: | :-- | :-- |
| deglacjacja | 20 000 → 16 000 | lód | basen pod lądolodem, pierwsze jeziora zaporowe przy czole |
| **Bałtyckie Jezioro Lodowe** | 16 000 → 11 700 | słodka | jezioro zatamowane lodem i progiem, ~25 m nad ówczesnym oceanem |
| **Morze Yoldiowe** | 11 700 → 10 700 | brakiczna | połączenie przez środkową Szwecję, woda słona wchodzi na krótko |
| **Jezioro Ancylusowe** | 10 700 → 9 800 | słodka | wypiętrzanie zamyka połączenie, znowu jezioro |
| Morze Mastogloia | 9 800 → 8 500 | brakiczna | przejściowe, otwieranie cieśnin duńskich |
| **Morze Littorynowe** | 8 500 → 4 000 | morska | transgresja, najwyższe zasolenie w całej historii |
| post-littoryna | 4 000 → 0 | brakiczna | dzisiejszy Bałtyk, zasolenie spada |

Plus sześć **przekrojów zdarzeniowych** — momentów, w których coś się rozstrzyga: przed i po
finalnym drenażu Billingen (11 750 / 11 650), maksimum i regresja ancylusowa (10 300 / 10 050),
początek i maksimum transgresji littorynowej (8 350 / 6 750).

### Co widać na ekranie

- **Glob 3D** — paleo-wysokość w każdym punkcie, woda rozdzielona na ocean i jezioro (różne
  reguły, różny kolor), dzisiejszy brzeg jako odniesienie, „brzeg sprzed 1000 lat" jako duch.
- **Bryła lądolodu** z grubością z profilu plastycznego, z pasem niepewności DATED-1 (min/max).
- **Karta fazy** — nazwa, typ wody, zakres PSU, poziom modelu **obok** poziomu z literatury wraz z
  rozbieżnością, **trasa odpływu** z odległością do punktu katalogowego, powierzchnia, objętość,
  głębokość maksymalna, `datum`, znaczniki „interpolowane" i „sporne".
- **Przekrój Umeå → Gdańsk** — dno, lustro wody, dzisiejsze dno linią przerywaną, pasmo lodu z
  kształtem profilu grubości.
- **Podpowiedź pod kursorem** — współrzędne, typ wody, wysokość względem ówczesnego oceanu i
  względem dzisiejszego, RSL, grubość lodu.
- **Panel źródeł** — każdy zbiór z użyciem, pochodzeniem, **licencją prosto z rejestru** i opisem
  tego, co z nim zrobiono.

### Czego aplikacja świadomie nie udaje

Rekonstrukcja jest **modelem**, nie zdjęciem. To, czego nie liczy, jest wypisane w
[metodyce §7](paleo-reconstruction-methodology.md): brak korekty na osady holoceńskie, brak
batymetrii jezior, brak modelu zasolenia (klasy wody to etykiety z literatury), brak strumieni
lodowych. Linia brzegowa jest ostra przy każdym przybliżeniu, ale jej położenie we wczesnym
holocenie niesie niepewność rzędu dziesiątek kilometrów — i to jest zmierzone, nie przypuszczane.

## 2. Dane i licencje

**Zasada projektu:** do pipeline'u wchodzą wyłącznie zbiory, których licencja nie wymaga zapytania
o zgodę. To wyklucza najlepsze dostępne modele GIA (ICE-6G_C, GLAC-1D) i najgęstsze izochrony
deglacjacji (Stroeven 2016, klauzula ND) — świadomy koszt za to, żeby wszystko, co publikujemy,
dało się opublikować legalnie i żeby każdy mógł to odtworzyć.

| Zbiór | Co z niego jest | Licencja | Weryfikacja |
| :-- | :-- | :-- | :-- |
| **GEBCO_2024** | dzisiejsza rzeźba i dno — `H_now`, podstawa paleo-DEM-u | domena publiczna z obowiązkiem atrybucji | *Terms of Use of The GEBCO Grid* |
| **Steffen i Kaufmann 2025** | relatywny poziom morza, 19 kroków 21,4 → 0 ka, 8 modeli Ziemi | CC BY 4.0 | DataCite |
| **DATED-1** (Hughes i in.) | zasięg lądolodu, warianty min/mc/max co 1 ka | CC BY 3.0 | PANGAEA |
| **Rosentau i in. 2021** (HOLSEA) | 1 099 datowanych wskaźników poziomu morza — walidacja ilościowa | CC BY 4.0 | DataCite |
| **Steffen i Kaufmann 2025** (pd. Bałtyk) | pole regionalne — porównanie na wybrzeżu PL/DE/LT | CC BY 4.0 | DataCite |
| **Kotthoff i in. 2022** (IODP M0059) | lokalny onset Littoryny w Małym Bełcie | CC BY 4.0 | DataCite |
| EMODnet DTM 2024 | zarejestrowany, nieużywany — lepsza batymetria na przyszłość | CC BY 4.0 | *Terms of use* EMODnet, 2026-11-02 |
| Zhang 2024 | zarejestrowany, nieużywany — miąższość osadów holoceńskich | CC BY 4.0 | DataCite |

Publikacje, których **liczby** wchodzą do kontraktu (granice faz, poziomy jezior, rzędne progów):
Andrén i in. 2011 (źródło wiodące chronologii), Björck 1995/2008, Uścinowicz 2014, Lambeck i in.
2014, Hughes i in. 2016. Fakty nie podlegają prawu autorskiemu, ale każda liczba ma cytowanie — i
**test sprawdza, że każdy identyfikator źródła w opublikowanych danych rozwiązuje się do wpisu w
`SOURCES.md`.**

Osiem pozycji o nieustalonej licencji zostało sprawdzonych u źródeł i **odrzuconych** (`0-03`):
NKG2016LU (licencji samych siatek nie dało się ustalić), SGU Strandförskjutningsmodell (produkt nie
istnieje do pobrania), BSBD/BSHC (ograniczenia o nieznanej treści, domena nie odpowiada), IOWTOPO2
(brak oświadczenia), GLOBathy, HELCOM, IntCal20, Copernicus DEM (zadania usunięte). Zasada,
zastosowana konsekwentnie: *ograniczenie, którego nie da się przeczytać, jest ograniczeniem,
którego nie da się dochować*.

## 3. Trzy rozwiązania techniczne warte opisania

### 3.1. Reguła wody ma jednego właściciela, a GLSL jest z niej generowany

**Problem.** Woda w tej aplikacji jest decyzją: dana komórka to ocean, jezioro, czy ląd. Decyzję
podejmują dwie strony — GPU, żeby pomalować piksel, i CPU, żeby policzyć powierzchnię, objętość i
odpowiedzieć podpowiedzi pod kursorem. Przez jakiś czas reguła istniała w dwóch kopiach: raz w
TypeScripcie, raz w GLSL-u. **Rozjechały się.** Podpowiedź mówiła co innego niż piksel, nad którym
stała, a opublikowane metryki opisywały inny zbiór komórek niż obraz.

**Rozwiązanie.** Reguła istnieje raz, w `water.ts`, a kod GLSL jest z niej **generowany jako
łańcuch znaków** i wstrzykiwany do shadera:

```ts
export const WATER_RULE_GLSL = /* glsl */ `
  bool oceanSide(vec2 ll) {
    return ll.x < ${glslFloat(OCEAN_SIDE.northSeaLon)}
      || (ll.y > ${glslFloat(OCEAN_SIDE.kattegatLat)} && ll.x < ${glslFloat(OCEAN_SIDE.kattegatLon)})
      ...
  }`;
```

Stałe nie są przepisane — są interpolowane. A że generowanie łańcucha nie dowodzi jeszcze, że
*logika* jest ta sama, test **tłumaczy GLSL z powrotem na JavaScript** i porównuje obie
implementacje na siatce punktów kontrolnych:

```ts
const expr = body[1].replace(/\buProfileK\b/g, 'K').replace(/\bsqrt\b/g, 'Math.sqrt');
const fromGlsl = new Function('d', 'K', `return ${expr};`);
```

Sprawdzone podmianą `sqrt(d)` na `d` w shaderze: test pada z liczbami. Ten sam wzorzec stosuje
teraz profil grubości lodu. **Wniosek ogólny:** kiedy dwie strony muszą zgadzać się co do reguły,
generowanie jednej z drugiej jest tańsze niż komentarz proszący o synchronizację — a test, który
czyta wygenerowany kod z powrotem, zamyka lukę między „generowane" a „równoważne".

### 3.2. Poziom jeziora liczy *priority-flood*, który zwraca także trasę odpływu

**Problem.** Powierzchnia wody w fazie jeziornej **nie jest** globalnym poziomem morza — wyznaczał
ją próg, przez który jezioro się przelewało. Naiwne progowanie `H_paleo < 0` pokazuje każde
zamknięte zagłębienie jako morze i nie wie nic o poziomie.

**Rozwiązanie.** Zalewanie priorytetowe (*priority-flood*) z kopcem binarnym, uruchamiane od
oceanu, nadające każdej komórce **poziom przelewu** — wysokość najniższej grani, przez którą woda
z tej komórki może uciec do oceanu. Lód jest ścianą. Gdzie poziom przelewu głębi leży powyżej jej
dna, basen jest jeziorem na tym poziomie.

Nieoczywista część: algorytm przy okazji **wie, którędy** jezioro się przelewa. Poziom przelewu
propaguje się jako `max(poziom poprzedniej komórki, wysokość tutaj)`, więc zapamiętanie, z której
komórki przyszła wartość, pozwala cofnąć się ścieżką do oceanu — a jej najwyższa komórka **jest**
progiem sterującym, z definicji.

To zmieniło wynik merytoryczny, nie tylko techniczny. Pytanie „którym progiem przelewa się Bałtyk
w danej fazie" wcześniej odpowiadano, patrząc na rzędne nazwanych progów. Zapytana wprost analiza
przelewu odpowiada **inaczej**: trasa dla Yoldii leży 97 km od najbliższego wpisu w ręcznym
katalogu, a próg Svea, uznawany za ancylusowy mechanizm, nie steruje **nigdy**. Dlatego katalog
progów (`sills.json`) jest dziś **generowany z tej analizy**, a nie wpisywany z listy nazw — a
trasa, która nie ma nazwy w katalogu, zatrzymuje build zamiast pożyczać nazwę sąsiada.

### 3.3. Bryła lodu morfuje przez pole odległości, nie przez wierzchołki

**Problem.** DATED-1 publikuje zarysy lądolodu co 1000 lat. Oś czasu jest ciągła, więc między
przekrojami trzeba interpolować. Morfowanie wierzchołków nie wchodzi w grę: liczba pierścieni
wariantu `mc` zmienia się z 1 na 16 na 5 w ciągu 20 → 10 ka, bo loby lodowe łączą się i rozpadają.
Nie ma stabilnej odpowiedniości wierzchołków, którą dałoby się interpolować.

**Rozwiązanie.** Zamiast zarysu interpolowane jest **pole odległości ze znakiem** do marginesu.
Dwie konsekwencje, z których druga jest darmowa:

1. Interpolacja pola odległości morfuje zarys poprawnie przez łączenie i rozpad lobów — bo
   topologia zarysu jest wynikiem pola, nie jego wejściem.
2. Profil plastyczny grubości potrzebuje **dokładnie tej samej wielkości** — odległości od
   marginesu. Jedno pole daje więc i kształt, i wysokość, morfowane razem.

Transformata odległości biegnie w **rastrze stereograficznym**, nie w lon/lat — odwzorowanie
wiernokątne zapewnia lokalną izotropię, bez której rozdzielny algorytm euklidesowy jest
nieprawidłowy (na siatce lon/lat komórka zmienia szerokość z `cos 75° / cos 65° ≈ 0,61` w tej
domenie). Przy okazji: rasteryzacja zarysów nie przechodzi przez DOM-owy `<canvas>` — własny
wypełniacz scanline z regułą nonzero sprawia, że **fizyczne wejście modelu nie zależy od API
przeglądarki**, a jezioro zatamowane lodem da się w ogóle przetestować poza przeglądarką.

> Tu jest też najlepsza lekcja z całego projektu. Pole odległości miało błąd obecny od początku:
> prostokąt domeny podany do `fitWidth` był nawinięty odwrotnie do konwencji d3-geo, więc
> biblioteka czytała „cała sfera minus prostokąt" i skalowała kulę do rastra — **45 km/piksel
> zamiast 3,4**. Drugi błąd w tym samym miejscu: niezagęszczony prostokąt, którego boki na sferze
> są łukami wielkiego koła, przez co południowy Bałtyk wypadał poza bounds. Oba były niewidoczne
> na ekranie — bryła wyglądała wiarygodnie. Znalazło je dopiero porównanie **maski z polem**:
> 9 653 niezgodne komórki przed poprawką, 486 po, wszystkie w pasie ≤ 2,5 km od krawędzi.

## 4. Co walidacja mówi o jakości rekonstrukcji

Siedem bramek blokujących (`npm run validate`), wszystkie zielone. Najważniejsza jest `V-03` —
jedyna ilościowa, porównująca modelowany poziom morza z **1 099 datowanymi wskaźnikami**:

| | wynik |
| :-- | :-- |
| RMSE, cały zbiór | **14,26 m** przy zakresie obserwacji −51…+269 m |
| mediana \|reszty\| | 5,2 m |
| bias | −0,6 m (brak systematycznego przesunięcia) |
| najlepszy region | Polska 4,2 m, Niemcy M-V 4,3 m |
| najgorszy region | północna Szwecja 48,7 m (n = 12, RSL do 269 m) |

**To jest liczba, której wcześniej nie było.** Przedtem aplikacja mogła powiedzieć tylko „zgodne z
syntezami".

Dwa ustalenia, które z niej wynikają i są zapisane w
[`research/baltic-earth-model.md`](research/baltic-earth-model.md):

1. **Wysyłany model Ziemi `sk1` jest szósty z ośmiu.** `p79` ma RMSE 11,62 m zamiast 14,26 i
   wygrywa w 11 z 13 regionów. Przełączenie naprawiłoby poziomy faz jeziornych (najgorsze
   odchylenie spada z +13,9 m do −5,7 m), ale **zgubiłoby drenaż Billingen** jako widoczne
   wydarzenie. Decyzja należy do właściciela projektu; jest tania i odwracalna.
2. **Różnica między modelami (2,6 m) jest mniejsza niż błąd każdego z nich (11,6–15,0 m)** — a ten
   błąd pochodzi z **rozdzielczości pola** (1° przy DEM-ie 0,025°, sąsiednie węzły różnią się do
   85 m), nie z reologii. Rekonstrukcja jest tak dobra, jak jej pole RSL, i dalszy postęp wymaga
   lepszego pola, nie innego modelu.

Pozostałe bramki: spadek Billingen 31,3 m wobec literaturowych 25–28; onset Littoryny w Małym
Bełcie **7 489 cal BP wobec 7 400** (89 lat, rozwiązywane *między* klatkami); maksimum holoceńskie
na Gotlandii w oknie 7,5–6,5 ka; gradient wypiętrzania przy Umeå 8,89 mm/rok wobec publikowanych
~10,3 (model daje średnią z 900 lat, więc niższa wartość jest oczekiwana); geometria bez
samoprzecięć i sumy kontrolne zgodne z plikami.

## 5. Odtwarzalność

Każda liczba w tym dokumencie i w audycie jest **policzona skryptem z zacommitowanych zasobów**, nie
przepisana:

```bash
npm run validate        # siedem bramek, każda z odchyleniem liczbowym
npm run audit:metrics   # każda liczba cytowana w audycie
npm run data:build      # regeneracja wszystkich plików generowanych + walidacja + budżet
```

CI na każdym PR regeneruje pliki generowane i **porównuje bajt po bajcie** — plik edytowany ręcznie
albo zostawiony nieaktualnym zatrzymuje merge. Manifest zapisuje SHA-256 każdego publikowanego
pliku, model Ziemi, interpolację i τ₀ profilu lodu, żeby czytelnik danych mógł je zinterpretować
bez czytania kodu.
