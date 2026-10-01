const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// Only inspect candidates; installation and human listening approval are separate gates.
function checkVoiceSet(directory, manifestPath) {
  const errors = [], details = [];
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const block = html.split('const VOICE_MAP = {')[1].split('};')[0];
  const expected = new Map([...block.matchAll(/'([^']+)': '(voice\/v\d{2}\.wav)'/g)].map(([, text, file]) => [file, text]));
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (expected.size !== 36) throw new Error('Expected 36 game phrases');
  if (!Array.isArray(manifest.files)) throw new Error('Manifest files must be an array');
  const seen = new Set();
  for (const entry of manifest.files) {
    if (!expected.has(entry.file)) { errors.push(`unexpected path: ${entry.file}`); continue; }
    if (seen.has(entry.file)) { errors.push(`duplicate: ${entry.file}`); continue; }
    seen.add(entry.file);
    if (entry.text !== expected.get(entry.file)) errors.push(`${entry.file}: text mismatch`);
    const filename = path.join(directory, path.basename(entry.file));
    if (!fs.existsSync(filename)) { errors.push(`${entry.file}: missing`); continue; }
    const wav = fs.readFileSync(filename);
    const digest = crypto.createHash('sha256').update(wav).digest('hex');
    if (digest !== entry.sha256) errors.push(`${entry.file}: sha256 mismatch`);
    try {
      if (wav.length < 44 || wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE' || wav.readUInt32LE(4) + 8 !== wav.length) throw new Error('invalid WAV header or size');
      let format, data, offset = 12;
      while (offset < wav.length) {
        if (offset + 8 > wav.length) throw new Error('invalid WAV chunk boundary');
        const size = wav.readUInt32LE(offset + 4), end = offset + 8 + size;
        if (end > wav.length) throw new Error('invalid WAV chunk size');
        if (end + (size % 2) > wav.length) throw new Error('invalid WAV chunk boundary');
        const name = wav.toString('ascii', offset, offset + 4);
        if (name === 'fmt ') format = wav.subarray(offset + 8, end);
        if (name === 'data') data = wav.subarray(offset + 8, end);
        offset = end + (size % 2);
      }
      if (!format || format.length < 16 || !data || data.length % 2) throw new Error('invalid WAV chunks');
      if (format.readUInt16LE(0) !== 1 || format.readUInt16LE(2) !== 1 || format.readUInt32LE(4) !== 24000 || format.readUInt32LE(8) !== 48000 || format.readUInt16LE(12) !== 2 || format.readUInt16LE(14) !== 16) throw new Error('expected 24000 Hz mono PCM16');
      const frames = data.length / 2, duration = frames / 24000;
      if (duration < .6 || duration > 20) throw new Error('unexpected duration');
      let energy = 0, sum = 0, peak = 0, clipped = 0, quietRun = 0, longestQuiet = 0;
      for (let n = 0; n < data.length; n += 2) {
        const sample = data.readInt16LE(n), amplitude = Math.abs(sample);
        energy += sample * sample; sum += sample; peak = Math.max(peak, amplitude);
        if (amplitude >= 32760) clipped++;
      }
      // A constant DC offset carries energy but no speech, so remove its contribution.
      const rms = Math.sqrt(Math.max(0, energy / frames - (sum / frames) ** 2)), clippingRatio = clipped / frames;
      // Measure quiet windows, not individual zero-crossings within normal speech.
      for (let n = 0; n < data.length; n += 960) {
        let windowEnergy = 0, windowSum = 0, count = 0;
        for (let i = n; i < Math.min(n + 960, data.length); i += 2) { const s = data.readInt16LE(i); windowEnergy += s * s; windowSum += s; count++; }
        const windowRms = Math.sqrt(Math.max(0, windowEnergy / count - (windowSum / count) ** 2));
        quietRun = windowRms < 180 ? quietRun + count : 0;
        longestQuiet = Math.max(longestQuiet, quietRun);
      }
      if (rms < 100 || peak < 1000) errors.push(`${entry.file}: silent or inaudible`);
      if (clippingRatio > .01) errors.push(`${entry.file}: clipping exceeds 1%`);
      if (longestQuiet / 24000 > 2) errors.push(`${entry.file}: silence exceeds 2 seconds`);
      details.push({ file: entry.file, durationSeconds: Number(duration.toFixed(4)), rms: Number(rms.toFixed(2)), peak, clippingPercent: Number((clippingRatio * 100).toFixed(4)), longestQuietSeconds: Number((longestQuiet / 24000).toFixed(3)) });
    } catch (error) { errors.push(`${entry.file}: ${error.message}`); }
  }
  for (const file of expected.keys()) if (!seen.has(file)) errors.push(`${file}: missing manifest entry`);
  return { expected: expected.size, inspected: details.length, errors, details };
}

if (require.main === module) {
  try {
    const [directory, manifestPath] = process.argv.slice(2);
    if (!directory || !manifestPath) throw new Error('Usage: node scripts/check-voice-recordings.js AUDIO_DIR MANIFEST_JSON');
    const result = checkVoiceSet(directory, manifestPath);
    console.log(JSON.stringify(result, null, 2));
    console.log(`${result.inspected}/${result.expected} files inspected; listening and transcription approval still required.`);
    if (result.errors.length) { console.error(result.errors.join('\n')); process.exitCode = 1; }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { checkVoiceSet };
