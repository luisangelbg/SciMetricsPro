# SciMetricsPro

[![Licencia: GPL v3](https://img.shields.io/badge/Licencia-GPLv3-blue.svg)](LICENSE)

**Del análisis bibliométrico al artículo, sin programar.** Versión 1.0.0.

**Versión en línea:** https://luisangelbg.github.io/SciMetricsPro/ ·
**Manual de usuario (español):** [PDF](manual/SciMetricsPro%20User's%20Manual.pdf) ·
[HTML](https://luisangelbg.github.io/SciMetricsPro/manual/es/manual-completo.html)

Una aplicación web (HTML y JavaScript, sin instalación; también funciona sin conexión desde una copia local) que
lleva un conjunto de registros bibliográficos desde la búsqueda hasta las figuras y el texto del artículo:
ayuda a escribir la cadena de búsqueda, lee las exportaciones de las bases de datos, une los duplicados, normaliza
autores, instituciones y países, calcula los indicadores clásicos, dibuja las estructuras conceptual, intelectual
y social, registra una revisión sistemática PRISMA 2020 y entrega figuras a tamaño de revista, tablas, redes para
otros programas y un informe con el texto metodológico redactado con tus datos.

Cada indicador se calcula con su fórmula publicada y se validó contra implementaciones independientes.
Los datos se procesan **solo en tu computadora**: únicamente las búsquedas que decidas hacer en el catálogo
bibliográfico abierto salen a internet.

## Cómo abrirlo

1. **Doble clic en `index.html`.** No necesita instalación ni servidor: los datos de ejemplo y los idiomas van
   como archivos `.js`.
2. Para verlo con un servidor local (o desde una tableta en la misma red), clic derecho en **`server.ps1`** →
   *Ejecutar con PowerShell*, o doble clic en `Open SciMetricsPro.bat`. Abre `http://localhost:9100`.
   Si el puerto está ocupado: `powershell -ExecutionPolicy Bypass -File server.ps1 -Port 9101`.
3. La portada trae **datos de ejemplo** (300 obras sobre la nutrición mineral del maracuyá, metadatos de un
   catálogo bibliográfico abierto con licencia CC0) para recorrer toda la app con un clic.

## Qué hace

| Pantalla | Contenido |
|---|---|
| **Importar** | Cadena de búsqueda a partir del título de tu trabajo, con glosario y sintaxis de cada buscador; lectura de exportaciones en CSV, RIS, BibTeX, texto etiquetado y hojas de cálculo; descarga directa desde un catálogo bibliográfico abierto; tabla de campos disponibles y avisos de lo que falta. |
| **Limpieza y filtros** | Duplicados por DOI y por similitud de títulos, variantes de nombres de autor, instituciones y países con sus equivalencias, sinónimos y palabras vacías, y seis filtros globales. |
| **Panorama general** | Trece indicadores con su fórmula y su ayuda, producción anual, citas por año y tipos de documento. |
| **Fuentes** | Fuentes más productivas, ley de Bradford con sus tres zonas, índices h, g y m, y dinámica de producción. |
| **Autores** | Productividad completa y fraccionada, trayectorias, ley de Lotka con prueba de Kolmogorov-Smirnov, impacto, instituciones, países y mapa mundial. |
| **Documentos** | Documentos más citados, citas locales, referencias más citadas, espectroscopía de años de referencia (RPYS), palabras, crecimiento y temas en tendencia. |
| **Estructura conceptual** | Red de coocurrencia, ficha de cada término, mapa temático de Callon, evolución temática y análisis factorial (ACM o AC) con k-means y silueta. |
| **Estructura intelectual** | Cocitación de referencias, autores y fuentes; acoplamiento bibliográfico; mapa de acoplamiento; historiografía de citas directas. |
| **Estructura social** | Redes de colaboración de autores, instituciones y países; mapa mundial con arcos; cronología de la colaboración. |
| **Revisión sistemática** | Cribado con atajos de teclado, motivos de exclusión, diagrama de flujo PRISMA 2020 y análisis de solo los estudios incluidos. |
| **Exportar y reporte** | Figuras a 8.5 o 17 cm en PNG, TIFF, SVG o PDF; tablas en hoja de cálculo; redes en GraphML, GEXF y texto; el conjunto limpio en CSV y BibTeX; un paquete ZIP con índice; y un informe con metodología, resultados y referencias en documento de texto, PDF o página web. |

## Manual de usuario

El manual en español está en [`manual/`](manual/): 14 partes en HTML, el documento unido
(`manual/es/manual-completo.html`) y el PDF de 194 hojas. Explica cada pantalla con los datos de ejemplo,
con las cifras comprobadas fuera de la app, e incluye apéndices con los formatos de archivo, las fórmulas de
los indicadores con su referencia, un glosario español–inglés y la solución de los problemas más comunes.

## Pruebas

`tests/index.html` corre la suite completa (325 pruebas) en el navegador, sin instalar nada.

## Licencia y cómo citar

El programa se distribuye con la **Licencia Pública General de GNU, versión 3 o posterior**
([GPL-3.0-or-later](LICENSE)).

> Barrera-Guzmán, L. Á., y Ramírez-Ojeda, G. (2026). *SciMetricsPro: análisis bibliométrico y cienciométrico*
> (versión 1.0.0) [Software].

La página **Acerca de** de la app muestra la misma cita en texto y en BibTeX, con un botón para copiarla.

## Componentes y datos de terceros

| Archivo | Uso | Licencia |
|---|---|---|
| `vendor/xlsx.full.min.js` | Lectura de hojas de cálculo al importar | Apache License 2.0 |
| `data/world.js` | Contornos de los países del mapa mundial | Dominio público |
| `data/example.js` | Datos de ejemplo: metadatos de 300 obras, sin resúmenes | CC0 1.0 |

Los avisos completos están en [`vendor/THIRD-PARTY-NOTICES.txt`](vendor/THIRD-PARTY-NOTICES.txt).

## Autores

Luis Ángel Barrera-Guzmán ([ORCID 0000-0001-8057-2583](https://orcid.org/0000-0001-8057-2583)) y
Gabriela Ramírez-Ojeda ([ORCID 0000-0001-9679-6514](https://orcid.org/0000-0001-9679-6514)).

SciMetricsPro forma parte de una familia de aplicaciones de análisis sin programar, junto con PCAPro,
ClusteringPro, PopGeneticsPro y AgriDesign.

---

**In English.** SciMetricsPro is a self-contained web application for bibliometric and scientometric analysis that
runs entirely in the browser, with no installation and no server-side computation. It helps write the search
string, reads the exports of the main bibliographic databases (CSV, RIS, BibTeX, tagged text and spreadsheets),
merges duplicates, normalises authors, institutions and countries, computes the classical indicators (Bradford,
Lotka, h, g and m indices, local citations, RPYS), draws the conceptual, intellectual and social structures
(co-occurrence, thematic map and evolution, factorial analysis, co-citation, bibliographic coupling,
historiograph, collaboration networks and world map), records a PRISMA 2020 systematic review, and exports
journal-ready figures, tables, networks and an automatic report with its methods section. The interface is
available in Spanish and English; the user manual is in Spanish.
