import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { createServer } from 'vite';

// Mount the real component and exercise its user actions without credentials or production data.
const html = `<!doctype html><html><body><div id="root"></div>
<script>window.librepm={getBackendPort:async()=>8080};</script><script type="module">
import React from 'react'; import {createRoot} from 'react-dom/client';
import SuiteProjectsPanel from '/src/components/SuiteProjectsPanel.jsx';
import {librepm} from '/src/api/librepm.js'; import '/node_modules/bootstrap/dist/css/bootstrap.min.css';
const first='11111111-1111-1111-1111-111111111111',second='22222222-2222-2222-2222-222222222222';
const context=id=>({suiteProjectId:id,title:id===first?'Primo progetto':'Secondo progetto',links:{associago:'https://associago.example/?suiteProject='+id,bandi:'javascript:alert(1)'},sync:[{system:'associago',status:'unlinked'},{system:'bandi',status:'unlinked'}],financial:null,workforce:null,preparation:null});
let catalog=[];window.audit={registered:0,syncs:0,selection:null};
librepm.suiteProjects=async()=>catalog;
librepm.suiteRegister=async id=>{window.audit.registered++;catalog=[context(id),context(second)];return catalog[0];};
librepm.suiteSelect=async id=>{window.audit.selection=id;return {suiteProjectId:id};};
librepm.projectsGet=async id=>({id,name:id===first?'Primo progetto':'Secondo progetto'});
librepm.suiteSync=async id=>{window.audit.syncs++;const result={...context(id),links:{associago:'https://associago.example/?suiteProject='+id,bandi:'https://bandi.example/suite/projects/'+id},sync:[{system:'associago',status:'synced',lastSuccessAt:'2026-10-29T12:00:00Z'},{system:'bandi',status:window.audit.syncs===1?'error':'synced',errorMessage:window.audit.syncs===1?'Bandi temporaneamente offline':null}],financial:{currency:'EUR',income:'100.00',expense:'25.00',balance:'75.00'}};catalog=catalog.map(p=>p.suiteProjectId===id?result:p);return result;};
function Harness(){const [project,setProject]=React.useState({id:first,name:'Primo progetto'});return React.createElement(SuiteProjectsPanel,{shell:{currentProject:project,setCurrentProject:setProject}});}
createRoot(document.getElementById('root')).render(React.createElement(Harness));
</script></body></html>`;
const server=await createServer({configFile:resolve('vite.config.js'),server:{host:'127.0.0.1',port:5191,strictPort:false},plugins:[{name:'suite-smoke',configureServer(vite){vite.middlewares.use('/suite-smoke.html',async(_req,res)=>{res.setHeader('Content-Type','text/html');res.end(await vite.transformIndexHtml('/suite-smoke.html',html));});}}]});
const tempRoot=resolve(tmpdir()),profile=mkdtempSync(join(tempRoot,'librepm-suite-smoke-'));
const chrome=[process.env.CHROME_PATH,'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe','/usr/bin/google-chrome','/usr/bin/chromium'].find(p=>p&&existsSync(p));
const sleep=ms=>new Promise(done=>setTimeout(done,ms));
let browser,socket;
try {
    assert.ok(chrome,'Chrome/Edge required; set CHROME_PATH');await server.listen();
    const port=9900+process.pid%100;
    browser=spawn(chrome,['--headless=new','--disable-gpu','--no-first-run',`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore',windowsHide:true});
    let tabs;
    for(let attempt=0;attempt<50&&!tabs;attempt++){try{tabs=await(await fetch(`http://127.0.0.1:${port}/json`)).json();}catch{await sleep(100);}}
    assert.ok(tabs,'Browser did not start');socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
    await new Promise((done,reject)=>{socket.onopen=done;socket.onerror=reject;});
    let requestId=0;const pending=new Map(),errors=[];
    socket.onmessage=event=>{const message=JSON.parse(event.data);if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.text);if(pending.has(message.id)){pending.get(message.id)(message);pending.delete(message.id);}};
    const send=(method,params={})=>new Promise((done,reject)=>{const id=++requestId,timer=setTimeout(()=>reject(Error('Timeout '+method)),10000);pending.set(id,response=>{clearTimeout(timer);response.error?reject(Error(response.error.message)):done(response.result);});socket.send(JSON.stringify({id,method,params}));});
    const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value;};
    const waitFor=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await sleep(100);}throw Error('Condition failed: '+expression+'\n'+await evaluate('document.body.innerText'));};
    const click=text=>evaluate(`(()=>{const button=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)});if(!button||button.disabled)throw Error('Button unavailable');button.click();})()`);
    await send('Page.enable');await send('Runtime.enable');await send('Page.navigate',{url:server.resolvedUrls.local[0]+'suite-smoke.html'});
    await waitFor(`document.body.innerText.includes('Condividi questo progetto')`);await click('Condividi questo progetto');
    await waitFor(`document.body.innerText.includes('Progetto registrato.')`);assert.equal(await evaluate('window.audit.registered'),1);
    assert.equal(await evaluate('window.audit.selection'),'11111111-1111-1111-1111-111111111111');
    assert.equal(await evaluate(`!![...document.querySelectorAll('a')].find(a=>a.textContent.includes('Apri in Bandi'))`),false);
    await click('Allinea applicazioni');await waitFor(`document.body.innerText.includes('Allineamento incompleto')`);
    assert.equal(await evaluate(`document.body.innerText.includes('Bandi temporaneamente offline')`),true);
    assert.equal(await evaluate(`document.body.innerText.includes('saldo 75.00')`),true);
    await click('Allinea applicazioni');await waitFor(`document.body.innerText.includes('Le applicazioni collegate sono allineate.')`);
    assert.equal(await evaluate(`document.querySelector('a[href*="bandi.example"]').getAttribute('href')`),'https://bandi.example/suite/projects/11111111-1111-1111-1111-111111111111');
    await evaluate(`(()=>{const select=document.querySelector('select');select.value='22222222-2222-2222-2222-222222222222';select.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await waitFor(`document.body.innerText.includes('Progetto corrente: Secondo progetto')`);
    assert.equal(await evaluate('window.audit.selection'),'22222222-2222-2222-2222-222222222222');
    assert.equal(await evaluate(`new URLSearchParams(location.search).get('suiteProject')`),'22222222-2222-2222-2222-222222222222');
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth'),false);assert.deepEqual(errors,[]);
    console.log('PASS: real suite UI registers, persists selection, reports partial sync, retries, opens safe links and changes project; mobile width390.');
    await send('Browser.close').catch(()=>{});
} finally {
    socket?.close();browser?.kill();await server.close();
    if(resolve(profile).startsWith(tempRoot+sep)){await sleep(250);try{rmSync(profile,{recursive:true,force:true});}catch{}}
}
