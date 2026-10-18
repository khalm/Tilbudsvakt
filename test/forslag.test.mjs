import { test } from 'node:test';
import assert from 'node:assert/strict';
import { utvid } from '../lib/matcher.js';
import { rangerForslag, fraTilbud } from '../lib/forslag.js';

test('forslag rangeres: ordbok > beslektet > tilbud, dekkede ord utelates', () => {
  const plan = utvid({ tittel: 'håndkle' });
  const avviste = [
    { tittel: 'Frottéklut 6-pk', butikk: 'Jysk' },
    { tittel: 'Frottéklut hvit', butikk: 'Europris' },
    { tittel: 'Frottéklut', butikk: 'Kid' },
    { tittel: 'Håndklestativ', butikk: 'Jula' },
    { tittel: 'Badekåpe grå', butikk: 'Jysk' },
  ];
  const f = rangerForslag({ plan, ordbok: ['vaskeklut', 'håndklede'], avviste });
  const ord = f.map((x) => x.ord);
  assert.equal(ord[0], 'vaskeklut');           // ordbok først
  assert.ok(ord.includes('strandlaken'));      // beslektet gruppe (badelaken)
  assert.ok(!ord.includes('håndklede'));       // allerede i søket
  assert.ok(!ord.includes('hvit'));            // fyllord
  assert.ok(ord.indexOf('vaskeklut') < ord.indexOf('strandlaken'));
  assert.ok(!ord.includes('frottéklut'));      // ord fra tilbudstitler brukes ikke (for mye støy)
  assert.ok(!ord.includes('strandhåndkle'));   // dekket: sammensatt med håndkle
});

test('ett enkelt tilbud i én butikk blir ikke foreslått', () => {
  const plan = utvid({ tittel: 'ved' });
  assert.deepEqual(fraTilbud([{ tittel: 'Pizzaovn gass', butikk: 'Obs' }], plan), []);
});

test('teskje foreslår andre skjeer (samme siste ledd)', () => {
  const plan = utvid({ tittel: 'teskje' });
  const ord = rangerForslag({ plan }).map((x) => x.ord);
  assert.ok(ord.includes('spiseskje'), ord.join(','));
});

test('lærte synonymer fra egne ønsker rangeres høyt', () => {
  const plan = utvid({ tittel: 'håndkle' });
  const f = rangerForslag({ plan, laerte: [['håndkle', 'frottéklut']] });
  assert.equal(f[0].ord, 'frottéklut');
});
