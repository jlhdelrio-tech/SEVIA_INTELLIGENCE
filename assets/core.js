/* SEVIA Intelligence · simulador · lógica de intenciones (calcula sobre DATA, sin IA) */
const TH_DEF=300, REGLA='productividad_v2';
let A=[],DSR=[],PER='';
const norm=s=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
const sum=a=>a.reduce((x,y)=>x+y,0);
function quantile(a,q){const b=[...a].sort((x,y)=>x-y),p=(b.length-1)*q,i=Math.floor(p),f=p-i;return i+1<b.length?b[i]+f*(b[i+1]-b[i]):b[i];}
const money=x=>(x<0?'−':'')+'$'+Math.abs(Math.round(x)).toLocaleString('en-US');
const fmt1=v=>(Math.round((v-1e-9)*10)/10).toFixed(1);
const sev=s=>s==null?'—':'#'+s;
function groupBy(rows,f){const m=new Map();for(const r of rows){const k=f(r);if(!m.has(k))m.set(k,[]);m.get(k).push(r);}return m;}
const DIAS=['DOMINGO','LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','SABADO'];
const dow=f=>DIAS[new Date(f+'T00:00:00Z').getUTCDay()];
function valid(th){return A.filter(r=>r.t==='Asistencia'&&r.s!=null&&!r.op&&r.km>0&&r.g>th);}
const grupo=r=>r.tu==='FLEX'?'FLEX':r.ct;
function perDriver(rows){const m=groupBy(rows,r=>r.s),o=[];for(const [s,q] of m){const v=q.map(r=>r.g);o.push({s,mean:mean(v),sum:sum(v),n:v.length});}return o;}
const rule=th=>`${REGLA}: Asistencia + km > 0 + ingreso oficial > ${money(th)}; sin Operaciones ni la entidad 'SEVIA Mobility FLEET'`;


/* ---- Ingreso semanal por driver (componentes: une filas por ID SEV y por nombre) ---- */
let _wk=null;
function comps(){ if(_wk)return _wk; const par={};const f=x=>{while(par[x]!==x){par[x]=par[par[x]];x=par[x];}return x;};
  const add=x=>{if(!(x in par))par[x]=x;};
  for(const r of A){if(r.en)continue;const ks=[];if(r.s!=null)ks.push('s'+r.s);if(r.d!=null)ks.push('d'+r.d);ks.forEach(add);if(ks.length===2)par[f(ks[0])]=f(ks[1]);}
  const m=new Map();for(const r of A){if(r.en)continue;const k=r.s!=null?'s'+r.s:(r.d!=null?'d'+r.d:null);if(!k)continue;const root=f(k);if(!m.has(root))m.set(root,[]);m.get(root).push(r);}
  _wk=m;return m;}
function drivers(p,inc){const out=[];
  for(const [,rows] of comps()){const op=rows.some(r=>r.op);if(op&&!(inc&&inc.op))continue;
    const sv=rows.find(r=>r.s!=null),s=sv?sv.s:null,flex=rows.some(r=>r.tu==='FLEX'),cat=flex?'FLEX':rows[0].ct;
    if(p.exFlex&&flex)continue;if(p.cat&&cat!==p.cat)continue;
    const vr=rows.filter(r=>r.t==='Asistencia'&&r.km>0&&r.g>p.th);
    out.push({s,d:rows[0].d,cat,op,total:sum(rows.map(r=>r.g)),dias:new Set(rows.filter(r=>r.g>0).map(r=>r.f)).size,v:vr.length,avg:vr.length?mean(vr.map(r=>r.g)):null,rows});}
  return out;}
const dlabel=x=>x.s!=null?sev(x.s):'Sin ID SEV (ref '+x.d+')';
function rankW(p){const by=p.by==='avg'?'avg':'total';
  let e=drivers(p).filter(x=>x.v>=p.minJ);
  const all=e.length;
  if(p.umbral!=null)e=e.filter(x=>x[by]<p.umbral);if(p.mas!=null)e=e.filter(x=>x[by]>p.mas);
  e.sort((a,b)=>b[by]-a[by]);return {e,all,by};}

const INTENTS={
P01:{name:'auditoria_fleet_vs_corte',label:'Fleet vs Corte',q:'¿Qué diferencias hay entre Fleet y Corte esta semana?',fin:true,run(p){
  const co=sum(A.map(r=>r.co||0)),fl=sum(A.map(r=>r.fl||0)),m=groupBy(A,r=>r.au);
  const order=['COINCIDE','NO COINCIDE','SOLO FLEET','SOLO CORTE','SIN INFORMACIÓN FINANCIERA'];
  return {head:`Corte ${money(co)} vs Fleet ${money(fl)}: diferencia de ${money(co-fl)} (${(co-fl<0?'−':'+')+Math.abs((co-fl)/fl*100).toFixed(1)}%).`,
   table:{cols:['Estatus','Registros'],rows:order.map(k=>[k,(m.get(k)||[]).length])},
   meta:{regla:'Fuente oficial: Fleet cuando existe; SOLO CORTE no suma al oficial hasta validar Fleet.',universo:`${A.length} filas del consolidado, ${PER}`}};}},
P02:{name:'auditoria_solo_fuente',label:'Solo Fleet / solo Corte',q:'¿Qué registros están solo en Fleet o solo en el Corte?',fin:true,run(p){
  const sf=A.filter(r=>r.au==='SOLO FLEET'),sc=A.filter(r=>r.au==='SOLO CORTE');
  const top=[...sf].sort((a,b)=>b.fl-a.fl).slice(0,p.topN);
  return {head:`${sf.length} registros solo en Fleet (${money(sum(sf.map(r=>r.fl)))}) y ${sc.length} solo en el Corte (${money(sum(sc.map(r=>r.co)))}).`,
   table:{cols:['Mayores solo Fleet','Fecha','Fleet'],rows:top.map(r=>[r.en?'Entidad SEVIA Mobility FLEET':(r.s!=null?sev(r.s):'Sin ID SEV (driver '+r.d+')'),r.f,money(r.fl)])},
   meta:{regla:'Se conservan como casos de auditoría; no se eliminan.',universo:`${A.length} filas, ${PER}`},notas:['La entidad de la empresa no es un driver y se excluye de promedios y rankings.']};}},
P03:{name:'ranking_drivers',label:'Mejores y peores drivers',q:'¿Cuáles fueron mis mejores drivers excluyendo FLEX y Operaciones?',run(p){
  let v=valid(p.th).filter(r=>r.tu!=='FLEX'); if(p.cat) v=v.filter(r=>r.ct===p.cat);
  const s=perDriver(v).filter(x=>x.n>=p.minJ).sort((a,b)=>b.mean-a.mean),n=Math.min(p.topN,s.length),wb=p.wantBest,ww=p.wantWorst;
  const row=(x,i)=>[i,sev(x.s),money(x.mean),x.n],rows=[];
  if(!ww||wb)s.slice(0,n).forEach((x,i)=>rows.push(row(x,i+1)));
  if(ww)[...s].reverse().slice(0,n).forEach((x,i)=>rows.push(row(x,s.length-i)));
  const what=ww&&wb?`Los ${n} mejores y los ${n} peores:`:ww?`Los ${n} peores:`:`Los ${n} mejores:`;
  return {head:`${s.length} drivers califican (≥${p.minJ} jornadas válidas${p.cat?', '+p.cat:''}, sin FLEX ni Operaciones). ${what}`,
   table:{cols:['Lugar','Driver','Promedio diario','Jornadas'],rows},
   meta:{regla:rule(p.th),universo:`${v.length} jornadas válidas, ${PER}`}};}},
P04:{name:'drivers_bajo_umbral',label:'Promedio bajo umbral',q:'¿Qué drivers promedian menos de $1,600?',run(p){
  const u=p.umbral??1600;let v=valid(p.th).filter(r=>r.tu!=='FLEX');if(p.cat)v=v.filter(r=>r.ct===p.cat);
  const all=perDriver(v).filter(x=>x.n>=p.minJ),s=all.filter(x=>x.mean<u).sort((a,b)=>a.mean-b.mean);
  return {head:`${s.length} de ${all.length} drivers promedian menos de ${money(u)}. Los más bajos:`,
   table:{cols:['Driver','Promedio diario','Jornadas'],rows:s.slice(0,p.topN).map(x=>[sev(x.s),money(x.mean),x.n])},
   meta:{regla:rule(p.th),universo:`${all.length} drivers con ≥${p.minJ} jornadas válidas, sin FLEX`}};}},
P05:{name:'estadisticas_ingreso',label:'Promedio, mediana y P75',q:'¿Cuál es el promedio, la mediana y el P75 diario y semanal?',run(p){
  let v=valid(p.th);if(p.cat)v=v.filter(r=>grupo(r)===p.cat);const g=v.map(r=>r.g),d=perDriver(v);
  return {head:`Diario: promedio ${money(mean(g))}, mediana ${money(quantile(g,.5))}, P75 ${money(quantile(g,.75))}. Semanal por driver: ${money(mean(d.map(x=>x.sum)))}.`,
   table:{cols:['Métrica','Valor'],rows:[['Jornadas válidas',v.length],['Drivers',d.length],['Días promedio por driver',mean(d.map(x=>x.n)).toFixed(1)],['Promedio diario',money(mean(g))],['Mediana diaria',money(quantile(g,.5))],['P75 diario',money(quantile(g,.75))],['Promedio semanal por driver',money(mean(d.map(x=>x.sum)))]]},
   meta:{regla:rule(p.th)+'. Semanal = suma de jornadas válidas por driver, promediada entre drivers.',universo:`${v.length} jornadas válidas, ${PER}`}};}},
P06:{name:'comparativo_categoria',label:'Premier, Express y FLEX',q:'¿Cómo se comparan Premier, Express y FLEX?',run(p){
  const v=valid(p.th),rows=['PREMIER','EXPRESS','FLEX'].filter(g=>!p.cat||g===p.cat).map(gr=>{const q=v.filter(r=>grupo(r)===gr),d=perDriver(q);return [gr,d.length,money(mean(q.map(r=>r.g))),money(mean(d.map(x=>x.sum)))];});
  return {head:'Comparativo por categoría (promedio diario y semanal por driver):',table:{cols:['Categoría','Drivers','Diario','Semanal'],rows},
   meta:{regla:rule(p.th)+'. FLEX = turno FLEX; Premier y Express vienen del Maestro.',universo:`${v.length} jornadas válidas`},notas:['Estado parcial: depende del cruce con el Maestro y de que el turno esté completo en el consolidado.']};}},
P07:{name:'asistencia_motivos',label:'Faltas y permisos',q:'¿Cuántas faltas y permisos hubo y cuáles no tienen motivo?',run(p){
  const m=groupBy(A.filter(r=>r.t),r=>r.t),c=k=>(m.get(k)||[]).length,nm=A.filter(r=>['Permiso','Incapacidad','Otros'].includes(r.t));
  return {head:`Faltas ${c('Falta')}, permisos ${c('Permiso')}, incapacidades ${c('Incapacidad')}, otros ${c('Otros')}. Sin comentario: ${nm.filter(r=>!r.cm).length} de ${nm.length} (permiso, incapacidad y otros).`,
   table:{cols:['Tipo','Registros'],rows:['Asistencia','Descanso','Día extra','Permiso','Falta','Otros','Incapacidad'].map(k=>[k,c(k)])},
   meta:{regla:'Permiso, incapacidad y otros exigen motivo; sin comentario = motivo faltante.',universo:`${A.filter(r=>r.t).length} registros con tipo, ${PER}`}};}},
P08:{name:'trabajo_en_descanso',label:'Trabajó en descanso',q:'¿Quién trabajó en su día de descanso?',run(p){
  const w=A.filter(r=>r.t==='Asistencia'&&r.dc&&r.dc===dow(r.f)),s=new Set(w.filter(r=>r.s!=null).map(r=>r.s));
  const m=groupBy(w,r=>r.dc);
  return {head:`${w.length} asistencias en día de descanso (${s.size} drivers).`,
   table:{cols:['Día de descanso','Asistencias'],rows:[...m].map(([k,q])=>[k,q.length])},
   meta:{regla:'Día de la semana de la fecha = día de descanso del Maestro.',universo:`${A.filter(r=>r.t==='Asistencia'&&r.dc).length} asistencias con día de descanso conocido`},notas:['Estado parcial: depende de que el día de descanso esté completo en el Maestro.']};}},
P09:{name:'dias_extra',label:'Días extra',q:'¿Qué días extra están registrados y cuáles podrían estar omitidos?',run(p){
  const w=A.filter(r=>(r.t==='Asistencia'||r.t==='Día extra')&&r.km>0&&r.s!=null),m=new Map();
  for(const r of w){if(!m.has(r.s))m.set(r.s,new Set());m.get(r.s).add(r.f);}
  const de=new Set(A.filter(r=>r.t==='Día extra'&&r.s!=null).map(r=>r.s)),cnt=s=>(m.get(s)||new Set()).size;
  const s7=[...m.keys()].filter(s=>cnt(s)>=7),n6=[...m.keys()].filter(s=>cnt(s)>=6).length;
  const rows=[...s7.map(s=>[sev(s),cnt(s),de.has(s)?'Sí':'No','Omitido probable'].map((x,i)=>i===3&&de.has(s)?'Correcto':x)),...[...de].filter(s=>cnt(s)<7).map(s=>[sev(s),cnt(s),'Sí','Revisión (menos de 7 días)'])];
  return {head:`${m.size} drivers con km; ${n6} llegan a 6 días (${Math.round(n6/m.size*100)}%); ${s7.length} llegan a 7. Posibles omitidos: ${s7.filter(s=>!de.has(s)).map(sev).join(', ')||'ninguno'}.`,
   table:{cols:['Driver','Días con km','Día extra registrado','Resultado'],rows},
   meta:{regla:'6 días esperados por semana; el 7º día trabajado con km se espera como Día extra.',universo:`${m.size} drivers con ruta, ${PER}`},notas:['Los casos sin evidencia suficiente quedan en revisión, no se confirman solos.']};}},
P10:{name:'excepciones_ruta_facturacion',label:'Ruta sin facturación / facturación sin km',q:'¿Qué drivers tienen jornadas con ruta pero sin facturación, o facturación sin km?',run(p){
  const a=A.filter(r=>r.t==='Asistencia'),r1=a.filter(r=>r.km>0&&(r.g||0)<=p.th),r2=a.filter(r=>!(r.km>0)&&r.g>p.th);
  const top=m=>[...groupBy(m,r=>r.s)].map(([s,q])=>[sev(s),q.length]).sort((x,y)=>y[1]-x[1]).slice(0,5);
  return {head:`Ruta sin facturación (≤${money(p.th)}): ${r1.length}. Facturación (>${money(p.th)}) sin km: ${r2.length}.`,
   table:{cols:['Facturación sin km: driver','Días'],rows:top(r2)},meta:{regla:'Se conservan como excepciones separadas para auditoría.',universo:`${a.length} asistencias, ${PER}`}};}},
P11:{name:'ranking_unidades_km',label:'Unidades con más o menos km',q:'¿Qué unidades recorrieron más kilómetros?',run(p){
  const k=A.filter(r=>r.km>=50&&r.km<=500&&r.pl),s=[...groupBy(k,r=>r.pl)].map(([pl,q])=>[pl,sum(q.map(r=>r.km)),q.length]).filter(x=>!p.low||x[2]>=3).sort((a,b)=>p.low?a[1]-b[1]:b[1]-a[1]);
  return {head:`Las ${p.topN} unidades con ${p.low?'menos':'más'} km (jornadas de 50 a 500 km):`,table:{cols:['Placa','Km','Jornadas'],rows:s.slice(0,p.topN).map(x=>[x[0],Math.round(x[1]).toLocaleString('en-US'),x[2]])},
   meta:{regla:'Jornadas entre 50 y 500 km; el resto se marca, no se borra.',universo:`${k.length} jornadas, ${PER}`},notas:p.low?['Solo unidades con 3 o más jornadas: con menos, el total de km no es comparable. Poca utilización no es lo mismo que mal desempeño.']:[]};}},
P12:{name:'rutas_sin_validar',label:'Sin validar por HubLeader',q:'¿Qué registros no fueron validados por el HubLeader?',run(p){
  const rt=A.filter(r=>r.km>0);return {head:`${rt.filter(r=>!r.vi).length} rutas sin validador de inicio y ${rt.filter(r=>!r.vf).length} sin validador de fin, de ${rt.length} rutas.`,
   table:{cols:['Falta validar','Rutas'],rows:[['Inicio',rt.filter(r=>!r.vi).length],['Fin',rt.filter(r=>!r.vf).length]]},
   meta:{regla:'Se usa valido_inicio y valido_fin; el campo Validacion_Ruta no se usa porque dice "No validada" en todas.',universo:`${rt.length} rutas con km`}};}},
P13:{name:'travelers_rendimiento',label:'Rendimiento Travelers',q:'¿Cuál es el rendimiento de los Travelers: promedio, mejor y peor?',run(p){
  const t=A.filter(r=>r.tv===1&&r.km>0).map(r=>({...r,kml:r.cb>0?(r.cb<5?100/r.cb:r.cb):null})),ok=t.filter(r=>r.kml!=null),at=ok.filter(r=>r.kml>150),ev=ok.filter(r=>r.kml<=150);
  const meta={regla:'Valor 0 = sin dato; valor < 5 = l/100 km, km/l = 100 ÷ valor; más de 150 km/l = atípico (se marca y no entra al promedio).',universo:`${t.length} registros Traveler con ruta`};
  const notas=[`${t.filter(r=>!(r.cb>0)).length} sin dato, ${t.filter(r=>r.cb>0&&r.cb<5).length} convertidos desde l/100 km y ${at.length} atípicos (más de 150 km/l) fuera del promedio.`];
  if(p.kml!=null){const b=ok.filter(r=>r.kml<p.kml);
    return {head:`${b.length} de ${ok.length} registros rinden menos de ${p.kml} km/l.`,table:{cols:['Placa','Fecha','Driver','km/l'],rows:b.map(r=>[r.pl,r.f,sev(r.s),r.kml.toFixed(1)])},meta,notas};}
  const v=ev.map(r=>r.kml),pl=[...groupBy(ev,r=>r.pl)].map(([k,q])=>({pl:k,m:mean(q.map(r=>r.kml)),n:q.length})).filter(x=>x.n>=3).sort((a,b)=>b.m-a.m);
  const best=ev.reduce((a,b)=>b.kml>a.kml?b:a),worst=ev.reduce((a,b)=>b.kml<a.kml?b:a),n=Math.min(p.topN,pl.length);
  const f1=x=>x.toFixed(1);
  let rows=[];const wb=p.wantBest,ww=p.wantWorst,both=(wb&&ww)||(!wb&&!ww);
  if(wb||both)pl.slice(0,n).forEach((x,i)=>rows.push([i+1,x.pl,f1(x.m),x.n]));
  if(ww||both)[...pl].reverse().slice(0,n).forEach((x,i)=>rows.push([pl.length-i,x.pl,f1(x.m),x.n]));
  return {head:`Rendimiento de Travelers: promedio ${f1(mean(v))} km/l, mediana ${f1(quantile(v,.5))}, P75 ${f1(quantile(v,.75))} (${ev.length} registros, ${new Set(ev.map(r=>r.pl)).size} placas).`,
   table:{cols:['Métrica','Valor'],rows:[['Promedio',f1(mean(v))+' km/l'],['Mediana',f1(quantile(v,.5))+' km/l'],['P75',f1(quantile(v,.75))+' km/l'],['Mejor registro',`${f1(best.kml)} km/l · ${best.pl} · ${sev(best.s)} · ${best.f}`],['Peor registro',`${f1(worst.kml)} km/l · ${worst.pl} · ${sev(worst.s)} · ${worst.f}`],['Registros bajo 10 km/l',ok.filter(r=>r.kml<10).length],['Atípicos (>150 km/l)',at.length]]},
   extra:[{title:'Placas (mínimo 3 registros): promedio de km/l',table:{cols:['Lugar','Placa','km/l promedio','Registros'],rows}}],
   meta,notas:notas.concat(['Para ver solo los que rinden menos de un valor, pregunta por ejemplo "Travelers con rendimiento menor a 10 km/l".'])};}},
P14:{name:'km_promedio_submarca',label:'Km promedio por submarca',q:'¿Cuál es el km promedio por submarca?',run(p){
  const k=A.filter(r=>r.km>=50&&r.km<=500&&r.sb),s=[...groupBy(k,r=>r.sb)].map(([sb,q])=>[sb,mean(q.map(r=>r.km)),q.length]).sort((a,b)=>b[2]-a[2]);
  return {head:'Km promedio por jornada y submarca:',table:{cols:['Submarca','Km promedio','Registros'],rows:s.slice(0,8).map(x=>[x[0],fmt1(x[1]),x[2]])},
   meta:{regla:'Excluye 0 km, menos de 50 y más de 500.',universo:`${k.length} jornadas`},notas:[`Excluidos: ${A.filter(r=>r.km===0).length} con 0 km, ${A.filter(r=>r.km>0&&r.km<50).length} con menos de 50 y ${A.filter(r=>r.km>500).length} con más de 500.`]};}},
P15:{name:'top_bottom_categoria',label:'Top y bottom por categoría',q:'¿Cuál es el top 5 y bottom 5 por categoría (Premier, Express, FLEX)?',run(p){
  const v=valid(p.th),rows=[];let tot=[];
  for(const gr of ['PREMIER','EXPRESS','FLEX']){if(p.cat&&gr!==p.cat)continue;const s=perDriver(v.filter(r=>grupo(r)===gr)).filter(x=>x.n>=p.minJ).sort((a,b)=>b.mean-a.mean);tot.push(`${gr} ${s.length}`);
    s.slice(0,p.topN).forEach((x,i)=>rows.push([gr,'Top '+(i+1),sev(x.s),money(x.mean),x.n]));[...s].reverse().slice(0,p.topN).forEach((x,i)=>rows.push([gr,'Bottom '+(i+1),sev(x.s),money(x.mean),x.n]));}
  return {head:`Top ${p.topN} y bottom ${p.topN} por categoría (drivers elegibles: ${tot.join(', ')}).`,table:{cols:['Categoría','Lugar','Driver','Promedio','Jornadas'],rows},
   meta:{regla:rule(p.th)+`; mínimo ${p.minJ} jornadas.`,universo:`${v.length} jornadas válidas`},notas:['FLEX tiene pocos drivers elegibles: top y bottom se traslapan.']};}},
P16:{name:'ingreso_total_promedio',label:'Ingreso total y promedio',q:'¿Cuál es el ingreso total y el ingreso promedio por driver?',fin:true,run(p){
  const tot=sum(A.map(r=>r.g)),ent=sum(A.filter(r=>r.en).map(r=>r.g)),dr=A.filter(r=>!r.en),m=groupBy(dr,r=>r.ct),v=valid(p.th);
  const rows=[...m].map(([c,q])=>[c,money(sum(q.map(r=>r.g))),new Set(q.map(r=>r.d)).size,money(sum(q.map(r=>r.g))/new Set(q.map(r=>r.d)).size)]).sort((a,b)=>parseInt(b[1].replace(/\D/g,''))-parseInt(a[1].replace(/\D/g,'')));
  const d=perDriver(v);
  return {head:`Ingreso total oficial ${money(tot)}; sin la entidad 'SEVIA Mobility FLEET' (${money(ent)}) los drivers suman ${money(tot-ent)}. Promedio con regla v2: ${money(mean(v.map(r=>r.g)))} diario y ${money(mean(d.map(x=>x.sum)))} semanal por driver.`,
   table:{cols:['Categoría','Total','Drivers','Por driver (semana)'],rows},
   meta:{regla:'Total oficial de Fleet; promedios con '+REGLA+` (ingreso > ${money(p.th)}).`,universo:`${A.length} filas, ${PER}`},notas:["'Sin categoría' son drivers sin cruce con el Maestro (se deja así por ahora)."]};}},
P17:{name:'dias_sin_registro',label:'Días sin registro',q:'¿Qué drivers tienen días sin registro?',run(p){
  const f=DSR.map(([s,e,r])=>({s,e,r,f:Math.max(e-r,0)})),con=f.filter(x=>x.f>0).sort((a,b)=>b.f-a.f),ev=A.filter(r=>r.s!=null&&!r.t);
  return {head:`${con.length} de ${f.length} drivers tienen al menos un día sin registro: ${sum(f.map(x=>x.f))} de ${sum(f.map(x=>x.e))} días esperados (${Math.round(sum(f.map(x=>x.f))/sum(f.map(x=>x.e))*100)}%). Además, ${ev.length} filas con SEV traen ingreso Fleet sin registro en la app (${ev.filter(r=>r.g>p.th).length} con ingreso > ${money(p.th)}).`,
   table:{cols:['Driver','Días esperados','Registrados','Sin registro'],rows:con.slice(0,p.topN).map(x=>[sev(x.s),x.e,x.r,x.f])},
   meta:{regla:'Se esperan 7 registros por semana, ajustados por fecha de ingreso y baja; excluye Operaciones y bajas.',universo:`${f.length} drivers, ${PER}`},notas:['Solo ve drivers con alguna fila en el consolidado. Un registro faltante con evidencia de ingreso es omisión administrativa de alta prioridad.']};}}
};

INTENTS.P18={name:'ingreso_semanal_driver',label:'Ingreso semanal del driver',q:'¿Cuál fue el ingreso semanal del driver #62?',run(p){
  const all=drivers({th:p.th},{op:true}),x=p.id!=null?all.find(d=>d.rows.some(r=>r.s===p.id)):null;
  if(p.id==null){const r=rankW({...p,topN:5,umbral:null,mas:null});return {head:'Dime el número de driver, por ejemplo: "ingreso semanal del driver #62". Mientras tanto, los 5 con mayor ingreso semanal:',
    table:{cols:['Driver','Ingreso semanal','Jornadas válidas'],rows:r.e.slice(0,5).map(d=>[dlabel(d),money(d.total),d.v])},meta:{regla:'Ingreso semanal = suma de la facturación oficial de todos sus días.',universo:`${r.all} drivers elegibles`}};}
  if(!x)return {head:`No encontré al driver ${sev(p.id)} en esta semana.`,table:null,meta:{regla:'—',universo:PER}};
  const r=rankW({th:p.th,minJ:p.minJ,by:'total'}).e,pos=r.findIndex(d=>d===x||d.rows[0]===x.rows[0])+1;
  const rows=[...x.rows].sort((a,b)=>a.f<b.f?-1:1).map(r=>[r.f,r.t||'Sin registro en app',r.km!=null?r.km:'—',money(r.g),r.au]);
  const rank=x.op?'Es personal de Operaciones: no entra a los rankings de desempeño.':(pos?`Lugar ${pos} de ${r.length} por ingreso semanal (${x.cat}).`:`No entra al ranking (menos de ${p.minJ} jornadas válidas).`);
  return {head:`Driver ${sev(p.id)}: ingreso semanal ${money(x.total)} en ${x.dias} días con ingreso. ${rank}`,
   table:{cols:['Fecha','Registro','Km','Ingreso oficial','Auditoría'],rows},
   meta:{regla:'Ingreso semanal = suma de la facturación oficial (Fleet cuando existe) de todos sus días de la semana, incluidos los registrados como Descanso u otros.',universo:`${x.rows.length} filas del driver, ${PER}`},
   notas:[`Jornadas válidas (${REGLA}): ${x.v}${x.avg!=null?', promedio por jornada '+money(x.avg):''}.`]};}};
INTENTS.P19={name:'ranking_ingreso_semanal',label:'Mejor y peor por ingreso semanal',q:'¿Quién fue el mejor y el peor driver por ingreso semanal?',run(p){
  const r=rankW(p),e=r.e,by=r.by,lab=by==='avg'?'promedio por jornada válida':'ingreso semanal',val=d=>money(d[by]);
  const row=(d,i)=>[i,dlabel(d),d.cat,money(d.total),d.v,d.avg!=null?money(d.avg):'—'];
  const n=Math.min(p.topN,e.length),top=e.slice(0,n),bot=e.slice(-n).reverse(),wb=p.wantBest,ww=p.wantWorst,both=(wb&&ww)||(!wb&&!ww);
  const st=e.length?`Promedio ${money(mean(e.map(d=>d[by])))}, mediana ${money(quantile(e.map(d=>d[by]),.5))}, P75 ${money(quantile(e.map(d=>d[by]),.75))}.`:'';
  let head;
  if(p.umbral!=null||p.mas!=null)head=`${e.length} de ${r.all} drivers ${p.umbral!=null?'con '+lab+' menor a '+money(p.umbral):'con '+lab+' mayor a '+money(p.mas)}.`;
  else head=e.length?`Mejor: ${dlabel(e[0])} con ${val(e[0])}. Peor: ${dlabel(e[e.length-1])} con ${val(e[e.length-1])}. ${st}`:'Ningún driver cumple el criterio.';
  const rows=(p.umbral!=null||p.mas!=null)?e.slice(0,Math.max(p.topN,10)).map((d,i)=>row(d,i+1)):[...((wb||both)?top.map((d,i)=>row(d,i+1)):[]),...((ww||both)?bot.map((d,i)=>row(d,e.length-i)):[])];
  return {head,table:{cols:['Lugar','Driver','Categoría','Ingreso semanal','Jornadas válidas','Prom. por jornada'],rows},
   meta:{regla:`${by==='avg'?'Promedio por jornada válida':'Ingreso semanal = suma de la facturación oficial de todos sus días'}; elegibles: ≥${p.minJ} jornadas válidas (${REGLA}, ingreso > ${money(p.th)}); sin Operaciones ni la entidad 'SEVIA Mobility FLEET'.`,universo:`${r.all} drivers elegibles, ${PER}`},
   notas:['El ingreso semanal favorece a quien trabajó más días; para comparar de forma justa usa también el promedio por jornada. Pídelo con "por jornada" o "promedio diario".']};}};

/* ---- Consultas 20 a 22: unidades por submarca, ingreso por km y reporte diario ---- */
let _cidBuilt=false;
function cid(r){if(!_cidBuilt){let i=0;for(const [,rows] of comps()){for(const x of rows)x._c=i;i++;}_cidBuilt=true;}return r._c;}
const money2=x=>'$'+x.toFixed(2);
const DIA3={DOMINGO:'Dom',LUNES:'Lun',MARTES:'Mar',MIERCOLES:'Mié',JUEVES:'Jue',VIERNES:'Vie',SABADO:'Sáb'};
INTENTS.P20={name:'unidades_por_submarca',label:'Unidades por submarca',q:'¿Cuántas unidades hay por submarca?',run(p){
  const k=A.filter(r=>r.pl&&r.sb),m=groupBy(k,r=>r.sb);
  const rows=[...m].map(([sb,q])=>{const u=new Set(q.map(r=>r.pl)).size;return [sb,u,q.length,(q.length/u).toFixed(1)];}).sort((a,b)=>b[1]-a[1]);
  const tot=new Set(k.map(r=>r.pl)).size;
  return {head:`${tot} unidades con ruta registrada en la semana. La submarca con más unidades es ${rows[0][0]} (${rows[0][1]}).`,
   table:{cols:['Submarca','Unidades','Jornadas','Jornadas por unidad'],rows},
   meta:{regla:'Unidades = placas distintas con ruta registrada, agrupadas por submarca.',universo:`${k.length} jornadas con placa, ${PER}`},
   notas:['Solo cuenta unidades que tuvieron al menos una ruta en la semana; la flota completa requiere el catálogo de unidades.']};}};
INTENTS.P21={name:'ingreso_por_km_submarca',label:'Ingreso por km por submarca',q:'¿Cuál es el ingreso por km estimado por submarca?',run(p){
  const k=A.filter(r=>r.km>=50&&r.km<=500&&r.g>0&&r.sb),m=groupBy(k,r=>r.sb);
  const rows=[...m].map(([sb,q])=>{const i=sum(q.map(r=>r.g)),km=sum(q.map(r=>r.km));return {sb,i,km,n:q.length,r:i/km};}).sort((a,b)=>b.r-a.r);
  const ti=sum(k.map(r=>r.g)),tk=sum(k.map(r=>r.km));
  return {head:`Ingreso por km estimado: ${money2(ti/tk)} en total. Mayor: ${rows[0].sb} (${money2(rows[0].r)}/km). Menor: ${rows[rows.length-1].sb} (${money2(rows[rows.length-1].r)}/km).`,
   table:{cols:['Submarca','Ingreso por km','Ingreso','Km','Jornadas'],rows:rows.map(x=>[x.sb,money2(x.r),money(x.i),Math.round(x.km).toLocaleString('en-US'),x.n])},
   meta:{regla:'Ingreso por km = suma del ingreso oficial ÷ suma de km, en jornadas de 50 a 500 km con ingreso mayor a 0.',universo:`${k.length} jornadas, ${PER}`},
   notas:['Es una estimación: el ingreso del día puede incluir viajes fuera de la ruta registrada.']};}};
INTENTS.P22={name:'reporte_ingresos_diario',label:'Reporte de ingresos por día',q:'Reporte de ingresos por día: asistencias, ingresos, promedio por driver y acumulado',run(p){
  let rows=A.filter(r=>!r.en);if(p.cat)rows=rows.filter(r=>grupo(r)===p.cat);
  const m=groupBy(rows,r=>r.f),fechas=[...m.keys()].sort(),out=[],dias=[];let acc=0;
  for(const f of fechas){const q=m.get(f),as=q.filter(r=>r.t==='Asistencia'||r.t==='Día extra').length,tot=sum(q.map(r=>r.g)),dr=new Set(q.filter(r=>r.g>0&&r.d!=null||r.g>0&&r.s!=null).map(cid)).size;
    acc+=tot;dias.push({f,tot});out.push([`${f} · ${DIA3[dow(f)]}`,as,money(tot),dr?money(tot/dr):'—',money(acc)]);}
  const T=sum(rows.map(r=>r.g)),AS=rows.filter(r=>r.t==='Asistencia'||r.t==='Día extra').length,DR=new Set(rows.filter(r=>r.g>0&&(r.d!=null||r.s!=null)).map(cid)).size;
  out.push(['Total semana',AS,money(T),DR?money(T/DR):'—',money(acc)]);
  const best=dias.reduce((a,b)=>b.tot>a.tot?b:a),worst=dias.reduce((a,b)=>b.tot<a.tot?b:a),ent=sum(A.filter(r=>r.en).map(r=>r.g));
  return {head:`Ingresos de la semana: ${money(T)} en ${AS} asistencias; promedio por driver ${money(T/DR)}. Mejor día: ${best.f} (${money(best.tot)}). Peor: ${worst.f} (${money(worst.tot)}).`,
   table:{cols:['Fecha','Asistencias','Total ingresos','Prom. por driver','Acumulado'],rows:out},
   meta:{regla:'Asistencias = registros tipo Asistencia o Día extra. Total = facturación oficial del día (Fleet cuando existe). Promedio por driver = total ÷ drivers con ingreso ese día. Acumulado = suma corrida de los totales.',universo:`${rows.length} filas, ${PER}`},
   notas:ent?[`Excluye la entidad 'SEVIA Mobility FLEET' (${money(ent)} en la semana), que no es un driver.`,'Incluye ingresos de días sin registro en la app (solo Fleet).']:['Incluye ingresos de días sin registro en la app (solo Fleet).']};}};

/* Router: simula la clasificación de intención que haría un modelo barato */
function parse(q){const t=norm(q),p={th:TH_DEF,topN:5,minJ:3,cat:null,umbral:null,kml:null,warn:[]};
  let m=t.match(/(?:top|primeros|mejores|peores|bottom|ultimos)\s*(\d{1,2})/)||t.match(/(\d{1,2})\s*(?:mejores|peores|drivers|unidades|placas)/);if(m)p.topN=Math.min(parseInt(m[1]),20);
  m=t.match(/(?:menos de|menor a|menores a|menor que|debajo de|bajo de|<)\s*\$?\s*([\d][\d,\.]*)/);if(m){const v=parseFloat(m[1].replace(/,/g,''));if(/km\s*\/\s*l|rendimiento/.test(t))p.kml=v;else p.umbral=v;}
  const exFlex=/(sin|excluy\w*|excepto|menos|quitando|sacando)\s+(a\s+)?(los\s+)?(drivers\s+)?flex/.test(t);
  const cats=[];if(/premier/.test(t)&&!/no premier/.test(t))cats.push('PREMIER');if(/express/.test(t))cats.push('EXPRESS');if(/flex/.test(t)&&!exFlex)cats.push('FLEX');
  p.cat=cats.length===1?cats[0]:null;p.exFlex=exFlex;
  m=t.match(/(?:driver|conductor|sev|numero|num|no\.?|#)\s*[-#:]?\s*0*(\d{1,3})\b/);p.id=m?parseInt(m[1]):null;
  m=t.match(/(?:mas de|mayor(?:es)? a|arriba de|por encima de|>)\s*\$?\s*([\d][\d,\.]*)/);p.mas=m?parseFloat(m[1].replace(/,/g,'')):null;
  p.by=/(promedio|por dia|diario|por jornada)/.test(t)?'avg':'total';
  p.wantBest=/(mejor|mejores|top|primeros)/.test(t);p.wantWorst=/(peor|peores|bottom|ultimos|mas bajos|menor desempeno)/.test(t);p.low=p.wantWorst||/(menos km|menos kilometr|menor km|menos recorr|minim)/.test(t);
  m=t.match(/(?:ingreso|facturacion)[^\d$]*(?:mayor(?:es)? a|>)\s*\$?\s*(\d[\d,]*)/);if(m&&!/(semanal|de la semana|por semana)/.test(t))p.th=parseFloat(m[1].replace(/,/g,''));
  if(/\b(mes|mensual|septiembre|agosto|julio|semana pasada|anterior|ayer|hoy)\b/.test(t))p.warn.push('Por ahora solo tengo la semana '+PER+'.');
  if(p.id!=null&&/(top|mejores|peores|bottom)\s*\d/.test(t))p.id=null;
  return p;}
function route(q){const t=norm(q);
  const has=re=>re.test(t);
  if(has(/(fleet|corte|dash)/)&&has(/(solo|unicamente|sin coincid|no aparec|faltan)/))return 'P02';
  if(has(/(fleet|corte|dash)/)&&has(/(diferenc|difier|audit|compar|cuadr|coincid)/))return 'P01';
  const hasId=/(?:driver|conductor|sev|numero|num|no\.?|#)\s*[-#:]?\s*0*\d{1,3}\b/.test(t);
  if(hasId&&has(/(ingreso|facturacion|gano|genero|cuanto|semanal|semana|detalle|dias)/)&&!has(/(unidad|placa|top\s*\d|bottom)/))return 'P18';
  if(has(/(semanal|de la semana|por semana)/)&&has(/(ingreso|facturacion|gano|genero|mejor|peor|top|bottom|ranking|quien|menos de|mas de|mayor|menor)/)&&!has(/(mediana|p75|percentil|estadistic)/))return 'P19';
  if(has(/(quien|cual|que driver).*(mejor|peor)/)&&has(/(ingreso|facturacion|gano|genero)/))return 'P19';
  if((has(/(reporte|resumen|desglose|detalle|acumulado|evolucion)/)&&has(/(ingreso|facturacion)/)&&has(/(dia|fecha|diario)/))||has(/(ingresos?|facturacion)\s+(por|de cada|cada)\s+(dia|fecha)/)||has(/acumulado/))return 'P22';
  if(has(/(bottom|peores|ultimos|mas bajos)/)&&has(/(premier|express|flex|categoria)/)||has(/top\s*\d+\s*y\s*bottom/))return 'P15';
  if(has(/(travel|rendimiento|km\s*\/\s*l|combustible)/))return 'P13';
  if(has(/(ingreso|facturacion|pesos)/)&&has(/(por|x|\/)\s*(km|kilometro)/))return 'P21';
  if(has(/(unidad|placa|vehiculo|flota)/)&&has(/(submarca|modelo)/)&&has(/(cuant|cantidad|numero|total|hay|tenemos)/))return 'P20';
  if(has(/submarca|modelo/))return 'P14';
  if(has(/(sin registro|omision|omitid.*registro|no registr)/))return 'P17';
  if(has(/(dia|dias)\s*extra|extras/))return 'P09';
  if(has(/descanso/))return 'P08';
  if(has(/(falta|permiso|incapacidad|motivo)/))return 'P07';
  if(has(/(hubleader|hub leader|validad|sin validar)/))return 'P12';
  if(has(/(ruta pero sin|sin facturacion|facturacion sin|sin km|con ruta)/))return 'P10';
  if(has(/(unidad|placa|vehiculo)/)&&has(/(km|kilometr|recorr|peor|mejor|top|menos|mas)/))return 'P11';
  if(has(/(ingreso total|facturacion total|ingreso promedio|promedio por driver|cuanto (se )?factur|total de ingreso)/))return 'P16';
  if(has(/(menos de|menor a|debajo de|bajo de|promedian menos|<)/)&&has(/(\$|promed|driver)/))return 'P04';
  if(has(/(mejor|top|ranking|primeros|peor|bottom|ultimos|mas bajos)/)&&has(/(driver|conductor|chofer)/)||has(/(mejores|peores)/))return 'P03';
  if(has(/(compar|premier|express|flex|categoria)/))return 'P06';
  if(has(/(promedio|mediana|p75|percentil|estadistic)/))return 'P05';
  return null;}
INTENTS.P06.partial=true;INTENTS.P08.partial=true;
/* Carga de datos (el archivo JSON se genera con scripts/preparar_datos.py; no se guarda en el repositorio) */
function setData(d){A=d.rows;DSR=d.dsr||[];PER=(d.meta&&d.meta.periodo)||'';_wk=null;
  try{const t=rankW({th:TH_DEF,minJ:3,by:'total'}).e.find(x=>x.s!=null);if(t)INTENTS.P18.q='¿Cuál fue el ingreso semanal del driver #'+t.s+'?';}catch(e){}}
if(typeof module!=='undefined')module.exports={INTENTS,route,parse,setData,TH_DEF,REGLA};
