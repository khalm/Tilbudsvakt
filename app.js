import { utvid, passer, lesOnske, liste } from './lib/matcher.js';

const VERSJON = '1.0.0';

// Repoet appen hører til: utledes fra GitHub Pages-adressen, ellers standard.
const [EIER, REPO] = (() => {
  const h = location.hostname;
  if (h.endsWith('.github.io')) {
    const r = location.pathname.split('/').filter(Boolean)[0];
    if (r) return [h.split('.')[0], r];
  }
  return ['khalm', 'tilbudsvakt'];
})();
const REPO_URL = `https://github.com/${EIER}/${REPO}`;
const ETIKETT = 'ønske';

// ---------- Tekster ----------
const T = {
  nb: {
    nyTittel: 'Hva trenger du?', nyPlaceholder: 'F.eks. håndkle, teskjeer, ved, kaffe', leggTil: 'Legg til',
    sokerOgsa: 'Søker også etter:', flereValg: 'Flere valg', makspris: 'Makspris (kr)',
    andreOrd: 'Andre ord den kan hete (komma mellom)', andreOrdPh: 'F.eks. frottéklut, gjestehåndkle',
    unnga: 'Unngå treff med (komma mellom)', unngaPh: 'F.eks. papir, stativ',
    butikker: 'Bare disse butikkene (tomt = alle)', butikkerPh: 'F.eks. Europris, Jysk, Kiwi',
    leggTilHjelp: 'Ønsket lagres på GitHub. Trykk «Create» / «Submit new issue» på siden som åpnes, så sjekkes tilbudene med en gang.',
    listeTittel: 'Ønskelisten din', oppdater: 'Oppdater', laster: 'Laster …',
    testTittel: 'Test et produktnavn', testHjelp: 'Lim inn navnet på en vare for å se om den ville gitt treff på ønskene dine.',
    testPh: 'F.eks. «Frotté håndduk 50x70»', infoTittel: 'Slik virker det',
    tom: 'Ingen ønsker ennå. Skriv noe du trenger over, så følger Tilbudsvakt med for deg.',
    ingenTilbud: 'Ingen tilbud akkurat nå. Du får varsel når noe dukker opp.',
    venter: 'Nytt ønske – første sjekk kjører nå. Oppdater om et par minutter.',
    tilbud: (n) => (n === 1 ? '1 tilbud' : `${n} tilbud`),
    maks: (p) => `maks ${p}`, kun: (b) => `kun ${b}`,
    rediger: 'Endre', kjopt: 'Kjøpt / fjern', se: 'Se tilbudet', for: 'før', til: 'til', fra: 'fra',
    viaSynonym: (t) => `traff «${t}»`,
    sistSjekket: (d) => `Sist sjekket ${d}`, aldriSjekket: 'Ikke sjekket ennå – første sjekk kjører når du legger til et ønske.',
    utenNett: 'Uten nett – viser sist lagrede data.',
    kassalMangler: 'Dagligvarer med prishistorikk er ikke slått på ennå (se «Slik virker det»).',
    kildeFeil: (n) => `${n} svarte ikke ved siste sjekk.`,
    testIngen: 'Ingen av ønskene dine ville truffet dette.', testIngenOnsker: 'Legg til et ønske først.',
    testTreff: (o, t, g) => `✔ Treffer «${o}» via «${t}» (${g})`,
    grunner: { eksakt: 'samme ord', 'bøyning': 'bøyningsform', sammensatt: 'sammensatt ord', skrivefeil: 'nesten likt' },
    flere: (n) => `+${n} til`, faerre: 'vis færre', visAlle: (n) => `Vis alle ${n} tilbud`,
    info: `
      <ol>
        <li><b>Skriv det du trenger</b> – «håndkle», «teskjeer», «ved», «kaffe». Du trenger ikke tenke på alle ordene det kan hete: Tilbudsvakt søker også etter synonymer (håndklede, håndduk, håndklær), bøyninger (teskje/teskjeer) og sammensatte ord (badehåndkle, bjørkeved), men ikke ting som bare ligner (håndklestativ, vedovn).</li>
        <li><b>To ganger om dagen</b> sjekkes kundeaviser fra dagligvare, Europris, Jula, Clas Ohlson, byggvare og mer (eTilbudsavis), og dagligvarepriser fra Kassalapp.</li>
        <li><b>Du får varsel</b> som en kommentar på ønsket i GitHub-appen. Slå på varsler i GitHub-appen på telefonen. Vil du heller ha varsel via <a href="https://ntfy.sh" target="_blank" rel="noopener">ntfy</a>, legg et hemmelig emnenavn i repo-secret <code>NTFY_TOPIC</code> og abonner på det samme navnet i ntfy-appen.</li>
        <li><b>Kjøpt det?</b> Trykk «Kjøpt / fjern» og lukk ønsket, så stopper varslene.</li>
      </ol>
      <p class="liten"><b>Dagligvarer med prishistorikk:</b> lag en gratis nøkkel på <a href="https://kassal.app/api" target="_blank" rel="noopener">kassal.app/api</a> og legg den som repo-secret <code>KASSALAPP_API_SECRET</code> (GitHub → Settings → Secrets and variables → Actions). Da varsles du også når en dagligvare er minst 10 % billigere enn den har vært de siste 60 dagene.</p>`,
  },
  en: {
    nyTittel: 'What do you need?', nyPlaceholder: 'E.g. towel, teaspoons, firewood, coffee (Norwegian works best)', leggTil: 'Add',
    sokerOgsa: 'Also searching for:', flereValg: 'More options', makspris: 'Max price (NOK)',
    andreOrd: 'Other names for it (comma separated)', andreOrdPh: 'E.g. frottéklut, gjestehåndkle',
    unnga: 'Ignore results containing (comma separated)', unngaPh: 'E.g. papir, stativ',
    butikker: 'Only these stores (empty = all)', butikkerPh: 'E.g. Europris, Jysk, Kiwi',
    leggTilHjelp: 'The wish is saved on GitHub. Tap “Create” / “Submit new issue” on the page that opens and offers are checked right away.',
    listeTittel: 'Your wishlist', oppdater: 'Refresh', laster: 'Loading …',
    testTittel: 'Test a product name', testHjelp: 'Paste a product name to see whether it would match your wishes.',
    testPh: 'E.g. “Frotté håndduk 50x70”', infoTittel: 'How it works',
    tom: 'No wishes yet. Type something you need above and Tilbudsvakt will keep watch.',
    ingenTilbud: 'No offers right now. You’ll be notified when something shows up.',
    venter: 'New wish – the first check is running. Refresh in a couple of minutes.',
    tilbud: (n) => (n === 1 ? '1 offer' : `${n} offers`),
    maks: (p) => `max ${p}`, kun: (b) => `only ${b}`,
    rediger: 'Edit', kjopt: 'Bought / remove', se: 'See offer', for: 'was', til: 'until', fra: 'from',
    viaSynonym: (t) => `matched “${t}”`,
    sistSjekket: (d) => `Last checked ${d}`, aldriSjekket: 'Not checked yet – the first check runs when you add a wish.',
    utenNett: 'Offline – showing last saved data.',
    kassalMangler: 'Groceries with price history are not enabled yet (see “How it works”).',
    kildeFeil: (n) => `${n} did not respond at the last check.`,
    testIngen: 'None of your wishes would match this.', testIngenOnsker: 'Add a wish first.',
    testTreff: (o, t, g) => `✔ Matches “${o}” via “${t}” (${g})`,
    grunner: { eksakt: 'same word', 'bøyning': 'inflected form', sammensatt: 'compound word', skrivefeil: 'near match' },
    flere: (n) => `+${n} more`, faerre: 'show fewer', visAlle: (n) => `Show all ${n} offers`,
    info: `
      <ol>
        <li><b>Type what you need</b>, ideally in Norwegian. Tilbudsvakt also searches synonyms (håndklede, håndduk, håndklær), inflections and compound words (badehåndkle, bjørkeved), but not things that merely look similar (håndklestativ, vedovn).</li>
        <li><b>Twice a day</b> it checks flyers from grocery chains, Europris, Jula, Clas Ohlson, DIY stores and more (eTilbudsavis), plus grocery prices from Kassalapp.</li>
        <li><b>You get notified</b> as a comment on the wish in the GitHub app. Turn on notifications in the GitHub mobile app. Prefer <a href="https://ntfy.sh" target="_blank" rel="noopener">ntfy</a>? Put a secret topic name in the repo secret <code>NTFY_TOPIC</code> and subscribe to it in the ntfy app.</li>
        <li><b>Bought it?</b> Tap “Bought / remove” and close the wish to stop notifications.</li>
      </ol>
      <p class="liten"><b>Groceries with price history:</b> create a free key at <a href="https://kassal.app/api" target="_blank" rel="noopener">kassal.app/api</a> and add it as the repo secret <code>KASSALAPP_API_SECRET</code>. You’ll then also be notified when a grocery item is at least 10% cheaper than in the last 60 days.</p>`,
  },
};
let sprak = (() => { try { return localStorage.getItem('sprak') || 'nb'; } catch { return 'nb'; } })();
const t = (k) => T[sprak][k] ?? T.nb[k];

// ---------- Hjelpere ----------
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const kr = (n) => (n == null ? '' : new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', minimumFractionDigits: n % 1 ? 2 : 0 }).format(n));
const dato = (s) => (s ? new Date(s).toLocaleDateString(sprak === 'en' ? 'en-GB' : 'nb-NO', { day: 'numeric', month: 'short' }) : '');
const tidspunkt = (s) => new Date(s).toLocaleString(sprak === 'en' ? 'en-GB' : 'nb-NO', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const trygt = (url) => (/^https?:\/\//i.test(url ?? '') ? url : null);
const lagre = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const hentLagret = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };

// ---------- Data ----------
let onsker = [];   // fra GitHub issues (live)
let funn = null;   // fra data/funn.json
let utenNett = false;

async function hentJson(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function lastInn() {
  utenNett = false;
  const [iss, f] = await Promise.allSettled([
    hentJson(`https://api.github.com/repos/${EIER}/${REPO}/issues?state=open&labels=${encodeURIComponent(ETIKETT)}&per_page=100`),
    // raw.githubusercontent er oppdatert straks sjekken har kjørt; lokal kopi som reserve.
    hentJson(`https://raw.githubusercontent.com/${EIER}/${REPO}/main/data/funn.json?t=${Date.now()}`)
      .catch(() => hentJson(`data/funn.json?t=${Date.now()}`)),
  ]);
  if (iss.status === 'fulfilled') {
    onsker = iss.value.filter((i) => !i.pull_request).map(lesOnske).filter((o) => o.tittel);
    lagre('onsker', onsker);
  } else {
    onsker = hentLagret('onsker') ?? (funn?.onsker ?? []);
    utenNett = true;
  }
  if (f.status === 'fulfilled') {
    funn = f.value;
    lagre('funn', funn);
  } else {
    funn = hentLagret('funn');
    utenNett = true;
  }
  if (iss.status !== 'fulfilled' && funn?.onsker?.length && !hentLagret('onsker')) onsker = funn.onsker;
  tegn();
}

// ---------- Tegning ----------
function tegnStatus() {
  const deler = [];
  if (utenNett) deler.push(t('utenNett'));
  deler.push(funn?.oppdatert ? t('sistSjekket')(tidspunkt(funn.oppdatert)) : t('aldriSjekket'));
  const k = funn?.kilder ?? {};
  const feil = Object.values(k).filter((x) => String(x.status).startsWith('feil')).map((x) => x.navn);
  if (feil.length) deler.push(t('kildeFeil')(feil.join(', ')));
  if (k.kassalapp?.status === 'mangler nøkkel') deler.push(t('kassalMangler'));
  $('#status').textContent = deler.join(' ');
}

function brikker(termer, vis = 6) {
  const synlige = termer.slice(0, vis).map((x) => `<span class="brikke">${esc(x)}</span>`).join('');
  const rest = termer.length - vis;
  if (rest <= 0) return synlige;
  const skjult = termer.slice(vis).map((x) => `<span class="brikke">${esc(x)}</span>`).join('');
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
      </div>
      <div class="pris">
        <div class="naa">${esc(kr(x.pris))}</div>
        ${x.forpris ? `<div class="for">${esc(t('for'))} ${esc(kr(x.forpris))}</div>` : ''}
        ${rabatt > 0 ? `<div class="rabatt">−${rabatt}%</div>` : ''}
      </div>
    </li>`;
}

function tegnOnsker() {
  const boks = $('#onsker');
  if (!onsker.length) {
    boks.innerHTML = `<p class="tom">${esc(t('tom'))}</p>`;
    return;
  }
  const resultat = new Map((funn?.onsker ?? []).map((o) => [o.nr, o]));
  boks.innerHTML = onsker.map((o) => {
    const r = resultat.get(o.nr);
    const plan = utvid(o);
    const liste = r?.funn ?? [];
    const meta = [o.makspris ? t('maks')(kr(o.makspris)) : '', o.butikker.length ? t('kun')(o.butikker.join(', ')) : '']
      .filter(Boolean).join(' · ');
    const issue = `${REPO_URL}/issues/${o.nr}`;
    return `
      <article class="onske kort${liste.length ? ' har-tilbud' : ''}">
        <header class="onske-topp">
          <div>
            <h3>${esc(o.tittel)}</h3>
            ${meta ? `<p class="liten">${esc(meta)}</p>` : ''}
          </div>
          <span class="teller${liste.length ? ' aktiv' : ''}">${esc(t('tilbud')(liste.length))}</span>
        </header>
        <div class="brikker">${brikker(plan.termer.filter((x) => x !== o.tittel.toLowerCase()))}</div>
        ${liste.length
          ? `<ul class="tilbudsliste">${liste.slice(0, 6).map(tilbudHtml).join('')}</ul>${liste.length > 6
              ? `<details class="flere-tilbud"><summary>${esc(t('visAlle')(liste.length))}</summary><ul class="tilbudsliste">${liste.slice(6).map(tilbudHtml).join('')}</ul></details>` : ''}`
          : `<p class="liten svak">${esc(r ? t('ingenTilbud') : t('venter'))}</p>`}
        <div class="handlinger">
          <a class="knapp tekst" href="${esc(issue)}" target="_blank" rel="noopener">${esc(t('rediger'))}</a>
          <a class="knapp tekst" href="${esc(issue)}#issue-comment-box" target="_blank" rel="noopener">${esc(t('kjopt'))}</a>
        </div>
      </article>`;
  }).join('');
}

function tegnForhand() {
  const tittel = $('#ny-ord').value.trim();
  const ekstra = liste($('#ny-ekstra').value);
  const boks = $('#forhand');
  if (!tittel) { boks.hidden = true; return; }
  const plan = utvid({ tittel, ekstra, unnga: liste($('#ny-unnga').value) });
  const andre = plan.termer.filter((x) => x !== tittel.toLowerCase());
  boks.hidden = !andre.length;
  $('#forhand-brikker').innerHTML = brikker(andre, 10);
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
}

function tegn() {
  oversett();
  tegnStatus();
  tegnOnsker();
  tegnForhand();
  tegnTest();
}

// ---------- Hendelser ----------
$('#ny-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const tittel = $('#ny-ord').value.trim();
  if (!tittel) return;
  const pris = $('#ny-pris').value.trim();
  const linjer = [
    pris ? `Makspris: ${pris}` : '',
    $('#ny-ekstra').value.trim() ? `Andre ord: ${$('#ny-ekstra').value.trim()}` : '',
    $('#ny-unnga').value.trim() ? `Unngå: ${$('#ny-unnga').value.trim()}` : '',
    $('#ny-butikker').value.trim() ? `Butikker: ${$('#ny-butikker').value.trim()}` : '',
  ].filter(Boolean);
  const body = [
    ...linjer,
    '',
    '<!-- Tilbudsvakt: du kan endre linjene over når som helst. Felt: Makspris, Andre ord, Unngå, Butikker. Lukk ønsket når du har kjøpt det. -->',
  ].join('\n');
  const p = new URLSearchParams({ title: tittel, body, labels: ETIKETT });
  window.open(`${REPO_URL}/issues/new?${p}`, '_blank', 'noopener');
  e.target.reset();
  tegnForhand();
  // Hent på nytt når brukeren kommer tilbake fra GitHub.
  setTimeout(lastInn, 4000);
});

['#ny-ord', '#ny-ekstra', '#ny-unnga'].forEach((s) => $(s).addEventListener('input', tegnForhand));
$('#test-ord').addEventListener('input', tegnTest);
$('#oppdater').addEventListener('click', lastInn);
$('#sprak').addEventListener('click', () => {
  sprak = sprak === 'en' ? 'nb' : 'en';
  try { localStorage.setItem('sprak', sprak); } catch {}
  tegn();
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) lastInn(); });

// ---------- Oppstart ----------
$('#versjon').textContent = `v${VERSJON}`;
$('#bunn-versjon').textContent = `Tilbudsvakt v${VERSJON}`;
$('#repo-lenke').href = REPO_URL;
funn = hentLagret('funn');
onsker = hentLagret('onsker') ?? [];
tegn();
lastInn();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
