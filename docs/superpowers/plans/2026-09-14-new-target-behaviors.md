# 三项新干预目标行为 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有“刷牙、洗脸、穿衣”替换为“清洗衣服、折叠衣服、收整折叠伞”三关卡，实现21个可连续完成、可语音引导、可记录的卡通互动步骤。

**Architecture:** 继续使用单文件 `index.html`保存所有页面、样式、步骤数据和互动逻辑，图片按关卡放入 `assets/` 子目录。保留现有进度、语音、奖励、递进提示和研究记录基础，用统一的“步骤进度”小工具支持揉洗、逐片理伞等重复动作。旧研究记录保留原样，新记录使用新的任务标识。

**Tech Stack:** 原生 HTML/CSS/JavaScript、Web Speech API、Web Audio API、LocalStorage、Node.js 内置测试器、本地 PNG 图片；不引入 npm 包、CDN、框架或第三方库。

**Spec:** `docs/superpowers/specs/2026-09-14-new-target-behaviors-design.md`

## Global Constraints

- 应用目标平台为 iPad Safari（iOS 15+），同时保留桌面端鼠标调试。
- 所有应用代码继续保存在 `index.html`，不拆分 JavaScript 或 CSS 文件。
- 所有图片使用项目内本地资源，不发起运行时网络请求。
- 每关7步，每屏只有一个主要操作目标。
- 拖放成功阈值保持为物品与目标区重叠超过35%，所有触控目标不小于44×44pt。
- 语音使用中文女声和0.75倍语速，文字仅作辅助。
- 不显示负面评价、红色警告或失败分数。
- 卡通素材统一为深棕色粗描边、大色块、低细节和柔和色彩，不与旧写实素材混用。
- 不删除旧研究数据；只删除已确认不再被网页、测试或文档引用的旧图片文件。

---

## File Map

- Modify: `index.html` — 首页关卡、21步数据、场景、动画、手势、语音、研究记录和完成弹窗。
- Create: `tests/new-target-behaviors.test.js` — 新关卡数据、场景、重复动作、连续状态、记录和资源引用测试。
- Modify: `tests/continuous-animation.test.js` — 把旧任务的动画断言替换为新任务的兼容性断言。
- Create: `assets/laundry/` — 洗衣场景、脏/净上衣、水盆和洗衣液。
- Create: `assets/folding/` — 折衣桌面、展开卫衣和叠好卫衣。
- Create: `assets/umbrella/` — 收伞场景和打开、收拢、卷好的六片手动折叠伞。
- Modify: `docs/requirements.md` — 把三项旧技能及场景说明替换为新任务。
- Modify: `docs/design-spec.md` — 更新卡通画风、新场景、物品和新增的重复动作规则。
- Modify: `docs/implementation-plan.md` — 记录本轮21步内容替换与测试状态。
- Modify: `dev-logs/2026-09-14.md` — 持续记录设计、实施、检查和上传结果。

### Task 1: 锁定新关卡数据与研究标识

**Files:**
- Create: `tests/new-target-behaviors.test.js`
- Modify: `index.html:828-885, 1102-1195, 2020-2125, 2445-2495, 2641-2760`

**Interfaces:**
- Produces: `LEVELS` 中的 `laundry` / `fold-clothes` / `fold-umbrella` 三个任务标识。
- Produces: `STEP_STATE_KEYS[levelId]: string[7]` 与 `TASK_ANALYSIS[levelId].steps: TaskStep[7]`。
- Preserves: `localStorage.researchRecords` 和 `localStorage.session_summaries` 中的旧记录，不做覆盖或删除。

- [ ] **Step 1: 写三关数据失败测试**

```js
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
```

- [ ] **Step 2: 运行定向测试并确认因旧标识失败**

Run: `node --test tests/new-target-behaviors.test.js`

Expected: FAIL，输出仍为 `brush, wash, dress`。

- [ ] **Step 3: 替换首页、研究选择项和三套数据定义**

```js
const NEW_LEVEL_IDS = ['laundry', 'fold-clothes', 'fold-umbrella'];
const STEP_STATE_KEYS = {
  laundry: ['shirtInBasin','shirtWet','detergentAdded','frontRubbed','backRubbed','shirtRinsed','shirtWrung'],
  'fold-clothes': ['shirtPlaced','shirtSmoothed','leftSleeveFolded','rightSleeveFolded','leftBodyFolded','rightBodyFolded','shirtFolded'],
  'fold-umbrella': ['frameClosed','shaftShortened','strapFacingOut','panelsSmoothed','panelsGathered','canopyRolled','strapFastened']
};
```

将 `LEVELS` 和 `TASK_ANALYSIS` 按已批准的设计文档逐字填入，三关名称分别为“清洗衣服”、“折叠衣服”和“收整折叠伞”。研究记录的 `skill` 映射使用 `clothes washing`、`clothes folding`、`folding umbrella` 三个新值。

- [ ] **Step 4: 运行数据测试**

Run: `node --test tests/new-target-behaviors.test.js`

Expected: PASS for level IDs, 7-step counts, state keys, task-analysis names and voice strings.

- [ ] **Step 5: 保存本任务**

```bash
git add index.html tests/new-target-behaviors.test.js
git commit -m "替换三项干预任务数据"
```

### Task 2: 生成并验收统一卡通素材

**Files:**
- Create: `assets/laundry/laundry-room.png`
- Create: `assets/laundry/shirt-dirty.png`
- Create: `assets/laundry/shirt-clean.png`
- Create: `assets/laundry/wash-basin.png`
- Create: `assets/laundry/detergent.png`
- Create: `assets/folding/folding-table.png`
- Create: `assets/folding/sweatshirt-flat.png`
- Create: `assets/folding/sweatshirt-folded.png`
- Create: `assets/umbrella/umbrella-room.png`
- Create: `assets/umbrella/umbrella-open.png`
- Create: `assets/umbrella/umbrella-closed.png`
- Create: `assets/umbrella/umbrella-folded.png`
- Modify: `tests/new-target-behaviors.test.js`

**Interfaces:**
- Produces: 3张底图，统一为2048×1152 PNG。
- Produces: 9张透明背景物品图，长边不小于1024px，alpha 通道存在。
- Consumes: `/Users/labaicaimac/Desktop/游戏风格.jpg` 仅用作画风参考，不复制其构图或角色。

- [ ] **Step 1: 先写素材完整性测试**

```js
test('all new local artwork exists and old photo assets are not referenced', () => {
  for (const file of REQUIRED_ASSETS) {
    assert.equal(fs.existsSync(path.join(ROOT, file)), true, `${file} missing`);
  }
  for (const oldName of ['bathroom-bg.png','brush-boy.png','cartoon-boy.png']) {
    assert.doesNotMatch(HTML, new RegExp(`src=["'][^"']*${oldName}`));
  }
});
```

- [ ] **Step 2: 运行测试并确认新素材尚未存在**

Run: `node --test tests/new-target-behaviors.test.js`

Expected: FAIL with `assets/laundry/laundry-room.png missing`.

- [ ] **Step 3: 用内置图像生成能力分批制作素材**

底图通用提示词：

```text
原创儿童生活技能游戏横向场景，扁平手绘卡通，深棕色粗描边，大色块，低细节，柔和高对比色彩，不要文字，不要人物，中央留出宽阔互动区。2048×1152。参考图仅用于画风，不复制其构图或物体。
```

物品通用提示词：

```text
单个完整生活物品的正面游戏素材，透明背景，扁平手绘卡通，深棕色粗描边，大色块，低细节，完整轮廓，不要手，不要人物，不要文字，不要投影，不要裁边。参考图仅用于画风。
```

依次补入各文件的具体物体和状态，同一物体的后续状态使用前一张图作内容参考，保持颜色、描边和比例一致。

- [ ] **Step 4: 检查尺寸、alpha 通道和真实透明角点**

Run:

```bash
sips -g pixelWidth -g pixelHeight -g hasAlpha assets/laundry/*.png assets/folding/*.png assets/umbrella/*.png
```

Expected: backgrounds 2048×1152; every object reports `hasAlpha: yes`. 另用图像查看工具逐张检查，透明物品不得有白色方框、裁边或多余物体。

- [ ] **Step 5: 运行素材完整性测试**

Run: `node --test tests/new-target-behaviors.test.js`

Expected: asset existence and alpha checks PASS.

- [ ] **Step 6: 保存本任务**

```bash
git add assets tests/new-target-behaviors.test.js
git commit -m "添加三关统一卡通素材"
```

### Task 3: 建立可重复动作和子进度机制

**Files:**
- Modify: `index.html:1160-1275, 1710-1920`
- Modify: `tests/new-target-behaviors.test.js`

**Interfaces:**
- Produces: `StepProgress.reset(step): void`。
- Produces: `StepProgress.advance(amount = 1): { current:number, goal:number, complete:boolean }`。
- Produces: `StepProgress.render(container): void`。
- Consumes: optional `step.repeatGoal: number`; absent or `1` retains one-action behavior.
- Produces: `gesture` values `repeat-horizontal`, `repeat-vertical`, `push-inward`, `roll-horizontal` in addition to existing `tap` and `drag`.

- [ ] **Step 1: 写重复进度和方向变化的失败测试**

```js
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
```

- [ ] **Step 2: 运行测试并确认 `StepProgress` 不存在**

Run: `node --test tests/new-target-behaviors.test.js`

Expected: FAIL with `Cannot read properties of undefined (reading 'reset')`.

- [ ] **Step 3: 实现最小子进度对象**

```js
const StepProgress = {
  current: 0,
  goal: 1,
  reset(step) {
    this.current = 0;
    this.goal = Math.max(1, Number(step?.repeatGoal) || 1);
  },
  advance(amount = 1) {
    this.current = Math.min(this.goal, this.current + amount);
    return { current: this.current, goal: this.goal, complete: this.current >= this.goal };
  },
  render(container) {
    const dots = container?.querySelectorAll('[data-substep]') || [];
    dots.forEach((dot, index) => dot.classList.toggle('done', index < this.current));
  }
};
```

在 `loadStep()` 中调用 `StepProgress.reset(step)`。对重复手势，每次合法滑动只调用一次 `advance()`，达到目标后才调用 `handleStepSuccess()`。保留单次点击和35%拖放的现有通过规则。

- [ ] **Step 4: 测试重复手势不早于目标次数完成**

Run: `node --test tests/new-target-behaviors.test.js tests/continuous-animation.test.js`

Expected: all StepProgress tests PASS; no existing tap/drag threshold regression.

- [ ] **Step 5: 保存本任务**

```bash
git add index.html tests/new-target-behaviors.test.js
git commit -m "增加重复动作子进度"
```

### Task 4: 实现清洗衣服七步场景

**Files:**
- Modify: `index.html:1200-1350, 1419-1705, 1920-2005`
- Modify: `tests/new-target-behaviors.test.js`
- Modify: `tests/continuous-animation.test.js`

**Interfaces:**
- Consumes: `LEVELS[0]`, `STEP_STATE_KEYS.laundry`, `StepProgress` and `assets/laundry/*`.
- Produces: `buildLaundryScene(step): string` and `buildLaundryPersistentState(stepId): string`.

- [ ] **Step 1: 写七个场景、连续状态和示范标记的失败测试**

```js
test('laundry renders seven interactive scenes with delayed demonstrations', () => {
  const { api } = loadRuntime();
  for (let stepId = 1; stepId <= 7; stepId++) {
    const scene = api.buildScene('laundry', api.LEVELS[0].steps[stepId - 1]);
    assert.match(scene, new RegExp(`demo-element demo-laundry-${stepId}`));
    assert.match(scene, /interactive-target/);
    assert.match(scene, /aria-hidden="true"/);
  }
});
```

另断言步骤1是衣服拖到水盆、步骤2是点击水龙头、步骤3是点击洗衣液、步骤4和5各需3次左右揉搓、步骤6在水流区停留2秒、步骤7使用向内拧水手势。

- [ ] **Step 2: 运行定向测试并确认场景未实现**

Run: `node --test tests/new-target-behaviors.test.js --test-name-pattern="laundry"`

Expected: FAIL because `buildScene('laundry', ...)` lacks the seven new markers.

- [ ] **Step 3: 实现洗衣背景、7个场景和7个非交互示范动画**

```js
function buildLaundryScene(step) {
  const sid = step.id;
  // Return one .step-stage with exactly one .interactive-target,
  // one aria-hidden demo-laundry-{sid}, and the current persistent state.
}
```

步骤5的翻面动画自动完成，儿童只负责揉洗。步骤7显示两只手，但只让儿童拖动其中一只大手，另一只由同步动画向反方向移动，避免强制多点触控。

- [ ] **Step 4: 运行洗衣和公共回归测试**

Run: `node --test tests/new-target-behaviors.test.js tests/continuous-animation.test.js`

Expected: laundry scene, continuity, repetition, demonstration and 35% drag tests PASS.

- [ ] **Step 5: 保存本任务**

```bash
git add index.html tests/new-target-behaviors.test.js tests/continuous-animation.test.js
git commit -m "实现清洗衣服七步游戏"
```

### Task 5: 实现折叠衣服七步场景

**Files:**
- Modify: `index.html:1200-1350, 1419-1705, 1920-2005`
- Modify: `tests/new-target-behaviors.test.js`
- Modify: `tests/continuous-animation.test.js`

**Interfaces:**
- Consumes: `LEVELS[1]`, `STEP_STATE_KEYS['fold-clothes']`, `StepProgress` and `assets/folding/*`.
- Produces: `buildClothesFoldingScene(step): string` and `buildClothesFoldingPersistentState(stepId): string`.

- [ ] **Step 1: 写折衣顺序与完整衣物连续性的失败测试**

```js
test('clothes folding keeps one whole sweatshirt through all seven states', () => {
  const { api } = loadRuntime();
  for (let stepId = 1; stepId <= 7; stepId++) {
    const scene = api.buildScene('fold-clothes', api.LEVELS[1].steps[stepId - 1]);
    assert.match(scene, /data-garment="whole-sweatshirt"/);
    assert.match(scene, new RegExp(`demo-fold-clothes-${stepId}`));
  }
});
```

断言顺序为平铺、抚平、折画面左袖、折画面右袖、折画面左侧衣身、折画面右侧衣身、下摆向上折。语音只说“这边”和“另一边”，不依赖儿童分辨左右。

- [ ] **Step 2: 运行定向测试并确认折衣场景未实现**

Run: `node --test tests/new-target-behaviors.test.js --test-name-pattern="clothes folding"`

Expected: FAIL because whole-sweatshirt states are absent.

- [ ] **Step 3: 实现桌面、完整卫衣分层和7个折叠动画**

```js
function buildClothesFoldingScene(step) {
  const persistent = buildClothesFoldingPersistentState(step.id);
  return stepStageHTML(persistent + buildWholeSweatshirtLayers(step), buildFoldGuide(step), 'fold-clothes', step.id);
}
```

卫衣外观始终为同一件，用裁切区域和 CSS `transform-origin` 表现袖子、衣身与下摆折入，不把衣服显示成散落零件。已完成的折叠状态在下一步保留。

- [ ] **Step 4: 运行折衣和公共回归测试**

Run: `node --test tests/new-target-behaviors.test.js tests/continuous-animation.test.js`

Expected: all fold order, whole-garment continuity, demo and target-size tests PASS.

- [ ] **Step 5: 保存本任务**

```bash
git add index.html tests/new-target-behaviors.test.js tests/continuous-animation.test.js
git commit -m "实现折叠衣服七步游戏"
```

### Task 6: 实现收整折叠伞七步场景

**Files:**
- Modify: `index.html:1200-1350, 1419-1705, 1920-2005`
- Modify: `tests/new-target-behaviors.test.js`
- Modify: `tests/continuous-animation.test.js`

**Interfaces:**
- Consumes: `LEVELS[2]`, `STEP_STATE_KEYS['fold-umbrella']`, `StepProgress` and `assets/umbrella/*`.
- Produces: `buildUmbrellaFoldingScene(step): string` and `buildUmbrellaPersistentState(stepId): string`.
- Produces: six `[data-umbrella-panel="1".."6"]` elements and six `[data-substep]` progress stars in step 4.

- [ ] **Step 1: 写伞布逐片整理、卷伞和扣带的失败测试**

```js
test('umbrella step four exposes exactly six sequential panels', () => {
  const { api } = loadRuntime();
  const step = api.LEVELS[2].steps[3];
  const scene = api.buildScene('fold-umbrella', step);
  assert.equal(step.repeatGoal, 6);
  assert.equal((scene.match(/data-umbrella-panel=/g) || []).length, 6);
  assert.equal((scene.match(/data-substep=/g) || []).length, 6);
});

test('umbrella flow ends at a fastened strap and contains no bag action', () => {
  const { api } = loadRuntime();
  const text = JSON.stringify(api.LEVELS[2]);
  assert.match(text, /扣好/);
  assert.doesNotMatch(text, /伞套|书包|收进包/);
});
```

- [ ] **Step 2: 运行定向测试并确认折叠伞场景未实现**

Run: `node --test tests/new-target-behaviors.test.js --test-name-pattern="umbrella"`

Expected: FAIL because six panel elements and final fastened state are absent.

- [ ] **Step 3: 实现六片伞的7个连续状态**

```js
function buildUmbrellaFoldingScene(step) {
  if (step.id === 4) return buildSixPanelSmoothingStage(step);
  return stepStageHTML(buildUmbrellaObject(step), buildUmbrellaGuide(step), 'fold-umbrella', step.id);
}
```

步骤1只拖动加大伞巢向下收拢；步骤2把伞杆推至目标位置；步骤3水平滑动将扣带转到正面；步骤4按固定顺序高亮六片伞布，每片一次向下整理；步骤5将伞片拖向伞杆；步骤6用一次宽松水平滑动触发一圈半的自动缓慢卷伞动画；步骤7将扣带拖到粘扣目标区后自动扣好。

- [ ] **Step 4: 检查步骤4不能跳过任何一片伞布**

Run: `node --test tests/new-target-behaviors.test.js --test-name-pattern="umbrella"`

Expected: five strokes remain incomplete; the sixth valid stroke completes step 4; wrong-direction strokes do not increment progress.

- [ ] **Step 5: 运行折叠伞和公共回归测试**

Run: `node --test tests/new-target-behaviors.test.js tests/continuous-animation.test.js`

Expected: all umbrella continuity, six-panel, roll, strap, demonstration and common gesture tests PASS.

- [ ] **Step 6: 保存本任务**

```bash
git add index.html tests/new-target-behaviors.test.js tests/continuous-animation.test.js
git commit -m "实现折叠伞收整七步游戏"
```

### Task 7: 接通提示、记录与关卡完成流程

**Files:**
- Modify: `index.html:1980-2000, 2129-2495, 2641-3090`
- Modify: `tests/new-target-behaviors.test.js`
- Modify: `tests/continuous-animation.test.js`

**Interfaces:**
- Consumes: new `LEVELS`, `TASK_ANALYSIS`, `StepProgress` and existing `UnifiedDataManager`.
- Produces: `finishCurrentLevel(): void`, the sole level-completion entry point.
- Preserves: prompt levels 0‑4, teaching/practice/assessment behavior and old localStorage records.

- [ ] **Step 1: 写第7步结束、新记录标识和旧数据保留的失败测试**

```js
test('all three new levels can finish without an undefined saveRecord call', () => {
  const { api, elements } = loadRuntime();
  for (let level = 0; level < 3; level++) {
    api.state.currentLevel = level;
    assert.doesNotThrow(() => api.finishCurrentLevel());
    assert.equal(elements['celebration'].classList.contains('active'), true);
  }
});

test('new records use new task ids while old records remain untouched', () => {
  const seed = [{ taskId: 'brush', stepNumber: 1 }];
  localStorage.setItem('researchRecords', JSON.stringify(seed));
  // Complete one laundry step through the real hook.
  const records = JSON.parse(localStorage.getItem('researchRecords'));
  assert.equal(records[0].taskId, 'brush');
  assert.equal(records.at(-1).taskId, 'laundry');
});
```

- [ ] **Step 2: 运行定向测试并确认现有结束路径失败**

Run: `node --test tests/new-target-behaviors.test.js --test-name-pattern="finish|records"`

Expected: FAIL because `finishCurrentLevel` is absent and the old `saveRecord` call is undefined.

- [ ] **Step 3: 用单一结束函数替换未定义调用**

```js
function finishCurrentLevel() {
  const level = LEVELS[state.currentLevel];
  if (UnifiedDataManager.active) UnifiedDataManager.endSession();
  document.getElementById('celebration-title').textContent = `${level.icon} ${level.name}完成啦！`;
  document.getElementById('celebration-sub').textContent = '你真的太厉害了！';
  document.getElementById('celebration').classList.add('active');
  playCelebrationSound();
  spawnCanvasConfetti();
  speak(`太厉害了！你已经学会${level.name}了！`);
}
```

让 `goNextStep()` 在第7步调用 `finishCurrentLevel()`，移除旧的未定义 `saveRecord()` 调用，并确保 `UnifiedDataManager.endSession()` 不会在回首页时重复下载或重复写入。

- [ ] **Step 4: 将重复动作次数和伞布编号写入事件记录**

```js
UnifiedDataManager.logEvent('substep_complete', {
  substepIndex: StepProgress.current,
  substepGoal: StepProgress.goal,
  panelNumber: step.target === 'umbrella-panel' ? StepProgress.current : null
});
```

- [ ] **Step 5: 运行数据、提示和结束流程测试**

Run: `node --test tests/new-target-behaviors.test.js tests/continuous-animation.test.js`

Expected: no `saveRecord is not defined`; one session end per level; old records retained; new task IDs and substep events correct.

- [ ] **Step 6: 保存本任务**

```bash
git add index.html tests/new-target-behaviors.test.js tests/continuous-animation.test.js
git commit -m "修复关卡完成并更新干预记录"
```

### Task 8: 更新项目文档并清理已无引用的旧素材

**Files:**
- Modify: `docs/requirements.md`
- Modify: `docs/design-spec.md`
- Modify: `docs/implementation-plan.md`
- Modify: `dev-logs/2026-09-14.md`
- Delete only if unreferenced: root-level legacy PNG/JPG assets replaced by `assets/laundry/`, `assets/folding/`, and `assets/umbrella/`

**Interfaces:**
- Consumes: completed new levels and final asset paths.
- Produces: documentation that matches the running page and an auditable unused-asset list.

- [ ] **Step 1: 搜索所有旧任务词和旧图片引用**

Run:

```bash
rg -n "刷牙|洗脸|穿衣|bathroom-bg|brush-boy|cartoon-boy|toothbrush|toothpaste|towel" index.html tests docs dev-logs
```

Expected: runtime files contain no old level names or old image references; historical specs, plans and logs may retain their original record.

- [ ] **Step 2: 计算图片哈希并列出精确重复项**

Run:

```bash
find . -type f \( -name '*.png' -o -name '*.jpg' \) -print0 | xargs -0 shasum -a 256 | sort
```

Expected: only identical SHA-256 values count as exact duplicates. 先核对引用，再删除多余副本。

- [ ] **Step 3: 删除确认未引用的旧运行素材**

```bash
git rm -- <each-explicitly-verified-unreferenced-asset>
```

不使用递归删除或通配符；每个文件在命令中显式列出。保留 `/Users/labaicaimac/Desktop/游戏风格.jpg` 参考图和历史文档。

- [ ] **Step 4: 更新三份项目文档和当日日志**

文档必须准确列出新三关、21步、新图片目录、卡通风格、重复动作规则、六片伞布完成条件与研究记录字段。

- [ ] **Step 5: 确认新网页不引用不存在的素材**

Run: `node --test tests/new-target-behaviors.test.js`

Expected: required assets exist, all `src` paths resolve, runtime has no old asset references.

- [ ] **Step 6: 保存本任务**

```bash
git add docs dev-logs/2026-09-14.md tests/new-target-behaviors.test.js
git commit -m "更新新干预任务文档与素材"
```

### Task 9: 完成全流程验证与上线

**Files:**
- Modify if verification finds scoped defects: `index.html`, `tests/new-target-behaviors.test.js`, `tests/continuous-animation.test.js`
- Modify: `dev-logs/2026-09-14.md`

**Interfaces:**
- Consumes: all three implemented levels and all local assets.
- Produces: test evidence for 21 steps, desktop browser, iPad Safari and the published GitHub Pages page.

- [ ] **Step 1: 运行全部自动检查**

Run:

```bash
node --test tests/new-target-behaviors.test.js tests/continuous-animation.test.js
```

Expected: all tests PASS, exit code 0.

- [ ] **Step 2: 启动本地预览**

Run: `python3 -m http.server 8080`

Expected: `http://localhost:8080` returns the new cartoon home screen without console errors.

- [ ] **Step 3: 桌面浏览器逐步走通21个步骤**

对每关7步逐项操作，确认语音、示范、箭头、目标区、正向奖励、下一步按钮和关卡完成弹窗均正常。特别确认洗衣步骤4/5各需3次揉搓，折叠伞步骤4需完成六片伞布。

- [ ] **Step 4: 在研究模式中验证三种训练模式**

教学模式确认提示逐级增加；练习模式确认从视觉提示开始；评估模式确认不播放示范动画。完成后检查新记录的 `taskId`、`stepNumber`、`promptLevel`、`responseTimeMs`、`errors` 和 `substep_complete` 事件。

- [ ] **Step 5: 在 iPad Safari 进行真机检查**

用 `http://10.70.176.223:8080` 打开页面，检查横屏和竖屏、触控目标大小、拖放命中、页面无意外缩放、女声语速和每关结束弹窗。

- [ ] **Step 6: 记录验证结果并保存**

```bash
git add index.html tests docs dev-logs/2026-09-14.md
git commit -m "完成三项新干预游戏验证"
```

- [ ] **Step 7: 上传并检查线上页面**

Run: `git push origin main`

Expected: push succeeds. 等待 GitHub Pages 更新后，在 `https://labaicai-2004.github.io/life-skills-game/` 重复首页、三关入口、每关第1步与第7步的检查，并确认没有缺图或旧内容。
