"""Isolated Chromium QA of the exact compiled GENEAI viewport controller.
No credentials, genealogy records or external services are used.
"""
from pathlib import Path
import json, os, shutil, subprocess, sys, tempfile
from playwright.sync_api import sync_playwright
BASE=Path(__file__).resolve().parents[1]
compiler = BASE / "node_modules/.bin/tsc"
compiler = str(compiler) if compiler.exists() else shutil.which("tsc")
if not compiler:
 raise SystemExit("TypeScript not found. Run npm ci first.")
with tempfile.TemporaryDirectory(prefix="geneai-viewport-") as temp:
 subprocess.run([compiler, "--target", "ES2020", "--module", "ES2020", "--lib", "ES2020,DOM", "--strict", "--outDir", temp, str(BASE / "src/components/tree/treeViewport.ts")], check=True)
 JS=(Path(temp)/"treeViewport.js").read_text()
OUTPUT=Path(os.environ.get("TREE_QA_OUTPUT", str(Path(tempfile.gettempdir()) / "geneai-tree-viewport-qa")))
OUTPUT.mkdir(parents=True, exist_ok=True)
HTML='''<meta name="viewport" content="width=device-width,initial-scale=1"><style>
body{margin:0} #workspace{position:relative;width:400px;height:700px;overflow:hidden}
#surface{position:absolute;inset:60px 0;overflow:hidden;touch-action:none;user-select:none;overscroll-behavior:none}
#canvas{position:absolute;left:50%;top:50%;width:1700px;height:900px;transform-origin:center;transform:translate3d(calc(-50% + var(--tree-x,0px)),calc(-50% + var(--tree-y,0px)),0) scale(var(--tree-scale,.88));will-change:transform}
#person{position:absolute;left:825px;top:425px;width:50px;height:50px;background:#ddd}
#person button{width:50px;height:50px} #toolbar{position:absolute;top:0;left:0;z-index:20;height:50px;background:white}
</style><div id="workspace"><div id="toolbar"><button id="zoom">+</button><input id="search"/></div>
<div id="surface" tabindex="0"><div id="canvas"><article id="person"><button id="select">Persona</button></article></div></div></div>'''
results=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'),headless=True)
 version=browser.version
 ctx=browser.new_context(viewport={'width':400,'height':800},is_mobile=True,has_touch=True,reduced_motion='reduce')
 page=ctx.new_page(); errors=[]; page.on('pageerror', lambda e:errors.append(str(e)))
 def setup(reduced=True):
  global page
  page.close(); page=ctx.new_page(); page.on('pageerror', lambda e:errors.append(str(e)))
  page.emulate_media(reduced_motion='reduce' if reduced else 'no-preference')
  page.set_content(HTML)
  page.add_script_tag(type='module',content=JS+'''
   window.v=createTreeViewport(); window.mathCamera=anchoredCamera;
   window.detach=v.attach(document.querySelector('#surface'));
   window.published=0; v.subscribe(()=>window.published++);
   window.selected=0; document.querySelector('#select').onclick=()=>window.selected++;
   document.querySelector('#zoom').onclick=()=>v.zoomIn();
   window.send=(type,id,x,y,target='#surface',pointerType='touch')=>document.querySelector(target).dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:id,clientX:x,clientY:y,pointerType,button:0}));
   window.ready=true;
  ''')
  page.wait_for_function('window.ready && window.v'); page.wait_for_timeout(60)
 def c(): return page.evaluate('v.getCamera()')
 def close(a,b,tol=.001): assert abs(a-b)<tol, (a,b)
 def send(t,id,x,y,target='#surface',pt='touch'):
  page.evaluate('(a)=>send(...a)',[t,id,x,y,target,pt])
 def tap(x,y):
  send('pointerdown',1,x,y); send('pointerup',1,x,y)
 def test(name,fn):
  try:
   setup(); fn(); assert not errors, errors
   results.append({'test':name,'status':'PASS'}); print('PASS',name,flush=True)
  except Exception as e:
   results.append({'test':name,'status':'FAIL','detail':str(e)}); print('FAIL',name,str(e),flush=True)
 def anchor():
  for i in range(200):
   scale=.2+(i%27)/10; s={'x':(i*13)%500-250,'y':(i*7)%700-350,'scale':scale}
   a={'x':i%140-70,'y':i%170-85}; b={'x':a['x']+21,'y':a['y']-12}; ratio=2**((i%15-7)/3)
   n=page.evaluate('(a)=>mathCamera(...a)',[s,a,b,ratio]); applied=n['scale']/scale
   close((a['x']-s['x'])*applied+n['x'],b['x']); close((a['y']-s['y'])*applied+n['y'],b['y'])
   assert .15<=n['scale']<=3
 test('200 anchored zoom / clamp cases',anchor)
 def pan():
  send('pointerdown',1,100,200);send('pointermove',1,180,260);send('pointerup',1,180,260)
  close(c()['x'],80);close(c()['y'],60);close(c()['scale'],.88)
  page.wait_for_timeout(50); assert page.evaluate('published')==0
 test('one-finger pan; no scale subscribers during pan',pan)
 def pinch():
  send('pointerdown',1,100,250);send('pointerdown',2,200,250)
  send('pointermove',1,70,290);send('pointermove',2,270,290)
  # baseline midpoint is (-50,-100), new=(-30,-60), scale doubles
  close(c()['scale'],1.76);close(c()['x'],70);close(c()['y'],140)
  send('pointerup',2,270,290); before=c();send('pointermove',1,80,300)
  close(c()['x'],before['x']+10);close(c()['y'],before['y']+10);close(c()['scale'],1.76)
  send('pointerup',1,80,300)
 test('pinch + simultaneous pan; 2-to-1 finger without jump',pinch)
 def bounds():
  send('pointerdown',1,100,250);send('pointerdown',2,200,250)
  send('pointermove',2,110,250);close(c()['scale'],.15)
  send('pointermove',2,10100,250);close(c()['scale'],3)
  send('pointercancel',2,10100,250)
 test('pinch scale limited to 15–300 percent',bounds)
 def cancel():
  send('pointerdown',1,100,200);send('pointermove',1,150,260);send('pointercancel',1,150,260)
  old=c();send('pointermove',1,300,600); assert c()==old
  send('pointerdown',2,100,200);send('pointermove',2,110,210);close(c()['x'],old['x']+10)
 test('cancel clears stale pointers; next gesture works',cancel)
 def third():
  send('pointerdown',1,100,200);send('pointerdown',2,200,200);send('pointerdown',3,300,300)
  old=c();send('pointermove',3,350,300);assert c()==old
  send('pointerup',1,100,200);old=c();send('pointermove',2,210,200)
  assert abs(c()['x']-old['x'])<30
 test('third finger does not cause a camera jump',third)
 def clicks():
  send('pointerdown',1,200,350,'#select');send('pointerup',1,200,350,'#select')
  page.evaluate("document.querySelector('#select').dispatchEvent(new MouseEvent('click',{bubbles:true,detail:1}))")
  assert page.evaluate('selected')==1
  send('pointerdown',2,200,350,'#select');send('pointermove',2,250,400,'#select');send('pointerup',2,250,400,'#select')
  page.evaluate("document.querySelector('#select').dispatchEvent(new MouseEvent('click',{bubbles:true,detail:1}))")
  assert page.evaluate('selected')==1
  page.evaluate("document.querySelector('#select').click()")
  assert page.evaluate('selected')==2
 test('tap opens person, drag does not; keyboard click preserved',clicks)
 def wheel():
  page.evaluate("document.querySelector('#surface').dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaX:20,deltaY:30}))")
  close(c()['x'],-20);close(c()['y'],-30)
  page.evaluate("document.querySelector('#surface').dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:-Math.log(2)/.01,ctrlKey:true,clientX:100,clientY:250}))")
  close(c()['scale'],1.76);close(c()['x'],60);close(c()['y'],40)
 test('two-axis trackpad scrolling and cursor-anchored ctrl-wheel',wheel)
 def overlays():
  old=c();page.locator('#search').fill('Sanguineti');page.locator('#search').press('ArrowLeft')
  assert c()==old
  page.locator('#zoom').click();page.wait_for_timeout(50);close(c()['scale'],1.1)
  assert page.locator('#toolbar').bounding_box()['y']==0, page.locator('#toolbar').bounding_box()
  assert page.locator('#toolbar').bounding_box()['height']==50
 test('fixed toolbar, working buttons, search remains editable',overlays)
 def double():
  tap(40,150);tap(40,150);page.wait_for_timeout(50);close(c()['scale'],1.32)
  send('pointerdown',2,200,350,'#select');send('pointerup',2,200,350,'#select')
  send('pointerdown',2,200,350,'#select');send('pointerup',2,200,350,'#select')
  close(c()['scale'],1.32)
 test('double-tap blank zooms, double-tap cards does not',double)
 def keys():
  page.locator('#surface').focus();page.keyboard.press('+');page.wait_for_timeout(30);close(c()['scale'],1.1)
  page.keyboard.press('ArrowDown');close(c()['y'],-60)
  page.keyboard.press('Home');page.wait_for_timeout(30);assert c()=={'x':0,'y':0,'scale':.88}
 test('keyboard navigation and reset',keys)
 def dispose():
  send('pointerdown',1,100,200);send('pointermove',1,200,300)
  page.evaluate('detach()');old=c();send('pointermove',1,300,400);assert c()==old
  page.evaluate("()=>{detach=v.attach(document.querySelector('#surface'))}");page.wait_for_timeout(100)
  send('pointerdown',2,100,200);send('pointermove',2,110,200);close(c()['x'],old['x']+10)
 test('detach / React StrictMode reattach without duplicate listeners',dispose)
 def smooth():
  page.emulate_media(reduced_motion='no-preference');page.evaluate('v.zoomIn()');initial=c()
  page.wait_for_timeout(85); mid=c();assert .88<mid['scale']<1.1
  page.wait_for_timeout(250);close(c()['scale'],1.1)
 test('animated zoom reaches precise target',smooth)
 def inertia():
  page.emulate_media(reduced_motion='no-preference');send('pointerdown',1,100,200)
  for x in range(110,211,20):
   page.wait_for_timeout(16);send('pointermove',1,x,200)
  send('pointerup',1,210,200);end=c()['x'];page.wait_for_timeout(90);assert c()['x']>end
  send('pointerdown',2,100,200);stopped=c();page.wait_for_timeout(100);assert c()==stopped
 test('pan momentum decelerates and stops on new touch',inertia)
 def reduced():
  send('pointerdown',1,100,200)
  for x in range(110,211,20):
   page.wait_for_timeout(16);send('pointermove',1,x,200)
  send('pointerup',1,210,200);end=c();page.wait_for_timeout(120);assert c()==end
 test('reduced-motion disables momentum',reduced)
 def actual_touch():
  session=ctx.new_cdp_session(page)
  def touch(t,points):session.send('Input.dispatchTouchEvent',{'type':t,'touchPoints':[{'x':x,'y':y,'id':i} for i,x,y in points]})
  touch('touchStart',[(1,100,250),(2,200,250)])
  for i in range(1,6):
   touch('touchMove',[(1,100-6*i,250+8*i),(2,200+14*i,250+8*i)]);page.wait_for_timeout(20)
  page.wait_for_timeout(40)
  close(c()['scale'],1.76,.03);close(c()['x'],70,2);close(c()['y'],140,2)
  touch('touchEnd',[]);page.wait_for_timeout(40);session.detach()
 test('Chromium native multi-touch pinch via CDP',actual_touch)
 def actual_tap_and_drag():
  page.touchscreen.tap(200,350);assert page.evaluate('selected')==1
  session=ctx.new_cdp_session(page)
  session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':200,'y':350,'id':1}]})
  for i in range(1,5):
   session.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':200+i*10,'y':350+i*10,'id':1}]});page.wait_for_timeout(20)
  session.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
  page.wait_for_timeout(40);assert page.evaluate('selected')==1;close(c()['x'],40,1);close(c()['y'],40,1);session.detach()
 test('Chromium native tap vs drag on a person card',actual_tap_and_drag)
 def batching():
  page.evaluate("""()=>{for(let i=0;i<1000;i++){let n=document.createElement('span');n.textContent='Person';document.querySelector('#canvas').append(n)}
  window.writes=0;window.obs=new MutationObserver(m=>window.writes+=m.length);obs.observe(document.querySelector('#surface'),{attributes:true,attributeFilter:['style']});
  for(let i=0;i<100;i++)document.querySelector('#surface').dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:-1,ctrlKey:true,clientX:150,clientY:300}));}""")
  page.wait_for_timeout(50);assert page.evaluate('published')==1;assert page.evaluate('writes')==3
  assert page.locator('#canvas > span').count()==1000
 test('100 input events batched into one frame for 1000-node fixture',batching)
 page.screenshot(path=str(OUTPUT/'gesture-fixture.png'))
 browser.close()
(OUTPUT/'results.json').write_text(json.dumps({'browser':f'Chromium {version}','scope':'isolated production controller; not full authenticated app or physical iPhone','results':results},indent=2,ensure_ascii=False))
print(json.dumps({'passed':sum(r['status']=='PASS' for r in results),'total':len(results)},ensure_ascii=False))
sys.exit(any(r['status']=='FAIL' for r in results))
