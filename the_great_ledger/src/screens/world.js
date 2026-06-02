/* ==========================================================================
   World Map & Dungeon Selection View - The Great Ledger
   ========================================================================== */

import { getState, getDerivedStats, startExpedition } from '../state.js';
import { DUNGEONS } from '../formulas.js';
import { switchScreen } from '../app.js';

export function renderWorld(container) {
  const state = getState();
  const derived = getDerivedStats();
  const currentSteps = state.profile.steps;
  const currentLevel = state.profile.totalLevel;

  container.innerHTML = `
    <div class="world-screen">
      <div class="parchment-card header-banner">
        <h1 class="card-title">🗺️ Travel Map & Journey</h1>
        <p class="description-text">
          Real-world movement carries you across fantasy biomes. Amass steps to unlock deeper vaults, tougher bosses, and premium treasures.
        </p>
      </div>

      <!-- Quick Step Accumulator Cheat/Demo Helper -->
      <div class="demo-step-box parchment-card">
        <div class="demo-info">
          <span>👣 <strong>Steps Walked:</strong> ${currentSteps.toLocaleString()}</span>
        </div>
        <button class="btn-secondary" id="btn-simulate-steps">🚶 Walk 2,500 Steps</button>
      </div>

      <!-- Region Dungeons Stack -->
      <div class="dungeon-stack" id="dungeon-container"></div>
    </div>
  `;

  injectWorldCSS();

  const stack = container.querySelector('#dungeon-container');
  
  stack.innerHTML = DUNGEONS.map(dungeon => {
    const isStepUnlocked = currentSteps >= dungeon.stepRequirement;
    const isLevelUnlocked = currentLevel >= dungeon.levelRequirement;
    const isUnlocked = isStepUnlocked && isLevelUnlocked;

    if (!isUnlocked) {
      // LOCKED REGION CARD
      const stepPct = Math.min(100, Math.floor((currentSteps / dungeon.stepRequirement) * 100));
      return `
        <div class="parchment-card dungeon-card locked">
          <div class="locked-overlay">
            <span class="lock-icon">🔒 Locked Region</span>
            <div class="lock-conditions">
              <div class="condition-item ${isStepUnlocked ? 'met' : 'unmet'}">
                👣 Steps: ${currentSteps.toLocaleString()} / <strong>${dungeon.stepRequirement.toLocaleString()}</strong>
                <div class="lock-progress-bar">
                  <div class="lock-progress-fill" style="width: ${stepPct}%"></div>
                </div>
              </div>
              <div class="condition-item ${isLevelUnlocked ? 'met' : 'unmet'}">
                🛡️ Total Lvl: ${currentLevel} / <strong>${dungeon.levelRequirement}</strong>
              </div>
            </div>
          </div>
          
          <div class="dungeon-blur-content">
            <h3 class="dungeon-title">${dungeon.icon} ${dungeon.name} <span class="rec-level-tag">Rec. Lvl ${dungeon.levelRequirement}</span></h3>
            <p class="dungeon-desc">${dungeon.description}</p>
          </div>
        </div>
      `;
    }

    // UNLOCKED ADVENTURE CARD
    return `
      <div class="parchment-card dungeon-card unlocked" style="border-color: ${dungeon.color};">
        <div class="dungeon-header">
          <div class="dungeon-title-group">
            <span class="dungeon-icon">${dungeon.icon}</span>
            <div>
              <h3 class="dungeon-title">${dungeon.name}</h3>
              <span class="biome-tag">${dungeon.biome}</span>
              <span class="rec-level-tag">Rec. Lvl ${dungeon.levelRequirement}</span>
            </div>
          </div>
          <button class="btn-primary embark-btn" data-id="${dungeon.id}">⚔️ Embark</button>
        </div>

        <p class="dungeon-desc">${dungeon.description}</p>

        <div class="dungeon-rewards-info">
          <div class="reward-factor" title="XP Multiplier">
            <span class="factor-label">XP Scale:</span>
            <span class="factor-val">${dungeon.baseXPMultiplier.toFixed(2)}x</span>
          </div>
          <div class="reward-factor" title="Gold Multiplier">
            <span class="factor-label">Gold Scale:</span>
            <span class="factor-val">${dungeon.baseGoldMultiplier.toFixed(2)}x</span>
          </div>
          <div class="reward-factor" title="Tier Loot Rarity">
            <span class="factor-label">Top Gear:</span>
            <span class="factor-val rarity-tag rarity-${dungeon.id}">
              ${dungeon.id === 'woods' ? 'Rare' : dungeon.id === 'vaults' ? 'Cosmic' : 'Legendary'}
            </span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Event Listeners
  setupEventListeners(container);
}

function setupEventListeners(container) {
  // Step simulation button (crucial for local testing!)
  const btnWalk = container.querySelector('#btn-simulate-steps');
  btnWalk.addEventListener('click', () => {
    // Add steps via state
    import('../state.js').then(mod => {
      mod.addSteps(2500);
      
      // Spawn floating feet splat
      const rect = btnWalk.getBoundingClientRect();
      const splat = document.createElement('span');
      splat.className = 'splat-text splat-xp';
      splat.textContent = '👣 +2,500 Steps!';
      splat.style.left = `${rect.left + rect.width/2}px`;
      splat.style.top = `${rect.top}px`;
      document.body.appendChild(splat);
      setTimeout(() => splat.remove(), 800);
      
      // Re-render
      renderWorld(container);
      
      // Dynamically update main header Steps element
      const headerSteps = document.querySelector('#header-steps');
      if (headerSteps) {
        headerSteps.textContent = mod.getState().profile.steps.toLocaleString();
      }
    });
  });

  // Embark buttons listener
  container.querySelectorAll('.embark-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const dungeonId = btn.getAttribute('data-id');
      
      // Start focus timer state
      startExpedition(dungeonId);
      
      // Switch screen automatically to focus timer
      switchScreen('quests'); // In app.js we will coordinate view swaps
      // Wait, let's redirect to expeditions! In app.js we'll have a controller.
      // We will export switchScreen to swap views.
      const navItem = document.querySelector('#tab-quests'); // Embarks overlay the quests/focus timer page
      switchScreen('quests');
    });
  });
}

function injectWorldCSS() {
  if (document.getElementById('world-view-styles')) return;
  const style = document.createElement('style');
  style.id = 'world-view-styles';
  style.innerHTML = `
    .demo-step-box {
      background-color: var(--parchment-dark);
      padding: 10px 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      font-size: 0.85rem;
    }
    .demo-info {
      display: flex;
      align-items: center;
    }
    .dungeon-stack {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .dungeon-card {
      padding: 14px;
      position: relative;
      transition: all 0.2s ease;
    }
    .dungeon-card.unlocked:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 14px rgba(44, 37, 30, 0.12);
    }
    .dungeon-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }
    .dungeon-title-group {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .dungeon-icon {
      font-size: 1.6rem;
    }
    .dungeon-title {
      font-family: var(--font-header);
      font-size: 0.95rem;
      font-weight: 700;
      color: var(--ink-charcoal);
    }
    .biome-tag {
      font-family: var(--font-header);
      font-size: 0.55rem;
      font-weight: 700;
      background-color: rgba(44, 37, 30, 0.08);
      color: var(--ink-muted);
      padding: 1px 5px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .rec-level-tag {
      font-family: var(--font-header);
      font-size: 0.55rem;
      font-weight: 700;
      background-color: rgba(140, 59, 50, 0.08);
      color: var(--ruby-crimson);
      padding: 1px 5px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-left: 4px;
      display: inline-block;
    }
    .dungeon-desc {
      font-size: 0.76rem;
      color: var(--ink-muted);
      line-height: 1.4;
      margin-bottom: 10px;
    }
    .dungeon-rewards-info {
      display: flex;
      justify-content: space-between;
      background-color: rgba(0, 0, 0, 0.03);
      padding: 6px 10px;
      border-radius: 6px;
      border: 1px solid rgba(44, 37, 30, 0.06);
    }
    .reward-factor {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 0.72rem;
    }
    .factor-label {
      color: var(--ink-muted);
      font-weight: 600;
    }
    .factor-val {
      font-weight: 700;
    }
    .rarity-tag {
      text-transform: uppercase;
      font-size: 0.62rem;
      font-family: var(--font-header);
    }
    .rarity-woods { color: var(--sapphire-blue); }
    .rarity-caves { color: var(--emerald-green); }
    .rarity-ruins { color: var(--ruby-crimson); }
    .rarity-citadel { color: var(--ruby-light); }
    .rarity-vaults { color: var(--gold-primary); font-weight: 900; }

    /* Locked Card Layout */
    .dungeon-card.locked {
      background-color: var(--parchment-dark);
      border-style: dashed;
      border-color: rgba(44, 37, 30, 0.3);
    }
    .dungeon-blur-content {
      filter: blur(1.5px);
      opacity: 0.45;
      pointer-events: none;
    }
    .locked-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 10;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 14px;
      background-color: rgba(230, 220, 205, 0.4);
    }
    .lock-icon {
      font-family: var(--font-header);
      font-weight: 700;
      font-size: 0.8rem;
      letter-spacing: 0.5px;
      color: var(--ruby-crimson);
      background-color: var(--parchment-light);
      border: var(--border-hand-ink);
      padding: 2px 8px;
      border-radius: 4px;
      margin-bottom: 8px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.05);
    }
    .lock-conditions {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 0.72rem;
      color: var(--ink-charcoal);
    }
    .condition-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 4px 8px;
      background-color: rgba(255, 255, 255, 0.6);
      border-radius: 6px;
      border: 1px solid rgba(44, 37, 30, 0.1);
    }
    .condition-item.met {
      border-color: var(--emerald-light);
      background-color: rgba(220, 245, 225, 0.7);
    }
    .lock-progress-bar {
      width: 100%;
      height: 4px;
      background-color: rgba(0,0,0,0.1);
      border-radius: 2px;
      overflow: hidden;
      margin-top: 2px;
    }
    .lock-progress-fill {
      height: 100%;
      background-color: var(--sapphire-light);
    }
  `;
  document.head.appendChild(style);
}
