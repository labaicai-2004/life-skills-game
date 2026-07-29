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
    style: {},
    dataset: {},
    isConnected: true,
    addEventListener(type, handler) { listeners.set(type, handler); },
    removeEventListener(type) { listeners.delete(type); },
    dispatch(type, event) { listeners.get(type)(event); },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    appendChild(child) { this.lastChild = child; },
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
    }
  };
  context.globalThis = context;
  const expose = `
    globalThis.__animationApi = {
      AnimationPolicy, AnimationController, ResearchMode, TrainingModes,
      get currentTrainingMode() { return currentTrainingMode; },
      setTrainingMode(mode) { currentTrainingMode = mode; },
      get state() { return state; }, loadStep, goHome, attachGestureListeners
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
