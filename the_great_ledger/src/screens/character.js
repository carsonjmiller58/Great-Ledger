import { getState, getDerivedStats, equipItem, unequipItem, sellItem, buyMomentumRecovery, changeClass, upgradeCore, equipCore, craftRelic, equipRelic } from '../state.js';
import { xpForLevel, weaponRankForXp, getWeaponMasteryDetails, DUNGEONS } from '../formulas.js';

let activeTab = "stats";

export function renderCharacter(container) {
  const state = getState();
  const derived = getDerivedStats();
  const gear = state.inventory.equipped;
  const prog = state.progression || {
    currentClass: "Commoner",
    equippedCore: "Iron",
    coreRanks: { Iron: 1 },
    equippedRelic: null,
    unlockedRelics: [],
    weaponXP: { blade: 0, axe: 0, spear: 0, dagger: 0, staff: 0, focus: 0 },
    monsterCodex: {},
    materials: { essence: 0, coreFragments: 0, relicShards: 0 }
  };

  container.innerHTML = `
    <div class="character-screen">
      
      <!-- Hero Header Panel -->
      <div class="parchment-card hero-header-box">
        <div class="avatar-shield-frame">
          <svg viewBox="0 0 100 100" class="hero-svg-shield">
            ${getDynamicAvatarShieldSVG(state.profile.archetype)}
          </svg>
        </div>
        <div class="hero-titles">
          <h1 class="hero-name-label">${state.profile.name}</h1>
          <span class="hero-subbadge">${prog.currentClass} (${state.profile.archetype})</span>
        </div>

        <!-- Buyback Momentum box -->
        <div class="momentum-buyback-box">
          <div class="buyback-text">
            🔥 <strong>Flame consistency:</strong> ${state.profile.momentum}%
          </div>
          <button class="btn-secondary btn-buyback" id="btn-buyback-momentum">
            🪙 Recover Momentum (-${Math.floor(40 + (state.profile.momentum * 1.5))}g)
          </button>
        </div>
      </div>

      <!-- Tab Navigation Menu -->
      <div class="character-tabs">
        <button class="char-tab-btn ${activeTab === 'stats' ? 'active' : ''}" data-tab="stats">🛡️ Stats</button>
        <button class="char-tab-btn ${activeTab === 'classes' ? 'active' : ''}" data-tab="classes">⚔️ Class/Mastery</button>
        <button class="char-tab-btn ${activeTab === 'cores' ? 'active' : ''}" data-tab="cores">🔮 Cores/Relics</button>
        <button class="char-tab-btn ${activeTab === 'codex' ? 'active' : ''}" data-tab="codex">👾 Codex</button>
      </div>

      <!-- Tab Content Area -->
      <div id="character-tab-content" style="margin-top: 12px; display: flex; flex-direction: column; gap: 12px;">
        ${renderActiveTabContent(activeTab, state, derived, gear, prog)}
      </div>

    </div>
  `;

  injectCharacterCSS();

  // Setup Event Listeners
  setupEventListeners(container);
}

function renderActiveTabContent(tab, state, derived, gear, prog) {
  if (tab === "stats") {
    return `
      <!-- Combat Statistics Dashboard -->
      <div class="parchment-card stats-dashboard">
        <h3 class="card-title">⚔️ Combat Attributes</h3>
        <div class="combat-grid">
          <div class="combat-stat-card">
            <span class="stat-icon">🗡️</span>
            <div class="stat-info">
              <span class="stat-val">${derived.combatStats.attack}</span>
              <span class="stat-label">Attack Rating</span>
            </div>
          </div>
          <div class="combat-stat-card">
            <span class="stat-icon">🛡️</span>
            <div class="stat-info">
              <span class="stat-val">${derived.combatStats.defense}</span>
              <span class="stat-label">Defense Rating</span>
            </div>
          </div>
          <div class="combat-stat-card">
            <span class="stat-icon">🪓</span>
            <div class="stat-info">
              <span class="stat-val">1 - ${derived.combatStats.damageRange}</span>
              <span class="stat-label">Damage Range</span>
            </div>
          </div>
          <div class="combat-stat-card">
            <span class="stat-icon">❤️</span>
            <div class="stat-info">
              <span class="stat-val">${derived.combatStats.maxHP}</span>
              <span class="stat-label">Max Health</span>
            </div>
          </div>
          <!-- Weapon Range Stat -->
          <div class="combat-stat-card" style="grid-column: span 2; justify-content: center; gap: 15px;">
            <span class="stat-icon">${
              gear.mainHand && (gear.mainHand.name.toLowerCase().includes("bow") || gear.mainHand.name.toLowerCase().includes("staff")) 
                ? '🏹' : '⚔️'
            }</span>
            <div class="stat-info" style="align-items: center;">
              <span class="stat-val">${(() => {
                const mainHand = gear.mainHand;
                if (mainHand) {
                  const wName = mainHand.name.toLowerCase();
                  if (wName.includes("bow") || wName.includes("staff") || wName.includes("wand")) {
                    return "5m (Ranged)";
                  } else if (wName.includes("halberd")) {
                    return "2m (Polearm)";
                  }
                }
                return "1m (Melee)";
              })()}</span>
              <span class="stat-label">Equipped Combat Range</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Equipment Slots Frame -->
      <div class="parchment-card equipment-grid-box">
        <h3 class="card-title">🛡️ Equipped Gear</h3>
        <div class="equipment-slots-layout">
          ${renderEquipSlot(gear, 'helmet', 'Helm', '👑')}
          ${renderEquipSlot(gear, 'chestArmor', 'Chest', '👕')}
          ${renderEquipSlot(gear, 'gloves', 'Gloves', '🧤')}
          ${renderEquipSlot(gear, 'boots', 'Boots', '🥾')}
          ${renderEquipSlot(gear, 'mainHand', 'Weapon', '🗡️')}
          ${renderEquipSlot(gear, 'offHand', 'Shield', '🛡️')}
        </div>
      </div>

      <!-- OSRS Skills Stack -->
      <div class="parchment-card skills-stack-box">
        <h3 class="card-title">📖 OSRS Skill Masteries</h3>
        <div class="skills-stack" id="skills-container-list">
          ${renderSkillsList(state.skills, derived.skillsLevels)}
        </div>
      </div>

      <!-- Backpack Grid -->
      <div class="parchment-card backpack-box">
        <h3 class="card-title">🎒 Backpack Inventory</h3>
        <div class="backpack-grid" id="backpack-grid-items">
          ${renderBackpackItems(state.inventory.backpack)}
        </div>
      </div>
    `;
  } else if (tab === "classes") {
    return `
      <!-- Active Class Badge -->
      <div class="parchment-card">
        <h3 class="card-title">🛡️ Select Class Evolution</h3>
        <p class="description-text" style="margin-bottom:12px;">Classes define combat passives and active abilities. Level up OSRS stats to meet guild requirements.</p>
        
        <div class="class-selection-container" style="display:flex; flex-direction:column; gap:8px;">
          ${renderClassRegistry(state, derived, prog)}
        </div>
      </div>

      <!-- Weapon masteries -->
      <div class="parchment-card">
        <h3 class="card-title">🪓 Weapon Masteries</h3>
        <p class="description-text" style="margin-bottom:12px;">XP is earned by focusing with the weapon type equipped. Higher ranks grant massive combat ratings.</p>
        
        <div class="weapon-masteries-stack" style="display:flex; flex-direction:column; gap:10px;">
          ${renderWeaponMasteryList(prog)}
        </div>
      </div>
    `;
  } else if (tab === "cores") {
    return `
      <!-- Materials bar -->
      <div class="parchment-card materials-bar" style="background-color: var(--parchment-dark);">
        <h4 class="card-title" style="border:none; margin:0 0 6px 0; font-size:0.75rem; text-transform:uppercase;">💎 Account Upgrade Materials</h4>
        <div class="materials-grid" style="display:flex; gap:8px; justify-content:space-between;">
          <div class="material-chip" style="background-color:rgba(0,0,0,0.03); border:1px solid var(--ink-charcoal); border-radius:6px; padding:4px 8px; font-size:0.7rem; font-weight:700;">✨ <strong>${prog.materials.essence}</strong> Essence</div>
          <div class="material-chip" style="background-color:rgba(0,0,0,0.03); border:1px solid var(--ink-charcoal); border-radius:6px; padding:4px 8px; font-size:0.7rem; font-weight:700;">⚙️ <strong>${prog.materials.coreFragments}</strong> Fragments</div>
          <div class="material-chip" style="background-color:rgba(0,0,0,0.03); border:1px solid var(--ink-charcoal); border-radius:6px; padding:4px 8px; font-size:0.7rem; font-weight:700;">🧩 <strong>${prog.materials.relicShards}</strong> Shards</div>
        </div>
      </div>

      <!-- Armor cores -->
      <div class="parchment-card">
        <h3 class="card-title">🔮 Armor Core Upgrades</h3>
        <p class="description-text" style="margin-bottom:12px;">Account-wide cores providing specialized survival modifiers. Spend Essences & Fragments to rank up.</p>
        
        <div class="cores-container" style="display:flex; flex-direction:column; gap:8px;">
          ${renderCoresList(prog)}
        </div>
      </div>

      <!-- Relics workstation -->
      <div class="parchment-card">
        <h3 class="card-title">👑 Relic Forge</h3>
        <p class="description-text" style="margin-bottom:12px;">Rare items crafted with Relic Shards that grant powerful passive utility buffs.</p>
        
        <div class="relics-container" style="display:flex; flex-direction:column; gap:8px;">
          ${renderRelicsList(prog)}
        </div>
      </div>
    `;
  } else if (tab === "codex") {
    return `
      <div class="parchment-card codex-summary-card">
        <h3 class="card-title">👾 Monster Slayer Codex</h3>
        <p class="description-text" style="margin-bottom:12px;">Beating monsters logs kills. 10/100/1000 kills unlock account prestige stats.</p>
        
        <div class="codex-bonuses-badge" style="background-color:rgba(0,0,0,0.02); border:1px dashed rgba(44,37,30,0.2); border-radius:8px; padding:10px; text-align:left;">
          <strong style="font-family:var(--font-header); font-size:0.72rem; color:var(--gold-primary); text-transform:uppercase;">⚔️ Current Active Codex Buffs:</strong>
          <div class="active-buffs-list" style="margin-top:6px; display:flex; flex-direction:column; gap:4px; font-size:0.75rem; font-weight:700; color:var(--emerald-green);">
            ${renderCodexBuffs(prog)}
          </div>
        </div>
      </div>

      <div class="parchment-card">
        <h4 class="card-title">📜 Beast Compendium</h4>
        <div class="codex-monsters-list" style="display:flex; flex-direction:column; gap:8px;">
          ${renderCodexMonsters(prog)}
        </div>
      </div>
    `;
  }
}

function renderClassRegistry(state, derived, prog) {
  const classes = [
    { name: "Commoner", tier: 1, desc: "Starter class. Balanced combat values.", reqText: "Unlock: Free" },
    { name: "Wanderer", tier: 1, desc: "+2 Base damage rating.", reqText: "Unlock: Level 1" },
    { name: "Street Rat", tier: 1, desc: "+10% Dodge rate.", reqText: "Unlock: Level 1" },
    
    { name: "Fighter", tier: 2, desc: "+15% Critical Chance, +1 damage limit.", reqText: "Req: Strength 10, Vitality 5", check: () => (derived.skillsLevels.strength >= 10 && derived.skillsLevels.vitality >= 5) },
    { name: "Rogue", tier: 2, desc: "+20% Dodge rate, active [Vanish] skill.", reqText: "Req: Agility 10, Insight 5", check: () => (derived.skillsLevels.agility >= 10 && derived.skillsLevels.insight >= 5) },
    { name: "Mage", tier: 2, desc: "Spellcaster, active [Fireball] burning blast.", reqText: "Req: Intelligence 10, Wisdom 5", check: () => (derived.skillsLevels.intelligence >= 10 && derived.skillsLevels.wisdom >= 5) },
    
    { name: "Paladin", tier: 3, desc: "+4 Defense rating, +15 Max HP block.", reqText: "Req: Character Level 20+", check: () => state.profile.totalLevel >= 20 },
    { name: "Warden", tier: 3, desc: "+5 Defense rating, +20 Max HP block.", reqText: "Req: Character Level 20+", check: () => state.profile.totalLevel >= 20 },
    
    { name: "Warlord", tier: 4, desc: "+5 Attack accuracy, +3 Damage limit, +2 Defense.", reqText: "Req: Character Level 40+", check: () => state.profile.totalLevel >= 40 },
    
    { name: "God-Warrior", tier: 5, desc: "+10 Attack accuracy, +6 Damage limit, +40 Max HP.", reqText: "Req: Character Level 75+", check: () => state.profile.totalLevel >= 75 }
  ];

  return classes.map(c => {
    const isCurrent = prog.currentClass === c.name;
    const canUnlock = c.tier === 1 || (c.check && c.check());
    
    let btnHtml = "";
    if (isCurrent) {
      btnHtml = `<span class="class-status-badge current" style="background-color:var(--emerald-green); color:var(--parchment-light); border-radius:4px; font-size:0.62rem; font-weight:700; text-transform:uppercase; padding:2px 6px;">Active</span>`;
    } else if (canUnlock) {
      btnHtml = `<button class="btn-secondary btn-class-swap" data-class="${c.name}" style="font-size:0.65rem; padding:4px 8px; box-shadow:none;">Select</button>`;
    } else {
      btnHtml = `<span class="class-status-badge locked" title="Requirements not met" style="background-color:rgba(0,0,0,0.05); border:1px solid rgba(0,0,0,0.1); border-radius:4px; font-size:0.62rem; font-weight:700; text-transform:uppercase; padding:2px 6px; color:var(--ink-muted);">Locked</span>`;
    }

    return `
      <div class="class-card" style="border: 1px solid rgba(44,37,30,0.12); padding:10px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; background-color:${isCurrent ? 'rgba(59, 96, 67, 0.04)' : 'rgba(0,0,0,0.01)'}; border-color:${isCurrent ? 'var(--emerald-green)' : 'rgba(44,37,30,0.12)'}">
        <div class="class-card-left" style="display:flex; flex-direction:column; gap:2px; text-align:left;">
          <div><strong style="font-size:0.85rem; color:var(--ink-charcoal);">${c.name}</strong> <span style="font-size:0.55rem; background-color:var(--parchment-dark); padding:1px 4px; border-radius:3px; font-weight:700; text-transform:uppercase;">Tier ${c.tier}</span></div>
          <div style="font-size:0.75rem; color:var(--ink-muted); line-height:1.2;">${c.desc}</div>
          <div style="font-size:0.6rem; color:var(--gold-primary); font-weight:700; margin-top:2px;">${c.reqText}</div>
        </div>
        <div class="class-card-right">
          ${btnHtml}
        </div>
      </div>
    `;
  }).join('');
}

function renderWeaponMasteryList(prog) {
  const paths = [
    { key: "blade", name: "Blade Mastery", icon: "⚔️", desc: "Swords and Halberds. Flat accuracy rating." },
    { key: "axe", name: "Axe Mastery", icon: "🪓", desc: "Axes. Heavy physical damage scaling." },
    { key: "spear", name: "Spear Mastery", icon: "🔱", desc: "Spears and Polearms. Balance and range." },
    { key: "dagger", name: "Dagger Mastery", icon: "🗡️", desc: "Daggers and Bows. Agility critical rate." },
    { key: "staff", name: "Staff Mastery", icon: "🪄", desc: "Staves. Spell power damage scaling." },
    { key: "focus", name: "Focus Mastery", icon: "🔮", desc: "Orbs and books. RNG crit multipliers." }
  ];

  return paths.map(p => {
    const xp = prog.weaponXP[p.key] || 0;
    const details = getWeaponMasteryDetails(xp);
    const pct = Math.min(100, Math.floor((details.current / details.next) * 100));

    return `
      <div class="weapon-mastery-row" style="display:flex; flex-direction:column; gap:2px; text-align:left;">
        <div class="weapon-row-header" style="display:flex; justify-content:space-between; font-size:0.78rem;">
          <span class="weapon-title">${p.icon} <strong>${p.name}</strong> (Rank ${details.rank})</span>
          <span class="weapon-xp-txt" style="color:var(--ink-muted); font-size:0.7rem;">${xp.toLocaleString()} XP</span>
        </div>
        <div class="weapon-row-bar" style="width:100%; height:12px; background-color:rgba(44,37,30,0.1); border-radius:4px; border:1px solid var(--ink-charcoal); position:relative; overflow:hidden;">
          <div class="weapon-bar-fill" style="width:${pct}%; height:100%; background:linear-gradient(90deg, var(--gold-primary), var(--gold-glow)); border-radius:3px;"></div>
          <span class="weapon-bar-label" style="position:absolute; top:0; left:0; width:100%; height:100%; display:flex; justify-content:center; align-items:center; font-size:0.52rem; font-weight:700;">${details.current} / ${details.next} XP</span>
        </div>
        <div class="weapon-desc" style="font-size:0.62rem; color:var(--ink-muted); line-height:1.1;">${p.desc}</div>
      </div>
    `;
  }).join('');
}

function renderCoresList(prog) {
  const cores = [
    { name: "Iron", tier: 1, desc: "Iron Core: Increases flat armor rating block. (Block = Core Rank)" },
    { name: "Warrior", tier: 1, desc: "Warrior Core: Increases physical attack damage. (Attack = Core Rank)" },
    { name: "Scholar", tier: 1, desc: "Scholar Core: Boosts magical defense shield. (Defense = Core Rank / 2)" },
    { name: "Vanguard", tier: 2, desc: "Vanguard Core: Grants Shield HP at the start of combat. (HP = Core Rank * 5)" },
    { name: "Juggernaut", tier: 3, desc: "Juggernaut Core: Increases character health. (Health = Core Rank * 4)" },
    { name: "Sovereign", tier: 5, desc: "Sovereign Core: Dual offensive/defensive scaling. (+2 Attack, +2 Def per Rank)" },
    { name: "Ascendant", tier: 5, desc: "Ascendant Core: Ultimate mythical defense and offense bonuses." }
  ];

  return cores.map(c => {
    const rank = prog.coreRanks[c.name] || 0;
    const isEquipped = prog.equippedCore === c.name;
    
    // Cost calculation
    const essenceCost = rank * 10 || 5;
    const fragCost = rank * 2 || 1;
    const canUpgrade = rank < 10 && prog.materials.essence >= essenceCost && prog.materials.coreFragments >= fragCost;
    
    let actionBtn = "";
    if (rank === 0) {
      const canUnlock = prog.materials.essence >= essenceCost && prog.materials.coreFragments >= fragCost;
      actionBtn = `<button class="btn-primary btn-core-upgrade" data-core="${c.name}" ${canUnlock ? '' : 'disabled'} style="font-size:0.6rem; padding:4px 8px; box-shadow:none;">Unlock (${essenceCost}e/${fragCost}f)</button>`;
    } else {
      actionBtn = `
        <div class="core-action-row" style="display:flex; flex-direction:column; gap:4px; align-items:flex-end;">
          ${isEquipped 
            ? `<span class="class-status-badge current" style="background-color:var(--emerald-green); color:var(--parchment-light); border-radius:4px; font-size:0.6rem; font-weight:700; text-transform:uppercase; padding:2px 6px;">Equipped</span>` 
            : `<button class="btn-secondary btn-core-equip" data-core="${c.name}" style="font-size:0.6rem; padding:4px 8px; box-shadow:none; width:70px;">Equip</button>`
          }
          ${rank < 10 
            ? `<button class="btn-primary btn-core-upgrade" data-core="${c.name}" ${canUpgrade ? '' : 'disabled'} style="font-size:0.6rem; padding:4px 8px; box-shadow:none; width:70px;">Upgrade (${essenceCost}e/${fragCost}f)</button>`
            : `<span style="font-size:0.55rem; font-weight:700; color:var(--emerald-green);">MAX RANK</span>`
          }
        </div>
      `;
    }

    return `
      <div class="core-card" style="border: 1px solid rgba(44,37,30,0.12); padding:10px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; background-color:${isEquipped ? 'rgba(59, 96, 67, 0.04)' : 'rgba(0,0,0,0.01)'}; border-color:${isEquipped ? 'var(--emerald-green)' : 'rgba(44,37,30,0.12)'}">
        <div class="core-card-left" style="display:flex; flex-direction:column; gap:2px; text-align:left; max-width: 65%;">
          <div><strong style="font-size:0.85rem; color:var(--ink-charcoal);">${c.name} Core</strong> <span style="font-size:0.55rem; background-color:var(--gold-primary); color:white; padding:1px 4px; border-radius:3px; font-weight:700; text-transform:uppercase;">Rank ${rank}</span></div>
          <div style="font-size:0.72rem; color:var(--ink-muted); line-height:1.2;">${c.desc}</div>
        </div>
        <div class="core-card-right">
          ${actionBtn}
        </div>
      </div>
    `;
  }).join('');
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
      btnHtml = `<span class="class-status-badge current" style="background-color:var(--emerald-green); color:var(--parchment-light); border-radius:4px; font-size:0.6rem; font-weight:700; text-transform:uppercase; padding:2px 6px;">Equipped</span>`;
    } else if (isCrafted) {
      btnHtml = `<button class="btn-secondary btn-relic-equip" data-relic="${r.id}" style="font-size:0.6rem; padding:4px 8px; box-shadow:none; width:70px;">Equip</button>`;
    } else {
      btnHtml = `<button class="btn-primary btn-relic-craft" data-relic="${r.id}" data-essence="${r.costE}" data-shards="${r.costS}" ${canCraft ? '' : 'disabled'} style="font-size:0.6rem; padding:4px 8px; box-shadow:none; width:70px;">Craft (${r.costE}e/${r.costS}s)</button>`;
    }

    return `
      <div class="relic-card" style="border: 1px solid rgba(44,37,30,0.12); padding:10px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; background-color:${isEquipped ? 'rgba(59, 96, 67, 0.04)' : 'rgba(0,0,0,0.01)'}; border-color:${isEquipped ? 'var(--emerald-green)' : 'rgba(44,37,30,0.12)'}">
        <div class="relic-card-left" style="display:flex; flex-direction:column; gap:2px; text-align:left; max-width: 65%;">
          <div><strong style="font-size:0.85rem; color:var(--ink-charcoal);">${r.id}</strong> <span style="font-size:0.55rem; background-color:${r.tier === 'Legendary' ? 'var(--gold-primary)' : r.tier === 'Mythic' ? 'var(--ruby-crimson)' : 'var(--sapphire-blue)'}; color:white; padding:1px 4px; border-radius:3px; font-weight:700; text-transform:uppercase;">${r.tier}</span></div>
          <div style="font-size:0.72rem; color:var(--ink-muted); line-height:1.2;">${r.effect}</div>
          <div style="font-size:0.58rem; color:var(--gold-primary); font-weight:700; margin-top:2px;">Req Level: ${r.reqLvl}</div>
        </div>
        <div class="relic-card-right">
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
    <div class="codex-buff-line">✨ Global Critical Strike rate: +${critBonus.toFixed(2)}%</div>
    <div class="codex-buff-line">🛡️ Global Defense rating: +${defBonus} armor</div>
    <div class="codex-buff-line">🪓 Global Max Damage rating: +${dmgBonus} damage</div>
  `;
}

function renderCodexMonsters(prog) {
  let listHtml = [];
  
  DUNGEONS.forEach(dungeon => {
    const monsters = [...dungeon.monsters, dungeon.boss];
    const monsterLines = monsters.map(m => {
      const kills = prog.monsterCodex[m.name] || 0;
      return `
        <div class="codex-monster-row" style="display:flex; justify-content:space-between; align-items:center; border:1px solid rgba(44,37,30,0.06); padding:6px 10px; border-radius:6px; background-color:rgba(0,0,0,0.01);">
          <div class="codex-monster-info" style="display:flex; flex-direction:column; text-align:left;">
            <strong style="font-size:0.8rem;">${m.name}</strong>
            <span class="codex-monster-kills" style="font-size:0.62rem; color:var(--ink-muted);">Killed: ${kills}</span>
          </div>
          <div class="codex-monster-checkmarks" style="display:flex; gap:6px; font-size:0.75rem;">
            <span class="chk ${kills >= 1 ? 'chk-active' : ''}" style="opacity:${kills >= 1 ? '1' : '0.2'}" title="1+ kill: Unlocked">🔓</span>
            <span class="chk ${kills >= 10 ? 'chk-active' : ''}" style="opacity:${kills >= 10 ? '1' : '0.2'}" title="10+ kills: +0.25% Crit">⚔️</span>
            <span class="chk ${kills >= 100 ? 'chk-active' : ''}" style="opacity:${kills >= 100 ? '1' : '0.2'}" title="100+ kills: +1 Def">🛡️</span>
            <span class="chk ${kills >= 1000 ? 'chk-active' : ''}" style="opacity:${kills >= 1000 ? '1' : '0.2'}" title="1000+ kills: +2 Damage">🪓</span>
          </div>
        </div>
      `;
    }).join('');

    listHtml.push(`
      <div class="codex-dungeon-section" style="margin-bottom:12px; text-align:left;">
        <h5 style="font-family:var(--font-header); font-size:0.7rem; color:var(--gold-primary); text-transform:uppercase; border-bottom:1px dashed rgba(44,37,30,0.12); padding-bottom:2px; margin-bottom:6px;">${dungeon.icon} ${dungeon.name}</h5>
        <div style="display:flex; flex-direction:column; gap:4px;">
          ${monsterLines}
        </div>
      </div>
    `);
  });

  return listHtml.join('');
}

function renderEquipSlot(gear, slotKey, label, emoji) {
  const item = gear[slotKey];
  if (!item) {
    return `
      <div class="equip-slot empty-slot" data-slot="${slotKey}">
        <span class="slot-emoji">${emoji}</span>
        <span class="slot-label">${label}</span>
      </div>
    `;
  }
  return `
    <div class="equip-slot filled-slot active-item-pop" data-slot="${slotKey}" data-id="${item.id}" style="border-color:${item.rarityColor}">
      <div class="slot-icon-box">${item.icon}</div>
      <span class="slot-label font-gold">${item.name.split('] ')[1]}</span>
      <button class="btn-unequip-slot" data-slot="${slotKey}">❌</button>
    </div>
  `;
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
        <div class="skill-row-bar">
          <div class="skill-bar-fill" style="width: ${pct}%"></div>
          <span class="skill-bar-text">${xp.toLocaleString()} / ${nextXP.toLocaleString()} XP</span>
        </div>
      </div>
    `;
  }).join('');
}

function renderBackpackItems(backpack) {
  if (backpack.length === 0) {
    return `<div class="empty-backpack-msg">Backpack is empty. Explore Dungeons to claim loot chests!</div>`;
  }
  return backpack.map(item => {
    return `
      <div class="backpack-item-card active-backpack-pop" data-id="${item.id}" style="border-color:${item.rarityColor}">
        <div class="backpack-item-icon">${item.icon}</div>
        <div class="backpack-item-name">${item.name.split('] ')[1]}</div>
        <div class="backpack-item-rarity" style="color:${item.rarityColor}">${item.rarity}</div>
      </div>
    `;
  }).join('');
}

function setupEventListeners(container) {
  // Tab swap listeners
  container.querySelectorAll('.char-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTab = btn.getAttribute('data-tab');
      renderCharacter(container);
    });
  });

  // Class swap listeners
  container.querySelectorAll('.btn-class-swap').forEach(btn => {
    btn.addEventListener('click', () => {
      const cls = btn.getAttribute('data-class');
      changeClass(cls);
      renderCharacter(container);
    });
  });

  // Core Equip listeners
  container.querySelectorAll('.btn-core-equip').forEach(btn => {
    btn.addEventListener('click', () => {
      const core = btn.getAttribute('data-core');
      equipCore(core);
      renderCharacter(container);
    });
  });

  // Core Upgrade listeners
  container.querySelectorAll('.btn-core-upgrade').forEach(btn => {
    btn.addEventListener('click', () => {
      const core = btn.getAttribute('data-core');
      const success = upgradeCore(core);
      if (success) {
        renderCharacter(container);
      } else {
        alert("⚠️ Insufficient upgrade materials! Complete daily/weekly quests to gather Essence and Fragments.");
      }
    });
  });

  // Relic Equip listeners
  container.querySelectorAll('.btn-relic-equip').forEach(btn => {
    btn.addEventListener('click', () => {
      const relic = btn.getAttribute('data-relic');
      equipRelic(relic);
      renderCharacter(container);
    });
  });

  // Relic Craft listeners
  container.querySelectorAll('.btn-relic-craft').forEach(btn => {
    btn.addEventListener('click', () => {
      const relic = btn.getAttribute('data-relic');
      const essence = parseInt(btn.getAttribute('data-essence'));
      const shards = parseInt(btn.getAttribute('data-shards'));
      const success = craftRelic(relic, essence, shards);
      if (success) {
        renderCharacter(container);
      } else {
        alert("⚠️ Insufficient materials to craft Relic! Complete one-time habits to claim Relic Shards.");
      }
    });
  });

  // Unequip buttons
  container.querySelectorAll('.btn-unequip-slot').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const slot = btn.getAttribute('data-slot');
      unequipItem(slot);
      renderCharacter(container);
    });
  });

  // Click slots / backpack items to swap/equip/sell
  container.querySelectorAll('.active-backpack-pop').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.getAttribute('data-id');
      const backpack = getState().inventory.backpack;
      const item = backpack.find(i => i.id === id);
      if (!item) return;

      const statSummary = Object.entries(item.stats)
        .filter(([_, v]) => v > 0)
        .map(([k, v]) => `+${v} ${k.toUpperCase()}`)
        .join(', ');

      const confirmEquip = confirm(
        `🎒 Item Details:\n` +
        `Name: ${item.name}\n` +
        `Slot: ${item.slot}\n` +
        `Stats: ${statSummary || 'Cosmetic only'}\n` +
        `Value: ${item.goldValue} Gold\n\n` +
        `[OK] to EQUIP | [Cancel] to SELL for ${item.goldValue}g`
      );

      if (confirmEquip) {
        equipItem(id);
      } else {
        sellItem(id);
      }
      renderCharacter(container);
    });
  });

  // Buyback momentum handler
  const btnBuyback = container.querySelector('#btn-buyback-momentum');
  if (btnBuyback) {
    btnBuyback.addEventListener('click', () => {
      const success = buyMomentumRecovery();
      if (success) {
        // Spawn floating gold alert
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
}

function getDynamicAvatarShieldSVG(archetype) {
  // Returns highly detailed decorative custom vector shields corresponding to each archetype
  let paths = "";
  let baseColor = "var(--ink-charcoal)";

  if (archetype === "Warrior" || archetype === "Crafter") {
    baseColor = "var(--ruby-crimson)";
    paths = `
      <!-- Broad Shield base -->
      <path d="M20 20 C20 20, 20 60, 50 85 C80 60, 80 20, 80 20 Z" fill="${baseColor}" stroke="var(--ink-charcoal)" stroke-width="4" />
      <path d="M30 25 C30 25, 30 55, 50 75 C70 55, 70 25, 70 25 Z" fill="rgba(0,0,0,0.15)" />
      <!-- Crossed Axes -->
      <path d="M35 30 L65 60 M65 30 L35 60" stroke="var(--gold-primary)" stroke-width="6" stroke-linecap="round" />
      <circle cx="50" cy="45" r="10" fill="var(--parchment-light)" stroke="var(--ink-charcoal)" stroke-width="3" />
    `;
  } else if (archetype === "Ranger" || archetype === "Alchemist") {
    baseColor = "var(--emerald-green)";
    paths = `
      <!-- Diamond Archery shield -->
      <path d="M50 10 L85 50 L50 90 L15 50 Z" fill="${baseColor}" stroke="var(--ink-charcoal)" stroke-width="4" />
      <path d="M50 20 L75 50 L50 80 L25 50 Z" fill="rgba(0,0,0,0.15)" />
      <!-- Arrow -->
      <path d="M50 25 V75 M40 35 L50 25 L60 35" stroke="var(--gold-primary)" stroke-width="5" stroke-linecap="round" fill="none" />
      <circle cx="50" cy="50" r="6" fill="var(--ruby-light)" />
    `;
  } else if (archetype === "Scholar" || archetype === "Merchant") {
    baseColor = "var(--sapphire-blue)";
    paths = `
      <!-- Gothic Round Shield -->
      <circle cx="50" cy="50" r="40" fill="${baseColor}" stroke="var(--ink-charcoal)" stroke-width="4" />
      <circle cx="50" cy="50" r="30" fill="rgba(0,0,0,0.15)" />
      <!-- Tome Symbol -->
      <path d="M35 38 H65 V62 H35 Z" fill="var(--parchment-light)" stroke="var(--ink-charcoal)" stroke-width="3" />
      <path d="M50 38 V62" stroke="var(--ink-charcoal)" stroke-width="2" />
      <circle cx="50" cy="50" r="4" fill="var(--gold-primary)" />
    `;
  } else {
    // Novice / Bard / Default
    baseColor = "var(--parchment-dark)";
    paths = `
      <!-- Simple round shield -->
      <circle cx="50" cy="50" r="40" fill="${baseColor}" stroke="var(--ink-charcoal)" stroke-width="4" />
      <circle cx="50" cy="50" r="30" fill="var(--parchment-light)" stroke="rgba(0,0,0,0.1)" stroke-width="2" />
      <circle cx="50" cy="50" r="10" fill="var(--gold-primary)" stroke="var(--ink-charcoal)" stroke-width="3" />
    `;
  }

  return paths;
}

function injectCharacterCSS() {
  if (document.getElementById('character-view-styles')) return;
  const style = document.createElement('style');
  style.id = 'character-view-styles';
  style.innerHTML = `
    .hero-header-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      padding: 16px;
    }
    .avatar-shield-frame {
      width: 80px;
      height: 80px;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .hero-svg-shield {
      width: 100%;
      height: 100%;
      filter: drop-shadow(0 4px 6px rgba(0,0,0,0.15));
    }
    .hero-titles {
      text-align: center;
    }
    .hero-name-label {
      font-family: var(--font-header);
      font-size: 1.25rem;
      font-weight: 900;
      color: var(--ink-charcoal);
    }
    .hero-subbadge {
      font-family: var(--font-header);
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.5px;
      background-color: var(--ink-charcoal);
      color: var(--parchment-light);
      padding: 2px 8px;
      border-radius: 4px;
      text-transform: uppercase;
    }
    .momentum-buyback-box {
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid rgba(44, 37, 30, 0.1);
      padding-top: 10px;
      margin-top: 6px;
    }
    .buyback-text {
      font-size: 0.8rem;
    }
    .btn-buyback {
      font-size: 0.65rem !important;
      padding: 4px 8px !important;
    }

    /* Combat Grid */
    .combat-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    }
    .combat-stat-card {
      display: flex;
      align-items: center;
      gap: 10px;
      background-color: rgba(0,0,0,0.03);
      padding: 8px 12px;
      border-radius: 8px;
      border: 1px solid rgba(44, 37, 30, 0.08);
    }
    .stat-icon {
      font-size: 1.4rem;
    }
    .stat-info {
      display: flex;
      flex-direction: column;
    }
    .stat-val {
      font-family: var(--font-header);
      font-weight: 900;
      font-size: 1rem;
      line-height: 1.1;
    }
    .stat-label {
      font-size: 0.6rem;
      color: var(--ink-muted);
      text-transform: uppercase;
      font-weight: 700;
    }

    /* Equipment Slots layout */
    .equipment-slots-layout {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }
    .equip-slot {
      height: 70px;
      border: 2px solid rgba(44, 37, 30, 0.15);
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background-color: rgba(0,0,0,0.02);
      position: relative;
      cursor: pointer;
      overflow: hidden;
    }
    .empty-slot {
      border-style: dashed;
    }
    .slot-emoji {
      font-size: 1.3rem;
      opacity: 0.35;
    }
    .slot-label {
      font-size: 0.58rem;
      font-weight: 700;
      text-transform: uppercase;
      color: var(--ink-muted);
      margin-top: 2px;
      text-align: center;
      line-height: 1;
    }
    .font-gold {
      color: var(--gold-primary);
      font-weight: 900;
    }
    .filled-slot {
      border: var(--border-hand-ink);
      background-color: var(--parchment-light);
      box-shadow: inset 0 0 5px rgba(0,0,0,0.05);
    }
    .slot-icon-box {
      width: 32px;
      height: 32px;
    }
    .btn-unequip-slot {
      position: absolute;
      top: 2px;
      right: 2px;
      background: none;
      border: none;
      font-size: 0.6rem;
      cursor: pointer;
      opacity: 0.7;
    }
    .btn-unequip-slot:hover {
      opacity: 1;
    }

    /* OSRS Skills list */
    .skills-stack {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .skill-stack-row {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .skill-row-basics {
      display: flex;
      justify-content: space-between;
      font-size: 0.8rem;
      font-weight: 700;
    }
    .skill-label-name {
      color: var(--ink-charcoal);
    }
    .skill-level-number {
      font-family: var(--font-header);
      color: var(--sapphire-blue);
    }
    .skill-row-bar {
      width: 100%;
      height: 14px;
      background-color: rgba(44, 37, 30, 0.1);
      border-radius: 4px;
      border: 1px solid var(--ink-charcoal);
      position: relative;
      overflow: hidden;
    }
    .skill-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--sapphire-light), var(--sapphire-blue));
      border-radius: 3px;
    }
    .skill-bar-text {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      font-size: 0.58rem;
      font-weight: 700;
      color: var(--ink-charcoal);
      text-shadow: 0px 1px 1px var(--parchment-light);
    }

    /* Backpack Grid */
    .backpack-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
    }
    .backpack-item-card {
      border: 2px solid rgba(44, 37, 30, 0.15);
      background-color: rgba(0,0,0,0.02);
      border-radius: 8px;
      padding: 6px;
      display: flex;
      flex-direction: column;
      align-items: center;
      cursor: pointer;
      transition: all 0.1s ease;
      min-height: 70px;
    }
    .backpack-item-card:hover {
      transform: scale(1.05);
      border-color: var(--ink-charcoal);
    }
    .backpack-item-icon {
      width: 28px;
      height: 28px;
    }
    .backpack-item-name {
      font-size: 0.52rem;
      font-weight: 700;
      text-align: center;
      line-height: 1.1;
      margin-top: 2px;
      max-height: 22px;
      overflow: hidden;
    }
    .backpack-item-rarity {
      font-family: var(--font-header);
      font-size: 0.46rem;
      font-weight: 700;
      text-transform: uppercase;
      margin-top: 1px;
    }
    .empty-backpack-msg {
      grid-column: span 4;
      text-align: center;
      padding: 16px;
      font-size: 0.76rem;
      color: var(--ink-muted);
      border: 1px dashed rgba(44, 37, 30, 0.2);
      border-radius: 8px;
    }

    /* Character Tabs selector */
    .character-tabs {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      background-color: var(--parchment-dark);
      border: var(--border-hand-ink);
      border-radius: 8px;
      overflow: hidden;
    }
    .char-tab-btn {
      background: none;
      border: none;
      border-right: 1px solid var(--ink-charcoal);
      padding: 8px 4px;
      cursor: pointer;
      font-family: var(--font-header);
      font-size: 0.65rem;
      font-weight: 700;
      color: var(--ink-muted);
      transition: all 0.15s ease;
    }
    .char-tab-btn:last-child {
      border-right: none;
    }
    .char-tab-btn.active {
      background-color: var(--parchment-light);
      color: var(--ink-charcoal);
      box-shadow: inset 0 -3px 0 var(--gold-primary);
    }

    /* New Progression system cards */
    .class-tier-tag, .core-rank-tag, .relic-tier-tag {
      font-family: var(--font-header);
      font-size: 0.5rem;
      font-weight: 900;
      text-transform: uppercase;
      padding: 1px 4px;
      border-radius: 3px;
      background-color: var(--ink-charcoal);
      color: var(--parchment-light);
      display: inline-block;
    }
    .core-rank-tag {
      background-color: var(--gold-primary);
    }
    .relic-tier-tag {
      background-color: var(--sapphire-blue);
    }
    
    /* Core equippable highlights */
    .equipped-core-card, .equipped-relic-card {
      border-color: var(--emerald-green) !important;
      box-shadow: 0 0 10px rgba(59, 96, 67, 0.1) !important;
    }
  `;
  document.head.appendChild(style);
}
