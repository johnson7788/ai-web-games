import functools, http.server, json, os, socket, socketserver, sys, threading, time
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
def free():
    s=socket.socket(); s.bind(("127.0.0.1",0)); p=s.getsockname()[1]; s.close(); return p
def measure(page,label,js_before):
    page.evaluate(js_before) if js_before else None
    r=page.evaluate("""new Promise((res)=>{const t=[];let l=performance.now();
      function f(ts){t.push(ts-l);l=ts;if(t.length<90)requestAnimationFrame(f);
        else{const a=t.slice(10).sort((x,y)=>x-y);res({avg:a.reduce((s,v)=>s+v,0)/a.length,p95:a[Math.floor(a.length*.95)]})}}
      requestAnimationFrame(f)})""")
    print(f"{label:22s} avg={r['avg']:.1f}ms  p95={r['p95']:.1f}ms  ~{1000/r['avg']:.0f}fps")
port=free()
socketserver.TCPServer.allow_reuse_address=True
h=functools.partial(Q,directory=ROOT)
httpd=socketserver.TCPServer(("127.0.0.1",port),h)
threading.Thread(target=httpd.serve_forever,daemon=True).start()
from playwright.sync_api import sync_playwright
with sync_playwright() as pw:
    b=pw.chromium.launch(args=["--no-sandbox"])
    ctx=b.new_context(viewport={"width":720,"height":1280},device_scale_factor=2)
    pg=ctx.new_page(); pg.goto(f"http://127.0.0.1:{port}/index.html",wait_until="networkidle")
    pg.wait_for_function("window.__game && window.__game.screen!=='loading'",timeout=20000)
    time.sleep(.4)
    measure(pg,"menu","")
    pg.evaluate("window.__ll.start('solo','novice')"); time.sleep(.6)
    measure(pg,"in-game (live)","")
    measure(pg,"in-game paused","window.__ll.pause()")
    measure(pg,"no tree","window.__game.scene.drawTree=function(){};window.__ll.resume()")
    measure(pg,"no hud","window.__game.ui.drawHud=function(){}")
    measure(pg,"no bg","window.__game.scene.drawBackground=function(){}")
    b.close()
