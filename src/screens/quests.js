/* ==========================================================================
   Quests View (Bounty Board / Habit Tracker) - The Great Ledger
   ========================================================================== */

import { getState, completeQuest, getMomentumMultiplier, createCustomQuest, generateUpgradeQuest } from '../state.js';
import { xpForLevel, levelForXp } from '../formulas.js';

export function renderQuests(container) {
  const state = getState();
  const mult = parseFloat(getMomentumMultiplier());

  // Screen layout HTML
  container.innerHTML = `
    <div class="quests-screen">
      <div class="parchment-card header-banner">
        <h1 class="card-title">📜 Guild Bounty Board</h1>
        <p class="description-text">
          Real-world discipline fuels your hero. Complete active bounties to earn medieval coins and OSRS attribute experience.
        </p>
      </div>

      <!-- Add New Custom Quest Panel -->
      <div style="display: flex; gap: 8px;">
        <button class="btn-primary full-width-btn" id="btn-open-quest-modal">
          ➕ Post New Custom Bounty
        </button>
        <button class="btn-primary full-width-btn" id="btn-generate-upgrade-quest" style="background: var(--sapphire-blue);">
          🎯 Generate Class Upgrade Quest
        </button>
      </div>

      <!-- Active Quests List -->
      <div class="quest-section-header">🛡️ Daily Quests</div>
      <div class="quest-list" id="daily-quest-list"></div>

      <div class="quest-section-header" style="margin-top:20px;">⚔️ Weekly Milestones</div>
      <div class="quest-list" id="weekly-quest-list"></div>
    </div>

    <!-- Modal Scaffolding for Quest Creation -->
    <div id="quest-create-modal" class="modal-overlay hidden">
      <div class="parchment-card modal-content">
        <h2 class="card-title">🖋️ Write Scroll of Bounty</h2>
        
        <div class="form-group">
          <label>Bounty Description</label>
          <input type="text" id="modal-quest-text" placeholder="e.g. Read 3 chapters of spellbook..." />
        </div>

        <div class="form-group">
          <label>Reset Cadence</label>
          <select id="modal-quest-type">
            <option value="daily">Daily Quest</option>
            <option value="weekly">Weekly Milestone</option>
            <option value="onetime">One-Time Bounty</option>
          </select>
        </div>

        <div class="form-group">
          <label>Mapped Attribute</label>
          <select id="modal-quest-skill">
            <option value="strength">Strength (Weightlifting / Heavy labor)</option>
            <option value="agility">Agility (Running / Gym / Cardio)</option>
            <option value="wisdom">Wisdom (Reading / Learning / Philosophy)</option>
            <option value="intelligence">Intelligence (Studying / Code / Mathematics)</option>
            <option value="insight">Insight (Meditation / Journaling / Self-Care)</option>
            <option value="vitality">Vitality (Healthy Sleep / Core recovery)</option>
            <option value="charisma">Charisma (Socializing / Leadership / Speech)</option>
            <option value="cleaning">Cleaning (🧹 Clean / Wash / Organize Sanctuary)</option>
          </select>
        </div>

        <div class="modal-actions">
          <button class="btn-secondary" id="modal-btn-cancel">Tear Up</button>
          <button class="btn-primary" id="modal-btn-submit">Seal with Wax</button>
        </div>
      </div>
    </div>
  `;

  // Custom Inline Styles for Quests View
  // CSS moved to styles.css

  // Populate Lists
  const dailyList = container.querySelector('#daily-quest-list');
  const weeklyList = container.querySelector('#weekly-quest-list');

  const dailyQuests = state.quests.filter(q => q.type === 'daily');
  const weeklyQuests = state.quests.filter(q => q.type === 'weekly');

  // Sort daily and weekly quests so completed ones (completedCount > 0) are moved to the bottom
  dailyQuests.sort((a, b) => {
    const aComp = a.completedCount > 0 ? 1 : 0;
    const bComp = b.completedCount > 0 ? 1 : 0;
    return aComp - bComp;
  });
  weeklyQuests.sort((a, b) => {
    const aComp = a.completedCount > 0 ? 1 : 0;
    const bComp = b.completedCount > 0 ? 1 : 0;
    return aComp - bComp;
  });

  populateQuests(dailyQuests, dailyList, mult);
  populateQuests(weeklyQuests, weeklyList, mult);

  // Setup Event Listeners
  setupEventListeners(container);
}

function populateQuests(quests, listContainer, mult) {
  if (quests.length === 0) {
    listContainer.innerHTML = `<div class="empty-quest-msg">No active seals on this board.</div>`;
    return;
  }

  const state = getState();
  const skillEmojis = {
    strength: '⚔️',
    agility: '🏃',
    wisdom: '📖',
    intelligence: '🧪',
    insight: '👁️',
    vitality: '💤',
    charisma: '🍻',
    cleaning: '🧹'
  };

  listContainer.innerHTML = quests.map(quest => {
    const xpReward = Math.floor(quest.baseXP * mult);
    const goldReward = Math.floor(quest.baseGold * mult);
    const emoji = skillEmojis[quest.mappedSkill] || '🛡️';
    
    const isCompleted = quest.completedCount > 0;
    const cardClass = isCompleted ? 'quest-card quest-completed-today' : 'quest-card';
    const btnAttr = isCompleted ? 'disabled' : '';
    const btnLabel = isCompleted ? '✅ Done' : 'Complete';
    
    let timerHtml = '';
    if (isCompleted && !quest.isOneTime) {
      const now = new Date();
      let resetMs = 0;
      if (quest.type === 'daily') {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0,0,0,0);
        resetMs = tomorrow - now;
      } else if (quest.type === 'weekly') {
        const d = new Date(now);
        d.setDate(d.getDate() + ((7 - d.getDay() + 1) % 7 || 7));
        d.setHours(0,0,0,0);
        resetMs = d - now;
      }
      const hrs = Math.floor(resetMs / (1000 * 60 * 60));
      const mins = Math.floor((resetMs % (1000 * 60 * 60)) / (1000 * 60));
      timerHtml = `<div class="quest-reset-timer">Resets in ${hrs}h ${mins}m</div>`;
    }
    
    let streakHtml = '';
    if (quest.currentStreak > 1) {
      streakHtml = `<span class="streak-badge">🔥 ${quest.currentStreak}-day streak</span>`;
    }
    
    const currentXp = state.skills[quest.mappedSkill] || 0;
    const currentLevel = levelForXp(currentXp);
    const xpForCurrent = xpForLevel(currentLevel);
    const xpForNext = xpForLevel(currentLevel + 1);
    const progressTotal = xpForNext - xpForCurrent;
    const progressCurrent = currentXp - xpForCurrent;
    const pct = Math.min(100, Math.max(0, (progressCurrent / progressTotal) * 100));
    
    const xpBarHtml = `
      <div class="quest-xp-bar-row">
        <div class="quest-xp-bar-track">
          <div class="quest-xp-bar-fill" style="width: ${pct}%"></div>
        </div>
        <span class="quest-xp-bar-label">${currentXp}/${xpForNext}</span>
      </div>
    `;

    return `
      <div class="parchment-card ${cardClass}" data-id="${quest.id}">
        <div class="quest-card-top">
          <div class="quest-card-left">
            <div class="skill-indicator" title="Skill Mapped">
              <span class="emoji-icon">${emoji}</span>
              <span class="skill-name">${quest.mappedSkill}</span>
            </div>
            <div class="quest-text">${quest.text}</div>
            <div class="quest-meta-row">
              <div class="quest-stats">Completed: <strong>${quest.completedCount}</strong></div>
              ${streakHtml}
              ${timerHtml}
            </div>
            ${xpBarHtml}
          </div>
          <button class="btn-quest-complete" title="Claim Rewards" ${btnAttr}>
            <div class="reward-tag xp-reward">+${xpReward} XP</div>
            <div class="reward-tag gold-reward">+${goldReward}g</div>
            <span class="claim-label">${btnLabel}</span>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function setupEventListeners(container) {
  // Quest completion click handler
  container.querySelectorAll('.btn-quest-complete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const card = e.target.closest('.quest-card');
      const questId = card.getAttribute('data-id');
      
      // Perform complete
      const reward = completeQuest(questId);
      if (reward) {
        const rect = btn.getBoundingClientRect();
        spawnSplat(rect.left + rect.width/2, rect.top, `+${reward.xpReward} XP`, 'splat-xp');
        spawnSplat(rect.left + rect.width/2, rect.top - 20, `+${reward.goldReward} Gold`, 'splat-gold');

        if (reward.isOneTime) {
          // ONE-TIME BOUNTY COMPLETED: Trigger scroll-burn flame dissolve animation!
          card.classList.add('quest-burn-out');
          triggerFireParticles(card);
          
          setTimeout(() => {
            import('../state.js').then(mod => {
              mod.deleteQuest(questId);
              renderQuests(container);
            });
          }, 750);
        } else {
          // Repeating daily/weekly habit: standard parchment checkmark
          card.classList.add('quest-checked');
          
          setTimeout(() => {
            renderQuests(container);
          }, 350);
        }
      }
    });
  });

  // Modal display listeners
  const modal = container.querySelector('#quest-create-modal');
  const btnOpen = container.querySelector('#btn-open-quest-modal');
  const btnCancel = container.querySelector('#modal-btn-cancel');
  const btnSubmit = container.querySelector('#modal-btn-submit');
  const btnGenerateUpgrade = container.querySelector('#btn-generate-upgrade-quest');

  btnOpen.addEventListener('click', () => modal.classList.remove('hidden'));
  btnCancel.addEventListener('click', () => modal.classList.add('hidden'));
  
  if (btnGenerateUpgrade) {
    btnGenerateUpgrade.addEventListener('click', () => {
      generateUpgradeQuest();
      renderQuests(container); // Refresh the UI immediately to show new quest
    });
  }

  btnSubmit.addEventListener('click', () => {
    const text = container.querySelector('#modal-quest-text').value.trim();
    const type = container.querySelector('#modal-quest-type').value;
    const skill = container.querySelector('#modal-quest-skill').value;

    if (!text) {
      alert("Guild laws require a description for your bounty!");
      return;
    }

    createCustomQuest(text, type, skill);
    modal.classList.add('hidden');
    renderQuests(container);
  });
}

function spawnSplat(x, y, text, splatClass) {
  const el = document.createElement('span');
  el.className = `splat-text ${splatClass}`;
  el.textContent = text;
  el.style.left = `${x}px`;
  el.style.top = `${y + window.scrollY}px`;
  
  document.body.appendChild(el);
  
  // Cleanup
  setTimeout(() => {
    el.remove();
  }, 800);
}

function triggerFireParticles(cardElement) {
  const rect = cardElement.getBoundingClientRect();
  const numParticles = 30;
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
    
    // Initial position scattered within the card
    const startX = rect.left + Math.random() * rect.width;
    const startY = rect.top + Math.random() * rect.height;
    p.style.left = `${startX}px`;
    p.style.top = `${startY}px`;
    
    // Random angle upwards (between -180 and 0 degrees)
    const angle = Math.random() * Math.PI - Math.PI; 
    const speed = Math.random() * 120 + 60; // px/s
    const lifetime = Math.random() * 0.4 + 0.45; // 0.45s to 0.85s
    
    document.body.appendChild(p);
    
    const targetX = startX + Math.cos(angle) * (speed * lifetime);
    const targetY = startY + Math.sin(angle) * (speed * lifetime) - 50;
    
    p.animate([
      { transform: 'translate(0, 0) scale(1)', opacity: 0.9 },
      { transform: `translate(${targetX - startX}px, ${targetY - startY}px) scale(0)`, opacity: 0 }
    ], {
      duration: lifetime * 1000,
      easing: 'ease-out',
      fill: 'forwards'
    });
    
    setTimeout(() => p.remove(), lifetime * 1000);
  }
}

