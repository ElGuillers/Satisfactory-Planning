/**
 * SATISFACTORY CALCULATOR ENGINE (1.0+ / 1.2 COMPLIANT)
 * Pure computation functions for extraction, distribution, ratios, and factory chains.
 */

const SatisCalc = {
  /**
   * Calculate miner output and belt requirement
   * @param {string} purityId - 'impure' | 'normal' | 'pure'
   * @param {string} minerId - 'miner_mk1' | 'miner_mk2' | 'miner_mk3' | 'oil_extractor' | 'water_extractor'
   * @param {number} clockPercent - 1 to 250
   */
  calculateExtraction(purityId, minerId, clockPercent = 100) {
    const purity = SATIS_DATA.purities[purityId] || SATIS_DATA.purities.normal;
    const miner = SATIS_DATA.miners[minerId] || SATIS_DATA.miners.miner_mk1;

    const clockRatio = clockPercent / 100;
    // Water extractors don't have purity nodes; they are placed on open water
    const factor = miner.isFixedRate ? 1.0 : purity.factor;
    const exactRate = miner.baseRate * factor * clockRatio;

    // Power Shards calculation (1 shard per +50% above 100%)
    let powerShards = 0;
    if (clockPercent > 100) {
      powerShards = Math.ceil((clockPercent - 100) / 50);
    }

    // Exponent for production power scaling in Satisfactory 1.0
    // Power = Base * (Clock / 100) ^ 1.321928
    const powerMw = miner.power * Math.pow(clockRatio, 1.321928);

    // Belt recommendation
    let recommendedBelt = null;
    let beltOverflow = false;

    if (miner.isFluid) {
      recommendedBelt = exactRate <= 300 
        ? SATIS_DATA.pipes[0] 
        : SATIS_DATA.pipes[1];
      if (exactRate > 600) beltOverflow = true;
    } else {
      for (const b of SATIS_DATA.belts) {
        if (exactRate <= b.speed) {
          recommendedBelt = b;
          break;
        }
      }
      if (!recommendedBelt) {
        recommendedBelt = SATIS_DATA.belts[SATIS_DATA.belts.length - 1]; // Mk.6 (1200)
        if (exactRate > 1200) {
          beltOverflow = true;
        }
      }
    }

    return {
      rate: Number(exactRate.toFixed(4)),
      purity,
      miner,
      clockPercent,
      powerShards,
      powerMw: Number(powerMw.toFixed(2)),
      recommendedBelt,
      beltOverflow,
      isFluid: !!miner.isFluid
    };
  },

  /**
   * Find the minimal belt tier for a given rate
   */
  getBeltForRate(rate) {
    for (const b of SATIS_DATA.belts) {
      if (rate <= b.speed) return b;
    }
    return SATIS_DATA.belts[SATIS_DATA.belts.length - 1]; // Mk.6
  },

  /**
   * Find the minimal pipeline tier for a given flow rate
   */
  getPipeForRate(rate) {
    const pipes = SATIS_DATA.pipes || [
      { tier: 1, name: 'Tubería Mk.1', flow: 300, color: '#38bdf8' },
      { tier: 2, name: 'Tubería Mk.2', flow: 600, color: '#818cf8' }
    ];
    for (const p of pipes) {
      if (rate <= p.flow) return p;
    }
    return pipes[pipes.length - 1];
  },

  /**
   * Calculate splitting and machine feeding
   * @param {number} inputRate - available materials/min
   * @param {number} machineIntake - material consumed by 1 machine at 100%
   */
  calculateSplitting(inputRate, machineIntake) {
    if (inputRate <= 0 || machineIntake <= 0) return null;

    const totalMachinesFloat = inputRate / machineIntake;
    const wholeMachines = Math.floor(totalMachinesFloat);
    const fractionalRemainder = totalMachinesFloat - wholeMachines;

    // Fractional machine clock speed if keeping others at 100%
    const lastMachineClock = fractionalRemainder > 0 
      ? Number((fractionalRemainder * 100).toFixed(2)) 
      : 100;

    // Synchronized clock speed if distributing load evenly across all ceil(N) machines
    const ceilMachines = Math.ceil(totalMachinesFloat);
    const syncClock = Number(((totalMachinesFloat / ceilMachines) * 100).toFixed(2));

    // Belts needed for the main trunk in a manifold
    // At each machine, input decreases by machineIntake
    const manifoldSteps = [];
    let remainingFlow = inputRate;
    for (let i = 0; i < ceilMachines; i++) {
      const belt = this.getBeltForRate(remainingFlow);
      const isLast = (i === ceilMachines - 1);
      const machineConsumption = isLast && fractionalRemainder > 0 
        ? Number((fractionalRemainder * machineIntake).toFixed(2)) 
        : machineIntake;

      manifoldSteps.push({
        machineIndex: i + 1,
        flowBefore: Number(remainingFlow.toFixed(2)),
        machineConsumes: machineConsumption,
        recommendedBelt: belt,
        isFractional: isLast && fractionalRemainder > 0
      });

      remainingFlow -= machineConsumption;
      if (remainingFlow < 0.0001) remainingFlow = 0;
    }

    // Balancer topology suggestion
    let balancerType = 'Manifold (Recomendado FICSIT)';
    let balancerDetail = 'Un manifold con splitters en cascada es compacto y se auto-satura al 100% en pocos minutos.';

    if (ceilMachines === 2) {
      balancerType = 'División 1:2 (1 Splitter)';
      balancerDetail = '1 divisor divide 50% / 50% perfecto.';
    } else if (ceilMachines === 4) {
      balancerType = 'División 1:4 (3 Splitters)';
      balancerDetail = '1 divisor primario alimenta 2 divisores secundarios.';
    } else if (ceilMachines === 8) {
      balancerType = 'División 1:8 (7 Splitters)';
      balancerDetail = 'Árbol binario simétrico de 3 niveles de divisores.';
    } else if (ceilMachines === 3) {
      balancerType = 'División 1:3 (1 Splitter)';
      balancerDetail = '1 divisor estándar con sus 3 salidas activas (33.33% cada una).';
    } else if (ceilMachines === 6) {
      balancerType = 'División 1:6 (4 Splitters)';
      balancerDetail = '1 divisor inicial de 3 vías -> cada salida a 1 divisor de 2 vías.';
    }

    return {
      inputRate,
      machineIntake,
      totalMachinesFloat: Number(totalMachinesFloat.toFixed(3)),
      wholeMachines,
      fractionalRemainder: Number(fractionalRemainder.toFixed(3)),
      ceilMachines,
      lastMachineClock,
      syncClock,
      feederBelt: this.getBeltForRate(machineIntake),
      mainBelt: this.getBeltForRate(inputRate),
      manifoldSteps,
      balancerType,
      balancerDetail
    };
  },

  /**
   * Generates step-by-step schematic for splitting input into N machines
   */
  calculateManifoldFlow(inputRate, machineIntake, machineCount) {
    const ceilMachines = Math.max(1, Math.ceil(machineCount));
    const steps = [];
    let remainingFlow = inputRate;

    for (let i = 0; i < ceilMachines; i++) {
      const machineIndex = i + 1;
      const isLast = (i === ceilMachines - 1);
      const isFractional = (machineCount % 1 !== 0);
      const consumes = isLast && isFractional
        ? Number(((machineCount % 1) * machineIntake).toFixed(2))
        : machineIntake;

      const beltIn = this.getBeltForRate(remainingFlow);
      const remainingAfter = Math.max(0, Number((remainingFlow - consumes).toFixed(2)));
      const beltContinue = isLast ? null : this.getBeltForRate(remainingAfter);
      const feederBelt = this.getBeltForRate(consumes);

      steps.push({
        machineIndex,
        isLast,
        flowIn: Number(remainingFlow.toFixed(2)),
        beltIn,
        consumes: Number(consumes.toFixed(2)),
        feederBelt,
        flowRemaining: remainingAfter,
        beltContinue,
        splitterIndex: (ceilMachines > 1 && !isLast) ? (i + 1) : null
      });

      remainingFlow = remainingAfter;
    }

    return {
      totalMachines: ceilMachines,
      splittersNeeded: Math.max(0, ceilMachines - 1),
      steps
    };
  },

  /**
   * Find recipe producing an item
   * @param {string} itemId
   * @param {boolean} preferAlt
   */
  findRecipeForItem(itemId, selectedAltRecipes = {}) {
    // If user specifically picked a recipe ID for this item
    if (selectedAltRecipes[itemId]) {
      const chosen = SATIS_DATA.recipes.find(r => r.id === selectedAltRecipes[itemId]);
      if (chosen) return chosen;
    }

    // Default: find standard recipe
    const std = SATIS_DATA.recipes.find(r => !r.isAlt && r.outputs.some(o => o.item === itemId));
    if (std) return std;

    // Or any recipe
    return SATIS_DATA.recipes.find(r => r.outputs.some(o => o.item === itemId));
  },

  /**
   * Get all recipes that can produce a given item
   */
  getRecipesForItem(itemId) {
    return SATIS_DATA.recipes.filter(r => r.outputs.some(o => o.item === itemId));
  },

  /**
   * Multi-tier recursive factory plan
   * Computes entire chain backwards from target item
   */
  planFactory(targetItemId, targetRate, selectedRecipes = {}) {
    const rawRequirements = {};
    const machineSteps = [];
    const visited = new Set();

    function recurse(itemId, neededRate, depth = 0) {
      // Check if it's a raw resource
      if (SATIS_DATA.rawResources[itemId]) {
        rawRequirements[itemId] = (rawRequirements[itemId] || 0) + neededRate;
        return;
      }

      // Find recipe
      const recipe = SatisCalc.findRecipeForItem(itemId, selectedRecipes);
      if (!recipe) {
        // Unknown or raw fallback
        rawRequirements[itemId] = (rawRequirements[itemId] || 0) + neededRate;
        return;
      }

      const outEntry = recipe.outputs.find(o => o.item === itemId);
      const baseOutRate = outEntry ? outEntry.rate : 1;
      const machinesCount = neededRate / baseOutRate;
      const building = SATIS_DATA.buildings[recipe.building];
      const basePower = building ? building.power : 10;
      const totalPower = machinesCount * basePower;

      // Register step
      machineSteps.push({
        depth,
        itemId,
        recipe,
        building,
        neededRate: Number(neededRate.toFixed(3)),
        machinesCount: Number(machinesCount.toFixed(3)),
        wholeMachines: Math.floor(machinesCount),
        remainderClock: Number(((machinesCount - Math.floor(machinesCount)) * 100).toFixed(2)),
        totalPower: Number(totalPower.toFixed(2)),
        inputs: recipe.inputs.map(inp => ({
          item: inp.item,
          rateTotal: Number((inp.rate * machinesCount).toFixed(3)),
          ratePerMachine: inp.rate
        }))
      });

      // Recurse inputs
      for (const inp of recipe.inputs) {
        const inputRateRequired = inp.rate * machinesCount;
        recurse(inp.item, inputRateRequired, depth + 1);
      }
    }

    recurse(targetItemId, targetRate, 0);

    // Calculate total energy
    const totalEnergyMw = machineSteps.reduce((sum, s) => sum + s.totalPower, 0);

    // Format raw requirements with node purity equivalents
    const rawBreakdown = Object.entries(rawRequirements).map(([rawId, requiredRate]) => {
      const rawMeta = SATIS_DATA.rawResources[rawId] || { name: rawId, isFluid: false };
      const rate = Number(requiredRate.toFixed(2));

      // Calculate how many nodes of each purity would satisfy this
      // Example with Miner Mk.2 (120 normal):
      const impureMk2 = rate / 60;
      const normalMk2 = rate / 120;
      const pureMk2 = rate / 240;

      return {
        rawId,
        name: rawMeta.name,
        isFluid: rawMeta.isFluid,
        requiredRate: rate,
        beltNeeded: SatisCalc.getBeltForRate(rate),
        nodeEquivalents: {
          impureMk2: Number(impureMk2.toFixed(2)),
          normalMk2: Number(normalMk2.toFixed(2)),
          pureMk2: Number(pureMk2.toFixed(2))
        }
      };
    });

    return {
      targetItemId,
      targetRate,
      targetName: (SATIS_DATA.items[targetItemId] || {}).name || targetItemId,
      machineSteps,
      rawBreakdown,
      totalEnergyMw: Number(totalEnergyMw.toFixed(2))
    };
  },

  /**
   * Complete Target-Driven Factory Plan (Forward Tree Pipeline)
   * Calculates all raw minerals required, groups manufacturing stages forward,
   * and provides manifold splitters and logistics for the entire factory.
   */
  buildTargetFactoryPlan(targetItemId, targetRate, selectedRecipes = {}, purityOverrides = {}, minerOverrides = {}, nodeCountOverrides = {}, globalMinerTier = 'miner_mk1') {
    const rawRequirements = {};
    const rawStepList = [];

    function recurse(itemId, neededRate, depth = 0) {
      if (SATIS_DATA.rawResources[itemId]) {
        rawRequirements[itemId] = (rawRequirements[itemId] || 0) + neededRate;
        return;
      }

      const recipe = SatisCalc.findRecipeForItem(itemId, selectedRecipes);
      if (!recipe) {
        rawRequirements[itemId] = (rawRequirements[itemId] || 0) + neededRate;
        return;
      }

      const outEntry = recipe.outputs.find(o => o.item === itemId) || recipe.outputs[0];
      const baseOutRate = outEntry ? outEntry.rate : 1;
      const machinesCount = neededRate / baseOutRate;
      const building = SATIS_DATA.buildings[recipe.building] || { name: recipe.building, power: 10 };
      const totalPower = machinesCount * (building.power || 10);

      rawStepList.push({
        depth,
        itemId,
        recipe,
        building,
        neededRate,
        machinesCount,
        totalPower,
        inputs: recipe.inputs.map(inp => ({
          item: inp.item,
          rateTotal: inp.rate * machinesCount,
          ratePerMachine: inp.rate
        }))
      });

      for (const inp of recipe.inputs) {
        recurse(inp.item, inp.rate * machinesCount, depth + 1);
      }
    }

    recurse(targetItemId, targetRate, 0);

    const maxDepth = rawStepList.length > 0 ? Math.max(...rawStepList.map(s => s.depth)) : 0;

    // Consolidate steps producing the same recipe
    const consolidatedMap = new Map();
    rawStepList.forEach(step => {
      const key = step.recipe.id;
      if (!consolidatedMap.has(key)) {
        consolidatedMap.set(key, {
          key,
          maxStepDepth: step.depth,
          itemId: step.itemId,
          recipe: step.recipe,
          building: step.building,
          neededRate: step.neededRate,
          machinesCount: step.machinesCount,
          totalPower: step.totalPower,
          inputsMap: {}
        });
        step.inputs.forEach(inp => {
          consolidatedMap.get(key).inputsMap[inp.item] = {
            item: inp.item,
            rateTotal: inp.rateTotal,
            ratePerMachine: inp.ratePerMachine
          };
        });
      } else {
        const existing = consolidatedMap.get(key);
        existing.maxStepDepth = Math.max(existing.maxStepDepth, step.depth);
        existing.neededRate += step.neededRate;
        existing.machinesCount += step.machinesCount;
        existing.totalPower += step.totalPower;
        step.inputs.forEach(inp => {
          if (existing.inputsMap[inp.item]) {
            existing.inputsMap[inp.item].rateTotal += inp.rateTotal;
          } else {
            existing.inputsMap[inp.item] = {
              item: inp.item,
              rateTotal: inp.rateTotal,
              ratePerMachine: inp.ratePerMachine
            };
          }
        });
      }
    });

    const consolidatedSteps = Array.from(consolidatedMap.values()).map(step => {
      const whole = Math.floor(step.machinesCount);
      const remainder = Number(((step.machinesCount - whole) * 100).toFixed(1));
      const inputs = Object.values(step.inputsMap).map(inp => ({
        ...inp,
        rateTotal: Number(inp.rateTotal.toFixed(2))
      }));
      const outBelt = SatisCalc.getBeltForRate(step.neededRate);
      const primaryInRate = inputs[0] ? inputs[0].rateTotal : step.neededRate;
      const inBelt = SatisCalc.getBeltForRate(primaryInRate);

      const intakePerMachine = step.recipe.inputs[0]?.rate || 30;
      const manifold = SatisCalc.calculateManifoldFlow(primaryInRate, intakePerMachine, step.machinesCount);

      return {
        key: step.key,
        stageRank: maxDepth - step.maxStepDepth, // 0 closest to raw, maxDepth is final product
        depth: step.maxStepDepth,
        itemId: step.itemId,
        recipe: step.recipe,
        building: step.building,
        neededRate: Number(step.neededRate.toFixed(2)),
        machinesCount: Number(step.machinesCount.toFixed(2)),
        wholeMachines: whole,
        remainderClock: remainder,
        totalPower: Number(step.totalPower.toFixed(1)),
        inputs,
        inBelt,
        outBelt,
        manifold
      };
    });

    // Sort forward: from raw processing (smelters) to final product
    consolidatedSteps.sort((a, b) => a.stageRank - b.stageRank);

    // Group steps into sequential phases
    const stagesMap = new Map();
    consolidatedSteps.forEach(s => {
      const rank = s.stageRank;
      if (!stagesMap.has(rank)) {
        stagesMap.set(rank, []);
      }
      stagesMap.get(rank).push(s);
    });

    const stages = Array.from(stagesMap.entries()).map(([rank, steps], idx) => {
      const isFinal = (parseInt(rank, 10) === maxDepth);
      let title = `FASE ${idx + 2}: `;
      if (isFinal) {
        title += `🎯 Producto Objetivo Final`;
      } else if (idx === 0) {
        title += `Fundición y Procesamiento Inicial de Lingotes`;
      } else if (idx === 1) {
        title += `Componentes Básicos`;
      } else {
        title += `Ensamblaje Intermedio`;
      }

      const stagePower = steps.reduce((sum, st) => sum + st.totalPower, 0);

      return {
        stageIndex: idx + 2, // Stage 1 is Extraction
        stageRank: parseInt(rank, 10),
        isFinal,
        title,
        stagePower: Number(stagePower.toFixed(1)),
        steps
      };
    });

    // Process Raw Requirements & Miners
    let totalMinerPower = 0;
    const buildingCounts = {};

    const rawBreakdown = Object.entries(rawRequirements).map(([rawId, requiredRate]) => {
      const rawMeta = SATIS_DATA.rawResources[rawId] || { name: rawId, isFluid: false, category: 'Mineral' };
      const rate = Number(requiredRate.toFixed(2));
      const purityKey = purityOverrides[rawId] || 'normal';
      const purity = SATIS_DATA.purities[purityKey] || SATIS_DATA.purities.normal;

      // Miner Selection: check if resource is fluid or solid
      let minerKey = 'miner_mk1';
      if (rawMeta.isFluid) {
        minerKey = (rawId === 'water') ? 'water_extractor' : 'oil_extractor';
      } else {
        minerKey = minerOverrides[rawId] || globalMinerTier || 'miner_mk1';
      }
      const minerMeta = SATIS_DATA.miners[minerKey] || SATIS_DATA.miners.miner_mk1;

      // Output of a single node with this miner tier at 100% clock
      const singleMinerOutput = Number((minerMeta.baseRate * purity.factor).toFixed(2));

      // Minimum nodes needed
      const exactMiners = singleMinerOutput > 0 ? Number((rate / singleMinerOutput).toFixed(2)) : 1;
      const minWholeNodes = Math.max(1, Math.ceil(exactMiners));

      // User assigned node count (or defaults to minimum whole nodes)
      const userNodeCount = (nodeCountOverrides && nodeCountOverrides[rawId] !== undefined)
        ? Math.max(1, parseInt(nodeCountOverrides[rawId], 10) || 1)
        : minWholeNodes;

      // Capacity & Supply Balance
      const totalCapacity = Number((userNodeCount * singleMinerOutput).toFixed(2));
      const balance = Number((totalCapacity - rate).toFixed(2));
      const isCovered = (balance >= -0.01);

      // Clock calculations
      let optimalClock = 100;
      let requiredOverclock = 100;
      if (isCovered) {
        optimalClock = totalCapacity > 0 ? Number(((rate / totalCapacity) * 100).toFixed(1)) : 100;
      } else {
        requiredOverclock = totalCapacity > 0 ? Number(((rate / totalCapacity) * 100).toFixed(1)) : 100;
      }

      // Energy consumption in MW
      const powerFactor = isCovered ? (optimalClock / 100) : Math.min(2.5, Math.pow(requiredOverclock / 100, 1.321928));
      const powerMw = Number((minerMeta.power * userNodeCount * powerFactor).toFixed(1));

      totalMinerPower += powerMw;
      buildingCounts[minerMeta.name] = (buildingCounts[minerMeta.name] || 0) + userNodeCount;

      // Belts / Pipes
      const beltNeeded = rawMeta.isFluid ? SatisCalc.getPipeForRate(rate) : SatisCalc.getBeltForRate(rate);
      const singleNodeBelt = rawMeta.isFluid ? SatisCalc.getPipeForRate(singleMinerOutput) : SatisCalc.getBeltForRate(singleMinerOutput);
      const totalCapacityBelt = rawMeta.isFluid ? SatisCalc.getPipeForRate(totalCapacity) : SatisCalc.getBeltForRate(totalCapacity);

      return {
        rawId,
        name: rawMeta.name,
        isFluid: rawMeta.isFluid,
        category: rawMeta.category,
        requiredRate: rate,
        minerKey,
        minerName: minerMeta.name,
        minerPower: minerMeta.power,
        purityKey,
        purityName: purity.name,
        singleMinerOutput,
        exactMiners,
        minWholeNodes,
        userNodeCount,
        totalCapacity,
        balance,
        isCovered,
        optimalClock,
        requiredOverclock,
        powerMw,
        beltNeeded,
        singleNodeBelt,
        totalCapacityBelt
      };
    });

    // Tally building counts from machine steps
    consolidatedSteps.forEach(s => {
      const bName = s.building?.name || 'Edificio';
      buildingCounts[bName] = (buildingCounts[bName] || 0) + Math.ceil(s.machinesCount);
    });

    const totalMachinesPower = consolidatedSteps.reduce((sum, s) => sum + s.totalPower, 0);
    const totalEnergyMw = Number((totalMachinesPower + totalMinerPower).toFixed(1));

    return {
      targetItemId,
      targetRate,
      targetMeta: SATIS_DATA.items[targetItemId] || SATIS_DATA.rawResources[targetItemId] || { name: targetItemId },
      rawBreakdown,
      stages,
      consolidatedSteps,
      buildingCounts,
      totalEnergyMw,
      totalMachinesPower: Number(totalMachinesPower.toFixed(1)),
      totalMinerPower: Number(totalMinerPower.toFixed(1))
    };
  },

  /**
   * Calculate exact target production rate from available raw miner extraction
   * (Allows building the entire factory based on the number of drills placed)
   */
  calculateTargetRateFromRawExtraction(targetItemId, rawResourceId = null, availableRawRate = 60, selectedRecipes = {}) {
    const basePlan = SatisCalc.buildTargetFactoryPlan(targetItemId, 1.0, selectedRecipes);
    if (!basePlan || !basePlan.rawBreakdown || basePlan.rawBreakdown.length === 0) {
      return availableRawRate;
    }

    let primaryRaw = null;
    if (rawResourceId) {
      primaryRaw = basePlan.rawBreakdown.find(r => r.rawId === rawResourceId);
    }
    if (!primaryRaw) {
      primaryRaw = basePlan.rawBreakdown.reduce((prev, curr) => (curr.requiredRate > prev.requiredRate ? curr : prev));
    }

    const rawPerUnit = primaryRaw ? primaryRaw.requiredRate : 1;
    if (rawPerUnit <= 0) return 1;

    const rate = Number((availableRawRate / rawPerUnit).toFixed(2));
    return Math.max(0.1, rate);
  },

  /**
   * Find all craftable items that can be derived from rawResourceId
   */
  getDerivativesForRaw(rawId) {
    const reachable = new Set();
    const queue = [rawId];
    
    while (queue.length > 0) {
      const current = queue.shift();
      const recipes = SATIS_DATA.recipes.filter(r => r.inputs.some(i => i.item === current));
      for (const r of recipes) {
        for (const out of r.outputs) {
          if (!reachable.has(out.item)) {
            reachable.add(out.item);
            queue.push(out.item);
          }
        }
      }
    }
    return Array.from(reachable);
  },

  /**
   * Builds the forward production chain connecting rawId to targetItemId
   */
  buildForwardChain(rawId, targetItemId, initialRate) {
    const path = [];
    const visited = new Set();

    function findPath(currItem) {
      if (currItem === rawId) return true;
      if (visited.has(currItem)) return false;
      visited.add(currItem);

      const producers = SATIS_DATA.recipes.filter(r => r.outputs.some(o => o.item === currItem));
      // Prefer standard recipes first
      producers.sort((a, b) => (a.isAlt ? 1 : 0) - (b.isAlt ? 1 : 0));

      for (const recipe of producers) {
        for (const inp of recipe.inputs) {
          if (findPath(inp.item)) {
            path.push({ recipe, mainInputItem: inp.item, outputItem: currItem });
            return true;
          }
        }
      }
      return false;
    }

    findPath(targetItemId);

    const phases = [];
    let currentFlow = initialRate;
    let currentItem = rawId;

    for (let i = 0; i < path.length; i++) {
      const step = path[i];
      const recipe = step.recipe;
      const building = SATIS_DATA.buildings[recipe.building] || { name: recipe.building, power: 4 };
      const inEntry = recipe.inputs.find(inp => inp.item === currentItem) || recipe.inputs[0];
      const outEntry = recipe.outputs.find(out => out.item === step.outputItem) || recipe.outputs[0];

      const intakePerMachine = inEntry.rate;
      const outPerMachine = outEntry.rate;

      const exactMachines = currentFlow / intakePerMachine;
      const wholeMachines = Math.floor(exactMachines);
      const isFractional = (exactMachines !== wholeMachines);

      const producedRate = exactMachines * outPerMachine;
      const totalPower = exactMachines * building.power;

      const secondaryInputs = recipe.inputs
        .filter(inp => inp.item !== inEntry.item)
        .map(inp => {
          const itemMeta = SATIS_DATA.items[inp.item] || SATIS_DATA.rawResources[inp.item] || { name: inp.item };
          return {
            item: inp.item,
            name: itemMeta.name,
            ratePerMachine: inp.rate,
            totalRate: Number((inp.rate * exactMachines).toFixed(2))
          };
        });

      phases.push({
        phaseIndex: i + 1,
        recipe,
        building,
        inputItem: currentItem,
        inputRate: Number(currentFlow.toFixed(2)),
        secondaryInputs,
        outputItem: step.outputItem,
        outputRate: Number(producedRate.toFixed(2)),
        intakePerMachine,
        outPerMachine,
        exactMachines: Number(exactMachines.toFixed(2)),
        wholeMachines,
        isFractional,
        totalPower: Number(totalPower.toFixed(1))
      });

      currentFlow = producedRate;
      currentItem = step.outputItem;
    }

    return phases;
  },

  _canDeriveCache: new Map(),
  _derivableCache: new Map(),
  _subchainCache: new Map(),

  /**
   * Checks if targetItemId can be derived directly or indirectly from supplyItemId (cached BFS)
   */
  canDeriveItem(targetItemId, supplyItemId) {
    if (targetItemId === supplyItemId) return true;
    const cacheKey = `${targetItemId}__${supplyItemId}`;
    if (this._canDeriveCache.has(cacheKey)) {
      return this._canDeriveCache.get(cacheKey);
    }

    const visited = new Set([targetItemId]);
    const queue = [targetItemId];
    let found = false;

    while (queue.length > 0) {
      const current = queue.shift();
      if (current === supplyItemId) {
        found = true;
        break;
      }
      const producers = SATIS_DATA.recipes.filter(r => r.outputs.some(o => o.item === current));
      for (const r of producers) {
        for (const inp of r.inputs) {
          if (inp.item === supplyItemId) {
            found = true;
            break;
          }
          if (!visited.has(inp.item)) {
            visited.add(inp.item);
            queue.push(inp.item);
          }
        }
        if (found) break;
      }
      if (found) break;
    }

    this._canDeriveCache.set(cacheKey, found);
    return found;
  },

  /**
   * Returns all recipes that can be produced from supplyItemId (direct or multi-tier, cached)
   */
  getDerivableRecipesForSupply(supplyItemId) {
    if (this._derivableCache.has(supplyItemId)) {
      return this._derivableCache.get(supplyItemId);
    }

    const list = [];
    for (const r of SATIS_DATA.recipes) {
      const isDirect = r.inputs.some(inp => inp.item === supplyItemId);
      const canCraft = isDirect || r.inputs.some(inp => this.canDeriveItem(inp.item, supplyItemId));
      if (canCraft) {
        const bldg = SATIS_DATA.buildings[r.building] || { name: r.building };
        list.push({
          ...r,
          isDirect,
          buildingName: bldg.name,
          tag: isDirect ? '⚡ [Directo]' : '🔄 [Sub-cadena]'
        });
      }
    }

    // Sort: Direct recipes first, then by name
    list.sort((a, b) => {
      if (a.isDirect && !b.isDirect) return -1;
      if (!a.isDirect && b.isDirect) return 1;
      return a.name.localeCompare(b.name);
    });

    this._derivableCache.set(supplyItemId, list);
    return list;
  },

  /**
   * Resolves the full chain of recipes required to craft targetRecipeId from supplyItemId (cached base units)
   */
  resolveBranchSubchain(supplyItemId, targetRecipeId, targetMachineCount = 1, customAltRecipes = {}) {
    const isBase = (targetMachineCount === 1 && Object.keys(customAltRecipes).length === 0);
    const cacheKey = `${supplyItemId}__${targetRecipeId}`;
    if (isBase && this._subchainCache.has(cacheKey)) {
      return this._subchainCache.get(cacheKey);
    }
    const targetRecipe = SATIS_DATA.recipes.find(r => r.id === targetRecipeId);
    if (!targetRecipe) return null;

    const targetBuilding = SATIS_DATA.buildings[targetRecipe.building] || { name: targetRecipe.building, power: 4, icon: '🏭' };
    const primaryOut = targetRecipe.outputs[0];
    const outItemMeta = SATIS_DATA.items[primaryOut.item] || { name: primaryOut.item };
    const targetOutputTotal = Number((primaryOut.rate * targetMachineCount).toFixed(2));
    const targetPower = Number((targetMachineCount * (targetBuilding.power || 0)).toFixed(1));

    let supplyIntakeRate = 0;
    const intermediateSteps = [];
    const externalInputs = {};
    const buildingCounts = {};
    buildingCounts[targetBuilding.name] = (buildingCounts[targetBuilding.name] || 0) + Math.ceil(targetMachineCount);

    const self = this;

    function findBestRecipeToSupply(itemId) {
      if (customAltRecipes[itemId]) {
        const custom = SATIS_DATA.recipes.find(r => r.id === customAltRecipes[itemId]);
        if (custom) return custom;
      }

      const producers = SATIS_DATA.recipes.filter(r => r.outputs.some(o => o.item === itemId));
      if (producers.length === 0) return null;

      const validProducers = producers.filter(r => 
        r.inputs.some(inp => self.canDeriveItem(inp.item, supplyItemId))
      );

      if (validProducers.length > 0) {
        validProducers.sort((a, b) => (a.isAlt ? 1 : 0) - (b.isAlt ? 1 : 0));
        return validProducers[0];
      }

      return producers.find(r => !r.isAlt) || producers[0];
    }

    function traceInput(itemId, neededRate, visited = new Set()) {
      if (itemId === supplyItemId) {
        supplyIntakeRate += neededRate;
        return;
      }

      if (visited.has(itemId)) {
        externalInputs[itemId] = (externalInputs[itemId] || 0) + neededRate;
        return;
      }
      visited.add(itemId);

      const recipe = findBestRecipeToSupply(itemId);
      const canLead = recipe && recipe.inputs.some(inp => self.canDeriveItem(inp.item, supplyItemId));

      if (!recipe || !canLead) {
        externalInputs[itemId] = (externalInputs[itemId] || 0) + neededRate;
        return;
      }

      const outEntry = recipe.outputs.find(o => o.item === itemId) || recipe.outputs[0];
      const machinesNeeded = neededRate / outEntry.rate;
      const bldg = SATIS_DATA.buildings[recipe.building] || { name: recipe.building, power: 4, icon: '🏭' };
      const stepPower = Number((machinesNeeded * (bldg.power || 0)).toFixed(1));
      buildingCounts[bldg.name] = (buildingCounts[bldg.name] || 0) + Math.ceil(machinesNeeded);

      const inEntry = recipe.inputs.find(inp => self.canDeriveItem(inp.item, supplyItemId)) || recipe.inputs[0];
      const mainInputRate = inEntry.rate * machinesNeeded;

      intermediateSteps.push({
        itemId,
        itemName: (SATIS_DATA.items[itemId] || SATIS_DATA.rawResources[itemId] || {}).name || itemId,
        recipe,
        building: bldg,
        machinesCount: Number(machinesNeeded.toFixed(2)),
        outputRate: Number(neededRate.toFixed(2)),
        mainInputItem: inEntry.item,
        mainInputRate: Number(mainInputRate.toFixed(2)),
        power: stepPower,
        feederBelt: self.getBeltForRate(mainInputRate),
        outBelt: self.getBeltForRate(neededRate)
      });

      for (const inp of recipe.inputs) {
        traceInput(inp.item, inp.rate * machinesNeeded, new Set(visited));
      }
    }

    for (const inp of targetRecipe.inputs) {
      const inputNeeded = inp.rate * targetMachineCount;
      traceInput(inp.item, inputNeeded, new Set());
    }

    intermediateSteps.reverse();

    const consolidatedSteps = [];
    const stepMap = new Map();
    for (const step of intermediateSteps) {
      const key = `${step.recipe.id}_${step.itemId}`;
      if (!stepMap.has(key)) {
        stepMap.set(key, { ...step });
        consolidatedSteps.push(stepMap.get(key));
      } else {
        const existing = stepMap.get(key);
        existing.machinesCount = Number((existing.machinesCount + step.machinesCount).toFixed(2));
        existing.outputRate = Number((existing.outputRate + step.outputRate).toFixed(2));
        existing.mainInputRate = Number((existing.mainInputRate + step.mainInputRate).toFixed(2));
        existing.power = Number((existing.power + step.power).toFixed(1));
        existing.feederBelt = self.getBeltForRate(existing.mainInputRate);
        existing.outBelt = self.getBeltForRate(existing.outputRate);
      }
    }

    supplyIntakeRate = Number(supplyIntakeRate.toFixed(2));
    const intermediatePower = consolidatedSteps.reduce((sum, s) => sum + s.power, 0);
    const totalPower = Number((targetPower + intermediatePower).toFixed(1));

    const secondaryInputsList = Object.entries(externalInputs).map(([extId, extRate]) => {
      const extMeta = SATIS_DATA.items[extId] || SATIS_DATA.rawResources[extId] || { name: extId };
      return {
        item: extId,
        name: extMeta.name,
        totalRate: Number(extRate.toFixed(2))
      };
    });

    return {
      recipe: targetRecipe,
      building: targetBuilding,
      targetMachineCount,
      primaryOut,
      outItemMeta,
      targetOutputTotal,
      targetPower,
      supplyIntakeRate,
      isDirect: (consolidatedSteps.length === 0),
      intermediateSteps: consolidatedSteps,
      totalPower,
      secondaryInputs: secondaryInputsList,
      buildingCounts,
      feederBelt: self.getBeltForRate(supplyIntakeRate),
      outBelt: self.getBeltForRate(targetOutputTotal)
    };
  },

  /**
   * Optimizes the division of supplyRate across the specified branch recipes.
   * Finds integer combinations that hit 100% saturation (0 waste), as well as proportional options.
   * @param {string} supplyItemId - e.g. 'copper_ingot' or 'iron_ingot'
   * @param {number} supplyRate - available materials/min (e.g. 120)
   * @param {Array<string>} recipeIds - recipe IDs for the branches
   * @param {Array<number>} targetRatios - optional weights/shares (e.g. [0.5, 0.5])
   */
  optimizeBranchDistribution(supplyItemId, supplyRate, recipeIds, targetRatios = null) {
    if (!recipeIds || recipeIds.length === 0 || supplyRate <= 0) return null;

    const k = recipeIds.length;
    const unitIntakes = [];
    const chains = [];

    for (let i = 0; i < k; i++) {
      const chain = this.resolveBranchSubchain(supplyItemId, recipeIds[i], 1);
      const intake = (chain && chain.supplyIntakeRate > 0) ? chain.supplyIntakeRate : 15;
      unitIntakes.push(intake);
      chains.push(chain);
    }

    // Default target ratios: equal division (1/k)
    let ratios = targetRatios;
    if (!ratios || ratios.length !== k) {
      ratios = Array(k).fill(1 / k);
    } else {
      const sumR = ratios.reduce((a, b) => a + b, 0) || 1;
      ratios = ratios.map(r => r / sumR);
    }

    // Continuous proportional solution (Exact 100.0% saturation)
    const continuousCounts = [];
    for (let i = 0; i < k; i++) {
      const shareRate = supplyRate * ratios[i];
      const count = Number((shareRate / unitIntakes[i]).toFixed(2));
      continuousCounts.push(count);
    }

    // Search for optimal integer machine solutions
    const maxMachines = unitIntakes.map(u => Math.max(1, Math.floor(supplyRate / u)));
    const candidates = [];

    function search(idx, currentCounts, currentSum) {
      if (idx === k) {
        if (currentSum > 0 && currentSum <= supplyRate + 0.05) {
          const surplus = Number(Math.max(0, supplyRate - currentSum).toFixed(2));
          const eff = Number(((currentSum / supplyRate) * 100).toFixed(1));
          candidates.push({
            counts: [...currentCounts],
            totalIntake: Number(currentSum.toFixed(2)),
            surplus,
            efficiency: eff
          });
        }
        return;
      }

      for (let m = 1; m <= maxMachines[idx]; m++) {
        const nextSum = currentSum + (m * unitIntakes[idx]);
        if (nextSum <= supplyRate + 0.05) {
          currentCounts.push(m);
          search(idx + 1, currentCounts, nextSum);
          currentCounts.pop();
        }
      }
    }

    search(0, [], 0);

    // Sort integer candidates:
    // 1. Minimal surplus (closest to 100% saturation)
    // 2. Closeness to requested ratios
    candidates.sort((a, b) => {
      if (Math.abs(a.surplus - b.surplus) > 0.05) {
        return a.surplus - b.surplus;
      }
      let diffA = 0;
      let diffB = 0;
      for (let i = 0; i < k; i++) {
        const shareA = (a.counts[i] * unitIntakes[i]) / a.totalIntake;
        const shareB = (b.counts[i] * unitIntakes[i]) / b.totalIntake;
        diffA += Math.abs(shareA - ratios[i]);
        diffB += Math.abs(shareB - ratios[i]);
      }
      return diffA - diffB;
    });

    // Unique top solutions
    const uniqueSolutions = [];
    const seen = new Set();
    for (const cand of candidates) {
      const key = cand.counts.join('-');
      if (!seen.has(key)) {
        seen.add(key);
        const branchBreakdown = cand.counts.map((m, i) => {
          const intake = Number((m * unitIntakes[i]).toFixed(1));
          const pct = ((intake / supplyRate) * 100).toFixed(1);
          const ch = chains[i];
          const outRate = Number((ch.primaryOut.rate * m).toFixed(1));
          return {
            branchIndex: i,
            machineCount: m,
            buildingName: ch.building.name,
            recipeName: ch.recipe.name,
            itemName: ch.outItemMeta.name,
            intakeRate: intake,
            intakePercent: pct,
            outputRate: outRate,
            intermediateSteps: ch.intermediateSteps.map(s => ({
              ...s,
              machinesCount: Number((s.machinesCount * m).toFixed(1))
            }))
          };
        });

        uniqueSolutions.push({
          ...cand,
          branchBreakdown,
          isExact100: (cand.surplus === 0)
        });
        if (uniqueSolutions.length >= 6) break;
      }
    }

    const bestInteger = uniqueSolutions.length > 0 ? uniqueSolutions[0] : null;

    return {
      continuousCounts,
      bestInteger,
      isPerfectInteger: !!(bestInteger && bestInteger.surplus === 0),
      solutions: uniqueSolutions,
      unitIntakes,
      chains,
      ratios
    };
  }
};

window.SatisCalc = SatisCalc;
