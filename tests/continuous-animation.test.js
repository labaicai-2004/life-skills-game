const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

class ClassList {
  constructor() { this.values = new Set(); }
  add(...names) { names.forEach(name => this.values.add(name)); }
  remove(...names) { names.forEach(name => this.values.delete(name)); }
  contains(name) { return this.values.has(name); }
}

function createElement() {
  const listeners = new Map();
  return {
    classList: new ClassList(),
    style: { setProperty() {} },
    dataset: {},
    isConnected: true,
    addEventListener(type, handler) { listeners.set(type, handler); },
    removeEventListener(type) { listeners.delete(type); },
    dispatch(type, event) { listeners.get(type)(event); },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    appendChild(child) { this.lastChild = child; },
    removeChild() {},
    click() {},
    remove() { this.isConnected = false; },
    getBoundingClientRect() { return { left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 }; }
  };
}

function loadAnimationRuntime() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const timers = [];
  const elements = {
    'next-step-btn': createElement(),
    'step-number-label': createElement(),
    'step-instruction': createElement(),
    'progress-dots': createElement(),
    scene: createElement(),
    'interaction-area': createElement(),
    'start-screen': createElement(),
    'game-screen': createElement(),
    'volume-btn': createElement()
  };
  const document = {
    addEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getElementById(id) { return elements[id] || createElement(); },
    body: createElement(),
    createElement() {
      const wrapper = createElement();
      Object.defineProperty(wrapper, 'innerHTML', {
        set() { this.firstElementChild = createElement(); }
      });
      return wrapper;
    }
  };
  const context = {
    AbortController,
    Audio: class {
      play() { return { catch() {} }; }
      pause() {}
    },
    Blob: class {},
    Date,
    JSON,
    Math,
    console,
    document,
    localStorage: { getItem() { return null; }, setItem() {} },
    requestAnimationFrame(callback) { callback(); },
    setInterval() { return 1; },
    clearInterval() {},
    setTimeout(callback, delay) { timers.push({ callback, delay, cleared: false }); return timers.length; },
    clearTimeout(id) { if (timers[id - 1]) timers[id - 1].cleared = true; },
    window: {
      addEventListener() {},
      matchMedia() { return { matches: false }; }
    },
    URL: { createObjectURL() { return 'blob:test'; } }
  };
  context.globalThis = context;
  const expose = `
    globalThis.__animationApi = {
      AnimationPolicy, AnimationController, ResearchMode, TrainingModes,
      get currentTrainingMode() { return currentTrainingMode; },
      setTrainingMode(mode) { currentTrainingMode = mode; },
      get state() { return state; }, loadStep, goHome, startLevel,
      handleStepSuccess, attachGestureListeners, STEP_STATE_KEYS,
      SkillSceneState, buildPersistentStateHTML, stepStageHTML, buildScene, LEVELS
    };
  `;
  try {
    vm.runInNewContext(`${script}\n${expose}`, context);
  } catch (error) {
    return { error };
  }
  return {
    api: context.__animationApi,
    elements,
    timers,
    runTimer(index) {
      const timer = timers[index];
      if (!timer.cleared) timer.callback();
    }
  };
}

test('AnimationPolicy enables demonstrations only for teaching intervention sessions', () => {
  const runtime = loadAnimationRuntime();
  assert.equal(runtime.error, undefined, runtime.error?.message);
  const { api } = runtime;
  api.ResearchMode.active = false;
  assert.equal(api.AnimationPolicy.isEnabled(), true);
  api.ResearchMode.active = true;
  api.ResearchMode.phase = 'baseline';
  assert.equal(api.AnimationPolicy.isEnabled(), false);
  api.ResearchMode.phase = 'intervention';
  api.setTrainingMode(api.TrainingModes.TEACHING);
  assert.equal(api.AnimationPolicy.isEnabled(), true);
  api.setTrainingMode(api.TrainingModes.ASSESSMENT);
  assert.equal(api.AnimationPolicy.isEnabled(), false);
});

test('AnimationController delays the demonstration, pauses it, and clears its stage state', () => {
  const runtime = loadAnimationRuntime();
  assert.equal(runtime.error, undefined, runtime.error?.message);
  const { api } = runtime;
  const stage = createElement();
  api.AnimationController.schedule(stage);
  assert.equal(runtime.timers[0].delay, 2000);
  assert.equal(stage.classList.contains('demo-running'), false);
  runtime.runTimer(0);
  assert.equal(stage.classList.contains('demo-running'), true);
  api.AnimationController.pause(stage);
  assert.equal(stage.classList.contains('demo-paused'), true);
  api.AnimationController.clear();
  assert.equal(stage.classList.contains('demo-running'), false);
  assert.equal(stage.classList.contains('demo-paused'), false);
  assert.equal(api.AnimationController.currentStage, null);
});

test('step lifecycle schedules on entry, pauses on first touch, and clears on return home', () => {
  const runtime = loadAnimationRuntime();
  assert.equal(runtime.error, undefined, runtime.error?.message);
  const { api, elements } = runtime;
  api.state.currentLevel = 0;
  api.loadStep(0);
  const stage = elements.scene.lastChild;
  assert.equal(api.AnimationController.currentStage, stage);
  elements['interaction-area'].dispatch('touchstart', {
    touches: [{ clientX: 20, clientY: 20 }],
    preventDefault() {}
  });
  assert.equal(stage.classList.contains('demo-paused'), true);
  api.goHome();
  assert.equal(api.AnimationController.currentStage, null);
  assert.equal(stage.classList.contains('demo-paused'), false);
});

test('STEP_STATE_KEYS maps all three skills to their seven persistent-state keys', () => {
  const runtime = loadAnimationRuntime();
  assert.equal(runtime.error, undefined, runtime.error?.message);
  assert.equal(JSON.stringify(runtime.api.STEP_STATE_KEYS), JSON.stringify({
    brush: ['toothbrushFound', 'toothpasteApplied', 'toothbrushPickedUp', 'leftBrushed', 'rightBrushed', 'rinsed', 'mouthWiped'],
    wash: ['faucetOn', 'waterCollected', 'towelWet', 'towelWrung', 'faceWashed', 'towelRinsed', 'faucetOff'],
    dress: ['jacketFound', 'frontIdentified', 'leftSleeveOn', 'rightSleeveOn', 'jacketPulledDown', 'zipperClosed', 'collarAdjusted']
  }));
});

test('SkillSceneState resets, completes mapped steps, and reports only completed keys', () => {
  const runtime = loadAnimationRuntime();
  assert.equal(runtime.error, undefined, runtime.error?.message);
  const { SkillSceneState } = runtime.api;
  SkillSceneState.reset();
  assert.equal(SkillSceneState.has('brush', 'toothpasteApplied'), false);
  SkillSceneState.complete('brush', 2);
  SkillSceneState.complete('wash', 5);
  assert.equal(SkillSceneState.has('brush', 'toothpasteApplied'), true);
  assert.equal(SkillSceneState.has('wash', 'faceWashed'), true);
  assert.equal(SkillSceneState.has('dress', 'zipperClosed'), false);
  SkillSceneState.reset();
  assert.equal(SkillSceneState.has('brush', 'toothpasteApplied'), false);
  assert.equal(SkillSceneState.has('wash', 'faceWashed'), false);
});

test('starting a level and returning home reset persistent skill state', () => {
  const runtime = loadAnimationRuntime();
  assert.equal(runtime.error, undefined, runtime.error?.message);
  const { api } = runtime;
  api.SkillSceneState.complete('brush', 2);
  api.startLevel(1);
  assert.equal(api.SkillSceneState.has('brush', 'toothpasteApplied'), false);
  api.SkillSceneState.complete('wash', 1);
  api.goHome();
  assert.equal(api.SkillSceneState.has('wash', 'faucetOn'), false);
});

test('handleStepSuccess stores the current level step in persistent state', () => {
  const runtime = loadAnimationRuntime();
  assert.equal(runtime.error, undefined, runtime.error?.message);
  const { api } = runtime;
  api.SkillSceneState.reset();
  api.state.currentLevel = 2;
  api.state.currentStep = 5;
  api.handleStepSuccess(createElement());
  assert.equal(api.SkillSceneState.has('dress', 'zipperClosed'), true);
});

test('persistent state markup includes only prior indicators and stage markup receives level and step', () => {
  const runtime = loadAnimationRuntime();
  assert.equal(runtime.error, undefined, runtime.error?.message);
  const { api } = runtime;
  api.SkillSceneState.reset();
  api.SkillSceneState.complete('brush', 2);
  api.SkillSceneState.complete('brush', 4);
  api.SkillSceneState.complete('brush', 5);
  const priorState = api.buildPersistentStateHTML('brush', 6);
  assert.match(api.buildPersistentStateHTML('brush', 3), /state-paste-on-brush/);
  assert.doesNotMatch(priorState, /state-paste-on-brush/);
  assert.match(priorState, /state-clean-both/);
  assert.doesNotMatch(api.buildPersistentStateHTML('brush', 2), /state-paste-on-brush/);
  assert.match(priorState, /persistent-state/);
  assert.match(priorState, /aria-hidden="true"/);
  const stage = api.stepStageHTML('<div class="objects"></div>', '<div class="guide"></div>', 'brush', 6);
  assert.match(stage, /data-level="brush"/);
  assert.match(stage, /data-step="6"/);
  assert.doesNotMatch(stage, /state-paste-on-brush/);
  assert.match(stage, /objects/);
  assert.match(stage, /guide/);
});

test('brushing scenes provide seven delayed, non-interactive demonstration markers', () => {
  const runtime = loadAnimationRuntime();
  assert.equal(runtime.error, undefined, runtime.error?.message);
  const { api } = runtime;
  const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

  for (let stepId = 1; stepId <= 7; stepId++) {
    const scene = api.buildScene('brush', api.LEVELS[0].steps[stepId - 1]);
    assert.match(scene, new RegExp(`demo-element demo-brush-${stepId}`));
    assert.match(scene, /aria-hidden="true"/);
    assert.match(source, new RegExp(`\\.step-stage\\.demo-running\\s+\\.demo-brush-${stepId}\\s*\\{`));
  }

  assert.match(source, /\.demo-element, \.persistent-state\s*\{\s*pointer-events:none;/);
  for (const keyframe of [
    'demoFindPulse', 'demoPasteSqueeze', 'demoPasteDrop', 'demoPickUp',
    'demoBrushVertical', 'demoCupTilt', 'demoWipeHorizontal', 'cleanSparkle'
  ]) {
    assert.match(source, new RegExp(`@keyframes ${keyframe}`));
  }
});

test('brushing drag demonstrations animate a separate ghost and leave the real draggable item still', () => {
  const runtime = loadAnimationRuntime();
  assert.equal(runtime.error, undefined, runtime.error?.message);
  const { api } = runtime;

  for (const stepId of [4, 5, 7]) {
    const scene = api.buildScene('brush', api.LEVELS[0].steps[stepId - 1]);
    assert.match(scene, new RegExp(`demo-element demo-brush-${stepId} demo-ghost`));
    assert.doesNotMatch(scene, /class="[^"]*draggable-item[^"]*demo-element/);
  }
});

test('brushing continuity indicators appear only after their required completed steps', () => {
  const runtime = loadAnimationRuntime();
  assert.equal(runtime.error, undefined, runtime.error?.message);
  const { SkillSceneState, buildPersistentStateHTML } = runtime.api;
  SkillSceneState.reset();

  assert.doesNotMatch(buildPersistentStateHTML('brush', 3), /state-paste-on-brush/);
  SkillSceneState.complete('brush', 2);
  assert.match(buildPersistentStateHTML('brush', 3), /state-paste-on-brush/);
  assert.doesNotMatch(buildPersistentStateHTML('brush', 6), /state-paste-on-brush/);

  assert.doesNotMatch(buildPersistentStateHTML('brush', 5), /state-clean-left/);
  SkillSceneState.complete('brush', 4);
  assert.match(buildPersistentStateHTML('brush', 5), /state-clean-left/);

  assert.doesNotMatch(buildPersistentStateHTML('brush', 6), /state-clean-both/);
  SkillSceneState.complete('brush', 5);
  assert.match(buildPersistentStateHTML('brush', 6), /state-clean-both/);

  assert.doesNotMatch(buildPersistentStateHTML('brush', 6), /state-final-clean-mouth/);
  assert.match(buildPersistentStateHTML('brush', 7), /state-final-clean-mouth/);
  assert.match(buildPersistentStateHTML('brush', 7), /aria-hidden="true"/);
});
