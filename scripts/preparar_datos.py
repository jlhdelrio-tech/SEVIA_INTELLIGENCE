#!/usr/bin/env python3
"""Convierte el Consolidado y el Maestro de Drivers en un JSON anonimizado para el simulador.

Uso:
  python scripts/preparar_datos.py --consolidado CONSOLIDADO.xlsx --maestro drivers.xlsx --salida datos.json

- Solo lee del Maestro las columnas NO personales (nombre, estatus, categoría, turno, descanso y fechas).
- No escribe nombres: cada persona queda como ID SEV y como un número interno anónimo.
- El archivo resultante NO debe subirse a GitHub (ya está en .gitignore). Se carga desde la página.
"""
import argparse, json, re, sys, unicodedata
from datetime import date
import numpy as np
import pandas as pd

MAESTRO_COLS = ['Nombre', 'Turno asignado', 'CATEGORIA', 'Nombre_Driver_Fleet', 'Dia de descanso',
                'STATUS', 'Fecha_ingreso', 'Fecha_Baja']
CONS_COLS = ['fecha', 'num_empleado', 'Nombre_SEVIA', 'Nombre_Fleet_Original', 'registro_tipo', 'registro_comentario',
             'km_recorridos', 'Total_Oficial_Facturacion', 'Auditoria_Ingresos', 'Total_Corte', 'Total_Fleet', 'turno',
             'submarca', 'placa', 'traveler', 'consumo_combustible', 'valido_inicio', 'valido_fin']
MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']


def norm(s):
    if pd.isna(s):
        return None
    s = unicodedata.normalize('NFD', str(s)).encode('ascii', 'ignore').decode().upper()
    return re.sub(r'\s+', ' ', re.sub(r'[^A-Z0-9 ]', ' ', s)).strip()


def nz(x, r=2):
    return None if pd.isna(x) else round(float(x), r)


def exigir(df, cols, nombre):
    falta = [c for c in cols if c not in df.columns]
    if falta:
        sys.exit(f"Al archivo {nombre} le faltan columnas: {', '.join(falta)}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--consolidado', required=True)
    ap.add_argument('--maestro', required=True)
    ap.add_argument('--hoja', default='CONSOLIDADO')
    ap.add_argument('--salida', default='datos.json')
    a = ap.parse_args()

    c = pd.read_excel(a.consolidado, sheet_name=a.hoja)
    exigir(c, CONS_COLS, 'consolidado')
    hdr = pd.read_excel(a.maestro, nrows=0)
    exigir(hdr, MAESTRO_COLS, 'maestro')
    d = pd.read_excel(a.maestro, usecols=MAESTRO_COLS)  # nunca se leen CURP, RFC, NSS, CLABE, etc.

    d['k1'] = d.Nombre.map(norm)
    d['k2'] = d.Nombre_Driver_Fleet.map(norm)
    mp, mp1 = {}, {}
    for _, r in d.iterrows():
        if r.k1 and r.k1 not in mp1:
            mp1[r.k1] = r
        for k in (r.k1, r.k2):
            if k and k not in mp:
                mp[k] = r

    c['k'] = c.Nombre_SEVIA.map(norm).fillna(c.Nombre_Fleet_Original.map(norm))
    c['cat'] = c.k.map(lambda k: mp[k].CATEGORIA if k in mp else None).fillna('SIN CATEGORÍA')
    c['op'] = c.k.map(lambda k: (str(mp[k]['Turno asignado']).upper() == 'OPERACIONES') if k in mp else False)
    c['dc'] = c.k.map(lambda k: norm(mp[k]['Dia de descanso']) if k in mp else None)
    c['en'] = c.Nombre_Fleet_Original.astype(str).str.startswith('SEVIA Mobility')
    kid = {k: i for i, k in enumerate(sorted(x for x in c.k.dropna().unique()))}

    rows = []
    for _, r in c.iterrows():
        rows.append(dict(
            f=str(r.fecha)[:10], s=(int(str(r.num_empleado)[-6:]) if pd.notna(r.num_empleado) else None),
            d=(kid.get(r.k) if r.k else None), t=(None if pd.isna(r.registro_tipo) else r.registro_tipo),
            km=nz(r.km_recorridos, 1), g=nz(r.Total_Oficial_Facturacion), au=r.Auditoria_Ingresos,
            co=nz(r.Total_Corte), fl=nz(r.Total_Fleet), tu=(None if pd.isna(r.turno) else r.turno), ct=r['cat'],
            op=int(bool(r.op)), en=int(bool(r.en)), sb=(None if pd.isna(r.submarca) else r.submarca),
            pl=(None if pd.isna(r.placa) else r.placa),
            tv=(None if pd.isna(r.traveler) else (1 if str(r.traveler).lower() in ('sí', 'si') else 0)),
            cb=nz(r.consumo_combustible, 1), vi=int(pd.notna(r.valido_inicio)), vf=int(pd.notna(r.valido_fin)),
            cm=int(pd.notna(r.registro_comentario)), dc=(None if pd.isna(r.dc) else r.dc)))

    # días esperados vs registrados por driver (ajustado por ingreso y baja)
    c['k'] = c.Nombre_SEVIA.map(norm)
    c['ing'] = pd.to_datetime(c.k.map(lambda k: mp1[k].Fecha_ingreso if k in mp1 else None), errors='coerce')
    c['baf'] = pd.to_datetime(c.k.map(lambda k: mp1[k].Fecha_Baja if k in mp1 else None), errors='coerce')
    c['st'] = c.k.map(lambda k: mp1[k].STATUS if k in mp1 else None)
    c['op1'] = c.k.map(lambda k: (str(mp1[k]['Turno asignado']).upper() == 'OPERACIONES') if k in mp1 else False)
    c['f2'] = pd.to_datetime(c.fecha)
    ini, fin = c.f2.min().normalize(), c.f2.max().normalize()
    dsr = []
    for sev, q in c[c.num_empleado.notna() & (c.st != 'Baja') & (c.op1 != True)].groupby('num_empleado'):  # noqa: E712
        ing = q.ing.dropna().min() if q.ing.notna().any() else pd.NaT
        baf = q.baf.dropna().min() if q.baf.notna().any() else pd.NaT
        x = max(ini, ing) if pd.notna(ing) else ini
        y = min(fin, baf) if pd.notna(baf) else fin
        if y < x:
            continue
        dsr.append([int(str(sev)[-6:]), (y - x).days + 1, int(q[q.registro_tipo.notna()].f2.dt.normalize().nunique())])

    periodo = f"{ini.day} {MESES[ini.month-1]} – {fin.day} {MESES[fin.month-1]} {fin.year}"
    out = {'meta': {'periodo': periodo, 'generado': date.today().isoformat(), 'filas': len(rows)}, 'rows': rows, 'dsr': dsr}
    with open(a.salida, 'w', encoding='utf-8') as fh:
        json.dump(out, fh, separators=(',', ':'), ensure_ascii=False)
    print(f"OK · {len(rows)} filas · {len(dsr)} drivers · periodo {periodo} · {a.salida}")


if __name__ == '__main__':
    main()
