const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function createElement() {
  return {
    classList: { add() {}, remove() {}, contains() { return false; } },
    dataset: {},
    style: { setProperty() {}, getPropertyValue() { return ''; } },
    addEventListener() {},
    appendChild() {},
    click() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getBoundingClientRect() { return { left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 }; }
  };
}

function loadRuntime() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const elements = new Map();
  const spoken = [];
  const selectedPhase = createElement();
  const selectedSkill = createElement();
  selectedPhase.dataset.phase = 'intervention';
  selectedSkill.dataset.skill = 'laundry';
  class SpeechSynthesisUtterance {
    constructor(text) { this.text = text; }
  }
  const speechSynthesis = {
    cancel() {},
    getVoices() { return [{ name: 'Tingting', lang: 'zh-CN' }]; },
    speak(utterance) { spoken.push(utterance); }
  };
  const getElement = id => {
    if (!elements.has(id)) elements.set(id, createElement());
    return elements.get(id);
  };
  const document = {
    addEventListener() {},
    body: createElement(),
    createElement,
    getElementById: getElement,
    querySelector(selector) {
      if (selector === '.phase-btn.selected') return selectedPhase;
      if (selector === '.skill-btn.selected') return selectedSkill;
      return null;
    },
    querySelectorAll() { return []; }
  };
  const context = {
    AbortController,
    Blob: class {},
    Date,
    JSON,
    Math,
    SpeechSynthesisUtterance,
    URL: { createObjectURL() { return 'blob:test'; } },
    console,
    document,
    localStorage: { getItem() { return null; }, setItem() {} },
    requestAnimationFrame() {},
    setInterval() { return 1; },
    clearInterval() {},
    setTimeout() { return 1; },
    clearTimeout() {},
    window: { addEventListener() {}, matchMedia() { return { matches: false }; }, speechSynthesis }
  };
  context.globalThis = context;
  vm.runInNewContext(`${script}\n;globalThis.__testApi = { LEVELS, STEP_STATE_KEYS, TASK_ANALYSIS, NEW_LEVEL_IDS, ResearchMode, UnifiedDataManager, speak, state };`, context);
  return { api: context.__testApi, getElement, selectedSkill, spoken };
}

test('new intervention targets expose exactly three seven-step levels', () => {
  const { api } = loadRuntime();
  assert.deepEqual(Array.from(api.LEVELS, level => level.id), [
    'laundry', 'fold-clothes', 'fold-umbrella'
  ]);
  assert.deepEqual(Array.from(api.LEVELS, level => level.steps.length), [7, 7, 7]);
  assert.equal(api.LEVELS[0].steps[0].instruction, '放进水盆');
  assert.equal(api.LEVELS[1].steps[6].instruction, '向上折好');
  assert.equal(api.LEVELS[2].steps[3].repeatGoal, 6);
});

test('new intervention targets retain the approved state, task analysis, and voice contracts', () => {
  const { api } = loadRuntime();
  assert.deepEqual(JSON.parse(JSON.stringify(api.STEP_STATE_KEYS)), {
    laundry: ['shirtInBasin', 'shirtWet', 'detergentAdded', 'frontRubbed', 'backRubbed', 'shirtRinsed', 'shirtWrung'],
    'fold-clothes': ['shirtPlaced', 'shirtSmoothed', 'leftSleeveFolded', 'rightSleeveFolded', 'leftBodyFolded', 'rightBodyFolded', 'shirtFolded'],
    'fold-umbrella': ['frameClosed', 'shaftShortened', 'strapFacingOut', 'panelsSmoothed', 'panelsGathered', 'canopyRolled', 'strapFastened']
  });
  assert.deepEqual(
    JSON.parse(JSON.stringify(Object.values(api.TASK_ANALYSIS).map(task => [task.taskId, task.taskName, task.steps.length]))),
    [['laundry', '清洗衣服', 7], ['fold-clothes', '折叠衣服', 7], ['fold-umbrella', '收整折叠伞', 7]]
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(api.LEVELS.map(level => level.steps.map(step => step.voice)))),
    [
      ['把脏衣服放进水盆里。', '打开水龙头，把衣服弄湿。', '按一下，加入洗衣液。', '用小手来回揉一揉。', '翻过来，再揉一揉。', '用清水把泡泡冲干净。', '两只手轻轻拧一拧。'],
      ['把衣服平平地放在桌上。', '用小手把衣服抚平。', '把这边的袖子折进来。', '再把这边的袖子折进来。', '把衣服这边折到中间。', '再把另一边折到中间。', '把衣服下面向上折，叠好啦。'],
      ['把小滑块慢慢拉下来。', '两只手拿稳，把伞杆轻轻收短。', '转一转，找到雨伞的小带子。', '顺着伞骨，一片一片理整齐。', '把理好的伞布靠在一起。', '朝一个方向，慢慢卷起来。', '把小带子绕过来，扣好。']
    ]
  );
});

test('new instructions and level rewards use Chinese speech when no recording exists', () => {
  const { api, spoken } = loadRuntime();
  const instructions = api.LEVELS.flatMap(level => level.steps.map(step => step.voice));
  const rewards = api.LEVELS.map(level => `太厉害了！你已经学会${level.name}了！`);

  [...instructions, ...rewards].forEach(text => api.speak(text));

  assert.equal(spoken.length, 24);
  for (const utterance of spoken) {
    assert.equal(utterance.lang, 'zh-CN');
    assert.equal(utterance.rate, 0.75);
    assert.equal(utterance.voice?.name, 'Tingting');
  }
});

test('new study IDs start their matching level and save their contracted skill labels', () => {
  const { api, getElement, selectedSkill } = loadRuntime();
  getElement('research-child-id').value = 'child-1';
  getElement('research-session-num').value = '2';
  getElement('research-date').value = '2026-09-14';

  for (const [index, [id, skill]] of [
    ['laundry', 'clothes washing'],
    ['fold-clothes', 'clothes folding'],
    ['fold-umbrella', 'folding umbrella']
  ].entries()) {
    selectedSkill.dataset.skill = id;
    api.ResearchMode.start();
    assert.equal(api.state.currentLevel, index);
    assert.equal(api.UnifiedDataManager.taskId, id);
    assert.equal(api.UnifiedDataManager.onStepComplete(true).skill, skill);
  }
});
