const KEY='sevia_intel_prueba_v1',KEY_DATA='sevia_intel_data_v1';
let LOG={q:[],req:[]};
try{const s=localStorage.getItem(KEY);if(s)LOG=JSON.parse(s);}catch(e){}
function save(){try{localStorage.setItem(KEY,JSON.stringify(LOG));}catch(e){}}
let ROL='admin';
const chat=document.getElementById('chat'),inp=document.getElementById('inp');

function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;}
function scroll(){chat.scrollTop=chat.scrollHeight;}
function bubble(kind,text){const b=el('div','msg '+kind,text);chat.appendChild(b);scroll();return b;}
function hhmm(iso){const d=new Date(iso);return d.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});}

let HAS_DATA=false,META=null;
function setEnabled(on){inp.disabled=!on;document.getElementById('send').disabled=!on;inp.placeholder=on?'Escribe tu pregunta…':'Carga primero tus datos';document.getElementById('sug').style.display=on?'flex':'none';}
function updateCtx(){document.getElementById('perChip').textContent=PER||'Sin datos';document.getElementById('regChip').textContent='Regla '+REGLA+' · ingreso > '+money(TH_DEF);}
function validData(d){return d&&Array.isArray(d.rows)&&d.rows.length>0&&'f' in d.rows[0]&&'g' in d.rows[0]&&Array.isArray(d.dsr||[]);}
function loadData(d,persist){
  if(!validData(d)){bubble('sys','El archivo no tiene el formato esperado. Genera uno con scripts/preparar_datos.py.');return false;}
  setData(d);META=d.meta||{};HAS_DATA=true;
  if(persist){try{localStorage.setItem(KEY_DATA,JSON.stringify(d));}catch(e){bubble('sys','Datos cargados, pero este navegador no permite guardarlos en el dispositivo.');}}
  updateCtx();setEnabled(true);welcome();return true;}
function pickFile(){document.getElementById('file').click();}
function loadDemo(){fetch('data.demo.json').then(r=>r.json()).then(d=>loadData(d,false)).catch(()=>bubble('sys','No pude cargar los datos de demostración.'));}
function showLoader(){
  setEnabled(false);updateCtx();chat.innerHTML='';
  const b=bubble('bot');
  b.appendChild(el('div','head','Primero carga tus datos'));
  b.appendChild(el('div',null,'Esta página no guarda tus datos en GitHub. Carga el archivo .json que generas con scripts/preparar_datos.py: se queda solo en este dispositivo. O prueba con datos de demostración (sintéticos).'));
  const l=el('div','loader'),a=el('button',null,'Cargar mi archivo de datos (.json)'),c=el('button','alt','Usar datos de demostración');
  a.onclick=pickFile;c.onclick=loadDemo;l.appendChild(a);l.appendChild(c);b.appendChild(l);}
function openDatos(){
  if(ROL!=='admin'){bubble('sys','La gestión de datos es solo para Admin.');return;}
  const sh=document.getElementById('sheet'),bd=document.getElementById('sheetBody');bd.innerHTML='';
  document.getElementById('sheetTitle').textContent='Datos cargados';
  bd.appendChild(el('div','row',HAS_DATA?('Periodo: '+(PER||'—')+' · '+A.length+' filas'+((META&&META.generado)?' · generado '+META.generado:'')):'Aún no hay datos cargados.'));
  const a=el('div','acts'),x=el('button','ghost','Cargar otro archivo'),y=el('button','ghost','Usar demostración'),z=el('button','ghost','Borrar datos de este dispositivo');
  x.onclick=()=>{sh.hidden=true;pickFile();};y.onclick=()=>{sh.hidden=true;loadDemo();};
  z.onclick=()=>{try{localStorage.removeItem(KEY_DATA);}catch(e){}HAS_DATA=false;sh.hidden=true;showLoader();};
  a.appendChild(x);a.appendChild(y);a.appendChild(z);bd.appendChild(a);sh.hidden=false;}
function welcome(){
  chat.innerHTML='';
  const b=bubble('bot');
  b.appendChild(el('div','head','SEVIA Intelligence está en desarrollo.'));
}
function renderSug(){
  const s=document.getElementById('sug');s.innerHTML='';
  Object.keys(INTENTS).forEach(id=>{const b=el('button',null,INTENTS[id].label);b.onclick=()=>ask(INTENTS[id].q);s.appendChild(b);});
}
function typing(){const b=bubble('bot');const d=el('div','dots');d.innerHTML='<span></span><span></span><span></span>';b.appendChild(d);return b;}

function ask(q){
  q=(q||'').trim();if(!q||!HAS_DATA)return;inp.value='';
  bubble('user',q);
  const t=typing();
  setTimeout(()=>{t.remove();answer(q);},450);
}
function answer(q){
  const id=route(q),entry={t:new Date().toISOString(),q,intent:id,rol:ROL,fb:null};LOG.q.push(entry);save();
  if(!id){
    const b=bubble('bot');
    b.appendChild(el('div','head','Aún no estoy diseñado para responder eso.'));
    b.appendChild(el('div',null,'Puedo ayudarte con las preguntas sugeridas de abajo. Si quieres que lo analicemos, solicítalo y quedará registrado.'));
    const r=el('button','req','Solicitar este análisis');
    r.onclick=()=>{LOG.req.push({t:new Date().toISOString(),q,rol:ROL});save();r.disabled=true;r.textContent='Solicitud registrada ✓';};
    b.appendChild(r);scroll();return;
  }
  const I=INTENTS[id];
  if(I.fin&&ROL!=='admin'){
    const b=bubble('bot');
    b.appendChild(el('div','head','No tienes permiso para consultar esta información.'));
    b.appendChild(el('div',null,'Las consultas financieras (Fleet vs Corte e ingresos totales) son solo para Admin en esta prueba.'));
    addCalc(b,id,parse(q),{meta:{regla:'Permiso por perfil',universo:'—'}});scroll();return;
  }
  const p=parse(q);let r;
  try{r=I.run(p);}catch(e){const b=bubble('bot');b.appendChild(el('div','head','Tuve un problema al calcular esto.'));return;}
  const b=bubble('bot');
  if(I.partial){b.appendChild(el('span','badge partial','Parcial · revisar notas'));}else{b.appendChild(el('span','badge','Consulta del catálogo · '+id));}
  b.appendChild(el('div','head',r.head));
  if(r.table){
    if(r.table.rows.length){
      const w=el('div','tw'),tb=document.createElement('table'),hr=document.createElement('tr');
      r.table.cols.forEach(c=>hr.appendChild(el('th',null,c)));const th=document.createElement('thead');th.appendChild(hr);tb.appendChild(th);
      const bd=document.createElement('tbody');
      r.table.rows.forEach(row=>{const tr=document.createElement('tr');row.forEach(v=>tr.appendChild(el('td',null,String(v))));bd.appendChild(tr);});
      tb.appendChild(bd);w.appendChild(tb);b.appendChild(w);
    }else b.appendChild(el('div','note','Ningún registro cumple el criterio.'));
  }
  (r.extra||[]).forEach(x=>{b.appendChild(el('div','note2',x.title));const w=el('div','tw'),tb=document.createElement('table'),hr=document.createElement('tr');
    x.table.cols.forEach(c=>hr.appendChild(el('th',null,c)));const th=document.createElement('thead');th.appendChild(hr);tb.appendChild(th);
    const bd=document.createElement('tbody');x.table.rows.forEach(row=>{const tr=document.createElement('tr');row.forEach(v=>tr.appendChild(el('td',null,String(v))));bd.appendChild(tr);});tb.appendChild(bd);w.appendChild(tb);b.appendChild(w);});
  (r.notas||[]).concat(p.warn).forEach(n=>b.appendChild(el('div','note',n)));
  addCalc(b,id,p,r);
  const f=el('div','fb');f.appendChild(el('span',null,'¿Era lo que esperabas?'));
  const y=el('button',null,'👍 Sí'),n=el('button',null,'👎 No');
  const mark=v=>{entry.fb=v;save();y.disabled=true;n.disabled=true;(v==='si'?y:n).style.borderColor='var(--brand)';};
  y.onclick=()=>mark('si');n.onclick=()=>mark('no');f.appendChild(y);f.appendChild(n);b.appendChild(f);
  scroll();
}
function addCalc(b,id,p,r){
  const d=document.createElement('details'),s=el('summary',null,'Cómo lo calculé');d.appendChild(s);
  d.appendChild(el('p',null,'Regla: '+r.meta.regla));
  d.appendChild(el('p',null,'Universo: '+r.meta.universo));
  d.appendChild(el('p',null,'Intención detectada: '+INTENTS[id].name+' · umbral ingreso '+money(p.th)+' · top '+p.topN+' · mín. jornadas '+p.minJ+(p.cat?' · categoría '+p.cat:'')+(p.umbral!=null?' · promedio < '+money(p.umbral):'')+(p.kml!=null?' · rendimiento < '+p.kml+' km/l':'')));
  b.appendChild(d);
}

/* Registro */
function openSheet(){
  document.getElementById('sheetTitle').textContent='Registro de la prueba';
  if(ROL!=='admin'){bubble('sys','El registro de la prueba es solo para Admin.');return;}
  const sh=document.getElementById('sheet'),bd=document.getElementById('sheetBody');bd.innerHTML='';
  const q=LOG.q,con=q.filter(x=>x.intent).length,sin=q.length-con,si=q.filter(x=>x.fb==='si').length,no=q.filter(x=>x.fb==='no').length;
  const st=el('div','stats');
  [['Preguntas',q.length],['Con intención',con],['Sin intención',sin],['👍',si],['👎',no],['Solicitudes',LOG.req.length]].forEach(([a,b])=>{const d=el('div','stat');d.appendChild(el('b',null,String(b)));d.appendChild(el('span',null,a));st.appendChild(d);});
  bd.appendChild(st);
  bd.appendChild(el('h3',null,'Solicitudes de análisis'));
  if(!LOG.req.length)bd.appendChild(el('div','row','Sin solicitudes todavía.'));
  LOG.req.slice().reverse().forEach(x=>{const r=el('div','row',x.q);r.appendChild(el('small',null,hhmm(x.t)+' · '+x.rol));bd.appendChild(r);});
  bd.appendChild(el('h3',null,'Preguntas hechas'));
  if(!q.length)bd.appendChild(el('div','row','Aún no hay preguntas.'));
  q.slice().reverse().slice(0,60).forEach(x=>{const r=el('div','row',x.q);r.appendChild(el('small',null,hhmm(x.t)+' · '+(x.intent?'→ '+x.intent+' '+INTENTS[x.intent].label:'sin intención')+' · '+(x.fb==='si'?'👍':x.fb==='no'?'👎':'sin evaluar')));bd.appendChild(r);});
  bd.appendChild(el('h3',null,'Copiar el registro'));
  const ta=document.createElement('textarea');ta.readOnly=true;ta.value=JSON.stringify(LOG,null,1);bd.appendChild(ta);
  const a=el('div','acts');
  const c=el('button','ghost','Copiar');c.onclick=()=>{ta.select();try{navigator.clipboard.writeText(ta.value);c.textContent='Copiado ✓';}catch(e){document.execCommand&&document.execCommand('copy');c.textContent='Seleccionado';}};
  const x=el('button','ghost','Borrar registro');x.onclick=()=>{LOG={q:[],req:[]};save();openSheet();};
  const nw=el('button','ghost','Nueva conversación');nw.onclick=()=>{sh.hidden=true;welcome();};
  a.appendChild(c);a.appendChild(x);a.appendChild(nw);bd.appendChild(a);
  sh.hidden=false;
}

document.getElementById('send').onclick=()=>ask(inp.value);
inp.addEventListener('keydown',e=>{if(e.key==='Enter')ask(inp.value);});
document.getElementById('btnReg').onclick=openSheet;
document.getElementById('btnDatos').onclick=openDatos;
document.getElementById('file').onchange=e=>{const f=e.target.files[0];if(!f)return;f.text().then(x=>{try{loadData(JSON.parse(x),true);}catch(err){bubble('sys','No pude leer el archivo: no es un JSON válido.');}});e.target.value='';};
document.getElementById('btnClose').onclick=()=>{document.getElementById('sheet').hidden=true;};
document.getElementById('rol').onchange=e=>{ROL=e.target.value;bubble('sys','Perfil cambiado a '+(ROL==='admin'?'Admin':'Usuario')+(ROL==='usuario'?' · sin consultas financieras ni registro':''));};
renderSug();
let saved=null;try{saved=JSON.parse(localStorage.getItem(KEY_DATA)||'null');}catch(e){}
if(saved&&validData(saved)){setData(saved);META=saved.meta||{};HAS_DATA=true;updateCtx();setEnabled(true);welcome();}else showLoader();
