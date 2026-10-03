const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
function manager() {
  const source = html.match(/const DataTransfer = \{[\s\S]*?\n\};/)?.[0];
  assert.ok(source, 'DataTransfer missing');
  return vm.runInNewContext(source + '\nDataTransfer', {JSON, Date, Set, Object, String});
}
function storage(seed = {}) {
  const values = new Map(Object.entries(seed).map(([key,value]) => [key, JSON.stringify(value)]));
  let failKey = '';
  let failed = false;
  return {
    getItem(key) {return values.has(key) ? values.get(key) : null;},
    setItem(key,value) {if (key === failKey && !failed) {failed=true; throw Error('quota');} values.set(key,value);},
    removeItem(key) {values.delete(key);},
    failOnce(key) {failKey=key;},
    dump() {return Object.fromEntries(values);}
  };
}
const record = (timestamp = '2026-10-03T10:00:00.000Z', errors = 0) => ({
  participantID:'P01', taskId:'laundry', skill:'clothes washing', phase:'baseline',
  sessionNumber:1, stepNumber:1, stepName:'放进水盆', completionStatus:true,
  promptLevel:0, trainingMode:'assessment', responseTimeMs:1200, errors, timestamp
});

test('backup includes all five local data keys and a format version', () => {
  const db = storage({researchRecords:[record()],session_summaries:[{sessionId:'s1'}],researchParticipants:['P01'],researchSession:{participantID:'P01'},'life-skills-records':{laundry:1}});
  const backup = manager().buildBackup(db);
  assert.equal(backup.formatVersion, 2);
  assert.equal(backup.researchRecords.length, 1);
  assert.equal(backup.sessionSummaries[0].sessionId, 's1');
  assert.equal(backup.researchParticipants[0], 'P01');
  assert.equal(backup.researchSession.participantID, 'P01');
  assert.equal(backup.lifeSkillsRecords.laundry, 1);
  assert.ok(backup.exportedAt);
});

test('old three-key backup previews without mutating existing data', () => {
  const db = storage({researchRecords:[record()],researchParticipants:['P01']});
  const before = db.dump();
  const old = {researchRecords:[record('2026-10-03T11:00:00.000Z')],sessionSummaries:[{sessionId:'s2'}],lifeSkillsRecords:{laundry:2}};
  const preview = manager().previewImport(JSON.stringify(old), db);
  assert.equal(preview.valid, true);
  assert.equal(preview.counts.researchRecords, 1);
  assert.equal(preview.merged.researchRecords.length, 2);
  assert.deepEqual(db.dump(), before);
});

test('invalid JSON and wrong field types are rejected before writes', () => {
  const db = storage({researchRecords:[record()]});
  const before = db.dump();
  assert.equal(manager().previewImport('{broken', db).valid, false);
  assert.equal(manager().previewImport(JSON.stringify({researchRecords:{bad:true}}), db).valid, false);
  assert.deepEqual(db.dump(), before);
});

test('exact duplicate is skipped while same identity with different content blocks import', () => {
  const db = storage({researchRecords:[record()]});
  const duplicate = manager().previewImport(JSON.stringify({researchRecords:[record()]}), db);
  assert.equal(duplicate.valid, true);
  assert.equal(duplicate.duplicates.researchRecords, 1);
  assert.equal(duplicate.merged.researchRecords.length, 1);
  const conflict = manager().previewImport(JSON.stringify({researchRecords:[record(undefined, 2)]}), db);
  assert.equal(conflict.valid, false);
  assert.ok(conflict.conflicts.researchRecords > 0);
  assert.equal(manager().applyImport(conflict, db).ok, false);
});

test('participants merge, target counts win, and imported session never starts training', () => {
  const db = storage({researchParticipants:['P01'],'life-skills-records':{laundry:3}});
  const input = {researchRecords:[],researchParticipants:['P01','P02'],lifeSkillsRecords:{laundry:4,dress:1},researchSession:{participantID:'P02',active:true}};
  const managerInstance = manager();
  const preview = managerInstance.previewImport(JSON.stringify(input), db);
  assert.equal(preview.valid, true);
  assert.deepEqual(JSON.parse(JSON.stringify(preview.merged.researchParticipants)), ['P01','P02']);
  assert.equal(preview.merged.lifeSkillsRecords.laundry, 3);
  assert.equal(preview.merged.lifeSkillsRecords.dress, 1);
  assert.equal(preview.merged.researchSession.active, undefined);
  assert.equal(managerInstance.applyImport(preview, db).ok, true);
  assert.equal(JSON.parse(db.getItem('researchSession')).active, undefined);
});

test('quota error rolls back all changed keys or reports keys it could not restore', () => {
  const db = storage({researchRecords:[record()],session_summaries:[{sessionId:'s1'}]});
  const before = db.dump();
  const preview = manager().previewImport(JSON.stringify({researchRecords:[record('2026-10-03T11:00:00.000Z')],sessionSummaries:[{sessionId:'s2'}]}), db);
  assert.equal(preview.valid, true);
  db.failOnce('session_summaries');
  const result = manager().applyImport(preview, db);
  assert.equal(result.ok, false);
  assert.equal(result.restored, true);
  assert.deepEqual(db.dump(), before);
});

test('backup and restore buttons use preview and never directly overwrite local storage', () => {
  const handlers = html.match(/function backupData\(\) \{[\s\S]*?\n\}\n[\s\S]*?function restoreData\(\) \{[\s\S]*?\n\}/)?.[0] || '';
  assert.ok(handlers.includes('DataTransfer.buildBackup(localStorage)'));
  assert.ok(handlers.includes('DataTransfer.previewImport('));
  assert.ok(handlers.includes('DataTransfer.applyImport('));
  assert.ok(!handlers.includes("localStorage.setItem('researchRecords'"));
  assert.ok(handlers.includes('导入预览'));
});

test('backup reminder counts newly completed sessions by session id, not steps', () => {
  const source = html.match(/function refreshBackupStatus\(\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(source);
  const db = storage({offlineBackupMeta:{at:'2026-10-03T08:00:00.000Z',sessionIds:['s1']},session_summaries:[{sessionId:'s1',totalSteps:7},{sessionId:'s2',totalSteps:7},{sessionId:'s3',totalSteps:2}]});
  const label = {textContent:''};
  vm.runInNewContext(source + '\nrefreshBackupStatus()', {localStorage:db,document:{getElementById() {return label;}},JSON,Set});
  assert.match(label.textContent, /新增 2 个 Session/);
  assert.match(label.textContent, /核对下载文件/);
});
