# 21-Step Continuous Demonstration Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a delayed, touch-pausing demonstration animation and persistent within-skill visual state to all 21 life-skill steps without changing existing response criteria or research data writes.

**Architecture:** Keep all production code in `index.html`. Add a small `AnimationPolicy`, `AnimationController`, and `SkillSceneState`, then mark existing scene objects with stable CSS classes. CSS handles motion; JavaScript only schedules, pauses, clears, and records visual state. Existing gesture and data hooks remain the sole path for success, error, and research records.

**Tech Stack:** HTML5, CSS keyframes, vanilla JavaScript, local PNG/SVG assets, browser-based manual verification.

## Global Constraints

- Do not introduce a framework, package, CDN, GIF, video, or Canvas animation.
- Do not change the child-facing layout, voice map, buttons, success criteria, 35% drag threshold, or 21-step order.
- Do not add another wrapper around `loadStep`, `handleStepSuccess`, `startLevel`, or `goHome`.
- Demonstration elements must use `pointer-events:none`.
- Demonstrations must never call `handleStepSuccess()` and must never write to `researchRecords`.
- Normal play enables demonstrations.
- Research Intervention with Teaching mode enables demonstrations.
- Research Baseline, Assessment, Maintenance, and non-Teaching research sessions disable demonstrations.
- A demonstration starts 2000ms after the stage is installed and pauses on the first `touchstart` or `mousedown`.
- Returning home or starting another skill clears timers and all visual state.
- Production application code remains in `index.html`.

---

### Task 1: Animation lifecycle and research policy

**Files:**
- Modify: `index.html:226-245`
- Modify: `index.html:889-897`
- Modify: `index.html:1008-1085`
- Modify: `index.html:1261-1472`
- Modify: `dev-logs/2026-07-29.md`

**Interfaces:**
- Produces: `AnimationPolicy.isEnabled(): boolean`.
- Produces: `AnimationController.schedule(stage: HTMLElement): void`.
- Produces: `AnimationController.pause(stage?: HTMLElement): void`.
- Produces: `AnimationController.clear(): void`.
- Consumes: `ResearchMode.active`, `ResearchMode.phase`, and `currentTrainingMode.id` at user-interaction time.

- [ ] **Step 1: Record the pre-change lifecycle checks**

Run:

```bash
node -e "const fs=require('fs');const s=fs.readFileSync('index.html','utf8');for(const n of ['loadStep','attachGestureListeners','handleStepSuccess','startLevel','goHome'])if(!s.includes('function '+n+'('))throw new Error(n+' missing');console.log('lifecycle functions present')"
```

Expected: `lifecycle functions present`.

- [ ] **Step 2: Add the base animation CSS contract**

Add CSS beside `.step-stage`:

```css
.demo-element, .persistent-state {
  pointer-events:none;
}
.step-stage.demo-paused .demo-element,
.step-stage.demo-paused .demo-element::before,
.step-stage.demo-paused .demo-element::after {
  animation-play-state:paused !important;
}
@media (prefers-reduced-motion: reduce) {
  .demo-element, .demo-element::before, .demo-element::after {
    animation:none !important;
  }
}
```

- [ ] **Step 3: Add `AnimationPolicy`**

Add after the base `state` object:

```javascript
const AnimationPolicy = {
  isEnabled() {
    if (!ResearchMode.active) return true;
    return ResearchMode.phase === 'intervention' &&
      currentTrainingMode.id === 'teaching';
  }
};
```

The function is called only after the script has loaded and the user has started a level, so later `const` declarations are initialized before access.

- [ ] **Step 4: Add `AnimationController`**

Add after `AnimationPolicy`:

```javascript
const AnimationController = {
  timer: null,
  currentStage: null,

  schedule(stage) {
    this.clear();
    this.currentStage = stage;
    if (!stage || !AnimationPolicy.isEnabled() ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.timer = setTimeout(() => {
      if (this.currentStage === stage && stage.isConnected) {
        stage.classList.add('demo-running');
      }
      this.timer = null;
    }, 2000);
  },

  pause(stage) {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const target = stage || this.currentStage;
    if (target) target.classList.add('demo-paused');
  },

  clear() {
    if (this.timer) clearTimeout(this.timer);
    if (this.currentStage) {
      this.currentStage.classList.remove('demo-running', 'demo-paused');
    }
    this.timer = null;
    this.currentStage = null;
  }
};
```

- [ ] **Step 5: Connect the controller to existing lifecycle points**

In the original `loadStep()`:

- call `AnimationController.clear()` before replacing the old stage;
- call `AnimationController.schedule(newStage)` after `attachGestureListeners(step, area)`.

In both existing `touchstart` and `mousedown` listeners, call:

```javascript
AnimationController.pause(area.querySelector('.step-stage'));
```

before gesture branching. In the original `startLevel()` and `goHome()`, call `AnimationController.clear()`. Do not add new wrappers.

- [ ] **Step 6: Run syntax and policy-source checks**

Run:

```bash
node -e "const fs=require('fs');const h=fs.readFileSync('index.html','utf8');const s=[...h.matchAll(/<script>([\\s\\S]*?)<\\/script>/g)].map(m=>m[1]);s.forEach(x=>new Function(x));for(const q of ['AnimationPolicy','AnimationController','demo-running','demo-paused','2000'])if(!h.includes(q))throw new Error(q+' missing');console.log('animation lifecycle syntax OK')"
```

Expected: `animation lifecycle syntax OK`.

- [ ] **Step 7: Update the development log and commit**

Record controller integration and checks in `dev-logs/2026-07-29.md`.

```bash
git add index.html dev-logs/2026-07-29.md
git commit -m "增加连续动画生命周期控制"
```

---

### Task 2: Persistent skill-state model

**Files:**
- Modify: `index.html:889-930`
- Modify: `index.html:1008-1020`
- Modify: `index.html:1138-1155`
- Modify: `index.html:1475-1492`
- Modify: `dev-logs/2026-07-29.md`

**Interfaces:**
- Produces: `SkillSceneState.reset(): void`.
- Produces: `SkillSceneState.complete(levelId: string, stepId: number): void`.
- Produces: `SkillSceneState.has(levelId: string, key: string): boolean`.
- Produces: `buildPersistentStateHTML(levelId: string, stepId: number): string`.
- Consumes: `LEVELS[state.currentLevel].id` and the current step ID.

- [ ] **Step 1: Add an explicit step-to-state mapping**

Add:

```javascript
const STEP_STATE_KEYS = {
  brush: ['toothbrushFound','toothpasteApplied','toothbrushPickedUp','leftBrushed','rightBrushed','rinsed','mouthWiped'],
  wash: ['faucetOn','waterCollected','towelWet','towelWrung','faceWashed','towelRinsed','faucetOff'],
  dress: ['jacketFound','frontIdentified','leftSleeveOn','rightSleeveOn','jacketPulledDown','zipperClosed','collarAdjusted']
};
```

- [ ] **Step 2: Add `SkillSceneState`**

```javascript
const SkillSceneState = {
  values: {},

  reset() {
    this.values = {
      brush: Object.fromEntries(STEP_STATE_KEYS.brush.map(k => [k, false])),
      wash: Object.fromEntries(STEP_STATE_KEYS.wash.map(k => [k, false])),
      dress: Object.fromEntries(STEP_STATE_KEYS.dress.map(k => [k, false]))
    };
  },

  complete(levelId, stepId) {
    const key = STEP_STATE_KEYS[levelId]?.[stepId - 1];
    if (key) this.values[levelId][key] = true;
  },

  has(levelId, key) {
    return this.values[levelId]?.[key] === true;
  }
};
SkillSceneState.reset();
```

- [ ] **Step 3: Reset and update state at existing lifecycle points**

Call `SkillSceneState.reset()` inside the original `startLevel()` and `goHome()`. In the original `handleStepSuccess()` call:

```javascript
SkillSceneState.complete(level.id, level.steps[state.currentStep].id);
```

before visual success feedback. Do not write new research events.

- [ ] **Step 4: Add a persistent-state rendering helper**

Add `buildPersistentStateHTML(levelId, stepId)` beside `stepStageHTML()`. It returns only state indicators relevant to prior completed steps, never interactive targets. Use these stable classes:

```text
state-paste-on-brush
state-clean-left
state-clean-both
state-water-stream
state-wet-towel
state-clean-face
state-jacket-front
state-left-sleeve
state-both-sleeves
state-jacket-flat
state-zipper-closed
```

Each returned element must include `persistent-state` and `aria-hidden="true"`.

- [ ] **Step 5: Extend `stepStageHTML` without changing its callers’ behavior**

Change the signature to:

```javascript
function stepStageHTML(objects, guide, levelId, stepId) {
  const persistent = buildPersistentStateHTML(levelId, stepId);
  return `<div class="step-stage" data-level="${levelId}" data-step="${stepId}">${persistent}${objects}${guide}</div>`;
}
```

Update the three `return stepStageHTML(...)` calls in `buildScene()` to pass `levelId` and `sid`.

- [ ] **Step 6: Run state mapping checks**

Run:

```bash
node -e "const fs=require('fs');const s=fs.readFileSync('index.html','utf8');for(const id of ['brush','wash','dress']){const m=s.match(new RegExp(id+': \\\\[(.*?)\\\\]'));if(!m)throw new Error(id+' mapping missing');const n=(m[1].match(/'/g)||[]).length/2;if(n!==7)throw new Error(id+' state count='+n)}console.log('skill state mapping: 3 x 7')"
```

Expected: `skill state mapping: 3 x 7`.

- [ ] **Step 7: Update the development log and commit**

```bash
git add index.html dev-logs/2026-07-29.md
git commit -m "增加三项技能连续场景状态"
```

---

### Task 3: Brushing demonstration animations

**Files:**
- Modify: `index.html:226-370`
- Modify: `index.html:1149-1205`
- Modify: `dev-logs/2026-07-29.md`

**Interfaces:**
- Consumes: `.step-stage.demo-running`.
- Consumes: `SkillSceneState` through `buildPersistentStateHTML`.
- Produces: Seven brushing stage markers `demo-brush-1` through `demo-brush-7`.

- [ ] **Step 1: Mark all seven brushing scenes**

Add a stable `demo-element demo-brush-N` class to the object that demonstrates each action. For drag steps, add a separate ghost demonstration element and leave `.draggable-item` stationary so the child’s real object never moves before interaction.

- [ ] **Step 2: Add brushing keyframes**

Add keyframes and selectors for:

```text
demoFindPulse
demoPasteSqueeze
demoPasteDrop
demoPickUp
demoBrushVertical
demoCupTilt
demoWipeHorizontal
cleanSparkle
```

Animations run only under `.step-stage.demo-running`. Use `transform` and `opacity`; keep each cycle between 1.4s and 2.4s.

- [ ] **Step 3: Render brushing continuity indicators**

Implement:

- toothpaste dab on brush for steps 3-5 after step 2;
- left clean sparkle on step 5 after step 4;
- both-side clean sparkle on steps 6-7 after step 5;
- final clean-mouth sparkle after step 7 success.

These elements are decorative and non-interactive.

- [ ] **Step 4: Verify all brushing animation markers**

Run:

```bash
node -e "const fs=require('fs');const s=fs.readFileSync('index.html','utf8');for(let i=1;i<=7;i++)if(!s.includes('demo-brush-'+i))throw new Error('brush '+i+' missing');console.log('brushing markers: 7/7')"
```

Expected: `brushing markers: 7/7`.

- [ ] **Step 5: Browser-check brushing**

Start:

```bash
python3 -m http.server 8765
```

In a desktop browser, run all seven brushing steps and verify for each step:

- no movement before 2000ms;
- demonstration starts after the delay;
- first touch pauses it;
- the original action still succeeds;
- the next step displays the expected prior state.

- [ ] **Step 6: Update the development log and commit**

```bash
git add index.html dev-logs/2026-07-29.md
git commit -m "增加刷牙七步连续示范动画"
```

---

### Task 4: Face-washing demonstration animations

**Files:**
- Modify: `index.html:226-430`
- Modify: `index.html:1206-1235`
- Modify: `dev-logs/2026-07-29.md`

**Interfaces:**
- Consumes: `.step-stage.demo-running`.
- Consumes: `SkillSceneState` through `buildPersistentStateHTML`.
- Produces: Seven face-washing stage markers `demo-wash-1` through `demo-wash-7`.

- [ ] **Step 1: Mark all seven washing scenes**

Add separate non-interactive ghost hand, towel, water-drop, or water-stream elements for each correct action. Keep the real `.draggable-item` and `.drag-target` unchanged.

- [ ] **Step 2: Add washing keyframes**

Add:

```text
demoHandPushUp
demoCollectWater
demoTowelRub
demoTowelWring
demoFaceWipe
demoTowelRinse
demoHandPushDown
waterFlow
waterFadeOut
```

- [ ] **Step 3: Render washing continuity indicators**

Implement:

- persistent water stream after step 1 through step 6;
- small hand droplets after step 2;
- darker wet towel after step 3;
- reduced droplets after step 4;
- clean-face sparkle after step 5;
- clean wet towel after step 6;
- no water stream after step 7.

- [ ] **Step 4: Verify all washing animation markers**

Run:

```bash
node -e "const fs=require('fs');const s=fs.readFileSync('index.html','utf8');for(let i=1;i<=7;i++)if(!s.includes('demo-wash-'+i))throw new Error('wash '+i+' missing');console.log('washing markers: 7/7')"
```

Expected: `washing markers: 7/7`.

- [ ] **Step 5: Browser-check face washing**

Run all seven washing steps and apply the same delay, pause, success, and state-continuity checks used for brushing. Confirm water disappears after the final step.

- [ ] **Step 6: Update the development log and commit**

```bash
git add index.html dev-logs/2026-07-29.md
git commit -m "增加洗脸七步连续示范动画"
```

---

### Task 5: Dressing demonstration animations

**Files:**
- Modify: `index.html:226-490`
- Modify: `index.html:1236-1260`
- Modify: `dev-logs/2026-07-29.md`

**Interfaces:**
- Consumes: `.step-stage.demo-running`.
- Consumes: `SkillSceneState` through `buildPersistentStateHTML`.
- Produces: Seven dressing stage markers `demo-dress-1` through `demo-dress-7`.

- [ ] **Step 1: Mark all seven dressing scenes**

Add non-interactive demonstration layers for jacket selection, front-side tilt, left sleeve, right sleeve, pull-down, zipper, and collar actions. Do not animate the child’s actual draggable hand.

- [ ] **Step 2: Add dressing keyframes**

Add:

```text
demoJacketPulse
demoJacketFront
demoLeftSleeve
demoRightSleeve
demoPullDown
demoZipUp
demoCollarAdjust
```

- [ ] **Step 3: Render dressing continuity indicators**

Use inline SVG overlays that match the existing jacket:

- front-facing highlight after step 2;
- left sleeve completion after step 3;
- both sleeves completion after step 4;
- straight hem after step 5;
- closed zipper line after step 6;
- symmetrical collar sparkle after step 7.

- [ ] **Step 4: Verify all dressing animation markers**

Run:

```bash
node -e "const fs=require('fs');const s=fs.readFileSync('index.html','utf8');for(let i=1;i<=7;i++)if(!s.includes('demo-dress-'+i))throw new Error('dress '+i+' missing');console.log('dressing markers: 7/7')"
```

Expected: `dressing markers: 7/7`.

- [ ] **Step 5: Browser-check dressing**

Run all seven dressing steps. Confirm ghost demonstrations do not change drag target geometry and all sleeve, jacket-body, zipper, and collar targets still accept the original 35% overlap.

- [ ] **Step 6: Update the development log and commit**

```bash
git add index.html dev-logs/2026-07-29.md
git commit -m "增加穿衣七步连续示范动画"
```

---

### Task 6: Research-condition and data-integrity verification

**Files:**
- Modify: `index.html` only if verification reveals a policy defect
- Modify: `dev-logs/2026-07-29.md`

**Interfaces:**
- Consumes: `AnimationPolicy.isEnabled()`.
- Observes: `UnifiedDataManager.events` and `localStorage.researchRecords`.
- Produces: Verified condition matrix with no new data fields or writes.

- [ ] **Step 1: Verify the animation condition matrix**

In browser testing, verify:

| Research state | Phase | Training mode | Expected |
|---|---|---|---|
| inactive | — | any | animation enabled |
| active | intervention | teaching | animation enabled |
| active | intervention | practice | animation disabled |
| active | intervention | assessment | animation disabled |
| active | baseline | any | animation disabled |
| active | maintenance | any | animation disabled |

- [ ] **Step 2: Verify no animation event writes**

Before the 2000ms delay, record:

```javascript
const beforeEvents = UnifiedDataManager.events.length;
const beforeRecords = JSON.parse(localStorage.getItem('researchRecords') || '[]').length;
```

After two full demonstration cycles without child action, verify:

```javascript
UnifiedDataManager.events.length === beforeEvents
JSON.parse(localStorage.getItem('researchRecords') || '[]').length === beforeRecords
```

Expected: both expressions are `true`.

- [ ] **Step 3: Verify one child completion creates one record**

Complete one step after the animation pauses. Confirm exactly one `step_success` event and one new step-level `researchRecords` item, with unchanged fields:

```text
participantID, skill, phase, sessionNumber, stepNumber, stepName,
taskId, completionStatus, promptLevel, trainingMode,
responseTimeMs, errors, timestamp
```

- [ ] **Step 4: Update the development log and commit any policy fix**

If no code fix is required, commit only the verification record with the final task. If a fix is required:

```bash
git add index.html dev-logs/2026-07-29.md
git commit -m "修正研究条件下动画控制"
```

---

### Task 7: Full 21-step regression and deployment

**Files:**
- Create: `docs/testing/2026-07-29-continuous-animation-checklist.md`
- Modify: `dev-logs/2026-07-29.md`
- Modify: `index.html` only for defects found during regression

**Interfaces:**
- Consumes: all animation, state, interaction, audio, and research interfaces from Tasks 1-6.
- Produces: completed 21-step verification checklist and deployed GitHub Pages version.

- [ ] **Step 1: Run static verification**

```bash
node -e "const fs=require('fs');const h=fs.readFileSync('index.html','utf8');const scripts=[...h.matchAll(/<script>([\\s\\S]*?)<\\/script>/g)].map(m=>m[1]);scripts.forEach((s,i)=>new Function(s));console.log('JavaScript syntax OK')"
node -e "const fs=require('fs');const s=fs.readFileSync('index.html','utf8');const b=s.match(/const LEVELS = \\[([\\s\\S]*?)\\n\\];/);const skills=(b[1].match(/id:'(brush|wash|dress)'/g)||[]).length;const steps=(b[1].match(/\\{id:[1-7],instruction:/g)||[]).length;if(skills!==3||steps!==21)process.exit(1);console.log('skills='+skills+', steps='+steps)"
git diff --check
```

Expected:

```text
JavaScript syntax OK
skills=3, steps=21
```

- [ ] **Step 2: Complete the browser checklist**

Create a table with one row per step and these columns:

```text
Skill | Step | 2s delay | animation visible | touch pauses |
original action passes | state retained | duplicate data | console error
```

All 21 rows must pass before deployment.

- [ ] **Step 3: Verify reset paths**

Test:

- return home before demonstration starts;
- return home while demonstration runs;
- restart the same skill;
- switch from brushing to washing;
- switch from normal play to a research session.

Confirm no old timer fires and no prior skill state appears.

- [ ] **Step 4: Verify iPad Safari**

On iPad Safari, complete at least one tap, one swipe, and one drag step in each skill, then complete all remaining steps. Confirm animation does not cause scroll, flicker, delayed touch, or dropped audio.

- [ ] **Step 5: Record final evidence**

Update `docs/testing/2026-07-29-continuous-animation-checklist.md` and `dev-logs/2026-07-29.md` with pass/fail evidence. Do not label iPad testing as passed unless it was actually performed on an iPad.

- [ ] **Step 6: Commit the verified implementation**

```bash
git add index.html docs/testing/2026-07-29-continuous-animation-checklist.md dev-logs/2026-07-29.md
git commit -m "完成21步连续动画回归测试"
```

- [ ] **Step 7: Push and verify GitHub Pages**

```bash
git push origin main
curl -L --max-time 15 -s "https://labaicai-2004.github.io/life-skills-game/" | rg "AnimationController"
```

Expected: the deployed HTML contains `AnimationController`.

## Self-review result

- Every approved design requirement is assigned to a task.
- Production changes remain in `index.html`.
- No placeholder steps or unspecified interfaces remain.
- Research-condition gating and no-write verification are explicit.
- iPad verification is separated from desktop evidence so it cannot be claimed without a real device run.
