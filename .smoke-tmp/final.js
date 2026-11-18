const puppeteer = require('../node_modules/puppeteer');
(async () => {
  const browser = await puppeteer.launch({headless:'new',args:['--no-sandbox','--enable-webgl','--ignore-gpu-blocklist','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-gpu-sandbox']});
  const page = await browser.newPage();
  await page.setViewport({width:1440,height:900});
  await page.evaluateOnNewDocument(()=>{localStorage.setItem('pixelstaging-welcome-seen','1');localStorage.setItem('pixelstaging-tutorial-seen','1');});
  await page.goto('http://127.0.0.1:8137/index.html',{waitUntil:'networkidle0',timeout:60000});
  await page.waitForFunction('window.app && window.app.camera',{timeout:30000});
  const result = await page.evaluate(()=>{
    const app=window.app; const floor=app.objects.find(o=>o.userData?.staging?.presetId==='floor');
    const before=floor.material.emissive.getHex(); app.applyHoverHighlight(floor); const floorUnchanged=floor.material.emissive.getHex()===before; app.restoreObjectColor(floor);
    const front=app.factory.createShape('box'); front.position.set(20,1,0);
    const back=app.factory.createShape('box'); back.position.set(20,1,-3);
    app.addToScene(front); app.addToScene(back);
    app.camera.position.set(20,1,8); app.camera.up.set(0,1,0); app.camera.lookAt(20,1,0); app.camera.updateMatrixWorld(true); app.scene.updateMatrixWorld(true);
    const r=app.renderer.domElement.getBoundingClientRect(); const ev={clientX:r.left+r.width/2,clientY:r.top+r.height/2};
    app.selectObject(front);
    const meta=app.pickSelectableRoot({...ev,metaKey:true}); const ctrl=app.pickSelectableRoot({...ev,ctrlKey:true});
    return {floorUnchanged,meta:meta===back,ctrl:ctrl===back,shortcutRows:[...document.querySelectorAll('#shortcuts-tools .shortcut-key')].map(e=>e.textContent).filter(t=>t.includes('Click'))};
  });
  console.log(JSON.stringify(result,null,2));
  await browser.close();
  if(!result.floorUnchanged||!result.meta||!result.ctrl) process.exit(2);
})();
