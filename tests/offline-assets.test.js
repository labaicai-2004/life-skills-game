const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('install manifest stays within the project scope and has two local icons', () => {
  const manifest = JSON.parse(read('manifest.webmanifest'));
  assert.equal(manifest.name, '生活小能手');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  for (const size of [192, 512]) {
    const icon = manifest.icons.find(entry => entry.sizes === `${size}x${size}`);
    assert.ok(icon, `missing ${size} icon`);
    const file = path.join(root, icon.src);
    assert.ok(fs.existsSync(file));
    const sips = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', file], {encoding:'utf8'});
    assert.match(sips, new RegExp(`pixelWidth: ${size}`));
    assert.match(sips, new RegExp(`pixelHeight: ${size}`));
  }
});

test('page references local install resources without runtime Google Fonts requests', () => {
  const html = read('index.html');
  assert.match(html, /<link rel="manifest" href="\.\/manifest\.webmanifest">/);
  assert.match(html, /<link rel="apple-touch-icon" href="\.\/assets\/icons\/icon-192\.png">/);
  assert.doesNotMatch(html, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
});

test('all three seven-step skills and their formal voice and music files remain present', () => {
  const html = read('index.html');
  const levelBlock = html.match(/const LEVELS = \[([\s\S]*?)\n\];/)?.[1] || '';
  assert.deepEqual([...levelBlock.matchAll(/\bid:'(laundry|fold-clothes|fold-umbrella)'/g)].map(match => match[1]), ['laundry', 'fold-clothes', 'fold-umbrella']);
  assert.equal([...levelBlock.matchAll(/\bvoice:/g)].length, 21);
  for (let i = 0; i < 36; i++) {
    assert.ok(fs.existsSync(path.join(root, 'voice', `v${String(i).padStart(2,'0')}.wav`)));
  }
  assert.ok(fs.existsSync(path.join(root, 'music/xylophone.wav')));
});
