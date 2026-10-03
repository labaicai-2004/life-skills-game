const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const worker = fs.readFileSync(path.join(__dirname, '..', 'service-worker.js'), 'utf8');

function coordinator({training = false, waiting = true, answer = {accepted:true, reason:''}} = {}) {
  const source = html.match(/const OfflineCoordinator = \{[\s\S]*?\n\};/)?.[0];
  assert.ok(source, 'OfflineCoordinator missing');
  const elements = new Map();
  const element = id => elements.get(id) || elements.set(id, {textContent:'', hidden:false, disabled:false}).get(id);
  const calls = [];
  const readyWorker = {postMessage(message, ports) {calls.push(message.type); ports[0].postMessage(message.type === 'OFFLINE_STATUS' ? {type:'OFFLINE_STATUS_RESULT',version:'v1',ready:true,missing:[]} : answer);}};
  const registration = {active:readyWorker, waiting:waiting ? readyWorker : null, update:async () => {calls.push('update');}};
  class Channel {
    constructor() {
      this.port1 = {onmessage:null};
      this.port2 = {postMessage:value => this.port1.onmessage?.({data:value})};
    }
  }
  const context = {
    navigator:{serviceWorker:{register:async () => registration, ready:Promise.resolve(registration), addEventListener() {}, controller:readyWorker}},
    document:{getElementById:element},
    window:{location:{protocol:'https:', reload() {calls.push('reload');}}, addEventListener() {}},
    MessageChannel:Channel, setTimeout, clearTimeout,
    state:{currentLevel:training ? 0 : -1}, SessionManager:{active:false},
    console
  };
  const api = vm.runInNewContext(source + '\nOfflineCoordinator', context);
  return {api, calls, elements, context};
}

test('installation, retry, update and status controls live only in teacher area', () => {
  const panel = html.match(/<div class="research-panel"[\s\S]*?<\/div>\s*<\/div>\s*<!-- Observer Mode panel -->/)?.[0] || '';
  assert.match(panel, /id="offline-status"/);
  assert.match(panel, /id="offline-retry"/);
  assert.match(panel, /id="offline-update"/);
  assert.match(panel, /添加到主屏幕/);
  const game = html.match(/<div id="game-screen"[\s\S]*?<!-- ===== PARENT RECORDS PANEL ===== -->/)?.[0] || '';
  assert.doesNotMatch(game, /offline-status|offline-update/);
});

test('teacher cannot activate update while current training is active', async () => {
  const {api,calls} = coordinator({training:true});
  await api.init();
  assert.equal(await api.requestUpdate(), false);
  assert.ok(!calls.includes('ACTIVATE_UPDATE'));
});

test('teacher confirmation asks waiting worker and reloads only after accepted idle update', async () => {
  const {api,calls} = coordinator();
  await api.init();
  assert.equal(await api.requestUpdate(), true);
  assert.ok(calls.includes('ACTIVATE_UPDATE'));
  assert.ok(!calls.includes('reload'));
  api.onControllerChange();
  assert.ok(calls.includes('reload'));
});

test('worker refuses activation when another client exists or does not answer', () => {
  assert.match(worker, /TRAINING_STATE_QUERY/);
  assert.match(worker, /ACTIVATE_UPDATE_RESULT/);
  assert.match(worker, /clients\.matchAll/);
  assert.match(worker, /skipWaiting\(\)/);
});
