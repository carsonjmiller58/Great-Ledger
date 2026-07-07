import { getState, getDerivedStats, updateActiveExpedition, completeExpedition, terminateExpeditionGracefully, startExpedition } from '../state.js';
import { rollCombatTick, DUNGEONS, getWeaponMasteryKey, WEAPON_PRESETS } from '../formulas.js';

let timerInterval = null;
let encounterInterval = null;
let targetTime = 0; // Total Focus Goal (ms)
let timeRemaining = 0;
let timeElapsed = 0;
let currentMonster = null;
let lastVisibilityChange = 0;
let isIndefiniteMode = false;

export function renderExpedition(container) {
  const state = getState();
  const derived = getDerivedStats();

  // If expedition is NOT active, show the countdown setup screen
  if (!state.expedition.active) {
    const selectedDungeonId = state.expedition.selectedDungeonId || 'woods';
    const dungeon = DUNGEONS.find(d => d.id === selectedDungeonId) || DUNGEONS[0];

    // Reset setup variables safely
    cleanupTimers();
    currentMonster = null;
    lastVisibilityChange = 0;

    container.innerHTML = `
      <div class="expedition-screen setup-view">
        <div class="parchment-card header-banner" style="border-color: ${dungeon.color}; display: flex; flex-direction: column; gap: 4px;">
          <h1 class="card-title" style="margin-bottom:4px; font-size:1.1rem; color: ${dungeon.color}">${dungeon.icon} Deep Focus Journey</h1>
          <p class="description-text">
            Prepare your mind. Selected Destination: <strong style="color: ${dungeon.color}">${dungeon.name}</strong> (${dungeon.biome}).
          </p>
          
          <div class="selected-dungeon-card" style="border: 1px dashed rgba(44,37,30,0.15); border-radius: 8px; padding: 10px; margin-top: 6px; background-color: rgba(0,0,0,0.01); text-align: left;">
            <div style="font-family: var(--font-header); font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: ${dungeon.color};">${dungeon.icon} ${dungeon.name}</div>
            <div style="font-size: 0.72rem; color: var(--ink-muted); margin-top: 2px; line-height: 1.3;">${dungeon.description}</div>
            <div style="font-size: 0.6rem; color: var(--ruby-crimson); font-weight: 700; margin-top: 4px;">Recommended Level: ${dungeon.levelRequirement}</div>
          </div>

          <button class="btn-secondary full-width-btn" id="btn-switch-destination" style="margin-top: 8px;">🗺️ Switch Destination</button>
        </div>

        <div class="parchment-card focus-timer-box" style="padding: 16px;">
          <div class="clock-display" style="margin: 10px auto;">
            <svg class="radial-ring" viewBox="0 0 100 100">
              <circle class="ring-track" cx="50" cy="50" r="45"></circle>
              <circle id="ring-fill" class="ring-fill" cx="50" cy="50" r="45" style="stroke:${dungeon.color}"></circle>
            </svg>
            <div class="clock-labels">
              <span id="timer-countdown">00:10</span>
              <span id="timer-goal-label">10s Goal</span>
            </div>
          </div>

          <div class="duration-selectors" id="timer-presets" style="margin-bottom: 12px;">
            <button class="btn-secondary btn-preset active" data-sec="600">⏱️ 10 Mins</button>
            <button class="btn-secondary btn-preset" data-sec="1500">⏱️ 25 Mins</button>
            <button class="btn-secondary btn-preset" data-sec="3000">⏱️ 50 Mins</button>
            <button class="btn-secondary btn-preset" id="btn-timer-indefinite" data-sec="-1">♾️ Indefinite</button>
            <button class="btn-secondary" id="btn-timer-custom-toggle">⏱️ Custom</button>
          </div>

          <div id="custom-time-input-box" class="custom-time-box hidden" style="margin-bottom: 12px;">
            <label class="custom-label">Custom Focus Minutes:</label>
            <div class="custom-input-row">
              <input type="number" id="custom-minutes-input" min="1" max="180" value="15" />
              <button class="btn-secondary" id="btn-timer-custom-set">Set</button>
            </div>
          </div>

          <button class="btn-primary full-width-btn" id="btn-focus-start" style="font-size: 0.95rem; padding: 12px; margin-top: 4px;">⚔️ Ignite Focus Session</button>
        </div>
      </div>

      <!-- Destination selector overlay -->
      <div id="destination-selector-overlay" class="modal-overlay hidden">
        <div class="parchment-card modal-content" style="max-height: 80vh; overflow-y: auto; width: 90%; max-width: 400px; padding: 16px;">
          <h2 class="card-title" style="margin-bottom: 10px;">🗺️ Choose Destination</h2>
          <div class="dungeon-list-box" style="display: flex; flex-direction: column; gap: 8px;">
            ${renderDungeonsSelectorList(state.profile.steps, state.profile.totalLevel)}
          </div>
          <button class="btn-secondary full-width-btn" id="btn-close-destination" style="margin-top: 12px;">Cancel</button>
        </div>
      </div>
    `;

    // CSS moved to styles.css
    setupSetupViewListeners(container, selectedDungeonId);
    return;
  }

  // ACTIVE EXPEDITION RUNNING VIEW
  const dungeon = DUNGEONS.find(d => d.id === state.expedition.dungeonId) || DUNGEONS[0];

  container.innerHTML = `
    <div class="expedition-screen strike-parent" style="border-color:${dungeon.color}">
      
      <!-- Stage Progression Header -->
      <div class="stage-tracker">
        <span class="stage-dot active" data-index="0">Entrance</span>
        <span class="stage-connector"></span>
        <span class="stage-dot" data-index="1">Lower Halls</span>
        <span class="stage-connector"></span>
        <span class="stage-dot" data-index="2">Caverns</span>
        <span class="stage-connector"></span>
        <span class="stage-dot" data-index="3">Boss Chamber</span>
      </div>

      <!-- Left Panel: Focus Clock -->
      <div class="focus-timer-box parchment-card">
        <div class="dungeon-title-bar" style="color:${dungeon.color}">
          <span>${dungeon.icon} Deep Focus: ${dungeon.name}</span>
        </div>

        <!-- Big Radial Clock -->
        <div class="clock-display">
          <svg class="radial-ring" viewBox="0 0 100 100">
            <circle class="ring-track" cx="50" cy="50" r="45"></circle>
            <circle id="ring-fill" class="ring-fill" cx="50" cy="50" r="45" style="stroke:${dungeon.color}"></circle>
          </svg>
          <div class="clock-labels">
            <span id="timer-countdown">00:00</span>
            <span id="timer-goal-label">Focusing...</span>
          </div>
        </div>

        <div class="timer-controls">
          <button class="btn-primary hidden" id="btn-summon-boss">👑 Summon Boss!</button>
          <button class="btn-secondary btn-flee" id="btn-focus-abandon">🏳️ Retreat</button>
        </div>
      </div>

      <!-- Middle: Combat Stats & Battle HUD -->
      <div id="battle-hud" class="parchment-card battle-hud hidden">
        <div class="hud-halves">
          <div class="hud-hero">
            <span class="hud-avatar">⚔️ ${state.profile.name}</span>
            <div class="hud-hp-bar">
              <div id="hud-hero-hp" class="hp-fill fill-green" style="width:100%"></div>
            </div>
            <span class="hud-label" id="hud-hero-hp-txt">HP: 20/20</span>
          </div>
          
          <div class="versus-icon">VS</div>
          
          <div class="hud-enemy" id="hud-enemy-box">
            <span class="hud-avatar" id="hud-enemy-name">Monster</span>
            <div class="hud-hp-bar">
              <div id="hud-enemy-hp" class="hp-fill fill-red" style="width:100%"></div>
            </div>
            <span class="hud-label" id="hud-enemy-hp-txt">HP: 15/15</span>
          </div>
        </div>
      </div>

      <!-- Right: Real-time scrolling medieval logs -->
      <div class="combat-scroll-box parchment-card">
        <h4 class="card-title">📖 Active Combat logs</h4>
        <div class="log-viewport scroll-container" id="log-viewport-box"></div>
      </div>

    </div>
  `;

  // CSS moved to styles.css

  // Elements
  const logBox = container.querySelector('#log-viewport-box');
  const timerCount = container.querySelector('#timer-countdown');
  const ringFill = container.querySelector('#ring-fill');
  const btnAbandon = container.querySelector('#btn-focus-abandon');
  const battleHud = container.querySelector('#battle-hud');

  // Load starting logs
  renderLogs(state.expedition.logs, logBox);

  // Set initial countdown ring offset
  setRadialProgress(1);

  // Bind Retreat abandon button
  btnAbandon.addEventListener('click', () => {
    let modal = container.querySelector('#retreat-modal-overlay');
    const isIndefinite = targetTime === Infinity;
    
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'retreat-modal-overlay';
      modal.className = 'modal-overlay hidden';
      modal.style.cssText = 'position: fixed; z-index: 200; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px);';
      
      const titleText = isIndefinite ? "Conclude Expedition?" : "Retreat?";
      const descText = isIndefinite ? 
        "Are you ready to safely conclude your indefinite journey? You will keep 100% of the spoils you have collected so far." :
        "Are you sure you want to retreat to safety? You will drop most unbanked materials and suffer a momentum penalty.";
      const btnColor = isIndefinite ? "var(--emerald-green)" : "var(--ruby-crimson)";
      const btnText = isIndefinite ? "Conclude Safely" : "Retreat";

      modal.innerHTML = `
        <div class="parchment-card" style="width: 320px; padding: 24px; text-align: center;">
          <h2 style="color: ${btnColor}; margin-top: 0; font-family: var(--font-header);">${titleText}</h2>
          <p style="margin-bottom: 24px; font-size: 0.9rem; color: var(--ink-base);">${descText}</p>
          <div style="display: flex; gap: 12px;">
            <button id="btn-retreat-cancel" class="btn-secondary" style="flex: 1;">Cancel</button>
            <button id="btn-retreat-confirm" class="btn-primary" style="flex: 1; background: ${btnColor};">${btnText}</button>
          </div>
        </div>
      `;
      container.appendChild(modal);
      
      modal.querySelector('#btn-retreat-cancel').addEventListener('click', () => {
        modal.classList.add('hidden');
      });
      
      modal.querySelector('#btn-retreat-confirm').addEventListener('click', () => {
        modal.classList.add('hidden');
        cleanupTimers();
        if (isIndefinite) {
          import('../state.js').then(mod => {
            mod.completeExpedition();
            renderExpeditionReport(container, dungeon, true);
          });
        } else {
          import('../state.js').then(mod => {
            mod.terminateExpeditionGracefully("Retreated from dungeon.");
            mod.notify(); // Wait, let's just use import logic without duplicate switchScreen
            import('../app.js').then(appMod => appMod.switchScreen('quests'));
          });
        }
      });
    }
    modal.classList.remove('hidden');
  });

  // Start active clocks
  startVisualTimers(container, dungeon, logBox, derived);
  setupVisibilityDetector();
}

function renderDungeonsSelectorList(steps, level) {
  return DUNGEONS.map(dungeon => {
    const isStepUnlocked = steps >= dungeon.stepRequirement;
    const isLevelUnlocked = level >= dungeon.levelRequirement;
    const isUnlocked = isStepUnlocked && isLevelUnlocked;

    if (!isUnlocked) {
      return `
        <div class="dungeon-select-row locked" style="opacity: 0.65; border: 1px dashed rgba(44,37,30,0.3); padding: 8px 10px; border-radius: 8px; background-color: rgba(0,0,0,0.02); text-align: left;">
          <strong style="font-size: 0.72rem; color: var(--ruby-crimson);">🔒 Locked: ${dungeon.name}</strong>
          <div style="font-size: 0.58rem; color: var(--ink-muted); margin-top: 2px;">
            👣 Steps: ${steps.toLocaleString()} / ${dungeon.stepRequirement.toLocaleString()} | 🛡️ Lvl: ${level}/${dungeon.levelRequirement}
          </div>
        </div>
      `;
    }

    return `
      <div class="dungeon-select-row unlocked" data-id="${dungeon.id}" style="border: 1px solid ${dungeon.color}; padding: 8px 10px; border-radius: 8px; cursor: pointer; background-color: rgba(0,0,0,0.01); text-align: left; transition: transform 0.1s ease;">
        <div style="font-family: var(--font-header); font-size: 0.76rem; font-weight: 700; color: ${dungeon.color};">${dungeon.icon} ${dungeon.name}</div>
        <div style="font-size: 0.65rem; color: var(--ink-muted); margin-top: 1px; line-height: 1.25;">${dungeon.description}</div>
        <div style="font-size: 0.58rem; color: var(--emerald-green); font-weight: 700; margin-top: 4px;">Rec. Lvl: ${dungeon.levelRequirement} | XP: ${dungeon.baseXPMultiplier.toFixed(2)}x, Gold: ${dungeon.baseGoldMultiplier.toFixed(2)}x</div>
      </div>
    `;
  }).join('');
}

function setupSetupViewListeners(container, selectedDungeonId) {
  const modal = container.querySelector('#destination-selector-overlay');
  const btnOpen = container.querySelector('#btn-switch-destination');
  const btnClose = container.querySelector('#btn-close-destination');
  const timerCount = container.querySelector('#timer-countdown');
  const ringFill = container.querySelector('#ring-fill');
  const btnStart = container.querySelector('#btn-focus-start');
  const presets = container.querySelector('#timer-presets');

  let selectedSeconds = 600;
  isIndefiniteMode = false;

  btnOpen.addEventListener('click', () => modal.classList.remove('hidden'));
  btnClose.addEventListener('click', () => modal.classList.add('hidden'));

  // Switch destination selections
  container.querySelectorAll('.dungeon-select-row.unlocked').forEach(row => {
    row.addEventListener('click', () => {
      const dungeonId = row.getAttribute('data-id');
      import('../state.js').then(mod => {
        const state = mod.getState();
        state.expedition.selectedDungeonId = dungeonId;
        mod.saveState();
        modal.classList.add('hidden');
        renderExpedition(container);
      });
    });
  });

  // Presets listeners
  presets.querySelectorAll('.btn-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      presets.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
      const customToggle = container.querySelector('#btn-timer-custom-toggle');
      if (customToggle) customToggle.classList.remove('active');
      btn.classList.add('active');
      
      container.querySelector('#custom-time-input-box').classList.add('hidden');
      selectedSeconds = parseInt(btn.getAttribute('data-sec'));
      
      if (selectedSeconds === -1) {
        isIndefiniteMode = true;
        timerCount.textContent = "00:00";
        container.querySelector('#timer-goal-label').textContent = "Indefinite Focus";
      } else {
        isIndefiniteMode = false;
        const m = Math.floor(selectedSeconds / 60);
        const s = selectedSeconds % 60;
        timerCount.textContent = `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
        container.querySelector('#timer-goal-label').textContent = `${m > 0 ? m + ' Mins' : selectedSeconds + 's'} Goal`;
      }
    });
  });

  // Custom Toggle handlers
  const btnCustomToggle = container.querySelector('#btn-timer-custom-toggle');
  const customInputBox = container.querySelector('#custom-time-input-box');
  const customInput = container.querySelector('#custom-minutes-input');
  const btnCustomSet = container.querySelector('#btn-timer-custom-set');

  btnCustomToggle.addEventListener('click', () => {
    presets.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
    btnCustomToggle.classList.add('active');
    customInputBox.classList.remove('hidden');
    
    isIndefiniteMode = false;
    const mins = parseInt(customInput.value) || 15;
    selectedSeconds = mins * 60;
    timerCount.textContent = `${mins.toString().padStart(2,'0')}:00`;
    container.querySelector('#timer-goal-label').textContent = `${mins} Mins Goal`;
  });

  btnCustomSet.addEventListener('click', () => {
    const mins = parseInt(customInput.value) || 15;
    selectedSeconds = mins * 60;
    isIndefiniteMode = false;
    timerCount.textContent = `${mins.toString().padStart(2,'0')}:00`;
    container.querySelector('#timer-goal-label').textContent = `${mins} Mins Goal`;
  });

  // Start Focus Session
  btnStart.addEventListener('click', () => {
    import('../state.js').then(mod => {
      // Start state expedition
      mod.startExpedition(selectedDungeonId);
      
      if (isIndefiniteMode) {
        targetTime = Infinity;
        timeRemaining = 0;
      } else {
        targetTime = selectedSeconds * 1000;
        timeRemaining = targetTime;
      }
      timeElapsed = 0;
      lastVisibilityChange = Date.now();
      
      // Re-render view to the active combat layout
      renderExpedition(container);
    });
  });
}

function startVisualTimers(container, dungeon, logBox, derived) {
  const timerCount = container.querySelector('#timer-countdown');
  const ringFill = container.querySelector('#ring-fill');
  
  const isDemo = targetTime === 10000;
  const tickDuration = 1000;
  const combatIntervalSec = 45; // Standard encounter rate

  appendLog(`🔥 Focus ignited! You prepare to cross the thresholds...`, logBox);

  // Anchor to absolute system time to survive sleep/backgrounding
  const startedAt = getState().expedition.startedAt || Date.now();
  let lastWeaponXpElapsed = 0;
  let lastSavePointElapsed = 0;

  function updateTimerUI() {
    const activeExp = getState().expedition;
    if (!activeExp.active) return;
    
    timeElapsed = Date.now() - startedAt;

    // Award weapon XP every 5 seconds reliably based on absolute elapsed time
    if (timeElapsed - lastWeaponXpElapsed >= 5000) {
      const numAwards = Math.floor((timeElapsed - lastWeaponXpElapsed) / 5000);
      lastWeaponXpElapsed += numAwards * 5000;
      
      const activeWeaponKey = getState().progression.equippedWeapon || "blade";
      if (activeWeaponKey) {
        import('../state.js').then(mod => {
          const res = mod.incrementWeaponMasteryXP(activeWeaponKey, 5 * numAwards);
          if (res && res.leveledUp) {
            appendLog(`🎉 Weapon Mastery Leveled Up! Your ${activeWeaponKey.toUpperCase()} mastery is now Rank ${res.newRank}!`, logBox);
          }
        });
      }
    }

    if (isIndefiniteMode) {
      // Create a save point every 5 minutes (300,000 ms)
      if (timeElapsed - lastSavePointElapsed >= 300000) {
        const numSaves = Math.floor((timeElapsed - lastSavePointElapsed) / 300000);
        lastSavePointElapsed += numSaves * 300000;
        
        import('../state.js').then(mod => {
          mod.bankExpeditionSpoils();
          appendLog(`💾 <strong>Save Point Reached!</strong> All spoils collected so far are 100% secured in your ledger.`, logBox);
        });
      }

      // stopwatch counts up
      const elapsedSec = Math.floor(timeElapsed / 1000);
      const m = Math.floor(elapsedSec / 60);
      const s = elapsedSec % 60;
      timerCount.textContent = `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
      
      const pulsePct = 1 - ((timeElapsed % 4000) / 4000);
      setRadialProgress(pulsePct, ringFill);
      
      const stageIdx = Math.min(3, Math.floor(timeElapsed / (30 * 1000)));
      updateActiveExpedition((exp) => {
        exp.stageIndex = stageIdx;
      });
      updateStageDots(container, stageIdx);
      
      const minThreshold = 900000; // 15 minutes to summon boss in indefinite mode
      if (timeElapsed >= minThreshold) {
        const btnSummon = container.querySelector('#btn-summon-boss');
        if (btnSummon && btnSummon.disabled) {
          btnSummon.disabled = false;
          btnSummon.classList.remove('hidden');
          btnSummon.textContent = "👑 Summon Boss!";
        }
      }
      
    } else {
      timeRemaining = Math.max(0, targetTime - timeElapsed);

      const remSec = Math.floor(timeRemaining / 1000);
      const m = Math.floor(remSec / 60);
      const s = remSec % 60;
      timerCount.textContent = `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
      
      const pct = timeRemaining / targetTime;
      setRadialProgress(pct, ringFill);

      const stageIdx = Math.min(3, Math.floor((timeElapsed / targetTime) * 4));
      updateActiveExpedition((exp) => {
        exp.stageIndex = stageIdx;
      });
      updateStageDots(container, stageIdx);

      if (timeRemaining <= 0) {
        cleanupTimers();
        appendLog(`🏆 Time goal reached! The Boss Chamber opens!`, logBox);
        triggerCombatEncounter(container, dungeon, true, logBox, derived);
      }
    }
  }

  // Export for visibility handler to force immediate updates
  window._updateExpeditionTimerUI = updateTimerUI;
  
  // Initial draw and loop
  updateTimerUI();
  timerInterval = setInterval(updateTimerUI, tickDuration);

  // Periodic Combat Roll scheduler
  encounterInterval = setInterval(() => {
    if ((isIndefiniteMode || timeRemaining > 0) && (!currentMonster || currentMonster.hp <= 0)) {
      triggerCombatEncounter(container, dungeon, false, logBox, derived);
    }
  }, combatIntervalSec * 1000);
}

function triggerCombatEncounter(container, dungeon, isBoss, logBox, derived) {
  const monsterData = isBoss ? dungeon.boss : dungeon.monsters[Math.floor(Math.random() * dungeon.monsters.length)];
  currentMonster = { ...monsterData, currentDistance: 5, maxHp: monsterData.hp }; // Start at distance of 5 steps!

  appendLog(`⚠️ ${isBoss ? '👑 BOSS ENCOUNTER:' : '👾 ENEMY DETECTED:'} A wild ${currentMonster.name} jumps from the shadows! (Distance: 5m)`, logBox);

  // Weapon range summary log
  const activeWeaponKey = getState().progression.equippedWeapon || "blade";
  const preset = WEAPON_PRESETS[activeWeaponKey] || WEAPON_PRESETS.blade;
  appendLog(`🛡️ Equipped Weapon Range: ${preset.range}m (${preset.name}).`, logBox);
  
  updateBattleHUD(container, currentMonster, derived);

  // Set up battle strike tick loops
  const battleTick = setInterval(() => {
    if (!getState().expedition.active) {
      clearInterval(battleTick);
      return;
    }

    const playerRange = preset.range;

    // Inject equipped weapon name temporarily for calculations
    derived.equippedMainHandName = preset.name;
    const tick = rollCombatTick(derived, currentMonster, playerRange, getState().progression);

    // Print step advance movements
    if (tick.logDetails && tick.logDetails.length > 0) {
      tick.logDetails.forEach(line => appendLog(line, logBox));
    }

    if (tick.playerHit === "crit") {
      appendLog(`✨🗡️ <strong>CRITICAL STRIKE!</strong> You strike ${currentMonster.name} dealing ${tick.playerDmg} damage!`, logBox);
    } else if (tick.playerHit) {
      appendLog(`🗡️ You strike ${currentMonster.name} dealing ${tick.playerDmg} dmg!`, logBox);
    } else if (currentMonster.currentDistance <= playerRange && !tick.playerHit) {
      appendLog(`💨 You swing but the ${currentMonster.name} dodges!`, logBox);
    }

    if (tick.enemyHit) {
      appendLog(`💥 The ${currentMonster.name} counter-attacks, dealing ${tick.enemyDmg} damage to your health!`, logBox);
    }

    updateBattleHUD(container, currentMonster, derived);

    // Check Death outcomes
    if (currentMonster.hp <= 0) {
      clearInterval(battleTick);
      const goldGained = Math.floor(currentMonster.xp * 0.4 * dungeon.baseGoldMultiplier);
      const xpGained = Math.floor(currentMonster.xp * dungeon.baseXPMultiplier);

      appendLog(`💀 Defeated the ${currentMonster.name}! You earn +${goldGained} Gold and +${xpGained} Combat XP!`, logBox);
      
      // Log defeated monster to the Monster Codex
      import('../state.js').then(mod => {
        mod.incrementCodexKill(currentMonster.name);
      });
      
      updateActiveExpedition(exp => {
        exp.rewardsGained.gold += goldGained;
        exp.rewardsGained.xp += xpGained;
        exp.logs.push(`💀 Defeated ${currentMonster.name}`);
      });

      // Material loot drop check
      if (isBoss || Math.random() > 0.5) {
        const roll = Math.random();
        let matName = "Essence";
        let matAmt = Math.floor(Math.random() * 5) + 3; // 3-7
        let matField = "essence";
        let emoji = "✨";

        if (isBoss) {
          matName = "Relic Shard";
          matAmt = Math.floor(Math.random() * 2) + 1; // 1-2
          matField = "relicShards";
          emoji = "🧩";
        } else if (roll > 0.85) {
          matName = "Relic Shard";
          matAmt = 1;
          matField = "relicShards";
          emoji = "🧩";
        } else if (roll > 0.50) {
          matName = "Core Fragment";
          matAmt = Math.floor(Math.random() * 2) + 1; // 1-2
          matField = "coreFragments";
          emoji = "⚙️";
        }

        appendLog(`${emoji} loot discovered! Obtained: <strong>+${matAmt} ${matName}</strong>!`, logBox);
        updateActiveExpedition(exp => {
          exp.rewardsGained[matField] = (exp.rewardsGained[matField] || 0) + matAmt;
        });
      }

      if (isBoss) {
        appendLog(`🎉 VICTORY! Dungeon cleared successfully. compiling report...`, logBox);
        setTimeout(() => {
          cleanupTimers();
          renderExpeditionReport(container, dungeon, true);
        }, 2500);
      }
      
    } else if (derived.currentHP <= 0) {
      clearInterval(battleTick);
      cleanupTimers();
      appendLog(`💔 Hero incapacitated! You are dragged back to safety by local trackers. Gold earned slashed!`, logBox);
      
      setTimeout(() => {
        renderExpeditionReport(container, dungeon, false);
      }, 2500);
    }

  }, 1200);
}

function updateBattleHUD(container, monster, derived) {
  const heroHP = container.querySelector('#hud-hero-hp');
  const enemyHP = container.querySelector('#hud-enemy-hp');
  const heroHPTxt = container.querySelector('#hud-hero-hp-txt');
  const enemyHPTxt = container.querySelector('#hud-enemy-hp-txt');

  if (heroHP && derived) {
    const heroPct = Math.max(0, Math.floor((derived.currentHP / derived.combatStats.maxHP) * 100));
    heroHP.style.width = `${heroPct}%`;
    heroHPTxt.textContent = `HP: ${derived.currentHP}/${derived.combatStats.maxHP}`;
  }

  if (enemyHP && monster) {
    container.querySelector('#hud-enemy-name').textContent = monster.name;
    const maxHp = monster.maxHp || monster.hp;
    const monsterPct = Math.max(0, Math.floor((monster.hp / maxHp) * 100));
    enemyHP.style.width = `${monsterPct}%`;
    enemyHPTxt.textContent = `HP: ${monster.hp}/${maxHp}`;
  }
}

function setupVisibilityDetector() {
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  document.addEventListener('visibilitychange', handleVisibilityChange);
}

function handleVisibilityChange() {
  const state = getState();
  if (!state.expedition.active) return;

  if (!document.hidden && window._updateExpeditionTimerUI) {
    // When the screen wakes up or tab is focused, immediately sync the timer 
    // rather than waiting for the next setInterval tick.
    window._updateExpeditionTimerUI();
  }
}

function cleanupTimers() {
  if (timerInterval) clearInterval(timerInterval);
  if (encounterInterval) clearInterval(encounterInterval);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
}

function renderLogs(logs, box) {
  box.innerHTML = logs.map(l => `<div class="log-line">${l}</div>`).join('');
  box.scrollTop = box.scrollHeight;
}

function appendLog(text, box) {
  const line = document.createElement('div');
  line.className = 'log-line';
  line.innerHTML = text;
  box.appendChild(line);
  box.scrollTop = box.scrollHeight;

  updateActiveExpedition(exp => {
    exp.logs.push(text);
  });
}

function setRadialProgress(pct, fillEl) {
  const el = fillEl || document.getElementById('ring-fill');
  if (!el) return;
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset = circumference - (pct * circumference);
  
  el.style.strokeDasharray = `${circumference} ${circumference}`;
  el.style.strokeDashoffset = strokeOffset;
}

function updateStageDots(container, index) {
  container.querySelectorAll('.stage-dot').forEach((dot, idx) => {
    if (idx <= index) {
      dot.classList.add('active');
    } else {
      dot.classList.remove('active');
    }
  });
}

function renderExpeditionReport(container, dungeon, success) {
  const state = getState();
  const kills = getDefeatedEnemiesList(state.expedition.logs);
  
  const banked = state.expedition.bankedRewards || { gold: 0, xp: 0, essence: 0, coreFragments: 0, relicShards: 0 };
  const unbanked = state.expedition.rewardsGained || { gold: 0, xp: 0, essence: 0, coreFragments: 0, relicShards: 0 };

  const goldVal = success ? (unbanked.gold + banked.gold) : Math.floor(unbanked.gold * 0.35) + banked.gold;
  const xpVal = success ? (unbanked.xp + banked.xp) : Math.floor(unbanked.xp * 0.15) + banked.xp;
  const essenceVal = success ? (unbanked.essence || 0) + banked.essence : Math.floor((unbanked.essence || 0) * 0.35) + banked.essence;
  const coreVal = success ? (unbanked.coreFragments || 0) + banked.coreFragments : Math.floor((unbanked.coreFragments || 0) * 0.35) + banked.coreFragments;
  const relicVal = success ? (unbanked.relicShards || 0) + banked.relicShards : Math.floor((unbanked.relicShards || 0) * 0.35) + banked.relicShards;

  container.innerHTML = `
    <div class="report-card-overlay parchment-theme">
      <div class="parchment-card report-card">
        <h2 class="card-title" style="color: ${success ? 'var(--emerald-green)' : 'var(--ruby-crimson)'}; font-family: var(--font-header);">
          ${success ? '🏆 Expedition Concluded!' : '💔 Dungeon Retreat...'}
        </h2>
        
        <div class="report-scroll">
          <div class="report-meta">
            <strong>Realm Visited:</strong> ${dungeon.icon} ${dungeon.name} <br>
            <strong>Outcome:</strong> ${success ? 'Dungeon Cleared / Safely Concluded' : 'Incapacitated (Rescued)'}
          </div>
          
          <div class="report-section">
            <h4>👾 Defeated Enemies</h4>
            <div class="report-kills-list">
              ${kills.map(k => `<div>${k}</div>`).join('')}
            </div>
          </div>

          <div class="report-section">
            <h4>🪙 Spoils of Adventure</h4>
            <div class="spoils-grid" style="grid-template-columns: repeat(2, 1fr);">
              <div class="spoil-item">✨ <strong>+${xpVal}</strong> Combat XP</div>
              <div class="spoil-item">🪙 <strong>+${goldVal}</strong> Gold Coins</div>
            </div>
          </div>

          <div class="report-section">
            <h4>✨ Upgrade Materials Recovered</h4>
            <div class="spoils-grid" style="grid-template-columns: repeat(3, 1fr); gap: 6px;">
              <div class="spoil-item" style="font-size: 0.65rem;">✨ <strong>+${essenceVal}</strong> Essence</div>
              <div class="spoil-item" style="font-size: 0.65rem;">⚙️ <strong>+${coreVal}</strong> Fragments</div>
              <div class="spoil-item" style="font-size: 0.65rem;">🧩 <strong>+${relicVal}</strong> Shards</div>
            </div>
          </div>
        </div>

        <button class="btn-primary full-width-btn" id="btn-claim-report">Seal Report & Continue</button>
      </div>
    </div>
  `;

  const btnClaim = container.querySelector('#btn-claim-report');
  btnClaim.addEventListener('click', () => {
    if (success) {
      completeExpedition();
      import('../app.js').then(mod => mod.switchScreen('character'));
    } else {
      terminateExpeditionGracefully("Died in dungeon.");
      import('../app.js').then(mod => mod.switchScreen('quests'));
    }
  });
}

function getDefeatedEnemiesList(logs) {
  const counts = {};
  logs.forEach(line => {
    if (line.includes("💀 Defeated the ") || line.includes("💀 Defeated ")) {
      const parts = line.split("💀 Defeated the ");
      const name = parts[1] ? parts[1].split("!")[0] : line.split("💀 Defeated ")[1].split("!")[0];
      const cleanName = name.trim();
      counts[cleanName] = (counts[cleanName] || 0) + 1;
    }
  });
  
  const list = Object.entries(counts).map(([name, qty]) => `💀 ${qty}x ${name}`);
  if (list.length === 0) list.push("💀 No monsters encountered");
  return list;
}

