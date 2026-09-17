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
    remove() {},
    offsetWidth: 100,
    offsetHeight: 100,
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getBoundingClientRect() { return { left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 }; }
  };
}

function loadRuntime() {
  let now = 0;
  const timers = new Map();
  let timerId = 0;
  class ControlledDate extends Date { static now() { return now; } }
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
    Date: ControlledDate,
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
    setTimeout(callback, delay) { timers.set(++timerId, { callback, due: now + delay }); return timerId; },
    clearTimeout(id) { timers.delete(id); },
    window: { addEventListener() {}, matchMedia() { return { matches: false }; }, speechSynthesis }
  };
  context.globalThis = context;
  vm.runInNewContext(`${script}\n;globalThis.__testApi = { LEVELS, STEP_STATE_KEYS, TASK_ANALYSIS, NEW_LEVEL_IDS, FOLD_LAYOUT: typeof FOLD_LAYOUT === 'undefined' ? undefined : FOLD_LAYOUT, ResearchMode, UnifiedDataManager, StepProgress: typeof StepProgress === 'undefined' ? undefined : StepProgress, attachGestureListeners, checkMatch, isMovingTowardTarget: typeof isMovingTowardTarget === 'undefined' ? undefined : isMovingTowardTarget, gestureTargetCenter: typeof gestureTargetCenter === 'undefined' ? undefined : gestureTargetCenter, applyPromptLevel, PROMPT_LEVELS, speak, state };`, context);
  vm.runInNewContext('Object.assign(globalThis.__testApi, { buildScene, SkillSceneState, buildPersistentStateHTML });', context);
  return { api: context.__testApi, getElement, selectedSkill, spoken,
    advance(ms) {
      now += ms;
      for (const [id, timer] of [...timers]) if (timer.due <= now) { timers.delete(id); timer.callback(); }
    }
  };
}

function laundryGesture(stepId, kind = 'mouse') {
  const runtime = loadRuntime();
  const { api } = runtime;
  const listeners = new Map();
  const stage = createElement();
  const item = createElement();
  const target = createElement();
  const partner = createElement();
  item.style.left = '0px'; item.style.top = '0px';
  item.getBoundingClientRect = () => {
    const left = parseFloat(item.style.left) || 0, top = parseFloat(item.style.top) || 0;
    return { left, top, right: left + 100, bottom: top + 100, width: 100, height: 100 };
  };
  target.getBoundingClientRect = () => ({ left: 200, top: 0, right: 400, bottom: 200, width: 200, height: 200 });
  const area = createElement();
  area.getBoundingClientRect = () => ({ left: 0, top: 0, right: 750, bottom: 380, width: 750, height: 380 });
  area.querySelector = selector => ({ '.step-stage': stage, '.interactive-target': item, '.draggable-item': item, '.drag-target': target, '[data-gesture-target]': target, '.laundry-partner-hand': partner })[selector] || null;
  area.addEventListener = (type, callback, options) => {
    listeners.set(type, callback);
    options?.signal?.addEventListener('abort', () => listeners.delete(type));
  };
  api.state.currentLevel = 0; api.state.currentStep = stepId - 1;
  api.StepProgress.reset(api.LEVELS[0].steps[stepId - 1]);
  api.attachGestureListeners(api.LEVELS[0].steps[stepId - 1], area);
  const dispatch = (phase, x, y = 50) => {
    const type = kind === 'mouse' ? { start: 'mousedown', move: 'mousemove', end: 'mouseup', cancel: 'mouseleave' }[phase] : { start: 'touchstart', move: 'touchmove', end: 'touchend', cancel: 'touchcancel' }[phase];
    listeners.get(type)?.({ clientX: x, clientY: y, touches: [{ clientX: x, clientY: y }], changedTouches: [{ clientX: x, clientY: y }], preventDefault() {} });
  };
  return { ...runtime, item, partner, stage, dispatch, complete: () => api.state.stepCompleted.has(stepId - 1) };
}

function foldingGesture(stepId, kind = 'mouse') {
  const runtime = loadRuntime();
  const { api } = runtime;
  const listeners = new Map();
  const stage = createElement(), item = createElement(), target = createElement(), area = createElement();
  const geometry = api.FOLD_LAYOUT[stepId];
  const px = (value, size) => value.endsWith('%') ? Number.parseFloat(value) / 100 * size : Number.parseFloat(value);
  const rect = (box, width, height) => {
    const itemWidth = px(box.width, width), itemHeight = px(box.height, height);
    const left = box.left ? px(box.left, width) : width - px(box.right, width) - itemWidth;
    return { left, top:px(box.top, height), right:left + itemWidth, bottom:px(box.top, height) + itemHeight, width:itemWidth, height:itemHeight };
  };
  const initial = rect(geometry.item, 750, 380), destination = rect(geometry.target, 750, 380);
  item.offsetWidth = initial.width; item.offsetHeight = initial.height;
  item.style.left = initial.left + 'px'; item.style.top = initial.top + 'px';
  item.getBoundingClientRect = () => {
    const left = parseFloat(item.style.left) || 0, top = parseFloat(item.style.top) || 0;
    return { left, top, right:left + initial.width, bottom:top + initial.height, width:initial.width, height:initial.height };
  };
  target.getBoundingClientRect = () => destination;
  area.getBoundingClientRect = () => ({ left:0, top:0, right:750, bottom:380, width:750, height:380 });
  area.querySelector = selector => ({ '.step-stage':stage, '.interactive-target':item, '.draggable-item':item, '.drag-target':target })[selector] || null;
  area.addEventListener = (type, callback, options) => {
    listeners.set(type, callback);
    options?.signal?.addEventListener('abort', () => listeners.delete(type));
  };
  api.state.currentLevel = 1; api.state.currentStep = stepId - 1;
  api.StepProgress.reset(api.LEVELS[1].steps[stepId - 1]);
  api.attachGestureListeners(api.LEVELS[1].steps[stepId - 1], area);
  const dispatch = (phase, x, y = 50) => {
    const type = kind === 'mouse' ? { start:'mousedown', move:'mousemove', end:'mouseup' }[phase] : { start:'touchstart', move:'touchmove', end:'touchend' }[phase];
    listeners.get(type)?.({ clientX:x, clientY:y, touches:[{ clientX:x, clientY:y }], changedTouches:[{ clientX:x, clientY:y }], preventDefault() {} });
  };
  return { ...runtime, item, target:destination, dispatch, complete: () => api.state.stepCompleted.has(stepId - 1) };
}

test('laundry renders seven scenes with one main target and passive delayed demos', () => {
  const { api } = loadRuntime();
  for (let id = 1; id <= 7; id++) {
    const scene = api.buildScene('laundry', api.LEVELS[0].steps[id - 1]);
    assert.match(scene, new RegExp(`demo-element demo-laundry-${id}`));
    assert.equal((scene.match(/interactive-target/g) || []).length, 1);
    assert.match(scene, /aria-hidden="true"/);
    assert.match(scene, /assets\/laundry\//);
    assert.doesNotMatch(scene, /class="[^"]*interactive-target[^"]*demo-element/);
  }
  const scene = id => api.buildScene('laundry', api.LEVELS[0].steps[id - 1]);
  assert.match(scene(1), /data-target="basin"/);
  assert.match(scene(2), /data-item="faucet"/);
  assert.match(scene(3), /data-item="detergent"/);
  assert.match(scene(5), /laundry-auto-flip/);
  assert.match(scene(6), /data-target="water"/);
  assert.match(scene(7), /laundry-partner-hand/);
  assert.equal(api.LEVELS[0].steps[6].gesture, 'push-inward');
});

test('laundry persistent state requires real prior completion and keeps clean wet and rinsed outcomes', () => {
  const { api } = loadRuntime();
  const states = ['in-basin', 'wet', 'soapy', 'front-clean', 'back-clean', 'rinsed', 'wrung'];
  for (let id = 1; id <= 7; id++) {
    assert.doesNotMatch(api.buildPersistentStateHTML('laundry', id + 1), new RegExp(`state-laundry-${states[id - 1]}`));
    api.SkillSceneState.complete('laundry', id);
    assert.match(api.buildPersistentStateHTML('laundry', id + 1), new RegExp(`state-laundry-${states[id - 1]}`));
    assert.doesNotMatch(api.buildPersistentStateHTML('laundry', id), new RegExp(`state-laundry-${states[id - 1]}`));
  }
  const final = api.buildPersistentStateHTML('laundry', 8);
  assert.match(final, /state-laundry-in-basin/);
  assert.match(final, /state-laundry-rinsed/);
  assert.doesNotMatch(final, /state-laundry-soapy/);
});

test('clothes folding keeps one whole sweatshirt through all seven states', () => {
  const { api } = loadRuntime();
  const expectedActions = ['flat', 'smooth', 'left-sleeve', 'right-sleeve', 'left-body', 'right-body', 'hem-up'];
  for (let stepId = 1; stepId <= 7; stepId++) {
    const scene = api.buildScene('fold-clothes', api.LEVELS[1].steps[stepId - 1]);
    assert.match(scene, /data-garment="whole-sweatshirt"/);
    assert.match(scene, new RegExp(`demo-element demo-fold-clothes-${stepId}`));
    assert.match(scene, new RegExp(`data-fold-action="${expectedActions[stepId - 1]}"`));
    assert.equal((scene.match(/interactive-target/g) || []).length, 1);
    assert.match(scene, /assets\/folding\/sweatshirt-(flat|folded)\.png/);
    assert.doesNotMatch(scene, /class="[^"]*interactive-target[^"]*demo-element/);
  }
});

test('clothes folding retains only completed folds in the next step', () => {
  const { api } = loadRuntime();
  const folds = ['flat', 'smooth', 'left-sleeve', 'right-sleeve', 'left-body', 'right-body', 'hem-up'];
  for (let stepId = 1; stepId <= 7; stepId++) {
    assert.doesNotMatch(api.buildPersistentStateHTML('fold-clothes', stepId + 1), new RegExp(`state-fold-${folds[stepId - 1]}`));
    api.SkillSceneState.complete('fold-clothes', stepId);
    assert.match(api.buildPersistentStateHTML('fold-clothes', stepId + 1), new RegExp(`state-fold-${folds[stepId - 1]}`));
    assert.doesNotMatch(api.buildPersistentStateHTML('fold-clothes', stepId), new RegExp(`state-fold-${folds[stepId - 1]}`));
  }
});

test('clothes folding completed states keep visible layers on the whole garment', () => {
  const source = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const layers = [
    ['smooth', 'folding-smooth'], ['left-sleeve', 'folding-left-sleeve'], ['right-sleeve', 'folding-right-sleeve'],
    ['left-body', 'folding-left-body'], ['right-body', 'folding-right-body'], ['hem-up', 'folding-final']
  ];
  for (const [state, layer] of layers) {
    assert.match(source, new RegExp(`state-fold-${state} ~ \\.folding-garment .*\\.${layer}`));
  }
});

for (const kind of ['mouse', 'touch']) {
  test(`clothes folding ${kind} step one accepts a 35 percent table overlap after a real drag`, () => {
    const r = foldingGesture(1, kind);
    const item = r.item.getBoundingClientRect(), target = r.target;
    const startX = item.left + item.width / 2, startY = item.top + item.height / 2;
    const endX = target.left + target.width / 2, endY = target.top + target.height / 2;
    r.dispatch('start', startX, startY); r.dispatch('move', endX, endY); r.dispatch('end', endX, endY);
    assert.equal(r.complete(), true);
  });

  test(`clothes folding ${kind} smoothing starts on the garment and moves down`, () => {
    const blank = foldingGesture(2, kind);
    blank.dispatch('start', 20, 20); blank.dispatch('move', 20, 90); blank.dispatch('end', 20, 90);
    assert.equal(blank.complete(), false);
    const up = foldingGesture(2, kind), upItem = up.item.getBoundingClientRect();
    const upX = upItem.left + upItem.width / 2, upY = upItem.top + upItem.height / 2;
    up.dispatch('start', upX, upY); up.dispatch('move', upX, upY - 60); up.dispatch('end', upX, upY - 60);
    assert.equal(up.complete(), false);
    const down = foldingGesture(2, kind), downItem = down.item.getBoundingClientRect();
    const downX = downItem.left + downItem.width / 2, downY = downItem.top + downItem.height / 2;
    down.dispatch('start', downX, downY); down.dispatch('move', downX, downY + 60); down.dispatch('end', downX, downY + 60);
    assert.equal(down.complete(), true);
  });
}

test('clothes folding uses a table target large enough for the whole garment', () => {
  const { api } = loadRuntime();
  assert.equal(api.FOLD_LAYOUT[1].item.width, '300px');
  assert.equal(api.FOLD_LAYOUT[1].target.width, '40%');
  assert.equal(api.FOLD_LAYOUT[1].target.height, '78%');
});

for (const kind of ['mouse', 'touch']) {
  test(`clothes folding ${kind} drag steps require movement from their configured start`, () => {
    for (const stepId of [1, 3, 4, 5, 6, 7]) {
      const idle = foldingGesture(stepId, kind);
      const start = idle.item.getBoundingClientRect();
      const startX = start.left + start.width / 2, startY = start.top + start.height / 2;
      idle.dispatch('start', startX, startY); idle.dispatch('end', startX, startY);
      assert.equal(idle.complete(), false, `step ${stepId} cannot complete without movement`);

      const moved = foldingGesture(stepId, kind);
      const item = moved.item.getBoundingClientRect();
      const target = moved.target;
      const itemX = item.left + item.width / 2, itemY = item.top + item.height / 2;
      const targetX = target.left + target.width / 2, targetY = target.top + target.height / 2;
      moved.dispatch('start', itemX, itemY); moved.dispatch('move', targetX, targetY); moved.dispatch('end', targetX, targetY);
      assert.equal(moved.complete(), true, `step ${stepId} accepts a drag to its configured target`);
    }
  });
}

test('laundry back remains dirty until its own rubbing is completed', () => {
  const { api } = loadRuntime();
  api.SkillSceneState.complete('laundry', 4);
  assert.match(api.buildScene('laundry', api.LEVELS[0].steps[4]), /shirt-dirty\.png/);
  api.SkillSceneState.complete('laundry', 5);
  assert.match(api.buildScene('laundry', api.LEVELS[0].steps[5]), /shirt-clean\.png/);
});

for (const kind of ['mouse', 'touch']) {
  test(`laundry ${kind} drag accepts 35 percent basin overlap and rejects less`, () => {
    for (const [endX, expected] of [[184, false], [185, true]]) {
      const r = laundryGesture(1, kind);
      r.dispatch('start', 50); r.dispatch('move', endX); r.dispatch('end', endX);
      assert.equal(r.complete(), expected);
    }
  });
  test(`laundry ${kind} taps require the actual faucet or detergent and filling animation`, () => {
    for (const id of [2, 3]) {
      const r = laundryGesture(id, kind);
      r.dispatch('start', 600); r.dispatch('end', 600);
      assert.equal(r.complete(), false);
      r.dispatch('start', 50); r.dispatch('end', 50);
      assert.equal(r.complete(), false);
      r.advance(1200);
      assert.equal(r.complete(), true);
    }
  });
  test(`laundry ${kind} rubbing requires three horizontal strokes on the hand after automatic flip`, () => {
    for (const id of [4, 5]) {
      const r = laundryGesture(id, kind);
      const stroke = (x = 100, y = 50) => { r.dispatch('start', 50); r.dispatch('move', x, y); r.dispatch('end', x, y); };
      if (id === 5) { stroke(); assert.equal(r.api.StepProgress.current, 0); r.advance(900); }
      stroke(50, 100); stroke(89);
      assert.equal(r.api.StepProgress.current, 0);
      stroke(); stroke(); assert.equal(r.complete(), false);
      stroke(); assert.equal(r.complete(), true);
    }
  });
  test(`laundry ${kind} rinse needs two continuous seconds and resets outside water or on cancel`, () => {
    const r = laundryGesture(6, kind);
    r.dispatch('start', 50); r.dispatch('move', 250);
    r.advance(1999); assert.equal(r.complete(), false);
    r.dispatch('move', 50); r.advance(1); assert.equal(r.complete(), false);
    r.dispatch('move', 250); r.advance(1000); r.dispatch('cancel', 250);
    r.advance(2000); assert.equal(r.complete(), false);
    r.dispatch('start', 50); r.dispatch('move', 250); r.advance(1999);
    assert.equal(r.complete(), false);
    r.advance(1); assert.equal(r.complete(), true);
  });
  test(`laundry ${kind} short water drop cannot bypass dwell and aborted step cancels timer`, () => {
    const r = laundryGesture(6, kind);
    r.dispatch('start', 50); r.dispatch('move', 250); r.dispatch('end', 250);
    assert.equal(r.complete(), false);
    r.api.state.stepAbortController.abort(); r.advance(3000);
    assert.equal(r.complete(), false);
  });
  test(`laundry ${kind} regrabbing during rinse starts at the current shirt position`, () => {
    const r = laundryGesture(6, kind);
    r.dispatch('start', 50); r.dispatch('move', 250); r.dispatch('end', 250);
    r.advance(1000);
    r.dispatch('start', 250); r.dispatch('move', 260);
    assert.equal(r.item.style.left, '210px');
    r.advance(1999); assert.equal(r.complete(), false);
    r.advance(1); assert.equal(r.complete(), true);
  });
  test(`laundry ${kind} completed rinse cannot be moved or reset while the finger is still held`, () => {
    const r = laundryGesture(6, kind);
    r.dispatch('start', 50); r.dispatch('move', 250); r.advance(2000);
    assert.equal(r.complete(), true);
    const left = r.item.style.left;
    r.dispatch('move', 50); r.dispatch('end', 50); r.dispatch('cancel', 50);
    assert.equal(r.item.style.left, left);
  });
  test(`laundry ${kind} inward hand drag mirrors the second hand and rejects outward or short gestures`, () => {
    const r = laundryGesture(7, kind);
    for (const x of [0, 89]) { r.dispatch('start', 50); r.dispatch('move', x); r.dispatch('end', x); assert.equal(r.complete(), false); }
    r.dispatch('start', 50); r.dispatch('move', 100);
    assert.match(r.partner.style.transform, /translate\(-50px/);
    r.dispatch('end', 100); assert.equal(r.complete(), true);
    assert.equal(r.spoken.at(-1).text, '衣服洗干净啦');
  });
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
      ['把衣服平平地放在桌上。', '用小手把衣服抚平。', '把这边的袖子折进来。', '再把另一边的袖子折进来。', '把衣服这边折到中间。', '再把另一边折到中间。', '把衣服下面向上折，叠好啦。'],
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
