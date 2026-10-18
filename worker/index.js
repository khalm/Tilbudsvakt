// Tilbudsvakt – Cloudflare Worker.
//
// Serverer appen (statiske filer) og et lite API:
//   GET    /api/data                 ønskeliste + siste funn for brukeren
//   POST   /api/onsker               nytt ønske
//   PUT    /api/onsker/:id           endre ønske (makspris, andre ord, unngå, ikke søk etter, butikker)
//   DELETE /api/onsker/:id           fjerne ønske
//   POST   /api/push                 registrere telefon for push-varsler
//   DELETE /api/push                 avregistrere telefon
//   GET    /api/sok?kilde=tjek|kassal&q=...   søk (for umiddelbar sjekk i appen)
//   …/api/admin/*                    brukes av den planlagte sjekken på GitHub
//
// Brukeren identifiseres med en tilfeldig ID appen lager (header X-Bruker).
// Ingen innlogging; ID-en kan flyttes til en annen telefon med en kode.

const ID_RE = /^[a-z0-9]{20,40}$/;
const GRENSER = { onsker: 100, tittel: 80, ord: 30, ordLengde: 60, body: 20000, push: 10 };
const TILLATTE_OPPRINNELSER = [/^https:\/\/[a-z0-9-]+\.github\.io$/i];

function cors(req) {
  const o = req.headers.get('Origin');
  const url = new URL(req.url);
  const ok = !o || o === url.origin || TILLATTE_OPPRINNELSER.some((r) => r.test(o));
  return ok && o ? {
    'Access-Control-Allow-Origin': o,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,X-Bruker',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  } : {};
}

const json = (data, status = 200, ekstra = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...ekstra } });

const feil = (status, melding, ekstra) => json({ feil: melding }, status, ekstra);

function rensTekst(s, max) {
  return String(s ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
}
function rensListe(l) {
  if (!Array.isArray(l)) return [];
  const sett = new Set();
  for (const x of l) {
    const s = rensTekst(x, GRENSER.ordLengde);
    if (s) sett.add(s);
    if (sett.size >= GRENSER.ord) break;
  }
  return [...sett];
}
function rensOnske(inn, gammelt = {}) {
  const raPris = 'makspris' in inn ? inn.makspris : gammelt.makspris;
  const pris = raPris == null || raPris === '' ? NaN : Number(String(raPris).replace(',', '.'));
  return {
    id: gammelt.id ?? lagId(10),
    tittel: rensTekst(inn.tittel ?? gammelt.tittel, GRENSER.tittel),
    makspris: Number.isFinite(pris) && pris > 0 ? Math.round(pris * 100) / 100 : null,
    ekstra: rensListe(inn.ekstra ?? gammelt.ekstra),
    unnga: rensListe(inn.unnga ?? gammelt.unnga),
    fjern: rensListe(inn.fjern ?? gammelt.fjern),
    butikker: rensListe(inn.butikker ?? gammelt.butikker),
    opprettet: gammelt.opprettet ?? new Date().toISOString(),
    endret: new Date().toISOString(),
  };
}

function lagId(n = 24) {
  const a = 'abcdefghijkmnopqrstuvwxyz23456789';
  const b = crypto.getRandomValues(new Uint8Array(n));
  return [...b].map((x) => a[x % a.length]).join('');
}

async function lesBruker(env, id) {
  return (await env.TILBUD.get(`u:${id}`, 'json')) ?? null;
}
async function skrivBruker(env, id, data) {
  await env.TILBUD.put(`u:${id}`, JSON.stringify(data));
}

async function sha256hex(tekst) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(tekst));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function admin(req, env, sti) {
  const auth = req.headers.get('Authorization') ?? '';
  if (!env.ADMIN_KEY || auth !== `Bearer ${env.ADMIN_KEY}`) return feil(401, 'ikke tilgang');

  // GET /api/admin/brukere – alle brukere med ønsker og telefoner
  if (sti === 'brukere' && req.method === 'GET') {
    const ut = [];
    let cursor;
    do {
      const l = await env.TILBUD.list({ prefix: 'u:', cursor });
      for (const k of l.keys) {
        const b = await env.TILBUD.get(k.name, 'json');
        if (b) ut.push({ id: k.name.slice(2), onsker: b.onsker ?? [], push: b.push ?? {}, blokkert: b.blokkert ?? [] });
      }
      cursor = l.list_complete ? null : l.cursor;
    } while (cursor);
    return json(ut);
  }
  // PUT /api/admin/funn/:id – resultat fra siste sjekk
  let m = sti.match(/^funn\/([a-z0-9]+)$/);
  if (m && req.method === 'PUT') {
    const tekst = await req.text();
    if (tekst.length > 2_000_000) return feil(413, 'for stort');
    await env.TILBUD.put(`f:${m[1]}`, tekst);
    return json({ ok: true });
  }
  // DELETE /api/admin/push/:id/:nokkel – telefon som ikke finnes lenger
  m = sti.match(/^push\/([a-z0-9]+)\/(.+)$/);
  if (m && req.method === 'DELETE') {
    const b = await lesBruker(env, m[1]);
    if (b?.push?.[decodeURIComponent(m[2])]) {
      delete b.push[decodeURIComponent(m[2])];
      await skrivBruker(env, m[1], b);
    }
    return json({ ok: true });
  }
  return feil(404, 'ukjent');
}

async function api(req, env, url) {
  const sti = url.pathname.replace(/^\/api\/?/, '');
  if (sti.startsWith('admin/')) return admin(req, env, sti.slice(6));
  if (sti === 'helse') return json({ ok: true, tid: new Date().toISOString() });

  const id = req.headers.get('X-Bruker') ?? '';
  if (!ID_RE.test(id)) return feil(400, 'mangler bruker-ID');

  // Søk – sendes rett videre, så Worker-en bruker nesten ingen CPU.
  if (sti === 'sok' && req.method === 'GET') {
    const q = rensTekst(url.searchParams.get('q'), 80);
    if (!q) return feil(400, 'mangler søk');
    if (!(await env.TILBUD.get(`u:${id}`))) return feil(403, 'ukjent bruker');
    const kilde = url.searchParams.get('kilde');
    let svar;
    if (kilde === 'kassal') {
      if (!env.KASSALAPP_KEY) return json({ data: [] });
      svar = await fetch(`https://kassal.app/api/v1/products?${new URLSearchParams({ search: q, size: '60' })}`, {
        headers: { Authorization: `Bearer ${env.KASSALAPP_KEY}`, Accept: 'application/json' },
      });
    } else {
      svar = await fetch(`https://api.etilbudsavis.dk/v2/offers/search?${new URLSearchParams({ query: q, country_id: 'NO', limit: '80' })}`, {
        cf: { cacheTtl: 900, cacheEverything: true },
      });
    }
    return new Response(svar.body, {
      status: svar.ok ? 200 : 502,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, max-age=300' },
    });
  }

  // Prishistorikk for en dagligvare (Kassalapp, siste 90 dager i alle butikker).
  if (sti === 'historikk' && req.method === 'GET') {
    const ean = (url.searchParams.get('ean') ?? '').replace(/[^0-9]/g, '');
    if (!ean || !env.KASSALAPP_KEY) return json({ data: [] });
    if (!(await env.TILBUD.get(`u:${id}`))) return feil(403, 'ukjent bruker');
    const svar = await fetch('https://kassal.app/api/v1/products/prices-bulk', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.KASSALAPP_KEY}`, Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ eans: [ean], days: 90 }),
    });
    return new Response(svar.body, {
      status: svar.ok ? 200 : 502,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, max-age=3600' },
    });
  }

  let bruker = await lesBruker(env, id);
  const ny = () => ({ opprettet: new Date().toISOString(), onsker: [], push: {} });

  if (sti === 'data' && req.method === 'GET') {
    const funn = await env.TILBUD.get(`f:${id}`, 'json');
    return json({ onsker: bruker?.onsker ?? [], blokkert: bruker?.blokkert ?? [], funn: funn ?? null, telefoner: Object.keys(bruker?.push ?? {}).length });
  }

  const tekst = ['POST', 'PUT', 'DELETE'].includes(req.method) ? await req.text() : '';
  if (tekst.length > GRENSER.body) return feil(413, 'for stort');
  let inn = {};
  try { inn = tekst ? JSON.parse(tekst) : {}; } catch { return feil(400, 'ugyldig JSON'); }

  if (sti === 'onsker' && req.method === 'POST') {
    bruker ??= ny();
    if (bruker.onsker.length >= GRENSER.onsker) return feil(400, 'for mange ønsker');
    const o = rensOnske(inn);
    if (!o.tittel) return feil(400, 'mangler hva du trenger');
    bruker.onsker.push(o);
    await skrivBruker(env, id, bruker);
    return json(o, 201);
  }

  let m = sti.match(/^onsker\/([a-z0-9]+)$/);
  if (m) {
    const i = bruker?.onsker.findIndex((o) => o.id === m[1]) ?? -1;
    if (i < 0) return feil(404, 'fant ikke ønsket');
    if (req.method === 'PUT') {
      bruker.onsker[i] = rensOnske({ ...inn, tittel: bruker.onsker[i].tittel }, bruker.onsker[i]);
      await skrivBruker(env, id, bruker);
      return json(bruker.onsker[i]);
    }
    if (req.method === 'DELETE') {
      bruker.onsker.splice(i, 1);
      if (!bruker.onsker.length && !Object.keys(bruker.push ?? {}).length && !bruker.blokkert?.length) {
        // Tom bruker uten telefoner: rydd bort alt.
        await env.TILBUD.delete(`u:${id}`);
        await env.TILBUD.delete(`f:${id}`);
      } else {
        await skrivBruker(env, id, bruker);
      }
      return json({ ok: true });
    }
  }

  // Butikker brukeren ikke vil se tilbud fra.
  if (sti === 'blokkert' && req.method === 'PUT') {
    bruker ??= ny();
    bruker.blokkert = rensListe(inn.butikker).slice(0, 30);
    await skrivBruker(env, id, bruker);
    return json({ blokkert: bruker.blokkert });
  }

  if (sti === 'push' && req.method === 'POST') {
    const s = inn.sub ?? inn;
    if (!/^https:\/\//.test(s?.endpoint ?? '') || !s.keys?.p256dh || !s.keys?.auth) return feil(400, 'ugyldig abonnement');
    bruker ??= ny();
    const nokkel = (await sha256hex(s.endpoint)).slice(0, 24);
    bruker.push ??= {};
    bruker.push[nokkel] = { sub: { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } }, fra: new Date().toISOString() };
    const nokler = Object.keys(bruker.push);
    if (nokler.length > GRENSER.push) delete bruker.push[nokler[0]];
    await skrivBruker(env, id, bruker);
    return json({ ok: true, nokkel });
  }
  if (sti === 'push' && req.method === 'DELETE') {
    if (bruker?.push && inn.endpoint) {
      delete bruker.push[(await sha256hex(inn.endpoint)).slice(0, 24)];
      await skrivBruker(env, id, bruker);
    }
    return json({ ok: true });
  }

  return feil(404, 'ukjent');
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    const c = cors(req);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: c });
    let svar;
    try {
      svar = await api(req, env, url);
    } catch (e) {
      svar = feil(500, e.message);
    }
    for (const [k, v] of Object.entries(c)) svar.headers.set(k, v);
    return svar;
  },
};
