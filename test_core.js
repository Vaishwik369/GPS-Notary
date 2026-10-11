const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
const m = html.match(/\/\/ ==CORE-START==([\s\S]*?)\/\/ ==CORE-END==/);
if (!m) { console.log('FAIL: core markers not found'); process.exit(1); }
const api = new Function(m[1] + '; return {CFG,haversine,evaluateFix,scoreFrom,stableStringify,appendEvidence,verifyChain};')();
const { evaluateFix, scoreFrom, appendEvidence, verifyChain, haversine } = api;

let pass = 0, fail = 0;
function check(name, cond){ if (cond){ pass++; console.log('PASS', name); } else { fail++; console.log('FAIL', name); } }
const T0 = 1_800_000_000_000;
const mk = (lat, lon, tSec, extra = {}) => Object.assign({ lat, lon, acc: 6, speed: null, t: T0 + tSec * 1000 }, extra);
const ctx = (tSec, extra = {}) => Object.assign({ mode: 'foot', motion: { available: true, stillMs: 0 }, anchor: null, nowMs: T0 + tSec * 1000, tzOffsetMin: null }, extra);
const codes = fl => fl.map(f => f.code);

// 1. Normal walking: ~1.4 m/s, no flags
let a = mk(28.6139, 77.2090, 0), b = mk(28.6139 + 0.0000126, 77.2090, 1);
check('normal walking is clean', evaluateFix(b, a, ctx(1)).length === 0);

// 2. Teleport 60 km in 1 s -> JUMP
let c = mk(28.6139, 77.2090 + 0.55, 2);
check('60 km teleport flagged JUMP', codes(evaluateFix(c, b, ctx(2))).includes('JUMP'));

// 3. Teleport in vehicle mode at 60 km in 1 s still flagged
check('teleport flagged in vehicle mode', codes(evaluateFix(c, b, ctx(2, { mode: 'vehicle' }))).includes('JUMP'));

// 4. Car at 25 m/s must NOT be flagged in vehicle mode
let car1 = mk(28.6, 77.2, 0), car2 = mk(28.6 + 25 / 111000, 77.2, 1);
check('car at 90 km/h not flagged (vehicle mode)', evaluateFix(car2, car1, ctx(1, { mode: 'vehicle' })).length === 0);

// 5. Slow drift while phone is still -> STILL_DRIFT but not JUMP
const anchor = mk(28.6139, 77.2090, 0);
const drifted = mk(28.6139 + 0.0006, 77.2090, 25); // ~67 m
const f5 = evaluateFix(drifted, mk(28.6139 + 0.00057, 77.2090, 24), ctx(25, { motion: { available: true, stillMs: 25000 }, anchor }));
check('slow drift caught by motion check', codes(f5).includes('STILL_DRIFT') && !codes(f5).includes('JUMP'));

// 6. Same drift but phone is moving (stillMs 0) -> not flagged
const f6 = evaluateFix(drifted, mk(28.6139 + 0.00057, 77.2090, 24), ctx(25, { motion: { available: true, stillMs: 0 }, anchor: null }));
check('walking person not flagged as drift', !codes(f6).includes('STILL_DRIFT'));

// 7. Vehicle mode ignores STILL_DRIFT
const f7 = evaluateFix(drifted, mk(28.6139 + 0.00057, 77.2090, 24), ctx(25, { mode: 'vehicle', motion: { available: true, stillMs: 25000 }, anchor }));
check('vehicle mode does not use still-drift', !codes(f7).includes('STILL_DRIFT'));

// 8. No motion sensor -> no STILL_DRIFT
const f8 = evaluateFix(drifted, null, ctx(25, { motion: { available: false, stillMs: 0 }, anchor }));
check('no sensor means no motion verdict', !codes(f8).includes('STILL_DRIFT'));

// 9. Noisy indoor GPS (acc 150 m, 90 m wobble) must not flag drift or jump
const noisyA = mk(28.6139, 77.2090, 0, { acc: 150 }), noisyB = mk(28.6139 + 0.0008, 77.2090, 1, { acc: 150 });
const f9 = evaluateFix(noisyB, noisyA, ctx(1, { motion: { available: true, stillMs: 30000 }, anchor: noisyA }));
check('noisy low-accuracy fix tolerated', f9.length === 0);

// 10. Clock shift +120 s -> CLOCK_SKEW
check('clock shift flagged', codes(evaluateFix(mk(28.6, 77.2, 120), null, ctx(0))).includes('CLOCK_SKEW'));

// 11. Speed mismatch
const sA = mk(28.6, 77.2, 0), sB = mk(28.6 + 200 / 111000, 77.2, 2, { speed: 1 });
check('speed mismatch flagged', codes(evaluateFix(sB, sA, ctx(2, { mode: 'vehicle' }))).includes('SPEED_MISMATCH'));

// 12. Timezone region: IST device (offset -330) with GPS in London -> flagged; in Delhi -> clean
check('timezone mismatch flagged', codes(evaluateFix(mk(51.5, -0.12, 0), null, ctx(0, { tzOffsetMin: -330 }))).includes('TZ_REGION'));
check('timezone match clean', !codes(evaluateFix(mk(28.6, 77.2, 0), null, ctx(0, { tzOffsetMin: -330 }))).includes('TZ_REGION'));

// 13. Score
let s = scoreFrom([{ code: 'JUMP', weight: 60, t: T0 }], T0 + 1000);
check('jump drops trust to 40, LIKELY SPOOFED', s.trust === 40 && s.label === 'LIKELY SPOOFED');
s = scoreFrom([{ code: 'JUMP', weight: 60, t: T0 }], T0 + 60000);
check('score recovers after window', s.trust === 100);
s = scoreFrom([{ code: 'CLOCK_SKEW', weight: 35, t: T0 }], T0 + 1000);
check('single minor flag is SUSPICIOUS', s.label === 'SUSPICIOUS');

// 14. Evidence chain
(async () => {
  const chain = [];
  await appendEvidence(chain, { type: 'session_start' });
  await appendEvidence(chain, { type: 'incident', code: 'JUMP', message: 'jump' });
  await appendEvidence(chain, { type: 'incident', code: 'CLOCK_SKEW', message: 'skew' });
  let v = await verifyChain(chain);
  check('fresh chain verifies', v.ok && v.length === 3);
  const roundTrip = JSON.parse(JSON.stringify(chain));
  v = await verifyChain(roundTrip);
  check('chain verifies after JSON round trip', v.ok);
  const bad = JSON.parse(JSON.stringify(chain));
  bad[1].event.message = 'edited';
  v = await verifyChain(bad);
  check('edited entry detected at #1', !v.ok && v.brokenAt === 1);
  const deleted = JSON.parse(JSON.stringify(chain)); deleted.splice(1, 1);
  v = await verifyChain(deleted);
  check('deleted entry detected', !v.ok);
  const reordered = JSON.parse(JSON.stringify(chain)); [reordered[1], reordered[2]] = [reordered[2], reordered[1]];
  v = await verifyChain(reordered);
  check('reordered entries detected', !v.ok);
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
