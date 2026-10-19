import { utvid, passer, liste, brett, butikkBlokkert } from './lib/matcher.js';
import { beslektet } from './lib/forslag.js';
import { fraTjek, fraKassal, finnTreff } from './lib/tilbud.js';
import { oppsummer, sparklinje, fraKassalBulk, slaSammen } from './lib/historikk.js';

const VERSJON = '2.4.1';
const VAPID_OFFENTLIG = 'BD4V-Tm80lC4uIXUJ_koeqn-lyBNACrFxrvVBZSf_QxNlCTKCwffEe3KX0XwahBFQcLGMPXw3tKtspT6z_YJrCs';
const UMIDDELBAR_TERMER = 8; // søk ved umiddelbar sjekk i appen

// ---------- Tekster ----------
const T = {
  nb: {
    nyTittel: 'Hva trenger du?', nyPlaceholder: 'F.eks. håndkle, teskjeer, ved, kaffe', leggTil: 'Legg til',
    sokerOgsa: 'Søker også etter:', flereValg: 'Flere valg', makspris: 'Makspris (kr)',
    andreOrd: 'Andre ord den kan hete (komma mellom)', andreOrdPh: 'F.eks. frottéklut, gjestehåndkle',
    unnga: 'Unngå treff med (komma mellom)', unngaPh: 'F.eks. papir, stativ',
    butikker: 'Bare disse butikkene (tomt = alle)', butikkerPh: 'F.eks. Europris, Jysk, Kiwi',
    listeTittel: 'Ønskelisten din', oppdater: 'Oppdater', laster: 'Laster …',
    testTittel: 'Test et produktnavn', testHjelp: 'Lim inn navnet på en vare for å se om den ville gitt treff på ønskene dine.',
    testPh: 'F.eks. «Frotté håndduk 50x70»', infoTittel: 'Slik virker det',
    synkTittel: 'Bruk på en annen telefon', synkHjelp: 'Ønskelisten din er knyttet til denne koden. Skriv den inn på en annen telefon for å se den samme listen der.',
    kopier: 'Kopier', kopiert: 'Koden er kopiert.', kodePh: 'Kode fra den andre telefonen', bruk: 'Bruk',
    ugyldigKode: 'Det ser ikke ut som en gyldig kode.', byttetKode: 'Byttet til ønskelisten for koden.',
    tom: 'Ingen ønsker ennå. Skriv noe du trenger over, så følger Tilbudsvakt med for deg.',
    ingenTilbud: 'Ingen tilbud akkurat nå. Du får varsel når noe dukker opp.',
    sjekker: 'Sjekker tilbud …', sjekkNaa: 'Sjekk nå',
    tilbud: (n) => (n === 1 ? '1 tilbud' : `${n} tilbud`),
    maks: (p) => `maks ${p}`, kun: (b) => `kun ${b}`,
    endre: 'Endre', kjopt: 'Kjøpt / fjern', lagre: 'Lagre', avbryt: 'Avbryt',
    bekreftSlett: (o) => `Fjerne «${o}» fra ønskelisten?`,
    se: 'Se tilbudet', for: 'før', til: 'til', fra: 'fra',
    viaSynonym: (t) => `traff «${t}»`,
    sistSjekket: (d) => `Sist sjekket ${d}.`, aldriSjekket: 'Tilbudene sjekkes hver tredje time, og med en gang når du legger til noe.',
    utenNett: 'Uten nett – viser sist lagrede data.', serverFeil: 'Fikk ikke kontakt med Tilbudsvakt. Prøv igjen om litt.',
    kassalMangler: 'Dagligvarer med prishistorikk er ikke slått på.',
    kildeFeil: (n) => `${n} svarte ikke ved siste sjekk.`,
    testIngen: 'Ingen av ønskene dine ville truffet dette.', testIngenOnsker: 'Legg til et ønske først.',
    testTreff: (o, t, g) => `✔ Treffer «${o}» via «${t}» (${g})`,
    grunner: { eksakt: 'samme ord', 'bøyning': 'bøyningsform', sammensatt: 'sammensatt ord', skrivefeil: 'nesten likt' },
    flere: (n) => `+${n} til`, visAlle: (n) => `Vis alle ${n} tilbud`,
    fjernOrd: (x) => `Ikke søk etter ${x}`, fjernet: 'Søker ikke etter',
    forslagTittel: 'Forslag til flere søkeord (mest sannsynlige først)', forslagHjelp: 'Trykk for å velge.',
    leggTilValgte: 'Søk også etter valgte', unngaValgte: 'Unngå valgte', forslagSkjema: 'Kanskje også:',
    kilde: { ordbok: 'ordbok', beslektet: 'synonymliste', laert: 'fra dine ønsker' },
    funnetNaa: (o, n, p) => `${n === 1 ? '1 tilbud' : `${n} tilbud`} på «${o}» nå – billigst ${p}.`,
    ingenNaa: (o) => `Ingen tilbud på «${o}» akkurat nå. Tilbudsvakt følger med og varsler deg.`,
    eksakt: 'Bare dette ordet', eksaktHjelp: '(ingen synonymer)', eksaktMerke: 'Bare dette ordet',
    valgSynonymer: (n) => `Med synonymer (+${n})`, valgEksakt: (o) => `Bare «${o}»`,
    sokerBare: (o) => `Søker bare etter «${o}» – ingen synonymer.`,
    eksaktForklaring: 'Søker bare etter ordet du skrev (også f.eks. «badehåndkle» og «håndkleet»), ikke synonymer.',
    medSynonymer: 'Søk også etter synonymer',
    installer: '📲 Installer appen', installert: 'Tilbudsvakt er installert ✔ Du finner den på startskjermen.',
    installerHjelp: 'Trykk ⋮ øverst til høyre i Chrome og velg «Installer app» eller «Legg til på startskjermen».',
    installerHjelpIos: 'Trykk Del-knappen nederst i Safari og velg «Legg til på Hjem-skjerm».',
    prisjakt: 'Se prishistorikk på Prisjakt ↗',
    prishistorikk: '📈 Prishistorikk', ingenHistorikk: 'Ingen prishistorikk ennå. Tilbudsvakt samler den fra nå av, så den blir bedre for hver uke.',
    lavest: 'Laveste', hoyest: 'Høyeste', vanligPris: 'Vanlig pris', periode: (a, b) => `${a} – ${b}`,
    naaLavest: '✔ Laveste pris Tilbudsvakt har sett', settTilbud: (n, d) => `Sett på tilbud ${n} ${n === 1 ? 'gang' : 'ganger'} siden ${d}`,
    andreButikker: 'Pris i andre butikker nå', henterPriser: 'Henter priser …', ingenAndre: 'Fant ikke priser i andre butikker.',
    blokkTittel: 'Butikker du ikke vil se', blokkHjelp: 'Tilbud fra disse butikkene vises ikke, og du får ikke varsel om dem.',
    blokkPh: 'Butikknavn, f.eks. Rema 1000', blokkTom: 'Ingen butikker er skjult.',
    skjulButikk: 'Ikke vis tilbud fra denne butikken i framtiden', skjult: (b) => `Viser ikke lenger tilbud fra ${b}.`, angre: 'Angre',
    visIgjen: (b) => `Vis tilbud fra ${b} igjen`,
    varslerPaa: '🔔 Slå på varsler', varslerErPaa: '🔔 Varsler er på',
    varslerBlokkert: 'Varsler er blokkert. Tillat varsler for nettstedet i Chrome-innstillingene.',
    varslerIkkeStottet: 'Denne nettleseren støtter ikke push-varsler. Installer appen fra Chrome-menyen («Legg til på startskjermen»).',
    varslerTest: 'Varsler er slått på ✔', varslerTestTekst: 'Du får beskjed her når noe du trenger kommer på tilbud.',
    info: `
      <ol>
        <li><b>Skriv det du trenger</b> – «håndkle», «teskjeer», «ved», «kaffe». Tilbudsvakt søker også etter synonymer (håndklede, håndduk, håndklær), bøyninger (teskje/teskjeer) og sammensatte ord (badehåndkle, bjørkeved), men ikke ting som bare ligner (håndklestativ, vedovn). Trykk × for å fjerne et ord du ikke vil ha.</li>
        <li><b>Med en gang</b> du legger til noe, ser du om det er på tilbud nå.</li>
        <li><b>Hver tredje time</b> sjekkes kundeaviser fra dagligvare, Europris, Jula, Clas Ohlson, byggvare og mer (eTilbudsavis), og dagligvarepriser fra Kassalapp.</li>
        <li><b>Du får varsel</b> på telefonen når noe nytt dukker opp – også når appen er lukket. Trykk «Slå på varsler» øverst én gang.</li>
        <li><b>Kjøpt det?</b> Trykk «Kjøpt / fjern», så stopper varslene.</li>
      </ol>`,
  },
  en: {
    nyTittel: 'What do you need?', nyPlaceholder: 'E.g. towel, teaspoons, firewood, coffee (Norwegian works best)', leggTil: 'Add',
    sokerOgsa: 'Also searching for:', flereValg: 'More options', makspris: 'Max price (NOK)',
    andreOrd: 'Other names for it (comma separated)', andreOrdPh: 'E.g. frottéklut, gjestehåndkle',
    unnga: 'Ignore results containing (comma separated)', unngaPh: 'E.g. papir, stativ',
    butikker: 'Only these stores (empty = all)', butikkerPh: 'E.g. Europris, Jysk, Kiwi',
    listeTittel: 'Your wishlist', oppdater: 'Refresh', laster: 'Loading …',
    testTittel: 'Test a product name', testHjelp: 'Paste a product name to see whether it would match your wishes.',
    testPh: 'E.g. “Frotté håndduk 50x70”', infoTittel: 'How it works',
    synkTittel: 'Use on another phone', synkHjelp: 'Your wishlist is tied to this code. Enter it on another phone to see the same list there.',
    kopier: 'Copy', kopiert: 'Code copied.', kodePh: 'Code from the other phone', bruk: 'Use',
    ugyldigKode: 'That does not look like a valid code.', byttetKode: 'Switched to the wishlist for that code.',
    tom: 'No wishes yet. Type something you need above and Tilbudsvakt will keep watch.',
    ingenTilbud: 'No offers right now. You’ll be notified when something shows up.',
    sjekker: 'Checking offers …', sjekkNaa: 'Check now',
    tilbud: (n) => (n === 1 ? '1 offer' : `${n} offers`),
    maks: (p) => `max ${p}`, kun: (b) => `only ${b}`,
    endre: 'Edit', kjopt: 'Bought / remove', lagre: 'Save', avbryt: 'Cancel',
    bekreftSlett: (o) => `Remove “${o}” from your wishlist?`,
    se: 'See offer', for: 'was', til: 'until', fra: 'from',
    viaSynonym: (t) => `matched “${t}”`,
    sistSjekket: (d) => `Last checked ${d}.`, aldriSjekket: 'Offers are checked every three hours, and right away when you add something.',
    utenNett: 'Offline – showing last saved data.', serverFeil: 'Could not reach Tilbudsvakt. Try again shortly.',
    kassalMangler: 'Groceries with price history are not enabled.',
    kildeFeil: (n) => `${n} did not respond at the last check.`,
    testIngen: 'None of your wishes would match this.', testIngenOnsker: 'Add a wish first.',
    testTreff: (o, t, g) => `✔ Matches “${o}” via “${t}” (${g})`,
    grunner: { eksakt: 'same word', 'bøyning': 'inflected form', sammensatt: 'compound word', skrivefeil: 'near match' },
    flere: (n) => `+${n} more`, visAlle: (n) => `Show all ${n} offers`,
    fjernOrd: (x) => `Don’t search for ${x}`, fjernet: 'Not searching for',
    forslagTittel: 'Suggested extra search words (most likely first)', forslagHjelp: 'Tap to select.',
    leggTilValgte: 'Also search for selected', unngaValgte: 'Ignore selected', forslagSkjema: 'Maybe also:',
    kilde: { ordbok: 'dictionary', beslektet: 'synonym list', laert: 'from your wishes' },
    funnetNaa: (o, n, p) => `${n === 1 ? '1 offer' : `${n} offers`} on “${o}” now – cheapest ${p}.`,
    ingenNaa: (o) => `No offers on “${o}” right now. Tilbudsvakt will keep watching.`,
    eksakt: 'Only this word', eksaktHjelp: '(no synonyms)', eksaktMerke: 'Only this word',
    valgSynonymer: (n) => `With synonyms (+${n})`, valgEksakt: (o) => `Only “${o}”`,
    sokerBare: (o) => `Searching only for “${o}” – no synonyms.`,
    eksaktForklaring: 'Searches only for the word you typed (incl. compounds and inflections), not synonyms.',
    medSynonymer: 'Also search for synonyms',
    installer: '📲 Install app', installert: 'Tilbudsvakt is installed ✔ You’ll find it on your home screen.',
    installerHjelp: 'Tap ⋮ at the top right in Chrome and choose “Install app” or “Add to Home screen”.',
    installerHjelpIos: 'Tap the Share button at the bottom of Safari and choose “Add to Home Screen”.',
    prisjakt: 'See price history on Prisjakt ↗',
    prishistorikk: '📈 Price history', ingenHistorikk: 'No price history yet. Tilbudsvakt collects it from now on, so it gets better every week.',
    lavest: 'Lowest', hoyest: 'Highest', vanligPris: 'Usual price', periode: (a, b) => `${a} – ${b}`,
    naaLavest: '✔ Lowest price Tilbudsvakt has seen', settTilbud: (n, d) => `Seen on offer ${n} ${n === 1 ? 'time' : 'times'} since ${d}`,
    andreButikker: 'Price in other stores now', henterPriser: 'Fetching prices …', ingenAndre: 'No prices found in other stores.',
    blokkTittel: 'Stores you don’t want to see', blokkHjelp: 'Offers from these stores are hidden and you won’t be notified about them.',
    blokkPh: 'Store name, e.g. Rema 1000', blokkTom: 'No stores are hidden.',
    skjulButikk: 'Don’t show offers from this store in the future', skjult: (b) => `No longer showing offers from ${b}.`, angre: 'Undo',
    visIgjen: (b) => `Show offers from ${b} again`,
    varslerPaa: '🔔 Turn on notifications', varslerErPaa: '🔔 Notifications on',
    varslerBlokkert: 'Notifications are blocked. Allow them for this site in Chrome settings.',
    varslerIkkeStottet: 'This browser does not support push notifications. Install the app from the Chrome menu (“Add to Home screen”).',
    varslerTest: 'Notifications are on ✔', varslerTestTekst: 'You’ll be told here when something you need goes on sale.',
    info: `
      <ol>
        <li><b>Type what you need</b>, ideally in Norwegian. Tilbudsvakt also searches synonyms, inflections and compound words, but not things that merely look similar. Tap × to drop a word you don’t want.</li>
        <li><b>Right away</b> when you add something, you see whether it’s on sale now.</li>
        <li><b>Every three hours</b> it checks flyers from grocery chains, Europris, Jula, Clas Ohlson, DIY stores and more (eTilbudsavis), plus grocery prices from Kassalapp.</li>
        <li><b>You get notified</b> on your phone when something new shows up – even when the app is closed. Tap “Turn on notifications” at the top once.</li>
        <li><b>Bought it?</b> Tap “Bought / remove” to stop notifications.</li>
      </ol>`,
  },
};

// ---------- Hjelpere ----------
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lagre = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const hentLagret = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
let sprak = hentLagret('sprak') || 'nb';
const t = (k) => T[sprak][k] ?? T.nb[k];
const kr = (n) => (n == null ? '' : new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', minimumFractionDigits: n % 1 ? 2 : 0 }).format(n));
const dato = (s) => (s ? new Date(s).toLocaleDateString(sprak === 'en' ? 'en-GB' : 'nb-NO', { day: 'numeric', month: 'short' }) : '');
const tidspunkt = (s) => new Date(s).toLocaleString(sprak === 'en' ? 'en-GB' : 'nb-NO', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const trygt = (url) => (/^https?:\/\//i.test(url ?? '') ? url : null);

function visBeskjed(tekst, varighet = 9000, handling = null) {
  const b = $('#beskjed');
  $('#beskjed-tekst').textContent = tekst;
  const k = $('#beskjed-knapp');
  k.hidden = !handling;
  k.onclick = null;
  if (handling) {
    k.textContent = handling.tekst;
    k.onclick = () => { b.hidden = true; handling.gjor(); };
  }
  b.hidden = false;
  clearTimeout(visBeskjed.t);
  visBeskjed.t = setTimeout(() => { b.hidden = true; }, varighet);
}

// ---------- Bruker og API ----------
const ID_RE = /^[a-z0-9]{20,40}$/;
function lagId() {
  const a = 'abcdefghijkmnopqrstuvwxyz23456789';
  return [...crypto.getRandomValues(new Uint8Array(24))].map((x) => a[x % a.length]).join('');
}
let bruker = hentLagret('bruker');
if (!ID_RE.test(bruker ?? '')) { bruker = lagId(); lagre('bruker', bruker); }

let API = '';
async function finnApi() {
  if (location.hostname.endsWith('workers.dev') || location.hostname === 'localhost') return '';
  try {
    const k = await (await fetch(`config.json?t=${Date.now()}`, { cache: 'no-store' })).json();
    return (k.api ?? '').replace(/\/$/, '');
  } catch { return ''; }
}

async function api(sti, { metode = 'GET', data } = {}) {
  const r = await fetch(`${API}/api/${sti}`, {
    method: metode,
    headers: { 'X-Bruker': bruker, ...(data ? { 'Content-Type': 'application/json' } : {}) },
    body: data ? JSON.stringify(data) : undefined,
    cache: 'no-store',
  });
  const svar = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(svar.feil ?? `HTTP ${r.status}`);
  return svar;
}

// ---------- Tilstand ----------
let onsker = hentLagret('onsker') ?? [];
let blokkert = hentLagret('blokkert') ?? [];
let funn = hentLagret('funn');               // fra planlagt sjekk
let umiddelbar = hentLagret('umiddelbar') ?? {}; // { onskeId: { tid, funn } } fra sjekk i appen
let utenNett = false;
let serverFeil = false;
const sjekkerNa = new Set();
const fjernede = new Set(); // ord fjernet fra et nytt ønske før det legges til
let redigerer = null;

async function lastInn() {
  try {
    const d = await api('data');
    onsker = d.onsker ?? [];
    blokkert = d.blokkert ?? [];
    lagre('blokkert', blokkert);
    funn = d.funn ?? null;
    utenNett = false;
    serverFeil = false;
    lagre('onsker', onsker);
    lagre('funn', funn);
  } catch (e) {
    if (navigator.onLine === false) utenNett = true; else serverFeil = true;
  }
  tegn();
}

/** Resultatet som skal vises for et ønske: det nyeste av planlagt sjekk og umiddelbar sjekk. */
function resultatFor(o) {
  const fraServer = funn?.onsker?.find((x) => x.id === o.id);
  const lokal = umiddelbar[o.id];
  const serverTid = new Date(funn?.oppdatert ?? 0).getTime();
  const lokalBrukes = lokal && (!fraServer || lokal.tid > serverTid || new Date(o.endret ?? 0).getTime() > serverTid);
  const liste = lokalBrukes ? lokal.funn : (fraServer?.funn ?? null);
  return { funn: liste?.filter((x) => !butikkBlokkert(x.butikk, blokkert)) ?? null, forslag: fraServer?.forslag ?? [] };
}

// ---------- Umiddelbar sjekk (i appen, via Worker-en) ----------
async function sjekkNa(o) {
  if (sjekkerNa.has(o.id)) return null;
  sjekkerNa.add(o.id);
  tegn(true);
  try {
    const plan = utvid(o);
    const termer = plan.termer.slice(0, UMIDDELBAR_TERMER);
    const kall = [];
    for (const term of termer) {
      kall.push(api(`sok?kilde=tjek&q=${encodeURIComponent(term)}`).then(fraTjek).catch(() => []));
      kall.push(api(`sok?kilde=kassal&q=${encodeURIComponent(term)}`).then(fraKassal).catch(() => []));
    }
    const alle = (await Promise.all(kall)).flat();
    const treff = finnTreff(alle, o, plan, { blokkert });
    umiddelbar[o.id] = { tid: Date.now(), funn: treff };
    lagre('umiddelbar', umiddelbar);
    return treff;
  } finally {
    sjekkerNa.delete(o.id);
    tegn(true);
  }
}

// ---------- Tegning ----------
function tegnStatus() {
  const deler = [];
  if (utenNett) deler.push(t('utenNett'));
  if (serverFeil) deler.push(t('serverFeil'));
  deler.push(funn?.oppdatert ? t('sistSjekket')(tidspunkt(funn.oppdatert)) : t('aldriSjekket'));
  const k = funn?.kilder ?? {};
  const feil = Object.values(k).filter((x) => String(x.status).startsWith('feil')).map((x) => x.navn);
  if (feil.length) deler.push(t('kildeFeil')(feil.join(', ')));
  if (k.kassalapp?.status === 'mangler nøkkel') deler.push(t('kassalMangler'));
  $('#status').textContent = deler.join(' ');
}

function brikke(x, fjernbar) {
  return fjernbar
    ? `<span class="brikke fjernbar">${esc(x)}<button type="button" class="kryss" data-fjern="${esc(x)}" aria-label="${esc(t('fjernOrd')(x))}">×</button></span>`
    : `<span class="brikke">${esc(x)}</span>`;
}
function brikker(termer, vis = 6, fjernbar = false) {
  const synlige = termer.slice(0, vis).map((x) => brikke(x, fjernbar)).join('');
  const rest = termer.length - vis;
  if (rest <= 0) return synlige;
  const skjult = termer.slice(vis).map((x) => brikke(x, fjernbar)).join('');
  return `${synlige}<details class="mer"><summary>${esc(t('flere')(rest))}</summary>${skjult}</details>`;
}

function tilbudHtml(x) {
  const bilde = trygt(x.bilde);
  const lenke = trygt(x.lenke);
  const rabatt = x.forpris && x.pris ? Math.round((1 - x.pris / x.forpris) * 100) : null;
  const periode = [
    x.fra && new Date(x.fra) > new Date() ? `${t('fra')} ${dato(x.fra)}` : '',
    x.til ? `${t('til')} ${dato(x.til)}` : '',
  ].filter(Boolean).join(' · ');
  return `
    <li class="tilbud">
      ${bilde ? `<img src="${esc(bilde)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '<div class="bilde-tom" aria-hidden="true">🏷️</div>'}
      <div class="tilbud-tekst">
        <div class="tilbud-navn">${esc(x.tittel)}</div>
        <div class="tilbud-meta">${esc(x.butikk)}${periode ? ` · ${esc(periode)}` : ''}${x.merknad ? ` · ${esc(x.merknad)}` : ''}</div>
        ${x.traff ? `<div class="tilbud-meta svak">${esc(t('viaSynonym')(x.traff))}</div>` : ''}
        ${lenke ? `<a class="lenke" href="${esc(lenke)}" target="_blank" rel="noopener">${esc(t('se'))} ↗</a>` : ''}
        <details class="historikk" data-tilbud="${esc(x.id)}">
          <summary>${esc(t('prishistorikk'))}</summary>
          <div class="historikk-innhold">${historikkHtml(x)}</div>
          ${x.ean ? `<div class="andre-butikker" data-ean="${esc(x.ean)}"></div>` : ''}
          ${x.kilde !== 'kassalapp' ? `<a class="lenke prisjakt" href="https://www.prisjakt.no/search?search=${encodeURIComponent(prisjaktSok(x.tittel))}" target="_blank" rel="noopener">${esc(t('prisjakt'))}</a>` : ''}
        </details>
        <button type="button" class="skjul-butikk" data-skjul="${esc(x.butikk)}">🚫 ${esc(t('skjulButikk'))}</button>
      </div>
      <div class="pris">
        <div class="naa">${esc(kr(x.pris))}</div>
        ${x.forpris ? `<div class="for">${esc(t('for'))} ${esc(kr(x.forpris))}</div>` : ''}
        ${rabatt > 0 ? `<div class="rabatt">−${rabatt}%</div>` : ''}
      </div>
    </li>`;
}

/** Søkeord til Prisjakt: tittelen uten mål, pakningsstørrelser og fyll. */
function prisjaktSok(tittel) {
  return String(tittel)
    .replace(/\b\d+([.,]\d+)?\s*(x\s*\d+\s*)?(cm|mm|m|l|liter|dl|ml|g|kg|stk|pk|pakk|-pk|w|v)\b/gi, ' ')
    .replace(/\s+-\s+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || tittel;
}

function historikkHtml(x, spor = x.spor ?? []) {
  if (!spor.length) return `<p class="liten svak">${esc(t('ingenHistorikk'))}</p>`;
  const o = oppsummer(spor, x.pris);
  const linjer = [];
  if (x.kilde === 'tjek') linjer.push(t('settTilbud')(o.antall, dato(o.fra)));
  else linjer.push(t('periode')(dato(o.fra), dato(o.til)));
  const tall = [
    `${t('lavest')}: <b>${esc(kr(o.lavest))}</b> (${esc(dato(o.lavestDato))})`,
    `${t('hoyest')}: ${esc(kr(o.hoyest))}`,
    o.vanlig != null && x.kilde !== 'tjek' ? `${t('vanligPris')}: ${esc(kr(o.vanlig))}` : '',
  ].filter(Boolean).join(' · ');
  return `
    ${sparklinje(spor, { naa: x.pris })}
    <p class="liten">${tall}</p>
    <p class="liten svak">${esc(linjer.join(' · '))}</p>
    ${o.naaErLavest && o.antall > 1 ? `<p class="liten ok">${esc(t('naaLavest'))}</p>` : ''}`;
}

const bulkCache = new Map();
async function visAndreButikker(boks, x) {
  if (boks.dataset.lastet) return;
  boks.dataset.lastet = '1';
  boks.innerHTML = `<p class="liten svak"><span class="spinner" aria-hidden="true"></span> ${esc(t('henterPriser'))}</p>`;
  try {
    if (!bulkCache.has(x.ean)) bulkCache.set(x.ean, fraKassalBulk(await api(`historikk?ean=${encodeURIComponent(x.ean)}`)));
    const b = bulkCache.get(x.ean);
    // Lengre historikk for samme butikk (90 dager) erstatter den korte.
    const egen = b.perButikk[x.butikk];
    if (egen?.length > (x.spor?.length ?? 0)) {
      boks.parentElement.querySelector('.historikk-innhold').innerHTML = historikkHtml(x, slaSammen(egen, x.spor));
    }
    const andre = b.naa.filter((s) => !butikkBlokkert(s.butikk, blokkert));
    boks.innerHTML = andre.length
      ? `<p class="liten"><b>${esc(t('andreButikker'))}</b></p><ul class="andre">${andre.slice(0, 6).map((s) =>
        `<li class="${brett(s.butikk) === brett(x.butikk) ? 'denne' : ''}"><span>${esc(s.butikk)}</span><span>${esc(kr(s.pris))}</span></li>`).join('')}</ul>`
      : `<p class="liten svak">${esc(t('ingenAndre'))}</p>`;
  } catch {
    boks.innerHTML = '';
    delete boks.dataset.lastet;
  }
}

function forslagHtml(o, forslag) {
  const f = forslag.filter((x) => ![...o.ekstra, ...o.unnga, ...(o.fjern ?? [])].some((e) => brett(e) === brett(x.ord)));
  if (!f.length) return '';
  return `
    <details class="forslag">
      <summary>${esc(t('forslagTittel'))} <span class="antall">${f.length}</span></summary>
      <p class="liten svak">${esc(t('forslagHjelp'))}</p>
      <div class="brikker">${f.map((x) => `<button type="button" class="brikke valg" aria-pressed="false" data-ord="${esc(x.ord)}" title="${esc(x.kilder.map((k) => t('kilde')[k] ?? k).join(', '))}">${esc(x.ord)}</button>`).join('')}</div>
      <div class="handlinger venstre">
        <button type="button" class="knapp liten-knapp" data-gjor="legg-til" disabled>${esc(t('leggTilValgte'))}</button>
        <button type="button" class="knapp tekst" data-gjor="unnga" disabled>${esc(t('unngaValgte'))}</button>
      </div>
    </details>`;
}

function redigerHtml(o) {
  return `
    <form class="rediger" data-id="${esc(o.id)}">
      <label class="bryter">
        <input type="checkbox" name="eksakt"${o.eksakt ? ' checked' : ''}>
        <span class="bryter-spor" aria-hidden="true"></span>
        <span><b>${esc(t('eksakt'))}</b> <span class="liten svak">${esc(t('eksaktHjelp'))}</span></span>
      </label>
      <label><span>${esc(t('makspris'))}</span><input name="makspris" type="number" inputmode="decimal" min="0" step="any" value="${esc(o.makspris ?? '')}"></label>
      <label><span>${esc(t('andreOrd'))}</span><input name="ekstra" type="text" value="${esc(o.ekstra.join(', '))}"></label>
      <label><span>${esc(t('unnga'))}</span><input name="unnga" type="text" value="${esc(o.unnga.join(', '))}"></label>
      <label><span>${esc(t('butikker'))}</span><input name="butikker" type="text" value="${esc(o.butikker.join(', '))}"></label>
      <div class="handlinger venstre">
        <button type="submit" class="knapp liten-knapp">${esc(t('lagre'))}</button>
        <button type="button" class="knapp tekst" data-gjor="avbryt">${esc(t('avbryt'))}</button>
      </div>
    </form>`;
}

const tilbudKart = new Map();
function tegnOnsker() {
  const boks = $('#onsker');
  tilbudKart.clear();
  if (!onsker.length) {
    boks.innerHTML = `<p class="tom">${esc(t('tom'))}</p>`;
    return;
  }
  boks.innerHTML = [...onsker].reverse().map((o) => {
    const plan = utvid(o);
    const r = resultatFor(o);
    const liste = r.funn ?? [];
    for (const x of liste) tilbudKart.set(x.id, x);
    const sjekker = sjekkerNa.has(o.id);
    const meta = [o.makspris ? t('maks')(kr(o.makspris)) : '', o.butikker.length ? t('kun')(o.butikker.join(', ')) : '']
      .filter(Boolean).join(' · ');
    const tilbudDel = sjekker
      ? `<p class="liten svak"><span class="spinner" aria-hidden="true"></span> ${esc(t('sjekker'))}</p>`
      : liste.length
        ? `<ul class="tilbudsliste">${liste.slice(0, 6).map(tilbudHtml).join('')}</ul>${liste.length > 6
          ? `<details class="flere-tilbud"><summary>${esc(t('visAlle')(liste.length))}</summary><ul class="tilbudsliste">${liste.slice(6).map(tilbudHtml).join('')}</ul></details>` : ''}`
        : `<p class="liten svak">${esc(t('ingenTilbud'))}</p>`;
    return `
      <article class="onske kort${liste.length ? ' har-tilbud' : ''}" data-id="${esc(o.id)}">
        <header class="onske-topp">
          <div>
            <h3>${esc(o.tittel)}</h3>
            ${meta ? `<p class="liten">${esc(meta)}</p>` : ''}
            ${o.eksakt ? `<span class="merke-eksakt" title="${esc(t('eksaktForklaring'))}">🎯 ${esc(t('eksaktMerke'))}</span>` : ''}
          </div>
          <span class="teller${liste.length ? ' aktiv' : ''}">${esc(t('tilbud')(liste.length))}</span>
        </header>
        ${o.eksakt
          ? `<p class="liten svak">${esc(t('eksaktForklaring'))} <button type="button" class="lenkeknapp" data-gjor="synonymer">${esc(t('medSynonymer'))}</button></p>
             ${o.ekstra.length ? `<div class="brikker">${brikker(plan.termer.filter((x) => brett(x) !== brett(o.tittel)), 6, true)}</div>` : ''}`
          : `<div class="brikker">${brikker(plan.termer.filter((x) => brett(x) !== brett(o.tittel)), 6, true)}</div>`}
        ${o.fjern?.length ? `<p class="liten svak">${esc(t('fjernet'))}: ${o.fjern.map((f) => `<button type="button" class="angre" data-angre="${esc(f)}">${esc(f)} ↺</button>`).join(' ')}</p>` : ''}
        ${tilbudDel}
        ${redigerer === o.id ? redigerHtml(o) : o.eksakt ? '' : forslagHtml(o, r.forslag)}
        <div class="handlinger">
          <button type="button" class="knapp tekst" data-gjor="sjekk"${sjekker ? ' disabled' : ''}>${esc(t('sjekkNaa'))}</button>
          <button type="button" class="knapp tekst" data-gjor="endre">${esc(t('endre'))}</button>
          <button type="button" class="knapp tekst" data-gjor="slett">${esc(t('kjopt'))}</button>
        </div>
      </article>`;
  }).join('');
}

function tegnForhand() {
  const tittel = $('#ny-ord').value.trim();
  const ekstra = liste($('#ny-ekstra').value);
  const boks = $('#forhand');
  if (!tittel) { boks.hidden = true; return; }
  const eksakt = $('#ny-eksakt').checked;
  const unnga = liste($('#ny-unnga').value);
  // Hvor mange synonymer ordet ville fått – avgjør om valget «Bare dette ordet» gir mening.
  const medSyn = utvid({ tittel, ekstra, unnga, fjern: [...fjernede] });
  const antallSyn = medSyn.termer.filter((x) => brett(x) !== brett(tittel)).length;
  const plan = utvid({ tittel, ekstra, unnga, fjern: [...fjernede], eksakt });
  const andre = plan.termer.filter((x) => brett(x) !== brett(tittel));
  const kanskje = eksakt ? [] : beslektet(plan, undefined, funn?.laerte ?? []).slice(0, 8).map((x) => x.ord);
  const fjernetHer = eksakt ? [] : [...fjernede].filter((f) => utvid({ tittel, ekstra }).termer.some((x) => brett(x) === brett(f)));
  const harSynonymer = antallSyn > 0 || fjernetHer.length > 0;

  // Valget vises med en gang ordet har synonymer.
  $('#sokevalg').hidden = !harSynonymer;
  $('#valg-synonymer').textContent = t('valgSynonymer')(antallSyn);
  $('#valg-eksakt').textContent = t('valgEksakt')(tittel);
  $('#valg-synonymer').setAttribute('aria-checked', String(!eksakt));
  $('#valg-eksakt').setAttribute('aria-checked', String(eksakt));
  $('#forhand-tekst').textContent = eksakt ? t('sokerBare')(tittel) : t('sokerOgsa');
  $('#forhand-tekst').hidden = !eksakt && !andre.length;

  boks.hidden = !harSynonymer && !kanskje.length;
  $('#forhand-brikker').innerHTML = brikker(andre, 10, true)
    + (fjernetHer.length ? `<p class="liten svak hel">${esc(t('fjernet'))}: ${fjernetHer.map((f) => `<button type="button" class="angre" data-angre="${esc(f)}">${esc(f)} ↺</button>`).join(' ')}</p>` : '')
    + (kanskje.length ? `<p class="liten svak hel">${esc(t('forslagSkjema'))}</p>${kanskje.map((k) => `<button type="button" class="brikke valg pluss" data-legg="${esc(k)}">+ ${esc(k)}</button>`).join('')}` : '');
}

function tegnTest() {
  const tekst = $('#test-ord').value.trim();
  const svar = $('#test-svar');
  if (!tekst) { svar.innerHTML = ''; return; }
  if (!onsker.length) { svar.textContent = t('testIngenOnsker'); return; }
  const treff = onsker
    .map((o) => ({ o, m: passer(tekst, utvid(o)) }))
    .filter((x) => x.m)
    .map((x) => `<p class="ok">${esc(t('testTreff')(x.o.tittel, x.m.term, t('grunner')[x.m.grunn] ?? x.m.grunn))}</p>`);
  svar.innerHTML = treff.length ? treff.join('') : `<p class="svak">${esc(t('testIngen'))}</p>`;
}

function oversett() {
  document.documentElement.lang = sprak === 'en' ? 'en' : 'nb';
  document.querySelectorAll('[data-t]').forEach((el) => { el.textContent = t(el.dataset.t); });
  document.querySelectorAll('[data-tp]').forEach((el) => { el.placeholder = t(el.dataset.tp); });
  $('#info-tekst').innerHTML = t('info');
  $('#sprak').textContent = sprak === 'en' ? 'NO' : 'EN';
  $('#min-kode').textContent = bruker;
}

let sistTegnet = '';
function tegn(tving = false) {
  oversett();
  tegnStatus();
  tegnVarselKnapp();
  tegnInstallerKnapp();
  // Tegn kortene bare når noe er endret, så valgte forslag og åpne lister ikke nullstilles.
  const nokkel = JSON.stringify([sprak, onsker, blokkert, funn?.oppdatert, Object.keys(umiddelbar).length, [...sjekkerNa], redigerer]);
  if (tving || nokkel !== sistTegnet) { sistTegnet = nokkel; tegnOnsker(); }
  tegnBlokkert();
  tegnForhand();
  tegnTest();
}

function tegnBlokkert() {
  $('#blokkert-liste').innerHTML = blokkert.length
    ? blokkert.map((b) => `<span class="brikke fjernbar">${esc(b)}<button type="button" class="kryss" data-vis="${esc(b)}" aria-label="${esc(t('visIgjen')(b))}">×</button></span>`).join('')
    : `<span class="liten svak">${esc(t('blokkTom'))}</span>`;
}

async function settBlokkert(ny) {
  const forrige = blokkert;
  blokkert = ny;
  lagre('blokkert', blokkert);
  tegn(true);
  try {
    const svar = await api('blokkert', { metode: 'PUT', data: { butikker: ny } });
    blokkert = svar.blokkert;
    lagre('blokkert', blokkert);
  } catch (err) {
    blokkert = forrige;
    lagre('blokkert', blokkert);
    tegn(true);
    visBeskjed(`${t('serverFeil')} (${err.message})`);
  }
}

// ---------- Endre ønsker ----------
async function oppdaterOnske(o, endring) {
  const ny = await api(`onsker/${o.id}`, { metode: 'PUT', data: { ...o, ...endring } });
  onsker = onsker.map((x) => (x.id === o.id ? ny : x));
  lagre('onsker', onsker);
  tegn(true);
  return ny;
}

async function leggTilOnske(data) {
  const o = await api('onsker', { metode: 'POST', data });
  onsker = [...onsker, o];
  lagre('onsker', onsker);
  tegn(true);
  const treff = await sjekkNa(o);
  if (treff) {
    visBeskjed(treff.length ? t('funnetNaa')(o.tittel, treff.length, kr(treff[0].pris)) : t('ingenNaa')(o.tittel));
  }
}

// ---------- Installer appen ----------
let installerHendelse = null;
const erInstallert = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const erIos = /iPhone|iPad|iPod/i.test(navigator.userAgent);

function tegnInstallerKnapp() {
  const k = $('#installer');
  k.textContent = t('installer');
  k.hidden = erInstallert() || hentLagret('installert') === true;
}
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installerHendelse = e;
  lagre('installert', false);
  tegnInstallerKnapp();
});
window.addEventListener('appinstalled', () => {
  installerHendelse = null;
  lagre('installert', true);
  tegnInstallerKnapp();
  visBeskjed(t('installert'));
});
$('#installer').addEventListener('click', async () => {
  if (installerHendelse) {
    installerHendelse.prompt();
    const { outcome } = await installerHendelse.userChoice.catch(() => ({}));
    if (outcome === 'accepted') { lagre('installert', true); installerHendelse = null; }
    tegnInstallerKnapp();
  } else {
    // Nettleseren tilbyr ikke installasjon direkte (f.eks. Safari): vis hvordan.
    visBeskjed(erIos ? t('installerHjelpIos') : t('installerHjelp'), 14000);
  }
});

// ---------- Push-varsler ----------
function base64tilBytes(b64) {
  const s = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}
const stottesPush = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

async function tegnVarselKnapp() {
  const k = $('#varsler');
  if (!stottesPush) { k.hidden = true; return; }
  k.hidden = false;
  let aktiv = false;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    aktiv = Boolean(reg && await reg.pushManager.getSubscription()) && Notification.permission === 'granted';
  } catch {}
  k.textContent = aktiv ? t('varslerErPaa') : t('varslerPaa');
  k.classList.toggle('paa', aktiv);
}

async function slaPaVarsler() {
  if (!stottesPush) { visBeskjed(t('varslerIkkeStottet')); return; }
  const tillatelse = await Notification.requestPermission();
  if (tillatelse !== 'granted') { visBeskjed(t('varslerBlokkert')); return; }
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64tilBytes(VAPID_OFFENTLIG) });
  await api('push', { metode: 'POST', data: { sub: sub.toJSON() } });
  await reg.showNotification(t('varslerTest'), { body: t('varslerTestTekst'), icon: 'icon-192.png', badge: 'icon-192.png' });
  tegnVarselKnapp();
}

// ---------- Hendelser ----------
$('#ny-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const tittel = $('#ny-ord').value.trim();
  if (!tittel) return;
  const data = {
    tittel,
    makspris: $('#ny-pris').value.trim() || null,
    ekstra: liste($('#ny-ekstra').value),
    unnga: liste($('#ny-unnga').value),
    fjern: [...fjernede],
    butikker: liste($('#ny-butikker').value),
    eksakt: $('#ny-eksakt').checked,
  };
  const knapp = e.target.querySelector('button[type=submit]');
  knapp.disabled = true;
  try {
    e.target.reset();
    fjernede.clear();
    tegnForhand();
    await leggTilOnske(data);
  } catch (err) {
    visBeskjed(`${t('serverFeil')} (${err.message})`);
    $('#ny-ord').value = tittel;
  } finally {
    knapp.disabled = false;
  }
});

$('#forhand-brikker').addEventListener('click', (e) => {
  const kryss = e.target.closest('[data-fjern]');
  if (kryss) { fjernede.add(kryss.dataset.fjern); tegnForhand(); return; }
  const angre = e.target.closest('[data-angre]');
  if (angre) { fjernede.delete(angre.dataset.angre); tegnForhand(); return; }
  const b = e.target.closest('[data-legg]');
  if (!b) return;
  const felt = $('#ny-ekstra');
  const ordene = liste(felt.value);
  if (!ordene.some((x) => brett(x) === brett(b.dataset.legg))) ordene.push(b.dataset.legg);
  felt.value = ordene.join(', ');
  felt.closest('details').open = true;
  tegnForhand();
});

$('#onsker').addEventListener('click', async (e) => {
  const kort = e.target.closest('.onske');
  if (!kort) return;
  const o = onsker.find((x) => x.id === kort.dataset.id);
  if (!o) return;
  const feilmelding = (err) => visBeskjed(`${t('serverFeil')} (${err.message})`);

  const skjul = e.target.closest('[data-skjul]');
  if (skjul) {
    const b = skjul.dataset.skjul;
    if (!butikkBlokkert(b, blokkert)) {
      const forrige = [...blokkert];
      await settBlokkert([...blokkert, b]);
      visBeskjed(t('skjult')(b), 9000, { tekst: t('angre'), gjor: () => settBlokkert(forrige) });
    }
    return;
  }
  const kryss = e.target.closest('[data-fjern]');
  if (kryss) {
    oppdaterOnske(o, { fjern: [...new Set([...(o.fjern ?? []), kryss.dataset.fjern])] }).catch(feilmelding);
    return;
  }
  const angre = e.target.closest('[data-angre]');
  if (angre) {
    oppdaterOnske(o, { fjern: (o.fjern ?? []).filter((f) => brett(f) !== brett(angre.dataset.angre)) }).catch(feilmelding);
    return;
  }
  const valg = e.target.closest('.valg');
  const forslag = e.target.closest('.forslag');
  if (valg && forslag) {
    valg.classList.toggle('valgt');
    valg.setAttribute('aria-pressed', valg.classList.contains('valgt'));
    const valgte = forslag.querySelectorAll('.valg.valgt').length;
    forslag.querySelectorAll('[data-gjor]').forEach((k) => { k.disabled = !valgte; });
    return;
  }
  const gjor = e.target.closest('[data-gjor]')?.dataset.gjor;
  if (!gjor) return;
  if (gjor === 'legg-til' || gjor === 'unnga') {
    const valgte = [...forslag.querySelectorAll('.valg.valgt')].map((x) => x.dataset.ord);
    const felt = gjor === 'legg-til' ? 'ekstra' : 'unnga';
    await oppdaterOnske(o, { [felt]: [...new Set([...o[felt], ...valgte])] }).catch(feilmelding);
    if (gjor === 'legg-til') sjekkNa(onsker.find((x) => x.id === o.id)).catch(() => {});
  } else if (gjor === 'synonymer') {
    const ny = await oppdaterOnske(o, { eksakt: false }).catch(feilmelding);
    if (ny) sjekkNa(ny).catch(() => {});
  } else if (gjor === 'sjekk') {
    sjekkNa(o).then((treff) => treff && visBeskjed(treff.length ? t('funnetNaa')(o.tittel, treff.length, kr(treff[0].pris)) : t('ingenNaa')(o.tittel)))
      .catch(feilmelding);
  } else if (gjor === 'endre') {
    redigerer = redigerer === o.id ? null : o.id;
    tegn(true);
  } else if (gjor === 'avbryt') {
    redigerer = null;
    tegn(true);
  } else if (gjor === 'slett') {
    if (!confirm(t('bekreftSlett')(o.tittel))) return;
    try {
      await api(`onsker/${o.id}`, { metode: 'DELETE' });
      onsker = onsker.filter((x) => x.id !== o.id);
      delete umiddelbar[o.id];
      lagre('onsker', onsker);
      lagre('umiddelbar', umiddelbar);
      tegn(true);
    } catch (err) { feilmelding(err); }
  }
});

$('#onsker').addEventListener('submit', async (e) => {
  const skjema = e.target.closest('.rediger');
  if (!skjema) return;
  e.preventDefault();
  const o = onsker.find((x) => x.id === skjema.dataset.id);
  const f = new FormData(skjema);
  try {
    redigerer = null;
    const ny = await oppdaterOnske(o, {
      makspris: f.get('makspris') || null,
      ekstra: liste(f.get('ekstra')),
      unnga: liste(f.get('unnga')),
      butikker: liste(f.get('butikker')),
      eksakt: f.get('eksakt') === 'on',
    });
    sjekkNa(ny).catch(() => {});
  } catch (err) { visBeskjed(`${t('serverFeil')} (${err.message})`); }
});

// Hent priser i andre butikker når prishistorikken åpnes (toggle bobler ikke, så lytt i capture-fasen).
$('#onsker').addEventListener('toggle', (e) => {
  const d = e.target;
  if (!d.matches?.('details.historikk') || !d.open) return;
  const boks = d.querySelector('.andre-butikker');
  const x = tilbudKart.get(d.dataset.tilbud);
  if (boks && x?.ean) visAndreButikker(boks, x);
}, true);

$('#blokkert-liste').addEventListener('click', (e) => {
  const k = e.target.closest('[data-vis]');
  if (k) settBlokkert(blokkert.filter((b) => brett(b) !== brett(k.dataset.vis)));
});
$('#blokk-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const navn = $('#ny-blokk').value.trim();
  if (!navn) return;
  e.target.reset();
  if (!butikkBlokkert(navn, blokkert)) settBlokkert([...blokkert, navn]);
});

['#ny-ord', '#ny-ekstra', '#ny-unnga'].forEach((s) => $(s).addEventListener('input', tegnForhand));
$('#valg-synonymer').addEventListener('click', () => { $('#ny-eksakt').checked = false; tegnForhand(); });
$('#valg-eksakt').addEventListener('click', () => { $('#ny-eksakt').checked = true; tegnForhand(); });
// Nytt ord = start med synonymer igjen.
$('#ny-ord').addEventListener('input', () => { if (!$('#ny-ord').value.trim()) $('#ny-eksakt').checked = false; });
$('#ny-ord').addEventListener('input', () => { if (!$('#ny-ord').value.trim()) fjernede.clear(); });
$('#test-ord').addEventListener('input', tegnTest);
$('#oppdater').addEventListener('click', lastInn);
$('#varsler').addEventListener('click', () => {
  if ($('#varsler').classList.contains('paa')) return;
  slaPaVarsler().catch((e) => visBeskjed(`${t('varslerBlokkert')} (${e.message})`));
});
$('#sprak').addEventListener('click', () => {
  sprak = sprak === 'en' ? 'nb' : 'en';
  lagre('sprak', sprak);
  tegn(true);
});
$('#kopier-kode').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(bruker); visBeskjed(t('kopiert'), 3000); } catch {}
});
$('#kode-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const kode = $('#ny-kode').value.trim().toLowerCase();
  if (!ID_RE.test(kode)) { visBeskjed(t('ugyldigKode')); return; }
  bruker = kode;
  lagre('bruker', bruker);
  umiddelbar = {};
  lagre('umiddelbar', umiddelbar);
  e.target.reset();
  await lastInn();
  // Telefonen skal få varsler for den nye listen også.
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg && await reg.pushManager.getSubscription();
    if (sub) await api('push', { metode: 'POST', data: { sub: sub.toJSON() } });
  } catch {}
  visBeskjed(t('byttetKode'));
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) lastInn(); });

// ---------- Oppstart ----------
$('#versjon').textContent = `v${VERSJON}`;
$('#bunn-versjon').textContent = `Tilbudsvakt v${VERSJON}`;
tegn(true);
API = await finnApi();
lastInn();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then(() => tegnVarselKnapp()).catch(() => {});
}
