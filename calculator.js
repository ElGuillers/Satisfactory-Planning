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
  calculateSplitting(inputRate, machineIntake, isFluid = false) {
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

    const getTransport = (rate) => isFluid ? this.getPipeForRate(rate) : this.getBeltForRate(rate);

    // Belts/Pipes needed for the main trunk in a manifold
    // At each machine, input decreases by machineIntake
    const manifoldSteps = [];
    let remainingFlow = inputRate;
    for (let i = 0; i < ceilMachines; i++) {
      const belt = getTransport(remainingFlow);
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
    let balancerType = isFluid ? 'Manifold de Tuberías (Recomendado FICSIT)' : 'Manifold (Recomendado FICSIT)';
    let balancerDetail = isFluid 
      ? 'Un manifold lineal con Crucetas de Tubería (Pipe Junction Crosses) auto-satura todas las máquinas sin pérdida de carga.' 
      : 'Un manifold con splitters en cascada es compacto y se auto-satura al 100% en pocos minutos.';

    if (ceilMachines === 2) {
      balancerType = isFluid ? 'División 1:2 (1 Cruceta de Tubería)' : 'División 1:2 (1 Splitter)';
      balancerDetail = isFluid ? '1 cruceta divide 50% / 50% el caudal de fluido.' : '1 divisor divide 50% / 50% perfecto.';
    } else if (ceilMachines === 4) {
      balancerType = isFluid ? 'División 1:4 (3 Crucetas)' : 'División 1:4 (3 Splitters)';
      balancerDetail = isFluid ? '1 cruceta primaria alimenta 2 secundarias con balance simétrico.' : '1 divisor primario alimenta 2 divisores secundarios.';
    } else if (ceilMachines === 8) {
      balancerType = isFluid ? 'División 1:8 (7 Crucetas)' : 'División 1:8 (7 Splitters)';
      balancerDetail = isFluid ? 'Árbol simétrico de 3 niveles de crucetas de tubería.' : 'Árbol binario simétrico de 3 niveles de divisores.';
    } else if (ceilMachines === 3) {
      balancerType = isFluid ? 'División 1:3 (1 Cruceta)' : 'División 1:3 (1 Splitter)';
      balancerDetail = isFluid ? '1 cruceta de tubería estándar con sus 3 salidas activadas (33.33% c/u).' : '1 divisor estándar con sus 3 salidas activas (33.33% cada una).';
    } else if (ceilMachines === 6) {
      balancerType = isFluid ? 'División 1:6 (4 Crucetas)' : 'División 1:6 (4 Splitters)';
      balancerDetail = isFluid ? '1 cruceta inicial de 3 vías ➔ cada salida a 1 cruceta de 2 vías.' : '1 divisor inicial de 3 vías -> cada salida a 1 divisor de 2 vías.';
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
      feederBelt: getTransport(machineIntake),
      mainBelt: getTransport(inputRate),
      manifoldSteps,
      balancerType,
      balancerDetail,
      isFluid: !!isFluid
    };
  },

  /**
   * Generates step-by-step schematic for splitting input into N machines
   */
  calculateManifoldFlow(inputRate, machineIntake, machineCount, isFluid = false) {
    const ceilMachines = Math.max(1, Math.ceil(machineCount));
    const steps = [];
    let remainingFlow = inputRate;
    const getTransport = (rate) => isFluid ? this.getPipeForRate(rate) : this.getBeltForRate(rate);

    for (let i = 0; i < ceilMachines; i++) {
      const machineIndex = i + 1;
      const isLast = (i === ceilMachines - 1);
      const isFractional = (machineCount % 1 !== 0);
      const consumes = isLast && isFractional
        ? Number(((machineCount % 1) * machineIntake).toFixed(2))
        : machineIntake;

      const beltIn = getTransport(remainingFlow);
      const remainingAfter = Math.max(0, Number((remainingFlow - consumes).toFixed(2)));
      const beltContinue = isLast ? null : getTransport(remainingAfter);
      const feederBelt = getTransport(consumes);

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
      isFluid: !!isFluid,
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
   * Discovers all items involved in the production chain of targetItemId
   * and returns items that have alternative recipes along with their base and alternative options.
   */
  getRecipeOptionsForChain(targetItemId, selectedAltRecipes = {}) {
    const chainItems = new Set();
    const visited = new Set();

    function collectItems(itemId) {
      if (!itemId || visited.has(itemId) || (SATIS_DATA.rawResources && SATIS_DATA.rawResources[itemId])) return;
      visited.add(itemId);
      chainItems.add(itemId);

      const allRecipesForItem = SATIS_DATA.recipes.filter(r => r.outputs.some(o => o.item === itemId));
      for (const r of allRecipesForItem) {
        for (const inp of r.inputs) {
          collectItems(inp.item);
        }
      }
    }

    collectItems(targetItemId);

    const options = [];

    for (const itemId of chainItems) {
      const allForThis = SATIS_DATA.recipes.filter(r => r.outputs.some(o => o.item === itemId));
      const standardRecipe = allForThis.find(r => !r.isAlt) || allForThis[0];
      const altRecipes = allForThis.filter(r => r.isAlt);

      if (altRecipes.length > 0 && standardRecipe) {
        const itemMeta = SATIS_DATA.items[itemId] || { name: itemId };
        const activeRecipeId = selectedAltRecipes[itemId] || standardRecipe.id;
        const activeRecipe = allForThis.find(r => r.id === activeRecipeId) || standardRecipe;

        const formatSummary = (rec) => {
          const bldg = SATIS_DATA.buildings[rec.building]?.name || rec.building;
          const inSummary = rec.inputs.map(i => {
            const iMeta = SATIS_DATA.items[i.item] || SATIS_DATA.rawResources[i.item] || { name: i.item };
            return `${i.rate}/m ${iMeta.name}`;
          }).join(' + ');
          const outRate = rec.outputs.find(o => o.item === itemId)?.rate || rec.outputs[0]?.rate || 0;
          return `${bldg}: ${inSummary} ➔ ${outRate}/m ${itemMeta.name}`;
        };

        options.push({
          itemId,
          itemName: itemMeta.name,
          standardRecipe: {
            ...standardRecipe,
            buildingName: SATIS_DATA.buildings[standardRecipe.building]?.name || standardRecipe.building,
            summary: formatSummary(standardRecipe)
          },
          altRecipes: altRecipes.map(alt => ({
            ...alt,
            buildingName: SATIS_DATA.buildings[alt.building]?.name || alt.building,
            summary: formatSummary(alt)
          })),
          activeRecipeId,
          isUsingAlt: !!activeRecipe.isAlt
        });
      }
    }

    return options;
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
        beltNeeded: rawMeta.isFluid ? SatisCalc.getPipeForRate(rate) : SatisCalc.getBeltForRate(rate),
        nodeEquivalents: {
          impureMk2: Number(impureMk2.toFixed(2)),
          normalMk2: Number(normalMk2.toFixed(2)),
          pureMk2: Number(pureMk2.toFixed(2))
        }
      };
    });

    const targetMeta = SATIS_DATA.items[targetItemId] || SATIS_DATA.rawResources[targetItemId] || { name: targetItemId, isFluid: false };
    return {
      targetItemId,
      targetRate,
      targetName: targetMeta.name || targetItemId,
      targetMeta,
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
  buildTargetFactoryPlan(targetItemId, targetRate, selectedRecipes = {}, purityOverrides = {}, minerOverrides = {}, nodeCountOverrides = {}, globalMinerTier = 'miner_mk1', rawNodesConfig = {}) {
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
      const outItemMeta = SATIS_DATA.items[step.itemId] || SATIS_DATA.rawResources[step.itemId] || { isFluid: false };
      const isOutFluid = !!outItemMeta.isFluid;
      const outBelt = isOutFluid ? SatisCalc.getPipeForRate(step.neededRate) : SatisCalc.getBeltForRate(step.neededRate);

      const primaryInItem = inputs[0] ? inputs[0].item : null;
      const primaryInMeta = primaryInItem ? (SATIS_DATA.items[primaryInItem] || SATIS_DATA.rawResources[primaryInItem] || { isFluid: false }) : { isFluid: false };
      const isInFluid = !!primaryInMeta.isFluid;
      const primaryInRate = inputs[0] ? inputs[0].rateTotal : step.neededRate;
      const inBelt = isInFluid ? SatisCalc.getPipeForRate(primaryInRate) : SatisCalc.getBeltForRate(primaryInRate);

      const intakePerMachine = step.recipe.inputs[0]?.rate || 30;
      const manifold = SatisCalc.calculateManifoldFlow(primaryInRate, intakePerMachine, step.machinesCount, isInFluid);

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

    // Process Raw Requirements & Miners (Supports individual / heterogeneous nodes per resource)
    let totalMinerPower = 0;
    const buildingCounts = {};

    const rawBreakdown = Object.entries(rawRequirements).map(([rawId, requiredRate]) => {
      const rawMeta = SATIS_DATA.rawResources[rawId] || { name: rawId, isFluid: false, category: 'Mineral' };
      const rate = Number(requiredRate.toFixed(2));
      const purityKey = purityOverrides[rawId] || 'normal';
      const purity = SATIS_DATA.purities[purityKey] || SATIS_DATA.purities.normal;

      // Default Miner Selection: check if resource is fluid or solid
      let defaultMinerKey = 'miner_mk1';
      if (rawMeta.isFluid) {
        defaultMinerKey = (rawId === 'water') ? 'water_extractor' : 'oil_extractor';
      } else {
        defaultMinerKey = minerOverrides[rawId] || globalMinerTier || 'miner_mk1';
      }
      const defaultMinerMeta = SATIS_DATA.miners[defaultMinerKey] || SATIS_DATA.miners.miner_mk1;

      // Base single miner output with default purity/miner
      const baseSingleOutput = Number((defaultMinerMeta.baseRate * ((defaultMinerMeta.isFixedRate || (rawMeta.isFluid && rawId === 'water')) ? 1.0 : purity.factor)).toFixed(2));
      const exactMiners = baseSingleOutput > 0 ? Number((rate / baseSingleOutput).toFixed(2)) : 1;
      const minWholeNodes = Math.max(1, Math.ceil(exactMiners));

      // Check if specific node configurations exist for this resource
      const configuredNodes = rawNodesConfig && Array.isArray(rawNodesConfig[rawId]) && rawNodesConfig[rawId].length > 0
        ? rawNodesConfig[rawId]
        : null;

      let nodes = [];
      if (configuredNodes) {
        nodes = configuredNodes.map((n, idx) => {
          const nPurityKey = n.purity || purityKey;
          const nPurity = SATIS_DATA.purities[nPurityKey] || SATIS_DATA.purities.normal;
          let nMinerKey = n.minerKey;
          if (rawMeta.isFluid) {
            nMinerKey = (rawId === 'water') ? 'water_extractor' : 'oil_extractor';
          } else if (!nMinerKey) {
            nMinerKey = defaultMinerKey;
          }
          const nMinerMeta = SATIS_DATA.miners[nMinerKey] || defaultMinerMeta;
          const nFactor = (nMinerMeta.isFixedRate || (rawMeta.isFluid && rawId === 'water')) ? 1.0 : nPurity.factor;
          const nClock = (n.clock !== undefined) ? n.clock : 100;
          const nOutput = Number((nMinerMeta.baseRate * nFactor * (nClock / 100)).toFixed(2));
          const nPower = Number((nMinerMeta.power * Math.pow(nClock / 100, 1.321928)).toFixed(2));
          const nBelt = rawMeta.isFluid ? SatisCalc.getPipeForRate(nOutput) : SatisCalc.getBeltForRate(nOutput);

          return {
            nodeIndex: idx + 1,
            purityKey: nPurityKey,
            purityName: nPurity.name,
            purityColor: nPurity.color,
            minerKey: nMinerKey,
            minerName: nMinerMeta.name,
            clock: nClock,
            outputRate: nOutput,
            powerMw: nPower,
            belt: nBelt
          };
        });
      } else {
        const userNodeCount = (nodeCountOverrides && nodeCountOverrides[rawId] !== undefined)
          ? Math.max(1, parseInt(nodeCountOverrides[rawId], 10) || 1)
          : minWholeNodes;

        for (let i = 0; i < userNodeCount; i++) {
          const nBelt = rawMeta.isFluid ? SatisCalc.getPipeForRate(baseSingleOutput) : SatisCalc.getBeltForRate(baseSingleOutput);
          nodes.push({
            nodeIndex: i + 1,
            purityKey,
            purityName: purity.name,
            purityColor: purity.color,
            minerKey: defaultMinerKey,
            minerName: defaultMinerMeta.name,
            clock: 100,
            outputRate: baseSingleOutput,
            powerMw: defaultMinerMeta.power,
            belt: nBelt
          });
        }
      }

      const userNodeCount = nodes.length;
      const totalCapacity = Number(nodes.reduce((sum, n) => sum + n.outputRate, 0).toFixed(2));
      const balance = Number((totalCapacity - rate).toFixed(2));
      const isCovered = (balance >= -0.01);

      // Optimal Clock or Overclock required
      let optimalClock = 100;
      let requiredOverclock = 100;
      if (isCovered) {
        optimalClock = totalCapacity > 0 ? Number(((rate / totalCapacity) * 100).toFixed(1)) : 100;
      } else {
        requiredOverclock = totalCapacity > 0 ? Number(((rate / totalCapacity) * 100).toFixed(1)) : 100;
      }

      // Energy consumption
      let resourcePowerMw = 0;
      if (isCovered && optimalClock < 100) {
        const underRatio = optimalClock / 100;
        resourcePowerMw = Number(nodes.reduce((sum, n) => {
          const baseP = (SATIS_DATA.miners[n.minerKey] || defaultMinerMeta).power;
          return sum + (baseP * Math.pow(underRatio, 1.321928));
        }, 0).toFixed(1));
      } else {
        resourcePowerMw = Number(nodes.reduce((sum, n) => sum + n.powerMw, 0).toFixed(1));
      }

      totalMinerPower += resourcePowerMw;

      // Count buildings per machine name
      nodes.forEach(n => {
        buildingCounts[n.minerName] = (buildingCounts[n.minerName] || 0) + 1;
      });

      const beltNeeded = rawMeta.isFluid ? SatisCalc.getPipeForRate(rate) : SatisCalc.getBeltForRate(rate);
      const totalCapacityBelt = rawMeta.isFluid ? SatisCalc.getPipeForRate(totalCapacity) : SatisCalc.getBeltForRate(totalCapacity);
      const singleNodeBelt = nodes[0] ? nodes[0].belt : beltNeeded;

      return {
        rawId,
        name: rawMeta.name,
        isFluid: rawMeta.isFluid,
        category: rawMeta.category,
        requiredRate: rate,
        nodes,
        minerKey: defaultMinerKey,
        minerName: defaultMinerMeta.name,
        minerPower: defaultMinerMeta.power,
        purityKey,
        purityName: purity.name,
        singleMinerOutput: baseSingleOutput,
        exactMiners,
        minWholeNodes,
        userNodeCount,
        totalCapacity,
        balance,
        isCovered,
        optimalClock,
        requiredOverclock,
        powerMw: resourcePowerMw,
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
   * Calculate target rate when multiple minerals are configured (respects bottleneck across all inputs)
   */
  calculateTargetRateFromAllRawExtraction(targetItemId, rawRatesMap = {}, selectedRecipes = {}) {
    const basePlan = SatisCalc.buildTargetFactoryPlan(targetItemId, 1.0, selectedRecipes);
    if (!basePlan || !basePlan.rawBreakdown || basePlan.rawBreakdown.length === 0) {
      const firstKey = Object.keys(rawRatesMap)[0];
      return firstKey ? (rawRatesMap[firstKey] || 60) : 60;
    }

    const possibleRates = basePlan.rawBreakdown.map(r => {
      const avail = (rawRatesMap && rawRatesMap[r.rawId] !== undefined) ? rawRatesMap[r.rawId] : 60;
      const perUnit = r.requiredRate > 0 ? r.requiredRate : 1;
      return avail / perUnit;
    });

    const minRate = Math.min(...possibleRates);
    return Math.max(0.1, Number(minRate.toFixed(2)));
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
    if (Array.isArray(supplyItemId)) {
      return supplyItemId.includes(targetItemId) || supplyItemId.some(id => this.canDeriveItem(targetItemId, id));
    }
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
    if (Array.isArray(supplyItemId)) {
      const combined = new Map();
      supplyItemId.forEach(id => {
        const sub = this.getDerivableRecipesForSupply(id);
        sub.forEach(r => {
          if (!combined.has(r.id)) combined.set(r.id, r);
        });
      });
      return Array.from(combined.values());
    }

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
    const cacheKey = `${Array.isArray(supplyItemId) ? supplyItemId.join('+') : supplyItemId}__${targetRecipeId}`;
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
    const supplyIntakeRates = {};
    const isMatchSupply = (itemId) => Array.isArray(supplyItemId) ? supplyItemId.includes(itemId) : (itemId === supplyItemId);
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
      if (isMatchSupply(itemId)) {
        supplyIntakeRate += neededRate;
        supplyIntakeRates[itemId] = (supplyIntakeRates[itemId] || 0) + neededRate;
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

      const inIsFluid = !!(SATIS_DATA.items[inEntry.item] || SATIS_DATA.rawResources[inEntry.item] || {}).isFluid;
      const outIsFluid = !!(SATIS_DATA.items[itemId] || SATIS_DATA.rawResources[itemId] || {}).isFluid;

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
        feederBelt: inIsFluid ? self.getPipeForRate(mainInputRate) : self.getBeltForRate(mainInputRate),
        outBelt: outIsFluid ? self.getPipeForRate(neededRate) : self.getBeltForRate(neededRate)
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
        const exInFluid = !!(SATIS_DATA.items[existing.mainInputItem] || SATIS_DATA.rawResources[existing.mainInputItem] || {}).isFluid;
        const exOutFluid = !!(SATIS_DATA.items[existing.itemId] || SATIS_DATA.rawResources[existing.itemId] || {}).isFluid;
        existing.feederBelt = exInFluid ? self.getPipeForRate(existing.mainInputRate) : self.getBeltForRate(existing.mainInputRate);
        existing.outBelt = exOutFluid ? self.getPipeForRate(existing.outputRate) : self.getBeltForRate(existing.outputRate);
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

    const isSupplyFluid = Array.isArray(supplyItemId)
      ? supplyItemId.some(id => (SATIS_DATA.items[id] || SATIS_DATA.rawResources[id] || {}).isFluid)
      : !!(SATIS_DATA.items[supplyItemId] || SATIS_DATA.rawResources[supplyItemId] || {}).isFluid;
    const isTargetOutFluid = !!(SATIS_DATA.items[primaryOut.item] || SATIS_DATA.rawResources[primaryOut.item] || {}).isFluid;

    return {
      recipe: targetRecipe,
      building: targetBuilding,
      targetMachineCount,
      primaryOut,
      outItemMeta,
      targetOutputTotal,
      targetPower,
      supplyIntakeRate,
      supplyIntakeRates,
      isDirect: (consolidatedSteps.length === 0),
      intermediateSteps: consolidatedSteps,
      totalPower,
      secondaryInputs: secondaryInputsList,
      buildingCounts,
      feederBelt: isSupplyFluid ? self.getPipeForRate(supplyIntakeRate) : self.getBeltForRate(supplyIntakeRate),
      outBelt: isTargetOutFluid ? self.getPipeForRate(targetOutputTotal) : self.getBeltForRate(targetOutputTotal)
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
  },

  /**
   * Energy Optimization & Power Generation Manager (Satisfactory 1.0 / 1.2)
   * Formula: Power = BasePower * (Clock / 100) ^ 1.321928
   * Modes:
   * - 'standard': Nominal speeds (whole machines @ 100%, last machine @ remainder %).
   * - 'eco': Underclocked distributed machines (e.g. 2.4 machines -> 3 machines @ 80% clock).
   *          Produces exponential power savings (-15% to -28% MW).
   * - 'compact': Overclocked machines (up to 200%-250% clock with Power Shards) to reduce floor area.
   */
  calculateEnergyOptimization(plan, powerMode = 'standard') {
    if (!plan || !plan.consolidatedSteps) {
      return {
        mode: powerMode,
        activeMw: 0,
        standardMw: 0,
        ecoMw: 0,
        compactMw: 0,
        savingsMw: 0,
        savingsPercent: 0,
        shardsRequired: 0,
        breakdown: { minersMw: 0, smeltersMw: 0, constructorsMw: 0, assemblersMw: 0, othersMw: 0 },
        recommendedGenerators: []
      };
    }

    const EXPONENT = 1.321928;
    let standardMachinesPower = 0;
    let ecoMachinesPower = 0;
    let compactMachinesPower = 0;
    let compactShardsTotal = 0;
    let compactMachinesTotal = 0;
    let standardMachinesTotal = 0;
    let ecoMachinesTotal = 0;

    const breakdown = {
      minersMw: plan.totalMinerPower || 0,
      smeltersMw: 0,
      constructorsMw: 0,
      assemblersMw: 0,
      othersMw: 0
    };

    plan.consolidatedSteps.forEach(step => {
      const bldg = step.building || { power: 4, name: 'Máquina' };
      const baseP = bldg.power || 4;
      const count = step.machinesCount;
      const whole = Math.floor(count);
      const rem = count - whole;

      // 1. Standard: whole @ 100%, rem @ rem^EXPONENT
      standardMachinesTotal += Math.ceil(count);
      let stepStdP = whole * baseP;
      if (rem > 0.001) {
        stepStdP += baseP * Math.pow(rem, EXPONENT);
      }
      standardMachinesPower += stepStdP;

      // 2. Eco: distribute equally across ceil(count) machines
      const ecoMachinesCount = Math.ceil(count);
      ecoMachinesTotal += ecoMachinesCount;
      const ecoClockRatio = ecoMachinesCount > 0 ? (count / ecoMachinesCount) : 1;
      const stepEcoP = ecoMachinesCount * baseP * Math.pow(ecoClockRatio, EXPONENT);
      ecoMachinesPower += stepEcoP;

      // 3. Compact: overclock up to 200% (2x speed)
      const compactCount = Math.max(1, Math.ceil(count / 2));
      compactMachinesTotal += compactCount;
      const compactClockRatio = count / compactCount;
      const stepCompactP = compactCount * baseP * Math.pow(compactClockRatio, EXPONENT);
      compactMachinesPower += stepCompactP;

      if (compactClockRatio > 1) {
        const shardsPerMachine = Math.ceil((compactClockRatio * 100 - 100) / 50);
        compactShardsTotal += shardsPerMachine * compactCount;
      }

      // Categorize for breakdown
      const bName = bldg.name || '';
      if (bName.includes('Fundic') || bName.includes('Horno')) {
        breakdown.smeltersMw += stepStdP;
      } else if (bName.includes('Constructor')) {
        breakdown.constructorsMw += stepStdP;
      } else if (bName.includes('Ensambla')) {
        breakdown.assemblersMw += stepStdP;
      } else {
        breakdown.othersMw += stepStdP;
      }
    });

    const totalMinerP = plan.totalMinerPower || 0;
    const finalStandardMw = Number((standardMachinesPower + totalMinerP).toFixed(1));
    const finalEcoMw = Number((ecoMachinesPower + totalMinerP).toFixed(1));
    const finalCompactMw = Number((compactMachinesPower + totalMinerP).toFixed(1));

    let activeMw = finalStandardMw;
    let savingsMw = 0;
    let savingsPercent = 0;
    let shardsRequired = 0;

    if (powerMode === 'eco') {
      activeMw = finalEcoMw;
      savingsMw = Number((finalStandardMw - finalEcoMw).toFixed(1));
      savingsPercent = finalStandardMw > 0 ? Number(((savingsMw / finalStandardMw) * 100).toFixed(1)) : 0;
    } else if (powerMode === 'compact') {
      activeMw = finalCompactMw;
      savingsMw = Number((finalStandardMw - finalCompactMw).toFixed(1));
      savingsPercent = finalStandardMw > 0 ? Number(((savingsMw / finalStandardMw) * 100).toFixed(1)) : 0;
      shardsRequired = compactShardsTotal;
    }

    // Generator Recommendations for current active load
    const recommendedGenerators = [
      {
        id: 'coal_generator',
        name: 'Generadores de Carbón',
        icon: '⛏️',
        unitMw: 75,
        count: Math.ceil(activeMw / 75),
        totalMw: Math.ceil(activeMw / 75) * 75,
        fuelItem: 'Carbón',
        fuelRate: Number((Math.ceil(activeMw / 75) * 15).toFixed(1)),
        waterRate: Number((Math.ceil(activeMw / 75) * 45).toFixed(1)),
        waterExtractors: Number(((Math.ceil(activeMw / 75) * 45) / 120).toFixed(1)),
        tag: 'Tier 3-4 (Estable)'
      },
      {
        id: 'fuel_generator',
        name: 'Generadores de Combustible',
        icon: '🛢️',
        unitMw: 250,
        count: Math.ceil(activeMw / 250),
        totalMw: Math.ceil(activeMw / 250) * 250,
        fuelItem: 'Combustible (Fuel)',
        fuelRate: Number((Math.ceil(activeMw / 250) * 20).toFixed(1)),
        waterRate: 0,
        tag: 'Tier 5-6 (Medio/Alto)'
      },
      {
        id: 'biomass_burner',
        name: 'Quemadores de Biomasa',
        icon: '🌿',
        unitMw: 30,
        count: Math.ceil(activeMw / 30),
        totalMw: Math.ceil(activeMw / 30) * 30,
        fuelItem: 'Biocombustible Sólido',
        fuelRate: Number((Math.ceil(activeMw / 30) * 4).toFixed(1)),
        waterRate: 0,
        tag: 'Tier 1-2 (Inicial)'
      },
      {
        id: 'nuclear_power_plant',
        name: 'Centrales Nucleares',
        icon: '☢️',
        unitMw: 2500,
        count: Math.max(1, Math.ceil(activeMw / 2500)),
        totalMw: Math.max(1, Math.ceil(activeMw / 2500)) * 2500,
        fuelItem: 'Barras de Uranio',
        fuelRate: Number((Math.max(1, Math.ceil(activeMw / 2500)) * 0.2).toFixed(2)),
        waterRate: Number((Math.max(1, Math.ceil(activeMw / 2500)) * 240).toFixed(1)),
        tag: 'Tier 7-8 (Masivo)'
      }
    ];

    const recommendedStorage = Math.max(1, Math.ceil(activeMw / 100));

    return {
      mode: powerMode,
      activeMw,
      standardMw: finalStandardMw,
      ecoMw: finalEcoMw,
      compactMw: finalCompactMw,
      savingsMw,
      savingsPercent,
      shardsRequired,
      standardMachinesTotal,
      ecoMachinesTotal,
      compactMachinesTotal,
      breakdown: {
        minersMw: Number(breakdown.minersMw.toFixed(1)),
        smeltersMw: Number(breakdown.smeltersMw.toFixed(1)),
        constructorsMw: Number(breakdown.constructorsMw.toFixed(1)),
        assemblersMw: Number(breakdown.assemblersMw.toFixed(1)),
        othersMw: Number(breakdown.othersMw.toFixed(1))
      },
      recommendedGenerators,
      recommendedStorage
    };
  },

  /**
   * CÁLCULO DE MÁXIMA EFICIENCIA PARA CENTRALES ELÉCTRICAS (Satisfactory 1.0 / 1.2)
   * Calcula generadores exactos, consumo de combustible, agua, extractores, tuberías,
   * balance de red, arquitectura modular 8:3 y datos para el plano 2D.
   */
  calculateDedicatedPowerPlant({
    targetMW = 8000,
    fuelId = 'coal',
    pipeTier = 1,
    beltTier = 3,
    minerTier = 'miner_mk2',
    purity = 'normal',
    drills = []
  }) {
    const target = Math.max(10, Number(targetMW) || 8000);

    // Mapeo de combustible a generador y parámetros oficiales 1.0
    let genData = SATIS_DATA.powerGenerators.coal_generator;
    let fuelData = genData.fuelOptions[0];

    if (fuelId === 'compacted_coal') {
      genData = SATIS_DATA.powerGenerators.coal_generator;
      fuelData = genData.fuelOptions[1];
    } else if (fuelId === 'petroleum_coke') {
      genData = SATIS_DATA.powerGenerators.coal_generator;
      fuelData = genData.fuelOptions[2];
    } else if (fuelId === 'fuel') {
      genData = SATIS_DATA.powerGenerators.fuel_generator;
      fuelData = genData.fuelOptions[0];
    } else if (fuelId === 'turbofuel') {
      genData = SATIS_DATA.powerGenerators.fuel_generator;
      fuelData = genData.fuelOptions[1];
    } else if (fuelId === 'uranium_fuel_rod') {
      genData = SATIS_DATA.powerGenerators.nuclear_power_plant;
      fuelData = genData.fuelOptions[0];
    } else if (fuelId === 'solid_biofuel') {
      genData = SATIS_DATA.powerGenerators.biomass_burner;
      fuelData = genData.fuelOptions[0];
    }

    const unitMW = genData.powerMW;
    const exactGenerators = target / unitMW;
    const fullGenerators = Math.floor(exactGenerators);
    const fractionalPart = exactGenerators - fullGenerators;
    const hasFractional = fractionalPart > 0.0001;
    const lastClock = hasFractional ? Number((fractionalPart * 100).toFixed(1)) : 100;
    const totalGeneratorsCount = hasFractional ? fullGenerators + 1 : fullGenerators;

    // Consumo de Combustible
    const unitFuelRate = fuelData.ratePerGen;
    const totalFuelRate = Number((exactGenerators * unitFuelRate).toFixed(2));
    const isFuelFluid = !!fuelData.isFluid;

    // Manejo de Cintas o Tuberías para el combustible
    const beltObj = SATIS_DATA.belts.find(b => b.tier === Number(beltTier)) || SATIS_DATA.belts[2]; // Default Mk.3 (270)
    const fuelBeltsCount = !isFuelFluid ? Math.max(1, Math.ceil(totalFuelRate / beltObj.speed)) : 0;
    const fuelPipesCount = isFuelFluid ? Math.max(1, Math.ceil(totalFuelRate / (pipeTier === 2 ? 600 : 300))) : 0;

    // Cálculo y Desglose de Taladros / Extractores (Carbón o Petróleo Crudo)
    const isOilFuel = fuelId === 'fuel' || fuelId === 'turbofuel' || fuelId === 'petroleum_coke';
    let userDrillsCalculated = [];
    let userExtractionRate = 0;
    let userMinersPower = 0;

    // Cálculo Petroquímico (Satisfactory 1.0)
    let crudeOilNeeded = 0;
    let refineriesExact = 0;
    let refineriesCount = 0;
    let polymerResinRate = 0;
    let refineriesPower = 0;
    let sinkPower = 0;

    if (fuelId === 'fuel') {
      // Receta Estándar: 60 Petróleo Crudo ➔ 40 Fuel + 30 Resina de Polímero
      refineriesExact = totalFuelRate / 40;
      refineriesCount = Math.ceil(refineriesExact);
      crudeOilNeeded = Number((refineriesExact * 60).toFixed(2));
      polymerResinRate = Number((refineriesExact * 30).toFixed(2));
      refineriesPower = Math.ceil(refineriesExact) * 30; // 30 MW por refinería
      sinkPower = polymerResinRate > 0 ? 30 : 0; // 30 MW Trituradora FICSIT Awesome Sink
    } else if (fuelId === 'turbofuel') {
      // Receta Estándar Turbofuel: 22.5 Fuel + 15 Carbón Compactado ➔ 18.75 Turbofuel
      const turboRefineries = totalFuelRate / 18.75;
      const fuelNeeded = turboRefineries * 22.5;
      refineriesExact = fuelNeeded / 40;
      refineriesCount = Math.ceil(refineriesExact + turboRefineries);
      crudeOilNeeded = Number((refineriesExact * 60).toFixed(2));
      polymerResinRate = Number((refineriesExact * 30).toFixed(2));
      refineriesPower = Math.ceil(refineriesExact + turboRefineries) * 30;
      sinkPower = polymerResinRate > 0 ? 30 : 0;
    } else if (fuelId === 'petroleum_coke') {
      // Receta Coque: 30 Petróleo Crudo ➔ 40 Residuo ➔ 120 Coque
      refineriesExact = totalFuelRate / 120;
      refineriesCount = Math.ceil(refineriesExact);
      crudeOilNeeded = Number((refineriesExact * 30).toFixed(2));
      polymerResinRate = Number((refineriesExact * 20).toFixed(2));
      refineriesPower = Math.ceil(refineriesExact) * 30;
      sinkPower = polymerResinRate > 0 ? 30 : 0;
    }

    if (isOilFuel) {
      // Manejo de Extractores de Petróleo Crudo
      if (Array.isArray(drills) && drills.length > 0) {
        userDrillsCalculated = drills.map((d, idx) => {
          const clock = (d.clock !== undefined && d.clock !== null) ? Math.min(250, Math.max(1, Number(d.clock))) : 100;
          const clockRatio = clock / 100;
          const pFactor = SATIS_DATA.purities[d.purity]?.factor || 1.0;
          const mBase = 120; // 120 m³/min base para pozo normal
          const basePower = 40; // 40 MW base por extractor de petróleo
          const rate = Number((mBase * pFactor * clockRatio).toFixed(2));
          const mw = Number((basePower * Math.pow(clockRatio, 1.321928)).toFixed(1));
          const shards = clock > 100 ? Math.ceil((clock - 100) / 50) : 0;
          userExtractionRate += rate;
          userMinersPower += mw;
          return {
            id: d.id || `oil_well_${idx + 1}`,
            index: idx + 1,
            minerTier: 'oil_extractor',
            purity: d.purity || 'normal',
            clock,
            shards,
            rate,
            mw,
            belt: { name: rate > 300 ? 'Tubería Mk.2 (600 m³/min)' : 'Tubería Mk.1 (300 m³/min)', speed: rate > 300 ? 600 : 300 }
          };
        });
      } else {
        const purityFactor = SATIS_DATA.purities[purity]?.factor || 1.0;
        const nodeRate = 120 * purityFactor;
        const extractorsNeeded = Number((crudeOilNeeded / Math.max(1, nodeRate)).toFixed(2));
        userMinersPower = Math.ceil(extractorsNeeded) * 40;
        userExtractionRate = crudeOilNeeded;
      }
    } else {
      // Manejo de Taladros de Carbón / Biomasa / Mineral
      if (Array.isArray(drills) && drills.length > 0) {
        userDrillsCalculated = drills.map((d, idx) => {
          const clock = (d.clock !== undefined && d.clock !== null) ? Math.min(250, Math.max(1, Number(d.clock))) : 100;
          const clockRatio = clock / 100;
          const pFactor = SATIS_DATA.purities[d.purity]?.factor || 1.0;
          const mBase = SATIS_DATA.miners[d.minerTier]?.baseRate || 60;
          const basePower = SATIS_DATA.miners[d.minerTier]?.power || 5;
          const rate = Number((mBase * pFactor * clockRatio).toFixed(2));
          const mw = Number((basePower * Math.pow(clockRatio, 1.321928)).toFixed(1));
          const shards = clock > 100 ? Math.ceil((clock - 100) / 50) : 0;
          const belt = SatisCalc.getBeltForRate(rate);
          userExtractionRate += rate;
          userMinersPower += mw;
          return {
            id: d.id || `drill_${idx + 1}`,
            index: idx + 1,
            minerTier: d.minerTier || 'miner_mk1',
            purity: d.purity || 'normal',
            clock,
            shards,
            rate,
            mw,
            belt
          };
        });
      } else {
        const purityFactor = SATIS_DATA.purities[purity]?.factor || 1.0;
        const minerBase = SATIS_DATA.miners[minerTier]?.baseRate || 120;
        const nodeRate = minerBase * purityFactor;
        const minersNeeded = Number((totalFuelRate / Math.max(1, nodeRate)).toFixed(2));
        userMinersPower = Math.ceil(minersNeeded) * (SATIS_DATA.miners[minerTier]?.power || 12);
        userExtractionRate = totalFuelRate;
      }
    }

    // Balance de Combustible o Petróleo Crudo
    const requiredInputRate = isOilFuel ? crudeOilNeeded : totalFuelRate;
    const maxGensWithSupply = isOilFuel
      ? (fuelId === 'fuel' ? (userExtractionRate / 1.5) / 20 : (userExtractionRate / 1.8) / 7.5)
      : userExtractionRate / Math.max(0.1, unitFuelRate);

    const fuelBalance = {
      requiredRate: requiredInputRate,
      suppliedRate: Number(userExtractionRate.toFixed(2)),
      difference: Number((userExtractionRate - requiredInputRate).toFixed(2)),
      isCovered: userExtractionRate >= (requiredInputRate - 0.05),
      maxGeneratorsWithSupply: Number(maxGensWithSupply.toFixed(2)),
      maxMWWithSupply: Number((maxGensWithSupply * unitMW).toFixed(1))
    };

    // Consumo de Agua y Extractores
    const requiresWater = !!genData.requiresWater;
    const unitWaterRate = genData.waterRatePerGen || 0;
    const totalWaterRate = requiresWater ? Number((exactGenerators * unitWaterRate).toFixed(2)) : 0;
    const waterExtractorsExact = requiresWater ? (totalWaterRate / 120) : 0;
    const waterExtractorsCount = requiresWater ? Math.ceil(waterExtractorsExact) : 0;
    const lastExtractorClock = (waterExtractorsExact > 0 && (waterExtractorsCount - waterExtractorsExact) > 0.001)
      ? Number(((waterExtractorsExact - Math.floor(waterExtractorsExact)) * 100).toFixed(1))
      : 100;
    const waterExtractorsPower = waterExtractorsCount * 20; // 20 MW cada extractor de agua
    const pipeCapacity = pipeTier === 2 ? 600 : 300;
    const waterPipesCount = requiresWater ? Math.max(1, Math.ceil(totalWaterRate / pipeCapacity)) : 0;

    // Arquitectura Modular de Máxima Eficiencia (Golden Ratios)
    let modularArchitecture = null;
    if (genData.id === 'coal_generator') {
      // Ratio de oro 8 Generadores de Carbón : 3 Extractores de Agua (600 MW por módulo)
      const modules8_3 = Math.floor(fullGenerators / 8);
      const remGens = (fullGenerators % 8) + (hasFractional ? fractionalPart : 0);
      const remExtractors = remGens > 0 ? Number(((remGens * 45) / 120).toFixed(2)) : 0;

      modularArchitecture = {
        type: 'Ratio Áureo FICSIT 8:3',
        description: 'Cada módulo une 8 Generadores (600 MW) + 3 Extractores de Agua (360 m³/min) + 120 Carbón/min (Cinta Mk.2). Previene bloqueos por límite de caudal en tuberías.',
        standardModulesCount: modules8_3,
        standardModuleMW: 600,
        standardModuleCoal: 120,
        standardModuleWater: 360,
        standardModuleExtractors: 3,
        hasRemainder: remGens > 0,
        remainderGenerators: Number(remGens.toFixed(2)),
        remainderMW: Number((remGens * 75).toFixed(1)),
        remainderExtractors: Math.ceil(remExtractors),
        remainderCoal: Number((remGens * 15).toFixed(1))
      };
    } else if (genData.id === 'fuel_generator') {
      // Ratio de oro FICSIT 1:2: 1 Refinería (40 Fuel) ➔ 2 Generadores de Combustible (500 MW)
      const modules500 = Math.floor(fullGenerators / 2);
      const remGens = (fullGenerators % 2) + (hasFractional ? fractionalPart : 0);
      modularArchitecture = {
        type: 'Ratio Áureo FICSIT 1:2 (Módulos de 500 MW)',
        description: 'Cada módulo une 1 Refinería (60 Crudo ➔ 40 Fuel + 30 Resina) con 2 Generadores de Combustible 1.0 (500 MW). Cero desperdicio, simetría perfecta y la resina se tritura en un Awesome Sink.',
        standardModulesCount: modules500,
        standardModuleMW: 500,
        standardModuleCrude: 60,
        standardModuleFuel: 40,
        standardModuleResin: 30,
        standardModuleRefineries: 1,
        standardModuleGenerators: 2,
        hasRemainder: remGens > 0,
        remainderGenerators: Number(remGens.toFixed(2)),
        remainderMW: Number((remGens * 250).toFixed(1)),
        remainderCrude: Number(((remGens * 20 / 40) * 60).toFixed(1)),
        remainderFuel: Number((remGens * 20).toFixed(1)),
        remainderResin: Number(((remGens * 20 / 40) * 30).toFixed(1))
      };
    } else if (genData.id === 'nuclear_power_plant') {
      modularArchitecture = {
        type: 'Módulos Nucleares de 2,500 MW',
        description: 'Cada Reactor Nuclear produce 2,500 MW, consume 0.2 varillas/min y 240 m³/min de Agua (2 Extractores de Agua a 120 m³/min).',
        standardModulesCount: fullGenerators,
        standardModuleMW: 2500,
        standardModuleWater: 240,
        standardModuleExtractors: 2,
        hasRemainder: hasFractional,
        remainderGenerators: hasFractional ? 1 : 0,
        remainderMW: Number((fractionalPart * 2500).toFixed(1))
      };
    }

    // Balance Eléctrico
    const grossMW = target;
    const internalPumpsMW = waterExtractorsPower;
    const internalMinersMW = userMinersPower;
    const internalRefineryMW = refineriesPower;
    const internalSinkMW = sinkPower;
    const totalInternalMW = internalPumpsMW + internalMinersMW + internalRefineryMW + internalSinkMW;
    const netMW = Math.max(0, Number((grossMW - totalInternalMW).toFixed(1)));
    const netEfficiency = Number(((netMW / grossMW) * 100).toFixed(1));

    return {
      targetMW: target,
      generator: genData,
      fuelOption: fuelData,
      unitMW,
      exactGenerators: Number(exactGenerators.toFixed(3)),
      fullGenerators,
      hasFractional,
      lastClock,
      totalGeneratorsCount,
      fuel: {
        id: fuelData.id,
        name: fuelData.name,
        isFluid: isFuelFluid,
        unitRate: unitFuelRate,
        totalRate: totalFuelRate,
        belt: beltObj,
        beltsNeededCount: fuelBeltsCount,
        pipesNeededCount: fuelPipesCount,
        minersPower: userMinersPower,
        userDrills: userDrillsCalculated,
        balance: fuelBalance
      },
      petrochem: isOilFuel ? {
        isOil: true,
        crudeOilRate: crudeOilNeeded,
        refineriesExact: Number(refineriesExact.toFixed(2)),
        refineriesCount,
        refineryPower: refineriesPower,
        polymerResinRate,
        resinBelt: SatisCalc.getBeltForRate(polymerResinRate),
        sinkPower,
        crudePipesCount: Math.max(1, Math.ceil(crudeOilNeeded / pipeCapacity)),
        crudeBalance: fuelBalance
      } : null,
      water: {
        requiresWater,
        unitRate: unitWaterRate,
        totalRate: totalWaterRate,
        extractorsExact: Number(waterExtractorsExact.toFixed(2)),
        extractorsCount: waterExtractorsCount,
        lastExtractorClock,
        extractorPower: waterExtractorsPower,
        pipesNeededCount: waterPipesCount,
        pipeCapacity,
        pipeName: pipeTier === 2 ? 'Tubería Mk.2 (600 m³/min)' : 'Tubería Mk.1 (300 m³/min)'
      },
      modularArchitecture,
      powerBalance: {
        grossMW,
        internalPumpsMW,
        internalMinersMW,
        internalRefineryMW,
        internalSinkMW,
        totalInternalMW,
        netMW,
        netEfficiency
      }
    };
  }
};

window.SatisCalc = SatisCalc;
