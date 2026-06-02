import { levelForXp, calculateArchetype, xpForLevel, weaponRankForXp, getWeaponMasteryKey, generateProceduralLoot } from './formulas.js';

// Global game save key
const SAVE_KEY = 'the_great_ledger_epic_save';

// Global state structure
let state = {
  profile: {
    name: 'Hero Knight',
    archetype: 'Novice',
    totalLevel: 7,
    gold: 250,
    steps: 0,
    momentum: 50, // 0 to 100
    lastUpdate: Date.now()
  },
  skills: {
    strength: 0,
    agility: 0,
    wisdom: 0,
    intelligence: 0,
    insight: 0,
    vitality: 0,
    charisma: 0,
    cleaning: 0
  },
  inventory: {
    equipped: {
      helmet: null,
      chestArmor: null,
      gloves: null,
      boots: null,
      mainHand: null,
      offHand: null
    },
    backpack: []
  },
  quests: [
    {
      id: 'quest-1',
      text: 'Push the Iron: Weightlifting Practice',
      type: 'daily',
      mappedSkill: 'strength',
      completedCount: 0,
      baseXP: 30,
      baseGold: 15
    },
    {
      id: 'quest-2',
      text: 'Pound the Pavement: Afternoon Run',
      type: 'daily',
      mappedSkill: 'agility',
      completedCount: 0,
      baseXP: 30,
      baseGold: 15
    },
    {
      id: 'quest-3',
      text: 'Lore & Tomes: 30 Mins Reading',
      type: 'daily',
      mappedSkill: 'wisdom',
      completedCount: 0,
      baseXP: 45,
      baseGold: 20
    },
    {
      id: 'quest-4',
      text: 'Alchemical Formulae: Deep Study Session',
      type: 'daily',
      mappedSkill: 'intelligence',
      completedCount: 0,
      baseXP: 45,
      baseGold: 20
    },
    {
      id: 'quest-5',
      text: 'Scroll of Self-Truth: Journaling Entry',
      type: 'daily',
      mappedSkill: 'insight',
      completedCount: 0,
      baseXP: 30,
      baseGold: 12
    },
    {
      id: 'quest-6',
      text: 'Sanctuary Rest: 8 Hours Cozy Sleep',
      type: 'daily',
      mappedSkill: 'vitality',
      completedCount: 0,
      baseXP: 40,
      baseGold: 10
    },
    {
      id: 'quest-7',
      text: 'Tavern Whispers: Healthy Socializing',
      type: 'weekly',
      mappedSkill: 'charisma',
      completedCount: 0,
      baseXP: 100,
      baseGold: 60
    },
    {
      id: 'quest-8',
      text: 'Purge the Grime: Clean & Organize Sanctuary',
      type: 'daily',
      mappedSkill: 'cleaning',
      completedCount: 0,
      baseXP: 35,
      baseGold: 15
    }
  ],
  expedition: {
    active: false,
    dungeonId: null,
    startedAt: null,
    totalDuration: 0, // milliseconds
    stageIndex: 0,
    logs: [],
    rewardsGained: { gold: 0, xp: 0, items: [] }
  },
  progression: {
    currentClass: "Commoner",
    equippedCore: "Iron",
    coreRanks: {
      Iron: 1, Leather: 1, Scholar: 1, Warrior: 1,
      Vanguard: 0, Mirage: 0, Executioner: 0, Oracle: 0,
      Juggernaut: 0, Phantom: 0, Tempest: 0, Predator: 0,
      Titan: 0, Void: 0, Phoenix: 0, Chrono: 0,
      Ascendant: 0, Sovereign: 0, Fate: 0
    },
    equippedRelic: null,
    unlockedRelics: [], // List of relics crafted
    weaponXP: {
      blade: 0, axe: 0, spear: 0, dagger: 0, staff: 0, focus: 0
    },
    weaponAffinities: {
      blade: null, axe: null, spear: null, dagger: null, staff: null, focus: null
    },
    monsterCodex: {}, // monsterName: killCount
    materials: {
      essence: 20,          // start with some for demo/fresh players
      weaponEssence: 5,
      coreFragments: 3,
      relicShards: 0
    }
  }
};

// Listeners queue for reactivity
const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  saveState();
  listeners.forEach(fn => fn());
}

/* ==========================================================================
   State Initialization & Auto-Saves
   ========================================================================== */

export function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      state = { ...state, ...parsed };
      state.profile = { ...state.profile, ...parsed.profile };
      state.skills = { ...state.skills, ...parsed.skills };
      state.inventory = { ...state.inventory, ...parsed.inventory };
      state.quests = parsed.quests || state.quests;
      state.expedition = { ...state.expedition, ...parsed.expedition };
      
      // Deep merge progression to prevent breaking older save versions
      if (parsed.progression) {
        state.progression = {
          ...state.progression,
          ...parsed.progression,
          coreRanks: { ...state.progression.coreRanks, ...parsed.progression.coreRanks },
          weaponXP: { ...state.progression.weaponXP, ...parsed.progression.weaponXP },
          weaponAffinities: { ...state.progression.weaponAffinities, ...parsed.progression.weaponAffinities },
          monsterCodex: { ...state.progression.monsterCodex, ...parsed.progression.monsterCodex },
          materials: { ...state.progression.materials, ...parsed.progression.materials }
        };
      }
      
      // Daily Log-in Date check
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
      if (state.profile.lastLoginDate !== todayStr) {
        state.profile.lastLoginDate = todayStr;
        state.profile.hasPendingLoginBonus = true; // Claim tribute on boot!
      }
      
      recalculateDerivedStats();
    } else {
      const now = new Date();
      state.profile.lastLoginDate = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
      state.profile.hasPendingLoginBonus = true; // New profile also gets a starter bonus chest!
      recalculateDerivedStats();
      saveState();
    }
  } catch (e) {
    console.error("Failed to load local state database, building fresh start...", e);
  }
}

export function saveState() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("Failed to save state database...", e);
  }
}

export function getState() {
  return state;
}

/* ==========================================================================
   Dynamic Stat Derivations & Vectors
   ========================================================================== */

let derivedStats = {
  combatStats: {
    attack: 0,
    defense: 0,
    damageRange: 5,
    maxHP: 20
  },
  currentHP: 20,
  skillsLevels: {}
};

export function getDerivedStats() {
  return derivedStats;
}

function recalculateDerivedStats() {
  // 1. Calculate Individual Skills Levels
  const skillLevels = {};
  let totalLevelSum = 0;
  for (const [skill, xp] of Object.entries(state.skills)) {
    const lvl = levelForXp(xp);
    skillLevels[skill] = lvl;
    totalLevelSum += lvl;
  }
  derivedStats.skillsLevels = skillLevels;
  state.profile.totalLevel = totalLevelSum;

  // 2. Resolve Archetype
  const statsArray = [
    skillLevels.strength,
    skillLevels.agility,
    skillLevels.wisdom,
    skillLevels.intelligence,
    skillLevels.insight,
    skillLevels.vitality,
    skillLevels.charisma,
    skillLevels.cleaning
  ];
  state.profile.archetype = calculateArchetype(statsArray);

  // 3. Derived Combat Values based on Level + Equipment
  const overallLvl = Math.floor(totalLevelSum / 5) + 1; // Core scaling factor
  const gear = state.inventory.equipped;

  const attBonus = (gear.mainHand?.stats.attack || 0) + (gear.gloves?.stats.attack || 0);
  const defBonus = (gear.chestArmor?.stats.defense || 0) + 
                   (gear.helmet?.stats.defense || 0) + 
                   (gear.offHand?.stats.defense || 0) + 
                   (gear.boots?.stats.defense || 0);
                   
  const strengthLvl = skillLevels.strength;
  const vitalityLvl = skillLevels.vitality;

  // 4. Incorporate Armor Core progression, Relics, and Weapon Masteries
  const prog = state.progression || {
    currentClass: "Commoner",
    equippedCore: "Iron",
    coreRanks: { Iron: 1 },
    equippedRelic: null,
    weaponXP: { blade: 0, axe: 0, spear: 0, dagger: 0, staff: 0, focus: 0 },
    monsterCodex: {}
  };

  // Class selection passives
  let classAtt = 0;
  let classDef = 0;
  let classHp = 0;
  let classDmg = 0;

  if (prog.currentClass === "Fighter") { classAtt += 2; classDmg += 1; }
  else if (prog.currentClass === "Paladin") { classDef += 4; classHp += 15; }
  else if (prog.currentClass === "Warlord") { classAtt += 5; classDmg += 3; classDef += 2; }
  else if (prog.currentClass === "God-Warrior") { classAtt += 10; classDmg += 6; classDef += 5; classHp += 40; }
  else if (prog.currentClass === "Rogue") { classAtt += 1; }
  else if (prog.currentClass === "Warden") { classDef += 5; classHp += 20; }

  // Core stats
  let coreAtt = 0;
  let coreDef = 0;
  let coreHp = 0;
  let coreDmg = 0;
  const coreRank = prog.coreRanks[prog.equippedCore] || 0;
  if (prog.equippedCore === "Iron") { coreDef += coreRank * 1; }
  else if (prog.equippedCore === "Warrior") { coreAtt += coreRank * 1; }
  else if (prog.equippedCore === "Scholar") { coreDef += Math.floor(coreRank / 2); }
  else if (prog.equippedCore === "Vanguard") { coreDef += coreRank * 1; coreHp += coreRank * 2; }
  else if (prog.equippedCore === "Juggernaut") { coreHp += coreRank * 4; coreDef += coreRank * 1; }
  else if (prog.equippedCore === "Sovereign") { coreAtt += coreRank * 2; coreDef += coreRank * 2; coreDmg += Math.floor(coreRank / 2); }
  else if (prog.equippedCore === "Ascendant") { coreAtt += coreRank * 3; coreDef += coreRank * 3; coreHp += coreRank * 5; }

  // Relic stats
  let relicAtt = 0;
  let relicDef = 0;
  let relicHp = 0;
  let relicDmg = 0;
  if (prog.equippedRelic === "Iron Ring") { relicDef += 2; }
  else if (prog.equippedRelic === "Wolf Fang") { relicAtt += 2; relicDmg += 1; }
  else if (prog.equippedRelic === "Crown of Momentum") { relicAtt += 3; relicDef += 1; }
  else if (prog.equippedRelic === "Heart of the Titan") { relicHp += 20; }
  else if (prog.equippedRelic === "Worldbreaker") { relicAtt += 8; relicDmg += 4; relicDef += 2; }
  else if (prog.equippedRelic === "Assassin's Mark") { relicAtt += 3; relicDmg += 2; }

  // Codex passive stats
  let codexDef = 0;
  let codexDmg = 0;
  for (const [mName, kills] of Object.entries(prog.monsterCodex)) {
    if (kills >= 100) {
      codexDef += 1;
    }
    if (kills >= 1000) {
      codexDmg += 2;
    }
  }

  // Weapon mastery stats
  let weaponAtt = 0;
  let weaponDmg = 0;
  const equippedWeaponName = gear.mainHand ? gear.mainHand.name : "";
  const weaponKey = getWeaponMasteryKey(equippedWeaponName);
  if (weaponKey) {
    const wXp = prog.weaponXP[weaponKey] || 0;
    const wRank = weaponRankForXp(wXp);
    // Accuracy
    weaponAtt += Math.floor(wRank * 0.4);
    // Damage thresholds
    if (wRank >= 20) weaponDmg += 5;
    else if (wRank >= 15) weaponDmg += 3;
    else if (wRank >= 10) weaponDmg += 2;
    else if (wRank >= 5) weaponDmg += 1;
  }

  derivedStats.combatStats.attack = overallLvl + Math.floor(strengthLvl / 3) + attBonus + classAtt + coreAtt + relicAtt + weaponAtt;
  derivedStats.combatStats.defense = overallLvl + Math.floor(vitalityLvl / 4) + defBonus + classDef + coreDef + relicDef + codexDef;
  derivedStats.combatStats.damageRange = 6 + Math.floor(strengthLvl / 2) + (gear.mainHand?.stats.attack || 0) + classDmg + coreDmg + relicDmg + codexDmg + weaponDmg;
  derivedStats.combatStats.maxHP = 25 + (overallLvl * 3) + (vitalityLvl * 4) + classHp + coreHp + relicHp;

  // Auto-heal to max if not in active combat
  if (!state.expedition.active) {
    derivedStats.currentHP = derivedStats.combatStats.maxHP;
  } else {
    // Keep HP bounded by new limits
    derivedStats.currentHP = Math.min(derivedStats.currentHP, derivedStats.combatStats.maxHP);
  }
}

/* ==========================================================================
   State Mutation Action Creators
   ========================================================================== */

/**
 * Grants steps, checks region unlocks on World Map.
 */
export function addSteps(amount) {
  if (amount <= 0) return;
  state.profile.steps += amount;
  notify();
}

/**
 * Momentum Decay & Consistency Updates
 */
export function changeMomentum(delta) {
  state.profile.momentum = Math.min(100, Math.max(0, state.profile.momentum + delta));
  notify();
}

/**
 * Custom formula mapping momentum values directly to flame multipliers.
 * Exponential-style bonus: 50 is 1.0x. 100 is 2.0x. 0 is 0.5x.
 */
export function getMomentumMultiplier() {
  const m = state.profile.momentum;
  if (m >= 50) {
    return (1.0 + ((m - 50) / 50)).toFixed(1); // 1.0x to 2.0x
  } else {
    return (0.5 + (m / 100)).toFixed(1); // 0.5x to 1.0x
  }
}

/**
 * Completes a habit quest, updates XP, stats, momentum, and spawns splats.
 */
export function completeQuest(questId) {
  const quest = state.quests.find(q => q.id === questId);
  if (!quest) return null;

  quest.completedCount++;

  // Record pre-levels to compare
  const oldLvlSum = state.profile.totalLevel;
  const oldSkillsLevels = { ...derivedStats.skillsLevels };
  const oldCombatStats = { ...derivedStats.combatStats };

  // Multipliers based on momentum
  const mult = parseFloat(getMomentumMultiplier());
  const xpReward = Math.floor(quest.baseXP * mult);
  const goldReward = Math.floor(quest.baseGold * mult);

  // Apply rewards
  state.skills[quest.mappedSkill] += xpReward;
  state.profile.gold += goldReward;

  // Progression materials drops
  let essenceReward = 0;
  let fragReward = 0;
  let shardReward = 0;

  if (state.progression) {
    if (quest.type === 'daily') {
      essenceReward = Math.floor(Math.random() * 3) + 1; // 1-3
      fragReward = 1;
    } else {
      // Weekly or one-time
      essenceReward = Math.floor(Math.random() * 6) + 5; // 5-10
      fragReward = Math.floor(Math.random() * 3) + 2; // 2-4
      if (quest.isOneTime) {
        shardReward = 1;
      }
    }

    state.progression.materials.essence += essenceReward;
    state.progression.materials.coreFragments += fragReward;
    state.progression.materials.relicShards += shardReward;
  }

  // Boost flame consistency meter
  changeMomentum(8);

  // Check for level ups!
  checkForLevelUps(oldLvlSum, oldSkillsLevels, oldCombatStats);

  notify();

  return { xpReward, goldReward, skill: quest.mappedSkill, isOneTime: quest.isOneTime, essenceReward, fragReward, shardReward };
}

/**
 * Custom Habit / Quest Creation
 */
export function createCustomQuest(text, type, skill) {
  const newQuest = {
    id: `quest-${Date.now()}`,
    text,
    type: type === 'onetime' ? 'weekly' : type, // Internally map one-time bounties to the weekly checklist
    mappedSkill: skill,
    completedCount: 0,
    baseXP: type === 'daily' ? 35 : type === 'weekly' ? 90 : 150, // Higher yield for one-time
    baseGold: type === 'daily' ? 15 : type === 'weekly' ? 45 : 75,
    isOneTime: type === 'onetime'
  };
  state.quests.push(newQuest);
  notify();
}

/**
 * Equipment Inventories Management
 */
export function equipItem(itemId) {
  const backpackIndex = state.inventory.backpack.findIndex(item => item.id === itemId);
  if (backpackIndex === -1) return;

  const item = state.inventory.backpack[backpackIndex];
  const slot = item.slot;

  // Retrieve current equipped item in that slot
  const currentlyEquipped = state.inventory.equipped[slot];

  // Equip new item
  state.inventory.equipped[slot] = item;

  // Swap to backpack or remove
  if (currentlyEquipped) {
    state.inventory.backpack[backpackIndex] = currentlyEquipped;
  } else {
    state.inventory.backpack.splice(backpackIndex, 1);
  }

  recalculateDerivedStats();
  notify();
}

export function unequipItem(slot) {
  const item = state.inventory.equipped[slot];
  if (!item) return;

  state.inventory.equipped[slot] = null;
  state.inventory.backpack.push(item);

  recalculateDerivedStats();
  notify();
}

export function sellItem(itemId) {
  const index = state.inventory.backpack.findIndex(item => item.id === itemId);
  if (index === -1) return;

  const item = state.inventory.backpack[index];
  state.profile.gold += item.goldValue;
  state.inventory.backpack.splice(index, 1);

  notify();
}

export function buyMomentumRecovery() {
  const m = state.profile.momentum;
  if (m >= 100) return false;

  const cost = Math.floor(40 + (m * 1.5));
  if (state.profile.gold < cost) return false;

  state.profile.gold -= cost;
  state.profile.momentum = Math.min(100, state.profile.momentum + 35);
  
  notify();
  return true;
}

/* ==========================================================================
   Expeditions Logic Syncs
   ========================================================================== */

export function startExpedition(dungeonId) {
  state.expedition = {
    active: true,
    dungeonId,
    startedAt: Date.now(),
    totalDuration: 0,
    stageIndex: 0,
    logs: [`🌲 Embarked into the depths! Let your focus guide your blades...`],
    rewardsGained: { gold: 0, xp: 0, items: [] }
  };
  recalculateDerivedStats();
  notify();
}

export function completeExpedition() {
  if (!state.expedition.active) return;

  // Capture pre-levels
  const oldLvlSum = state.profile.totalLevel;
  const oldSkillsLevels = { ...derivedStats.skillsLevels };
  const oldCombatStats = { ...derivedStats.combatStats };

  // Apply final rewards gathered
  state.profile.gold += state.expedition.rewardsGained.gold;
  
  // Distribute XP to Strength (combat) and Agility/Wisdom based on dungeon
  const xp = state.expedition.rewardsGained.xp;
  state.skills.strength += Math.floor(xp * 0.5);
  state.skills.vitality += Math.floor(xp * 0.3);
  state.skills.agility += Math.floor(xp * 0.2);

  // Put loot items into backpack
  state.inventory.backpack.push(...state.expedition.rewardsGained.items);

  // Close expedition
  state.expedition.active = false;
  state.expedition.dungeonId = null;

  checkForLevelUps(oldLvlSum, oldSkillsLevels, oldCombatStats);
  notify();
}

export function terminateExpeditionGracefully(message) {
  if (!state.expedition.active) return;
  
  // Interrupted! Preserve 35% of gold/xp rewards, drop all items found.
  state.profile.gold += Math.floor(state.expedition.rewardsGained.gold * 0.35);
  state.skills.strength += Math.floor(state.expedition.rewardsGained.xp * 0.15);
  
  state.expedition.active = false;
  state.expedition.dungeonId = null;

  // Mute consistency due to distraction
  changeMomentum(-10);

  recalculateDerivedStats();
  notify();
}

export function updateActiveExpedition(updateFn) {
  if (!state.expedition.active) return;
  updateFn(state.expedition, derivedStats);
  notify();
}

export function deleteQuest(questId) {
  state.quests = state.quests.filter(q => q.id !== questId);
  notify();
}

export function claimPendingLoginBonus(dungeonId = "woods") {
  if (!state.profile.hasPendingLoginBonus) return null;

  // Generate procedurally compiled treasure chest item
  const lootItem = generateProceduralLoot(dungeonId);
  state.inventory.backpack.push(lootItem);

  // Create a dedicated premium daily log-in bonus item
  const loginBonusItem = {
    id: `item-login-bonus-${Date.now()}`,
    name: "[Epic] Emblem of Consistency",
    slot: "offHand",
    rarity: "Epic",
    rarityColor: "var(--ruby-crimson)",
    stats: { attack: 1, defense: 3, speed: 2, intelligence: 1, wisdom: 1 },
    goldValue: 120,
    icon: `<svg viewBox="0 0 100 100" style="width:100%; height:100%; fill:var(--ruby-crimson); stroke:var(--ink-charcoal); stroke-width:3px;"><circle cx="50" cy="50" r="35" fill="var(--gold-primary)" /><path d="M50 20 L60 40 L80 40 L65 55 L70 75 L50 62 L30 75 L35 55 L20 40 L40 40 Z" fill="var(--ruby-crimson)" /></svg>`
  };
  state.inventory.backpack.push(loginBonusItem);

  // Grant 100 bonus gold
  state.profile.gold += 100;
  
  // Set flag false
  state.profile.hasPendingLoginBonus = false;
  
  notify();
  return { item: lootItem, loginBonusItem, gold: 100 };
}

export function clearPendingLevelUp() {
  state.profile.pendingLevelUp = null;
  notify();
}

function checkForLevelUps(oldLvlSum, oldSkillsLevels, oldCombatStats) {
  recalculateDerivedStats();
  
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

  const newLevels = derivedStats.skillsLevels;
  const newCombat = derivedStats.combatStats;

  // 1. Check if individual skills leveled up
  for (const [skill, oldLvl] of Object.entries(oldSkillsLevels)) {
    const newLvl = newLevels[skill];
    if (newLvl > oldLvl) {
      const diff = newLvl - oldLvl;
      const statsList = [`🌟 ${skillEmojis[skill]} increased by ${diff}`];
      
      const dmgDiff = newCombat.damageRange - oldCombatStats.damageRange;
      if (dmgDiff > 0) {
        statsList.push(`🪓 damage increased by ${dmgDiff}`);
      }
      
      const attDiff = newCombat.attack - oldCombatStats.attack;
      if (attDiff > 0) {
        statsList.push(`🗡️ accuracy increased by ${attDiff}`);
      }
      
      const defDiff = newCombat.defense - oldCombatStats.defense;
      if (defDiff > 0) {
        statsList.push(`🛡️ armor increased by ${defDiff}`);
      }
      
      const hpDiff = newCombat.maxHP - oldCombatStats.maxHP;
      if (hpDiff > 0) {
        statsList.push(`❤️ maximum health increased by ${hpDiff}`);
      }

      state.profile.pendingLevelUp = {
        title: `Your ${skillEmojis[skill]} level is now ${newLvl}!`,
        icon: skill === 'strength' ? '⚔️' : skill === 'cleaning' ? '🧹' : skill === 'wisdom' ? '📖' : '✨',
        statsList: statsList
      };
      return;
    }
  }

  // 2. Check if total Level leveled up
  if (state.profile.totalLevel > oldLvlSum) {
    const totalDiff = state.profile.totalLevel - oldLvlSum;
    const statsList = [`🏆 total level increased by ${totalDiff}`];
    
    const dmgDiff = newCombat.damageRange - oldCombatStats.damageRange;
    if (dmgDiff > 0) {
      statsList.push(`🪓 damage increased by ${dmgDiff}`);
    }
    
    const attDiff = newCombat.attack - oldCombatStats.attack;
    if (attDiff > 0) {
      statsList.push(`🗡️ accuracy increased by ${attDiff}`);
    }
    
    const defDiff = newCombat.defense - oldCombatStats.defense;
    if (defDiff > 0) {
      statsList.push(`🛡️ armor increased by ${defDiff}`);
    }
    
    const hpDiff = newCombat.maxHP - oldCombatStats.maxHP;
    if (hpDiff > 0) {
      statsList.push(`❤️ maximum health increased by ${hpDiff}`);
    }

    state.profile.pendingLevelUp = {
      title: `Congratulations! Total Level increased to ${state.profile.totalLevel}!`,
      icon: '🏆',
      statsList: statsList
    };
  }
}

/* ==========================================================================
   RPG Progression Action Creators
   ========================================================================== */

export function changeClass(className) {
  if (!state.progression) return;
  state.progression.currentClass = className;
  recalculateDerivedStats();
  notify();
}

export function upgradeCore(coreName) {
  if (!state.progression) return false;
  const currentRank = state.progression.coreRanks[coreName] || 0;
  if (currentRank >= 10) return false; // Max rank

  // Upgrading costs
  const essenceCost = currentRank * 10 || 5;
  const fragCost = currentRank * 2 || 1;

  if (state.progression.materials.essence >= essenceCost &&
      state.progression.materials.coreFragments >= fragCost) {
    state.progression.materials.essence -= essenceCost;
    state.progression.materials.coreFragments -= fragCost;
    state.progression.coreRanks[coreName] = currentRank + 1;
    recalculateDerivedStats();
    notify();
    return true;
  }
  return false;
}

export function equipCore(coreName) {
  if (!state.progression) return;
  state.progression.equippedCore = coreName;
  recalculateDerivedStats();
  notify();
}

export function craftRelic(relicId, costEssence, costShards) {
  if (!state.progression) return false;
  if (state.progression.unlockedRelics.includes(relicId)) return false;

  if (state.progression.materials.essence >= costEssence &&
      state.progression.materials.relicShards >= costShards) {
    state.progression.materials.essence -= costEssence;
    state.progression.materials.relicShards -= costShards;
    state.progression.unlockedRelics.push(relicId);
    notify();
    return true;
  }
  return false;
}

export function equipRelic(relicId) {
  if (!state.progression) return;
  state.progression.equippedRelic = relicId;
  recalculateDerivedStats();
  notify();
}

export function incrementCodexKill(monsterName) {
  if (!state.progression) return;
  if (!state.progression.monsterCodex[monsterName]) {
    state.progression.monsterCodex[monsterName] = 0;
  }
  state.progression.monsterCodex[monsterName]++;
  recalculateDerivedStats();
  notify();
}

export function incrementWeaponMasteryXP(weaponKey, xpAmount) {
  if (!state.progression) return;
  if (state.progression.weaponXP[weaponKey] === undefined) {
    state.progression.weaponXP[weaponKey] = 0;
  }
  const oldXp = state.progression.weaponXP[weaponKey];
  const oldRank = weaponRankForXp(oldXp);
  
  state.progression.weaponXP[weaponKey] += xpAmount;
  
  const newRank = weaponRankForXp(state.progression.weaponXP[weaponKey]);
  
  recalculateDerivedStats();
  notify();
  
  return { leveledUp: newRank > oldRank, newRank };
}
