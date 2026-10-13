# 🏭 FICSIT Production Planner & Calculator (Satisfactory 1.0 / 1.2)

Calculadora y planificador de producción ultra liviano diseñado para pioneros de **Satisfactory**, ejecutado de forma local en tu navegador **Brave** con 0 impacto en el rendimiento de tu PC o FPS en el juego.

---

## 🚀 Cómo Iniciar
- **Opción Rápida:** Haz doble clic en el archivo [`abrir_calculadora.bat`](file:///d:/Satis/abrir_calculadora.bat).
- **Opción Directa:** Abre el archivo [`index.html`](file:///d:/Satis/index.html) directamente en Brave Browser.

---

## ⚡ Módulos Incluidos

### 1. ⛏️ Nodos y Mineros
* **Pureza de Depósitos:** 
  * **Impuro:** Multiplicador `0.5x` (30 / 60 / 120 base)
  * **Normal:** Multiplicador `1.0x` (60 / 120 / 240 base)
  * **Puro:** Multiplicador `2.0x` (120 / 240 / 480 base)
* **Mineros Mk.1, Mk.2 y Mk.3** + Extractores de fluidos (Petróleo y Agua).
* **Overclocking interactivo (1% a 250%):** Muestra el consumo exacto en **MW** con la fórmula oficial de Satisfactory 1.0/1.2 y el número de Fragmentos de Energía necesarios.
* **Detección de Cinta Óptima:** Recomienda automáticamente desde **Cinta Mk.1 (60/m)** hasta **Cinta Mk.6 (1200/m)**.
* **Botón directo "Dividir esta Cinta":** Envía la salida del minero a la pestaña de splitters automáticamente.

### 2. 🏭 Diseñador de Fábrica por Taladros y Objetivo
* Elige el producto al que quieres llegar (Motor, Rotor, Marco Modular, Ascensor Espacial...).
* **Cálculo directo por Número de Taladros:** Define cuántos taladros colocas (1, 2, 3, 4...) con el selector o botones rápidos.
* La calculadora determina matemáticamente la producción máxima continua que satura al 100% esa extracción de minerales.
* **Pre-selección de Tecnología:** Elige previamente tu tecnología de taladros (Mk.1, Mk.2, Mk.3) y la pureza de cada veta (Impuro, Normal, Puro).
* **Botón '⚡ Adaptar Fábrica a este Recurso':** Ajusta toda la cadena de montaje a cualquier mineral secundario o cuello de botella con 1 solo clic.
* Desglosa:
  * Número exacto de máquinas por etapa (ej: *3 al 100% + 1 al 33.33%*).
  * Consumo eléctrico total en MW.
  * Cintas recomendadas por minero y troncales principales.
* Selector de **Recetas Alternativas** (Tornillos fundidos, Acero sólido, Planchas cosidas...).

### 3. 🔀 Asistente de División y Splitters
* Introduce el flujo de entrada (ej: 240/m) y el consumo por máquina (ej: 30/m).
* Calcula el número exacto de máquinas que puedes alimentar.
* **Ajuste de Overclocking sin sobrantes:**
  * Opción A: Máquinas al 100% + última máquina al % exacto.
  * Opción B: Todas las máquinas sincronizadas al mismo % de reloj.
* **Diseño de Cinta Manifold:** Te indica la velocidad de cinta recomendada en cada tramo de la línea principal a medida que se reduce el flujo.

### 4. ⚙️ Calculadora Rápida
* Inspección individual de cualquier máquina y receta con cálculo de potencia y ratios en tiempo real.

### 5. 📦 Catálogo Visual FICSIT de Productos & Sub-Cadenas
* Modal de selección con desglose visual de insumos y derivaciones directas o multi-fase.
* Búsqueda en tiempo real instantánea y filtros rápidos por edificio (Constructora, Ensambladora, Fabricante).
* **Motor Ultra-Optimizado 60 FPS:** Algoritmo BFS con memoización, dataset pre-compilado en memoria y `content-visibility: auto` que elimina cualquier caída de fotogramas.

### 6. 📖 Base de Datos 1.0 / 1.2
* Buscador dinámico con todas las recetas estándar y de discos duros.
* Botón **"Copiar Resumen"** para pegar tus notas en el juego o bloc de notas.

### 7. 🎨 Gráficos Oficiales en Alta Resolución (Satisfactory 1.0 / 1.2)
* **84 Iconos Oficiales Descargados Localmente:** En `images/items/` y `images/buildings/` para funcionamiento 100% offline sin necesidad de internet.
* Todos los materiales (Minerales, Lingotes, Piezas avanzadas, Fases del Ascensor Espacial) y todas las máquinas y mineros se muestran con sus ilustraciones originales transparentes y sombras industriales FICSIT.

### 8. 🔀 Espacio Libre (División, Balance y Desglose de Hornos + Constructores)
* **Lista Directa de Productos:** Selector desplegable nativo en cada rama (`<select>`) clasificado en *Derivación Directa* y *Cadenas Avanzadas*, además de botón de *Catálogo Visual*.
* **Conteo Explícito de Maquinaria por Rama:** Desglosa exactamente cuántos **Hornos (Fundiciones)**, **Constructores**, **Ensambladoras** y otras máquinas requiere cada línea elegida.
* **Resumen de Construcción Claro:** Muestra la frase explicativa: `💡 En esta rama colocarás: X Hornos + Y Constructores para sacar Z [Producto]/min`.
* **Esquema de Splitters & Balance Troncal:** Indica cómo derivar la cinta principal y cómo configurar el manifold en el juego con cero desperdicio y 100% de eficiencia.
* **Botón '📐 Plano 2D' por Rama:** Abre una ventana modal interactiva con el plano de planta 2D específico de la producción de esa rama.

### 9. 📐 Plano Vista Aérea (2D) Interactivo (Floor Blueprint & Descongestión)
* **Vista Superior de Fábrica (2D Aerial):** Generación automática en SVG de la planta de fábrica sobre suelo de cimientos estándar de Satisfactory (**8m x 8m por bloque**).
* **Sin Taladros Exteriores:** El plano excluye los mineros exteriores e inicia limpiamente en los puertos colectoras de entrada de mineral (`📥 ENTRADA EXTERIOR`), centrándose exclusivamente en el suelo y distribución de la fábrica.
* **Equipamiento Completo Representado:**
  * **Hornos (Fundiciones)**, **Constructoras**, **Ensambladoras**, **Fabricantes** y **Refinerías** a escala visual con su icono oficial, receta asignada, insumo, salida continua, reloj de overclock y consumo en MW.
  * **Divisores (Splitters `🔀`)** colocados automáticamente para alimentar manifolds de múltiples máquinas.
  * **Unidores (Mergers `🔄`)** para recolectar las salidas hacia la siguiente fase.
  * **Contenedor de Salida Final (`📦 SALIDA FINAL`):** Terminal de almacenamiento con ritmo de entrega y cinta requerida.
* **Enrutamiento por Carriles Multicanal (Multi-Lane Bus Routing - Sin Líneas Confusas):**
  * Elimina por completo el solapamiento o congestión de cintas entre fases.
  * Cada cinta transportadora en un mismo corredor recibe su propio canal vertical independiente con curvaturas suaves (`Q` Bezier) y separación garantizada.
  * **Marcadores de Flecha Direccional:** Flechas SVG y animación de flujo dinámico que indican claramente hacia dónde viaja el producto.
  * **Pastillas de Material y Flujo:** Cada cinta muestra su material y caudal continuo (`[Icono] Nombre (+X/m)`).
* **Trazado Interactivo de Rutas (Interactive Route Tracing):**
  * **Al pasar el cursor sobre cualquier máquina:** Se iluminan automáticamente todas sus cintas de entrada en **Cyan (#38bdf8)** y sus salidas en **Verde Esmeralda (#4ade80)**, destacando sus máquinas de procedencia y destino mientras se atenúa el resto de la fábrica (`opacity: 0.15`).
  * **Al pasar el cursor sobre cualquier cinta:** Se ilumina la trayectoria completa y un tooltip detallado te explica de dónde viene y hacia qué máquina va.
* **Barra de Filtrado Rápido por Material:**
  * Botones en la barra superior (`[🌟 Ver Todo]`, `[🪨 Mineral]`, `[🪙 Lingote]`, `[🔩 Tornillos]...`).
  * Al hacer 1 clic en un material, la fábrica entera aísla visualmente toda su línea de transporte y manufactura.
* **Dimensiones y Conteo de Cimientos:** Insignia que te indica los cimientos exactos y compactos que debes construir en el juego (ej. `20x5 Cimientos (160m x 40m • 100 bloques)` ajustados al milímetro con cero espacio desperdiciado) con reglas perimetrales de coordenadas.
* **Controles Interactivos Fluidos:** Arrastre (*Pan* libre), zoom con rueda hacia el cursor, pantalla completa (⛶) y alternador de ratios.

---

### 10. ⚡ Gestor de Rendimiento Energético (Satisfactory 1.0 / 1.2)
* **Física Real de Energía FICSIT:** Aplica el exponente oficial de producción `1.321928` según la fórmula:
  $$P = P_{\text{base}} \times \left(\frac{\text{Clock}}{100}\right)^{1.321928}$$
* **3 Perfiles de Rendimiento Eléctrico:**
  1. 🟢 **Modo Eco (Máxima Eficiencia):** Underclocking distribuido inteligente entre máquinas idénticas. Logra un **ahorro de entre 15% y 25% de MW** con la misma producción exacta.
  2. 🟡 **Modo Estándar (100%):** Operación nominal clásica de Satisfactory (máquinas enteras al 100% y 1 residual al porcentaje restante).
  3. 🔴 **Modo Compacto (Overclocking 200%):** Reduce el número de máquinas y el espacio en cimientos a la mitad, calculando el consumo extra y el total de **Fragmentos de Energía (💎 Power Shards)** requeridos.
* **Barra Segmentada de Desglose:** Visualiza en tiempo real qué porcentaje y cuántos MW consumen tus Mineros, Fundiciones, Constructoras y Ensambladoras.
* **Dimensionamiento de Centrales Eléctricas FICSIT:**
  * Calcula cuántas centrales necesitas construir para alimentar tu fábrica completa:
    * ⛏️ **Generadores de Carbón (75 MW c/u):** Cantidad de plantas, consumo de Carbón/min y consumo de Agua en $m^3$/min (+ número de Extractores de Agua).
    * 🛢️ **Generadores de Combustible (250 MW c/u):** Cantidad de generadores y tasa de Fuel/min.
    * 🌿 **Quemadores de Biomasa (30 MW c/u):** Para arranques en Tier 1-2.
    * ☢️ **Centrales Nucleares (2500 MW c/u):** Para megaproyectos de alta capacidad.
    * 🔋 **Almacenamiento de Energía FICSIT:** Baterías recomendadas (100 MWh c/u) para absorber picos y evitar caídas de red.


