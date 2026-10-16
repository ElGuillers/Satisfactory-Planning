/**
 * FICSIT CONTROLLER & UI APPLICATION
 * Manages reactive UI, calculations, tab switching, and visual cards.
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- STATE ---
  const state = {
    currentTab: 'tab-line-builder',
    builder: {
      calcMode: 'drills', // 'drills' | 'rate'
      viewMode: 'blueprint', // 'blueprint' | 'phases'
      powerMode: 'eco', // 'eco' | 'standard' | 'compact'
      targetGoal: 'motor',
      drillCount: 1,
      targetRate: 5,
      globalMinerTier: 'miner_mk1',
      purityOverrides: {},
      minerOverrides: {},
      nodeCountOverrides: {},
      rawNodesConfig: {},
      altPreferences: {}
    },
    power: {
      targetMW: 8000,
      fuelId: 'coal',
      pipeTier: 1,
      beltTier: 3,
      blueprintMode: 'block',
      coalDistribution: 'balanced', // 'balanced' (Mitad y Mitad / Central 60/60) | 'cascade' (Manifold continuo)
      drills: [
        { id: 'drill_1', minerTier: 'miner_mk2', purity: 'normal', clock: 100 },
        { id: 'drill_2', minerTier: 'miner_mk2', purity: 'normal', clock: 100 },
        { id: 'drill_3', minerTier: 'miner_mk2', purity: 'normal', clock: 100 },
        { id: 'drill_4', minerTier: 'miner_mk2', purity: 'normal', clock: 100 }
      ]
    },
    sandbox: {
      mode: 'miners', // 'miners' | 'free'
      resource: 'iron_ore',
      purity: 'normal',
      minerTier: 'miner_mk1',
      minerCount: 2,
      hasSecondary: false,
      secondaryResource: 'coal',
      secondaryPurity: 'normal',
      secondaryMinerTier: 'miner_mk1',
      secondaryMinerCount: 1,
      autoSmelt: true,
      autoBalance: true,
      freeItem: 'iron_ingot',
      freeRate: 120,
      branches: [
        { recipeId: 'iron_plate_std', machineCount: 2 },
        { recipeId: 'iron_rod_std', machineCount: 4 }
      ]
    },
    miner: {
      resource: 'iron_ore',
      purity: 'normal',
      minerTier: 'miner_mk2',
      clockPercent: 100
    },
    factory: {
      targetItem: 'modular_frame',
      targetRate: 10,
      altPreferences: {}
    },
    splitter: {
      inputRate: 120,
      machineIntake: 30
    },
    quick: {
      building: 'constructor',
      recipeId: 'iron_plate_std',
      count: 1,
      clock: 100
    }
  };

  // --- BLUEPRINT VIEWER & MODAL STATES ---
  const bpViewerState = {
    scale: 1,
    panX: 0,
    panY: 0,
    isDragging: false,
    isZooming: false,
    focusModeEnabled: true,
    startX: 0,
    startY: 0,
    currentModel: null,
    showRatios: true,
    activeMaterialFilter: null,
    isInitialized: false
  };

  const powerBpState = {
    scale: 1,
    panX: 0,
    panY: 0,
    isDragging: false,
    isZooming: false,
    focusModeEnabled: true,
    startX: 0,
    startY: 0,
    currentModel: null,
    isInitialized: false
  };

  const sbBpState = {
    scale: 1,
    panX: 0,
    panY: 0,
    isDragging: false,
    isZooming: false,
    focusModeEnabled: true,
    startX: 0,
    startY: 0,
    currentModel: null,
    isInitialized: false,
    highlightedBranchIdx: null
  };

  const bpModalState = {
    scale: 1,
    panX: 0,
    panY: 0,
    isDragging: false,
    startX: 0,
    startY: 0,
    currentModel: null,
    isInitialized: false
  };

  // --- INITIALIZATION ---
  try {
    initTabs();
    initLineBuilder();
    initRecipePickerModal();
    initSandboxTab();
    initPowerTab();
    initMinersTab();
    initFactoryTab();
    initSplitterTab();
    initQuickTab();
    initRecipesTab();
    initCopyButton();
  } catch (err) {
    console.error('FICSIT App Error:', err);
    if (document.body) {
      document.body.setAttribute('data-app-error', (err && err.stack) ? err.stack : String(err));
    }
  }

  // =========================================================================
  // 1. TABS MANAGEMENT
  // =========================================================================
  function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        setActiveTab(targetTab);
      });
    });
  }

  function setActiveTab(tabId) {
    state.currentTab = tabId;
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });
    document.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === tabId);
    });

    if (tabId === 'tab-power') {
      renderPowerPlantSection();
      setTimeout(() => fitPowerBlueprintToViewport(), 80);
    } else if (tabId === 'tab-sandbox') {
      updateSandbox();
      setTimeout(() => fitSandboxBlueprintToViewport(), 80);
    }
  }

  // =========================================================================
  // 1.5. TAB 0: DISEÑADOR DE FÁBRICA POR OBJETIVO (DE TU META A LOS MINERALES)
  // =========================================================================
  function getPrimaryRawId(targetItemId, altPreferences = {}) {
    const basePlan = SatisCalc.buildTargetFactoryPlan(targetItemId, 1.0, altPreferences);
    if (basePlan && basePlan.rawBreakdown && basePlan.rawBreakdown.length > 0) {
      return basePlan.rawBreakdown.reduce((prev, curr) => (curr.requiredRate > prev.requiredRate ? curr : prev)).rawId;
    }
    return 'iron_ore';
  }

  function updateCalcModeUI() {
    const isDrills = (state.builder.calcMode === 'drills');
    const drillInputBox = document.getElementById('builderDrillInputBox');
    const rateInputBox = document.getElementById('builderRateInputBox');
    const quantityLabel = document.getElementById('builderQuantityLabel');
    const btnToggleCalcMode = document.getElementById('btnToggleCalcMode');
    const drillInput = document.getElementById('builderDrillCountInput');
    const rateInput = document.getElementById('builderTargetRate');

    const basePlan = SatisCalc.buildTargetFactoryPlan(state.builder.targetGoal || 'iron_plate', 1.0, state.builder.altPreferences);
    const isMultiRaw = basePlan && basePlan.rawBreakdown && basePlan.rawBreakdown.length > 1;

    if (drillInputBox) drillInputBox.style.display = isDrills ? 'flex' : 'none';
    if (rateInputBox) rateInputBox.style.display = isDrills ? 'none' : 'flex';
    if (quantityLabel) {
      if (isDrills) {
        quantityLabel.innerHTML = isMultiRaw
          ? `⛏️ 2. ¿Cuántos Taladros colocas? <span style="font-size: 0.72rem; color: #38bdf8; font-weight: 700;">(${state.builder.drillCount || 1} por cada mineral requerido: ${basePlan.rawBreakdown.map(r => r.name).join(' + ')})</span>`
          : '⛏️ 2. ¿Cuántos Taladros colocas?';
      } else {
        quantityLabel.textContent = '📦 2. Cantidad deseada (piezas/min)';
      }
    }
    if (btnToggleCalcMode) {
      btnToggleCalcMode.textContent = isDrills ? '(Cambiar a piezas/min manual)' : '(Cambiar a cálculo por taladros)';
    }
    if (drillInput) drillInput.value = state.builder.drillCount || 1;
    if (rateInput) rateInput.value = state.builder.targetRate;
  }

  function syncTargetRateFromDrills(applyToAll = true) {
    const targetGoal = state.builder.targetGoal || 'iron_plate';
    const basePlan = SatisCalc.buildTargetFactoryPlan(targetGoal, 1.0, state.builder.altPreferences);
    const requiredRaws = (basePlan && basePlan.rawBreakdown && basePlan.rawBreakdown.length > 0)
      ? basePlan.rawBreakdown
      : [{ rawId: 'iron_ore', name: 'Mineral de Hierro', requiredRate: 1.0 }];

    const drillCount = Math.max(1, state.builder.drillCount || 1);
    state.builder.rawNodesConfig = state.builder.rawNodesConfig || {};
    state.builder.nodeCountOverrides = state.builder.nodeCountOverrides || {};

    // 1. Si applyToAll es true (usuario cambió el input general de taladros o usó un preset),
    // ajustamos la cantidad de taladros para TODOS los minerales requeridos (ej. Hierro Y Carbón)
    if (applyToAll) {
      requiredRaws.forEach(raw => {
        const rawId = raw.rawId;
        const defaultMinerTier = (state.builder.minerOverrides && state.builder.minerOverrides[rawId]) || state.builder.globalMinerTier || 'miner_mk1';
        const defaultPurity = (state.builder.purityOverrides && state.builder.purityOverrides[rawId]) || 'normal';

        let nodes = state.builder.rawNodesConfig[rawId];
        if (!nodes || !Array.isArray(nodes)) nodes = [];

        while (nodes.length < drillCount) {
          nodes.push({
            id: Date.now() + Math.random(),
            purity: defaultPurity,
            minerKey: defaultMinerTier
          });
        }
        if (nodes.length > drillCount) {
          nodes = nodes.slice(0, drillCount);
        }
        state.builder.rawNodesConfig[rawId] = nodes;
        state.builder.nodeCountOverrides[rawId] = drillCount;
      });
    }

    // 2. Calcular la tasa de extracción de cada mineral
    const availableRatesMap = {};
    requiredRaws.forEach(raw => {
      const rawId = raw.rawId;
      const nodes = state.builder.rawNodesConfig[rawId] || [];
      const defaultTier = (state.builder.minerOverrides && state.builder.minerOverrides[rawId]) || state.builder.globalMinerTier || 'miner_mk1';
      const rawRate = Number(nodes.reduce((sum, n) => {
        const pMeta = SATIS_DATA.purities[n.purity] || SATIS_DATA.purities.normal;
        const mMeta = SATIS_DATA.miners[n.minerKey] || SATIS_DATA.miners[defaultTier] || SATIS_DATA.miners.miner_mk1;
        const factor = (mMeta.isFixedRate || rawId === 'water') ? 1.0 : pMeta.factor;
        const clock = (n.clock !== undefined) ? n.clock : 100;
        return sum + (mMeta.baseRate * factor * (clock / 100));
      }, 0).toFixed(2));
      availableRatesMap[rawId] = rawRate;
    });

    // 3. Calcular la tasa objetivo respetando todos los insumos (cuello de botella)
    const calculatedRate = SatisCalc.calculateTargetRateFromAllRawExtraction(
      targetGoal,
      availableRatesMap,
      state.builder.altPreferences
    );

    state.builder.targetRate = calculatedRate;
    const rateInput = document.getElementById('builderTargetRate');
    const drillInput = document.getElementById('builderDrillCountInput');
    if (rateInput) rateInput.value = calculatedRate;
    if (drillInput) drillInput.value = drillCount;
  }

  function initLineBuilder() {
    const goalSelect = document.getElementById('builderGoalSelect');
    const rateInput = document.getElementById('builderTargetRate');
    const btnMinus = document.getElementById('btnBuilderRateMinus');
    const btnPlus = document.getElementById('btnBuilderRatePlus');
    const btnOpenModal = document.getElementById('btnOpenBuilderGoalModal');
    const btnCopyGuide = document.getElementById('btnCopyBuilderGuide');

    const btnPreset1D = document.getElementById('btnPreset1Drill');
    const btnPreset2D = document.getElementById('btnPreset2Drills');
    const btnPreset3D = document.getElementById('btnPreset3Drills');
    const btnPreset4D = document.getElementById('btnPreset4Drills');
    const btnPreset1M = document.getElementById('btnPreset1Machine');
    const btnPreset2M = document.getElementById('btnPreset2Machines');

    const btnToggleCalcMode = document.getElementById('btnToggleCalcMode');
    const drillInput = document.getElementById('builderDrillCountInput');
    const btnDrillMinus = document.getElementById('btnBuilderDrillMinus');
    const btnDrillPlus = document.getElementById('btnBuilderDrillPlus');

    populateGoalSelect();
    updateCalcModeUI();
    if (state.builder.calcMode === 'drills') {
      syncTargetRateFromDrills();
    }

    if (btnToggleCalcMode) {
      btnToggleCalcMode.addEventListener('click', () => {
        state.builder.calcMode = (state.builder.calcMode === 'drills') ? 'rate' : 'drills';
        updateCalcModeUI();
        if (state.builder.calcMode === 'drills') {
          syncTargetRateFromDrills();
        }
        updateLineBuilder();
      });
    }

    // Drill count controls
    if (drillInput) {
      drillInput.addEventListener('input', (e) => {
        state.builder.calcMode = 'drills';
        state.builder.drillCount = Math.max(1, parseInt(e.target.value, 10) || 1);
        syncTargetRateFromDrills();
        updateLineBuilder();
      });
    }

    if (btnDrillMinus) {
      btnDrillMinus.addEventListener('click', () => {
        state.builder.calcMode = 'drills';
        const cur = state.builder.drillCount || 1;
        state.builder.drillCount = Math.max(1, cur - 1);
        if (drillInput) drillInput.value = state.builder.drillCount;
        syncTargetRateFromDrills();
        updateLineBuilder();
      });
    }

    if (btnDrillPlus) {
      btnDrillPlus.addEventListener('click', () => {
        state.builder.calcMode = 'drills';
        const cur = state.builder.drillCount || 1;
        state.builder.drillCount = cur + 1;
        if (drillInput) drillInput.value = state.builder.drillCount;
        syncTargetRateFromDrills();
        updateLineBuilder();
      });
    }

    // Drill preset buttons
    function setDrillPreset(count) {
      state.builder.calcMode = 'drills';
      state.builder.drillCount = count;
      updateCalcModeUI();
      syncTargetRateFromDrills();
      updateLineBuilder();
    }

    if (btnPreset1D) btnPreset1D.addEventListener('click', () => setDrillPreset(1));
    if (btnPreset2D) btnPreset2D.addEventListener('click', () => setDrillPreset(2));
    if (btnPreset3D) btnPreset3D.addEventListener('click', () => setDrillPreset(3));
    if (btnPreset4D) btnPreset4D.addEventListener('click', () => setDrillPreset(4));

    // Manual rate controls
    if (rateInput) {
      rateInput.value = state.builder.targetRate;
      rateInput.addEventListener('input', (e) => {
        state.builder.calcMode = 'rate';
        state.builder.targetRate = Math.max(0.1, parseFloat(e.target.value) || 1);
        updateLineBuilder();
      });
    }

    if (btnMinus) {
      btnMinus.addEventListener('click', () => {
        state.builder.calcMode = 'rate';
        const cur = state.builder.targetRate;
        const step = cur > 5 ? 1 : 0.5;
        state.builder.targetRate = Math.max(0.5, Number((cur - step).toFixed(2)));
        if (rateInput) rateInput.value = state.builder.targetRate;
        updateLineBuilder();
      });
    }

    if (btnPlus) {
      btnPlus.addEventListener('click', () => {
        state.builder.calcMode = 'rate';
        const cur = state.builder.targetRate;
        const step = cur >= 5 ? 1 : 0.5;
        state.builder.targetRate = Number((cur + step).toFixed(2));
        if (rateInput) rateInput.value = state.builder.targetRate;
        updateLineBuilder();
      });
    }

    if (btnPreset1M) {
      btnPreset1M.addEventListener('click', () => {
        state.builder.calcMode = 'rate';
        const stdRec = SatisCalc.findRecipeForItem(state.builder.targetGoal);
        state.builder.targetRate = stdRec?.outputs[0]?.rate || 5;
        updateCalcModeUI();
        updateLineBuilder();
      });
    }
    if (btnPreset2M) {
      btnPreset2M.addEventListener('click', () => {
        state.builder.calcMode = 'rate';
        const stdRec = SatisCalc.findRecipeForItem(state.builder.targetGoal);
        state.builder.targetRate = (stdRec?.outputs[0]?.rate || 5) * 2;
        updateCalcModeUI();
        updateLineBuilder();
      });
    }

    if (goalSelect) {
      goalSelect.addEventListener('change', (e) => {
        state.builder.targetGoal = e.target.value;
        if (state.builder.calcMode === 'drills') {
          syncTargetRateFromDrills();
        } else {
          const stdRec = SatisCalc.findRecipeForItem(state.builder.targetGoal);
          if (stdRec && stdRec.outputs[0]) {
            state.builder.targetRate = stdRec.outputs[0].rate;
            if (rateInput) rateInput.value = state.builder.targetRate;
          }
        }
        updateLineBuilder();
      });
    }

    if (btnOpenModal) {
      btnOpenModal.addEventListener('click', () => {
        openRecipePickerModal({ type: 'builder' });
      });
    }

    // Global Miner Tier selection (elegir antes)
    const globalMinerGroup = document.getElementById('builderGlobalMinerGroup');
    if (globalMinerGroup) {
      globalMinerGroup.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-global-miner');
        if (!btn) return;
        const minerTier = btn.getAttribute('data-miner');
        state.builder.globalMinerTier = minerTier;
        state.builder.minerOverrides = {}; // Reset overrides to follow global selection
        globalMinerGroup.querySelectorAll('.btn-global-miner').forEach(b => {
          b.classList.toggle('active', b.getAttribute('data-miner') === minerTier);
        });
        if (state.builder.calcMode === 'drills') {
          syncTargetRateFromDrills();
        }
        updateLineBuilder();
      });
    }

    // Raw Cards Container delegation (Purity per drill, Miner Tier per drill, Add/Remove drill, Auto Reset, Sync)
    const rawCardsBox = document.getElementById('builderRawCardsContainer');
    if (rawCardsBox) {
      rawCardsBox.addEventListener('click', (e) => {
        // 1. Purity toggle for a specific drill
        const btnNodePurity = e.target.closest('.btn-node-purity');
        if (btnNodePurity) {
          const rawId = btnNodePurity.getAttribute('data-raw');
          const idx = parseInt(btnNodePurity.getAttribute('data-index'), 10);
          const purity = btnNodePurity.getAttribute('data-purity');
          if (state.builder.rawNodesConfig && state.builder.rawNodesConfig[rawId] && state.builder.rawNodesConfig[rawId][idx]) {
            state.builder.rawNodesConfig[rawId][idx].purity = purity;
            if (state.builder.calcMode === 'drills') {
              syncTargetRateFromDrills(false);
            }
            updateLineBuilder();
          }
          return;
        }

        // 2. Miner tier toggle for a specific drill (Mk.1, Mk.2, Mk.3)
        const btnNodeMiner = e.target.closest('.btn-node-miner');
        if (btnNodeMiner) {
          const rawId = btnNodeMiner.getAttribute('data-raw');
          const idx = parseInt(btnNodeMiner.getAttribute('data-index'), 10);
          const minerKey = btnNodeMiner.getAttribute('data-miner');
          if (state.builder.rawNodesConfig && state.builder.rawNodesConfig[rawId] && state.builder.rawNodesConfig[rawId][idx]) {
            state.builder.rawNodesConfig[rawId][idx].minerKey = minerKey;
            if (state.builder.calcMode === 'drills') {
              syncTargetRateFromDrills(false);
            }
            updateLineBuilder();
          }
          return;
        }

        // 3. Add a drill to this resource
        const btnAddDrill = e.target.closest('.btn-add-drill');
        if (btnAddDrill) {
          const rawId = btnAddDrill.getAttribute('data-raw');
          state.builder.rawNodesConfig = state.builder.rawNodesConfig || {};
          if (!state.builder.rawNodesConfig[rawId]) {
            state.builder.rawNodesConfig[rawId] = [];
          }
          state.builder.rawNodesConfig[rawId].push({
            id: Date.now() + Math.random(),
            purity: 'normal',
            minerKey: state.builder.globalMinerTier || 'miner_mk1'
          });
          const newCount = state.builder.rawNodesConfig[rawId].length;
          state.builder.nodeCountOverrides = state.builder.nodeCountOverrides || {};
          state.builder.nodeCountOverrides[rawId] = newCount;

          if (state.builder.calcMode === 'drills') {
            syncTargetRateFromDrills(false);
            updateCalcModeUI();
          }
          updateLineBuilder();
          return;
        }

        // 4. Remove a specific drill from this resource
        const btnRemove = e.target.closest('.btn-remove-drill');
        if (btnRemove) {
          const rawId = btnRemove.getAttribute('data-raw');
          const idx = parseInt(btnRemove.getAttribute('data-index'), 10);
          if (state.builder.rawNodesConfig && state.builder.rawNodesConfig[rawId] && state.builder.rawNodesConfig[rawId].length > 1) {
            state.builder.rawNodesConfig[rawId].splice(idx, 1);
            const newCount = state.builder.rawNodesConfig[rawId].length;
            state.builder.nodeCountOverrides = state.builder.nodeCountOverrides || {};
            state.builder.nodeCountOverrides[rawId] = newCount;

            if (state.builder.calcMode === 'drills') {
              syncTargetRateFromDrills(false);
              updateCalcModeUI();
            }
            updateLineBuilder();
          }
          return;
        }

        // 5. Node count auto reset (al mínimo calculado)
        const btnAuto = e.target.closest('.btn-node-auto');
        if (btnAuto) {
          const rawId = btnAuto.getAttribute('data-raw');
          const minNodes = parseInt(btnAuto.getAttribute('data-minnodes'), 10) || 1;
          state.builder.rawNodesConfig = state.builder.rawNodesConfig || {};
          const defaultMinerTier = (state.builder.minerOverrides && state.builder.minerOverrides[rawId]) || state.builder.globalMinerTier || 'miner_mk1';
          state.builder.rawNodesConfig[rawId] = Array.from({ length: minNodes }, (_, i) => ({
            id: i + 1,
            purity: 'normal',
            minerKey: defaultMinerTier
          }));
          state.builder.nodeCountOverrides = state.builder.nodeCountOverrides || {};
          state.builder.nodeCountOverrides[rawId] = minNodes;

          if (state.builder.calcMode === 'drills') {
            syncTargetRateFromDrills(false);
            updateCalcModeUI();
          }
          updateLineBuilder();
          return;
        }

        // 6. Sync factory to this drill / mineral capacity and auto-balance other required minerals
        const btnSync = e.target.closest('.btn-sync-factory-to-drill');
        if (btnSync) {
          const rawId = btnSync.getAttribute('data-raw');
          const cap = parseFloat(btnSync.getAttribute('data-capacity')) || 60;
          const nodes = parseInt(btnSync.getAttribute('data-nodes'), 10) || 1;
          state.builder.calcMode = 'drills';
          state.builder.drillCount = nodes;
          state.builder.nodeCountOverrides = state.builder.nodeCountOverrides || {};
          state.builder.nodeCountOverrides[rawId] = nodes;

          const targetRate = SatisCalc.calculateTargetRateFromRawExtraction(
            state.builder.targetGoal,
            rawId,
            cap,
            state.builder.altPreferences
          );
          state.builder.targetRate = targetRate;

          // Auto-equilibrar los demás minerales requeridos para que no queden con déficit
          const basePlan = SatisCalc.buildTargetFactoryPlan(state.builder.targetGoal, targetRate, state.builder.altPreferences);
          if (basePlan && basePlan.rawBreakdown) {
            basePlan.rawBreakdown.forEach(r => {
              if (r.rawId !== rawId) {
                const neededRate = r.requiredRate;
                const defaultTier = (state.builder.minerOverrides && state.builder.minerOverrides[r.rawId]) || state.builder.globalMinerTier || 'miner_mk1';
                const defaultPurity = (state.builder.purityOverrides && state.builder.purityOverrides[r.rawId]) || 'normal';
                const pFactor = SATIS_DATA.purities[defaultPurity]?.factor || 1.0;
                const mBase = SATIS_DATA.miners[defaultTier]?.baseRate || 60;
                const singleOutput = mBase * pFactor;
                const neededNodes = Math.max(1, Math.ceil(neededRate / singleOutput));

                state.builder.rawNodesConfig = state.builder.rawNodesConfig || {};
                let otherNodes = state.builder.rawNodesConfig[r.rawId] || [];
                while (otherNodes.length < neededNodes) {
                  otherNodes.push({ id: Date.now() + Math.random(), purity: defaultPurity, minerKey: defaultTier });
                }
                state.builder.rawNodesConfig[r.rawId] = otherNodes;
                state.builder.nodeCountOverrides[r.rawId] = otherNodes.length;
              }
            });
          }

          updateCalcModeUI();
          updateLineBuilder();
          return;
        }
      });
    }

    if (btnCopyGuide) {
      btnCopyGuide.addEventListener('click', () => {
        const container = document.getElementById('builderDynamicPhasesContainer');
        const totalMw = document.getElementById('builderTotalMw')?.innerText || '0 MW';
        const bChips = document.getElementById('builderBuildingChips')?.innerText || '';
        const fullGuide = `=== GUÍA DE PRODUCCIÓN FICSIT (Satisfactory 1.0/1.2) ===\nOBJETIVO: ${state.builder.targetRate} ${state.builder.targetGoal}/min\nENERGÍA TOTAL: ${totalMw}\n\nPASOS DE LA FÁBRICA:\n${container?.innerText || ''}\n\nEDIFICIOS REQUERIDOS:\n${bChips}`;

        navigator.clipboard.writeText(fullGuide).then(() => {
          const orig = btnCopyGuide.innerHTML;
          btnCopyGuide.innerHTML = '✅ Copiado';
          setTimeout(() => { btnCopyGuide.innerHTML = orig; }, 2000);
        });
      });
    }

    // View Switcher: Plano Vista Aérea (2D) vs Esquema por Fases
    const btnViewBp = document.getElementById('btnViewBlueprint');
    const btnViewPh = document.getElementById('btnViewPhases');
    const sectionBp = document.getElementById('builderBlueprintSection');
    const containerPh = document.getElementById('builderDynamicPhasesContainer');

    function switchBuilderView(mode) {
      state.builder.viewMode = mode;
      if (btnViewBp) btnViewBp.classList.toggle('active', mode === 'blueprint');
      if (btnViewPh) btnViewPh.classList.toggle('active', mode === 'phases');
      if (sectionBp) sectionBp.style.display = (mode === 'blueprint') ? 'block' : 'none';
      if (containerPh) containerPh.style.display = (mode === 'phases') ? 'block' : 'none';
      if (mode === 'blueprint') {
        requestAnimationFrame(() => fitBlueprintToViewport(false));
      }
    }

    if (btnViewBp) btnViewBp.addEventListener('click', () => switchBuilderView('blueprint'));
    if (btnViewPh) btnViewPh.addEventListener('click', () => switchBuilderView('phases'));

    // Gestor de Modo Energético (Eco / Estándar / Compacto)
    const btnPwrEco = document.getElementById('btnPowerEco');
    const btnPwrStd = document.getElementById('btnPowerStandard');
    const btnPwrCmp = document.getElementById('btnPowerCompact');
    const btnToggleGens = document.getElementById('btnToggleGens');
    const genListEl = document.getElementById('energyGeneratorsList');

    function setPowerMode(mode) {
      state.builder.powerMode = mode;
      if (btnPwrEco) btnPwrEco.classList.toggle('active', mode === 'eco');
      if (btnPwrStd) btnPwrStd.classList.toggle('active', mode === 'standard');
      if (btnPwrCmp) btnPwrCmp.classList.toggle('active', mode === 'compact');
      updateLineBuilder();
    }

    if (btnPwrEco) btnPwrEco.addEventListener('click', () => setPowerMode('eco'));
    if (btnPwrStd) btnPwrStd.addEventListener('click', () => setPowerMode('standard'));
    if (btnPwrCmp) btnPwrCmp.addEventListener('click', () => setPowerMode('compact'));

    if (btnToggleGens && genListEl) {
      let gensVisible = true;
      btnToggleGens.addEventListener('click', () => {
        gensVisible = !gensVisible;
        genListEl.style.display = gensVisible ? 'flex' : 'none';
        btnToggleGens.textContent = gensVisible ? 'Ocultar opciones ▴' : 'Ver opciones ▾';
      });
    }

    initBlueprintInteractions();
    initBlueprintModal();

    updateLineBuilder();
  }

  function populateGoalSelect() {
    const goalSelect = document.getElementById('builderGoalSelect');
    if (!goalSelect) return;

    const craftableMap = new Map();
    SATIS_DATA.recipes.forEach(r => {
      r.outputs.forEach(o => {
        if (!craftableMap.has(o.item)) {
          const itemMeta = SATIS_DATA.items[o.item] || { id: o.item, name: o.item, category: 'General' };
          craftableMap.set(o.item, itemMeta);
        }
      });
    });

    const categories = {
      'Fases del Ascensor Espacial': [],
      'Componentes Industriales': [],
      'Electrónica y Alta Tecnología': [],
      'Piezas Básicas': [],
      'Lingotes': [],
      'Otros': []
    };

    craftableMap.forEach((item, itemId) => {
      const cat = (item.category || '').toLowerCase();
      if (cat.includes('fase') || cat.includes('espacial') || itemId.includes('smart_plating') || itemId.includes('automated_wiring') || itemId.includes('adaptive_control') || itemId.includes('versatile') || itemId.includes('modular_engine')) {
        categories['Fases del Ascensor Espacial'].push(item);
      } else if (cat.includes('lingote')) {
        categories['Lingotes'].push(item);
      } else if (cat.includes('básico') || itemId.includes('plate') || itemId.includes('rod') || itemId.includes('screw') || itemId.includes('wire') || itemId.includes('concrete')) {
        categories['Piezas Básicas'].push(item);
      } else if (cat.includes('electr') || cat.includes('comunic') || itemId.includes('circuit') || itemId.includes('computer')) {
        categories['Electrónica y Alta Tecnología'].push(item);
      } else {
        categories['Componentes Industriales'].push(item);
      }
    });

    let html = '';
    for (const [catName, list] of Object.entries(categories)) {
      if (list.length === 0) continue;
      list.sort((a, b) => a.name.localeCompare(b.name));
      html += `<optgroup label="${catName}">`;
      list.forEach(item => {
        html += `<option value="${item.id}">${item.name}</option>`;
      });
      html += `</optgroup>`;
    }

    goalSelect.innerHTML = html;
    if (craftableMap.has(state.builder.targetGoal)) {
      goalSelect.value = state.builder.targetGoal;
    } else {
      goalSelect.value = 'motor';
      state.builder.targetGoal = 'motor';
    }
  }

  function renderManifoldDiagram(flowSteps, buildingName, itemName, outItemName, outRatePerMachine) {
    if (!flowSteps || flowSteps.length === 0) return '';
    if (flowSteps.length === 1) {
      const s = flowSteps[0];
      return `
        <div class="schematic-box">
          <div class="schematic-title">
            <span>📐 Conexión Directa (Sin Splitters)</span>
            <span style="color: ${s.beltIn.color};">${s.beltIn.name} (${s.consumes}/m)</span>
          </div>
          <div class="splitter-step-item">
            <span>1x ${buildingName} recibe directamente <strong>${s.consumes}/m de ${itemName}</strong></span>
            <strong style="color: #4ade80;">➔ Saca: ${outRatePerMachine}/m ${outItemName}</strong>
          </div>
        </div>
      `;
    }

    let rows = '';
    flowSteps.forEach(step => {
      rows += `
        <div class="splitter-step-item">
          <div style="display: flex; align-items: center; gap: 8px;">
            ${step.splitterIndex 
              ? `<span class="splitter-badge-tag">Splitter #${step.splitterIndex}</span>` 
              : `<span class="splitter-badge-tag" style="background: #334155; color: #94a3b8;">Fin Manifold</span>`
            }
            <span>Entran: <strong style="color: ${step.beltIn.color};">${step.flowIn}/m (${step.beltIn.name})</strong></span>
          </div>
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="color: #facc15;">├─► <strong>${step.consumes}/m</strong> (${step.feederBelt.name}) ➔ ${buildingName} #${step.machineIndex}</span>
            ${step.flowRemaining > 0 
              ? `<span style="color: #94a3b8; font-size: 0.75rem;">└─► Siguen <strong>${step.flowRemaining}/m</strong> (${step.beltContinue ? step.beltContinue.name : ''})</span>` 
              : `<span style="color: #4ade80; font-size: 0.75rem;">(Saturación 100%)</span>`
            }
          </div>
        </div>
      `;
    });

    return `
      <div class="schematic-box">
        <div class="schematic-title">
          <span>📐 Desglose Paso a Paso de Divisores (Manifold de ${flowSteps.length - 1} Splitters)</span>
          <span style="color: ${flowSteps[0].beltIn.color}; font-size: 0.75rem;">Troncal: ${flowSteps[0].beltIn.name} (${flowSteps[0].flowIn}/m)</span>
        </div>
        <div class="splitter-step-list">
          ${rows}
        </div>
      </div>
    `;
  }

  function updateLineBuilder() {
    try {
      const targetGoal = state.builder.targetGoal || 'motor';
    const targetRate = state.builder.targetRate || 5;
    const purityOverrides = state.builder.purityOverrides || {};
    const altPreferences = state.builder.altPreferences || {};
    const minerOverrides = state.builder.minerOverrides || {};
    const nodeCountOverrides = state.builder.nodeCountOverrides || {};
    const globalMinerTier = state.builder.globalMinerTier || 'miner_mk1';
    const rawNodesConfig = state.builder.rawNodesConfig || {};

    const plan = SatisCalc.buildTargetFactoryPlan(
      targetGoal,
      targetRate,
      altPreferences,
      purityOverrides,
      minerOverrides,
      nodeCountOverrides,
      globalMinerTier,
      rawNodesConfig
    );
    const targetMeta = plan.targetMeta || { name: targetGoal };

    // 0. Sync Global Miner Buttons
    const globalMinerGroup = document.getElementById('builderGlobalMinerGroup');
    if (globalMinerGroup) {
      globalMinerGroup.querySelectorAll('.btn-global-miner').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-miner') === globalMinerTier);
      });
    }

    // 0.1. Sync Preset buttons and inputs active state
    const isDrills = (state.builder.calcMode === 'drills');
    const drillCount = state.builder.drillCount || 1;
    const p1D = document.getElementById('btnPreset1Drill');
    const p2D = document.getElementById('btnPreset2Drills');
    const p3D = document.getElementById('btnPreset3Drills');
    const p4D = document.getElementById('btnPreset4Drills');
    const p1M = document.getElementById('btnPreset1Machine');
    const p2M = document.getElementById('btnPreset2Machines');

    if (p1D) p1D.classList.toggle('active', isDrills && drillCount === 1);
    if (p2D) p2D.classList.toggle('active', isDrills && drillCount === 2);
    if (p3D) p3D.classList.toggle('active', isDrills && drillCount === 3);
    if (p4D) p4D.classList.toggle('active', isDrills && drillCount === 4);

    const stdRec = SatisCalc.findRecipeForItem(targetGoal);
    const m1Rate = stdRec?.outputs[0]?.rate || 5;
    if (p1M) p1M.classList.toggle('active', !isDrills && Math.abs(plan.targetRate - m1Rate) < 0.01);
    if (p2M) p2M.classList.toggle('active', !isDrills && Math.abs(plan.targetRate - (m1Rate * 2)) < 0.01);

    const drillInputEl = document.getElementById('builderDrillCountInput');
    if (drillInputEl && isDrills) {
      drillInputEl.value = drillCount;
    }
    const rateInputEl = document.getElementById('builderTargetRate');
    if (rateInputEl) {
      rateInputEl.value = plan.targetRate;
    }

    // 1. Top Badges & Machine Hint
    const badgeEl = document.getElementById('builderGoalBadge');
    if (badgeEl) {
      badgeEl.innerHTML = `🎯 ${plan.targetRate}/min`;
    }

    const hintEl = document.getElementById('builderFinalMachineHint');
    if (hintEl) {
      const finalStep = plan.consolidatedSteps.find(s => s.itemId === targetGoal);
      if (finalStep) {
        hintEl.innerHTML = `
          <span>🏭 <strong>Paso Final:</strong> Se produce en <strong>${finalStep.machinesCount}x ${finalStep.building.name}</strong> (${finalStep.wholeMachines} al 100%${finalStep.remainderClock ? ` + 1 al ${finalStep.remainderClock}%` : ''}) usando la receta <em>${finalStep.recipe.name}</em> &bull; Consumo: <strong style="color: #facc15;">${finalStep.totalPower} MW</strong></span>
        `;
      } else {
        hintEl.innerHTML = `<span>Producirás <strong>${plan.targetRate}/min de ${targetMeta.name}</strong>.</span>`;
      }
    }

    // 2. Render Raw Material Cards (Heterogeneous Individual Drills per Resource)
    const rawContainer = document.getElementById('builderRawCardsContainer');
    if (rawContainer) {
      if (plan.rawBreakdown.length === 0) {
        rawContainer.innerHTML = `
          <div style="color: var(--text-muted); font-size: 0.85rem; padding: 8px;">
            Este producto no requiere minerales crudos adicionales o es una materia prima directa.
          </div>
        `;
      } else {
        let cardsHtml = '';
        state.builder.rawNodesConfig = state.builder.rawNodesConfig || {};

        plan.rawBreakdown.forEach(raw => {
          const belt = raw.beltNeeded;
          const nodes = raw.nodes || [];

          // Keep state.builder.rawNodesConfig in sync
          if (!state.builder.rawNodesConfig[raw.rawId] || state.builder.rawNodesConfig[raw.rawId].length !== nodes.length) {
            state.builder.rawNodesConfig[raw.rawId] = nodes.map(n => ({
              id: n.nodeIndex,
              purity: n.purityKey,
              minerKey: n.minerKey,
              clock: n.clock || 100
            }));
          }

          // Individual Drills List HTML
          const drillsListHtml = nodes.map((n, idx) => {
            return `
              <div class="raw-drill-row">
                <div class="drill-row-header">
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <span class="drill-tag">⛏️ Taladro #${n.nodeIndex}</span>
                    <span style="font-size: 0.72rem; color: #94a3b8; font-weight: 600;">${!raw.isFluid ? n.minerName : 'Extractor'}</span>
                  </div>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="drill-output-badge" style="color: #4ade80;">
                      <strong>+${n.outputRate}/m</strong>
                      <span style="color: ${n.belt.color}; font-size: 0.68rem; font-weight: 700;">(${n.belt.name})</span>
                    </span>
                    ${nodes.length > 1 ? `
                      <button type="button" class="btn-remove-drill" data-raw="${raw.rawId}" data-index="${idx}" title="Eliminar este taladro">🗑️</button>
                    ` : ''}
                  </div>
                </div>

                <div class="drill-row-controls">
                  <!-- Selector de Pureza de esta mena específica -->
                  <div class="drill-control-group">
                    <span class="drill-sublabel">Pureza:</span>
                    <div class="raw-purity-group-sm">
                      <button type="button" class="btn-node-purity ${n.purityKey === 'impure' ? 'active' : ''}" data-raw="${raw.rawId}" data-index="${idx}" data-purity="impure" title="Mena Impura (0.5x velocidad)">Impuro</button>
                      <button type="button" class="btn-node-purity ${n.purityKey === 'normal' ? 'active' : ''}" data-raw="${raw.rawId}" data-index="${idx}" data-purity="normal" title="Mena Normal (1.0x velocidad)">Normal</button>
                      <button type="button" class="btn-node-purity ${n.purityKey === 'pure' ? 'active' : ''}" data-raw="${raw.rawId}" data-index="${idx}" data-purity="pure" title="Mena Pura (2.0x velocidad)">Puro</button>
                    </div>
                  </div>

                  <!-- Selector de Minero de este taladro (solo para minerales sólidos) -->
                  ${!raw.isFluid ? `
                    <div class="drill-control-group">
                      <span class="drill-sublabel">Nivel:</span>
                      <div class="raw-miner-group-sm">
                        <button type="button" class="btn-node-miner ${n.minerKey === 'miner_mk1' ? 'active' : ''}" data-raw="${raw.rawId}" data-index="${idx}" data-miner="miner_mk1">Mk.1</button>
                        <button type="button" class="btn-node-miner ${n.minerKey === 'miner_mk2' ? 'active' : ''}" data-raw="${raw.rawId}" data-index="${idx}" data-miner="miner_mk2">Mk.2</button>
                        <button type="button" class="btn-node-miner ${n.minerKey === 'miner_mk3' ? 'active' : ''}" data-raw="${raw.rawId}" data-index="${idx}" data-miner="miner_mk3">Mk.3</button>
                      </div>
                    </div>
                  ` : ''}
                </div>
              </div>
            `;
          }).join('');

          cardsHtml += `
            <div class="raw-resource-card">
              <div class="raw-card-header">
                <div style="display: flex; align-items: center; gap: 8px;">
                  ${getItemIcon(raw.rawId, 28)}
                  <div>
                    <div style="font-weight: 800; font-size: 0.92rem; color: #f8fafc;">${raw.name}</div>
                    <div style="font-size: 0.72rem; color: var(--text-muted);">${raw.category || 'Materia Prima'}</div>
                  </div>
                </div>
                <div style="text-align: right;">
                  <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">Requerido</div>
                  <span style="font-size: 1.15rem; font-weight: 800; color: #38bdf8;">${raw.requiredRate}</span>
                  <span style="font-size: 0.72rem; color: var(--text-muted);">${raw.isFluid ? 'm³/min' : '/min'}</span>
                </div>
              </div>

              <!-- Supply & Capacity Balance Pill -->
              <div>
                ${raw.isCovered ? `
                  <div class="raw-balance-pill covered">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <span>✅ <strong>Abastecido:</strong> ${raw.totalCapacity} /min extraídos</span>
                      <span style="color: #4ade80; font-size: 0.72rem; font-weight: 800;">(Sobra +${raw.balance}/m)</span>
                    </div>
                    <div style="font-size: 0.69rem; color: #cbd5e1; margin-top: 2px;">
                      💡 Reloj sugerido: <strong>${raw.optimalClock}%</strong> promedio para gasto exacto.
                    </div>
                  </div>
                ` : `
                  <div class="raw-balance-pill deficit">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <span>⚠️ <strong>Déficit:</strong> ${raw.totalCapacity} /min extraídos</span>
                      <span style="color: #ef4444; font-weight: 800; font-size: 0.72rem;">(Faltan ${Math.abs(raw.balance)}/m)</span>
                    </div>
                    <div style="font-size: 0.69rem; color: #fca5a5; margin-top: 2px;">
                      ${raw.requiredOverclock <= 250 
                        ? `Añade otro taladro (+) o sube reloj al <strong>${raw.requiredOverclock}%</strong> con Fragmentos.` 
                        : `Faltan taladros. Añade taladros con el botón (+) o mejora a Mk.2 / Mk.3.`}
                    </div>
                  </div>
                `}
              </div>

              <!-- Lista de Taladros asignados con control individual -->
              <div style="margin-top: 4px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                  <span style="font-size: 0.72rem; color: #38bdf8; font-weight: 800; text-transform: uppercase;">
                    ⛏️ Taladros / Menas asignadas (${nodes.length}):
                  </span>
                  <button type="button" class="btn-node-auto" data-raw="${raw.rawId}" data-minnodes="${raw.minWholeNodes}">
                    Auto (${raw.minWholeNodes} ${raw.minWholeNodes === 1 ? 'taladro' : 'taladros'})
                  </button>
                </div>

                <div class="raw-drills-list">
                  ${drillsListHtml}
                </div>

                <button type="button" class="btn-add-drill" data-raw="${raw.rawId}">
                  <span>+ Añadir otro Taladro a este mineral</span>
                </button>
              </div>

              <!-- Node & Belt info -->
              <div style="margin-top: 6px; padding: 6px 8px; background: rgba(0,0,0,0.25); border-radius: 4px; font-size: 0.74rem; color: #cbd5e1; display: flex; justify-content: space-between; align-items: center;">
                <span>Cinta troncal requerida:</span>
                <strong style="color: ${belt.color}; font-size: 0.72rem;">${belt.name} (${belt.speed || belt.flow}/m)</strong>
              </div>

              <!-- Button to adapt entire factory to this mineral's extraction rate -->
              <button type="button" class="btn-sync-factory-to-drill" data-raw="${raw.rawId}" data-capacity="${raw.totalCapacity}" data-nodes="${raw.userNodeCount}">
                ⚡ Adaptar Fábrica a estos Taladros (${raw.totalCapacity}/m extraídos)
              </button>
            </div>
          `;
        });
        rawContainer.innerHTML = cardsHtml;
      }
    }

    // 2.5. Render Recipe Preferences Box (Base vs Alternativas MAM)
    renderRecipePreferencesBox(plan.targetItemId);

    // 3. Render Pipeline Phases into #builderDynamicPhasesContainer
    const pipelineContainer = document.getElementById('builderDynamicPhasesContainer');
    if (pipelineContainer) {
      let pipeHtml = '';

      // --- ETAPA 1: Nodos y Extracción en el Terreno ---
      if (plan.rawBreakdown.length > 0) {
        let minersListHtml = '';
        plan.rawBreakdown.forEach(raw => {
          const drillSubList = (raw.nodes || []).map(n => `
            <div style="font-size: 0.72rem; color: #cbd5e1; display: flex; align-items: center; justify-content: space-between; padding: 3px 8px; background: rgba(0,0,0,0.25); border-radius: 4px; border-left: 2px solid ${n.purityColor};">
              <span>⛏️ <strong>Taladro #${n.nodeIndex}:</strong> Mena ${n.purityName} (${n.minerName})</span>
              <span style="color: #4ade80; font-weight: 700;">+${n.outputRate}/m <span style="color: ${n.belt.color}; font-size: 0.68rem;">(${n.belt.name})</span></span>
            </div>
          `).join('');

          minersListHtml += `
            <div style="display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; background: rgba(15, 23, 42, 0.6); border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.04);">
              <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                  ${getItemIcon(raw.rawId, 26)}
                  <div>
                    <strong style="color: #f1f5f9; font-size: 0.9rem;">${raw.nodes ? raw.nodes.length : raw.userNodeCount}x Taladros &bull; ${raw.name}</strong>
                    <div style="font-size: 0.73rem; color: var(--text-muted);">
                      Extracción total: <span style="color: #4ade80; font-weight: 800;">${raw.totalCapacity} ${raw.isFluid ? 'm³/m' : '/min'}</span> &bull; Necesario: ${raw.requiredRate}/m
                    </div>
                  </div>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span class="badge" style="background: rgba(255,255,255,0.06); color: ${raw.beltNeeded.color}; border: 1px solid ${raw.beltNeeded.color}; font-size: 0.72rem; padding: 2px 8px;">
                    Troncal: ${raw.beltNeeded.name}
                  </span>
                </div>
              </div>
              <div style="display: flex; flex-direction: column; gap: 3px; margin-top: 4px;">
                ${drillSubList}
              </div>
            </div>
          `;
        });

        pipeHtml += `
          <div class="phase-card">
            <div class="phase-header">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span class="phase-number" style="background: #0284c7; color: white;">1</span>
                <div>
                  <div class="phase-title" style="color: #38bdf8;">ETAPA 1: Extracción en el Terreno (Nodos y Mineros)</div>
                  <div class="phase-subtitle">Coloca estos mineros sobre los yacimientos y lleva las cintas transportadoras a tu fábrica</div>
                </div>
              </div>
              <span class="badge" style="background: rgba(250, 204, 21, 0.15); color: #facc15; border: 1px solid rgba(250, 204, 21, 0.3); font-weight: 800;">
                ⚡ ${plan.totalMinerPower} MW
              </span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 10px;">
              ${minersListHtml}
            </div>
          </div>
        `;

        // Arrow connector
        pipeHtml += `
          <div class="diagram-connector">
            <div class="connector-arrow">
              <span style="font-size: 1.1rem; line-height: 1;">⬇️</span>
              <span class="connector-label">Transportar minerales crudos a las líneas de producción</span>
            </div>
          </div>
        `;
      }

      // --- ETAPAS 2+: Fases de Procesamiento Secuenciales ---
      plan.stages.forEach((stage, sIdx) => {
        let stepsHtml = '';

        stage.steps.forEach(step => {
          const outMeta = SATIS_DATA.items[step.itemId] || { name: step.itemId };
          const outRateTotal = Number((step.recipe.outputs[0].rate * step.machinesCount).toFixed(2));

          // Input Badges
          let inputsBadges = '';
          step.inputs.forEach(inp => {
            const inMeta = SATIS_DATA.items[inp.item] || SATIS_DATA.rawResources[inp.item] || { name: inp.item };
            const inRate = Number((inp.totalRate || inp.rateTotal || 0).toFixed(2));
            const inBelt = inp.belt || (inMeta.isFluid ? SatisCalc.getPipeForRate(inRate) : SatisCalc.getBeltForRate(inRate));
            inputsBadges += `
              <div style="display: inline-flex; align-items: center; gap: 6px; background: #0b1120; padding: 4px 8px; border-radius: 4px; border: 1px solid rgba(255, 255, 255, 0.08); font-size: 0.74rem;">
                ${getItemIcon(inp.item, 18)}
                <span>${inRate}/min ${inMeta.name}</span>
                <span style="color: ${inBelt.color}; font-weight: 700; font-size: 0.7rem;">(${inBelt.name})</span>
              </div>
            `;
          });

          // Machine detail text (clocking)
          let clockDetail = `${step.machinesCount}x`;
          if (step.remainderClock > 0 && step.wholeMachines >= 1) {
            clockDetail = `${step.wholeMachines}x al 100% + 1x al ${step.remainderClock}%`;
          }

          // Manifold schematic
          let manifoldHtml = '';
          if (step.machinesCount > 1 && step.manifold && step.manifold.length > 0) {
            const firstInpMeta = SATIS_DATA.items[step.recipe.inputs[0]?.item] || SATIS_DATA.rawResources[step.recipe.inputs[0]?.item] || { name: 'Insumo' };
            manifoldHtml = renderManifoldDiagram(
              step.manifold,
              step.building.name,
              firstInpMeta.name,
              outMeta.name,
              step.recipe.outputs[0].rate
            );
          }

          stepsHtml += `
            <div style="background: rgba(15, 23, 42, 0.5); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 8px; padding: 12px; margin-bottom: 10px;">
              <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 8px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                  ${getBuildingIcon(step.building.id, 28)}
                  <div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <strong style="color: #ffffff; font-size: 0.95rem;">${step.machinesCount}x ${step.building.name}</strong>
                      <span class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); font-size: 0.72rem; padding: 2px 6px;">
                        ${clockDetail}
                      </span>
                    </div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                      <span>Receta: <strong style="color: #f1f5f9;">${step.recipe.name}</strong></span>
                      ${step.recipe.isAlt 
                        ? `<span class="recipe-badge-tag tag-alt" style="font-size: 0.65rem;">⚡ Alt (MAM)</span>` 
                        : `<span class="recipe-badge-tag tag-base" style="font-size: 0.65rem;">⭐ Base Oficial</span>`}
                    </div>
                  </div>
                </div>

                <div style="display: flex; align-items: center; gap: 12px;">
                  <div style="display: flex; align-items: center; gap: 6px; background: rgba(74, 222, 128, 0.1); border: 1px solid rgba(74, 222, 128, 0.3); padding: 4px 10px; border-radius: 6px;">
                    ${getItemIcon(step.itemId, 20)}
                    <span style="color: #4ade80; font-weight: 800; font-size: 0.9rem;">+${outRateTotal}/min ${outMeta.name}</span>
                  </div>
                  <span class="badge" style="background: rgba(250, 204, 21, 0.1); color: #facc15; border: 1px solid rgba(250, 204, 21, 0.2); font-weight: 700; font-size: 0.74rem;">
                    ⚡ ${step.totalPower} MW
                  </span>
                </div>
              </div>

              <!-- Inputs row -->
              <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 8px;">
                <span style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700; margin-right: 4px;">Insumos requeridos:</span>
                ${inputsBadges}
              </div>

              <!-- Manifold visual breakdown -->
              ${manifoldHtml}
            </div>
          `;
        });

        pipeHtml += `
          <div class="phase-card">
            <div class="phase-header">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span class="phase-number">${stage.stageIndex}</span>
                <div>
                  <div class="phase-title">${stage.title}</div>
                  <div class="phase-subtitle">${stage.isFinal ? 'Último eslabón de ensamblado' : 'Procesamiento y ensamblado intermedio'}</div>
                </div>
              </div>
              <span class="badge" style="background: rgba(250, 204, 21, 0.15); color: #facc15; border: 1px solid rgba(250, 204, 21, 0.3); font-weight: 800;">
                ⚡ ${stage.stagePower} MW
              </span>
            </div>
            <div style="margin-top: 12px;">
              ${stepsHtml}
            </div>
          </div>
        `;

        if (sIdx < plan.stages.length - 1) {
          pipeHtml += `
            <div class="diagram-connector">
              <div class="connector-arrow">
                <span style="font-size: 1.1rem; line-height: 1;">⬇️</span>
                <span class="connector-label">Alimentar insumos hacia la siguiente etapa de manufactura</span>
              </div>
            </div>
          `;
        }
      });

      // --- ETAPA FINAL / CELEBRACIÓN DE META CUMPLIDA ---
      const finalBelt = SatisCalc.getBeltForRate(plan.targetRate);
      pipeHtml += `
        <div class="diagram-connector">
          <div class="connector-arrow">
            <span style="font-size: 1.1rem; line-height: 1;">⬇️</span>
            <span class="connector-label">Salida a Contenedores o Ascensor Espacial</span>
          </div>
        </div>

        <div class="phase-card optimal" style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(15, 23, 42, 0.95) 100%); border-color: rgba(74, 222, 128, 0.4); box-shadow: 0 4px 20px rgba(74, 222, 128, 0.1);">
          <div class="phase-header" style="border-bottom: 1px solid rgba(74, 222, 128, 0.2); padding-bottom: 12px; margin-bottom: 12px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              ${getItemIcon(plan.targetItemId, 36)}
              <div>
                <div class="phase-title" style="color: #4ade80; font-size: 1.15rem;">
                  🎉 PRODUCCIÓN FINAL: ${targetMeta.name}
                </div>
                <div class="phase-subtitle" style="color: #94a3b8;">
                  Cadena 100% calculada y balanceada para tu objetivo
                </div>
              </div>
            </div>
            <span class="badge" style="background: #4ade80; color: #0f172a; font-weight: 900; font-size: 1.1rem; padding: 4px 12px;">
              ${plan.targetRate} /min
            </span>
          </div>
          <div style="font-size: 0.88rem; color: var(--text-main); line-height: 1.6;">
            • Tu fábrica producirá exactamente <strong style="color: #4ade80; font-size: 1.15rem;">${plan.targetRate} ${targetMeta.name} / min</strong> de forma continua.<br>
            • Cinta recomendada de salida al almacén: <strong style="color: ${finalBelt.color};">${finalBelt.name} (${finalBelt.speed}/m)</strong>.<br>
            • <strong>Consumo eléctrico total de toda la fábrica:</strong> <span style="color: #facc15; font-weight: 800; font-size: 1.05rem;">⚡ ${plan.totalEnergyMw} MW</span>.<br>
            • <strong>Aprovechamiento FICSIT:</strong> 100% de saturación perfecta sin cuellos de botella ni desperdicio de minerales.
          </div>
        </div>
      `;

      pipelineContainer.innerHTML = pipeHtml;
    }

    // 4. Update Energy Performance Management & Right Column
    const powerMode = state.builder.powerMode || 'eco';
    const energyOpt = SatisCalc.calculateEnergyOptimization(plan, powerMode);

    // Sync active mode buttons
    const btnPwrEco = document.getElementById('btnPowerEco');
    const btnPwrStd = document.getElementById('btnPowerStandard');
    const btnPwrCmp = document.getElementById('btnPowerCompact');
    if (btnPwrEco) btnPwrEco.classList.toggle('active', powerMode === 'eco');
    if (btnPwrStd) btnPwrStd.classList.toggle('active', powerMode === 'standard');
    if (btnPwrCmp) btnPwrCmp.classList.toggle('active', powerMode === 'compact');

    const mwEl = document.getElementById('builderTotalMw');
    if (mwEl) mwEl.textContent = `${energyOpt.activeMw} MW`;

    const activeMwEl = document.getElementById('energyActiveMw');
    if (activeMwEl) activeMwEl.textContent = `${energyOpt.activeMw} MW`;

    const effBadge = document.getElementById('energyEfficiencyBadge');
    if (effBadge) {
      if (powerMode === 'eco') {
        effBadge.style.background = 'rgba(74, 222, 128, 0.15)';
        effBadge.style.color = '#4ade80';
        effBadge.style.borderColor = '#4ade80';
        effBadge.textContent = `AHORRO -${energyOpt.savingsMw} MW (-${energyOpt.savingsPercent}%)`;
      } else if (powerMode === 'compact') {
        effBadge.style.background = 'rgba(239, 68, 68, 0.15)';
        effBadge.style.color = '#f87171';
        effBadge.style.borderColor = '#ef4444';
        effBadge.textContent = `OVERCLOCK 200% (💎 ${energyOpt.shardsRequired} SHARDS)`;
      } else {
        effBadge.style.background = 'rgba(250, 204, 21, 0.15)';
        effBadge.style.color = '#facc15';
        effBadge.style.borderColor = '#facc15';
        effBadge.textContent = `ESTÁNDAR 100% NOMINAL`;
      }
    }

    const savingsLabel = document.getElementById('energySavingsLabel');
    const savingsVal = document.getElementById('energySavingsVal');
    if (savingsLabel && savingsVal) {
      if (powerMode === 'eco') {
        savingsLabel.textContent = 'Ahorro vs Estándar';
        savingsVal.textContent = `-${energyOpt.savingsMw} MW (-${energyOpt.savingsPercent}%)`;
        savingsVal.style.color = '#4ade80';
      } else if (powerMode === 'compact') {
        savingsLabel.textContent = 'Consumo Extra';
        savingsVal.textContent = `+${Number((energyOpt.compactMw - energyOpt.standardMw).toFixed(1))} MW`;
        savingsVal.style.color = '#f87171';
      } else {
        savingsLabel.textContent = 'Referencia Base';
        savingsVal.textContent = `${energyOpt.standardMw} MW`;
        savingsVal.style.color = '#facc15';
      }
    }

    const machinesBadge = document.getElementById('energyMachinesCountBadge');
    if (machinesBadge) {
      const totalM = (powerMode === 'eco') ? energyOpt.ecoMachinesTotal 
                   : (powerMode === 'compact') ? energyOpt.compactMachinesTotal 
                   : energyOpt.standardMachinesTotal;
      machinesBadge.textContent = `${totalM} máquinas fabriles`;
    }

    // Segmented power breakdown bar
    const totMw = Math.max(1, energyOpt.activeMw);
    const bd = energyOpt.breakdown;
    const pMiners = document.getElementById('pbarMiners');
    const pSmelters = document.getElementById('pbarSmelters');
    const pConstructors = document.getElementById('pbarConstructors');
    const pAssemblers = document.getElementById('pbarAssemblers');
    const pOthers = document.getElementById('pbarOthers');

    if (pMiners) pMiners.style.width = `${(bd.minersMw / totMw) * 100}%`;
    if (pSmelters) pSmelters.style.width = `${(bd.smeltersMw / totMw) * 100}%`;
    if (pConstructors) pConstructors.style.width = `${(bd.constructorsMw / totMw) * 100}%`;
    if (pAssemblers) pAssemblers.style.width = `${(bd.assemblersMw / totMw) * 100}%`;
    if (pOthers) pOthers.style.width = `${(bd.othersMw / totMw) * 100}%`;

    // Breakdown detail list
    const bdList = document.getElementById('energyBreakdownList');
    if (bdList) {
      bdList.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span>⛏️ Mineros y Extracción:</span><strong style="color: #3b82f6;">${bd.minersMw} MW</strong>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span>🔥 Fundiciones / Hornos:</span><strong style="color: #f97316;">${bd.smeltersMw} MW</strong>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span>⚙️ Constructoras:</span><strong style="color: #38bdf8;">${bd.constructorsMw} MW</strong>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span>🔧 Ensambladoras:</span><strong style="color: #a855f7;">${bd.assemblersMw} MW</strong>
        </div>
        ${bd.othersMw > 0 ? `
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span>🏭 Otras Máquinas:</span><strong style="color: #ec4899;">${bd.othersMw} MW</strong>
          </div>
        ` : ''}
      `;
    }

    // Recommended power generators & batteries
    const genList = document.getElementById('energyGeneratorsList');
    if (genList && energyOpt.recommendedGenerators) {
      let gHtml = '';
      energyOpt.recommendedGenerators.forEach(gen => {
        let details = '';
        if (gen.waterRate > 0) {
          details = `• Consumo: <strong>${gen.fuelRate}/m ${gen.fuelItem}</strong> + <strong>${gen.waterRate} m³/m Agua</strong> (${gen.waterExtractors}x Extractores)`;
        } else {
          details = `• Consumo: <strong>${gen.fuelRate}/m ${gen.fuelItem}</strong>`;
        }
        gHtml += `
          <div class="gen-card-item">
            <div>
              <div style="font-weight: 800; color: #f1f5f9; display: flex; align-items: center; gap: 6px;">
                <span>${gen.icon}</span>
                <span>${gen.count}x ${gen.name}</span>
                <span class="badge" style="font-size: 0.65rem; background: rgba(250, 204, 21, 0.15); color: #facc15; padding: 1px 6px;">${gen.totalMw} MW</span>
              </div>
              <div style="font-size: 0.68rem; color: #94a3b8; margin-top: 2px;">
                ${details}
              </div>
            </div>
            <span style="font-size: 0.68rem; color: #38bdf8; font-weight: 700; white-space: nowrap;">${gen.tag}</span>
          </div>
        `;
      });
      gHtml += `
        <div class="gen-card-item" style="border-color: rgba(56, 189, 248, 0.25);">
          <div>
            <div style="font-weight: 800; color: #38bdf8; display: flex; align-items: center; gap: 6px;">
              <span>🔋</span>
              <span>${energyOpt.recommendedStorage}x Almacenamiento Eléctrico</span>
              <span class="badge" style="font-size: 0.65rem; background: rgba(56, 189, 248, 0.15); color: #38bdf8; padding: 1px 6px;">${energyOpt.recommendedStorage * 100} MWh</span>
            </div>
            <div style="font-size: 0.68rem; color: #94a3b8; margin-top: 2px;">
              • Baterías FICSIT para absorber picos y estabilizar la red
            </div>
          </div>
        </div>
      `;
      genList.innerHTML = gHtml;
    }

    const effEl = document.getElementById('builderEfficiencyVal');
    if (effEl) effEl.textContent = `100%`;

    const bChips = document.getElementById('builderBuildingChips');
    if (bChips) {
      const chipsArr = [];
      for (const [bName, count] of Object.entries(plan.buildingCounts)) {
        const bObj = Object.values(SATIS_DATA.buildings).find(b => b.name === bName) || 
                      Object.values(SATIS_DATA.miners).find(m => m.name === bName);
        const bIcon = bObj ? getBuildingIcon(bObj.id, 20) : '🏭';
        chipsArr.push(`
          <div class="diagram-branch optimal" style="padding: 6px 10px; display: flex; align-items: center; gap: 8px;">
            ${bIcon}
            <span>• <strong>${count}x</strong> ${bName}</span>
          </div>
        `);
      }

      // Calculate total splitters
      let totalSplitters = 0;
      plan.consolidatedSteps.forEach(s => {
        if (s.machinesCount > 1 && s.manifold) {
          totalSplitters += (s.manifold.length - 1);
        }
      });
      if (totalSplitters > 0) {
        chipsArr.push(`
          <div class="diagram-branch" style="border-left-color: #f59e0b; padding: 6px 10px;">
            <span>• <strong>${totalSplitters}x</strong> Divisores (Splitters)</span>
          </div>
        `);
      }

      bChips.innerHTML = chipsArr.join('');
    }

    // Belts summary in Right Column
    const beltsBox = document.getElementById('builderBeltsLogistics');
    if (beltsBox) {
      let beltsSummary = '';
      if (plan.rawBreakdown.length > 0) {
        beltsSummary += `• <strong>Materias primas de entrada:</strong><br>`;
        plan.rawBreakdown.forEach(raw => {
          beltsSummary += `&nbsp;&nbsp;- ${raw.name}: ${raw.userNodeCount}x ${raw.minerName} (${raw.purityName}) ➔ Troncal: ${raw.beltNeeded.name} (${raw.totalCapacity}/m extraídos)<br>`;
        });
      }
      const finalBelt = SatisCalc.getBeltForRate(plan.targetRate);
      beltsSummary += `• <strong>Línea final a almacenamiento:</strong> ${finalBelt.name} (${plan.targetRate}/m)<br>`;
      beltsSummary += `• <em>Balance FICSIT automático sin cuellos de botella.</em>`;
      beltsBox.innerHTML = beltsSummary;
    }

    // Render 2D Aerial Factory Blueprint
    renderFactoryBlueprint(plan);
    } catch (err) {
      console.error('Error in updateLineBuilder:', err);
      document.body.setAttribute('data-app-error', `${err.message} :: ${err.stack}`);
    }
  }

  function renderRecipePreferencesBox(targetGoal) {
    const altBox = document.getElementById('builderAltOptionsBox');
    if (!altBox) return;

    const options = SatisCalc.getRecipeOptionsForChain(targetGoal, state.builder.altPreferences);

    if (!options || options.length === 0) {
      altBox.style.display = 'block';
      altBox.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 1.1rem;">📋</span>
            <span style="font-size: 0.8rem; color: #cbd5e1;">
              <strong>Recetas de Fabricación:</strong> Esta línea de producción utiliza exclusivamente <strong>Recetas Base oficiales</strong> (sin discos duros ni MAM).
            </span>
          </div>
          <span class="badge" style="background: rgba(74, 222, 128, 0.15); color: #4ade80; border: 1px solid #4ade80; font-size: 0.72rem; padding: 2px 8px; font-weight: 700;">
            ⭐ 100% Recetas Base
          </span>
        </div>
      `;
      return;
    }

    altBox.style.display = 'block';

    const activeAltsCount = options.filter(opt => opt.isUsingAlt).length;

    let itemsHtml = options.map(opt => {
      const isBaseActive = !opt.isUsingAlt;
      return `
        <div class="recipe-choice-card">
          <div class="recipe-choice-header">
            <div style="display: flex; align-items: center; gap: 8px;">
              ${getItemIcon(opt.itemId, 22)}
              <strong style="color: #f1f5f9; font-size: 0.86rem;">${opt.itemName}</strong>
            </div>
            <span class="recipe-choice-status ${opt.isUsingAlt ? 'status-alt' : 'status-base'}">
              ${opt.isUsingAlt ? '⚡ Alternativa Activa (MAM)' : '⭐ Receta Base Activa'}
            </span>
          </div>

          <div class="recipe-choice-buttons">
            <!-- Receta Base Oficial -->
            <button type="button" class="btn-recipe-choice ${isBaseActive ? 'active-base' : ''}" data-item="${opt.itemId}" data-recipe="${opt.standardRecipe.id}" title="${opt.standardRecipe.summary}">
              <div class="recipe-btn-top">
                <span class="recipe-badge-tag tag-base">⭐ BASE OFICIAL</span>
                <span class="recipe-name-text">${opt.standardRecipe.name}</span>
              </div>
              <div class="recipe-btn-desc">${opt.standardRecipe.summary}</div>
            </button>

            <!-- Recetas Alternativas -->
            ${opt.altRecipes.map(alt => {
              const isThisAltActive = (opt.activeRecipeId === alt.id);
              return `
                <button type="button" class="btn-recipe-choice ${isThisAltActive ? 'active-alt' : ''}" data-item="${opt.itemId}" data-recipe="${alt.id}" title="${alt.summary}">
                  <div class="recipe-btn-top">
                    <span class="recipe-badge-tag tag-alt">⚡ ALT (MAM)</span>
                    <span class="recipe-name-text">${alt.name}</span>
                  </div>
                  <div class="recipe-btn-desc">${alt.summary}</div>
                </button>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }).join('');

    altBox.innerHTML = `
      <div class="recipe-pref-header">
        <div>
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span style="font-size: 1.1rem;">📋</span>
            <h3 style="margin: 0; font-size: 0.92rem; font-weight: 800; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.5px;">
              Recetas de Fabricación (Base vs Alternativas MAM)
            </h3>
            ${activeAltsCount > 0 
              ? `<span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid #f59e0b; font-size: 0.72rem; padding: 2px 8px; font-weight: 700;">⚡ ${activeAltsCount} Alternativas en uso</span>`
              : `<span class="badge" style="background: rgba(74, 222, 128, 0.15); color: #4ade80; border: 1px solid #4ade80; font-size: 0.72rem; padding: 2px 8px; font-weight: 700;">⭐ 100% Recetas Base (Sin MAM)</span>`
            }
          </div>
          <div style="font-size: 0.74rem; color: #cbd5e1; margin-top: 4px; line-height: 1.4;">
            Por defecto todas las máquinas usan las <strong>Recetas Base (Estándar)</strong> del juego. Si tienes discos duros desbloqueados en el MAM, puedes activar aquí tus recetas alternativas para optimizar tu producción:
          </div>
        </div>

        <button type="button" class="btn-reset-base" id="btnResetAllBaseRecipes" title="Restablecer todos los materiales a sus recetas base oficiales">
          ⭐ Restablecer Todas a Recetas Base
        </button>
      </div>

      <div class="recipe-choices-grid" style="margin-top: 12px;">
        ${itemsHtml}
      </div>
    `;

    // Event listeners
    const resetBtn = altBox.querySelector('#btnResetAllBaseRecipes');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        state.builder.altPreferences = {};
        if (state.builder.calcMode === 'drills') {
          syncTargetRateFromDrills();
        }
        updateLineBuilder();
      });
    }

    altBox.querySelectorAll('.btn-recipe-choice').forEach(btn => {
      btn.addEventListener('click', () => {
        const itemId = btn.getAttribute('data-item');
        const recipeId = btn.getAttribute('data-recipe');
        const opt = options.find(o => o.itemId === itemId);
        if (!opt) return;

        state.builder.altPreferences = state.builder.altPreferences || {};
        if (recipeId === opt.standardRecipe.id) {
          delete state.builder.altPreferences[itemId];
        } else {
          state.builder.altPreferences[itemId] = recipeId;
        }

        if (state.builder.calcMode === 'drills') {
          syncTargetRateFromDrills();
        }
        updateLineBuilder();
      });
    });
  }

  // =========================================================================
  // 1.7. MODAL DE CATÁLOGO FICSIT DE PRODUCTOS Y RECETAS
  // =========================================================================
  function getItemIcon(itemId, size = 28, className = 'ficsit-item-icon') {
    if (!itemId) return '📦';
    const s = size ? `width: ${size}px; height: ${size}px;` : '';
    return `<img src="images/items/${itemId}.png" alt="${itemId}" class="${className}" style="${s} object-fit: contain; vertical-align: middle; display: inline-block; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.6));" onerror="this.onerror=null; this.outerHTML='📦';">`;
  }

  function getBuildingIcon(buildingId, size = 20, className = 'ficsit-bldg-icon') {
    if (!buildingId) return '🏭';
    const s = size ? `width: ${size}px; height: ${size}px;` : '';
    return `<img src="images/buildings/${buildingId}.png" alt="${buildingId}" class="${className}" style="${s} object-fit: contain; vertical-align: middle; display: inline-block; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));" onerror="this.onerror=null; this.outerHTML='🏭';">`;
  }

  // =========================================================================
  // 1.8. MOTOR DE PLANO DE PLANTA AÉREA EN 2D (FICSIT 2D BLUEPRINT ENGINE)
  // =========================================================================
  function generateBlueprintSvg(plan) {
    if (!plan || !plan.stages || plan.stages.length === 0) {
      return {
        svg: `<div style="padding: 40px; text-align: center; color: var(--text-muted); font-size: 0.9rem;">Selecciona una meta para generar el plano de planta 2D.</div>`,
        model: null
      };
    }

    const GRID_SIZE = 80; // 80px = 1 Cimiento estándar de 8m x 8m en Satisfactory

    function getMachineDims(bldgId) {
      if (bldgId === 'smelter') return { w: 105, h: 60 };
      if (bldgId === 'constructor') return { w: 115, h: 64 };
      if (bldgId === 'assembler') return { w: 135, h: 74 };
      if (bldgId === 'manufacturer') return { w: 160, h: 86 };
      if (bldgId === 'refinery') return { w: 140, h: 78 };
      return { w: 115, h: 64 };
    }

    // 1. Puntos de Entrada Exterior (Mineral crudo sin los taladros)
    const intakePorts = (plan.rawBreakdown || []).map((raw, idx) => ({
      id: raw.rawId,
      name: raw.name,
      rate: raw.requiredRate,
      isFluid: raw.isFluid,
      belt: raw.beltNeeded,
      color: raw.beltNeeded.color,
      width: 125,
      height: 44,
      x: 25,
      y: 45 + idx * 56
    }));

    const intakeTotalH = intakePorts.length * 56 + 30;

    // 2. Fases de Procesamiento y Ensamblaje
    const machines = [];
    const splitters = [];
    const mergers = [];
    const belts = [];
    const stageHeaders = [];
    const itemOutputPoints = {};
    let beltCounter = 0;

    intakePorts.forEach(inp => {
      itemOutputPoints[inp.id] = {
        id: `inp_${inp.id}`,
        x: inp.x + inp.width,
        y: inp.y + inp.height / 2,
        belt: inp.belt,
        rate: inp.rate,
        name: inp.name,
        itemId: inp.id
      };
    });

    let currentX = 25 + (intakePorts.length > 0 ? 125 + 32 : 0);

    plan.stages.forEach((stage, sIdx) => {
      const stageSteps = stage.steps.map(step => {
        const bldgId = step.building?.id || step.recipe?.building || 'constructor';
        const { w: mWidth, h: mHeight } = getMachineDims(bldgId);
        const count = Math.max(1, Math.ceil(step.machinesCount));
        return { step, bldgId, mWidth, mHeight, count };
      });

      // Si la fase tiene más de 2 recetas, organizarlas en sub-columnas para evitar torres verticales
      const subColumns = [];
      if (stageSteps.length > 2) {
        const half = Math.ceil(stageSteps.length / 2);
        subColumns.push(stageSteps.slice(0, half));
        subColumns.push(stageSteps.slice(half));
      } else {
        subColumns.push(stageSteps);
      }

      const stageStartX = currentX;
      let stageMaxRight = currentX;

      subColumns.forEach((colSteps) => {
        const colStartX = currentX;
        const maxMWidth = Math.max(...colSteps.map(s => s.mWidth));
        const mX = colStartX + 26; // Espacio a la izquierda para splitters
        let stepY = 48;

        colSteps.forEach((stepData) => {
          const step = stepData.step;
          const bldg = step.building || { name: 'Máquina', power: 4 };
          const mWidth = stepData.mWidth;
          const mHeight = stepData.mHeight;
          const count = stepData.count;

          const stepMachines = [];
          const stepSplitters = [];
          const stepMergers = [];

          for (let k = 0; k < count; k++) {
            const mY = stepY + k * (mHeight + 10);
            let clock = 100;
            if (k >= step.wholeMachines && step.remainderClock) {
              clock = step.remainderClock;
            }
            const mw = Number(((bldg.power || 4) * (clock / 100)).toFixed(1));

            const mObj = {
              id: `m_${step.itemId}_${k}`,
              name: `${bldg.name} #${k + 1}`,
              bldg,
              bldgId: stepData.bldgId,
              recipe: step.recipe,
              itemId: step.itemId,
              x: mX,
              y: mY,
              width: mWidth,
              height: mHeight,
              clock,
              mw,
              inputRate: step.inputs[0]?.rate || 30,
              outputRate: step.recipe.outputs[0]?.rate || 20
            };
            machines.push(mObj);
            stepMachines.push(mObj);

            // Splitters (si hay > 1 máquina en este paso)
            if (count > 1) {
              const sX = mX - 24;
              const sY = mY + mHeight / 2 - 9;
              const sObj = { id: `sp_${step.itemId}_${k}`, x: sX, y: sY, width: 18, height: 18, index: k + 1 };
              splitters.push(sObj);
              stepSplitters.push(sObj);

              belts.push({
                id: `belt_feed_sp_${step.itemId}_${k}`,
                fromId: sObj.id,
                toId: mObj.id,
                itemId: step.inputs[0]?.item,
                itemName: SATIS_DATA.items[step.inputs[0]?.item]?.name || step.inputs[0]?.item,
                fromName: `Divisor #${k + 1}`,
                toName: mObj.name,
                x1: sX + 18, y1: sY + 9,
                x2: mX, y2: mY + mHeight / 2,
                color: step.inBelt.color,
                rate: mObj.inputRate,
                isFeeder: true
              });
            }

            // Mergers (si hay > 1 máquina en este paso)
            if (count > 1) {
              const mgX = mX + mWidth + 6;
              const mgY = mY + mHeight / 2 - 9;
              const mgObj = { id: `mg_${step.itemId}_${k}`, x: mgX, y: mgY, width: 18, height: 18, index: k + 1 };
              mergers.push(mgObj);
              stepMergers.push(mgObj);

              belts.push({
                id: `belt_feed_mg_${step.itemId}_${k}`,
                fromId: mObj.id,
                toId: mgObj.id,
                itemId: step.itemId,
                itemName: SATIS_DATA.items[step.itemId]?.name || step.itemId,
                fromName: mObj.name,
                toName: `Unidor #${k + 1}`,
                x1: mX + mWidth, y1: mY + mHeight / 2,
                x2: mgX, y2: mgY + 9,
                color: step.outBelt.color,
                rate: mObj.outputRate,
                isFeeder: true
              });
            }
          }

          // Cintas troncales de manifold
          if (count > 1) {
            belts.push({
              id: `belt_trunk_sp_${step.itemId}`,
              fromId: stepSplitters[0].id,
              toId: stepSplitters[count - 1].id,
              itemId: step.inputs[0]?.item,
              itemName: SATIS_DATA.items[step.inputs[0]?.item]?.name || step.inputs[0]?.item,
              fromName: `Línea Troncal Divisores`,
              toName: `Fin Troncal Divisores`,
              x1: stepSplitters[0].x + 9, y1: stepSplitters[0].y + 9,
              x2: stepSplitters[count - 1].x + 9, y2: stepSplitters[count - 1].y + 9,
              color: step.inBelt.color,
              rate: step.inputs[0]?.rateTotal || step.neededRate,
              isTrunk: true
            });

            belts.push({
              id: `belt_trunk_mg_${step.itemId}`,
              fromId: stepMergers[0].id,
              toId: stepMergers[count - 1].id,
              itemId: step.itemId,
              itemName: SATIS_DATA.items[step.itemId]?.name || step.itemId,
              fromName: `Línea Troncal Unidores`,
              toName: `Fin Troncal Unidores`,
              x1: stepMergers[0].x + 9, y1: stepMergers[0].y + 9,
              x2: stepMergers[count - 1].x + 9, y2: stepMergers[count - 1].y + 9,
              color: step.outBelt.color,
              rate: step.neededRate,
              isTrunk: true
            });
          }

          // Conexión de entrada desde fases anteriores
          const entryX = count > 1 ? stepSplitters[0].x : stepMachines[0].x;
          const entryY = count > 1 ? stepSplitters[0].y + 9 : stepMachines[0].y + mHeight / 2;
          const entryId = count > 1 ? stepSplitters[0].id : stepMachines[0].id;
          const entryName = count > 1 ? `Divisor #${step.recipe.name}` : stepMachines[0].name;

          step.inputs.forEach((inp, inpIdx) => {
            const src = itemOutputPoints[inp.item];
            if (src) {
              const inBeltObj = SatisCalc.getBeltForRate(inp.rateTotal);
              beltCounter++;
              belts.push({
                id: `belt_flow_${inp.item}_to_${step.itemId}_${beltCounter}`,
                fromId: src.id,
                toId: entryId,
                itemId: inp.item,
                itemName: SATIS_DATA.items[inp.item]?.name || inp.item,
                fromName: src.name,
                toName: entryName,
                x1: src.x, y1: src.y,
                x2: entryX, y2: entryY + (inpIdx * 12),
                color: inBeltObj.color,
                rate: inp.rateTotal,
                name: SATIS_DATA.items[inp.item]?.name || inp.item
              });
            }
          });

          // Punto de salida para etapas posteriores
          const exitX = count > 1 ? stepMergers[count - 1].x + 18 : stepMachines[0].x + mWidth;
          const exitY = count > 1 ? stepMergers[count - 1].y + 9 : stepMachines[0].y + mHeight / 2;
          const exitId = count > 1 ? stepMergers[count - 1].id : stepMachines[0].id;
          const exitName = count > 1 ? `Salida Manifold ${step.recipe.name}` : stepMachines[0].name;

          itemOutputPoints[step.itemId] = {
            id: exitId,
            x: exitX, y: exitY,
            belt: step.outBelt,
            rate: step.neededRate,
            name: exitName,
            itemId: step.itemId
          };

          stepY += count * (mHeight + 10) + 14;
        });

        const subColW = maxMWidth + 50;
        stageMaxRight = Math.max(stageMaxRight, colStartX + subColW);
        currentX += subColW + 24;
      });

      // Cabecera de la fase
      const stageW = Math.max(120, stageMaxRight - stageStartX);
      stageHeaders.push({
        x: stageStartX,
        y: 12,
        width: stageW,
        text: `FASE ${stage.stageIndex}: ${stage.title.toUpperCase()}`
      });

      currentX = stageMaxRight + 32;
    });

    // 3. Contenedor de Salida Final
    const finalSrc = itemOutputPoints[plan.targetGoal];
    const finalX = currentX + 16;
    const finalY = finalSrc ? Math.max(35, finalSrc.y - 32) : 48;
    const finalW = 145;
    const finalH = 65;
    const finalBelt = plan.targetMeta.isFluid ? SatisCalc.getPipeForRate(plan.targetRate) : SatisCalc.getBeltForRate(plan.targetRate);

    const delivery = { id: 'delivery', x: finalX, y: finalY, width: finalW, height: finalH, belt: finalBelt };

    if (finalSrc) {
      belts.push({
        id: `belt_final_delivery`,
        fromId: finalSrc.id,
        toId: 'delivery',
        itemId: plan.targetGoal,
        itemName: plan.targetMeta.name,
        fromName: finalSrc.name,
        toName: 'Contenedor Salida Final FICSIT',
        x1: finalSrc.x, y1: finalSrc.y,
        x2: finalX, y2: finalY + finalH / 2,
        color: finalBelt.color,
        rate: plan.targetRate,
        name: plan.targetMeta.name,
        isFinal: true
      });
    }

    // 4. Cálculo de límites y ajuste milimétrico de cimientos (0 espacio perdido)
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    intakePorts.forEach(p => {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + p.width);
      maxY = Math.max(maxY, p.y + p.height);
    });

    machines.forEach(m => {
      minX = Math.min(minX, m.x - 24);
      minY = Math.min(minY, m.y);
      maxX = Math.max(maxX, m.x + m.width + 24);
      maxY = Math.max(maxY, m.y + m.height);
    });

    splitters.forEach(s => {
      minX = Math.min(minX, s.x);
      minY = Math.min(minY, s.y);
      maxX = Math.max(maxX, s.x + s.width);
      maxY = Math.max(maxY, s.y + s.height);
    });

    mergers.forEach(mg => {
      minX = Math.min(minX, mg.x);
      minY = Math.min(minY, mg.y);
      maxX = Math.max(maxX, mg.x + mg.width);
      maxY = Math.max(maxY, mg.y + mg.height);
    });

    if (delivery) {
      minX = Math.min(minX, delivery.x);
      minY = Math.min(minY, delivery.y);
      maxX = Math.max(maxX, delivery.x + delivery.width);
      maxY = Math.max(maxY, delivery.y + delivery.height);
    }

    if (!isFinite(minX)) minX = 20;
    if (!isFinite(minY)) minY = 20;
    if (!isFinite(maxX)) maxX = 600;
    if (!isFinite(maxY)) maxY = 350;

    const padX = 28;
    const padY = 28;
    const shiftX = padX - minX;
    const shiftY = padY - minY;

    // Trasladar todos los elementos con margen perimetral exacto
    intakePorts.forEach(p => { p.x += shiftX; p.y += shiftY; });
    machines.forEach(m => { m.x += shiftX; m.y += shiftY; });
    splitters.forEach(s => { s.x += shiftX; s.y += shiftY; });
    mergers.forEach(mg => { mg.x += shiftX; mg.y += shiftY; });
    delivery.x += shiftX;
    delivery.y += shiftY;
    belts.forEach(b => {
      b.x1 += shiftX; b.y1 += shiftY;
      b.x2 += shiftX; b.y2 += shiftY;
    });
    stageHeaders.forEach(h => { h.x += shiftX; h.y += shiftY; });

    // 5. Multi-Lane Bus Corridor Routing (Descongestión total de cintas)
    // Agrupar cintas que cruzan por el mismo corredor horizontal para darles carriles independientes
    const corridors = {};
    belts.forEach(b => {
      if (!b.isTrunk && b.x1 < b.x2 && Math.abs(b.y1 - b.y2) > 2) {
        const cKey = `${Math.round(b.x1 / 30)}_${Math.round(b.x2 / 30)}`;
        if (!corridors[cKey]) corridors[cKey] = [];
        corridors[cKey].push(b);
      }
    });

    Object.values(corridors).forEach(cBelts => {
      cBelts.sort((a, b) => (a.y2 - b.y2) || (a.y1 - b.y1));
      const N = cBelts.length;
      cBelts.forEach((b, idx) => {
        const gap = b.x2 - b.x1;
        const pad = Math.min(22, Math.max(8, gap * 0.15));
        const usable = gap - pad * 2;
        const fraction = N > 1 ? (idx + 1) / (N + 1) : 0.5;
        b.laneX = Math.round(b.x1 + pad + usable * fraction);
      });
    });

    const contentW = (maxX - minX) + padX * 2;
    const contentH = (maxY - minY) + padY * 2;
    const totalW = Math.max(480, Math.ceil(contentW / GRID_SIZE) * GRID_SIZE);
    const totalH = Math.max(320, Math.ceil(contentH / GRID_SIZE) * GRID_SIZE);
    const foundationsX = Math.round(totalW / GRID_SIZE);
    const foundationsY = Math.round(totalH / GRID_SIZE);

    const model = {
      GRID_SIZE,
      totalW,
      totalH,
      foundationsX,
      foundationsY,
      foundationsMetersW: foundationsX * 8,
      foundationsMetersH: foundationsY * 8,
      totalFoundations: foundationsX * foundationsY,
      intakePorts,
      machines,
      splitters,
      mergers,
      belts,
      delivery
    };

    // GENERAR SVG
    let svgDefs = `
      <defs>
        <pattern id="bpFoundationPattern" width="${GRID_SIZE}" height="${GRID_SIZE}" patternUnits="userSpaceOnUse">
          <rect width="${GRID_SIZE}" height="${GRID_SIZE}" fill="#070b13" stroke="#121e30" stroke-width="1.2"/>
          <rect x="2" y="2" width="${GRID_SIZE - 4}" height="${GRID_SIZE - 4}" fill="none" stroke="rgba(56, 189, 248, 0.025)" stroke-width="0.8"/>
          <circle cx="${GRID_SIZE/2}" cy="${GRID_SIZE/2}" r="1.2" fill="rgba(56, 189, 248, 0.15)"/>
          <circle cx="0" cy="0" r="1.8" fill="rgba(56, 189, 248, 0.22)"/>
        </pattern>
        <filter id="bpGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.5" result="blur"/>
          <feComposite in="SourceGraphic" in2="blur" operator="over"/>
        </filter>
        <marker id="bpArrowDefault" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#38bdf8"/>
        </marker>
      </defs>
    `;

    // Cintas SVG
    let beltsSvg = '';
    belts.forEach(b => {
      let d = '';
      if (b.isTrunk || (b.y1 === b.y2) || (b.x1 === b.x2)) {
        d = `M ${b.x1} ${b.y1} L ${b.x2} ${b.y2}`;
      } else {
        const laneX = b.laneX || Math.round((b.x1 + b.x2) / 2);
        const dirY = (b.y2 > b.y1) ? 1 : -1;
        const r = Math.min(6, Math.abs(b.y2 - b.y1) / 2, Math.abs(laneX - b.x1), Math.abs(b.x2 - laneX));
        if (r < 2) {
          d = `M ${b.x1} ${b.y1} L ${laneX} ${b.y1} L ${laneX} ${b.y2} L ${b.x2} ${b.y2}`;
        } else {
          d = `M ${b.x1} ${b.y1} ` +
              `L ${laneX - r} ${b.y1} ` +
              `Q ${laneX} ${b.y1} ${laneX} ${b.y1 + dirY * r} ` +
              `L ${laneX} ${b.y2 - dirY * r} ` +
              `Q ${laneX} ${b.y2} ${laneX + r} ${b.y2} ` +
              `L ${b.x2} ${b.y2}`;
        }
      }

      let badgeSvg = '';
      if (!b.isFeeder && b.rate) {
        const badgeX = b.laneX || Math.round((b.x1 + b.x2) / 2);
        const badgeY = Math.round((b.y1 + b.y2) / 2);
        const itemLabel = b.itemName ? `${b.itemName} (+${b.rate}/m)` : `${b.rate}/m`;
        const pW = Math.max(46, itemLabel.length * 5.6 + 14);
        badgeSvg = `
          <g class="bp-belt-rate-pill" style="pointer-events: none;">
            <rect x="${badgeX - pW/2}" y="${badgeY - 8}" width="${pW}" height="16" rx="4" fill="#070e1b" stroke="${b.color}" stroke-width="1.2"/>
            <text x="${badgeX}" y="${badgeY + 3.5}" fill="#f1f5f9" font-size="7.5" font-family="'Consolas', monospace" font-weight="700" text-anchor="middle">${itemLabel}</text>
          </g>
        `;
      }

      beltsSvg += `
        <g class="blueprint-belt" 
           id="${b.id}"
           data-id="${b.id}"
           data-from="${b.fromId || ''}"
           data-to="${b.toId || ''}"
           data-item="${b.itemId || ''}"
           data-itemname="${b.itemName || ''}"
           data-rate="${b.rate || ''}"
           data-fromname="${b.fromName || ''}"
           data-toname="${b.toName || ''}">
          <path class="bp-belt-casing" d="${d}" fill="none" stroke="#040812" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path class="bp-belt-rail" d="${d}" fill="none" stroke="${b.color}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" marker-end="url(#bpArrowDefault)"/>
          <path class="bp-belt-flow" d="${d}" fill="none" stroke="#ffffff" stroke-width="1.6" stroke-dasharray="6 6" opacity="0.8" stroke-linecap="round" stroke-linejoin="round"/>
          ${badgeSvg}
        </g>
      `;
    });

    // Puntos de Entrada Exterior SVG
    let intakeSvg = '';
    intakePorts.forEach(inp => {
      intakeSvg += `
        <g class="blueprint-intake" id="inp_${inp.id}" data-id="inp_${inp.id}" data-item="${inp.id}">
          <rect x="${inp.x}" y="${inp.y}" width="${inp.width}" height="${inp.height}" rx="5" fill="#0c1524" stroke="${inp.color}" stroke-width="1.6"/>
          <rect x="${inp.x + inp.width - 2}" y="${inp.y + inp.height/2 - 5}" width="4" height="10" fill="#4ade80" rx="2"/>
          <text x="${inp.x + 8}" y="${inp.y + 14}" fill="#38bdf8" font-size="7.5" font-weight="800" letter-spacing="0.5">📥 ENTRADA EXTERIOR</text>
          <text x="${inp.x + 8}" y="${inp.y + 27}" fill="#f8fafc" font-size="9.5" font-weight="800">${inp.name}</text>
          <text x="${inp.x + 8}" y="${inp.y + 38}" fill="#94a3b8" font-size="8" font-weight="700">${inp.rate} /min &bull; <tspan fill="${inp.color}">${inp.belt.name}</tspan></text>
        </g>
      `;
    });

    // Splitters SVG
    let splittersSvg = '';
    splitters.forEach(s => {
      splittersSvg += `
        <g class="blueprint-splitter" id="${s.id}" data-id="${s.id}">
          <rect x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" rx="3" fill="#78350f" stroke="#f59e0b" stroke-width="1.5"/>
          <text x="${s.x + 9}" y="${s.y + 13}" fill="#fef08a" font-size="9.5" text-anchor="middle" font-weight="800">🔀</text>
        </g>
      `;
    });

    // Mergers SVG
    let mergersSvg = '';
    mergers.forEach(mg => {
      mergersSvg += `
        <g class="blueprint-merger" id="${mg.id}" data-id="${mg.id}">
          <rect x="${mg.x}" y="${mg.y}" width="${mg.width}" height="${mg.height}" rx="3" fill="#0c4a6e" stroke="#38bdf8" stroke-width="1.5"/>
          <text x="${mg.x + 9}" y="${mg.y + 13}" fill="#e0f2fe" font-size="9.5" text-anchor="middle" font-weight="800">🔄</text>
        </g>
      `;
    });

    // Máquinas SVG
    let machinesSvg = '';
    machines.forEach(m => {
      let bColor = '#38bdf8';
      let iconEmoji = '⚙️';
      if (m.bldgId === 'smelter') { bColor = '#f97316'; iconEmoji = '🔥'; }
      else if (m.bldgId === 'assembler') { bColor = '#a855f7'; iconEmoji = '🔧'; }
      else if (m.bldgId === 'manufacturer') { bColor = '#ec4899'; iconEmoji = '🏭'; }
      else if (m.bldgId === 'refinery') { bColor = '#10b981'; iconEmoji = '🧪'; }

      const iconImg = `images/buildings/${m.bldgId}.png`;

      machinesSvg += `
        <g class="blueprint-machine" 
           id="${m.id}"
           data-id="${m.id}"
           data-name="${m.name}" 
           data-bldg="${m.bldg.name}" 
           data-recipe="${m.recipe.name}" 
           data-clock="${m.clock}" 
           data-mw="${m.mw}" 
           data-in="${m.inputRate}" 
           data-out="${m.outputRate}" 
           data-item="${m.itemId}"
           data-itemname="${SATIS_DATA.items[m.itemId]?.name || m.itemId}"
           transform="translate(${m.x}, ${m.y})">
          
          <rect width="${m.width}" height="${m.height}" rx="5" fill="#0d1524" stroke="${bColor}" stroke-width="1.8"/>
          <rect x="3" y="3" width="${m.width - 6}" height="${m.height - 6}" rx="3" fill="#070c17" stroke="rgba(255,255,255,0.05)"/>
          
          <rect x="-3" y="${m.height/2 - 5}" width="4" height="10" fill="#38bdf8" rx="2"/>
          <rect x="${m.width - 1}" y="${m.height/2 - 5}" width="4" height="10" fill="#4ade80" rx="2"/>
          
          <circle cx="${m.width - 9}" cy="11" r="2.8" fill="#4ade80" filter="url(#bpGlow)"/>

          <image href="${iconImg}" x="6" y="6" width="22" height="22" onerror="this.outerHTML='<text x=6 y=22 font-size=16>${iconEmoji}</text>'"/>

          <text x="32" y="16" fill="#ffffff" font-size="9" font-weight="800">${m.name}</text>
          <text x="32" y="27" fill="${m.recipe.isAlt ? '#fbbf24' : '#94a3b8'}" font-size="7.5" font-weight="600">${m.recipe.isAlt ? '⚡ Alt: ' : '⭐ '}${m.recipe.name}</text>

          <text x="6" y="${m.height - 14}" fill="#4ade80" font-size="7.5" font-weight="700">➔ +${m.outputRate}/m ${SATIS_DATA.items[m.itemId]?.name || m.itemId}</text>
          <text x="6" y="${m.height - 5}" fill="#facc15" font-size="7" font-weight="700">⚡ ${m.clock}% &bull; ${m.mw} MW</text>
        </g>
      `;
    });

    // Contenedor de Salida Final SVG
    const d = model.delivery;
    const finalIconImg = `images/items/${plan.targetGoal}.png`;
    const deliverySvg = `
      <g class="blueprint-delivery" id="delivery" data-id="delivery" data-item="${plan.targetGoal}" transform="translate(${d.x}, ${d.y})">
        <rect width="${d.width}" height="${d.height}" rx="6" fill="#091624" stroke="#4ade80" stroke-width="2"/>
        <rect x="3" y="3" width="${d.width - 6}" height="${d.height - 6}" rx="4" fill="#06101c"/>
        <rect x="-3" y="${d.height/2 - 6}" width="4" height="12" fill="#4ade80" rx="2"/>
        
        <circle cx="${d.width - 11}" cy="13" r="3" fill="#4ade80" filter="url(#bpGlow)"/>
        
        <image href="${finalIconImg}" x="8" y="8" width="26" height="26" onerror="this.outerHTML='<text x=8 y=26 font-size=18>📦</text>'"/>
        
        <text x="38" y="18" fill="#4ade80" font-size="8" font-weight="800" letter-spacing="0.5">📦 SALIDA FINAL</text>
        <text x="38" y="31" fill="#ffffff" font-size="10.5" font-weight="900">+${plan.targetRate} /min</text>
        <text x="8" y="47" fill="#cbd5e1" font-size="8.5" font-weight="700">${plan.targetMeta.name}</text>
        <text x="8" y="58" fill="${d.belt.color}" font-size="7.5" font-weight="700">➔ Cinta: ${d.belt.name}</text>
      </g>
    `;

    // Reglas de coordenadas y cimientos en bordes
    let rulersSvg = '';
    for (let cx = 0; cx < foundationsX; cx++) {
      const rx = cx * GRID_SIZE;
      rulersSvg += `
        <line x1="${rx}" y1="0" x2="${rx}" y2="${totalH}" stroke="rgba(56, 189, 248, 0.08)" stroke-width="1"/>
        <text x="${rx + 5}" y="14" fill="rgba(56, 189, 248, 0.35)" font-size="7.5" font-family="'Consolas', monospace" font-weight="700">C${cx + 1} (${cx * 8}m)</text>
      `;
    }
    for (let cy = 0; cy < foundationsY; cy++) {
      const ry = cy * GRID_SIZE;
      rulersSvg += `
        <line x1="0" y1="${ry}" x2="${totalW}" y2="${ry}" stroke="rgba(56, 189, 248, 0.08)" stroke-width="1"/>
        <text x="5" y="${ry + 14}" fill="rgba(56, 189, 248, 0.35)" font-size="7.5" font-family="'Consolas', monospace" font-weight="700">F${cy + 1}</text>
      `;
    }

    // Encabezados de Fase
    let headersSvg = '';
    stageHeaders.forEach((h) => {
      headersSvg += `
        <g transform="translate(${h.x}, ${h.y})">
          <rect width="${h.width}" height="20" rx="3" fill="rgba(2, 132, 199, 0.15)" stroke="#0284c7" stroke-width="0.8"/>
          <text x="${h.width / 2}" y="13.5" fill="#38bdf8" font-size="8" font-weight="800" text-anchor="middle" letter-spacing="0.5">${h.text}</text>
        </g>
      `;
    });

    const fullSvg = `
      <svg id="factoryBlueprintSvg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}" style="width: ${totalW}px; height: ${totalH}px; display: block;" xmlns="http://www.w3.org/2000/svg">
        ${svgDefs}
        <rect width="${totalW}" height="${totalH}" fill="url(#bpFoundationPattern)"/>
        ${rulersSvg}
        ${headersSvg}
        ${beltsSvg}
        ${intakeSvg}
        ${splittersSvg}
        ${mergersSvg}
        ${machinesSvg}
        ${deliverySvg}
      </svg>
    `;

    // Recopilar materiales presentes para barra de filtrado
    const materialsMap = new Map();
    belts.forEach(b => {
      if (b.itemId && !materialsMap.has(b.itemId)) {
        const meta = SATIS_DATA.items[b.itemId] || SATIS_DATA.rawResources[b.itemId] || { id: b.itemId, name: b.itemName || b.itemId };
        materialsMap.set(b.itemId, meta);
      }
    });
    intakePorts.forEach(inp => {
      if (!materialsMap.has(inp.id)) {
        const meta = SATIS_DATA.rawResources[inp.id] || { id: inp.id, name: inp.name };
        materialsMap.set(inp.id, meta);
      }
    });
    if (!materialsMap.has(plan.targetGoal)) {
      materialsMap.set(plan.targetGoal, plan.targetMeta);
    }

    return { svg: fullSvg, model, materialsList: Array.from(materialsMap.values()) };
  }

  function applyBlueprintMaterialFilter() {
    const canvas = document.getElementById('blueprintCanvas');
    if (!canvas) return;
    const filterItem = bpViewerState.activeMaterialFilter;

    // Actualizar botones de filtro
    const chips = document.querySelectorAll('#bpMaterialFiltersRow .bp-filter-chip');
    chips.forEach(c => {
      const it = c.getAttribute('data-filter-item');
      c.classList.toggle('active', it === (filterItem || 'all'));
    });

    if (!filterItem) {
      canvas.classList.remove('has-active-focus');
      canvas.querySelectorAll('.is-dimmed').forEach(el => el.classList.remove('is-dimmed'));
      return;
    }

    canvas.classList.add('has-active-focus');
    // Belts
    canvas.querySelectorAll('.blueprint-belt').forEach(bEl => {
      const bItem = bEl.getAttribute('data-item');
      bEl.classList.toggle('is-dimmed', bItem !== filterItem);
    });
    // Machines
    canvas.querySelectorAll('.blueprint-machine').forEach(mEl => {
      const mItem = mEl.getAttribute('data-item');
      mEl.classList.toggle('is-dimmed', mItem !== filterItem);
    });
    // Intake
    canvas.querySelectorAll('.blueprint-intake').forEach(inpEl => {
      const inpItem = inpEl.getAttribute('data-item');
      inpEl.classList.toggle('is-dimmed', inpItem !== filterItem);
    });
    // Delivery
    canvas.querySelectorAll('.blueprint-delivery').forEach(dEl => {
      const dItem = dEl.getAttribute('data-item');
      dEl.classList.toggle('is-dimmed', dItem !== filterItem);
    });
  }

  function renderFactoryBlueprint(plan) {
    const canvas = document.getElementById('blueprintCanvas');
    if (!canvas) return;

    const { svg, model, materialsList } = generateBlueprintSvg(plan);
    canvas.innerHTML = svg;
    bpViewerState.currentModel = model;

    const dimBadge = document.getElementById('bpFoundationDimensionsBadge');
    if (dimBadge && model) {
      dimBadge.textContent = `📐 ${model.foundationsX}x${model.foundationsY} Cimientos (${model.foundationsMetersW}m x ${model.foundationsMetersH}m • ${model.totalFoundations} bloques)`;
    }

    // Renderizar chips de filtro por material en la barra de herramientas del plano
    const filtersRow = document.getElementById('bpMaterialFiltersRow');
    if (filtersRow && materialsList) {
      let chipsHtml = `
        <button type="button" class="bp-filter-chip ${!bpViewerState.activeMaterialFilter ? 'active' : ''}" data-filter-item="all">
          <span>🌟 Ver Todo</span>
        </button>
      `;
      materialsList.forEach(mItem => {
        const isActive = bpViewerState.activeMaterialFilter === mItem.id;
        chipsHtml += `
          <button type="button" class="bp-filter-chip ${isActive ? 'active' : ''}" data-filter-item="${mItem.id}">
            ${getItemIcon(mItem.id, 14)}
            <span>${mItem.name}</span>
          </button>
        `;
      });
      filtersRow.innerHTML = chipsHtml;

      filtersRow.onclick = (e) => {
        const chip = e.target.closest('.bp-filter-chip');
        if (!chip) return;
        const itemId = chip.getAttribute('data-filter-item');
        if (itemId === 'all' || bpViewerState.activeMaterialFilter === itemId) {
          bpViewerState.activeMaterialFilter = null;
        } else {
          bpViewerState.activeMaterialFilter = itemId;
        }
        applyBlueprintMaterialFilter();
      };
    }

    if (bpViewerState.activeMaterialFilter) {
      applyBlueprintMaterialFilter();
    }

    requestAnimationFrame(() => {
      fitBlueprintToViewport(false);
    });

    attachBlueprintHoverTooltips();
  }

  function applyBlueprintTransform(canvasEl, stateObj) {
    if (!canvasEl) return;
    canvasEl.style.transform = `translate(${stateObj.panX}px, ${stateObj.panY}px) scale(${stateObj.scale})`;
  }

  function fitBlueprintToViewport(isModal = false) {
    const viewportId = isModal ? 'blueprintModalViewport' : 'blueprintViewport';
    const canvasId = isModal ? 'blueprintModalCanvas' : 'blueprintCanvas';
    const stateObj = isModal ? bpModalState : bpViewerState;

    const viewport = document.getElementById(viewportId);
    const canvas = document.getElementById(canvasId);
    if (!viewport || !canvas || !stateObj.currentModel) return;

    const vW = viewport.clientWidth || 800;
    const vH = viewport.clientHeight || 500;
    const mW = stateObj.currentModel.totalW;
    const mH = stateObj.currentModel.totalH;

    const pad = 20;
    const scale = Math.min((vW - pad * 2) / mW, (vH - pad * 2) / mH);
    stateObj.scale = Math.max(0.45, Math.min(1.25, Number(scale.toFixed(3))));
    stateObj.panX = Math.round((vW - mW * stateObj.scale) / 2);
    stateObj.panY = Math.round((vH - mH * stateObj.scale) / 2);

    applyBlueprintTransform(canvas, stateObj);
  }

  function initBlueprintInteractions() {
    const viewport = document.getElementById('blueprintViewport');
    const canvas = document.getElementById('blueprintCanvas');
    if (!viewport || !canvas || bpViewerState.isInitialized) return;
    bpViewerState.isInitialized = true;

    // Arrastre y desplazamiento (Pan)
    viewport.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      bpViewerState.isDragging = true;
      bpViewerState.startX = e.clientX - bpViewerState.panX;
      bpViewerState.startY = e.clientY - bpViewerState.panY;
      viewport.style.cursor = 'grabbing';
      canvas.classList.add('is-navigating');
      clearBlueprintHighlights();
    });

    window.addEventListener('mousemove', (e) => {
      if (!bpViewerState.isDragging) return;
      bpViewerState.panX = e.clientX - bpViewerState.startX;
      bpViewerState.panY = e.clientY - bpViewerState.startY;
      applyBlueprintTransform(canvas, bpViewerState);
    });

    window.addEventListener('mouseup', () => {
      if (bpViewerState.isDragging) {
        bpViewerState.isDragging = false;
        viewport.style.cursor = 'grab';
        canvas.classList.remove('is-navigating');
      }
    });

    // Zoom con rueda de ratón centrado en el cursor (estable, sin parpadeos ni desenfoques)
    let wheelZoomTimer = null;
    viewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      bpViewerState.isZooming = true;
      canvas.classList.add('is-navigating');
      clearBlueprintHighlights();

      const rect = viewport.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      const newScale = Math.max(0.25, Math.min(2.8, bpViewerState.scale * zoomFactor));

      bpViewerState.panX = mouseX - (mouseX - bpViewerState.panX) * (newScale / bpViewerState.scale);
      bpViewerState.panY = mouseY - (mouseY - bpViewerState.panY) * (newScale / bpViewerState.scale);
      bpViewerState.scale = newScale;

      applyBlueprintTransform(canvas, bpViewerState);

      clearTimeout(wheelZoomTimer);
      wheelZoomTimer = setTimeout(() => {
        bpViewerState.isZooming = false;
        canvas.classList.remove('is-navigating');
      }, 160);
    }, { passive: false });

    // Clic en el fondo del plano para enfocar todo y limpiar resaltados
    viewport.addEventListener('click', (e) => {
      if (e.target === viewport || (e.target && e.target.tagName === 'svg')) {
        clearBlueprintHighlights();
      }
    });

    // Botones de la barra de herramientas
    const btnIn = document.getElementById('btnBpZoomIn');
    const btnOut = document.getElementById('btnBpZoomOut');
    const btnReset = document.getElementById('btnBpReset');
    const btnToggleFocus = document.getElementById('btnBpToggleFocus');
    const btnToggleLabels = document.getElementById('btnBpToggleLabels');
    const btnFs = document.getElementById('btnBpFullscreen');

    if (btnIn) btnIn.addEventListener('click', () => {
      bpViewerState.scale = Math.min(2.8, bpViewerState.scale * 1.25);
      applyBlueprintTransform(canvas, bpViewerState);
    });

    if (btnOut) btnOut.addEventListener('click', () => {
      bpViewerState.scale = Math.max(0.25, bpViewerState.scale * 0.8);
      applyBlueprintTransform(canvas, bpViewerState);
    });

    if (btnReset) btnReset.addEventListener('click', () => {
      fitBlueprintToViewport(false);
      clearBlueprintHighlights();
    });

    if (btnToggleFocus) {
      btnToggleFocus.addEventListener('click', () => {
        bpViewerState.focusModeEnabled = !bpViewerState.focusModeEnabled;
        if (!bpViewerState.focusModeEnabled) {
          clearBlueprintHighlights();
          canvas.classList.add('inspection-disabled');
          btnToggleFocus.innerHTML = '🎯 Foco: Desactivado';
          btnToggleFocus.style.opacity = '0.7';
        } else {
          canvas.classList.remove('inspection-disabled');
          btnToggleFocus.innerHTML = '🎯 Foco: Suave';
          btnToggleFocus.style.opacity = '1';
        }
      });
    }

    if (btnToggleLabels) btnToggleLabels.addEventListener('click', () => {
      bpViewerState.showRatios = !bpViewerState.showRatios;
      canvas.querySelectorAll('.bp-belt-rate-pill').forEach(el => {
        el.style.display = bpViewerState.showRatios ? 'block' : 'none';
      });
      btnToggleLabels.classList.toggle('active', bpViewerState.showRatios);
    });

    if (btnFs) btnFs.addEventListener('click', () => {
      const card = document.getElementById('builderBlueprintSection');
      if (!card) return;
      const isFs = card.classList.toggle('is-fullscreen');
      btnFs.innerHTML = isFs ? '✕ Salir' : '⛶ Pantalla Completa';
      setTimeout(() => fitBlueprintToViewport(false), 150);
    });
  }

  function clearBlueprintHighlights() {
    const tooltip = document.getElementById('blueprintTooltip');
    const canvas = document.getElementById('blueprintCanvas');
    if (!canvas) return;
    if (tooltip) tooltip.style.display = 'none';
    canvas.classList.remove('has-active-focus');
    canvas.querySelectorAll('.is-hovered, .is-active-in, .is-active-out, .is-active-source, .is-active-target, .is-dimmed').forEach(el => {
      el.classList.remove('is-hovered', 'is-active-in', 'is-active-out', 'is-active-source', 'is-active-target', 'is-dimmed');
    });
    if (bpViewerState.activeMaterialFilter) {
      applyBlueprintMaterialFilter();
    }
  }

  function attachBlueprintHoverTooltips() {
    const viewport = document.getElementById('blueprintViewport');
    const tooltip = document.getElementById('blueprintTooltip');
    const canvas = document.getElementById('blueprintCanvas');
    if (!viewport || !tooltip || !canvas) return;

    // 1. Trazado Interactivo al Pasar el Ratón por Máquinas
    canvas.querySelectorAll('.blueprint-machine').forEach(mEl => {
      mEl.addEventListener('mouseenter', () => {
        if (bpViewerState.isZooming || bpViewerState.isDragging || !bpViewerState.focusModeEnabled) return;

        const mId = mEl.getAttribute('data-id');
        const name = mEl.getAttribute('data-name');
        const bldg = mEl.getAttribute('data-bldg');
        const recipe = mEl.getAttribute('data-recipe');
        const clock = mEl.getAttribute('data-clock');
        const mw = mEl.getAttribute('data-mw');
        const inRate = mEl.getAttribute('data-in');
        const outRate = mEl.getAttribute('data-out');
        const itemName = mEl.getAttribute('data-itemname') || mEl.getAttribute('data-item');

        canvas.classList.add('has-active-focus');
        mEl.classList.add('is-hovered');

        const sourceNodes = new Set();
        const targetNodes = new Set();

        // Identificar cintas de entrada y salida conectadas a esta máquina
        canvas.querySelectorAll('.blueprint-belt').forEach(bEl => {
          const from = bEl.getAttribute('data-from');
          const to = bEl.getAttribute('data-to');

          if (to === mId || (to && mId && to.includes(mId))) {
            bEl.classList.add('is-active-in');
            if (from) sourceNodes.add(from);
          } else if (from === mId || (from && mId && from.includes(mId))) {
            bEl.classList.add('is-active-out');
            if (to) targetNodes.add(to);
          } else {
            bEl.classList.add('is-dimmed');
          }
        });

        // Resaltar nodos de origen (Cyan) y destino (Verde)
        sourceNodes.forEach(nodeId => {
          const el = canvas.querySelector(`[data-id="${nodeId}"]`) || canvas.querySelector(`#${nodeId}`);
          if (el) el.classList.add('is-active-source');
        });

        targetNodes.forEach(nodeId => {
          const el = canvas.querySelector(`[data-id="${nodeId}"]`) || canvas.querySelector(`#${nodeId}`);
          if (el) el.classList.add('is-active-target');
        });

        // Atenuar el resto de máquinas y elementos no involucrados
        canvas.querySelectorAll('.blueprint-machine, .blueprint-intake, .blueprint-delivery, .blueprint-splitter, .blueprint-merger').forEach(nodeEl => {
          const nId = nodeEl.getAttribute('data-id') || nodeEl.id;
          if (nId !== mId && !sourceNodes.has(nId) && !targetNodes.has(nId)) {
            nodeEl.classList.add('is-dimmed');
          }
        });

        tooltip.innerHTML = `
          <div style="font-weight: 800; color: #38bdf8; font-size: 0.85rem; margin-bottom: 4px;">${name}</div>
          <div><strong>Edificio:</strong> ${bldg}</div>
          <div><strong>Receta:</strong> ${recipe}</div>
          <div><strong>Insumos:</strong> ${inRate}/min</div>
          <div><strong>Producción:</strong> <span style="color: #4ade80; font-weight: 700;">+${outRate}/min ${itemName}</span></div>
          <div style="margin-top: 5px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 4px; color: #facc15;">
            ⚡ Reloj: <strong>${clock}%</strong> &bull; Potencia: <strong>${mw} MW</strong>
          </div>
          <div style="font-size: 0.68rem; color: #94a3b8; margin-top: 3px;">
            <span style="color: #38bdf8;">■ Entradas (Cyan)</span> &bull; <span style="color: #4ade80;">■ Salidas (Verde)</span>
          </div>
        `;
        tooltip.style.display = 'block';
      });

      mEl.addEventListener('mousemove', (e) => {
        const rect = viewport.getBoundingClientRect();
        tooltip.style.left = `${e.clientX - rect.left + 15}px`;
        tooltip.style.top = `${e.clientY - rect.top + 15}px`;
      });

      mEl.addEventListener('mouseleave', clearBlueprintHighlights);
    });

    // 2. Trazado Interactivo al Pasar el Ratón por Cintas Transportadoras
    canvas.querySelectorAll('.blueprint-belt').forEach(bEl => {
      bEl.addEventListener('mouseenter', () => {
        if (bpViewerState.isZooming || bpViewerState.isDragging || !bpViewerState.focusModeEnabled) return;

        const from = bEl.getAttribute('data-from');
        const to = bEl.getAttribute('data-to');
        const fromName = bEl.getAttribute('data-fromname') || 'Origen';
        const toName = bEl.getAttribute('data-toname') || 'Destino';
        const itemName = bEl.getAttribute('data-itemname') || 'Material';
        const itemId = bEl.getAttribute('data-item');
        const rate = bEl.getAttribute('data-rate');

        canvas.classList.add('has-active-focus');
        bEl.classList.add('is-active-in');

        // Resaltar origen y destino
        if (from) {
          const srcEl = canvas.querySelector(`[data-id="${from}"]`) || canvas.querySelector(`#${from}`);
          if (srcEl) srcEl.classList.add('is-active-source');
        }
        if (to) {
          const tgtEl = canvas.querySelector(`[data-id="${to}"]`) || canvas.querySelector(`#${to}`);
          if (tgtEl) tgtEl.classList.add('is-active-target');
        }

        // Atenuar todo lo demás
        canvas.querySelectorAll('.blueprint-belt').forEach(otherB => {
          if (otherB !== bEl) otherB.classList.add('is-dimmed');
        });
        canvas.querySelectorAll('.blueprint-machine, .blueprint-intake, .blueprint-delivery, .blueprint-splitter, .blueprint-merger').forEach(nodeEl => {
          const nId = nodeEl.getAttribute('data-id') || nodeEl.id;
          if (nId !== from && nId !== to) nodeEl.classList.add('is-dimmed');
        });

        tooltip.innerHTML = `
          <div style="font-weight: 800; color: #facc15; font-size: 0.85rem; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
            <span>📦</span>
            <span>Cinta: ${itemName}</span>
          </div>
          ${rate ? `<div><strong>Flujo continuo:</strong> <span style="color: #4ade80; font-weight: 800;">+${rate} /min</span></div>` : ''}
          <div style="margin-top: 4px; font-size: 0.74rem;"><strong>De:</strong> <span style="color: #38bdf8;">${fromName}</span></div>
          <div style="font-size: 0.74rem;"><strong>Hacia:</strong> <span style="color: #4ade80;">${toName}</span></div>
        `;
        tooltip.style.display = 'block';
      });

      bEl.addEventListener('mousemove', (e) => {
        const rect = viewport.getBoundingClientRect();
        tooltip.style.left = `${e.clientX - rect.left + 15}px`;
        tooltip.style.top = `${e.clientY - rect.top + 15}px`;
      });

      bEl.addEventListener('mouseleave', clearBlueprintHighlights);
    });
  }

  function initBlueprintModal() {
    const modal = document.getElementById('factoryBlueprintModal');
    const btnClose = document.getElementById('btnCloseBpModal');
    const btnIn = document.getElementById('btnBpModalZoomIn');
    const btnOut = document.getElementById('btnBpModalZoomOut');
    const btnReset = document.getElementById('btnBpModalReset');
    const viewport = document.getElementById('blueprintModalViewport');
    const canvas = document.getElementById('blueprintModalCanvas');

    if (!modal) return;

    if (btnClose) btnClose.addEventListener('click', () => { modal.style.display = 'none'; });
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

    if (btnIn && canvas) btnIn.addEventListener('click', () => {
      bpModalState.scale = Math.min(2.8, bpModalState.scale * 1.25);
      applyBlueprintTransform(canvas, bpModalState);
    });

    if (btnOut && canvas) btnOut.addEventListener('click', () => {
      bpModalState.scale = Math.max(0.25, bpModalState.scale * 0.8);
      applyBlueprintTransform(canvas, bpModalState);
    });

    if (btnReset) btnReset.addEventListener('click', () => {
      fitBlueprintToViewport(true);
    });

    if (viewport && canvas && !bpModalState.isInitialized) {
      bpModalState.isInitialized = true;
      viewport.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        bpModalState.isDragging = true;
        bpModalState.startX = e.clientX - bpModalState.panX;
        bpModalState.startY = e.clientY - bpModalState.panY;
        viewport.style.cursor = 'grabbing';
      });

      window.addEventListener('mousemove', (e) => {
        if (!bpModalState.isDragging) return;
        bpModalState.panX = e.clientX - bpModalState.startX;
        bpModalState.panY = e.clientY - bpModalState.startY;
        applyBlueprintTransform(canvas, bpModalState);
      });

      window.addEventListener('mouseup', () => {
        if (bpModalState.isDragging) {
          bpModalState.isDragging = false;
          viewport.style.cursor = 'grab';
        }
      });
    }
  }

  function openBranchBlueprintModal(branchIdx) {
    const modal = document.getElementById('factoryBlueprintModal');
    const modalCanvas = document.getElementById('blueprintModalCanvas');
    const modalTitle = document.getElementById('bpModalTitle');
    const modalSubtitle = document.getElementById('bpModalSubtitle');
    const dimBadge = document.getElementById('bpModalDimensionsBadge');

    if (!modal || !modalCanvas) return;

    const branch = state.sandbox.branches[branchIdx];
    if (!branch) return;

    const rec = SATIS_DATA.recipes.find(r => r.id === branch.recipeId);
    if (!rec) return;

    const outItem = rec.outputs[0]?.item;
    const outRate = Number((rec.outputs[0]?.rate * branch.machineCount).toFixed(2));
    const outMeta = SATIS_DATA.items[outItem] || { name: outItem };

    const plan = SatisCalc.buildTargetFactoryPlan(outItem, outRate);
    if (!plan) return;

    if (modalTitle) modalTitle.innerHTML = `<span>📐 Plano Aéreo 2D: Rama #${branchIdx + 1} &bull; ${rec.name}</span>`;
    if (modalSubtitle) modalSubtitle.textContent = `Producción continua de +${outRate}/min de ${outMeta.name} (Hornos, constructores, splitters y cintas)`;

    const { svg, model } = generateBlueprintSvg(plan);
    modalCanvas.innerHTML = svg;
    bpModalState.currentModel = model;

    if (dimBadge && model) {
      dimBadge.textContent = `📐 ${model.foundationsX}x${model.foundationsY} Cimientos (${model.foundationsMetersW}m x ${model.foundationsMetersH}m • ${model.totalFoundations} bloques)`;
    }

    modal.style.display = 'flex';
    setTimeout(() => fitBlueprintToViewport(true), 80);
  }

  let activePickerTarget = null; // { type: 'sandbox', branchIndex: number } | { type: 'builder' }
  let currentPickerFilter = 'all';
  let currentPickerSearch = '';
  let currentCatalogEntries = [];
  let searchDebounceRaf = null;

  function initRecipePickerModal() {
    const modal = document.getElementById('recipePickerModal');
    const btnClose = document.getElementById('btnCloseRecipeModal');
    const searchInput = document.getElementById('recipePickerSearch');
    const filtersRow = document.getElementById('recipePickerFilters');
    const grid = document.getElementById('recipePickerGrid');

    if (!modal) return;

    if (btnClose) {
      btnClose.addEventListener('click', closeRecipePickerModal);
    }

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeRecipePickerModal();
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.style.display !== 'none') {
        closeRecipePickerModal();
      }
    });

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        currentPickerSearch = (e.target.value || '').toLowerCase().trim();
        if (searchDebounceRaf) cancelAnimationFrame(searchDebounceRaf);
        searchDebounceRaf = requestAnimationFrame(() => {
          renderRecipePickerGrid();
        });
      });
    }

    if (filtersRow) {
      filtersRow.addEventListener('click', (e) => {
        const pill = e.target.closest('.filter-pill');
        if (!pill) return;
        filtersRow.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        currentPickerFilter = pill.getAttribute('data-filter') || 'all';
        renderRecipePickerGrid();
      });
    }

    if (grid) {
      grid.addEventListener('click', (e) => {
        const card = e.target.closest('.recipe-catalog-card');
        if (!card) return;
        const recipeId = card.getAttribute('data-recipe-id');
        const itemId = card.getAttribute('data-item-id');
        selectRecipeFromCatalog(recipeId, itemId);
      });
    }
  }

  function openRecipePickerModal(target) {
    const modal = document.getElementById('recipePickerModal');
    const searchInput = document.getElementById('recipePickerSearch');
    const titleEl = document.getElementById('modalPickerTitle');
    const subtitleEl = document.getElementById('modalPickerSubtitle');
    const filtersRow = document.getElementById('recipePickerFilters');

    if (!modal) return;
    activePickerTarget = target;

    currentPickerFilter = 'all';
    currentPickerSearch = '';
    if (searchInput) searchInput.value = '';

    if (filtersRow) {
      filtersRow.querySelectorAll('.filter-pill').forEach(p => {
        p.classList.toggle('active', p.getAttribute('data-filter') === 'all');
      });
    }

    let activeSupplyItem = 'iron_ore';
    let rawList = [];

    if (target.type === 'sandbox') {
      const supply = getSandboxSupply();
      activeSupplyItem = supply.item;
      if (titleEl) {
        titleEl.innerHTML = `<span>📦 Catálogo FICSIT &bull; Rama #${target.branchIndex + 1}</span>`;
      }
      if (subtitleEl) {
        subtitleEl.innerHTML = `Fabricación a partir de <strong>${supply.itemName}</strong> (${supply.rate.toFixed(1)}/min disponibles). Haz 1 clic sobre el producto deseado.`;
      }

      let derivable = SatisCalc.getDerivableRecipesForSupply(activeSupplyItem);
      if (derivable.length === 0) {
        derivable = SATIS_DATA.recipes;
      }
      rawList = derivable;
    } else if (target.type === 'builder') {
      if (titleEl) {
        titleEl.innerHTML = `<span>🎯 Catálogo FICSIT &bull; Meta de Fábrica</span>`;
      }
      if (subtitleEl) {
        subtitleEl.innerHTML = `Elige el producto que deseas fabricar (ej: Motor, Rotor, Armazón Modular). La fábrica calculará todos los minerales requeridos (Hierro, Cobre, Caliza, Carbón) de forma 100% automática.`;
      }

      // Todas las recetas estándar para elegir cualquier producto objetivo
      rawList = SATIS_DATA.recipes.filter(r => !r.isAlt);
    }

    // Precompilar dataset del catálogo una sola vez al abrir el modal (0 subchain resolution en render/search)
    let countAll = 0;
    let countDirect = 0;
    let countSubchain = 0;

    currentCatalogEntries = rawList.map(r => {
      const outItem = r.outputs[0]?.item || '';
      const outMeta = SATIS_DATA.items[outItem] || SATIS_DATA.rawResources[outItem] || { name: outItem };
      const bldg = SATIS_DATA.buildings[r.building] || { name: r.building, icon: '🏭', power: 4 };
      const chain = (target.type === 'sandbox') ? (r.chain || SatisCalc.resolveBranchSubchain(activeSupplyItem, r.id, 1)) : null;
      const isDirect = (target.type === 'builder') ? true : (chain ? chain.isDirect : (r.isDirect !== false));

      countAll++;
      if (isDirect) countDirect++;
      else countSubchain++;

      let flowHtml = '';
      if (target.type === 'builder') {
        flowHtml = `🎯 <strong>Meta de Fábrica:</strong> Produce <strong style="color: #4ade80; display: inline-flex; align-items: center; gap: 4px;">${getItemIcon(outItem, 16)} ${outMeta.name}</strong> (${r.outputs[0]?.rate}/m por máquina en ${bldg.name})`;
      } else if (chain && !chain.isDirect) {
        const supplyMeta = SATIS_DATA.items[activeSupplyItem] || SATIS_DATA.rawResources[activeSupplyItem] || { name: activeSupplyItem };
        const stepsSeq = chain.intermediateSteps.map(s => {
          const bId = s.building?.id || s.building;
          return `<span style="display: inline-flex; align-items: center; gap: 4px;">${getBuildingIcon(bId, 16)} ${s.itemName}</span>`;
        }).join(' ➔ ');
        flowHtml = `🔄 <strong>Sub-cadena:</strong> ${getItemIcon(activeSupplyItem, 16)} ${supplyMeta.name} ➔ ${stepsSeq} ➔ <strong style="color: #4ade80; display: inline-flex; align-items: center; gap: 4px;">${getItemIcon(outItem, 16)} ${outMeta.name}</strong>`;
      } else {
        flowHtml = `⚡ <strong>Entrada directa:</strong> ${r.inputs.map(inp => {
          const inMeta = SATIS_DATA.items[inp.item] || SATIS_DATA.rawResources[inp.item] || { name: inp.item };
          return `<span style="display: inline-flex; align-items: center; gap: 4px;">${getItemIcon(inp.item, 16)} ${inp.rate}/m de ${inMeta.name}</span>`;
        }).join(', ')}`;
      }

      const inputNames = r.inputs.map(inp => {
        const inMeta = SATIS_DATA.items[inp.item] || SATIS_DATA.rawResources[inp.item] || { name: inp.item };
        return inMeta.name;
      }).join(' ');

      const searchIndex = `${r.name} ${outMeta.name} ${bldg.name} ${inputNames}`.toLowerCase();

      return {
        id: r.id,
        name: r.name,
        isAlt: Boolean(r.isAlt),
        building: r.building,
        buildingName: bldg.name,
        buildingIcon: getBuildingIcon(r.building, 18),
        power: bldg.power || 4,
        outItem: outItem,
        outName: outMeta.name,
        outRate: r.outputs[0]?.rate || 0,
        isDirect: isDirect,
        stepsCount: chain ? chain.intermediateSteps.length + 1 : 2,
        flowHtml: flowHtml,
        searchIndex: searchIndex,
        icon: getItemIcon(outItem, 36, 'ficsit-item-icon-lg')
      };
    });

    const countAllEl = document.getElementById('countFilterAll');
    const countDirectEl = document.getElementById('countFilterDirect');
    const countSubchainEl = document.getElementById('countFilterSubchain');
    if (countAllEl) countAllEl.textContent = countAll;
    if (countDirectEl) countDirectEl.textContent = countDirect;
    if (countSubchainEl) countSubchainEl.textContent = countSubchain;

    modal.style.display = 'flex';
    renderRecipePickerGrid();

    if (searchInput) {
      setTimeout(() => searchInput.focus(), 60);
    }
  }

  function closeRecipePickerModal() {
    const modal = document.getElementById('recipePickerModal');
    if (modal) {
      modal.style.display = 'none';
    }
    activePickerTarget = null;
  }

  function selectRecipeFromCatalog(recipeId, itemId) {
    if (!activePickerTarget) return;

    if (activePickerTarget.type === 'sandbox') {
      const idx = activePickerTarget.branchIndex;
      if (state.sandbox.branches[idx]) {
        state.sandbox.branches[idx].recipeId = recipeId;
        if (state.sandbox.autoBalance) {
          applyAutoBalanceToBranches();
        }
        updateSandbox();
      }
    } else if (activePickerTarget.type === 'builder') {
      state.builder.targetGoal = itemId;
      const goalSelect = document.getElementById('builderGoalSelect');
      if (goalSelect) {
        goalSelect.value = itemId;
      }
      if (state.builder.calcMode === 'drills') {
        syncTargetRateFromDrills();
      }
      updateLineBuilder();
    }

    closeRecipePickerModal();
  }

  function renderRecipePickerGrid() {
    const grid = document.getElementById('recipePickerGrid');
    if (!grid || !activePickerTarget) return;

    let currentSelectedId = '';
    if (activePickerTarget.type === 'sandbox') {
      const curBranch = state.sandbox.branches[activePickerTarget.branchIndex];
      currentSelectedId = curBranch ? curBranch.recipeId : '';
    } else if (activePickerTarget.type === 'builder') {
      currentSelectedId = state.builder.targetGoal;
    }

    const q = currentPickerSearch;
    const f = currentPickerFilter;

    const filtered = currentCatalogEntries.filter(item => {
      if (f === 'direct' && !item.isDirect) return false;
      if (f === 'subchain' && item.isDirect) return false;
      if (f === 'constructor' && item.building !== 'constructor') return false;
      if (f === 'assembler' && item.building !== 'assembler') return false;
      if (f === 'manufacturer' && item.building !== 'manufacturer') return false;

      if (q && !item.searchIndex.includes(q)) return false;
      return true;
    });

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="catalog-no-results">
          <div style="font-size: 2.2rem; margin-bottom: 10px;">🔍</div>
          <div style="font-weight: 800; color: #f1f5f9; font-size: 1.05rem;">No se encontraron recetas con "${currentPickerSearch}"</div>
          <div style="font-size: 0.82rem; color: var(--text-muted); margin-top: 6px;">Prueba buscando otra palabra clave (ej: <em>Plancha, Cable, Alambre, Rotor, Tornillo</em>) o selecciona el filtro "🌟 Todos".</div>
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered.map(item => {
      const isSelected = (activePickerTarget.type === 'sandbox' && item.id === currentSelectedId) ||
                         (activePickerTarget.type === 'builder' && item.outItem === currentSelectedId);

      return `
        <div class="recipe-catalog-card ${isSelected ? 'current-selected' : ''}" data-recipe-id="${item.id}" data-item-id="${item.outItem}">
          <div class="catalog-card-header">
            <div class="catalog-card-title">
              <span style="display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; background: rgba(13, 21, 34, 0.8); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 6px; padding: 2px;">${item.icon}</span>
              <div>
                <span style="color: #f8fafc; font-weight: 800; font-size: 0.95rem;">${item.name}</span>
                ${item.isAlt ? '<span class="badge" style="background: rgba(245, 158, 11, 0.2); color: #f59e0b; font-size: 0.65rem; margin-left: 4px;">ALT</span>' : ''}
                <div style="font-size: 0.74rem; color: #94a3b8; font-weight: 600; margin-top: 2px; display: flex; align-items: center; gap: 4px;">
                  ${item.buildingIcon} <span>${item.buildingName}</span>
                </div>
              </div>
            </div>
            <div>
              ${!item.isDirect 
                ? `<span class="catalog-tag-subchain">🔄 ${item.stepsCount} Fases</span>` 
                : `<span class="catalog-tag-direct">⚡ Directo</span>`
              }
            </div>
          </div>

          <div class="catalog-pipeline-flow">
            ${item.flowHtml}
          </div>

          <div class="catalog-card-footer">
            <div style="display: flex; gap: 8px; align-items: center;">
              <span style="color: #4ade80; font-weight: 800; font-size: 0.82rem; display: flex; align-items: center; gap: 4px;">📦 +${item.outRate}/m ${item.outName}</span>
              <span style="color: #facc15; font-size: 0.72rem; font-weight: 700;">⚡ ${item.power} MW</span>
            </div>
            <div>
              ${isSelected 
                ? `<span style="color: #4ade80; font-weight: 800; font-size: 0.8rem; background: rgba(74, 222, 128, 0.15); padding: 3px 8px; border-radius: 4px;">✓ En uso</span>`
                : `<span style="color: #38bdf8; font-weight: 700; font-size: 0.8rem;">Seleccionar ➔</span>`
              }
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // =========================================================================
  // 1.8. TAB: ESPACIO LIBRE / SANDBOX (DIVISIÓN MULTIFUNCIONAL & BALANCE)
  // =========================================================================
  function initSandboxTab() {
    const btnSbModeMiners = document.getElementById('btnSbModeMiners');
    const btnSbModeFree = document.getElementById('btnSbModeFree');
    const sbMinersPanel = document.getElementById('sbMinersPanel');
    const sbFreePanel = document.getElementById('sbFreePanel');
    const sbAutoSmeltRow = document.getElementById('sbAutoSmeltRow');
    const sbChkAutoSmelt = document.getElementById('sbChkAutoSmelt');
    const sbResourceSelect = document.getElementById('sbResourceSelect');
    const sbPurityBtns = document.querySelectorAll('.sb-purity-btn');
    const sbMinerTierSelect = document.getElementById('sbMinerTierSelect');
    const sbMinerCount = document.getElementById('sbMinerCount');
    const btnSbMinerMinus = document.getElementById('btnSbMinerMinus');
    const btnSbMinerPlus = document.getElementById('btnSbMinerPlus');
    const sbFreeItemSelect = document.getElementById('sbFreeItemSelect');
    const sbFreeRateInput = document.getElementById('sbFreeRateInput');
    const btnAddSbBranch = document.getElementById('btnAddSbBranch');
    const sbBranchesList = document.getElementById('sbBranchesList');
    const btnCopySbReport = document.getElementById('btnCopySbReport');
    const btnGoToSandbox = document.getElementById('btnGoToSandbox');

    if (!sbResourceSelect) return;

    // 1. Populate Resources (Solid raw resources)
    sbResourceSelect.innerHTML = Object.values(SATIS_DATA.rawResources).map(r => `
      <option value="${r.id}">${r.name} (${r.category})</option>
    `).join('');
    sbResourceSelect.value = state.sandbox.resource;

    // 2. Populate Free Items (Ores, Ingots, Basic Parts, etc.)
    const allFreeItems = [
      ...Object.values(SATIS_DATA.rawResources).map(r => ({ id: r.id, name: `${r.name} (Mineral/Crudo)`, isRaw: true })),
      ...Object.values(SATIS_DATA.items).map(i => ({ id: i.id, name: `${i.name} [${i.category || 'Item'}]`, isRaw: false }))
    ];
    sbFreeItemSelect.innerHTML = allFreeItems.map(it => `
      <option value="${it.id}">${it.name}</option>
    `).join('');
    sbFreeItemSelect.value = state.sandbox.freeItem;

    // 3. Mode Toggles
    btnSbModeMiners.addEventListener('click', () => {
      state.sandbox.mode = 'miners';
      btnSbModeMiners.classList.add('active');
      btnSbModeFree.classList.remove('active');
      sbMinersPanel.style.display = 'grid';
      sbFreePanel.style.display = 'none';
      const sbSecRow = document.getElementById('sbSecondaryMineralRow');
      if (sbSecRow) sbSecRow.style.display = 'block';
      checkAutoSmeltVisibility();
      updateSandbox();
    });

    btnSbModeFree.addEventListener('click', () => {
      state.sandbox.mode = 'free';
      btnSbModeFree.classList.add('active');
      btnSbModeMiners.classList.remove('active');
      sbMinersPanel.style.display = 'none';
      sbFreePanel.style.display = 'grid';
      const sbSecRow = document.getElementById('sbSecondaryMineralRow');
      if (sbSecRow) sbSecRow.style.display = 'none';
      checkAutoSmeltVisibility();
      updateSandbox();
    });

    function checkAutoSmeltVisibility() {
      if (state.sandbox.mode === 'miners') {
        const smeltRecipe = SATIS_DATA.recipes.find(r => 
          r.building === 'smelter' && !r.isAlt && r.inputs.some(inp => inp.item === state.sandbox.resource)
        );
        sbAutoSmeltRow.style.display = smeltRecipe ? 'flex' : 'none';
      } else {
        sbAutoSmeltRow.style.display = 'none';
      }
    }

    // 4. Miners Controls
    sbResourceSelect.addEventListener('change', (e) => {
      state.sandbox.resource = e.target.value;
      checkAutoSmeltVisibility();
      if (state.sandbox.autoBalance) applyAutoBalanceToBranches();
      updateSandbox();
    });

    sbPurityBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        sbPurityBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.sandbox.purity = btn.getAttribute('data-purity');
        if (state.sandbox.minerNodes) {
          state.sandbox.minerNodes.forEach(n => { n.purity = state.sandbox.purity; });
        }
        if (state.sandbox.autoBalance) applyAutoBalanceToBranches();
        updateSandbox();
      });
    });

    sbMinerTierSelect.value = state.sandbox.minerTier;
    sbMinerTierSelect.addEventListener('change', (e) => {
      state.sandbox.minerTier = e.target.value;
      if (state.sandbox.minerNodes) {
        state.sandbox.minerNodes.forEach(n => { n.minerTier = state.sandbox.minerTier; });
      }
      if (state.sandbox.autoBalance) applyAutoBalanceToBranches();
      updateSandbox();
    });

    sbMinerCount.value = state.sandbox.minerCount;
    btnSbMinerMinus.addEventListener('click', () => {
      state.sandbox.minerCount = Math.max(1, state.sandbox.minerCount - 1);
      sbMinerCount.value = state.sandbox.minerCount;
      if (state.sandbox.autoBalance) applyAutoBalanceToBranches();
      updateSandbox();
    });

    btnSbMinerPlus.addEventListener('click', () => {
      state.sandbox.minerCount = Math.min(10, state.sandbox.minerCount + 1);
      sbMinerCount.value = state.sandbox.minerCount;
      if (state.sandbox.autoBalance) applyAutoBalanceToBranches();
      updateSandbox();
    });

    sbMinerCount.addEventListener('input', (e) => {
      state.sandbox.minerCount = Math.max(1, Math.min(10, parseInt(e.target.value) || 1));
      if (state.sandbox.autoBalance) applyAutoBalanceToBranches();
      updateSandbox();
    });

    sbChkAutoSmelt.checked = state.sandbox.autoSmelt;
    sbChkAutoSmelt.addEventListener('change', (e) => {
      state.sandbox.autoSmelt = e.target.checked;
      if (state.sandbox.autoBalance) applyAutoBalanceToBranches();
      updateSandbox();
    });

    // 4.1. Controles de Segundo Mineral Opcional (ej. Carbón para Acero, Cobre, etc.)
    const sbSecondaryResourceSelect = document.getElementById('sbSecondaryResourceSelect');
    const btnToggleSbSecondaryMineral = document.getElementById('btnToggleSbSecondaryMineral');
    const btnRemoveSbSecondaryMineral = document.getElementById('btnRemoveSbSecondaryMineral');
    const sbSecondaryMineralPanel = document.getElementById('sbSecondaryMineralPanel');
    const sbSecondaryMinerTierSelect = document.getElementById('sbSecondaryMinerTierSelect');
    const sbSecondaryMinerCount = document.getElementById('sbSecondaryMinerCount');
    const btnSbSecMinerMinus = document.getElementById('btnSbSecMinerMinus');
    const btnSbSecMinerPlus = document.getElementById('btnSbSecMinerPlus');
    const sbSecPurityBtns = document.querySelectorAll('.sb-sec-purity-btn');

    if (sbSecondaryResourceSelect) {
      sbSecondaryResourceSelect.innerHTML = Object.values(SATIS_DATA.rawResources).map(r => `
        <option value="${r.id}">${r.name} (${r.category})</option>
      `).join('');
      sbSecondaryResourceSelect.value = state.sandbox.secondaryResource || 'coal';
      sbSecondaryResourceSelect.addEventListener('change', (e) => {
        state.sandbox.secondaryResource = e.target.value;
        if (state.sandbox.autoBalance) applyAutoBalanceToBranches();
        updateSandbox();
      });
    }

    if (btnToggleSbSecondaryMineral && sbSecondaryMineralPanel) {
      btnToggleSbSecondaryMineral.addEventListener('click', () => {
        state.sandbox.hasSecondary = true;
        sbSecondaryMineralPanel.style.display = 'block';
        btnToggleSbSecondaryMineral.style.display = 'none';
        if (state.sandbox.autoBalance) applyAutoBalanceToBranches();
        updateSandbox();
      });
    }

    if (btnRemoveSbSecondaryMineral && sbSecondaryMineralPanel) {
      btnRemoveSbSecondaryMineral.addEventListener('click', () => {
        state.sandbox.hasSecondary = false;
        sbSecondaryMineralPanel.style.display = 'none';
        if (btnToggleSbSecondaryMineral) btnToggleSbSecondaryMineral.style.display = 'inline-flex';
        if (state.sandbox.autoBalance) applyAutoBalanceToBranches();
        updateSandbox();
      });
    }

    if (sbSecondaryMinerTierSelect) {
      sbSecondaryMinerTierSelect.value = state.sandbox.secondaryMinerTier || 'miner_mk1';
      sbSecondaryMinerTierSelect.addEventListener('change', (e) => {
        state.sandbox.secondaryMinerTier = e.target.value;
        if (state.sandbox.autoBalance) applyAutoBalanceToBranches();
        updateSandbox();
      });
    }

    if (sbSecondaryMinerCount && btnSbSecMinerMinus && btnSbSecMinerPlus) {
      sbSecondaryMinerCount.value = state.sandbox.secondaryMinerCount || 1;
      btnSbSecMinerMinus.addEventListener('click', () => {
        state.sandbox.secondaryMinerCount = Math.max(1, (state.sandbox.secondaryMinerCount || 1) - 1);
        sbSecondaryMinerCount.value = state.sandbox.secondaryMinerCount;
        if (state.sandbox.autoBalance) applyAutoBalanceToBranches();
        updateSandbox();
      });
      btnSbSecMinerPlus.addEventListener('click', () => {
        state.sandbox.secondaryMinerCount = Math.min(10, (state.sandbox.secondaryMinerCount || 1) + 1);
        sbSecondaryMinerCount.value = state.sandbox.secondaryMinerCount;
        if (state.sandbox.autoBalance) applyAutoBalanceToBranches();
        updateSandbox();
      });
      sbSecondaryMinerCount.addEventListener('input', (e) => {
        state.sandbox.secondaryMinerCount = Math.max(1, Math.min(10, parseInt(e.target.value) || 1));
        if (state.sandbox.autoBalance) applyAutoBalanceToBranches();
        updateSandbox();
      });
    }

    sbSecPurityBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        sbSecPurityBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.sandbox.secondaryPurity = btn.getAttribute('data-purity');
        if (state.sandbox.autoBalance) applyAutoBalanceToBranches();
        updateSandbox();
      });
    });

    // 5. Free Mode Controls
    sbFreeItemSelect.addEventListener('change', (e) => {
      state.sandbox.freeItem = e.target.value;
      if (state.sandbox.autoBalance) applyAutoBalanceToBranches();
      updateSandbox();
    });

    sbFreeRateInput.value = state.sandbox.freeRate;
    sbFreeRateInput.addEventListener('input', (e) => {
      state.sandbox.freeRate = Math.max(0, parseFloat(e.target.value) || 0);
      if (state.sandbox.autoBalance) applyAutoBalanceToBranches();
      updateSandbox();
    });

    // 5.1. Auto-Optimizer Controls
    const btnApplyAutoBalance = document.getElementById('btnApplyAutoBalance');
    const sbChkKeepAutoBalanced = document.getElementById('sbChkKeepAutoBalanced');
    const sbOptimalSolutionsChips = document.getElementById('sbOptimalSolutionsChips');

    if (btnApplyAutoBalance) {
      btnApplyAutoBalance.addEventListener('click', () => {
        state.sandbox.autoBalance = true;
        if (sbChkKeepAutoBalanced) sbChkKeepAutoBalanced.checked = true;
        applyAutoBalanceToBranches();
        updateSandbox();
      });
    }

    if (sbChkKeepAutoBalanced) {
      sbChkKeepAutoBalanced.checked = state.sandbox.autoBalance;
      sbChkKeepAutoBalanced.addEventListener('change', (e) => {
        state.sandbox.autoBalance = e.target.checked;
        if (state.sandbox.autoBalance) {
          applyAutoBalanceToBranches();
          updateSandbox();
        }
      });
    }

    if (sbOptimalSolutionsChips) {
      sbOptimalSolutionsChips.addEventListener('click', (e) => {
        const chip = e.target.closest('.solution-chip');
        if (!chip) return;
        const countsStr = chip.getAttribute('data-counts');
        if (countsStr) {
          const counts = countsStr.split(',').map(Number);
          counts.forEach((c, idx) => {
            if (state.sandbox.branches[idx]) {
              state.sandbox.branches[idx].machineCount = c;
            }
          });
          state.sandbox.autoBalance = false;
          if (sbChkKeepAutoBalanced) sbChkKeepAutoBalanced.checked = false;
          updateSandbox();
        }
      });
    }

    // 6. Branch Add Button
    btnAddSbBranch.addEventListener('click', () => {
      const supply = getSandboxSupply();
      let derivable = SatisCalc.getDerivableRecipesForSupply(supply.item);
      if (derivable.length === 0) derivable = SATIS_DATA.recipes;
      
      const usedRecipes = new Set(state.sandbox.branches.map(b => b.recipeId));
      let chosen = derivable.find(r => !usedRecipes.has(r.id)) || derivable[0];
      
      state.sandbox.branches.push({
        recipeId: chosen ? chosen.id : 'iron_plate_std',
        machineCount: 1
      });
      if (state.sandbox.autoBalance) {
        applyAutoBalanceToBranches();
      }
      updateSandbox();
    });

    // 7. Branch Delegated Events
    sbBranchesList.addEventListener('change', (e) => {
      if (e.target.classList.contains('sb-branch-recipe-select')) {
        const idx = parseInt(e.target.getAttribute('data-index'), 10);
        if (state.sandbox.branches[idx]) {
          state.sandbox.branches[idx].recipeId = e.target.value;
          if (state.sandbox.autoBalance) applyAutoBalanceToBranches();
          updateSandbox();
        }
      }
    });

    sbBranchesList.addEventListener('input', (e) => {
      if (e.target.classList.contains('sb-branch-count-input')) {
        const idx = parseInt(e.target.getAttribute('data-index'), 10);
        if (state.sandbox.branches[idx]) {
          const val = Math.max(0.1, parseFloat(e.target.value) || 1);
          state.sandbox.branches[idx].machineCount = Number(val.toFixed(2));
          // Manual modification: suspend auto-balance
          state.sandbox.autoBalance = false;
          if (sbChkKeepAutoBalanced) sbChkKeepAutoBalanced.checked = false;
          updateSandbox();
        }
      }
    });

    sbBranchesList.addEventListener('click', (e) => {
      const pickerTrigger = e.target.closest('.btn-trigger-recipe-picker') || e.target.closest('.btn-trigger-picker-text');
      if (pickerTrigger) {
        const idx = parseInt(pickerTrigger.getAttribute('data-index'), 10);
        openRecipePickerModal({ type: 'sandbox', branchIndex: idx });
        return;
      }

      const bpBtn = e.target.closest('.btn-open-branch-blueprint');
      if (bpBtn) {
        const idx = parseInt(bpBtn.getAttribute('data-index'), 10);
        sbBpState.highlightedBranchIdx = idx;
        const section = document.getElementById('sandboxBlueprintSection');
        if (section) {
          section.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        updateSandbox();
        return;
      }

      const minusBtn = e.target.closest('.sb-branch-minus');
      const plusBtn = e.target.closest('.sb-branch-plus');
      const delBtn = e.target.closest('.btn-delete-branch');

      if (minusBtn) {
        const idx = parseInt(minusBtn.getAttribute('data-index'), 10);
        if (state.sandbox.branches[idx]) {
          state.sandbox.branches[idx].machineCount = Math.max(0.5, Number((state.sandbox.branches[idx].machineCount - 1).toFixed(2)));
          state.sandbox.autoBalance = false;
          if (sbChkKeepAutoBalanced) sbChkKeepAutoBalanced.checked = false;
          updateSandbox();
        }
      } else if (plusBtn) {
        const idx = parseInt(plusBtn.getAttribute('data-index'), 10);
        if (state.sandbox.branches[idx]) {
          state.sandbox.branches[idx].machineCount = Number((state.sandbox.branches[idx].machineCount + 1).toFixed(2));
          state.sandbox.autoBalance = false;
          if (sbChkKeepAutoBalanced) sbChkKeepAutoBalanced.checked = false;
          updateSandbox();
        }
      } else if (delBtn) {
        const idx = parseInt(delBtn.getAttribute('data-index'), 10);
        if (state.sandbox.branches.length > 1) {
          state.sandbox.branches.splice(idx, 1);
          if (state.sandbox.autoBalance) {
            applyAutoBalanceToBranches();
          }
          updateSandbox();
        }
      }
    });

    // 7.1. Individual Miners in Sandbox delegation
    const sbIndivMinersBox = document.getElementById('sbIndividualMinersContainer');
    if (sbIndivMinersBox) {
      sbIndivMinersBox.addEventListener('click', (e) => {
        const btnP = e.target.closest('.btn-sb-node-purity');
        if (btnP) {
          const idx = parseInt(btnP.getAttribute('data-index'), 10);
          const purity = btnP.getAttribute('data-purity');
          if (state.sandbox.minerNodes && state.sandbox.minerNodes[idx]) {
            state.sandbox.minerNodes[idx].purity = purity;
            if (state.sandbox.autoBalance) applyAutoBalanceToBranches();
            updateSandbox();
          }
          return;
        }

        const btnM = e.target.closest('.btn-sb-node-miner');
        if (btnM) {
          const idx = parseInt(btnM.getAttribute('data-index'), 10);
          const tier = btnM.getAttribute('data-miner');
          if (state.sandbox.minerNodes && state.sandbox.minerNodes[idx]) {
            state.sandbox.minerNodes[idx].minerTier = tier;
            if (state.sandbox.autoBalance) applyAutoBalanceToBranches();
            updateSandbox();
          }
          return;
        }
      });
    }

    // 8. Banner shortcut button
    if (btnGoToSandbox) {
      btnGoToSandbox.addEventListener('click', () => {
        setActiveTab('tab-sandbox');
      });
    }

    // 9. Copy Report
    if (btnCopySbReport) {
      btnCopySbReport.addEventListener('click', () => {
        const supply = getSandboxSupply();
        const totalMw = document.getElementById('sbTotalMw')?.textContent || '0 MW';
        const eff = document.getElementById('sbEfficiencyVal')?.textContent || '100%';
        const availableText = document.getElementById('sbStatAvailable')?.textContent || '';
        const consumedText = document.getElementById('sbStatConsumed')?.textContent || '';
        const balanceText = document.getElementById('sbStatBalance')?.textContent || '';
        const verdictText = document.getElementById('sbVerdictBox')?.innerText || '';
        const bChips = document.getElementById('sbBuildingChips')?.innerText || '';

        const lines = [
          `=== REPORTE ESPACIO LIBRE FICSIT (Satisfactory 1.0/1.2) ===`,
          `SUMINISTRO: ${availableText} (${supply.itemName})`,
          `CONSUMO TOTAL: ${consumedText}`,
          `BALANCE NETO: ${balanceText}`,
          `APROVECHAMIENTO: ${eff} | ENERGÍA: ${totalMw}`,
          ``,
          `DIAGNÓSTICO:`,
          verdictText,
          ``,
          `RAMAS DE PRODUCCIÓN Y DIVISIÓN:`,
        ];

        state.sandbox.branches.forEach((b, idx) => {
          const chain = SatisCalc.resolveBranchSubchain(supply.item, b.recipeId, b.machineCount);
          if (chain) {
            lines.push(`• Rama #${idx + 1}: ${b.machineCount}x ${chain.building.name} [${chain.recipe.name}] -> Produce ${chain.targetOutputTotal}/m ${chain.outItemMeta.name}`);
            if (!chain.isDirect) {
              const subStr = chain.intermediateSteps.map(s => `${s.machinesCount}x ${s.building.name} [${s.recipe.name}]`).join(', ');
              lines.push(`  - Pasos previos requeridos: ${subStr}`);
            }
            lines.push(`  - Consume de cinta troncal: ${chain.supplyIntakeRate}/m de ${supply.itemName} | Potencia: ${chain.totalPower} MW`);
          }
        });

        lines.push(``);
        lines.push(`EDIFICIOS Y LOGÍSTICA:`);
        lines.push(bChips);

        navigator.clipboard.writeText(lines.join('\n')).then(() => {
          const orig = btnCopySbReport.innerHTML;
          btnCopySbReport.innerHTML = '✅ ¡Copiado!';
          setTimeout(() => { btnCopySbReport.innerHTML = orig; }, 2000);
        });
      });
    }

    checkAutoSmeltVisibility();
    updateSandbox();
  }

  function getSandboxSupply() {
    let secondarySupply = null;
    if (state.sandbox.mode === 'miners' && state.sandbox.hasSecondary && state.sandbox.secondaryResource) {
      const secRes = state.sandbox.secondaryResource;
      const secPurity = state.sandbox.secondaryPurity || 'normal';
      const secTier = state.sandbox.secondaryMinerTier || 'miner_mk1';
      const secCount = Math.max(1, state.sandbox.secondaryMinerCount || 1);
      const secExt = SatisCalc.calculateExtraction(secPurity, secTier, 100);
      const secTotalRate = Number((secExt.rate * secCount).toFixed(2));
      const secPower = Number((secExt.powerMw * secCount).toFixed(1));
      const secMeta = SATIS_DATA.rawResources[secRes] || { name: secRes };
      const secBelt = SatisCalc.getBeltForRate(secTotalRate);
      secondarySupply = {
        item: secRes,
        itemName: secMeta.name,
        rate: secTotalRate,
        purity: secPurity,
        minerTier: secTier,
        minerCount: secCount,
        powerMw: secPower,
        recommendedBelt: secBelt
      };
    }

    if (state.sandbox.mode === 'miners') {
      const count = Math.max(1, state.sandbox.minerCount || 1);
      state.sandbox.minerNodes = state.sandbox.minerNodes || [];
      while (state.sandbox.minerNodes.length < count) {
        state.sandbox.minerNodes.push({
          purity: state.sandbox.purity || 'normal',
          minerTier: state.sandbox.minerTier || 'miner_mk1'
        });
      }
      if (state.sandbox.minerNodes.length > count) {
        state.sandbox.minerNodes = state.sandbox.minerNodes.slice(0, count);
      }

      let rawRate = 0;
      let minerPower = 0;
      state.sandbox.minerNodes.forEach(n => {
        const p1Calc = SatisCalc.calculateExtraction(n.purity || state.sandbox.purity, n.minerTier || state.sandbox.minerTier, 100);
        rawRate += p1Calc.rate;
        minerPower += p1Calc.powerMw;
      });
      rawRate = Number(rawRate.toFixed(2));
      minerPower = Number(minerPower.toFixed(1));
      const rawMeta = SATIS_DATA.rawResources[state.sandbox.resource] || { name: state.sandbox.resource };

      const smeltRecipe = SATIS_DATA.recipes.find(r => 
        r.building === 'smelter' && !r.isAlt && r.inputs.some(inp => inp.item === state.sandbox.resource)
      );

      if (smeltRecipe && state.sandbox.autoSmelt) {
        const inPerSmelter = smeltRecipe.inputs[0].rate;
        const outPerSmelter = smeltRecipe.outputs[0].rate;
        const smeltersNeeded = Number((rawRate / inPerSmelter).toFixed(2));
        const ingotRate = Number((smeltersNeeded * outPerSmelter).toFixed(2));
        const outItemMeta = SATIS_DATA.items[smeltRecipe.outputs[0].item] || { name: smeltRecipe.outputs[0].item };
        const smelterPower = smeltersNeeded * (SATIS_DATA.buildings.smelter?.power || 4);

        return {
          item: smeltRecipe.outputs[0].item,
          itemName: outItemMeta.name,
          rate: ingotRate,
          rawRate: rawRate,
          rawItem: state.sandbox.resource,
          rawItemName: rawMeta.name,
          isSmelted: true,
          smeltRecipe: smeltRecipe,
          smeltersNeeded: smeltersNeeded,
          smelterPower: smelterPower,
          minerPower: minerPower,
          secondary: secondarySupply
        };
      } else {
        return {
          item: state.sandbox.resource,
          itemName: rawMeta.name,
          rate: rawRate,
          rawRate: rawRate,
          rawItem: state.sandbox.resource,
          rawItemName: rawMeta.name,
          isSmelted: false,
          smeltRecipe: null,
          smeltersNeeded: 0,
          smelterPower: 0,
          minerPower: minerPower,
          secondary: secondarySupply
        };
      }
    } else {
      const freeItem = state.sandbox.freeItem;
      const itemMeta = SATIS_DATA.items[freeItem] || SATIS_DATA.rawResources[freeItem] || { name: freeItem };
      const rate = Math.max(0, Number(state.sandbox.freeRate) || 0);
      return {
        item: freeItem,
        itemName: itemMeta.name,
        rate: rate,
        rawRate: rate,
        rawItem: freeItem,
        rawItemName: itemMeta.name,
        isSmelted: false,
        smeltRecipe: null,
        smeltersNeeded: 0,
        smelterPower: 0,
        minerPower: 0,
        secondary: null
      };
    }
  }

  function applyAutoBalanceToBranches() {
    const supply = getSandboxSupply();
    if (!supply || supply.rate <= 0 || !state.sandbox.branches || state.sandbox.branches.length === 0) return;
    const recipeIds = state.sandbox.branches.map(b => b.recipeId);
    const opt = SatisCalc.optimizeBranchDistribution(supply.item, supply.rate, recipeIds);
    if (!opt) return;

    if (opt.bestInteger && opt.bestInteger.counts) {
      opt.bestInteger.counts.forEach((cnt, idx) => {
        if (state.sandbox.branches[idx]) {
          state.sandbox.branches[idx].machineCount = cnt;
        }
      });
    } else if (opt.continuousCounts) {
      opt.continuousCounts.forEach((cnt, idx) => {
        if (state.sandbox.branches[idx]) {
          state.sandbox.branches[idx].machineCount = cnt;
        }
      });
    }
  }

  function updateSandbox() {
    if (state.sandbox.autoBalance) {
      applyAutoBalanceToBranches();
    }

    const supply = getSandboxSupply();
    const trunkBelt = SatisCalc.getBeltForRate(supply.rate);

    // Update badges
    const sbAvailableBadge = document.getElementById('sbAvailableBadge');
    if (sbAvailableBadge) {
      let badgeHtml = `<span>${trunkBelt.name}:</span> <strong>${supply.rate.toFixed(1)} /min ${supply.itemName}</strong>`;
      if (supply.secondary) {
        badgeHtml += ` <span style="margin-left: 8px; padding-left: 8px; border-left: 1px solid rgba(255,255,255,0.25); color: #38bdf8;">⛏️ ${supply.secondary.rate.toFixed(1)} /min ${supply.secondary.itemName} (${supply.secondary.recommendedBelt.name})</span>`;
      }
      sbAvailableBadge.innerHTML = badgeHtml;
      sbAvailableBadge.style.color = trunkBelt.color;
      sbAvailableBadge.style.borderColor = trunkBelt.color;
    }

    const sbSmeltBadge = document.getElementById('sbSmeltSummaryBadge');
    if (sbSmeltBadge) {
      if (supply.isSmelted) {
        sbSmeltBadge.textContent = `🔥 ${supply.rate.toFixed(1)} Lingotes/min (${supply.smeltersNeeded} Hornos - ${supply.smelterPower.toFixed(1)} MW)`;
      } else {
        sbSmeltBadge.textContent = `Mineral directo sin fundición previa`;
      }
    }

    // Render individual miners in sandbox if minerCount > 1
    const sbIndivMinersContainer = document.getElementById('sbIndividualMinersContainer');
    const sbIndivMinersList = document.getElementById('sbIndividualMinersList');
    if (sbIndivMinersContainer && sbIndivMinersList) {
      if (state.sandbox.mode === 'miners' && state.sandbox.minerCount > 1) {
        sbIndivMinersContainer.style.display = 'block';
        sbIndivMinersList.innerHTML = (state.sandbox.minerNodes || []).map((n, idx) => {
          const calc = SatisCalc.calculateExtraction(n.purity, n.minerTier, 100);
          return `
            <div class="raw-drill-row">
              <div class="drill-row-header">
                <span class="drill-tag">⛏️ Taladro #${idx + 1}</span>
                <span class="drill-output-badge" style="color: #4ade80;">
                  <strong>+${calc.rate}/m</strong>
                  <span style="color: ${calc.recommendedBelt.color}; font-size: 0.68rem; font-weight: 700;">(${calc.recommendedBelt.name})</span>
                </span>
              </div>
              <div class="drill-row-controls">
                <div class="drill-control-group">
                  <span class="drill-sublabel">Pureza:</span>
                  <div class="raw-purity-group-sm">
                    <button type="button" class="btn-node-purity btn-sb-node-purity ${n.purity === 'impure' ? 'active' : ''}" data-index="${idx}" data-purity="impure">Impuro</button>
                    <button type="button" class="btn-node-purity btn-sb-node-purity ${n.purity === 'normal' ? 'active' : ''}" data-index="${idx}" data-purity="normal">Normal</button>
                    <button type="button" class="btn-node-purity btn-sb-node-purity ${n.purity === 'pure' ? 'active' : ''}" data-index="${idx}" data-purity="pure">Puro</button>
                  </div>
                </div>
                <div class="drill-control-group">
                  <span class="drill-sublabel">Nivel:</span>
                  <div class="raw-miner-group-sm">
                    <button type="button" class="btn-node-miner btn-sb-node-miner ${n.minerTier === 'miner_mk1' ? 'active' : ''}" data-index="${idx}" data-miner="miner_mk1">Mk.1</button>
                    <button type="button" class="btn-node-miner btn-sb-node-miner ${n.minerTier === 'miner_mk2' ? 'active' : ''}" data-index="${idx}" data-miner="miner_mk2">Mk.2</button>
                    <button type="button" class="btn-node-miner btn-sb-node-miner ${n.minerTier === 'miner_mk3' ? 'active' : ''}" data-index="${idx}" data-miner="miner_mk3">Mk.3</button>
                  </div>
                </div>
              </div>
            </div>
          `;
        }).join('');
      } else {
        sbIndivMinersContainer.style.display = 'none';
      }
    }

    // Find derivable recipes for this supply (direct + multi-tier)
    let supplyItems = [supply.item];
    if (supply.secondary && supply.secondary.item) {
      supplyItems.push(supply.secondary.item);
    }
    let derivableRecipes = SatisCalc.getDerivableRecipesForSupply(supplyItems);
    if (derivableRecipes.length === 0) {
      derivableRecipes = SATIS_DATA.recipes.map(r => ({
        ...r,
        isDirect: true,
        buildingName: (SATIS_DATA.buildings[r.building] || {}).name || r.building,
        tag: '⚡ [Directo]'
      }));
    }

    // Process branches with sub-chains
    let totalConsumed = 0;
    let branchDetails = [];
    const buildingCounts = {};
    let totalBranchPower = 0;
    const lineColors = ['#38bdf8', '#a855f7', '#f59e0b', '#10b981', '#ec4899', '#06b6d4'];

    if (state.sandbox.mode === 'miners') {
      const mName = SATIS_DATA.miners[state.sandbox.minerTier]?.name || 'Minero';
      buildingCounts[mName] = (buildingCounts[mName] || 0) + state.sandbox.minerCount;
    }
    if (supply.secondary) {
      const secMName = SATIS_DATA.miners[supply.secondary.minerTier]?.name || 'Minero (Secundario)';
      buildingCounts[secMName] = (buildingCounts[secMName] || 0) + supply.secondary.minerCount;
    }
    if (supply.isSmelted && supply.smeltersNeeded > 0) {
      buildingCounts['Hornos (Fundiciones)'] = (buildingCounts['Hornos (Fundiciones)'] || 0) + Math.ceil(supply.smeltersNeeded);
    }

    state.sandbox.branches.forEach((b, idx) => {
      // Ensure branch has a valid recipe
      if (!derivableRecipes.some(r => r.id === b.recipeId)) {
        b.recipeId = derivableRecipes[0].id;
      }

      const chain = SatisCalc.resolveBranchSubchain(supplyItems, b.recipeId, b.machineCount);
      if (!chain) return;

      totalConsumed += chain.supplyIntakeRate;
      totalBranchPower += chain.totalPower;

      // Accumulate all buildings (intermediate + target)
      for (const [bName, count] of Object.entries(chain.buildingCounts)) {
        buildingCounts[bName] = (buildingCounts[bName] || 0) + count;
      }

      branchDetails.push({
        index: idx,
        branch: b,
        chain: chain,
        recipe: chain.recipe,
        building: chain.building,
        primaryOut: chain.primaryOut,
        outItemMeta: chain.outItemMeta,
        branchOutputTotal: chain.targetOutputTotal,
        supplyIntakeRate: chain.supplyIntakeRate,
        isDirect: chain.isDirect,
        intermediateSteps: chain.intermediateSteps,
        totalPower: chain.totalPower,
        targetPower: chain.targetPower,
        secondaryInputs: chain.secondaryInputs,
        feederBelt: chain.feederBelt,
        outBelt: chain.outBelt
      });
    });

    totalConsumed = Number(totalConsumed.toFixed(2));
    const netBalance = Number((supply.rate - totalConsumed).toFixed(2));

    // Render Branch Cards HTML
    const branchesContainer = document.getElementById('sbBranchesList');
    if (branchesContainer) {
      branchesContainer.innerHTML = branchDetails.map((d, idx) => {
        const color = lineColors[idx % lineColors.length];
        const pctOfBelt = supply.rate > 0 ? ((d.supplyIntakeRate / supply.rate) * 100).toFixed(1) : '0';

        // Separate and format recipe dropdown options (direct vs subchains)
        const directRecipes = derivableRecipes.filter(r => r.isDirect);
        const subchainRecipes = derivableRecipes.filter(r => !r.isDirect);

        const directOptionsHtml = directRecipes.map(r => {
          const isSelected = r.id === d.recipe.id ? 'selected' : '';
          const outItem = SATIS_DATA.items[r.outputs[0]?.item] || SATIS_DATA.rawResources[r.outputs[0]?.item] || { name: r.outputs[0]?.item };
          const bldg = SATIS_DATA.buildings[r.building] || { name: r.building };
          return `<option value="${r.id}" ${isSelected}>⚡ ${outItem.name} — ${bldg.name} (${r.name})</option>`;
        }).join('');

        const subchainOptionsHtml = subchainRecipes.map(r => {
          const isSelected = r.id === d.recipe.id ? 'selected' : '';
          const outItem = SATIS_DATA.items[r.outputs[0]?.item] || SATIS_DATA.rawResources[r.outputs[0]?.item] || { name: r.outputs[0]?.item };
          const bldg = SATIS_DATA.buildings[r.building] || { name: r.building };
          return `<option value="${r.id}" ${isSelected}>🔄 ${outItem.name} — ${bldg.name} (${r.name})</option>`;
        }).join('');

        const selectOptionsHtml = `
          <optgroup label="⚡ Derivación Directa (1 Fase)">
            ${directOptionsHtml}
          </optgroup>
          ${subchainRecipes.length > 0 ? `
            <optgroup label="🔄 Cadenas Avanzadas (Múltiples Fases)">
              ${subchainOptionsHtml}
            </optgroup>
          ` : ''}
        `;

        // Calculate exact machine requirements for this branch (Hornos + Constructores + Ensambladoras)
        const branchSmelters = (supply.isSmelted && supply.smeltRecipe)
          ? Number((d.supplyIntakeRate / (supply.smeltRecipe.outputs[0]?.rate || 30)).toFixed(2))
          : 0;
        const branchOreIntake = (supply.isSmelted && supply.smeltRecipe)
          ? Number((branchSmelters * (supply.smeltRecipe.inputs[0]?.rate || 30)).toFixed(2))
          : 0;

        const branchMachineTotals = {};
        if (branchSmelters > 0) {
          branchMachineTotals['Hornos (Fundición)'] = branchSmelters;
        }

        d.intermediateSteps.forEach(step => {
          const bName = step.building.name || 'Constructora';
          branchMachineTotals[bName] = Number(((branchMachineTotals[bName] || 0) + step.machinesCount).toFixed(2));
        });

        const targetBldgName = d.building.name || 'Constructora';
        branchMachineTotals[targetBldgName] = Number(((branchMachineTotals[targetBldgName] || 0) + d.branch.machineCount).toFixed(2));

        const branchSummaryPhrase = Object.entries(branchMachineTotals)
          .map(([bName, count]) => {
            const formatted = Number.isInteger(count) ? count : Number(count.toFixed(2));
            return `<strong>${formatted}x ${bName}</strong>`;
          })
          .join(' + ');

        return `
          <div class="sandbox-branch-card" style="border-left: 4px solid ${color};">
            <div class="sandbox-branch-header">
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <span class="step-badge" style="background: ${color}; color: #0b111e; font-weight: 800;">RAMA #${idx + 1}</span>
                <strong style="color: #f1f5f9; font-size: 0.95rem; display: flex; align-items: center; gap: 6px;">${getBuildingIcon(d.building.id || d.building, 20)} ${d.recipe.name}</strong>
                ${!d.isDirect 
                  ? `<span class="badge" style="background: rgba(56, 189, 248, 0.15); border: 1px solid #38bdf8; color: #38bdf8; font-size: 0.72rem; font-weight: 700;">🔄 Sub-cadena (${d.intermediateSteps.length + 1} fases)</span>` 
                  : `<span class="badge" style="background: rgba(74, 222, 128, 0.15); border: 1px solid #4ade80; color: #4ade80; font-size: 0.72rem; font-weight: 700;">⚡ Directo</span>`
                }
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="belt-badge" style="color: #4ade80; border-color: #4ade80; font-size: 0.78rem; display: flex; align-items: center; gap: 4px;">
                  ${getItemIcon(d.primaryOut.item, 16)} Produce: ${d.branchOutputTotal} ${d.outItemMeta.name}/min
                </span>
                <button type="button" class="btn btn-secondary btn-open-branch-blueprint" data-index="${idx}" style="padding: 2px 8px; font-size: 0.75rem; border-color: #38bdf8; color: #38bdf8; display: inline-flex; align-items: center; gap: 4px; cursor: pointer;" title="Ver plano de planta aérea 2D para esta rama">
                  📐 Plano 2D
                </button>
                ${state.sandbox.branches.length > 1 ? `
                  <button type="button" class="btn btn-secondary btn-delete-branch" data-index="${idx}" style="padding: 2px 8px; font-size: 0.75rem; border-color: #ef4444; color: #ef4444;" title="Eliminar esta rama">
                    🗑️
                  </button>
                ` : ''}
              </div>
            </div>

            <div class="branch-config-grid">
              <div class="branch-recipe-col">
                <div class="branch-col-label">
                  <span style="font-weight: 700;">📦 Elegir Producto / Receta:</span>
                  <button type="button" class="btn btn-secondary btn-trigger-picker-text" data-index="${idx}" style="padding: 2px 8px; font-size: 0.72rem; border-color: #38bdf8; color: #38bdf8; cursor: pointer;" title="Abrir catálogo visual con tarjetas y fotos">
                    🔍 Catálogo Visual
                  </button>
                </div>
                <select class="form-select sb-branch-recipe-select" data-index="${idx}" style="font-weight: 700; border: 1px solid #38bdf8; background: #101826; color: #f8fafc; margin-bottom: 8px; cursor: pointer;" title="Selecciona directamente el producto o receta a fabricar">
                  ${selectOptionsHtml}
                </select>
                <div class="branch-recipe-current-card btn-trigger-recipe-picker" data-index="${idx}" title="Haz clic para ver detalles y catálogo visual">
                  <div style="display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1; overflow: hidden;">
                    <div class="recipe-avatar">${getItemIcon(d.primaryOut.item, 34)}</div>
                    <div style="min-width: 0; flex: 1;">
                      <div style="font-size: 0.95rem; font-weight: 800; color: #f8fafc; display: flex; align-items: center; gap: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        <span style="overflow: hidden; text-overflow: ellipsis;">${d.recipe.name}</span>
                        ${!d.isDirect 
                          ? `<span class="catalog-tag-subchain" style="font-size: 0.68rem; flex-shrink: 0;">🔄 ${d.intermediateSteps.length + 1} Fases</span>` 
                          : `<span class="catalog-tag-direct" style="font-size: 0.68rem;">⚡ Directo</span>`
                        }
                      </div>
                      <div style="font-size: 0.75rem; color: #94a3b8; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 4px;">
                        ${getBuildingIcon(d.building.id || d.building, 16)} <strong>${d.building.name}</strong> &bull; Entrega: <strong style="color: #4ade80; display: inline-flex; align-items: center; gap: 3px;">${getItemIcon(d.primaryOut.item, 14)} +${d.branchOutputTotal} ${d.outItemMeta.name}/min</strong>
                      </div>
                    </div>
                  </div>
                  <button type="button" class="btn btn-secondary btn-open-picker-hint" data-index="${idx}" style="font-size: 0.75rem; padding: 5px 10px; pointer-events: none; border-color: #38bdf8; color: #38bdf8; flex-shrink: 0; margin-left: 8px;">
                    🔍 Cambiar
                  </button>
                </div>
              </div>

              <div class="branch-machines-col">
                <div class="branch-col-label" style="color: #38bdf8;" title="Nº de ${d.building.name}s finales para ${d.outItemMeta.name}">
                  <span style="display: flex; align-items: center; gap: 4px; overflow: hidden; text-overflow: ellipsis;">
                    ${getBuildingIcon(d.building.id || d.building, 16)} Nº de ${d.building.name}s:
                  </span>
                </div>
                <div class="stepper-control branch-stepper-control">
                  <button type="button" class="stepper-btn sb-branch-minus" data-index="${idx}" title="Restar 1 máquina">-</button>
                  <input type="number" class="stepper-input sb-branch-count-input" data-index="${idx}" value="${d.branch.machineCount}" min="0.1" max="100" step="any" title="Número de máquinas">
                  <button type="button" class="stepper-btn sb-branch-plus" data-index="${idx}" title="Sumar 1 máquina">+</button>
                </div>
              </div>
            </div>

            <!-- CUADRO DE MAQUINARIA TOTAL REQUERIDA (HORNOS + CONSTRUCTORES + ENSAMBLADORAS) -->
            <div class="branch-machinery-box" style="margin-bottom: 12px; padding: 12px; background: rgba(15, 23, 42, 0.9); border: 1px solid rgba(56, 189, 248, 0.35); border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.25);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 6px;">
                <span style="font-size: 0.8rem; font-weight: 800; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 6px;">
                  🏗️ MAQUINARIA REQUERIDA EN ESTA RAMA:
                </span>
                <span style="color: #facc15; font-size: 0.78rem; font-weight: 700;">⚡ ${d.totalPower} MW requeridos</span>
              </div>

              <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px;">
                ${Object.entries(branchMachineTotals).map(([bName, count]) => {
                  const formatted = Number.isInteger(count) ? count : Number(count.toFixed(2));
                  let icon = '🏭';
                  let bColor = '#38bdf8';
                  if (bName.includes('Horno') || bName.includes('Fundic')) { icon = '🔥'; bColor = '#f97316'; }
                  else if (bName.includes('Constructor')) { icon = '⚙️'; bColor = '#38bdf8'; }
                  else if (bName.includes('Ensambla')) { icon = '🔧'; bColor = '#a855f7'; }
                  else if (bName.includes('Fabricante') || bName.includes('Manufac')) { icon = '🏭'; bColor = '#ec4899'; }
                  else if (bName.includes('Refin')) { icon = '🧪'; bColor = '#10b981'; }

                  return `
                    <div style="display: flex; align-items: center; gap: 8px; background: #0c1524; border: 1px solid ${bColor}40; border-left: 4px solid ${bColor}; border-radius: 6px; padding: 6px 12px; font-size: 0.85rem;">
                      <span style="font-size: 1.15rem;">${icon}</span>
                      <div>
                        <div style="color: #f8fafc; font-weight: 800; font-size: 0.95rem;">${formatted}x <span style="font-size: 0.82rem; font-weight: 600; color: #cbd5e1;">${bName}</span></div>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>

              <div style="font-size: 0.82rem; color: #f8fafc; background: rgba(56, 189, 248, 0.1); padding: 8px 12px; border-radius: 4px; border-left: 3px solid #38bdf8; line-height: 1.5;">
                💡 <strong>En esta rama colocarás:</strong> ${branchSummaryPhrase} para sacar de forma 100% continua <strong style="color: #4ade80;">+${d.branchOutputTotal} ${d.outItemMeta.name}/min</strong>.
              </div>
            </div>

            ${(!d.isDirect || branchSmelters > 0) ? `
              <!-- Desglose de Fases de Producción (Fundición previa y sub-cadenas) -->
              <div style="margin-bottom: 10px; padding: 10px 12px; background: #0c1524; border-radius: 6px; border: 1px solid rgba(56, 189, 248, 0.25);">
                <div style="font-size: 0.76rem; font-weight: 800; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center;">
                  <span>🔄 Desglose de Fases de Producción:</span>
                  <span style="color: #94a3b8; font-weight: 600; font-size: 0.72rem;">(Calculadas paso a paso para alimentar la meta)</span>
                </div>
                <div style="display: flex; flex-direction: column; gap: 6px; font-size: 0.78rem;">
                  ${branchSmelters > 0 ? `
                    <div style="padding: 6px 10px; background: #131c2b; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; border-left: 3px solid #f97316;">
                      <div>
                        <strong>Fase Previa (Fundición):</strong> <strong style="color: #f97316;">${branchSmelters}x Hornos (Fundición)</strong> [${supply.smeltRecipe.name}]
                        <span style="color: var(--text-muted); font-size: 0.74rem; display: block; margin-top: 2px;">
                          • Consume: ${branchOreIntake}/m ${supply.rawItemName} ➔ Entrega: <strong style="color: #4ade80;">${d.supplyIntakeRate}/m de ${supply.itemName}</strong>
                        </span>
                      </div>
                      <span style="color: #facc15; font-size: 0.75rem; font-weight: 700; white-space: nowrap;">⚡ ${(branchSmelters * (SATIS_DATA.buildings.smelter?.power || 4)).toFixed(1)} MW</span>
                    </div>
                  ` : ''}
                  ${d.intermediateSteps.map((step, sIdx) => `
                    <div style="padding: 6px 10px; background: #131c2b; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; border-left: 3px solid #f59e0b;">
                      <div>
                        <strong>Paso Intermedio ${sIdx + 1}:</strong> <strong style="color: #facc15;">${step.machinesCount}x ${step.building.name}</strong> [${step.recipe.name}]
                        <span style="color: var(--text-muted); font-size: 0.74rem; display: block; margin-top: 2px;">
                          • Consume: ${step.mainInputRate}/m ${SATIS_DATA.items[step.mainInputItem]?.name || SATIS_DATA.rawResources[step.mainInputItem]?.name || step.mainInputItem} ➔ Entrega: <strong style="color: #4ade80;">${step.outputRate}/m de ${step.itemName}</strong>
                        </span>
                      </div>
                      <span style="color: #facc15; font-size: 0.75rem; font-weight: 700; white-space: nowrap;">⚡ ${step.power} MW</span>
                    </div>
                  `).join('')}
                  <div style="padding: 6px 10px; background: #131c2b; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; border-left: 3px solid #4ade80;">
                    <div>
                      <strong>Paso Final:</strong> <strong style="color: #4ade80;">${d.branch.machineCount}x ${d.building.name}</strong> [${d.recipe.name}]
                      <span style="color: var(--text-muted); font-size: 0.74rem; display: block; margin-top: 2px;">
                        • Recibe las materias anteriores y entrega: <strong style="color: #4ade80;">${d.branchOutputTotal}/m de ${d.outItemMeta.name}</strong>
                      </span>
                    </div>
                    <span style="color: #facc15; font-size: 0.75rem; font-weight: 700; white-space: nowrap;">⚡ ${d.targetPower} MW</span>
                  </div>
                </div>
              </div>
            ` : ''}

            <div style="background: #0d131f; border-radius: 4px; padding: 10px 12px; font-size: 0.8rem; line-height: 1.6; border: 1px solid rgba(255,255,255,0.05);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <span>• <strong>Toma de la cinta troncal:</strong> <strong style="color: #facc15;">${d.supplyIntakeRate} de los ${supply.rate} /min</strong> de ${supply.itemName}</span>
                <span class="belt-badge" style="font-size: 0.7rem; color: ${d.feederBelt.color}; border-color: ${d.feederBelt.color};">
                  ${pctOfBelt}% de la cinta (${d.feederBelt.name})
                </span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <span>• <strong>Edificios requeridos:</strong> ${branchSummaryPhrase}</span>
                <span style="color: #facc15; font-weight: 700;">⚡ ${d.totalPower} MW</span>
              </div>
              ${!d.isDirect ? `
                <div style="margin-bottom: 4px; color: #facc15; font-size: 0.76rem; background: rgba(250, 204, 21, 0.08); padding: 4px 8px; border-radius: 4px; border-left: 2px solid #facc15;">
                  • <strong>Cadena intermedia previa requerida:</strong> ${d.intermediateSteps.map(s => `<strong>${s.machinesCount}x ${s.building.name}</strong> de ${s.itemName}`).join(' + ')}
                </div>
              ` : ''}
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span>• <strong>Producción neta entregada:</strong> <strong style="color: #4ade80;">+${d.branchOutputTotal} ${d.outItemMeta.name}/min</strong></span>
                <span class="belt-badge" style="font-size: 0.7rem; color: ${d.outBelt.color}; border-color: ${d.outBelt.color};">${d.outBelt.name}</span>
              </div>
              ${d.secondaryInputs.map(sec => `
                <div style="margin-top: 6px; padding: 4px 8px; background: rgba(245, 158, 11, 0.12); border-left: 3px solid #f59e0b; border-radius: 3px; font-size: 0.75rem; color: #fbbf24;">
                  ⚠️ <strong>Insumo extra a traer por otra cinta:</strong> Traer <strong>${sec.totalRate} /min de ${sec.name}</strong> para abastecer esta línea.
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }).join('');
    }

    // Render Auto-Optimization Panel Explanations and Chips
    const opt = SatisCalc.optimizeBranchDistribution(supply.item, supply.rate, state.sandbox.branches.map(b => b.recipeId));
    const expBox = document.getElementById('sbAutoOptimizationExplanation');
    if (expBox && opt) {
      const is100 = (Math.abs(netBalance) < 0.05);
      const branchLines = branchDetails.map((d, bIdx) => {
        const pct = supply.rate > 0 ? ((d.supplyIntakeRate / supply.rate) * 100).toFixed(1) : '0';
        const subStepsText = !d.isDirect 
          ? ` <span style="color: #facc15;">(alimentadas por ${d.intermediateSteps.map(s => `<strong>${s.machinesCount}x ${s.building.name}</strong> de ${s.itemName}`).join(', ')})</span>`
          : '';
        const branchSmeltersTxt = (supply.isSmelted && supply.smeltRecipe)
          ? ` <span style="color: #f97316;">(requiere ${Number((d.supplyIntakeRate / (supply.smeltRecipe.outputs[0]?.rate || 30)).toFixed(2))}x Hornos)</span>`
          : '';
        return `
          <div style="padding: 3px 0;">
            • <strong>Rama #${bIdx + 1} (${d.recipe.name}):</strong> Consume <strong style="color: #facc15;">${d.supplyIntakeRate} de los ${supply.rate}</strong> ${supply.itemName}/min (${pct}%)${branchSmeltersTxt} ➔ <strong style="color: #4ade80;">${d.branch.machineCount}x ${d.building.name}</strong>${subStepsText} para fabricar <strong style="color: #4ade80;">+${d.branchOutputTotal} ${d.outItemMeta.name}/min</strong>.
          </div>
        `;
      }).join('');

      let statusBadge = is100 
        ? `<span class="badge" style="background: rgba(74, 222, 128, 0.2); color: #4ade80; font-weight: 800; font-size: 0.78rem;">🟢 100% Saturación Exacta (0 Desperdicio)</span>`
        : (netBalance > 0 
            ? `<span class="badge" style="background: rgba(250, 204, 21, 0.2); color: #facc15; font-weight: 800; font-size: 0.78rem;">🟡 Sobran +${netBalance.toFixed(1)}/min</span>` 
            : `<span class="badge" style="background: rgba(239, 68, 68, 0.2); color: #ef4444; font-weight: 800; font-size: 0.78rem;">🔴 Faltan ${Math.abs(netBalance).toFixed(1)}/min</span>`
          );

      expBox.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; flex-wrap: wrap; gap: 6px;">
          <span style="font-weight: 800; color: #38bdf8; font-size: 0.9rem;">
            💡 Reparto Exacto de tus ${supply.rate.toFixed(1)} ${supply.itemName}/min disponibles:
          </span>
          ${statusBadge}
        </div>
        <div style="font-size: 0.83rem; line-height: 1.5; color: #f1f5f9;">
          ${branchLines}
        </div>
        <div style="margin-top: 6px; font-size: 0.75rem; color: #94a3b8; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 5px;">
          ✨ <em>FICSIT ha calculado la división óptima de tus máquinas para sacar el máximo rendimiento continuo.</em>
        </div>
      `;
    }

    // Render Solutions Chips
    const chipsBox = document.getElementById('sbOptimalSolutionsChips');
    if (chipsBox && opt && opt.solutions && opt.solutions.length > 0) {
      chipsBox.innerHTML = opt.solutions.map((sol, sIdx) => {
        const countsKey = sol.counts.join(',');
        const currentCountsKey = state.sandbox.branches.map(b => b.machineCount).join(',');
        const isActive = countsKey === currentCountsKey;
        
        let label = '';
        if (sIdx === 0) label = `⚖️ Equilibrado`;
        else if (sol.counts[0] > (sol.counts[1] || 0)) label = `📈 Más ${branchDetails[0]?.outItemMeta?.name || 'Rama 1'}`;
        else label = `📈 Más ${branchDetails[1]?.outItemMeta?.name || 'Rama 2'}`;

        const subDetail = sol.counts.map((c, i) => `${c}x ${branchDetails[i]?.outItemMeta?.name || `R${i+1}`}`).join(' + ');

        return `
          <button type="button" class="solution-chip ${isActive ? 'active' : ''}" data-counts="${countsKey}" title="Aplicar automáticamente esta combinación óptima">
            <span>${label}:</span>
            <strong>${subDetail}</strong>
            <span style="font-size: 0.7rem; color: ${sol.isExact100 ? '#4ade80' : '#facc15'};">(${sol.efficiency}%)</span>
          </button>
        `;
      }).join('');
    }

    // Update Balance Bar & Stats
    document.getElementById('sbStatAvailable').textContent = `${supply.rate.toFixed(1)} /min`;
    document.getElementById('sbStatConsumed').textContent = `${totalConsumed.toFixed(1)} /min`;

    const statBal = document.getElementById('sbStatBalance');
    const barFill = document.getElementById('sbBalanceBarFill');
    const verdictBox = document.getElementById('sbVerdictBox');

    if (netBalance > 0.05) {
      // SOBRA / EXCEDENTE
      const pct = supply.rate > 0 ? Math.min(100, (totalConsumed / supply.rate) * 100) : 0;
      statBal.textContent = `+${netBalance.toFixed(1)} /min (Sobra)`;
      statBal.style.color = '#facc15';
      barFill.style.width = `${pct}%`;
      barFill.style.background = '#facc15';
      verdictBox.className = 'verdict-alert-box surplus';

      let expansionTips = branchDetails.map(d => {
        const intakePerUnit = d.supplyIntakeRate / d.branch.machineCount;
        const extraM = intakePerUnit > 0 ? (netBalance / intakePerUnit).toFixed(1) : '0';
        const extraP = (extraM * d.primaryOut.rate).toFixed(1);
        return `• <strong>+${extraM}x ${d.building.name}</strong> de ${d.recipe.name} (te daría +${extraP} ${d.outItemMeta.name}/min)`;
      }).join('<br>');

      verdictBox.innerHTML = `
        <div style="font-weight: 800; font-size: 0.95rem; margin-bottom: 6px; color: #facc15; display: flex; align-items: center; gap: 8px;">
          <span>🟡 TE SOBRAN ${netBalance.toFixed(1)} ${supply.itemName}/min</span>
          <span style="font-size: 0.75rem; background: rgba(250, 204, 21, 0.2); padding: 2px 8px; border-radius: 4px;">Uso: ${pct.toFixed(1)}%</span>
        </div>
        <div>Tus máquinas están 100% abastecidas, pero estás dejando <strong>${netBalance.toFixed(1)} /min</strong> sin procesar en la cinta troncal.</div>
        <div style="margin-top: 8px; font-weight: 700; color: #fef08a;">💡 Opciones de FICSIT para aprovechar el sobrante:</div>
        <div style="margin-top: 4px; padding-left: 6px; border-left: 2px solid #facc15; font-size: 0.8rem; line-height: 1.5;">
          ${expansionTips}<br>
          • <strong>O derivar a Awesome Sink:</strong> Coloca un Smart Splitter con desbordamiento (<em>Overflow</em>) al final para triturar los ${netBalance.toFixed(1)}/m sobrantes y ganar cupones.
        </div>
      `;
    } else if (netBalance < -0.05) {
      // FALTA / DÉFICIT
      const deficit = Math.abs(netBalance);
      statBal.textContent = `-${deficit.toFixed(1)} /min (Falta)`;
      statBal.style.color = '#ef4444';
      barFill.style.width = '100%';
      barFill.style.background = '#ef4444';
      verdictBox.className = 'verdict-alert-box deficit';

      const underclockPct = totalConsumed > 0 ? ((supply.rate / totalConsumed) * 100).toFixed(1) : 0;

      verdictBox.innerHTML = `
        <div style="font-weight: 800; font-size: 0.95rem; margin-bottom: 6px; color: #ef4444; display: flex; align-items: center; gap: 8px;">
          <span>🔴 TE FALTAN ${deficit.toFixed(1)} ${supply.itemName}/min</span>
          <span style="font-size: 0.75rem; background: rgba(239, 68, 68, 0.2); padding: 2px 8px; border-radius: 4px;">Déficit de flujo</span>
        </div>
        <div>¡Alerta de desabastecimiento! Las ramas intentan consumir <strong>${totalConsumed.toFixed(1)} /min</strong>, pero solo entran <strong>${supply.rate.toFixed(1)} /min</strong>. Las máquinas finales parpadearán en amarillo y se detendrán intermitentemente.</div>
        <div style="margin-top: 8px; font-weight: 700; color: #fca5a5;">💡 Soluciones FICSIT recomendadas:</div>
        <div style="margin-top: 4px; padding-left: 6px; border-left: 2px solid #ef4444; font-size: 0.8rem; line-height: 1.5;">
          • <strong>Opción A (Aumentar entrada):</strong> Sube la extracción o agrega otro nodo para traer los <strong>+${deficit.toFixed(1)} /min</strong> faltantes.<br>
          • <strong>Opción B (Underclocking inteligente):</strong> Baja el reloj de todas tus máquinas al <strong>${underclockPct}%</strong>. Consumirán exactamente los ${supply.rate.toFixed(1)}/min disponibles, operarán al 100% continuas y reducirás el consumo eléctrico drásticamente.<br>
          • <strong>Opción C (Reducir máquinas):</strong> Reduce la cantidad de máquinas en alguna de las ramas hasta igualar el consumo.
        </div>
      `;
    } else {
      // BALANCE ÓPTIMO
      statBal.textContent = `0.0 /min (Exacto)`;
      statBal.style.color = '#4ade80';
      barFill.style.width = '100%';
      barFill.style.background = '#4ade80';
      verdictBox.className = 'verdict-alert-box optimal';

      verdictBox.innerHTML = `
        <div style="font-weight: 800; font-size: 0.95rem; margin-bottom: 6px; color: #4ade80; display: flex; align-items: center; gap: 8px;">
          <span>🟢 ¡BALANCE 100% PERFECTO!</span>
          <span style="font-size: 0.75rem; background: rgba(74, 222, 128, 0.2); padding: 2px 8px; border-radius: 4px;">Saturación exacta</span>
        </div>
        <div>¡Eficiencia FICSIT absoluta! Todo el material suministrado (<strong>${supply.rate.toFixed(1)} ${supply.itemName}/min</strong>) se reparte y consume de manera exacta entre tus ${branchDetails.length} ramas.</div>
        <div style="margin-top: 6px; font-size: 0.82rem; color: #bbf7d0;">
          • No hay acumulación de cintas, ni cuellos de botella, ni máquinas apagadas por falta de recursos.
        </div>
      `;
    }

    // Render Splitter Schematic
    renderSandboxSplittersSchematic(branchDetails, supply, trunkBelt, netBalance);

    // Render 2D Aerial Interactive Blueprint (Sandbox Distribution & Splitters)
    renderSandboxBlueprint(supply, branchDetails, netBalance);

    // Update Right Column (Shopping List & Energy)
    const totalPowerMw = supply.minerPower + (supply.secondary ? supply.secondary.powerMw : 0) + supply.smelterPower + totalBranchPower;
    document.getElementById('sbTotalMw').textContent = `${totalPowerMw.toFixed(1)} MW`;

    const effVal = supply.rate > 0 ? Math.min(100, (totalConsumed / supply.rate) * 100).toFixed(1) : 0;
    document.getElementById('sbEfficiencyVal').textContent = `${effVal}%`;

    // Calculate Splitters & Mergers across whole factory
    const trunkSplitters = Math.max(0, state.sandbox.branches.length - 1);
    let internalSplitters = 0;
    let internalMergers = 0;
    branchDetails.forEach(d => {
      // Target machine splitters/mergers
      internalSplitters += Math.max(0, Math.ceil(d.branch.machineCount - 1));
      internalMergers += Math.max(0, Math.ceil(d.branch.machineCount - 1));
      // Intermediate machines splitters/mergers
      d.intermediateSteps.forEach(step => {
        internalSplitters += Math.max(0, Math.ceil(step.machinesCount - 1));
        internalMergers += Math.max(0, Math.ceil(step.machinesCount - 1));
      });
    });
    if (supply.isSmelted && supply.smeltersNeeded > 1) {
      internalSplitters += Math.ceil(supply.smeltersNeeded - 1);
      internalMergers += Math.ceil(supply.smeltersNeeded - 1);
    }
    const totalSplitters = trunkSplitters + internalSplitters;

    const bChipsContainer = document.getElementById('sbBuildingChips');
    if (bChipsContainer) {
      const chips = [];
      for (const [bName, count] of Object.entries(buildingCounts)) {
        chips.push(`
          <div class="diagram-branch optimal" style="padding: 6px 10px;">
            <span>• <strong>${count}x</strong> ${bName}</span>
          </div>
        `);
      }
      if (totalSplitters > 0) {
        chips.push(`
          <div class="diagram-branch" style="border-left-color: #f59e0b; padding: 6px 10px;">
            <span>• <strong>${totalSplitters}x</strong> Divisores (Splitters)</span>
          </div>
        `);
      }
      if (internalMergers > 0) {
        chips.push(`
          <div class="diagram-branch" style="border-left-color: #38bdf8; padding: 6px 10px;">
            <span>• <strong>${internalMergers}x</strong> Unidores (Mergers)</span>
          </div>
        `);
      }
      bChipsContainer.innerHTML = chips.join('');
    }

    // Belts Logistics Box
    const beltsBox = document.getElementById('sbBeltsLogistics');
    if (beltsBox) {
      let bLines = [`• <strong>Troncal principal:</strong> ${trunkBelt.name} (${supply.rate.toFixed(1)}/m)`];
      branchDetails.forEach((d, idx) => {
        bLines.push(`• <strong>Entrada Rama #${idx + 1}:</strong> ${d.feederBelt.name} (${d.supplyIntakeRate}/m de ${supply.itemName})`);
        if (!d.isDirect) {
          d.intermediateSteps.forEach(s => {
            bLines.push(`  - Cinta interna [${s.itemName}]: ${s.outBelt.name} (${s.outputRate}/m)`);
          });
        }
        bLines.push(`• <strong>Salida Rama #${idx + 1}:</strong> ${d.outBelt.name} (${d.branchOutputTotal}/m ${d.outItemMeta.name})`);
      });
      beltsBox.innerHTML = bLines.join('<br>');
    }
  }

  function renderSandboxSplittersSchematic(branches, supply, trunkBelt, netBalance) {
    const schematicBox = document.getElementById('sbSplitterSchematicBox');
    if (!schematicBox) return;

    if (branches.length === 0) {
      schematicBox.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem;">Agrega al menos una rama de producción para ver el esquema de división.</div>';
      return;
    }

    if (branches.length === 1) {
      const b0 = branches[0];
      const manifold = SatisCalc.calculateManifoldFlow(supply.rate, b0.supplyIntakeRate / b0.branch.machineCount, b0.branch.machineCount);

      schematicBox.innerHTML = `
        <div class="schematic-box">
          <div class="schematic-title">
            <span>🛤️ LÍNEA DIRECTA SIN DIVISIONES DE RAMA</span>
            <span class="splitter-badge-tag">${manifold.splittersNeeded} Splitters en fila</span>
          </div>
          <div style="font-size: 0.83rem; line-height: 1.6; color: var(--text-main);">
            • La cinta troncal <strong>${trunkBelt.name} (${supply.rate}/m de ${supply.itemName})</strong> alimenta esta rama.<br>
            ${!b0.isDirect 
              ? `• 🔄 <strong>Sub-cadena previa:</strong> Entra primero a ${b0.intermediateSteps.map(s => `<strong>${s.machinesCount}x ${s.building.name} [${s.recipe.name}]</strong>`).join(' ➔ ')}, alimentando luego a los <strong>${b0.branch.machineCount}x ${b0.building.name}</strong> finales.<br>` 
              : `• Conexión directa a los <strong>${b0.branch.machineCount}x ${b0.building.name}</strong>.<br>`
            }
            • Salida final: <strong style="color: #4ade80;">${b0.branchOutputTotal} /min de ${b0.outItemMeta.name}</strong> (${b0.outBelt.name}).
          </div>
        </div>
      `;
      return;
    }

    // Multiple branches: Sequential Splitter Cascade
    let currentFlow = supply.rate;
    let stepItems = [];

    branches.forEach((b, idx) => {
      const isLast = (idx === branches.length - 1);
      const splitNumber = idx + 1;
      const divertedFlow = b.supplyIntakeRate;
      const feedBelt = b.feederBelt;
      const passThroughFlow = Math.max(0, Number((currentFlow - divertedFlow).toFixed(2)));
      const passBelt = SatisCalc.getBeltForRate(passThroughFlow);

      stepItems.push(`
        <div class="splitter-step-item" style="border-left: 3px solid ${feedBelt.color};">
          <div style="display: flex; flex-direction: column; gap: 3px; width: 100%;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <strong style="color: #38bdf8;">🔀 Splitter Troncal #${splitNumber}:</strong>
              <span class="badge" style="background: rgba(255,255,255,0.06); font-size: 0.72rem;">Llega: ${currentFlow.toFixed(1)}/m</span>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-main); line-height: 1.5; margin-top: 4px;">
              ➔ <strong>Salida A (Hacia Rama #${idx + 1}):</strong> Deriva <strong style="color: #facc15;">${divertedFlow} /min</strong> en <strong>${feedBelt.name}</strong>.
              ${!b.isDirect ? `
                <div style="padding-left: 12px; margin-top: 4px; font-size: 0.75rem; color: var(--text-muted); border-left: 2px solid #38bdf8;">
                  • 🔄 <strong>Cadena interna requerida:</strong> Alimenta primero a <strong>${b.intermediateSteps.map(s => `${s.machinesCount}x ${s.building.name} [${s.recipe.name}]`).join(' ➔ ')}</strong>, y su producto alimenta a las <strong>${b.branch.machineCount}x ${b.building.name}</strong> finales de ${b.recipe.name}.
                </div>
              ` : `
                <span style="font-size: 0.75rem; color: var(--text-muted); padding-left: 12px; display: block;">
                  • Conexión directa a las ${b.branch.machineCount}x ${b.building.name} (${b.recipe.name}).
                </span>
              `}
              ➔ <strong>Salida B (Continuación troncal):</strong> Los restantes <strong style="color: #38bdf8;">${passThroughFlow} /min</strong> continúan en <strong>${passBelt.name}</strong> ${!isLast ? `hacia el Splitter #${splitNumber + 1}.` : (netBalance > 0 ? 'hacia almacenamiento o Awesome Sink (sobrante).' : 'quedando la cinta en 0.')}
            </div>
          </div>
        </div>
      `);

      currentFlow = passThroughFlow;
    });

    schematicBox.innerHTML = `
      <div class="schematic-box">
        <div class="schematic-title">
          <span>🔀 CÓMO DIVIDIR LA CINTA TRONCAL (${trunkBelt.name}: ${supply.rate}/m ${supply.itemName})</span>
          <span class="splitter-badge-tag">${branches.length - 1}x Splitters Principales</span>
        </div>
        <div class="splitter-step-list">
          ${stepItems.join('')}
        </div>
        <div style="margin-top: 10px; font-size: 0.78rem; color: var(--text-muted); line-height: 1.5; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 6px;">
          💡 <strong>Principio Manifold de Satisfactory:</strong> Al dividir en cascada, los splitters se autorregulan en pocos minutos. Cada rama recibe exactamente su cuota calculada.
        </div>
      </div>
    `;
  }

  // =========================================================================
  // 1.85. PLANO AÉREO 2D DE ESPACIO LIBRE (DISTRIBUCIÓN Y BALANCE POR SPLITTERS)
  // =========================================================================
  function applySandboxBlueprintTransform(canvasEl, stateObj) {
    if (!canvasEl) return;
    canvasEl.style.transform = `translate(${stateObj.panX}px, ${stateObj.panY}px) scale(${stateObj.scale})`;
  }

  function fitSandboxBlueprintToViewport() {
    const viewport = document.getElementById('sandboxBlueprintViewport');
    const canvas = document.getElementById('sandboxBlueprintCanvas');
    if (!viewport || !canvas || !sbBpState.currentModel) return;

    const vW = viewport.clientWidth || 900;
    const vH = viewport.clientHeight || 540;
    const mW = sbBpState.currentModel.totalW;
    const mH = sbBpState.currentModel.totalH;

    const pad = 24;
    const scale = Math.min((vW - pad * 2) / mW, (vH - pad * 2) / mH);
    sbBpState.scale = Math.max(0.3, Math.min(1.2, Number(scale.toFixed(3))));
    sbBpState.panX = Math.round((vW - mW * sbBpState.scale) / 2);
    sbBpState.panY = Math.round((vH - mH * sbBpState.scale) / 2);

    applySandboxBlueprintTransform(canvas, sbBpState);
  }

  function initSandboxBlueprintInteractions() {
    const viewport = document.getElementById('sandboxBlueprintViewport');
    const canvas = document.getElementById('sandboxBlueprintCanvas');
    if (!viewport || !canvas || sbBpState.isInitialized) return;
    sbBpState.isInitialized = true;

    // Pan / Drag
    viewport.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      sbBpState.isDragging = true;
      sbBpState.startX = e.clientX - sbBpState.panX;
      sbBpState.startY = e.clientY - sbBpState.panY;
      viewport.style.cursor = 'grabbing';
      canvas.classList.add('is-navigating');
    });

    window.addEventListener('mousemove', (e) => {
      if (!sbBpState.isDragging) return;
      sbBpState.panX = e.clientX - sbBpState.startX;
      sbBpState.panY = e.clientY - sbBpState.startY;
      applySandboxBlueprintTransform(canvas, sbBpState);
    });

    window.addEventListener('mouseup', () => {
      if (sbBpState.isDragging) {
        sbBpState.isDragging = false;
        viewport.style.cursor = 'grab';
        canvas.classList.remove('is-navigating');
      }
    });

    // Zoom on wheel centered on cursor
    let zoomTimer = null;
    viewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      sbBpState.isZooming = true;
      canvas.classList.add('is-navigating');

      const rect = viewport.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      const newScale = Math.max(0.2, Math.min(2.8, sbBpState.scale * zoomFactor));

      sbBpState.panX = mouseX - (mouseX - sbBpState.panX) * (newScale / sbBpState.scale);
      sbBpState.panY = mouseY - (mouseY - sbBpState.panY) * (newScale / sbBpState.scale);
      sbBpState.scale = newScale;

      applySandboxBlueprintTransform(canvas, sbBpState);

      clearTimeout(zoomTimer);
      zoomTimer = setTimeout(() => {
        sbBpState.isZooming = false;
        canvas.classList.remove('is-navigating');
      }, 160);
    }, { passive: false });

    // Toolbar buttons
    const btnIn = document.getElementById('btnSbBpZoomIn');
    const btnOut = document.getElementById('btnSbBpZoomOut');
    const btnReset = document.getElementById('btnSbBpReset');
    const btnToggleFocus = document.getElementById('btnSbBpToggleFocus');
    const btnFs = document.getElementById('btnSbBpFullscreen');

    if (btnIn) btnIn.addEventListener('click', () => {
      sbBpState.scale = Math.min(2.8, sbBpState.scale * 1.25);
      applySandboxBlueprintTransform(canvas, sbBpState);
    });

    if (btnOut) btnOut.addEventListener('click', () => {
      sbBpState.scale = Math.max(0.2, sbBpState.scale * 0.8);
      applySandboxBlueprintTransform(canvas, sbBpState);
    });

    if (btnReset) btnReset.addEventListener('click', () => {
      fitSandboxBlueprintToViewport();
    });

    if (btnToggleFocus) {
      btnToggleFocus.addEventListener('click', () => {
        sbBpState.focusModeEnabled = !sbBpState.focusModeEnabled;
        if (!sbBpState.focusModeEnabled) {
          canvas.classList.add('inspection-disabled');
          btnToggleFocus.innerHTML = '🎯 Foco: Desactivado';
          btnToggleFocus.style.opacity = '0.7';
        } else {
          canvas.classList.remove('inspection-disabled');
          btnToggleFocus.innerHTML = '🎯 Foco: Suave';
          btnToggleFocus.style.opacity = '1';
        }
      });
    }

    if (btnFs) btnFs.addEventListener('click', () => {
      const card = document.getElementById('sandboxBlueprintSection');
      if (!card) return;
      const isFs = card.classList.toggle('is-fullscreen');
      btnFs.innerHTML = isFs ? '✕ Salir' : '⛶ Pantalla Completa';
      setTimeout(() => fitSandboxBlueprintToViewport(), 150);
    });
  }

  function attachSandboxBlueprintHoverTooltips() {
    const viewport = document.getElementById('sandboxBlueprintViewport');
    const tooltip = document.getElementById('sandboxBlueprintTooltip');
    const canvas = document.getElementById('sandboxBlueprintCanvas');
    if (!viewport || !tooltip || !canvas) return;

    function moveTooltip(e) {
      const rect = viewport.getBoundingClientRect();
      const x = e.clientX - rect.left + 15;
      const y = e.clientY - rect.top + 15;
      tooltip.style.left = `${Math.min(viewport.clientWidth - 260, Math.max(10, x))}px`;
      tooltip.style.top = `${Math.min(viewport.clientHeight - 140, Math.max(10, y))}px`;
    }

    // Mineros
    canvas.querySelectorAll('.blueprint-node-miner').forEach(node => {
      node.addEventListener('mouseenter', (e) => {
        if (sbBpState.isZooming || sbBpState.isDragging) return;
        const name = node.getAttribute('data-name');
        const rate = node.getAttribute('data-rate');
        const power = node.getAttribute('data-power');
        tooltip.innerHTML = `
          <div style="font-weight: 800; color: #f97316; font-size: 0.88rem; margin-bottom: 4px;">⛏️ Estación de Extracción FICSIT</div>
          <div><strong>Recurso:</strong> <span style="color: #f8fafc;">${name}</span></div>
          <div><strong>Tasa de Extracción:</strong> <span style="color: #4ade80; font-weight: 800;">+${rate}/min</span></div>
          <div><strong>Consumo Eléctrico:</strong> <span style="color: #38bdf8;">⚡ ${power} MW</span></div>
        `;
        tooltip.style.display = 'block';
        moveTooltip(e);
      });
      node.addEventListener('mousemove', moveTooltip);
      node.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });
    });

    // Hornos / Fundición
    canvas.querySelectorAll('.blueprint-node-smelter').forEach(node => {
      node.addEventListener('mouseenter', (e) => {
        if (sbBpState.isZooming || sbBpState.isDragging) return;
        const name = node.getAttribute('data-name');
        const count = node.getAttribute('data-count');
        const power = node.getAttribute('data-power');
        tooltip.innerHTML = `
          <div style="font-weight: 800; color: #fbbf24; font-size: 0.88rem; margin-bottom: 4px;">🔥 Batería de Hornos (Fundición)</div>
          <div><strong>Edificios:</strong> <span style="color: #f8fafc; font-weight: 800;">${count}x Fundición</span></div>
          <div><strong>Consumo Eléctrico:</strong> <span style="color: #38bdf8;">⚡ ${power} MW</span></div>
          <div style="font-size: 0.72rem; color: #94a3b8; margin-top: 4px;">Convierte mineral crudo en lingotes antes de repartir por splitters.</div>
        `;
        tooltip.style.display = 'block';
        moveTooltip(e);
      });
      node.addEventListener('mousemove', moveTooltip);
      node.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });
    });

    // Splitters Troncales
    canvas.querySelectorAll('.blueprint-node-splitter').forEach(node => {
      node.addEventListener('mouseenter', (e) => {
        if (sbBpState.isZooming || sbBpState.isDragging) return;
        const idx = parseInt(node.getAttribute('data-split-index'), 10) + 1;
        const inFlow = node.getAttribute('data-in');
        const divert = node.getAttribute('data-divert');
        const pass = node.getAttribute('data-pass');
        tooltip.innerHTML = `
          <div style="font-weight: 800; color: #f59e0b; font-size: 0.88rem; margin-bottom: 4px;">🔀 Divisor Troncal (Splitter #${idx})</div>
          <div><strong>Caudal entrante:</strong> <span style="color: #facc15; font-weight: 800;">${inFlow}/min</span></div>
          <div><strong>Hacia Rama #${idx}:</strong> <span style="color: #38bdf8; font-weight: 800;">${divert}/min</span></div>
          <div><strong>Sigue adelante:</strong> <span style="color: #94a3b8; font-weight: 800;">${pass}/min</span></div>
        `;
        tooltip.style.display = 'block';
        moveTooltip(e);
      });
      node.addEventListener('mousemove', moveTooltip);
      node.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });
    });

    // Máquinas de Ramas
    canvas.querySelectorAll('.blueprint-node-machine').forEach(node => {
      node.addEventListener('mouseenter', (e) => {
        if (sbBpState.isZooming || sbBpState.isDragging) return;
        const name = node.getAttribute('data-name');
        const count = node.getAttribute('data-count');
        const power = node.getAttribute('data-power');
        const type = node.getAttribute('data-type');
        tooltip.innerHTML = `
          <div style="font-weight: 800; color: #38bdf8; font-size: 0.88rem; margin-bottom: 4px;">🏭 ${type === 'final' ? 'Fabricación Final' : 'Fase Intermedia'}</div>
          <div><strong>Receta:</strong> <span style="color: #f8fafc; font-weight: 800;">${name}</span></div>
          <div><strong>Máquinas requeridas:</strong> <span style="color: #4ade80; font-weight: 800;">${count}</span></div>
          <div><strong>Potencia total:</strong> <span style="color: #38bdf8;">⚡ ${power} MW</span></div>
        `;
        tooltip.style.display = 'block';
        moveTooltip(e);
      });
      node.addEventListener('mousemove', moveTooltip);
      node.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });
    });

    // Almacén / Entrega
    canvas.querySelectorAll('.blueprint-node-storage').forEach(node => {
      node.addEventListener('mouseenter', (e) => {
        if (sbBpState.isZooming || sbBpState.isDragging) return;
        const name = node.getAttribute('data-name');
        const rate = node.getAttribute('data-rate');
        tooltip.innerHTML = `
          <div style="font-weight: 800; color: #10b981; font-size: 0.88rem; margin-bottom: 4px;">📦 Almacén FICSIT / Salida Final</div>
          <div><strong>Producto:</strong> <span style="color: #f8fafc; font-weight: 800;">${name}</span></div>
          <div><strong>Rendimiento Neto:</strong> <span style="color: #4ade80; font-weight: 900;">+${rate}/min</span></div>
          <div style="font-size: 0.72rem; color: #94a3b8; margin-top: 4px;">Conéctalo directamente a tus contenedores industriales o trenes.</div>
        `;
        tooltip.style.display = 'block';
        moveTooltip(e);
      });
      node.addEventListener('mousemove', moveTooltip);
      node.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });
    });

    // Awesome Sink
    canvas.querySelectorAll('.blueprint-node-sink').forEach(node => {
      node.addEventListener('mouseenter', (e) => {
        if (sbBpState.isZooming || sbBpState.isDragging) return;
        const rate = node.getAttribute('data-rate');
        tooltip.innerHTML = `
          <div style="font-weight: 800; color: #c084fc; font-size: 0.88rem; margin-bottom: 4px;">🌟 Trituradora FICSIT Sink</div>
          <div><strong>Excedente triturado:</strong> <span style="color: #4ade80; font-weight: 800;">+${rate}/min</span></div>
          <div style="font-size: 0.72rem; color: #e9d5ff; margin-top: 4px;">Genera cupones FICSIT automáticamente y evita que las cintas se atasquen.</div>
        `;
        tooltip.style.display = 'block';
        moveTooltip(e);
      });
      node.addEventListener('mousemove', moveTooltip);
      node.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });
    });

    // Enfoque / Dimming por Rama
    const bays = canvas.querySelectorAll('.blueprint-branch-bay');
    bays.forEach(bay => {
      bay.addEventListener('mouseenter', () => {
        if (!sbBpState.focusModeEnabled || sbBpState.isDragging || sbBpState.isZooming) return;
        const idx = bay.getAttribute('data-branch-index');
        canvas.classList.add('has-active-focus');
        bays.forEach(other => {
          if (other.getAttribute('data-branch-index') !== idx) {
            other.classList.add('is-dimmed');
          } else {
            other.classList.remove('is-dimmed');
          }
        });
      });

      bay.addEventListener('mouseleave', () => {
        if (!sbBpState.focusModeEnabled || sbBpState.isDragging || sbBpState.isZooming) return;
        if (sbBpState.highlightedBranchIdx === null) {
          canvas.classList.remove('has-active-focus');
          bays.forEach(other => other.classList.remove('is-dimmed'));
        } else {
          bays.forEach(other => {
            if (other.getAttribute('data-branch-index') !== String(sbBpState.highlightedBranchIdx)) {
              other.classList.add('is-dimmed');
            } else {
              other.classList.remove('is-dimmed');
            }
          });
        }
      });

      bay.addEventListener('click', () => {
        const idx = parseInt(bay.getAttribute('data-branch-index'), 10);
        if (sbBpState.highlightedBranchIdx === idx) {
          sbBpState.highlightedBranchIdx = null;
          canvas.classList.remove('has-active-focus');
          bays.forEach(other => other.classList.remove('is-dimmed'));
        } else {
          sbBpState.highlightedBranchIdx = idx;
          canvas.classList.add('has-active-focus');
          bays.forEach(other => {
            if (other.getAttribute('data-branch-index') !== String(idx)) {
              other.classList.add('is-dimmed');
            } else {
              other.classList.remove('is-dimmed');
            }
          });
        }
      });
    });
  }

  function generateSandboxBlueprintSvg(supply, branchDetails, netBalance) {
    const N = Math.max(1, branchDetails.length);
    const branchH = 170;
    const branchGap = 24;
    const startY = 100;
    const totalH = Math.max(680, startY + N * (branchH + branchGap) + 120);
    const totalW = 1680;

    const hasSmelting = (supply.isSmelted && supply.smeltersNeeded > 0);
    const hasSecondary = !!supply.secondary;

    // Coordinate Anchors
    const X_MINERS = 50;
    const W_MINERS = 220;

    const X_SMELT = 330;
    const W_SMELT = 200;

    const X_SPLITTER = hasSmelting ? 600 : 340;
    const W_SPLITTER = 70;

    const X_BRANCH_START = X_SPLITTER + 150;
    const branchW = totalW - X_BRANCH_START - 40;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${totalH}" width="${totalW}" height="${totalH}" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; user-select: none;">`;

    // Definitions
    svg += `
      <defs>
        <pattern id="sbGridPat" width="60" height="60" patternUnits="userSpaceOnUse">
          <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#172338" stroke-width="1.2" />
          <circle cx="0" cy="0" r="1.5" fill="#334155" />
          <circle cx="60" cy="0" r="1.5" fill="#334155" />
          <circle cx="0" cy="60" r="1.5" fill="#334155" />
          <circle cx="60" cy="60" r="1.5" fill="#334155" />
        </pattern>

        <linearGradient id="sbMinerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ea580c" />
          <stop offset="100%" stop-color="#9a3412" />
        </linearGradient>

        <linearGradient id="sbSecMinerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0284c7" />
          <stop offset="100%" stop-color="#0369a1" />
        </linearGradient>

        <linearGradient id="sbSmeltGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#f97316" />
          <stop offset="100%" stop-color="#c2410c" />
        </linearGradient>

        <linearGradient id="sbSplitterGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#f59e0b" />
          <stop offset="100%" stop-color="#b45309" />
        </linearGradient>

        <linearGradient id="sbSinkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#8b5cf6" />
          <stop offset="100%" stop-color="#6d28d9" />
        </linearGradient>

        <linearGradient id="sbStorageGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#10b981" />
          <stop offset="100%" stop-color="#047857" />
        </linearGradient>

        <filter id="sbGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>

        <marker id="sbArrowOrange" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M 0 0 L 8 4 L 0 8 z" fill="#f97316" />
        </marker>
        <marker id="sbArrowCyan" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M 0 0 L 8 4 L 0 8 z" fill="#38bdf8" />
        </marker>
        <marker id="sbArrowYellow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M 0 0 L 8 4 L 0 8 z" fill="#facc15" />
        </marker>
        <marker id="sbArrowGreen" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M 0 0 L 8 4 L 0 8 z" fill="#4ade80" />
        </marker>
      </defs>
    `;

    // Background Foundation Plate
    svg += `<rect width="${totalW}" height="${totalH}" fill="#080e1a" />`;
    svg += `<rect width="${totalW}" height="${totalH}" fill="url(#sbGridPat)" opacity="0.65" />`;

    // Top Blueprint Bar
    svg += `
      <rect x="40" y="20" width="${totalW - 80}" height="48" rx="8" fill="#0d1728" stroke="#1e293b" stroke-width="1.5" />
      <text x="60" y="50" font-size="14" font-weight="900" fill="#f8fafc" letter-spacing="0.5">
        📐 PLANO AÉREO 2D &bull; DISTRIBUCIÓN FICSIT Y DIVISIÓN POR SPLITTERS
      </text>
      <text x="${totalW - 60}" y="50" text-anchor="end" font-size="12" font-weight="700" fill="#38bdf8">
        Suministro: ${supply.rate.toFixed(1)} ${supply.itemName}/min &bull; ${branchDetails.length} Ramas
      </text>
    `;

    // 1. EXTRACTION STATION (LEFT COLUMN)
    const minerH = 140;
    const isMultiMiner = (supply.minerNodes && supply.minerNodes.length > 1);
    const minerTierName = SATIS_DATA.miners[supply.minerTier]?.name || 'Minero Mk.1';
    const purityName = (supply.purity === 'pure') ? 'Pura' : (supply.purity === 'impure') ? 'Impura' : 'Normal';

    svg += `
      <g class="blueprint-node-miner" data-name="${supply.rawItemName}" data-rate="${supply.rawRate}" data-power="${supply.minerPower}">
        <rect x="${X_MINERS}" y="${startY}" width="${W_MINERS}" height="${minerH}" rx="10" fill="#0f172a" stroke="#ea580c" stroke-width="2" />
        <rect x="${X_MINERS}" y="${startY}" width="${W_MINERS}" height="28" rx="8" fill="url(#sbMinerGrad)" />
        <text x="${X_MINERS + 12}" y="${startY + 18}" font-size="11" font-weight="900" fill="#ffffff" letter-spacing="0.5">
          ⛏️ EXTRACCIÓN PRIMARIA
        </text>

        <text x="${X_MINERS + 14}" y="${startY + 56}" font-size="13" font-weight="800" fill="#f8fafc">
          ${supply.rawItemName}
        </text>

        <text x="${X_MINERS + 14}" y="${startY + 84}" font-size="18" font-weight="900" fill="#4ade80">
          +${supply.rawRate.toFixed(1)} <tspan font-size="12" font-weight="700" fill="#94a3b8">/min</tspan>
        </text>

        <text x="${X_MINERS + 14}" y="${startY + 110}" font-size="10.5" font-weight="700" fill="#cbd5e1">
          ${isMultiMiner ? `${supply.minerNodes.length}x Taladros Combinados` : `${minerTierName} (${purityName})`}
        </text>

        <text x="${X_MINERS + 14}" y="${startY + 126}" font-size="9.5" font-weight="600" fill="#94a3b8">
          ⚡ Consumo: ${supply.minerPower.toFixed(1)} MW
        </text>
      </g>
    `;

    // Secondary Miner (if present)
    if (hasSecondary && supply.secondary) {
      const sec = supply.secondary;
      const secY = startY + 160;
      const secH = 125;
      const secTierName = SATIS_DATA.miners[sec.minerTier]?.name || 'Minero Mk.1';
      const secPurityName = (sec.purity === 'pure') ? 'Pura' : (sec.purity === 'impure') ? 'Impura' : 'Normal';

      svg += `
        <g class="blueprint-node-miner" data-name="${sec.itemName}" data-rate="${sec.rate}" data-power="${sec.powerMw}">
          <rect x="${X_MINERS}" y="${secY}" width="${W_MINERS}" height="${secH}" rx="10" fill="#08182b" stroke="#0284c7" stroke-width="2" />
          <rect x="${X_MINERS}" y="${secY}" width="${W_MINERS}" height="28" rx="8" fill="url(#sbSecMinerGrad)" />
          <text x="${X_MINERS + 12}" y="${secY + 18}" font-size="11" font-weight="900" fill="#ffffff" letter-spacing="0.5">
            ⛏️ SEGUNDO MINERAL
          </text>

          <text x="${X_MINERS + 14}" y="${secY + 52}" font-size="13" font-weight="800" fill="#f8fafc">
            ${sec.itemName}
          </text>

          <text x="${X_MINERS + 14}" y="${secY + 78}" font-size="17" font-weight="900" fill="#38bdf8">
            +${sec.rate.toFixed(1)} <tspan font-size="11" font-weight="700" fill="#94a3b8">/min</tspan>
          </text>

          <text x="${X_MINERS + 14}" y="${secY + 100}" font-size="10" font-weight="700" fill="#cbd5e1">
            ${sec.minerCount}x ${secTierName} (${secPurityName})
          </text>

          <text x="${X_MINERS + 14}" y="${secY + 115}" font-size="9" font-weight="600" fill="#94a3b8">
            ⚡ Consumo: ${sec.powerMw.toFixed(1)} MW
          </text>
        </g>
      `;
    }

    // 2. SMELTING BATTERY (IF AUTO-SMELT)
    const smeltY = startY;
    if (hasSmelting) {
      // Conveyor from Primary Miner to Smelter
      svg += `
        <line x1="${X_MINERS + W_MINERS}" y1="${startY + 70}" x2="${X_SMELT}" y2="${startY + 70}" stroke="#f97316" stroke-width="6" stroke-dasharray="8 4" marker-end="url(#sbArrowOrange)" />
        <rect x="${X_MINERS + W_MINERS + 10}" y="${startY + 48}" width="50" height="18" rx="4" fill="#0f172a" stroke="#f97316" stroke-width="1" />
        <text x="${X_MINERS + W_MINERS + 35}" y="${startY + 61}" text-anchor="middle" font-size="9" font-weight="800" fill="#f97316">
          ${supply.rawRate.toFixed(0)}/m
        </text>
      `;

      // Smelter Box
      svg += `
        <g class="blueprint-node-smelter" data-name="Batería de Hornos" data-count="${supply.smeltersNeeded}" data-power="${supply.smelterPower}">
          <rect x="${X_SMELT}" y="${smeltY}" width="${W_SMELT}" height="${minerH}" rx="10" fill="#18111e" stroke="#f97316" stroke-width="2" />
          <rect x="${X_SMELT}" y="${smeltY}" width="${W_SMELT}" height="28" rx="8" fill="url(#sbSmeltGrad)" />
          <text x="${X_SMELT + 12}" y="${smeltY + 18}" font-size="11" font-weight="900" fill="#ffffff" letter-spacing="0.5">
            🔥 BATERÍA DE HORNOS
          </text>

          <text x="${X_SMELT + 14}" y="${smeltY + 54}" font-size="13" font-weight="800" fill="#f8fafc">
            ${supply.smeltersNeeded}x Fundición (Horno)
          </text>

          <text x="${X_SMELT + 14}" y="${smeltY + 80}" font-size="17" font-weight="900" fill="#fbbf24">
            +${supply.rate.toFixed(1)} <tspan font-size="11" font-weight="700" fill="#94a3b8">Lingotes/m</tspan>
          </text>

          <text x="${X_SMELT + 14}" y="${smeltY + 104}" font-size="10" font-weight="700" fill="#cbd5e1">
            Manifold de Fundición 100%
          </text>

          <text x="${X_SMELT + 14}" y="${smeltY + 122}" font-size="9.5" font-weight="600" fill="#94a3b8">
            ⚡ Consumo: ${supply.smelterPower.toFixed(1)} MW
          </text>
        </g>
      `;

      // Conveyor from Smelter to Splitter #1
      svg += `
        <line x1="${X_SMELT + W_SMELT}" y1="${startY + 70}" x2="${X_SPLITTER}" y2="${startY + 70}" stroke="#facc15" stroke-width="6" stroke-dasharray="8 4" marker-end="url(#sbArrowYellow)" />
        <rect x="${X_SMELT + W_SMELT + 10}" y="${startY + 48}" width="50" height="18" rx="4" fill="#0f172a" stroke="#facc15" stroke-width="1" />
        <text x="${X_SMELT + W_SMELT + 35}" y="${startY + 61}" text-anchor="middle" font-size="9" font-weight="800" fill="#facc15">
          ${supply.rate.toFixed(0)}/m
        </text>
      `;
    } else {
      // No Smelter: Conveyor directly from Miner to Splitter #1
      svg += `
        <line x1="${X_MINERS + W_MINERS}" y1="${startY + 70}" x2="${X_SPLITTER}" y2="${startY + 70}" stroke="#f97316" stroke-width="6" stroke-dasharray="8 4" marker-end="url(#sbArrowOrange)" />
        <rect x="${X_MINERS + W_MINERS + 10}" y="${startY + 48}" width="50" height="18" rx="4" fill="#0f172a" stroke="#f97316" stroke-width="1" />
        <text x="${X_MINERS + W_MINERS + 35}" y="${startY + 61}" text-anchor="middle" font-size="9" font-weight="800" fill="#f97316">
          ${supply.rate.toFixed(0)}/m
        </text>
      `;
    }

    // 3. TRUNK CONVEYOR & PHYSICAL SPLITTERS
    let currentFlow = supply.rate;
    const splPositions = [];

    branchDetails.forEach((d, idx) => {
      const bY = startY + idx * (branchH + branchGap);
      const splY = bY + 60;
      const divertedFlow = d.supplyIntakeRate;
      const passFlow = Math.max(0, Number((currentFlow - divertedFlow).toFixed(2)));
      splPositions.push({ splY, inFlow: currentFlow, divertedFlow, passFlow });

      // Vertical connecting conveyor between splitters
      if (idx > 0) {
        const prevSplY = splPositions[idx - 1].splY;
        svg += `
          <line x1="${X_SPLITTER + 35}" y1="${prevSplY + 45}" x2="${X_SPLITTER + 35}" y2="${splY}" stroke="#facc15" stroke-width="5" stroke-dasharray="6 3" marker-end="url(#sbArrowYellow)" />
          <rect x="${X_SPLITTER + 42}" y="${(prevSplY + 45 + splY) / 2 - 9}" width="46" height="16" rx="3" fill="#0f172a" stroke="#facc15" stroke-width="1" />
          <text x="${X_SPLITTER + 65}" y="${(prevSplY + 45 + splY) / 2 + 3}" text-anchor="middle" font-size="8.5" font-weight="800" fill="#facc15">
            ${currentFlow.toFixed(0)}/m
          </text>
        `;
      }

      // Splitter Box
      svg += `
        <g class="blueprint-node-splitter" data-split-index="${idx}" data-in="${currentFlow}" data-divert="${divertedFlow}" data-pass="${passFlow}">
          <rect x="${X_SPLITTER}" y="${splY}" width="${W_SPLITTER}" height="45" rx="6" fill="#1e293b" stroke="#f59e0b" stroke-width="2" />
          <text x="${X_SPLITTER + 35}" y="${splY + 20}" text-anchor="middle" font-size="11" font-weight="900" fill="#f59e0b">
            🔀 S#${idx + 1}
          </text>
          <text x="${X_SPLITTER + 35}" y="${splY + 35}" text-anchor="middle" font-size="8.5" font-weight="700" fill="#fed7aa">
            -${divertedFlow.toFixed(0)}/m
          </text>
        </g>
      `;

      // Branch Infeed Conveyor (Splitter -> Branch Bay)
      const feedBeltColor = d.color || '#38bdf8';
      svg += `
        <line x1="${X_SPLITTER + W_SPLITTER}" y1="${splY + 22}" x2="${X_BRANCH_START}" y2="${splY + 22}" stroke="${feedBeltColor}" stroke-width="6" stroke-dasharray="6 3" marker-end="url(#sbArrowCyan)" />
        <rect x="${X_SPLITTER + W_SPLITTER + 10}" y="${splY + 10}" width="58" height="18" rx="4" fill="#0f172a" stroke="${feedBeltColor}" stroke-width="1" />
        <text x="${X_SPLITTER + W_SPLITTER + 39}" y="${splY + 23}" text-anchor="middle" font-size="9" font-weight="800" fill="${feedBeltColor}">
          ➔ ${divertedFlow.toFixed(0)}/m
        </text>
      `;

      currentFlow = passFlow;
    });

    // End of Line / Awesome Sink
    const lastSpl = splPositions[splPositions.length - 1];
    const endY = lastSpl.splY + 65;

    if (netBalance > 0.05) {
      // Excess goes to Awesome Sink
      svg += `
        <line x1="${X_SPLITTER + 35}" y1="${lastSpl.splY + 45}" x2="${X_SPLITTER + 35}" y2="${endY}" stroke="#a855f7" stroke-width="5" stroke-dasharray="6 3" marker-end="url(#sbArrowGreen)" />
        <g class="blueprint-node-sink" data-rate="${netBalance}">
          <rect x="${X_SPLITTER - 20}" y="${endY}" width="110" height="52" rx="8" fill="#1f1035" stroke="#a855f7" stroke-width="2" />
          <text x="${X_SPLITTER + 35}" y="${endY + 20}" text-anchor="middle" font-size="10.5" font-weight="900" fill="#c084fc">
            🌟 FICSIT SINK
          </text>
          <text x="${X_SPLITTER + 35}" y="${endY + 38}" text-anchor="middle" font-size="9.5" font-weight="800" fill="#4ade80">
            +${netBalance.toFixed(1)}/m Excedente
          </text>
        </g>
      `;
    } else if (netBalance < -0.05) {
      // Deficit indicator
      svg += `
        <line x1="${X_SPLITTER + 35}" y1="${lastSpl.splY + 45}" x2="${X_SPLITTER + 35}" y2="${endY}" stroke="#ef4444" stroke-width="4" stroke-dasharray="4 2" />
        <rect x="${X_SPLITTER - 15}" y="${endY}" width="100" height="42" rx="6" fill="#2d0f0f" stroke="#ef4444" stroke-width="1.5" />
        <text x="${X_SPLITTER + 35}" y="${endY + 18}" text-anchor="middle" font-size="10" font-weight="900" fill="#ef4444">
          ⚠️ DÉFICIT
        </text>
        <text x="${X_SPLITTER + 35}" y="${endY + 32}" text-anchor="middle" font-size="9" font-weight="700" fill="#fca5a5">
          ${netBalance.toFixed(1)}/m faltante
        </text>
      `;
    } else {
      // 100% Perfect Balance Terminal Cap
      svg += `
        <line x1="${X_SPLITTER + 35}" y1="${lastSpl.splY + 45}" x2="${X_SPLITTER + 35}" y2="${endY}" stroke="#4ade80" stroke-width="4" />
        <circle cx="${X_SPLITTER + 35}" cy="${endY + 12}" r="12" fill="#052e16" stroke="#4ade80" stroke-width="2" />
        <text x="${X_SPLITTER + 35}" y="${endY + 16}" text-anchor="middle" font-size="11" font-weight="900" fill="#4ade80">✓</text>
        <text x="${X_SPLITTER + 35}" y="${endY + 38}" text-anchor="middle" font-size="8.5" font-weight="700" fill="#86efac">
          100% Balance
        </text>
      `;
    }

    // 4. BRANCH FABRICATION BAYS (HORIZONTAL FOUNDATION MODULES)
    branchDetails.forEach((d, idx) => {
      const bY = startY + idx * (branchH + branchGap);
      const isHigh = (sbBpState.highlightedBranchIdx === idx);
      const bColor = d.color || '#38bdf8';

      // Bay Foundation Plate
      svg += `
        <g class="blueprint-branch-bay ${isHigh ? 'is-active-branch' : ''}" data-branch-index="${idx}">
          <rect x="${X_BRANCH_START}" y="${bY}" width="${branchW}" height="${branchH}" rx="12" fill="#0a1220" stroke="${isHigh ? '#38bdf8' : bColor}" stroke-width="${isHigh ? 3 : 1.5}" ${isHigh ? 'filter="url(#sbGlow)"' : ''} />

          <!-- Bay Header Bar -->
          <rect x="${X_BRANCH_START}" y="${bY}" width="${branchW}" height="32" rx="10" fill="#0f1d33" />
          <rect x="${X_BRANCH_START + 12}" y="${bY + 6}" width="80" height="20" rx="4" fill="${bColor}" />
          <text x="${X_BRANCH_START + 52}" y="${bY + 20}" text-anchor="middle" font-size="10.5" font-weight="900" fill="#0b111e">
            RAMA #${idx + 1}
          </text>

          <text x="${X_BRANCH_START + 104}" y="${bY + 21}" font-size="12" font-weight="800" fill="#f8fafc">
            ${d.recipe.name}
          </text>

          <text x="${X_BRANCH_START + branchW - 16}" y="${bY + 21}" text-anchor="end" font-size="11" font-weight="800" fill="#4ade80">
            Entrega: +${d.branchOutputTotal} ${d.outItemMeta.name}/m &bull; <tspan fill="#38bdf8">⚡ ${d.chain.totalPower} MW</tspan>
          </text>
      `;

      // Machines Layout inside Bay
      let curX = X_BRANCH_START + 24;
      const machY = bY + 48;
      const machH = 100;

      // Intermediate machines (if any)
      if (!d.isDirect && d.intermediateSteps && d.intermediateSteps.length > 0) {
        d.intermediateSteps.forEach(step => {
          const stepW = 190;
          svg += `
            <g class="blueprint-node-machine" data-type="intermediate" data-name="${step.recipe.name}" data-count="${step.machinesCount}" data-power="${step.power}">
              <rect x="${curX}" y="${machY}" width="${stepW}" height="${machH}" rx="8" fill="#131e31" stroke="#334155" stroke-width="1.5" />
              <rect x="${curX}" y="${machY}" width="${stepW}" height="22" rx="6" fill="#1e293b" />
              <text x="${curX + 8}" y="${machY + 15}" font-size="9.5" font-weight="800" fill="#94a3b8">
                Fase Intermedia &bull; ${step.building.name}
              </text>

              <text x="${curX + 10}" y="${machY + 40}" font-size="11" font-weight="800" fill="#f8fafc">
                ${step.machinesCount}x ${step.recipe.name}
              </text>

              <text x="${curX + 10}" y="${machY + 62}" font-size="12" font-weight="900" fill="#38bdf8">
                +${step.outputRate} <tspan font-size="9" font-weight="700" fill="#94a3b8">/m ${step.itemName}</tspan>
              </text>

              <text x="${curX + 10}" y="${machY + 84}" font-size="8.5" font-weight="600" fill="#64748b">
                ⚡ ${step.power.toFixed(1)} MW &bull; ${step.feederBelt.name}
              </text>
            </g>
          `;

          // Connecting Conveyor to Next Stage
          svg += `
            <line x1="${curX + stepW}" y1="${machY + 50}" x2="${curX + stepW + 40}" y2="${machY + 50}" stroke="#94a3b8" stroke-width="4" stroke-dasharray="4 2" marker-end="url(#sbArrowCyan)" />
          `;
          curX += stepW + 40;
        });
      }

      // Final Target Machine(s)
      const targetW = 210;
      svg += `
        <g class="blueprint-node-machine" data-type="final" data-name="${d.recipe.name}" data-count="${d.branch.machineCount}" data-power="${d.chain.totalPower}">
          <rect x="${curX}" y="${machY}" width="${targetW}" height="${machH}" rx="8" fill="#14233c" stroke="${bColor}" stroke-width="2" />
          <rect x="${curX}" y="${machY}" width="${targetW}" height="24" rx="6" fill="#1e3455" />
          <text x="${curX + 10}" y="${machY + 16}" font-size="10" font-weight="900" fill="${bColor}">
            FABRICACIÓN FINAL
          </text>

          <text x="${curX + 12}" y="${machY + 44}" font-size="12" font-weight="800" fill="#f8fafc">
            ${d.branch.machineCount}x ${d.building.name}
          </text>

          <text x="${curX + 12}" y="${machY + 68}" font-size="14" font-weight="900" fill="#4ade80">
            +${d.branchOutputTotal} <tspan font-size="10" font-weight="700" fill="#94a3b8">/m ${d.outItemMeta.name}</tspan>
          </text>

          <text x="${curX + 12}" y="${machY + 88}" font-size="9" font-weight="600" fill="#94a3b8">
            ${d.recipe.name} &bull; ⚡ ${(d.branch.machineCount * (d.building.power || 4)).toFixed(1)} MW
          </text>
        </g>
      `;

      // Conveyor to Storage Container
      const storageX = curX + targetW + 45;
      svg += `
        <line x1="${curX + targetW}" y1="${machY + 50}" x2="${storageX}" y2="${machY + 50}" stroke="#4ade80" stroke-width="5" stroke-dasharray="6 3" marker-end="url(#sbArrowGreen)" />
      `;

      // Final Storage / Delivery Container
      const storageW = Math.max(160, branchW - (storageX - X_BRANCH_START) - 20);
      svg += `
        <g class="blueprint-node-storage" data-name="${d.outItemMeta.name}" data-rate="${d.branchOutputTotal}">
          <rect x="${storageX}" y="${machY}" width="${storageW}" height="${machH}" rx="8" fill="#04271c" stroke="#10b981" stroke-width="1.8" />
          <rect x="${storageX}" y="${machY}" width="${storageW}" height="22" rx="6" fill="url(#sbStorageGrad)" />
          <text x="${storageX + 10}" y="${machY + 15}" font-size="9.5" font-weight="900" fill="#ffffff">
            📦 ALMACÉN FICSIT
          </text>

          <text x="${storageX + 12}" y="${machY + 46}" font-size="11.5" font-weight="800" fill="#f8fafc">
            ${d.outItemMeta.name}
          </text>

          <text x="${storageX + 12}" y="${machY + 74}" font-size="16" font-weight="900" fill="#4ade80">
            +${d.branchOutputTotal} <tspan font-size="10" font-weight="700" fill="#a7f3d0">/min</tspan>
          </text>
        </g>
      `;

      svg += `</g>`; // close branch-bay group
    });

    svg += `</svg>`;
    return svg;
  }

  function renderSandboxBlueprint(supply, branchDetails, netBalance) {
    const canvas = document.getElementById('sandboxBlueprintCanvas');
    if (!canvas) return;

    initSandboxBlueprintInteractions();

    const svgHtml = generateSandboxBlueprintSvg(supply, branchDetails, netBalance);
    canvas.innerHTML = svgHtml;

    // Cache model dimensions
    const N = Math.max(1, branchDetails.length);
    const branchH = 170;
    const branchGap = 24;
    const startY = 100;
    const totalH = Math.max(680, startY + N * (branchH + branchGap) + 120);
    const totalW = 1680;
    sbBpState.currentModel = { totalW, totalH };

    // Update Summary Badge
    const summaryBadge = document.getElementById('sbBpSummaryBadge');
    if (summaryBadge) {
      const balText = Math.abs(netBalance) < 0.05 
        ? '🟢 100% Balanceado' 
        : (netBalance > 0 ? `🟡 +${netBalance.toFixed(1)} Sobrante` : `🔴 ${netBalance.toFixed(1)} Déficit`);
      summaryBadge.textContent = `${supply.rate.toFixed(1)} ${supply.itemName}/min ➔ ${branchDetails.length} Ramas (${balText})`;
    }

    if (!sbBpState.isInitializedScale) {
      fitSandboxBlueprintToViewport();
      sbBpState.isInitializedScale = true;
    } else {
      applySandboxBlueprintTransform(canvas, sbBpState);
    }

    attachSandboxBlueprintHoverTooltips();
  }

  // =========================================================================
  // 1.9. TAB POWER: CENTRALES DE ENERGÍA Y PLANOS 2D AÉREOS (FICSIT ENERGY)
  // =========================================================================
  function initPowerTab() {
    const inputMW = document.getElementById('inputPowerTargetMW');
    const btnMinus = document.getElementById('btnPowerMwMinus');
    const btnPlus = document.getElementById('btnPowerMwPlus');
    const pipeSelect = document.getElementById('selectPowerPipeTier');
    const beltSelect = document.getElementById('selectPowerBeltTier');
    const btnCopy = document.getElementById('btnPowerCopySummary');
    const btnAddDrill = document.getElementById('btnAddPowerDrill');
    const btnSyncToDrills = document.getElementById('btnSyncPowerToDrills');
    const drillsList = document.getElementById('powerDrillsList');
    const btnViewBlock = document.getElementById('btnPowerViewBlock');
    const btnViewOverview = document.getElementById('btnPowerViewOverview');

    if (inputMW) {
      inputMW.addEventListener('input', () => {
        state.power.targetMW = Math.max(10, Number(inputMW.value) || 8000);
        updatePresetButtons(state.power.targetMW);
        renderPowerPlantSection();
      });
    }

    if (btnMinus && inputMW) {
      btnMinus.addEventListener('click', () => {
        const step = state.power.targetMW > 2000 ? 500 : 100;
        state.power.targetMW = Math.max(50, state.power.targetMW - step);
        inputMW.value = state.power.targetMW;
        updatePresetButtons(state.power.targetMW);
        renderPowerPlantSection();
      });
    }

    if (btnPlus && inputMW) {
      btnPlus.addEventListener('click', () => {
        const step = state.power.targetMW >= 2000 ? 500 : 100;
        state.power.targetMW = state.power.targetMW + step;
        inputMW.value = state.power.targetMW;
        updatePresetButtons(state.power.targetMW);
        renderPowerPlantSection();
      });
    }

    // Presets de MW
    document.querySelectorAll('.btn-power-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        const mw = Number(btn.getAttribute('data-mw')) || 8000;
        state.power.targetMW = mw;
        if (inputMW) inputMW.value = mw;
        updatePresetButtons(mw);
        renderPowerPlantSection();
      });
    });

    function updatePresetButtons(currentMW) {
      document.querySelectorAll('.btn-power-preset').forEach(b => {
        b.classList.toggle('active', Number(b.getAttribute('data-mw')) === currentMW);
      });
    }

    // Selector de Combustibles
    document.querySelectorAll('.btn-power-fuel').forEach(btn => {
      btn.addEventListener('click', () => {
        const fuel = btn.getAttribute('data-fuel');
        state.power.fuelId = fuel;
        document.querySelectorAll('.btn-power-fuel').forEach(b => b.classList.toggle('active', b === btn));

        const isOil = fuel === 'fuel' || fuel === 'turbofuel' || fuel === 'petroleum_coke';
        if (Array.isArray(state.power.drills)) {
          state.power.drills.forEach(d => {
            if (isOil && d.minerTier !== 'oil_extractor') {
              d.minerTier = 'oil_extractor';
            } else if (!isOil && d.minerTier === 'oil_extractor') {
              d.minerTier = 'miner_mk2';
            }
          });
        }
        renderPowerPlantSection();
      });
    });

    if (pipeSelect) {
      pipeSelect.addEventListener('change', () => {
        state.power.pipeTier = Number(pipeSelect.value) || 1;
        renderPowerPlantSection();
      });
    }

    if (beltSelect) {
      beltSelect.addEventListener('change', () => {
        state.power.beltTier = Number(beltSelect.value) || 3;
        renderPowerPlantSection();
      });
    }

    // Switcher de Vista del Plano (Detalle del Bloque vs Panorámica)
    const btnDistBalanced = document.getElementById('btnPowerDistBalanced');
    const btnDistCascade = document.getElementById('btnPowerDistCascade');

    if (btnViewBlock && btnViewOverview) {
      btnViewBlock.addEventListener('click', () => {
        state.power.blueprintMode = 'block';
        btnViewBlock.classList.add('active');
        btnViewOverview.classList.remove('active');
        renderPowerPlantSection();
      });

      btnViewOverview.addEventListener('click', () => {
        state.power.blueprintMode = 'overview';
        btnViewOverview.classList.add('active');
        btnViewBlock.classList.remove('active');
        renderPowerPlantSection();
      });
    }

    if (btnDistBalanced && btnDistCascade) {
      btnDistBalanced.addEventListener('click', () => {
        state.power.coalDistribution = 'balanced';
        btnDistBalanced.classList.add('active');
        btnDistCascade.classList.remove('active');
        renderPowerPlantSection();
      });

      btnDistCascade.addEventListener('click', () => {
        state.power.coalDistribution = 'cascade';
        btnDistCascade.classList.add('active');
        btnDistBalanced.classList.remove('active');
        renderPowerPlantSection();
      });
    }

    // Añadir Taladro / Extractor de Petróleo
    if (btnAddDrill) {
      btnAddDrill.addEventListener('click', () => {
        if (!state.power.drills) state.power.drills = [];
        const isOil = state.power.fuelId === 'fuel' || state.power.fuelId === 'turbofuel' || state.power.fuelId === 'petroleum_coke';
        const nextIdx = state.power.drills.length + 1;
        state.power.drills.push({
          id: `drill_${Date.now()}_${nextIdx}`,
          minerTier: isOil ? 'oil_extractor' : 'miner_mk2',
          purity: 'normal',
          clock: 100
        });
        renderPowerPlantSection();
      });
    }

    // Sincronizar Planta con la Extracción de los Taladros
    if (btnSyncToDrills) {
      btnSyncToDrills.addEventListener('click', () => {
        const plant = SatisCalc.calculateDedicatedPowerPlant(state.power);
        if (plant.fuel && plant.fuel.balance && plant.fuel.balance.maxMWWithSupply > 0) {
          state.power.targetMW = Math.round(plant.fuel.balance.maxMWWithSupply);
          if (inputMW) inputMW.value = state.power.targetMW;
          updatePresetButtons(state.power.targetMW);
          renderPowerPlantSection();
        }
      });
    }

    // Delegación de eventos en la lista de taladros
    if (drillsList) {
      drillsList.addEventListener('click', (e) => {
        const purityBtn = e.target.closest('.btn-power-node-purity');
        const minerBtn = e.target.closest('.btn-power-node-miner');
        const clockBtn = e.target.closest('.btn-power-drill-clock');
        const removeBtn = e.target.closest('.btn-remove-power-drill');

        if (purityBtn) {
          const drillId = purityBtn.getAttribute('data-drill-id');
          const purityVal = purityBtn.getAttribute('data-purity');
          const d = (state.power.drills || []).find(x => x.id === drillId);
          if (d) {
            d.purity = purityVal;
            renderPowerPlantSection();
          }
          return;
        }

        if (minerBtn) {
          const drillId = minerBtn.getAttribute('data-drill-id');
          const minerVal = minerBtn.getAttribute('data-miner');
          const d = (state.power.drills || []).find(x => x.id === drillId);
          if (d) {
            d.minerTier = minerVal;
            renderPowerPlantSection();
          }
          return;
        }

        if (clockBtn) {
          const drillId = clockBtn.getAttribute('data-drill-id');
          const clockVal = parseInt(clockBtn.getAttribute('data-clock'), 10) || 100;
          const d = (state.power.drills || []).find(x => x.id === drillId);
          if (d) {
            d.clock = clockVal;
            renderPowerPlantSection();
          }
          return;
        }

        if (removeBtn) {
          const drillId = removeBtn.getAttribute('data-drill-id');
          if (state.power.drills && state.power.drills.length > 1) {
            state.power.drills = state.power.drills.filter(x => x.id !== drillId);
            renderPowerPlantSection();
          }
          return;
        }
      });

      drillsList.addEventListener('input', (e) => {
        const rangeInput = e.target.closest('.range-power-drill-clock');
        if (rangeInput) {
          const drillId = rangeInput.getAttribute('data-drill-id');
          const clockVal = Math.min(250, Math.max(1, parseInt(rangeInput.value, 10) || 100));
          const d = (state.power.drills || []).find(x => x.id === drillId);
          if (d) {
            d.clock = clockVal;
            renderPowerPlantSection();
          }
        }
      });
    }

    if (btnCopy) {
      btnCopy.addEventListener('click', () => {
        const plant = SatisCalc.calculateDedicatedPowerPlant(state.power);
        const lines = [
          `=== REPORTE DE CENTRAL ELÉCTRICA FICSIT (Satisfactory 1.0) ===`,
          `POTENCIA OBJETIVO: ${plant.powerBalance.grossMW.toLocaleString()} MW`,
          `POTENCIA NETA LIMPIA: ${plant.powerBalance.netMW.toLocaleString()} MW (Eficiencia: ${plant.powerBalance.netEfficiency}%)`,
          `AUTOCONSUMO INTERNO: -${plant.powerBalance.totalInternalMW.toLocaleString()} MW (Bombas: ${plant.water.extractorPower} MW, Taladros: ${plant.fuel.minersPower} MW)`,
          ``,
          `--- MAQUINARIA DE GENERACIÓN ---`,
          `• Generadores: ${plant.totalGeneratorsCount}x ${plant.generator.name} (${plant.fullGenerators} al 100%${plant.hasFractional ? ` + 1 al ${plant.lastClock}%` : ''})`,
          `• Combustible: ${plant.fuel.totalRate} /min de ${plant.fuel.name} (${plant.fuel.beltsNeededCount ? `${plant.fuel.beltsNeededCount} Cintas ${plant.fuel.belt.name}` : `${plant.fuel.pipesNeededCount} Tuberías`})`,
          plant.water.requiresWater ? `• Agua: ${plant.water.totalRate} m³/min (${plant.water.extractorsCount} Extractores de Agua al 100% en ${plant.water.pipesNeededCount} ${plant.water.pipeName})` : `• Agua: No requerida`,
          ``,
          plant.modularArchitecture ? `--- ARQUITECTURA MODULAR RECOMENDADA ---` : ``,
          plant.modularArchitecture ? `• Esquema: ${plant.modularArchitecture.type}` : ``,
          plant.modularArchitecture ? `• ${plant.modularArchitecture.description}` : ``,
          plant.modularArchitecture ? `• Módulos Estándar: ${plant.modularArchitecture.standardModulesCount} Bloques de 600 MW (${plant.modularArchitecture.standardModulesCount * 600} MW)` : ``,
          plant.modularArchitecture && plant.modularArchitecture.hasRemainder ? `• Módulo de Ajuste Remanente: ${plant.modularArchitecture.remainderGenerators} Generadores (${plant.modularArchitecture.remainderMW} MW)` : ``
        ].filter(Boolean);

        navigator.clipboard.writeText(lines.join('\n')).then(() => {
          const original = btnCopy.innerHTML;
          btnCopy.innerHTML = '✅ ¡Copiado!';
          setTimeout(() => { btnCopy.innerHTML = original; }, 2000);
        });
      });
    }

    initPowerBlueprintInteractions();
    renderPowerPlantSection();
  }

  function renderPowerPlantSection() {
    const statsGrid = document.getElementById('powerStatsGrid');
    const archCard = document.getElementById('powerArchitectureCard');
    const drillsBox = document.getElementById('powerDrillsConfigContainer');
    const drillsList = document.getElementById('powerDrillsList');
    const balanceBadge = document.getElementById('powerDrillsBalanceBadge');
    if (!statsGrid) return;

    const plant = SatisCalc.calculateDedicatedPowerPlant(state.power);
    const isSolidFuel = !plant.fuel.isFluid;
    const isOilFuel = !!(plant.petrochem && plant.petrochem.isOil);
    const canShowDrills = isSolidFuel || isOilFuel;

    // 1. Mostrar/Ocultar y Adaptar Textos de Taladros / Pozos
    if (drillsBox) {
      drillsBox.style.display = canShowDrills ? 'block' : 'none';
    }

    const drillsHeaderTitle = document.getElementById('powerDrillsHeaderTitle');
    const drillsHeaderSubtitle = document.getElementById('powerDrillsHeaderSubtitle');
    const drillsHeaderIcon = document.getElementById('powerDrillsHeaderIcon');
    const addDrillBtn = document.getElementById('btnAddPowerDrill');
    const syncDrillBtn = document.getElementById('btnSyncPowerToDrills');

    if (isOilFuel) {
      if (drillsHeaderIcon) drillsHeaderIcon.textContent = '🛢️';
      if (drillsHeaderTitle) drillsHeaderTitle.textContent = 'Configuración de Pozos de Petróleo Crudo (Extractores)';
      if (drillsHeaderSubtitle) drillsHeaderSubtitle.textContent = 'Indica cuántos pozos de petróleo tienes y de qué pureza es cada pozo. La app calculará cuántas refinerías y cuántos Generadores de Combustible (250 MW) puedes alimentar sin apagones.';
      if (addDrillBtn) addDrillBtn.innerHTML = '<span>➕ Añadir Pozo / Extractor de Petróleo</span>';
      if (syncDrillBtn && plant.fuel.balance) {
        syncDrillBtn.innerHTML = `<span>⚡ Sincronizar Central con estos Pozos (${plant.fuel.balance.maxMWWithSupply.toLocaleString()} MW)</span>`;
      }
    } else {
      if (drillsHeaderIcon) drillsHeaderIcon.textContent = '⛏️';
      if (drillsHeaderTitle) drillsHeaderTitle.textContent = 'Configuración de Taladros por Veta (Menas Puras, Normales e Impuras)';
      if (drillsHeaderSubtitle) drillsHeaderSubtitle.textContent = 'Indica cuántos taladros tienes y de qué pureza es cada veta. La app calculará la extracción total exacta y cuántos MW puedes alimentar.';
      if (addDrillBtn) addDrillBtn.innerHTML = '<span>➕ Añadir Taladro de Carbón</span>';
      if (syncDrillBtn && plant.fuel.balance) {
        syncDrillBtn.innerHTML = `<span>⚡ Sincronizar Central con estos Taladros (${plant.fuel.balance.maxMWWithSupply.toLocaleString()} MW)</span>`;
      }
    }

    if (canShowDrills && drillsList && plant.fuel.userDrills) {
      drillsList.innerHTML = plant.fuel.userDrills.map((d, idx) => {
        const canDelete = plant.fuel.userDrills.length > 1;

        if (isOilFuel) {
          return `
            <div class="power-drill-row">
              <div class="power-drill-header">
                <div class="power-drill-tag" style="background: rgba(2, 132, 199, 0.15); border-color: #38bdf8; color: #7dd3fc;">
                  <span>🛢️</span>
                  <span>Extractor #${idx + 1} (Petróleo Crudo)</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span class="power-drill-output">+${d.rate} m³/min &bull; ${d.clock}% (${d.belt.name})</span>
                  <span style="font-size: 0.72rem; color: #facc15; font-weight: 700; background: rgba(250, 204, 21, 0.1); border: 1px solid rgba(250, 204, 21, 0.25); padding: 2px 6px; border-radius: 4px;">⚡ ${d.mw} MW</span>
                  ${canDelete ? `<button type="button" class="btn-remove-drill btn-remove-power-drill" data-drill-id="${d.id}" title="Eliminar este pozo">✕</button>` : ''}
                </div>
              </div>

              <div class="power-drill-controls">
                <!-- Selector de Pureza -->
                <div class="drill-control-group">
                  <span class="drill-sublabel">Pureza del Pozo:</span>
                  <div class="raw-purity-group-sm">
                    <button type="button" class="btn-node-purity btn-power-node-purity ${d.purity === 'impure' ? 'active' : ''}" data-drill-id="${d.id}" data-purity="impure">Impura (60 m³/m)</button>
                    <button type="button" class="btn-node-purity btn-power-node-purity ${d.purity === 'normal' ? 'active' : ''}" data-drill-id="${d.id}" data-purity="normal">Normal (120 m³/m)</button>
                    <button type="button" class="btn-node-purity btn-power-node-purity ${d.purity === 'pure' ? 'active' : ''}" data-drill-id="${d.id}" data-purity="pure">Pura (240 m³/m)</button>
                  </div>
                </div>

                <!-- Edificio Extractor -->
                <div class="drill-control-group">
                  <span class="drill-sublabel">Edificio:</span>
                  <div style="font-size: 0.76rem; color: #38bdf8; font-weight: 700; background: rgba(2, 132, 199, 0.12); border: 1px solid rgba(56, 189, 248, 0.25); padding: 5px 10px; border-radius: 4px; display: inline-flex; align-items: center; gap: 6px;">
                    <span>🛢️</span> Extractor de Petróleo (120 m³/m base)
                  </div>
                </div>

                <!-- Selector de Overclocking (1% a 250%) -->
                <div class="drill-control-group" style="flex: 1; min-width: 250px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-bottom: 2px;">
                    <span class="drill-sublabel">Overclock del Pozo:</span>
                    <span style="font-size: 0.74rem; font-weight: 800; color: ${d.clock > 100 ? '#f59e0b' : '#38bdf8'}; font-family: var(--font-mono);">
                      ${d.clock}% ${d.shards > 0 ? `<small style="color: #38bdf8; font-weight: 700;">(💎 ${d.shards} ${d.shards === 1 ? 'Shard' : 'Shards'})</small>` : ''}
                    </span>
                  </div>
                  <div style="display: flex; align-items: center; gap: 8px; width: 100%;">
                    <input type="range" class="range-slider range-power-drill-clock" data-drill-id="${d.id}" min="1" max="250" value="${d.clock}" step="1" style="flex: 1;">
                    <div class="raw-clock-group-sm">
                      <button type="button" class="btn-node-clock btn-power-drill-clock ${d.clock === 100 ? 'active' : ''}" data-drill-id="${d.id}" data-clock="100">100%</button>
                      <button type="button" class="btn-node-clock btn-power-drill-clock ${d.clock === 150 ? 'active overclock' : ''}" data-drill-id="${d.id}" data-clock="150">150%</button>
                      <button type="button" class="btn-node-clock btn-power-drill-clock ${d.clock === 200 ? 'active overclock' : ''}" data-drill-id="${d.id}" data-clock="200">200%</button>
                      <button type="button" class="btn-node-clock btn-power-drill-clock ${d.clock === 250 ? 'active overclock' : ''}" data-drill-id="${d.id}" data-clock="250">250%</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          `;
        }

        return `
          <div class="power-drill-row">
            <div class="power-drill-header">
              <div class="power-drill-tag">
                <span>⛏️</span>
                <span>Taladro #${idx + 1} (${plant.fuel.name})</span>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="power-drill-output">+${d.rate}/min &bull; ${d.clock}% (${d.belt.name})</span>
                <span style="font-size: 0.72rem; color: #facc15; font-weight: 700; background: rgba(250, 204, 21, 0.1); border: 1px solid rgba(250, 204, 21, 0.25); padding: 2px 6px; border-radius: 4px;">⚡ ${d.mw} MW</span>
                ${canDelete ? `<button type="button" class="btn-remove-drill btn-remove-power-drill" data-drill-id="${d.id}" title="Eliminar este taladro">✕</button>` : ''}
              </div>
            </div>

            <div class="power-drill-controls">
              <!-- Selector de Pureza -->
              <div class="drill-control-group">
                <span class="drill-sublabel">Pureza:</span>
                <div class="raw-purity-group-sm">
                  <button type="button" class="btn-node-purity btn-power-node-purity ${d.purity === 'impure' ? 'active' : ''}" data-drill-id="${d.id}" data-purity="impure">Impura (0.5x)</button>
                  <button type="button" class="btn-node-purity btn-power-node-purity ${d.purity === 'normal' ? 'active' : ''}" data-drill-id="${d.id}" data-purity="normal">Normal (1.0x)</button>
                  <button type="button" class="btn-node-purity btn-power-node-purity ${d.purity === 'pure' ? 'active' : ''}" data-drill-id="${d.id}" data-purity="pure">Pura (2.0x)</button>
                </div>
              </div>

              <!-- Selector de Nivel de Minero -->
              <div class="drill-control-group">
                <span class="drill-sublabel">Taladro:</span>
                <div class="raw-miner-group-sm">
                  <button type="button" class="btn-node-miner btn-power-node-miner ${d.minerTier === 'miner_mk1' ? 'active' : ''}" data-drill-id="${d.id}" data-miner="miner_mk1">Mk.1</button>
                  <button type="button" class="btn-node-miner btn-power-node-miner ${d.minerTier === 'miner_mk2' ? 'active' : ''}" data-drill-id="${d.id}" data-miner="miner_mk2">Mk.2</button>
                  <button type="button" class="btn-node-miner btn-power-node-miner ${d.minerTier === 'miner_mk3' ? 'active' : ''}" data-drill-id="${d.id}" data-miner="miner_mk3">Mk.3</button>
                </div>
              </div>

              <!-- Selector de Overclocking (1% a 250%) -->
              <div class="drill-control-group" style="flex: 1; min-width: 250px;">
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-bottom: 2px;">
                  <span class="drill-sublabel">Overclock:</span>
                  <span style="font-size: 0.74rem; font-weight: 800; color: ${d.clock > 100 ? '#f59e0b' : '#38bdf8'}; font-family: var(--font-mono);">
                    ${d.clock}% ${d.shards > 0 ? `<small style="color: #38bdf8; font-weight: 700;">(💎 ${d.shards} ${d.shards === 1 ? 'Shard' : 'Shards'})</small>` : ''}
                  </span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px; width: 100%;">
                  <input type="range" class="range-slider range-power-drill-clock" data-drill-id="${d.id}" min="1" max="250" value="${d.clock}" step="1" style="flex: 1;">
                  <div class="raw-clock-group-sm">
                    <button type="button" class="btn-node-clock btn-power-drill-clock ${d.clock === 100 ? 'active' : ''}" data-drill-id="${d.id}" data-clock="100">100%</button>
                    <button type="button" class="btn-node-clock btn-power-drill-clock ${d.clock === 150 ? 'active overclock' : ''}" data-drill-id="${d.id}" data-clock="150">150%</button>
                    <button type="button" class="btn-node-clock btn-power-drill-clock ${d.clock === 200 ? 'active overclock' : ''}" data-drill-id="${d.id}" data-clock="200">200%</button>
                    <button type="button" class="btn-node-clock btn-power-drill-clock ${d.clock === 250 ? 'active overclock' : ''}" data-drill-id="${d.id}" data-clock="250">250%</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `;
      }).join('');

      // Badge de Balance de Combustible / Petróleo
      if (balanceBadge && plant.fuel.balance) {
        const bal = plant.fuel.balance;
        if (isOilFuel) {
          if (bal.isCovered) {
            balanceBadge.innerHTML = `
              <span class="raw-balance-pill covered" style="display: inline-flex; align-items: center; gap: 6px;">
                <span>✅</span>
                <span><strong>Petróleo Satisfecho:</strong> Extraes ${bal.suppliedRate} m³/m para ${plant.petrochem.refineriesCount} Refinerías (${bal.difference >= 0 ? `+${bal.difference} m³/m libre` : 'Exacto'})</span>
              </span>
            `;
          } else {
            balanceBadge.innerHTML = `
              <span class="raw-balance-pill deficit" style="display: inline-flex; align-items: center; gap: 6px;">
                <span>⚠️</span>
                <span><strong>Falta Petróleo Crudo:</strong> Extraes ${bal.suppliedRate} m³/m pero requieres ${bal.requiredRate} m³/m (Déficit de ${Math.abs(bal.difference)} m³/m)</span>
              </span>
            `;
          }
        } else {
          if (bal.isCovered) {
            balanceBadge.innerHTML = `
              <span class="raw-balance-pill covered" style="display: inline-flex; align-items: center; gap: 6px;">
                <span>✅</span>
                <span><strong>Cubierto:</strong> Extraes ${bal.suppliedRate}/m &bull; Necesitas ${bal.requiredRate}/m (${bal.difference >= 0 ? `+${bal.difference}/m libre` : 'Exacto'})</span>
              </span>
            `;
          } else {
            balanceBadge.innerHTML = `
              <span class="raw-balance-pill deficit" style="display: inline-flex; align-items: center; gap: 6px;">
                <span>⚠️</span>
                <span><strong>Falta Carbón:</strong> Extraes ${bal.suppliedRate}/m pero requieres ${bal.requiredRate}/m (Déficit de ${Math.abs(bal.difference)}/m)</span>
              </span>
            `;
          }
        }
      }
    }

    // 2. Renderizar Cuadrícula de Métricas
    if (isOilFuel) {
      statsGrid.innerHTML = `
        <div class="power-stat-card stat-gross">
          <span class="power-stat-label">⚡ Potencia Bruta Total</span>
          <span class="power-stat-value" style="color: #38bdf8;">${plant.powerBalance.grossMW.toLocaleString()} MW</span>
          <span class="power-stat-sub">Generación nominal total</span>
        </div>

        <div class="power-stat-card stat-net">
          <span class="power-stat-label">🔌 Potencia Neta Suministrada</span>
          <span class="power-stat-value" style="color: #4ade80;">${plant.powerBalance.netMW.toLocaleString()} MW</span>
          <span class="power-stat-sub">
            <strong style="color: #4ade80;">⚡ ${plant.powerBalance.netEfficiency}%</strong> limpia para tu fábrica
          </span>
        </div>

        <div class="power-stat-card stat-generators">
          <span class="power-stat-label">🏭 Generadores de Combustible</span>
          <span class="power-stat-value" style="color: #c084fc;">${plant.totalGeneratorsCount} <small style="font-size: 0.85rem;">Edificios</small></span>
          <span class="power-stat-sub">
            Generador 1.0 (250 MW c/u)${plant.hasFractional ? ` &bull; 1 al <strong>${plant.lastClock}%</strong>` : ''}
          </span>
        </div>

        <div class="power-stat-card stat-fuel">
          <span class="power-stat-label">🛢️ Combustible Requerido</span>
          <span class="power-stat-value" style="color: #f59e0b;">${plant.fuel.totalRate.toLocaleString()} <small style="font-size: 0.85rem;">m³/min</small></span>
          <span class="power-stat-sub">
            ${plant.fuel.pipesNeededCount}x ${plant.water.pipeName} de Fuel
          </span>
        </div>

        <div class="power-stat-card" style="border-top: 3px solid #0284c7; background: #08111e;">
          <span class="power-stat-label">⚗️ Refinerías & Petróleo Crudo</span>
          <span class="power-stat-value" style="color: #38bdf8;">${plant.petrochem.refineriesCount} <small style="font-size: 0.85rem;">Refinerías</small></span>
          <span class="power-stat-sub">
            Consumen <strong>${plant.petrochem.crudeOilRate.toLocaleString()} m³/min</strong> de Crudo (${plant.petrochem.crudePipesCount}x ${plant.water.pipeName})
          </span>
        </div>

        <div class="power-stat-card" style="border-top: 3px solid #c084fc; background: #130a1c;">
          <span class="power-stat-label">💜 Subproducto: Resina</span>
          <span class="power-stat-value" style="color: #e879f9;">${plant.petrochem.polymerResinRate.toLocaleString()} <small style="font-size: 0.85rem;">/min</small></span>
          <span class="power-stat-sub" style="color: #f472b6;">
            ⚠️ Enviar a <strong>Trituradora Awesome Sink</strong> (${plant.petrochem.resinBelt.name}) para evitar apagones
          </span>
        </div>

        <div class="power-stat-card stat-gross" style="border-top-color: #ef4444;">
          <span class="power-stat-label">🔄 Autoconsumo de la Central</span>
          <span class="power-stat-value" style="color: #f87171;">-${plant.powerBalance.totalInternalMW.toLocaleString()} MW</span>
          <span class="power-stat-sub">
            ${plant.petrochem.refineryPower} MW Refinerías + ${plant.fuel.minersPower} MW Extractores + ${plant.petrochem.sinkPower} MW Sink
          </span>
        </div>
      `;
    } else {
      statsGrid.innerHTML = `
        <div class="power-stat-card stat-gross">
          <span class="power-stat-label">⚡ Potencia Bruta Total</span>
          <span class="power-stat-value" style="color: #38bdf8;">${plant.powerBalance.grossMW.toLocaleString()} MW</span>
          <span class="power-stat-sub">Generación nominal total</span>
        </div>

        <div class="power-stat-card stat-net">
          <span class="power-stat-label">🔌 Potencia Neta Suministrada</span>
          <span class="power-stat-value" style="color: #4ade80;">${plant.powerBalance.netMW.toLocaleString()} MW</span>
          <span class="power-stat-sub">
            <strong style="color: #4ade80;">⚡ ${plant.powerBalance.netEfficiency}%</strong> limpia para tu fábrica
          </span>
        </div>

        <div class="power-stat-card stat-generators">
          <span class="power-stat-label">🏭 Generadores Requeridos</span>
          <span class="power-stat-value" style="color: #c084fc;">${plant.totalGeneratorsCount} <small style="font-size: 0.85rem;">Edificios</small></span>
          <span class="power-stat-sub">
            ${plant.fullGenerators} al 100%${plant.hasFractional ? ` + 1 ajustado al <strong>${plant.lastClock}%</strong>` : ''}
          </span>
        </div>

        <div class="power-stat-card stat-fuel">
          <span class="power-stat-label">🪨 Combustible Requerido</span>
          <span class="power-stat-value" style="color: #f59e0b;">${plant.fuel.totalRate.toLocaleString()} <small style="font-size: 0.85rem;">/min</small></span>
          <span class="power-stat-sub">
            ${plant.fuel.name} &bull; ${plant.fuel.beltsNeededCount ? `${plant.fuel.beltsNeededCount}x ${plant.fuel.belt.name}` : `${plant.fuel.pipesNeededCount}x ${plant.water.pipeName}`}
            ${plant.fuel.balance ? ` (Extraes ${plant.fuel.balance.suppliedRate}/m)` : ''}
          </span>
        </div>

        <div class="power-stat-card stat-water">
          <span class="power-stat-label">💧 Consumo de Agua</span>
          <span class="power-stat-value" style="color: #06b6d4;">${plant.water.requiresWater ? `${plant.water.totalRate.toLocaleString()} m³/min` : '0 m³/min'}</span>
          <span class="power-stat-sub">
            ${plant.water.requiresWater 
              ? `<strong>${plant.water.extractorsCount} Extractores</strong> al 100% en <strong>${plant.water.pipesNeededCount}x</strong> ${plant.water.pipeName}` 
              : 'Esta central no utiliza agua'
            }
          </span>
        </div>

        <div class="power-stat-card stat-gross" style="border-top-color: #ef4444;">
          <span class="power-stat-label">🔄 Autoconsumo de la Central</span>
          <span class="power-stat-value" style="color: #f87171;">-${plant.powerBalance.totalInternalMW.toLocaleString()} MW</span>
          <span class="power-stat-sub">
            ${plant.water.extractorPower} MW bombas + ${plant.fuel.minersPower} MW minería
          </span>
        </div>
      `;
    }

    // 3. Renderizar Explicación Clara y Didáctica de la Arquitectura
    if (archCard) {
      if (plant.generator.id === 'fuel_generator') {
        archCard.style.display = 'block';
        archCard.innerHTML = `
          <div class="power-architecture-header">
            <div>
              <span style="font-size: 0.72rem; color: #38bdf8; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Guía Práctica de Construcción FICSIT &bull; Petróleo y Combustible 1.0</span>
              <h3 style="margin: 2px 0 0; font-size: 1.05rem; color: #f1f5f9; display: flex; align-items: center; gap: 8px;">
                <span>📐 La Regla de Oro 1:2 (1 Refinería = 2 Generadores = 500 MW)</span>
              </h3>
            </div>
            <span class="blueprint-badge" style="background: rgba(74, 222, 128, 0.15); border-color: #4ade80; color: #4ade80;">
              Cero Atascos con Trituradora FICSIT (Awesome Sink)
            </span>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; margin-bottom: 14px;">
            <div style="background: #090e18; border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 10px 12px;">
              <strong style="color: #fbbf24; font-size: 0.8rem; display: block; margin-bottom: 4px;">1. ¿Por qué el módulo perfecto es 1:2 (500 MW)?</strong>
              <p style="font-size: 0.78rem; color: #cbd5e1; line-height: 1.5; margin: 0;">
                En Satisfactory 1.0, 1 Refinería toma <strong>60 m³/min de Petróleo Crudo</strong> y produce <strong>40 m³/min de Fuel</strong>. Cada Generador de Combustible toma exactamente <strong>20 m³/min de Fuel</strong> y entrega <strong>250 MW</strong>.
                ¡1 Refinería alimenta con precisión milimétrica a <strong>2 Generadores (500 MW)</strong> sin decimales ni sobrantes de combustible!
              </p>
            </div>

            <div style="background: #15091a; border: 1px solid rgba(192, 132, 252, 0.4); border-radius: 6px; padding: 10px 12px;">
              <strong style="color: #e879f9; font-size: 0.8rem; display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                <span>⚠️</span> 2. ¡EL PELIGRO DEL APAGÓN! (Atasco de Resina)
              </strong>
              <p style="font-size: 0.78rem; color: #cbd5e1; line-height: 1.5; margin: 0;">
                La refinería produce <strong>30 Resina de Polímero/min</strong> como subproducto. Si no la sacas, el almacén de la refinería se llena (100 u.), <strong>la producción de Fuel se detiene al 100%</strong>, los generadores se vacían y tu red eléctrica colapsa en un apagón general.
                <br><strong style="color: #4ade80;">Solución FICSIT:</strong> Conecta la salida de sólidos con una cinta hacia una <strong>Trituradora FICSIT (Awesome Sink)</strong>. ¡Triturar la resina te da cupones y asegura que la central jamás se apague!
              </p>
            </div>

            <div style="background: #090e18; border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 10px 12px;">
              <strong style="color: #38bdf8; font-size: 0.8rem; display: block; margin-bottom: 4px;">3. Tuberías de Petróleo y Fuel (300 vs 600 m³/min)</strong>
              <p style="font-size: 0.78rem; color: #cbd5e1; line-height: 1.5; margin: 0;">
                Tu central consume <strong>${plant.fuel.totalRate} m³/min de Fuel</strong> provenientes de <strong>${plant.petrochem.crudeOilRate} m³/min de Petróleo Crudo</strong>.
                Una Tubería Mk.1 aguanta 300 m³/min (suficiente para 5 refinerías = 10 generadores = 2,500 MW). Para tu meta necesitas <strong>${plant.fuel.pipesNeededCount} Tubería(s)</strong>.
                Alimenta los manifolds desde ambos extremos en bucle para evitar pérdida de carga hidráulica.
              </p>
            </div>

            <div style="background: #090e18; border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 10px 12px;">
              <strong style="color: #4ade80; font-size: 0.8rem; display: block; margin-bottom: 4px;">4. Cómo construir tus ${plant.powerBalance.grossMW.toLocaleString()} MW</strong>
              <p style="font-size: 0.78rem; color: #cbd5e1; line-height: 1.5; margin: 0;">
                Construye <strong>${plant.modularArchitecture.standardModulesCount} bloques de 500 MW</strong> (cada uno con 1 Refinería + 2 Generadores de Combustible 1.0) ${plant.modularArchitecture.hasRemainder ? `+ 1 bloque de ajuste de ${plant.modularArchitecture.remainderGenerators} generadores (${plant.modularArchitecture.remainderMW} MW)` : ''}.
                En total son <strong>${plant.petrochem.refineriesCount} Refinerías</strong> y <strong>${plant.totalGeneratorsCount} Generadores de Combustible</strong>.
              </p>
            </div>
          </div>
        `;
      } else if (plant.modularArchitecture) {
        archCard.style.display = 'block';
        archCard.innerHTML = `
          <div class="power-architecture-header">
            <div>
              <span style="font-size: 0.72rem; color: #38bdf8; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Guía Práctica de Construcción FICSIT</span>
              <h3 style="margin: 2px 0 0; font-size: 1.05rem; color: #f1f5f9; display: flex; align-items: center; gap: 8px;">
                <span>📐 La Regla de los 8 Generadores y 3 Extractores (600 MW)</span>
              </h3>
            </div>
            <span class="blueprint-badge" style="background: rgba(74, 222, 128, 0.15); border-color: #4ade80; color: #4ade80;">
              Conexión 100% Estable Sin Apagones
            </span>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; margin-bottom: 14px;">
            <div style="background: #090e18; border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 10px 12px;">
              <strong style="color: #fbbf24; font-size: 0.8rem; display: block; margin-bottom: 4px;">1. ¿Por qué se agrupan de a 8 generadores?</strong>
              <p style="font-size: 0.78rem; color: #cbd5e1; line-height: 1.5; margin: 0;">
                Cada generador toma <strong>15 carbón/min</strong> y <strong>45 m³/min de agua</strong>. Al juntar 8 generadores, el consumo es de exactamente <strong>120 carbón/min</strong> (justo lo que entrega 1 Cinta Mk.2) y <strong>360 m³/min de agua</strong> (justo lo que dan 3 Extractores de Agua).
              </p>
            </div>

            <div style="background: #090e18; border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 10px 12px;">
              <strong style="color: #38bdf8; font-size: 0.8rem; display: block; margin-bottom: 4px;">2. El truco de conectar el agua (Sin ahogos)</strong>
              <p style="font-size: 0.78rem; color: #cbd5e1; line-height: 1.5; margin: 0;">
                Una Tubería Mk.1 solo aguanta <strong>300 m³/min</strong>. Si inyectas los 360 m³ por una sola punta, la tubería se satura y los últimos generadores se quedan secos. En el plano verás la solución oficial: <strong>1 extractor entra por la izquierda, 1 por la derecha y 1 por el centro</strong>. ¡Así nunca se ahoga!
              </p>
            </div>

            <div style="background: #090e18; border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 10px 12px;">
              <strong style="color: #4ade80; font-size: 0.8rem; display: block; margin-bottom: 4px;">3. Cómo construir tus ${plant.powerBalance.grossMW.toLocaleString()} MW</strong>
              <p style="font-size: 0.78rem; color: #cbd5e1; line-height: 1.5; margin: 0;">
                En vez de conectar 107 generadores en una sola línea enredada, simplemente construye <strong>${plant.modularArchitecture.standardModulesCount} bloques idénticos de 8 generadores</strong> (suman ${(plant.modularArchitecture.standardModulesCount * 600).toLocaleString()} MW) ${plant.modularArchitecture.hasRemainder ? `+ 1 bloque pequeño de ${plant.modularArchitecture.remainderGenerators} generadores (${plant.modularArchitecture.remainderMW} MW)` : ''}.
              </p>
            </div>
          </div>

          <!-- COMPARATIVA: CASCADA VS MITAD Y MITAD & LOGÍSTICA DE TALADROS -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 12px; margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 12px;">
            <!-- Comparativa de Distribución -->
            <div style="background: #08101e; border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 6px; padding: 12px;">
              <strong style="color: #38bdf8; font-size: 0.84rem; display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
                <span>⚖️</span> 4. ¿División en Cascada ("en fila") o Mitad y Mitad (Balanceado)?
              </strong>
              <div style="font-size: 0.77rem; color: #cbd5e1; line-height: 1.55;">
                <div style="margin-bottom: 8px;">
                  <span style="color: #ea580c; font-weight: 800;">• Cascada en serie (Línea continua):</span>
                  Los divisores van uno tras otro. <em>El Generador #1 toma 60/m</em> y llena su almacén de 100 muy rápido, pero <em>el Generador #8 recibe solo 0.45/m</em> al inicio. Tarda entre <strong>8 y 15 minutos en saturarse</strong>, y mientras tanto los generadores lejanos parpadean y apagan la central. <em>(Solo úsalo si precargas carbón a mano antes de arrancar)</em>.
                </div>
                <div>
                  <span style="color: #4ade80; font-weight: 800;">• Mitad y Mitad (Central 60/60) ⭐ RECOMENDADO:</span>
                  La cinta entra por el centro con un divisor 50%/50% y reparte <strong>60/min a la izquierda (Gen 1 al 4)</strong> y <strong>60/min a la derecha (Gen 5 al 8)</strong>. Se llena <strong>4 veces más rápido</strong>, los extremos no sufren y la red es estable desde el primer minuto.
                </div>
              </div>
            </div>

            <!-- Logística Macro de Taladros (Regla 240/min) -->
            <div style="background: #08101e; border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 6px; padding: 12px;">
              <strong style="color: #fbbf24; font-size: 0.84rem; display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
                <span>⛏️</span> 5. Regla FICSIT de los 240/min para tus Taladros
              </strong>
              <div style="font-size: 0.77rem; color: #cbd5e1; line-height: 1.55;">
                <div style="margin-bottom: 8px;">
                  <span style="color: #f87171; font-weight: 800;">• Nunca unas 43 taladros en 1 sola cinta:</span>
                  Para ${plant.powerBalance.grossMW.toLocaleString()} MW necesitas <strong>${plant.fuel.totalRate} carbón/min</strong>. ¡Ninguna cinta del juego soporta 1,600/min en una sola línea (la Mk.5 aguanta 780)! Si unes todo, las cintas colapsan y los bloques lejanos mueren de hambre.
                </div>
                <div>
                  <span style="color: #fbbf24; font-weight: 800;">• La Solución en Parejas de Bloques (240/min):</span>
                  Agrupa tus taladros en cintas de <strong>240 carbón/min</strong> (Cinta Mk.3 de 270). A cada salida de 240/min ponle un <strong>Splitter 50%/50%</strong> que saque dos cintas de <strong>120/min</strong>: una va al <em>Bloque Maestro A (600 MW)</em> y la otra al <em>Bloque Maestro B (600 MW)</em>. Para tus ${plant.modularArchitecture ? plant.modularArchitecture.standardModulesCount : 1} bloques necesitas exactamente <strong>${Math.ceil((plant.modularArchitecture ? plant.modularArchitecture.standardModulesCount : 1) / 2)} líneas de 240/min</strong>.
                </div>
              </div>
            </div>
          </div>
        `;
      } else {
        archCard.style.display = 'none';
      }
    }

    // 4. Renderizar Plano 2D Aéreo de la Central Eléctrica
    renderPowerPlantBlueprint(plant);
  }

  function renderPowerPlantBlueprint(plant) {
    const canvas = document.getElementById('powerBlueprintCanvas');
    const subtitle = document.getElementById('powerBpSubtitle');
    const viewBlockLabel = document.getElementById('powerViewBlockLabel');
    const coalDistSwitcher = document.getElementById('powerBpCoalDistSwitcher');
    const legend = document.getElementById('powerBlueprintLegend');
    if (!canvas) return;

    const isOil = !!(plant.petrochem && plant.petrochem.isOil);
    const isBlockMode = state.power.blueprintMode === 'block';

    if (viewBlockLabel) {
      viewBlockLabel.textContent = isOil 
        ? '📐 Plano de Montaje (1 Refinería : 2 Generadores • 500 MW)' 
        : '📐 Plano de Montaje (8 Generadores : 3 Extractores • 600 MW)';
    }

    if (coalDistSwitcher) {
      coalDistSwitcher.style.display = isOil ? 'none' : 'inline-flex';
    }

    if (legend) {
      if (isOil) {
        legend.innerHTML = `
          <div class="legend-item">
            <span class="legend-color-box" style="background: #0284c7;"></span>
            <span>🛢️ Petróleo Crudo y Tuberías</span>
          </div>
          <div class="legend-item">
            <span class="legend-color-box" style="background: #f59e0b;"></span>
            <span>🟧 Fuel / Combustible Líquido</span>
          </div>
          <div class="legend-item">
            <span class="legend-color-box" style="background: #c084fc;"></span>
            <span>🟪 Resina de Polímero ➔ Trituradora</span>
          </div>
          <div class="legend-item">
            <span class="legend-color-box" style="background: #38bdf8;"></span>
            <span>🟦 Refinería FICSIT (Receta: Fuel)</span>
          </div>
          <div class="legend-item">
            <span class="legend-color-box" style="background: #22c55e;"></span>
            <span>🟩 Red Eléctrica Aérea (+500 MW)</span>
          </div>
        `;
      } else {
        legend.innerHTML = `
          <div class="legend-item">
            <span class="legend-color-box" style="background: #ea580c;"></span>
            <span>🟧 Carbón y Divisores (Splitters)</span>
          </div>
          <div class="legend-item">
            <span class="legend-color-box" style="background: #00e5ff;"></span>
            <span>🟦 Agua y Manifold Colector</span>
          </div>
          <div class="legend-item">
            <span class="legend-color-box" style="background: #8b5cf6;"></span>
            <span>🟪 Generadores de Carbón (75 MW)</span>
          </div>
          <div class="legend-item">
            <span class="legend-color-box" style="background: #22c55e;"></span>
            <span>🟩 Red Eléctrica Aérea y Subestación (+600 MW)</span>
          </div>
        `;
      }
    }

    if (subtitle) {
      if (isBlockMode) {
        if (isOil) {
          subtitle.innerHTML = `Mostrando plano de montaje de 1 Bloque Maestro de Petróleo (1 Refinería : 2 Generadores &bull; 500 MW) &bull; Clona este bloque ${plant.modularArchitecture ? plant.modularArchitecture.standardModulesCount : 1} veces`;
        } else {
          subtitle.innerHTML = `Mostrando plano de montaje de 1 Bloque Maestro (8 Generadores &bull; 600 MW) &bull; Clona este bloque ${plant.modularArchitecture ? plant.modularArchitecture.standardModulesCount : 1} veces`;
        }
      } else {
        subtitle.innerHTML = `Mostrando plano panorámico de toda la central (${plant.powerBalance.grossMW.toLocaleString()} MW &bull; ${plant.totalGeneratorsCount} Generadores totales)`;
      }
    }

    const { svg, model } = generatePowerPlantBlueprintSvg(plant);
    canvas.innerHTML = svg;
    powerBpState.currentModel = model;

    requestAnimationFrame(() => {
      fitPowerBlueprintToViewport();
    });

    attachPowerBlueprintHoverTooltips();
  }

  function generatePowerPlantBlueprintSvg(plant) {
    const mode = state.power.blueprintMode || 'block';
    const isOil = !!(plant.petrochem && plant.petrochem.isOil);

    if (mode === 'overview') {
      if (isOil) {
        return generatePowerOilOverviewBlueprintSvg(plant);
      }
      return generatePowerOverviewBlueprintSvg(plant);
    } else {
      if (isOil) {
        return generatePowerOilBlockBlueprintSvg(plant);
      }
      return generatePowerBlockBlueprintSvg(plant);
    }
  }

  // --- MODO 1: PLANO DETALLADO DE MONTAJE DEL BLOQUE (8 GENERADORES : 3 EXTRACTORES) ---
  function generatePowerBlockBlueprintSvg(plant) {
    const totalW = 1480;
    const totalH = 740;

    const genW = 128;
    const genH = 96;
    const gapX = 36;
    const startX = 65;
    const genY = 245;
    const beltY = 160;
    const isBalanced = (state.power.coalDistribution || 'balanced') === 'balanced';
    const midX = Math.round(startX + 3.5 * (genW + gapX) + genW / 2); // 703 px (centro entre Gen 4 y 5)

    let svg = `<svg viewBox="0 0 ${totalW} ${totalH}" width="${totalW}" height="${totalH}" xmlns="http://www.w3.org/2000/svg" style="background: #040812; font-family: var(--font-main);">
      <defs>
        <!-- Rejilla de cimientos Satisfactory -->
        <pattern id="blockGridPat" width="60" height="60" patternUnits="userSpaceOnUse">
          <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(255,255,255,0.035)" stroke-width="1"/>
          <path d="M 30 0 L 30 60 M 0 30 L 60 30" fill="none" stroke="rgba(255,255,255,0.015)" stroke-width="0.5"/>
        </pattern>

        <!-- Gradiente de Lago / Agua Marina -->
        <linearGradient id="lakeWaterGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#022c43" stop-opacity="0.85"/>
          <stop offset="50%" stop-color="#034569" stop-opacity="0.95"/>
          <stop offset="100%" stop-color="#041c2c" stop-opacity="1"/>
        </linearGradient>

        <!-- Gradiente Generador (Violeta Tecnológico / Gris Acero) -->
        <linearGradient id="generatorChassisGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#1e1b4b"/>
          <stop offset="100%" stop-color="#0f172a"/>
        </linearGradient>

        <!-- Filtros de Resplandor Neón -->
        <filter id="glowGreen" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="glowCyan" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="glowOrange" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      <!-- Fondo Cuadrícula -->
      <rect width="${totalW}" height="${totalH}" fill="url(#blockGridPat)" />

      <!-- =========================================================================
           1. BARRA SUPERIOR: TÍTULO Y LEYENDA DE COLORES DE ALTO CONTRASTE
           ========================================================================= -->
      <rect x="35" y="14" width="${totalW - 70}" height="54" rx="8" fill="#090f19" stroke="rgba(56, 189, 248, 0.35)" stroke-width="1.5"/>
      
      <!-- Título del Plano -->
      <text x="50" y="34" fill="#f8fafc" font-size="13" font-weight="900" letter-spacing="0.5">
        📐 ESQUEMA DE MONTAJE DEL BLOQUE MAESTRO (8 Generadores de Carbón : 3 Extractores de Agua = 600 MW)
      </text>
      <text x="50" y="52" fill="#94a3b8" font-size="10.5">
        Distribución de Carbón: <tspan fill="${isBalanced ? '#4ade80' : '#f59e0b'}" font-weight="900">${isBalanced ? '🔀 Mitad y Mitad (Central 60/60 - Recomendado)' : '➡️ Cascada (Manifold Lineal)'}</tspan> • Meta: <tspan fill="#4ade80" font-weight="900">${plant.modularArchitecture ? plant.modularArchitecture.standardModulesCount : 1} bloques idénticos</tspan>.
      </text>

      <!-- Leyenda de Colores (4 Colores 100% Distintos) -->
      <g transform="translate(${totalW - 680}, 24)">
        <!-- 1. Carbón: Naranja -->
        <rect x="0" y="0" width="14" height="14" rx="3" fill="#ea580c" stroke="#ff781f" stroke-width="1.5"/>
        <text x="18" y="11" fill="#fed7aa" font-size="9.5" font-weight="800">Carbón (Naranja)</text>

        <!-- 2. Agua: Azul Cian -->
        <rect x="135" y="0" width="14" height="14" rx="3" fill="#0284c7" stroke="#00e5ff" stroke-width="1.5"/>
        <text x="153" y="11" fill="#7dd3fc" font-size="9.5" font-weight="800">Agua (Azul Cian)</text>

        <!-- 3. Generadores: Violeta/Gris -->
        <rect x="270" y="0" width="14" height="14" rx="3" fill="#1e1b4b" stroke="#a855f7" stroke-width="1.5"/>
        <text x="288" y="11" fill="#d8b4fe" font-size="9.5" font-weight="800">Generadores (Violeta)</text>

        <!-- 4. Electricidad: Verde Neón -->
        <rect x="430" y="0" width="14" height="14" rx="3" fill="#052e16" stroke="#22c55e" stroke-width="1.5"/>
        <text x="448" y="11" fill="#86efac" font-size="9.5" font-weight="800">Red Eléctrica (Verde)</text>
      </g>

      <!-- =========================================================================
           2. NIVEL 1 (SUPERIOR): RED ELÉCTRICA AÉREA Y SUBESTACIÓN (+600 MW)
           ========================================================================= -->
      <!-- Línea troncal aérea verde de alta tensión -->
      <path d="M ${startX + genW / 2} 90 L ${totalW - 200} 90" stroke="#15803d" stroke-width="6" fill="none" stroke-linecap="round"/>
      <path d="M ${startX + genW / 2} 90 L ${totalW - 200} 90" stroke="#22c55e" stroke-width="2.5" stroke-dasharray="8 6" fill="none" filter="url(#glowGreen)"/>
      <text x="${startX + 10}" y="84" fill="#86efac" font-size="9" font-weight="800" letter-spacing="0.5">
        ⚡ CABLEADO AÉREO DE ALTA TENSIÓN (Conexión de los 8 Generadores)
      </text>

      <!-- Subestación de Bloque (+600 MW) -->
      <g class="power-substation-node" style="cursor: pointer;">
        <rect x="${totalW - 195}" y="52" width="160" height="76" rx="8" fill="#052e16" stroke="#22c55e" stroke-width="2.5" filter="url(#glowGreen)"/>
        <circle cx="${totalW - 165}" cy="82" r="14" fill="#22c55e" />
        <text x="${totalW - 165}" y="87" fill="#022c22" font-size="14" font-weight="900" text-anchor="middle">⚡</text>
        <text x="${totalW - 142}" y="76" fill="#ffffff" font-size="10" font-weight="800">SUBESTACIÓN</text>
        <text x="${totalW - 142}" y="95" fill="#4ade80" font-size="16" font-weight="900">+600 MW</text>
        <text x="${totalW - 142}" y="112" fill="#86efac" font-size="8.5">8 Generadores a red</text>
      </g>

      <!-- =========================================================================
           3. NIVEL 2: LÍNEA TRONCAL DE CARBÓN Y DIVISORES (SPLITTERS)
           ========================================================================= -->
      ${isBalanced ? `
        <!-- ENTRADA CENTRAL BALANCEADA (50% IZQUIERDA / 50% DERECHA) -->
        <path d="M ${midX} 98 L ${midX} ${beltY - 18}" stroke="#ea580c" stroke-width="5" fill="none" />
        <polygon points="${midX - 5},${beltY - 20} ${midX + 5},${beltY - 20} ${midX},${beltY - 12}" fill="#ea580c" />

        <!-- Cartel Central de Entrada de Carbón -->
        <rect x="${midX - 130}" y="64" width="260" height="26" rx="5" fill="#1c0b05" stroke="#ea580c" stroke-width="1.8" />
        <text x="${midX}" y="81" fill="#ffedd5" font-size="10.5" font-weight="900" text-anchor="middle">
          🪨 Entrada Central: 120/min (Cinta Mk.2)
        </text>

        <!-- Riel Rama Izquierda: de midX a Generador 1 -->
        <path d="M ${midX - 54} ${beltY} L ${startX + genW / 2} ${beltY}" stroke="#1e293b" stroke-width="12" fill="none" stroke-linecap="round" />
        <path d="M ${midX - 54} ${beltY} L ${startX + genW / 2} ${beltY}" stroke="#7c2d12" stroke-width="7" fill="none" />
        <path d="M ${midX - 54} ${beltY} L ${startX + genW / 2} ${beltY}" class="blueprint-belt-flow" stroke="#ea580c" stroke-width="3" stroke-dasharray="14 10" fill="none" />

        <!-- Etiqueta Rama Izquierda -->
        <rect x="${startX + 20}" y="${beltY - 32}" width="220" height="20" rx="4" fill="#180702" stroke="#ea580c" stroke-width="1.2" />
        <text x="${startX + 130}" y="${beltY - 18}" fill="#fed7aa" font-size="9" font-weight="800" text-anchor="middle">
          ⬅ Rama Izquierda: 60/min (Generadores 1 al 4)
        </text>

        <!-- Riel Rama Derecha: de midX a Generador 8 -->
        <path d="M ${midX + 54} ${beltY} L ${startX + 7 * (genW + gapX) + genW / 2} ${beltY}" stroke="#1e293b" stroke-width="12" fill="none" stroke-linecap="round" />
        <path d="M ${midX + 54} ${beltY} L ${startX + 7 * (genW + gapX) + genW / 2} ${beltY}" stroke="#7c2d12" stroke-width="7" fill="none" />
        <path d="M ${midX + 54} ${beltY} L ${startX + 7 * (genW + gapX) + genW / 2} ${beltY}" class="blueprint-belt-flow" stroke="#ea580c" stroke-width="3" stroke-dasharray="14 10" fill="none" />

        <!-- Etiqueta Rama Derecha -->
        <rect x="${midX + 80}" y="${beltY - 32}" width="220" height="20" rx="4" fill="#180702" stroke="#ea580c" stroke-width="1.2" />
        <text x="${midX + 190}" y="${beltY - 18}" fill="#fed7aa" font-size="9" font-weight="800" text-anchor="middle">
          Rama Derecha: 60/min (Generadores 5 al 8) ➔
        </text>

        <!-- Divisor Central Mitad y Mitad (Splitter 50%/50%) -->
        <g class="power-splitter-node" data-id="sp_central" data-name="Divisor Central FICSIT (50% / 50%)" data-flow="60 /min Izquierda (Gen 1-4) + 60 /min Derecha (Gen 5-8)" style="cursor: pointer;">
          <rect x="${midX - 54}" y="${beltY - 18}" width="108" height="36" rx="6" fill="#2d1205" stroke="#ea580c" stroke-width="2.5" filter="url(#glowOrange)"/>
          <text x="${midX}" y="${beltY - 2}" fill="#ffedd5" font-size="9.5" font-weight="900" text-anchor="middle">
            🔀 Divisor Central
          </text>
          <text x="${midX}" y="${beltY + 11}" fill="#fdba74" font-size="8.5" font-weight="800" text-anchor="middle">
            50% Izq | 50% Der (60/m)
          </text>
        </g>
      ` : `
        <!-- ENTRADA EN CASCADA CONTINUA (DE IZQUIERDA A DERECHA) -->
        <path d="M 35 ${beltY} L ${startX + 8 * (genW + gapX) - 15} ${beltY}" stroke="#1e293b" stroke-width="12" fill="none" stroke-linecap="round" />
        <path d="M 35 ${beltY} L ${startX + 8 * (genW + gapX) - 15} ${beltY}" stroke="#7c2d12" stroke-width="7" fill="none" />
        <path d="M 35 ${beltY} L ${startX + 8 * (genW + gapX) - 15} ${beltY}" class="blueprint-belt-flow" stroke="#ea580c" stroke-width="3" stroke-dasharray="14 10" fill="none" />
        
        <!-- Cartel de Entrada de Carbón en Cascada -->
        <rect x="35" y="${beltY - 36}" width="260" height="26" rx="4" fill="#1c0b05" stroke="#ea580c" stroke-width="1.8" />
        <text x="45" y="${beltY - 19}" fill="#ffedd5" font-size="10.5" font-weight="900">
          🪨 Entrada Cascada: 120/min (Cinta Mk.2)
        </text>
      `}

      <!-- =========================================================================
           4. NIVEL 3: LOS 8 GENERADORES DE CARBÓN Y SUS DIVISORES
           ========================================================================= -->
    `;

    for (let i = 0; i < 8; i++) {
      const gx = startX + i * (genW + gapX);
      const splitX = gx + genW / 2;
      const isLeftBranch = i < 4;
      const splitFlow = isBalanced
        ? (isLeftBranch ? `15 /min de Rama Izquierda hacia Generador #${i + 1}` : `15 /min de Rama Derecha hacia Generador #${i + 1}`)
        : `15 /min en cascada hacia Generador #${i + 1}`;

      // 1. Cable eléctrico vertical que sube desde el techo del generador a la red
      svg += `
        <line x1="${splitX}" y1="${genY}" x2="${splitX}" y2="90" stroke="#22c55e" stroke-width="2" stroke-dasharray="4 4" opacity="0.85" />
        <circle cx="${splitX}" cy="90" r="4" fill="#22c55e" />
        <circle cx="${splitX}" cy="${genY}" r="3.5" fill="#4ade80" />
      `;

      // 2. DIVISOR DE CARBÓN (SPLITTER) - Rótulo claro sin siglas crípticas
      svg += `
        <g class="power-splitter-node" data-id="sp_${i}" data-name="Divisor de Carbón #${i + 1} (Splitter)" data-flow="${splitFlow}" style="cursor: pointer;">
          <!-- Caja del Divisor -->
          <rect x="${splitX - 32}" y="${beltY - 17}" width="64" height="34" rx="4" fill="#271006" stroke="#ea580c" stroke-width="2" filter="url(#glowOrange)"/>
          <text x="${splitX}" y="${beltY - 2}" fill="#ffedd5" font-size="9" font-weight="900" text-anchor="middle">
            🔀 Divisor #${i + 1}
          </text>
          <text x="${splitX}" y="${beltY + 11}" fill="#fdba74" font-size="8" font-weight="700" text-anchor="middle">
            (Splitter)
          </text>

          <!-- Bajada de carbón hacia la tolva del generador (+15/min) -->
          <path d="M ${splitX} ${beltY + 17} L ${splitX} ${genY}" stroke="#ea580c" stroke-width="4" fill="none" />
          <polygon points="${splitX - 4},${genY - 2} ${splitX + 4},${genY - 2} ${splitX},${genY + 4}" fill="#ea580c" />
          
          <rect x="${splitX - 25}" y="${genY - 22}" width="50" height="15" rx="3" fill="#180702" stroke="#ea580c" stroke-width="1" />
          <text x="${splitX}" y="${genY - 11}" fill="#ffedd5" font-size="8" font-weight="800" text-anchor="middle">15/min</text>
        </g>
      `;

      // 3. GENERADOR DE CARBÓN (CHASIS VIOLETA TECNOLÓGICO FICSIT)
      svg += `
        <g class="power-generator-node" data-id="gen_${i}" data-name="Generador de Carbón #${i + 1}" data-mw="75 MW" data-clock="100%" data-fuel="15 /min" data-water="45 m³/min" style="cursor: pointer;">
          <!-- Cimiento de hormigón -->
          <rect x="${gx - 5}" y="${genY - 5}" width="${genW + 10}" height="${genH + 10}" rx="6" fill="#1e293b" stroke="#334155" stroke-width="1.2" />
          
          <!-- Chasis del Edificio (Violeta Industrial FICSIT) -->
          <rect x="${gx}" y="${genY}" width="${genW}" height="${genH}" rx="6" fill="url(#generatorChassisGrad)" stroke="#8b5cf6" stroke-width="2.5" />

          <!-- Chimenea de Combustión -->
          <circle cx="${gx + 22}" cy="${genY + 24}" r="14" fill="#090d16" stroke="#a855f7" stroke-width="2" />
          <circle cx="${gx + 22}" cy="${genY + 24}" r="6" fill="#c084fc" />
          <text x="${gx + 22}" y="${genY + 28}" font-size="11" text-anchor="middle">💨</text>

          <!-- Título y Potencia -->
          <text x="${gx + 42}" y="${genY + 22}" fill="#ffffff" font-size="11.5" font-weight="900">Generador #${i + 1}</text>
          <text x="${gx + 42}" y="${genY + 40}" fill="#4ade80" font-size="13" font-weight="900">⚡ 75 MW</text>
          
          <!-- Puerto de entrada de Carbón (Arriba) -->
          <rect x="${splitX - 12}" y="${genY - 3}" width="24" height="6" rx="2" fill="#ea580c" />
          
          <!-- Puerto de entrada de Agua (Abajo) -->
          <rect x="${splitX - 12}" y="${genY + genH - 3}" width="24" height="6" rx="2" fill="#00e5ff" />

          <!-- Barra de Consumos (15 Carbón / 45 Agua) -->
          <rect x="${gx + 6}" y="${genY + 54}" width="${genW - 12}" height="32" rx="4" fill="#090f1a" stroke="rgba(255,255,255,0.08)" stroke-width="1" />
          <text x="${gx + 12}" y="${genY + 68}" fill="#fed7aa" font-size="9" font-weight="800">🪨 15 Carbón/m</text>
          <text x="${gx + 12}" y="${genY + 81}" fill="#7dd3fc" font-size="9" font-weight="800">💧 45 m³ Agua/m</text>
        </g>
      `;

      // 4. Subida vertical de agua desde el manifold colector hacia la base del generador
      const pipeY = 415;
      svg += `
        <!-- Cruce de Tubería -->
        <circle cx="${splitX}" cy="${pipeY}" r="7" fill="#034569" stroke="#00e5ff" stroke-width="2" />
        <path d="M ${splitX} ${pipeY} L ${splitX} ${genY + genH}" stroke="#00e5ff" stroke-width="4.5" fill="none" />
        <polygon points="${splitX - 4},${genY + genH + 4} ${splitX + 4},${genY + genH + 4} ${splitX},${genY + genH - 2}" fill="#00e5ff" />
        
        <rect x="${splitX - 25}" y="${pipeY - 26}" width="50" height="15" rx="3" fill="#041a27" stroke="#00e5ff" stroke-width="1" />
        <text x="${splitX}" y="${pipeY - 15}" fill="#7dd3fc" font-size="8" font-weight="800" text-anchor="middle">45 m³/m</text>
      `;
    }

    // =========================================================================
    // 5. NIVEL 4: MANIFOLD COLECTOR DE AGUA (TUBERÍA MK.1 EN BUCLE CERRADO)
    // =========================================================================
    const pipeY = 415;
    svg += `
      <!-- Tubería Troncal de Agua (Azul Marino y Cian Neón) -->
      <path d="M ${startX + 10} ${pipeY} L ${startX + 7 * (genW + gapX) + genW - 10} ${pipeY}" stroke="#022c43" stroke-width="14" fill="none" stroke-linecap="round" />
      <path d="M ${startX + 10} ${pipeY} L ${startX + 7 * (genW + gapX) + genW - 10} ${pipeY}" stroke="#0369a1" stroke-width="8" fill="none" stroke-linecap="round" />
      <path d="M ${startX + 10} ${pipeY} L ${startX + 7 * (genW + gapX) + genW - 10} ${pipeY}" class="blueprint-belt-flow" stroke="#00e5ff" stroke-width="3" stroke-dasharray="16 10" fill="none" filter="url(#glowCyan)"/>

      <!-- Cartel Explicativo del Manifold -->
      <rect x="35" y="${pipeY + 16}" width="420" height="24" rx="4" fill="#041a27" stroke="#00e5ff" stroke-width="1.5" />
      <text x="45" y="${pipeY + 32}" fill="#7dd3fc" font-size="10.5" font-weight="800">
        💧 Tubería Colectora Mk.1 (Bucle de 360 m³/min con 3 Inyecciones)
      </text>

      <!-- Cartel de Ingeniería FICSIT para evitar ahogos -->
      <rect x="${totalW - 650}" y="${pipeY + 16}" width="615" height="24" rx="4" fill="#0c2333" stroke="#38bdf8" stroke-width="1.2" />
      <text x="${totalW - 640}" y="${pipeY + 32}" fill="#38bdf8" font-size="9.5" font-weight="700">
        ⭐ Regla FICSIT: Con 3 inyecciones, ningún tramo supera los 120 m³/m (Tubería Mk.1 aguanta hasta 300 m³/m). ¡Cero apagones!
      </text>
    `;

    // =========================================================================
    // 6. NIVEL 5: COSTA / LAGO Y LOS 3 EXTRACTORES DE AGUA BALANCEADOS
    // =========================================================================
    const lakeY = 485;
    svg += `
      <!-- Zona de Agua Abierta (Lago) -->
      <rect x="0" y="${lakeY}" width="${totalW}" height="${totalH - lakeY}" fill="url(#lakeWaterGrad)" />
      <line x1="0" y1="${lakeY}" x2="${totalW}" y2="${lakeY}" stroke="#00e5ff" stroke-width="2.5" stroke-dasharray="10 5" opacity="0.8"/>
      
      <text x="40" y="${lakeY + 24}" fill="#00e5ff" font-size="11.5" font-weight="900" letter-spacing="1">
        🌊 COSTA / LAGO DE AGUA (3 Extractores colocados en agua abierta • 120 m³/min cada uno)
      </text>
    `;

    // Posicionamiento de los 3 Extractores de Agua
    const ext1X = startX + 50;
    const ext2X = startX + 3.5 * (genW + gapX) + genW / 2;
    const ext3X = startX + 7 * (genW + gapX);
    const extY = 550;

    const extractors = [
      { name: 'Extractor #1 (Izquierda)', x: ext1X, targetX: startX + 15, tag: 'INYECCIÓN #1: EXTREMO IZQUIERDO (+120 m³/m)' },
      { name: 'Extractor #2 (Centro)', x: ext2X, targetX: ext2X, tag: 'INYECCIÓN #2: ZONA CENTRAL ENTRE GEN 4 Y 5 (+120 m³/m)' },
      { name: 'Extractor #3 (Derecha)', x: ext3X, targetX: startX + 7 * (genW + gapX) + genW - 15, tag: 'INYECCIÓN #3: EXTREMO DERECHO (+120 m³/m)' }
    ];

    extractors.forEach((ext, idx) => {
      svg += `
        <!-- Tubería de inyección desde el extractor al colector -->
        <path d="M ${ext.x + 36} ${extY} L ${ext.targetX} ${pipeY}" stroke="#00e5ff" stroke-width="5" fill="none" opacity="0.9" />
        <circle cx="${ext.targetX}" cy="${pipeY}" r="8" fill="#00e5ff" stroke="#ffffff" stroke-width="2" filter="url(#glowCyan)"/>

        <!-- Etiqueta de Inyección sobre la tubería -->
        <rect x="${ext.targetX - 75}" y="${pipeY + 44}" width="150" height="20" rx="4" fill="#031824" stroke="#00e5ff" stroke-width="1.5" />
        <text x="${ext.targetX}" y="${pipeY + 58}" fill="#38bdf8" font-size="9" font-weight="800" text-anchor="middle">
          Inyección #${idx + 1} (+120 m³/m)
        </text>

        <!-- Nodo del Extractor de Agua -->
        <g class="power-extractor-node" data-id="ext_${idx}" data-name="${ext.name}" data-flow="120 m³/min" data-mw="20 MW" style="cursor: pointer;">
          <!-- Plataforma flotante -->
          <rect x="${ext.x - 6}" y="${extY - 6}" width="84" height="84" rx="8" fill="#082f49" stroke="#00e5ff" stroke-width="2" />
          
          <!-- Bomba rotatoria -->
          <circle cx="${ext.x + 36}" cy="${extY + 36}" r="28" fill="#0369a1" stroke="#38bdf8" stroke-width="2" />
          <text x="${ext.x + 36}" y="${extY + 44}" fill="#ffffff" font-size="24" text-anchor="middle">💧</text>

          <text x="${ext.x + 36}" y="${extY + 98}" fill="#ffffff" font-size="11" font-weight="900" text-anchor="middle">Extractor #${idx + 1}</text>
          <text x="${ext.x + 36}" y="${extY + 112}" fill="#00e5ff" font-size="10" font-weight="800" text-anchor="middle">+120 m³/min (100%)</text>
          <text x="${ext.x + 36}" y="${extY + 125}" fill="#f87171" font-size="8.5" font-weight="700" text-anchor="middle">Consumo: 20 MW</text>
        </g>
      `;
    });

    svg += `</svg>`;

    return {
      svg,
      model: { totalW, totalH }
    };
  }

  // --- MODO 1B: PLANO DETALLADO DE MONTAJE DEL BLOQUE DE PETRÓLEO (1 REFINERÍA : 2 GENERADORES 500 MW) ---
  function generatePowerOilBlockBlueprintSvg(plant) {
    const totalW = 1520;
    const totalH = 760;

    const extX = 55;
    const extY = 190;
    const refX = 390;
    const refY = 160;
    const crossX = 720;
    const crossY = 220;
    const gen1X = 840;
    const gen1Y = 80;
    const gen2X = 840;
    const gen2Y = 320;
    const sinkX = 750;
    const sinkY = 510;
    const subX = 1200;
    const subY = 140;

    let svg = `<svg viewBox="0 0 ${totalW} ${totalH}" width="${totalW}" height="${totalH}" xmlns="http://www.w3.org/2000/svg" style="background: #040812; font-family: var(--font-main);">
      <defs>
        <pattern id="oilBlockGridPat" width="60" height="60" patternUnits="userSpaceOnUse">
          <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(255,255,255,0.035)" stroke-width="1"/>
          <path d="M 30 0 L 30 60 M 0 30 L 60 30" fill="none" stroke="rgba(255,255,255,0.015)" stroke-width="0.5"/>
        </pattern>

        <linearGradient id="oilExtGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0e3a53"/>
          <stop offset="100%" stop-color="#081420"/>
        </linearGradient>

        <linearGradient id="refineryGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#1e1b4b"/>
          <stop offset="100%" stop-color="#0c1222"/>
        </linearGradient>

        <linearGradient id="fuelGenGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#2a1205"/>
          <stop offset="50%" stop-color="#1c1917"/>
          <stop offset="100%" stop-color="#0c0a09"/>
        </linearGradient>

        <linearGradient id="sinkGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#3b0764"/>
          <stop offset="100%" stop-color="#150524"/>
        </linearGradient>

        <filter id="glowOrangeOil" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="glowPurpleOil" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="glowCyanOil" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="glowGreenOil" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      <!-- Fondo Cuadrícula -->
      <rect width="${totalW}" height="${totalH}" fill="url(#oilBlockGridPat)" />

      <!-- =========================================================================
           1. BARRA SUPERIOR: ENCABEZADO Y LEYENDA TÉCNICA
           ========================================================================= -->
      <rect x="35" y="14" width="${totalW - 70}" height="54" rx="8" fill="#090f19" stroke="rgba(245, 158, 11, 0.35)" stroke-width="1.5"/>
      <text x="50" y="34" fill="#f8fafc" font-size="13" font-weight="900" letter-spacing="0.5">
        📐 ESQUEMA DE MONTAJE PETROQUÍMICO: MÓDULO 500 MW (1 REFINERÍA : 2 GENERADORES DE COMBUSTIBLE 1.0)
      </text>
      <text x="50" y="52" fill="#94a3b8" font-size="10.5">
        Ratio Áureo FICSIT: <tspan fill="#4ade80" font-weight="900">60 Crudo ➔ 40 Fuel + 30 Resina ➔ 2 Generadores (500 MW)</tspan> • Clona este bloque <tspan fill="#f59e0b" font-weight="900">${plant.modularArchitecture ? plant.modularArchitecture.standardModulesCount : 1} veces</tspan> para tus ${plant.powerBalance.grossMW.toLocaleString()} MW.
      </text>

      <!-- Leyenda Rápida Superior -->
      <g transform="translate(${totalW - 680}, 24)">
        <rect x="0" y="0" width="14" height="14" rx="3" fill="#0284c7" stroke="#38bdf8" stroke-width="1.5"/>
        <text x="18" y="11" fill="#7dd3fc" font-size="9.5" font-weight="800">Crudo (60/m)</text>

        <rect x="120" y="0" width="14" height="14" rx="3" fill="#f59e0b" stroke="#fbbf24" stroke-width="1.5"/>
        <text x="138" y="11" fill="#fde68a" font-size="9.5" font-weight="800">Fuel (40/m)</text>

        <rect x="235" y="0" width="14" height="14" rx="3" fill="#9333ea" stroke="#c084fc" stroke-width="1.5"/>
        <text x="253" y="11" fill="#e9d5ff" font-size="9.5" font-weight="800">Resina ➔ Sink</text>

        <rect x="380" y="0" width="14" height="14" rx="3" fill="#16a34a" stroke="#4ade80" stroke-width="1.5"/>
        <text x="398" y="11" fill="#bbf7d0" font-size="9.5" font-weight="800">Red (+500 MW)</text>
      </g>

      <!-- =========================================================================
           2. CABLEADO AÉREO DE ALTA TENSIÓN (VERDE)
           ========================================================================= -->
      <path d="M ${gen1X + 115} 95 L ${subX} 180" stroke="#15803d" stroke-width="6" fill="none" stroke-linecap="round"/>
      <path d="M ${gen1X + 115} 95 L ${subX} 180" stroke="#22c55e" stroke-width="2.5" stroke-dasharray="8 6" fill="none" filter="url(#glowGreenOil)"/>

      <path d="M ${gen2X + 115} 335 L ${subX} 240" stroke="#15803d" stroke-width="6" fill="none" stroke-linecap="round"/>
      <path d="M ${gen2X + 115} 335 L ${subX} 240" stroke="#22c55e" stroke-width="2.5" stroke-dasharray="8 6" fill="none" filter="url(#glowGreenOil)"/>

      <!-- =========================================================================
           3. ZONA 1: EXTRACTOR DE PETRÓLEO CRUDO
           ========================================================================= -->
      <g class="power-extractor-node" data-name="Extractor de Petróleo Crudo" data-flow="60 m³/min" data-mw="40 MW" style="cursor: pointer;">
        <rect x="${extX}" y="${extY}" width="160" height="170" rx="10" fill="url(#oilExtGrad)" stroke="#38bdf8" stroke-width="2.5" />
        
        <!-- Header del Extractor -->
        <rect x="${extX + 8}" y="${extY + 8}" width="144" height="24" rx="4" fill="#082f49" />
        <text x="${extX + 80}" y="${extY + 24}" fill="#38bdf8" font-size="11" font-weight="900" text-anchor="middle">
          🛢️ POZO PETROLÍFERO
        </text>

        <!-- Silueta de Bomba de Petróleo -->
        <circle cx="${extX + 80}" cy="${extY + 75}" r="28" fill="#0c4a6e" stroke="#38bdf8" stroke-width="1.8" />
        <text x="${extX + 80}" y="${extY + 82}" fill="#ffffff" font-size="24" text-anchor="middle">🛢️</text>

        <!-- Métricas del Pozo -->
        <text x="${extX + 80}" y="${extY + 120}" fill="#f8fafc" font-size="11.5" font-weight="900" text-anchor="middle">
          Extractor de Petróleo
        </text>
        <text x="${extX + 80}" y="${extY + 138}" fill="#38bdf8" font-size="12" font-weight="900" text-anchor="middle">
          +60 m³/min (Crudo)
        </text>
        <text x="${extX + 80}" y="${extY + 154}" fill="#f87171" font-size="9" font-weight="700" text-anchor="middle">
          Consumo: 40 MW
        </text>
      </g>

      <!-- =========================================================================
           4. TUBERÍA DE PETRÓLEO CRUDO (EXTRACTOR ➔ REFINERÍA)
           ========================================================================= -->
      <path d="M ${extX + 160} 265 L ${refX} 265" stroke="#082f49" stroke-width="14" fill="none" stroke-linecap="round" />
      <path d="M ${extX + 160} 265 L ${refX} 265" stroke="#0284c7" stroke-width="7" fill="none" />
      <path d="M ${extX + 160} 265 L ${refX} 265" class="blueprint-belt-flow" stroke="#38bdf8" stroke-width="3" stroke-dasharray="14 10" fill="none" />

      <!-- Cartel sobre la tubería de Crudo -->
      <rect x="225" y="235" width="150" height="24" rx="4" fill="#041b2d" stroke="#38bdf8" stroke-width="1.2" />
      <text x="300" y="251" fill="#7dd3fc" font-size="9.5" font-weight="800" text-anchor="middle">
        Tubería: 60 m³/min Crudo
      </text>

      <!-- =========================================================================
           5. ZONA 2: REFINERÍA FICSIT (COMBUSTIBLE + RESINA DE POLÍMERO)
           ========================================================================= -->
      <g class="power-refinery-node" data-name="Refinería de Combustible" data-input="60 m³/min Petróleo Crudo" data-fuel="40 m³/min Fuel" data-resin="30 Resina/min" data-mw="30 MW" style="cursor: pointer;">
        <rect x="${refX}" y="${refY}" width="220" height="230" rx="10" fill="url(#refineryGrad)" stroke="#818cf8" stroke-width="2.5" />

        <!-- Header Refinería -->
        <rect x="${refX + 8}" y="${refY + 8}" width="204" height="26" rx="4" fill="#1e1b4b" />
        <text x="${refX + 110}" y="${refY + 25}" fill="#c084fc" font-size="11.5" font-weight="900" text-anchor="middle">
          ⚗️ REFINERÍA FICSIT
        </text>

        <!-- Chimeneas gemelas de condensación -->
        <rect x="${refX + 35}" y="${refY - 18}" width="24" height="22" rx="3" fill="#312e81" stroke="#818cf8" stroke-width="1.5" />
        <rect x="${refX + 75}" y="${refY - 24}" width="24" height="28" rx="3" fill="#312e81" stroke="#818cf8" stroke-width="1.5" />

        <!-- Columna de Destilación Fraccionada (Gráfica interna) -->
        <rect x="${refX + 25}" y="${refY + 45}" width="75" height="110" rx="6" fill="#0f172a" stroke="#4338ca" stroke-width="1.5" />
        <line x1="${refX + 25}" y1="${refY + 75}" x2="${refX + 100}" y2="${refY + 75}" stroke="#4338ca" stroke-width="1.2" stroke-dasharray="3 3"/>
        <line x1="${refX + 25}" y1="${refY + 105}" x2="${refX + 100}" y2="${refY + 105}" stroke="#4338ca" stroke-width="1.2" stroke-dasharray="3 3"/>
        <line x1="${refX + 25}" y1="${refY + 130}" x2="${refX + 100}" y2="${refY + 130}" stroke="#4338ca" stroke-width="1.2" stroke-dasharray="3 3"/>
        <text x="${refX + 62}" y="${refY + 70}" fill="#f59e0b" font-size="8.5" font-weight="800" text-anchor="middle">Fuel 40/m</text>
        <text x="${refX + 62}" y="${refY + 100}" fill="#c084fc" font-size="8.5" font-weight="800" text-anchor="middle">Resina 30/m</text>
        <text x="${refX + 62}" y="${refY + 145}" fill="#38bdf8" font-size="8.5" font-weight="800" text-anchor="middle">Crudo 60/m</text>

        <!-- Panel de Estado Digital -->
        <rect x="${refX + 115}" y="${refY + 45}" width="95" height="110" rx="6" fill="#050a14" stroke="rgba(255,255,255,0.1)" stroke-width="1" />
        <text x="${refX + 162}" y="${refY + 65}" fill="#4ade80" font-size="9" font-weight="900" text-anchor="middle">● ACTIVA 100%</text>
        <text x="${refX + 162}" y="${refY + 84}" fill="#94a3b8" font-size="8.5" text-anchor="middle">Receta Oficial:</text>
        <text x="${refX + 162}" y="${refY + 98}" fill="#f8fafc" font-size="9.5" font-weight="800" text-anchor="middle">Fuel Estándar</text>
        <text x="${refX + 162}" y="${refY + 120}" fill="#f87171" font-size="9" font-weight="700" text-anchor="middle">Consumo: 30 MW</text>
        <text x="${refX + 162}" y="${refY + 142}" fill="#38bdf8" font-size="8.5" font-weight="800" text-anchor="middle">Ciclo: 6s</text>

        <!-- Puertos de Salida Identificados -->
        <!-- Puerto Superior: Fluidos (Combustible) -->
        <circle cx="${refX + 220}" cy="${refY + 60}" r="9" fill="#f59e0b" stroke="#ffffff" stroke-width="2" filter="url(#glowOrangeOil)"/>
        <text x="${refX + 190}" y="${refY + 42}" fill="#f59e0b" font-size="9" font-weight="900">Salida Fuel ➔</text>

        <!-- Puerto Inferior: Sólidos (Resina) -->
        <rect x="${refX + 212}" y="${refY + 175}" width="14" height="14" rx="3" fill="#9333ea" stroke="#ffffff" stroke-width="2" filter="url(#glowPurpleOil)"/>
        <text x="${refX + 145}" y="${refY + 205}" fill="#c084fc" font-size="9" font-weight="900">Salida Resina ➔</text>
      </g>

      <!-- =========================================================================
           6. TUBERÍA DE FUEL Y DIVISOR EN CRUCETA (50% / 50%)
           ========================================================================= -->
      <!-- Tramo común de Fuel desde Refinería a Cruceta -->
      <path d="M ${refX + 220} ${refY + 60} L ${crossX} ${refY + 60}" stroke="#451a03" stroke-width="12" fill="none" stroke-linecap="round"/>
      <path d="M ${refX + 220} ${refY + 60} L ${crossX} ${refY + 60}" stroke="#f59e0b" stroke-width="6" fill="none"/>
      <path d="M ${refX + 220} ${refY + 60} L ${crossX} ${refY + 60}" class="blueprint-belt-flow" stroke="#fbbf24" stroke-width="2.5" stroke-dasharray="10 8" fill="none"/>

      <!-- Cruceta de Tubería (Pipe Junction Cross) -->
      <g class="power-splitter-node" data-name="Divisor de Combustible (Cruceta)" data-flow="20 m³/min a cada Generador" style="cursor: pointer;">
        <circle cx="${crossX}" cy="${refY + 60}" r="16" fill="#1c1917" stroke="#f59e0b" stroke-width="2.5" filter="url(#glowOrangeOil)"/>
        <circle cx="${crossX}" cy="${refY + 60}" r="7" fill="#f59e0b"/>

        <!-- Tubería hacia Generador #1 (Superior) -->
        <path d="M ${crossX} ${refY + 60} L ${crossX} ${gen1Y + 55} L ${gen1X} ${gen1Y + 55}" stroke="#451a03" stroke-width="10" fill="none" stroke-linejoin="round"/>
        <path d="M ${crossX} ${refY + 60} L ${crossX} ${gen1Y + 55} L ${gen1X} ${gen1Y + 55}" stroke="#f59e0b" stroke-width="5" fill="none" stroke-linejoin="round"/>
        <path d="M ${crossX} ${refY + 60} L ${crossX} ${gen1Y + 55} L ${gen1X} ${gen1Y + 55}" class="blueprint-belt-flow" stroke="#fbbf24" stroke-width="2" stroke-dasharray="8 6" fill="none" stroke-linejoin="round"/>

        <!-- Tubería hacia Generador #2 (Inferior) -->
        <path d="M ${crossX} ${refY + 60} L ${crossX} ${gen2Y + 55} L ${gen2X} ${gen2Y + 55}" stroke="#451a03" stroke-width="10" fill="none" stroke-linejoin="round"/>
        <path d="M ${crossX} ${refY + 60} L ${crossX} ${gen2Y + 55} L ${gen2X} ${gen2Y + 55}" stroke="#f59e0b" stroke-width="5" fill="none" stroke-linejoin="round"/>
        <path d="M ${crossX} ${refY + 60} L ${crossX} ${gen2Y + 55} L ${gen2X} ${gen2Y + 55}" class="blueprint-belt-flow" stroke="#fbbf24" stroke-width="2" stroke-dasharray="8 6" fill="none" stroke-linejoin="round"/>

        <!-- Cartel de la Cruceta -->
        <rect x="${crossX - 70}" y="${refY + 85}" width="140" height="22" rx="4" fill="#1c0b05" stroke="#f59e0b" stroke-width="1.2" />
        <text x="${crossX}" y="${refY + 100}" fill="#fde68a" font-size="9" font-weight="900" text-anchor="middle">
          Cruceta: 20 m³/m a c/u
        </text>
      </g>

      <!-- =========================================================================
           7. GENERADORES DE COMBUSTIBLE 1.0 (250 MW CADA UNO = 500 MW)
           ========================================================================= -->
      <!-- Generador #1 -->
      <g class="power-generator-node" data-id="fuel_gen_1" data-name="Generador de Combustible #1" data-mw="250 MW" data-clock="100%" data-fuel="20 m³/min Fuel" data-water="0 m³/min" style="cursor: pointer;">
        <rect x="${gen1X}" y="${gen1Y}" width="240" height="145" rx="10" fill="url(#fuelGenGrad)" stroke="#f59e0b" stroke-width="2.5" />
        
        <!-- Header Generador 1 -->
        <rect x="${gen1X + 8}" y="${gen1Y + 8}" width="224" height="26" rx="4" fill="#180702" />
        <text x="${gen1X + 16}" y="${gen1Y + 25}" fill="#fbbf24" font-size="11" font-weight="900">
          ⚡ GENERADOR #1 (FUEL 1.0)
        </text>
        <text x="${gen1X + 224}" y="${gen1Y + 25}" fill="#4ade80" font-size="12" font-weight="900" text-anchor="end">
          +250 MW
        </text>

        <!-- Chimeneas y Turbina Térmica -->
        <circle cx="${gen1X + 45}" cy="${gen1Y + 70}" r="22" fill="#0f172a" stroke="#f59e0b" stroke-width="2" />
        <text x="${gen1X + 45}" y="${gen1Y + 76}" fill="#f59e0b" font-size="20" text-anchor="middle">⚙️</text>
        
        <rect x="${gen1X + 80}" y="${gen1Y + 45}" width="145" height="48" rx="5" fill="#050a14" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
        <text x="${gen1X + 90}" y="${gen1Y + 63}" fill="#38bdf8" font-size="9.5" font-weight="800">Insumo: 20 m³/min Fuel</text>
        <text x="${gen1X + 90}" y="${gen1Y + 80}" fill="#94a3b8" font-size="8.5">Agua: No requerida</text>

        <!-- Barra de Estado 100% -->
        <rect x="${gen1X + 12}" y="${gen1Y + 105}" width="216" height="26" rx="4" fill="rgba(74, 222, 128, 0.12)" stroke="#22c55e" stroke-width="1.2" />
        <text x="${gen1X + 120}" y="${gen1Y + 122}" fill="#86efac" font-size="10.5" font-weight="900" text-anchor="middle">
          ● 100% OPERATIVO (250 MW LIMPIOS)
        </text>
      </g>

      <!-- Generador #2 -->
      <g class="power-generator-node" data-id="fuel_gen_2" data-name="Generador de Combustible #2" data-mw="250 MW" data-clock="100%" data-fuel="20 m³/min Fuel" data-water="0 m³/min" style="cursor: pointer;">
        <rect x="${gen2X}" y="${gen2Y}" width="240" height="145" rx="10" fill="url(#fuelGenGrad)" stroke="#f59e0b" stroke-width="2.5" />
        
        <!-- Header Generador 2 -->
        <rect x="${gen2X + 8}" y="${gen2Y + 8}" width="224" height="26" rx="4" fill="#180702" />
        <text x="${gen2X + 16}" y="${gen2Y + 25}" fill="#fbbf24" font-size="11" font-weight="900">
          ⚡ GENERADOR #2 (FUEL 1.0)
        </text>
        <text x="${gen2X + 224}" y="${gen2Y + 25}" fill="#4ade80" font-size="12" font-weight="900" text-anchor="end">
          +250 MW
        </text>

        <!-- Chimeneas y Turbina Térmica -->
        <circle cx="${gen2X + 45}" cy="${gen2Y + 70}" r="22" fill="#0f172a" stroke="#f59e0b" stroke-width="2" />
        <text x="${gen2X + 45}" y="${gen2Y + 76}" fill="#f59e0b" font-size="20" text-anchor="middle">⚙️</text>
        
        <rect x="${gen2X + 80}" y="${gen2Y + 45}" width="145" height="48" rx="5" fill="#050a14" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
        <text x="${gen2X + 90}" y="${gen2Y + 63}" fill="#38bdf8" font-size="9.5" font-weight="800">Insumo: 20 m³/min Fuel</text>
        <text x="${gen2X + 90}" y="${gen2Y + 80}" fill="#94a3b8" font-size="8.5">Agua: No requerida</text>

        <!-- Barra de Estado 100% -->
        <rect x="${gen2X + 12}" y="${gen2Y + 105}" width="216" height="26" rx="4" fill="rgba(74, 222, 128, 0.12)" stroke="#22c55e" stroke-width="1.2" />
        <text x="${gen2X + 120}" y="${gen2Y + 122}" fill="#86efac" font-size="10.5" font-weight="900" text-anchor="middle">
          ● 100% OPERATIVO (250 MW LIMPIOS)
        </text>
      </g>

      <!-- =========================================================================
           8. CINTA DE RESINA DE POLÍMERO Y TRITURADORA FICSIT (AWESOME SINK)
           ========================================================================= -->
      <!-- Cinta Transportadora Violeta bajando al Sink -->
      <path d="M ${refX + 220} ${refY + 182} L 670 ${refY + 182} L 670 ${sinkY + 60} L ${sinkX} ${sinkY + 60}" stroke="#1e102e" stroke-width="14" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M ${refX + 220} ${refY + 182} L 670 ${refY + 182} L 670 ${sinkY + 60} L ${sinkX} ${sinkY + 60}" stroke="#7e22ce" stroke-width="7" fill="none" stroke-linejoin="round"/>
      <path d="M ${refX + 220} ${refY + 182} L 670 ${refY + 182} L 670 ${sinkY + 60} L ${sinkX} ${sinkY + 60}" class="blueprint-belt-flow" stroke="#c084fc" stroke-width="3" stroke-dasharray="12 8" fill="none" stroke-linejoin="round"/>

      <!-- Cartel de la Cinta de Resina -->
      <rect x="580" y="440" width="160" height="22" rx="4" fill="#13031f" stroke="#c084fc" stroke-width="1.2" />
      <text x="660" y="455" fill="#e9d5ff" font-size="9" font-weight="800" text-anchor="middle">
        Cinta: 30 Resina/min
      </text>

      <!-- Trituradora FICSIT (Awesome Sink) -->
      <g class="power-sink-node" data-name="Trituradora FICSIT (Awesome Sink)" data-shred="30 Resina de Polímero/min" data-mw="30 MW" style="cursor: pointer;">
        <rect x="${sinkX}" y="${sinkY}" width="340" height="145" rx="10" fill="url(#sinkGrad)" stroke="#c084fc" stroke-width="2.5" filter="url(#glowPurpleOil)"/>

        <!-- Header Sink -->
        <rect x="${sinkX + 8}" y="${sinkY + 8}" width="324" height="26" rx="4" fill="#2e1065" />
        <text x="${sinkX + 170}" y="${sinkY + 25}" fill="#f0abfc" font-size="11.5" font-weight="900" text-anchor="middle">
          🎟️ TRITURADORA FICSIT (AWESOME SINK)
        </text>

        <!-- Engranajes Trituradores Silueta -->
        <circle cx="${sinkX + 45}" cy="${sinkY + 75}" r="22" fill="#170326" stroke="#c084fc" stroke-width="2" />
        <text x="${sinkX + 45}" y="${sinkY + 81}" fill="#c084fc" font-size="20" text-anchor="middle">⚙️</text>

        <!-- Texto Explicativo Crítico -->
        <text x="${sinkX + 80}" y="${sinkY + 62}" fill="#ffffff" font-size="11" font-weight="900">
          DRENAJE CONTINUO ANTI-ATASCOS
        </text>
        <text x="${sinkX + 80}" y="${sinkY + 78}" fill="#e879f9" font-size="10" font-weight="800">
          Tritura 30 Resina/m • Generando Cupones ++
        </text>
        <text x="${sinkX + 80}" y="${sinkY + 93}" fill="#f87171" font-size="9" font-weight="700">
          Consumo: 30 MW
        </text>

        <!-- Alerta de Seguridad FICSIT -->
        <rect x="${sinkX + 10}" y="${sinkY + 105}" width="320" height="28" rx="4" fill="rgba(192, 132, 252, 0.15)" stroke="#c084fc" stroke-width="1.2" />
        <text x="${sinkX + 170}" y="${sinkY + 123}" fill="#f5d0fe" font-size="9.5" font-weight="800" text-anchor="middle">
          ⭐ ¡GARANTIZA 0 APAGONES! La refinería nunca se llena de subproducto.
        </text>
      </g>

      <!-- =========================================================================
           9. SUBESTACIÓN ELÉCTRICA FICSIT (BALANCE NETO DEL MÓDULO)
           ========================================================================= -->
      <g class="power-substation-node" style="cursor: pointer;">
        <rect x="${subX}" y="${subY}" width="270" height="250" rx="12" fill="#042014" stroke="#22c55e" stroke-width="3" filter="url(#glowGreenOil)"/>

        <!-- Header Subestación -->
        <rect x="${subX + 8}" y="${subY + 8}" width="254" height="28" rx="6" fill="#064e3b" />
        <text x="${subX + 135}" y="${subY + 27}" fill="#4ade80" font-size="12" font-weight="900" text-anchor="middle">
          ⚡ SUBESTACIÓN DE ENTREGA
        </text>

        <!-- Potencia Neta Destacada -->
        <text x="${subX + 135}" y="${subY + 75}" fill="#ffffff" font-size="28" font-weight="900" text-anchor="middle">
          +400 MW
        </text>
        <text x="${subX + 135}" y="${subY + 95}" fill="#86efac" font-size="11" font-weight="800" text-anchor="middle">
          POTENCIA NETA LIMPIA DEL MÓDULO
        </text>

        <!-- Desglose de Energía -->
        <rect x="${subX + 16}" y="${subY + 115}" width="238" height="85" rx="6" fill="#02150d" stroke="rgba(74, 222, 128, 0.25)" stroke-width="1"/>
        <text x="${subX + 26}" y="${subY + 135}" fill="#4ade80" font-size="10" font-weight="800">
          • Generación Bruta: <tspan fill="#ffffff">+500 MW</tspan> (2x 250 MW)
        </text>
        <text x="${subX + 26}" y="${subY + 153}" fill="#f87171" font-size="10" font-weight="800">
          • Autoconsumo: <tspan fill="#ffffff">-100 MW</tspan>
        </text>
        <text x="${subX + 36}" y="${subY + 170}" fill="#94a3b8" font-size="9">
          (Refinería 30 MW + Extractor 40 MW + Sink 30 MW)
        </text>
        <text x="${subX + 26}" y="${subY + 188}" fill="#38bdf8" font-size="9.5" font-weight="800">
          • Eficiencia Neta: 80.0% limpia
        </text>

        <!-- Estado de Red -->
        <rect x="${subX + 16}" y="${subY + 210}" width="238" height="26" rx="4" fill="rgba(74, 222, 128, 0.2)" />
        <text x="${subX + 135}" y="${subY + 227}" fill="#bbf7d0" font-size="9.5" font-weight="900" text-anchor="middle">
          ESTABILIDAD: 100% CONTINUA
        </text>
      </g>

      <!-- =========================================================================
           10. BARRA INFERIOR: PLAN MAESTRO DE ESCALADO TOTAL
           ========================================================================= -->
      <rect x="35" y="680" width="${totalW - 70}" height="56" rx="8" fill="#090f19" stroke="rgba(56, 189, 248, 0.35)" stroke-width="1.5"/>
      <text x="50" y="702" fill="#38bdf8" font-size="11.5" font-weight="900">
        🏭 PLAN DE ESCALADO A ${plant.powerBalance.grossMW.toLocaleString()} MW:
      </text>
      <text x="50" y="722" fill="#cbd5e1" font-size="10.5">
        Para tu objetivo necesitas construir <tspan fill="#f59e0b" font-weight="900">${plant.modularArchitecture ? plant.modularArchitecture.standardModulesCount : 1} bloques idénticos como este</tspan> (Total: <tspan fill="#c084fc" font-weight="900">${plant.totalGeneratorsCount} Generadores</tspan> + <tspan fill="#38bdf8" font-weight="900">${plant.petrochem.refineriesCount} Refinerías</tspan>). Suministro: <tspan fill="#38bdf8" font-weight="900">${plant.petrochem.crudeOilRate.toLocaleString()} m³/min de Petróleo Crudo</tspan> • Subproducto: <tspan fill="#e879f9" font-weight="900">${plant.petrochem.polymerResinRate.toLocaleString()} Resina/min</tspan> al Awesome Sink.
      </text>

    </svg>`;

    return {
      svg,
      model: { totalW, totalH }
    };
  }

  // --- MODO 2 (PETRÓLEO): PLANO PANORÁMICO DE TODA LA CENTRAL DE FUEL ---
  function generatePowerOilOverviewBlueprintSvg(plant) {
    const totalGens = plant.totalGeneratorsCount;
    const standardModules = plant.modularArchitecture ? plant.modularArchitecture.standardModulesCount : Math.floor(totalGens / 2);
    const hasRemainder = plant.modularArchitecture ? plant.modularArchitecture.hasRemainder : (totalGens % 2 > 0);
    const totalBlocks = standardModules + (hasRemainder ? 1 : 0);

    const cols = Math.min(6, Math.max(2, Math.ceil(totalBlocks / 2)));
    const rows = Math.ceil(totalBlocks / cols);

    const blockW = 188;
    const blockH = 135;
    const gapX = 32;
    const gapY = 40;
    const startX = 60;
    const startY = 130;

    const totalW = Math.max(1280, startX + cols * (blockW + gapX) + 260);
    const totalH = Math.max(600, startY + rows * (blockH + gapY) + 90);

    let svg = `<svg viewBox="0 0 ${totalW} ${totalH}" width="${totalW}" height="${totalH}" xmlns="http://www.w3.org/2000/svg" style="background: #040812; font-family: var(--font-main);">
      <defs>
        <pattern id="overviewOilGridPat" width="60" height="60" patternUnits="userSpaceOnUse">
          <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(255,255,255,0.035)" stroke-width="1"/>
        </pattern>
        <linearGradient id="overviewOilBlockGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0a192f"/>
          <stop offset="100%" stop-color="#08101e"/>
        </linearGradient>
      </defs>

      <rect width="${totalW}" height="${totalH}" fill="url(#overviewOilGridPat)" />

      <!-- Encabezado Panorámico con Leyenda -->
      <rect x="40" y="18" width="${totalW - 80}" height="56" rx="8" fill="#090f19" stroke="rgba(56, 189, 248, 0.35)" stroke-width="1.5"/>
      <text x="56" y="42" fill="#38bdf8" font-size="13" font-weight="900">
        🏭 VISTA PANORÁMICA DE LA CENTRAL DE PETRÓLEO: ${totalBlocks} Bloques FICSIT (1:2) • ${plant.totalGeneratorsCount} Generadores • ${plant.petrochem.refineriesCount} Refinerías
      </text>
      <text x="56" y="60" fill="#94a3b8" font-size="10.5">
        Potencia Total de la Central: <tspan fill="#4ade80" font-weight="900">+${plant.powerBalance.grossMW.toLocaleString()} MW Brutos</tspan> (<tspan fill="#86efac" font-weight="800">+${plant.powerBalance.netMW.toLocaleString()} MW Netos</tspan>) • Crudo Requerido: <tspan fill="#38bdf8" font-weight="900">${plant.petrochem.crudeOilRate.toLocaleString()} m³/min</tspan> • Resina Total al Sink: <tspan fill="#c084fc" font-weight="900">${plant.petrochem.polymerResinRate.toLocaleString()}/min</tspan>
      </text>

      <!-- Leyenda de Colores en Vista Panorámica -->
      <g transform="translate(${totalW - 600}, 30)">
        <rect x="0" y="0" width="12" height="12" rx="2" fill="#0284c7"/>
        <text x="16" y="10" fill="#7dd3fc" font-size="9" font-weight="800">Petróleo Crudo</text>

        <rect x="110" y="0" width="12" height="12" rx="2" fill="#f59e0b"/>
        <text x="126" y="10" fill="#fde68a" font-size="9" font-weight="800">Fuel (40/m)</text>

        <rect x="200" y="0" width="12" height="12" rx="2" fill="#9333ea"/>
        <text x="216" y="10" fill="#e9d5ff" font-size="9" font-weight="800">Resina ➔ Sink</text>

        <rect x="315" y="0" width="12" height="12" rx="2" fill="#0284c7"/>
        <text x="331" y="10" fill="#38bdf8" font-size="9" font-weight="800">Módulos (500 MW)</text>

        <rect x="450" y="0" width="12" height="12" rx="2" fill="#22c55e"/>
        <text x="466" y="10" fill="#86efac" font-size="9" font-weight="800">Red Eléctrica</text>
      </g>

      <!-- Línea troncal principal de Petróleo Crudo (Azul Cyan) -->
      <path d="M 30 100 L ${totalW - 270} 100" stroke="#082f49" stroke-width="10" fill="none" stroke-linecap="round" />
      <path d="M 30 100 L ${totalW - 270} 100" class="blueprint-belt-flow" stroke="#38bdf8" stroke-width="3" stroke-dasharray="14 10" fill="none" />
      <rect x="30" y="82" width="700" height="24" rx="4" fill="#041b2d" stroke="#38bdf8" stroke-width="1.2" />
      <text x="40" y="98" fill="#7dd3fc" font-size="9.5" font-weight="900">
        🛢️ COLECTOR PRINCIPAL DE CRUDO: Distribuye 60 m³/min a cada refinería de bloque (Tuberías Mk.1 de 300 o Mk.2 de 600 m³/min).
      </text>
    `;

    // Renderizar cada bloque modular de 500 MW
    for (let b = 0; b < totalBlocks; b++) {
      const col = b % cols;
      const row = Math.floor(b / cols);
      const bx = startX + col * (blockW + gapX);
      const by = startY + row * (blockH + gapY);

      const isRem = b === totalBlocks - 1 && hasRemainder;
      const bGens = isRem ? plant.modularArchitecture.remainderGenerators : 2;
      const bMW = isRem ? plant.modularArchitecture.remainderMW : 500;
      const bCrude = isRem ? Math.round(bGens * 30) : 60;
      const bFuel = isRem ? Math.round(bGens * 20) : 40;
      const bResin = isRem ? Math.round(bGens * 15) : 30;

      svg += `
        <!-- Bajada de Crudo desde colector principal al bloque -->
        <path d="M ${bx + blockW / 2} 100 L ${bx + blockW / 2} ${by}" stroke="#38bdf8" stroke-width="2.5" stroke-dasharray="4 2" fill="none" />
        
        <!-- Bloque Modular de Petróleo #${b + 1} -->
        <g class="power-generator-node" data-id="oil_block_${b}" data-name="Módulo Fuel #${b + 1} (${bMW} MW)" data-mw="${bMW} MW" data-clock="100%" data-fuel="${bFuel} m³/min Fuel" data-water="0 m³/min" style="cursor: pointer;">
          <rect x="${bx}" y="${by}" width="${blockW}" height="${blockH}" rx="8" fill="url(#overviewOilBlockGrad)" stroke="${isRem ? '#f59e0b' : '#38bdf8'}" stroke-width="2" />
          
          <rect x="${bx + 8}" y="${by + 8}" width="${blockW - 16}" height="22" rx="4" fill="#082f49" />
          <text x="${bx + 14}" y="${by + 23}" fill="${isRem ? '#fbbf24' : '#7dd3fc'}" font-size="10.5" font-weight="900">
            ${isRem ? `Módulo #${b + 1} (Ajuste)` : `Módulo #${b + 1} (1:2)`}
          </text>
          <text x="${bx + blockW - 14}" y="${by + 23}" fill="#4ade80" font-size="11" font-weight="900" text-anchor="end">
            +${bMW} MW
          </text>

          <text x="${bx + 14}" y="${by + 48}" fill="#f1f5f9" font-size="9.5" font-weight="700">⚗️ 1 Refinería (${bCrude} Crudo ➔ ${bFuel} Fuel)</text>
          <text x="${bx + 14}" y="${by + 65}" fill="#f59e0b" font-size="9.5" font-weight="700">⚡ ${bGens}x Generadores (250 MW c/u)</text>
          <text x="${bx + 14}" y="${by + 82}" fill="#c084fc" font-size="9.5" font-weight="700">🎟️ Sink: ${bResin} Resina/min</text>
          <text x="${bx + 14}" y="${by + 98}" fill="#94a3b8" font-size="8.5">💧 Agua requerida: 0 m³/min</text>
          
          <rect x="${bx + 8}" y="${by + blockH - 24}" width="${blockW - 16}" height="17" rx="3" fill="rgba(74, 222, 128, 0.12)" stroke="rgba(74, 222, 128, 0.25)" stroke-width="0.8"/>
          <text x="${bx + blockW / 2}" y="${by + blockH - 12}" fill="#86efac" font-size="9" font-weight="800" text-anchor="middle">
            ● Net: +${bMW - (bGens * 50)} MW Limpios
          </text>
        </g>

        <!-- Cable de salida a la subestación central (Verde) -->
        <path d="M ${bx + blockW} ${by + blockH / 2} Q ${totalW - 220} ${by + blockH / 2} ${totalW - 200} 250" stroke="#22c55e" stroke-width="1.8" stroke-dasharray="4 3" fill="none" opacity="0.6"/>
      `;
    }

    // Subestación Central de Petróleo (Verde Esmeralda)
    const subX = totalW - 210;
    const subY = 180;
    svg += `
      <g class="power-substation-node" style="cursor: pointer;">
        <rect x="${subX}" y="${subY}" width="180" height="155" rx="10" fill="#042014" stroke="#22c55e" stroke-width="3" />
        <circle cx="${subX + 90}" cy="${subY + 30}" r="15" fill="#22c55e" />
        <text x="${subX + 90}" y="${subY + 36}" fill="#022c22" font-size="16" font-weight="900" text-anchor="middle">⚡</text>
        <text x="${subX + 90}" y="${subY + 68}" fill="#ffffff" font-size="17" font-weight="900" text-anchor="middle">
          +${plant.powerBalance.netMW.toLocaleString()} MW
        </text>
        <text x="${subX + 90}" y="${subY + 86}" fill="#86efac" font-size="10.5" font-weight="800" text-anchor="middle">
          POTENCIA NETA TOTAL
        </text>
        <text x="${subX + 90}" y="${subY + 104}" fill="#94a3b8" font-size="9" text-anchor="middle">
          ${plant.totalGeneratorsCount} Generadores • ${plant.petrochem.refineriesCount} Refinerías
        </text>
        <rect x="${subX + 10}" y="${subY + 116}" width="160" height="26" rx="4" fill="rgba(74, 222, 128, 0.15)"/>
        <text x="${subX + 90}" y="${subY + 133}" fill="#4ade80" font-size="8.5" font-weight="800" text-anchor="middle">
          Eficiencia: ${plant.powerBalance.netEfficiency}%
        </text>
      </g>
    `;

    svg += `</svg>`;

    return {
      svg,
      model: { totalW, totalH }
    };
  }

  // --- MODO 2: PLANO PANORÁMICO DE TODA LA CENTRAL ELÉCTRICA ---
  function generatePowerOverviewBlueprintSvg(plant) {
    const totalGens = plant.totalGeneratorsCount;
    const standardModules = plant.modularArchitecture ? plant.modularArchitecture.standardModulesCount : Math.floor(totalGens / 8);
    const hasRemainder = plant.modularArchitecture ? plant.modularArchitecture.hasRemainder : (totalGens % 8 > 0);
    const totalBlocks = standardModules + (hasRemainder ? 1 : 0);

    const cols = Math.min(6, Math.max(2, Math.ceil(totalBlocks / 2)));
    const rows = Math.ceil(totalBlocks / cols);

    const blockW = 168;
    const blockH = 118;
    const gapX = 32;
    const gapY = 38;
    const startX = 60;
    const startY = 130;

    const totalW = Math.max(1240, startX + cols * (blockW + gapX) + 240);
    const totalH = Math.max(580, startY + rows * (blockH + gapY) + 90);

    let svg = `<svg viewBox="0 0 ${totalW} ${totalH}" width="${totalW}" height="${totalH}" xmlns="http://www.w3.org/2000/svg" style="background: #040812; font-family: var(--font-main);">
      <defs>
        <pattern id="overviewGridPat" width="60" height="60" patternUnits="userSpaceOnUse">
          <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(255,255,255,0.035)" stroke-width="1"/>
        </pattern>
        <linearGradient id="overviewBlockGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#1e1b4b"/>
          <stop offset="100%" stop-color="#0f172a"/>
        </linearGradient>
      </defs>

      <rect width="${totalW}" height="${totalH}" fill="url(#overviewGridPat)" />

      <!-- Encabezado Panorámico con Leyenda -->
      <rect x="40" y="18" width="${totalW - 80}" height="56" rx="8" fill="#090f19" stroke="rgba(56, 189, 248, 0.35)" stroke-width="1.5"/>
      <text x="56" y="42" fill="#38bdf8" font-size="13" font-weight="900">
        🏭 VISTA PANORÁMICA DE TODA LA CENTRAL: ${totalBlocks} Bloques • ${plant.totalGeneratorsCount} Generadores Totales
      </text>
      <text x="56" y="60" fill="#94a3b8" font-size="10.5">
        Potencia Total de la Central: <tspan fill="#4ade80" font-weight="900">+${plant.powerBalance.grossMW.toLocaleString()} MW</tspan> • Suministro requerido: <tspan fill="#ea580c" font-weight="900">${plant.fuel.totalRate} ${plant.fuel.name}/min</tspan>
      </text>

      <!-- Leyenda de Colores en Vista Panorámica -->
      <g transform="translate(${totalW - 540}, 30)">
        <rect x="0" y="0" width="12" height="12" rx="2" fill="#ea580c"/>
        <text x="16" y="10" fill="#fed7aa" font-size="9" font-weight="800">Carbón</text>

        <rect x="90" y="0" width="12" height="12" rx="2" fill="#0284c7"/>
        <text x="106" y="10" fill="#7dd3fc" font-size="9" font-weight="800">Agua</text>

        <rect x="170" y="0" width="12" height="12" rx="2" fill="#8b5cf6"/>
        <text x="186" y="10" fill="#d8b4fe" font-size="9" font-weight="800">Bloques (600 MW)</text>

        <rect x="310" y="0" width="12" height="12" rx="2" fill="#22c55e"/>
        <text x="326" y="10" fill="#86efac" font-size="9" font-weight="800">Red Eléctrica</text>
      </g>

      <!-- Línea troncal principal de carbón (Naranja) con Regla de los 240/min -->
      <path d="M 30 100 L ${totalW - 250} 100" stroke="#1e293b" stroke-width="8" fill="none" stroke-linecap="round" />
      <path d="M 30 100 L ${totalW - 250} 100" class="blueprint-belt-flow" stroke="#ea580c" stroke-width="3" stroke-dasharray="12 8" fill="none" />
      <rect x="30" y="82" width="640" height="24" rx="4" fill="#180702" stroke="#ea580c" stroke-width="1.2" />
      <text x="40" y="98" fill="#fed7aa" font-size="9.5" font-weight="900">
        ⛏️ REGLA FICSIT 240/min: Agrupa taladros en cintas Mk.3 de 240/min y divide con Splitter 50%/50% a pares de bloques de 120/min.
      </text>
    `;

    // Renderizar cada bloque modular
    for (let b = 0; b < totalBlocks; b++) {
      const col = b % cols;
      const row = Math.floor(b / cols);
      const bx = startX + col * (blockW + gapX);
      const by = startY + row * (blockH + gapY);

      const isRem = b === totalBlocks - 1 && hasRemainder;
      const bGens = isRem ? plant.modularArchitecture.remainderGenerators : 8;
      const bMW = isRem ? plant.modularArchitecture.remainderMW : 600;
      const bWater = isRem ? (bGens * 45).toFixed(0) : 360;

      svg += `
        <!-- Bajada de carbón al bloque -->
        <path d="M ${bx + blockW / 2} 100 L ${bx + blockW / 2} ${by}" stroke="#ea580c" stroke-width="2.5" stroke-dasharray="4 2" fill="none" />
        
        <!-- Bloque Modular #${b + 1} -->
        <g class="power-generator-node" data-id="block_${b}" data-name="Bloque #${b + 1} (${bMW} MW)" data-mw="${bMW} MW" data-clock="100%" data-fuel="${bGens * 15}/min" data-water="${bWater} m³/min" style="cursor: pointer;">
          <rect x="${bx}" y="${by}" width="${blockW}" height="${blockH}" rx="8" fill="url(#overviewBlockGrad)" stroke="${isRem ? '#f59e0b' : '#8b5cf6'}" stroke-width="2.5" />
          
          <rect x="${bx + 8}" y="${by + 8}" width="${blockW - 16}" height="22" rx="4" fill="#090f1a" />
          <text x="${bx + 14}" y="${by + 23}" fill="${isRem ? '#fbbf24' : '#c084fc'}" font-size="10.5" font-weight="900">
            ${isRem ? `Bloque #${b + 1} (Ajuste)` : `Bloque #${b + 1} (8:3)`}
          </text>
          <text x="${bx + blockW - 14}" y="${by + 23}" fill="#4ade80" font-size="11" font-weight="900" text-anchor="end">
            +${bMW} MW
          </text>

          <text x="${bx + 14}" y="${by + 50}" fill="#f1f5f9" font-size="10" font-weight="700">🏭 ${bGens} Generadores</text>
          <text x="${bx + 14}" y="${by + 67}" fill="#ea580c" font-size="10" font-weight="700">🪨 ${bGens * 15} Carbón/min</text>
          <text x="${bx + 14}" y="${by + 84}" fill="#00e5ff" font-size="10" font-weight="700">💧 ${bWater} m³ Agua/min</text>
          
          <rect x="${bx + 8}" y="${by + blockH - 24}" width="${blockW - 16}" height="16" rx="3" fill="rgba(74, 222, 128, 0.12)" />
          <text x="${bx + blockW / 2}" y="${by + blockH - 12}" fill="#86efac" font-size="9" font-weight="800" text-anchor="middle">
            ${isRem ? '1 Extractor de Agua' : '3 Extractores de Agua'}
          </text>
        </g>

        <!-- Cable de salida a la subestación central (Verde) -->
        <path d="M ${bx + blockW} ${by + blockH / 2} Q ${totalW - 200} ${by + blockH / 2} ${totalW - 180} 240" stroke="#22c55e" stroke-width="1.8" stroke-dasharray="4 3" fill="none" opacity="0.6"/>
      `;
    }

    // Subestación Central de Salida General (Verde Esmeralda)
    const subX = totalW - 195;
    const subY = 180;
    svg += `
      <g class="power-substation-node" style="cursor: pointer;">
        <rect x="${subX}" y="${subY}" width="165" height="120" rx="10" fill="#052e16" stroke="#22c55e" stroke-width="3" />
        <circle cx="${subX + 82}" cy="${subY + 30}" r="15" fill="#22c55e" />
        <text x="${subX + 82}" y="${subY + 36}" fill="#022c22" font-size="16" font-weight="900" text-anchor="middle">⚡</text>
        <text x="${subX + 82}" y="${subY + 68}" fill="#ffffff" font-size="17" font-weight="900" text-anchor="middle">
          +${plant.powerBalance.netMW.toLocaleString()} MW
        </text>
        <text x="${subX + 82}" y="${subY + 88}" fill="#86efac" font-size="11" font-weight="800" text-anchor="middle">
          POTENCIA NETA TOTAL
        </text>
        <text x="${subX + 82}" y="${subY + 107}" fill="#94a3b8" font-size="9.5" text-anchor="middle">
          ${plant.totalGeneratorsCount} Generadores Conectados
        </text>
      </g>
    `;

    svg += `</svg>`;

    return {
      svg,
      model: { totalW, totalH }
    };
  }

  function applyPowerBlueprintTransform(canvasEl, stateObj) {
    if (!canvasEl) return;
    canvasEl.style.transform = `translate(${stateObj.panX}px, ${stateObj.panY}px) scale(${stateObj.scale})`;
  }

  function fitPowerBlueprintToViewport() {
    const viewport = document.getElementById('powerBlueprintViewport');
    const canvas = document.getElementById('powerBlueprintCanvas');
    if (!viewport || !canvas || !powerBpState.currentModel) return;

    const vW = viewport.clientWidth || 900;
    const vH = viewport.clientHeight || 540;
    const mW = powerBpState.currentModel.totalW;
    const mH = powerBpState.currentModel.totalH;

    const pad = 24;
    const scale = Math.min((vW - pad * 2) / mW, (vH - pad * 2) / mH);
    powerBpState.scale = Math.max(0.35, Math.min(1.2, Number(scale.toFixed(3))));
    powerBpState.panX = Math.round((vW - mW * powerBpState.scale) / 2);
    powerBpState.panY = Math.round((vH - mH * powerBpState.scale) / 2);

    applyPowerBlueprintTransform(canvas, powerBpState);
  }

  function initPowerBlueprintInteractions() {
    const viewport = document.getElementById('powerBlueprintViewport');
    const canvas = document.getElementById('powerBlueprintCanvas');
    if (!viewport || !canvas || powerBpState.isInitialized) return;
    powerBpState.isInitialized = true;

    // Arrastre y Paneo
    viewport.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      powerBpState.isDragging = true;
      powerBpState.startX = e.clientX - powerBpState.panX;
      powerBpState.startY = e.clientY - powerBpState.panY;
      viewport.style.cursor = 'grabbing';
      canvas.classList.add('is-navigating');
    });

    window.addEventListener('mousemove', (e) => {
      if (!powerBpState.isDragging) return;
      powerBpState.panX = e.clientX - powerBpState.startX;
      powerBpState.panY = e.clientY - powerBpState.startY;
      applyPowerBlueprintTransform(canvas, powerBpState);
    });

    window.addEventListener('mouseup', () => {
      if (powerBpState.isDragging) {
        powerBpState.isDragging = false;
        viewport.style.cursor = 'grab';
        canvas.classList.remove('is-navigating');
      }
    });

    // Zoom con rueda centrado en el cursor (estable sin desenfoques)
    let zoomTimer = null;
    viewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      powerBpState.isZooming = true;
      canvas.classList.add('is-navigating');

      const rect = viewport.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      const newScale = Math.max(0.2, Math.min(2.8, powerBpState.scale * zoomFactor));

      powerBpState.panX = mouseX - (mouseX - powerBpState.panX) * (newScale / powerBpState.scale);
      powerBpState.panY = mouseY - (mouseY - powerBpState.panY) * (newScale / powerBpState.scale);
      powerBpState.scale = newScale;

      applyPowerBlueprintTransform(canvas, powerBpState);

      clearTimeout(zoomTimer);
      zoomTimer = setTimeout(() => {
        powerBpState.isZooming = false;
        canvas.classList.remove('is-navigating');
      }, 160);
    }, { passive: false });

    // Botones de Toolbar
    const btnIn = document.getElementById('btnPowerBpZoomIn');
    const btnOut = document.getElementById('btnPowerBpZoomOut');
    const btnReset = document.getElementById('btnPowerBpReset');
    const btnToggleFocus = document.getElementById('btnPowerBpToggleFocus');
    const btnFs = document.getElementById('btnPowerBpFullscreen');

    if (btnIn) btnIn.addEventListener('click', () => {
      powerBpState.scale = Math.min(2.8, powerBpState.scale * 1.25);
      applyPowerBlueprintTransform(canvas, powerBpState);
    });

    if (btnOut) btnOut.addEventListener('click', () => {
      powerBpState.scale = Math.max(0.2, powerBpState.scale * 0.8);
      applyPowerBlueprintTransform(canvas, powerBpState);
    });

    if (btnReset) btnReset.addEventListener('click', () => {
      fitPowerBlueprintToViewport();
    });

    if (btnToggleFocus) {
      btnToggleFocus.addEventListener('click', () => {
        powerBpState.focusModeEnabled = !powerBpState.focusModeEnabled;
        if (!powerBpState.focusModeEnabled) {
          canvas.classList.add('inspection-disabled');
          btnToggleFocus.innerHTML = '🎯 Foco: Desactivado';
          btnToggleFocus.style.opacity = '0.7';
        } else {
          canvas.classList.remove('inspection-disabled');
          btnToggleFocus.innerHTML = '🎯 Foco: Suave';
          btnToggleFocus.style.opacity = '1';
        }
      });
    }

    if (btnFs) btnFs.addEventListener('click', () => {
      const card = document.getElementById('powerBlueprintCard');
      if (!card) return;
      const isFs = card.classList.toggle('is-fullscreen');
      btnFs.innerHTML = isFs ? '✕ Salir' : '⛶ Pantalla Completa';
      setTimeout(() => fitPowerBlueprintToViewport(), 150);
    });
  }

  function attachPowerBlueprintHoverTooltips() {
    const viewport = document.getElementById('powerBlueprintViewport');
    const tooltip = document.getElementById('powerBlueprintTooltip');
    const canvas = document.getElementById('powerBlueprintCanvas');
    if (!viewport || !tooltip || !canvas) return;

    canvas.querySelectorAll('.power-generator-node').forEach(node => {
      node.addEventListener('mouseenter', () => {
        if (powerBpState.isZooming || powerBpState.isDragging || !powerBpState.focusModeEnabled) return;
        const name = node.getAttribute('data-name');
        const mw = node.getAttribute('data-mw');
        const clock = node.getAttribute('data-clock');
        const fuel = node.getAttribute('data-fuel');
        const water = node.getAttribute('data-water');

        tooltip.innerHTML = `
          <div style="font-weight: 800; color: #fbbf24; font-size: 0.88rem; margin-bottom: 4px;">⚡ ${name}</div>
          <div><strong>Producción:</strong> <span style="color: #4ade80; font-weight: 800;">${mw}</span></div>
          <div><strong>Ajuste de Reloj:</strong> ${clock}</div>
          <div style="margin-top: 4px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 4px;">
            <div>🪨 Combustible: <strong>${fuel}</strong></div>
            ${water !== '0 m³/min' ? `<div>💧 Agua: <strong>${water}</strong></div>` : ''}
          </div>
        `;
        tooltip.style.display = 'block';
      });

      node.addEventListener('mousemove', (e) => {
        const rect = viewport.getBoundingClientRect();
        tooltip.style.left = `${e.clientX - rect.left + 15}px`;
        tooltip.style.top = `${e.clientY - rect.top + 15}px`;
      });

      node.addEventListener('mouseleave', () => {
        tooltip.style.display = 'none';
      });
    });

    canvas.querySelectorAll('.power-extractor-node').forEach(node => {
      node.addEventListener('mouseenter', () => {
        if (powerBpState.isZooming || powerBpState.isDragging || !powerBpState.focusModeEnabled) return;
        const name = node.getAttribute('data-name') || 'Extractor';
        const flow = node.getAttribute('data-flow') || '';
        const mw = node.getAttribute('data-mw') || '40 MW';
        const isOil = name.toLowerCase().includes('petróleo') || name.toLowerCase().includes('crudo');
        const icon = isOil ? '🛢️' : '💧';
        const fluidTitle = isOil ? 'Suministro de Petróleo Crudo:' : 'Suministro de Agua:';
        const connDesc = isOil ? 'Conectado a la red de tuberías hacia las Refinerías FICSIT' : 'Conectado al manifold colector de agua';

        tooltip.innerHTML = `
          <div style="font-weight: 800; color: #38bdf8; font-size: 0.88rem; margin-bottom: 4px;">${icon} ${name}</div>
          <div><strong>${fluidTitle}</strong> <span style="color: #38bdf8; font-weight: 800;">+${flow}</span></div>
          <div><strong>Consumo Eléctrico:</strong> <span style="color: #f87171;">-${mw}</span></div>
          <div style="font-size: 0.72rem; color: #94a3b8; margin-top: 4px;">${connDesc}</div>
        `;
        tooltip.style.display = 'block';
      });

      node.addEventListener('mousemove', (e) => {
        const rect = viewport.getBoundingClientRect();
        tooltip.style.left = `${e.clientX - rect.left + 15}px`;
        tooltip.style.top = `${e.clientY - rect.top + 15}px`;
      });

      node.addEventListener('mouseleave', () => {
        tooltip.style.display = 'none';
      });
    });

    canvas.querySelectorAll('.power-refinery-node').forEach(node => {
      node.addEventListener('mouseenter', () => {
        if (powerBpState.isZooming || powerBpState.isDragging || !powerBpState.focusModeEnabled) return;
        const name = node.getAttribute('data-name') || 'Refinería FICSIT';
        const input = node.getAttribute('data-input') || '60 m³/min Petróleo Crudo';
        const fuel = node.getAttribute('data-fuel') || '40 m³/min Fuel';
        const resin = node.getAttribute('data-resin') || '30 Resina/min';
        const mw = node.getAttribute('data-mw') || '30 MW';

        tooltip.innerHTML = `
          <div style="font-weight: 800; color: #c084fc; font-size: 0.88rem; margin-bottom: 4px;">⚗️ ${name}</div>
          <div style="color: #cbd5e1; font-size: 0.76rem; margin-bottom: 4px;">Convierte Crudo en Combustible + Resina de Polímero</div>
          <div><strong>Insumo:</strong> <span style="color: #38bdf8; font-weight: 800;">${input}</span></div>
          <div><strong>Producción:</strong> <span style="color: #f59e0b; font-weight: 800;">${fuel}</span></div>
          <div><strong>Subproducto:</strong> <span style="color: #e879f9; font-weight: 800;">${resin}</span></div>
          <div><strong>Consumo Eléctrico:</strong> <span style="color: #f87171;">-${mw}</span></div>
          <div style="font-size: 0.72rem; color: #4ade80; margin-top: 4px;">Relación áurea FICSIT 1:2 (Alimenta 2 Generadores de 250 MW)</div>
        `;
        tooltip.style.display = 'block';
      });

      node.addEventListener('mousemove', (e) => {
        const rect = viewport.getBoundingClientRect();
        tooltip.style.left = `${e.clientX - rect.left + 15}px`;
        tooltip.style.top = `${e.clientY - rect.top + 15}px`;
      });

      node.addEventListener('mouseleave', () => {
        tooltip.style.display = 'none';
      });
    });

    canvas.querySelectorAll('.power-sink-node').forEach(node => {
      node.addEventListener('mouseenter', () => {
        if (powerBpState.isZooming || powerBpState.isDragging || !powerBpState.focusModeEnabled) return;
        const name = node.getAttribute('data-name') || 'Trituradora FICSIT (Awesome Sink)';
        const shred = node.getAttribute('data-shred') || '30 Resina de Polímero/min';
        const mw = node.getAttribute('data-mw') || '30 MW';

        tooltip.innerHTML = `
          <div style="font-weight: 800; color: #f0abfc; font-size: 0.88rem; margin-bottom: 4px;">🎟️ ${name}</div>
          <div style="color: #e9d5ff; font-size: 0.76rem; margin-bottom: 4px;">Drenaje de subproductos para evitar paradas de fábrica</div>
          <div><strong>Destruye:</strong> <span style="color: #c084fc; font-weight: 800;">${shred}</span></div>
          <div><strong>Consumo Eléctrico:</strong> <span style="color: #f87171;">-${mw}</span></div>
          <div><strong>Recompensa:</strong> <span style="color: #fbbf24; font-weight: 800;">Cupones FICSIT ++</span></div>
          <div style="font-size: 0.72rem; color: #4ade80; margin-top: 4px;">⭐ SALVAGUARDA VITAL: Garantiza que el combustible nunca deje de fluir.</div>
        `;
        tooltip.style.display = 'block';
      });

      node.addEventListener('mousemove', (e) => {
        const rect = viewport.getBoundingClientRect();
        tooltip.style.left = `${e.clientX - rect.left + 15}px`;
        tooltip.style.top = `${e.clientY - rect.top + 15}px`;
      });

      node.addEventListener('mouseleave', () => {
        tooltip.style.display = 'none';
      });
    });

    canvas.querySelectorAll('.power-splitter-node').forEach(node => {
      node.addEventListener('mouseenter', () => {
        if (powerBpState.isZooming || powerBpState.isDragging || !powerBpState.focusModeEnabled) return;
        const name = node.getAttribute('data-name');
        const flow = node.getAttribute('data-flow');

        tooltip.innerHTML = `
          <div style="font-weight: 800; color: #ea580c; font-size: 0.88rem; margin-bottom: 4px;">🔀 ${name}</div>
          <div style="color: #ffedd5; font-size: 0.76rem; margin-bottom: 4px;">Divisor / Cruceta de tubería o cinta</div>
          <div><strong>Derivación:</strong> <span style="color: #fed7aa; font-weight: 800;">${flow}</span></div>
          <div style="font-size: 0.72rem; color: #94a3b8; margin-top: 4px;">Distribución equilibrada continua hacia los generadores.</div>
        `;
        tooltip.style.display = 'block';
      });

      node.addEventListener('mousemove', (e) => {
        const rect = viewport.getBoundingClientRect();
        tooltip.style.left = `${e.clientX - rect.left + 15}px`;
        tooltip.style.top = `${e.clientY - rect.top + 15}px`;
      });

      node.addEventListener('mouseleave', () => {
        tooltip.style.display = 'none';
      });
    });

    canvas.querySelectorAll('.power-substation-node').forEach(node => {
      node.addEventListener('mouseenter', () => {
        if (powerBpState.isZooming || powerBpState.isDragging || !powerBpState.focusModeEnabled) return;

        tooltip.innerHTML = `
          <div style="font-weight: 800; color: #22c55e; font-size: 0.88rem; margin-bottom: 4px;">⚡ Subestación Eléctrica</div>
          <div style="color: #86efac; font-size: 0.76rem; margin-bottom: 4px;">Punto central de interconexión a la Red FICSIT</div>
          <div><strong>Entrega a la Red:</strong> <span style="color: #4ade80; font-weight: 800;">Potencia en Alta Tensión</span></div>
          <div style="font-size: 0.72rem; color: #94a3b8; margin-top: 4px;">Conecta los cables de tus postes y fábricas aquí.</div>
        `;
        tooltip.style.display = 'block';
      });

      node.addEventListener('mousemove', (e) => {
        const rect = viewport.getBoundingClientRect();
        tooltip.style.left = `${e.clientX - rect.left + 15}px`;
        tooltip.style.top = `${e.clientY - rect.top + 15}px`;
      });

      node.addEventListener('mouseleave', () => {
        tooltip.style.display = 'none';
      });
    });
  }

  // =========================================================================
  // 2. TAB 1: NODES & MINERS
  // =========================================================================
  function initMinersTab() {
    const resSelect = document.getElementById('minerResourceSelect');
    const tierSelect = document.getElementById('minerTierSelect');
    const clockRange = document.getElementById('minerClockRange');
    const clockVal = document.getElementById('minerClockValue');
    const shardsVal = document.getElementById('minerShardsValue');
    const purityBtns = document.querySelectorAll('.purity-btn');
    const btnSendToSplitter = document.getElementById('btnSendToSplitter');

    // Populate Resources
    resSelect.innerHTML = Object.values(SATIS_DATA.rawResources).map(r => `
      <option value="${r.id}">${r.name} (${r.category})</option>
    `).join('');
    resSelect.value = state.miner.resource;

    // Event Listeners
    resSelect.addEventListener('change', (e) => {
      state.miner.resource = e.target.value;
      const res = SATIS_DATA.rawResources[state.miner.resource];
      if (res && res.isFluid) {
        tierSelect.value = state.miner.resource === 'crude_oil' ? 'oil_extractor' : 'water_extractor';
      } else if (tierSelect.value === 'oil_extractor' || tierSelect.value === 'water_extractor') {
        tierSelect.value = 'miner_mk2';
      }
      state.miner.minerTier = tierSelect.value;
      updateMinerCalc();
    });

    purityBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        purityBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.miner.purity = btn.getAttribute('data-purity');
        updateMinerCalc();
      });
    });

    tierSelect.addEventListener('change', (e) => {
      state.miner.minerTier = e.target.value;
      updateMinerCalc();
    });

    clockRange.addEventListener('input', (e) => {
      state.miner.clockPercent = Number(e.target.value);
      clockVal.textContent = `${state.miner.clockPercent}%`;
      updateMinerCalc();
    });

    document.querySelectorAll('[data-set-clock]').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = Number(btn.getAttribute('data-set-clock'));
        clockRange.value = val;
        state.miner.clockPercent = val;
        clockVal.textContent = `${val}%`;
        updateMinerCalc();
      });
    });

    btnSendToSplitter.addEventListener('click', () => {
      const calc = SatisCalc.calculateExtraction(state.miner.purity, state.miner.minerTier, state.miner.clockPercent);
      const inputField = document.getElementById('splitInputRate');
      inputField.value = calc.rate;
      state.splitter.inputRate = calc.rate;
      updateSplitterCalc();
      setActiveTab('tab-splitters');
    });

    updateMinerCalc();
  }

  function updateMinerCalc() {
    const calc = SatisCalc.calculateExtraction(state.miner.purity, state.miner.minerTier, state.miner.clockPercent);
    const outputRate = document.getElementById('minerOutputRate');
    const unitLabel = document.getElementById('minerUnitLabel');
    const powerVal = document.getElementById('minerPowerVal');
    const shardsVal = document.getElementById('minerShardsValue');
    const beltBadge = document.getElementById('minerBeltBadge');
    const warningBox = document.getElementById('minerWarningBox');
    const equivalences = document.getElementById('minerEquivalences');

    outputRate.textContent = calc.rate;
    unitLabel.textContent = calc.isFluid ? 'm³/min' : 'items/min';
    powerVal.textContent = calc.powerMw;
    shardsVal.textContent = `🔋 ${calc.powerShards} Fragmentos`;

    // Belt / Pipe Badge
    if (calc.recommendedBelt) {
      beltBadge.innerHTML = `
        <span class="belt-badge" style="color: ${calc.recommendedBelt.color}; border-color: ${calc.recommendedBelt.color}; background: rgba(0,0,0,0.3);">
          📦 ${calc.recommendedBelt.name} (${calc.recommendedBelt.speed || calc.recommendedBelt.flow} ${calc.isFluid ? 'm³/m' : 'items/m'})
        </span>
      `;
    }

    // Overflow check (> 1200 belt or > 600 pipe)
    warningBox.style.display = calc.beltOverflow ? 'block' : 'none';

    // Equivalences
    const resourceName = (SATIS_DATA.rawResources[state.miner.resource] || {}).name || 'Mineral';
    let eqHtml = `Con esta tasa de <strong>${calc.rate} ${unitLabel.textContent}</strong> puedes abastecer exactamente:<ul>`;
    
    if (state.miner.resource === 'iron_ore') {
      const smelters = (calc.rate / 30).toFixed(2);
      const platesConstructors = (calc.rate / 30).toFixed(2);
      eqHtml += `
        <li>🔥 <strong>${smelters} Fundiciones de Hierro</strong> al 100% de saturación (30/min cada una).</li>
        <li>⚙️ <strong>${platesConstructors} Constructoras de Planchas</strong> directas desde lingote.</li>
      `;
    } else if (state.miner.resource === 'copper_ore') {
      const smelters = (calc.rate / 30).toFixed(2);
      eqHtml += `<li>🔥 <strong>${smelters} Fundiciones de Cobre</strong> (30/min c/u) produciendo alambre o láminas.</li>`;
    } else if (state.miner.resource === 'coal') {
      const generators = (calc.rate / 15).toFixed(2);
      const mw = (Number(generators) * 75).toFixed(0);
      eqHtml += `<li>⚡ <strong>${generators} Generadores de Carbón</strong> (15/min c/u) generando <strong>${mw} MW</strong> limpios.</li>`;
    } else if (state.miner.resource === 'limestone') {
      const concrete = (calc.rate / 45).toFixed(2);
      eqHtml += `<li>⚙️ <strong>${concrete} Constructoras de Hormigón</strong> (45/min c/u) produciendo ${(calc.rate / 3).toFixed(1)} Hormigón/min.</li>`;
    } else {
      eqHtml += `<li>📦 Flujo continuo de <strong>${calc.rate} ${unitLabel.textContent}</strong> para tus cadenas de montaje.</li>`;
    }
    eqHtml += `</ul>`;
    equivalences.innerHTML = eqHtml;
  }

  // =========================================================================
  // 3. TAB 2: FACTORY PLANNER
  // =========================================================================
  function initFactoryTab() {
    const itemSelect = document.getElementById('factoryItemSelect');
    const rateInput = document.getElementById('factoryTargetRate');
    const btnCalc = document.getElementById('btnCalculateFactory');
    const chkCastScrew = document.getElementById('chkCastScrew');
    const chkSolidSteel = document.getElementById('chkSolidSteel');
    const chkStitchedPlate = document.getElementById('chkStitchedPlate');

    // Populate Items that have recipes
    const craftableItems = new Set();
    SATIS_DATA.recipes.forEach(r => {
      r.outputs.forEach(o => craftableItems.add(o.item));
    });

    itemSelect.innerHTML = Array.from(craftableItems).map(itemId => {
      const item = SATIS_DATA.items[itemId] || { name: itemId, category: 'General' };
      return `<option value="${itemId}">${item.name} (${item.category || ''})</option>`;
    }).join('');
    itemSelect.value = state.factory.targetItem;

    btnCalc.addEventListener('click', () => {
      state.factory.targetItem = itemSelect.value;
      state.factory.targetRate = Math.max(0.01, parseFloat(rateInput.value) || 10);
      state.factory.altPreferences.screw = chkCastScrew.checked ? 'screw_cast' : 'screw_std';
      state.factory.altPreferences.steel_ingot = chkSolidSteel.checked ? 'steel_ingot_solid' : 'steel_ingot_std';
      state.factory.altPreferences.reinforced_iron_plate = chkStitchedPlate.checked ? 'reinforced_iron_plate_stitched' : 'reinforced_iron_plate_std';
      runFactoryPlanner();
    });

    runFactoryPlanner();
  }

  function runFactoryPlanner() {
    const plan = SatisCalc.planFactory(
      state.factory.targetItem, 
      state.factory.targetRate, 
      state.factory.altPreferences
    );

    // Totals
    const totalMachines = plan.machineSteps.reduce((acc, s) => acc + s.machinesCount, 0);
    document.getElementById('factoryTotalMachines').textContent = totalMachines.toFixed(2);
    document.getElementById('factoryTotalEnergy').textContent = plan.totalEnergyMw;
    document.getElementById('factoryStagesCount').textContent = plan.machineSteps.length;

    // Raw Materials & Nodes requirements
    const rawContainer = document.getElementById('factoryRawRequirements');
    rawContainer.innerHTML = plan.rawBreakdown.map(raw => `
      <div style="background: #18202d; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <strong style="color: var(--text-main); font-size: 0.95rem; display: flex; align-items: center; gap: 6px;">
            ${getItemIcon(raw.itemId || raw.id || raw.item, 22)} <span>${raw.name}</span>
          </strong>
          <span style="font-family: var(--font-mono); font-weight: 800; color: var(--ficsit-orange);">${raw.requiredRate} ${raw.isFluid ? 'm³/m' : '/min'}</span>
        </div>
        <div style="font-size: 0.75rem; color: var(--text-muted); line-height: 1.4;">
          Cinta necesaria: <span style="color: ${raw.beltNeeded.color}; font-weight: 700;">${raw.beltNeeded.name}</span><br>
          Equivalente Minero Mk.2:<br>
          • Nodo Puro: <strong>${raw.nodeEquivalents.pureMk2}</strong> nodos (240/m)<br>
          • Nodo Normal: <strong>${raw.nodeEquivalents.normalMk2}</strong> nodos (120/m)<br>
          • Nodo Impuro: <strong>${raw.nodeEquivalents.impureMk2}</strong> nodos (60/m)
        </div>
      </div>
    `).join('');

    // Machine Steps Tree
    const stepsContainer = document.getElementById('factoryStepsContainer');
    stepsContainer.innerHTML = plan.machineSteps.map((step, idx) => {
      const isAlt = step.recipe.isAlt;
      const whole = step.wholeMachines;
      const remainder = step.remainderClock;
      const machineDetail = remainder > 0 && whole > 0
        ? `${whole} al 100% + 1 al ${remainder}%`
        : (whole === 0 ? `1 al ${remainder}%` : `${whole} exactas`);

      const inputsList = step.inputs.map(inp => {
        const itemObj = SATIS_DATA.items[inp.item] || SATIS_DATA.rawResources[inp.item] || { name: inp.item };
        return `<span style="display: inline-flex; align-items: center; gap: 4px;">• ${getItemIcon(inp.item, 16)} ${itemObj.name}: <strong>${inp.rateTotal}/m</strong></span>`;
      }).join(' &nbsp;|&nbsp; ');

      return `
        <div class="tree-step-card">
          <div class="tree-building-badge">
            <div class="building-icon" style="display: flex; align-items: center; justify-content: center;">${step.building ? getBuildingIcon(step.building.id, 32) : '🏭'}</div>
            <div class="building-details">
              <h4>
                ${step.building ? step.building.name : 'Edificio'} 
                <span style="color: var(--ficsit-orange);">[${step.recipe.name}]</span>
                ${isAlt ? '<span class="badge-alt">ALT</span>' : ''}
              </h4>
              <p style="display: flex; align-items: center; gap: 4px; margin-top: 2px;">
                Produciendo: <strong>${step.neededRate}/min</strong> de ${getItemIcon(step.itemId, 18)} ${(SATIS_DATA.items[step.itemId] || {}).name || step.itemId}
              </p>
              <div style="font-size: 0.75rem; color: var(--text-sub); margin-top: 4px;">
                Insumos: ${inputsList}
              </div>
            </div>
          </div>
          <div class="tree-rate-badge">
            <div class="count">${step.machinesCount} <span style="font-size: 0.85rem; font-weight: 400; color: var(--text-muted);">máquinas</span></div>
            <div class="sub" style="color: #38bdf8;">${machineDetail}</div>
            <div class="sub" style="color: #facc15;">⚡ ${step.totalPower} MW</div>
          </div>
        </div>
      `;
    }).join('');
  }

  // =========================================================================
  // 4. TAB 3: SPLITTERS & MANIFOLDS
  // =========================================================================
  function initSplitterTab() {
    const inputRateField = document.getElementById('splitInputRate');
    const machineIntakeField = document.getElementById('splitMachineIntake');

    inputRateField.addEventListener('input', () => {
      state.splitter.inputRate = parseFloat(inputRateField.value) || 0;
      updateSplitterCalc();
    });

    machineIntakeField.addEventListener('input', () => {
      state.splitter.machineIntake = parseFloat(machineIntakeField.value) || 0;
      updateSplitterCalc();
    });

    window.setSplitPreset = (intake) => {
      machineIntakeField.value = intake;
      state.splitter.machineIntake = intake;
      updateSplitterCalc();
    };

    updateSplitterCalc();
  }

  function updateSplitterCalc() {
    const split = SatisCalc.calculateSplitting(state.splitter.inputRate, state.splitter.machineIntake);
    if (!split) return;

    const countNumber = document.getElementById('splitMachinesCount');
    const exactRatioTag = document.getElementById('splitExactRatioTag');
    const mainBeltBadge = document.getElementById('splitMainBeltBadge');
    const feederBeltBadge = document.getElementById('splitFeederBeltBadge');
    const fractionalNotice = document.getElementById('splitFractionalNotice');
    const balancerHeader = document.getElementById('splitBalancerHeader');
    const balancerDesc = document.getElementById('splitBalancerDesc');
    const manifoldSteps = document.getElementById('splitManifoldSteps');

    countNumber.textContent = split.totalMachinesFloat;
    exactRatioTag.textContent = split.fractionalRemainder === 0 ? 'exactas (100%)' : `(${split.ceilMachines} máq. con ajuste)`;

    // Main and Feeder Belts
    mainBeltBadge.innerHTML = `
      <span class="belt-badge" style="color: ${split.mainBelt.color}; border-color: ${split.mainBelt.color};">
        ${split.mainBelt.name} (${split.mainBelt.speed}/m)
      </span>
    `;
    feederBeltBadge.innerHTML = `
      <span class="belt-badge" style="color: ${split.feederBelt.color}; border-color: ${split.feederBelt.color};">
        ${split.feederBelt.name} (${split.feederBelt.speed}/m)
      </span>
    `;

    // Overclocking / Fractional advice
    if (split.fractionalRemainder === 0) {
      fractionalNotice.style.display = 'none';
    } else {
      fractionalNotice.style.display = 'block';
      fractionalNotice.innerHTML = `
        <strong style="color: #fbbf24;">⚙️ Ajuste de Ratios sin Sobrantes:</strong>
        <div style="font-size: 0.85rem; color: var(--text-main); margin-top: 4px; line-height: 1.5;">
          • <strong>Opción A (Recomendada):</strong> Coloca <strong>${split.wholeMachines} máquinas al 100%</strong> y <strong>1 máquina al ${split.lastMachineClock}%</strong> de reloj.<br>
          • <strong>Opción B (Sincronizada):</strong> Coloca <strong>${split.ceilMachines} máquinas sincronizadas al ${split.syncClock}%</strong> cada una para repartir el consumo por igual.
        </div>
      `;
    }

    // Balancer Info
    balancerHeader.textContent = `📐 ${split.balancerType}`;
    balancerDesc.textContent = split.balancerDetail;

    // Manifold Visualizer Steps
    manifoldSteps.innerHTML = split.manifoldSteps.map(step => `
      <div class="flow-step-card ${step.isFractional ? 'fractional' : ''}">
        <div class="step-info">
          <div class="step-num">#${step.machineIndex}</div>
          <div class="step-desc">
            <span class="machine-tag">Máquina ${step.machineIndex} ${step.isFractional ? '(Ajustada)' : ''}</span><br>
            <span class="intake-tag">Entrada consumida: <strong>${step.machineConsumes} /min</strong> &nbsp;|&nbsp; Flujo restante: ${step.flowBefore} /min</span>
          </div>
        </div>
        <div class="step-belts">
          <span class="belt-badge" style="color: ${step.recommendedBelt.color}; border-color: ${step.recommendedBelt.color}; font-size: 0.75rem;">
            Cinta de espina: ${step.recommendedBelt.name}
          </span>
        </div>
      </div>
    `).join('');
  }

  // =========================================================================
  // 5. TAB 4: QUICK MACHINE CALCULATOR
  // =========================================================================
  function initQuickTab() {
    const buildingSelect = document.getElementById('quickBuildingSelect');
    const recipeSelect = document.getElementById('quickRecipeSelect');
    const countInput = document.getElementById('quickMachineCount');
    const clockRange = document.getElementById('quickClockRange');
    const clockVal = document.getElementById('quickClockVal');
    const shardsVal = document.getElementById('quickShardsVal');

    // Populate buildings
    buildingSelect.innerHTML = Object.values(SATIS_DATA.buildings).map(b => `
      <option value="${b.id}">${b.icon} ${b.name} (${b.power} MW)</option>
    `).join('');
    buildingSelect.value = state.quick.building;

    function populateRecipes() {
      const filtered = SATIS_DATA.recipes.filter(r => r.building === buildingSelect.value);
      recipeSelect.innerHTML = filtered.map(r => `
        <option value="${r.id}">${r.name} ${r.isAlt ? '[ALT]' : ''}</option>
      `).join('');
      if (filtered.length > 0) {
        recipeSelect.value = filtered[0].id;
        state.quick.recipeId = filtered[0].id;
      }
      updateQuickCalc();
    }

    buildingSelect.addEventListener('change', () => {
      state.quick.building = buildingSelect.value;
      populateRecipes();
    });

    recipeSelect.addEventListener('change', () => {
      state.quick.recipeId = recipeSelect.value;
      updateQuickCalc();
    });

    countInput.addEventListener('input', () => {
      state.quick.count = Math.max(1, parseInt(countInput.value) || 1);
      updateQuickCalc();
    });

    clockRange.addEventListener('input', () => {
      state.quick.clock = Number(clockRange.value);
      clockVal.textContent = `${state.quick.clock}%`;
      const shards = state.quick.clock > 100 ? Math.ceil((state.quick.clock - 100) / 50) : 0;
      shardsVal.textContent = `🔋 ${shards} Shards`;
      updateQuickCalc();
    });

    populateRecipes();
  }

  function updateQuickCalc() {
    const recipe = SATIS_DATA.recipes.find(r => r.id === state.quick.recipeId);
    if (!recipe) return;

    const building = SATIS_DATA.buildings[recipe.building];
    const clockRatio = state.quick.clock / 100;
    const count = state.quick.count;

    // Power
    const singlePower = building.power * Math.pow(clockRatio, 1.321928);
    const totalPower = (singlePower * count).toFixed(2);
    document.getElementById('quickTotalPower').textContent = totalPower;

    // In / Out lists
    const inList = document.getElementById('quickInputsList');
    inList.innerHTML = recipe.inputs.map(inp => {
      const item = SATIS_DATA.items[inp.item] || SATIS_DATA.rawResources[inp.item] || { name: inp.item };
      const totalRate = (inp.rate * clockRatio * count).toFixed(2);
      const belt = SatisCalc.getBeltForRate(totalRate);
      return `
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px; border-bottom: 1px solid #263345; padding-bottom: 4px;">
          <span>${item.name}</span>
          <span style="font-family: var(--font-mono); font-weight: 700; color: #f87171;">
            ${totalRate}/m <small style="color: ${belt.color}">(${belt.name})</small>
          </span>
        </div>
      `;
    }).join('');

    const outList = document.getElementById('quickOutputsList');
    outList.innerHTML = recipe.outputs.map(out => {
      const item = SATIS_DATA.items[out.item] || { name: out.item };
      const totalRate = (out.rate * clockRatio * count).toFixed(2);
      const belt = SatisCalc.getBeltForRate(totalRate);
      return `
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px; border-bottom: 1px solid #263345; padding-bottom: 4px;">
          <span>${item.name}</span>
          <span style="font-family: var(--font-mono); font-weight: 700; color: #4ade80;">
            ${totalRate}/m <small style="color: ${belt.color}">(${belt.name})</small>
          </span>
        </div>
      `;
    }).join('');
  }

  // =========================================================================
  // 6. TAB 5: RECIPES DATABASE
  // =========================================================================
  function initRecipesTab() {
    const tableBody = document.getElementById('recipeTableBody');
    const searchInput = document.getElementById('recipeSearchInput');

    function renderRecipes(query = '') {
      const q = query.toLowerCase().trim();
      const filtered = SATIS_DATA.recipes.filter(r => {
        if (!q) return true;
        const b = SATIS_DATA.buildings[r.building] || {};
        const inMatch = r.inputs.some(i => (SATIS_DATA.items[i.item] || SATIS_DATA.rawResources[i.item] || {}).name?.toLowerCase().includes(q));
        const outMatch = r.outputs.some(o => (SATIS_DATA.items[o.item] || {}).name?.toLowerCase().includes(q));
        return r.name.toLowerCase().includes(q) || b.name?.toLowerCase().includes(q) || inMatch || outMatch;
      });

      tableBody.innerHTML = filtered.map(r => {
        const building = SATIS_DATA.buildings[r.building] || { name: r.building, icon: '🏭' };
        const inText = r.inputs.map(i => {
          const item = SATIS_DATA.items[i.item] || SATIS_DATA.rawResources[i.item] || { name: i.item };
          return `<span style="display: inline-flex; align-items: center; gap: 4px; margin-right: 6px;">${getItemIcon(i.item, 16)} ${i.rate}/m ${item.name}</span>`;
        }).join(' ');

        const outText = r.outputs.map(o => {
          const item = SATIS_DATA.items[o.item] || { name: o.item };
          return `<span style="display: inline-flex; align-items: center; gap: 4px; margin-right: 6px;">${getItemIcon(o.item, 16)} ${o.rate}/m ${item.name}</span>`;
        }).join(' ');

        return `
          <tr>
            <td>
              <div style="display: flex; align-items: center; gap: 8px;">
                ${getItemIcon(r.outputs[0]?.item, 26)}
                <div>
                  <strong>${r.name}</strong> ${r.isAlt ? '<span class="badge-alt">ALT</span>' : ''}
                </div>
              </div>
            </td>
            <td>
              <div style="display: flex; align-items: center; gap: 6px;">
                ${getBuildingIcon(r.building, 22)}
                <span>${building.name}</span>
              </div>
            </td>
            <td style="color: #f87171;">${inText}</td>
            <td style="color: #4ade80; font-weight: 600;">${outText}</td>
            <td>${r.isAlt ? 'Disco Duro' : 'Estándar'}</td>
          </tr>
        `;
      }).join('');
    }

    searchInput.addEventListener('input', (e) => {
      renderRecipes(e.target.value);
    });

    renderRecipes();
  }

  // =========================================================================
  // 7. COPY FICSIT REPORT TO CLIPBOARD
  // =========================================================================
  function initCopyButton() {
    const btn = document.getElementById('btnCopyReport');
    btn.addEventListener('click', () => {
      const plan = SatisCalc.planFactory(state.factory.targetItem, state.factory.targetRate, state.factory.altPreferences);
      const lines = [
        `=== REPORTE DE PRODUCCIÓN FICSIT (Satisfactory 1.0/1.2) ===`,
        `OBJETIVO: ${plan.targetRate} /min de ${plan.targetName}`,
        `ENERGÍA TOTAL: ${plan.totalEnergyMw} MW`,
        ``,
        `--- MATERIAS PRIMAS REQUERIDAS ---`
      ];

      plan.rawBreakdown.forEach(raw => {
        lines.push(`• ${raw.name}: ${raw.requiredRate} /min (${raw.beltNeeded.name})`);
        lines.push(`  - Nodos Mk.2 req: ${raw.nodeEquivalents.pureMk2} Puros | ${raw.nodeEquivalents.normalMk2} Normales | ${raw.nodeEquivalents.impureMk2} Impuros`);
      });

      lines.push(``);
      lines.push(`--- MAQUINARIA DE LA LÍNEA ---`);
      plan.machineSteps.forEach(s => {
        lines.push(`• ${s.building.name} [${s.recipe.name}]: ${s.machinesCount} máquinas (${s.totalPower} MW) -> Produce ${s.neededRate}/m`);
      });

      navigator.clipboard.writeText(lines.join('\n')).then(() => {
        const originalText = btn.innerHTML;
        btn.innerHTML = '✅ ¡Copiado!';
        setTimeout(() => {
          btn.innerHTML = originalText;
        }, 2000);
      });
    });
  }
});
