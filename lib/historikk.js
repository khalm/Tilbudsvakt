// Prishistorikk: samle, oppsummere og tegne.
// Spor er en liste [[dato 'YYYY-MM-DD', pris], ...] sortert på dato.

/** Slår sammen spor (én pris per dag; laveste vinner) og sorterer. */
export function slaSammen(...spor) {
  const kart = new Map();
  for (const s of spor) {
    for (const [d, p] of s ?? []) {
      if (!d || !Number.isFinite(p) || p <= 0) continue;
      const dag = String(d).slice(0, 10);
      if (!kart.has(dag) || p < kart.get(dag)) kart.set(dag, p);
    }
  }
  return [...kart.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
}

/** Legger dagens pris til et spor og kutter alt eldre enn `dager`. */
export function leggTil(spor, dato, pris, dager = 180) {
  const grense = new Date(new Date(dato).getTime() - dager * 864e5).toISOString().slice(0, 10);
  return slaSammen((spor ?? []).filter(([d]) => d >= grense), [[dato, pris]]);
}

/** Tynner et langt spor (beholder første, siste, laveste og høyeste). */
export function tynn(spor, maks = 60) {
  if (spor.length <= maks) return spor;
  const steg = spor.length / maks;
  const valgt = new Set([0, spor.length - 1]);
  let lav = 0; let hoy = 0;
  spor.forEach(([, p], i) => { if (p < spor[lav][1]) lav = i; if (p > spor[hoy][1]) hoy = i; });
  valgt.add(lav); valgt.add(hoy);
  for (let i = 0; i < spor.length; i += steg) valgt.add(Math.floor(i));
  return [...valgt].sort((a, b) => a - b).map((i) => spor[i]);
}

/** Nøkkeltall for et spor sammenlignet med dagens pris. */
export function oppsummer(spor, naa) {
  if (!spor?.length) return null;
  let lav = spor[0]; let hoy = spor[0];
  for (const x of spor) { if (x[1] < lav[1]) lav = x; if (x[1] > hoy[1]) hoy = x; }
  const tidligere = spor.filter(([, p]) => p !== naa);
  return {
    fra: spor[0][0], til: spor[spor.length - 1][0], antall: spor.length,
    lavest: lav[1], lavestDato: lav[0], hoyest: hoy[1], hoyestDato: hoy[0],
    naaErLavest: naa != null && naa <= lav[1],
    vanlig: tidligere.length ? median(tidligere.map(([, p]) => p)) : null,
  };
}

function median(l) {
  const s = [...l].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Kassalapp prices-bulk-svar → { perButikk: { navn: spor }, naa: [{ butikk, pris }] } */
export function fraKassalBulk(raa) {
  const p = raa?.data?.[0];
  if (!p) return { perButikk: {}, naa: [] };
  const navn = Object.fromEntries((p.stores ?? []).map((s) => [s.store, s.name]));
  const perButikk = {};
  for (const h of p.price_history ?? []) {
    const n = navn[h.store] ?? h.store;
    (perButikk[n] ??= []).push([String(h.date).slice(0, 10), Number(h.price)]);
  }
  for (const n of Object.keys(perButikk)) perButikk[n] = slaSammen(perButikk[n]);
  const naa = (p.stores ?? [])
    .map((s) => ({ butikk: s.name, pris: Number(s.current_price) }))
    .filter((s) => Number.isFinite(s.pris) && s.pris > 0)
    .sort((a, b) => a.pris - b.pris);
  return { perButikk, naa };
}

/** Liten trappelinje som SVG (farger fra CSS-variabler). */
export function sparklinje(spor, { bredde = 280, hoyde = 64, naa = null } = {}) {
  const pkt = naa != null && spor.length && spor[spor.length - 1][1] !== naa
    ? [...spor, [new Date().toISOString().slice(0, 10), naa]] : spor;
  if (pkt.length < 2) return '';
  const t0 = Date.parse(pkt[0][0]);
  const t1 = Math.max(Date.parse(pkt[pkt.length - 1][0]), t0 + 864e5);
  const priser = pkt.map(([, p]) => p);
  const min = Math.min(...priser); const max = Math.max(...priser);
  const spenn = max - min || 1;
  const m = 6;
  const x = (d) => m + ((Date.parse(d) - t0) / (t1 - t0)) * (bredde - 2 * m);
  const y = (p) => m + (1 - (p - min) / spenn) * (hoyde - 2 * m);
  let sti = `M${x(pkt[0][0]).toFixed(1)},${y(pkt[0][1]).toFixed(1)}`;
  for (let i = 1; i < pkt.length; i++) {
    sti += ` H${x(pkt[i][0]).toFixed(1)} V${y(pkt[i][1]).toFixed(1)}`;
  }
  const siste = pkt[pkt.length - 1];
  const lavI = priser.indexOf(min);
  return `<svg class="spark" viewBox="0 0 ${bredde} ${hoyde}" width="100%" height="${hoyde}" role="img" aria-hidden="true">
    <line x1="${m}" x2="${bredde - m}" y1="${y(min).toFixed(1)}" y2="${y(min).toFixed(1)}" class="spark-lav"/>
    <path d="${sti}" class="spark-linje" fill="none"/>
    <circle cx="${x(pkt[lavI][0]).toFixed(1)}" cy="${y(min).toFixed(1)}" r="3" class="spark-lavpunkt"/>
    <circle cx="${x(siste[0]).toFixed(1)}" cy="${y(siste[1]).toFixed(1)}" r="4" class="spark-naa"/>
  </svg>`;
}
