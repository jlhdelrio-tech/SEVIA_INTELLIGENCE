# SEVIA Intelligence · Simulador de prueba

Chat de prueba que **simula la IA** de SEVIA Intelligence: reconoce la pregunta, la liga a una consulta del catálogo (22 preguntas) y calcula la respuesta con tus datos del Consolidado y del Maestro de Drivers. Sirve para validar reglas y cifras antes de conectar una IA real (Vertex AI, etc.).

> **Privacidad:** este repositorio contiene solo código. Tus datos reales **no se suben a GitHub**: se cargan desde un archivo `.json` en tu propio dispositivo y se guardan solo en ese navegador.

## Estructura

```
index.html                 página del chat
assets/core.js             consultas del catálogo y reglas (productividad_v2, umbral $300)
assets/app.js              interfaz (chat, perfiles Admin/Usuario, registro de pruebas)
assets/styles.css          estilos (claro/oscuro)
data.demo.json             datos SINTÉTICOS de demostración
scripts/preparar_datos.py  convierte tu Consolidado + Maestro en datos.json (anonimizado)
scripts/generar_demo.py    regenera los datos de demostración
tests/run.js               verifica consultas y router (corre en GitHub Actions)
.github/workflows/pages.yml  publica en GitHub Pages
```

## 1. Preparar tus datos (en tu computadora)

Requiere Python 3 con `pandas` y `openpyxl` (`pip install pandas openpyxl`).

```bash
python scripts/preparar_datos.py \
  --consolidado CONSOLIDADO_SEVIA_2026-09-28_a_2026-10-04_MATCH_REFORZADO.xlsx \
  --maestro drivers.xlsx \
  --salida datos.json
```

- Del Maestro solo lee columnas **no personales**: nombre (para cruzar), estatus, categoría, turno, día de descanso y fechas. Nunca lee CURP, RFC, NSS, CLABE ni documentos.
- El resultado no lleva nombres: solo ID SEV y un número interno anónimo.
- `datos.json` está en `.gitignore`: **no lo subas**.

## 2. Subirlo a GitHub

Con la terminal:

```bash
git init
git add .
git commit -m "SEVIA Intelligence: simulador de prueba"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/sevia-intelligence.git
git push -u origin main
```

O desde la web: crea el repositorio `sevia-intelligence` y arrastra todo el contenido (incluida la carpeta oculta `.github`).

## 3. Activar GitHub Pages

1. En el repositorio: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Ve a **Actions → Publicar en GitHub Pages → Run workflow** (o haz un nuevo push).
3. Tu página queda en `https://TU_USUARIO.github.io/sevia-intelligence/`.

Si el primer despliegue falla en `configure-pages`, es que Pages aún no estaba activado: actívalo (paso 1) y vuelve a correr el workflow.

## 4. Usarla

1. Abre la página y toca **Cargar mi archivo de datos (.json)**; elige `datos.json`. Queda guardado en ese dispositivo (botón **Datos** para cambiarlo o borrarlo). También puedes probar con **Usar datos de demostración**.
2. Toca una pregunta sugerida o escribe con tus palabras: "peores drivers", "ingreso semanal del driver #62", "rendimiento de las traveler", "mejor y peor por ingreso semanal por jornada", "cuántas unidades hay por submarca", "ingreso por km por submarca", "reporte de ingresos por día con acumulado"…
3. Marca 👍 o 👎 en cada respuesta. El botón **Registro** (solo Admin) muestra las preguntas hechas, las solicitudes de análisis y un texto copiable.

Cada semana: genera un `datos.json` nuevo con el script y cárgalo; no hay que volver a publicar.

## Privacidad: lo que debes saber

- **GitHub Pages es público**, incluso si el repositorio es privado (salvo planes Enterprise con Pages privado; verifica tu plan). Por eso la página no trae datos reales: cualquiera que abra la URL ve solo la pantalla de carga y los datos sintéticos.
- La página tiene `noindex` para que los buscadores no la listen.
- Los datos cargados viven en el almacenamiento del navegador de ese dispositivo. El botón **Datos → Borrar datos de este dispositivo** los elimina.
- Los perfiles Admin/Usuario de esta prueba son de demostración y **no son seguridad real**: cualquiera puede cambiar el selector. Para uso real, los roles deben venir de la app operativa (Firebase Auth) y la consulta debe hacerse en un servidor.

## Reglas principales (assets/core.js)

- Jornada válida (`productividad_v2`): Asistencia + km > 0 + ingreso oficial > $300 (parámetro `TH_DEF`).
- Se excluyen Operaciones y la entidad "SEVIA Mobility FLEET" de los comparativos de desempeño.
- Rankings: mínimo 3 jornadas válidas.
- Combustible: valor 0 = sin dato; valor < 5 = l/100 km (km/l = 100 ÷ valor); más de 150 km/l = atípico.
- Ingreso semanal = suma de la facturación oficial de todos los días del driver.

## Siguiente fase

Reemplazar el router por una IA real (clasificación de intención con un modelo barato) y los cálculos locales por vistas de BigQuery, manteniendo el mismo catálogo de preguntas y reglas versionadas.
