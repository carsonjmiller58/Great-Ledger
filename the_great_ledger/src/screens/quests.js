/* ==========================================================================
   Quests View (Bounty Board / Habit Tracker) - The Great Ledger
   ========================================================================== */

import { getState, completeQuest, getMomentumMultiplier, createCustomQuest } from '../state.js';

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
      <button class="btn-primary full-width-btn" id="btn-open-quest-modal">
        ➕ Post New Custom Bounty
      </button>

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
  injectQuestsCSS();

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

    return `
      <div class="parchment-card quest-card" data-id="${quest.id}">
        <div class="quest-card-left">
          <div class="skill-indicator" title="Skill Mapped">
            <span class="emoji-icon">${emoji}</span>
            <span class="skill-name">${quest.mappedSkill}</span>
          </div>
          <div class="quest-text">${quest.text}</div>
          <div class="quest-stats">Completed: <strong>${quest.completedCount}</strong></div>
        </div>
        <button class="btn-quest-complete" title="Claim Rewards">
          <div class="reward-tag xp-reward">+${xpReward} XP</div>
          <div class="reward-tag gold-reward">+${goldReward}g</div>
          <span class="claim-label">Complete</span>
        </button>
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

  btnOpen.addEventListener('click', () => modal.classList.remove('hidden'));
  btnCancel.addEventListener('click', () => modal.classList.add('hidden'));

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

function injectQuestsCSS() {
  if (document.getElementById('quests-view-styles')) return;
  const style = document.createElement('style');
  style.id = 'quests-view-styles';
  style.innerHTML = `
    .description-text {
      font-size: 0.8rem;
      line-height: 1.4;
      color: var(--ink-muted);
      margin-top: 4px;
    }
    .full-width-btn {
      width: 100%;
      margin: 8px 0;
      font-size: 0.9rem !important;
      padding: 10px 0 !important;
    }
    .quest-section-header {
      font-family: var(--font-header);
      font-weight: 700;
      font-size: 0.9rem;
      letter-spacing: 0.5px;
      color: var(--ink-charcoal);
      border-left: 3px solid var(--gold-primary);
      padding-left: 8px;
      margin-bottom: 8px;
    }
    .quest-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .empty-quest-msg {
      text-align: center;
      padding: 20px;
      font-size: 0.8rem;
      color: var(--ink-muted);
      border: 1px dashed rgba(44, 37, 30, 0.2);
      border-radius: 8px;
    }
    .quest-card {
      padding: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      transition: all 0.3s ease;
    }
    .quest-card-left {
      flex-grow: 1;
      padding-right: 12px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .skill-indicator {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-family: var(--font-header);
      font-weight: 700;
      font-size: 0.6rem;
      text-transform: uppercase;
      color: var(--sapphire-blue);
    }
    .quest-text {
      font-size: 0.88rem;
      font-weight: 600;
      line-height: 1.3;
    }
    .quest-stats {
      font-size: 0.72rem;
      color: var(--ink-muted);
    }
    .btn-quest-complete {
      background-color: var(--emerald-green);
      color: var(--parchment-light);
      border: var(--border-hand-ink);
      border-radius: 8px;
      padding: 6px 12px;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      box-shadow: 0 3px 0 var(--ink-charcoal);
      transition: all 0.1s ease;
    }
    .btn-quest-complete:active {
      transform: translateY(3px);
      box-shadow: none;
    }
    .reward-tag {
      font-size: 0.58rem;
      font-weight: 700;
      line-height: 1;
      text-shadow: 0 1px 2px rgba(0,0,0,0.1);
    }
    .xp-reward { color: var(--parchment-light); }
    .gold-reward { color: var(--gold-glow); }
    .claim-label {
      font-family: var(--font-header);
      font-size: 0.65rem;
      font-weight: 700;
      margin-top: 2px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .quest-checked {
      transform: scale(0.97);
      opacity: 0.6;
      border-color: var(--emerald-light);
      background-color: rgba(59, 96, 67, 0.05);
    }
    .quest-burn-out {
      animation: burn-out 0.75s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
      border-color: #ff4500 !important;
      box-shadow: 0 0 20px #ff4500, inset 0 0 15px #ff8c00 !important;
      background: linear-gradient(rgba(255, 69, 0, 0.15), rgba(255, 140, 0, 0.05)) !important;
    }
    @keyframes burn-out {
      0% { transform: scale(1) rotate(0deg); opacity: 1; filter: none; }
      30% { transform: scale(1.08) rotate(2deg); opacity: 0.95; filter: sepia(0.5) hue-rotate(-20deg) saturate(2.5) contrast(1.2); }
      100% { transform: scale(0.05) translateY(-85px) rotate(-25deg); opacity: 0; filter: sepia(1) saturate(5) contrast(3.5); }
    }

    /* Modal Styling */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background-color: rgba(10, 8, 5, 0.6);
      backdrop-filter: blur(4px);
      z-index: 200;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 20px;
    }
    .modal-overlay.hidden {
      display: none;
    }
    .modal-content {
      width: 100%;
      max-width: 400px;
      animation: zoom-in 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
    }
    .form-group {
      margin-bottom: 12px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .form-group label {
      font-family: var(--font-header);
      font-size: 0.65rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--ink-muted);
    }
    .form-group input, .form-group select {
      font-family: var(--font-body);
      font-size: 0.85rem;
      padding: 8px;
      border: var(--border-hand-ink);
      border-radius: 8px;
      background-color: var(--parchment-light);
      color: var(--ink-charcoal);
    }
    .form-group input:focus, .form-group select:focus {
      outline: none;
      border-color: var(--gold-primary);
      box-shadow: 0 0 6px var(--gold-glow);
    }
    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 18px;
    }
    @keyframes zoom-in {
      from { transform: scale(0.9); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
}
