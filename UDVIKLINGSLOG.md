# Udviklingslog – Elevoverblik

Her står, hvad der er lavet i hver version, og hvorfor. Den nyeste version står øverst.
Versionsnummeret står også øverst i programmet ved siden af "Elevoverblik".

---

## v17 – 13. november 2026
**Venstre og højre pil flytter mellem cellerne på karakterfanen**
- Ligesom pil op og ned kan man nu bruge venstre og højre pil til at gå til cellen ved siden af i samme række, også på tværs af kategorierne.
- I felter med tal (7-trinsskala, point, procent) flytter pilene altid til næste celle. I tekstfelter (egne vurderinger, fri tekst) flytter de kun, når markøren står i starten eller slutningen af teksten, så man stadig kan rette midt i en tekst.
- Når skemaet ruller, sørger programmet for, at den valgte celle ikke gemmer sig bag navnekolonnen, overskrifterne eller gennemsnitsrækken.

## v16 – 13. november 2026
**Aftaler fra en samtale står på lyserød baggrund**
- På samtalekortene står teksten under "Aftaler" nu på en lyserød baggrund, så aftalerne er nemme at få øje på. Overskriften og resten af kortet beholder deres farve.

## v15 – 13. november 2026
**Hele kommentaren vises, når man holder musen over en karakter**
- Chromes egen lille hjælpeboks skar lange kommentarer af. Programmet har nu sin egen boks, der viser hele kommentaren, også linjeskift. Det gælder både på karakterfanen og på kortene i elevfanen.

## v14 – 13. november 2026
**Ctrl + Enter gemmer en kommentar**
- Når man skriver en kommentar til en karakter, kan man gemme og lukke vinduet med Ctrl + Enter. Almindelig Enter giver stadig en ny linje.
- Genvejen virker i alle tekstfelter i programmets vinduer, f.eks. også i noterne til en samtale eller en aftale.

## v13 – 13. november 2026
**Klassetrin ved perioderne, når alle år vises**
- Vælger man "Alle år" på karakterfanen, står klassen nu foran perioden over kolonnerne, f.eks. **8.c 1. samtale 2026/27**. Så kan man se, hvilket klassetrin klassen gik på, da karaktererne blev givet.

## v12 – 13. november 2026
**Standpunktskarakterer med fed skrift og nyt "Vis"-valg på karakterfanen**
- Opgaver, der hedder **S1**, **S2**, **S3** osv., er standpunktskarakterer. Navnet og karaktererne i kolonnen står med fed skrift, både på karakterfanen og på kortene i elevfanen. Almindelige opgavenavne og karakterer står med lidt tyndere skrift, så forskellen er tydelig.
- Nyt valg til højre for skoleåret på karakterfanen: **Vis: Alle karakterer / Kun standpunktskarakterer / Kun sidste standpunktskarakter**.
- "Kun sidste standpunktskarakter" viser for hver kategori den sidste standpunktskarakter, som mindst én elev har fået. Kolonnen vises for hele klassen, også for elever, der ikke har fået den endnu. En tom S-kolonne, der er oprettet på forhånd, springes over.
- Mærket foran kategori-knapperne hedder nu "Kategorier:" i stedet for "Vis:".

## v11 – 10. november 2026
**Tyk sort streg mellem karakterkategorierne på karakterfanen**
- Mellem kategorierne i karakterskemaet (f.eks. mellem Problemregning og Færdighedsregning) er der nu en tyk, sort streg. Den går hele vejen fra kategoriens navn øverst ned til gennemsnitsrækken.
- Stregerne mellem 1. samtale, 2. samtale og "efter sidste samtale" er stadig tynde og grå, så de to slags streger er nemme at skelne.

## v10 – 9. november 2026
**Den enkelte opgave kan bruge en anden skala end kategorien**
- Kategoriens skala er nu en standard for nye opgaver. Klikker man på en opgaves navn på karakterfanen, kan man vælge en anden skala til netop den opgave, inklusive egne vurderinger med egne valgmuligheder.
- Det står ikke ved opgaven i skemaet, så det ikke fylder. Skalaen kan ses i redigér-vinduet og når man holder musen over opgavens navn.
- Skifter en opgave skala, omregnes de eksisterende karakterer, hvor det kan lade sig gøre (f.eks. 7 → 7 point). Karakterer, der ikke passer til den nye skala, markeres med rødt i skemaet og tæller ikke med i gennemsnittet.
- Kategoriens standardskala kan nu ændres, selv om kategorien er brugt. Eksisterende opgaver beholder deres skala.
- Dataformatet er hævet til version 3. Ældre datafiler åbnes uden ændringer.

## v9 – 9. november 2026
**Skalaen vises med lille grå skrift på elevkortene**
- I karakterskemaerne på elevfanen står skalaen (f.eks. "7-trinsskala" eller "Point") nu med mindre grå skrift efter kategoriens navn, ligesom på karakterfanen.

## v8 – 9. november 2026
**Ny overskrift på kortene i elevfanen**
- Kortenes top viser nu klasse og samtale med stor skrift, f.eks. **8.c 1. skole-hjem**, og datoen med lille skrift under, f.eks. *2. Nov. 2026*.
- Den automatiske titel ("Efterår 2026") og linjen med dato og klasse er fjernet. Oplysningerne står nu i de to linjer.
- Gælder alle kort: samtaler, ekstra samtaler ("8.c Ekstra samtale"), aftaler ("8.c Aftale") og kort for samtaler, der ikke er oprettet endnu.
- Titelfeltet er nu valgfrit. Skriver man en titel, vises den som en lille linje under datoen.

## v7 – 9. november 2026
**Tomme tekstfelter skjules på kortene**
- "Punkter at tale om", "Noter fra samtalen" og "Aftaler" vises kun på et samtalekort, hvis der står noget i dem. Så bruger kortene ikke plads på tomme overskrifter.
- I redigér-dialogen står alle tre felter der stadig, så det er nemt at skrive noget i dem.
- Udviklingslog (denne fil) og en projektbeskrivelse til Claude (`CLAUDE.md`) er tilføjet.

## v6 – 9. november 2026
**Versionsnummer i programmet**
- Versionsnummeret står nu øverst i programmet.
- Filerne hentes med versionsnummer i adressen (`app.js?v=6`), så browseren henter de nye filer, når programmet opdateres, i stedet for at bruge en gammel gemt kopi.
- *Baggrund:* en opdatering dukkede ikke op i browseren, fordi Chrome viste en gemt kopi af den gamle version.

## v5 – 9. november 2026
**Træk i karakterkategorierne for at ændre rækkefølgen**
- Kategori-knapperne på elevfanen og karakterfanen kan trækkes med mus, touchpad eller touchskærm.
- Der er én fælles rækkefølge. Den gemmes i datafilen og styrer rækkefølgen på kortene (øverst først), i karakterskemaet (venstre først) og i opsætningen.
- Et almindeligt klik slår stadig en kategori til og fra.

## v4 – 9. november 2026
**Nye skole-hjem-samtaler oprettes for hele klassen**
- En ny samtale oprettes som standard for alle elever i klassen med samme dato, samtalenummer og titel.
- Elever, der allerede har samtalen i det skoleår, bliver sprunget over.
- Tekstfelterne gemmes kun hos den valgte elev. De andre elevers kort starter tomme.
- Ekstra samtaler og aftaler oprettes kun for den enkelte elev.

## v3 – 9. november 2026
**Kategorierne står på linje på tværs af kortene, og ekstra samtaler er forenklet**
- På elevfanen har hver karakterkategori sin egen vandrette række på tværs af alle samtalekort, så det er nemt at følge en elevs udvikling over tid.
- En ekstra samtale har kun ét tekstfelt, "Noter", i stedet for de tre faste overskrifter.

## v2 – 9. november 2026
**Karakterer knyttes til 1. samtale, 2. samtale eller "efter sidste samtale"**
- Hver opgave (kolonne) hører til en periode i skoleåret. Programmet foreslår selv perioden ud fra datoen, og den kan ændres.
- Samtaler har et nummer: 1., 2. eller ekstra.
- Samtalekortene viser karaktererne som små skemaer pr. kategori, ligesom på karakterfanen. Kommentarer vises, når man holder musen over karakteren.
- Karakterer givet efter sidste samtale vises på kortet for 2. samtale, adskilt af en tyk streg.
- Der vises et stiplet kort for samtaler, der ikke er oprettet endnu, men som allerede har karakterer.
- Karakterfanen viser perioderne med en overskrift og en tyk streg.
- Ældre datafiler opdateres automatisk (dataformat version 2).

## v1 – 9. november 2026
**Første version**
- **Elevfanen:** samtale- og aftalekort i datoorden, som kan scrolles vandret.
- **Karakterfanen:** navnekolonnen står fast, og der er indtastning direkte i felterne, kommentarer pr. karakter og klassens gennemsnit.
- **Opsætning:** klasser, der rykker automatisk op hvert skoleår, elever og karakterkategorier.
- **Skalaer:** 7-trinsskala, point, procent, egne vurderinger og fri tekst.
- **Data:** alt ligger i én JSON-fil, som brugeren selv vælger, og programmet gemmer automatisk. Siden har en sikkerhedsregel, der blokerer al netværkstrafik.
- **Testtilstand:** fiktive testelever til afprøvning.

---

## Ønsker og idéer til senere
- Udskriftsvenlig forberedelse til skole-hjem-samtalen
- Gennemsnit pr. elev i karakterskemaet
- Ret dato for hele klassens samtale på én gang (i dag skal datoen rettes pr. elev)

## Ikke testet endnu
- At gemme i en rigtig fil i Google Drev på en Chromebook. Det er kun testet med en simuleret fil.
