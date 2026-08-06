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
      SkillSceneState, buildPersistentStateHTML, stepStageHTML, buildScene, LEVELS,
      applyPromptLevel, PROMPT_LEVELS
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

test('brushing demonstration cycles stay within the 1.4s to 2.4s range', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  for (let stepId = 1; stepId <= 7; stepId++) {
    const match = source.match(new RegExp(`\\.step-stage\\.demo-running\\s+\\.demo-brush-${stepId}\\s*\\{\\s*animation:[^;]*?([\\d.]+)s`));
    assert.notEqual(match, null, `demo-brush-${stepId} needs a running animation`);
    const duration = Number(match[1]);
    assert.ok(duration >= 1.4 && duration <= 2.4, `demo-brush-${stepId} duration ${duration}s is outside 1.4s-2.4s`);
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

test('washing scenes provide seven delayed, non-interactive demonstration markers', () => {
  const runtime = loadAnimationRuntime();
  assert.equal(runtime.error, undefined, runtime.error?.message);
  const { api } = runtime;
  const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

  for (let stepId = 1; stepId <= 7; stepId++) {
    const scene = api.buildScene('wash', api.LEVELS[1].steps[stepId - 1]);
    assert.match(scene, new RegExp(`demo-element demo-wash-${stepId}`));
    assert.match(scene, /aria-hidden="true"/);
    assert.match(source, new RegExp(`\\.step-stage\\.demo-running\\s+\\.demo-wash-${stepId}\\s*\\{`));
    assert.doesNotMatch(scene, /class="[^"]*draggable-item[^"]*demo-element/);
  }

  for (const keyframe of [
    'demoHandPushUp', 'demoCollectWater', 'demoTowelRub', 'demoTowelWring',
    'demoFaceWipe', 'demoTowelRinse', 'demoHandPushDown', 'waterFlow', 'waterFadeOut'
  ]) {
    assert.match(source, new RegExp(`@keyframes ${keyframe}`));
  }
});

test('washing towel demonstrations stage arrival before two distinct rubbing motions and reset', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const keyframeBody = name => {
    const match = source.match(new RegExp(`@keyframes ${name}\\s*\\{([\\s\\S]*?)(?=\\n@keyframes|\\n\\.step-stage)`));
    assert.notEqual(match, null, `${name} keyframes missing`);
    return match[1];
  };
  const stages = body => [...body.matchAll(/(\d+)%\s*\{([^}]*)\}/g)].map(([, percentage, declarations]) => ({
    percentage: Number(percentage),
    right: Number(declarations.match(/right:(\d+)%/)?.[1]),
    translateY: Number(declarations.match(/translateY\((-?\d+)(?:px)?\)/)?.[1]),
    opacity: Number(declarations.match(/opacity:([\d.]+)/)?.[1])
  }));

  const assertStagedPath = (keyframe, path) => {
    const startIndex = path.findIndex(stage => stage.right === 8 && stage.translateY === 0 && stage.opacity > 0);
    assert.notEqual(startIndex, -1, `${keyframe} needs a visible right-side start at translateY(0)`);

    const arrivalIndex = path.findIndex((stage, index) => index > startIndex && stage.right === 50 && stage.translateY === 0);
    assert.notEqual(arrivalIndex, -1, `${keyframe} needs a horizontal-only arrival at the centered towel`);

    const actionIndexes = path
      .map((stage, index) => ({ stage, index }))
      .filter(({ stage, index }) => index > arrivalIndex && stage.translateY !== 0);
    assert.ok(actionIndexes.length >= 2, `${keyframe} needs at least two post-arrival vertical motions`);
    assert.ok(new Set(actionIndexes.map(({ stage }) => stage.translateY)).size >= 2, `${keyframe} needs two distinct post-arrival vertical positions`);

    const lastActionIndex = actionIndexes.at(-1).index;
    assert.ok(
      path.slice(arrivalIndex, lastActionIndex + 1).every(stage => stage.right === 50),
      `${keyframe} must stay centered from arrival through the last action`
    );

    const resetIndex = path.findIndex((stage, index) => index > lastActionIndex && stage.right === 8 && stage.translateY === 0);
    assert.notEqual(resetIndex, -1, `${keyframe} needs to reset to the right-side start after rubbing`);
  };

  for (const keyframe of ['demoTowelRub', 'demoTowelWring']) {
    assertStagedPath(keyframe, stages(keyframeBody(keyframe)));
  }

  const allPostArrivalVerticalsZero = keyframeBody('demoTowelRub')
    .replace(/right:50%; transform:translateY\(-?\d+px\)/g, 'right:50%; transform:translateY(0px)');
  assert.throws(
    () => assertStagedPath('demoTowelRub mutation', stages(allPostArrivalVerticalsZero)),
    /post-arrival vertical motions/
  );

  const rightDrift = keyframeBody('demoTowelRub')
    .replace('70% { right:50%;', '70% { right:20%;');
  assert.throws(
    () => assertStagedPath('demoTowelRub drift mutation', stages(rightDrift)),
    /stay centered/
  );
});

test('washing continuity indicators appear only after their required completed steps', () => {
  const runtime = loadAnimationRuntime();
  assert.equal(runtime.error, undefined, runtime.error?.message);
  const { SkillSceneState, buildPersistentStateHTML } = runtime.api;
  SkillSceneState.reset();

  assert.doesNotMatch(buildPersistentStateHTML('wash', 2), /state-water-stream/);
  SkillSceneState.complete('wash', 1);
  assert.match(buildPersistentStateHTML('wash', 2), /state-water-stream/);
  assert.match(buildPersistentStateHTML('wash', 6), /state-water-stream/);
  assert.doesNotMatch(buildPersistentStateHTML('wash', 7), /state-water-stream/);

  assert.doesNotMatch(buildPersistentStateHTML('wash', 3), /state-hand-droplets/);
  SkillSceneState.complete('wash', 2);
  assert.match(buildPersistentStateHTML('wash', 3), /state-hand-droplets/);

  assert.doesNotMatch(buildPersistentStateHTML('wash', 4), /state-wet-towel/);
  SkillSceneState.complete('wash', 3);
  assert.match(buildPersistentStateHTML('wash', 4), /state-wet-towel/);

  assert.doesNotMatch(buildPersistentStateHTML('wash', 5), /state-reduced-droplets/);
  SkillSceneState.complete('wash', 4);
  assert.match(buildPersistentStateHTML('wash', 5), /state-reduced-droplets/);

  assert.doesNotMatch(buildPersistentStateHTML('wash', 6), /state-clean-face/);
  SkillSceneState.complete('wash', 5);
  assert.match(buildPersistentStateHTML('wash', 6), /state-clean-face/);

  assert.doesNotMatch(buildPersistentStateHTML('wash', 7), /state-clean-wet-towel/);
  SkillSceneState.complete('wash', 6);
  assert.match(buildPersistentStateHTML('wash', 7), /state-clean-wet-towel/);
  assert.match(buildPersistentStateHTML('wash', 7), /aria-hidden="true"/);
});

test('prompt highlighting cannot reveal the final mouth sparkle before real brushing completion', () => {
  const runtime = loadAnimationRuntime();
  assert.equal(runtime.error, undefined, runtime.error?.message);
  const { api, elements } = runtime;
  const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const stage = createElement();
  elements['interaction-area'].querySelector = selector => selector === '.step-stage' ? stage : null;
  api.state.currentLevel = 0;
  api.state.currentStep = 6;

  api.applyPromptLevel(api.PROMPT_LEVELS.VISUAL.level);
  assert.equal(elements['interaction-area'].classList.contains('success'), true);
  assert.equal(stage.classList.contains('brush-final-clean'), false);
  assert.doesNotMatch(source, /#interaction-area\.success\s+\.state-final-clean-mouth/);

  api.handleStepSuccess(elements['interaction-area']);
  assert.equal(stage.classList.contains('brush-final-clean'), true);
});

test('dressing scenes provide seven delayed, non-interactive demonstration markers', () => {
  const runtime = loadAnimationRuntime();
  assert.equal(runtime.error, undefined, runtime.error?.message);
  const { api } = runtime;
  const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

  for (let stepId = 1; stepId <= 7; stepId++) {
    const scene = api.buildScene('dress', api.LEVELS[2].steps[stepId - 1]);
    assert.match(scene, new RegExp(`demo-element demo-dress-${stepId}`));
    assert.match(scene, /aria-hidden="true"/);
    assert.match(source, new RegExp(`\\.step-stage\\.demo-running\\s+\\.demo-dress-${stepId}\\s*\\{`));
    assert.doesNotMatch(scene, /class="[^"]*draggable-item[^"]*demo-element/);
  }

  for (const stepId of [3, 4, 5, 6, 7]) {
    const scene = api.buildScene('dress', api.LEVELS[2].steps[stepId - 1]);
    assert.match(scene, new RegExp(`demo-element demo-dress-${stepId} demo-ghost`));
  }

  for (const keyframe of [
    'demoJacketPulse', 'demoJacketFront', 'demoLeftSleeve', 'demoRightSleeve',
    'demoPullDown', 'demoZipUp', 'demoCollarAdjust'
  ]) {
    assert.match(source, new RegExp(`@keyframes ${keyframe}`));
  }
});

test('dressing ghost hands reach their target before the directional demonstration', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const keyframeBody = name => {
    const match = source.match(new RegExp(`@keyframes ${name}\\s*\\{([\\s\\S]*?)(?=\\n@keyframes|\\n\\.step-stage)`));
    assert.notEqual(match, null, `${name} keyframes missing`);
    return match[1];
  };
  const stages = body => [...body.matchAll(/(\d+)%\s*\{([^}]*)\}/g)].map(([, percentage, declarations]) => ({
    percentage: Number(percentage),
    left: Number(declarations.match(/left:(\d+)%/)?.[1]),
    top: Number(declarations.match(/top:(\d+)%/)?.[1]),
    opacity: Number(declarations.match(/opacity:([\d.]+)/)?.[1])
  }));
  const assertArrivalThenAction = (keyframe, target, action, body = keyframeBody(keyframe)) => {
    const path = stages(body);
    const arrivalIndex = path.findIndex(stage =>
      stage.left === target.left && stage.top === target.top && stage.opacity > 0
    );
    assert.notEqual(arrivalIndex, -1, `${keyframe} must visibly arrive at its target`);
    const actionIndex = path.findIndex((stage, index) => index > arrivalIndex &&
      (stage.left === action.left || stage.top === action.top)
    );
    assert.notEqual(actionIndex, -1, `${keyframe} needs its directional action after arriving`);
    assert.ok(actionIndex > arrivalIndex, `${keyframe} must not act before reaching its target`);
  };

  assertArrivalThenAction('demoLeftSleeve', { left: 14, top: 22 }, { left: 8, top: 22 });
  assertArrivalThenAction('demoRightSleeve', { left: 75, top: 22 }, { left: 81, top: 22 });
  assertArrivalThenAction('demoPullDown', { left: 50, top: 40 }, { left: 50, top: 50 });
  assertArrivalThenAction('demoZipUp', { left: 50, top: 38 }, { left: 50, top: 25 });
  assertArrivalThenAction('demoCollarAdjust', { left: 50, top: 5 }, { left: 43, top: 5 });

  const noArrival = keyframeBody('demoZipUp').replace('45% { left:50%; top:38%;', '45% { left:50%; top:48%;');
  assert.throws(
    () => assertArrivalThenAction('demoZipUp mutation', { left: 50, top: 38 }, { left: 50, top: 25 }, noArrival),
    /must visibly arrive|needs its directional action/
  );
  assert.match(noArrival, /top:48%/);
});

test('dressing continuity indicators follow completed steps and reveal the final collar only on real completion', () => {
  const runtime = loadAnimationRuntime();
  assert.equal(runtime.error, undefined, runtime.error?.message);
  const { api, elements } = runtime;
  const { SkillSceneState, buildPersistentStateHTML } = api;
  SkillSceneState.reset();

  assert.doesNotMatch(buildPersistentStateHTML('dress', 3), /state-jacket-front/);
  SkillSceneState.complete('dress', 2);
  assert.match(buildPersistentStateHTML('dress', 3), /state-jacket-front/);

  assert.doesNotMatch(buildPersistentStateHTML('dress', 4), /state-left-sleeve/);
  SkillSceneState.complete('dress', 3);
  assert.match(buildPersistentStateHTML('dress', 4), /state-left-sleeve/);

  assert.doesNotMatch(buildPersistentStateHTML('dress', 5), /state-both-sleeves/);
  SkillSceneState.complete('dress', 4);
  assert.match(buildPersistentStateHTML('dress', 5), /state-both-sleeves/);

  assert.doesNotMatch(buildPersistentStateHTML('dress', 6), /state-jacket-flat/);
  SkillSceneState.complete('dress', 5);
  assert.match(buildPersistentStateHTML('dress', 6), /state-jacket-flat/);

  assert.doesNotMatch(buildPersistentStateHTML('dress', 7), /state-zipper-closed/);
  SkillSceneState.complete('dress', 6);
  assert.match(buildPersistentStateHTML('dress', 7), /state-zipper-closed/);
  assert.doesNotMatch(buildPersistentStateHTML('dress', 7), /state-final-collar-sparkle/);
  SkillSceneState.complete('dress', 7);
  assert.match(buildPersistentStateHTML('dress', 8), /state-final-collar-sparkle/);

  const stage = createElement();
  elements['interaction-area'].querySelector = selector => selector === '.step-stage' ? stage : null;
  api.state.currentLevel = 2;
  api.state.currentStep = 6;
  api.applyPromptLevel(api.PROMPT_LEVELS.VISUAL.level);
  assert.equal(stage.classList.contains('dress-final-collar'), false);
  api.handleStepSuccess(elements['interaction-area']);
  assert.equal(stage.classList.contains('dress-final-collar'), true);
});
