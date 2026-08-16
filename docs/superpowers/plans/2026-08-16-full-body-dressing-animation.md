# Full-Body Dressing Character and Seven-Step Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current hand-icon dressing scenes with one persistent layered full-body cartoon boy who demonstrates and completes the existing seven dressing steps by manipulating an orange hooded jacket in a warm bedroom.

**Architecture:** Keep all production logic in `index.html`. Add a layered inline-SVG dressing character renderer, a dressing-state renderer, a one-shot dressing demonstration extension, a dedicated garment interaction adapter, and a completion-action controller while preserving the existing unified data hooks. Add one local bedroom PNG and replace five local Tingting voice files; no framework, package, CDN, Canvas runtime, or 3D engine is introduced.

**Tech Stack:** HTML5, CSS keyframes, inline SVG, vanilla JavaScript, local PNG and M4A assets, Node.js built-in test runner, Mac `say`/`afconvert`, Edge and iPad Safari manual verification.

## Global Constraints

- Production application code remains in `index.html`; do not split JavaScript or CSS into production modules.
- Do not introduce React, Vue, jQuery, Three.js, npm packages, CDNs, GIFs, videos, or a Canvas animation runtime.
- Modify only the dressing skill; brushing and face-washing scene markup, interactions, voices, and behavior remain unchanged.
- Preserve all 21 step IDs and names. Dressing remains `dress` with step IDs 1 through 7.
- Preserve the unified research record schema and keep `researchRecords` as the only primary experiment-data store.
- Preserve `participantID`, `taskId`, `stepNumber`, `completionStatus`, `promptLevel`, `trainingMode`, `responseTimeMs`, `errors`, and `timestamp` semantics.
- Demonstration elements use `pointer-events:none`, never call `handleStepSuccess()`, never change `SkillSceneState`, and never write research data.
- Normal play and research Intervention＋Teaching show one dressing demonstration. Baseline, Maintenance, Assessment, and non-Teaching research sessions show no dressing demonstration.
- A dressing demonstration plays once and returns to the operation-ready pose; it does not loop.
- Real garment input uses the existing forgiving interaction principles: tap movement below 18px, directional movement at least 40px, and target overlap above 35% where overlap is used.
- The full-body character stays front-facing; sleeve completion uses only a small opposite-side torso lean.
- Keep all child-facing feedback positive; no red warning, cross symbol, or negative wording.
- Do not merge or deploy until Mac Edge and iPad Safari dressing checks are explicitly completed or the user explicitly accepts the remaining device-test limitation.

## File Map

- Create: `warm-bedroom-bg.png` — compressed local 2:1 warm-bedroom background with quiet center stage.
- Modify: `index.html` — dressing data, SVG renderers, scene markup, one-shot demos, garment input adapter, completion choreography, background selection, and voice map.
- Replace: `voice/v16.m4a` through `voice/v20.m4a` — confirmed Tingting instructions for dressing steps 3 through 7.
- Create: `tests/full-body-dressing.test.js` — dressing-specific source, runtime, interaction, data, and animation regression tests.
- Create: `tests/helpers/game-runtime.js` — shared DOM/timer/localStorage test harness extracted without behavioral changes from the existing continuous-animation test.
- Modify: `tests/continuous-animation.test.js` — only where the existing dressing demonstration assumptions must change from looping ghost-hand demos to one-shot garment demos.
- Modify: `docs/testing/2026-07-29-continuous-animation-checklist.md` — update the seven dressing rows and research-mode checks.
- Modify: `docs/design-spec.md` — record the warm bedroom, layered full-body SVG, and direct garment controls.
- Modify: `docs/implementation-plan.md` — record the dressing upgrade as the active tested increment.
- Modify: `dev-logs/2026-08-16.md` — append task results, review findings, test evidence, and deployment status.

---

### Task 1: Produce and approve the warm bedroom background

**Files:**
- Create: `warm-bedroom-bg.png`
- Create: `tests/full-body-dressing.test.js`
- Modify: `dev-logs/2026-08-16.md`

**Interfaces:**
- Produces: `warm-bedroom-bg.png`, a local RGB/RGBA PNG with a 2:1 target composition and no text.
- Consumes: the approved visual brief from `docs/superpowers/specs/2026-08-16-full-body-dressing-animation-design.md`.

- [ ] **Step 1: Write the failing asset-contract test**

Create `tests/full-body-dressing.test.js`:

```javascript
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const html = () => fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('warm bedroom background exists locally and is referenced only by dressing', () => {
  const asset = path.join(root, 'warm-bedroom-bg.png');
  assert.equal(fs.existsSync(asset), true, 'warm-bedroom-bg.png missing');
  assert.ok(fs.statSync(asset).size > 100_000, 'background is unexpectedly empty');
  assert.ok(fs.statSync(asset).size <= 2_500_000, 'background exceeds 2.5 MB');
  assert.match(html(), /level\.id === 'dress'[\s\S]{0,500}warm-bedroom-bg\.png/);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
node --test tests/full-body-dressing.test.js
```

Expected: FAIL with `warm-bedroom-bg.png missing`.

- [ ] **Step 3: Generate the visual asset with the approved brief**

Use the built-in image generation tool with this exact production brief:

```text
Use case: illustration-story
Asset type: local background for a 2D children's dressing game
Primary request: a simple warm cartoon bedroom for a child life-skills training game
Scene/backdrop: cream wall, light wood floor, low wardrobe on the far left, simple low bed or storage cabinet on the far right
Style/medium: polished soft 2D children's educational illustration, rounded shapes, subtle depth
Composition/framing: 2:1 landscape; keep the central 55 percent visually quiet and empty for a full-body child; furniture stays near edges
Color palette: cream, pale peach, light natural wood, muted blue accents
Constraints: no people, no clothes, no text, no logos, no clouds, no stars, no scattered toys, no high-contrast patterns, no watermark
```

Inspect the generated image. Save the approved output as `warm-bedroom-bg.png` in the repository root without overwriting any existing asset. Resize/crop to 1536×768 and keep the file at or below 2.5 MB. Show it to the user and obtain visual approval before integrating it.

- [ ] **Step 4: Add the dressing-only background reference**

In the original `loadStep()` background branch, replace the dressing gradient with:

```javascript
scene.innerHTML = level.id === 'dress'
  ? `<img class="scene-bg dress-room-bg" src="warm-bedroom-bg.png?v=1" draggable="false" alt="">`
  : `<img class="scene-bg" src="bathroom-bg.png?v=2" draggable="false" style="object-fit:cover;-webkit-touch-callout:none;" alt="">`;
```

Add beside `.scene-bg`:

```css
.dress-room-bg { object-fit:cover; object-position:center; -webkit-touch-callout:none; }
```

- [ ] **Step 5: Run the asset test and image checks**

Run:

```bash
node --test tests/full-body-dressing.test.js
file warm-bedroom-bg.png
du -k warm-bedroom-bg.png
```

Expected: test PASS; `file` reports PNG image data; size is no more than 2500 KB.

- [ ] **Step 6: Update the log and commit**

Record the approved background, dimensions, file size, and test result in `dev-logs/2026-08-16.md`.

```bash
git add warm-bedroom-bg.png index.html tests/full-body-dressing.test.js dev-logs/2026-08-16.md
git commit -m "增加温暖卧室穿衣背景"
```

---

### Task 2: Build the layered full-body SVG character and jacket renderers

**Files:**
- Modify: `index.html` near `svgJacket()` and dressing CSS
- Create: `tests/helpers/game-runtime.js`
- Modify: `tests/continuous-animation.test.js`
- Modify: `tests/full-body-dressing.test.js`
- Modify: `dev-logs/2026-08-16.md`

**Interfaces:**
- Produces: `DRESS_VISUAL_STATES`, a frozen map of state IDs to jacket visibility flags.
- Produces: `svgDressChild(options?: { pose?: string, state?: string, interactivePart?: string }): string`.
- Produces: `svgDressJacket(state: string, options?: { interactivePart?: string }): string`.
- Produces stable SVG classes: `.dress-child`, `.dress-head`, `.dress-torso`, `.dress-arm-left-upper`, `.dress-arm-left-lower`, `.dress-arm-right-upper`, `.dress-arm-right-lower`, `.dress-hand-left`, `.dress-hand-right`, `.dress-jacket-body`, `.dress-sleeve-left`, `.dress-sleeve-right`, `.dress-collar-left`, `.dress-collar-right`, `.dress-zipper-slider`.
- Consumes: existing `g-jacket` gradient and approved A-proportion character palette.

- [ ] **Step 1: Record the green test-harness baseline**

Run:

```bash
node --test tests/continuous-animation.test.js tests/full-body-dressing.test.js
```

Expected: all tests that exist after Task 1 PASS.

- [ ] **Step 2: Extract the existing runtime helper without changing behavior**

Move the existing `ClassList`, `createElement`, `getKeyframeBody`, `parsePixelKeyframeBody`, `parsePixelKeyframePath`, `stagePathVariables`, and `loadAnimationRuntime` declarations from `tests/continuous-animation.test.js` into `tests/helpers/game-runtime.js`. Move all required Node imports with them. End the helper with:

```javascript
module.exports = {
  ClassList,
  createElement,
  getKeyframeBody,
  parsePixelKeyframeBody,
  parsePixelKeyframePath,
  stagePathVariables,
  loadAnimationRuntime
};
```

Replace the moved declarations in `tests/continuous-animation.test.js` with:

```javascript
const {
  createElement,
  getKeyframeBody,
  parsePixelKeyframeBody,
  parsePixelKeyframePath,
  stagePathVariables,
  loadAnimationRuntime
} = require('./helpers/game-runtime');
```

In `tests/full-body-dressing.test.js`, add:

```javascript
const {
  createElement,
  loadAnimationRuntime
} = require('./helpers/game-runtime');

function loadDressingRuntime(sourceMutation) {
  return loadAnimationRuntime(sourceMutation);
}
```

- [ ] **Step 3: Verify the extraction stays GREEN**

Run:

```bash
node --test tests/continuous-animation.test.js tests/full-body-dressing.test.js
```

Expected: the same baseline test count passes with zero failures.

- [ ] **Step 4: Add failing renderer contract tests**

Append:

```javascript
test('dressing renderer exposes a complete articulated A-proportion child', () => {
  const source = html();
  for (const token of [
    'function svgDressChild(', 'function svgDressJacket(', 'DRESS_VISUAL_STATES',
    'dress-head', 'dress-torso', 'dress-arm-left-upper', 'dress-arm-left-lower',
    'dress-arm-right-upper', 'dress-arm-right-lower', 'dress-hand-left',
    'dress-hand-right', 'dress-jacket-body', 'dress-sleeve-left',
    'dress-sleeve-right', 'dress-collar-left', 'dress-collar-right',
    'dress-zipper-slider'
  ]) assert.ok(source.includes(token), `${token} missing`);
});

test('dressing SVG uses a stable 360 by 640 full-body viewBox', () => {
  assert.match(html(), /class="dress-child"[\s\S]{0,200}viewBox="0 0 360 640"/);
});
```

- [ ] **Step 5: Run tests and verify RED**

Run:

```bash
node --test tests/full-body-dressing.test.js
```

Expected: FAIL with `function svgDressChild( missing`.

- [ ] **Step 6: Define explicit visual states**

Add beside `STEP_STATE_KEYS`:

```javascript
const DRESS_VISUAL_STATES = Object.freeze({
  initial:        { jacketFound:false, front:false, leftSleeve:false, rightSleeve:false, pulled:false, zipped:false, collar:false },
  found:          { jacketFound:true,  front:false, leftSleeve:false, rightSleeve:false, pulled:false, zipped:false, collar:false },
  frontReady:     { jacketFound:true,  front:true,  leftSleeve:false, rightSleeve:false, pulled:false, zipped:false, collar:false },
  leftSleeveOn:   { jacketFound:true,  front:true,  leftSleeve:true,  rightSleeve:false, pulled:false, zipped:false, collar:false },
  bothSleevesOn:  { jacketFound:true,  front:true,  leftSleeve:true,  rightSleeve:true,  pulled:false, zipped:false, collar:false },
  jacketPulled:   { jacketFound:true,  front:true,  leftSleeve:true,  rightSleeve:true,  pulled:true,  zipped:false, collar:false },
  zipperClosed:   { jacketFound:true,  front:true,  leftSleeve:true,  rightSleeve:true,  pulled:true,  zipped:true,  collar:false },
  complete:       { jacketFound:true,  front:true,  leftSleeve:true,  rightSleeve:true,  pulled:true,  zipped:true,  collar:true }
});
```

- [ ] **Step 7: Implement `svgDressChild()`**

Implement one `<svg class="dress-child" viewBox="0 0 360 640">` with named `<g>` groups for every joint. Start from these explicit shapes and refine their curves without renaming or merging joint groups:

```javascript
function svgDressChild(options = {}) {
  const pose = options.pose || 'neutral';
  const visualState = options.state || 'initial';
  return `<svg class="dress-child pose-${pose} state-${visualState}" viewBox="0 0 360 640" aria-label="正在学习穿衣的小朋友">
    <g class="dress-leg-left"><rect x="119" y="438" width="48" height="144" rx="23" fill="#F3C19D"/><path d="M101 568h70v38h-82c0-22 4-32 12-38z" fill="#FF8C42"/></g>
    <g class="dress-leg-right"><rect x="193" y="438" width="48" height="144" rx="23" fill="#F3C19D"/><path d="M189 568h70c8 6 12 16 12 38h-82z" fill="#FF8C42"/></g>
    <g class="dress-torso"><path d="M113 214q67-32 134 0l-8 205H121z" fill="#FFFDF8" stroke="#B8B2AA" stroke-width="4"/><path d="M112 392h136v71H112z" fill="#5BA0D5"/></g>
    <g class="dress-arm-left-upper"><rect x="73" y="226" width="46" height="112" rx="23" fill="#F3C19D"/><g class="dress-arm-left-lower"><rect x="64" y="316" width="43" height="108" rx="21" fill="#F3C19D"/><g class="dress-hand-left"><ellipse cx="84" cy="425" rx="25" ry="31" fill="#F3C19D"/></g></g></g>
    <g class="dress-arm-right-upper"><rect x="241" y="226" width="46" height="112" rx="23" fill="#F3C19D"/><g class="dress-arm-right-lower"><rect x="253" y="316" width="43" height="108" rx="21" fill="#F3C19D"/><g class="dress-hand-right"><ellipse cx="276" cy="425" rx="25" ry="31" fill="#F3C19D"/></g></g></g>
    <g class="dress-neck"><rect x="158" y="181" width="44" height="47" rx="18" fill="#F3C19D"/></g>
    <g class="dress-head"><ellipse cx="180" cy="122" rx="78" ry="91" fill="#F3C19D" stroke="#6A4430" stroke-width="4"/><g class="dress-hair"><path d="M105 116q2-92 77-92 76 0 76 92-32-48-153 0z" fill="#573827"/></g><g class="dress-face"><ellipse cx="151" cy="126" rx="8" ry="11" fill="#3E2C25"/><ellipse cx="209" cy="126" rx="8" ry="11" fill="#3E2C25"/><path d="M158 158q22 19 44 0" fill="none" stroke="#B75E58" stroke-width="5" stroke-linecap="round"/></g></g>
    ${svgDressJacket(visualState, { interactivePart:options.interactivePart })}
  </svg>`;
}
```

Set transform origins in SVG user-space coordinates. The child remains front-facing; `pose-lean-right` and `pose-lean-left` rotate the torso no more than 4 degrees and counter-rotate the head for readability.

- [ ] **Step 8: Implement `svgDressJacket()` with state-gated layers**

Use `DRESS_VISUAL_STATES[state] || DRESS_VISUAL_STATES.initial`. Render the jacket beside the child for `initial`, `found`, and `frontReady`; render attached sleeve/body layers inside the child SVG from `leftSleeveOn` onward. Add `data-garment-part` only when the part named by `options.interactivePart` is interactive.

```javascript
function svgDressJacket(state = 'initial', options = {}) {
  const flags = DRESS_VISUAL_STATES[state] || DRESS_VISUAL_STATES.initial;
  const partAttr = name => options.interactivePart === name
    ? ` data-garment-part="${name}" class="dress-garment-control dress-${name}"`
    : ` class="dress-${name}"`;
  return `<g class="dress-jacket state-${state}">
    <g${partAttr('jacket-body')}><path d="M112 220q68-26 136 0l-4 211H116z" fill="url(#g-jacket)"/><path d="M180 236v190" stroke="#C05020" stroke-width="5"/></g>
    <g${partAttr('sleeve-left')}><path d="M116 224q-42 5-56 44l14 146 45-4 4-170z" fill="url(#g-jacket)"/></g>
    <g${partAttr('sleeve-right')}><path d="M244 224q42 5 56 44l-14 146-45-4-4-170z" fill="url(#g-jacket)"/></g>
    <g class="dress-collar-left"><path d="M178 222l-43-4 29 52 16-29z" fill="#FFB07A"/></g>
    <g class="dress-collar-right"><path d="M182 222l43-4-29 52-16-29z" fill="#FFB07A"/></g>
    <g${partAttr('zipper-slider')}><rect x="171" y="391" width="18" height="24" rx="5" fill="#E7E7E7"/><rect x="175" y="396" width="10" height="5" rx="2" fill="#FFFFFF"/></g>
  </g>`;
}
```

- [ ] **Step 9: Add static pose CSS**

Add `.dress-character-wrap`, joint transform origins, state visibility rules, and responsive sizing. Do not add animation yet.

```css
.dress-character-wrap { position:absolute; inset:2% 17% 0 35%; z-index:4; display:flex; align-items:flex-end; justify-content:center; }
.dress-child { width:100%; height:100%; max-height:100%; overflow:visible; }
.dress-arm-left-upper, .dress-arm-right-upper,
.dress-arm-left-lower, .dress-arm-right-lower,
.dress-head, .dress-torso { transform-box:fill-box; }
.dress-arm-left-upper, .dress-arm-right-upper { transform-origin:50% 8%; }
.dress-arm-left-lower, .dress-arm-right-lower { transform-origin:50% 8%; }
.dress-head { transform-origin:50% 90%; }
.dress-garment-control { cursor:grab; touch-action:none; }
```

- [ ] **Step 10: Run tests, syntax check, and visual inspection**

Run:

```bash
node --test tests/full-body-dressing.test.js
node -e "const fs=require('fs'),vm=require('vm');const h=fs.readFileSync('index.html','utf8');[...h.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach((m,i)=>new vm.Script(m[1],{filename:'inline-'+i}));console.log('syntax OK')"
```

Expected: all dressing tests PASS and `syntax OK`.

Open a temporary dressing renderer preview at 750×380 and 390×844 viewport sizes. Verify the full body, both hands, both shoes, and jacket are not clipped. Show the A-proportion model to the user for visual approval before proceeding.

- [ ] **Step 11: Update the log and commit**

```bash
git add index.html tests/helpers/game-runtime.js tests/full-body-dressing.test.js tests/continuous-animation.test.js dev-logs/2026-08-16.md
git commit -m "建立分层穿衣儿童模型"
```

---

### Task 3: Add one-shot dressing demonstrations without changing research writes

**Files:**
- Modify: `index.html` animation CSS and `AnimationController`
- Modify: `tests/full-body-dressing.test.js`
- Modify: `tests/continuous-animation.test.js`
- Modify: `dev-logs/2026-08-16.md`

**Interfaces:**
- Produces: `AnimationController.finishOneShot(stage: HTMLElement): void`.
- Produces stage classes: `.dress-demo-once`, `.demo-running`, `.demo-finished`, `.demo-paused`.
- Consumes: `AnimationPolicy.isEnabled()`, existing `schedule(stage)`, `pause(stage)`, and `clear()`.

- [ ] **Step 1: Add failing one-shot lifecycle tests**

Add these helpers and runtime tests:

```javascript
function createDressStage() {
  const stage = createElement();
  const sequence = createElement();
  stage.dataset.demoMode = 'once';
  stage.querySelector = selector => selector === '.dress-demo-sequence' ? sequence : null;
  return { stage, sequence };
}

function researchRecords(runtime) {
  return JSON.parse(runtime.localStorage.getItem('researchRecords') || '[]');
}

function dataSnapshot(runtime) {
  return {
    events: runtime.api.UnifiedDataManager.events.length,
    records: researchRecords(runtime).length,
    state: JSON.stringify(runtime.api.SkillSceneState.values.dress)
  };
}

test('dressing demonstration runs once and returns to operation-ready state', () => {
  const runtime = loadDressingRuntime();
  const { stage, sequence } = createDressStage();
  runtime.api.AnimationController.schedule(stage);
  runtime.runTimer(0);
  assert.equal(stage.classList.contains('demo-running'), true);
  sequence.dispatch('animationend', { target:sequence });
  assert.equal(stage.classList.contains('demo-running'), false);
  assert.equal(stage.classList.contains('demo-finished'), true);
});

test('one-shot demonstration writes no events, state, or research records', () => {
  const runtime = loadDressingRuntime();
  const before = dataSnapshot(runtime);
  const { stage, sequence } = createDressStage();
  runtime.api.AnimationController.schedule(stage);
  runtime.runTimer(0);
  sequence.dispatch('animationend', { target:sequence });
  assert.deepEqual(dataSnapshot(runtime), before);
});
```

Update the existing dressing animation expectations in `tests/continuous-animation.test.js`: brush and wash retain their existing loop contract; dressing uses `1` iteration and a `.dress-demo-sequence` end event.

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
node --test tests/full-body-dressing.test.js tests/continuous-animation.test.js
```

Expected: FAIL because `finishOneShot` and `.demo-finished` do not exist and dressing CSS still uses `infinite`.

- [ ] **Step 3: Implement the one-shot controller extension**

Inside `AnimationController.schedule(stage)`, after setting `currentStage`, attach one listener only when `stage.dataset.demoMode === 'once'`:

```javascript
const sequence = stage.querySelector('.dress-demo-sequence');
if (sequence) {
  sequence.addEventListener('animationend', event => {
    if (event.target === sequence && this.currentStage === stage) {
      this.finishOneShot(stage);
    }
  }, { once:true });
}
```

Add:

```javascript
finishOneShot(stage) {
  if (!stage || this.currentStage !== stage) return;
  stage.classList.remove('demo-running');
  stage.classList.add('demo-finished');
}
```

Ensure `clear()` removes `demo-finished` in addition to existing classes. `pause()` must cancel the delayed start and freeze a running one-shot without calling `finishOneShot()`.

- [ ] **Step 4: Replace only dressing loop selectors with one-shot timing**

Remove the seven old ghost-hand dressing loop selectors. Add one `.dress-demo-sequence` animation per step with `1` iteration and `forwards`; do not change brush or wash animation declarations.

```css
.step-stage.demo-running[data-level="dress"] .dress-demo-sequence {
  animation-duration:2.2s;
  animation-timing-function:ease-in-out;
  animation-iteration-count:1;
  animation-fill-mode:forwards;
}
.step-stage.demo-finished[data-level="dress"] .dress-demo-layer {
  opacity:0;
}
```

Use seven named keyframes: `dressDemoFind`, `dressDemoFront`, `dressDemoLeftSleeve`, `dressDemoRightSleeve`, `dressDemoPullDown`, `dressDemoZipUp`, and `dressDemoCollar`. Every movement declaration uses only `transform` and `opacity`.

- [ ] **Step 5: Run both suites and source constraints**

Run:

```bash
node --test tests/full-body-dressing.test.js tests/continuous-animation.test.js
node -e "const fs=require('fs');const s=fs.readFileSync('index.html','utf8');for(const n of ['dressDemoFind','dressDemoFront','dressDemoLeftSleeve','dressDemoRightSleeve','dressDemoPullDown','dressDemoZipUp','dressDemoCollar']){const i=s.indexOf('@keyframes '+n);if(i<0)throw Error(n+' missing');const b=s.slice(i,s.indexOf('\n}',i)+2);if(/\b(top|left|right|bottom|width|height)\s*:/.test(b))throw Error(n+' changes layout');}console.log('dress demo transform contract OK')"
```

Expected: all tests PASS and `dress demo transform contract OK`.

- [ ] **Step 6: Update the log and commit**

```bash
git add index.html tests/full-body-dressing.test.js tests/continuous-animation.test.js dev-logs/2026-08-16.md
git commit -m "增加穿衣一次性动作示范"
```

---

### Task 4: Render the persistent full-body dressing scene for all seven steps

**Files:**
- Modify: `index.html` `buildPersistentStateHTML()`, `stepStageHTML()`, and `buildScene()` dressing branch
- Modify: `tests/full-body-dressing.test.js`
- Modify: `tests/continuous-animation.test.js`
- Modify: `dev-logs/2026-08-16.md`

**Interfaces:**
- Produces: `getDressVisualState(stepId: number): string`.
- Produces: `getDressInteractivePart(stepId: number): string`.
- Produces: `buildDressTarget(stepId: number): string`.
- Produces: `buildDressGuide(stepId: number): string`.
- Produces: `buildDressScene(step: object): string`.
- Produces stable stage attributes: `data-level="dress"`, `data-step="1"` through `data-step="7"`, and `data-demo-mode="once"`.
- Consumes: `SkillSceneState.has('dress', key)`, `svgDressChild()`, `svgDressJacket()`, and `arrowHTML()`.

- [ ] **Step 1: Add failing state and scene tests**

Add:

```javascript
test('each dressing step renders one real child, one passive demo layer, and no hand icon control', () => {
  const runtime = loadDressingRuntime();
  for (const step of runtime.api.LEVELS[2].steps) {
    const markup = runtime.api.buildScene('dress', step);
    assert.equal((markup.match(/dress-real-layer/g) || []).length, 1, `real step ${step.id}`);
    assert.equal((markup.match(/dress-demo-layer/g) || []).length, 1, `demo step ${step.id}`);
    assert.doesNotMatch(markup, /data-item="hand"/);
    assert.match(markup, /data-demo-mode="once"/);
  }
});

test('dressing visual state advances only from completed prior steps', () => {
  const runtime = loadDressingRuntime();
  assert.equal(runtime.api.getDressVisualState(1), 'initial');
  runtime.api.SkillSceneState.complete('dress', 1);
  assert.equal(runtime.api.getDressVisualState(2), 'found');
  runtime.api.SkillSceneState.complete('dress', 2);
  assert.equal(runtime.api.getDressVisualState(3), 'frontReady');
});
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
node --test tests/full-body-dressing.test.js
```

Expected: FAIL because current dressing scenes have no full-body child and still contain `data-item="hand"`.

- [ ] **Step 3: Implement `getDressVisualState()`**

```javascript
function getDressVisualState(stepId) {
  if (stepId >= 7 && SkillSceneState.has('dress','zipperClosed')) return 'zipperClosed';
  if (stepId >= 6 && SkillSceneState.has('dress','jacketPulledDown')) return 'jacketPulled';
  if (stepId >= 5 && SkillSceneState.has('dress','rightSleeveOn')) return 'bothSleevesOn';
  if (stepId >= 4 && SkillSceneState.has('dress','leftSleeveOn')) return 'leftSleeveOn';
  if (stepId >= 3 && SkillSceneState.has('dress','frontIdentified')) return 'frontReady';
  if (stepId >= 2 && SkillSceneState.has('dress','jacketFound')) return 'found';
  return 'initial';
}
```

Add `getDressVisualState` and `buildDressScene` to the `__animationApi` exposure string in `tests/helpers/game-runtime.js` when each function exists, so the following runtime tests use the real production functions.

- [ ] **Step 4: Replace the dressing branch with `buildDressScene()`**

`buildScene()` delegates only dressing to:

```javascript
if (levelId === 'dress') return buildDressScene(step);
```

`buildDressScene()` renders exactly one real character, one non-interactive demo layer, the active garment control, enlarged target geometry, and the existing directional guide. Use this structure:

```javascript
function buildDressScene(step) {
  const stateName = getDressVisualState(step.id);
  const interactivePart = getDressInteractivePart(step.id);
  const real = `<div class="dress-character-wrap dress-real-layer">${svgDressChild({ state:stateName, interactivePart })}</div>`;
  const demo = AnimationPolicy.isEnabled()
    ? `<div class="dress-character-wrap dress-demo-layer demo-element" aria-hidden="true"><div class="dress-demo-sequence demo-dress-step-${step.id}">${svgDressChild({ state:stateName, pose:'demo' })}</div></div>`
    : '';
  const target = buildDressTarget(step.id);
  const guide = buildDressGuide(step.id);
  return `<div class="step-stage dress-stage" data-level="dress" data-step="${step.id}" data-demo-mode="once">${real}${demo}${target}${guide}</div>`;
}
```

Implement the three mapping helpers with these exact contracts:

```javascript
function getDressInteractivePart(stepId) {
  return ['jacket-body','jacket-body','sleeve-left','sleeve-right','jacket-body','zipper-slider','collar'][stepId - 1] || '';
}

function buildDressTarget(stepId) {
  const targets = {
    3:'<div class="dress-target dress-target-left-hand drag-target" data-target="sleeve-left"></div>',
    4:'<div class="dress-target dress-target-right-hand drag-target" data-target="sleeve-right"></div>',
    5:'<div class="dress-target dress-target-lower-body" data-target="jacket-body"></div>',
    6:'<div class="dress-target dress-target-upper-zip" data-target="zipper"></div>',
    7:'<div class="dress-target dress-target-collar" data-target="collar"></div>'
  };
  return targets[stepId] || '';
}

function buildDressGuide(stepId) {
  const guides = {
    1:['tap','57%','17%','点击衣服'],
    2:['tap','50%','22%','点击正面'],
    3:['right','42%','18%','拖动左袖口靠近左手'],
    4:['left','42%','68%','拖动右袖口靠近右手'],
    5:['down','38%','48%','抓住衣身往下拉'],
    6:['up','46%','48%','抓住拉链头往上拉'],
    7:['leftright','18%','42%','在领口左右滑动']
  };
  const args = guides[stepId];
  return args ? arrowHTML(...args) : '';
}
```

Wrap the two collar paths in one `<g>` receiving `partAttr('collar')`, so step 7 exposes one coherent real garment control. Steps 1 and 2 use `jacket-body` as the click target without moving it.

For steps 1 and 2, the real jacket itself is the `.interactive-target`; for steps 3 through 6, only the named garment part is draggable; step 7 exposes the collar hit area without a separate hand icon.

- [ ] **Step 5: Remove obsolete dressing persistent overlays**

Delete the old `state-jacket-front`, `state-left-sleeve`, `state-both-sleeves`, `state-jacket-flat`, `state-zipper-closed`, and ghost-hand dressing markup from `buildPersistentStateHTML()`. Their information is now rendered by the single full-body SVG. Keep `STEP_STATE_KEYS.dress` unchanged.

- [ ] **Step 6: Run scene tests and existing animation regression**

Run:

```bash
node --test tests/full-body-dressing.test.js tests/continuous-animation.test.js
```

Expected: both suites PASS; brush and wash expectations remain unchanged.

- [ ] **Step 7: Manually inspect all seven static states**

At desktop width and iPad portrait width, load dressing steps 1 through 7 with prior states programmatically set. Verify one visible real character after the passive demo ends, no hand icon, correct jacket continuity, full body visible, and no controls hidden behind furniture.

- [ ] **Step 8: Update the log and commit**

```bash
git add index.html tests/full-body-dressing.test.js tests/continuous-animation.test.js dev-logs/2026-08-16.md
git commit -m "重建穿衣七步全身场景"
```

---

### Task 5: Implement direct garment controls for the seven existing steps

**Files:**
- Modify: `index.html` dressing `LEVELS` metadata and gesture handling
- Modify: `tests/full-body-dressing.test.js`
- Modify: `dev-logs/2026-08-16.md`

**Interfaces:**
- Produces optional step property `dressControl: 'jacket-tap'|'front-tap'|'sleeve-left'|'sleeve-right'|'body-pull'|'zipper-up'|'collar-swipe'`.
- Produces: `attachDressGarmentListeners(step: object, area: HTMLElement, signal: AbortSignal): boolean`.
- Produces: `evaluateDressGesture(control: string, metrics: object): boolean`.
- Consumes: `handleStepSuccess(area)`, `handleStepWrong(area)`, `AnimationController.pause(stage)`, and the existing abort controller.

- [ ] **Step 1: Add failing interaction-matrix tests**

Add:

```javascript
test('dressing steps expose the confirmed garment control matrix', () => {
  const source = html();
  for (const control of ['jacket-tap','front-tap','sleeve-left','sleeve-right','body-pull','zipper-up','collar-swipe']) {
    assert.ok(source.includes(`dressControl:'${control}'`), `${control} missing`);
  }
});

test('dressing gesture evaluation keeps forgiving thresholds', () => {
  const { evaluateDressGesture } = loadDressingRuntime().api;
  assert.equal(evaluateDressGesture('sleeve-left', { overlapRatio:.36 }), true);
  assert.equal(evaluateDressGesture('sleeve-left', { overlapRatio:.34 }), false);
  assert.equal(evaluateDressGesture('body-pull', { dx:5, dy:41 }), true);
  assert.equal(evaluateDressGesture('zipper-up', { dx:5, dy:-41, reachedTarget:true }), true);
  assert.equal(evaluateDressGesture('collar-swipe', { dx:41, dy:8 }), true);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
node --test tests/full-body-dressing.test.js
```

Expected: FAIL because `dressControl` and `evaluateDressGesture()` do not exist.

- [ ] **Step 3: Add explicit dressing-control metadata**

Keep every existing `id`, `instruction`, `gesture`, `target`, `arrow`, and `voice` field. Add only:

```javascript
// step 1
dressControl:'jacket-tap'
// step 2
dressControl:'front-tap'
// steps 3..7
dressControl:'sleeve-left'
dressControl:'sleeve-right'
dressControl:'body-pull'
dressControl:'zipper-up'
dressControl:'collar-swipe'
```

- [ ] **Step 4: Implement pure gesture evaluation**

```javascript
function evaluateDressGesture(control, metrics) {
  if (control === 'jacket-tap' || control === 'front-tap') return metrics.distance < 18;
  if (control === 'sleeve-left' || control === 'sleeve-right') return metrics.overlapRatio > 0.35;
  if (control === 'body-pull') return metrics.dy >= 40 && Math.abs(metrics.dy) > Math.abs(metrics.dx);
  if (control === 'zipper-up') return metrics.dy <= -40 && Math.abs(metrics.dy) > Math.abs(metrics.dx) && metrics.reachedTarget;
  if (control === 'collar-swipe') return Math.abs(metrics.dx) >= 40 && Math.abs(metrics.dx) > Math.abs(metrics.dy);
  return false;
}
```

Add `evaluateDressGesture` and `attachDressGarmentListeners` to the `__animationApi` exposure string in `tests/helpers/game-runtime.js` after implementing them.

- [ ] **Step 5: Implement the dedicated garment listener adapter**

At the start of `attachGestureListeners()`, after creating the abort controller, add:

```javascript
if (step.dressControl && attachDressGarmentListeners(step, area, signal)) return;
```

`attachDressGarmentListeners()` uses the existing touch and mouse event families, pauses the demo on the first input, moves only `.dress-garment-control` for sleeve/body/zipper controls, and computes metrics on end. It calls exactly one of `handleStepSuccess(area)` or `handleStepWrong(area)`. It returns `true` when installed.

Do not create a second abort controller. Do not attach both the dressing adapter and generic listeners. On a failed movable control, add `snap-back`, restore its original transform, and remove `snap-back` after the existing 400ms duration.

- [ ] **Step 6: Add real-path interaction tests**

Use the runtime DOM stub to dispatch touch and mouse sequences for all seven controls. Assert:

```javascript
assert.equal(successCalls, 1);
assert.equal(wrongCalls, 0);
assert.equal(stage.classList.contains('demo-paused'), true);
```

Repeat one valid mouse sequence after completion and assert the unified record count does not increase.

- [ ] **Step 7: Run interaction and existing regression suites**

Run:

```bash
node --test tests/full-body-dressing.test.js tests/continuous-animation.test.js
```

Expected: all tests PASS.

- [ ] **Step 8: Update the log and commit**

```bash
git add index.html tests/full-body-dressing.test.js dev-logs/2026-08-16.md
git commit -m "改为直接操作穿衣部件"
```

---

### Task 6: Play real completion actions before positive feedback

**Files:**
- Modify: `index.html` dressing action CSS and original `handleStepSuccess()`
- Modify: `tests/full-body-dressing.test.js`
- Modify: `tests/continuous-animation.test.js`
- Modify: `dev-logs/2026-08-16.md`

**Interfaces:**
- Produces: `DressActionController.play(stepId: number, area: HTMLElement, onComplete: Function): void`.
- Produces: `showStepSuccessFeedback(area: HTMLElement, level: object): void`, extracted from the original UI-only success body.
- Consumes: existing outer `handleStepSuccess` wrapper for deduplication, abort, prompt reset, and `UnifiedDataManager.onStepComplete(true)`.

- [ ] **Step 1: Add failing completion-order tests**

Add:

```javascript
test('dressing real action finishes before positive feedback is shown', () => {
  const runtime = loadDressingRuntime();
  const area = runtime.elements['interaction-area'];
  const stage = createElement();
  const realLayer = createElement();
  stage.querySelector = selector => selector === '.dress-real-layer' ? realLayer : null;
  area.querySelector = selector => selector === '.step-stage' ? stage : null;
  runtime.api.state.currentLevel = 2;
  runtime.api.state.currentStep = 2;
  runtime.api.UnifiedDataManager.startSession('dress');
  runtime.api.handleStepSuccess(area);
  assert.equal(area.classList.contains('success'), false);
  assert.equal(stage.classList.contains('dress-action-3'), true);
  realLayer.dispatch('animationend', { target:realLayer });
  assert.equal(area.classList.contains('success'), true);
});

test('dressing completion still writes exactly once at accepted input time', () => {
  const runtime = loadDressingRuntime();
  const area = runtime.elements['interaction-area'];
  const stage = createElement();
  const realLayer = createElement();
  stage.querySelector = selector => selector === '.dress-real-layer' ? realLayer : null;
  area.querySelector = selector => selector === '.step-stage' ? stage : null;
  runtime.api.state.currentLevel = 2;
  runtime.api.state.currentStep = 2;
  runtime.api.UnifiedDataManager.startSession('dress');
  runtime.api.handleStepSuccess(area);
  assert.equal(researchRecords(runtime).length, 1);
  realLayer.dispatch('animationend', { target:realLayer });
  assert.equal(researchRecords(runtime).length, 1);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
node --test tests/full-body-dressing.test.js
```

Expected: FAIL because current feedback is immediate and `DressActionController` is missing.

- [ ] **Step 3: Extract the existing UI feedback unchanged**

Move only the green outline, sound, praise voice, particles, progress rendering, and next-step button logic from the original `handleStepSuccess()` into:

```javascript
function showStepSuccessFeedback(area, level) {
  area.classList.add('success');
  playSuccessSound();
  const praise = ['太棒了！做得真好！','真厉害！继续加油！','非常好！你真聪明！','好棒哦！就是这样！','太好了！给你点赞！'];
  speak(praise[Math.floor(Math.random()*praise.length)]);
  spawnParticles(8);
  renderProgressDots();
  const btn = document.getElementById('next-step-btn');
  btn.textContent = state.currentStep < level.steps.length - 1 ? '✅ 下一步' : '🎉 完成关卡';
  btn.classList.add('show');
}
```

- [ ] **Step 4: Implement `DressActionController`**

```javascript
const DressActionController = {
  timer:null,
  play(stepId, area, onComplete) {
    this.clear();
    const stage = area.querySelector('.step-stage');
    if (!stage) { onComplete(); return; }
    stage.classList.add(`dress-action-${stepId}`);
    const sequence = stage.querySelector('.dress-real-layer');
    const finish = () => {
      this.timer = null;
      onComplete();
    };
    if (sequence) sequence.addEventListener('animationend', finish, { once:true });
    this.timer = setTimeout(finish, 1800);
  },
  clear() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
};
```

Add `DressActionController` and `showStepSuccessFeedback` to the `__animationApi` exposure string in `tests/helpers/game-runtime.js` after implementing them.

Guard `finish` so an animation event and fallback timer cannot invoke feedback twice. Call `DressActionController.clear()` from `loadStep()`, `startLevel()`, and `goHome()`.

- [ ] **Step 5: Route only dressing through completion actions**

The original `handleStepSuccess()` keeps `state.stepCompleted.add()` and `SkillSceneState.complete()` before any animation. Then:

```javascript
if (level.id === 'dress') {
  DressActionController.play(level.steps[state.currentStep].id, area, () => {
    showStepSuccessFeedback(area, level);
  });
  return;
}
showStepSuccessFeedback(area, level);
```

Do not move or duplicate the outer unified-data wrapper. Response time stays tied to accepted input, not animation end.

- [ ] **Step 6: Add seven real-action keyframes**

Add named classes and keyframes for: look/reach, hold front, left sleeve with ≤4° right lean, right sleeve with ≤4° left lean, pull down, zip up, and two-hand collar adjust. Use only transforms and opacity. The final step adds the existing positive sparkle only after the real collar action finishes.

- [ ] **Step 7: Run completion, data, and existing regression tests**

Run:

```bash
node --test tests/full-body-dressing.test.js tests/continuous-animation.test.js
```

Expected: all tests PASS; one accepted input produces one success event and one research record before one feedback sequence.

- [ ] **Step 8: Update the log and commit**

```bash
git add index.html tests/full-body-dressing.test.js tests/continuous-animation.test.js dev-logs/2026-08-16.md
git commit -m "增加穿衣真实完成动作"
```

---

### Task 7: Update five Tingting instructions and task-analysis response definitions

**Files:**
- Modify: `index.html` dressing voices, `VOICE_MAP`, and `TASK_ANALYSIS.dress`
- Replace: `voice/v16.m4a`
- Replace: `voice/v17.m4a`
- Replace: `voice/v18.m4a`
- Replace: `voice/v19.m4a`
- Replace: `voice/v20.m4a`
- Modify: `tests/full-body-dressing.test.js`
- Modify: `dev-logs/2026-08-16.md`

**Interfaces:**
- Produces exact confirmed voice strings mapped to `voice/v16.m4a` through `voice/v20.m4a`.
- Updates `TASK_ANALYSIS.dress.steps[2..6].responseDef` and mastery criteria to match direct garment input.
- Preserves step IDs, names, task ID, and research record schema.

- [ ] **Step 1: Add failing voice and task-analysis tests**

Add:

```javascript
const confirmedVoices = [
  ['拖动左边袖口靠近左手，把左手伸进袖子。','voice/v16.m4a'],
  ['拖动右边袖口靠近右手，把右手伸进袖子。','voice/v17.m4a'],
  ['抓住衣服中间，往下拉好。','voice/v18.m4a'],
  ['抓住拉链头，往上拉。','voice/v19.m4a'],
  ['在领口左右滑一滑，把衣领整理整齐。','voice/v20.m4a']
];

test('confirmed dressing garment voices and files are present', () => {
  const source = html();
  for (const [voice,file] of confirmedVoices) {
    assert.ok(source.includes(`voice:'${voice}'`));
    assert.ok(source.includes(`'${voice}': '${file}'`));
    assert.ok(fs.statSync(path.join(root,file)).size > 10_000);
  }
});

test('task analysis describes garment input instead of dragging a hand icon', () => {
  const dressBlock = html().match(/dress:\s*\{[\s\S]*?\n\s*\}\n\};/)[0];
  assert.doesNotMatch(dressBlock, /拖拽小手/);
  for (const term of ['拖动左袖口','拖动右袖口','向下拖动衣身','向上拖动拉链头','在衣领区域左右滑动']) {
    assert.ok(dressBlock.includes(term), `${term} missing`);
  }
});
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
node --test tests/full-body-dressing.test.js
```

Expected: FAIL because old hand-icon instructions remain.

- [ ] **Step 3: Update `LEVELS` and `VOICE_MAP` exact strings**

Replace only dressing steps 3 through 7 voice strings with the five confirmed strings. Replace the five old `VOICE_MAP` keys while keeping file names `v16.m4a` through `v20.m4a`.

- [ ] **Step 4: Generate replacement Tingting audio non-destructively, then replace after verification**

For each line, first create an AIFF in a task-specific temporary directory and convert to M4A. Example for step 3:

```bash
say -v Tingting -r 150 -o /tmp/dress-voice-v16.aiff '拖动左边袖口靠近左手，把左手伸进袖子。'
afconvert -f m4af -d aac -b 64000 /tmp/dress-voice-v16.aiff /tmp/dress-voice-v16.m4a
afinfo /tmp/dress-voice-v16.m4a
```

Repeat for v17–v20. Listen to all five temporary files. Confirm female Tingting voice, intelligibility, and consistent volume. Then replace only `voice/v16.m4a` through `voice/v20.m4a`. Do not change v00–v15 or v21–v32.

- [ ] **Step 5: Update task-analysis operational definitions**

Use these exact response definitions:

```text
Step 3: 拖动左袖口进入左手目标区
Step 4: 拖动右袖口进入右手目标区
Step 5: 向下拖动衣身至少40px
Step 6: 向上拖动拉链头至少40px并到达胸部终点
Step 7: 在衣领区域左右滑动至少40px
```

Use `重叠≥35%` for steps 3 and 4, and `方向正确且移动≥40px` for steps 5 through 7. Keep task name, domain, setting, and step behaviors unchanged.

- [ ] **Step 6: Run voice, syntax, and research tests**

Run:

```bash
node --test tests/full-body-dressing.test.js tests/continuous-animation.test.js
for f in voice/v16.m4a voice/v17.m4a voice/v18.m4a voice/v19.m4a voice/v20.m4a; do afinfo "$f" >/dev/null || exit 1; done
node -e "const fs=require('fs'),vm=require('vm');const h=fs.readFileSync('index.html','utf8');[...h.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach((m,i)=>new vm.Script(m[1],{filename:'inline-'+i}));console.log('syntax OK')"
```

Expected: all tests PASS, all five audio files parse, and `syntax OK`.

- [ ] **Step 7: Update the log and commit**

```bash
git add index.html voice/v16.m4a voice/v17.m4a voice/v18.m4a voice/v19.m4a voice/v20.m4a tests/full-body-dressing.test.js dev-logs/2026-08-16.md
git commit -m "更新穿衣部件操作语音与定义"
```

---

### Task 8: Complete research integrity, 21-step regression, documentation, and release gate

**Files:**
- Modify: `tests/full-body-dressing.test.js`
- Modify: `tests/continuous-animation.test.js`
- Modify: `docs/testing/2026-07-29-continuous-animation-checklist.md`
- Modify: `docs/design-spec.md`
- Modify: `docs/implementation-plan.md`
- Modify: `dev-logs/2026-08-16.md`

**Interfaces:**
- Consumes all production interfaces from Tasks 1 through 7.
- Produces final automated evidence and a manual Mac Edge/iPad Safari release checklist.

- [ ] **Step 1: Add the final research-condition matrix test**

Test all combinations against the real `AnimationPolicy` and real dressing markup:

```javascript
const runtime = loadDressingRuntime();
const { api } = runtime;
for (const phase of ['baseline','intervention','maintenance']) {
  for (const mode of [api.TrainingModes.TEACHING, api.TrainingModes.PRACTICE, api.TrainingModes.ASSESSMENT]) {
    api.ResearchMode.active = true;
    api.ResearchMode.phase = phase;
    api.setTrainingMode(mode);
    const markup = api.buildDressScene(api.LEVELS[2].steps[0]);
    const enabled = phase === 'intervention' && mode.id === 'teaching';
    assert.equal(markup.includes('dress-demo-layer'), enabled, `${phase}/${mode.id}`);
  }
}
api.ResearchMode.active = false;
api.setTrainingMode(api.TrainingModes.TEACHING);
assert.equal(api.buildDressScene(api.LEVELS[2].steps[0]).includes('dress-demo-layer'), true);
```

Assert two complete demo plays add zero `step_success` events and zero `researchRecords`; one accepted action adds exactly one of each with `taskId:'dress'` and `responseTimeMs` measured before the completion animation ends.

- [ ] **Step 2: Add the complete state-chain test**

Programmatically complete dressing steps 1 through 7 and assert the visible state sequence:

```text
initial → found → frontReady → leftSleeveOn → bothSleevesOn → jacketPulled → zipperClosed → complete
```

Call `goHome()` and assert the next dressing start returns to `initial`.

- [ ] **Step 3: Run all automated checks**

Run:

```bash
node --test tests/*.test.js
node -e "const fs=require('fs'),vm=require('vm');const h=fs.readFileSync('index.html','utf8');[...h.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach((m,i)=>new vm.Script(m[1],{filename:'inline-'+i}));console.log('inline JavaScript syntax OK')"
node -e "const fs=require('fs');const h=fs.readFileSync('index.html','utf8');const skills=[...h.matchAll(/id:'(brush|wash|dress)'/g)].map(m=>m[1]);if(skills.length!==3)throw Error('skill count');const block=h.match(/const LEVELS = \[([\s\S]*?)\n\];/)[1];const steps=(block.match(/\{id:\d+,instruction:/g)||[]).length;if(steps!==21)throw Error('step count '+steps);console.log('3 skills / 21 steps OK')"
git diff --check
```

Expected: zero failures; syntax OK; `3 skills / 21 steps OK`; no whitespace errors.

- [ ] **Step 4: Perform Mac Edge manual dressing verification**

For normal play, run all seven dressing steps and verify: one-shot demo, direct garment control, full completion action, state continuity, voice, sound, next-step button, full-body visibility, and no console errors. Test both mouse and touch emulation. Repeat at 750×380 and 390×844 viewport sizes.

- [ ] **Step 5: Perform research-mode manual verification**

Run one dressing step in each of Baseline/Assessment, Intervention/Teaching, Intervention/Practice, and Maintenance. Verify demo visibility matches policy and each accepted action writes one correctly shaped record. Export CSV and confirm `responseTimeMs`, `errors`, `participantID`, and `taskId` columns remain usable.

- [ ] **Step 6: Perform iPad Safari seven-step verification**

On the real target iPad, verify all seven controls, full-body framing, no clipping, no accidental page scrolling, female voice playback, smooth one-shot and completion animations, and no obvious frame drops. Record any exact step/device issue before merge.

- [ ] **Step 7: Run brushing and washing regression**

Complete brushing steps 1–7 and washing steps 1–7 in desktop Edge. Confirm their existing scene objects, gesture targets, voices, loop demonstrations, success feedback, and research records are unchanged.

- [ ] **Step 8: Update documentation and checklist**

Update:

- `docs/testing/2026-07-29-continuous-animation-checklist.md` with seven full-body dressing rows and one-shot expectations.
- `docs/design-spec.md` bedroom scene, A-proportion full-body SVG, orange hooded jacket, and garment-control rules.
- `docs/implementation-plan.md` current phase and real-device status.
- `dev-logs/2026-08-16.md` commits, automated counts, manual results, known limitations, and release decision.

- [ ] **Step 9: Request independent review**

Review the complete diff against `docs/superpowers/specs/2026-08-16-full-body-dressing-animation-design.md`. Reject the branch for any of these: hand icon remains as a dressing control; demo loops; demo writes data; dressing state resets between steps; Baseline/Maintenance/Assessment shows a demo; voice instructs the wrong object; brush or wash changed unintentionally.

- [ ] **Step 10: Commit final regression evidence**

```bash
git add tests/full-body-dressing.test.js tests/continuous-animation.test.js docs/testing/2026-07-29-continuous-animation-checklist.md docs/design-spec.md docs/implementation-plan.md dev-logs/2026-08-16.md
git commit -m "完成全身穿衣动作回归验证"
```

Do not merge or push at this step. Use `superpowers:finishing-a-development-branch` only after all automated checks pass, independent review passes, and the user has reviewed the Mac/iPad result or accepted the remaining device-test limitation.
