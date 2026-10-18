// Daglig tilbudssjekk for Tilbudsvakt. Kjøres av GitHub Actions.
//
// 1. Leser ønskelisten (åpne issues med etiketten "ønske").
// 2. Søker etter hvert ønske og alle synonymene i:
//    - eTilbudsavis/Tjek (kundeaviser: dagligvare, Europris, Jula, Clas Ohlson ...)
//    - Kassalapp (dagligvarer med prishistorikk, krever gratis API-nøkkel)
// 3. Sjekker hvert treff med matcheren (synonymer, bøyninger, sammensatte ord).
// 4. Skriver data/funn.json som appen viser.
// 5. Varsler om nye tilbud: kommentar på ønsket (push i GitHub-appen)
//    og eventuelt ntfy hvis NTFY_TOPIC er satt.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { utvid, passer, lesOnske, butikkOk, liste as kommaliste, brett } from '../lib/matcher.js';
import { rangerForslag, hentOrdbok } from '../lib/forslag.js';

const VERSJON = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).version;
const REPO = process.env.GITHUB_REPOSITORY ?? 'khalm/tilbudsvakt';
const GH_TOKEN = process.env.GITHUB_TOKEN ?? '';
const KASSAL_KEY = process.env.KASSALAPP_API_KEY ?? '';
const NTFY_TOPIC = process.env.NTFY_TOPIC ?? '';
const TORR = () => process.env.DRY_RUN === '1'; // ingen kommentarer/varsler
const ETIKETT = 'ønske';
const ENDRING = 'ønske-endring'; // små hjelpe-issues fra appen: «legg til ord på ønske #N»
const MAKS_TERMER = 10;          // søk per ønske og kilde
const RABATT_GRENSE = 0.9;       // Kassalapp: minst 10 % under nylig pris
const HISTORIKK_DAGER = 60;
const APP_URL = `https://${REPO.split('/')[0].toLowerCase()}.github.io/${REPO.split('/')[1]}/`;

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
      const r = await fetch(url, { ...opts, signal: AbortSignal.timeout(20000) });
      if (r.status === 429 || r.status >= 500) throw new Error(`HTTP ${r.status}`);
      if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`), { endelig: true });
      return r.status === 204 ? null : await r.json();
    } catch (e) {
      if (e.endelig || i === forsok - 1) throw e;
      await vent(1500 * 2 ** i);
    }
  }
}

// ---------- GitHub ----------
const gh = (sti, opts = {}) => hent(`https://api.github.com/repos/${REPO}${sti}`, {
  ...opts,
  headers: {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'tilbudsvakt',
    ...(GH_TOKEN ? { Authorization: `Bearer ${GH_TOKEN}` } : {}),
    ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
  },
});

async function sikreEtikett() {
  if (!GH_TOKEN) return;
  for (const [name, color, description] of [
    [ETIKETT, '2f9e6e', 'Noe jeg trenger – Tilbudsvakt følger med på tilbud'],
    [ENDRING, 'c5def5', 'Endring på et ønske fra Tilbudsvakt-appen (lukkes automatisk)'],
  ]) {
    try { await gh(`/labels/${encodeURIComponent(name)}`); }
    catch {
      await gh('/labels', { method: 'POST', body: JSON.stringify({ name, color, description }) })
        .catch((e) => console.warn('Kunne ikke lage etikett:', e.message));
    }
  }
}

/** Legger verdier til en «Felt: a, b»-linje i issue-teksten (lager linjen om den mangler). */
function leggTilFelt(body, navn, alias, verdier) {
  if (!verdier.length) return body;
  const linjer = String(body ?? '').split('\n');
  const re = new RegExp(`^\\s*(?:${alias})\\s*:(.*)$`, 'i');
  const i = linjer.findIndex((l) => re.test(l));
  const gamle = i >= 0 ? kommaliste(linjer[i].match(re)[1]) : [];
  const alle = [...gamle];
  for (const v of verdier) if (!alle.some((g) => brett(g) === brett(v))) alle.push(v);
  const ny = `${navn}: ${alle.join(', ')}`;
  if (i >= 0) linjer[i] = ny; else linjer.unshift(ny);
  return linjer.join('\n');
}

/** Utfører endringer appen har bestilt (legg til søkeord / unngå-ord), og lukker hjelpe-issuet. */
async function utforEndringer() {
  if (!GH_TOKEN) return;
  const liste = await gh(`/issues?state=open&labels=${encodeURIComponent(ENDRING)}&per_page=50`).catch(() => []);
  for (const e of liste) {
    const body = String(e.body ?? '');
    const felt = (n) => { const m = body.match(new RegExp(`^\\s*(?:${n})\\s*:\\s*(.*)$`, 'im')); return m ? m[1].trim() : ''; };
    const nr = parseInt(felt('ønske|onske|wish').replace(/[^0-9]/g, ''), 10);
    const leggTil = kommaliste(felt('legg til|andre ord|add'));
    const unnga = kommaliste(felt('unngå|unnga|avoid'));
    let svar;
    try {
      if (!nr) throw new Error('fant ikke hvilket ønske det gjaldt');
      const mal = await gh(`/issues/${nr}`);
      let ny = leggTilFelt(mal.body, 'Andre ord', 'andre ord|ekstra ord|synonymer|also|other words', leggTil);
      ny = leggTilFelt(ny, 'Unngå', 'unngå|unnga|ikke|avoid|exclude', unnga);
      await gh(`/issues/${nr}`, { method: 'PATCH', body: JSON.stringify({ body: ny }) });
      svar = `✔ Oppdaterte #${nr}.${leggTil.length ? ` Søker nå også etter: ${leggTil.join(', ')}.` : ''}${unnga.length ? ` Unngår: ${unnga.join(', ')}.` : ''}`;
    } catch (err) {
      svar = `Klarte ikke å oppdatere ønsket: ${err.message}`;
    }
    await gh(`/issues/${e.number}/comments`, { method: 'POST', body: JSON.stringify({ body: svar }) }).catch(() => {});
    await gh(`/issues/${e.number}`, { method: 'PATCH', body: JSON.stringify({ state: 'closed', state_reason: 'completed' }) }).catch(() => {});
    console.log(svar);
  }
}

async function hentOnsker() {
  const issues = await gh(`/issues?state=open&labels=${encodeURIComponent(ETIKETT)}&per_page=100`);
  return issues.filter((i) => !i.pull_request).map(lesOnske).filter((o) => o.tittel);
}

// ---------- Kilde: eTilbudsavis / Tjek ----------
async function sokTjek(term) {
  const p = new URLSearchParams({ query: term, country_id: 'NO', limit: '100' });
  const rå = await hent(`https://api.etilbudsavis.dk/v2/offers/search?${p}`, { headers: { 'User-Agent': 'tilbudsvakt' } });
  return (rå ?? [])
    .filter((o) => !o.dealer?.country?.id || o.dealer.country.id === 'NO')
    .map((o) => ({
      kilde: 'tjek',
      id: `tjek:${o.id}`,
      tittel: o.heading,
      beskrivelse: o.description ?? '',
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

// ---------- Kilde: Kassalapp ----------
async function sokKassal(term) {
  const p = new URLSearchParams({ search: term, size: '100', unique: '0' });
  const rå = await hent(`https://kassal.app/api/v1/products?${p}`, {
    headers: { Authorization: `Bearer ${KASSAL_KEY}`, Accept: 'application/json', 'User-Agent': 'tilbudsvakt' },
  });
  const ut = [];
  for (const v of rå?.data ?? []) {
    const pris = typeof v.current_price === 'object' ? v.current_price?.price : v.current_price;
    if (!Number.isFinite(pris) || pris <= 0) continue;
    ut.push({
      kilde: 'kassalapp',
      id: `kassal:${v.id}`,
      tittel: v.name,
      beskrivelse: [v.brand, v.vendor].filter(Boolean).join(' '),
      butikk: v.store?.name ?? 'Ukjent butikk',
      pris,
      forpris: null,
      fra: null,
      til: null,
      bilde: v.image ?? null,
      lenke: v.url ?? null,
      merknad: '',
      _historikk: (v.price_history ?? []).map((h) => [String(h.date).slice(0, 10), Number(h.price)]),
    });
  }
  return ut;
}

/** Er en Kassalapp-pris et tilbud? Sammenligner med de siste 60 dagene. */
function vurderKassal(t, historikk) {
  const grense = new Date(nå.getTime() - HISTORIKK_DAGER * 864e5).toISOString().slice(0, 10);
  const egen = historikk[t.id] ?? [];
  const alle = [...t._historikk, ...egen].filter(([d, p]) => d >= grense && Number.isFinite(p) && p > 0);
  // Oppdater egen historikk (én verdi per dag).
  const kart = new Map(egen.filter(([d]) => d >= grense));
  kart.set(idag, t.pris);
  historikk[t.id] = [...kart.entries()].sort();

  const tidligere = alle.filter(([d, p]) => !(d === idag && p === t.pris)).map(([, p]) => p);
  if (!tidligere.length) return false;
  const høyest = Math.max(...tidligere);
  if (t.pris <= høyest * RABATT_GRENSE) {
    t.forpris = høyest;
    t.merknad = `Ned ${Math.round((1 - t.pris / høyest) * 100)} % siste ${HISTORIKK_DAGER} dager`;
    return true;
  }
  return false;
}

// ---------- Varsler ----------
const kr = (n) => (n == null ? '' : `${Number(n).toFixed(2).replace('.', ',').replace(',00', ',-')} kr`);
const dato = (s) => (s ? new Date(s).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', timeZone: 'Europe/Oslo' }) : '');

function linje(t) {
  const pris = t.pris != null ? `**${kr(t.pris)}**` : '';
  const før = t.forpris ? ` (før ${kr(t.forpris)})` : '';
  const når = t.til ? ` · til ${dato(t.til)}` : '';
  const start = t.fra && new Date(t.fra) > nå ? ` · fra ${dato(t.fra)}` : '';
  const lenke = t.lenke ? ` · [se tilbudet](${t.lenke})` : '';
  return `- ${t.tittel} – ${t.butikk}: ${pris}${før}${start}${når}${lenke}`;
}

async function varsle(onske, nye) {
  if (TORR() || !nye.length) return;
  // Maks tre per butikk (nettbutikker har ofte mange varianter av samme vare), billigst først.
  const perButikk = {};
  const utvalg = nye.filter((t) => (perButikk[t.butikk] = (perButikk[t.butikk] ?? 0) + 1) <= 3).slice(0, 15);
  const tekst = [`🔔 **${nye.length === 1 ? 'Nytt tilbud' : `${nye.length} nye tilbud`} på ${onske.tittel}**`, '', ...utvalg.map(linje)];
  if (nye.length > utvalg.length) tekst.push('', `…og ${nye.length - utvalg.length} til. Se alle i [Tilbudsvakt](${APP_URL}).`);
  tekst.push('', `_Lukk dette ønsket når du har kjøpt det, så slutter varslene._`);
  if (GH_TOKEN) {
    await gh(`/issues/${onske.nr}/comments`, { method: 'POST', body: JSON.stringify({ body: tekst.join('\n') }) })
      .catch((e) => console.warn(`Kommentar på #${onske.nr} feilet:`, e.message));
  }
  if (NTFY_TOPIC) {
    const billigst = nye[0];
    await hent('https://ntfy.sh/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: NTFY_TOPIC,
        title: `Tilbud: ${onske.tittel}`,
        message: nye.slice(0, 5).map((t) => `${t.tittel} – ${t.butikk} ${kr(t.pris)}`).join('\n'),
        click: APP_URL,
        tags: ['moneybag'],
        ...(billigst.bilde ? { attach: billigst.bilde } : {}),
      }),
    }, 2).catch((e) => console.warn('ntfy feilet:', e.message));
  }
}

// ---------- Hovedløp ----------
async function main() {
  const testsok = (process.env.TESTSOK ?? '').trim();
  await sikreEtikett();
  if (!testsok) await utforEndringer();
  // Testsøk: lat som det finnes ett ønske, vis resultatet i loggen, lagre/varsle ingenting.
  const onsker = testsok ? [{ nr: 0, tittel: testsok, makspris: null, ekstra: [], unnga: [], butikker: [] }] : await hentOnsker();
  if (testsok) process.env.DRY_RUN = '1';
  const sett = await lesJson('sett.json', {});
  const historikk = await lesJson('historikk.json', {});
  const kilder = {
    tjek: { status: 'ok', navn: 'eTilbudsavis (kundeaviser)' },
    kassalapp: { status: KASSAL_KEY ? 'ok' : 'mangler nøkkel', navn: 'Kassalapp (dagligvarer)' },
  };
  const resultat = [];

  for (const onske of onsker) {
    const plan = utvid(onske);
    const termer = plan.termer.slice(0, MAKS_TERMER);
    const funn = new Map();
    const avviste = []; // relevante søketreff som ikke passet – grunnlag for forslag

    const vurder = (t) => {
      if (funn.has(t.id)) return;
      if (t.til && new Date(t.til) < nå) return;
      if (!butikkOk(t.butikk, onske.butikker)) return;
      if (onske.makspris && t.pris != null && t.pris > onske.makspris) return;
      // Tittelen først; kundeaviser har ofte merkenavn i tittelen og varen i beskrivelsen.
      // Bare tittelen teller. Beskrivelser i kundeaviser nevner ofte andre varer
      // ("Potetmos – rør inn melk"), og det ga feiltreff.
      const m = passer(t.tittel, plan);
      if (!m) { if (avviste.length < 400) avviste.push({ tittel: t.tittel, butikk: t.butikk }); return; }
      if (t.kilde === 'kassalapp' && !vurderKassal(t, historikk)) return;
      delete t._historikk;
      funn.set(t.id, { ...t, traff: m.term, grunn: m.grunn });
    };

    for (const term of termer) {
      try { (await sokTjek(term)).forEach(vurder); }
      catch (e) { kilder.tjek.status = `feil: ${e.message}`; console.warn('Tjek:', term, e.message); }
      if (KASSAL_KEY) {
        try { (await sokKassal(term)).forEach(vurder); }
        catch (e) { kilder.kassalapp.status = `feil: ${e.message}`; console.warn('Kassalapp:', term, e.message); }
        await vent(1100); // gratisnøkkel: 60 kall i minuttet
      } else {
        await vent(200);
      }
    }

    // Samme vare i samme butikk til samme pris kommer ofte fra flere aviser: vis den én gang.
    const unike = new Map();
    for (const t of funn.values()) {
      const k = `${t.tittel.toLowerCase().replace(/\s+/g, ' ').trim()}|${t.butikk.toLowerCase()}|${t.pris}`;
      if (!unike.has(k)) unike.set(k, t);
    }
    const liste = [...unike.values()].sort((a, b) => (a.pris ?? 1e9) - (b.pris ?? 1e9));
    const nye = liste.filter((t) => !sett[`${onske.nr}|${t.id}|${t.pris}`]);
    for (const t of liste) sett[`${onske.nr}|${t.id}|${t.pris}`] ??= idag;
    await varsle(onske, nye);
    console.log(`#${onske.nr} ${onske.tittel}: ${liste.length} treff (${nye.length} nye) – søkte på ${termer.join(', ')}`);

    const ordbok = await hentOrdbok(onske.tittel);
    const forslag = rangerForslag({ plan, ordbok, avviste });
    resultat.push({ ...onske, termer: plan.termer, unnga: plan.unnga, forslag, funn: liste });
    if (testsok) {
      console.log(`Unngår: ${plan.unnga.join(', ') || '–'}`);
      for (const t of liste) console.log(`  ${t.pris ?? '?'} kr  ${t.tittel}  (${t.butikk}, ${t.kilde}, traff «${t.traff}» – ${t.grunn})`);
      console.log('Kilder:', JSON.stringify(kilder));
      await skrivJson('testsok.json', { sok: testsok, tid: nå.toISOString(), kilder, termer: plan.termer, unnga: plan.unnga, ordbok, forslag, funn: liste });
      return;
    }
  }

  // Rydd: glem varsler eldre enn 60 dager og historikk for produkter vi ikke følger lenger.
  const grense = new Date(nå.getTime() - HISTORIKK_DAGER * 864e5).toISOString().slice(0, 10);
  for (const [k, d] of Object.entries(sett)) if (d < grense) delete sett[k];
  for (const [k, v] of Object.entries(historikk)) if (!v.length || v[v.length - 1][0] < grense) delete historikk[k];

  await skrivJson('funn.json', { versjon: VERSJON, oppdatert: nå.toISOString(), kilder, onsker: resultat });
  await skrivJson('sett.json', sett);
  await skrivJson('historikk.json', historikk);
}

main().catch((e) => { console.error(e); process.exit(1); });
