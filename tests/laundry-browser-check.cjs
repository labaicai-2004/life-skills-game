const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const url = require('node:url').pathToFileURL(require('node:path').join(__dirname, '..', 'index.html')).href;
(async () => {
 const browser = await chromium.launch({headless:true,channel:'chrome'});
 try {
  const page = await browser.newPage({viewport:{width:1024,height:768}});
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);
  await page.evaluate(()=>{promptState.enabled=false; state.muted=true; startLevel(0);});
  for(let id=1;id<=7;id++) {
   await page.waitForTimeout(id===7?2600:1100);
   const item=page.locator('.step-stage .interactive-target');
   assert.equal(await item.count(),1);
   const box=await item.boundingBox(); assert.ok(box.width>=44&&box.height>=44);
   const guide=await page.locator('.laundry-guide').boundingBox();
   assert.ok(box.x+box.width<=guide.x || box.x>=guide.x+guide.width || box.y+box.height<=guide.y || box.y>=guide.y+guide.height, `step ${id} guide must not obscure the target`);
   await page.screenshot({path:`/private/tmp/task4-resume-step${id}.png`});
   const center={x:box.x+box.width/2,y:box.y+box.height/2};
   if(id===2||id===3) await page.mouse.click(center.x,center.y);
   else if(id===1||id===6) {
    const dest=await page.locator('.step-stage .drag-target').boundingBox();
    await page.mouse.move(center.x,center.y); await page.mouse.down();
    await page.mouse.move(dest.x+dest.width/2,dest.y+dest.height/2,{steps:12});
    await page.mouse.up();
    if(id===6) assert.equal(await page.evaluate(()=>state.stepCompleted.has(5)),false);
   } else {
    for(let n=0;n<(id===7?1:3);n++) {
     await page.mouse.move(center.x,center.y); await page.mouse.down();
     await page.mouse.move(center.x+60,center.y,{steps:6});
     if(id===7) {
      const result=await page.locator('.laundry-partner-hand:not(.demo-element)').evaluate(el=>({actual:new DOMMatrix(getComputedStyle(el).transform).m41,expected:new DOMMatrix(el.style.transform).m41}));
      assert.equal(result.actual,result.expected,'partner must follow real hand after demonstration');
     }
     await page.mouse.up(); await page.waitForTimeout(350);
    }
   }
   await page.waitForTimeout(id===6?2100:1300);
   assert.equal(await page.evaluate(index=>state.stepCompleted.has(index),id-1),true,`step ${id} incomplete`);
   if(id===6) assert.equal(await page.locator('.laundry-bubbles').evaluate(el=>getComputedStyle(el).opacity),'0','rinse completion must keep bubbles cleared');
   console.log(`Step ${id}: PASS; target ${Math.round(box.width)} x ${Math.round(box.height)}`);
   if(id<7) await page.locator('#next-step-btn').click();
  }
  assert.deepEqual(errors,[]);
  await page.screenshot({path:'/private/tmp/task4-resume-final.png'});
  console.log('Seven-step browser flow, rinse result and post-demo partner hand: PASS; no page errors.');
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1)});
