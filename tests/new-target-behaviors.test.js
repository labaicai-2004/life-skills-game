const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const BACKGROUND_ASSETS = [
  'assets/laundry/laundry-room.png',
  'assets/folding/folding-table.png',
  'assets/umbrella/umbrella-room.png'
];
const TRANSPARENT_ITEM_ASSETS = [
  'assets/laundry/shirt-dirty.png',
  'assets/laundry/shirt-clean.png',
  'assets/laundry/wash-basin.png',
  'assets/laundry/detergent.png',
  'assets/folding/sweatshirt-flat.png',
  'assets/folding/sweatshirt-folded.png',
  'assets/umbrella/umbrella-open.png',
  'assets/umbrella/umbrella-closed.png',
  'assets/umbrella/umbrella-folded.png'
];
const REQUIRED_ASSETS = [...BACKGROUND_ASSETS, ...TRANSPARENT_ITEM_ASSETS];

function imageProperties(file) {
  const output = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', '-g', 'hasAlpha', file], { encoding: 'utf8' });
  return Object.fromEntries(
    [...output.matchAll(/^\s+(pixelWidth|pixelHeight|hasAlpha):\s+(.+)$/gm)].map(([, key, value]) => [key, value])
  );
}

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
    Audio: class { play() { return { catch() {} }; } pause() {} },
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
  vm.runInNewContext(`${script}\n;globalThis.__testApi = { LEVELS, STEP_STATE_KEYS, TASK_ANALYSIS, NEW_LEVEL_IDS, ResearchMode, UnifiedDataManager, StepProgress: typeof StepProgress === 'undefined' ? undefined : StepProgress, attachGestureListeners, checkMatch, isMovingTowardTarget: typeof isMovingTowardTarget === 'undefined' ? undefined : isMovingTowardTarget, gestureTargetCenter: typeof gestureTargetCenter === 'undefined' ? undefined : gestureTargetCenter, applyPromptLevel, PROMPT_LEVELS, speak, state };`, context);
  return { api: context.__testApi, getElement, selectedSkill, spoken };
}

function createGestureArea() {
  const listeners = new Map();
  const target = {
    getBoundingClientRect() { return { left: 90, top: -10, width: 20, height: 20 }; }
  };
  const area = {
    targetQueries: 0,
    classList: { add() {}, remove() {} },
    style: {},
    addEventListener(type, handler) { listeners.set(type, handler); },
    dispatch(type, event = {}) {
      listeners.get(type)?.({ preventDefault() {}, target: area, currentTarget: area, ...event });
    },
    appendChild() {},
    querySelector(selector) {
      if (selector === '[data-gesture-target]') {
        this.targetQueries++;
        return target;
      }
      return null;
    },
    querySelectorAll() { return []; },
    getBoundingClientRect() { return { left: -200, top: -100, width: 200, height: 200 }; }
  };
  return area;
}

function runPushInwardGesture(kind, endX) {
  const { api } = loadRuntime();
  const area = createGestureArea();
  api.state.currentLevel = 0;
  api.state.currentStep = 0;
  api.state.stepCompleted = new Set();
  api.state.stepAbortController = null;
  api.StepProgress.reset({});
  api.attachGestureListeners({ gesture: 'push-inward' }, area);

  if (kind === 'touch') {
    area.dispatch('touchstart', { touches: [{ clientX: 0, clientY: 0 }] });
    area.dispatch('touchmove', { touches: [{ clientX: endX, clientY: 0 }] });
    area.dispatch('touchend');
  } else {
    area.dispatch('mousedown', { clientX: 0, clientY: 0 });
    area.dispatch('mousemove', { clientX: endX, clientY: 0 });
    area.dispatch('mouseup');
  }

  return {
    completed: api.state.stepCompleted.has(0),
    progress: api.StepProgress.current,
    targetQueries: area.targetQueries
  };
}

test('all new local artwork exists with contracted dimensions and alpha', () => {
  for (const file of REQUIRED_ASSETS) {
    assert.equal(fs.existsSync(path.join(ROOT, file)), true, `${file} missing`);
  }

  for (const file of BACKGROUND_ASSETS) {
    const properties = imageProperties(path.join(ROOT, file));
    assert.equal(properties.pixelWidth, '2048', `${file} must be 2048px wide`);
    assert.equal(properties.pixelHeight, '1152', `${file} must be 1152px high`);
  }

  for (const file of TRANSPARENT_ITEM_ASSETS) {
    const properties = imageProperties(path.join(ROOT, file));
    assert.ok(Math.max(Number(properties.pixelWidth), Number(properties.pixelHeight)) >= 1024, `${file} long edge must be at least 1024px`);
    assert.equal(properties.hasAlpha, 'yes', `${file} must preserve a transparent background`);
  }
});

test('new intervention targets expose exactly three seven-step levels', () => {
  const { api } = loadRuntime();
  assert.deepEqual(Array.from(api.LEVELS, level => level.id), [
    'laundry', 'fold-clothes', 'fold-umbrella'
  ]);
  assert.deepEqual(Array.from(api.LEVELS, level => level.steps.length), [7, 7, 7]);
  assert.equal(api.LEVELS[0].steps[0].instruction, '放进水盆');
  assert.equal(api.LEVELS[0].steps[3].repeatGoal, 3);
  assert.equal(api.LEVELS[0].steps[4].repeatGoal, 3);
  assert.equal(api.LEVELS[1].steps[6].instruction, '向上折好');
  assert.equal(api.LEVELS[2].steps[3].repeatGoal, 6);
});

test('StepProgress completes only after the configured repetitions', () => {
  const { api } = loadRuntime();
  api.StepProgress.reset({ repeatGoal: 3 });
  assert.equal(api.StepProgress.advance().complete, false);
  assert.equal(api.StepProgress.advance().complete, false);
  assert.equal(api.StepProgress.advance().complete, true);
});

test('six umbrella panels require six completed smoothing strokes', () => {
  const { api } = loadRuntime();
  api.StepProgress.reset({ repeatGoal: 6 });
  for (let index = 0; index < 5; index++) assert.equal(api.StepProgress.advance().complete, false);
  assert.equal(api.StepProgress.advance().complete, true);
});

test('StepProgress preserves one-action steps and renders completed substeps', () => {
  const { api } = loadRuntime();
  const dots = Array.from({ length: 3 }, () => ({ classList: { done: false, toggle(name, value) { this.done = value; } } }));
  api.StepProgress.reset({});
  assert.deepEqual(JSON.parse(JSON.stringify(api.StepProgress.advance())), { current: 1, goal: 1, complete: true });
  api.StepProgress.reset({ repeatGoal: 2 });
  api.StepProgress.advance();
  api.StepProgress.render({ querySelectorAll() { return dots; } });
  assert.deepEqual(dots.map(dot => dot.classList.done), [true, false, false]);
});

test('repeat gestures accept only compatible swipe directions', () => {
  const { api } = loadRuntime();
  assert.equal(api.checkMatch('swipe-right', 'repeat-horizontal'), true);
  assert.equal(api.checkMatch('swipe-up', 'repeat-horizontal'), false);
  assert.equal(api.checkMatch('swipe-down', 'repeat-vertical'), true);
  assert.equal(api.checkMatch('swipe-left', 'repeat-vertical'), false);
  assert.equal(api.checkMatch('swipe-left', 'roll-horizontal'), true);
});

test('touch and mouse share a 40px inward-target direction check', () => {
  const { api } = loadRuntime();
  const start = { x: 0, y: 0 };
  const targetCenter = { x: 100, y: 0 };
  assert.equal(api.isMovingTowardTarget(start, { x: 50, y: 0 }, targetCenter), true);
  assert.equal(api.isMovingTowardTarget(start, { x: -50, y: 0 }, targetCenter), false);
  assert.equal(api.isMovingTowardTarget(start, { x: 39, y: 0 }, targetCenter), false);
});

test('inward gestures prefer an explicit target center before the interaction area center', () => {
  const { api } = loadRuntime();
  const target = { getBoundingClientRect() { return { left: 20, top: 40, width: 40, height: 20 }; } };
  const area = {
    querySelector(selector) { return selector === '[data-gesture-target]' ? target : null; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 200, height: 100 }; }
  };
  assert.deepEqual(JSON.parse(JSON.stringify(api.gestureTargetCenter(area))), { x: 40, y: 50 });
  area.querySelector = () => null;
  assert.deepEqual(JSON.parse(JSON.stringify(api.gestureTargetCenter(area))), { x: 100, y: 50 });
});

test('attachGestureListeners routes touch and mouse inward gestures to the explicit target', () => {
  for (const kind of ['touch', 'mouse']) {
    assert.deepEqual(runPushInwardGesture(kind, 50), { completed: true, progress: 1, targetQueries: 1 });
    assert.deepEqual(runPushInwardGesture(kind, -50), { completed: false, progress: 0, targetQueries: 1 });
    assert.deepEqual(runPushInwardGesture(kind, 39), { completed: false, progress: 0, targetQueries: 1 });
  }
});

test('demonstration completes repeat progress before recording one assisted success', () => {
  for (const [levelIndex, stepIndex, goal] of [[0, 3, 3], [2, 3, 6]]) {
    const { api } = loadRuntime();
    api.state.currentLevel = levelIndex;
    api.state.currentStep = stepIndex;
    api.StepProgress.reset(api.LEVELS[levelIndex].steps[stepIndex]);
    api.applyPromptLevel(api.PROMPT_LEVELS.DEMONSTRATION.level);
    assert.equal(api.StepProgress.current, goal);
    assert.equal(api.StepProgress.goal, goal);
    assert.equal(api.UnifiedDataManager.events.filter(event => event.event === 'step_success').length, 1);
  }
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
