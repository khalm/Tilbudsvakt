import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slaSammen, leggTil, oppsummer, fraKassalBulk, sparklinje, tynn } from '../lib/historikk.js';

test('slå sammen og oppsummer', () => {
  const s = slaSammen([['2026-10-01', 30], ['2026-10-02', 25]], [['2026-10-02', 28], ['2026-09-20', 35]]);
  assert.deepEqual(s, [['2026-09-20', 35], ['2026-10-01', 30], ['2026-10-02', 25]]);
  const o = oppsummer(s, 25);
  assert.equal(o.lavest, 25);
  assert.equal(o.hoyest, 35);
  assert.ok(o.naaErLavest);
  assert.equal(o.vanlig, 32.5);
});

test('leggTil kutter gammelt', () => {
  const s = leggTil([['2025-01-01', 10]], '2026-10-18', 12, 180);
  assert.deepEqual(s, [['2026-10-18', 12]]);
});

test('kassal bulk', () => {
  const r = fraKassalBulk({ data: [{ stores: [{ store: 'SPAR_NO', name: 'SPAR', current_price: '87.90' }, { store: 'BUNNPRIS', name: 'Bunnpris', current_price: '70.00' }],
    price_history: [{ price: 87.9, date: '2026-10-18', store: 'SPAR_NO' }, { price: 99, date: '2026-10-01', store: 'SPAR_NO' }] }] });
  assert.deepEqual(r.perButikk.SPAR, [['2026-10-01', 99], ['2026-10-18', 87.9]]);
  assert.equal(r.naa[0].butikk, 'Bunnpris');
});

test('sparklinje og tynning', () => {
  assert.match(sparklinje([['2026-10-01', 99], ['2026-10-18', 87.9]]), /<svg/);
  assert.equal(sparklinje([['2026-10-01', 99]]), '');
  const lang = Array.from({ length: 200 }, (_, i) => [`2026-01-${String((i % 28) + 1).padStart(2, '0')}`, 50 + (i % 7)]);
  assert.ok(tynn(lang, 60).length <= 70);
});
