// Forslag til flere søkeord for et ønske, rangert med de mest sannsynlige først.
//
// Kilder og vekt (høyere = mer sannsynlig at det er det samme som du ønsker deg):
//   ordbok     – synonymer fra Wiktionary                         (100)
//   beslektet  – nabogrupper i Tilbudsvakts egen synonymliste       (60)
//   tilbud     – ord som går igjen i tilbud søket fant, men som
//                ikke traff ønsket ditt. Flere butikker = sterkere. (opptil ~80)
// Ord som allerede søkes på, ord du vil unngå og fyllord tas aldri med.

import { SYNONYMGRUPPER } from './synonymer.js';
import { brett, stamme, fraseTreff } from './matcher.js';

// Fyllord som går igjen i tilbudstitler uten å si hva varen er.
const STOPP = new Set(`
  pakke pakk stykk stykker sett liter gram kilo pris priser tilbud kjøp kjop ekstra stor store liten lite
  små sma nye flere farger farge fargen størrelse størrelser storrelse valgfri valgfritt utvalgte utvalgt gjelder
  mange varianter variant økologisk okologisk original classic premium mini maxi uten eller også ogsa
  laget norsk norge size medium large small pack with från fra eller ellers samme andre annen annet
  hvit hvite svart svarte sort sorte grå gra blå bla blått rød rod røde grønn gronn grønne gul gule rosa beige
  brun brune lilla oransje natur naturell mørkeblå lyseblå mørk lys mørkegrå lysegrå antrasitt sand
  bomull polyester mikrofiber cotton organic kammet egyptisk gots sertifisert sertifisering
  kvalitet kvalitets klassisk ekte frisk ferske ferskt fersk beste best god gode godt vanlig vanlige
  ukens uke ukas dagens helg helgens medlem medlemspris trumf kampanje kampanjepris spar sparer
  pose poser boks bokser flaske flasker kartong glass beger brett stk pk pkt
`.trim().split(/\s+/).map(brett));

const VEKT = { ordbok: 100, beslektet: 60 };

/** Allerede dekket av søket (synonym, bøyning, sammensatt) eller filtrert bort? */
function dekket(ordet, plan) {
  const b = brett(ordet);
  if (!b || STOPP.has(b) || STOPP.has(stamme(b))) return true;
  if (plan.termer.some((t) => fraseTreff([b], t))) return true;
  if (plan.unnga.some((u) => fraseTreff([b], u))) return true;
  return false;
}

/** Ord fra synonymgrupper som deler minst ett ord med gruppene ønsket brukte. */
export function beslektet(plan, grupper = SYNONYMGRUPPER) {
  const brukte = new Set(plan.grupper.flat().map(brett));
  const ut = [];
  for (const g of grupper) {
    if (plan.grupper.includes(g.ord)) continue;
    if (!g.ord.some((o) => brukte.has(brett(o)))) continue;
    for (const o of g.ord) if (!dekket(o, plan)) ut.push(o);
  }
  return ut;
}

/**
 * Ord fra tilbud søket returnerte men som ikke traff ønsket.
 * @param {{tittel:string, butikk:string}[]} avviste
 */
export function fraTilbud(avviste, plan) {
  const tellere = new Map(); // brettet -> { ord, titler:Set, butikker:Set, hode:number }
  for (const { tittel, butikk } of avviste) {
    const ordene = String(tittel).toLowerCase().split(/[^a-zæøåéèüäö]+/i).filter(Boolean);
    ordene.forEach((w, i) => {
      if (w.length < 4 || w.length > 24 || dekket(w, plan)) return;
      const k = brett(w);
      const t = tellere.get(k) ?? { ord: w, titler: new Set(), butikker: new Set(), hode: 0 };
      t.titler.add(brett(tittel));
      t.butikker.add(brett(butikk));
      // Siste ord i en kort tittel er ofte selve varen ("KARLSTAD håndkle").
      if (i === ordene.length - 1 && ordene.length <= 4) t.hode++;
      tellere.set(k, t);
    });
  }
  return [...tellere.values()]
    .map((t) => ({
      ord: t.ord,
      poeng: Math.min(80, t.butikker.size * 12 + t.titler.size * 3 + t.hode * 10),
      butikker: t.butikker.size,
    }))
    // Ett enkelt tilbud i én butikk er for tynt til å foreslå.
    .filter((t) => t.butikker >= 2);
}

/** Slår sammen kildene og sorterer med de mest sannsynlige først. */
export function rangerForslag({ plan, ordbok = [], avviste = [] }, maks = 12) {
  const alle = new Map();
  const leggTil = (ord, poeng, kilde) => {
    if (dekket(ord, plan)) return;
    const k = brett(ord);
    const f = alle.get(k) ?? { ord: ord.toLowerCase(), poeng: 0, kilder: [] };
    f.poeng += poeng;
    if (!f.kilder.includes(kilde)) f.kilder.push(kilde);
    alle.set(k, f);
  };
  for (const o of ordbok) leggTil(o, VEKT.ordbok, 'ordbok');
  for (const o of beslektet(plan)) leggTil(o, VEKT.beslektet, 'beslektet');
  for (const o of fraTilbud(avviste, plan)) leggTil(o.ord, o.poeng, 'tilbud');
  return [...alle.values()]
    .sort((a, b) => b.poeng - a.poeng || a.ord.localeCompare(b.ord, 'nb'))
    .slice(0, maks);
}

/** Henter synonymer fra norsk Wiktionary (gratis, ingen nøkkel). */
export async function hentOrdbok(ord, hent = fetch) {
  const ut = new Set();
  for (const side of new Set([ord.trim().toLowerCase(), ord.trim()])) {
    try {
      const r = await hent(`https://no.wiktionary.org/wiki/${encodeURIComponent(side.replace(/ /g, '_'))}?action=raw`, {
        headers: { 'User-Agent': 'tilbudsvakt (https://github.com/khalm/tilbudsvakt)' },
        signal: AbortSignal.timeout(10000),
      });
      if (!r.ok) continue;
      const tekst = await r.text();
      // Seksjoner som "====Synonymer====" frem til neste overskrift.
      const re = /=+\s*Synonym(?:er)?\s*=+([\s\S]*?)(?=\n=|$)/gi;
      let m;
      while ((m = re.exec(tekst))) {
        for (const l of m[1].matchAll(/\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]|\{\{l\|[^|}]+\|([^|}]+)/g)) {
          const s = (l[1] ?? l[2] ?? '').trim();
          if (s && s.toLowerCase() !== ord.toLowerCase() && !s.includes(':')) ut.add(s.toLowerCase());
        }
      }
      if (ut.size) break;
    } catch { /* Wiktionary er bare en bonus */ }
  }
  return [...ut];
}
