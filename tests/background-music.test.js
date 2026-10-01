const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('music loops quietly, ducks for speech, and stops for mute, home and background', () => {
  const sources = [], gains = [], voices = [], events = [];
  const button = { setAttribute() {} };
  const state = { muted: false, currentLevel: 0, audioCtx: {
    currentTime: 0, destination: {},
    createGain() { const node = { gain: { value: 0, cancelScheduledValues() {}, setTargetAtTime(value) { this.value = value; } }, connect() {}, disconnect() {} }; gains.push(node); return node; },
    createBufferSource() { const node = { connect() {}, disconnect() {}, start() { this.started = true; }, stop() { this.stopped = true; } }; sources.push(node); return node; }
  } };
  const document = { hidden: false, getElementById() { return button; }, addEventListener() {} };
  const context = { state, document, initAudio() {}, UnifiedDataManager: { active: true, logEvent(name, data) { events.push(data); } },
    Audio: class { constructor() { voices.push(this); } pause() {} play() { return Promise.resolve(); } }
  };
  const music = html.slice(html.indexOf('const BackgroundMusic ='), html.indexOf('function playTone('));
  const speech = html.slice(html.indexOf('let currentAudio ='), html.indexOf('function replayVoice('));
  vm.runInNewContext(`${music}\nconst VOICE_MAP = { one: 'one.wav', two: 'two.wav' };\n${speech}\nglobalThis.api = {BackgroundMusic, speak, toggleMute};`, context);
  const { BackgroundMusic: bgm, speak, toggleMute } = context.api;
  bgm.buffer = {};
  bgm.sync(); bgm.sync();
  assert.equal(sources.length, 1, 'only one music loop');
  assert.equal(sources[0].loop, true);
  assert.equal(gains[0].gain.value, 0.12);
  speak('one');
  assert.equal(gains[0].gain.value, 0.018);
  speak('two');
  voices[0].onended();
  assert.equal(gains[0].gain.value, 0.018, 'stale voice callback must not unduck');
  voices[1].onended();
  assert.equal(gains[0].gain.value, 0.12);
  document.hidden = true; bgm.sync();
  assert.equal(sources[0].stopped, true);
  document.hidden = false; bgm.sync();
  assert.equal(sources.length, 2);
  toggleMute();
  assert.equal(sources[1].stopped, true);
  toggleMute();
  assert.equal(sources.length, 3);
  bgm.toggle();
  assert.equal(sources[2].stopped, true);
  assert.equal(events.at(-1).backgroundMusic, 'off');
  bgm.toggle();
  state.currentLevel = -1; bgm.sync();
  assert.equal(sources[3].stopped, true);
});

test('music is a complete local WAV and research defaults to an opt-in checkbox', () => {
  const wav = fs.readFileSync(path.join(__dirname, '..', 'music/xylophone.wav'));
  assert.equal(wav.subarray(0, 4).toString(), 'RIFF');
  assert.equal(wav.readUInt32LE(24), 22050);
  assert.ok(wav.length > 800000);
  assert.match(html, /id="research-music"/);
  assert.doesNotMatch(html, /id="research-music"[^>]*checked/);
  assert.match(html, /BackgroundMusic.enabled = ResearchMode.active \? document.getElementById\('research-music'\)\?\.checked === true : true/);
});

test('replaying a preloaded voice starts at the beginning and ignores its old rejected play', () => {
  const players=[], rejections=[], ducks=[];
  const context={state:{muted:false},BackgroundMusic:{duck(value){ducks.push(value);}},
    Audio:class{constructor(src){this.src=src;players.push(this);}load(){}pause(){}play(){return {catch(fn){rejections.push(fn);}};}}};
  const speech=html.slice(html.indexOf('let currentAudio ='),html.indexOf('function toggleMute('));
  vm.runInNewContext(`const VOICE_MAP={one:'one.wav'};${speech};globalThis.speak=speak;`,context);
  context.speak('one');players[0].currentTime=2;
  context.speak('one');
  assert.equal(players.length,1,'reuse loaded recording rather than create a new player');
  assert.equal(players[0].currentTime,0);
  rejections[0]();
  assert.equal(ducks.at(-1),true,'an interrupted play failure must not unduck current replay');
  players[0].onended();assert.equal(ducks.at(-1),false);
});
