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
      altPreferences: {
        screw: 'screw_cast',
        steel_ingot: null,
        reinforced_iron_plate: null
      }
    },
    sandbox: {
      mode: 'miners', // 'miners' | 'free'
      resource: 'iron_ore',
      purity: 'normal',
      minerTier: 'miner_mk1',
      minerCount: 2,
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
      altPreferences: {
        screw: 'screw_cast',
        steel_ingot: null,
        reinforced_iron_plate: null
      }
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
    startX: 0,
    startY: 0,
    currentModel: null,
    showRatios: true,
    activeMaterialFilter: null,
    isInitialized: false
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

    if (drillInputBox) drillInputBox.style.display = isDrills ? 'flex' : 'none';
    if (rateInputBox) rateInputBox.style.display = isDrills ? 'none' : 'flex';
    if (quantityLabel) {
      quantityLabel.textContent = isDrills ? '⛏️ 2. ¿Cuántos Taladros colocas?' : '📦 2. Cantidad deseada (piezas/min)';
    }
    if (btnToggleCalcMode) {
      btnToggleCalcMode.textContent = isDrills ? '(Cambiar a piezas/min manual)' : '(Cambiar a cálculo por taladros)';
    }
    if (drillInput) drillInput.value = state.builder.drillCount || 1;
    if (rateInput) rateInput.value = state.builder.targetRate;
  }

  function syncTargetRateFromDrills() {
    const targetGoal = state.builder.targetGoal || 'iron_plate';
    const primaryRawId = getPrimaryRawId(targetGoal, state.builder.altPreferences);
    const minerTier = (state.builder.minerOverrides && state.builder.minerOverrides[primaryRawId]) || state.builder.globalMinerTier || 'miner_mk1';
    const minerMeta = SATIS_DATA.miners[minerTier] || SATIS_DATA.miners.miner_mk1;
    const drillCount = Math.max(1, state.builder.drillCount || 1);

    const purityKey = (state.builder.purityOverrides && state.builder.purityOverrides[primaryRawId]) || 'normal';
    const purity = SATIS_DATA.purities[purityKey] || SATIS_DATA.purities.normal;

    const singleMinerOutput = minerMeta.baseRate * purity.factor;
    const availableRawRate = Number((singleMinerOutput * drillCount).toFixed(2));

    state.builder.nodeCountOverrides = state.builder.nodeCountOverrides || {};
    state.builder.nodeCountOverrides[primaryRawId] = drillCount;

    const calculatedRate = SatisCalc.calculateTargetRateFromRawExtraction(
      targetGoal,
      primaryRawId,
      availableRawRate,
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

    // Raw Cards Container delegation (Purity, Miner Tier, Node Count Stepper, Sync to Drill)
    const rawCardsBox = document.getElementById('builderRawCardsContainer');
    if (rawCardsBox) {
      rawCardsBox.addEventListener('click', (e) => {
        // 1. Purity toggle
        const btnPurity = e.target.closest('.btn-raw-purity');
        if (btnPurity) {
          const rawId = btnPurity.getAttribute('data-raw');
          const purity = btnPurity.getAttribute('data-purity');
          state.builder.purityOverrides = state.builder.purityOverrides || {};
          state.builder.purityOverrides[rawId] = purity;
          if (state.builder.calcMode === 'drills') {
            syncTargetRateFromDrills();
          }
          updateLineBuilder();
          return;
        }

        // 2. Miner tier toggle (Mk.1, Mk.2, Mk.3)
        const btnMiner = e.target.closest('.btn-raw-miner');
        if (btnMiner) {
          const rawId = btnMiner.getAttribute('data-raw');
          const minerKey = btnMiner.getAttribute('data-miner');
          state.builder.minerOverrides = state.builder.minerOverrides || {};
          state.builder.minerOverrides[rawId] = minerKey;
          if (state.builder.calcMode === 'drills') {
            syncTargetRateFromDrills();
          }
          updateLineBuilder();
          return;
        }

        // 3. Node count minus
        const btnMinus = e.target.closest('.btn-node-minus');
        if (btnMinus) {
          const rawId = btnMinus.getAttribute('data-raw');
          const current = parseInt(btnMinus.getAttribute('data-current'), 10) || 1;
          const newVal = Math.max(1, current - 1);
          state.builder.nodeCountOverrides = state.builder.nodeCountOverrides || {};
          state.builder.nodeCountOverrides[rawId] = newVal;
          const primaryRawId = getPrimaryRawId(state.builder.targetGoal, state.builder.altPreferences);
          if (state.builder.calcMode === 'drills' && rawId === primaryRawId) {
            state.builder.drillCount = newVal;
            syncTargetRateFromDrills();
          }
          updateLineBuilder();
          return;
        }

        // 4. Node count plus
        const btnPlus = e.target.closest('.btn-node-plus');
        if (btnPlus) {
          const rawId = btnPlus.getAttribute('data-raw');
          const current = parseInt(btnPlus.getAttribute('data-current'), 10) || 1;
          const newVal = current + 1;
          state.builder.nodeCountOverrides = state.builder.nodeCountOverrides || {};
          state.builder.nodeCountOverrides[rawId] = newVal;
          const primaryRawId = getPrimaryRawId(state.builder.targetGoal, state.builder.altPreferences);
          if (state.builder.calcMode === 'drills' && rawId === primaryRawId) {
            state.builder.drillCount = newVal;
            syncTargetRateFromDrills();
          }
          updateLineBuilder();
          return;
        }

        // 5. Node count auto reset
        const btnAuto = e.target.closest('.btn-node-auto');
        if (btnAuto) {
          const rawId = btnAuto.getAttribute('data-raw');
          if (state.builder.nodeCountOverrides) {
            delete state.builder.nodeCountOverrides[rawId];
          }
          updateLineBuilder();
          return;
        }

        // 6. Sync factory to this drill / mineral capacity
        const btnSync = e.target.closest('.btn-sync-factory-to-drill');
        if (btnSync) {
          const rawId = btnSync.getAttribute('data-raw');
          const cap = parseFloat(btnSync.getAttribute('data-capacity')) || 60;
          const nodes = parseInt(btnSync.getAttribute('data-nodes'), 10) || 1;
          state.builder.calcMode = 'drills';
          state.builder.drillCount = nodes;
          state.builder.nodeCountOverrides = state.builder.nodeCountOverrides || {};
          state.builder.nodeCountOverrides[rawId] = nodes;
          state.builder.targetRate = SatisCalc.calculateTargetRateFromRawExtraction(
            state.builder.targetGoal,
            rawId,
            cap,
            state.builder.altPreferences
          );
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

    const plan = SatisCalc.buildTargetFactoryPlan(
      targetGoal,
      targetRate,
      altPreferences,
      purityOverrides,
      minerOverrides,
      nodeCountOverrides,
      globalMinerTier
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

    // 2. Render Raw Material Cards (Auto-calculated!)
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
        plan.rawBreakdown.forEach(raw => {
          const curPurity = raw.purityKey || 'normal';
          const belt = raw.beltNeeded;

          // Miner Selector HTML (only for solids)
          let minerSelectorHtml = '';
          if (!raw.isFluid) {
            minerSelectorHtml = `
              <div style="margin-top: 6px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
                  <span style="font-size: 0.7rem; color: #94a3b8; text-transform: uppercase; font-weight: 700;">Tecnología de Taladro:</span>
                  <span style="font-size: 0.72rem; color: #f59e0b; font-weight: 700;">${raw.minerName}</span>
                </div>
                <div class="raw-purity-group">
                  <button type="button" class="btn-raw-miner ${raw.minerKey === 'miner_mk1' ? 'active' : ''}" data-raw="${raw.rawId}" data-miner="miner_mk1">⛏️ Mk.1</button>
                  <button type="button" class="btn-raw-miner ${raw.minerKey === 'miner_mk2' ? 'active' : ''}" data-raw="${raw.rawId}" data-miner="miner_mk2">⛏️ Mk.2</button>
                  <button type="button" class="btn-raw-miner ${raw.minerKey === 'miner_mk3' ? 'active' : ''}" data-raw="${raw.rawId}" data-miner="miner_mk3">⛏️ Mk.3</button>
                </div>
              </div>
            `;
          }

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

              <!-- Miner Tier Selector -->
              ${minerSelectorHtml}

              <!-- Purity Selector Buttons -->
              <div style="margin-top: 6px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
                  <span style="font-size: 0.7rem; color: #94a3b8; text-transform: uppercase; font-weight: 700;">Pureza de tu Mena:</span>
                  <span style="font-size: 0.72rem; color: #38bdf8; font-weight: 700;">${raw.purityName} (${raw.singleMinerOutput}/m c/u)</span>
                </div>
                <div class="raw-purity-group">
                  <button type="button" class="btn-raw-purity ${curPurity === 'impure' ? 'active' : ''}" data-raw="${raw.rawId}" data-purity="impure">Impuro</button>
                  <button type="button" class="btn-raw-purity ${curPurity === 'normal' ? 'active' : ''}" data-raw="${raw.rawId}" data-purity="normal">Normal</button>
                  <button type="button" class="btn-raw-purity ${curPurity === 'pure' ? 'active' : ''}" data-raw="${raw.rawId}" data-purity="pure">Puro</button>
                </div>
              </div>

              <!-- Node / Mena Count Stepper -->
              <div style="margin-top: 6px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
                  <span style="font-size: 0.7rem; color: #94a3b8; text-transform: uppercase; font-weight: 700;">¿Cuántas menas tienes?</span>
                  <button type="button" class="btn-node-auto" data-raw="${raw.rawId}">Auto (${raw.minWholeNodes} menas)</button>
                </div>
                <div class="node-stepper">
                  <button type="button" class="btn-node-step btn-node-minus" data-raw="${raw.rawId}" data-current="${raw.userNodeCount}">−</button>
                  <div class="node-count-display">${raw.userNodeCount} ${raw.userNodeCount === 1 ? 'Mena / Nodo' : 'Menas / Nodos'}</div>
                  <button type="button" class="btn-node-step btn-node-plus" data-raw="${raw.rawId}" data-current="${raw.userNodeCount}">+</button>
                </div>
              </div>

              <!-- Supply & Capacity Balance Pill -->
              <div style="margin-top: 8px;">
                ${raw.isCovered ? `
                  <div class="raw-balance-pill covered">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <span>✅ <strong>Abastecido:</strong> ${raw.totalCapacity} /min extraídos</span>
                      <span style="color: #4ade80; font-size: 0.72rem;">(Sobra +${raw.balance}/m)</span>
                    </div>
                    <div style="font-size: 0.69rem; color: #cbd5e1; margin-top: 2px;">
                      💡 Reloj sugerido: <strong>${raw.optimalClock}%</strong> por minero para gasto justo.
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
                        ? `Sube a ${raw.minWholeNodes} menas o reloj al <strong>${raw.requiredOverclock}%</strong> con Fragmentos.` 
                        : `Faltan menas. Agrega más menas o mejora a Taladro Mk.2 / Mk.3.`}
                    </div>
                  </div>
                `}
              </div>

              <!-- Node & Belt info -->
              <div style="margin-top: 6px; padding: 6px 8px; background: rgba(0,0,0,0.25); border-radius: 4px; font-size: 0.74rem; color: #cbd5e1; display: flex; flex-direction: column; gap: 3px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span>Cinta por cada mena:</span>
                  <strong style="color: ${raw.singleNodeBelt.color}; font-size: 0.72rem;">${raw.singleNodeBelt.name} (${raw.singleMinerOutput}/m)</strong>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span>Cinta troncal requerida:</span>
                  <strong style="color: ${belt.color}; font-size: 0.72rem;">${belt.name} (${belt.speed}/m)</strong>
                </div>
              </div>

              <!-- Button to adapt entire factory to this mineral's extraction rate -->
              <button type="button" class="btn-sync-factory-to-drill" data-raw="${raw.rawId}" data-capacity="${raw.totalCapacity}" data-nodes="${raw.userNodeCount}">
                ⚡ Adaptar Fábrica a este Recurso (${raw.totalCapacity}/m extraídos)
              </button>
            </div>
          `;
        });
        rawContainer.innerHTML = cardsHtml;
      }
    }

    // 3. Render Pipeline Phases into #builderDynamicPhasesContainer
    const pipelineContainer = document.getElementById('builderDynamicPhasesContainer');
    if (pipelineContainer) {
      let pipeHtml = '';

      // --- ETAPA 1: Nodos y Extracción en el Terreno ---
      if (plan.rawBreakdown.length > 0) {
        let minersListHtml = '';
        plan.rawBreakdown.forEach(raw => {
          minersListHtml += `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: rgba(15, 23, 42, 0.6); border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.04); flex-wrap: wrap; gap: 8px;">
              <div style="display: flex; align-items: center; gap: 10px;">
                ${getItemIcon(raw.rawId, 26)}
                <div>
                  <strong style="color: #f1f5f9; font-size: 0.9rem;">${raw.userNodeCount}x ${raw.minerName} &bull; ${raw.name}</strong>
                  <div style="font-size: 0.73rem; color: var(--text-muted);">
                    Nodo ${raw.purityName} (${raw.singleMinerOutput}/m c/u) &bull; Cinta por minero: <span style="color: ${raw.singleNodeBelt.color}; font-weight: 700;">${raw.singleNodeBelt.name}</span>
                  </div>
                </div>
              </div>
              <div style="display: flex; align-items: center; gap: 12px;">
                <div style="text-align: right;">
                  <div style="font-size: 0.9rem; font-weight: 800; color: ${raw.isCovered ? '#4ade80' : '#ef4444'};">
                    ${raw.totalCapacity} ${raw.isFluid ? 'm³/m' : '/min'}
                  </div>
                  <div style="font-size: 0.7rem; color: var(--text-muted);">
                    (Fábrica necesita: ${raw.requiredRate}/m)
                  </div>
                </div>
                <span class="badge" style="background: rgba(255,255,255,0.06); color: ${raw.beltNeeded.color}; border: 1px solid ${raw.beltNeeded.color}; font-size: 0.72rem; padding: 2px 8px;">
                  Troncal: ${raw.beltNeeded.name}
                </span>
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
                    <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">
                      Receta: <span style="color: #f1f5f9; font-weight: 600;">${step.recipe.name}</span>
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
          <text x="32" y="27" fill="#94a3b8" font-size="7.5" font-weight="600">${m.recipe.name}</text>

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
      }
    });

    // Zoom con rueda de ratón centrado en el cursor
    viewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = viewport.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      const newScale = Math.max(0.25, Math.min(2.8, bpViewerState.scale * zoomFactor));

      bpViewerState.panX = mouseX - (mouseX - bpViewerState.panX) * (newScale / bpViewerState.scale);
      bpViewerState.panY = mouseY - (mouseY - bpViewerState.panY) * (newScale / bpViewerState.scale);
      bpViewerState.scale = newScale;

      applyBlueprintTransform(canvas, bpViewerState);
    }, { passive: false });

    // Botones de la barra de herramientas
    const btnIn = document.getElementById('btnBpZoomIn');
    const btnOut = document.getElementById('btnBpZoomOut');
    const btnReset = document.getElementById('btnBpReset');
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
    });

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

  function attachBlueprintHoverTooltips() {
    const viewport = document.getElementById('blueprintViewport');
    const tooltip = document.getElementById('blueprintTooltip');
    const canvas = document.getElementById('blueprintCanvas');
    if (!viewport || !tooltip || !canvas) return;

    function clearBlueprintHighlights() {
      tooltip.style.display = 'none';
      canvas.classList.remove('has-active-focus');
      canvas.querySelectorAll('.is-hovered, .is-active-in, .is-active-out, .is-active-source, .is-active-target, .is-dimmed').forEach(el => {
        el.classList.remove('is-hovered', 'is-active-in', 'is-active-out', 'is-active-source', 'is-active-target', 'is-dimmed');
      });
      if (bpViewerState.activeMaterialFilter) {
        applyBlueprintMaterialFilter();
      }
    }

    // 1. Trazado Interactivo al Pasar el Ratón por Máquinas
    canvas.querySelectorAll('.blueprint-machine').forEach(mEl => {
      mEl.addEventListener('mouseenter', () => {
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
        subtitleEl.innerHTML = `Elige el producto que deseas fabricar (ej: Motor, Rotor, Marco Modular). La fábrica calculará todos los minerales requeridos (Hierro, Cobre, Caliza, Carbón) de forma 100% automática.`;
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
      checkAutoSmeltVisibility();
      updateSandbox();
    });

    btnSbModeFree.addEventListener('click', () => {
      state.sandbox.mode = 'free';
      btnSbModeFree.classList.add('active');
      btnSbModeMiners.classList.remove('active');
      sbMinersPanel.style.display = 'none';
      sbFreePanel.style.display = 'grid';
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
        if (state.sandbox.autoBalance) applyAutoBalanceToBranches();
        updateSandbox();
      });
    });

    sbMinerTierSelect.value = state.sandbox.minerTier;
    sbMinerTierSelect.addEventListener('change', (e) => {
      state.sandbox.minerTier = e.target.value;
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
        openBranchBlueprintModal(idx);
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
    if (state.sandbox.mode === 'miners') {
      const p1Calc = SatisCalc.calculateExtraction(state.sandbox.purity, state.sandbox.minerTier, 100);
      const singleMinerRate = p1Calc.rate;
      const rawRate = Number((state.sandbox.minerCount * singleMinerRate).toFixed(2));
      const rawMeta = SATIS_DATA.rawResources[state.sandbox.resource] || { name: state.sandbox.resource };
      const minerBldg = SATIS_DATA.miners[state.sandbox.minerTier] || { name: 'Minero', power: 5 };
      const minerPower = Number((state.sandbox.minerCount * p1Calc.powerMw).toFixed(1));

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
          minerPower: minerPower
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
          minerPower: minerPower
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
        minerPower: 0
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
      sbAvailableBadge.innerHTML = `<span>${trunkBelt.name}:</span> <strong>${supply.rate.toFixed(1)} /min ${supply.itemName}</strong>`;
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

    // Find derivable recipes for this supply (direct + multi-tier)
    let derivableRecipes = SatisCalc.getDerivableRecipesForSupply(supply.item);
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
    if (supply.isSmelted && supply.smeltersNeeded > 0) {
      buildingCounts['Hornos (Fundiciones)'] = (buildingCounts['Hornos (Fundiciones)'] || 0) + Math.ceil(supply.smeltersNeeded);
    }

    state.sandbox.branches.forEach((b, idx) => {
      // Ensure branch has a valid recipe
      if (!derivableRecipes.some(r => r.id === b.recipeId)) {
        b.recipeId = derivableRecipes[0].id;
      }

      const chain = SatisCalc.resolveBranchSubchain(supply.item, b.recipeId, b.machineCount);
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

    // Update Right Column (Shopping List & Energy)
    const totalPowerMw = supply.minerPower + supply.smelterPower + totalBranchPower;
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
