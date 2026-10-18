// Matcher for Tilbudsvakt: avgjør om et tilbud passer til et ønske.
//
// Brukes både av den daglige sjekken (Node) og av appen i nettleseren,
// så den skal ikke ha avhengigheter.
//
// Slik løses synonymer og varianter:
//  1. Synonymgrupper: "håndkle" utvides til håndklede, håndduk, håndklær ...
//  2. Bøyninger: håndkle / håndkleet / håndklærne, teskje / teskjeer / teskjer
//  3. Sammensatte ord: "badehåndkle" og "frottéhåndkle" treffer "håndkle",
//     men "håndklestativ" gjør det ikke (på norsk er det siste leddet det
//     tingen faktisk er).
//  4. Æøå og aksenter: "handkle", "frotte" og "frotté" regnes som like.
//  5. Skrivefeil: ett feil tegn tåles i ord på seks bokstaver eller mer.
//  6. Ord som ofte gir feiltreff kan filtreres bort ("Unngå").

import { SYNONYMGRUPPER } from './synonymer.js';

const SUFFIKSER = ['ene', 'ane', 'ers', 'er', 'en', 'et', 'ar', 'a', 'e', 's'];

/** Små bokstaver, æøå og aksenter brettet ut, kun bokstaver/tall/mellomrom. */
export function brett(tekst) {
  return String(tekst ?? '')
    .toLowerCase()
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o')
    .replace(/å/g, 'a')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Deler tekst i ord. Bindestrek deler også ("bade-håndkle" -> bade, håndkle). */
export function ord(tekst) {
  const b = brett(tekst);
  return b ? b.split(' ') : [];
}

/** Enkel norsk stamme: fjerner vanlige endelser, maks to ganger. */
export function stamme(w) {
  let s = w;
  for (let runde = 0; runde < 2; runde++) {
    if (s.length < 5) break;
    const suf = SUFFIKSER.find((x) => s.endsWith(x) && s.length - x.length >= 4);
    if (!suf) break;
    s = s.slice(0, -suf.length);
  }
  return s;
}

/** Levenshtein-avstand, avbrutt tidlig når den passerer max. */
function avstand(a, b, max = 1) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    let radMin = prev[0];
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
      if (prev[j] < radMin) radMin = prev[j];
    }
    if (radMin > max) return max + 1;
  }
  return prev[b.length];
}

/**
 * Treffer ett søkeord (ett ord, brettet) et ord i tilbudsteksten?
 * Returnerer en kort grunn ("eksakt", "bøyning", "sammensatt", "skrivefeil") eller null.
 */
export function ordTreff(tilbudOrd, sokOrd) {
  const w = tilbudOrd;
  const t = sokOrd;
  if (!w || !t) return null;
  if (w === t) return 'eksakt';
  if (t.length <= 2) return null; // "te", "øl": bare eksakt

  const ws = stamme(w);
  const ts = stamme(t);
  if (ws === ts) return 'bøyning';

  // Sammensatt ord: søkeordet er siste ledd, og forleddet har minst tre bokstaver.
  const minForledd = 3;
  if ((w.endsWith(t) && w.length - t.length >= minForledd) ||
      (ws.endsWith(ts) && ts.length >= 3 && ws.length - ts.length >= minForledd)) {
    return 'sammensatt';
  }

  // Skrivefeil i lengre ord, også som siste ledd i sammensatte ord.
  if (ts.length >= 6) {
    if (avstand(ws, ts) <= 1) return 'skrivefeil';
    if (ws.length > ts.length + minForledd) {
      for (const len of [ts.length - 1, ts.length, ts.length + 1]) {
        if (avstand(ws.slice(-len), ts) <= 1) return 'skrivefeil';
      }
    }
  }
  return null;
}

/** Treffer en frase (ett eller flere ord) en tekst? Alle ordene må finnes. */
export function fraseTreff(tekst, frase) {
  const tilbudOrd = Array.isArray(tekst) ? tekst : ord(tekst);
  const sokOrd = ord(frase);
  if (!sokOrd.length) return null;
  let grunn = 'eksakt';
  for (const s of sokOrd) {
    let funnet = null;
    for (const w of tilbudOrd) {
      funnet = ordTreff(w, s);
      if (funnet) break;
    }
    if (!funnet) return null;
    if (funnet !== 'eksakt') grunn = funnet;
  }
  return grunn;
}

/** Er to enkeltord "samme ord" (for å slå opp i synonymgruppene)? */
function sammeOrd(a, b) {
  const x = brett(a);
  const y = brett(b);
  return x === y || stamme(x) === stamme(y);
}

/** Splitter en kommaliste fra brukeren. */
export function liste(tekst) {
  return String(tekst ?? '')
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Lager søkeplan for et ønske.
 * @param {object} onske { tittel, ekstra: string[], unnga: string[], egneGrupper?: array }
 * @returns {{ termer: string[], unnga: string[], grupper: string[][] }}
 */
export function utvid(onske, grupper = SYNONYMGRUPPER) {
  const tittel = String(onske.tittel ?? '').trim();
  const termer = new Map(); // brettet -> originalform
  const unnga = new Map();
  const brukteGrupper = [];
  const leggTil = (m, s) => {
    const k = brett(s);
    if (k && !m.has(k)) m.set(k, s.trim().toLowerCase());
  };

  const fraser = [tittel, ...(onske.ekstra ?? [])].filter(Boolean);
  for (const frase of fraser) {
    leggTil(termer, frase);
    const deler = frase.trim().split(/\s+/);
    const hode = deler[deler.length - 1];
    const forledd = deler.slice(0, -1).join(' ');

    for (const g of grupper) {
      // Hele frasen eller hodeordet (siste ord) finnes i gruppen.
      const helFrase = g.ord.some((o) => brett(o) === brett(frase));
      const hodeTreff = g.ord.some((o) => !o.includes(' ') && sammeOrd(o, hode));
      if (!helFrase && !hodeTreff) continue;
      brukteGrupper.push(g.ord);
      for (const o of g.ord) {
        // "blå håndkle" -> "blå håndklede", "blå håndduk" ...
        leggTil(termer, helFrase || !forledd ? o : `${forledd} ${o}`);
      }
      for (const u of g.ikke ?? []) leggTil(unnga, u);
    }
  }
  for (const u of onske.unnga ?? []) leggTil(unnga, u);

  // Et ord brukeren selv har skrevet skal aldri filtreres bort.
  for (const k of termer.keys()) unnga.delete(k);

  return { termer: [...termer.values()], unnga: [...unnga.values()], grupper: brukteGrupper };
}

/**
 * Sjekker om en tilbudstekst passer til en søkeplan.
 * @returns {null | { term: string, grunn: string }}
 */
export function passer(tekst, plan) {
  const tilbudOrd = ord(tekst);
  if (!tilbudOrd.length) return null;
  for (const u of plan.unnga) {
    if (fraseTreff(tilbudOrd, u)) return null;
  }
  for (const term of plan.termer) {
    const grunn = fraseTreff(tilbudOrd, term);
    if (grunn) return { term, grunn };
  }
  return null;
}

/**
 * Leser et ønske fra et GitHub-issue.
 * Tittel = det du trenger. Brødtekst kan ha linjer som:
 *   Makspris: 200
 *   Andre ord: frotté, badelaken
 *   Unngå: papir, rull
 *   Butikker: Europris, Jula
 */
export function lesOnske(issue) {
  const body = String(issue.body ?? '');
  const felt = (navn) => {
    const re = new RegExp(`^\\s*(?:${navn})\\s*:\\s*(.*)$`, 'im');
    const m = body.match(re);
    return m ? m[1].trim() : '';
  };
  const pris = parseFloat(felt('makspris|maks pris|max price|maxpris').replace(',', '.').replace(/[^0-9.]/g, ''));
  return {
    nr: issue.number,
    tittel: String(issue.title ?? '').replace(/^\s*(ønske|onske)\s*:\s*/i, '').trim(),
    makspris: Number.isFinite(pris) && pris > 0 ? pris : null,
    ekstra: liste(felt('andre ord|ekstra ord|synonymer|also|other words')),
    unnga: liste(felt('unngå|unnga|ikke|avoid|exclude')),
    butikker: liste(felt('butikker|butikk|stores')),
    url: issue.html_url ?? null,
  };
}

/** Passer butikknavnet med brukerens butikkfilter (tomt filter = alle). */
export function butikkOk(butikk, filter) {
  if (!filter?.length) return true;
  const b = brett(butikk);
  return filter.some((f) => {
    const x = brett(f);
    return x && (b.includes(x) || x.includes(b));
  });
}
