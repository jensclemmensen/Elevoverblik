# Elevoverblik – noter til Claude

Et lille program, som en lærer bruger til skole-hjem-samtaler, aftaler og karakterer.
Brugeren skriver på dansk, og hele brugerfladen er på dansk.

## Regler, der altid gælder
- **Elevdata er persondata (GDPR).** Bed aldrig om at se datafilen. Test med `testdata.js`, som indeholder fiktive elever.
- **Programmet må aldrig sende data ud på nettet.** Behold Content-Security-Policy i `index.html` (`connect-src 'none'` m.m.). Brug ingen eksterne scripts, skrifttyper eller CDN'er.
- `.gitignore` udelukker alle `*.json`, så datafiler ikke kommer med op på GitHub.
- **Ved hver ændring af programmet:**
  1. Hæv versionsnummeret i `index.html`: `?v=N` på alle filer og mærket `vN` i overskriften.
  2. Skriv et afsnit øverst i `UDVIKLINGSLOG.md` med hvad og hvorfor, på dansk.
  3. Commit og push til `main`. GitHub Pages udgiver herfra: https://jensclemmensen.github.io/Elevoverblik/

## Opbygning
Ren HTML/CSS/JavaScript uden byggetrin og uden biblioteker. Alt kører i Chrome på brugerens Chromebook.
- `index.html`: sidens skelet og CSP
- `app.js`: al logik. Den er delt i afsnit: hjælpere, skoleår/klasser, skalaer, perioder og migrering, datafil, visning (elev, klasse, opsætning), dialoger og hændelser
- `style.css`: udseende
- `testdata.js`: `lavTestdata()` med fiktive elever

Datafilen åbnes og gemmes med File System Access API (`showOpenFilePicker` m.fl.). Programmet gemmer automatisk ca. 0,6 sekund efter hver ændring. Filhåndtaget huskes i IndexedDB, og visningsvalg (kun id'er) huskes i localStorage.

## Datamodel (datafilen, `format: 'elevoverblik'`)
Se kommentaren øverst i `app.js`. Kort fortalt:
- `klasser` har `trin` i skoleåret `aar`. Klassetrinnet stiger automatisk ved hvert nyt skoleår (`indstillinger.startMaaned`, standard august).
- `opgaver` har `periode`: 1 = til 1. samtale, 2 = til 2. samtale, 3 = efter sidste samtale.
- `samtaler` har `nummer`: 1, 2 eller 0 (ekstra samtale uden karakterer).
- `opgaver` kan have deres egen `skala` (og `vaerdier` til egne vurderinger). Ellers bruges kategoriens. Brug altid `skalaFor(kat, opg)`.
- `karakterer` kobler elev og opgave og har `vaerdi` og `kommentar`.
- Rækkefølgen i `kategorier` er den rækkefølge, kategorierne vises i.

**Ændres datamodellen:** hæv `VERSION` i `app.js`, og udfyld nye felter i `migrer()`. Den køres ved indlæsning og skal kunne køres flere gange uden at ødelægge noget. Brugerens eksisterende fil skal altid kunne åbnes.

## Test
Brug Playwright (allerede installeret) mod `file:///…/index.html`. Klik på "Prøv med fiktive testelever", og tag skærmbilleder af elevfanen, karakterfanen og opsætningen. Tjek, at der ikke kommer fejl i konsollen.
