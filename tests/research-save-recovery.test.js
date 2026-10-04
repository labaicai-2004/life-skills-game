const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const managerSource = html.match(/const UnifiedDataManager = \{[\s\S]*?\n\};/)?.[0];
const transferSource = html.match(/const DataTransfer = \{[\s\S]*?\n\};/)?.[0];
assert.ok(managerSource && transferSource);

function makeStorage(initial = null) {
  const values = new Map(initial === null ? [] : [['researchRecords', JSON.stringify(initial)]]);
  let failWrites = false;
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) {
      if (key === 'researchRecords' && failWrites) throw Error('quota');
      values.set(key, value);
    },
    removeItem(key) { values.delete(key); },
    fail(value) { failWrites = value; }
  };
}

function setup(storage) {
  const status = {textContent: ''};
  const retry = {hidden: true};
  const context = {
    localStorage: storage,
    document: {getElementById(id) {
      return id === 'research-save-status' ? status : id === 'research-save-retry' ? retry : null;
    }},
    LEVELS: [{id:'laundry',steps:[{id:1,instruction:'放进水盆',gesture:'drag'}]}],
    TASK_ANALYSIS: {laundry:{taskName:'清洗衣服',steps:[{behavior:'放进水盆'}]}},
    state: {currentLevel:0,currentStep:0},
    ResearchMode: {active:true,childId:'P01',phase:'baseline',sessionNum:1},
    promptState: {promptUsed:0},
    currentTrainingMode: {id:'assessment'},
    console: {log() {}},
    JSON, Date, Math, Set, Map, Object, String
  };
  const manager = vm.runInNewContext(`${managerSource}\n${transferSource}\nUnifiedDataManager`, context);
  manager.startSession('laundry', 'P01');
  manager.onStepStart();
  return {manager, status, retry};
}

test('failed step write remains pending and warns only in the researcher area', () => {
  const storage = makeStorage();
  const {manager, status, retry} = setup(storage);
  storage.fail(true);
  manager.onStepComplete(true);
  assert.equal(storage.getItem('researchRecords'), null);
  assert.equal(manager.getPendingRecords().length, 1);
  assert.match(status.textContent, /未保存/);
  assert.equal(retry.hidden, false);
});

test('retry stores a failed step exactly once and clears the warning', () => {
  const storage = makeStorage();
  const {manager, status, retry} = setup(storage);
  storage.fail(true);
  manager.onStepComplete(true);
  storage.fail(false);
  assert.equal(manager.retryPendingRecords(), true);
  assert.equal(JSON.parse(storage.getItem('researchRecords')).length, 1);
  assert.equal(manager.getPendingRecords().length, 0);
  assert.doesNotMatch(status.textContent, /未保存/);
  assert.equal(retry.hidden, true);
  assert.equal(manager.retryPendingRecords(), true);
  assert.equal(JSON.parse(storage.getItem('researchRecords')).length, 1);
});

test('malformed existing research records are not overwritten, and pending steps survive a new session', () => {
  const storage = makeStorage({bad:true});
  const {manager, status} = setup(storage);
  manager.onStepComplete(true);
  assert.equal(storage.getItem('researchRecords'), '{"bad":true}');
  assert.equal(manager.getPendingRecords().length, 1);
  assert.match(status.textContent, /未保存/);
  manager.startSession('laundry', 'P01');
  assert.equal(manager.getPendingRecords().length, 1);
});

test('backup contains pending research steps without changing local storage', () => {
  const storage = makeStorage([]);
  const {manager} = setup(storage);
  storage.fail(true);
  manager.onStepComplete(true);
  const before = storage.getItem('researchRecords');
  const backup = vm.runInNewContext(`${transferSource}\nDataTransfer`, {JSON,Date,Set,Map,Object,String})
    .buildBackup(storage, manager.getPendingRecords());
  assert.equal(backup.researchRecords.length, 1);
  assert.equal(backup.researchRecords[0].participantID, 'P01');
  assert.equal(storage.getItem('researchRecords'), before);
});

test('backup button exports the pending step and does not report a saved step', async () => {
  const storage = makeStorage([]);
  const {manager} = setup(storage);
  storage.fail(true);
  manager.onStepComplete(true);
  let downloaded;
  let filename;
  const label = {textContent:''};
  const body = {appendChild() {}};
  const document = {
    body,
    createElement() {return {click() {filename=this.download;},remove() {}};},
    getElementById(id) {return id === 'offline-backup-status' ? label : null;}
  };
  const context = {
    UnifiedDataManager:manager,localStorage:storage,document,
    URL:{createObjectURL(blob) {downloaded=blob; return 'blob:test';},revokeObjectURL() {}},
    Blob,JSON,Date,Set,Map,Object,String,setTimeout() {}
  };
  const source = html.match(/function backupData\(\) \{[\s\S]*?\n\}/)?.[0];
  const statusSource = html.match(/function refreshBackupStatus\(\) \{[\s\S]*?\n\}/)?.[0];
  vm.runInNewContext(`${transferSource}\n${statusSource}\n${source}\nbackupData()`, context);
  const data = JSON.parse(await downloaded.text());
  assert.equal(data.researchRecords.length, 1);
  assert.equal(data.researchRecords[0].stepName, '放进水盆');
  assert.match(filename, /backup_/);
  assert.equal(manager.getPendingRecords().length, 1);
  assert.equal(storage.getItem('researchRecords'), '[]');
});

test('malformed stored records produce a recovery file with pending steps and the original raw value', () => {
  const storage = makeStorage({bad:true});
  const {manager} = setup(storage);
  manager.onStepComplete(true);
  const transfer = vm.runInNewContext(`${transferSource}\nDataTransfer`, {JSON,Date,Set,Map,Object,String});
  const backup = transfer.buildRecoveryBackup(storage, manager.getPendingRecords());
  assert.equal(backup.recoveryOnly, true);
  assert.equal(backup.researchRecords.length, 1);
  assert.equal(backup.unreadableResearchRecords, '{"bad":true}');
  assert.equal(storage.getItem('researchRecords'), '{"bad":true}');
});

test('backup button offers only a recovery file when existing research records are malformed', async () => {
  const storage = makeStorage({bad:true});
  const {manager} = setup(storage);
  manager.onStepComplete(true);
  let downloaded;
  let filename;
  const label = {textContent:''};
  const document = {
    body:{appendChild() {}},
    createElement() {return {click() {filename=this.download;},remove() {}};},
    getElementById(id) {return id === 'offline-backup-status' ? label : null;}
  };
  const context = {
    UnifiedDataManager:manager,localStorage:storage,document,
    URL:{createObjectURL(blob) {downloaded=blob; return 'blob:test';},revokeObjectURL() {}},
    Blob,JSON,Date,Set,Map,Object,String,setTimeout() {}
  };
  const source = html.match(/function backupData\(\) \{[\s\S]*?\n\}/)?.[0];
  const statusSource = html.match(/function refreshBackupStatus\(\) \{[\s\S]*?\n\}/)?.[0];
  vm.runInNewContext(`${transferSource}\n${statusSource}\n${source}\nbackupData()`, context);
  const data = JSON.parse(await downloaded.text());
  assert.equal(data.recoveryOnly, true);
  assert.equal(data.researchRecords.length, 1);
  assert.match(filename, /unsaved_steps_/);
  assert.match(label.textContent, /仅包含未保存/);
  assert.equal(storage.getItem('offlineBackupMeta'), null);
});

test('retry does not duplicate a record already written before an interrupted save', () => {
  const storage = makeStorage([]);
  const {manager} = setup(storage);
  storage.fail(true);
  manager.onStepComplete(true);
  storage.fail(false);
  storage.setItem('researchRecords', JSON.stringify(manager.getPendingRecords()));
  assert.equal(manager.retryPendingRecords(), true);
  assert.equal(JSON.parse(storage.getItem('researchRecords')).length, 1);
});

test('retry preserves a pending step when an existing identity has different content', () => {
  const storage = makeStorage([]);
  const {manager, status} = setup(storage);
  storage.fail(true);
  manager.onStepComplete(true);
  storage.fail(false);
  const conflict = {...manager.getPendingRecords()[0], errors:9};
  storage.setItem('researchRecords', JSON.stringify([conflict]));
  assert.equal(manager.retryPendingRecords(), false);
  assert.equal(JSON.parse(storage.getItem('researchRecords')).length, 1);
  assert.equal(manager.getPendingRecords().length, 1);
  assert.match(status.textContent, /未保存/);
});

test('a malformed row cannot be labeled as a complete backup', () => {
  const storage = makeStorage([null]);
  const transfer = vm.runInNewContext(`${transferSource}\nDataTransfer`, {JSON,Date,Set,Map,Object,String});
  assert.throws(() => transfer.buildBackup(storage), /invalid shape/);
});

test('a conflicting pending identity cannot be labeled as a complete backup', () => {
  const storage = makeStorage([]);
  const {manager} = setup(storage);
  storage.fail(true);
  manager.onStepComplete(true);
  storage.fail(false);
  const conflict = {...manager.getPendingRecords()[0], errors:9};
  storage.setItem('researchRecords', JSON.stringify([conflict]));
  const transfer = vm.runInNewContext(`${transferSource}\nDataTransfer`, {JSON,Date,Set,Map,Object,String});
  assert.throws(() => transfer.buildBackup(storage, manager.getPendingRecords()), /conflict/);
});
