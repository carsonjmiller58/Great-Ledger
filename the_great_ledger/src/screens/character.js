import { getState, getDerivedStats, changeClass, switchWeapon, investEssence, craftRelic, equipRelic, buyMomentumRecovery, ARMOR_TIERS, getArmorForgeUpgradeCost, updateHeroName, resetSave } from '../state.js';
import { xpForLevel, weaponRankForXp, getWeaponMasteryDetails, DUNGEONS, WEAPON_PRESETS, CLASS_PATHS } from '../formulas.js';

let showWeaponSelector = false;

export function renderCharacter(container) {
  const state = getState();
  const derived = getDerivedStats();
  const prog = state.progression || {
    currentClass: "Commoner",
    equippedWeapon: "blade",
    armorForge: { level: 1, essenceInvested: 0 },
    equippedRelic: null,
    unlockedRelics: [],
    weaponXP: { blade: 0, axe: 0, spear: 0, dagger: 0, staff: 0, focus: 0 },
    monsterCodex: {},
    materials: { essence: 0, coreFragments: 0, relicShards: 0 }
  };

  const activeWeaponKey = prog.equippedWeapon || "blade";
  const activeWeapon = WEAPON_PRESETS[activeWeaponKey] || WEAPON_PRESETS.blade;

  // Render main Chronicle layout
  container.innerHTML = `
    <div class="character-screen chronicle-layout">
      
      <!-- 1. HEADER BANNER -->
      <div class="parchment-card chronicle-header">
        <h1 class="chronicle-title font-gold">THE CHRONICLE OF ${state.profile.name.toUpperCase()}</h1>
        <div class="chronicle-subtitle">Level ${state.profile.totalLevel} ${prog.currentClass}</div>
        
        <div class="avatar-shield-container">
          <svg viewBox="0 0 100 100" class="hero-svg-shield">
            ${getDynamicAvatarShieldSVG(state.profile.archetype)}
          </svg>
        </div>
        
        <!-- Recovery of Momentum -->
        <div class="momentum-recovery-row">
          <span class="momentum-status">🔥 <strong>Flame Consistency:</strong> ${state.profile.momentum}%</span>
          <button class="btn-secondary btn-buyback" id="btn-buyback-momentum" ${state.profile.momentum >= 100 ? 'disabled' : ''}>
            🪙 Ignite (${Math.floor(40 + (state.profile.momentum * 1.5))}g)
          </button>
        </div>
      </div>

      <!-- 2. COMBAT ATTRIBUTES -->
      <div class="parchment-card section-card">
        <h3 class="card-title">⚔️ Combat Attributes</h3>
        <div class="stats-grid">
          <div class="stat-badge">
            <span class="stat-badge-icon">❤️</span>
            <div class="stat-badge-info">
              <span class="stat-badge-val">${derived.combatStats.maxHP}</span>
              <span class="stat-badge-label">Max Health</span>
            </div>
          </div>
          <div class="stat-badge">
            <span class="stat-badge-icon">🗡️</span>
            <div class="stat-badge-info">
              <span class="stat-badge-val">${derived.combatStats.attack}</span>
              <span class="stat-badge-label">Attack Rating</span>
            </div>
          </div>
          <div class="stat-badge">
            <span class="stat-badge-icon">🛡️</span>
            <div class="stat-badge-info">
              <span class="stat-badge-val">${derived.combatStats.defense}</span>
              <span class="stat-badge-label">Defense Rating</span>
            </div>
          </div>
          <div class="stat-badge">
            <span class="stat-badge-icon">🪓</span>
            <div class="stat-badge-info">
              <span class="stat-badge-val">1 - ${derived.combatStats.damageRange}</span>
              <span class="stat-badge-label">Damage Range</span>
            </div>
          </div>
          <div class="stat-badge full-width-badge">
            <span class="stat-badge-icon">${activeWeapon.icon}</span>
            <div class="stat-badge-info" style="align-items: center;">
              <span class="stat-badge-val" style="font-size: 0.82rem;">${activeWeapon.name} (${activeWeapon.range}m range)</span>
              <span class="stat-badge-label">Equipped weapon type</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 3. CURRENT CLASS & EVOLUTIONS -->
      <div class="parchment-card section-card">
        <h3 class="card-title">🛡️ Class Evolutions</h3>
        <div class="current-class-lore">
          <span class="lore-label">Current Path:</span>
          <span class="lore-class font-gold">${prog.currentClass.toUpperCase()}</span>
          <p class="lore-quote">"${getClassLoreQuote(prog.currentClass)}"</p>
        </div>

        <h4 class="sub-section-title">🔮 Destiny Tiers Unlocked</h4>
        <div class="destiny-tree">
          ${renderDestinyPaths(state, derived, prog)}
        </div>
      </div>

      <!-- 4. OSRS SKILLS MASTERY -->
      <div class="parchment-card section-card">
        <h3 class="card-title">📖 OSRS Skill Masteries</h3>
        <div class="skills-stack">
          ${renderSkillsList(state.skills, derived.skillsLevels)}
        </div>
      </div>

      <!-- 5. WEAPON MASTERIES -->
      <div class="parchment-card section-card">
        <h3 class="card-title">🪓 Weapon Masteries</h3>
        <p class="section-desc">Practice with weapon types during Deep Focus to level their masteries and unlock flat accuracy scaling.</p>
        
        <div class="active-weapon-box">
          <div class="active-weapon-meta">
            <span>Equipped: <strong>${activeWeapon.name}</strong></span>
            <span>Range: <strong>${activeWeapon.range}m</strong></span>
          </div>
          <button class="btn-primary" id="btn-toggle-weapon-selector">
            ${showWeaponSelector ? '❌ Close Selection' : '⚔️ Switch Weapon'}
          </button>
        </div>

        ${showWeaponSelector ? `
          <div class="weapon-selector-grid" id="weapon-selection-container">
            ${renderWeaponSelectors(prog)}
          </div>
        ` : ''}

        <div class="weapon-masteries-list" style="margin-top: 12px; display:flex; flex-direction:column; gap:10px;">
          ${renderWeaponMasteryList(prog)}
        </div>
      </div>

      <!-- 6. ARMOR FORGE -->
      <div class="parchment-card section-card">
        <h3 class="card-title">🛡️ Armor Forge</h3>
        <p class="section-desc">Melt collected Essence to reinforce your defenses. Higher forge tiers grant massive Armor multipliers.</p>
        
        ${renderArmorForge(prog)}
      </div>

      <!-- 7. RELIC FORGE -->
      <div class="parchment-card section-card">
        <h3 class="card-title">💍 Relic Forge</h3>
        <p class="section-desc">Spend Relic Shards gathered from completed weekly milestones to forge mystical passives.</p>
        
        <!-- Upgrade Materials Bar -->
        <div class="materials-bar-relics">
          <div class="material-chip">✨ <strong>${prog.materials.essence}</strong> Essence</div>
          <div class="material-chip">🧩 <strong>${prog.materials.relicShards}</strong> Shards</div>
        </div>

        <div class="relics-list" style="display:flex; flex-direction:column; gap:8px;">
          ${renderRelicsList(prog)}
        </div>
      </div>

      <!-- 8. MONSTER SLAYER CODEX -->
      <div class="parchment-card section-card">
        <h3 class="card-title">comp compendium Compendium</h3>
        <div class="codex-bonuses">
          <div class="codex-bonuses-title">Active Codex Buffs:</div>
          <div class="codex-buffs-lines">
            ${renderCodexBuffs(prog)}
          </div>
        </div>
        <div class="codex-compendium-list">
          ${renderCodexMonsters(prog)}
        </div>
      </div>

      <!-- 9. ADVENTURER'S CHRONICLE LOG -->
      <div class="parchment-card section-card chronicle-logs-box">
        <h3 class="card-title">📜 Adventurer's Chronicle</h3>
        <div class="chronicle-events-list">
          ${state.profile.chronicleLog.map(event => `
            <div class="chronicle-event">
              <span class="event-time">${new Date(event.time).toLocaleDateString()}</span>
              <span class="event-arrow">→</span>
              <span class="event-text">${event.text}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- 10. SYSTEM SETTINGS -->
      <div class="parchment-card section-card settings-box">
        <h3 class="card-title">⚙️ Ledger Settings</h3>
        
        <div class="settings-row" style="margin-top: 10px; display: flex; gap: 8px;">
          <input type="text" id="input-hero-name" value="${state.profile.name}" class="parchment-input" style="flex: 1;" placeholder="Enter new name...">
          <button class="btn-secondary" id="btn-rename-hero">Rename</button>
        </div>

        <div class="settings-row" style="margin-top: 20px;">
          <button class="btn-primary" id="btn-reset-save" style="background: var(--ruby-crimson); width: 100%;">🔥 Burn Ledger (Wipe Save)</button>
        </div>
      </div>

    </div>
  `;

  // CSS moved to styles.css
  setupEventListeners(container);
}

function getClassLoreQuote(cls) {
  const quotes = {
    Commoner: "A simple seeker, writing their destiny one quest at a time.",
    Wanderer: "The road is their sanctuary, travel fuels their blade.",
    "Street Rat": "Born in the shadows, trained to slip past the deadliest strikes.",
    Fighter: "A steel resolve that cleaves clean through any obstacle.",
    Rogue: "Fades into the mists, striking only when the odds are fatal.",
    Mage: "Channelling deep focus into direct elemental fire blasts.",
    Paladin: "A fortress of virtue, standing tall against the darkness.",
    Warden: "Guardian of nature's sanctuaries and peaceful rest.",
    Warlord: "A tactical strategist, plotting consistency to conquer empires.",
    "God-Warrior": "A legendary avatar of absolute discipline and steel habits."
  };
  return quotes[cls] || "A dedicated ledger keeper.";
}

function renderDestinyPaths(state, derived, prog) {
  // Find current tier
  const currentClassObj = CLASS_PATHS.find(c => c.name === prog.currentClass);
  const currentTier = currentClassObj ? currentClassObj.tier : 1;

  // Only show the current class and the immediately next tier of classes
  const classes = CLASS_PATHS.filter(c => c.name === prog.currentClass || c.tier === currentTier + 1);

  return classes.map(c => {
    const isCurrent = prog.currentClass === c.name;
    
    // Check if requirements met
    let met = true;
    let reqTextList = [];
    
    for (const [key, reqVal] of Object.entries(c.reqs)) {
      if (key === 'level') {
        const val = state.profile.totalLevel;
        reqTextList.push(`Lvl ${val}/${reqVal}`);
        if (val < reqVal) met = false;
      } else {
        const val = derived.skillsLevels[key] || 1;
        reqTextList.push(`${key.toUpperCase()} ${val}/${reqVal}`);
        if (val < reqVal) met = false;
      }
    }

    const reqLabel = reqTextList.length > 0 ? reqTextList.join(', ') : c.desc;
    const abilityLabel = c.ability ? `<div class="destiny-ability" style="color: var(--amber-gold); font-size: 0.85em; margin-top: 4px;">✨ ${c.ability}</div>` : '';

    let buttonHtml = '';
    if (isCurrent) {
      buttonHtml = `<span class="class-badge-status current">Active</span>`;
    } else if (met) {
      buttonHtml = `<button class="btn-secondary btn-swap-class" data-class="${c.name}">Advance</button>`;
    } else {
      buttonHtml = `<span class="class-badge-status locked">Locked</span>`;
    }

    return `
      <div class="destiny-card ${isCurrent ? 'active' : ''} ${met ? 'unlocked' : 'locked'}">
        <div class="destiny-info">
          <div class="destiny-name">${c.name} <span class="destiny-tier">Tier ${c.tier}</span></div>
          <div class="destiny-reqs ${met ? 'met' : 'unmet'}">${reqLabel}</div>
          ${abilityLabel}
        </div>
        <div class="destiny-action">
          ${buttonHtml}
        </div>
      </div>
    `;
  }).join('');
}

function renderSkillsList(skills, levels) {
  const skillEmojis = {
    strength: '⚔️ Strength',
    agility: '🏃 Agility',
    wisdom: '📖 Wisdom',
    intelligence: '🧪 Intelligence',
    insight: '👁️ Insight',
    vitality: '💤 Vitality',
    charisma: '🍻 Charisma',
    cleaning: '🧹 Cleaning'
  };

  const skillInfluences = {
    strength: 'Increases Attack & Damage',
    vitality: 'Increases Defense & Max HP',
    agility: 'Contributes to Archetype & Char Lvl',
    wisdom: 'Contributes to Archetype & Char Lvl',
    intelligence: 'Contributes to Archetype & Char Lvl',
    insight: 'Contributes to Archetype & Char Lvl',
    charisma: 'Contributes to Archetype & Char Lvl',
    cleaning: 'Contributes to Archetype & Char Lvl'
  };

  return Object.entries(skills).map(([skill, xp]) => {
    const lvl = levels[skill];
    const baseXP = xpForLevel(lvl);
    const nextXP = xpForLevel(lvl + 1);
    
    // XP within current level
    const lvlXp = xp - baseXP;
    const lvlRange = nextXP - baseXP;
    const pct = Math.min(100, Math.floor((lvlXp / lvlRange) * 100));

    return `
      <div class="skill-stack-row">
        <div class="skill-row-basics">
          <span class="skill-label-name">${skillEmojis[skill]}</span>
          <span class="skill-level-number">Lvl ${lvl}</span>
        </div>
        <div class="skill-influence-label" style="font-size: 0.65rem; color: var(--ink-muted); margin-bottom: 6px;">${skillInfluences[skill]}</div>
        <div class="skill-row-bar">
          <div class="skill-bar-fill" style="width: ${pct}%"></div>
          <span class="skill-bar-text">${xp.toLocaleString()} / ${nextXP.toLocaleString()} XP</span>
        </div>
      </div>
    `;
  }).join('');
}

function renderWeaponSelectors(prog) {
  return Object.entries(WEAPON_PRESETS).map(([key, value]) => {
    const isEquipped = prog.equippedWeapon === key;
    return `
      <button class="weapon-select-btn ${isEquipped ? 'equipped' : ''}" data-key="${key}">
        <span class="w-icon">${value.icon}</span>
        <span class="w-name">${value.name}</span>
        <span class="w-stats">+${value.attack} Att / +${value.damage} Dmg</span>
      </button>
    `;
  }).join('');
}

function renderWeaponMasteryList(prog) {
  const paths = [
    { key: "blade", name: "Blade Mastery", icon: "⚔️", desc: "Swords. Flat accuracy rating." },
    { key: "axe", name: "Axe Mastery", icon: "🪓", desc: "Axes. Heavy physical damage." },
    { key: "spear", name: "Spear Mastery", icon: "🔱", desc: "Spears. Balance and reach." },
    { key: "dagger", name: "Dagger Mastery", icon: "🏹", desc: "Bows/Daggers. High agility crit rate." },
    { key: "staff", name: "Staff Mastery", icon: "🪄", desc: "Staves. Magic damage scaling." },
    { key: "focus", name: "Focus Mastery", icon: "🔮", desc: "Orbs/Books. Crit multipliers." }
  ];

  return paths.map(p => {
    const xp = prog.weaponXP[p.key] || 0;
    const details = getWeaponMasteryDetails(xp);
    const pct = Math.min(100, Math.floor((details.current / details.next) * 100));

    // Render ranks as stars (1 star per 5 ranks)
    const starCount = Math.floor(details.rank / 4);
    const stars = '★'.repeat(starCount) + '☆'.repeat(5 - starCount);

    return `
      <div class="weapon-mastery-row">
        <div class="weapon-row-header">
          <span class="weapon-title">${p.icon} <strong>${p.name}</strong> (Rank ${details.rank}) <span class="stars-gold">${stars}</span></span>
          <span class="weapon-xp-txt">${xp.toLocaleString()} XP</span>
        </div>
        <div class="weapon-row-bar">
          <div class="weapon-bar-fill" style="width:${pct}%"></div>
          <span class="weapon-bar-label">${details.current} / ${details.next} XP</span>
        </div>
      </div>
    `;
  }).join('');
}

function renderArmorForge(prog) {
  const forge = prog.armorForge || { level: 1, essenceInvested: 0 };
  const level = forge.level;
  const rating = (level - 1) * 15;
  const cost = getArmorForgeUpgradeCost(level);
  
  const pct = level >= 10 ? 100 : Math.min(100, Math.floor((forge.essenceInvested / cost) * 100));
  const currentTier = ARMOR_TIERS[level - 1] || "Rags";
  const nextTier = ARMOR_TIERS[level] || "MAX LEVEL";

  return `
    <div class="armor-forge-box">
      <div class="armor-forge-details">
        <div class="armor-rating-card">
          <span class="stat-val font-gold" style="font-size:1.4rem;">${rating}</span>
          <span class="stat-label">Armor Rating</span>
        </div>
        <div class="armor-tier-meta">
          <strong>Current Tier:</strong> ${currentTier} (Lvl ${level}) <br>
          <strong>Next Tier:</strong> ${nextTier} ${level < 10 ? `(+15 Def)` : ''}
        </div>
      </div>

      <div class="forge-bar-row">
        <div class="forge-xp-label">Essence Invested: ${level >= 10 ? 'MAXED' : `${forge.essenceInvested} / ${cost}`}</div>
        <div class="weapon-row-bar" style="height:15px; margin-top:2px;">
          <div class="weapon-bar-fill" style="width:${pct}%; background: linear-gradient(90deg, var(--ruby-crimson), var(--ruby-light));"></div>
        </div>
      </div>

      <div class="forge-upgrade-action" style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
        <span class="backpack-essence-count">✨ Pouch: <strong>${prog.materials.essence}</strong> Essence</span>
        <button class="btn-primary" id="btn-invest-essence" ${level >= 10 || prog.materials.essence <= 0 ? 'disabled' : ''}>
          🔨 Invest Essence
        </button>
      </div>
    </div>
  `;
}

function renderRelicsList(prog) {
  const relics = [
    { id: "Iron Ring", tier: "Bronze", costE: 15, costS: 5, effect: "+2 Defense rating globally.", reqLvl: 10 },
    { id: "Lucky Coin", tier: "Bronze", costE: 15, costS: 5, effect: "+25% gold drops on adventures.", reqLvl: 10 },
    { id: "Wolf Fang", tier: "Bronze", costE: 20, costS: 5, effect: "+2 Attack accuracy and +1 Damage.", reqLvl: 10 },
    { id: "Assassin's Mark", tier: "Silver", costE: 40, costS: 10, effect: "+3 Attack accuracy and +10% Crit.", reqLvl: 30 },
    { id: "Crown of Momentum", tier: "Gold", costE: 80, costS: 20, effect: "+3 Attack accuracy and +1 Defense.", reqLvl: 50 },
    { id: "Heart of the Titan", tier: "Mythic", costE: 150, costS: 35, effect: "+20 Maximum Health globally.", reqLvl: 75 },
    { id: "Worldbreaker", tier: "Legendary", costE: 300, costS: 50, effect: "+8 Attack accuracy, +4 Damage, +2 Def.", reqLvl: 99 }
  ];

  return relics.map(r => {
    const isCrafted = prog.unlockedRelics.includes(r.id);
    const isEquipped = prog.equippedRelic === r.id;
    const canCraft = !isCrafted && prog.materials.essence >= r.costE && prog.materials.relicShards >= r.costS;
    
    let btnHtml = "";
    if (isEquipped) {
      btnHtml = `<span class="class-badge-status current">Equipped</span>`;
    } else if (isCrafted) {
      btnHtml = `<button class="btn-secondary btn-equip-relic" data-relic="${r.id}">Equip</button>`;
    } else {
      btnHtml = `<button class="btn-primary btn-craft-relic" data-relic="${r.id}" data-essence="${r.costE}" data-shards="${r.costS}" ${canCraft ? '' : 'disabled'}>Forge</button>`;
    }

    return `
      <div class="relic-row-card ${isEquipped ? 'active' : ''}">
        <div class="relic-info-meta">
          <div class="relic-name">
            <strong>${r.id}</strong> 
            <span class="relic-badge-tier" style="background-color: ${r.tier === 'Legendary' ? 'var(--gold-primary)' : r.tier === 'Mythic' ? 'var(--ruby-crimson)' : 'var(--sapphire-blue)'}">${r.tier}</span>
          </div>
          <div class="relic-effect">${r.effect}</div>
        </div>
        <div class="relic-action-button">
          ${btnHtml}
        </div>
      </div>
    `;
  }).join('');
}

function renderCodexBuffs(prog) {
  let critBonus = 0;
  let defBonus = 0;
  let dmgBonus = 0;

  for (const [mName, kills] of Object.entries(prog.monsterCodex)) {
    if (kills >= 10) critBonus += 0.25;
    if (kills >= 100) defBonus += 1;
    if (kills >= 1000) dmgBonus += 2;
  }

  return `
    <div class="codex-buff-line">✨ Global Critical Strike rate: <strong>+${critBonus.toFixed(2)}%</strong></div>
    <div class="codex-buff-line">🛡️ Global Defense rating: <strong>+${defBonus} armor</strong></div>
    <div class="codex-buff-line">🪓 Global Max Damage rating: <strong>+${dmgBonus} damage</strong></div>
  `;
}

function renderCodexMonsters(prog) {
  let listHtml = [];
  
  DUNGEONS.forEach(dungeon => {
    const monsters = [...dungeon.monsters, dungeon.boss];
    const monsterLines = monsters.map(m => {
      const kills = prog.monsterCodex[m.name] || 0;
      return `
        <div class="codex-monster-row">
          <div class="codex-monster-info">
            <strong>${m.name}</strong>
            <span class="codex-monster-kills">Killed: ${kills}</span>
          </div>
          <div class="codex-monster-checkmarks">
            <span class="chk ${kills >= 1 ? 'chk-active' : ''}" title="1+ kill: Unlocked">🔓</span>
            <span class="chk ${kills >= 10 ? 'chk-active' : ''}" title="10+ kills: +0.25% Crit">⚔️</span>
            <span class="chk ${kills >= 100 ? 'chk-active' : ''}" title="100+ kills: +1 Def">🛡️</span>
            <span class="chk ${kills >= 1000 ? 'chk-active' : ''}" title="1000+ kills: +2 Damage">🪓</span>
          </div>
        </div>
      `;
    }).join('');

    listHtml.push(`
      <div class="codex-dungeon-section">
        <h5 class="codex-dungeon-title">${dungeon.icon} ${dungeon.name}</h5>
        <div class="codex-monsters-grid">
          ${monsterLines}
        </div>
      </div>
    `);
  });

  return listHtml.join('');
}

function setupEventListeners(container) {
  // Buyback momentum handler
  const btnBuyback = container.querySelector('#btn-buyback-momentum');
  if (btnBuyback) {
    btnBuyback.addEventListener('click', () => {
      const success = buyMomentumRecovery();
      if (success) {
        // Spawn floating ignition alert
        const rect = btnBuyback.getBoundingClientRect();
        const splat = document.createElement('span');
        splat.className = 'splat-text splat-gold';
        splat.textContent = '🔥 Flame Ignited!';
        splat.style.left = `${rect.left + rect.width/2}px`;
        splat.style.top = `${rect.top}px`;
        document.body.appendChild(splat);
        setTimeout(() => splat.remove(), 800);

        renderCharacter(container);
        
        // Update top status bars
        document.querySelector('#header-gold').textContent = getState().profile.gold;
        document.querySelector('#flame-meter-fill').style.width = `${getState().profile.momentum}%`;
        import('../state.js').then(mod => {
          document.querySelector('#flame-multiplier').textContent = `${mod.getMomentumMultiplier()}x`;
        });
      } else {
        alert("⚠️ Insufficient coins in your guild pouch!");
      }
    });
  }

  // Class swap buttons
  container.querySelectorAll('.btn-swap-class').forEach(btn => {
    btn.addEventListener('click', () => {
      const cls = btn.getAttribute('data-class');
      changeClass(cls);
      renderCharacter(container);
    });
  });

  // Toggle Weapon Selector Panel
  const btnToggleWeapon = container.querySelector('#btn-toggle-weapon-selector');
  if (btnToggleWeapon) {
    btnToggleWeapon.addEventListener('click', () => {
      showWeaponSelector = !showWeaponSelector;
      renderCharacter(container);
    });
  }

  // Weapon swap clicks
  container.querySelectorAll('.weapon-select-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const weaponKey = btn.getAttribute('data-key');
      switchWeapon(weaponKey);
      showWeaponSelector = false;
      renderCharacter(container);
    });
  });

  // Invest Essence
  const btnInvest = container.querySelector('#btn-invest-essence');
  if (btnInvest) {
    btnInvest.addEventListener('click', () => {
      const state = getState();
      const currentEss = state.progression.materials.essence;
      if (currentEss <= 0) return;
      
      const res = investEssence(currentEss);
      if (res && res.success) {
        alert(res.message);
        renderCharacter(container);
      }
    });
  }

  // Relic Equip clicks
  container.querySelectorAll('.btn-equip-relic').forEach(btn => {
    btn.addEventListener('click', () => {
      const relic = btn.getAttribute('data-relic');
      equipRelic(relic);
      renderCharacter(container);
    });
  });

  // Relic Forge clicks
  container.querySelectorAll('.btn-craft-relic').forEach(btn => {
    btn.addEventListener('click', () => {
      const relic = btn.getAttribute('data-relic');
      const essence = parseInt(btn.getAttribute('data-essence'));
      const shards = parseInt(btn.getAttribute('data-shards'));
      const success = craftRelic(relic, essence, shards);
      if (success) {
        renderCharacter(container);
      } else {
        alert("⚠️ Insufficient materials to craft Relic! Complete weekly milestones to gather Relic Shards.");
      }
    });
  });

  // Settings
  const btnRename = container.querySelector('#btn-rename-hero');
  if (btnRename) {
    btnRename.addEventListener('click', () => {
      const newName = container.querySelector('#input-hero-name').value;
      updateHeroName(newName);
      renderCharacter(container);
    });
  }

  const btnReset = container.querySelector('#btn-reset-save');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      const confirmReset = confirm("Are you absolutely sure you want to burn your ledger? ALL progress, stats, and gold will be permanently lost.");
      if (confirmReset) {
        resetSave();
      }
    });
  }
}

function getDynamicAvatarShieldSVG(archetype) {
  let paths = "";
  let baseColor = "var(--ink-charcoal)";

  if (archetype === "Warrior" || archetype === "Crafter") {
    baseColor = "var(--ruby-crimson)";
    paths = `
      <path d="M20 20 C20 20, 20 60, 50 85 C80 60, 80 20, 80 20 Z" fill="${baseColor}" stroke="var(--ink-charcoal)" stroke-width="4" />
      <path d="M30 25 C30 25, 30 55, 50 75 C70 55, 70 25, 70 25 Z" fill="rgba(0,0,0,0.15)" />
      <path d="M35 30 L65 60 M65 30 L35 60" stroke="var(--gold-primary)" stroke-width="6" stroke-linecap="round" />
      <circle cx="50" cy="45" r="10" fill="var(--parchment-light)" stroke="var(--ink-charcoal)" stroke-width="3" />
    `;
  } else if (archetype === "Ranger" || archetype === "Alchemist") {
    baseColor = "var(--emerald-green)";
    paths = `
      <path d="M50 10 L85 50 L50 90 L15 50 Z" fill="${baseColor}" stroke="var(--ink-charcoal)" stroke-width="4" />
      <path d="M50 20 L75 50 L50 80 L25 50 Z" fill="rgba(0,0,0,0.15)" />
      <path d="M50 25 V75 M40 35 L50 25 L60 35" stroke="var(--gold-primary)" stroke-width="5" stroke-linecap="round" fill="none" />
      <circle cx="50" cy="50" r="6" fill="var(--ruby-light)" />
    `;
  } else if (archetype === "Scholar" || archetype === "Merchant") {
    baseColor = "var(--sapphire-blue)";
    paths = `
      <circle cx="50" cy="50" r="40" fill="${baseColor}" stroke="var(--ink-charcoal)" stroke-width="4" />
      <circle cx="50" cy="50" r="30" fill="rgba(0,0,0,0.15)" />
      <path d="M35 38 H65 V62 H35 Z" fill="var(--parchment-light)" stroke="var(--ink-charcoal)" stroke-width="3" />
      <path d="M50 38 V62" stroke="var(--ink-charcoal)" stroke-width="2" />
      <circle cx="50" cy="50" r="4" fill="var(--gold-primary)" />
    `;
  } else {
    baseColor = "var(--parchment-dark)";
    paths = `
      <circle cx="50" cy="50" r="40" fill="${baseColor}" stroke="var(--ink-charcoal)" stroke-width="4" />
      <circle cx="50" cy="50" r="30" fill="var(--parchment-light)" stroke="rgba(0,0,0,0.1)" stroke-width="2" />
      <circle cx="50" cy="50" r="10" fill="var(--gold-primary)" stroke="var(--ink-charcoal)" stroke-width="3" />
    `;
  }

  return paths;
}


