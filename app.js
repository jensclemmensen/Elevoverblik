'use strict';
/*
  Elevoverblik
  ---------
  Programmet kører helt i browseren. Alle elevdata ligger i én JSON-fil, som
  brugeren selv vælger (f.eks. i Google Drev på Chromebooken). Programmet sender
  aldrig data nogen steder hen – se Content-Security-Policy i index.html.

  Datamodel (datafilen):
    indstillinger: { startMaaned }           skoleåret starter den 1. i denne måned
    klasser:    { id, trin, bogstav, aar }   'trin' er klassetrinnet i skoleåret, der starter i 'aar'
    elever:     { id, navn, klasseId }
    kategorier: { id, navn, skala, vaerdier[] }   skala: syvtrin | point | procent | liste | tekst
    opgaver:    { id, klasseId, kategoriId, navn, dato, maks, periode }
                periode: 1 = til 1. skole-hjem-samtale, 2 = til 2. samtale, 3 = efter sidste samtale
    karakterer: { id, elevId, opgaveId, vaerdi, kommentar }
    samtaler:   { id, elevId, dato, nummer, titel, punkter, noter, aftaler }
                nummer: 1 eller 2 (skoleårets 1./2. samtale), 0 = ekstra samtale uden karakterer
    aftaler:    { id, elevId, dato, titel, tekst }
*/

const VERSION = 2;

// ---------- Hjælpefunktioner ----------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const pad = (n) => String(n).padStart(2, '0');
const isoDato = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const idag = () => isoDato(new Date());
const visDato = (s) => { if (!s) return ''; const [y, m, d] = s.split('-'); return `${d}.${m}.${y}`; };
const sorterNavn = (a, b) => a.navn.localeCompare(b.navn, 'da');
const MAANEDER = ['januar', 'februar', 'marts', 'april', 'maj', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'december'];
const flertal = (n, en, flere) => `${n} ${n === 1 ? en : flere}`;

function tomData() {
  return {
    format: 'elevoverblik', version: VERSION,
    indstillinger: { startMaaned: 8 },
    klasser: [], elever: [], kategorier: [], opgaver: [], karakterer: [], samtaler: [], aftaler: [],
  };
}

let D = null; // de indlæste data
const find = (liste, id) => D[liste].find((x) => x.id === id);

// ---------- Visningsindstillinger (kun id'er – ingen persondata) ----------
const UI = Object.assign(
  { vis: 'elev', klasseId: null, elevId: null, klasseKategorier: [], skjulteKategorier: [], filterAaben: false, klasseAar: 'nu' },
  hentUI()
);
function hentUI() { try { return JSON.parse(localStorage.getItem('elevoverblik.ui')) || {}; } catch { return {}; } }
function gemUI() { try { localStorage.setItem('elevoverblik.ui', JSON.stringify(UI)); } catch { /* ok */ } }

// ---------- Skoleår og klasser ----------
function skoleaar(dato) { const [y, m] = dato.split('-').map(Number); return m >= D.indstillinger.startMaaned ? y : y - 1; }
function skoleaarStart(aar) { return `${aar}-${pad(D.indstillinger.startMaaned)}-01`; }
function skoleaarTekst(aar) { return `${aar}/${String(aar + 1).slice(-2)}`; }
function klassetrin(k, dato = idag()) { return k.trin + (skoleaar(dato) - k.aar); }
function klasseNavn(k, dato) { return `${klassetrin(k, dato)}.${k.bogstav}`; }
function sorteredeKlasser() {
  return [...D.klasser].sort((a, b) => klassetrin(a) - klassetrin(b) || a.bogstav.localeCompare(b.bogstav, 'da'));
}
function eleverIKlasse(id) { return D.elever.filter((e) => e.klasseId === id).sort(sorterNavn); }

// ---------- Skalaer ----------
const SKALAER = {
  syvtrin: { navn: '7-trinsskala', tal: true },
  point: { navn: 'Point', tal: true },
  procent: { navn: 'Procent', tal: true },
  liste: { navn: 'Egne vurderinger', tal: false },
  tekst: { navn: 'Fri tekst', tal: false },
};
const SYVTRIN = ['-3', '00', '02', '4', '7', '10', '12'];

function laesTal(s) {
  const t = s.replace(/\s/g, '').replace('%', '').replace(',', '.');
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}
/** Fortolker det, brugeren har skrevet. Returnerer { vaerdi } eller { fejl }. */
function fortolk(kat, opg, raa) {
  const s = String(raa ?? '').trim();
  if (s === '') return { vaerdi: '' };
  switch (kat.skala) {
    case 'syvtrin': {
      const alias = { '0': '00', '2': '02', '-03': '-3', '04': '4', '07': '7' };
      const v = alias[s] ?? s;
      return SYVTRIN.includes(v) ? { vaerdi: v } : { fejl: `"${s}" findes ikke på 7-trinsskalaen (${SYVTRIN.join(', ')})` };
    }
    case 'point': {
      const n = laesTal(s);
      if (isNaN(n) || n < 0) return { fejl: 'Point skal være et tal på 0 eller derover' };
      if (opg?.maks && n > opg.maks) return { fejl: `Der kan højst gives ${opg.maks} point` };
      return { vaerdi: n };
    }
    case 'procent': {
      const n = laesTal(s);
      if (isNaN(n) || n < 0 || n > 100) return { fejl: 'Procent skal være et tal mellem 0 og 100' };
      return { vaerdi: n };
    }
    case 'liste': {
      const v = (kat.vaerdier || []).find((x) => x.toLowerCase() === s.toLowerCase());
      return v ? { vaerdi: v } : { fejl: `Vælg en af: ${(kat.vaerdier || []).join(', ')}` };
    }
    default: return { vaerdi: s };
  }
}
const tomV = (v) => v === '' || v == null;
const talTekst = (n, dec = 1) => n.toLocaleString('da-DK', { maximumFractionDigits: dec });
/** Værdi som den vises på kort og i oversigter. */
function visVaerdi(kat, v, opg) {
  if (tomV(v)) return '';
  if (kat.skala === 'point') return talTekst(v, 2) + (opg?.maks ? `/${opg.maks}` : '');
  if (kat.skala === 'procent') return talTekst(v, 1) + ' %';
  return String(v);
}
/** Værdi som den står i et indtastningsfelt. */
function feltVaerdi(kat, v) {
  if (tomV(v)) return '';
  return kat.skala === 'point' || kat.skala === 'procent' ? talTekst(v, 2) : String(v);
}
function gennemsnit(kat, vaerdier) {
  const udfyldt = vaerdier.filter((v) => !tomV(v));
  if (!udfyldt.length) return { tekst: '–', titel: 'Ingen karakterer endnu' };
  if (SKALAER[kat.skala].tal) {
    const g = udfyldt.reduce((s, v) => s + Number(v), 0) / udfyldt.length;
    return { tekst: talTekst(g) + (kat.skala === 'procent' ? ' %' : ''), titel: `Gennemsnit af ${udfyldt.length} elever` };
  }
  const antal = {};
  udfyldt.forEach((v) => { antal[v] = (antal[v] || 0) + 1; });
  return { tekst: `${udfyldt.length} udfyldt`, titel: Object.entries(antal).map(([v, n]) => `${v}: ${n}`).join('\n') };
}

// ---------- Perioder: hvilken skole-hjem-samtale hører en opgave til ----------
const PERIODER = { 1: '1. samtale', 2: '2. samtale', 3: 'Efter sidste samtale' };
const PERIODER_LANG = { 1: 'Til 1. skole-hjem-samtale', 2: 'Til 2. skole-hjem-samtale', 3: 'Efter sidste skole-hjem-samtale (vises på 2. samtale)' };
const SAMTALE_NAVN = { 1: '1. skole-hjem-samtale', 2: '2. skole-hjem-samtale', 0: 'Ekstra samtale' };

/** Sortering af opgaver: skoleår, periode, dato, navn. */
function sorterOpg(a, b) {
  return skoleaar(a.dato) - skoleaar(b.dato) || a.periode - b.periode || a.dato.localeCompare(b.dato) || (a.navn || '').localeCompare(b.navn || '', 'da');
}
/** Typiske datoer for klassens 1. og 2. samtale i et skoleår (bruges til at gætte en opgaves periode). */
function klassensSamtaleDatoer(klasseId, aar) {
  const ids = new Set(D.elever.filter((e) => e.klasseId === klasseId).map((e) => e.id));
  const s = D.samtaler.filter((x) => ids.has(x.elevId) && skoleaar(x.dato) === aar);
  const median = (a) => (a.length ? a.sort()[Math.floor((a.length - 1) / 2)] : null);
  const s1 = median(s.filter((x) => x.nummer === 1).map((x) => x.dato)) || `${aar}-11-30`;
  let s2 = median(s.filter((x) => x.nummer === 2).map((x) => x.dato)) || `${aar + 1}-03-31`;
  if (s2 <= s1) s2 = `${aar + 1}-07-31`;
  return { s1, s2 };
}
function gaetPeriode(klasseId, dato) {
  const { s1, s2 } = klassensSamtaleDatoer(klasseId, skoleaar(dato));
  return dato <= s1 ? 1 : dato <= s2 ? 2 : 3;
}
/** Udfylder felter, som ældre datafiler mangler. Kan køres flere gange. */
function migrer() {
  const grupper = new Map();
  for (const s of D.samtaler) {
    const k = s.elevId + '|' + skoleaar(s.dato);
    if (!grupper.has(k)) grupper.set(k, []);
    grupper.get(k).push(s);
  }
  for (const liste of grupper.values()) {
    const brugt = new Set(liste.map((s) => s.nummer).filter(Boolean));
    for (const s of liste.sort((a, b) => a.dato.localeCompare(b.dato))) {
      if (s.nummer !== undefined) continue;
      s.nummer = [1, 2].find((n) => !brugt.has(n)) ?? 0;
      if (s.nummer) brugt.add(s.nummer);
    }
  }
  for (const o of D.opgaver) if (!o.periode) o.periode = gaetPeriode(o.klasseId, o.dato);
}

// ---------- Karakterer ----------
function saetKarakter(elevId, opgaveId, felter) {
  let k = D.karakterer.find((x) => x.elevId === elevId && x.opgaveId === opgaveId);
  if (!k) { k = { id: uid(), elevId, opgaveId, vaerdi: '', kommentar: '' }; D.karakterer.push(k); }
  Object.assign(k, felter);
  if (tomV(k.vaerdi) && !k.kommentar) D.karakterer = D.karakterer.filter((x) => x !== k);
  aendret();
}
// =====================================================================
//   Datafil
// =====================================================================
const Fil = {
  understoetter: 'showOpenFilePicker' in window,
  handle: null, navn: '', test: false, fallback: false,
  dirty: false, fejl: false, sidstGemt: null, timer: null, koe: Promise.resolve(),
};
const PICKER = { types: [{ description: 'Elevoverblik-datafil', accept: { 'application/json': ['.json'] } }] };

// Husk hvilken fil der sidst var åben (selve filhåndtaget – ikke indholdet)
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('elevoverblik', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function kvSaet(k, v) {
  try {
    const db = await idb();
    await new Promise((res, rej) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  } catch { /* ok */ }
}
async function kvHent(k) {
  try {
    const db = await idb();
    return await new Promise((res, rej) => { const r = db.transaction('kv').objectStore('kv').get(k); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  } catch { return undefined; }
}

function klargoer(d) {
  if (!d || d.format !== 'elevoverblik') throw new Error('Filen er ikke en Elevoverblik-datafil.');
  if (d.version > VERSION) throw new Error('Filen er lavet med en nyere version af programmet.');
  const t = tomData();
  for (const k of Object.keys(t)) if (d[k] === undefined) d[k] = t[k];
  d.indstillinger = Object.assign({}, t.indstillinger, d.indstillinger);
  d.version = VERSION;
  return d;
}
function laesTekst(tekst) { return tekst.trim() === '' ? tomData() : klargoer(JSON.parse(tekst)); }

async function brugHandle(h) {
  let tilladelse = await h.queryPermission({ mode: 'readwrite' });
  if (tilladelse !== 'granted') tilladelse = await h.requestPermission({ mode: 'readwrite' });
  if (tilladelse !== 'granted') throw new Error('Programmet fik ikke lov til at bruge filen.');
  const data = laesTekst(await (await h.getFile()).text());
  Object.assign(Fil, { handle: h, navn: h.name, test: false, fallback: false, dirty: false, fejl: false, sidstGemt: null });
  D = data; migrer();
  await kvSaet('handle', h);
  render();
}
async function aabnFil() {
  if (!Fil.understoetter) return aabnFilFallback();
  const [h] = await window.showOpenFilePicker(PICKER);
  await brugHandle(h);
}
async function nyFil() {
  if (!Fil.understoetter) { D = tomData(); Object.assign(Fil, { fallback: true, navn: 'elevdata.json', test: false }); render(); return; }
  const h = await window.showSaveFilePicker({ ...PICKER, suggestedName: 'elevdata.json' });
  D = tomData();
  Object.assign(Fil, { handle: h, navn: h.name, test: false, fallback: false, dirty: true, fejl: false });
  await gemNu();
  await kvSaet('handle', h);
  render();
}
async function genaabn() {
  const h = await kvHent('handle');
  if (!h) return aabnFil();
  await brugHandle(h);
}
function aabnFilFallback() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.json,application/json';
  inp.onchange = async () => {
    try {
      const f = inp.files[0]; if (!f) return;
      D = laesTekst(await f.text()); migrer();
      Object.assign(Fil, { fallback: true, navn: f.name, test: false, dirty: false });
      render();
    } catch (e) { visFejl(e); }
  };
  inp.click();
}
function startTest() {
  D = klargoer(lavTestdata()); migrer();
  Object.assign(Fil, { handle: null, navn: '', test: true, fallback: false, dirty: false, fejl: false });
  UI.klasseId = null; UI.elevId = null;
  render();
}

/** Kaldes efter hver ændring af data. Gemmer automatisk lidt efter. */
function aendret() {
  Fil.dirty = true;
  if (Fil.handle) { clearTimeout(Fil.timer); Fil.timer = setTimeout(gemNu, 600); }
  opdaterStatus();
}
function gemNu() {
  clearTimeout(Fil.timer);
  Fil.koe = Fil.koe.then(async () => {
    if (!Fil.handle || !Fil.dirty) return;
    Fil.dirty = false;
    try {
      const w = await Fil.handle.createWritable();
      await w.write(JSON.stringify(D, null, 1));
      await w.close();
      Fil.fejl = false; Fil.sidstGemt = new Date();
    } catch (e) {
      Fil.dirty = true; Fil.fejl = true;
      toast('Kunne ikke gemme datafilen: ' + e.message, true);
    }
    opdaterStatus();
  });
  return Fil.koe;
}
function download(navn, tekst) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([tekst], { type: 'application/json' }));
  a.download = navn;
  document.body.append(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
function backupNavn() { return `elevdata-backup-${idag()}.json`; }
async function gemSom() {
  const h = await window.showSaveFilePicker({ ...PICKER, suggestedName: 'elevdata.json' });
  Object.assign(Fil, { handle: h, navn: h.name, test: false, fallback: false, dirty: true });
  await gemNu();
  await kvSaet('handle', h);
  render();
}

window.addEventListener('beforeunload', (e) => {
  if (Fil.dirty && !Fil.test) { e.preventDefault(); e.returnValue = ''; }
});
document.addEventListener('visibilitychange', () => { if (document.hidden && Fil.dirty && Fil.handle) gemNu(); });

function opdaterStatus() {
  const s = $('#filstatus');
  if (!D) { s.innerHTML = ''; return; }
  if (Fil.test) {
    s.innerHTML = `<span class="maerke test">Testtilstand – fiktive elever, intet gemmes</span>
      <button data-act="afslut-test">Afslut test</button>`;
  } else if (Fil.handle) {
    const tid = Fil.sidstGemt ? `Gemt kl. ${pad(Fil.sidstGemt.getHours())}:${pad(Fil.sidstGemt.getMinutes())}` : 'Åbnet';
    s.innerHTML = `<span class="filnavn" title="Datafil">${esc(Fil.navn)}</span>
      <span class="${Fil.fejl ? 'maerke fejl' : 'gemt'}">${Fil.fejl ? 'Ikke gemt!' : Fil.dirty ? 'Gemmer…' : tid}</span>
      ${Fil.fejl ? '<button data-act="gem-igen">Prøv igen</button>' : ''}`;
  } else {
    s.innerHTML = `<span class="filnavn">${esc(Fil.navn)}</span>
      ${Fil.dirty ? '<span class="maerke fejl">Ændringer er ikke gemt</span>' : ''}
      <button data-act="download">Download datafil</button>`;
  }
}

// =====================================================================
//   Visning
// =====================================================================
let rulTilSlut = false;

function render() {
  const main = $('#main');
  if (!D) { $('#nav').hidden = true; opdaterStatus(); renderStart(); return; }
  $('#nav').hidden = false;
  $$('#nav button').forEach((b) => b.classList.toggle('aktiv', b.dataset.vis === UI.vis));

  const tl = $('.tidslinje'), gw = $('.grid-wrap');
  const gammel = { tl: tl?.scrollLeft, gx: gw?.scrollLeft, gy: gw?.scrollTop };

  main.innerHTML = UI.vis === 'klasse' ? htmlKlasse() : UI.vis === 'opsaetning' ? htmlOpsaetning() : htmlElev();

  const nyTl = $('.tidslinje');
  if (nyTl) {
    const n = Number(nyTl.dataset.raekker);
    nyTl.style.gridTemplateRows = `repeat(${n}, auto)`;
    $$('.kort', nyTl).forEach((k) => { k.style.gridRow = `span ${n}`; });
  }
  if (nyTl) nyTl.scrollLeft = rulTilSlut || gammel.tl == null ? nyTl.scrollWidth : gammel.tl;
  const nyGw = $('.grid-wrap');
  if (nyGw && gammel.gx != null) { nyGw.scrollLeft = gammel.gx; nyGw.scrollTop = gammel.gy; }
  rulTilSlut = false;
  opdaterStatus();
  gemUI();
}

async function renderStart() {
  const forrige = Fil.understoetter ? await kvHent('handle') : null;
  if (D) return;
  $('#main').innerHTML = `
    <div class="start">
      <h2>Velkommen til Elevoverblik</h2>
      <p>Alle elevdata gemmes i én fil, som du selv vælger placeringen af – f.eks. i din Google Drev-mappe.
         Programmet sender aldrig noget ud på internettet.</p>
      <div class="start-knapper">
        ${forrige ? `<button class="primaer stor" data-act="genaabn">Fortsæt med <b>${esc(forrige.name)}</b></button>` : ''}
        <button class="${forrige ? '' : 'primaer '}stor" data-act="aabn-fil">Åbn en datafil</button>
        <button class="stor" data-act="ny-fil">Opret en ny, tom datafil</button>
      </div>
      <hr>
      <p class="hjaelp">Vil du bare se, hvordan programmet virker?</p>
      <button data-act="testdata">Prøv med fiktive testelever</button>
      ${Fil.understoetter ? '' : `<p class="advarsel">Din browser kan ikke gemme direkte i filer. Brug Google Chrome –
        ellers skal du selv huske at downloade datafilen, når du har lavet ændringer.</p>`}
    </div>`;
}

function tomTilstand(titel, tekst = '') {
  return `<div class="tom"><p class="tom-titel">${titel}</p>${tekst ? `<p>${tekst}</p>` : ''}</div>`;
}
function sikrValg() {
  const kl = sorteredeKlasser();
  if (!kl.some((k) => k.id === UI.klasseId)) UI.klasseId = kl[0]?.id ?? null;
  const el = UI.klasseId ? eleverIKlasse(UI.klasseId) : [];
  if (!el.some((e) => e.id === UI.elevId)) UI.elevId = el[0]?.id ?? null;
  return { kl, el };
}
function klasseSelect(kl, act = 'vaelg-klasse') {
  return `<label class="inline">Klasse <select data-act="${act}">${kl.map((k) =>
    `<option value="${k.id}" ${k.id === UI.klasseId ? 'selected' : ''}>${esc(klasseNavn(k))}</option>`).join('')}</select></label>`;
}
function kategoriChips(act, erValgt) {
  return D.kategorier.map((k) => `<label class="chip"><input type="checkbox" data-act="${act}" value="${k.id}" ${erValgt(k) ? 'checked' : ''}>${esc(k.navn)}</label>`).join('');
}

// ---------- Elevvisning: tidslinje med kort ----------
function htmlElev() {
  const { kl, el } = sikrValg();
  if (!kl.length) return tomTilstand('Der er endnu ingen klasser.', 'Gå til <b>Opsætning</b> og opret dine klasser og elever.');
  const elev = UI.elevId && find('elever', UI.elevId);
  let h = `<div class="vaelger">
    ${klasseSelect(kl)}
    <div class="elevvalg">
      <button class="ikon" data-act="skift-elev" data-retning="-1" title="Forrige elev" ${el.length < 2 ? 'disabled' : ''}>‹</button>
      <select data-act="vaelg-elev" aria-label="Elev">${el.map((e) => `<option value="${e.id}" ${e.id === UI.elevId ? 'selected' : ''}>${esc(e.navn)}</option>`).join('')}</select>
      <button class="ikon" data-act="skift-elev" data-retning="1" title="Næste elev" ${el.length < 2 ? 'disabled' : ''}>›</button>
    </div>
    <span class="spacer"></span>
    ${elev ? `<button class="primaer" data-act="ny-samtale">+ Skole-hjem-samtale</button>
              <button class="aftale-knap" data-act="ny-aftale">+ Aftale</button>` : ''}
  </div>`;
  if (!elev) return h + tomTilstand('Klassen har ingen elever endnu.', 'Tilføj elever under <b>Opsætning</b>.');

  let filter = '';
  if (D.kategorier.length) {
    const vist = D.kategorier.filter((k) => !UI.skjulteKategorier.includes(k.id)).length;
    filter = `<details class="filter" data-filter ${UI.filterAaben ? 'open' : ''}>
      <summary>Karakterer på kortene: ${vist} af ${D.kategorier.length} kategorier vises</summary>
      <div class="chips">${kategoriChips('elev-kategori', (k) => !UI.skjulteKategorier.includes(k.id))}</div>
    </details>`;
  }

  const samtaler = D.samtaler.filter((s) => s.elevId === elev.id);
  const aftaler = D.aftaler.filter((a) => a.elevId === elev.id);
  // Elevens karakterer (opgaveId -> karakter) og de opgaver, der er relevante for eleven
  const elevK = new Map(D.karakterer.filter((k) => k.elevId === elev.id).map((k) => [k.opgaveId, k]));
  const relevante = D.opgaver.filter((o) => o.klasseId === elev.klasseId || elevK.has(o.id));
  const opgFor = (aar, nummer) => relevante.filter((o) => skoleaar(o.dato) === aar && (nummer === 1 ? o.periode === 1 : o.periode >= 2));

  // Først samles kortene; html laves bagefter, når vi kender alle kategorier
  const kort = [
    ...samtaler.map((o) => ({ dato: o.dato, orden: 0, type: o.nummer ? 'samtale' : 'ekstra', o, opg: o.nummer ? opgFor(skoleaar(o.dato), o.nummer) : [] })),
    ...aftaler.map((o) => ({ dato: o.dato, orden: 1, type: 'aftale', o, opg: [] })),
  ];
  // Pladsholderkort for samtaler, der ikke er oprettet endnu, men som allerede har karakterer
  const aarMedKarakterer = new Set(relevante.filter((o) => elevK.has(o.id)).map((o) => skoleaar(o.dato)));
  for (const aar of aarMedKarakterer) {
    for (const n of [1, 2]) {
      if (samtaler.some((s) => s.nummer === n && skoleaar(s.dato) === aar)) continue;
      const opg = opgFor(aar, n);
      const medKarakter = opg.filter((o) => elevK.has(o.id));
      if (!medKarakter.length) continue;
      kort.push({ dato: medKarakter.map((o) => o.dato).sort().pop(), orden: 2, type: 'pladsholder', n, aar, opg });
    }
  }
  kort.sort((a, b) => a.dato.localeCompare(b.dato) || a.orden - b.orden);

  // Kategorier, der optræder på mindst ét kort – hver får sin egen vandrette række
  const brugte = new Set(kort.flatMap((k) => k.opg.map((o) => o.kategoriId)));
  const kats = D.kategorier.filter((k) => brugte.has(k.id) && !UI.skjulteKategorier.includes(k.id));
  const raekker = 2 + kats.length + 1; // top, tekst, én pr. kategori, fod
  const html = kort.map((k) =>
    k.type === 'samtale' ? htmlSamtaleKort(k.o, elev, k.opg, elevK, kats)
      : k.type === 'pladsholder' ? htmlPladsholderKort(k.n, k.aar, elev, k.opg, elevK, kats)
        : k.type === 'ekstra' ? htmlEkstraKort(k.o, elev)
          : htmlAftaleKort(k.o, elev));

  h += `<div class="tidslinje-top">${filter}<span class="spacer"></span>${html.length > 1 ? `
    <button class="ikon" data-act="rul" data-retning="-1" title="Rul tilbage i tiden">‹</button>
    <button class="ikon" data-act="rul" data-retning="1" title="Rul frem i tiden">›</button>` : ''}</div>`;
  if (!html.length) {
    return h + tomTilstand(`Ingen samtaler eller aftaler for ${esc(elev.navn)} endnu.`,
      'Klik på <b>+ Skole-hjem-samtale</b> eller <b>+ Aftale</b> for at oprette det første kort.');
  }
  return h + `<div class="tidslinje" data-raekker="${raekker}">${html.join('')}</div>`;
}

function tekstFelt(overskrift, tekst) {
  return `<section><h4>${overskrift}</h4>${tekst ? `<p class="tekst">${esc(tekst)}</p>` : '<p class="tom-felt">–</p>'}</section>`;
}
function samtaleTitel(s) {
  if (s.titel) return s.titel;
  const [y, m] = s.dato.split('-').map(Number);
  return `${m >= 8 ? 'Efterår' : 'Forår'} ${y}`;
}
function klasseVed(elev, dato) {
  const k = find('klasser', elev.klasseId);
  return k ? klasseNavn(k, dato) : '';
}
// Samtale- og pladsholderkort er delt op i rækker (top, tekst, én pr. kategori, fod),
// som flugter på tværs af kortene (CSS subgrid).
function htmlSamtaleKort(s, elev, opgaver, elevK, kats) {
  const k = htmlKarakterRaekker(opgaver, elevK, s.nummer, kats);
  return `<article class="kort samtale">
    <header>
      <span class="type">${SAMTALE_NAVN[s.nummer]}</span>
      <h3>${esc(samtaleTitel(s))}</h3>
      <div class="meta">${visDato(s.dato)} · ${esc(klasseVed(elev, s.dato))}</div>
      <button class="rediger" data-act="rediger-samtale" data-id="${s.id}">Redigér</button>
    </header>
    <div class="tekst-del">
      ${tekstFelt('Punkter at tale om', s.punkter)}
      ${tekstFelt('Noter fra samtalen', s.noter)}
      ${tekstFelt('Aftaler', s.aftaler)}
      ${k.overskrift}
    </div>
    ${k.celler}
    <div class="kort-fod">${k.forklaring}</div>
  </article>`;
}
function htmlPladsholderKort(n, aar, elev, opgaver, elevK, kats) {
  const k = htmlKarakterRaekker(opgaver, elevK, n, kats);
  return `<article class="kort siden">
    <header>
      <span class="type">${SAMTALE_NAVN[n]}</span>
      <h3>Ikke oprettet endnu</h3>
      <div class="meta">Skoleåret ${skoleaarTekst(aar)} · ${esc(klasseVed(elev, skoleaarStart(aar)))}</div>
    </header>
    <div class="tekst-del">${k.overskrift}</div>
    ${k.celler}
    <div class="kort-fod">${k.forklaring}<button data-act="ny-samtale" data-nummer="${n}" data-aar="${aar}">+ Opret samtalen</button></div>
  </article>`;
}
function htmlEkstraKort(s, elev) {
  return `<article class="kort ekstra">
    <header>
      <span class="type">${SAMTALE_NAVN[0]}</span>
      <h3>${esc(samtaleTitel(s))}</h3>
      <div class="meta">${visDato(s.dato)} · ${esc(klasseVed(elev, s.dato))}</div>
      <button class="rediger" data-act="rediger-samtale" data-id="${s.id}">Redigér</button>
    </header>
    ${s.noter ? `<p class="tekst">${esc(s.noter)}</p>` : ''}
  </article>`;
}
function htmlAftaleKort(a, elev) {
  return `<article class="kort aftale">
    <header>
      <span class="type">Aftale</span>
      ${a.titel ? `<h3>${esc(a.titel)}</h3>` : ''}
      <div class="meta">${visDato(a.dato)} · ${esc(klasseVed(elev, a.dato))}</div>
      <button class="rediger" data-act="rediger-aftale" data-id="${a.id}">Redigér</button>
    </header>
    ${a.tekst ? `<p class="tekst">${esc(a.tekst)}</p>` : ''}
  </article>`;
}
/** Karakterer på et kort: ét lille skema pr. kategori (samme udseende som fanen Karakterer).
    Returnerer én celle pr. kategori i 'kats' – tom, hvis kortet ikke har karakterer i kategorien. */
function htmlKarakterRaekker(opgaver, elevK, nummer, kats) {
  let harEfter = false, antal = 0;
  const celler = kats.map((kat) => {
    const kol = opgaver.filter((o) => o.kategoriId === kat.id).sort(sorterOpg);
    if (!kol.length) return '<div class="kat-celle tom"></div>';
    antal++;
    // Tyk streg før den første opgave, der er givet efter samtalen (kun på 2. samtale)
    const streg = nummer === 2 ? kol.findIndex((o) => o.periode === 3) : -1;
    if (streg >= 0) harEfter = true;
    const c = (i) => (i === streg ? 'efter' : '');
    const erTal = SKALAER[kat.skala].tal;
    return `<div class="kat-celle"><div class="kskema-ramme"><table class="kskema">
      <thead>
        <tr><th class="kat" colspan="${kol.length}">${esc(kat.navn)} <span class="skala">${SKALAER[kat.skala].navn}</span></th></tr>
        <tr>${kol.map((o, i) => `<th class="${c(i)}" title="${esc(PERIODER[o.periode])}"><span class="opg-navn">${esc(o.navn || '(uden navn)')}</span><span class="opg-dato">${visDato(o.dato)}</span></th>`).join('')}</tr>
      </thead>
      <tbody><tr>${kol.map((o, i) => {
        const k = elevK.get(o.id);
        const v = k ? visVaerdi(kat, k.vaerdi, o) : '';
        const kom = k?.kommentar || '';
        const titel = [erTal ? '' : v, kom].filter(Boolean).join('\n');
        return `<td class="${c(i)}${kom ? ' har-kom' : ''}${erTal ? '' : ' tekst-v'}" title="${esc(titel)}">${v ? esc(v) : '<span class="tom-v">–</span>'}</td>`;
      }).join('')}</tr></tbody>
    </table></div></div>`;
  }).join('');
  return {
    overskrift: `<h4 class="karakter-overskrift">Karakterer og vurderinger${antal ? '' : ' <small>– ingen endnu</small>'}</h4>`,
    celler,
    forklaring: harEfter ? '<p class="forklaring"><span class="streg-eks"></span>Til højre for den tykke streg: givet efter samtalen</p>' : '',
  };
}

// ---------- Klassevisning: karakterskema ----------
function htmlKlasse() {
  const { kl } = sikrValg();
  if (!kl.length) return tomTilstand('Der er endnu ingen klasser.', 'Gå til <b>Opsætning</b> og opret dine klasser og elever.');
  const klasse = find('klasser', UI.klasseId);
  const elever = eleverIKlasse(klasse.id);
  UI.klasseKategorier = UI.klasseKategorier.filter((id) => D.kategorier.some((k) => k.id === id));
  const valgte = D.kategorier.filter((k) => UI.klasseKategorier.includes(k.id));

  const nu = skoleaar(idag());
  const aarListe = [...new Set([nu, ...D.opgaver.filter((o) => o.klasseId === klasse.id).map((o) => skoleaar(o.dato))])].sort((a, b) => b - a);
  const valgtAar = UI.klasseAar === 'alle' ? 'alle' : UI.klasseAar === 'nu' || !aarListe.includes(Number(UI.klasseAar)) ? nu : Number(UI.klasseAar);
  let h = `<div class="vaelger">
    ${klasseSelect(kl)}
    <label class="inline">Skoleår <select data-act="klasse-aar">
      ${aarListe.map((a) => `<option value="${a === nu ? 'nu' : a}" ${a === valgtAar ? 'selected' : ''}>${skoleaarTekst(a)} (${klasseNavn(klasse, skoleaarStart(a))})${a === nu ? ' – nu' : ''}</option>`).join('')}
      <option value="alle" ${valgtAar === 'alle' ? 'selected' : ''}>Alle år</option>
    </select></label>
    <div class="chips"><span class="chips-label">Vis:</span>${kategoriChips('klasse-kategori', (k) => UI.klasseKategorier.includes(k.id))}</div>
  </div>`;
  if (!D.kategorier.length) return h + tomTilstand('Der er ingen karakterkategorier endnu.', 'Opret dem under <b>Opsætning</b> – f.eks. "Problemregning" og "Færdighedsregning".');
  if (!valgte.length) return h + tomTilstand('Vælg en eller flere kategorier ovenfor.');
  if (!elever.length) return h + tomTilstand('Klassen har ingen elever endnu.', 'Tilføj elever under <b>Opsætning</b>.');

  const idx = new Map(D.karakterer.map((k) => [k.elevId + '|' + k.opgaveId, k]));
  const grupper = valgte.map((kat) => {
    const opg = D.opgaver.filter((o) => o.klasseId === klasse.id && o.kategoriId === kat.id && (valgtAar === 'alle' || skoleaar(o.dato) === valgtAar)).sort(sorterOpg);
    // Del kolonnerne op i perioder (1. samtale / 2. samtale / efter)
    const perioder = [];
    for (const o of opg) {
      const noegle = skoleaar(o.dato) + '|' + o.periode;
      if (perioder.at(-1)?.noegle === noegle) perioder.at(-1).opg.push(o);
      else perioder.push({ noegle, aar: skoleaar(o.dato), periode: o.periode, opg: [o] });
    }
    return { kat, opg, perioder, skift: new Set(perioder.slice(1).map((p) => p.opg[0].id)) };
  });
  const sk = (g, o) => (g.skift.has(o.id) ? ' skift' : '');

  const r1 = grupper.map((g) => `<th class="kat" colspan="${g.opg.length + 1}">${esc(g.kat.navn)} <span class="skala">${SKALAER[g.kat.skala].navn}</span></th>`).join('');
  const r2 = grupper.map((g) => g.perioder.map((p, i) => `<th class="per${i ? ' skift' : ''}" colspan="${p.opg.length}">${PERIODER[p.periode]}${valgtAar === 'alle' ? ` <span class="per-aar">${skoleaarTekst(p.aar)}</span>` : ''}</th>`).join('')
    + `<th class="ny" rowspan="2"><button class="ny-knap" data-act="ny-opgave" data-kat="${g.kat.id}" title="Ny opgave i ${esc(g.kat.navn)}">+ Ny</button></th>`).join('');
  const r3 = grupper.map((g) => g.opg.map((o) => `<th class="opg${sk(g, o)}"><button class="opg-knap" data-act="rediger-opgave" data-id="${o.id}" title="Redigér ${esc(o.navn || 'opgave')}">
      <span class="opg-navn">${esc(o.navn || '(uden navn)')}</span>
      <span class="opg-dato">${visDato(o.dato)}${o.maks ? ` · maks ${o.maks}` : ''}</span></button></th>`).join('')).join('');

  const rows = elever.map((e) => `<tr><th class="navn" scope="row">${esc(e.navn)}</th>${grupper.map((g) =>
    g.opg.map((o) => htmlCelle(e, o, g.kat, idx.get(e.id + '|' + o.id), sk(g, o))).join('') + '<td class="ny"></td>').join('')}</tr>`).join('');

  const fod = grupper.map((g) => g.opg.map((o) => {
    const gn = gennemsnit(g.kat, elever.map((e) => idx.get(e.id + '|' + o.id)?.vaerdi));
    return `<td class="gns${sk(g, o)}" data-gns="${o.id}" title="${esc(gn.titel)}">${esc(gn.tekst)}</td>`;
  }).join('') + '<td class="ny"></td>').join('');

  const lister = valgte.filter((k) => k.skala === 'liste')
    .map((k) => `<datalist id="dl-${k.id}">${(k.vaerdier || []).map((v) => `<option value="${esc(v)}">`).join('')}</datalist>`).join('');

  return h + `<div class="grid-wrap"><table class="grid">
    <thead><tr><th class="navn hjoerne" rowspan="3">Elev <span class="antal">(${elever.length})</span></th>${r1}</tr><tr>${r2}</tr><tr>${r3}</tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><th class="navn">Klassens gennemsnit</th>${fod}</tr></tfoot>
  </table></div>${lister}
  <p class="hjaelp">Tip: Skriv en karakter og tryk <kbd>Enter</kbd> for at gå til næste elev. Klik på ✎ i et felt for at skrive en kommentar.
  Klik på en opgaves navn for at rette navn, dato, hvilken samtale den hører til, eller slette den.
  Den tykke streg adskiller opgaver til 1. samtale, 2. samtale og efter sidste samtale.</p>`;
}
function htmlCelle(elev, opg, kat, k, ekstraKlasse = '') {
  const kom = k?.kommentar || '';
  return `<td class="celle${kat.skala === 'tekst' || kat.skala === 'liste' ? ' bred' : ''}${ekstraKlasse}"><div class="celle-indre">
    <input class="celle-input" data-elev="${elev.id}" data-opg="${opg.id}" value="${esc(k ? feltVaerdi(kat, k.vaerdi) : '')}"
      ${kat.skala === 'liste' ? `list="dl-${kat.id}"` : ''} autocomplete="off" spellcheck="false"
      aria-label="${esc(elev.navn)}, ${esc(opg.navn || kat.navn)}" title="${esc(kom)}">
    <button class="kom-knap${kom ? ' har' : ''}" data-act="kommentar" data-elev="${elev.id}" data-opg="${opg.id}" tabindex="-1"
      title="${kom ? esc('Kommentar: ' + kom) : 'Tilføj kommentar'}">✎</button>
  </div></td>`;
}
function celleAendret(inp) {
  const opg = find('opgaver', inp.dataset.opg);
  const kat = find('kategorier', opg.kategoriId);
  const r = fortolk(kat, opg, inp.value);
  if (r.fejl) {
    inp.classList.add('fejl'); inp.title = r.fejl;
    toast(r.fejl, true);
    return;
  }
  inp.classList.remove('fejl');
  saetKarakter(inp.dataset.elev, opg.id, { vaerdi: r.vaerdi });
  inp.value = feltVaerdi(kat, r.vaerdi);
  inp.title = D.karakterer.find((x) => x.elevId === inp.dataset.elev && x.opgaveId === opg.id)?.kommentar || '';
  opdaterGennemsnit(opg, kat);
}
function opdaterGennemsnit(opg, kat) {
  const celle = $(`[data-gns="${opg.id}"]`);
  if (!celle) return;
  const elever = eleverIKlasse(opg.klasseId).map((e) => e.id);
  const v = D.karakterer.filter((k) => k.opgaveId === opg.id && elever.includes(k.elevId)).map((k) => k.vaerdi);
  const gn = gennemsnit(kat, v);
  celle.textContent = gn.tekst; celle.title = gn.titel;
}

// ---------- Opsætning ----------
function htmlOpsaetning() {
  const kl = sorteredeKlasser();
  sikrValg();
  const nu = skoleaar(idag());
  const elever = UI.klasseId ? eleverIKlasse(UI.klasseId) : [];
  const brugt = (katId) => D.opgaver.filter((o) => o.kategoriId === katId).length;

  return `<div class="paneler">
    <section class="panel">
      <h2>Klasser</h2>
      <p class="hjaelp">Skoleåret starter 1. <select data-act="start-maaned" aria-label="Måned">${MAANEDER.map((m, i) =>
        `<option value="${i + 1}" ${i + 1 === D.indstillinger.startMaaned ? 'selected' : ''}>${m}</option>`).join('')}</select>.
        Lige nu er det skoleåret ${skoleaarTekst(nu)}. Klassetrinnet stiger automatisk ved hvert nyt skoleår.</p>
      ${kl.length ? `<table class="liste"><thead><tr><th>Klasse</th><th>Elever</th><th></th></tr></thead><tbody>
        ${kl.map((k) => `<tr><td><b>${esc(klasseNavn(k))}</b></td><td>${D.elever.filter((e) => e.klasseId === k.id).length}</td>
          <td class="h"><button data-act="rediger-klasse" data-id="${k.id}">Redigér</button></td></tr>`).join('')}
      </tbody></table>` : '<p class="tom-felt">Ingen klasser endnu.</p>'}
      <button class="primaer" data-act="rediger-klasse">+ Ny klasse</button>
    </section>

    <section class="panel">
      <h2>Elever</h2>
      ${kl.length ? `<div class="vaelger">${klasseSelect(kl, 'vaelg-klasse')}<span class="spacer"></span>
        <button class="primaer" data-act="nye-elever">+ Tilføj elever</button></div>
        ${elever.length ? `<table class="liste"><tbody>${elever.map((e) => `<tr><td>${esc(e.navn)}</td>
          <td class="h"><button data-act="rediger-elev" data-id="${e.id}">Redigér</button></td></tr>`).join('')}</tbody></table>`
          : '<p class="tom-felt">Ingen elever i klassen endnu.</p>'}`
        : '<p class="tom-felt">Opret først en klasse.</p>'}
    </section>

    <section class="panel">
      <h2>Karakterkategorier</h2>
      <p class="hjaelp">F.eks. "Problemregning", "Færdighedsregning" eller "Mundtlighed". Hver kategori har sin egen skala.</p>
      ${D.kategorier.length ? `<table class="liste"><thead><tr><th>Navn</th><th>Skala</th><th>Opgaver</th><th></th></tr></thead><tbody>
        ${D.kategorier.map((k) => `<tr><td><b>${esc(k.navn)}</b></td>
          <td>${SKALAER[k.skala].navn}${k.skala === 'liste' ? `<div class="lille">${esc((k.vaerdier || []).join(' · '))}</div>` : ''}</td>
          <td>${brugt(k.id)}</td><td class="h"><button data-act="rediger-kategori" data-id="${k.id}">Redigér</button></td></tr>`).join('')}
      </tbody></table>` : '<p class="tom-felt">Ingen kategorier endnu.</p>'}
      <button class="primaer" data-act="rediger-kategori">+ Ny kategori</button>
    </section>

    <section class="panel">
      <h2>Datafil</h2>
      ${Fil.test ? `<p>Du kører med <b>fiktive testdata</b>. Intet bliver gemt.</p>`
        : `<p>Data gemmes i <b>${esc(Fil.navn)}</b>${Fil.handle ? ' – automatisk, hver gang du ændrer noget' : ''}.</p>`}
      <p class="hjaelp">${D.elever.length} elever · ${D.samtaler.length} samtaler · ${D.aftaler.length} aftaler · ${D.karakterer.length} karakterer</p>
      <div class="knaprk">
        <button data-act="download">Gem en backup-kopi</button>
        <button data-act="skift-fil">Åbn en anden datafil</button>
      </div>
    </section>
  </div>`;
}

// =====================================================================
//   Dialoger
// =====================================================================
function aabnDialog(titel, indhold, { slet = false, gemTekst = 'Gem', bred = false, valider, efterAabning } = {}) {
  const dlg = $('#dlg');
  dlg.className = bred ? 'bred' : '';
  dlg.innerHTML = `<form class="dlg-form" novalidate>
    <h2>${esc(titel)}</h2>
    <div class="dlg-indhold">${indhold}</div>
    <p class="dlg-fejl" hidden></p>
    <div class="dlg-knapper">
      ${slet ? '<button type="button" class="fare" data-dlg="slet">Slet</button>' : ''}
      <span class="spacer"></span>
      <button type="button" data-dlg="annuller">Annullér</button>
      <button type="submit" class="primaer">${esc(gemTekst)}</button>
    </div>
  </form>`;
  const form = $('form', dlg);
  return new Promise((res) => {
    const luk = (v) => { dlg.close(); res(v); };
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      const v = Object.fromEntries(new FormData(form));
      const fejl = valider?.(v, form);
      if (fejl) { const p = $('.dlg-fejl', form); p.textContent = fejl; p.hidden = false; return; }
      luk({ handling: 'gem', v });
    });
    $('[data-dlg=annuller]', form).onclick = () => luk(null);
    if (slet) $('[data-dlg=slet]', form).onclick = () => luk({ handling: 'slet' });
    dlg.oncancel = () => res(null);
    dlg.showModal();
    efterAabning?.(form);
    $('input:not([type=hidden]), textarea, select', form)?.focus();
  });
}
const datoFelt = (navn, v, label = 'Dato') => `<label>${label}<input type="date" name="${navn}" required value="${esc(v || idag())}"></label>`;

async function redigerSamtale(id, forslag = null) {
  const elev = find('elever', UI.elevId);
  const s = id ? find('samtaler', id) : null;
  const nu = skoleaar(idag());
  const aar = forslag?.aar ?? nu;
  const elevensI = (a) => D.samtaler.filter((x) => x.elevId === elev.id && skoleaar(x.dato) === a && x !== s);
  const nummer = s ? s.nummer : forslag?.nummer ?? ([1, 2].find((n) => !elevensI(aar).some((x) => x.nummer === n)) || 0);
  let dato = s?.dato || idag();
  if (!s && aar !== nu) { const { s1, s2 } = klassensSamtaleDatoer(elev.klasseId, aar); dato = nummer === 2 ? s2 : s1; }
  const r = await aabnDialog(s ? 'Redigér skole-hjem-samtale' : `Ny skole-hjem-samtale – ${elev.navn}`, `
    <div class="raekke">${datoFelt('dato', dato)}
      <label>Hvilken samtale<select name="nummer">${[1, 2, 0].map((n) => `<option value="${n}" ${n === nummer ? 'selected' : ''}>${SAMTALE_NAVN[n]}${n ? '' : ' (uden karakterer)'}</option>`).join('')}</select></label></div>
    <label>Titel <input name="titel" value="${esc(s?.titel || '')}" placeholder="Udfyldes automatisk, f.eks. 'Efterår 2026'"></label>
    <label class="kun-fast">Punkter at tale om<textarea name="punkter" rows="4">${esc(s?.punkter || '')}</textarea></label>
    <label><span class="noter-label">Noter fra samtalen</span><textarea name="noter" rows="4">${esc(s?.noter || '')}</textarea></label>
    <label class="kun-fast">Aftaler<textarea name="aftaler" rows="3">${esc(s?.aftaler || '')}</textarea></label>`, {
    efterAabning: (f) => {
      const sel = $('select[name=nummer]', f);
      const opdater = () => {
        const ekstra = sel.value === '0';
        $$('.kun-fast', f).forEach((el) => { el.hidden = ekstra; });
        $('.noter-label', f).textContent = ekstra ? 'Noter' : 'Noter fra samtalen';
      };
      sel.addEventListener('change', opdater); opdater();
    },
    slet: !!s, bred: true,
    valider: (v) => {
      const n = Number(v.nummer);
      return n && elevensI(skoleaar(v.dato)).some((x) => x.nummer === n)
        ? `${elev.navn} har allerede en ${SAMTALE_NAVN[n].toLowerCase()} i skoleåret ${skoleaarTekst(skoleaar(v.dato))}.` : null;
    },
  });
  if (!r) return;
  if (r.handling === 'slet') {
    if (!confirm('Slet denne skole-hjem-samtale?')) return;
    D.samtaler = D.samtaler.filter((x) => x !== s);
  } else {
    const felter = { dato: r.v.dato, nummer: Number(r.v.nummer), titel: r.v.titel.trim(), punkter: r.v.punkter.trim(), noter: r.v.noter.trim(), aftaler: r.v.aftaler.trim() };
    if (felter.nummer === 0) {
      // En ekstra samtale har kun ét tekstfelt – eventuel tekst fra de andre felter flyttes dertil
      felter.noter = [felter.punkter, felter.noter, felter.aftaler].filter(Boolean).join('\n\n');
      felter.punkter = ''; felter.aftaler = '';
    }
    if (s) Object.assign(s, felter); else D.samtaler.push({ id: uid(), elevId: elev.id, ...felter });
  }
  aendret(); render();
}

async function redigerAftale(id) {
  const elev = find('elever', UI.elevId);
  const a = id ? find('aftaler', id) : null;
  const r = await aabnDialog(a ? 'Redigér aftale' : `Ny aftale – ${elev.navn}`, `
    <div class="raekke">${datoFelt('dato', a?.dato)}
      <label>Titel <input name="titel" value="${esc(a?.titel || '')}" placeholder="F.eks. 'Telefonsamtale med mor'"></label></div>
    <label>Aftale<textarea name="tekst" rows="6">${esc(a?.tekst || '')}</textarea></label>`, { slet: !!a });
  if (!r) return;
  if (r.handling === 'slet') {
    if (!confirm('Slet denne aftale?')) return;
    D.aftaler = D.aftaler.filter((x) => x !== a);
  } else {
    const felter = { dato: r.v.dato, titel: r.v.titel.trim(), tekst: r.v.tekst.trim() };
    if (a) Object.assign(a, felter); else D.aftaler.push({ id: uid(), elevId: elev.id, ...felter });
  }
  aendret(); render();
}

async function redigerOpgave(id, kategoriId) {
  const o = id ? find('opgaver', id) : null;
  const kat = find('kategorier', o ? o.kategoriId : kategoriId);
  const klasse = find('klasser', o ? o.klasseId : UI.klasseId);
  const antal = o ? D.karakterer.filter((k) => k.opgaveId === o.id).length : 0;
  const r = await aabnDialog(o ? `Redigér opgave i ${kat.navn}` : `Ny opgave i ${kat.navn} – ${klasseNavn(klasse)}`, `
    <label>Navn på opgave / prøve<input name="navn" value="${esc(o?.navn || '')}" placeholder="F.eks. 'Terminsprøve' eller 'Kapitel 3'"></label>
    <div class="raekke">${datoFelt('dato', o?.dato)}
      ${kat.skala === 'point' ? `<label>Maks. point (valgfrit)<input name="maks" type="number" min="1" step="any" value="${esc(o?.maks || '')}"></label>` : ''}</div>
    <label>Hører til<select name="periode">${[1, 2, 3].map((p) => `<option value="${p}" ${p === (o ? o.periode : gaetPeriode(klasse.id, idag())) ? 'selected' : ''}>${PERIODER_LANG[p]}</option>`).join('')}</select></label>
    ${o ? `<p class="hjaelp">${flertal(antal, 'elev har', 'elever har')} fået karakter i denne opgave.</p>` : ''}`,
  {
    slet: !!o, gemTekst: o ? 'Gem' : 'Opret',
    efterAabning: (f) => {
      // Foreslå automatisk en periode ud fra datoen, indtil brugeren selv vælger
      let roert = !!o;
      const sel = $('select[name=periode]', f), dato = $('input[name=dato]', f);
      sel.addEventListener('change', () => { roert = true; });
      dato.addEventListener('change', () => { if (!roert && dato.value) sel.value = gaetPeriode(klasse.id, dato.value); });
    },
  });
  if (!r) return;
  if (r.handling === 'slet') {
    if (!confirm(`Slet opgaven${antal ? ` og ${flertal(antal, 'karakter', 'karakterer')}` : ''}?`)) return;
    D.opgaver = D.opgaver.filter((x) => x !== o);
    D.karakterer = D.karakterer.filter((k) => k.opgaveId !== o.id);
  } else {
    const felter = { navn: r.v.navn.trim(), dato: r.v.dato, maks: r.v.maks ? Number(r.v.maks) : null, periode: Number(r.v.periode) };
    if (o) Object.assign(o, felter);
    else { const ny = { id: uid(), klasseId: klasse.id, kategoriId: kat.id, ...felter }; D.opgaver.push(ny); id = ny.id; }
  }
  aendret(); render();
  if (r.handling === 'gem') $(`.celle-input[data-opg="${id}"]`)?.focus();
}

async function redigerKommentar(elevId, opgaveId) {
  const elev = find('elever', elevId), opg = find('opgaver', opgaveId), kat = find('kategorier', opg.kategoriId);
  const inp = $(`.celle-input[data-elev="${elevId}"][data-opg="${opgaveId}"]`);
  const k = D.karakterer.find((x) => x.elevId === elevId && x.opgaveId === opgaveId);
  const nuv = inp && !inp.classList.contains('fejl') ? inp.value : feltVaerdi(kat, k?.vaerdi);
  const r = await aabnDialog(`${elev.navn} – ${opg.navn || kat.navn}`, `
    <p class="hjaelp">${esc(kat.navn)} · ${visDato(opg.dato)} · ${SKALAER[kat.skala].navn}</p>
    <label>Karakter / vurdering<input name="vaerdi" value="${esc(nuv)}" ${kat.skala === 'liste' ? `list="dl-k"` : ''} autocomplete="off"></label>
    ${kat.skala === 'liste' ? `<datalist id="dl-k">${(kat.vaerdier || []).map((v) => `<option value="${esc(v)}">`).join('')}</datalist>` : ''}
    <label>Kommentar<textarea name="kommentar" rows="4">${esc(k?.kommentar || '')}</textarea></label>`,
  { valider: (v) => fortolk(kat, opg, v.vaerdi).fejl,
    efterAabning: (f) => setTimeout(() => $('textarea', f).focus(), 0) });
  if (!r) return;
  saetKarakter(elevId, opgaveId, { vaerdi: fortolk(kat, opg, r.v.vaerdi).vaerdi, kommentar: r.v.kommentar.trim() });
  render();
}

async function redigerKlasse(id) {
  const k = id ? find('klasser', id) : null;
  const nu = skoleaar(idag());
  const r = await aabnDialog(k ? `Redigér klasse ${klasseNavn(k)}` : 'Ny klasse', `
    <div class="raekke">
      <label>Klassetrin i ${skoleaarTekst(nu)}<input name="trin" type="number" min="0" max="10" required value="${k ? klassetrin(k) : ''}"></label>
      <label>Bogstav / navn<input name="bogstav" required maxlength="12" value="${esc(k?.bogstav || '')}" placeholder="a"></label>
    </div>
    <p class="hjaelp">Klassetrinnet stiger automatisk med ét den 1. ${MAANEDER[D.indstillinger.startMaaned - 1]}, så 7.a bliver til 8.a.</p>`,
  { slet: !!k });
  if (!r) return;
  if (r.handling === 'slet') {
    const n = D.elever.filter((e) => e.klasseId === id).length;
    if (n) { toast(`Klassen har ${flertal(n, 'elev', 'elever')}. Flyt eller slet dem først.`, true); return; }
    const opg = D.opgaver.filter((o) => o.klasseId === id).map((o) => o.id);
    if (!confirm(`Slet klassen${opg.length ? ` og dens ${flertal(opg.length, 'opgave', 'opgaver')}` : ''}?`)) return;
    D.klasser = D.klasser.filter((x) => x !== k);
    D.opgaver = D.opgaver.filter((o) => o.klasseId !== id);
    D.karakterer = D.karakterer.filter((x) => !opg.includes(x.opgaveId));
  } else {
    const felter = { trin: Number(r.v.trin), aar: nu, bogstav: r.v.bogstav.trim() };
    if (k) Object.assign(k, felter);
    else { const ny = { id: uid(), ...felter }; D.klasser.push(ny); UI.klasseId = ny.id; }
  }
  aendret(); render();
}

function klasseOptions(valgt) {
  return sorteredeKlasser().map((k) => `<option value="${k.id}" ${k.id === valgt ? 'selected' : ''}>${esc(klasseNavn(k))}</option>`).join('');
}
async function nyeElever() {
  const r = await aabnDialog('Tilføj elever', `
    <label>Klasse<select name="klasseId">${klasseOptions(UI.klasseId)}</select></label>
    <label>Navne – én elev pr. linje<textarea name="navne" rows="10" required placeholder="Fornavn Efternavn"></textarea></label>
    <p class="hjaelp">Du kan kopiere en navneliste ind fra f.eks. et regneark.</p>`, { gemTekst: 'Tilføj' });
  if (!r) return;
  const navne = r.v.navne.split('\n').map((s) => s.trim()).filter(Boolean);
  navne.forEach((navn) => D.elever.push({ id: uid(), navn, klasseId: r.v.klasseId }));
  UI.klasseId = r.v.klasseId;
  toast(`${flertal(navne.length, 'elev', 'elever')} tilføjet`);
  aendret(); render();
}
async function redigerElev(id) {
  const e = find('elever', id);
  const r = await aabnDialog(`Redigér ${e.navn}`, `
    <label>Navn<input name="navn" required value="${esc(e.navn)}"></label>
    <label>Klasse<select name="klasseId">${klasseOptions(e.klasseId)}</select></label>`, { slet: true });
  if (!r) return;
  if (r.handling === 'slet') {
    const s = D.samtaler.filter((x) => x.elevId === id).length, a = D.aftaler.filter((x) => x.elevId === id).length,
      k = D.karakterer.filter((x) => x.elevId === id).length;
    if (!confirm(`Slet ${e.navn}?\n\nDette sletter også ${flertal(s, 'samtale', 'samtaler')}, ${flertal(a, 'aftale', 'aftaler')} og ${flertal(k, 'karakter', 'karakterer')}. Det kan ikke fortrydes.`)) return;
    D.elever = D.elever.filter((x) => x !== e);
    D.samtaler = D.samtaler.filter((x) => x.elevId !== id);
    D.aftaler = D.aftaler.filter((x) => x.elevId !== id);
    D.karakterer = D.karakterer.filter((x) => x.elevId !== id);
  } else {
    e.navn = r.v.navn.trim(); e.klasseId = r.v.klasseId;
  }
  aendret(); render();
}

async function redigerKategori(id) {
  const k = id ? find('kategorier', id) : null;
  const brugt = k ? D.opgaver.some((o) => o.kategoriId === k.id) : false;
  const r = await aabnDialog(k ? `Redigér ${k.navn}` : 'Ny karakterkategori', `
    <label>Navn<input name="navn" required value="${esc(k?.navn || '')}" placeholder="F.eks. 'Problemregning'"></label>
    <label>Skala<select name="skala" ${brugt ? 'disabled' : ''}>${Object.entries(SKALAER).map(([v, s]) =>
      `<option value="${v}" ${(k?.skala || 'syvtrin') === v ? 'selected' : ''}>${s.navn}</option>`).join('')}</select></label>
    ${brugt ? '<p class="hjaelp">Skalaen kan ikke ændres, fordi kategorien allerede er brugt.</p>' : ''}
    <label class="kun-liste">Mulige vurderinger – én pr. linje<textarea name="vaerdier" rows="5" placeholder="Under forventet&#10;Som forventet&#10;Over forventet">${esc((k?.vaerdier || []).join('\n'))}</textarea></label>
    <p class="hjaelp">7-trinsskala, point og procent får udregnet gennemsnit. Egne vurderinger og fri tekst gør ikke.</p>`,
  {
    slet: !!k,
    valider: (v) => ((v.skala || k?.skala) === 'liste' && !v.vaerdier.trim() ? 'Skriv mindst én mulig vurdering.' : null),
    efterAabning: (f) => {
      const sel = $('select[name=skala]', f), felt = $('.kun-liste', f);
      const vis = () => { felt.hidden = sel.value !== 'liste'; };
      sel.addEventListener('change', vis); vis();
    },
  });
  if (!r) return;
  if (r.handling === 'slet') {
    const opg = D.opgaver.filter((o) => o.kategoriId === id).map((o) => o.id);
    const n = D.karakterer.filter((x) => opg.includes(x.opgaveId)).length;
    if (!confirm(`Slet kategorien "${k.navn}"${opg.length ? ` med ${flertal(opg.length, 'opgave', 'opgaver')} og ${flertal(n, 'karakter', 'karakterer')}` : ''}? Det kan ikke fortrydes.`)) return;
    D.kategorier = D.kategorier.filter((x) => x !== k);
    D.opgaver = D.opgaver.filter((o) => o.kategoriId !== id);
    D.karakterer = D.karakterer.filter((x) => !opg.includes(x.opgaveId));
  } else {
    const felter = {
      navn: r.v.navn.trim(),
      skala: r.v.skala || k.skala,
      vaerdier: r.v.vaerdier.split('\n').map((s) => s.trim()).filter(Boolean),
    };
    if (k) Object.assign(k, felter);
    else { const ny = { id: uid(), ...felter }; D.kategorier.push(ny); UI.klasseKategorier.push(ny.id); }
  }
  aendret(); render();
}

// =====================================================================
//   Hændelser
// =====================================================================
function toast(tekst, fejl = false) {
  const t = $('#toast');
  t.textContent = tekst; t.className = fejl ? 'fejl' : ''; t.hidden = false;
  clearTimeout(toast.timer); toast.timer = setTimeout(() => { t.hidden = true; }, fejl ? 5000 : 2500);
}
function visFejl(e) {
  if (e?.name === 'AbortError') return; // brugeren lukkede fil-vinduet
  console.error(e);
  toast(e?.message || String(e), true);
}

const HANDLINGER = {
  vis: (el) => { UI.vis = el.dataset.vis; render(); },
  'aabn-fil': aabnFil,
  'ny-fil': nyFil,
  genaabn,
  testdata: startTest,
  'afslut-test': () => { if (confirm('Afslut testtilstand? Testdata bliver ikke gemt.')) { D = null; Fil.test = false; render(); } },
  'skift-fil': async () => { if (Fil.dirty) await gemNu(); await aabnFil(); },
  'gem-igen': () => { Fil.dirty = true; return gemNu(); },
  download: () => {
    download(Fil.handle || Fil.test ? backupNavn() : Fil.navn || 'elevdata.json', JSON.stringify(D, null, 1));
    if (Fil.fallback) { Fil.dirty = false; opdaterStatus(); }
  },
  'skift-elev': (el) => {
    const el2 = eleverIKlasse(UI.klasseId);
    const i = el2.findIndex((e) => e.id === UI.elevId);
    UI.elevId = el2[(i + Number(el.dataset.retning) + el2.length) % el2.length].id;
    rulTilSlut = true; render();
  },
  rul: (el) => { const tl = $('.tidslinje'); tl.scrollBy({ left: Number(el.dataset.retning) * Math.max(300, tl.clientWidth * 0.8), behavior: 'smooth' }); },
  'ny-samtale': (el) => redigerSamtale(null, el.dataset.nummer ? { nummer: Number(el.dataset.nummer), aar: Number(el.dataset.aar) } : null),
  'rediger-samtale': (el) => redigerSamtale(el.dataset.id),
  'ny-aftale': () => redigerAftale(null),
  'rediger-aftale': (el) => redigerAftale(el.dataset.id),
  'ny-opgave': (el) => redigerOpgave(null, el.dataset.kat),
  'rediger-opgave': (el) => redigerOpgave(el.dataset.id),
  kommentar: (el) => redigerKommentar(el.dataset.elev, el.dataset.opg),
  'rediger-klasse': (el) => redigerKlasse(el.dataset.id),
  'nye-elever': nyeElever,
  'rediger-elev': (el) => redigerElev(el.dataset.id),
  'rediger-kategori': (el) => redigerKategori(el.dataset.id),
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.tagName === 'SELECT' || el.type === 'checkbox') return;
  const f = HANDLINGER[el.dataset.act];
  if (!f) return;
  e.preventDefault();
  Promise.resolve().then(() => f(el)).catch(visFejl);
});

document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.matches('.celle-input')) return celleAendret(el);
  const toggle = (liste, id) => (liste.includes(id) ? liste.filter((x) => x !== id) : [...liste, id]);
  switch (el.dataset.act) {
    case 'vaelg-klasse': UI.klasseId = el.value; UI.elevId = null; rulTilSlut = true; render(); break;
    case 'vaelg-elev': UI.elevId = el.value; rulTilSlut = true; render(); break;
    case 'elev-kategori': UI.skjulteKategorier = toggle(UI.skjulteKategorier, el.value); render(); break;
    case 'klasse-aar': UI.klasseAar = el.value; render(); break;
    case 'klasse-kategori': UI.klasseKategorier = toggle(UI.klasseKategorier, el.value); render(); break;
    case 'start-maaned': D.indstillinger.startMaaned = Number(el.value); aendret(); render(); break;
  }
});

document.addEventListener('toggle', (e) => {
  if (e.target.matches?.('details[data-filter]')) { UI.filterAaben = e.target.open; gemUI(); }
}, true);

// Tastaturnavigation i karakterskemaet: Enter / pil op / pil ned
document.addEventListener('keydown', (e) => {
  const inp = e.target;
  if (!inp.matches?.('.celle-input')) return;
  const op = e.key === 'ArrowUp' && !inp.list;
  const ned = e.key === 'Enter' || (e.key === 'ArrowDown' && !inp.list);
  if (!op && !ned) return;
  e.preventDefault();
  const kolonne = $$(`.celle-input[data-opg="${inp.dataset.opg}"]`);
  const i = kolonne.indexOf(inp);
  const maal = kolonne[i + (op ? -1 : 1)];
  if (maal) { maal.focus(); maal.select(); } else inp.blur();
});

render();
