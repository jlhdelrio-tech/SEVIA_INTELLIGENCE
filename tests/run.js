// Verifica que todas las consultas del catálogo corren con los datos de demostración y que el router acierta.
const fs = require('fs'), path = require('path');
const core = require('../assets/core.js');
core.setData(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data.demo.json'), 'utf8')));
let fallas = 0;
for (const id of Object.keys(core.INTENTS)) {
  try {
    const I = core.INTENTS[id], r = I.run(core.parse(I.q));
    if (!r || typeof r.head !== 'string' || !r.head.length) throw new Error('sin respuesta');
  } catch (e) { fallas++; console.error('FALLA consulta', id, e.message); }
}
const casos = [
  ['diferencias entre fleet y corte', 'P01'], ['registros solo en fleet', 'P02'], ['mejores drivers', 'P03'],
  ['peores drivers', 'P03'], ['quienes promedian menos de $1,500', 'P04'], ['promedio, mediana y p75', 'P05'],
  ['cuantas faltas y permisos hubo', 'P07'], ['quien trabajo en su dia de descanso', 'P08'], ['dias extra', 'P09'],
  ['unidades con mas kilometros', 'P11'], ['rutas sin validar por el hubleader', 'P12'],
  ['rendimiento de las traveler', 'P13'], ['km promedio por submarca', 'P14'], ['top 5 y bottom 5 por categoria', 'P15'],
  ['ingreso total', 'P16'], ['dias sin registro', 'P17'], ['ingreso semanal del driver #5', 'P18'],
  ['quien fue el mejor y el peor driver por ingreso semanal', 'P19'], ['cuantas unidades hay por submarca', 'P20'], ['ingreso por km por submarca', 'P21'], ['reporte de ingresos por dia con acumulado', 'P22'], ['km promedio por submarca', 'P14'], ['dame el clima', null]];
for (const [q, esp] of casos) {
  const got = core.route(q);
  if (got !== esp) { fallas++; console.error(`FALLA router: "${q}" -> ${got} (esperado ${esp})`); }
}
console.log(fallas ? `${fallas} fallas` : `OK · ${Object.keys(core.INTENTS).length} consultas y ${casos.length} casos de router`);
process.exit(fallas ? 1 : 0);
