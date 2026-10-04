const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'service-worker.js'), 'utf8');
const scope = 'https://example.test/life-skills-game/';

function harness({failedPath = '', initial = {}, clients = []} = {}) {
  const handlers = {};
  const cacheData = new Map(Object.entries(initial).map(([name, paths]) => [name, new Map(paths.map(p => [new URL(p, scope).href, {ok:true, url:new URL(p,scope).href, clone() {return this;}}]))]));
  let network = true;
  let activations = 0;
  class Channel {
    constructor() {
      this.port1 = {onmessage:null};
      this.port2 = {postMessage:value => this.port1.onmessage?.({data:value})};
    }
  }
  const cacheApi = {
    async open(name) {
      if (!cacheData.has(name)) cacheData.set(name, new Map());
      const entries = cacheData.get(name);
      return {
        async match(request) { return entries.get(new URL(typeof request === 'string' ? request : request.url, scope).href); },
        async put(request, response) { entries.set(new URL(typeof request === 'string' ? request : request.url, scope).href, response); },
        async keys() { return [...entries.keys()].map(url => ({url})); }
      };
    },
    async keys() { return [...cacheData.keys()]; },
    async delete(name) { return cacheData.delete(name); }
  };
  const context = {
    URL, Response,
    MessageChannel:Channel, setTimeout:(fn,ms) => setTimeout(fn, Math.min(ms,10)), clearTimeout,
    caches: cacheApi,
    fetch: async request => {
      const url = new URL(typeof request === 'string' ? request : request.url, scope).href;
      if (!network || (failedPath && url.endsWith(failedPath))) throw Error('network failed');
      return {ok:true, url, headers:{get() {return 'audio/wav';}}, async arrayBuffer() {return Uint8Array.from([1,2,3,4]).buffer;}, clone() { return this; }};
    },
    self: {
      location: {href: scope + 'service-worker.js', origin: 'https://example.test'},
      registration: {scope},
      clients: {claim: async () => {}, matchAll: async () => clients},
      addEventListener(name, handler) { handlers[name] = handler; },
      skipWaiting: async () => {activations++;}
    }
  };
  vm.runInNewContext(source, context);
  async function dispatch(name, props = {}) {
    let promise;
    let response;
    handlers[name]({
      waitUntil(p) {promise = p;},
      respondWith(p) {response = p;},
      ...props
    });
    if (promise) await promise;
    return response ? response : undefined;
  }
  return {dispatch, cacheData, setOffline() {network = false;}, get activations() {return activations;}, scope};
}

test('install caches all required files and offline status verifies every entry', async () => {
  const sw = harness();
  await sw.dispatch('install');
  const names = [...sw.cacheData.keys()];
  assert.equal(names.length, 1);
  const entries = sw.cacheData.get(names[0]);
  assert.ok(entries.has(scope + 'index.html'));
  assert.ok(entries.has(scope + 'music/xylophone.wav'));
  assert.ok(entries.has(scope + 'assets/home/home-skills-island.png'));
  for (let i = 0; i < 36; i++) assert.ok(entries.has(scope + `voice/v${String(i).padStart(2,'0')}.wav`));
  let result;
  await sw.dispatch('message', {data:{type:'OFFLINE_STATUS'}, ports:[{postMessage(value) {result = value;}}]});
  assert.equal(result.type, 'OFFLINE_STATUS_RESULT');
  assert.equal(result.ready, true);
  assert.equal(result.missing.length, 0);
});

test('failed install discards only the incomplete new cache and retains old complete cache', async () => {
  const old = 'life-skills-static-old';
  const sw = harness({failedPath:'voice/v35.wav', initial:{[old]:['./index.html']}});
  await assert.rejects(sw.dispatch('install'), /network failed/);
  assert.deepEqual([...sw.cacheData.keys()], [old]);
});

test('offline navigation, voice, and music use cache while external requests bypass it', async () => {
  const sw = harness();
  await sw.dispatch('install');
  sw.setOffline();
  const page = await sw.dispatch('fetch', {request:{url:scope, method:'GET', mode:'navigate'}});
  assert.equal((await page).url, scope + 'index.html');
  const voice = await sw.dispatch('fetch', {request:{url:scope + 'voice/v02.wav', method:'GET', mode:'no-cors'}});
  assert.equal((await voice).url, scope + 'voice/v02.wav');
  const music = await sw.dispatch('fetch', {request:{url:scope + 'music/xylophone.wav', method:'GET', mode:'no-cors'}});
  assert.equal((await music).url, scope + 'music/xylophone.wav');
  assert.equal(await sw.dispatch('fetch', {request:{url:'https://other.test/x', method:'GET'}}), undefined);
  assert.equal(await sw.dispatch('fetch', {request:{url:scope + 'report.json', method:'POST'}}), undefined);
});

test('activation removes older static caches only after a complete install', async () => {
  const old = 'life-skills-static-old';
  const sw = harness({initial:{[old]:['./index.html']}});
  await sw.dispatch('install');
  assert.equal(sw.cacheData.size, 2);
  await sw.dispatch('activate');
  assert.equal(sw.cacheData.size, 1);
  assert.ok(!sw.cacheData.has(old));
});

test('research-save release installs beside the previously published offline cache', async () => {
  const prior = 'life-skills-static-2026-10-03-1';
  const sw = harness({initial:{[prior]:['./index.html']}});
  await sw.dispatch('install');
  assert.equal(sw.cacheData.size, 2);
  assert.ok(sw.cacheData.has(prior));
  assert.ok([...sw.cacheData.keys()].some(name => name !== prior && name.startsWith('life-skills-static-')));
});

test('update requires one responsive idle client and rejects other open clients', async () => {
  const idle = {postMessage(message, ports) {ports[0].postMessage({active:false});}};
  const send = async sw => {
    let answer;
    await sw.dispatch('message', {data:{type:'ACTIVATE_UPDATE'}, ports:[{postMessage(value) {answer=value;}}]});
    return answer;
  };
  const one = harness({clients:[idle]});
  await one.dispatch('install');
  assert.equal((await send(one)).accepted, true);
  assert.equal(one.activations, 1);
  const two = harness({clients:[idle,idle]});
  await two.dispatch('install');
  assert.equal((await send(two)).accepted, false);
  assert.equal(two.activations, 0);
  const active = harness({clients:[{postMessage(message,ports) {ports[0].postMessage({active:true});}}]});
  await active.dispatch('install');
  assert.equal((await send(active)).accepted, false);
  assert.equal(active.activations, 0);
  const silent = harness({clients:[{postMessage() {}}]});
  await silent.dispatch('install');
  assert.equal((await send(silent)).accepted, false);
  assert.equal(silent.activations, 0);
});

test('offline voice supports Safari byte-range requests', async () => {
  const sw = harness();
  await sw.dispatch('install');
  sw.setOffline();
  const voice = await sw.dispatch('fetch', {request:{url:scope + 'voice/v02.wav', method:'GET', mode:'no-cors', headers:{get(name) {return name === 'range' ? 'bytes=1-2' : null;}}}});
  assert.equal(voice.status, 206);
  assert.equal(voice.headers.get('Content-Range'), 'bytes 1-2/4');
  assert.deepEqual([...new Uint8Array(await voice.arrayBuffer())], [2,3]);
});
