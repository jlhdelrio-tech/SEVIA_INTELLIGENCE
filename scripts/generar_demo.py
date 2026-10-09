#!/usr/bin/env python3
"""Genera data.demo.json con datos SINTÉTICOS (no son reales). Uso: python scripts/generar_demo.py"""
import json, random
random.seed(7)
DIAS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO']
fechas = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']
dow = [DIAS[i] for i in range(7)]  # 28-sep-2026 es lunes
SUB = ['TRAVELER', 'TRAVELER', 'EJ7', 'EJ7', 'ESEI4', 'E30X', 'E10X']
placas = [f"{random.randint(40,89)}K{random.randint(100,999)}" for _ in range(28)]
rows, dsr = [], []
for i in range(1, 71):
    flex, op = i % 9 == 0, i % 14 == 0
    cat = random.choices(['PREMIER', 'EXPRESS', 'OTRO', 'SIN CATEGORÍA'], [.42, .38, .08, .12])[0]
    skill = random.gauss(1, .22) * (1.2 if cat == 'PREMIER' else 1)
    desc = random.choice(DIAS[:6]); tu = 'FLEX' if flex else ('OPERACIONES' if op else random.choice(['M1', 'V1', 'M3', 'V3', None]))
    sub = random.choice(SUB); pl = random.choice(placas); reg = 0
    for k, f in enumerate(fechas):
        t, g, km, au, co, fl = 'Asistencia', 0, None, 'SIN INFORMACIÓN FINANCIERA', None, None
        if dow[k] == desc: t = 'Descanso'
        else:
            r = random.random()
            t = 'Asistencia' if r < .86 else random.choice(['Falta', 'Permiso', 'Otros', 'Día extra'])
        if random.random() < .07: t = None; reg -= 1
        if t in ('Asistencia', 'Día extra'):
            g = max(0, round(random.gauss(1650, 520) * skill, 2)); km = round(max(0, random.gauss(135, 45)), 1)
            if random.random() < .06: km = None
            if random.random() < .02: km = round(random.uniform(520, 900), 1)
            fl = g; co = round(g * random.choice([1, 1, 1, .95, 1.05]), 2)
            au = random.choices(['COINCIDE', 'NO COINCIDE', 'SOLO CORTE'], [.86, .1, .04])[0]
            if au == 'SOLO CORTE': g = 0; fl = None
        elif t is None and random.random() < .5:
            g = round(random.gauss(1500, 400), 2); fl = g; au = 'SOLO FLEET'
        reg += 1 if t else 0
        tv = 1 if sub == 'TRAVELER' else 0; cb = None
        if tv and km:
            cb = random.choice([0, round(random.uniform(.8, 4.5), 1)] + [round(random.gauss(62, 22), 1) for _ in range(8)])
            if random.random() < .01: cb = 7.4
        rows.append(dict(f=f, s=i, d=i, t=t, km=km, g=round(g, 2), au=au, co=co, fl=fl, tu=tu, ct=cat, op=int(op), en=0,
                         sb=sub if km else None, pl=pl if km else None, tv=tv if km else None, cb=cb,
                         vi=int(random.random() > .03) if km else 0, vf=int(random.random() > .01) if km else 0,
                         cm=int(t in ('Permiso', 'Otros', 'Incapacidad') and random.random() < .5), dc=desc))
    if not op: dsr.append([i, 7, max(0, min(7, reg + 7 if reg < 0 else reg))])
rows.append(dict(f='2026-10-01', s=None, d=999, t=None, km=None, g=11000.0, au='SOLO FLEET', co=None, fl=11000.0, tu=None,
                 ct='SIN CATEGORÍA', op=0, en=1, sb=None, pl=None, tv=None, cb=None, vi=0, vf=0, cm=0, dc=None))
json.dump({'meta': {'periodo': 'Datos de demostración (sintéticos)', 'generado': 'demo', 'filas': len(rows)}, 'rows': rows, 'dsr': dsr},
          open('data.demo.json', 'w', encoding='utf-8'), separators=(',', ':'), ensure_ascii=False)
print('data.demo.json', len(rows), 'filas')
