const http=require('http'),fs=require('fs'),path=require('path');
const port=process.env.PORT||3000;
const file='/data/encuestas.json';
const offlineWorker="const CACHE=\"ceosur-nangaritza-shell-v3\";\nself.addEventListener(\"install\",event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.add(\"/\")).then(()=>self.skipWaiting()));});\nself.addEventListener(\"activate\",event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(\"ceosur-nangaritza-shell-\")&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});\nself.addEventListener(\"fetch\",event=>{const request=event.request,url=new URL(request.url);if(request.method!==\"GET\"||url.origin!==self.location.origin||url.pathname!==\"/\"||request.mode!==\"navigate\")return;event.respondWith((async()=>{try{const response=await fetch(request);if(response.ok){const cache=await caches.open(CACHE);await cache.put(\"/\",response.clone());}return response;}catch(error){const cache=await caches.open(CACHE);const saved=await cache.match(\"/\");return saved||new Response(\"Abra la encuesta una vez con conexión para habilitar el modo sin internet en este dispositivo.\",{status:503,headers:{\"Content-Type\":\"text/plain; charset=utf-8\"}});}})());});";

const script="(function(){\nconst form=document.getElementById('survey');\nconst number=form?.elements?.numero_encuestado;\nconst panel=document.createElement('div');\npanel.style.cssText='padding:12px;margin:12px 0;background:#e7f7ee;border:2px solid #164e3b;border-radius:10px';\npanel.innerHTML='<strong>CONTROL GENERAL CEO SUR</strong><p id=\"ceosur-global-state\">Consultando contador general…</p><small>Sin internet, las encuestas quedan guardadas en el celular y reciben su número definitivo al sincronizarse.</small>';\nconst statusNode=()=>document.getElementById('ceosur-global-state');\nlet status=statusNode();\nlet running=false;\nasync function sync(){\n if(running)return;\n if(!status){const anchor=document.getElementById('ceosur-counter-v25')||document.getElementById('survey');if(anchor){if(typeof anchor.after==='function')anchor.after(panel);else anchor.parentNode?.insertBefore(panel,anchor.nextSibling);status=statusNode();}}\n if(!status)return;\n running=true;\n try{\n  const readable=typeof getAll==='function';\n  const rows=readable?await getAll('encuestas'):[];\n  const pending=rows.filter(r=>!r.sincronizado);\n  if(pending.length){\n   for(let i=0;i<pending.length;i+=50){\n    const batch=pending.slice(i,i+50);\n    const response=await fetch('/api/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({encuestas:batch})});\n    if(!response.ok)throw Error('No se pudo sincronizar');\n    const result=await response.json();\n    for(const item of batch){const saved=result.registros.find(x=>x.id===item.id);if(saved){item.numero_encuestado=String(saved.numero);item.numero_general=saved.numero;item.sincronizado=true;await put('encuestas',item);}}\n    localStorage.setItem('ceosur:last-sync',String(Date.now()));\n   }\n   if(typeof refreshCount==='function')await refreshCount();\n  }\n  const response=await fetch('/api/status',{cache:'no-store'});\n  if(!response.ok)throw Error('Servidor no disponible');\n  const data=await response.json();\n  const lastSync=localStorage.getItem('ceosur:last-sync');\n  const lastLabel=lastSync?new Date(Number(lastSync)).toLocaleString('es-EC'):'Aún no consta envío desde este celular';\n  status.textContent='Encuestas centrales: '+data.total+' · Próximo número: '+(data.total+1)+' · Pendientes en este celular: '+(readable?'0':'no verificables')+' · Último envío: '+lastLabel;\n  if(number&&!form.dataset.saving)number.value=String(data.total+1);\n }catch(e){\n  const rows=typeof getAll==='function'?await getAll('encuestas').catch(()=>[]):[];\n  const lastSync=localStorage.getItem('ceosur:last-sync');\n  status.textContent='SIN CONEXIÓN: '+rows.filter(r=>!r.sincronizado).length+' encuesta(s) pendiente(s). Último envío: '+(lastSync?new Date(Number(lastSync)).toLocaleString('es-EC'):'sin registro')+'.';\n }finally{running=false;}\n}\nif(form){form.addEventListener('submit',()=>{form.dataset.saving='1';setTimeout(()=>{delete form.dataset.saving;sync();},900);});}\nwindow.addEventListener('online',sync);\ndocument.addEventListener('visibilitychange',()=>{if(!document.hidden)sync();});\nsetInterval(sync,12000);\nsync();\n})();";
function normalizeSurveyorName(value){const name=String(value??'').trim().replace(/\\s+/g,' ');const key=name.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toUpperCase();return key==='BELGICA MARISOL RAMIREZ HERMIJOS'?'Bélgica Marisol Ramírez Armijos':name;}
function load(){try{const data=JSON.parse(fs.readFileSync(file,'utf8'));return Array.isArray(data)?data:[];}catch(e){if(e.code==='ENOENT')return [];throw e;}}
function correctSurveyorRecords(){const rows=load();let changed=0;const updated=rows.map(r=>{if(!r||typeof r!=='object'||typeof r.encuestador!=='string')return r;const name=normalizeSurveyorName(r.encuestador);if(name===r.encuestador)return r;const key=r.encuestador.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').trim().replace(/\\s+/g,' ').toUpperCase();if(key!=='BELGICA MARISOL RAMIREZ HERMIJOS')return r;changed++;return {...r,encuestador:name};});if(changed){const backup=file+'.backup-before-armijos-correction.json';if(!fs.existsSync(backup))fs.copyFileSync(file,backup);save(updated);console.log('Corrección encuestadora Bélgica Marisol Ramírez Armijos: '+changed+' registros actualizados; total conservado: '+updated.length);}else console.log('Corrección encuestadora: sin registros pendientes de modificar; total: '+rows.length);}

function save(data){fs.mkdirSync('/data',{recursive:true});const temp=file+'.tmp';fs.writeFileSync(temp,JSON.stringify(data));fs.renameSync(temp,file);}

const excludedSurveyors=new Set(['PATRICIO URTADO','PATRICIO U','PATO U','MARIA FERNAMDA LOPEZ','MARIA FERNANDA LOPEZ','MARIA LOPEZ']);
function surveyorKey(v){return String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toUpperCase();}
const deletedIdsFile='/data/encuestas_pruebas_eliminadas_ids.json';
function deletedIds(){try{const ids=JSON.parse(fs.readFileSync(deletedIdsFile,'utf8'));return new Set(Array.isArray(ids)?ids:[]);}catch(e){if(e.code==='ENOENT')return new Set();throw e;}}
const reassignedIdsFile='/data/encuestas_reasignadas_aprobadas_ids.json';
function reassignedIds(){try{const ids=JSON.parse(fs.readFileSync(reassignedIdsFile,'utf8'));return new Set(Array.isArray(ids)?ids:[]);}catch(e){if(e.code==='ENOENT')return new Set();throw e;}}
function removeTestSurveys(){
 const approved=reassignedIds();
 const original=load(),selected=original.filter(r=>r&&excludedSurveyors.has(surveyorKey(r.encuestador))&&!approved.has(r.id));
 if(!selected.length){console.log('Depuración de encuestas de prueba: sin registros pendientes. Total: '+original.length);return;}
 fs.mkdirSync('/data',{recursive:true});
 const stamp=new Date().toISOString().replace(/[:.]/g,'-');
 const backup='/data/encuestas_backup_antes_de_eliminar_pruebas_'+stamp+'.json';
 fs.writeFileSync(backup,JSON.stringify(original));
 const ids=deletedIds();
 for(const r of selected)if(typeof r.id==='string'&&r.id)ids.add(r.id);
 const idsTmp=deletedIdsFile+'.tmp';fs.writeFileSync(idsTmp,JSON.stringify([...ids]));fs.renameSync(idsTmp,deletedIdsFile);
 const kept=original.filter(r=>!r||!excludedSurveyors.has(surveyorKey(r.encuestador)));
 save(kept);
 console.log('Encuestas de prueba eliminadas: '+selected.length+'; conservadas: '+kept.length+'; respaldo: '+backup);
}

function send(res,code,obj){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(obj));}
const server=http.createServer((req,res)=>{
const url=(req.url||'/').split('?')[0];
if(url==='/sw.js'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'application/javascript; charset=utf-8','Cache-Control':'no-cache','Service-Worker-Allowed':'/','X-Content-Type-Options':'nosniff'});return res.end(offlineWorker);}
if((url==='/cliente'||url==='/cliente/')&&req.method==='GET'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return fs.createReadStream(path.join(__dirname,'cliente.html')).pipe(res);}
if((url==='/admin'||url==='/admin.html')&&req.method==='GET'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});return fs.createReadStream(path.join(__dirname,'admin.html')).pipe(res);}
if(url==='/api/admin/excel'&&req.method==='GET'){if(!process.env.CEOSUR_ADMIN_PASSWORD||req.headers['x-admin-key']!==process.env.CEOSUR_ADMIN_PASSWORD)return send(res,403,{error:'Acceso restringido'});return require('./exporter').build(load()).then(buffer=>{res.writeHead(200,{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':'attachment; filename="CEO_SUR_Nangaritza_Informe_Profesional.xlsx"','Cache-Control':'no-store'});res.end(Buffer.from(buffer));}).catch(e=>{console.error('Excel export:',e);if(!res.headersSent)send(res,500,{error:'No se pudo generar Excel'});});}
if(url==='/api/admin/data'&&req.method==='GET'){if(!process.env.CEOSUR_ADMIN_PASSWORD||req.headers['x-admin-key']!==process.env.CEOSUR_ADMIN_PASSWORD)return send(res,403,{error:'Acceso restringido'});try{return send(res,200,{encuestas:load()});}catch(e){return send(res,500,{error:'Error de datos'});}}
if(url==='/api/admin/reassign-surveyor'&&req.method==='POST'){
 if(!process.env.CEOSUR_ADMIN_PASSWORD||req.headers['x-admin-key']!==process.env.CEOSUR_ADMIN_PASSWORD)return send(res,403,{error:'Acceso restringido'});
 let raw='';req.on('data',chunk=>{raw+=chunk;if(raw.length>100000)req.destroy();});
 req.on('end',()=>{try{
  const body=JSON.parse(raw),records=body.records;
  if(!Array.isArray(records)||records.length!==8||records.some(x=>!x||typeof x.id!=='string'||typeof x.from!=='string')||new Set(records.map(x=>x.id)).size!==records.length)return send(res,400,{error:'Solicitud inválida'});
  const all=load(),byId=new Map(records.map(x=>[x.id,x]));
  const matches=all.filter(r=>byId.has(r.id)&&r.encuestador===byId.get(r.id).from);
  if(matches.length!==records.length)return send(res,409,{error:'Los registros cambiaron; no se modificó ningún dato'});
  const approved=reassignedIds();for(const x of records)approved.add(x.id);
  fs.mkdirSync('/data',{recursive:true});const approvedTmp=reassignedIdsFile+'.tmp';fs.writeFileSync(approvedTmp,JSON.stringify([...approved]));fs.renameSync(approvedTmp,reassignedIdsFile);
  const updated=all.map(r=>byId.has(r.id)?{...r,encuestador:'María Fernanda López'}:r);save(updated);
  return send(res,200,{actualizados:records.length,total:updated.length,encuestador:'María Fernanda López'});
 }catch(e){console.error('Reasignación de encuestadores:',e);return send(res,500,{error:'No se pudo completar la reasignación'});}});
 return;
}
if(url==='/api/status'&&req.method==='GET'){try{return send(res,200,{total:load().length});}catch(e){return send(res,500,{error:'No se pudo consultar la base de datos'});}}
if(url==='/api/sync'&&req.method==='POST'){
 let raw='';req.on('data',chunk=>{raw+=chunk;if(raw.length>2000000)req.destroy();});
 req.on('end',()=>{try{
 const body=JSON.parse(raw);if(!Array.isArray(body.encuestas)||body.encuestas.length>50)return send(res,400,{error:'Lote inválido'});
 const all=load(),byId=new Map(all.map(x=>[x.id,x])),removedIds=deletedIds();const out=[];
 for(const item of body.encuestas){
  if(!item||typeof item.id!=='string'||item.id.length>120||typeof item.encuestador!=='string'||typeof item.parroquia!=='string')continue;
  if(removedIds.has(item.id)||(excludedSurveyors.has(surveyorKey(item.encuestador))&&!reassignedIds().has(item.id)))continue;
  let stored=byId.get(item.id);
  if(!stored){const numero=all.length+1;stored={...item,encuestador:normalizeSurveyorName(item.encuestador),numero_encuestado:String(numero),numero_general:numero,sincronizado:true};all.push(stored);byId.set(item.id,stored);}
  out.push({id:item.id,numero:stored.numero_general});
 }
 save(all);return send(res,200,{registros:out,total:all.length});
 }catch(e){return send(res,500,{error:'Error al registrar las encuestas'});}});
 return;
}
if(req.method!=='GET'||(url!=='/'&&url!=='/index.html')){res.writeHead(404);return res.end('Not found');}
fs.readFile(path.join(__dirname,'index.html'),'utf8',(err,html)=>{
 if(err){res.writeHead(500);return res.end('No se pudo cargar la encuesta');}
 const hide="const source=k;const div=document.createElement('div');";
 html=html.replace(hide,"if(!applicable)return;"+hide);
 html=html.replace('Número de encuestado (opcional)','Número de encuestado (automático)');
 html=html.replace('Los registros se guardan localmente y no se sincronizan con un servidor en esta versión. Realice respaldos frecuentes y no borre los datos del navegador.','Las encuestas se guardan en este celular y se sincronizan con el servidor central cuando hay conexión. Antes de borrar el navegador o cambiar de celular, compruebe que el envío haya terminado.');
 const originalHandler="const num=this.elements.numero_encuestado.value.trim(),person=this.elements.encuestador.value.trim();";
 html=html.replace(originalHandler,"const num='',person=this.elements.encuestador.value.trim();");
 const injection='<script>'+"(function(){\nfunction start(){\n const form=document.getElementById('survey');\n let field=form?.elements?.encuestador;\n if(!form||!field)return;\n const approvedSurveyors=['Alexandra Soledad Valdez Huanca','Zheny América Armijos Robles','Bélgica Marisol Ramírez Armijos','María Fernanda López'];\n if(field.tagName!=='SELECT'){\n  const previous=String(field.value||'').trim(),select=document.createElement('select');\n  select.name=field.name||'encuestador';select.id=field.id||'encuestador';select.required=field.required;select.className=field.className;select.style.cssText=field.style.cssText;select.setAttribute('aria-label','Encuestador responsable');\n  select.add(new Option('Seleccione encuestador',''));\n  for(const name of approvedSurveyors)select.add(new Option(name,name));\n  if(approvedSurveyors.includes(previous))select.value=previous;\n  field.replaceWith(select);field=select;\n }\n let box=document.getElementById('ceosur-counter-v25');\n if(!box){box=document.createElement('div');box.id='ceosur-counter-v25';box.style.cssText='padding:14px;margin:12px 0;border:2px solid #164e3b;border-radius:12px;background:#e7f7ee;color:#164e3b';box.innerHTML='<strong>CONTADOR AUTOMÁTICO POR ENCUESTADOR</strong><p id=\"ceosur-person-count\" aria-live=\"polite\"></p><small>Encuestas guardadas en este celular; se envían al servidor central al recuperar internet.</small>';field.closest('section').appendChild(box);}\n const numberField=form.elements.numero_encuestado;\n if(numberField){numberField.readOnly=true;numberField.setAttribute('aria-label','Número automático de encuestado');numberField.placeholder='Se asigna automáticamente';numberField.style.background='#e7f7ee';}\n const parishSelect=document.getElementById('parroquia'),circSelect=document.getElementById('circunscripcion');\n if(parishSelect&&circSelect){\n  const syncTerritory=()=>{const p=parishSelect.value;const target=p==='Guayzimi'?'urbana':p?'rural':'';if(circSelect.value!==target){circSelect.value=target;if(typeof renderBallot==='function')renderBallot();}};\n  circSelect.style.pointerEvents='none';circSelect.tabIndex=-1;circSelect.title='La circunscripción se asigna automáticamente según la parroquia donde sufraga';\n  parishSelect.addEventListener('change',()=>setTimeout(syncTerritory,0));syncTerritory();\n }\n const label=document.getElementById('ceosur-person-count'),norm=x=>String(x||'').trim().replace(/\\s+/g,' ').toLocaleUpperCase('es');\n async function refresh(){try{const n=norm(field.value);if(!n){label.textContent='Ingrese el nombre del encuestador.';if(numberField)numberField.value='';return;}const rows=await getAll('encuestas');const mine=rows.filter(r=>norm(r.encuestador)===n);const total=mine.length;const next=Math.max(total,...mine.map(r=>Number(r.numero_encuestado)||0))+1;if(numberField)numberField.value=String(next);label.textContent=n+' — '+total+' encuesta(s) guardada(s). Siguiente: N.º '+next;}catch(e){label.textContent='No se pudo consultar el contador: '+e.message;}}\n field.addEventListener('input',refresh);field.addEventListener('change',refresh);\n form.addEventListener('submit',()=>setTimeout(refresh,600));\n document.getElementById('restoreData')?.addEventListener('change',()=>setTimeout(refresh,1200));\n refresh();\n}\nif(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();\n})();"+'</script><script>'+script+'</script>';
 html=html.replace('</body>',injection+'<script>(function(){const ids=["csv","json","restoreData","summary"];for(const id of ids){const node=document.getElementById(id);if(node){node.style.display="none";const parent=node.closest("button,label");if(parent)parent.style.display="none";}}})();</script></body>');
 const geoScript = `(function(){
function initGeo(){
 const form=document.getElementById('survey');if(!form)return;
 const field=form.elements.parroquia_realizacion||form.querySelector('[name="ubicacion"]');
 const container=field?.closest('section')||form;
 if(document.getElementById('ceosur-geo-button'))return;
 const wrap=document.createElement('div');wrap.style.cssText='margin:12px 0;padding:14px;border:1px solid #91b8a0;border-radius:10px;background:#eff9f2';
 const button=document.createElement('button');button.type='button';button.id='ceosur-geo-button';button.textContent='📍 Ubicación';button.style.cssText='padding:12px;background:#17613f;color:white;border:0;border-radius:8px;cursor:pointer';
 const status=document.createElement('p');status.id='ceosur-geo-status';status.textContent='Toque el botón desde el lugar donde realiza la encuesta y permita el acceso a la ubicación.';
 const link=document.createElement('a');link.id='ceosur-geo-link';link.target='_blank';link.rel='noopener noreferrer';link.style.cssText='display:none;color:#17613f;font-weight:bold';link.textContent='Abrir ubicación en Google Maps';
 for(const name of ['latitud','longitud','precision_metros','ubicacion_mapa']){if(!form.elements[name]){const input=document.createElement('input');input.type='hidden';input.name=name;form.appendChild(input);}}
 button.addEventListener('click',()=>{
  if(!navigator.geolocation){status.textContent='Este dispositivo no permite obtener la ubicación.';return;}
  button.disabled=true;status.textContent='Consultando ubicación GPS…';
  navigator.geolocation.getCurrentPosition(pos=>{
   const lat=pos.coords.latitude.toFixed(6),lon=pos.coords.longitude.toFixed(6),accuracy=Math.round(pos.coords.accuracy);
   const url='https://www.google.com/maps?q='+encodeURIComponent(lat+','+lon);
   form.elements.latitud.value=lat;form.elements.longitud.value=lon;form.elements.precision_metros.value=String(accuracy);form.elements.ubicacion_mapa.value=url;
   if(field&&field.tagName==='INPUT')field.value=lat+', '+lon;
   link.href=url;link.style.display='inline-block';status.textContent='Ubicación registrada · precisión aproximada: '+accuracy+' m. Compruebe el punto en el mapa.';
   button.disabled=false;button.textContent='📍 Ubicación';
  },err=>{status.textContent=err.code===1?'Permiso de ubicación denegado. Habilítelo en el navegador.':'No se pudo obtener la ubicación. Active el GPS e inténtelo de nuevo.';button.disabled=false;},{enableHighAccuracy:true,timeout:18000,maximumAge:0});
 });
 for(const name of ['latitud','longitud']){const existing=form.querySelectorAll('[name="'+name+'"]');existing.forEach(node=>{if(node.type!=='hidden'){node.type='hidden';const label=node.closest('label');if(label&&label.textContent.trim().toLowerCase().startsWith(name))label.style.display='none';}});}
 // Mantener un único control GPS visible; no eliminar campos de datos.
 for(const other of form.querySelectorAll('button,input[type="button"]')){if(other===button)continue;const label=(other.textContent||other.value||'').trim().toLocaleLowerCase('es');if(/^(📍\\s*)?(obtener |capturar |registrar |actualizar )?ubicaci[oó]n( actual)?$/.test(label)){other.style.display='none';other.setAttribute('aria-hidden','true');}}
 wrap.append(button,status,link);container.appendChild(wrap);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initGeo);else initGeo();
})();`;
 html=html.replace('</body>','<script>'+geoScript+'</script>'+ "<script>(function(){if(!(\"serviceWorker\" in navigator))return;const update=()=>{const status=document.getElementById(\"network\");if(!status)return;status.textContent=navigator.onLine?\"Con conexión: modo sin internet preparado en este dispositivo.\":\"Sin internet: continúa encuestando; las respuestas se guardan en este celular y se sincronizan al volver la conexión.\";};navigator.serviceWorker.register(\"/sw.js\",{scope:\"/\"}).then(()=>navigator.serviceWorker.ready).then(()=>{update();window.addEventListener(\"online\",update);window.addEventListener(\"offline\",update);}).catch(()=>{});})();</script>" +'</body>');
 res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(html);
});
});
try{correctSurveyorRecords();removeTestSurveys();}catch(e){console.error('Error al depurar encuestas de prueba; revisar respaldo:',e);}
server.listen(port,'0.0.0.0',()=>console.log('CEO SUR central sync listening on '+port));
