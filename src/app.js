/* ==========================================================================
   The Great Ledger - Main System Controller & Tab Swapper
   ========================================================================== */

import { loadState, getState, subscribe, getMomentumMultiplier, claimPendingLoginBonus, clearPendingLevelUp, clearPendingClassAdvancement } from './state.js';
import { renderQuests } from './screens/quests.js';
import { renderCharacter } from './screens/character.js';
import { renderExpedition } from './screens/expeditions.js';

// Global Viewport Elements
const viewport = document.getElementById('app-viewport');
const nav = document.getElementById('bottom-navigation');

let currentScreen = 'quests'; // 'quests', 'world', 'character'

/**
 * Core Dynamic Tab Navigation Handler
 */
export function switchScreen(screenName) {
  const state = getState();
  
  // Discipline Guard: Lock screen if a Focus timer is underway!
  if (state.expedition.active) {
    currentScreen = 'world'; // Locked onto the Focus screen
    updateNavSelection('world');
    renderActiveView();
    return;
  }

  currentScreen = screenName;
  updateNavSelection(screenName);
  renderActiveView();
}

function updateNavSelection(screenName) {
  nav.querySelectorAll('.nav-tab').forEach(tab => {
    if (tab.getAttribute('data-screen') === screenName) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });
}

function renderActiveView() {
  const state = getState();
  
  // Clear any residual timer ticks if switching screens safely
  viewport.innerHTML = "";

  try {
    if (state.expedition.active) {
      renderExpedition(viewport);
      return;
    }

    switch (currentScreen) {
      case 'quests':
        renderQuests(viewport);
        break;
      case 'world':
        renderExpedition(viewport);
        break;
      case 'character':
        renderCharacter(viewport);
        break;
      default:
        renderQuests(viewport);
    }
  } catch(e) {
    viewport.innerHTML = `<div style="padding:20px; color:red; font-size:0.75rem; word-break:break-all;"><strong>JS ERROR:</strong><br>${e.message}<br><pre>${e.stack}</pre></div>`;
    console.error('renderActiveView failed:', e);
  }
}

/* ==========================================================================
   Reactivity & Status Updates
   ========================================================================== */

function syncStatusHeader() {
  const state = getState();
  
  // Basic attributes
  document.getElementById('header-char-name').textContent = state.profile.name;
  document.getElementById('header-archetype').textContent = `${state.profile.archetype}`;
  document.getElementById('header-gold').textContent = state.profile.gold.toLocaleString();
  document.getElementById('header-steps').textContent = state.profile.steps.toLocaleString();
  document.getElementById('header-total-level').textContent = state.profile.totalLevel;

  // Momentum meter variables
  const flameFill = document.getElementById('flame-meter-fill');
  const flameMult = document.getElementById('flame-multiplier');
  
  flameFill.style.width = `${state.profile.momentum}%`;
  flameMult.textContent = `${getMomentumMultiplier()}x`;

  // Dynamic Avatar Shield
  const avatarSVG = document.getElementById('header-avatar');
  avatarSVG.innerHTML = getHeaderAvatarSVG(state.profile.archetype);
}

function getHeaderAvatarSVG(archetype) {
  // Returns smaller visual crest overlays for the status header
  let color = "var(--ink-charcoal)";
  if (archetype === "Warrior" || archetype === "Crafter") color = "var(--ruby-crimson)";
  else if (archetype === "Ranger" || archetype === "Alchemist") color = "var(--emerald-green)";
  else if (archetype === "Scholar" || archetype === "Merchant") color = "var(--sapphire-blue)";

  return `
    <circle cx="50" cy="50" r="45" fill="${color}" stroke="var(--ink-charcoal)" stroke-width="4" />
    <circle cx="50" cy="50" r="33" fill="var(--parchment-light)" opacity="0.15" />
    <circle cx="50" cy="50" r="10" fill="var(--gold-primary)" stroke="var(--ink-charcoal)" stroke-width="3" />
  `;
}

/* ==========================================================================
   Initialization
   ========================================================================== */

function init() {
  try {
    // Load local state
    loadState();

    // Navigation tab clicks
    nav.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const screen = tab.getAttribute('data-screen');
        switchScreen(screen);
      });
    });

    // Subscribe state reactivity
    subscribe(() => {
      syncStatusHeader();
      checkForModalsAndOverlays();
    });

    // Initial Sync and draw
    syncStatusHeader();
    renderActiveView();
    checkForModalsAndOverlays();
  } catch(e) {
    viewport.innerHTML = `<div style="padding:20px; color:red; font-size:0.75rem; word-break:break-all;"><strong>INIT ERROR:</strong><br>${e.message}<br><pre>${e.stack}</pre></div>`;
    console.error('init failed:', e);
  }
}

// Start app
window.addEventListener('DOMContentLoaded', init);

/* ==========================================================================
   Overlay Modals System (Login Bonus & Level Up Notifications)
   ========================================================================== */

function checkForModalsAndOverlays() {
  const state = getState();

  // 1. Onboarding
  if (!state.profile.setupComplete) {
    renderOnboardingModal();
    return;
  }

  // 2. Pending login reward chest
  if (state.profile.hasPendingLoginBonus) {
    renderDailyLoginModal();
    return;
  }

  // 3. Weekly summary
  if (state.profile.hasPendingWeeklySummary) {
    renderWeeklySummaryModal();
    return;
  }

  // 4. Pending OSRS level-up congrats panel
  if (state.profile.pendingLevelUp) {
    renderLevelUpModal(state.profile.pendingLevelUp);
    return;
  }

  // 5. Pending Class Advancement
  if (state.profile.pendingClassAdvancement) {
    renderClassAdvancementModal(state.profile.pendingClassAdvancement);
    return;
  }
}



function renderClassAdvancementModal(advancementData) {
  if (document.getElementById('class-advancement-modal-overlay')) return;

  const gameContainer = document.getElementById('game-container');
  const overlay = document.createElement('div');
  overlay.id = 'class-advancement-modal-overlay';
  overlay.className = 'modal-overlay';

  overlay.innerHTML = `
    <div class="parchment-card modal-content" style="width: 340px; text-align: center;">
      <div style="font-size: 3.5rem; margin-bottom: 10px;">🌟</div>
      <h2 class="card-title font-gold" style="justify-content:center; border:none; margin-bottom: 10px; font-size: 1.4rem;">
        Evolution Complete!
      </h2>
      <p style="margin-bottom: 20px; font-size: 1.1rem;">
        You have advanced to Tier ${advancementData.tier}: <strong style="color: var(--sapphire-blue);">${advancementData.className}</strong>
      </p>
      
      <div style="background: rgba(44,37,30,0.05); border: 1px solid var(--amber-gold); border-radius: 6px; padding: 15px; margin-bottom: 20px;">
        <div style="font-weight: bold; margin-bottom: 5px;">New Combat Ability Unlocked:</div>
        <div style="color: var(--ruby-crimson); font-size: 0.95rem;">${advancementData.ability}</div>
      </div>
      
      <button class="btn-primary full-width-btn" id="btn-close-advancement">Accept Destiny</button>
    </div>
  `;

  gameContainer.appendChild(overlay);
  triggerFireParticles(overlay.querySelector('.modal-content'));

  overlay.querySelector('#btn-close-advancement').addEventListener('click', () => {
    overlay.remove();
    import('./state.js').then(mod => {
      mod.clearPendingClassAdvancement();
      checkForModalsAndOverlays();
    });
  });
}

function triggerFireParticles(containerElement) {
  const rect = containerElement.getBoundingClientRect();
  const numParticles = 25;
  for (let i = 0; i < numParticles; i++) {
    const p = document.createElement('div');
    p.className = 'fire-particle';
    
    const size = Math.random() * 8 + 4;
    const colors = ['#ff4500', '#ff8c00', '#ffd700', '#ff3300'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    p.style.width = `${size}px`;
    p.style.height = `${size}px`;
    p.style.backgroundColor = color;
    p.style.borderRadius = '50%';
    p.style.position = 'fixed';
    p.style.zIndex = '300';
    p.style.pointerEvents = 'none';
    p.style.boxShadow = `0 0 8px ${color}`;
    
    // Position near bottom of container
    const startX = rect.left + Math.random() * rect.width;
    const startY = rect.bottom - (Math.random() * 20);
    p.style.left = `${startX}px`;
    p.style.top = `${startY}px`;
    
    const angle = Math.random() * Math.PI - Math.PI; 
    const speed = Math.random() * 100 + 50;
    const lifetime = Math.random() * 0.4 + 0.5;
    
    document.body.appendChild(p);
    
    const targetX = startX + Math.cos(angle) * (speed * lifetime);
    const targetY = startY + Math.sin(angle) * (speed * lifetime) - 100;
    
    p.animate([
      { transform: `translate(0px, 0px) scale(1)`, opacity: 1 },
      { transform: `translate(${targetX - startX}px, ${targetY - startY}px) scale(0)`, opacity: 0 }
    ], {
      duration: lifetime * 1000,
      easing: 'ease-out',
      fill: 'forwards'
    });
    
    setTimeout(() => { p.remove(); }, lifetime * 1000);
  }
}

function renderOnboardingModal() {
  if (document.getElementById('onboarding-modal-overlay')) return;

  const gameContainer = document.getElementById('game-container');
  const overlay = document.createElement('div');
  overlay.id = 'onboarding-modal-overlay';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="parchment-card modal-content" style="width: 340px; padding: 24px;">
      <div id="onboarding-step-1">
        <h2 class="card-title font-gold" style="justify-content:center; border:none; margin-bottom:10px; font-family: var(--font-header);">Welcome to the Guild</h2>
        <p style="font-size: 0.8rem; text-align: center; margin-bottom: 20px;">What name shall be written in the Great Ledger?</p>
        <input type="text" id="onboarding-name-input" class="parchment-input" style="width: 100%; margin-bottom: 20px; text-align: center; font-size: 1.1rem;" placeholder="Your Hero's Name" value="Hero Knight">
        <button class="btn-primary full-width-btn" id="btn-onboarding-next">Next</button>
      </div>
      <div id="onboarding-step-2" class="hidden">
        <h2 class="card-title font-gold" style="justify-content:center; border:none; margin-bottom:10px; font-family: var(--font-header);">Choose Your Path</h2>
        <p style="font-size: 0.8rem; text-align: center; margin-bottom: 20px;">Your starting archetype determines your base stat growth.</p>
        <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px;">
          <label class="class-choice" style="display: flex; align-items: center; gap: 10px; padding: 10px; border: 1px solid rgba(44,37,30,0.15); border-radius: 6px; cursor: pointer;">
            <input type="radio" name="startClass" value="Commoner" checked>
            <div>
              <strong>Commoner</strong>
              <div style="font-size: 0.65rem; color: var(--ink-muted);">Balanced starting growth.</div>
            </div>
          </label>
          <label class="class-choice" style="display: flex; align-items: center; gap: 10px; padding: 10px; border: 1px solid rgba(44,37,30,0.15); border-radius: 6px; cursor: pointer;">
            <input type="radio" name="startClass" value="Wanderer">
            <div>
              <strong>Wanderer</strong>
              <div style="font-size: 0.65rem; color: var(--ink-muted);">Travel fuels their blade.</div>
            </div>
          </label>
          <label class="class-choice" style="display: flex; align-items: center; gap: 10px; padding: 10px; border: 1px solid rgba(44,37,30,0.15); border-radius: 6px; cursor: pointer;">
            <input type="radio" name="startClass" value="Street Rat">
            <div>
              <strong>Street Rat</strong>
              <div style="font-size: 0.65rem; color: var(--ink-muted);">Slips past the deadliest strikes.</div>
            </div>
          </label>
        </div>
        <button class="btn-primary full-width-btn" id="btn-onboarding-finish">Sign the Ledger</button>
      </div>
    </div>
  `;

  gameContainer.appendChild(overlay);

  const step1 = overlay.querySelector('#onboarding-step-1');
  const step2 = overlay.querySelector('#onboarding-step-2');
  
  overlay.querySelector('#btn-onboarding-next').addEventListener('click', () => {
    step1.classList.add('hidden');
    step2.classList.remove('hidden');
  });

  overlay.querySelector('#btn-onboarding-finish').addEventListener('click', () => {
    const name = overlay.querySelector('#onboarding-name-input').value.trim() || 'Hero Knight';
    const cls = overlay.querySelector('input[name="startClass"]:checked').value;
    
    import('./state.js').then(mod => {
      mod.updateHeroName(name);
      mod.changeClass(cls, true); // true = isInitialSetup (no modal)
      const state = mod.getState();
      state.profile.setupComplete = true;
      mod.saveState();
      
      overlay.remove();
      checkForModalsAndOverlays();
    });
  });
}

function renderWeeklySummaryModal() {
  if (document.getElementById('weekly-summary-modal-overlay')) return;
  const gameContainer = document.getElementById('game-container');
  
  import('./state.js').then(mod => {
    const summary = mod.claimWeeklySummary();
    if (!summary) return;

    const overlay = document.createElement('div');
    overlay.id = 'weekly-summary-modal-overlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="parchment-card modal-content" style="width: 320px; padding: 24px; text-align: center;">
        <h2 class="card-title font-gold" style="justify-content:center; border:none; margin-bottom:10px; font-family: var(--font-header);">📜 Weekly Chronicle</h2>
        <p style="font-size: 0.8rem; margin-bottom: 20px;">The Guild has reviewed your ledger from the past week. Here are your accomplishments:</p>
        
        <div style="display: flex; flex-direction: column; gap: 10px; text-align: left; margin-bottom: 20px;">
          <div style="padding: 10px; background: rgba(0,0,0,0.03); border: 1px dashed rgba(44,37,30,0.15); border-radius: 6px;">
            <div style="font-size: 0.75rem; font-weight: bold; color: var(--emerald-green);">✅ Quests Completed</div>
            <div style="font-size: 1.1rem;">${summary.questsCompleted}</div>
          </div>
          <div style="padding: 10px; background: rgba(0,0,0,0.03); border: 1px dashed rgba(44,37,30,0.15); border-radius: 6px;">
            <div style="font-size: 0.75rem; font-weight: bold; color: var(--gold-primary);">🔥 Streaks Maintained</div>
            <div style="font-size: 1.1rem;">${summary.streaksMaintained} days</div>
          </div>
          <div style="padding: 10px; background: rgba(0,0,0,0.03); border: 1px dashed rgba(44,37,30,0.15); border-radius: 6px;">
            <div style="font-size: 0.75rem; font-weight: bold; color: var(--ruby-crimson);">🌟 Skills Leveled</div>
            <div style="font-size: 0.9rem;">${summary.skillsLeveled.length > 0 ? summary.skillsLeveled.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ') : 'None'}</div>
          </div>
        </div>

        <button class="btn-primary full-width-btn" id="btn-close-weekly-summary">Onward to Next Week</button>
      </div>
    `;

    gameContainer.appendChild(overlay);

    overlay.querySelector('#btn-close-weekly-summary').addEventListener('click', () => {
      overlay.remove();
      checkForModalsAndOverlays();
    });
  });
}

function renderDailyLoginModal() {
  if (document.getElementById('daily-login-bonus-modal')) return;

  const gameContainer = document.getElementById('game-container');
  const overlay = document.createElement('div');
  overlay.id = 'daily-login-bonus-modal';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="parchment-card modal-content login-bonus-card">
      <h2 class="card-title font-gold" style="justify-content:center; border:none; margin-bottom:4px;">🎁 Guild Daily Tribute</h2>
      <p class="login-bonus-desc" style="font-size: 0.76rem; text-align: center;">
        For your dedication and consistency, the local trackers have recovered a tribute chest for your guild pouch!
      </p>

      <div class="chest-visual-container">
        <svg id="svg-chest" viewBox="0 0 100 100" class="chest-svg">
          <path d="M25 45 H75 V80 H25 Z" fill="var(--parchment-dark)" stroke="var(--ink-charcoal)" stroke-width="4px" />
          <path d="M20 45 Q50 15 80 45 Z" fill="var(--gold-primary)" stroke="var(--ink-charcoal)" stroke-width="4px" />
          <rect x="45" y="40" width="10" height="15" fill="var(--ink-charcoal)" rx="2" />
          <circle cx="50" cy="48" r="3" fill="var(--parchment-light)" />
        </svg>
      </div>

      <button class="btn-primary full-width-btn" id="btn-claim-daily-tribute">⚒️ Open Tribute Box</button>
    </div>
  `;

  gameContainer.appendChild(overlay);

  const btnClaim = overlay.querySelector('#btn-claim-daily-tribute');
  btnClaim.addEventListener('click', () => {
    const rewards = claimPendingLoginBonus();
    if (rewards) {
      // Render recap spoilers card inside
      overlay.querySelector('.login-bonus-card').innerHTML = `
        <h2 class="card-title" style="color:var(--emerald-green); justify-content:center; border:none; margin-bottom:4px;">✨ Spoils Claimed!</h2>
        <p class="login-bonus-desc" style="text-align:center; font-size: 0.76rem;">
          The tribute box was opened! The guild has awarded you with consistency materials:
        </p>

        <div class="spoils-recap-box">
          <div class="spoil-badge">🪙 +${rewards.gold} Gold Coins</div>
          <div class="spoil-badge">✨ +${rewards.essence} Upgrade Essence</div>
          <div class="spoil-badge">🧩 +${rewards.relicShards} Relic Shards</div>
        </div>

        <button class="btn-primary full-width-btn" id="btn-login-bonus-close">⚔️ Claim & Enter Town</button>
      `;

      overlay.querySelector('#btn-login-bonus-close').addEventListener('click', () => {
        overlay.remove();
        checkForModalsAndOverlays(); // Show level-up if one queued
      });
    }
  });
}

function renderLevelUpModal(details) {
  if (document.getElementById('level-up-overlay-modal')) return;

  const gameContainer = document.getElementById('game-container');
  const overlay = document.createElement('div');
  overlay.id = 'level-up-overlay-modal';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="parchment-card modal-content level-up-card-banner">
      <div class="level-up-header">
        <span class="level-up-crest">${details.icon}</span>
        <h1 class="font-gold" style="font-family: var(--font-header); font-size: 1.25rem; margin-top:4px;">Level Up!</h1>
      </div>

      <div class="level-up-title-text">${details.title}</div>

      <div class="report-section" style="border-top: 1px dashed rgba(44,37,30,0.15); padding-top: 10px; margin-top: 10px;">
        <h4 style="font-family: var(--font-header); font-size:0.7rem; color: var(--ink-muted); text-transform:uppercase; margin-bottom: 6px; text-align:left;">Character Improvements</h4>
        <div class="level-up-stats-list">
          ${details.statsList.map(stat => `<div class="level-up-stat-line">${stat}</div>`).join('')}
        </div>
      </div>

      <button class="btn-primary full-width-btn" id="btn-close-levelup-banner" style="margin-top: 16px;">⚔️ Close & Continue</button>
    </div>
  `;

  gameContainer.appendChild(overlay);

  const btnClose = overlay.querySelector('#btn-close-levelup-banner');
  btnClose.addEventListener('click', () => {
    overlay.remove();
    import('./state.js').then(mod => {
      mod.clearPendingLevelUp();
      checkForModalsAndOverlays();
    });
  });
}
