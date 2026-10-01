const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const test = require('node:test');
const { spawnSync } = require('node:child_process');
const ROOT = path.join(__dirname, '..');
const checker = path.join(ROOT, 'scripts/check-voice-recordings.js');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const map = html.split('const VOICE_MAP = {')[1].split('};')[0];
const entries = [...map.matchAll(/'([^']+)': '(voice\/v\d{2}\.wav)'/g)];

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'voice-check-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const wav = Buffer.alloc(44 + 24000 * 2);
  wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(24000, 24); wav.writeUInt32LE(48000, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
  for (let n = 0; n < 24000; n++) wav.writeInt16LE(Math.round(4000 * Math.sin(n * Math.PI / 24)), 44 + n * 2);
  const manifest = { referenceIsSynthetic: true, files: entries.map(([, text, file]) => {
    fs.writeFileSync(path.join(dir, path.basename(file)), wav);
    return { file, text, sha256: crypto.createHash('sha256').update(wav).digest('hex') };
  }) };
  const manifestPath = path.join(dir, 'manifest.json');
  return { dir, manifest, manifestPath, run() {
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    return spawnSync(process.execPath, [checker, dir, manifestPath], { encoding: 'utf8' });
  } };
}

test('voice checker accepts a complete matching PCM set without changing files', t => {
  const f = fixture(t), before = fs.readFileSync(path.join(f.dir, 'v00.wav'));
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /36\/36/);
  assert.deepEqual(fs.readFileSync(path.join(f.dir, 'v00.wav')), before);
});

test('voice checker refuses an incomplete set before it can be released', t => {
  const f = fixture(t); fs.unlinkSync(path.join(f.dir, 'v35.wav'));
  const result = f.run();
  assert.equal(result.status, 1); assert.match(result.stderr, /v35\.wav.*missing/);
});

test('voice checker refuses a duplicate manifest mapping', t => {
  const f = fixture(t); f.manifest.files[35] = { ...f.manifest.files[0] };
  const result = f.run();
  assert.equal(result.status, 1); assert.match(result.stderr, /duplicate/);
});

test('voice checker detects a wrong transcript and altered audio bytes', t => {
  const f = fixture(t); f.manifest.files[0].text = '另一条指令';
  f.manifest.files[1].sha256 = '0'.repeat(64);
  const result = f.run();
  assert.equal(result.status, 1); assert.match(result.stderr, /text mismatch/);
  assert.match(result.stderr, /sha256 mismatch/);
});

test('voice checker rejects truncated data rather than trusting the WAV extension', t => {
  const f = fixture(t); fs.writeFileSync(path.join(f.dir, 'v00.wav'), Buffer.from('RIFF'));
  const result = f.run();
  assert.equal(result.status, 1); assert.match(result.stderr, /invalid WAV/);
});

test('voice checker rejects silent or overloaded recordings', t => {
  const f = fixture(t);
  for (const [name, level] of [['v00.wav', 0], ['v01.wav', 32767]]) {
    const wav = fs.readFileSync(path.join(f.dir, name));
    for (let n = 44; n < wav.length; n += 2) wav.writeInt16LE(level, n);
    fs.writeFileSync(path.join(f.dir, name), wav);
  }
  const result = f.run();
  assert.equal(result.status, 1); assert.match(result.stderr, /silent/); assert.match(result.stderr, /clipping/);
});

test('voice checker rejects unexpected or unsafe manifest paths', t => {
  const f = fixture(t); f.manifest.files[0].file = '../v00.wav';
  const result = f.run();
  assert.equal(result.status, 1); assert.match(result.stderr, /unexpected path/);
});

test('voice checker rejects an incompatible audio encoding', t => {
  const f = fixture(t), filename = path.join(f.dir, 'v00.wav');
  const wav = fs.readFileSync(filename); wav.writeUInt16LE(3, 20);
  fs.writeFileSync(filename, wav);
  const result = f.run();
  assert.equal(result.status, 1); assert.match(result.stderr, /expected 24000 Hz mono PCM16/);
});

test('voice checker flags an excessive silent tail in an otherwise audible recording', t => {
  const f = fixture(t), filename = path.join(f.dir, 'v00.wav');
  const wav = Buffer.concat([fs.readFileSync(filename), Buffer.alloc(24000 * 2 * 3)]);
  wav.writeUInt32LE(wav.length - 8, 4); wav.writeUInt32LE(wav.length - 44, 40);
  fs.writeFileSync(filename, wav);
  const result = f.run();
  assert.equal(result.status, 1); assert.match(result.stderr, /silence exceeds 2 seconds/);
});

test('voice checker rejects trailing bytes and a missing odd-chunk padding byte', t => {
  const f = fixture(t), filename = path.join(f.dir, 'v00.wav');
  const original = fs.readFileSync(filename);
  const oddChunk = Buffer.alloc(9); oddChunk.write('JUNK'); oddChunk.writeUInt32LE(1, 4);
  for (const tail of [Buffer.from([0]), oddChunk]) {
    const wav = Buffer.concat([original, tail]); wav.writeUInt32LE(wav.length - 8, 4);
    fs.writeFileSync(filename, wav);
    f.manifest.files[0].sha256 = crypto.createHash('sha256').update(wav).digest('hex');
    const result = f.run();
    assert.equal(result.status, 1); assert.match(result.stderr, /invalid WAV chunk boundary/);
  }
});

test('voice checker treats a constant DC offset as inaudible rather than speech', t => {
  const f = fixture(t), filename = path.join(f.dir, 'v00.wav');
  const wav = fs.readFileSync(filename);
  for (let n = 44; n < wav.length; n += 2) wav.writeInt16LE(4000, n);
  fs.writeFileSync(filename, wav);
  f.manifest.files[0].sha256 = crypto.createHash('sha256').update(wav).digest('hex');
  const result = f.run();
  assert.equal(result.status, 1); assert.match(result.stderr, /silent or inaudible/);
});
