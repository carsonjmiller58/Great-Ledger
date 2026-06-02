/* ==========================================================================
   Active Focus Expedition and Combat View - The Great Ledger
   ========================================================================== */

import { getState, getDerivedStats, updateActiveExpedition, completeExpedition, terminateExpeditionGracefully } from '../state.js';
import { rollCombatTick, generateProceduralLoot, DUNGEONS, getWeaponMasteryKey } from '../formulas.js';

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

  // Reset active variables for fresh view
  cleanupTimers();
  currentMonster = null;
  lastVisibilityChange = 0;

  if (!state.expedition.active) {
    // If somehow landed here without an active expedition, fallback
    container.innerHTML = `<div class="empty-quest-msg">No active expedition. Go to Journey map first!</div>`;
    return;
  }

  const dungeon = DUNGEONS.find(d => d.id === state.expedition.dungeonId) || DUNGEONS[0];

  // Screen Scaffolding
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
            <span id="timer-goal-label">Set Focus Goal</span>
          </div>
        </div>

        <!-- Timer Duration Selectors -->
        <div class="duration-selectors" id="timer-presets">
          <button class="btn-secondary btn-preset active" data-sec="10">⏱️ Demo (10s)</button>
          <button class="btn-secondary btn-preset" data-sec="600">⏱️ 10 Mins</button>
          <button class="btn-secondary btn-preset" data-sec="1500">⏱️ 25 Mins</button>
          <button class="btn-secondary btn-preset" data-sec="3000">⏱️ 50 Mins</button>
          <button class="btn-secondary btn-preset" id="btn-timer-indefinite" data-sec="-1">♾️ Indefinite</button>
          <button class="btn-secondary" id="btn-timer-custom-toggle">⏱️ Custom</button>
        </div>

        <!-- Custom Focus Time Input Row -->
        <div id="custom-time-input-box" class="custom-time-box hidden">
          <label class="custom-label">Custom Focus Minutes:</label>
          <div class="custom-input-row">
            <input type="number" id="custom-minutes-input" min="1" max="180" value="15" />
            <button class="btn-secondary" id="btn-timer-custom-set">Set</button>
          </div>
        </div>

        <div class="timer-controls">
          <button class="btn-primary" id="btn-focus-start">🔥 Ignite Focus</button>
          <button class="btn-primary hidden" id="btn-summon-boss" disabled>👑 Summon Boss (Focus 5s)</button>
          <button class="btn-secondary btn-flee" id="btn-focus-abandon">🏳️ Retreat</button>
        </div>
      </div>

      <!-- Middle: Combat Stats & Battle HUD -->
      <div id="battle-hud" class="parchment-card battle-hud hidden">
        <div class="hud-halves">
          <div class="hud-hero">
            <span class="hud-avatar">⚔️ Hero</span>
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
        <h4 class="card-title">📖 Adventure Chronicle</h4>
        <div class="log-viewport scroll-container" id="log-viewport-box"></div>
      </div>

    </div>
  `;

  injectExpeditionCSS();

  // Elements
  const logBox = container.querySelector('#log-viewport-box');
  const timerCount = container.querySelector('#timer-countdown');
  const ringFill = container.querySelector('#ring-fill');
  const btnStart = container.querySelector('#btn-focus-start');
  const btnAbandon = container.querySelector('#btn-focus-abandon');
  const presets = container.querySelector('#timer-presets');
  const battleHud = container.querySelector('#battle-hud');

  // Load starting logs
  renderLogs(state.expedition.logs, logBox);

  // Set default countdown target to 10s (Demo)
  let selectedSeconds = 10;
  isIndefiniteMode = false; // Reset to false
  timerCount.textContent = "00:10";
  setRadialProgress(1);

  // Presets listeners
  presets.querySelectorAll('.btn-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      presets.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
      const customToggle = container.querySelector('#btn-timer-custom-toggle');
      if (customToggle) customToggle.classList.remove('active');
      btn.classList.add('active');
      
      // Hide custom input box
      container.querySelector('#custom-time-input-box').classList.add('hidden');
      
      selectedSeconds = parseInt(btn.getAttribute('data-sec'));
      
      if (selectedSeconds === -1) {
        // Indefinite Mode stopwatch counts up
        isIndefiniteMode = true;
        timerCount.textContent = "00:00";
        container.querySelector('#timer-goal-label').textContent = "Indefinite Focus";
        setRadialProgress(1);
      } else {
        isIndefiniteMode = false;
        const m = Math.floor(selectedSeconds / 60);
        const s = selectedSeconds % 60;
        timerCount.textContent = `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
        container.querySelector('#timer-goal-label').textContent = `${m > 0 ? m + ' Mins' : selectedSeconds + 's'} Goal`;
        setRadialProgress(1);
      }
    });
  });

  // Custom Time handlers
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
    setRadialProgress(1);
  });

  btnCustomSet.addEventListener('click', () => {
    const mins = parseInt(customInput.value) || 15;
    selectedSeconds = mins * 60;
    isIndefiniteMode = false;
    timerCount.textContent = `${mins.toString().padStart(2,'0')}:00`;
    container.querySelector('#timer-goal-label').textContent = `${mins} Mins Goal`;
    setRadialProgress(1);
  });

  // ignite focus
  btnStart.addEventListener('click', () => {
    // Hide presets, show combat hud
    presets.classList.add('hidden');
    customInputBox.classList.add('hidden');
    btnStart.classList.add('hidden');
    
    if (isIndefiniteMode) {
      const btnSummon = container.querySelector('#btn-summon-boss');
      if (btnSummon) {
        btnSummon.classList.remove('hidden');
        btnSummon.disabled = true;
        btnSummon.textContent = "👑 Summon Boss (Focus 5s)";
      }
    }
    
    battleHud.classList.remove('hidden');
    container.querySelector('#timer-goal-label').textContent = isIndefiniteMode ? "INDEFINITE EXPEDITION UNDERWAY" : "EXPEDITION UNDERWAY";

    // Initialize countdown timers
    if (isIndefiniteMode) {
      targetTime = Infinity;
      timeRemaining = 0;
    } else {
      targetTime = selectedSeconds * 1000;
      timeRemaining = targetTime;
    }
    timeElapsed = 0;
    lastVisibilityChange = Date.now(); // Start visibility tracker on ignite

    startVisualTimers(container, dungeon, logBox, derived);
  });

  // Summon Boss listener
  const btnSummon = container.querySelector('#btn-summon-boss');
  btnSummon.addEventListener('click', () => {
    btnSummon.classList.add('hidden');
    appendLog(`👑 Boss Summoned! The dread boss chamber opens...`, logBox);
    cleanupTimers();
    triggerCombatEncounter(container, dungeon, true, logBox, derived);
  });

  // Retreat abandonment listener
  btnAbandon.addEventListener('click', () => {
    const confirmRetreat = confirm("Are you sure you want to retreat to safety? You will drop all loot chests found and suffer a momentum penalty!");
    if (confirmRetreat) {
      cleanupTimers();
      terminateExpeditionGracefully("Retreated from dungeon.");
      import('../app.js').then(mod => mod.switchScreen('quests'));
    }
  });

  // Anti-Distraction Screen Visibility Observers
  setupVisibilityDetector();
}

function startVisualTimers(container, dungeon, logBox, derived) {
  const timerCount = container.querySelector('#timer-countdown');
  const ringFill = container.querySelector('#ring-fill');
  const steps = targetTime / 1000;
  
  // Fast frequency ticks for demo vs slow frequency for Mins
  const isDemo = steps === 10;
  const tickDuration = 1000;
  const combatIntervalSec = isDemo ? 2 : 45; // Combat rolls occur fast in demo!

  appendLog(`🔥 Focus ignited! You prepare to cross the thresholds...`, logBox);

  timerInterval = setInterval(() => {
    // Award weapon XP every 5 seconds (5 XP)
    if (timeElapsed > 0 && timeElapsed % 5000 === 0) {
      const mainHand = getState().inventory.equipped.mainHand;
      if (mainHand) {
        const wKey = getWeaponMasteryKey(mainHand.name);
        if (wKey) {
          import('../state.js').then(mod => {
            const res = mod.incrementWeaponMasteryXP(wKey, 5);
            if (res && res.leveledUp) {
              appendLog(`🎉 Weapon Mastery Leveled Up! Your ${wKey.toUpperCase()} mastery is now Rank ${res.newRank}!`, logBox);
            }
          });
        }
      }
    }

    if (isIndefiniteMode) {
      timeElapsed += tickDuration;
      
      // 1. Update Stopwatch displays
      const elapsedSec = Math.floor(timeElapsed / 1000);
      const m = Math.floor(elapsedSec / 60);
      const s = elapsedSec % 60;
      timerCount.textContent = `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
      
      // 2. Pulse radial progress ring
      const pulsePct = 1 - ((timeElapsed % 4000) / 4000);
      setRadialProgress(pulsePct, ringFill);
      
      // 3. Stage Indication (Unlock progressive tags every 30s)
      const stageIdx = Math.min(3, Math.floor(timeElapsed / (30 * 1000)));
      updateActiveExpedition((exp) => {
        exp.stageIndex = stageIdx;
      });
      updateStageDots(container, stageIdx);
      
      // 4. Enable Summon Boss button after 5s
      const minThreshold = 5000;
      if (timeElapsed >= minThreshold) {
        const btnSummon = container.querySelector('#btn-summon-boss');
        if (btnSummon && btnSummon.disabled) {
          btnSummon.disabled = false;
          btnSummon.textContent = "👑 Summon Boss!";
        }
      }
      
    } else {
      timeRemaining = Math.max(0, timeRemaining - tickDuration);
      timeElapsed += tickDuration;

      // 1. Update Clock Displays
      const remSec = Math.floor(timeRemaining / 1000);
      const m = Math.floor(remSec / 60);
      const s = remSec % 60;
      timerCount.textContent = `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
      
      // 2. Adjust Radial Circular Ring
      const pct = timeRemaining / targetTime;
      setRadialProgress(pct, ringFill);

      // 3. Resolve Dynamic Stage Indicators
      const stageIdx = Math.min(3, Math.floor((timeElapsed / targetTime) * 4));
      updateActiveExpedition((exp) => {
        exp.stageIndex = stageIdx;
      });
      updateStageDots(container, stageIdx);

      // 4. Check Focus Goal Completion
      if (timeRemaining <= 0) {
        cleanupTimers();
        
        // Boss Battle trigger!
        appendLog(`🏆 Time goal reached! The Boss Chamber opens!`, logBox);
        triggerCombatEncounter(container, dungeon, true, logBox, derived);
      }
    }
  }, tickDuration);

  // Periodic Combat Roll scheduler
  encounterInterval = setInterval(() => {
    if ((isIndefiniteMode || timeRemaining > 0) && (!currentMonster || currentMonster.hp <= 0)) {
      triggerCombatEncounter(container, dungeon, false, logBox, derived);
    }
  }, combatIntervalSec * 1000);
}

function triggerCombatEncounter(container, dungeon, isBoss, logBox, derived) {
  // Pull monster configs
  const monsterData = isBoss ? dungeon.boss : dungeon.monsters[Math.floor(Math.random() * dungeon.monsters.length)];
  currentMonster = { ...monsterData, currentDistance: 5 }; // Start at distance of 5 steps!

  appendLog(`⚠️ ${isBoss ? '👑 BOSS ENCOUNTER:' : '👾 ENEMY DETECTED:'} A wild ${currentMonster.name} jumps from the shadows! (Distance: 5m)`, logBox);

  // Weapon range summary log
  const mainHand = getState().inventory.equipped.mainHand;
  let rangeLabel = "1m (Melee)";
  if (mainHand) {
    const wName = mainHand.name.toLowerCase();
    if (wName.includes("bow") || wName.includes("staff") || wName.includes("wand")) {
      rangeLabel = "5m (Ranged)";
    } else if (wName.includes("halberd")) {
      rangeLabel = "2m (Polearm Reach Melee)";
    }
  }
  appendLog(`🛡️ Equipped Weapon Range: ${rangeLabel}.`, logBox);
  
  updateBattleHUD(container, currentMonster, derived);

  // Set up battle strike tick loops
  const battleTick = setInterval(() => {
    if (!getState().expedition.active) {
      clearInterval(battleTick);
      return;
    }

    // Determine active range based on equipped weapons
    const mainHand = getState().inventory.equipped.mainHand;
    let playerRange = 1; // Melee default
    if (mainHand) {
      const wName = mainHand.name.toLowerCase();
      if (wName.includes("bow") || wName.includes("staff") || wName.includes("wand")) {
        playerRange = 5;
      } else if (wName.includes("halberd")) {
        playerRange = 2; // Polearm melee reach
      }
    }

    // Inject equipped mainHand weapon name temporarily for calculations
    derived.equippedMainHandName = mainHand ? mainHand.name : "";
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

      // Rarity loot drop check
      if (isBoss || Math.random() > 0.6) {
        const item = generateProceduralLoot(dungeon.id);
        appendLog(`🎁 TREASURE CHEST OPENED! Obtained: <strong style="color:${item.rarityColor}">${item.name}</strong>!`, logBox);
        updateActiveExpedition(exp => {
          exp.rewardsGained.items.push(item);
        });
      }

      if (isBoss) {
        // Slain boss completes the focus session victoriously
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
    const enemyPct = Math.max(0, Math.floor((monster.hp / monster.hp) * 100)); // wait: need base HP
    const baseHP = monster.name === 'Elder Druid Shade' ? 60 : monster.name === 'Gemstone Colossus' ? 90 : 25; // fallback
    const monsterBaseHp = monster.hp > baseHP ? monster.hp : baseHP;
    const monsterPct = Math.max(0, Math.floor((monster.hp / monsterBaseHp) * 100));
    enemyHP.style.width = `${monsterPct}%`;
    enemyHPTxt.textContent = `HP: ${monster.hp}/${monsterBaseHp}`;
  }
}

function setupVisibilityDetector() {
  // Always clean up first to prevent multiple duplicate active listeners
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  document.addEventListener('visibilitychange', handleVisibilityChange);
}

function handleVisibilityChange() {
  const state = getState();
  if (!state.expedition.active) return;
  if (lastVisibilityChange === 0) return; // Skip if timer hasn't ignited yet

  if (document.hidden) {
    // Left app! Record timestamp
    lastVisibilityChange = Date.now();
  } else {
    // Returned! Calculate drift
    const elapsedOffline = Date.now() - lastVisibilityChange;
    if (elapsedOffline > 15000) { // 15 seconds grace period
      cleanupTimers();
      alert("⚠️ Focus Interrupted! You left the app during active focus. Dungeon expedition aborted and momentum flame decayed!");
      terminateExpeditionGracefully("Interrupted due to distraction.");
      import('../app.js').then(mod => mod.switchScreen('quests'));
    } else {
      // Returned within grace period: reset tracker to prevent accumulation
      lastVisibilityChange = Date.now();
    }
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

  // Sync to state logs
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
  
  // Slashed yields for defeat, full values for win
  const goldVal = success ? state.expedition.rewardsGained.gold : Math.floor(state.expedition.rewardsGained.gold * 0.35);
  const xpVal = success ? state.expedition.rewardsGained.xp : Math.floor(state.expedition.rewardsGained.xp * 0.3);

  container.innerHTML = `
    <div class="report-card-overlay parchment-theme">
      <div class="parchment-card report-card">
        <h2 class="card-title" style="color: ${success ? 'var(--emerald-green)' : 'var(--ruby-crimson)'}; font-family: var(--font-header);">
          ${success ? '🏆 Expedition Cleared!' : '💔 Dungeon Retreat...'}
        </h2>
        
        <div class="report-scroll">
          <div class="report-meta">
            <strong>Realm Visited:</strong> ${dungeon.icon} ${dungeon.name} <br>
            <strong>Outcome:</strong> ${success ? 'Dungeon Cleared (100% Explored)' : 'Incapacitated (Rescued)'}
          </div>
          
          <div class="report-section">
            <h4>👾 Defeated Enemies</h4>
            <div class="report-kills-list">
              ${kills.map(k => `<div>${k}</div>`).join('')}
            </div>
          </div>

          <div class="report-section">
            <h4>🪙 Spoils of Adventure</h4>
            <div class="spoils-grid">
              <div class="spoil-item">✨ <strong>+${xpVal}</strong> Combat XP</div>
              <div class="spoil-item">🪙 <strong>+${goldVal}</strong> Gold Coins</div>
            </div>
          </div>

          <div class="report-section">
            <h4>🎁 Recovered Equipment</h4>
            <div class="report-loot-items">
              ${success && state.expedition.rewardsGained.items.length > 0 ? 
                state.expedition.rewardsGained.items.map(item => `
                  <div class="report-loot-card" style="border-color:${item.rarityColor}">
                    <div class="report-loot-icon">${item.icon}</div>
                    <div class="report-loot-details">
                      <span class="report-loot-name" style="color:${item.rarityColor}">${item.name.split('] ')[1]}</span>
                      <span class="report-loot-slot">${item.slot} (${item.rarity})</span>
                    </div>
                  </div>
                `).join('') : `<div class="empty-backpack-msg">${success ? 'No gear drops found' : 'Loot chests lost in retreat'}</div>`
              }
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

function injectExpeditionCSS() {
  if (document.getElementById('expedition-view-styles')) return;
  const style = document.createElement('style');
  style.id = 'expedition-view-styles';
  style.innerHTML = `
    .expedition-screen {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    
    /* Stage Progression Dots */
    .stage-tracker {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 10px;
    }
    .stage-dot {
      font-size: 0.6rem;
      font-weight: 700;
      color: var(--ink-muted);
      border: var(--border-hand-ink);
      background-color: var(--parchment-dark);
      padding: 2px 6px;
      border-radius: 4px;
      text-transform: uppercase;
      font-family: var(--font-header);
    }
    .stage-dot.active {
      background-color: var(--gold-primary);
      color: var(--parchment-light);
      box-shadow: 0 0 6px var(--gold-glow);
    }
    .stage-connector {
      flex-grow: 1;
      height: 2px;
      background-color: var(--ink-charcoal);
      margin: 0 4px;
    }

    /* Focus Timer box */
    .focus-timer-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 10px;
    }
    .dungeon-title-bar {
      font-family: var(--font-header);
      font-weight: 900;
      font-size: 0.85rem;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    .clock-display {
      width: 140px;
      height: 140px;
      position: relative;
      margin-bottom: 8px;
    }
    .radial-ring {
      width: 100%;
      height: 100%;
      transform: rotate(-90deg);
    }
    .ring-track {
      fill: none;
      stroke: rgba(0,0,0,0.06);
      stroke-width: 6;
    }
    .ring-fill {
      fill: none;
      stroke-width: 6;
      stroke-linecap: round;
      transition: stroke-dashoffset 1s linear;
    }
    .clock-labels {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
    }
    #timer-countdown {
      font-size: 1.6rem;
      font-weight: 700;
      font-family: var(--font-header);
      line-height: 1;
    }
    #timer-goal-label {
      font-size: 0.58rem;
      font-weight: 700;
      color: var(--ink-muted);
      text-transform: uppercase;
      margin-top: 2px;
    }
    .duration-selectors {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
      width: 100%;
      margin-bottom: 8px;
    }
    .custom-time-box {
      width: 100%;
      background-color: rgba(0,0,0,0.03);
      padding: 8px 12px;
      border-radius: 8px;
      border: 1px dashed rgba(44, 37, 30, 0.1);
      margin-bottom: 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .custom-label {
      font-family: var(--font-header);
      font-size: 0.6rem;
      font-weight: 700;
      color: var(--ink-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .custom-input-row {
      display: flex;
      gap: 8px;
    }
    .custom-input-row input {
      flex-grow: 1;
      font-family: var(--font-body);
      font-size: 0.85rem;
      padding: 4px 8px;
      border: var(--border-hand-ink);
      border-radius: 6px;
      background-color: var(--parchment-light);
      color: var(--ink-charcoal);
    }
    .custom-input-row button {
      padding: 2px 10px !important;
      font-size: 0.72rem !important;
    }
    .btn-preset {
      font-size: 0.72rem !important;
      padding: 4px 0 !important;
    }
    .btn-preset.active {
      background-color: var(--sapphire-blue);
      color: var(--parchment-light);
    }
    .timer-controls {
      display: flex;
      gap: 10px;
      width: 100%;
    }
    .timer-controls button {
      flex-grow: 1;
    }

    /* Battle Stats HUD */
    .battle-hud {
      padding: 8px 12px;
    }
    .hud-halves {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .versus-icon {
      font-family: var(--font-header);
      font-weight: 900;
      font-size: 0.9rem;
      color: var(--ruby-crimson);
      animation: pulse-flame 0.5s infinite alternate;
    }
    .hud-hero, .hud-enemy {
      width: 42%;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .hud-hero { align-items: flex-start; }
    .hud-enemy { align-items: flex-end; }
    .hud-avatar {
      font-family: var(--font-header);
      font-weight: 700;
      font-size: 0.7rem;
    }
    .hud-hp-bar {
      width: 100%;
      height: 6px;
      background-color: rgba(0,0,0,0.1);
      border: 1px solid var(--ink-charcoal);
      border-radius: 3px;
      overflow: hidden;
    }
    .hp-fill {
      height: 100%;
      transition: width 0.3s ease;
    }
    .fill-green { background-color: var(--emerald-light); }
    .fill-red { background-color: var(--ruby-light); }
    .hud-label {
      font-size: 0.65rem;
      font-weight: 700;
    }

    /* Combat Logs view */
    .combat-scroll-box {
      flex-grow: 1;
      display: flex;
      flex-direction: column;
      padding: 10px;
      min-height: 150px;
    }
    .log-viewport {
      flex-grow: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 4px;
      background-color: rgba(0, 0, 0, 0.02);
      border-radius: 6px;
      border: 1px solid rgba(44, 37, 30, 0.05);
    }
    .log-line {
      font-size: 0.72rem;
      line-height: 1.4;
      border-bottom: 1px dashed rgba(44, 37, 30, 0.06);
      padding-bottom: 4px;
    }
    .hidden {
      display: none !important;
    }

    /* Expedition Report Card CSS styles */
    .report-card-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: var(--parchment-bg);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 20px;
      z-index: 100;
      animation: zoom-in 0.3s ease-out;
    }
    .report-card {
      width: 100%;
      height: 100%;
      max-height: 100%;
      display: flex;
      flex-direction: column;
      padding: 18px;
    }
    .report-scroll {
      flex-grow: 1;
      width: 100%;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 4px 0;
      margin-bottom: 10px;
    }
    .report-meta {
      font-size: 0.8rem;
      line-height: 1.5;
      background-color: rgba(0,0,0,0.02);
      padding: 8px 12px;
      border-radius: 8px;
      border: 1px dashed rgba(44, 37, 30, 0.1);
    }
    .report-section {
      border-top: 1px dashed rgba(44, 37, 30, 0.15);
      padding-top: 10px;
      margin-top: 4px;
    }
    .report-section h4 {
      font-family: var(--font-header);
      font-size: 0.75rem;
      text-transform: uppercase;
      color: var(--ink-muted);
      margin-bottom: 6px;
      letter-spacing: 0.5px;
    }
    .report-kills-list {
      font-size: 0.8rem;
      line-height: 1.4;
      color: var(--ink-charcoal);
    }
    .spoils-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
    }
    .spoil-item {
      background-color: rgba(0,0,0,0.03);
      padding: 6px;
      border-radius: 6px;
      border: 1px dashed rgba(44, 37, 30, 0.1);
      font-size: 0.75rem;
      text-align: center;
    }
    .report-loot-items {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .report-loot-card {
      display: flex;
      align-items: center;
      gap: 10px;
      background-color: var(--parchment-light);
      border: var(--border-hand-ink);
      border-radius: 8px;
      padding: 6px 10px;
    }
    .report-loot-icon {
      width: 28px;
      height: 28px;
    }
    .report-loot-details {
      display: flex;
      flex-direction: column;
    }
    .report-loot-name {
      font-size: 0.78rem;
      font-weight: 700;
    }
    .report-loot-slot {
      font-size: 0.62rem;
      color: var(--ink-muted);
      text-transform: uppercase;
      font-weight: 600;
    }
    .full-width-btn {
      width: 100%;
      margin-top: 8px;
    }
  `;
  document.head.appendChild(style);
}
