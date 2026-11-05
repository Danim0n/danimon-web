# danimon.party

Portfolio de **Daniel Rosell Martín**, desarrollador de software centrado en aplicaciones móviles con Flutter, herramientas con Python e inteligencia artificial aplicada.

[Visitar el portfolio](https://danimon.party) · [Versión en español](https://danimon.party/es/) · [LinkedIn](https://www.linkedin.com/in/daniel-rosell-mart%C3%ADn-703a561a0/)

## Una web para explorar proyectos

El portfolio reúne mi perfil, formación, tecnologías y proyectos en una experiencia disponible en español e inglés.

- **Proyectos en un carrusel 3D.** Tarjetas con acabado de cristal que giran automáticamente, se pueden arrastrar y muestran más información al interactuar con ellas.
- **Aplicación de eventos locales.** Una ficha explica el trabajo con Flutter, Dart, Supabase y el procesamiento de información asistido por un modelo local.
- **Lector de facturas.** Una demo reconoce una factura ficticia dentro del navegador, permite consultar el origen de los datos, corregirlos y guardar o exportar la revisión.
- **Perfil y tecnologías.** Un resumen de lo que hago, mi formación y las herramientas con las que trabajo.
- **Contacto y currículum.** Una tarjeta flotante reúne mi perfil, LinkedIn, la descarga del CV y distintas opciones para escribirme por correo.

## Cómo está construido

La web utiliza **Astro y TypeScript** para generar páginas estáticas y añadir interactividad donde hace falta. El diseño combina tipografía editorial, una cabecera con pestañas y un fondo procedural animado con **WebGL y GLSL**.

El carrusel está desarrollado con transformaciones **CSS 3D** y controles de puntero. La animación del perfil y los efectos de cristal utilizan CSS. La demo de facturas emplea **Tesseract.js y WebAssembly**, con los recursos de reconocimiento servidos desde el propio proyecto.

Las fuentes se sirven localmente. La navegación admite teclado, pantallas móviles y preferencias de movimiento reducido.

## Ejecutarlo en local

Requiere **Node.js 24** y **npm**.

~~~bash
npm ci
npm run dev
~~~

Abre la dirección que muestra la terminal. La portada está en inglés y la versión española se encuentra en `/es/`.

Para generar y revisar la versión estática:

~~~bash
npm run build
npm run preview -- --port 4325 --ignore-lock
~~~

Los archivos compilados se generan en `dist/`. El proyecto incluye configuración para servirlos mediante Cloudflare Workers Static Assets.

## Organización

| Carpeta | Contenido |
| --- | --- |
| `src/components/` | Componentes y elementos interactivos |
| `src/pages/` | Páginas en inglés y español |
| `src/scripts/` | Comportamiento del carrusel, el fondo y la demo |
| `src/shaders/` | Shaders del fondo animado |
| `src/styles/` | Estilos y tipografía |
| `public/` | Imágenes, iconos, CV y recursos de la demo |
| `tests/` | Pruebas de navegador |

## Contacto

¿Tienes un proyecto de desarrollo móvil o automatización? Puedes escribirme a [danirosellmartin@gmail.com](mailto:danirosellmartin@gmail.com) o encontrarme en [LinkedIn](https://www.linkedin.com/in/daniel-rosell-mart%C3%ADn-703a561a0/).

Las licencias y atribuciones de fuentes, iconos y recursos de terceros se conservan junto a sus archivos.
