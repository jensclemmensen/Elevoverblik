'use strict';
/*
  Fiktive testdata, så programmet kan afprøves uden rigtige elevoplysninger.
  Alle navne og tekster er opdigtede.
*/
function lavTestdata() {
  // Fast "tilfældighed", så testdata er ens hver gang
  let fro = 20240817;
  const r = () => { fro |= 0; fro = (fro + 0x6d2b79f5) | 0; let t = Math.imul(fro ^ (fro >>> 15), 1 | fro); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const vaelg = (a) => a[Math.floor(r() * a.length)];
  const id = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
  const begraens = (x) => Math.max(0, Math.min(1, x));

  const nu = new Date();
  const iDag = `${nu.getFullYear()}-${String(nu.getMonth() + 1).padStart(2, '0')}-${String(nu.getDate()).padStart(2, '0')}`;
  const sy = nu.getMonth() + 1 >= 8 ? nu.getFullYear() : nu.getFullYear() - 1;

  const d = {
    format: 'elevoverblik', version: 1, indstillinger: { startMaaned: 8 },
    klasser: [], elever: [], kategorier: [], opgaver: [], karakterer: [], samtaler: [], aftaler: [],
  };

  const fornavne = ['Alma', 'Bertil', 'Cille', 'Dagmar', 'Elias', 'Freja', 'Gustav', 'Hjalte', 'Ida', 'Johan', 'Karla', 'Lauge', 'Merle', 'Noah', 'Olivia', 'Palle', 'Rosa', 'Sigurd', 'Tilde', 'Uffe', 'Vera', 'Wilma', 'Asger', 'Bodil', 'Carl', 'Ditte', 'Emil', 'Folmer', 'Gry', 'Holger', 'Inger', 'Jonas', 'Kaja', 'Leo', 'Malte', 'Nanna'];
  const efternavne = ['Andersen', 'Bjerre', 'Dahl', 'Enevoldsen', 'Fisker', 'Grønbech', 'Holm', 'Iversen', 'Juul', 'Kjær', 'Lund', 'Mølgaard', 'Nygaard', 'Overgaard', 'Pallesen', 'Ravn', 'Skov', 'Thygesen', 'Vestergaard', 'Østergaard'];

  const kat = (navn, skala, vaerdier = []) => { const k = { id: id(), navn, skala, vaerdier }; d.kategorier.push(k); return k; };
  const problem = kat('Problemregning', 'syvtrin');
  const faerdighed = kat('Færdighedsregning', 'point');
  const mundtlig = kat('Mundtlig matematik', 'liste', ['Under forventet', 'Som forventet', 'Over forventet']);
  const laesning = kat('Læsetest', 'procent');
  const indsats = kat('Arbejdsindsats', 'tekst');

  const kommentarer = ['Glemte enheder i flere opgaver', 'Flot forklaring af fremgangsmåden', 'Mangler mellemregninger', 'Gik hjem før tid',
    'God brug af GeoGebra', 'Svært ved tekstopgaverne', 'Stor fremgang siden sidst', 'Skal øve brøker'];
  const indsatsTekst = ['Arbejder stabilt', 'Skal i gang hurtigere', 'Meget engageret', 'Lader sig let distrahere', 'Hjælper gerne andre'];
  const punkter = ['Trivsel i klassen', 'Lektier og forberedelse', 'Fremmøde', 'Arbejdet med problemregning', 'Valg af ungdomsuddannelse', 'Brug af mobil i timerne'];
  const aftaleTekst = ['Går i lektiecafé om tirsdagen', 'Forældre tjekker Aula hver søndag', 'Sidder forrest i matematiktimerne',
    'Laver ekstra færdighedsopgaver hjemme', 'Ny samtale med AKT-lærer i næste måned'];

  for (const [trin, bogstav] of [[8, 'a'], [6, 'b']]) {
    const klasse = { id: id(), trin, bogstav, aar: sy };
    d.klasser.push(klasse);
    const elever = [];
    while (elever.length < 18) {
      const navn = `${vaelg(fornavne)} ${vaelg(efternavne)}`;
      if (d.elever.some((e) => e.navn === navn) || elever.some((e) => e.navn === navn)) continue;
      elever.push({ id: id(), navn, klasseId: klasse.id, evne: r() });
    }
    for (const y of [sy - 1, sy]) {
      const plan = [
        [problem, `${y}-09-22`, 'Kapitel 1'], [problem, `${y + 1}-01-17`, 'Terminsprøve'], [problem, `${y + 1}-04-10`, 'Kapitel 5'],
        [faerdighed, `${y}-10-04`, 'Brøker', 40], [faerdighed, `${y + 1}-02-21`, 'Ligninger', 40],
        [mundtlig, `${y}-11-01`, 'Fremlæggelse'], [mundtlig, `${y + 1}-03-14`, 'Gruppeoplæg'],
        [laesning, `${y}-09-05`, 'Efterår'], [laesning, `${y + 1}-05-02`, 'Forår'],
        [indsats, `${y}-11-05`, 'Efterår'], [indsats, `${y + 1}-03-20`, 'Forår'],
      ];
      for (const [k, dato, navn, maks] of plan) {
        if (dato > iDag) continue;
        const o = { id: id(), klasseId: klasse.id, kategoriId: k.id, navn, dato, maks: maks || null };
        d.opgaver.push(o);
        for (const e of elever) {
          if (r() < 0.05) continue; // fravær
          const a = begraens(e.evne + (r() - 0.5) * 0.35);
          let v;
          if (k.skala === 'syvtrin') v = ['-3', '00', '02', '4', '7', '10', '12'][Math.min(6, Math.floor(a * 6.2 + 0.4))];
          else if (k.skala === 'point') v = Math.round(a * maks);
          else if (k.skala === 'procent') v = Math.round(30 + a * 70);
          else if (k.skala === 'liste') v = k.vaerdier[a < 0.33 ? 0 : a < 0.75 ? 1 : 2];
          else v = vaelg(indsatsTekst);
          d.karakterer.push({ id: id(), elevId: e.id, opgaveId: o.id, vaerdi: v, kommentar: r() < 0.15 ? vaelg(kommentarer) : '' });
        }
      }
      for (const dato of [`${y}-11-20`, `${y + 1}-03-12`]) {
        if (dato > iDag) continue;
        for (const e of elever) {
          d.samtaler.push({
            id: id(), elevId: e.id, dato, titel: '',
            punkter: `${vaelg(punkter)}\n${vaelg(punkter)}`,
            noter: r() < 0.5 ? 'God samtale. Eleven fortæller, at det går godt i klassen.' : 'Forældrene er bekymrede for lektiemængden.',
            aftaler: r() < 0.6 ? vaelg(aftaleTekst) : '',
          });
        }
      }
      const mellem = `${y + 1}-01-28`;
      if (mellem <= iDag) {
        for (const e of elever) {
          if (r() < 0.3) d.aftaler.push({ id: id(), elevId: e.id, dato: mellem, titel: 'Telefonsamtale med forældre', tekst: vaelg(aftaleTekst) });
        }
      }
    }
    elever.forEach((e) => { delete e.evne; d.elever.push(e); });
  }
  return d;
}
