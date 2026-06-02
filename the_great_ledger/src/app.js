/* ==========================================================================
   The Great Ledger - Main System Controller & Tab Swapper
   ========================================================================== */

import { loadState, getState, subscribe, getMomentumMultiplier, claimPendingLoginBonus, clearPendingLevelUp } from './state.js';
import { renderQuests } from './screens/quests.js';
import { renderWorld } from './screens/world.js';
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
    currentScreen = 'expeditions';
    updateNavSelection('quests'); // Keep highlight on quest/focus tab
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

  if (state.expedition.active) {
    renderExpedition(viewport);
    return;
  }

  switch (currentScreen) {
    case 'quests':
      renderQuests(viewport);
      break;
    case 'world':
      renderWorld(viewport);
      break;
    case 'character':
      renderCharacter(viewport);
      break;
    default:
      renderQuests(viewport);
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
  // Returns smaller visual crest overlays for the header status circle
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
}

// Start app
window.addEventListener('DOMContentLoaded', init);

/* ==========================================================================
   Overlay Modals System (Login Bonus & Level Up Notifications)
   ========================================================================== */

function checkForModalsAndOverlays() {
  const state = getState();

  // 1. Pending login reward chest
  if (state.profile.hasPendingLoginBonus) {
    renderDailyLoginModal();
    return;
  }

  // 2. Pending OSRS level-up congrats panel
  if (state.profile.pendingLevelUp) {
    renderLevelUpModal(state.profile.pendingLevelUp);
    return;
  }
}

function renderDailyLoginModal() {
  if (document.getElementById('daily-login-bonus-modal')) return;

  const overlay = document.createElement('div');
  overlay.id = 'daily-login-bonus-modal';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="parchment-card modal-content login-bonus-card">
      <h2 class="card-title font-gold" style="justify-content:center; border:none; margin-bottom:4px;">🎁 Guild Daily Tribute</h2>
      <p class="login-bonus-desc">
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

  document.body.appendChild(overlay);

  const btnClaim = overlay.querySelector('#btn-claim-daily-tribute');
  btnClaim.addEventListener('click', () => {
    const rewards = claimPendingLoginBonus("woods");
    if (rewards) {
      // Spin/giggle chest
      overlay.querySelector('#svg-chest').classList.add('chest-opened');
      
      // Render recap spoilers card inside
      overlay.querySelector('.login-bonus-card').innerHTML = `
        <h2 class="card-title" style="color:var(--emerald-green); justify-content:center; border:none; margin-bottom:4px;">✨ Spoils Claimed!</h2>
        <p class="login-bonus-desc" style="text-align:center;">
          The chest was opened! You discovered standard equipment, a special tribute item, and gold:
        </p>

        <div class="spoils-recap-box" style="display:flex; flex-direction:column; gap:10px;">
          <div class="spoil-badge" style="margin-bottom:2px;">🪙 +${rewards.gold} Gold Coins</div>
          
          <div style="display:flex; flex-direction:column; gap:8px;">
            <div class="loot-item-recap" style="border: 2px solid ${rewards.item.rarityColor}; background-color: var(--parchment-light); border-radius: 8px; padding: 8px; display: flex; align-items: center; gap: 10px;">
              <div style="width: 28px; height: 28px;">${rewards.item.icon}</div>
              <div style="display:flex; flex-direction:column; text-align:left;">
                <strong style="color:${rewards.item.rarityColor}; font-size:0.78rem;">${rewards.item.name.split('] ')[1]}</strong>
                <span style="font-size:0.58rem; color:var(--ink-muted); text-transform:uppercase; font-weight:700;">${rewards.item.slot} (${rewards.item.rarity})</span>
              </div>
            </div>
            
            <div class="loot-item-recap" style="border: 2px solid ${rewards.loginBonusItem.rarityColor}; background-color: var(--parchment-light); border-radius: 8px; padding: 8px; display: flex; align-items: center; gap: 10px;">
              <div style="width: 28px; height: 28px;">${rewards.loginBonusItem.icon}</div>
              <div style="display:flex; flex-direction:column; text-align:left;">
                <strong style="color:${rewards.loginBonusItem.rarityColor}; font-size:0.78rem;">${rewards.loginBonusItem.name.split('] ')[1]}</strong>
                <span style="font-size:0.58rem; color:var(--ink-muted); text-transform:uppercase; font-weight:700;">${rewards.loginBonusItem.slot} (${rewards.loginBonusItem.rarity}) - Daily Bonus!</span>
              </div>
            </div>
          </div>
        </div>

        <button class="btn-primary full-width-btn" id="btn-login-bonus-close" style="margin-top: 16px;">Claim & Enter Town</button>
      `;

      overlay.querySelector('#btn-login-bonus-close').addEventListener('click', () => {
        overlay.remove();
      });
    }
  });
}

function renderLevelUpModal(details) {
  if (document.getElementById('level-up-overlay-modal')) return;

  const overlay = document.createElement('div');
  overlay.id = 'level-up-overlay-modal';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="parchment-card modal-content level-up-card-banner">
      <div class="level-up-header">
        <span class="level-up-crest">${details.icon}</span>
        <h1 class="font-gold" style="font-family: var(--font-header); font-size: 1.25rem; margin-top:4px;">Level Up!</h1>
      </div>

      <div class="level-up-title-text" style="font-family: var(--font-header); font-size: 0.88rem; margin-top:4px;">${details.title}</div>

      <div class="report-section" style="border-top: 1px dashed rgba(44,37,30,0.15); padding-top: 10px; margin-top: 10px;">
        <h4 style="font-family: var(--font-header); font-size:0.7rem; color: var(--ink-muted); text-transform:uppercase; margin-bottom: 6px; text-align:left;">Character Improvements</h4>
        <div class="level-up-stats-list">
          ${details.statsList.map(stat => `<div class="level-up-stat-line">${stat}</div>`).join('')}
        </div>
      </div>

      <button class="btn-primary full-width-btn" id="btn-close-levelup-banner" style="margin-top: 16px;">⚔️ Close & Continue</button>
    </div>
  `;

  document.body.appendChild(overlay);

  const btnClose = overlay.querySelector('#btn-close-levelup-banner');
  btnClose.addEventListener('click', () => {
    clearPendingLevelUp();
    overlay.remove();
  });
}
