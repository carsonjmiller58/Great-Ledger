/* ==========================================================================
   The Great Ledger - Logical Game Mathematics & Formulas
   ========================================================================== */

/**
 * Calculates cumulative XP required to reach a specific level.
 * Exact formula used in Old School RuneScape (OSRS).
 * @param {number} level - Target level (1 to 99)
 * @returns {number} - Total cumulative XP required
 */
export function xpForLevel(level) {
  if (level <= 1) return 0;
  let sum = 0;
  for (let i = 1; i < level; i++) {
    sum += Math.floor(i + 300 * Math.pow(2, i / 7));
  }
  return Math.floor(sum / 4);
}

/**
 * Calculates current level based on total XP.
 * @param {number} xp - Cumulative XP
 * @returns {number} - Current level (1 to 99)
 */
export function levelForXp(xp) {
  for (let level = 1; level <= 99; level++) {
    if (xpForLevel(level) > xp) {
      return level - 1;
    }
  }
  return 99;
}

/**
 * Calculates Character Level based on OSRS skills with extra weight on the highest skill.
 * Formula: maxSkill * 0.5 + sum(otherSkills) * 0.15
 */
export function calculateCharacterLevel(skillsLevels) {
  const levels = Object.values(skillsLevels);
  if (levels.length === 0) return 1;
  const maxSkill = Math.max(...levels);
  const sumOthers = levels.reduce((a, b) => a + b, 0) - maxSkill;
  return Math.max(1, Math.floor(maxSkill * 0.5 + sumOthers * 0.15));
}

export const WEAPON_PRESETS = {
  blade: { name: "Broad Sword", key: "blade", range: 1, attack: 5, damage: 2, icon: "⚔️", desc: "Melee. Flat accuracy rating." },
  axe: { name: "Battle Axe", key: "axe", range: 1, attack: 2, damage: 6, icon: "🪓", desc: "Melee. Heavy physical damage." },
  spear: { name: "Pike Spear", key: "spear", range: 2, attack: 4, damage: 3, icon: "🔱", desc: "Polearm. Balance and reach." },
  dagger: { name: "Hunting Bow", key: "dagger", range: 5, attack: 6, damage: 1, icon: "🏹", desc: "Ranged. High agility crit rate." },
  staff: { name: "Wisdom Staff", key: "staff", range: 5, attack: 3, damage: 4, icon: "🪄", desc: "Ranged magic. Spell power scaling." },
  focus: { name: "Insight Orb", key: "focus", range: 5, attack: 2, damage: 2, icon: "🔮", desc: "Ranged magic. Crit multipliers." }
};

/**
 * Calculates current weapon rank based on cumulative Weapon XP.

 * Maximum rank is 20. Rank 1 starts at 0 XP.
 */
export function weaponRankForXp(xp) {
  if (!xp) return 1;
  let rank = 1;
  let needed = 100;
  let tempXp = xp;
  while (tempXp >= needed && rank < 20) {
    tempXp -= needed;
    rank++;
    needed = rank * 100;
  }
  return rank;
}

/**
 * Calculates current progress details (rank, current XP inside rank, and XP needed for next rank).
 */
export function getWeaponMasteryDetails(xp) {
  const rank = weaponRankForXp(xp);
  let totalXPForCurrent = 0;
  for (let r = 1; r < rank; r++) {
    totalXPForCurrent += r * 100;
  }
  const xpInCurrentRank = (xp || 0) - totalXPForCurrent;
  const xpNeededForNext = rank * 100;
  return { rank, current: xpInCurrentRank, next: xpNeededForNext };
}

/**
 * Maps any main-hand weapon name to its respective Weapon Mastery path category.
 */
export function getWeaponMasteryKey(itemName) {
  if (!itemName) return null;
  const name = itemName.toLowerCase();
  if (name === "blade" || name.includes("sword") || name.includes("scimitar") || name.includes("blade")) return "blade";
  if (name === "axe" || name.includes("axe")) return "axe";
  if (name === "spear" || name.includes("spear") || name.includes("halberd") || name.includes("pike")) return "spear";
  if (name === "dagger" || name.includes("dagger") || name.includes("knife") || name.includes("bow")) return "dagger";
  if (name === "staff" || name.includes("staff") || name.includes("wand") || name.includes("scepter")) return "staff";
  if (name === "focus" || name.includes("orb") || name.includes("book") || name.includes("focus")) return "focus";
  return "blade";
}


/* ==========================================================================
   Archetype Similarity Vector Resolver (7-Dimensional Cosine Similarity)
   Stats Vector Layout: [Strength, Agility, Wisdom, Intelligence, Insight, Vitality, Charisma]
   ========================================================================== */

const ARCHETYPE_SIGNATURES = {
  "Warrior":   [1.0, 0.4, 0.0, 0.0, 0.0, 0.8, 0.0], // High Str & Vit
  "Ranger":    [0.4, 1.0, 0.0, 0.0, 0.7, 0.4, 0.0], // High Agi & Ins
  "Scholar":   [0.0, 0.0, 1.0, 1.0, 0.4, 0.0, 0.0], // High Wis & Int
  "Alchemist": [0.0, 0.0, 0.3, 0.7, 1.0, 0.4, 0.0], // High Ins & Int
  "Bard":      [0.0, 0.5, 0.0, 0.0, 0.3, 0.0, 1.0], // High Cha & Agi
  "Crafter":   [0.8, 0.0, 0.0, 0.0, 0.3, 0.8, 0.4], // High Str & Vit & Insight
  "Merchant":  [0.0, 0.0, 0.7, 0.3, 0.0, 0.0, 1.0]  // High Cha & Wis
};

/**
 * Calculates the player's archetype based on cosine similarity of behavior vectors.
 * @param {number[]} stats - Array of 7 stat levels [Str, Agi, Wis, Int, Ins, Vit, Cha]
 * @returns {string} - Matching Archetype name
 */
export function calculateArchetype(stats) {
  // If no stats are leveled yet, player is a Novice
  const sum = stats.reduce((a, b) => a + b, 0);
  if (sum <= 7) return "Novice";

  let bestArchetype = "Novice";
  let maxSimilarity = -1;

  for (const [name, signature] of Object.entries(ARCHETYPE_SIGNATURES)) {
    const similarity = cosineSimilarity(stats, signature);
    if (similarity > maxSimilarity) {
      maxSimilarity = similarity;
      bestArchetype = name;
    }
  }

  return bestArchetype;
}

function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/* ==========================================================================
   Destiny Paths & Classes
   ========================================================================== */

export const CLASS_PATHS = [
  { name: "Commoner", tier: 1, reqs: {}, desc: "Free unlock", ability: "Jack of All Trades: Balanced baseline." },
  { name: "Wanderer", tier: 1, reqs: {}, desc: "Free unlock", ability: "Swift Stride: Faster exploration." },
  { name: "Street Rat", tier: 1, reqs: {}, desc: "Free unlock", ability: "Evasion: Chance to dodge." },
  { name: "Fighter", tier: 2, reqs: { strength: 10, vitality: 5 }, desc: "Req: Strength 10, Vitality 5", ability: "Cleave: +2 Attack, +1 Damage." },
  { name: "Rogue", tier: 2, reqs: { agility: 10, insight: 5 }, desc: "Req: Agility 10, Insight 5", ability: "Precision Strike: +1 Attack." },
  { name: "Mage", tier: 2, reqs: { intelligence: 10, wisdom: 5 }, desc: "Req: Intelligence 10, Wisdom 5", ability: "Arcane Focus: +3 Damage." },
  { name: "Paladin", tier: 3, reqs: { level: 20 }, desc: "Req: Character Lvl 20", ability: "Holy Aegis: +4 Armor, +15 Max HP." },
  { name: "Warden", tier: 3, reqs: { level: 20 }, desc: "Req: Character Lvl 20", ability: "Nature's Guard: +5 Armor, +20 Max HP." },
  { name: "Warlord", tier: 4, reqs: { level: 40 }, desc: "Req: Character Lvl 40", ability: "Tactical Command: +5 Attack, +3 Damage, +2 Armor." },
  { name: "God-Warrior", tier: 5, reqs: { level: 75 }, desc: "Req: Character Lvl 75", ability: "Ascension: Massive stat boosts across all combat metrics." }
];

/* ==========================================================================
   Dungeon Data Config & Encounter Registry
   ========================================================================== */

export const DUNGEONS = [
  {
    id: "woods",
    name: "Whispering Woods",
    biome: "forest",
    stepRequirement: 0,
    levelRequirement: 1,
    baseXPMultiplier: 1.0,
    baseGoldMultiplier: 1.0,
    description: "A dark canopy filled with mischievous sprites and wild woodland beats.",
    icon: "🌲",
    color: "var(--emerald-green)",
    monsters: [
      { name: "Forest Sprite", hp: 15, att: 2, def: 1, xp: 12 },
      { name: "Wild Woodwolf", hp: 20, att: 3, def: 2, xp: 20 },
      { name: "Corrupted Treant", hp: 35, att: 4, def: 3, xp: 45 }
    ],
    boss: { name: "Elder Druid Shade", hp: 60, att: 6, def: 4, xp: 150 }
  },
  {
    id: "caves",
    name: "Glimmering Caves",
    biome: "cave",
    stepRequirement: 5000,
    levelRequirement: 5,
    baseXPMultiplier: 1.25,
    baseGoldMultiplier: 1.2,
    description: "Luminous crystalline walls that echo with the pickaxes of goblin miners.",
    icon: "💎",
    color: "var(--sapphire-blue)",
    monsters: [
      { name: "Goblin Scavenger", hp: 25, att: 4, def: 2, xp: 35 },
      { name: "Cave Bat Swarm", hp: 18, att: 5, def: 1, xp: 25 },
      { name: "Crystalline Horror", hp: 45, att: 6, def: 5, xp: 75 }
    ],
    boss: { name: "Gemstone Colossus", hp: 90, att: 8, def: 8, xp: 300 }
  },
  {
    id: "ruins",
    name: "Shaded Ruins",
    biome: "ruins",
    stepRequirement: 15000,
    levelRequirement: 12,
    baseXPMultiplier: 1.6,
    baseGoldMultiplier: 1.5,
    description: "The crumbling archways of an ancient empire, now prowled by residual spirits.",
    icon: "🏛️",
    color: "var(--parchment-shadow)",
    monsters: [
      { name: "Spectral Archer", hp: 40, att: 7, def: 4, xp: 80 },
      { name: "Stone Gargoyle", hp: 55, att: 6, def: 7, xp: 110 },
      { name: "Tomb Wraith", hp: 50, att: 9, def: 3, xp: 120 }
    ],
    boss: { name: "Lich King Remnant", hp: 130, att: 11, def: 8, xp: 500 }
  },
  {
    id: "citadel",
    name: "Forgotten Citadel",
    biome: "castle",
    stepRequirement: 50000,
    levelRequirement: 25,
    baseXPMultiplier: 2.1,
    baseGoldMultiplier: 2.0,
    description: "A dark castle floating above burning chasms, guarded by elite black knights.",
    icon: "🏰",
    color: "var(--ruby-crimson)",
    monsters: [
      { name: "Citadel Guard", hp: 70, att: 11, def: 9, xp: 200 },
      { name: "Chasmic Imp", hp: 45, att: 13, def: 4, xp: 175 },
      { name: "Armored Wyvern", hp: 90, att: 12, def: 11, xp: 320 }
    ],
    boss: { name: "Dread Knight Overlord", hp: 200, att: 16, def: 13, xp: 1000 }
  },
  {
    id: "vaults",
    name: "Ancient Vaults",
    biome: "vault",
    stepRequirement: 100000,
    levelRequirement: 40,
    baseXPMultiplier: 3.0,
    baseGoldMultiplier: 3.0,
    description: "The cosmic chamber where the origin ledger is buried, guarded by ancient chronomancers.",
    icon: "🪐",
    color: "var(--gold-primary)",
    monsters: [
      { name: "Aether Sentry", hp: 100, att: 15, def: 13, xp: 450 },
      { name: "Void Stalker", hp: 80, att: 18, def: 10, xp: 420 },
      { name: "Temporal Warden", hp: 120, att: 16, def: 15, xp: 600 }
    ],
    boss: { name: "Chronos Cosmic Dragon", hp: 350, att: 22, def: 18, xp: 2500 }
  }
];

/* ==========================================================================
   Light Automated Dice Combat & Loot Resolver
   ========================================================================== */

/**
 * Resolves one combat tick.
 * Returns combat log detailing hits, misses, damage, and active HP changes.
 */
export function rollCombatTick(player, enemy, playerRange = 1, progression = null) {
  const prog = progression || {
    currentClass: "Commoner",
    equippedCore: "Iron",
    coreRanks: { Iron: 1 },
    equippedRelic: null,
    weaponXP: { blade: 0, axe: 0, spear: 0, dagger: 0, staff: 0, focus: 0 },
    monsterCodex: {},
    materials: {}
  };

  const monsterName = enemy.name.toLowerCase();
  const isMonsterRanged = monsterName.includes("sprite") || 
                          monsterName.includes("archer") || 
                          monsterName.includes("imp") || 
                          monsterName.includes("wraith") || 
                          monsterName.includes("lich") || 
                          monsterName.includes("warden") || 
                          monsterName.includes("dragon");
  const monsterRange = isMonsterRanged ? 5 : 1;

  let logDetails = [];
  let playerHit = false;
  let playerDmg = 0;
  let enemyHit = false;
  let enemyDmg = 0;

  // Initialize player shield at the start of combat if Vanguard Core is equipped
  if (player.shieldHP === undefined) {
    if (prog.equippedCore === "Vanguard") {
      const coreRank = prog.coreRanks.Vanguard || 1;
      player.shieldHP = coreRank * 5;
      logDetails.push(`🛡️ Vanguard Core activated! Gained a shield of ${player.shieldHP} HP.`);
    } else {
      player.shieldHP = 0;
    }
  }

  // Combat turn increment
  if (enemy.combatTurn === undefined) {
    enemy.combatTurn = 0;
  }
  enemy.combatTurn++;

  // Apply Burn DoT on Enemy if active
  if (enemy.burnTicks && enemy.burnTicks > 0) {
    const burnDmg = 3;
    enemy.hp = Math.max(0, enemy.hp - burnDmg);
    enemy.burnTicks--;
    logDetails.push(`🔥 The ${enemy.name} burns for ${burnDmg} damage (${enemy.burnTicks} burn turns left).`);
  }

  // 1. Player Turn (Attack or Advance)
  if (enemy.currentDistance > playerRange) {
    enemy.currentDistance = Math.max(playerRange, enemy.currentDistance - 2);
    logDetails.push(`🏃 You advance closer to the ${enemy.name} (Distance: ${enemy.currentDistance}m).`);
  } else {
    // In range!
    let activeAbilityUsed = false;
    let dmgMultiplier = 1.0;
    let bypassEnemyDefense = false;
    let forceCrit = false;

    // Class Skill Triggers
    if (prog.currentClass === "Fighter" && enemy.combatTurn % 4 === 0) {
      logDetails.push(`⚔️ Ability [Cleave] triggered! Next strike deals double damage.`);
      dmgMultiplier = 2.0;
      activeAbilityUsed = true;
    } else if (prog.currentClass === "Mage" && enemy.combatTurn % 3 === 0) {
      logDetails.push(`🧪 Ability [Fireball] triggered! Cast fire blast on ${enemy.name}.`);
      dmgMultiplier = 1.5;
      enemy.burnTicks = 3;
      activeAbilityUsed = true;
    } else if (prog.currentClass === "Commoner" && player.currentHP < player.combatStats.maxHP * 0.3 && !player.gritActive) {
      logDetails.push(`🛡️ Ability [Grit] triggered! Gained temporary +5 armor rating.`);
      player.gritActive = true;
      player.combatStats.defense += 5;
    }

    // Weapon Affinity Effects
    const mainHandName = player.equippedMainHandName || "";
    const weaponKey = getWeaponMasteryKey(mainHandName);
    const affinity = weaponKey ? prog.weaponAffinities[weaponKey] : null;

    let critMultiplier = 2.0;
    if (prog.currentClass === "Duel Master" || prog.currentClass === "Shadow Blade") {
      critMultiplier = 2.5;
    }
    if (affinity === "Shadow") {
      critMultiplier += 0.5; // Extra shadow crit multiplier
    }

    // Determine defense ignores
    let effectiveEnemyDef = enemy.def;
    if (affinity === "Void") {
      effectiveEnemyDef = Math.max(0, Math.floor(enemy.def * 0.7)); // Ignore 30% armor
    }

    // Roll Player Accuracy Hit
    const playerRoll = Math.floor(Math.random() * 20) + 1 + player.combatStats.attack;
    const enemyDefense = effectiveEnemyDef + 10;
    playerHit = playerRoll >= enemyDefense;

    // Apply Frost Affinity debuff on hit
    if (playerHit && affinity === "Frost") {
      enemy.def = Math.max(0, enemy.def - 1);
      logDetails.push(`❄️ Frost affinity chilled the ${enemy.name}, reducing defense rating!`);
    }

    if (playerHit) {
      // Crit Chance check
      let critChance = 5 + Math.floor((player.skillsLevels?.agility || 0) / 6);
      if (weaponKey === "dagger") critChance += 10; // Daggers/Bows bonus
      if (prog.currentClass === "Fighter") critChance += 15;
      if (prog.equippedRelic === "Lucky Coin") critChance += 5;
      if (prog.equippedRelic === "Assassin's Mark") critChance += 10;

      // Codex Kills crit bonus (kills >= 10 adds 0.25% crit per monster)
      let codexBonus = 0;
      for (const [_, kCount] of Object.entries(prog.monsterCodex)) {
        if (kCount >= 10) codexBonus += 0.25;
      }
      critChance += Math.floor(codexBonus);

      const isCrit = (Math.random() * 100 < critChance) || forceCrit;

      playerDmg = Math.max(1, Math.floor(Math.random() * player.combatStats.damageRange) + 1 + Math.floor(player.combatStats.attack / 3));
      playerDmg = Math.floor(playerDmg * dmgMultiplier);

      if (isCrit) {
        playerDmg = Math.floor(playerDmg * critMultiplier);
        playerHit = "crit"; // Indicate critical hit in logs!
      }

      if (affinity === "Storm") {
        playerDmg += 3; // Storm chain damage
      }

      enemy.hp = Math.max(0, enemy.hp - playerDmg);
    }
  }

  // 2. Monster Turn (Attack or Advance)
  if (enemy.hp > 0) {
    if (enemy.currentDistance > monsterRange) {
      enemy.currentDistance = Math.max(1, enemy.currentDistance - 2);
      logDetails.push(`👣 The ${enemy.name} stalks closer (Distance: ${enemy.currentDistance}m).`);
    } else {
      // In range!
      // Check player dodge rate
      let dodgeChance = 1 + Math.floor((player.skillsLevels?.agility || 0) / 4);
      if (prog.currentClass === "Rogue") dodgeChance += 20;
      else if (prog.currentClass === "Street Rat") dodgeChance += 10;
      
      const coreRank = prog.coreRanks[prog.equippedCore] || 0;
      if (prog.equippedCore === "Mirage") dodgeChance += coreRank * 1.5;

      const isDodged = Math.random() * 100 < dodgeChance;

      // Special active dodge ability (Rogue Vanish every 5 turns)
      let isVanished = false;
      if (prog.currentClass === "Rogue" && enemy.combatTurn % 5 === 0) {
        logDetails.push(`💨 Active Ability [Vanish] triggered! Gained 100% dodge.`);
        isVanished = true;
      }

      if (isDodged || isVanished) {
        logDetails.push(`💨 You gracefully dodged the ${enemy.name}'s attack!`);
      } else {
        const enemyRoll = Math.floor(Math.random() * 20) + 1 + enemy.att;
        const playerDefense = player.combatStats.defense + 10;
        enemyHit = enemyRoll >= playerDefense;

        if (enemyHit) {
          enemyDmg = Math.max(1, Math.floor(Math.random() * Math.max(3, enemy.att)) + 1 - Math.floor(player.combatStats.defense / 4));
          
          // Core damage reduction block
          let dmgBlock = 0;
          if (prog.equippedCore === "Iron") {
            dmgBlock = coreRank * 1;
          } else if (prog.equippedCore === "Juggernaut") {
            dmgBlock = Math.floor(coreRank * 0.5);
          }
          if (dmgBlock > 0) {
            enemyDmg = Math.max(1, enemyDmg - dmgBlock);
          }

          // Damage absorption by Shield
          if (player.shieldHP > 0) {
            const absorbed = Math.min(player.shieldHP, enemyDmg);
            player.shieldHP -= absorbed;
            enemyDmg -= absorbed;
            logDetails.push(`🛡️ Shield absorbed ${absorbed} damage (${player.shieldHP} shield HP remaining).`);
          }

          if (enemyDmg > 0) {
            player.currentHP = Math.max(0, player.currentHP - enemyDmg);
          } else {
            enemyHit = false; // Negated
          }
        }
      }
    }
  }

  return {
    playerHit,
    playerDmg,
    enemyHit,
    enemyDmg,
    enemyHP: enemy.hp,
    playerHP: player.currentHP,
    logDetails
  };
}

/**
 * Procedural Equipment Loot Generator
 * Creates custom styled SVGs and medieval stats based on dungeon rarity triggers.
 */
export function generateProceduralLoot(dungeonId) {
  const dungeon = DUNGEONS.find(d => d.id === dungeonId) || DUNGEONS[0];
  const mult = dungeon.baseGoldMultiplier;

  // Decide Rarity
  const roll = Math.random();
  let rarity = "Common";
  let rarityColor = "var(--ink-charcoal)";
  let statBonus = 1;

  if (roll > 0.98 && dungeonId !== "woods") {
    rarity = "Legendary";
    rarityColor = "var(--gold-primary)";
    statBonus = Math.floor(5 * mult);
  } else if (roll > 0.88 && dungeonId !== "woods") {
    rarity = "Epic";
    rarityColor = "var(--ruby-crimson)";
    statBonus = Math.floor(3 * mult);
  } else if (roll > 0.55) {
    rarity = "Rare";
    rarityColor = "var(--sapphire-blue)";
    statBonus = Math.floor(2 * mult);
  } else {
    rarity = "Common";
    rarityColor = "var(--ink-muted)";
    statBonus = Math.floor(1 * mult);
  }

  // Equipment Slot Choice
  const slots = ["helmet", "chestArmor", "gloves", "boots", "mainHand", "offHand"];
  const slot = slots[Math.floor(Math.random() * slots.length)];

  // Equipment Names Registry
  const names = {
    helmet: ["Iron Casque", "Knight Visor", "Great Helm", "Rogue Hood", "Wizard Cowl", "Runed Crown"],
    chestArmor: ["Chainmail Hauberk", "Steel Platebody", "Hardened Leather Coat", "Scholar Robes", "Gilded Brigandine"],
    gloves: ["Steel Gauntlets", "Leather Vambraces", "Slik Mittens", "Runed Bracers"],
    boots: ["Iron Greaves", "Sabatons", "Soft Leather Boots", "Scholar Sandals"],
    mainHand: ["Broad Sword", "Steel Scimitar", "Dagger of Swiftness", "Wisdom Staff", "Battle Axe", "Halberd", "Shortbow of Swiftness", "Runed Longbow"],
    offHand: ["Bronze Kite Shield", "Steel Round Shield", "Spell Spellbook", "Insight Orb", "Buckler"]
  };

  const baseName = names[slot][Math.floor(Math.random() * names[slot].length)];
  const itemName = `[${rarity}] ${baseName}`;

  // Stat allocation based on slot
  let stats = { attack: 0, defense: 0, speed: 0, intelligence: 0, wisdom: 0 };
  
  if (slot === "mainHand") {
    stats.attack = statBonus * 2;
    stats.speed = statBonus;
  } else if (slot === "offHand") {
    stats.defense = statBonus * 2;
    stats.wisdom = statBonus;
  } else if (slot === "chestArmor") {
    stats.defense = statBonus * 3;
  } else if (slot === "helmet") {
    stats.defense = statBonus;
    stats.intelligence = statBonus;
  } else if (slot === "gloves") {
    stats.attack = statBonus;
    stats.defense = statBonus;
  } else if (slot === "boots") {
    stats.defense = statBonus;
    stats.speed = statBonus * 2;
  }

  // Sell value
  const goldValue = Math.floor((statBonus * 12 + Math.random() * 15) * mult);

  return {
    id: `item-${Date.now()}-${Math.floor(Math.random()*1000)}`,
    name: itemName,
    slot,
    rarity,
    rarityColor,
    stats,
    goldValue,
    icon: getItemIconSVG(slot, rarityColor)
  };
}

function getItemIconSVG(slot, color) {
  // Generates clean embedded visual inline SVG tags for slots
  const svgStart = `<svg viewBox="0 0 100 100" style="width:100%; height:100%; fill:${color}; stroke:var(--ink-charcoal); stroke-width:3px;">`;
  const svgEnd = `</svg>`;
  let paths = "";

  if (slot === "mainHand") {
    // Sword
    paths = `<path d="M70 20 L80 30 L55 55 L45 45 Z" /><path d="M40 40 L50 50 L45 55 L35 45 Z" fill="var(--ink-muted)" /><circle cx="30" cy="70" r="6" />`;
  } else if (slot === "offHand") {
    // Shield
    paths = `<path d="M30 20 H70 C70 50, 50 80, 50 80 C50 80, 30 50, 30 20 Z" />`;
  } else if (slot === "helmet") {
    // Helm
    paths = `<circle cx="50" cy="50" r="30" /><path d="M35 50 H65 V65 H35 Z" fill="rgba(0,0,0,0.3)" /><path d="M50 20 V50" stroke="var(--gold-primary)" stroke-width="4px" />`;
  } else if (slot === "chestArmor") {
    // Cuirass
    paths = `<path d="M30 20 H70 L75 55 L65 80 H35 L25 55 Z" /><circle cx="50" cy="45" r="10" fill="rgba(0,0,0,0.1)" />`;
  } else if (slot === "gloves") {
    // Gauntlets
    paths = `<path d="M35 40 H65 L60 80 H40 Z" /><circle cx="50" cy="50" r="4" />`;
  } else if (slot === "boots") {
    // Shoes
    paths = `<path d="M30 40 H55 V60 H70 V75 H30 Z" />`;
  }

  return svgStart + paths + svgEnd;
}
