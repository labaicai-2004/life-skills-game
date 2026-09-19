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
  const styleValues = new Map();
  return {
    classList: new ClassList(),
    style: {
      setProperty(name, value) { styleValues.set(name, String(value)); },
      getPropertyValue(name) { return styleValues.get(name) || ''; }
    },
    dataset: {},
    isConnected: true,
    addEventListener(type, handler, options = {}) {
      const entries = listeners.get(type) || [];
      entries.push({ handler, once: options.once === true });
      listeners.set(type, entries);
    },
    removeEventListener(type, handler) {
      listeners.set(type, (listeners.get(type) || []).filter(entry => entry.handler !== handler));
    },
    dispatch(type, event = {}) {
      for (const entry of [...(listeners.get(type) || [])]) {
        entry.handler({ type, target: this, currentTarget: this, ...event });
        if (entry.once) this.removeEventListener(type, entry.handler);
      }
    },
    querySelector(selector) { return selector === '.demo-element' ? this.demoElements?.[0] || null : null; },
    querySelectorAll(selector) { return selector === '.demo-element' ? this.demoElements || [] : []; },
    appendChild(child) { this.lastChild = child; },
    insertAdjacentHTML(position,markup) { this.insertedHTML=(this.insertedHTML || '')+markup; },
    removeChild() {},
    getContext() { return { clearRect() {}, save() {}, restore() {}, translate() {}, rotate() {}, fillRect() {} }; },
    click() {},
    remove() { this.isConnected = false; },
    getBoundingClientRect() { return { left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 }; }
  };
}

function installLaundryDragSurface(elements) {
  const item = createElement(), target = createElement();
  item.style.left = '0px'; item.style.top = '0px';
  item.getBoundingClientRect = () => {
    const left = parseFloat(item.style.left), top = parseFloat(item.style.top);
    return {left,top,right:left+100,bottom:top+100,width:100,height:100};
  };
  target.getBoundingClientRect = () => ({left:200,top:0,right:400,bottom:200,width:200,height:200});
  const area = elements['interaction-area'];
  area.getBoundingClientRect = () => ({left:0,top:0,right:750,bottom:380,width:750,height:380});
  area.querySelector = selector => selector === '.step-stage' ? elements.scene.lastChild : selector === '.interactive-target' ? item : selector === '.drag-target' ? target : null;
}

function getKeyframeBody(source, name) {
  const marker = `@keyframes ${name}`;
  const markerIndex = source.indexOf(marker);
  assert.notEqual(markerIndex, -1, `${name} keyframes missing`);
  const openIndex = source.indexOf('{', markerIndex + marker.length);
  let depth = 1;
  for (let index = openIndex + 1; index < source.length; index++) {
    if (source[index] === '{') depth++;
    if (source[index] === '}') depth--;
    if (depth === 0) return source.slice(openIndex + 1, index);
  }
  assert.fail(`${name} keyframes are not closed`);
}

function parsePixelKeyframeBody(body, variables = {}) {
  const resolvedBody = body.replace(/var\(\s*(--[A-Za-z0-9_-]+)(?:\s*,[^)]*)?\)/g, (match, name) => variables[name] || '0px');
  return [...resolvedBody.matchAll(/((?:\d+%\s*,?\s*)+)\{([^}]*)\}/g)]
    .flatMap(([, percentages, declarations]) => {
      const pair = declarations.match(/translate\(\s*(-?[\d.]+)(?:px)?\s*,\s*(-?[\d.]+)(?:px)?\s*\)/);
      const translateX = pair ? Number(pair[1]) : Number(declarations.match(/translateX\(\s*(-?[\d.]+)(?:px)?\s*\)/)?.[1] || 0);
      const translateY = pair ? Number(pair[2]) : Number(declarations.match(/translateY\(\s*(-?[\d.]+)(?:px)?\s*\)/)?.[1] || 0);
      const opacity = Number(declarations.match(/opacity\s*:\s*([\d.]+)/)?.[1] || 1);
      return (percentages.match(/\d+/g) || []).map(percentage => ({
        percentage: Number(percentage), translateX, translateY, opacity
      }));
    })
    .sort((a, b) => a.percentage - b.percentage);
}

function parsePixelKeyframePath(source, name, variables = {}) {
  return parsePixelKeyframeBody(getKeyframeBody(source, name), variables);
}

function stagePathVariables(api, width, height) {
  const stage = createElement();
  stage.getBoundingClientRect = () => ({ left: 0, top: 0, right: width, bottom: height, width, height });
  api.AnimationController.schedule(stage);
  const names = [
    '--demo-brush-left-x', '--demo-brush-right-x', '--demo-brush-arrive-y',
    '--demo-brush-up-y', '--demo-brush-down-y', '--demo-wash-center-x',
    '--demo-left-sleeve-arrive-x', '--demo-left-sleeve-action-x', '--demo-sleeve-arrive-y',
    '--demo-right-sleeve-arrive-x', '--demo-right-sleeve-action-x',
    '--demo-pull-arrive-x', '--demo-pull-arrive-y', '--demo-pull-action-y',
    '--demo-zip-arrive-x', '--demo-zip-arrive-y', '--demo-zip-action-y',
    '--demo-collar-arrive-x', '--demo-collar-left-x', '--demo-collar-right-x', '--demo-collar-arrive-y'
  ];
  return Object.fromEntries(names.map(name => [name, stage.style.getPropertyValue(name)]));
}

function loadAnimationRuntime(sourceMutation = source => source) {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const script = sourceMutation(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
  const timers = [];
  const storage = new Map();
  const spoken = [];
  let now = 1_750_000_000_000;
  class ControlledDate extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }
  const localStorage = {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, String(value)); },
    removeItem(key) { storage.delete(key); },
    clear() { storage.clear(); }
  };
  const elements = {
    'next-step-btn': createElement(),
    'step-number-label': createElement(),
    'step-instruction': createElement(),
    'progress-dots': createElement(),
    scene: createElement(),
    'interaction-area': createElement(),
    'start-screen': createElement(),
    'game-screen': createElement(),
    'volume-btn': createElement(),
    'research-child-id': createElement(),
    'research-session-num': createElement(),
    'research-date': createElement(),
    'research-week': createElement(),
    'research-status-bar': createElement(),
    'research-overlay': createElement(),
    'selected-phase': createElement(),
    'selected-skill': createElement()
  };
  elements['selected-phase'].dataset.phase = 'intervention';
  elements['selected-skill'].dataset.skill = 'laundry';
  const document = {
    addEventListener() {},
    querySelector(selector) {
      if (selector === '.phase-btn.selected') return elements['selected-phase'];
      if (selector === '.skill-btn.selected') return elements['selected-skill'];
      return null;
    },
    querySelectorAll() { return []; },
    getElementById(id) {
      if (!elements[id]) elements[id] = createElement();
      return elements[id];
    },
    body: createElement(),
    createElement() {
      const wrapper = createElement();
      Object.defineProperty(wrapper, 'innerHTML', {
        set(markup) {
          const stage = createElement();
          stage.demoElements = markup.includes('demo-element') ? [createElement()] : [];
          this.firstElementChild = stage;
        }
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
    Date: ControlledDate,
    JSON,
    Math,
    SpeechSynthesisUtterance: class { constructor(text) {this.text=text;} },
    console,
    document,
    localStorage,
    performance: { now() { return now; } },
    requestAnimationFrame() { return 1; },
    setInterval() { return 1; },
    clearInterval() {},
    setTimeout(callback, delay) {
      timers.push({ callback, delay, dueAt: now + delay, cleared: false, ran: false });
      return timers.length;
    },
    clearTimeout(id) { if (timers[id - 1]) timers[id - 1].cleared = true; },
    window: {
      addEventListener() {},
      speechSynthesis: { cancel() {}, getVoices() {return [{lang:'zh-CN',name:'Tingting'}];}, speak(utterance) {spoken.push(utterance.text);} },
      matchMedia() { return { matches: false }; }
    },
    URL: { createObjectURL() { return 'blob:test'; } }
  };
  context.globalThis = context;
  const expose = `
    globalThis.__animationApi = {
      AnimationPolicy, AnimationController, ResearchMode, TrainingModes,
      UnifiedDataManager,
      get promptState() { return promptState; },
      get currentTrainingMode() { return currentTrainingMode; },
      setTrainingMode(mode) { currentTrainingMode = mode; },
      get state() { return state; }, loadStep, goHome, startLevel,
      handleStepSuccess, goNextStep, closeCelebration,
      finishCurrentLevel: typeof finishCurrentLevel === 'undefined' ? undefined : finishCurrentLevel,
      attachGestureListeners, STEP_STATE_KEYS,
      SkillSceneState, buildPersistentStateHTML, stepStageHTML, buildScene, LEVELS,
      applyPromptLevel, PROMPT_LEVELS
      , hideAllArrows
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
    spoken,
    localStorage,
    advanceClock(milliseconds) { now += milliseconds; },
    runTimersThroughNow() {
      let nextTimer;
      while ((nextTimer = timers.find(timer => !timer.cleared && !timer.ran && timer.dueAt <= now))) {
        nextTimer.ran = true;
        nextTimer.callback();
      }
    },
    runTimer(index) {
      const timer = timers[index];
      if (!timer.cleared) {
        timer.ran = true;
        timer.callback();
      }
    }
  };
}

test('research teaching at 2.1 seconds has no unrecorded demonstration or early voice', () => {
  const r=loadAnimationRuntime(),{api}=r;
  api.ResearchMode.active=true;api.ResearchMode.phase='intervention';
  api.setTrainingMode(api.TrainingModes.TEACHING);api.startLevel(0);
  r.advanceClock(200);r.runTimersThroughNow();
  r.advanceClock(1900);r.runTimersThroughNow();
  const stage=r.elements.scene.lastChild;
  assert.equal(stage.classList.contains('demo-running'),false);
  assert.equal(stage.dataset.promptLevel,'0');
  assert.deepEqual(r.spoken,[]);
  assert.equal(api.promptState.promptUsed,0);
});

test('assessment suppresses all new guides and demonstration even with prompting disabled', () => {
  const r=loadAnimationRuntime(),{api}=r;
  api.ResearchMode.active=true;api.ResearchMode.phase='intervention';
  api.setTrainingMode(api.TrainingModes.ASSESSMENT);api.promptState.enabled=false;api.startLevel(2);
  r.advanceClock(2100);r.runTimersThroughNow();
  assert.equal(r.elements.scene.lastChild.dataset.promptLevel,'0');
  assert.equal(r.elements.scene.lastChild.classList.contains('demo-running'),false);
  assert.deepEqual(r.spoken,[]);
  assert.equal(api.promptState.promptUsed,0);
});

test('new scene hint levels and hideAllArrows share the same scene visibility state', () => {
  const r=loadAnimationRuntime(),{api,elements}=r;
  api.startLevel(1);
  elements['interaction-area'].querySelector=selector=>selector==='.step-stage'?elements.scene.lastChild:null;
  elements.scene.querySelector=selector=>selector==='.step-stage'?elements.scene.lastChild:null;
  for(const level of [0,1,2,3,4]) {
    api.applyPromptLevel(level);
    assert.equal(elements.scene.lastChild.dataset.promptLevel,String(level));
    assert.equal(api.state.stepCompleted.size,0,'offering a demonstration cannot complete a task');
  }
  api.hideAllArrows();
  assert.equal(elements.scene.lastChild.dataset.promptLevel,'0');
});

test('AnimationPolicy follows the full inactive, intervention, baseline, and maintenance matrix', () => {
  const runtime = loadAnimationRuntime();
  assert.equal(runtime.error, undefined, runtime.error?.message);
  const { api } = runtime;
  const modes = [api.TrainingModes.TEACHING, api.TrainingModes.PRACTICE, api.TrainingModes.ASSESSMENT];

  for (const mode of modes) {
    api.ResearchMode.active = false;
    api.setTrainingMode(mode);
    assert.equal(api.AnimationPolicy.isEnabled(), mode.id !== 'assessment', `inactive ${mode.id}`);
  }

  for (const phase of ['intervention', 'baseline', 'maintenance']) {
    for (const mode of modes) {
      api.ResearchMode.active = true;
      api.ResearchMode.phase = phase;
      api.setTrainingMode(mode);
      assert.equal(
        api.AnimationPolicy.isEnabled(),
        phase === 'intervention' && mode.id !== 'assessment',
        `${phase} ${mode.id}`
      );
    }
  }
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

test('AnimationController derives transform-only path offsets from each installed stage size', () => {
  const runtime = loadAnimationRuntime();
  assert.equal(runtime.error, undefined, runtime.error?.message);
  const { api } = runtime;
  const cases = [
    {
      width: 750, height: 380,
      expected: {
        '--demo-brush-left-x': -260, '--demo-brush-right-x': 260,
        '--demo-brush-arrive-y': 30, '--demo-brush-up-y': 16, '--demo-brush-down-y': 44,
        '--demo-wash-center-x': -315,
        '--demo-left-sleeve-arrive-x': -540, '--demo-left-sleeve-action-x': -585,
        '--demo-sleeve-arrive-y': -99,
        '--demo-right-sleeve-arrive-x': 533, '--demo-right-sleeve-action-x': 578,
        '--demo-pull-arrive-x': 90, '--demo-pull-arrive-y': 152, '--demo-pull-action-y': 190,
        '--demo-zip-arrive-x': 55, '--demo-zip-arrive-y': -160, '--demo-zip-action-y': -209,
        '--demo-collar-arrive-x': -240, '--demo-collar-left-x': -293,
        '--demo-collar-right-x': -188, '--demo-collar-arrive-y': -34
      }
    },
    {
      width: 600, height: 700,
      expected: {
        '--demo-brush-left-x': -193, '--demo-brush-right-x': 193,
        '--demo-brush-arrive-y': -258, '--demo-brush-up-y': -272, '--demo-brush-down-y': -244,
        '--demo-wash-center-x': -252,
        '--demo-left-sleeve-arrive-x': -432, '--demo-left-sleeve-action-x': -468,
        '--demo-sleeve-arrive-y': -182,
        '--demo-right-sleeve-arrive-x': 426, '--demo-right-sleeve-action-x': 462,
        '--demo-pull-arrive-x': 72, '--demo-pull-arrive-y': 280, '--demo-pull-action-y': 350,
        '--demo-zip-arrive-x': 40, '--demo-zip-arrive-y': -294, '--demo-zip-action-y': -385,
        '--demo-collar-arrive-x': -192, '--demo-collar-left-x': -234,
        '--demo-collar-right-x': -150, '--demo-collar-arrive-y': -63
      }
    }
  ];

  for (const current of cases) {
    const variables = stagePathVariables(api, current.width, current.height);
    for (const [name, expected] of Object.entries(current.expected)) {
      assert.equal(Number(variables[name].replace('px', '')), expected, `${name} at ${current.width}x${current.height}`);
    }
  }
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

test('mouse down pauses the active demonstration before desktop gesture handling', () => {
  const runtime = loadAnimationRuntime();
  assert.equal(runtime.error, undefined, runtime.error?.message);
  const { api, elements } = runtime;
  api.promptState.enabled = false;
  api.startLevel(0);
  const stage = elements.scene.lastChild;
  runtime.advanceClock(2000);
  runtime.runTimersThroughNow();
  assert.equal(stage.classList.contains('demo-running'), true);

  elements['interaction-area'].dispatch('mousedown', { clientX: 20, clientY: 20 });

  assert.equal(stage.classList.contains('demo-paused'), true);
  assert.equal(api.AnimationController.timer, null);
});

test('paused stage freezes demonstration descendants, pseudo-elements, and persistent-state animations', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const pausedSelectors = new Set(
    [...source.matchAll(/([^{}]+)\{([^{}]*animation-play-state\s*:\s*paused\s*!important;?[^{}]*)\}/g)]
      .flatMap(([, selectors]) => selectors.split(',').map(selector => selector.trim()))
  );
  const animatedLayers = ['.demo-element', '.persistent-state'];

  for (const layer of animatedLayers) {
    for (const suffix of ['', ' *', '::before', '::after', ' *::before', ' *::after']) {
      const selector = `.step-stage.demo-paused ${layer}${suffix}`;
      assert.ok(pausedSelectors.has(selector), `${selector} must receive animation-play-state:paused`);
    }
  }
});

test('continuous demonstration keyframes animate only transform, opacity, or filter', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const animationNames = new Set(
    [...source.matchAll(/\.step-stage\.demo-running[^{}]*\{[^{}]*animation\s*:\s*([A-Za-z0-9_-]+)/g)]
      .map(([, name]) => name)
  );
  assert.ok(animationNames.size > 0, 'demonstration animation names must be discoverable');

  for (const name of animationNames) {
    const body = getKeyframeBody(source, name);
    for (const [, declarations] of body.matchAll(/\{([^{}]*)\}/g)) {
      const properties = [...declarations.matchAll(/(?:^|;)\s*([A-Za-z-]+)\s*:/g)].map(([, property]) => property);
      for (const property of properties) {
        assert.ok(
          ['transform', 'opacity', 'filter'].includes(property),
          `${name} must not animate layout property ${property}`
        );
      }
    }
  }
});

test('starting another level clears before installing and scheduling the new stage', () => {
  const runtime = loadAnimationRuntime();
  assert.equal(runtime.error, undefined, runtime.error?.message);
  const { api, elements } = runtime;
  api.startLevel(0);
  const oldStage = elements.scene.lastChild;
  const callOrder = [];
  const originalClear = api.AnimationController.clear;
  const originalSchedule = api.AnimationController.schedule;
  const originalAppendChild = elements.scene.appendChild;
  api.AnimationController.clear = function() {
    callOrder.push('clear');
    return originalClear.call(this);
  };
  api.AnimationController.schedule = function(stage) {
    callOrder.push('schedule');
    return originalSchedule.call(this, stage);
  };
  elements.scene.appendChild = function(stage) {
    callOrder.push('install');
    return originalAppendChild.call(this, stage);
  };

  api.startLevel(1);

  assert.ok(callOrder.indexOf('clear') < callOrder.indexOf('install'));
  assert.ok(callOrder.indexOf('clear') < callOrder.indexOf('schedule'));
  assert.ok(callOrder.indexOf('install') < callOrder.indexOf('schedule'));
  assert.equal(oldStage.classList.contains('demo-running'), false);
  assert.equal(oldStage.classList.contains('demo-paused'), false);
  assert.notEqual(api.AnimationController.currentStage, oldStage);
});

test('the original startLevel clears before state assignment and loadStep', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const start = source.indexOf('function startLevel(idx) {');
  const end = source.indexOf('\n}\n', start) + 2;
  const originalStartLevel = source.slice(start, end);
  const assertEarlyClear = functionBody => {
    const clearIndex = functionBody.indexOf('AnimationController.clear();');
    assert.notEqual(clearIndex, -1, 'original startLevel must clear the previous demonstration');
    assert.ok(clearIndex < functionBody.indexOf('state.currentLevel=idx'));
    assert.ok(clearIndex < functionBody.indexOf('loadStep(0)'));
  };

  assertEarlyClear(originalStartLevel);
  const withoutFirstClear = originalStartLevel.replace('  AnimationController.clear();\n', '');
  assert.throws(
    () => assertEarlyClear(withoutFirstClear),
    /original startLevel must clear the previous demonstration/
  );
});

test('leaving within 100ms cancels prompt initialization and old instruction speech', () => {
  const r=loadAnimationRuntime();
  r.api.startLevel(0);
  r.advanceClock(100);r.api.goHome();
  const events=r.api.UnifiedDataManager.events.length;
  r.advanceClock(10000);
  assert.doesNotThrow(()=>r.runTimersThroughNow());
  assert.deepEqual(r.spoken,[]);
  assert.equal(r.api.UnifiedDataManager.events.length,events);
});

test('rapid level switch leaves only one prompt chain and no prior instruction', () => {
  const r=loadAnimationRuntime();
  r.api.promptState.enabled=false;
  r.api.startLevel(0);r.advanceClock(100);r.api.startLevel(1);
  r.advanceClock(400);r.runTimersThroughNow();
  r.advanceClock(400);r.runTimersThroughNow();
  assert.ok(r.spoken.length>0);
  assert.ok(r.spoken.every(text=>text==='把衣服平平地放在桌上。'));
  assert.equal(r.spoken.length,1,'one initialized scene schedules one voice');
});

test('stale exit animation cannot attach a previous stage after returning home', () => {
  const r=loadAnimationRuntime();
  r.api.startLevel(0);
  const old=r.elements.scene.lastChild;
  r.elements.scene.querySelector=selector=>selector==='.step-stage'?old:null;
  r.api.loadStep(1);
  r.api.goHome();
  old.dispatch('animationend');
  assert.equal(r.api.AnimationController.currentStage,null);
  assert.equal(r.api.state.stepAbortController,null);
});

test('completion before delayed prompt initialization cannot restart prompting', () => {
  const r=loadAnimationRuntime(),{api,elements}=r;
  api.startLevel(0);
  api.handleStepSuccess(elements['interaction-area']);
  const events=api.UnifiedDataManager.events.length, voices=r.spoken.length;
  r.advanceClock(200);r.runTimersThroughNow();
  r.advanceClock(5000);r.runTimersThroughNow();
  assert.equal(api.UnifiedDataManager.events.length,events);
  assert.equal(r.spoken.length,voices);
  assert.equal(api.promptState.escalationTimer,null);
});

test('practice prompt remains visible when the new stage enters after 250ms exit', () => {
  const r=loadAnimationRuntime(),{api,elements}=r;
  api.setTrainingMode(api.TrainingModes.PRACTICE);
  api.startLevel(1);
  const old=elements.scene.lastChild;
  elements.scene.querySelector=selector=>selector==='.step-stage'?elements.scene.lastChild:null;
  api.loadStep(1);
  r.advanceClock(200);r.runTimersThroughNow();
  r.advanceClock(50);old.dispatch('animationend');
  assert.notEqual(elements.scene.lastChild,old);
  assert.equal(elements.scene.lastChild.dataset.promptLevel,'1');
});

test('new session preserves all 55 historical summaries and research records', () => {
  const {api, localStorage} = loadAnimationRuntime();
  const old = Array.from({length:55}, (_,id) => ({sessionId:`old-${id}`, taskId:'brush'}));
  localStorage.setItem('session_summaries', JSON.stringify(old));
  localStorage.setItem('researchRecords', JSON.stringify(old));
  api.UnifiedDataManager.startSession('laundry');
  api.UnifiedDataManager.endSession();
  assert.deepEqual(JSON.parse(localStorage.getItem('session_summaries')).slice(0,55), old);
  assert.equal(JSON.parse(localStorage.getItem('session_summaries')).length,56);
  assert.deepEqual(JSON.parse(localStorage.getItem('researchRecords')),old);
});

test('each new level finishes once, preserves old records, and closes without a duplicate session end', () => {
  const runtime = loadAnimationRuntime();
  assert.equal(runtime.error, undefined, runtime.error?.message);
  const { api, elements, localStorage } = runtime;
  localStorage.setItem('researchRecords', JSON.stringify([{ taskId: 'brush', stepNumber: 1 }]));
  assert.equal(typeof api.finishCurrentLevel, 'function');

  for (const [index, level] of api.LEVELS.entries()) {
    api.startLevel(index);
    api.state.currentStep = 6;
    api.handleStepSuccess(elements['interaction-area']);
    api.goNextStep();

    assert.equal(elements.celebration.classList.contains('active'), true);
    assert.equal(elements['celebration-title'].textContent, `${level.icon} ${level.name}完成啦！`);
    assert.equal(api.UnifiedDataManager.events.filter(event => event.event === 'session_end').length, 1);
    const summaries = JSON.parse(localStorage.getItem('session_summaries'));
    assert.equal(summaries.length, index + 1);

    api.closeCelebration();
    assert.equal(api.UnifiedDataManager.events.filter(event => event.event === 'session_end').length, 1);
    assert.equal(JSON.parse(localStorage.getItem('session_summaries')).length, index + 1);
  }

  const records = JSON.parse(localStorage.getItem('researchRecords'));
  assert.equal(records[0].taskId, 'brush');
  assert.deepEqual(records.slice(1).map(record => record.taskId), ['laundry', 'fold-clothes', 'fold-umbrella']);
});

test('real ResearchMode.start initializes one unified session with the selected task on every initial event', () => {
  const runtime = loadAnimationRuntime();
  assert.equal(runtime.error, undefined, runtime.error?.message);
  const { api, elements } = runtime;
  elements['research-child-id'].value = 'child-research-7';
  elements['research-session-num'].value = '4';
  elements['research-date'].value = '2026-08-06';
  elements['research-week'].value = '2';
  elements['selected-phase'].dataset.phase = 'intervention';
  elements['selected-skill'].dataset.skill = 'fold-clothes';
  api.promptState.enabled = false;

  api.ResearchMode.start();

  assert.equal(api.ResearchMode.active, true);
  assert.equal(api.state.currentLevel, 1);
  assert.equal(api.UnifiedDataManager.active, true);
  assert.equal(api.UnifiedDataManager.taskId, 'fold-clothes');
  assert.deepEqual(Array.from(api.UnifiedDataManager.events, event => event.event), [
    'session_start', 'step_start', 'ltm_chain_start'
  ]);
  assert.equal(api.UnifiedDataManager.events.filter(event => event.event === 'session_start').length, 1);
  assert.ok(api.UnifiedDataManager.events.every(event => event.taskId === 'fold-clothes'));
});

test('two passive demonstrations after real step initialization do not write events or research records', () => {
  const runtime = loadAnimationRuntime();
  assert.equal(runtime.error, undefined, runtime.error?.message);
  const { api, localStorage } = runtime;
  api.ResearchMode.active = false;
  api.promptState.enabled = false;
  assert.equal(api.AnimationPolicy.isEnabled(), true);
  api.startLevel(0);
  const stage = runtime.elements.scene.lastChild;
  const beforeEvents = api.UnifiedDataManager.events.length;
  const beforeRecords = JSON.parse(localStorage.getItem('researchRecords') || '[]').length;
  assert.deepEqual(Array.from(api.UnifiedDataManager.events, event => event.event), [
    'session_start', 'step_start', 'ltm_chain_start'
  ]);

  runtime.advanceClock(2000);
  runtime.runTimersThroughNow();
  assert.equal(stage.classList.contains('demo-running'), true);
  const representativeDemo = stage.querySelector('.demo-element');
  assert.notEqual(representativeDemo, null);
  representativeDemo.dispatch('animationiteration');
  representativeDemo.dispatch('animationiteration');

  assert.equal(api.UnifiedDataManager.events.length, beforeEvents);
  assert.equal(JSON.parse(localStorage.getItem('researchRecords') || '[]').length, beforeRecords);
});

test('passive data-integrity assertion detects an animation-iteration write mutation', () => {
  const runtime = loadAnimationRuntime(source => source.replace(
    "stage.classList.add('demo-running');",
    "stage.classList.add('demo-running'); stage.querySelector('.demo-element')?.addEventListener('animationiteration', () => UnifiedDataManager.logEvent('animation_iteration_write_mutation'));"
  ));
  assert.equal(runtime.error, undefined, runtime.error?.message);
  const { api, localStorage } = runtime;
  api.promptState.enabled = false;
  api.startLevel(0);
  const beforeEvents = api.UnifiedDataManager.events.length;
  const beforeRecords = JSON.parse(localStorage.getItem('researchRecords') || '[]').length;

  runtime.advanceClock(2000);
  runtime.runTimersThroughNow();
  const representativeDemo = runtime.elements.scene.lastChild.querySelector('.demo-element');
  assert.notEqual(representativeDemo, null);
  representativeDemo.dispatch('animationiteration');
  representativeDemo.dispatch('animationiteration');

  assert.throws(
    () => assert.equal(api.UnifiedDataManager.events.length, beforeEvents),
    /Expected values to be strictly equal/
  );
  assert.equal(JSON.parse(localStorage.getItem('researchRecords') || '[]').length, beforeRecords);
});

test('real mouse completion after demonstration pause adds one step-success event and contracted record', () => {
  const runtime = loadAnimationRuntime();
  assert.equal(runtime.error, undefined, runtime.error?.message);
  const { api, elements, localStorage } = runtime;
  localStorage.setItem('researchRecords', JSON.stringify([{ existing: true }]));
  api.ResearchMode.active = true;
  api.ResearchMode.childId = 'child-42';
  api.ResearchMode.phase = 'intervention';
  api.ResearchMode.sessionNum = 3;
  api.setTrainingMode(api.TrainingModes.TEACHING);
  api.promptState.enabled = false;
  installLaundryDragSurface(elements);
  api.startLevel(0);
  const beforeEvents = api.UnifiedDataManager.events.length;
  const beforeRecords = JSON.parse(localStorage.getItem('researchRecords')).length;
  runtime.advanceClock(2000);
  runtime.runTimersThroughNow();
  assert.equal(elements.scene.lastChild.classList.contains('demo-running'), true);

  runtime.advanceClock(1650);
  elements['interaction-area'].dispatch('mousedown', { clientX: 20, clientY: 20 });
  assert.equal(elements.scene.lastChild.classList.contains('demo-paused'), true);
  elements['interaction-area'].dispatch('mousemove', { clientX: 220, clientY: 20 });
  elements['interaction-area'].dispatch('mouseup', { clientX: 220, clientY: 20 });

  const newEvents = api.UnifiedDataManager.events.slice(beforeEvents);
  const records = JSON.parse(localStorage.getItem('researchRecords'));
  const record = records.at(-1);
  assert.deepEqual(Array.from(newEvents, event => event.event), ['step_success']);
  assert.equal(records.length, beforeRecords + 1);
  assert.equal(record.responseTimeMs, 3650);
  assert.equal(newEvents[0].responseTimeMs, 3650);
  assert.deepEqual(Object.keys(record).sort(), [
    'participantID', 'skill', 'phase', 'sessionNumber', 'stepNumber', 'stepName',
    'taskId', 'completionStatus', 'promptLevel', 'trainingMode',
    'responseTimeMs', 'errors', 'timestamp'
  ].sort());
  assert.equal(record.taskId, 'laundry');
  assert.equal(record.promptLevel,4,'viewing the passive demonstration is assistance');
  assert.equal(newEvents[0].independentCompletion,false);
});

test('Level 4 offers demonstration without success and real completion pauses it before feedback', () => {
  const runtime = loadAnimationRuntime();
  assert.equal(runtime.error, undefined, runtime.error?.message);
  const { api, elements } = runtime;
  const area = elements['interaction-area'];
  api.promptState.enabled = false;
  area.querySelector = selector => selector === '.step-stage' ? elements.scene.lastChild : null;
  api.startLevel(0);
  const stage = elements.scene.lastChild;
  runtime.runTimer(0);
  assert.equal(stage.classList.contains('demo-running'), true);
  assert.equal(stage.classList.contains('demo-paused'), false);

  let pausedWhenFeedbackStarted = false;
  const addClass = area.classList.add.bind(area.classList);
  area.classList.add = (...names) => {
    if (names.includes('success')) {
      pausedWhenFeedbackStarted = stage.classList.contains('demo-paused');
    }
    addClass(...names);
  };

  api.applyPromptLevel(api.PROMPT_LEVELS.DEMONSTRATION.level);
  assert.equal(api.state.stepCompleted.size,0);
  assert.equal(api.UnifiedDataManager.events.filter(e=>e.event==='step_success').length,0);
  api.handleStepSuccess(area);
  assert.equal(pausedWhenFeedbackStarted, true);
  assert.equal(stage.classList.contains('demo-paused'), true);
});

test('repeated valid mouse input cannot write a second success event or research record for a completed step', () => {
  const runtime = loadAnimationRuntime();
  assert.equal(runtime.error, undefined, runtime.error?.message);
  const { api, elements, localStorage } = runtime;
  const area = elements['interaction-area'];
  api.promptState.enabled = false;
  installLaundryDragSurface(elements);
  api.startLevel(0);
  const beforeEvents = api.UnifiedDataManager.events.length;
  const beforeRecords = JSON.parse(localStorage.getItem('researchRecords') || '[]').length;

  for (let attempt = 0; attempt < 2; attempt++) {
    area.dispatch('mousedown', { clientX: 20, clientY: 20 });
    area.dispatch('mousemove', { clientX: 220, clientY: 20 });
    area.dispatch('mouseup', { clientX: 220, clientY: 20 });
  }

  const newEvents = api.UnifiedDataManager.events.slice(beforeEvents);
  const records = JSON.parse(localStorage.getItem('researchRecords') || '[]');
  assert.equal(newEvents.filter(event => event.event === 'step_success').length, 1);
  assert.equal(records.length, beforeRecords + 1);
  assert.equal(api.state.stepCompleted.has(0), true);
});

test('STEP_STATE_KEYS maps all three skills to their seven persistent-state keys', () => {
  const runtime = loadAnimationRuntime();
  assert.equal(runtime.error, undefined, runtime.error?.message);
  assert.equal(JSON.stringify(runtime.api.STEP_STATE_KEYS), JSON.stringify({
    laundry: ['shirtInBasin', 'shirtWet', 'detergentAdded', 'frontRubbed', 'backRubbed', 'shirtRinsed', 'shirtWrung'],
    'fold-clothes': ['shirtPlaced', 'shirtSmoothed', 'leftSleeveFolded', 'rightSleeveFolded', 'leftBodyFolded', 'rightBodyFolded', 'shirtFolded'],
    'fold-umbrella': ['frameClosed', 'shaftShortened', 'strapFacingOut', 'panelsSmoothed', 'panelsGathered', 'canopyRolled', 'strapFastened']
  }));
});

test('SkillSceneState resets, completes mapped steps, and reports only completed keys', () => {
  const runtime = loadAnimationRuntime();
  assert.equal(runtime.error, undefined, runtime.error?.message);
  const { SkillSceneState } = runtime.api;
  SkillSceneState.reset();
  assert.equal(SkillSceneState.has('laundry', 'shirtWet'), false);
  SkillSceneState.complete('laundry', 2);
  SkillSceneState.complete('fold-clothes', 5);
  assert.equal(SkillSceneState.has('laundry', 'shirtWet'), true);
  assert.equal(SkillSceneState.has('fold-clothes', 'leftBodyFolded'), true);
  assert.equal(SkillSceneState.has('fold-umbrella', 'canopyRolled'), false);
  SkillSceneState.reset();
  assert.equal(SkillSceneState.has('laundry', 'shirtWet'), false);
  assert.equal(SkillSceneState.has('fold-clothes', 'leftBodyFolded'), false);
});

test('starting a level and returning home reset persistent skill state', () => {
  const runtime = loadAnimationRuntime();
  assert.equal(runtime.error, undefined, runtime.error?.message);
  const { api } = runtime;
  api.SkillSceneState.complete('laundry', 2);
  api.startLevel(1);
  assert.equal(api.SkillSceneState.has('laundry', 'shirtWet'), false);
  api.SkillSceneState.complete('fold-clothes', 1);
  api.goHome();
  assert.equal(api.SkillSceneState.has('fold-clothes', 'shirtPlaced'), false);
});

test('handleStepSuccess stores the current level step in persistent state', () => {
  const runtime = loadAnimationRuntime();
  assert.equal(runtime.error, undefined, runtime.error?.message);
  const { api } = runtime;
  api.SkillSceneState.reset();
  api.state.currentLevel = 1;
  api.state.currentStep = 5;
  api.handleStepSuccess(createElement());
  assert.equal(api.SkillSceneState.has('fold-clothes', 'rightBodyFolded'), true);
});

test('laundry stage markup contains only prior completed indicators', () => {
  const { api } = loadAnimationRuntime();
  api.SkillSceneState.complete('laundry', 2);
  assert.doesNotMatch(api.buildPersistentStateHTML('laundry', 2), /state-laundry-wet/);
  assert.match(api.buildPersistentStateHTML('laundry', 3), /state-laundry-wet/);
  const stage = api.stepStageHTML('<div class="objects"></div>', '<div class="guide"></div>', 'laundry', 3);
  assert.match(stage, /data-level="laundry"/);
  assert.match(stage, /data-step="3"/);
  assert.match(stage, /state-laundry-wet/);
  assert.match(stage, /aria-hidden="true"/);
});

test('laundry and clothes-folding states render only after their intended steps', () => {
  const runtime = loadAnimationRuntime();
  assert.equal(runtime.error, undefined, runtime.error?.message);
  const { SkillSceneState, buildPersistentStateHTML } = runtime.api;
  const cases = [
    {
      levelId: 'laundry', stepId: 1, className: 'state-laundry-in-basin',
      visibleSteps: [2, 7], hiddenSteps: [1]
    },
    {
      levelId: 'laundry', stepId: 3, className: 'state-laundry-soapy',
      visibleSteps: [4, 5], hiddenSteps: [3]
    },
    {
      levelId: 'laundry', stepId: 6, className: 'state-laundry-rinsed',
      visibleSteps: [7], hiddenSteps: [6]
    },
    {
      levelId: 'fold-clothes', stepId: 1, className: 'state-fold-flat',
      visibleSteps: [2, 7], hiddenSteps: [1]
    }
  ];

  for (const current of cases) {
    SkillSceneState.reset();
    for (const visibleStep of current.visibleSteps) {
      assert.doesNotMatch(
        buildPersistentStateHTML(current.levelId, visibleStep),
        new RegExp(current.className),
        `${current.className} must not appear before its real completion`
      );
    }
    SkillSceneState.complete(current.levelId, current.stepId);
    for (const visibleStep of current.visibleSteps) {
      const markup = buildPersistentStateHTML(current.levelId, visibleStep);
      assert.match(markup, new RegExp(current.className));
      assert.match(markup, /persistent-state/);
      assert.match(markup, /aria-hidden="true"/);
    }
    for (const hiddenStep of current.hiddenSteps) {
      assert.doesNotMatch(buildPersistentStateHTML(current.levelId, hiddenStep), new RegExp(current.className));
    }
  }
});

test('laundry scenes provide seven delayed, non-interactive demonstration markers', () => {
  const { api } = loadAnimationRuntime();
  const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  for (let id = 1; id <= 7; id++) {
    const scene = api.buildScene('laundry', api.LEVELS[0].steps[id - 1]);
    assert.match(scene, new RegExp(`demo-element demo-laundry-${id}`));
    assert.match(scene, /aria-hidden="true"/);
    assert.match(source, new RegExp(`\\.step-stage\\.demo-running\\s+\\.demo-laundry-${id}\\s*\\{`));
    assert.equal((scene.match(/interactive-target/g) || []).length, 1);
  }
});

test('laundry rinse demonstration holds at the water for at least two seconds', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const frames = parsePixelKeyframePath(source, 'demoLaundryRinse', {'--laundry-arrive-x':'200px','--laundry-arrive-y':'50px'});
  const held = frames.filter(frame => frame.translateX === 200 && frame.translateY === 50 && frame.opacity > 0);
  const duration = Number(source.match(/\.demo-laundry-6 \{ animation:demoLaundryRinse ([\d.]+)s/)[1]);
  assert.ok((held.at(-1).percentage - held[0].percentage) / 100 * duration >= 2);
});

test('laundry demonstrations animate separate ghosts and leave the real targets still', () => {
  const { api } = loadAnimationRuntime();
  for (let id = 1; id <= 7; id++) {
    const scene = api.buildScene('laundry', api.LEVELS[0].steps[id - 1]);
    assert.match(scene, new RegExp(`demo-element demo-laundry-${id} demo-ghost`));
    assert.doesNotMatch(scene, /class="[^"]*interactive-target[^"]*demo-element/);
  }
});

test('laundry drag demonstrations derive arrival from the real item and destination geometry', () => {
  const { api } = loadAnimationRuntime();
  const stage = createElement();
  const item = { getBoundingClientRect: () => ({left:30,top:40,width:100,height:80}) };
  const target = { getBoundingClientRect: () => ({left:220,top:160,width:200,height:180}) };
  stage.querySelector = selector => selector === '.laundry-shirt-start' ? item : selector === '.drag-target' ? target : null;
  api.AnimationController.configureStagePaths(stage);
  assert.equal(stage.style.getPropertyValue('--laundry-arrive-x'), '240px');
  assert.equal(stage.style.getPropertyValue('--laundry-arrive-y'), '170px');
});

test('laundry continuity indicators appear only after their required completed steps', () => {
  const { api } = loadAnimationRuntime();
  const names = ['in-basin','wet','soapy','front-clean','back-clean','rinsed','wrung'];
  for (let id = 1; id <= 7; id++) {
    assert.doesNotMatch(api.buildPersistentStateHTML('laundry', id + 1), new RegExp('state-laundry-' + names[id - 1]));
    api.SkillSceneState.complete('laundry', id);
    assert.match(api.buildPersistentStateHTML('laundry', id + 1), new RegExp('state-laundry-' + names[id - 1]));
  }
  assert.doesNotMatch(api.buildPersistentStateHTML('laundry', 7), /state-laundry-soapy/);
});

test('clothes folding scenes provide seven delayed, non-interactive demonstration markers', () => {
  const runtime = loadAnimationRuntime();
  assert.equal(runtime.error, undefined, runtime.error?.message);
  const { api } = runtime;
  const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

  for (let stepId = 1; stepId <= 7; stepId++) {
    const scene = api.buildScene('fold-clothes', api.LEVELS[1].steps[stepId - 1]);
    assert.match(scene, /data-garment="whole-sweatshirt"/);
    assert.match(scene, new RegExp(`demo-element demo-fold-clothes-${stepId}`));
    assert.match(scene, /aria-hidden="true"/);
    assert.match(source, new RegExp(`\\.step-stage\\.demo-running\\s+\\.demo-fold-clothes-${stepId}\\s*\\{`));
    assert.doesNotMatch(scene, /class="[^"]*draggable-item[^"]*demo-element/);
  }

  for (const keyframe of [
    'demoFoldPlace', 'demoFoldSmooth', 'demoFoldLeftSleeve', 'demoFoldRightSleeve',
    'demoFoldLeftBody', 'demoFoldRightBody', 'demoFoldHemUp'
  ]) {
    assert.match(source, new RegExp(`@keyframes ${keyframe}`));
  }
});

test('clothes folding side demonstrations move toward the highlighted fold area', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const left = parsePixelKeyframePath(source, 'demoFoldLeftSleeve');
  const right = parsePixelKeyframePath(source, 'demoFoldRightSleeve');
  assert.ok(left.some(frame => frame.translateX > 0 && frame.opacity > 0));
  assert.ok(right.some(frame => frame.translateX < 0 && frame.opacity > 0));
});

test('clothes folding continuity indicators appear only after their required completed steps', () => {
  const runtime = loadAnimationRuntime();
  assert.equal(runtime.error, undefined, runtime.error?.message);
  const { SkillSceneState, buildPersistentStateHTML } = runtime.api;
  const names = ['flat', 'smooth', 'left-sleeve', 'right-sleeve', 'left-body', 'right-body', 'hem-up'];
  SkillSceneState.reset();
  for (let stepId = 1; stepId <= 7; stepId++) {
    assert.doesNotMatch(buildPersistentStateHTML('fold-clothes', stepId + 1), new RegExp(`state-fold-${names[stepId - 1]}`));
    SkillSceneState.complete('fold-clothes', stepId);
    assert.match(buildPersistentStateHTML('fold-clothes', stepId + 1), new RegExp(`state-fold-${names[stepId - 1]}`));
  }
});

test('prompt highlighting cannot reveal laundry sparkle before real completion', () => {
  const { api, elements } = loadAnimationRuntime();
  const stage = createElement();
  elements['interaction-area'].querySelector = selector => selector === '.step-stage' ? stage : null;
  api.state.currentLevel = 0;
  api.state.currentStep = 6;
  api.applyPromptLevel(api.PROMPT_LEVELS.VISUAL.level);
  assert.equal(stage.classList.contains('laundry-complete'), false);
  api.handleStepSuccess(elements['interaction-area']);
  assert.equal(stage.classList.contains('laundry-complete'), true);
});

test('new scenes provide seven delayed, non-interactive demonstration markers', () => {
  const runtime = loadAnimationRuntime();
  assert.equal(runtime.error, undefined, runtime.error?.message);
  const { api } = runtime;
  for (const [levelId, level] of [['laundry', api.LEVELS[0]], ['fold-clothes', api.LEVELS[1]], ['fold-umbrella', api.LEVELS[2]]]) {
    for (let stepId = 1; stepId <= 7; stepId++) {
      const scene = api.buildScene(levelId, level.steps[stepId - 1]);
      assert.match(scene, /demo-element/);
      assert.match(scene, /aria-hidden="true"/);
      assert.doesNotMatch(scene, /class="[^"]*interactive-target[^"]*demo-element/);
    }
  }
});

test('umbrella continuity retains each completed action and fastens only on real completion', () => {
  const runtime = loadAnimationRuntime();
  assert.equal(runtime.error, undefined, runtime.error?.message);
  const { api, elements } = runtime;
  const { SkillSceneState, buildPersistentStateHTML } = api;
  SkillSceneState.reset();

  for (const [index,name] of ['closed','short','strap-front','smooth','gathered','rolled','fastened'].entries()) {
    assert.doesNotMatch(buildPersistentStateHTML('fold-umbrella',index+2),new RegExp(`state-umbrella-${name}`));
    SkillSceneState.complete('fold-umbrella',index+1);
    assert.match(buildPersistentStateHTML('fold-umbrella',index+2),new RegExp(`state-umbrella-${name}`));
    assert.doesNotMatch(buildPersistentStateHTML('fold-umbrella',index+1),new RegExp(`state-umbrella-${name}`));
  }

  const stage = createElement();
  elements['interaction-area'].querySelector = selector => selector === '.step-stage' ? stage : null;
  api.state.currentLevel = 2;
  api.state.currentStep = 6;
  api.applyPromptLevel(api.PROMPT_LEVELS.VISUAL.level);
  assert.equal(stage.classList.contains('umbrella-complete'), false);
  api.handleStepSuccess(elements['interaction-area']);
  assert.equal(stage.classList.contains('umbrella-complete'), true);
});

test('umbrella strap stays unfastened during passive demonstration and generic visual prompts', () => {
  const runtime = loadAnimationRuntime();
  assert.equal(runtime.error, undefined, runtime.error?.message);
  const { api, elements } = runtime;
  const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const stage = createElement();
  elements['interaction-area'].querySelector = selector => selector === '.step-stage' ? stage : null;
  api.state.currentLevel = 2;
  api.state.currentStep = 6;

  stage.classList.add('demo-running');
  assert.doesNotMatch(source, /\.step-stage\.demo-running\s+\.umbrella-final/);
  assert.doesNotMatch(source, /#interaction-area\.success\s+\.umbrella-final/);

  api.applyPromptLevel(api.PROMPT_LEVELS.VISUAL.level);
  assert.equal(elements['interaction-area'].classList.contains('success'), true);
  assert.equal(stage.classList.contains('umbrella-complete'), false);

  api.handleStepSuccess(elements['interaction-area']);
  assert.equal(stage.classList.contains('umbrella-complete'), true);
});
