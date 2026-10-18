// Gjør svar fra tilbudskildene om til ett felles format, og finner treff for et ønske.
// Brukes både av den planlagte sjekken (Node) og av appen (umiddelbar sjekk).

import { passer, butikkOk, butikkBlokkert } from './matcher.js';
import { slaSammen, tynn } from './historikk.js';

export const RABATT_GRENSE = 0.9;   // Kassalapp: minst 10 % under nylig pris
export const HISTORIKK_DAGER = 60;

/** eTilbudsavis/Tjek: kundeavis-tilbud i Norge. */
export function fraTjek(raa) {
  return (Array.isArray(raa) ? raa : [])
    .filter((o) => !o.dealer?.country?.id || o.dealer.country.id === 'NO')
    .map((o) => ({
      kilde: 'tjek',
      id: `tjek:${o.id}`,
      tittel: o.heading ?? '',
      butikk: o.dealer?.name ?? o.branding?.name ?? 'Ukjent butikk',
      pris: o.pricing?.price ?? null,
      forpris: o.pricing?.pre_price ?? null,
      fra: o.run_from ?? null,
      til: o.run_till ?? null,
      bilde: o.images?.view ?? o.images?.thumb ?? null,
      lenke: o.images?.zoom ?? o.images?.view ?? o.dealer?.website ?? null,
      merknad: 'Kundeavis',
    }));
}

/** Kassalapp: dagligvarer med prishistorikk. */
export function fraKassal(raa) {
  const ut = [];
  for (const v of raa?.data ?? []) {
    const pris = typeof v.current_price === 'object' ? v.current_price?.price : v.current_price;
    if (!Number.isFinite(pris) || pris <= 0) continue;
    ut.push({
      kilde: 'kassalapp',
      id: `kassal:${v.id}`,
      ean: v.ean ?? null,
      tittel: v.name ?? '',
      butikk: v.store?.name ?? 'Ukjent butikk',
      pris,
      forpris: null,
      fra: null,
      til: null,
      bilde: v.image ?? null,
      lenke: v.url ?? null,
      merknad: '',
      historikk: (v.price_history ?? []).map((h) => [String(h.date).slice(0, 10), Number(h.price)]),
    });
  }
  return ut;
}

/**
 * Er en Kassalapp-pris et tilbud? Sammenligner med høyeste pris siste 60 dager.
 * egen = ekstra historikk [[dato, pris], ...] (fra tidligere sjekker), valgfri.
 */
export function vurderKassal(t, nå = new Date(), egen = []) {
  const idag = nå.toISOString().slice(0, 10);
  const grense = new Date(nå.getTime() - HISTORIKK_DAGER * 864e5).toISOString().slice(0, 10);
  const tidligere = [...(t.historikk ?? []), ...egen]
    .filter(([d, p]) => d >= grense && Number.isFinite(p) && p > 0 && !(d >= idag && p === t.pris))
    .map(([, p]) => p);
  if (!tidligere.length) return false;
  const høyest = Math.max(...tidligere);
  if (t.pris <= høyest * RABATT_GRENSE) {
    t.forpris = høyest;
    t.merknad = `Ned ${Math.round((1 - t.pris / høyest) * 100)} % siste ${HISTORIKK_DAGER} dager`;
    return true;
  }
  return false;
}

/** Filtrerer en liste tilbud mot et ønske og en søkeplan. Returnerer treff sortert på pris, uten duplikater. */
export function finnTreff(tilbud, onske, plan, { nå = new Date(), historikk = null, avviste = null, blokkert = [] } = {}) {
  const funn = new Map();
  for (const t0 of tilbud) {
    if (funn.has(t0.id)) continue;
    if (t0.til && new Date(t0.til) < nå) continue;
    if (!butikkOk(t0.butikk, onske.butikker)) continue;
    if (butikkBlokkert(t0.butikk, blokkert)) continue;
    if (onske.makspris && t0.pris != null && t0.pris > onske.makspris) continue;
    const m = passer(t0.tittel, plan);
    if (!m) { if (avviste && avviste.length < 400) avviste.push({ tittel: t0.tittel, butikk: t0.butikk }); continue; }
    const t = { ...t0 };
    if (t.kilde === 'kassalapp' && !vurderKassal(t, nå, historikk?.[t.id] ?? [])) continue;
    if (t.kilde === 'kassalapp') t.spor = tynn(slaSammen(t.historikk, historikk?.[t.id]));
    delete t.historikk;
    funn.set(t.id, { ...t, traff: m.term, grunn: m.grunn });
  }
  // Samme vare i samme butikk til samme pris kommer ofte fra flere aviser: vis den én gang.
  const unike = new Map();
  for (const t of funn.values()) {
    const k = `${t.tittel.toLowerCase().replace(/\s+/g, ' ').trim()}|${t.butikk.toLowerCase()}|${t.pris}`;
    if (!unike.has(k)) unike.set(k, t);
  }
  return [...unike.values()].sort((a, b) => (a.pris ?? 1e9) - (b.pris ?? 1e9));
}
