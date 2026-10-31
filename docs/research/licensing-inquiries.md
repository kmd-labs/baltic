# Zapytania licencyjne

> **Zarchiwizowane 2026-10-31 — żadne zapytanie nie zostanie wysłane.** Decyzja `0-02`: projekt używa wyłącznie zbiorów, które nie wymagają zapytania o licencję. ICE-6G_C, GLAC-1D, ANU-ICE i Stroeven 2016 są w sekcji „Odrzucone” w [`SOURCES.md`](../../SOURCES.md). Dokument zostaje jako zapis researchu na wypadek zmiany decyzji.

Rejestr zapytań o warunki użycia zbiorów bez jawnej licencji (`0-02`, `0-03`). Zakres: postglacjał 20 ka → dziś — zapytanie o PhanDA (fanerozoik) wycofane 2026-10-31. Każda odpowiedź trafia tu dosłownie, z datą, a decyzja — do [`SOURCES.md`](../../SOURCES.md).

> **Cisza nie jest zgodą.** Do czasu pisemnej odpowiedzi zbiór ma status ❓ i żadna jego pochodna nie wchodzi do repo.

## Śledzenie

| # | Zbiór | Adresat | Wysłano | Odpowiedź | Decyzja |
| :-: | :-- | :-- | :-- | :-- | :-- |
| 1 | ICE-6G_C (VM5a) | W. R. Peltier, University of Toronto | — | — | — |
| 2 | GLAC-1D | L. Tarasov, Memorial University of Newfoundland | — | — | — |
| 3 | ANU-ICE | K. Lambeck, ANU Research School of Earth Sciences | — | — | — |
| 4 | Stroeven i in. 2016 (CC BY-NC-ND) | A. P. Stroeven, Stockholm University | — | — | — |

**Adresy do potwierdzenia przed wysłaniem.** `peltier@atmosp.physics.utoronto.ca` jest podany na stronie danych Peltiera (`atmosp.physics.utoronto.ca/~peltier/data.php`; strona ma uszkodzony certyfikat TLS, więc nie sprawdziłem jej bezpośrednio). `lev@mun.ca` pochodzi z adresów korespondencyjnych w pracach Tarasova. Dla 3–4 adres trzeba ustalić na stronach instytucji.

**Do uzupełnienia w każdym szkicu:** `[NADAWCA]`, `[ROLA]` oraz jedno zdanie o charakterze KMD Labs. Od tego, czy publikacja jest **niekomercyjna**, zależy odpowiedź przy #4 (klauzula NC) i prawdopodobnie przy #1–#3.

**Kontekst dla wszystkich zapytań:** repozytorium https://github.com/kmd-labs/baltic jest publiczne, aplikacja ma być hostowana na https://kmd-labs.github.io/baltic/. Publikujemy **wyłącznie produkty pochodne o obniżonej rozdzielczości** (uproszczone wektory TopoJSON: ląd / woda / lód w przekrojach co 500 lat, plus krzywe metryk). Surowe siatki zostają lokalnie (`data/raw/`, poza gitem) i nie są redystrybuowane.

---

## 1. ICE-6G_C (VM5a)

**Stan wiedzy (2026-10-30):** strona PMIP4 i strona Peltiera proszą o cytowanie Argus i in. 2014 i Peltier i in. 2015, nie podają licencji. Używamy `Topo` z `I6_C.VM5a_10min.<t>.nc` (0–21 ka) oraz współczesnego pola prędkości wypiętrzania (do kontroli wobec NKG2016LU).

**To:** peltier@atmosp.physics.utoronto.ca
**Subject:** Permission to publish derived Baltic paleogeography from ICE-6G_C (VM5a)

> Dear Professor Peltier,
>
> I am [ROLA] at KMD Labs, working on an open, interactive visualisation of the postglacial evolution of the Baltic Sea (20 ka to present). [ONE SENTENCE ON KMD LABS AND WHETHER THE PROJECT IS NON-COMMERCIAL.]
>
> We would like to base the reconstruction on ICE-6G_C (VM5a), using the `Topo` field from the PMIP4 distribution (`I6_C.VM5a_10min.*.nc`, 0–21 ka) cropped to 9–33°E, 53–67°N, added to a modern topo-bathymetric DEM, and — for validation only — the present-day uplift-rate grid.
>
> We would not redistribute the model grids themselves. What we would publish, in a public GitHub repository and on a public website, are derived low-resolution products: simplified vector polygons of land, water and ice for time slices every 500 years, and a few derived curves (basin area, volume). Every product would carry a full citation of Argus et al. (2014) and Peltier et al. (2015) and a clear statement that it is derived from ICE-6G_C (VM5a).
>
> Could you let us know whether this use is acceptable, and under what terms? Specifically:
>
> 1. May we publish such derived products, ideally under CC BY 4.0, with the attribution above?
> 2. Is there a preferred form of acknowledgement beyond citing the two papers?
>
> I would be grateful for a short written reply that we can record in our sources register.
>
> With kind regards,
> [NADAWCA]

---

## 2. GLAC-1D

**Stan wiedzy (2026-10-30):** PMIP4 prosi o cytowanie pięciu prac (Tarasov & Peltier 2002; Tarasov i in. 2012; Briggs i in. 2014; Tarasov i in. 2014; Abe-Ouchi i in. 2013), licencji nie podaje. Używamy `HDC` i `ICEM` z `TOPicemsk.GLACD26kN9894GE90227A6005GGrBgic.nc` (26 ka → 0, co 100 lat).

**To:** lev@mun.ca
**Subject:** Permission to publish derived Baltic paleogeography from GLAC-1D

> Dear Professor Tarasov,
>
> I am [ROLA] at KMD Labs, working on an open, interactive visualisation of the postglacial evolution of the Baltic Sea (20 ka to present). [ONE SENTENCE ON KMD LABS AND WHETHER THE PROJECT IS NON-COMMERCIAL.]
>
> We are considering GLAC-1D as the topography and ice history behind the reconstruction: `HDC` and `ICEM` from the PMIP4 file `TOPicemsk.GLACD26kN9894GE90227A6005GGrBgic.nc`, cropped to 9–33°E, 53–67°N and combined with a modern topo-bathymetric DEM. Its 100-year time step is particularly valuable for us around the Baltic Ice Lake drainage.
>
> We would not redistribute the GLAC-1D grids. We would publish, in a public GitHub repository and on a public website, derived low-resolution products only: simplified vector polygons of land, water and ice for time slices, and a few derived curves. Each would cite the five papers listed on the PMIP4 GLAC-1D page and state that it is derived from GLAC-1D.
>
> Could you tell us whether this use is acceptable, and under what terms — in particular, whether we may publish the derived products under CC BY 4.0? Is there a preferred citation set for the Eurasian component specifically?
>
> I would be grateful for a short written reply that we can record in our sources register.
>
> With kind regards,
> [NADAWCA]

---

## 3. ANU-ICE

**Stan wiedzy (2026-10-30):** brak publicznej dystrybucji siatek topografii. Licencjonowana pochodna jest już dostępna: pola RSL Steffena i Kaufmanna (Zenodo `10.5281/zenodo.15481755`, CC BY 4.0, ANU-ICE w wersji 1998). Zapytanie jest więc **niżej w priorytecie** — ma sens tylko wtedy, gdy potrzebna będzie nowsza wersja ANU-ICE niż ta z 1998 r. albo pełna paleotopografia zamiast RSL.

**To:** [ADRES — ANU Research School of Earth Sciences]
**Subject:** ANU ice model — terms for derived Baltic paleogeography

> Dear Professor Lambeck,
>
> I am [ROLA] at KMD Labs, working on an open, interactive visualisation of the postglacial evolution of the Baltic Sea (20 ka to present). [ONE SENTENCE ON KMD LABS AND WHETHER THE PROJECT IS NON-COMMERCIAL.]
>
> We would like to use the ANU ice model and its relative sea-level predictions for Fennoscandia and the Baltic, cropped to 9–33°E, 53–67°N. We are aware of the CC BY 4.0 RSL fields published by Steffen and Kaufmann (2025, Zenodo) that use the 1998 version of the ANU model.
>
> Is a more recent version of the European component available to external users, and if so, under what terms? We would publish only derived low-resolution products (simplified vector polygons of land, water and ice for time slices), never the model grids, with full citation.
>
> With kind regards,
> [NADAWCA]

---

## 4. Stroeven 2016 — CC BY-NC-ND

**Stan wiedzy (2026-10-30):** Bolin Centre (`bolin.su.se/data/stroeven-2016`) udostępnia izochrony jako shapefile na **CC BY-NC-ND 4.0**. Uproszczona, interpolowana geometria w TopoJSON jest utworem zależnym, więc ND tego zakazuje. Bez zgody `C-07` przechodzi na DATED-1 (CC BY 3.0) jako geometrię wiodącą.

**To:** [ADRES — Stockholm University, Department of Physical Geography]
**Subject:** Permission for derived (adapted) use of the Fennoscandian deglaciation isochrons (Stroeven et al. 2016)

> Dear Professor Stroeven,
>
> I am [ROLA] at KMD Labs, working on an open, interactive visualisation of the postglacial evolution of the Baltic Sea. [ONE SENTENCE ON KMD LABS AND WHETHER THE PROJECT IS NON-COMMERCIAL.]
>
> Your deglaciation isochrons (Stroeven et al. 2016, Bolin Centre database) are the best available constraint for the timing of the ice retreat around the Baltic basin, and we would like to use them as the ice-margin layer of the visualisation.
>
> The dataset is licensed CC BY-NC-ND 4.0. Our use would require adaptation: we would simplify and quantise the isochron polygons into a compact web format (TopoJSON), and display interpolated margins between isochrons, clearly marked as interpolated. The result would be published in a public GitHub repository and on a public website, with full citation of Stroeven et al. (2016).
>
> Would you grant permission for this adapted use? If so, may we publish the derived geometry under CC BY 4.0, or would you prefer it to stay under CC BY-NC-ND with a specific exception for this project?
>
> With kind regards,
> [NADAWCA]

