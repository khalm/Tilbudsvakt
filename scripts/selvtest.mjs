// Selvtest av den publiserte appen: lager en midlertidig bruker, legger til et ønske,
// søker via Worker-en (slik appen gjør) og rydder opp. Resultatet lagres i data/selvtest.json.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';
import { utvid } from '../lib/matcher.js';
import { fraTjek, fraKassal, finnTreff } from '../lib/tilbud.js';

const K = JSON.parse(await readFile(new URL('../config.json', import.meta.url), 'utf8'));
const API = K.api;
const ADMIN = createHash('sha256').update(`${process.env.CLOUDFLARE_API_TOKEN}:tilbudsvakt-admin`).digest('hex');
const bruker = `test${randomBytes(12).toString('hex')}`.slice(0, 28);
const ord = process.env.ORD || 'kaffe';
const logg = [];
const kall = async (sti, metode = 'GET', data, hdr = { 'X-Bruker': bruker }) => {
  const r = await fetch(`${API}/api/${sti}`, { method: metode, headers: { ...hdr, 'Content-Type': 'application/json' }, body: data ? JSON.stringify(data) : undefined });
  const tekst = await r.text();
  logg.push(`${metode} ${sti} → ${r.status}`);
  try { return JSON.parse(tekst); } catch { return tekst; }
};
const o = await kall('onsker', 'POST', { tittel: ord });
const plan = utvid(o);
const tjek = fraTjek(await kall(`sok?kilde=tjek&q=${encodeURIComponent(ord)}`));
const kassal = fraKassal(await kall(`sok?kilde=kassal&q=${encodeURIComponent(ord)}`));
const treff = finnTreff([...tjek, ...kassal], o, plan);
const admin = await kall('admin/brukere', 'GET', null, { Authorization: `Bearer ${ADMIN}` });
const medEan = kassal.find((x) => x.ean);
const hist = medEan ? await kall(`historikk?ean=${medEan.ean}`) : null;
const histEksempel = hist ? JSON.stringify(hist).slice(0, 1500) : null;
const app = await (await fetch(`${API}/`)).text();
await kall(`onsker/${o.id}`, 'DELETE');
const resultat = {
  tid: new Date().toISOString(), ord, logg,
  tjekTilbud: tjek.length, kassalProdukter: kassal.length, treff: treff.length,
  eksempler: treff.slice(0, 5).map((t) => `${t.pris} ${t.tittel} (${t.butikk})`),
  adminOk: Array.isArray(admin), histProdukt: medEan ? `${medEan.tittel} (${medEan.ean})` : null, histEksempel,
  kassalHistorikkISok: kassal.slice(0, 3).map((x) => x.historikk?.length ?? 0), appHarVersjon: /v\d+\.\d+\.\d+/.exec(app)?.[0] ?? null,
};
console.log(resultat);
await writeFile(new URL('../data/selvtest.json', import.meta.url), JSON.stringify(resultat, null, 2) + '\n');
