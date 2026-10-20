/**
 * SATISFACTORY 1.0+ / 1.2 PRODUCTION DATABASE
 * Exact official values for Resources, Miners, Belts, Machines, and Recipes.
 */

const SATIS_DATA = {
  // Purity multipliers for Resource Nodes
  purities: {
    impure: { id: 'impure', name: 'Impuro', factor: 0.5, color: '#94a3b8' },
    normal: { id: 'normal', name: 'Normal', factor: 1.0, color: '#38bdf8' },
    pure:   { id: 'pure',   name: 'Puro',   factor: 2.0, color: '#4ade80' }
  },

  // Extraction Buildings
  miners: {
    miner_mk1: { id: 'miner_mk1', name: 'Minero Mk.1', baseRate: 60, power: 5, icon: '⛏️', image: 'images/buildings/miner_mk1.png' },
    miner_mk2: { id: 'miner_mk2', name: 'Minero Mk.2', baseRate: 120, power: 12, icon: '⛏️', image: 'images/buildings/miner_mk2.png' },
    miner_mk3: { id: 'miner_mk3', name: 'Minero Mk.3', baseRate: 240, power: 30, icon: '⛏️', image: 'images/buildings/miner_mk3.png' },
    oil_extractor: { id: 'oil_extractor', name: 'Extractor de Petróleo', baseRate: 120, power: 40, isFluid: true, icon: '🛢️', image: 'images/buildings/oil_extractor.png' },
    water_extractor: { id: 'water_extractor', name: 'Extractor de Agua', baseRate: 120, power: 20, isFluid: true, isFixedRate: true, icon: '💧', image: 'images/buildings/water_extractor.png' }
  },

  // Conveyor Belts (Mk.1 - Mk.6 from Satisfactory 1.0)
  belts: [
    { tier: 1, name: 'Cinta Mk.1', speed: 60, color: '#94a3b8' },
    { tier: 2, name: 'Cinta Mk.2', speed: 120, color: '#60a5fa' },
    { tier: 3, name: 'Cinta Mk.3', speed: 270, color: '#f59e0b' },
    { tier: 4, name: 'Cinta Mk.4', speed: 480, color: '#ef4444' },
    { tier: 5, name: 'Cinta Mk.5', speed: 780, color: '#a855f7' },
    { tier: 6, name: 'Cinta Mk.6', speed: 1200, color: '#06b6d4' } // 1.0 addition
  ],

  // Pipelines
  pipes: [
    { tier: 1, name: 'Tubería Mk.1', flow: 300, color: '#38bdf8' },
    { tier: 2, name: 'Tubería Mk.2', flow: 600, color: '#818cf8' }
  ],

  // Production Buildings
  buildings: {
    smelter: { id: 'smelter', name: 'Fundición', power: 4, icon: '🔥', image: 'images/buildings/smelter.png' },
    foundry: { id: 'foundry', name: 'Fundición Avanzada', power: 16, icon: '🏭', image: 'images/buildings/foundry.png' },
    constructor: { id: 'constructor', name: 'Constructora', power: 4, icon: '⚙️', image: 'images/buildings/constructor.png' },
    assembler: { id: 'assembler', name: 'Ensambladora', power: 15, icon: '🔧', image: 'images/buildings/assembler.png' },
    manufacturer: { id: 'manufacturer', name: 'Fabricante', power: 55, icon: '🏭', image: 'images/buildings/manufacturer.png' },
    refinery: { id: 'refinery', name: 'Refinería', power: 30, icon: '⚗️', image: 'images/buildings/refinery.png' },
    blender: { id: 'blender', name: 'Mezcladora', power: 75, icon: '🌀', image: 'images/buildings/blender.png' },
    packager: { id: 'packager', name: 'Empaquetadora', power: 10, icon: '📦', image: 'images/buildings/packager.png' },
    particle_accelerator: { id: 'particle_accelerator', name: 'Acelerador de Partículas', power: 500, icon: '⚛️', image: 'images/buildings/particle_accelerator.png' },
    converter: { id: 'converter', name: 'Convertidor', power: 100, icon: '🔄', image: 'images/buildings/converter.png' },
    quantum_encoder: { id: 'quantum_encoder', name: 'Codificador Cuántico', power: 2000, icon: '🔮', image: 'images/buildings/quantum_encoder.png' }
  },

  // Official Power Generators & Fuels (Satisfactory 1.0 / 1.2)
  powerGenerators: {
    biomass_burner: {
      id: 'biomass_burner',
      name: 'Quemador de Biomasa',
      powerMW: 30,
      icon: '🌿',
      image: 'images/buildings/biomass_burner.png',
      requiresWater: false,
      fuelOptions: [
        { id: 'solid_biofuel', name: 'Biocombustible Sólido', ratePerGen: 4, isFluid: false },
        { id: 'biomass', name: 'Biomasa', ratePerGen: 12, isFluid: false }
      ]
    },
    coal_generator: {
      id: 'coal_generator',
      name: 'Generador de Carbón',
      powerMW: 75,
      icon: '🪨',
      image: 'images/buildings/coal_generator.png',
      requiresWater: true,
      waterRatePerGen: 45, // 45 m3/min
      fuelOptions: [
        { id: 'coal', name: 'Carbón', ratePerGen: 15, isFluid: false, defaultPurity: 'normal' },
        { id: 'compacted_coal', name: 'Carbón Compactado (Alt)', ratePerGen: 7.142857, isFluid: false },
        { id: 'petroleum_coke', name: 'Coque de Petróleo', ratePerGen: 25, isFluid: false }
      ]
    },
    fuel_generator: {
      id: 'fuel_generator',
      name: 'Generador de Combustible',
      powerMW: 250, // 250 MW en Satisfactory 1.0
      icon: '🛢️',
      image: 'images/buildings/fuel_generator.png',
      requiresWater: false,
      fuelOptions: [
        { id: 'fuel', name: 'Combustible Líquido (Fuel)', ratePerGen: 20, isFluid: true },
        { id: 'turbofuel', name: 'Turbocombustible', ratePerGen: 7.5, isFluid: true }
      ]
    },
    nuclear_power_plant: {
      id: 'nuclear_power_plant',
      name: 'Central Nuclear',
      powerMW: 2500,
      icon: '☢️',
      image: 'images/buildings/nuclear_power_plant.png',
      requiresWater: true,
      waterRatePerGen: 240, // 240 m3/min en 1.0
      fuelOptions: [
        { id: 'uranium_fuel_rod', name: 'Varilla de Combustible de Uranio', ratePerGen: 0.2, isFluid: false, wastePerGen: 10 }
      ]
    }
  },

  // Raw Resources
  rawResources: {
    iron_ore: { id: 'iron_ore', name: 'Mineral de Hierro', isFluid: false, category: 'Mineral' },
    copper_ore: { id: 'copper_ore', name: 'Mineral de Cobre', isFluid: false, category: 'Mineral' },
    limestone: { id: 'limestone', name: 'Piedra Caliza', isFluid: false, category: 'Mineral' },
    coal: { id: 'coal', name: 'Carbón', isFluid: false, category: 'Mineral' },
    caterium_ore: { id: 'caterium_ore', name: 'Mineral de Caterio', isFluid: false, category: 'Mineral' },
    raw_quartz: { id: 'raw_quartz', name: 'Cuarzo Crudo', isFluid: false, category: 'Mineral' },
    sulfur: { id: 'sulfur', name: 'Azufre', isFluid: false, category: 'Mineral' },
    bauxite: { id: 'bauxite', name: 'Bauxita', isFluid: false, category: 'Mineral' },
    uranium: { id: 'uranium', name: 'Uranio', isFluid: false, category: 'Mineral' },
    sam: { id: 'sam', name: 'Mineral SAM', isFluid: false, category: 'Mineral' },
    crude_oil: { id: 'crude_oil', name: 'Petróleo Crudo', isFluid: true, category: 'Fluido' },
    water: { id: 'water', name: 'Agua', isFluid: true, category: 'Fluido' },
    nitrogen_gas: { id: 'nitrogen_gas', name: 'Gas Nitrógeno', isFluid: true, category: 'Fluido' }
  },

  // Items metadata
  items: {
    // Ingots & Basics
    iron_ingot: { id: 'iron_ingot', name: 'Lingote de Hierro', category: 'Lingotes' },
    copper_ingot: { id: 'copper_ingot', name: 'Lingote de Cobre', category: 'Lingotes' },
    caterium_ingot: { id: 'caterium_ingot', name: 'Lingote de Caterio', category: 'Lingotes' },
    steel_ingot: { id: 'steel_ingot', name: 'Lingote de Acero', category: 'Lingotes' },
    aluminum_ingot: { id: 'aluminum_ingot', name: 'Lingote de Aluminio', category: 'Lingotes' },
    concrete: { id: 'concrete', name: 'Hormigón', category: 'Básicos' },
    quartz_crystal: { id: 'quartz_crystal', name: 'Cristal de Cuarzo', category: 'Básicos' },
    silica: { id: 'silica', name: 'Sílice', category: 'Básicos' },

    // Tier 1 - 2 Parts
    iron_plate: { id: 'iron_plate', name: 'Plancha de Hierro', category: 'Componentes' },
    iron_rod: { id: 'iron_rod', name: 'Varilla de Hierro', category: 'Componentes' },
    screw: { id: 'screw', name: 'Tornillos', category: 'Componentes' },
    wire: { id: 'wire', name: 'Alambre', category: 'Componentes' },
    cable: { id: 'cable', name: 'Cable', category: 'Componentes' },
    copper_sheet: { id: 'copper_sheet', name: 'Lámina de Cobre', category: 'Componentes' },

    // Tier 3 - 4 Parts
    reinforced_iron_plate: { id: 'reinforced_iron_plate', name: 'Plancha de Hierro Reforzada', category: 'Componentes' },
    rotor: { id: 'rotor', name: 'Rotor', category: 'Componentes' },
    modular_frame: { id: 'modular_frame', name: 'Armazón Modular', category: 'Componentes' },
    steel_beam: { id: 'steel_beam', name: 'Viga de Acero', category: 'Acero' },
    steel_pipe: { id: 'steel_pipe', name: 'Tubería de Acero', category: 'Acero' },
    encased_industrial_beam: { id: 'encased_industrial_beam', name: 'Viga Industrial Encapsulada', category: 'Acero' },
    stator: { id: 'stator', name: 'Estator', category: 'Componentes' },
    motor: { id: 'motor', name: 'Motor', category: 'Componentes' },

    // Tier 5 - 6 Parts (Oil & Electronics)
    plastic: { id: 'plastic', name: 'Plástico', category: 'Petroquímica' },
    rubber: { id: 'rubber', name: 'Goma', category: 'Petroquímica' },
    fuel: { id: 'fuel', name: 'Combustible', isFluid: true, category: 'Petroquímica' },
    turbofuel: { id: 'turbofuel', name: 'Turbocombustible', isFluid: true, category: 'Petroquímica' },
    heavy_oil_residue: { id: 'heavy_oil_residue', name: 'Residuo de Petróleo Pesado', isFluid: true, category: 'Petroquímica' },
    polymer_resin: { id: 'polymer_resin', name: 'Resina de Polímero', category: 'Petroquímica' },
    petroleum_coke: { id: 'petroleum_coke', name: 'Coque de Petróleo', category: 'Petroquímica' },
    circuit_board: { id: 'circuit_board', name: 'Circuito Impreso', category: 'Electrónica' },
    quickwire: { id: 'quickwire', name: 'Alambre Rápido (Caterio)', category: 'Electrónica' },
    ai_limiter: { id: 'ai_limiter', name: 'Limitador de IA', category: 'Electrónica' },
    high_speed_connector: { id: 'high_speed_connector', name: 'Conector de Alta Velocidad', category: 'Electrónica' },
    heavy_modular_frame: { id: 'heavy_modular_frame', name: 'Armazón Modular Pesado', category: 'Componentes' },
    computer: { id: 'computer', name: 'Ordenador (Computadora)', category: 'Electrónica' },

    // Tier 7 - 8 Parts (Aluminum & Advanced)
    alumina_solution: { id: 'alumina_solution', name: 'Solución de Alúmina', isFluid: true, category: 'Aluminio' },
    aluminum_scrap: { id: 'aluminum_scrap', name: 'Chatarra de Aluminio', category: 'Aluminio' },
    alclad_aluminum_sheet: { id: 'alclad_aluminum_sheet', name: 'Lámina de Aluminio Alclad', category: 'Aluminio' },
    aluminum_casing: { id: 'aluminum_casing', name: 'Carcasa de Aluminio', category: 'Aluminio' },
    heat_sink: { id: 'heat_sink', name: 'Disipador Térmico', category: 'Aluminio' },
    crystal_oscillator: { id: 'crystal_oscillator', name: 'Oscilador de Cristal', category: 'Electrónica' },
    radio_control_unit: { id: 'radio_control_unit', name: 'Unidad de Control de Radio', category: 'Electrónica' },
    supercomputer: { id: 'supercomputer', name: 'Superordenador (Supercomputadora)', category: 'Electrónica' },
    cooling_system: { id: 'cooling_system', name: 'Sistema de Refrigeración', category: 'Componentes' },
    fused_modular_frame: { id: 'fused_modular_frame', name: 'Armazón Modular Fusionado', category: 'Componentes' },
    turbo_motor: { id: 'turbo_motor', name: 'Motor Turbo', category: 'Componentes' },

    // Space Elevator Project Parts (Fases 1 a 5 - Satisfactory 1.0)
    smart_plating: { id: 'smart_plating', name: 'Revestimiento Inteligente (Fase 1)', category: 'Ascensor Espacial' },
    versatile_framework: { id: 'versatile_framework', name: 'Estructura Versátil (Fase 2)', category: 'Ascensor Espacial' },
    automated_wiring: { id: 'automated_wiring', name: 'Unidad de Control Automatizada (Fase 2)', category: 'Ascensor Espacial' },
    modular_engine: { id: 'modular_engine', name: 'Motor Modular (Fase 3)', category: 'Ascensor Espacial' },
    adaptive_control_unit: { id: 'adaptive_control_unit', name: 'Unidad de Control Adaptativa (Fase 3)', category: 'Ascensor Espacial' },
    assembly_director_system: { id: 'assembly_director_system', name: 'Sistema Director de Ensamblaje (Fase 4)', category: 'Ascensor Espacial' },
    magnetic_field_generator: { id: 'magnetic_field_generator', name: 'Generador de Campo Magnético (Fase 4)', category: 'Ascensor Espacial' },
    thermal_propulsion_rocket: { id: 'thermal_propulsion_rocket', name: 'Cohete de Propulsión Térmica (Fase 4)', category: 'Ascensor Espacial' },
    nuclear_pasta: { id: 'nuclear_pasta', name: 'Pasta Nuclear (Fase 4)', category: 'Ascensor Espacial' },
    biochemical_sculptor: { id: 'biochemical_sculptor', name: 'Escultor Bioquímico (Fase 5 - 1.0)', category: 'Ascensor Espacial' },
    ballistic_warp_drive: { id: 'ballistic_warp_drive', name: 'Motor Warp Balístico (Fase 5 - 1.0)', category: 'Ascensor Espacial' },
    ai_expansion_server: { id: 'ai_expansion_server', name: 'Servidor de Expansión de IA (Fase 5 - 1.0)', category: 'Ascensor Espacial' }
  },

  // Recipes (Official Satisfactory 1.0 / 1.2 Rates per minute)
  recipes: [
    // --- FUNDICIÓN (SMELTER) ---
    {
      id: 'iron_ingot_std',
      name: 'Lingote de Hierro',
      building: 'smelter',
      isAlt: false,
      inputs: [{ item: 'iron_ore', rate: 30 }],
      outputs: [{ item: 'iron_ingot', rate: 30 }]
    },
    {
      id: 'copper_ingot_std',
      name: 'Lingote de Cobre',
      building: 'smelter',
      isAlt: false,
      inputs: [{ item: 'copper_ore', rate: 30 }],
      outputs: [{ item: 'copper_ingot', rate: 30 }]
    },
    {
      id: 'caterium_ingot_std',
      name: 'Lingote de Caterio',
      building: 'smelter',
      isAlt: false,
      inputs: [{ item: 'caterium_ore', rate: 45 }],
      outputs: [{ item: 'caterium_ingot', rate: 15 }]
    },

    // --- FUNDICIÓN AVANZADA (FOUNDRY) ---
    {
      id: 'steel_ingot_std',
      name: 'Lingote de Acero',
      building: 'foundry',
      isAlt: false,
      inputs: [
        { item: 'iron_ore', rate: 45 },
        { item: 'coal', rate: 45 }
      ],
      outputs: [{ item: 'steel_ingot', rate: 45 }]
    },
    {
      id: 'steel_ingot_solid',
      name: 'Lingote de Acero Sólido (Alt)',
      building: 'foundry',
      isAlt: true,
      inputs: [
        { item: 'iron_ingot', rate: 40 },
        { item: 'coal', rate: 40 }
      ],
      outputs: [{ item: 'steel_ingot', rate: 60 }]
    },
    {
      id: 'copper_alloy_ingot',
      name: 'Aleación de Cobre (Alt)',
      building: 'foundry',
      isAlt: true,
      inputs: [
        { item: 'copper_ore', rate: 50 },
        { item: 'iron_ore', rate: 25 }
      ],
      outputs: [{ item: 'copper_ingot', rate: 100 }]
    },
    {
      id: 'iron_alloy_ingot',
      name: 'Aleación de Hierro (Alt)',
      building: 'foundry',
      isAlt: true,
      inputs: [
        { item: 'iron_ore', rate: 20 },
        { item: 'copper_ore', rate: 20 }
      ],
      outputs: [{ item: 'iron_ingot', rate: 50 }]
    },
    {
      id: 'aluminum_ingot_std',
      name: 'Lingote de Aluminio',
      building: 'foundry',
      isAlt: false,
      inputs: [
        { item: 'aluminum_scrap', rate: 90 },
        { item: 'silica', rate: 75 }
      ],
      outputs: [{ item: 'aluminum_ingot', rate: 60 }]
    },

    // --- CONSTRUCTORA (CONSTRUCTOR) ---
    {
      id: 'concrete_std',
      name: 'Hormigón',
      building: 'constructor',
      isAlt: false,
      inputs: [{ item: 'limestone', rate: 45 }],
      outputs: [{ item: 'concrete', rate: 15 }]
    },
    {
      id: 'iron_plate_std',
      name: 'Plancha de Hierro',
      building: 'constructor',
      isAlt: false,
      inputs: [{ item: 'iron_ingot', rate: 30 }],
      outputs: [{ item: 'iron_plate', rate: 20 }]
    },
    {
      id: 'iron_rod_std',
      name: 'Varilla de Hierro',
      building: 'constructor',
      isAlt: false,
      inputs: [{ item: 'iron_ingot', rate: 15 }],
      outputs: [{ item: 'iron_rod', rate: 15 }]
    },
    {
      id: 'screw_std',
      name: 'Tornillos',
      building: 'constructor',
      isAlt: false,
      inputs: [{ item: 'iron_rod', rate: 10 }],
      outputs: [{ item: 'screw', rate: 40 }]
    },
    {
      id: 'screw_cast',
      name: 'Tornillos Fundidos (Alt)',
      building: 'constructor',
      isAlt: true,
      inputs: [{ item: 'iron_ingot', rate: 12.5 }],
      outputs: [{ item: 'screw', rate: 50 }]
    },
    {
      id: 'screw_steel',
      name: 'Tornillos de Acero (Alt)',
      building: 'constructor',
      isAlt: true,
      inputs: [{ item: 'steel_beam', rate: 5 }],
      outputs: [{ item: 'screw', rate: 260 }]
    },
    {
      id: 'wire_std',
      name: 'Alambre',
      building: 'constructor',
      isAlt: false,
      inputs: [{ item: 'copper_ingot', rate: 15 }],
      outputs: [{ item: 'wire', rate: 30 }]
    },
    {
      id: 'wire_iron',
      name: 'Alambre de Hierro (Alt)',
      building: 'constructor',
      isAlt: true,
      inputs: [{ item: 'iron_ingot', rate: 12.5 }],
      outputs: [{ item: 'wire', rate: 22.5 }]
    },
    {
      id: 'wire_caterium',
      name: 'Alambre Fundido de Caterio (Alt)',
      building: 'constructor',
      isAlt: true,
      inputs: [{ item: 'caterium_ingot', rate: 15 }],
      outputs: [{ item: 'wire', rate: 120 }]
    },
    {
      id: 'cable_std',
      name: 'Cable',
      building: 'constructor',
      isAlt: false,
      inputs: [{ item: 'wire', rate: 60 }],
      outputs: [{ item: 'cable', rate: 30 }]
    },
    {
      id: 'copper_sheet_std',
      name: 'Lámina de Cobre',
      building: 'constructor',
      isAlt: false,
      inputs: [{ item: 'copper_ingot', rate: 20 }],
      outputs: [{ item: 'copper_sheet', rate: 10 }]
    },
    {
      id: 'steel_beam_std',
      name: 'Viga de Acero',
      building: 'constructor',
      isAlt: false,
      inputs: [{ item: 'steel_ingot', rate: 60 }],
      outputs: [{ item: 'steel_beam', rate: 15 }]
    },
    {
      id: 'steel_pipe_std',
      name: 'Tubería de Acero',
      building: 'constructor',
      isAlt: false,
      inputs: [{ item: 'steel_ingot', rate: 30 }],
      outputs: [{ item: 'steel_pipe', rate: 20 }]
    },
    {
      id: 'quartz_crystal_std',
      name: 'Cristal de Cuarzo',
      building: 'constructor',
      isAlt: false,
      inputs: [{ item: 'raw_quartz', rate: 37.5 }],
      outputs: [{ item: 'quartz_crystal', rate: 22.5 }]
    },
    {
      id: 'silica_std',
      name: 'Sílice',
      building: 'constructor',
      isAlt: false,
      inputs: [{ item: 'raw_quartz', rate: 22.5 }],
      outputs: [{ item: 'silica', rate: 37.5 }]
    },
    {
      id: 'quickwire_std',
      name: 'Alambre Rápido',
      building: 'constructor',
      isAlt: false,
      inputs: [{ item: 'caterium_ingot', rate: 12 }],
      outputs: [{ item: 'quickwire', rate: 60 }]
    },
    {
      id: 'aluminum_casing_std',
      name: 'Carcasa de Aluminio',
      building: 'constructor',
      isAlt: false,
      inputs: [{ item: 'aluminum_ingot', rate: 90 }],
      outputs: [{ item: 'aluminum_casing', rate: 60 }]
    },

    // --- ENSAMBLADORA (ASSEMBLER) ---
    {
      id: 'reinforced_iron_plate_std',
      name: 'Plancha de Hierro Reforzada',
      building: 'assembler',
      isAlt: false,
      inputs: [
        { item: 'iron_plate', rate: 30 },
        { item: 'screw', rate: 60 }
      ],
      outputs: [{ item: 'reinforced_iron_plate', rate: 5 }]
    },
    {
      id: 'reinforced_iron_plate_stitched',
      name: 'Plancha Cosida (Alt)',
      building: 'assembler',
      isAlt: true,
      inputs: [
        { item: 'iron_plate', rate: 18.75 },
        { item: 'wire', rate: 37.5 }
      ],
      outputs: [{ item: 'reinforced_iron_plate', rate: 5.625 }]
    },
    {
      id: 'reinforced_iron_plate_bolted',
      name: 'Plancha Atornillada (Alt)',
      building: 'assembler',
      isAlt: true,
      inputs: [
        { item: 'iron_plate', rate: 90 },
        { item: 'screw', rate: 250 }
      ],
      outputs: [{ item: 'reinforced_iron_plate', rate: 15 }]
    },
    {
      id: 'rotor_std',
      name: 'Rotor',
      building: 'assembler',
      isAlt: false,
      inputs: [
        { item: 'iron_rod', rate: 20 },
        { item: 'screw', rate: 100 }
      ],
      outputs: [{ item: 'rotor', rate: 4 }]
    },
    {
      id: 'rotor_steel',
      name: 'Rotor de Acero (Alt)',
      building: 'assembler',
      isAlt: true,
      inputs: [
        { item: 'steel_pipe', rate: 10 },
        { item: 'wire', rate: 30 }
      ],
      outputs: [{ item: 'rotor', rate: 5 }]
    },
    {
      id: 'modular_frame_std',
      name: 'Armazón Modular',
      building: 'assembler',
      isAlt: false,
      inputs: [
        { item: 'reinforced_iron_plate', rate: 3 },
        { item: 'iron_rod', rate: 12 }
      ],
      outputs: [{ item: 'modular_frame', rate: 2 }]
    },
    {
      id: 'modular_frame_steeled',
      name: 'Armazón de Acero (Alt)',
      building: 'assembler',
      isAlt: true,
      inputs: [
        { item: 'reinforced_iron_plate', rate: 2 },
        { item: 'steel_pipe', rate: 10 }
      ],
      outputs: [{ item: 'modular_frame', rate: 3 }]
    },
    {
      id: 'stator_std',
      name: 'Estator',
      building: 'assembler',
      isAlt: false,
      inputs: [
        { item: 'steel_pipe', rate: 15 },
        { item: 'wire', rate: 40 }
      ],
      outputs: [{ item: 'stator', rate: 5 }]
    },
    {
      id: 'motor_std',
      name: 'Motor',
      building: 'assembler',
      isAlt: false,
      inputs: [
        { item: 'rotor', rate: 10 },
        { item: 'stator', rate: 10 }
      ],
      outputs: [{ item: 'motor', rate: 5 }]
    },
    {
      id: 'encased_industrial_beam_std',
      name: 'Viga Industrial Encapsulada',
      building: 'assembler',
      isAlt: false,
      inputs: [
        { item: 'steel_beam', rate: 18 },
        { item: 'concrete', rate: 36 }
      ],
      outputs: [{ item: 'encased_industrial_beam', rate: 6 }]
    },
    {
      id: 'encased_industrial_pipe',
      name: 'Tubería Encapsulada (Alt)',
      building: 'assembler',
      isAlt: true,
      inputs: [
        { item: 'steel_pipe', rate: 24 },
        { item: 'concrete', rate: 20 }
      ],
      outputs: [{ item: 'encased_industrial_beam', rate: 4 }]
    },
    {
      id: 'circuit_board_std',
      name: 'Circuito Impreso',
      building: 'assembler',
      isAlt: false,
      inputs: [
        { item: 'copper_sheet', rate: 15 },
        { item: 'plastic', rate: 30 }
      ],
      outputs: [{ item: 'circuit_board', rate: 7.5 }]
    },
    {
      id: 'circuit_board_silicon',
      name: 'Circuito de Silicio (Alt)',
      building: 'assembler',
      isAlt: true,
      inputs: [
        { item: 'copper_sheet', rate: 27.5 },
        { item: 'silica', rate: 27.5 }
      ],
      outputs: [{ item: 'circuit_board', rate: 12.5 }]
    },
    {
      id: 'circuit_board_caterium',
      name: 'Circuito de Caterio (Alt)',
      building: 'assembler',
      isAlt: true,
      inputs: [
        { item: 'plastic', rate: 12.5 },
        { item: 'quickwire', rate: 37.5 }
      ],
      outputs: [{ item: 'circuit_board', rate: 8.75 }]
    },
    {
      id: 'ai_limiter_std',
      name: 'Limitador de IA',
      building: 'assembler',
      isAlt: false,
      inputs: [
        { item: 'copper_sheet', rate: 25 },
        { item: 'quickwire', rate: 100 }
      ],
      outputs: [{ item: 'ai_limiter', rate: 5 }]
    },
    {
      id: 'alclad_aluminum_sheet_std',
      name: 'Lámina de Aluminio Alclad',
      building: 'assembler',
      isAlt: false,
      inputs: [
        { item: 'aluminum_ingot', rate: 30 },
        { item: 'copper_ingot', rate: 10 }
      ],
      outputs: [{ item: 'alclad_aluminum_sheet', rate: 30 }]
    },
    {
      id: 'heat_sink_std',
      name: 'Disipador Térmico',
      building: 'assembler',
      isAlt: false,
      inputs: [
        { item: 'alclad_aluminum_sheet', rate: 37.5 },
        { item: 'copper_sheet', rate: 22.5 }
      ],
      outputs: [{ item: 'heat_sink', rate: 7.5 }]
    },

    // --- ASCENSOR ESPACIAL (SPACE ELEVATOR PHASES) ---
    {
      id: 'smart_plating_std',
      name: 'Revestimiento Inteligente (Fase 1)',
      building: 'assembler',
      isAlt: false,
      inputs: [
        { item: 'reinforced_iron_plate', rate: 2 },
        { item: 'rotor', rate: 2 }
      ],
      outputs: [{ item: 'smart_plating', rate: 2 }]
    },
    {
      id: 'versatile_framework_std',
      name: 'Estructura Versátil (Fase 2)',
      building: 'assembler',
      isAlt: false,
      inputs: [
        { item: 'modular_frame', rate: 2.5 },
        { item: 'steel_beam', rate: 30 }
      ],
      outputs: [{ item: 'versatile_framework', rate: 5 }]
    },
    {
      id: 'automated_wiring_std',
      name: 'Unidad de Control Automatizada (Fase 2)',
      building: 'assembler',
      isAlt: false,
      inputs: [
        { item: 'stator', rate: 2.5 },
        { item: 'cable', rate: 50 }
      ],
      outputs: [{ item: 'automated_wiring', rate: 2.5 }]
    },

    // --- FABRICANTE (MANUFACTURER) ---
    {
      id: 'heavy_modular_frame_std',
      name: 'Armazón Modular Pesado',
      building: 'manufacturer',
      isAlt: false,
      inputs: [
        { item: 'modular_frame', rate: 10 },
        { item: 'steel_pipe', rate: 40 },
        { item: 'encased_industrial_beam', rate: 10 },
        { item: 'screw', rate: 240 }
      ],
      outputs: [{ item: 'heavy_modular_frame', rate: 2 }]
    },
    {
      id: 'heavy_modular_frame_encased',
      name: 'Armazón Pesado Encapsulado (Alt)',
      building: 'manufacturer',
      isAlt: true,
      inputs: [
        { item: 'modular_frame', rate: 7.5 },
        { item: 'encased_industrial_beam', rate: 9.375 },
        { item: 'steel_pipe', rate: 33.75 },
        { item: 'concrete', rate: 20.625 }
      ],
      outputs: [{ item: 'heavy_modular_frame', rate: 2.8125 }]
    },
    {
      id: 'computer_std',
      name: 'Ordenador (Computadora)',
      building: 'manufacturer',
      isAlt: false,
      inputs: [
        { item: 'circuit_board', rate: 10 },
        { item: 'cable', rate: 20 },
        { item: 'plastic', rate: 40 }
      ],
      outputs: [{ item: 'computer', rate: 2.5 }]
    },
    {
      id: 'computer_caterium',
      name: 'Ordenador de Caterio (Alt)',
      building: 'manufacturer',
      isAlt: true,
      inputs: [
        { item: 'circuit_board', rate: 15 },
        { item: 'quickwire', rate: 52.5 },
        { item: 'rubber', rate: 22.5 }
      ],
      outputs: [{ item: 'computer', rate: 3.75 }]
    },
    {
      id: 'computer_crystal',
      name: 'Ordenador de Cristal (Alt)',
      building: 'assembler',
      isAlt: true,
      inputs: [
        { item: 'circuit_board', rate: 5 },
        { item: 'crystal_oscillator', rate: 1.667 }
      ],
      outputs: [{ item: 'computer', rate: 3.333 }]
    },
    {
      id: 'high_speed_connector_std',
      name: 'Conector de Alta Velocidad',
      building: 'manufacturer',
      isAlt: false,
      inputs: [
        { item: 'quickwire', rate: 210 },
        { item: 'cable', rate: 37.5 },
        { item: 'circuit_board', rate: 3.75 }
      ],
      outputs: [{ item: 'high_speed_connector', rate: 3.75 }]
    },
    {
      id: 'crystal_oscillator_std',
      name: 'Oscilador de Cristal',
      building: 'manufacturer',
      isAlt: false,
      inputs: [
        { item: 'quartz_crystal', rate: 18 },
        { item: 'cable', rate: 14 },
        { item: 'reinforced_iron_plate', rate: 2.5 }
      ],
      outputs: [{ item: 'crystal_oscillator', rate: 1 }]
    },
    {
      id: 'radio_control_unit_std',
      name: 'Unidad de Control de Radio',
      building: 'manufacturer',
      isAlt: false,
      inputs: [
        { item: 'aluminum_casing', rate: 40 },
        { item: 'crystal_oscillator', rate: 1.25 },
        { item: 'computer', rate: 1.25 }
      ],
      outputs: [{ item: 'radio_control_unit', rate: 2.5 }]
    },
    {
      id: 'supercomputer_std',
      name: 'Superordenador (Supercomputadora)',
      building: 'manufacturer',
      isAlt: false,
      inputs: [
        { item: 'computer', rate: 7.5 },
        { item: 'ai_limiter', rate: 3.75 },
        { item: 'high_speed_connector', rate: 5.625 },
        { item: 'plastic', rate: 52.5 }
      ],
      outputs: [{ item: 'supercomputer', rate: 1.875 }]
    },
    {
      id: 'supercomputer_oc',
      name: 'Superordenador OC (Alt)',
      building: 'assembler',
      isAlt: true,
      inputs: [
        { item: 'radio_control_unit', rate: 9 },
        { item: 'cooling_system', rate: 9 }
      ],
      outputs: [{ item: 'supercomputer', rate: 3 }]
    },
    {
      id: 'turbo_motor_std',
      name: 'Motor Turbo',
      building: 'manufacturer',
      isAlt: false,
      inputs: [
        { item: 'motor', rate: 7.5 },
        { item: 'radio_control_unit', rate: 3.75 },
        { item: 'cooling_system', rate: 4.5 },
        { item: 'rubber', rate: 45 }
      ],
      outputs: [{ item: 'turbo_motor', rate: 1.875 }]
    },
    {
      id: 'modular_engine_std',
      name: 'Motor Modular (Fase 3)',
      building: 'manufacturer',
      isAlt: false,
      inputs: [
        { item: 'motor', rate: 2 },
        { item: 'rubber', rate: 15 },
        { item: 'smart_plating', rate: 2 }
      ],
      outputs: [{ item: 'modular_engine', rate: 1 }]
    },
    {
      id: 'adaptive_control_unit_std',
      name: 'Unidad de Control Adaptativa (Fase 3)',
      building: 'manufacturer',
      isAlt: false,
      inputs: [
        { item: 'automated_wiring', rate: 7.5 },
        { item: 'circuit_board', rate: 5 },
        { item: 'heavy_modular_frame', rate: 1 },
        { item: 'computer', rate: 2 }
      ],
      outputs: [{ item: 'adaptive_control_unit', rate: 1 }]
    },

    // --- REFINERÍA (REFINERY) ---
    {
      id: 'plastic_std',
      name: 'Plástico (+ Fuel Residual)',
      building: 'refinery',
      isAlt: false,
      inputs: [{ item: 'crude_oil', rate: 30 }],
      outputs: [
        { item: 'plastic', rate: 20 },
        { item: 'fuel', rate: 10 }
      ]
    },
    {
      id: 'rubber_std',
      name: 'Goma (+ Fuel Residual)',
      building: 'refinery',
      isAlt: false,
      inputs: [{ item: 'crude_oil', rate: 30 }],
      outputs: [
        { item: 'rubber', rate: 20 },
        { item: 'fuel', rate: 20 }
      ]
    },
    {
      id: 'fuel_std',
      name: 'Combustible (+ Resina de Polímero)',
      building: 'refinery',
      isAlt: false,
      inputs: [{ item: 'crude_oil', rate: 60 }],
      outputs: [
        { item: 'fuel', rate: 40 },
        { item: 'polymer_resin', rate: 30 }
      ]
    },
    {
      id: 'turbofuel_std',
      name: 'Turbocombustible',
      building: 'refinery',
      isAlt: false,
      inputs: [
        { item: 'fuel', rate: 22.5 },
        { item: 'compacted_coal', rate: 15 }
      ],
      outputs: [{ item: 'turbofuel', rate: 18.75 }]
    },
    {
      id: 'petroleum_coke_std',
      name: 'Coque de Petróleo',
      building: 'refinery',
      isAlt: false,
      inputs: [{ item: 'heavy_oil_residue', rate: 40 }],
      outputs: [{ item: 'petroleum_coke', rate: 120 }]
    },
    {
      id: 'alumina_solution_std',
      name: 'Solución de Alúmina (+ Sílice)',
      building: 'refinery',
      isAlt: false,
      inputs: [
        { item: 'bauxite', rate: 120 },
        { item: 'water', rate: 180 }
      ],
      outputs: [
        { item: 'alumina_solution', rate: 120 },
        { item: 'silica', rate: 50 }
      ]
    },
    {
      id: 'aluminum_scrap_std',
      name: 'Chatarra de Aluminio (+ Agua)',
      building: 'refinery',
      isAlt: false,
      inputs: [
        { item: 'alumina_solution', rate: 240 },
        { item: 'coal', rate: 120 }
      ],
      outputs: [
        { item: 'aluminum_scrap', rate: 360 },
        { item: 'water', rate: 120 }
      ]
    },
    {
      id: 'pure_iron_ingot',
      name: 'Lingote de Hierro Puro (Alt)',
      building: 'refinery',
      isAlt: true,
      inputs: [
        { item: 'iron_ore', rate: 35 },
        { item: 'water', rate: 20 }
      ],
      outputs: [{ item: 'iron_ingot', rate: 65 }]
    },
    {
      id: 'pure_copper_ingot',
      name: 'Lingote de Cobre Puro (Alt)',
      building: 'refinery',
      isAlt: true,
      inputs: [
        { item: 'copper_ore', rate: 15 },
        { item: 'water', rate: 10 }
      ],
      outputs: [{ item: 'copper_ingot', rate: 37.5 }]
    },

    // --- BLENDER (MEZCLADORA) ---
    {
      id: 'cooling_system_std',
      name: 'Sistema de Refrigeración',
      building: 'blender',
      isAlt: false,
      inputs: [
        { item: 'heat_sink', rate: 12 }, // proxy for casing + sheet
        { item: 'rubber', rate: 12 },
        { item: 'water', rate: 30 },
        { item: 'nitrogen_gas', rate: 15 }
      ],
      outputs: [{ item: 'cooling_system', rate: 6 }]
    },
    {
      id: 'fused_modular_frame_std',
      name: 'Armazón Modular Fusionado',
      building: 'blender',
      isAlt: false,
      inputs: [
        { item: 'heavy_modular_frame', rate: 1.5 },
        { item: 'aluminum_casing', rate: 75 },
        { item: 'nitrogen_gas', rate: 37.5 }
      ],
      outputs: [{ item: 'fused_modular_frame', rate: 1.5 }]
    }
  ]
};

// Export for browser global context
window.SATIS_DATA = SATIS_DATA;
