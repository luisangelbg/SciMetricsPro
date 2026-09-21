# Manual de usuario de SciMetricsPro

El manual se escribe por partes, en HTML, con la misma dinámica que los manuales de PCAPro, PopGeneticsPro, ClusteringPro y AgriDesign. Primero va la versión en español y después la versión en inglés. Cuando las partes estén completas, se unen en un solo documento y se imprime a PDF.

```
manual/
  manual.css           hoja común: tamaño carta y marco de la portada
  interior.css         estilo de las páginas interiores: hojas blancas, vivos en azul marino, un color por capítulo
  paginar.js           reparte el contenido en hojas tamaño carta (encabezados, números de página, índice)
  img/                 capturas de pantalla de la app
  herramientas/
    captura.html       abre la app en un marco, ejecuta una receta de pasos y deja la vista lista para la captura
    capturar.ps1       toma la captura de una receta esperando a que terminen los cálculos y la guarda en img/
    revisar-hojas.ps1  pagina una parte, informa avisos e imágenes rotas y guarda cada hoja y una hoja de contactos
    unir-manual.pl     une portada y partes en es/manual-completo.html para imprimir el manual completo
    indice-general.pl  rehace el índice general de 01-introduccion.html con el h1 y los h2 de cada parte
  es/
    00-portada.html    portada blanca: título en español e inglés; una red de coocurrencia de palabras clave con
                       cuatro comunidades de color y, al centro de cada una, una flor de maracuyá, una mazorca de
                       maíz, una abeja y un chayote con sus nombres científicos; abajo, la curva de Bradford, un
                       mapa temático, un globo con arcos de colaboración y un diagrama PRISMA (todo dibujado con
                       gráficos vectoriales originales; sin hélice de ADN)
    01-introduccion.html  créditos, cómo citar, índice general, cómo leer el manual y capítulo 1: qué es
                       SciMetricsPro, preguntas que responde, ideas clave de la bibliometría, bases y formatos
                       que acepta, cómo abrirlo, recorrido por la interfaz, los datos de ejemplo del maracuyá,
                       flujo de trabajo y cómo leer indicadores, leyes y redes (capturas app-inicio, app-fuentes,
                       app-figura y app-ayuda en img/; cifras del ejemplo comprobadas fuera de la app)
    02-inicio.html     capítulo 2 · Inicio, proyecto y ayudas: la portada y la ruta de trabajo, idioma y tema,
                       guardar y abrir un proyecto (qué guarda y qué no), autoguardado y recuperación, recorrido
                       guiado y ayudas, Acerca de (licencia y cita), teclado y pantallas angostas (capturas
                       inicio-*.png en img/; tamaño del proyecto del ejemplo comprobado fuera de la app)
    03-importar.html   capítulo 3 · Importar datos: bloques de búsqueda, conceptos del título con el glosario,
                       edición de conceptos, sintaxis y truncamiento de cada buscador, qué exportar de cada base,
                       carga de seis exportaciones reales del maracuyá (402 registros), campos disponibles y
                       avisos, vista previa, búsqueda y conteo en el catálogo abierto (capturas importar-*.png;
                       cadenas, conteos por archivo y DOI comprobados fuera de la app)
    04-limpieza.html   capítulo 4 · Limpieza y filtros: por qué limpiar, el resumen y el campo de términos
                       (con el campo automático), duplicados (criterios, umbral, razones y qué campo gana al
                       fusionar), variantes de nombres de autor con los coautores compartidos, instituciones
                       y países con sus equivalencias, sinónimos y palabras vacías, y los seis filtros
                       globales (capturas limpieza-*.png; duplicados, variantes de autor, palabras clave,
                       idiomas y años comprobados fuera de la app con lectores propios)
    05-panorama.html   capítulo 5 · Panorama general: qué responde la pantalla, el año de referencia, las 13
                       tarjetas con su tabla y la ayuda con fórmula, producción anual y la trampa de la tasa
                       de crecimiento, citas promedio por año y años citables, tipos de documento, qué pasa
                       con filtros activos y la barra de descarga de las figuras (capturas panorama-*.png;
                       las trece tarjetas y las series anuales comprobadas fuera de la app)
    06-fuentes.html    capítulo 6 · Fuentes: las seis tarjetas y cómo se identifica una fuente (nombre e ISSN),
                       las más productivas, la ley de Bradford con sus tres zonas y el multiplicador, el
                       impacto con los índices h, g y m, la dinámica que delata a las revistas que dejaron el
                       tema y la tabla completa con sus dieciséis columnas (capturas fuentes-*.png; zonas,
                       índices y años comprobados fuera de la app)
    07-autores.html    capítulo 7 · Autores: las tarjetas y el aviso de afiliaciones, conteo completo y
                       fraccionado, trayectorias en el tiempo, la ley de Lotka con Kolmogorov-Smirnov, impacto
                       por autor, instituciones (documentos y apariciones), países con SCP/MCP y el mapa
                       (capturas autores-*.png con los datos de ejemplo, que el lector puede reproducir con un
                       clic; todas las cifras comprobadas leyendo data/example.js fuera de la app)
    08-documentos.html capítulo 8 · Documentos: tarjetas, tres medidas de citas, citas locales frente a
                       globales, referencias más citadas, RPYS con sus picos, palabras (barras, nube y mapa de
                       árbol), crecimiento y temas en tendencia (capturas documentos-*.png con los datos de
                       ejemplo; la RPYS con samples/manual/cienciometria_indice_b.txt, 147 artículos sobre
                       cocitación y acoplamiento en texto etiquetado del índice B, convertidos de un conjunto
                       público de ejemplo; cifras comprobadas fuera de la app)
    09-conceptual.html capítulo 9 · Estructura conceptual: red de coocurrencia y sus parámetros, ficha de un
                       término, mapa temático con centralidad y densidad de Callon, evolución temática con el
                       índice de inclusión, análisis factorial (ACM, Benzécri, k-means, silueta y Ward)
                       (capturas conceptual-*.png con los datos de ejemplo y 14 palabras vacías agregadas a la
                       lista en inglés —receta con el paso stop:—; cifras comprobadas fuera de la app y el
                       análisis factorial con otro programa estadístico)
    10-intelectual.html capítulo 10 · Estructura intelectual: cocitación de referencias, autores y fuentes,
                       acoplamiento bibliográfico, mapa de acoplamiento e historiografía (capturas intelectual-*.png:
                       la cocitación con samples/manual/cienciometria_indice_b.txt, porque las referencias del
                       catálogo son identificadores sin autor; lo demás con los datos de ejemplo y las 14 palabras
                       vacías del capítulo 9; la historiografía con la ventana a 1800 px de ancho; cifras
                       comprobadas fuera de la app)
    11-social.html     capítulo 11 · Estructura social: red de colaboración de autores, instituciones y
                       países, mapa mundial con arcos y cronología (capturas social-*.png con los datos de
                       ejemplo sin cambios en Limpieza; cifras comprobadas fuera de la app)
    12-prisma.html     capítulo 12 · PRISMA 2020: cribado con atajos, motivos de exclusión, diagrama de flujo
                       y «Analizar solo los incluidos»
                       (capturas prisma-*.png con el ejemplo filtrado a artículos y 20 decisiones con el teclado)
    13-exportar.html   capítulo 13 · Exportar y reporte: la barra de cada figura (formatos, una o dos columnas,
                       letra, resolución, grises), cómo se redibuja una figura para su ancho y el aviso cuando las
                       etiquetas no caben, Editar figura, tablas, redes (GraphML, GEXF, .net, CSV), conjunto limpio
                       (CSV, BibTeX, sinónimos), paquete ZIP con su índice e informe con metodología y resultados
                       (capturas exportar-*.png con los datos de ejemplo; exportar-8-5cm.png y exportar-17cm.png son
                       las descargas reales de la app; archivos, redes, tablas, BibTeX y .docx comprobados con
                       lectores independientes)
    14-apendices.html  apéndices A–F: A formatos de archivo (cómo reconoce la app cada archivo, de qué columna,
                       etiqueta o campo saca cada dato, tabla genérica y archivos propios), B fórmulas de los
                       indicadores con su referencia (las de las ayudas de la app), C glosario español–inglés con
                       los términos de la interfaz en inglés, D solución de problemas con los mensajes exactos de
                       la app, E referencias (las del diccionario refs de la app más Levenshtein 1966, Hernández y
                       Stolfo 1995 y Marshakova 1973, que cita el manual) y F componentes de terceros
    manual-completo.html  generado por unir-manual.pl; no se edita a mano
  en/                  versión en inglés (pendiente)
```

## Ver una parte

Abre el HTML con doble clic. `paginar.js` arma las hojas en cuanto cargan las tipografías y las imágenes. Sin conexión a internet, el navegador usa tipografías del sistema y la paginación se ajusta sola.

## Colores por capítulo

Son las franjas de la portada, en este orden, y el acento de cada capítulo. Vienen de las variables de `interior.css`, y los chips van de `.k0` a `.kx`.

| Parte | Color | Variable |
|---|---|---|
| Preliminares y capítulo 1 | tinta `#14213d` | `--b0` |
| 2 Inicio | azul `#1d5bb0` | `--b1` |
| 3 Importar | verde azulado `#0f766e` | `--b2` |
| 4 Limpieza y filtros | verde campo `#2f7d4f` | `--b3` |
| 5 Panorama general | ocre `#b7791f` | `--b4` |
| 6 Fuentes | naranja `#d9701f` | `--b5` |
| 7 Autores | carmín `#b4234a` | `--b6` |
| 8 Documentos | café tierra `#8a5a2b` | `--b7` |
| 9 Estructura conceptual | azul cielo `#2b8fb3` | `--b8` |
| 10 Estructura intelectual | índigo `#4f46a5` | `--b9` |
| 11 Estructura social | violeta `#7e3fb0` | `--b10` |
| 12 PRISMA 2020 | rosa `#c8416a` | `--b11` |
| 13 Exportar y reporte | grafito `#334155` | `--b12` |
| Apéndices | negro `#111111` | `--bx` |

## Cómo escribir la siguiente parte

- **Un capítulo es una sección.** Cada capítulo va en `<section class="capitulo" id="cap-N" data-pestana="N" data-orden="N" style="--acento: var(--bN-1)">`. `data-orden` fija la altura de la pestaña de color en el borde de la hoja: 1 para el capítulo 1, 2 para el capítulo 2, y así hasta 14 para los apéndices.
- **Recuadros disponibles:** `caja nota`, `caja importante`, `caja teoria`, `caja ejemplo`, `caja regla` (con tabla) y `caja dato`. Para los pasos se usa `ol.pasos`, y para el texto de la app `span.ui` y `span.ruta`.
- **Evitar `columns:`.** Las listas en dos columnas se hacen con rejilla (`display: grid`).
- **Capturas a menor ancho.** `<figure class="media">` va al 84 %. Un capítulo puede definir `figure.chica` (70 %) y `figure.mini` (50 %) en su propio `<style>`.
- **Validar los números.** Los valores que se citan como resultados de la app se comprueban antes de escribirlos, casi siempre con los datos de ejemplo del maracuyá.
- **Nombres de bases de datos.** Fuera de lo que la app muestra en su pantalla de importación, se usan las descripciones genéricas de `CLAUDE.md`: índice de citas multidisciplinario A y B, índice biomédico público, buscador académico abierto, base de datos de investigación enlazada y catálogo bibliográfico abierto consultado por API. Tampoco se nombran otros programas ni marcas: se escribe «hoja de cálculo», «gestor de referencias» u «otros paquetes bibliométricos».
- **Referencias.** Los métodos se citan por su artículo original, igual que en las ayudas de la app.
- **Espacio fijo antes de %.** Se escribe `95&nbsp;%`.

## Capturas de pantalla

Las capturas se toman con el servidor local de la app en marcha, en el puerto 9100 (`server.ps1`), y un navegador instalado con modo sin ventana:

```
powershell -ExecutionPolicy Bypass -File herramientas\capturar.ps1 -Navegador 'C:\ruta\al\navegador.exe' -Nombre app-fuentes -Receta 'ex;go:sources;tab:stab-bradford' -Alto 1100 -Recorte '560,400,2200,1500' -Marcas '#srcCards|#stab-bradford'
```

- `-Recorte x,y,ancho,alto` recorta la imagen, en píxeles de la imagen, que mide el doble de la ventana.
- `-Marcas sel1|sel2…` lista los elementos que llevarán marca numerada. Para cada uno, la herramienta escribe la caja del elemento en píxeles de la imagen sin recortar —útil para calcular el `-Recorte` de la primera pasada— y tres posiciones listas para copiar en `style="left:…;top:…"`: a la derecha, a la izquierda y encima, en porcentajes de la imagen ya recortada. Se elige la que no tape texto y se revisa la hoja con `revisar-hojas.ps1`. Las marcas se ven más grandes en imágenes bajas o angostas: en ellas conviene poner pocas y separadas.
- En las rejillas de tarjetas conviene poner la marca sobre el icono de cada tarjeta (a la izquierda de su título): el icono es decorativo y no se pierde texto. Lo mismo vale para el icono de los avisos de varias líneas.
- La marca mide unos 22 px y se centra en el punto: en filas o etiquetas juntas tapa la línea de arriba o de abajo. Cuando no queda hueco, conviene mover la marca a un espacio en blanco cercano (el centro de una fila, la línea del título de la tarjeta, el hueco entre dos tarjetas) o quitarla y explicar ese detalle en el texto.
- La marca no se achica con la figura: ocupa cerca del 3.5 % del ancho de una figura completa, 4.2 % en `media`, 5 % en `chica` y 6 % en `angosta`. Las posiciones que da `-Marcas` sirven de punto de partida; en figuras reducidas hay que alejarlas más del texto y revisar la hoja.
- `paginar.js` sube al hueco de una figura que no cabe los bloques que la siguen, pero no salta su leyenda de marcas. Si una figura con leyenda deja media hoja vacía, se reordenan los bloques a mano: una tabla o un recuadro que va antes de la figura llena la hoja anterior (así se armó el capítulo 9).
- `-Idioma en` toma la captura con la interfaz en inglés y `-Avisos` deja visibles los avisos del pie de la pantalla.
- `-Barras` deja ver las barras de desplazamiento. Sirve para las listas que se recorren (las sugerencias de sinónimos, las equivalencias): sin la barra, la última fila aparece cortada y parece un error de la captura.
- El navegador sin ventana no dibuja más allá de unos 8200 px de página: lo que queda más abajo sale en blanco. Para capturar algo profundo (una sección del informe), se ocultan con `hide:` las tarjetas y los bloques de arriba, como en la figura 13.8. `settle` espera también la búsqueda de figuras y el informe de Exportar.

- `capturar.ps1` usa el protocolo de depuración del navegador y espera en tiempo real a que la receta termine. La captura directa con `--screenshot` no sirve para las redes, porque el reloj simulado del navegador corre más rápido que los cálculos en segundo plano.
- La ventana mide 1400 × 900 por omisión (`-Ancho`, `-Alto`) y la imagen sale a doble resolución. `-Tema dark` la toma en modo oscuro.
- Antes de abrir la app, `captura.html` marca el recorrido guiado como visto y borra la sesión guardada, para que ninguna ventana tape la captura.

Los pasos de la receta van separados por `;`:

| Paso | Qué hace |
|---|---|
| `ex` | Carga los datos de ejemplo desde la portada. |
| `files:ruta\|ruta` | Importa archivos servidos desde la carpeta de la app, como si se eligieran en Importar. Las exportaciones reales para el manual están en `samples/manual/`, con nombres genéricos; esa carpeta no se publica. |
| `reload` | Vuelve a abrir la app con lo que guardó el navegador, para mostrar la recuperación de la sesión. |
| `stop:en=palabra\|palabra` | Agrega palabras vacías a la lista de ese idioma (`es` o `en`), como pulsar «Guardar listas» en Limpieza. En el capítulo 9 se usa para quitar los términos genéricos del catálogo. |
| `go:ruta` | Abre un módulo desde la barra lateral: `import`, `cleaning`, `overview`, `sources`, `authors`, `documents`, `conceptual`, `intellectual`, `social`, `prisma`, `export`, `home` o `about`. |
| `tab:id` | Pulsa una pestaña y espera los cálculos. Los prefijos son `tab-` en Importar, `ctab-` en Limpieza y Conceptual, `stab-` en Fuentes y Social, `atab-`, `dtab-`, `itab-`, `ptab-` y `extab-`. |
| `click:selector` | Pulsa un elemento. |
| `help:selector` | Abre una ayuda (`?`). |
| `open:selector` | Abre un `<details>`. |
| `select:selector=valor`, `set:selector=valor`, `check:selector=true` | Elige, escribe o marca y dispara el cambio. |
| `key:tecla` | Pulsa una tecla sobre la página, como los atajos de PRISMA. |
| `wait:ms`, `settle` | Espera un tiempo o espera los cálculos pendientes. |
| `scroll:selector,desfase` | Desliza la vista hasta un elemento. |
| `hide:selector`, `style:selector=css` | Oculta un elemento o le agrega estilo en línea. |
| `top` | Vuelve arriba. |

En la dirección, `#` se escribe `%23`, `"` se escribe `%22`, `=` dentro de un selector se escribe `%3D`, la coma dentro de un valor `%2C` y el espacio `%20`. Por ejemplo, la ayuda de la tarjeta de crecimiento es `help:%23ovCards%20[data-key%3D%22growth%22]%20.help-btn`.

Una figura más alta que una hoja no cabe: `revisar-hojas.ps1` lo avisa. Se parte en dos recortes dentro de la misma figura, como la figura 3.3.

**Revisar una parte** antes de darla por buena:

```
powershell -ExecutionPolicy Bypass -File herramientas\revisar-hojas.ps1 -Navegador 'C:\ruta\al\navegador.exe' -Parte es/01-introduccion.html -Salida C:\Temp\hojas
```

El resultado dice cuántas hojas salieron y si hubo avisos de la consola, por ejemplo un elemento más alto que una hoja, o imágenes que no cargaron. Después se revisa `contactos.png` y las hojas con figuras.

## Pendiente al publicar la versión 1.0

- Agregar el DOI y la dirección del código fuente a las dos citas de los créditos (`01-introduccion.html`, comentario en el HTML).
- Volver a tomar las capturas que muestran el número de versión: `inicio-acerca.png` (receta `go:about`, alto 1300, recorte x 553, y 140, 2191 × 2156), `exportar-vista.png` (portada del informe: «Generado con SciMetricsPro 0.1.0»; receta `go:export;tab:extab-report;click:%23rpBuild;settle;scroll:%23rpPreview,20`, alto 1500, recorte 580,50,2150,1650) y cualquier otra que muestre el pie de página.

## Cómo obtener el PDF

El PDF en español está en `manual/SciMetricsPro User's Manual.pdf` (194 hojas, 18 sep 2026). Si se corrige una parte, se vuelve a generar con los pasos siguientes y se reemplaza ese archivo. Si se agrega, quita o renombra una sección, antes de unir se corre `perl herramientas/indice-general.pl es` para que el índice general la refleje.

**Manual completo**, con el servidor local en marcha:

```
$navegador = 'C:\ruta\al\navegador.exe'   # navegador instalado, con modo sin ventana (headless)
perl herramientas/unir-manual.pl es
Start-Process -Wait $navegador -ArgumentList '--headless=new','--disable-gpu','--no-pdf-header-footer','--virtual-time-budget=300000','--print-to-pdf=C:\ruta\sin\espacios\manual-es.pdf','http://localhost:9100/manual/es/manual-completo.html'
```

- `unir-manual.pl` escribe `es/manual-completo.html` con la portada, las partes de `01-introduccion.html` a `14-apendices.html` y los estilos propios de cada parte. Ese archivo no se edita a mano: se corrigen las partes y se vuelve a generar.
- El manual se imprime de una sola vez. Unir PDF sueltos pierde los enlaces del índice y reinicia la numeración.
- El navegador no escribe el PDF si la ruta de `--print-to-pdf` tiene espacios. Imprime en una carpeta sin espacios y después copia el archivo.

**Una parte sola**, para revisarla (por ejemplo, la portada), con la misma variable `$navegador`:

```
Start-Process -Wait $navegador -ArgumentList '--headless=new','--disable-gpu','--no-pdf-header-footer','--virtual-time-budget=20000','--print-to-pdf=C:\Temp\portada.pdf','http://localhost:9100/manual/es/00-portada.html'
```

Desde el cuadro de impresión del navegador, elige el destino **Guardar como PDF**, los márgenes **Ninguno** y activa **Gráficos de fondo**.

## Tipografías

- **Cormorant** para los títulos.
- **Crimson Pro** para el texto de las páginas interiores.
- **Jost** para los rótulos, las tablas y los números.

Las tres tienen licencia SIL Open Font License 1.1 y se cargan desde el servicio público de fuentes web.

Todo lo demás es original: las ilustraciones, los diagramas, el paginador y la herramienta de capturas. No se usan imágenes de terceros.
