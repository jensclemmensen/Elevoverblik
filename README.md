# Elevoverblik

Et lille program til skole-hjem-samtaler, aftaler og karakterer. Det kører helt i Chrome.

## Programmet og data er adskilt

- **Programmet** består af filerne i dette repository (`index.html`, `app.js`, `style.css`, `testdata.js`).
  Der står ingen elevdata i dem.
- **Data** ligger i én fil, f.eks. `elevdata.json`, som du selv vælger placeringen af.
  Læg den i Google Drev, så har du backup. Drev gemmer også tidligere versioner af filen.
- Siden har en sikkerhedsregel (Content-Security-Policy), som får browseren til at blokere
  alt, hvad siden prøver at sende ud på nettet.

## Kom i gang

1. Åbn `index.html` i Chrome (fra en webadresse eller som lokal fil).
2. Vælg **Opret en ny, tom datafil**, og gem den i din Google Drev-mappe.
3. Under **Opsætning** opretter du klasser, elever og karakterkategorier.
4. Næste gang du åbner programmet, klikker du på **Fortsæt med elevdata.json**.

Programmet gemmer automatisk efter hver ændring.

## Når programmet skal ændres

Bed Claude om at ændre filerne i dette repository. Del aldrig datafilen.
Brug knappen **Prøv med fiktive testelever** til at se, hvordan ændringerne virker.
