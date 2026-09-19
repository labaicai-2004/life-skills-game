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
  const classes = new Set();
  return {
    classList: { add(...names) { names.forEach(n=>classes.add(n)); }, remove(...names) { names.forEach(n=>classes.delete(n)); }, contains(n) { return classes.has(n); }, toggle(n,on) { on?classes.add(n):classes.delete(n); } },
    insertAdjacentHTML(position,markup) { this.insertedHTML = (this.insertedHTML || '') + markup; },
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
    createElement() { const wrapper=createElement(); wrapper.firstElementChild=createElement(); return wrapper; },
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

function foldingGesture(stepId, kind = 'mouse', width = 750, height = 380) {
  const runtime = loadRuntime();
  const { api } = runtime;
  const listeners = new Map();
  const stage = createElement(), item = createElement(), target = createElement(), area = createElement();
  const geometry = api.FOLD_LAYOUT[stepId];
  const touchCSS=fs.readFileSync(path.join(ROOT,'index.html'),'utf8').match(/\.folding-touch \{([^}]+)\}/)[1];
  const px = (value, size) => {
    const calc=value.match(/^calc\(([\d.]+)% ([+-]) ([\d.]+)px\)$/);
    return calc ? Number(calc[1])/100*size+(calc[2]==='+'?1:-1)*Number(calc[3]) : value.endsWith('%') ? Number.parseFloat(value)/100*size : Number.parseFloat(value);
  };
  const rect = (box, width, height) => {
    const minimum=box===geometry.item && stepId>1;
    const itemWidth = Math.max(px(box.width, width),minimum?Number(touchCSS.match(/min-width:(\d+)px/)[1]):0);
    const itemHeight = Math.max(px(box.height, height),minimum?Number(touchCSS.match(/min-height:(\d+)px/)[1]):0);
    const left = box.left ? px(box.left, width) : width - px(box.right, width) - itemWidth;
    return { left, top:px(box.top, height), right:left + itemWidth, bottom:px(box.top, height) + itemHeight, width:itemWidth, height:itemHeight };
  };
  const initial = rect(geometry.item, width, height), destination = rect(geometry.target, width, height);
  item.offsetWidth = initial.width; item.offsetHeight = initial.height;
  item.style.left = initial.left + 'px'; item.style.top = initial.top + 'px';
  item.getBoundingClientRect = () => {
    const left = parseFloat(item.style.left) || 0, top = parseFloat(item.style.top) || 0;
    return { left, top, right:left + initial.width, bottom:top + initial.height, width:initial.width, height:initial.height };
  };
  target.getBoundingClientRect = () => destination;
  area.getBoundingClientRect = () => ({ left:0, top:0, right:width, bottom:height, width, height });
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
  return { ...runtime, item, stage, target:destination, dispatch, complete: () => api.state.stepCompleted.has(stepId - 1) };
}

test('folding hit boxes overlap the visible sleeve and body on wide and narrow screens', () => {
  const css=fs.readFileSync(path.join(ROOT,'index.html'),'utf8').match(/\.folding-garment \{([^}]+)\}/)[1];
  const garmentWidth=Number(css.match(/width:(\d+)px/)[1]);
  const garmentLeftPercent=Number(css.match(/left:([\d.]+)%/)[1])/100;
  const garmentTopPercent=Number(css.match(/top:([\d.]+)%/)[1])/100;
  for(const [width,height] of [[750,380],[360,600]]) for(const step of [3,4,5,6]) {
    const r=foldingGesture(step,'mouse',width,height), hit=r.item.getBoundingClientRect();
    const garmentLeft=width*garmentLeftPercent-garmentWidth/2, garmentTop=height*garmentTopPercent;
    // Independently inspected artwork: sleeves occupy outer quarters, body middle half.
    const [left,right]=({3:[10,75],4:[225,290],5:[75,130],6:[170,225]})[step];
    assert.ok(hit.left>=garmentLeft+left-5 && hit.right<=garmentLeft+right+5,`step ${step}, width ${width}: hit must lie over its visible cloth`);
    assert.ok(hit.top>=garmentTop+85 && hit.bottom<=garmentTop+235);
    assert.ok(hit.width>=44 && hit.height>=44);
    const overlap=Math.max(0,Math.min(hit.right,r.target.right)-Math.max(hit.left,r.target.left));
    assert.equal(overlap,0,'start and destination are separated');
  }
});

test('folding successful drags update the current scene and final picture immediately', () => {
  for(const [step,name] of [[3,'left-sleeve'],[4,'right-sleeve'],[5,'left-body'],[6,'right-body'],[7,'hem-up']]) {
    const r=foldingGesture(step),a=r.item.getBoundingClientRect(),b=r.target;
    r.dispatch('start',a.left+a.width/2,a.top+a.height/2);
    r.dispatch('move',b.left+b.width/2,b.top+b.height/2);
    r.dispatch('end',b.left+b.width/2,b.top+b.height/2);
    assert.equal(r.complete(),true);
    assert.match(r.stage.insertedHTML || '',new RegExp(`state-fold-${name}`));
    assert.equal(r.item.style.opacity,'0','completed handle is removed from the garment');
    if(step===7) assert.equal(r.spoken.at(-1).text,'衣服叠得真整齐');
  }
});

test('completed fold contours shrink on each side and final artwork replaces all flat layers', () => {
  const css=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
  const names=['left-sleeve','right-sleeve','left-body','right-body'];
  let previous=301;
  for(const name of names) {
    const rule=css.match(new RegExp(`\\.state-fold-${name} ~ \\.folding-garment \\{([^}]+)\\}`));
    assert.ok(rule,`${name} must clip the entire garment, including the original silhouette`);
    const inset=rule[1].match(/clip-path:inset\(0 ([\d.]+)% 0 ([\d.]+)%\)/);
    assert.ok(inset);
    const visibleWidth=300*(1-(Number(inset[1])+Number(inset[2]))/100);
    assert.ok(visibleWidth<previous); previous=visibleWidth;
  }
  assert.match(css,/state-fold-hem-up ~ \.folding-garment \.folding-layer:not\(\.folding-final\)[^{]*\{[^}]*opacity:0/);
});

function umbrellaPanelMarkup(api) {
  const scene=api.buildScene('fold-umbrella',api.LEVELS[2].steps[3]);
  return [...scene.matchAll(/<div class="umbrella-panel ([^"]*)" data-umbrella-panel="(\d+)" style="([^"]*)"><svg viewBox="([^"]*)"[^>]*>([\s\S]*?)<\/svg><\/div>/g)].map(match=>({
    number:Number(match[2]), style:Object.fromEntries([...match[3].matchAll(/([\w-]+):([\d.]+)px/g)].map(([,key,value])=>[key,Number(value)])),
    viewBox:match[4].split(' ').map(Number),svg:match[5]
  }));
}

for (const kind of ['mouse','touch']) {
  test(`laundry ${kind} retry records an error but cancellation does not`, () => {
    const r=laundryGesture(4,kind);
    r.api.UnifiedDataManager.startSession('laundry');
    r.api.UnifiedDataManager.onStepStart();
    r.dispatch('start',50,50); r.dispatch('move',50,100); r.dispatch('cancel',50,100);
    assert.equal(r.api.UnifiedDataManager._stepErrors,0);
    r.dispatch('start',50,50); r.dispatch('move',50,100); r.dispatch('end',50,100);
    assert.equal(r.api.UnifiedDataManager._stepErrors,1);
    for(let i=0;i<3;i++) { r.dispatch('start',50,50); r.dispatch('move',110,50); r.dispatch('end',110,50); }
    assert.equal(r.complete(),true);
    assert.equal(r.api.UnifiedDataManager.events.filter(e=>e.event==='step_error').length,1);
    assert.equal(r.api.UnifiedDataManager._sessionRecords[0].errors,1);
  });
  test(`umbrella ${kind} retry records an error but cancellation does not`, () => {
    const r=umbrellaGesture(3,kind);
    r.api.UnifiedDataManager.startSession('fold-umbrella');
    r.api.UnifiedDataManager.onStepStart();
    r.dispatch('start',180,120);r.dispatch('move',180,180);r.dispatch('cancel',180,180);
    assert.equal(r.api.UnifiedDataManager._stepErrors,0);
    r.stroke(180,120,0,60);
    assert.equal(r.api.UnifiedDataManager._stepErrors,1);
    r.stroke(180,120,60,0);r.advance(600);
    assert.equal(r.complete(),true);
    assert.equal(r.api.UnifiedDataManager.events.filter(e=>e.event==='step_error').length,1);
    assert.equal(r.api.UnifiedDataManager._sessionRecords[0].errors,1);
  });
}

function umbrellaGesture(stepId, kind = 'mouse') {
  const runtime = loadRuntime(), { api } = runtime, listeners = new Map();
  const box = (left, top, width, height) => ({ left, top, width, height, right:left + width, bottom:top + height });
  const node = (rect) => {
    const element = createElement(), classes = new Set();
    element.classList = { add(...names) { names.forEach(name => classes.add(name)); }, remove(...names) { names.forEach(name => classes.delete(name)); }, contains(name) { return classes.has(name); }, toggle(name, on) { on ? classes.add(name) : classes.delete(name); } };
    element.style.left = rect.left + 'px'; element.style.top = rect.top + 'px';
    element.getBoundingClientRect = () => box(parseFloat(element.style.left), parseFloat(element.style.top), rect.width, rect.height);
    return element;
  };
  const starts = [[154,162,52,52],[154,254,64,60],[145,90,90,100],[24,60,52,144],[24,76,70,140],[146,80,74,128],[218,124,76,48]];
  const targets = [[154,242,64,60],[154,194,64,60],[145,90,90,100],[24,60,52,144],[145,76,70,140],[146,80,74,128],[146,124,76,48]];
  const stage = node(box(0,0,360,320)), item = node(box(...starts[stepId - 1])), target = node(box(...targets[stepId - 1]));
  const panels = umbrellaPanelMarkup(api).map(({number,style}) => { const panel = node(box(style.left,style.top??60,style.width??52,style.height??144)); panel.dataset.umbrellaPanel = String(number); return panel; });
  const dots = Array.from({length:6}, () => node(box(0,0,20,20)));
  const demo=node(box(0,0,64,64));
  const demoStyle=api.buildScene('fold-umbrella',api.LEVELS[2].steps[stepId-1]).match(/class="demo-element demo-umbrella-\d demo-ghost umbrella-demo" style="([^"]+)"/)[1];
  for(const [,key,value] of demoStyle.matchAll(/([\w-]+):(-?[\d.]+)px/g)) demo.style[key]=value+'px';
  const area = node(box(0,0,750,380));
  area.querySelector = selector => ({'.step-stage':stage,'.interactive-target':item,'.draggable-item':item,'.drag-target':[1,2,5,7].includes(stepId)?target:null,'.umbrella-object':stage,'.umbrella-demo':demo,'[data-gesture-target]':target})[selector] || null;
  area.querySelectorAll = selector => selector === '[data-umbrella-panel]' ? panels : selector === '[data-substep]' ? dots : [];
  stage.querySelector = area.querySelector; stage.querySelectorAll = area.querySelectorAll;
  area.addEventListener = (type, callback, options) => { listeners.set(type, callback); options?.signal?.addEventListener('abort', () => listeners.delete(type)); };
  api.state.currentLevel = 2; api.state.currentStep = stepId - 1;
  api.StepProgress.reset(api.LEVELS[2].steps[stepId - 1]);
  api.attachGestureListeners(api.LEVELS[2].steps[stepId - 1], area);
  const dispatch = (phase,x,y) => {
    const type = kind === 'mouse' ? {start:'mousedown',move:'mousemove',end:'mouseup',cancel:'mouseleave'}[phase] : {start:'touchstart',move:'touchmove',end:'touchend',cancel:'touchcancel'}[phase];
    listeners.get(type)?.({clientX:x,clientY:y,touches:[{clientX:x,clientY:y}],changedTouches:[{clientX:x,clientY:y}],preventDefault(){}});
  };
  return {...runtime, stage,item,target,panels,dots,demo,dispatch,stroke(x,y,dx,dy) { dispatch('start',x,y);dispatch('move',x+dx,y+dy);dispatch('end',x+dx,y+dy); },complete:()=>api.state.stepCompleted.has(stepId-1)};
}

test('umbrella scenes retain one complete local umbrella with seven passive demos and six panels', () => {
  const { api } = loadRuntime();
  for (let id=1;id<=7;id++) {
    const scene = api.buildScene('fold-umbrella', api.LEVELS[2].steps[id-1]);
    assert.equal((scene.match(/data-umbrella="whole"/g)||[]).length,1);
    assert.match(scene,new RegExp(`demo-element demo-umbrella-${id}`));
    assert.match(scene,/assets\/umbrella\/umbrella-/);
    assert.equal((scene.match(/interactive-target/g)||[]).length,1);
    assert.doesNotMatch(scene,/class="[^"]*interactive-target[^"]*demo-element/);
  }
  const scene=api.buildScene('fold-umbrella',api.LEVELS[2].steps[3]);
  assert.equal((scene.match(/data-umbrella-panel=/g)||[]).length,6);
  assert.equal((scene.match(/data-substep/g)||[]).length,6);
  assert.doesNotMatch(JSON.stringify(api.LEVELS[2]),/伞套|书包|收进包/);
});

test('umbrella visible panel cloth fills exactly its hit box and rib crease and arrow stay inside it', () => {
  const {api}=loadRuntime();
  const panels=umbrellaPanelMarkup(api);
  assert.equal(panels.length,6);
  for(const panel of panels) {
    const cloth=panel.svg.match(/<rect class="panel-cloth" x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/);
    assert.ok(cloth,'the visible cloth must fill the same rectangle used for pointer hit testing');
    assert.deepEqual(cloth.slice(1).map(Number),[0,0,panel.style.width,panel.style.height]);
    assert.ok(panel.style.width>=44 && panel.style.height>=44);
    assert.deepEqual(panel.viewBox,[0,0,panel.style.width,panel.style.height]);
    assert.match(panel.svg,/<path class="panel-rib" d="M26 8 V132"/);
    assert.match(panel.svg,/<path class="panel-crease" d="M15 38 L35 56 L16 85 L34 115"/);
  }
  const source=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
  const arrow=Object.fromEntries([...source.match(/\.umbrella-panel\.active::after\s*\{([^}]+)\}/)[1].matchAll(/(left|top|width|height):([\d.]+)px/g)].map(([,key,value])=>[key,Number(value)]));
  assert.ok(arrow.left>=0 && arrow.left+arrow.width<=52);
  assert.ok(arrow.top>=0 && arrow.top+arrow.height+25<=144);
});

test('umbrella shaft scene shows a passive upper stabilizing hand and one moving lower hand', () => {
  const {api}=loadRuntime();
  const scene=api.buildScene('fold-umbrella',api.LEVELS[2].steps[1]);
  assert.match(scene,/<div class="umbrella-stabilizing-hand" aria-hidden="true"><svg/);
  assert.doesNotMatch(scene,/<div class="umbrella-stabilizing-hand[^\"]*(interactive-target|draggable-item)/);
  assert.match(scene,/<div class="umbrella-touch interactive-target draggable-item" data-item="umbrella-shaft"[^>]*><svg/);
  assert.equal((scene.match(/interactive-target/g)||[]).length,1);
});

for (const kind of ['mouse','touch']) {
  test(`umbrella ${kind} follows real visible panel rectangles and rejects blank space`, () => {
    const r=umbrellaGesture(4,kind),panels=umbrellaPanelMarkup(r.api);
    for(const [index,panel] of panels.entries()) {
      assert.equal(parseFloat(r.demo.style.left)+32,panel.style.left+26,'hand stays centered on the currently highlighted cloth');
      assert.ok(parseFloat(r.demo.style.top)>=panel.style.top);
      assert.ok(parseFloat(r.demo.style.top)+64+parseFloat(r.demo.style['--umbrella-demo-y'])<=panel.style.top+panel.style.height,'entire demonstration stroke stays over cloth');
      const cloth=panel.svg.match(/<rect class="panel-cloth" x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/);
      assert.ok(cloth,'test gestures must start on actual rendered cloth');
      const [x,y,w]=cloth.slice(1).map(Number);
      r.stroke(panel.style.left-1,panel.style.top+y+10,0,60);
      r.stroke(panel.style.left+x+w/2,panel.style.top-1,0,60);
      assert.equal(r.api.StepProgress.current,index,'blank space cannot count');
      r.stroke(panel.style.left+x+w/2,panel.style.top+y+10,0,60);
      assert.equal(r.api.StepProgress.current,index+1,'visible vertical rib path counts');
    }
    assert.equal(r.complete(),true);
  });
  test(`umbrella ${kind} only the current panel accepts one downward stroke and six are required`, () => {
    const r=umbrellaGesture(4,kind);
    assert.equal(r.panels.filter(p=>p.classList.contains('active')).length,1);
    r.stroke(102,90,0,60); r.stroke(50,90,0,-60); r.stroke(50,90,60,0); r.stroke(50,90,0,39);
    assert.equal(r.api.StepProgress.current,0);
    for(let i=0;i<6;i++) {
      r.stroke(50+52*i,90,0,60);
      assert.equal(r.api.StepProgress.current,i+1);
      assert.equal(r.complete(),i===5);
      assert.equal(r.dots.filter(d=>d.classList.contains('done')).length,i+1);
      assert.equal(r.panels.filter(p=>p.classList.contains('active')).length,i===5?0:1);
      if(i===0) { r.stroke(50,90,0,60); assert.equal(r.api.StepProgress.current,1); }
    }
  });
  test(`umbrella ${kind} slider shaft and gathering require correct direction and a target drop`, () => {
    for(const [id,x,y,dx,dy] of [[1,180,180,0,80],[2,180,280,0,-60],[5,50,110,121,0]]) {
      const r=umbrellaGesture(id,kind);
      r.stroke(x,y,0,0);r.stroke(x,y,-dx,-dy); assert.equal(r.complete(),false);
      r.stroke(x,y,dx,dy); assert.equal(r.complete(),true,`step ${id}`);
    }
  });
  test(`umbrella ${kind} rotation starts on umbrella and roll completes only after 1500ms`, () => {
    const turn=umbrellaGesture(3,kind);
    turn.stroke(10,10,60,0);turn.stroke(180,110,0,60);assert.equal(turn.complete(),false);
    turn.stroke(180,110,60,0);assert.equal(turn.complete(),false);turn.advance(600);assert.equal(turn.complete(),true);
    const roll=umbrellaGesture(6,kind);
    roll.stroke(180,110,-60,0);roll.stroke(180,110,39,0);assert.equal(roll.complete(),false);
    roll.stroke(180,110,60,0);assert.equal(roll.stage.classList.contains('umbrella-rolling'),true);
    roll.advance(1499);assert.equal(roll.complete(),false);roll.advance(1);assert.equal(roll.complete(),true);
  });
  test(`umbrella ${kind} strap needs 35 percent overlap and locks only on success`, () => {
    for(const [dx,expected] of [[-49.1,false],[-49.2,true]]) {
      const r=umbrellaGesture(7,kind);
      r.stroke(240,145,dx,24);assert.equal(r.complete(),expected);
      assert.equal(r.stage.classList.contains('umbrella-complete'),expected);
      if(expected) assert.equal(r.spoken.at(-1).text,'雨伞整理得真整齐');
    }
  });
  test(`umbrella ${kind} cancel and aborted roll never complete a step`, () => {
    const r=umbrellaGesture(4,kind);
    r.dispatch('start',50,90);r.dispatch('move',50,150);r.dispatch('cancel',50,150);r.dispatch('end',50,150);
    assert.equal(r.api.StepProgress.current,0);
    const roll=umbrellaGesture(6,kind);roll.stroke(180,110,60,0);roll.api.state.stepAbortController.abort();roll.advance(2000);
    assert.equal(roll.complete(),false);
  });
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

test('three live scene builders and static page images use existing new artwork only', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const legacyAssets = [
    'bathroom-bg.png', 'brush-boy.png', 'cartoon-bathroom-sample.png', 'cartoon-boy.png',
    'cartoon-home-sample.png', 'cartoon-toothbrush-sample.png', 'child-photo.jpg', 'cup.png',
    'hand.png', 'sink-faucet.png', 'toothbrush.png', 'toothpaste-original.png', 'toothpaste.png', 'towel.png'
  ];
  for (const asset of legacyAssets) assert.doesNotMatch(html, new RegExp(asset.replace('.', '\\.'), 'g'));
  const { api } = loadRuntime();
  const sceneMarkup = api.LEVELS.flatMap(level => level.steps.map(step => api.buildScene(level.id, step))).join('');
  const sources = [
    ...html.matchAll(/\bsrc\s*=\s*["']([^"'$]+\.(?:png|jpg))(?:\?[^"']*)?["']/gi),
    ...sceneMarkup.matchAll(/\bsrc\s*=\s*["']([^"']+\.(?:png|jpg))(?:\?[^"']*)?["']/gi)
  ].map(([, source]) => source);
  assert.ok(sources.length > 0, 'the page and three scene builders must expose image sources');
  for (const source of sources) {
    assert.equal(fs.existsSync(path.join(ROOT, source)), true, `${source} must exist`);
    assert.match(source, /^assets\/(?:laundry|folding|umbrella)\//, `${source} must use a new asset directory`);
  }
  for (const background of BACKGROUND_ASSETS) assert.match(html, new RegExp(background.replaceAll('.', '\\.')));
});

test('buildScene routes only the three approved intervention levels', () => {
  const { api } = loadRuntime();
  for (const level of api.LEVELS) assert.match(api.buildScene(level.id, level.steps[0]), /step-stage/);
  assert.equal(api.buildScene('brush', { id: 1 }), '');
  assert.equal(api.buildScene('wash', { id: 1 }), '');
  assert.equal(api.buildScene('dress', { id: 1 }), '');
});

test('retired scene builders and deleted image factories are absent from runtime source', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  for (const name of ['svgToothbrush', 'sampleToothbrush', 'sinkFaucetImg', 'svgCup', 'svgFace', 'svgTowel', 'svgJacket']) {
    assert.doesNotMatch(html, new RegExp(`function ${name}\\b`));
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

test('offering a demonstration never completes repeated actions or writes success', () => {
  for (const [levelIndex, stepIndex, goal] of [[0, 3, 3], [2, 3, 6]]) {
    const { api } = loadRuntime();
    api.state.currentLevel = levelIndex;
    api.state.currentStep = stepIndex;
    api.StepProgress.reset(api.LEVELS[levelIndex].steps[stepIndex]);
    api.applyPromptLevel(api.PROMPT_LEVELS.DEMONSTRATION.level);
    assert.equal(api.StepProgress.current, 0);
    assert.equal(api.StepProgress.goal, goal);
    assert.equal(api.UnifiedDataManager.events.filter(event => event.event === 'step_success' || event.event === 'substep_complete').length, 0);
  }
});

test('real repeated strokes record each completed substep without recording rejected strokes', () => {
  const rejected = umbrellaGesture(4);
  rejected.stroke(102, 90, 0, 60);
  assert.equal(rejected.api.UnifiedDataManager.events.filter(event => event.event === 'substep_complete').length, 0);

  const laundry = laundryGesture(4);
  for (let index = 0; index < 3; index++) {
    laundry.dispatch('start', 50, 50);
    laundry.dispatch('move', 110, 50);
    laundry.dispatch('end', 110, 50);
  }
  assert.deepEqual(
    JSON.parse(JSON.stringify(laundry.api.UnifiedDataManager.events.filter(event => event.event === 'substep_complete').map(event => [event.substepIndex, event.substepGoal, event.panelNumber]))),
    [[1, 3, null], [2, 3, null], [3, 3, null]]
  );

  const umbrella = umbrellaGesture(4);
  for (let index = 0; index < 6; index++) umbrella.stroke(50 + 52 * index, 90, 0, 60);
  assert.deepEqual(
    JSON.parse(JSON.stringify(umbrella.api.UnifiedDataManager.events.filter(event => event.event === 'substep_complete').map(event => [event.substepIndex, event.substepGoal, event.panelNumber]))),
    [[1, 6, 1], [2, 6, 2], [3, 6, 3], [4, 6, 4], [5, 6, 5], [6, 6, 6]]
  );
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
