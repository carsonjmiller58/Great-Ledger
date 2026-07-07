import { levelForXp, calculateArchetype, xpForLevel, weaponRankForXp, getWeaponMasteryKey, calculateCharacterLevel, WEAPON_PRESETS, CLASS_PATHS } from './formulas.js';

export const ARMOR_TIERS = [
  "Rags",
  "Novice Leather",
  "Reinforced Leather",
  "Hardened Mail",
  "Reinforced Plate",
  "Hardened Steel",
  "Runed Aegis",
  "Chrono Ward",
  "Sovereign Plate",
  "Celestial Bulwark"
];

export function getArmorForgeUpgradeCost(level) {
  const costs = [0, 50, 150, 300, 500, 800, 1200, 1800, 2500, 4000];
  if (level >= 10) return Infinity;
  return costs[level] || 5000;
}

// Global game save key
const SAVE_KEY = 'the_great_ledger_epic_save';

// Global state structure
let state = {
  profile: {
    name: 'Hero Knight',
    archetype: 'Novice',
    totalLevel: 1, // Will represent Character Level
    gold: 250,
    steps: 0,
    momentum: 50, // 0 to 100
    lastUpdate: Date.now(),
    setupComplete: false,
    lastResetDate: null,
    lastWeeklyResetDate: null,
    weeklyStats: { questsCompleted: 0, skillsLeveled: [], streaksMaintained: 0 },
    lastWeekSummary: null,
    hasPendingWeeklySummary: false,
    chronicleLog: [
      { text: "📜 Joined the guild and signed the Great Ledger.", time: Date.now() }
    ]
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
  inventory: { // Kept for stub compatibility
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
      currentStreak: 0,
      lastCompletedDate: null,
      baseXP: 30,
      baseGold: 15
    },
    {
      id: 'quest-2',
      text: 'Pound the Pavement: Afternoon Run',
      type: 'daily',
      mappedSkill: 'agility',
      completedCount: 0,
      currentStreak: 0,
      lastCompletedDate: null,
      baseXP: 30,
      baseGold: 15
    },
    {
      id: 'quest-3',
      text: 'Lore & Tomes: 30 Mins Reading',
      type: 'daily',
      mappedSkill: 'wisdom',
      completedCount: 0,
      currentStreak: 0,
      lastCompletedDate: null,
      baseXP: 45,
      baseGold: 20
    },
    {
      id: 'quest-4',
      text: 'Alchemical Formulae: Deep Study Session',
      type: 'daily',
      mappedSkill: 'intelligence',
      completedCount: 0,
      currentStreak: 0,
      lastCompletedDate: null,
      baseXP: 45,
      baseGold: 20
    },
    {
      id: 'quest-5',
      text: 'Scroll of Self-Truth: Journaling Entry',
      type: 'daily',
      mappedSkill: 'insight',
      completedCount: 0,
      currentStreak: 0,
      lastCompletedDate: null,
      baseXP: 30,
      baseGold: 12
    },
    {
      id: 'quest-6',
      text: 'Sanctuary Rest: 8 Hours Cozy Sleep',
      type: 'daily',
      mappedSkill: 'vitality',
      completedCount: 0,
      currentStreak: 0,
      lastCompletedDate: null,
      baseXP: 40,
      baseGold: 10
    },
    {
      id: 'quest-7',
      text: 'Tavern Whispers: Healthy Socializing',
      type: 'weekly',
      mappedSkill: 'charisma',
      completedCount: 0,
      currentStreak: 0,
      lastCompletedDate: null,
      baseXP: 100,
      baseGold: 60
    },
    {
      id: 'quest-8',
      text: 'Purge the Grime: Clean & Organize Sanctuary',
      type: 'daily',
      mappedSkill: 'cleaning',
      completedCount: 0,
      currentStreak: 0,
      lastCompletedDate: null,
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
    rewardsGained: { gold: 0, xp: 0, essence: 0, coreFragments: 0, relicShards: 0 }
  },
  progression: {
    currentClass: "Commoner",
    equippedWeapon: "blade",
    armorForge: {
      level: 1,
      essenceInvested: 0
    },
    equippedCore: "Iron", // kept for backward compatibility
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

function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7) + "-" + d.getUTCFullYear();
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
      
      // Ensure chronicle exists
      state.profile.chronicleLog = state.profile.chronicleLog || [
        { text: "📜 Joined the guild and signed the Great Ledger.", time: Date.now() }
      ];
      
      // Deep merge progression to prevent breaking older save versions
      if (parsed.progression) {
        state.progression = {
          ...state.progression,
          ...parsed.progression,
          armorForge: parsed.progression.armorForge || { level: 1, essenceInvested: 0 },
          equippedWeapon: parsed.progression.equippedWeapon || "blade",
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
      
      // Existing saves always skip onboarding — they already have name/class chosen
      state.profile.setupComplete = true;
      if (!state.profile.weeklyStats) state.profile.weeklyStats = { questsCompleted: 0, skillsLeveled: [], streaksMaintained: 0 };
      
      const isoWeekStr = getISOWeek(now);
      
      // Daily Reset Check
      if (state.profile.lastResetDate !== todayStr) {
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        const yesterdayStr = `${yesterday.getFullYear()}-${yesterday.getMonth()}-${yesterday.getDate()}`;
        
        state.quests.forEach(q => {
          if (q.currentStreak === undefined) q.currentStreak = 0;
          if (q.type === 'daily') {
            q.completedCount = 0;
            if (q.lastCompletedDate !== todayStr && q.lastCompletedDate !== yesterdayStr) {
              q.currentStreak = 0; // Streak broken
            }
          }
        });
        state.profile.lastResetDate = todayStr;
      }
      
      // Weekly Reset Check
      if (state.profile.lastWeeklyResetDate !== isoWeekStr) {
        if (state.profile.lastWeeklyResetDate !== null && state.profile.lastWeeklyResetDate !== undefined) {
          state.profile.lastWeekSummary = { ...state.profile.weeklyStats };
          state.profile.hasPendingWeeklySummary = true;
        }
        state.profile.weeklyStats = { questsCompleted: 0, skillsLeveled: [], streaksMaintained: 0 };
        state.profile.lastWeeklyResetDate = isoWeekStr;
        
        state.quests.forEach(q => {
          if (q.type === 'weekly') {
            q.completedCount = 0;
          }
        });
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
  for (const [skill, xp] of Object.entries(state.skills)) {
    skillLevels[skill] = levelForXp(xp);
  }
  derivedStats.skillsLevels = skillLevels;
  state.profile.totalLevel = calculateCharacterLevel(skillLevels); // Character Level!

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

  // 3. Derived Combat Values based on Level
  const overallLvl = state.profile.totalLevel; 
  
  const strengthLvl = skillLevels.strength;
  const vitalityLvl = skillLevels.vitality;

  // 4. Incorporate Armor Forge level, Relics, and Weapon Masteries
  const prog = state.progression || {
    currentClass: "Commoner",
    equippedWeapon: "blade",
    armorForge: { level: 1, essenceInvested: 0 },
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

  // Armor Forge flat defense calculation: each level provides +15 armor (base 0 for Level 1)
  const forgeLvl = prog.armorForge?.level || 1;
  const forgeDef = (forgeLvl - 1) * 15;

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
  const activeWeaponKey = prog.equippedWeapon || "blade";
  const weaponPreset = WEAPON_PRESETS[activeWeaponKey];
  
  if (activeWeaponKey) {
    const wXp = prog.weaponXP[activeWeaponKey] || 0;
    const wRank = weaponRankForXp(wXp);
    // Accuracy
    weaponAtt += Math.floor(wRank * 0.4);
    // Damage thresholds
    if (wRank >= 20) weaponDmg += 5;
    else if (wRank >= 15) weaponDmg += 3;
    else if (wRank >= 10) weaponDmg += 2;
    else if (wRank >= 5) weaponDmg += 1;

    // Add Preset Weapon base stats
    if (weaponPreset) {
      weaponAtt += weaponPreset.attack;
      weaponDmg += weaponPreset.damage;
    }
  }

  derivedStats.combatStats.attack = overallLvl + Math.floor(strengthLvl / 3) + classAtt + relicAtt + weaponAtt;
  derivedStats.combatStats.defense = overallLvl + Math.floor(vitalityLvl / 4) + classDef + forgeDef + relicDef + codexDef;
  derivedStats.combatStats.damageRange = 6 + Math.floor(strengthLvl / 2) + classDmg + relicDmg + codexDmg + weaponDmg;
  derivedStats.combatStats.maxHP = 25 + (overallLvl * 3) + (vitalityLvl * 4) + classHp + relicHp;

  // Auto-heal to max if not in active combat
  if (!state.expedition.active) {
    derivedStats.currentHP = derivedStats.combatStats.maxHP;
  } else {
    derivedStats.currentHP = Math.min(derivedStats.currentHP, derivedStats.combatStats.maxHP);
  }
}

/* ==========================================================================
   Momentum System
   ========================================================================== */

/**
 * Returns the XP/Gold multiplier based on current momentum (0-100).
 * 0% momentum = 0.5x, 50% = 1.0x, 100% = 2.0x
 */
export function getMomentumMultiplier() {
  const m = state.profile.momentum || 0;
  return (0.5 + (m / 100) * 1.5).toFixed(1);
}

/**
 * Changes momentum by a delta (clamped 0–100).
 */
function changeMomentum(delta) {
  state.profile.momentum = Math.max(0, Math.min(100, state.profile.momentum + delta));
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
/**
 * Helper to log character events to the chronicle history
 */
export function addChronicleEvent(text) {
  if (!state.profile.chronicleLog) {
    state.profile.chronicleLog = [];
  }
  state.profile.chronicleLog.unshift({ text, time: Date.now() });
  if (state.profile.chronicleLog.length > 50) {
    state.profile.chronicleLog.pop();
  }
}

/**
 * Completes a habit quest, updates XP, stats, momentum, and spawns splats.
 */
export function completeQuest(questId) {
  const quest = state.quests.find(q => q.id === questId);
  if (!quest) return null;

  quest.completedCount++;
  
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${yesterday.getMonth()}-${yesterday.getDate()}`;
  
  if (quest.type === 'daily') {
    if (quest.lastCompletedDate === yesterdayStr) {
      quest.currentStreak++;
      if (state.profile.weeklyStats) state.profile.weeklyStats.streaksMaintained++;
    } else if (quest.lastCompletedDate !== todayStr) {
      quest.currentStreak = 1;
    }
    quest.lastCompletedDate = todayStr;
  }
  
  if (state.profile.weeklyStats) {
    state.profile.weeklyStats.questsCompleted++;
  }

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

  const eventMsg = `Completed Bounty: ${quest.text} (+${xpReward} XP to ${quest.mappedSkill.toUpperCase()}, +${goldReward} Gold)`;
  addChronicleEvent(eventMsg);

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
    currentStreak: 0,
    lastCompletedDate: null,
    baseXP: type === 'daily' ? 35 : type === 'weekly' ? 90 : 150, // Higher yield for one-time
    baseGold: type === 'daily' ? 15 : type === 'weekly' ? 45 : 75,
    isOneTime: type === 'onetime'
  };
  state.quests.push(newQuest);
  addChronicleEvent(`🖋️ Posted custom bounty: "${text}"`);
  notify();
}

/**
 * Generates a special quest to help reach the next class upgrade.
 */
export function generateUpgradeQuest() {
  const derived = getDerivedStats();
  const currentLvl = state.profile.totalLevel;
  
  let targetSkill = 'strength'; // Default fallback
  let missingReq = null;
  let targetClassName = '';

  // Find the first locked class
  for (const c of CLASS_PATHS) {
    if (Object.keys(c.reqs).length === 0) continue;
    
    let hasAllReqs = true;
    for (const [key, reqVal] of Object.entries(c.reqs)) {
      if (key === 'level') {
        if (currentLvl < reqVal) {
          hasAllReqs = false;
          missingReq = { key, reqVal, current: currentLvl };
          break;
        }
      } else {
        const val = derived.skillsLevels[key] || 1;
        if (val < reqVal) {
          hasAllReqs = false;
          missingReq = { key, reqVal, current: val };
          break;
        }
      }
    }
    
    if (!hasAllReqs && missingReq) {
      targetClassName = c.name;
      break;
    }
  }

  if (!missingReq) {
    // If all classes unlocked, just boost the lowest skill
    const skills = Object.entries(derived.skillsLevels);
    skills.sort((a, b) => a[1] - b[1]);
    targetSkill = skills[0][0];
  } else {
    if (missingReq.key === 'level') {
      // Pick highest skill to maximize character level formula (maxSkill * 0.5 + others * 0.15)
      const skills = Object.entries(derived.skillsLevels);
      skills.sort((a, b) => b[1] - a[1]);
      targetSkill = skills[0][0];
    } else {
      targetSkill = missingReq.key;
    }
  }

  const text = `Class Training: ${targetClassName ? `Path to ${targetClassName}` : 'Mastery Pursuit'}`;
  
  const newQuest = {
    id: `quest-${Date.now()}`,
    text,
    type: 'weekly', // Treated as a one-time bounty
    mappedSkill: targetSkill,
    completedCount: 0,
    currentStreak: 0,
    lastCompletedDate: null,
    baseXP: 300, // Large EXP bonus for class progression
    baseGold: 100,
    isOneTime: true
  };
  state.quests.push(newQuest);
  addChronicleEvent(`🎯 New Class Upgrade Quest Generated: "${text}"`);
  notify();
}

/**
 * Equipment Inventories Management (Stubs for compatibility)
 */
export function equipItem(itemId) {
  recalculateDerivedStats();
  notify();
}

export function unequipItem(slot) {
  recalculateDerivedStats();
  notify();
}

export function sellItem(itemId) {
  notify();
}

export function buyMomentumRecovery() {
  const m = state.profile.momentum;
  if (m >= 100) return false;

  const cost = Math.floor(40 + (m * 1.5));
  if (state.profile.gold < cost) return false;

  state.profile.gold -= cost;
  state.profile.momentum = Math.min(100, state.profile.momentum + 35);
  
  addChronicleEvent(`🔥 Recovered consistency flame (spent ${cost} Gold)`);
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
    rewardsGained: { gold: 0, xp: 0, essence: 0, coreFragments: 0, relicShards: 0 },
    bankedRewards: { gold: 0, xp: 0, essence: 0, coreFragments: 0, relicShards: 0 }
  };
  addChronicleEvent(`🗺️ Embarked on dungeon expedition into ${dungeonId.toUpperCase()}!`);
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
  state.profile.gold += state.expedition.rewardsGained.gold;
  state.skills.strength += Math.floor(xp * 0.5);
  state.skills.vitality += Math.floor(xp * 0.3);
  state.skills.agility += Math.floor(xp * 0.2);

  // Add materials rewards
  state.progression.materials.essence += state.expedition.rewardsGained.essence || 0;
  state.progression.materials.coreFragments += state.expedition.rewardsGained.coreFragments || 0;
  state.progression.materials.relicShards += state.expedition.rewardsGained.relicShards || 0;

  // Combine with banked for final report
  state.expedition.rewardsGained.gold += state.expedition.bankedRewards?.gold || 0;
  state.expedition.rewardsGained.xp += state.expedition.bankedRewards?.xp || 0;
  state.expedition.rewardsGained.essence = (state.expedition.rewardsGained.essence || 0) + (state.expedition.bankedRewards?.essence || 0);
  state.expedition.rewardsGained.coreFragments = (state.expedition.rewardsGained.coreFragments || 0) + (state.expedition.bankedRewards?.coreFragments || 0);
  state.expedition.rewardsGained.relicShards = (state.expedition.rewardsGained.relicShards || 0) + (state.expedition.bankedRewards?.relicShards || 0);

  addChronicleEvent(`🏆 Expedition Cleared: +${state.expedition.rewardsGained.xp} total combat XP, +${state.expedition.rewardsGained.gold} Gold, +${state.expedition.rewardsGained.essence || 0} Essence!`);

  // Close expedition
  state.expedition.active = false;
  state.expedition.dungeonId = null;

  checkForLevelUps(oldLvlSum, oldSkillsLevels, oldCombatStats);
  notify();
}

export function terminateExpeditionGracefully(message) {
  if (!state.expedition.active) return;
  
  // Interrupted! Preserve 35% of UNBANKED gold/xp/materials rewards
  const gGain = Math.floor(state.expedition.rewardsGained.gold * 0.35);
  const xpGain = Math.floor(state.expedition.rewardsGained.xp * 0.15);
  const essGain = Math.floor((state.expedition.rewardsGained.essence || 0) * 0.35);
  const fragGain = Math.floor((state.expedition.rewardsGained.coreFragments || 0) * 0.35);
  const relicGain = Math.floor((state.expedition.rewardsGained.relicShards || 0) * 0.35);
  
  state.profile.gold += gGain;
  state.skills.strength += xpGain;
  state.progression.materials.essence += essGain;
  state.progression.materials.coreFragments += fragGain;
  state.progression.materials.relicShards += relicGain;

  // Combine penalized + banked so the report shows exactly what the user walked away with
  const banked = state.expedition.bankedRewards || { gold: 0, xp: 0, essence: 0, coreFragments: 0, relicShards: 0 };
  state.expedition.rewardsGained.gold = gGain + banked.gold;
  state.expedition.rewardsGained.xp = xpGain + banked.xp;
  state.expedition.rewardsGained.essence = essGain + banked.essence;
  state.expedition.rewardsGained.coreFragments = fragGain + banked.coreFragments;
  state.expedition.rewardsGained.relicShards = relicGain + banked.relicShards;

  addChronicleEvent(`💔 Expedition Aborted: Walked away with ${state.expedition.rewardsGained.gold} total Gold and ${state.expedition.rewardsGained.xp} XP.`);

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

export function bankExpeditionSpoils() {
  if (!state.expedition.active) return;
  const rewards = state.expedition.rewardsGained;
  
  state.profile.gold += rewards.gold;
  const xp = rewards.xp;
  state.skills.strength += Math.floor(xp * 0.5);
  state.skills.vitality += Math.floor(xp * 0.3);
  state.skills.agility += Math.floor(xp * 0.2);

  state.progression.materials.essence += rewards.essence || 0;
  state.progression.materials.coreFragments += rewards.coreFragments || 0;
  state.progression.materials.relicShards += rewards.relicShards || 0;

  state.expedition.bankedRewards.gold += rewards.gold;
  state.expedition.bankedRewards.xp += rewards.xp;
  state.expedition.bankedRewards.essence += rewards.essence || 0;
  state.expedition.bankedRewards.coreFragments += rewards.coreFragments || 0;
  state.expedition.bankedRewards.relicShards += rewards.relicShards || 0;

  state.expedition.rewardsGained = { gold: 0, xp: 0, essence: 0, coreFragments: 0, relicShards: 0 };
}

export function deleteQuest(questId) {
  const quest = state.quests.find(q => q.id === questId);
  if (quest) {
    addChronicleEvent(`🗑️ Removed bounty: "${quest.text}"`);
  }
  state.quests = state.quests.filter(q => q.id !== questId);
  notify();
}

export function claimPendingLoginBonus(dungeonId = "woods") {
  if (!state.profile.hasPendingLoginBonus) return null;

  // Grant Gold & Materials only (no items!)
  state.profile.gold += 150;
  state.progression.materials.essence += 30;
  state.progression.materials.relicShards += 3;

  // Set flag false
  state.profile.hasPendingLoginBonus = false;
  
  addChronicleEvent(`🎁 Claimed Guild Daily Tribute: +150 Gold, +30 Essence, +3 Relic Shards!`);
  notify();
  return { gold: 150, essence: 30, relicShards: 3 };
}

export function clearPendingLevelUp() {
  state.profile.pendingLevelUp = null;
  notify();
}

export function claimWeeklySummary() {
  const summary = state.profile.lastWeekSummary;
  state.profile.hasPendingWeeklySummary = false;
  state.profile.lastWeekSummary = null;
  notify();
  return summary;
}

export function updateHeroName(name) {
  if (name && name.trim()) {
    state.profile.name = name.trim();
    addChronicleEvent(`📝 Hero renamed to ${state.profile.name}.`);
    notify();
  }
}

export function resetSave() {
  localStorage.removeItem(SAVE_KEY);
  window.location.reload();
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

      const levelUpText = `🌟 Level Up! ${skillEmojis[skill]} reached Level ${newLvl}!`;
      addChronicleEvent(levelUpText);
      
      if (state.profile.weeklyStats && !state.profile.weeklyStats.skillsLeveled.includes(skill)) {
        state.profile.weeklyStats.skillsLeveled.push(skill);
      }

      state.profile.pendingLevelUp = {
        title: `Your ${skillEmojis[skill]} level is now ${newLvl}!`,
        icon: skill === 'strength' ? '⚔️' : skill === 'cleaning' ? '🧹' : skill === 'wisdom' ? '📖' : '✨',
        statsList: statsList
      };
      return;
    }
  }

  // 2. Check if total Level (Character Level) leveled up
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

    const charLvlUpText = `🏆 Character Level increased to ${state.profile.totalLevel}!`;
    addChronicleEvent(charLvlUpText);

    state.profile.pendingLevelUp = {
      title: `Congratulations! Character Level increased to ${state.profile.totalLevel}!`,
      icon: '🏆',
      statsList: statsList
    };
  }
}

/* ==========================================================================
   RPG Progression Action Creators
   ========================================================================== */

export function changeClass(className, isInitialSetup = false) {
  if (!state.progression) return;
  state.progression.currentClass = className;
  addChronicleEvent(`⚔️ Class Evolution: Evolved into a ${className}!`);
  
  if (!isInitialSetup) {
    const classObj = CLASS_PATHS.find(c => c.name === className);
    if (classObj) {
      state.profile.pendingClassAdvancement = {
        className: className,
        tier: classObj.tier,
        ability: classObj.ability
      };
    }
  }

  recalculateDerivedStats();
  notify();
}

export function clearPendingClassAdvancement() {
  state.profile.pendingClassAdvancement = null;
  notify();
}

export function switchWeapon(weaponKey) {
  if (!state.progression) return;
  state.progression.equippedWeapon = weaponKey;
  const name = WEAPON_PRESETS[weaponKey]?.name || "Fists";
  addChronicleEvent(`⚔️ Equipped Weapon: Swapped active weapon to ${name}!`);
  recalculateDerivedStats();
  notify();
}

export function investEssence(amount) {
  if (!state.progression.armorForge) {
    state.progression.armorForge = { level: 1, essenceInvested: 0 };
  }
  const level = state.progression.armorForge.level;
  if (level >= 10) return false;

  const cost = getArmorForgeUpgradeCost(level);
  const maxCanInvest = cost - state.progression.armorForge.essenceInvested;
  const toInvest = Math.min(amount, maxCanInvest, state.progression.materials.essence);

  if (toInvest <= 0) return false;

  state.progression.materials.essence -= toInvest;
  state.progression.armorForge.essenceInvested += toInvest;

  let message = `Invested ${toInvest} Essence into the Armor Forge.`;

  if (state.progression.armorForge.essenceInvested >= cost) {
    state.progression.armorForge.level++;
    state.progression.armorForge.essenceInvested = 0;
    const newTier = ARMOR_TIERS[state.progression.armorForge.level - 1] || "Plate";
    message += ` 🛡️ Upgraded to ${newTier}!`;
    addChronicleEvent(`🛡️ Armor Forge Upgraded: Reached Level ${state.progression.armorForge.level} (${newTier})!`);
  }

  recalculateDerivedStats();
  notify();
  return { success: true, message };
}

export function upgradeCore(coreName) {
  // kept as stub for core compatibility
  return false;
}

export function equipCore(coreName) {
  // kept as stub
}

export function craftRelic(relicId, costEssence, costShards) {
  if (!state.progression) return false;
  if (state.progression.unlockedRelics.includes(relicId)) return false;

  if (state.progression.materials.essence >= costEssence &&
      state.progression.materials.relicShards >= costShards) {
    state.progression.materials.essence -= costEssence;
    state.progression.materials.relicShards -= costShards;
    state.progression.unlockedRelics.push(relicId);
    addChronicleEvent(`💍 Crafted Relic: Forged ${relicId}!`);
    notify();
    return true;
  }
  return false;
}

export function equipRelic(relicId) {
  if (!state.progression) return;
  state.progression.equippedRelic = relicId;
  addChronicleEvent(`💍 Equipped Relic: Active relic is now ${relicId}.`);
  recalculateDerivedStats();
  notify();
}

export function incrementCodexKill(monsterName) {
  if (!state.progression) return;
  if (!state.progression.monsterCodex[monsterName]) {
    state.progression.monsterCodex[monsterName] = 0;
  }
  state.progression.monsterCodex[monsterName]++;
  
  const kills = state.progression.monsterCodex[monsterName];
  if (kills === 10 || kills === 100 || kills === 1000) {
    addChronicleEvent(`👾 Codex Milestone: Defeated ${monsterName} ${kills} times! Buff unlocked!`);
  }
  
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
  const leveledUp = newRank > oldRank;
  
  if (leveledUp) {
    addChronicleEvent(`🎉 Weapon Mastery: ${weaponKey.toUpperCase()} reached Rank ${newRank}!`);
  }
  
  recalculateDerivedStats();
  notify();
  
  return { leveledUp, newRank };
}

