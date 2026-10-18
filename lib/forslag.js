// Forslag til flere søkeord for et ønske, rangert med de mest sannsynlige først.
//
// Kilder og vekt (høyere = mer sannsynlig at det er det samme som du ønsker deg):
//   ordbok     – synonymer fra Wiktionary og ConceptNet          (100, «beslektet» i ConceptNet 40–70)
//   beslektet  – nabogrupper i Tilbudsvakts egen synonymliste       (60)
// (Ord hentet fra tilbudstitler ble prøvd, men ga for mye støy – merkenavn og andre varer.)
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
  matt blank glatt myk myke tykk tynn rund runde firkantet enkel dobbel inkl inklusive fargevalg flott fine pent
  sort sortiment kommer snart velg velges diverse ulike
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

// Kjente enkeltord (stammer) fra synonymlisten, brukt til å finne siste ledd i sammensatte ord.
const KJENTE = new Set(SYNONYMGRUPPER.flatMap((g) => g.ord).filter((o) => !o.includes(' '))
  .flatMap((o) => [brett(o), stamme(brett(o))]).filter((o) => o.length >= 4));

/** Siste ledd i et sammensatt ord, hvis det er et kjent ord: "teskje" -> "skje", "ved" -> null. */
function hode(w) {
  for (const b of [brett(w), stamme(brett(w))]) {
    for (let i = 2; i <= b.length - 4; i++) {
      if (KJENTE.has(b.slice(i))) return b.slice(i);
    }
  }
  return null;
}

/**
 * Ord fra nabogrupper i synonymlisten, med poeng:
 *  60 – gruppen deler et ord med ønskets grupper (badelaken -> strandlaken)
 *  45 – gruppen har samme siste ledd (teskje -> spiseskje, suppeskje)
 *  80 – lært fra dine egne ønsker («Andre ord» du har lagt til tidligere)
 */
export function beslektet(plan, grupper = SYNONYMGRUPPER, laerte = []) {
  const brukte = new Set(plan.grupper.flat().map(brett));
  // Bare ønsket selv (ikke hele synonymgruppen), ellers blir det for løse koblinger.
  const egne = [plan.termer[0], ...plan.termer.slice(1).filter((t) => !plan.grupper.flat().includes(t))];
  const hoder = new Set(egne.map(hode).filter(Boolean));
  const ut = new Map();
  const legg = (o, p, kilde) => {
    if (dekket(o, plan)) return;
    const k = brett(o);
    const f = ut.get(k);
    if (!f || f.poeng < p) ut.set(k, { ord: o, poeng: p, kilde });
  };
  for (const g of laerte) {
    if (g.some((o) => brukte.has(brett(o)) || plan.termer.some((t) => brett(t) === brett(o)))) {
      for (const o of g) legg(o, 80, 'laert');
    }
  }
  for (const g of grupper) {
    if (plan.grupper.includes(g.ord)) continue;
    if (g.ord.some((o) => brukte.has(brett(o)))) {
      for (const o of g.ord) legg(o, 60, 'beslektet');
    } else if (hoder.size) {
      for (const o of g.ord) {
        const bs = [brett(o), stamme(brett(o))];
        if ([...hoder].some((h) => bs.some((b) => b.endsWith(h) && b.length > h.length + 1))) legg(o, 45, 'beslektet');
      }
    }
  }
  return [...ut.values()].sort((a, b) => b.poeng - a.poeng);
}

/** Bygger «lærte» synonymgrupper fra ønskene: tittel + Andre ord. */
export function laerFraOnsker(onsker) {
  return onsker
    .filter((o) => o.ekstra?.length)
    .map((o) => [o.tittel, ...o.ekstra].map((x) => x.toLowerCase()));
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
export function rangerForslag({ plan, ordbok = [], avviste = [], laerte = [] }, maks = 12) {
  const alle = new Map();
  const leggTil = (ord, poeng, kilde) => {
    if (dekket(ord, plan)) return;
    const k = brett(ord);
    const f = alle.get(k) ?? { ord: ord.toLowerCase(), poeng: 0, kilder: [] };
    f.poeng += poeng;
    if (!f.kilder.includes(kilde)) f.kilder.push(kilde);
    alle.set(k, f);
  };
  for (const o of ordbok) {
    if (typeof o === 'string') leggTil(o, VEKT.ordbok, 'ordbok');
    else leggTil(o.ord, o.poeng ?? VEKT.ordbok, 'ordbok');
  }
  for (const o of beslektet(plan, SYNONYMGRUPPER, laerte)) leggTil(o.ord, o.poeng, o.kilde);
  void avviste; // beholdt i signaturen; se kommentar øverst
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

/** Synonymer og beslektede ord fra ConceptNet (gratis, ingen nøkkel). */
export async function hentConceptNet(ord, hent = fetch) {
  const ut = [];
  try {
    const node = `/c/no/${encodeURIComponent(ord.trim().toLowerCase().replace(/ /g, '_'))}`;
    const r = await hent(`https://api.conceptnet.io/query?node=${node}&other=/c/no&limit=60`, { signal: AbortSignal.timeout(12000) });
    if (!r.ok) return ut;
    const data = await r.json();
    for (const e of data.edges ?? []) {
      const rel = e.rel?.label;
      const annen = [e.start, e.end].find((n) => n?.language === 'no' && !n['@id']?.startsWith(node));
      const navn = annen?.label?.toLowerCase();
      if (!navn || navn.includes(':')) continue;
      if (rel === 'Synonym') ut.push({ ord: navn, poeng: 100 });
      else if (rel === 'RelatedTo' || rel === 'SimilarTo') ut.push({ ord: navn, poeng: Math.min(70, 40 + Math.round((e.weight ?? 1) * 10)) });
    }
  } catch { /* bare en bonus */ }
  return ut;
}

/** Alle ordbokkilder samlet. */
export async function hentOrdboker(ord, hent = fetch) {
  const [w, c] = await Promise.all([hentOrdbok(ord, hent), hentConceptNet(ord, hent)]);
  return { liste: [...w, ...c], status: { wiktionary: w.length, conceptnet: c.length } };
}
