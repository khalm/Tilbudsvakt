// Planlagt tilbudssjekk for Tilbudsvakt. Kjøres av GitHub Actions.
//
// 1. Henter alle ønskelister fra Tilbudsvakt-Worker-en (Cloudflare).
// 2. Søker etter hvert ønske og synonymene i eTilbudsavis/Tjek (kundeaviser)
//    og Kassalapp (dagligvarer med prishistorikk).
// 3. Sjekker treffene med matcheren (synonymer, bøyninger, sammensatte ord).
// 4. Lagrer funn per bruker i Worker-en, som appen viser.
// 5. Sender push-varsel om nye tilbud til brukerens telefoner.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { utvid, passer, brett } from '../lib/matcher.js';
import { fraTjek, fraKassal, finnTreff, HISTORIKK_DAGER } from '../lib/tilbud.js';
import { rangerForslag, hentOrdboker, laerFraOnsker } from '../lib/forslag.js';
import { leggTil as leggTilSpor, tynn } from '../lib/historikk.js';

const VERSJON = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).version;
const KONFIG = JSON.parse(await readFile(new URL('../config.json', import.meta.url), 'utf8').catch(() => '{}'));
const API = (process.env.API_URL || KONFIG.api || '').replace(/\/$/, '');
const APP_URL = KONFIG.app || `${API}/`;
const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN ?? '';
const ADMIN_KEY = CF_TOKEN ? createHash('sha256').update(`${CF_TOKEN}:tilbudsvakt-admin`).digest('hex') : '';
const KASSAL_KEY = process.env.KASSALAPP_API_KEY ?? '';
const NTFY_TOPIC = process.env.NTFY_TOPIC ?? '';
const VAPID_PRIVAT = process.env.VAPID_PRIVATE_KEY ?? '';
const VAPID_OFFENTLIG = 'BD4V-Tm80lC4uIXUJ_koeqn-lyBNACrFxrvVBZSf_QxNlCTKCwffEe3KX0XwahBFQcLGMPXw3tKtspT6z_YJrCs';
const TESTSOK = (process.env.TESTSOK ?? '').trim();
const MAKS_TERMER = 10; // søk per ønske og kilde

const DATA = new URL('../data/', import.meta.url);
const nå = new Date();
const idag = nå.toISOString().slice(0, 10);
const vent = (ms) => new Promise((r) => setTimeout(r, ms));

async function lesJson(navn, standard) {
  try { return JSON.parse(await readFile(new URL(navn, DATA), 'utf8')); } catch { return standard; }
}
async function skrivJson(navn, data) {
  await mkdir(DATA, { recursive: true });
  await writeFile(new URL(navn, DATA), JSON.stringify(data, null, 2) + '\n');
}

async function hent(url, opts = {}, forsok = 3) {
  for (let i = 0; i < forsok; i++) {
    try {
      const r = await fetch(url, { ...opts, signal: AbortSignal.timeout(25000) });
      if (r.status === 429 || r.status >= 500) throw new Error(`HTTP ${r.status}`);
      if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`), { endelig: true });
      return r.status === 204 ? null : await r.json();
    } catch (e) {
      if (e.endelig || i === forsok - 1) throw e;
      await vent(1500 * 2 ** i);
    }
  }
}

// ---------- Worker (ønskelister og funn) ----------
const worker = (sti, opts = {}) => hent(`${API}/api/admin/${sti}`, {
  ...opts,
  headers: { Authorization: `Bearer ${ADMIN_KEY}`, 'Content-Type': 'application/json', ...(opts.headers ?? {}) },
});

// ---------- Kilder (mellomlagret, så like søk fra flere brukere bare gjøres én gang) ----------
const kilder = {
  tjek: { status: 'ok', navn: 'eTilbudsavis (kundeaviser)' },
  kassalapp: { status: KASSAL_KEY ? 'ok' : 'mangler nøkkel', navn: 'Kassalapp (dagligvarer)' },
};
const sokCache = new Map();
async function sok(term) {
  const k = brett(term);
  if (sokCache.has(k)) return sokCache.get(k);
  const ut = [];
  try {
    const p = new URLSearchParams({ query: term, country_id: 'NO', limit: '100' });
    ut.push(...fraTjek(await hent(`https://api.etilbudsavis.dk/v2/offers/search?${p}`, { headers: { 'User-Agent': 'tilbudsvakt' } })));
  } catch (e) { kilder.tjek.status = `feil: ${e.message}`; console.warn('Tjek:', term, e.message); }
  if (KASSAL_KEY) {
    try {
      const p = new URLSearchParams({ search: term, size: '100' });
      ut.push(...fraKassal(await hent(`https://kassal.app/api/v1/products?${p}`, {
        headers: { Authorization: `Bearer ${KASSAL_KEY}`, Accept: 'application/json', 'User-Agent': 'tilbudsvakt' },
      })));
    } catch (e) { kilder.kassalapp.status = `feil: ${e.message}`; console.warn('Kassalapp:', term, e.message); }
    await vent(1100); // gratisnøkkel: 60 kall i minuttet
  } else {
    await vent(150);
  }
  sokCache.set(k, ut);
  return ut;
}

// ---------- Varsler ----------
const kr = (n) => (n == null ? '' : `${Number(n).toFixed(2).replace('.', ',').replace(',00', ',-')} kr`);

let webpush = null;
async function pushKlar() {
  if (!VAPID_PRIVAT) return false;
  if (!webpush) {
    try {
      webpush = (await import('web-push')).default;
      webpush.setVapidDetails('mailto:tilbudsvakt@users.noreply.github.com', VAPID_OFFENTLIG, VAPID_PRIVAT);
    } catch (e) { console.warn('web-push mangler:', e.message); return false; }
  }
  return true;
}

async function sendPush(bruker, data) {
  if (!(await pushKlar())) return 0;
  let sendt = 0;
  for (const [nokkel, a] of Object.entries(bruker.push ?? {})) {
    try {
      await webpush.sendNotification(a.sub, JSON.stringify(data), { TTL: 24 * 3600, urgency: 'high' });
      sendt++;
    } catch (e) {
      console.warn('Push feilet:', e.statusCode ?? e.message);
      if (e.statusCode === 404 || e.statusCode === 410) {
        await worker(`push/${bruker.id}/${encodeURIComponent(nokkel)}`, { method: 'DELETE' }).catch(() => {});
      }
    }
  }
  return sendt;
}

async function varsle(bruker, onske, nye) {
  if (!nye.length) return;
  const perButikk = {};
  const utvalg = nye.filter((t) => (perButikk[t.butikk] = (perButikk[t.butikk] ?? 0) + 1) <= 2);
  const b = nye[0];
  await sendPush(bruker, {
    tittel: `${nye.length === 1 ? 'Tilbud' : `${nye.length} tilbud`} på ${onske.tittel}`,
    tekst: utvalg.slice(0, 3).map((t) => `${t.tittel} – ${t.butikk} ${kr(t.pris)}`).join('\n'),
    bilde: b.bilde ?? undefined,
    url: APP_URL,
    tag: `onske-${onske.id}`,
  });
  if (NTFY_TOPIC) {
    await hent('https://ntfy.sh/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: NTFY_TOPIC, title: `Tilbud: ${onske.tittel}`, click: APP_URL, tags: ['moneybag'],
        message: utvalg.slice(0, 5).map((t) => `${t.tittel} – ${t.butikk} ${kr(t.pris)}`).join('\n'),
        ...(b.bilde ? { attach: b.bilde } : {}),
      }),
    }, 2).catch((e) => console.warn('ntfy feilet:', e.message));
  }
}

// ---------- Ett ønske ----------
async function sjekkOnske(onske, laerte, historikk, blokkert = [], prisspor = {}) {
  const plan = utvid(onske);
  const termer = plan.termer.slice(0, MAKS_TERMER);
  const alle = [];
  for (const term of termer) alle.push(...(await sok(term)));

  // Egen prishistorikk for dagligvarer som passer ønsket (én verdi per dag).
  const grense = new Date(nå.getTime() - HISTORIKK_DAGER * 864e5).toISOString().slice(0, 10);
  for (const t of alle) {
    if (t.kilde !== 'kassalapp' || !passer(t.tittel, plan)) continue;
    const kart = new Map((historikk[t.id] ?? []).filter(([d]) => d >= grense));
    if (!kart.has(idag)) kart.set(idag, t.pris);
    historikk[t.id] = [...kart.entries()].sort();
  }
  const avviste = [];
  const funn = finnTreff(alle, onske, plan, { nå, historikk, avviste, blokkert });
  // Kundeavis-tilbud har ingen historikk i kilden, så Tilbudsvakt fører sin egen (per vare og butikk).
  for (const t of funn) {
    if (t.kilde !== 'tjek' || t.pris == null) continue;
    const k = `${brett(t.tittel)}|${brett(t.butikk)}`;
    prisspor[k] = leggTilSpor(prisspor[k], idag, t.pris, 365);
    t.spor = tynn(prisspor[k]);
  }
  const { liste: ordbok, status: ordbokStatus } = plan.eksakt ? { liste: [], status: {} } : await hentOrdboker(onske.tittel);
  const forslag = plan.eksakt ? [] : rangerForslag({ plan, ordbok, avviste, laerte: laerte.filter((g) => brett(g[0]) !== brett(onske.tittel)) });
  return { plan, termer, funn, forslag, ordbok, ordbokStatus };
}

// ---------- Hovedløp ----------
async function main() {
  const historikk = await lesJson('historikk.json', {});
  const prisspor = await lesJson('prisspor.json', {});

  if (TESTSOK) {
    const r = await sjekkOnske({ id: 'test', tittel: TESTSOK, ekstra: [], unnga: [], fjern: [], butikker: [] }, [], historikk);
    console.log(`Testsøk «${TESTSOK}»: ${r.funn.length} treff – søkte på ${r.termer.join(', ')}`);
    await skrivJson('testsok.json', {
      sok: TESTSOK, tid: nå.toISOString(), kilder, termer: r.plan.termer, unnga: r.plan.unnga,
      ordbok: r.ordbok, ordbokStatus: r.ordbokStatus, forslag: r.forslag, funn: r.funn,
    });
    return;
  }

  if (!API || !ADMIN_KEY) {
    console.log('Appen er ikke publisert ennå (mangler config.json eller CLOUDFLARE_API_TOKEN). Hopper over.');
    return;
  }
  const brukere = await worker('brukere');
  const sett = await lesJson('sett.json', {});
  console.log(`${brukere.length} brukere, ${brukere.reduce((n, b) => n + b.onsker.length, 0)} ønsker.`);

  for (const bruker of brukere) {
    const laerte = laerFraOnsker(bruker.onsker);
    const resultat = [];
    for (const onske of bruker.onsker) {
      const r = await sjekkOnske(onske, laerte, historikk, bruker.blokkert ?? [], prisspor);
      const prefiks = `${bruker.id}|${onske.id}|`;
      // Første sjekk av et ønske varsler ikke: treffene ble vist i appen da ønsket ble lagt til.
      const forsteSjekk = !sett[`${prefiks}*`];
      const nye = r.funn.filter((t) => !sett[`${prefiks}${t.id}|${t.pris}`]);
      for (const t of r.funn) sett[`${prefiks}${t.id}|${t.pris}`] ??= idag;
      sett[`${prefiks}*`] = idag;
      if (!forsteSjekk) await varsle(bruker, onske, nye);
      console.log(`${bruker.id.slice(0, 6)} «${onske.tittel}»: ${r.funn.length} treff (${forsteSjekk ? 'første sjekk' : `${nye.length} nye`})`);
      resultat.push({ id: onske.id, tittel: onske.tittel, termer: r.plan.termer, unnga: r.plan.unnga, forslag: r.forslag, funn: r.funn });
    }
    await worker(`funn/${bruker.id}`, {
      method: 'PUT',
      body: JSON.stringify({ versjon: VERSJON, oppdatert: nå.toISOString(), kilder, laerte, onsker: resultat }),
    }).catch((e) => console.warn('Lagring av funn feilet:', e.message));
  }

  // Rydd: glem varsler eldre enn 60 dager og historikk for produkter vi ikke følger lenger.
  const grense = new Date(nå.getTime() - HISTORIKK_DAGER * 864e5).toISOString().slice(0, 10);
  for (const [k, d] of Object.entries(sett)) if (d < grense) delete sett[k];
  for (const [k, v] of Object.entries(historikk)) if (!v.length || v[v.length - 1][0] < grense) delete historikk[k];
  await skrivJson('sett.json', sett);
  await skrivJson('historikk.json', historikk);
  const sporGrense = new Date(nå.getTime() - 365 * 864e5).toISOString().slice(0, 10);
  for (const [k, v] of Object.entries(prisspor)) if (!v.length || v[v.length - 1][0] < sporGrense) delete prisspor[k];
  await skrivJson('prisspor.json', prisspor);
}

main().catch((e) => { console.error(e); process.exit(1); });
