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
* Elige el producto al que quieres llegar (Motor, Rotor, Armazón Modular, Ascensor Espacial...).
* **Cálculo directo por Número de Taladros:** Define cuántos taladros colocas (1, 2, 3, 4...) con el selector o botones rápidos.
* **Configuración Individual de Vetas / Menas:** Elige independientemente si cada taladro está sobre una veta **Pura, Normal o Impura**, y su tecnología (**Mk.1, Mk.2 o Mk.3**), permitiendo mezclas heterogéneas exactas (ej: 1 Puro Mk.2 + 1 Normal Mk.1 + 1 Impuro Mk.1).
* La calculadora determina matemáticamente la producción máxima continua que satura al 100% esa extracción de minerales.
* **Pre-selección de Tecnología:** Elige previamente tu tecnología de taladros (Mk.1, Mk.2, Mk.3) y añade o elimina taladros por recurso.
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
* **Controles Interactivos Fluidos & Anti-Desenfoque:**
  * **Zoom y Pan ultra-estables:** La vista se traslada y escala de forma suave y nítida sin artefactos de desenfoque. Durante el desplazamiento o zoom, los efectos de hover se suspenden automáticamente para evitar cualquier parpadeo.
  * **🎯 Botón de Modo Foco:** Permite alternar entre foco interactivo suave (`Foco: Suave`) o vista fija inalterable (`Foco: Desactivado`) si deseas que el 100% de la fábrica se mantenga siempre visible.
  * Botón para centrar y ajustar (⟲), pantalla completa (⛶) y alternador de etiquetas de ratios.

---

### 10. ⚡ Gestor de Rendimiento Energético (Satisfactory 1.0 / 1.2)
* **Física Real de Energía FICSIT:** Aplica el exponente oficial de producción `1.321928` según la fórmula:
  $$P = P_{\text{base}} \times \left(\frac{\text{Clock}}{100}\right)^{1.321928}$$
* **3 Perfiles de Rendimiento Eléctrico:**
  1. 🟢 **Modo Eco (Máxima Eficiencia):** Underclocking distribuido inteligente entre máquinas idénticas. Logra un **ahorro de entre 15% y 25% de MW** con la misma producción exacta.
  2. 🟡 **Modo Estándar (100%):** Operación nominal clásica de Satisfactory (máquinas enteras al 100% y 1 residual al porcentaje restante).
  3. 🔴 **Modo Compacto (Overclocking 200%):** Reduce el número de máquinas y el espacio en cimientos a la mitad, calculando el consumo extra y el total de **Fragmentos de Energía (💎 Power Shards)** requeridos.
* **Barra Segmentada de Desglose:** Visualiza en tiempo real qué porcentaje y cuántos MW consumen tus Mineros, Fundiciones, Constructoras y Ensambladoras.

---

### 11. ⚡ Centrales de Energía & Planos 2D Aéreos Dedicados (Objetivo en MW)
* **Generación por Meta Eléctrica:** Introduce directamente la potencia en Megavatios que deseas generar (ej. **8,000 MW**, **1,200 MW**, **15,000 MW**) o usa los botones de presets rápidos.
* **Selección de Fuente de Combustible:**
  * 🪨 **Carbón Estándar (75 MW c/u):** 15 carbón/min + 45 m³/min de agua.
  * 🧱 **Carbón Compactado (75 MW c/u):** 7.14 carbón/min + 45 m³/min de agua (ahorro de más del 52% de carbón).
  * ⚫ **Coque de Petróleo (75 MW c/u):** 25 coque/min + 45 m³/min de agua.
  * 🛢️ **Combustible Líquido 1.0 (250 MW c/u):** 20 m³/min de Fuel (sin agua).
  * 🚀 **Turbocombustible 1.0 (250 MW c/u):** 7.5 m³/min de Turbofuel.
  * ☢️ **Central Nuclear (2,500 MW c/u):** 0.2 varillas uranio/min + 240 m³/min agua.
  * 🌿 **Quemador de Biomasa (30 MW c/u):** 4 biocombustible sólido/min.
* **Cálculo de Máxima Eficiencia (Golden Ratios):**
  * **Generadores exactos:** Desglose entre generadores enteros al 100% y ajuste preciso de reloj (clock) del generador remanente.
  * **Consumo de agua y bombas:** Número exacto de Extractores de Agua al 100% y tuberías requeridas (Mk.1 de 300 m³/min o Mk.2 de 600 m³/min).
  * **Balance Eléctrico Neto:** Calcula la potencia bruta generada, resta el autoconsumo de las bombas de agua y taladros, y muestra los **MW Netos limpios** suministrados a la red.
  * **Arquitectura Áurea 8:3:** Instrucciones de construcción modular de 8 generadores : 3 extractores para evitar cuellos de botella de fluidos en tuberías.
* **Plano Aéreo 2D Interactivo de la Central Eléctrica:**
  * **Leyenda y Códigos de Color de Alto Contraste:** 4 familias cromáticas 100% diferenciadas para eliminar cualquier confusión visual:
    * 🟧 **Naranja Mecánico FICSIT (`#ea580c`):** Cinta transportadora troncal de carbón y bajadas directas a tolvas.
    * 🔀 **Divisores Etiquetados con Claridad:** Se eliminaron siglas confusas como `S1` a favor de nombres explícitos `Divisor #1 (Splitter)` con tooltips interactivos de caudal entrante y derivado.
    * 🟦 **Azul y Cian Neón (`#0284c7` / `#00e5ff`):** Manifold colector de agua en bucle cerrado y tuberías verticales de inyección.
    * 🟪 **Violeta Tecnológico (`#8b5cf6`):** Chasis industrial de los generadores sobre cimientos de hormigón reforzado, con chimeneas de vapor (`💨`) y potencia visible (`⚡ 75 MW`).
    * 🟩 **Verde Esmeralda (`#22c55e`):** Red aérea de cableado de alta tensión segregada en el nivel superior y Subestación receptora de potencia.
  * **Modos de Distribución de Carbón en el Bloque:**
    * 🔀 **Mitad y Mitad (Central 60/60 - Recomendado):** La cinta de 120/min entra por el centro y se divide en 2 ramales de 60/min (Generadores 1-4 y 5-8). Saturación 4x más rápida, arranque estable e instantáneo sin caídas de red ni parpadeos.
    * ➡️ **Cascada (Manifold Lineal continuo):** Cinta única de izquierda a derecha. Compacto pero requiere precargar carbón a mano o esperar 8-15 min a que los primeros generadores se saturen.
  * **Logística Macro de Taladros (Regla FICSIT de los 240/min):**
    * Guía técnica para plantas de gran escala (ej. 8,000 MW / 107 generadores): en lugar de unir 43 taladros en una megacinta que colapsaría el juego, se agrupan en cintas Mk.3 de **240 carbón/min** con un Splitter 50%/50% que alimenta **2 Bloques Maestros (120/min c/u = 1,200 MW limpios)** de forma autónoma.
  * **Estructura en 5 Niveles sin Cruces:** Red Eléctrica Superior ➔ Cinta de Carbón & Divisores ➔ Edificios de Generación ➔ Manifold de Agua ➔ Costa con Extractores Marinos.
  * **Doble Vista Alternable:** Esquema detallado de 1 Bloque Maestro (8:3) o Vista Panorámica con la totalidad de los bloques interconectados.



