import { test } from 'node:test';
import assert from 'node:assert/strict';
import { utvid, passer, lesOnske, stamme, brett } from '../lib/matcher.js';

const plan = (tittel, ekstra = {}) => utvid({ tittel, ...ekstra });
const treff = (tekst, p) => passer(tekst, p) !== null;

test('håndkle treffer synonymer og bøyninger', () => {
  const p = plan('håndkle');
  for (const t of [
    'Håndklede 50x70 cm', 'Frotté håndduk, flere farger', 'Håndklær 4-pk',
    'Badehåndkle 70x140', 'Gjestehåndkleder 2 stk', 'Bade-håndkle i bomull',
    'HANDKLE grå', 'Kjøkkenhåndkle 3-pk', 'Frottéhåndkleet', 'Badelaken XL',
  ]) assert.ok(treff(t, p), t);
});

test('håndkle treffer ikke feil ting', () => {
  const p = plan('håndkle');
  for (const t of ['Håndklestativ i stål', 'Tørkepapir 8 ruller', 'Håndkleholder', 'Dusjforheng'])
    assert.ok(!treff(t, p), t);
});

test('teskje treffer flertall og kaffeskje', () => {
  const p = plan('teskjeer');
  for (const t of ['Teskje 6-pk', 'Teskjer i rustfritt stål', 'Kaffeskjeer 4 stk', 'Teskjeene'])
    assert.ok(treff(t, p), t);
  assert.ok(!treff('Spiseskje 6 stk', p));
});

test('ved: sammensatt treffer, vedovn gjør ikke', () => {
  const p = plan('ved');
  for (const t of ['Bjørkeved 40 liter', 'Storsekk ved 1000L', 'Blandingsved', 'Kubber av bjørk'])
    assert.ok(treff(t, p), t);
  for (const t of ['Vedovn Jøtul', 'Vedkurv i filt', 'Svedbånd', 'Vedlikeholdsspray'])
    assert.ok(!treff(t, p), t);
});

test('skrivefeil i ønsket tåles', () => {
  const p = plan('håndklde');
  assert.ok(treff('Håndkle 50x70', p));
});

test('fraser: blå håndkle', () => {
  const p = plan('blå håndkle');
  assert.ok(treff('Håndklede, blå 50x70', p));
  assert.ok(!treff('Håndklede, grå 50x70', p));
});

test('dagligvarer: melk, poteter, kaffe', () => {
  assert.ok(treff('TINE Lettmelk 1L', plan('melk')));
  assert.ok(treff('Mjølk 1,75 liter', plan('melk')));
  assert.ok(treff('Mandelpoteter 1 kg', plan('poteter')));
  assert.ok(!treff('Potetgull 250g', plan('poteter')));
  assert.ok(treff('Friele Frokostkaffe filtermalt', plan('kaffe')));
  assert.ok(!treff('Kaffetrakter Moccamaster', plan('kaffe')));
  assert.ok(!treff('Pris per kg', plan('ris')));
});

test('egne unngå-ord og andre ord', () => {
  const p = plan('håndkle', { unnga: ['hvit'], ekstra: ['frottéklut'] });
  assert.ok(!treff('Håndkle hvit 50x70', p));
  assert.ok(treff('Frottéklut 6-pk', p));
});

test('lesOnske leser felt fra issue', () => {
  const o = lesOnske({ number: 3, title: 'Ønske: Håndkle', body: 'Makspris: 199,90 kr\nAndre ord: badelaken\nUnngå: papir, rull\nButikker: Jysk, Europris' });
  assert.equal(o.tittel, 'Håndkle');
  assert.equal(o.makspris, 199.9);
  assert.deepEqual(o.ekstra, ['badelaken']);
  assert.deepEqual(o.unnga, ['papir', 'rull']);
  assert.deepEqual(o.butikker, ['Jysk', 'Europris']);
});

test('stamme og brett', () => {
  assert.equal(brett('Frotté-Håndkle'), 'frotte handkle');
  assert.equal(stamme('teskjeer'), stamme('teskje'));
  assert.equal(stamme('handkleder'), stamme('handklede'));
});
