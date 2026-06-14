/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { serverDb, SUPABASE_DDL } from './serverDb';
import { getFusionSkill, FUSION_SKILLS_LIST } from './src/elementSkills';
import { 
  ElementId, 
  PlayerDB, 
  GameWSMessage, 
  GameMatchState, 
  CharacterState, 
  ProjectileState, 
  SkillEffectTrigger 
} from './src/types';

const app = express();
const PORT = 3000;
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());

// 1. HTTP API endpoints
app.get('/api/ddl', (req, res) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send(SUPABASE_DDL);
});

app.get('/api/rankings', (req, res) => {
  const top = serverDb.getTopPlayers(10);
  res.json({ success: true, players: top });
});

// Create player
app.post('/api/player', (req, res) => {
  const { username } = req.body;
  if (!username || typeof username !== 'string' || username.trim().length === 0) {
    return res.status(400).json({ success: false, message: '올바른 아이디를 입력해주세요.' });
  }
  const player = serverDb.createPlayer(username);
  res.json({ success: true, player });
});

// Match state registry
const activeMatches = new Map<string, {
  state: GameMatchState;
  p1Socket: WebSocket | null; // Null means Bot
  p2Socket: WebSocket | null; // Null means Bot
  p1Inputs: { moveX: number; jump: boolean; skill: 'A' | 'S' | 'R' | null; timestamp: number };
  p2Inputs: { moveX: number; jump: boolean; skill: 'A' | 'S' | 'R' | null; timestamp: number };
  p1Cooldowns: { A: number; S: number; R: number };
  p2Cooldowns: { A: number; S: number; R: number };
  isBotMatch: boolean;
  intervalId: NodeJS.Timeout;
}>();

// Arena Constants
const ARENA_WIDTH = 1000;
const FLOOR_Y = 480;
const GRAVITY = 1.0;
const PLAYER_SPEED = 7.5;
const JUMP_FORCE = -18.0;

// Matchmaker queues
interface QueuePlayer {
  socket: WebSocket;
  username: string;
  elem1: ElementId;
  elem2: ElementId;
  playerId: string;
}
let waitingQueue: QueuePlayer[] = [];

// Monitor queue and match players
setInterval(() => {
  if (waitingQueue.length >= 2) {
    const p1 = waitingQueue.shift()!;
    const p2 = waitingQueue.shift()!;
    startMatchBetween(p1, p2);
  } else if (waitingQueue.length === 1) {
    // If waiting for over 4.5 seconds, start a bot match
    const p1 = waitingQueue[0];
    // Check if this player has been in queue for a while or if they want to speed match
    // Let's boot a Bot after a safe timeout, or trigger it directly.
    // To be responsive, we can let them wait up to 4 seconds, or match immediately if they hit AI start.
  }
}, 1000);

function startMatchBetween(qp1: QueuePlayer, qp2: QueuePlayer) {
  const db1 = serverDb.getPlayerById(qp1.playerId) || serverDb.createPlayer(qp1.username);
  const db2 = serverDb.getPlayerById(qp2.playerId) || serverDb.createPlayer(qp2.username);

  const room = serverDb.createRoom(db1.id, qp1.elem1, qp1.elem2);
  serverDb.joinRoom(room.id, db2.id, qp2.elem1, qp2.elem2);

  createMatchInstance(room.id, qp1.socket, qp2.socket, db1, db2, false, [qp1.elem1, qp1.elem2], [qp2.elem1, qp2.elem2]);
}

function startBotMatchFor(qp: QueuePlayer) {
  // Remove from queue
  waitingQueue = waitingQueue.filter(q => q.socket !== qp.socket);

  const db1 = serverDb.getPlayerById(qp.playerId) || serverDb.createPlayer(qp.username);
  // Pick a random elemental bot
  const botNames = ['InfernoMaster_Bot', 'StormWalker_Bot', 'GlacierPrism_Bot', 'EarthShield_AI', 'ShadowSpore_Bot'];
  const botName = botNames[Math.floor(Math.random() * botNames.length)];
  const db2 = serverDb.createPlayer(botName);

  const botElements: ElementId[] = ['fire', 'lightning', 'ice', 'plant', 'wind', 'light', 'earth', 'void'];
  const botElem1 = botElements[Math.floor(Math.random() * botElements.length)];
  let botElem2 = botElements[Math.floor(Math.random() * botElements.length)];
  while (botElem1 === botElem2) {
    botElem2 = botElements[Math.floor(Math.random() * botElements.length)];
  }

  const room = serverDb.createRoom(db1.id, qp.elem1, qp.elem2);
  serverDb.joinRoom(room.id, db2.id, botElem1, botElem2);

  createMatchInstance(room.id, qp.socket, null, db1, db2, true, [qp.elem1, qp.elem2], [botElem1, botElem2]);
}

function createMatchInstance(
  roomId: string, 
  s1: WebSocket | null, 
  s2: WebSocket | null, 
  p1Db: PlayerDB, 
  p2Db: PlayerDB,
  isBotMatch: boolean,
  p1Elems: ElementId[],
  p2Elems: ElementId[]
) {
  const p1Character: CharacterState = {
    id: p1Db.id,
    username: p1Db.username,
    x: 200,
    y: FLOOR_Y,
    vx: 0,
    vy: 0,
    width: 40,
    height: 90,
    facingLeft: false,
    health: 100,
    maxHealth: 100,
    mana: 100,
    maxMana: 100,
    ultiGauge: 0,
    activeBuffs: [],
    isJumping: false,
    isStunned: false,
    isSilenced: false,
    isBlinded: false,
    isSuperArmor: false,
    isInvincible: false
  };

  const p2Character: CharacterState = {
    id: p2Db.id,
    username: p2Db.username,
    x: 800,
    y: FLOOR_Y,
    vx: 0,
    vy: 0,
    width: 40,
    height: 90,
    facingLeft: true,
    health: 100,
    maxHealth: 100,
    mana: 100,
    maxMana: 100,
    ultiGauge: 0,
    activeBuffs: [],
    isJumping: false,
    isStunned: false,
    isSilenced: false,
    isBlinded: false,
    isSuperArmor: false,
    isInvincible: false
  };

  const matchState: GameMatchState = {
    roomId,
    p1: p1Character,
    p2: p2Character,
    projectiles: [],
    effects: [],
    winnerId: null,
    timer: 90,
    shakeIntensity: 0
  };

  // Cooldown tracker (in game frames; 30fps = 30 frames/sec)
  const p1Cooldowns = { A: 0, S: 0, R: 0 };
  const p2Cooldowns = { A: 0, S: 0, R: 0 };

  const p1Inputs = { moveX: 0, jump: false, skill: null as 'A' | 'S' | 'R' | null, timestamp: Date.now() };
  const p2Inputs = { moveX: 0, jump: false, skill: null as 'A' | 'S' | 'R' | null, timestamp: Date.now() };

  // Notify clients
  if (s1 && s1.readyState === WebSocket.OPEN) {
    s1.send(JSON.stringify({ 
      type: 'match_found', 
      roomId, 
      p1: p1Db, 
      p2: p2Db, 
      side: 1,
      p1Elems,
      p2Elems
    }));
  }
  if (s2 && s2.readyState === WebSocket.OPEN) {
    s2.send(JSON.stringify({ 
      type: 'match_found', 
      roomId, 
      p1: p1Db, 
      p2: p2Db, 
      side: 2,
      p1Elems,
      p2Elems
    }));
  }

  // AI State machine variables (if Bot model active)
  let botTargetX = 500;
  let botActionTimer = 0;

  // Run physical update loop at ~30 FPS (33ms)
  const timerSecondInterval = 30; // 30 ticks = 1 sec
  let tickCount = 0;

  const intervalId = setInterval(() => {
    tickCount++;

    // 1. Decrement timer
    if (tickCount % timerSecondInterval === 0 && matchState.timer > 0) {
      matchState.timer--;
    }

    // 2. Clear Screen shake
    if (matchState.shakeIntensity > 0) {
      matchState.shakeIntensity *= 0.85;
      if (matchState.shakeIntensity < 0.2) matchState.shakeIntensity = 0;
    }

    // 3. Simple AI Bot logic for Player 2 (if active)
    if (isBotMatch) {
      botActionTimer++;
      const p1 = matchState.p1;
      const p2 = matchState.p2;

      // Follow or keep distance based on health
      if (p2.health > 30) {
        botTargetX = p1.x + (p1.facingLeft ? -100 : 100);
      } else {
        botTargetX = p2.x < p1.x ? 100 : 900; // run away
      }

      // Add noise to target
      if (botActionTimer % 60 === 0) {
        botTargetX += (Math.random() - 0.5) * 150;
      }

      // Left/Right movements
      if (Math.abs(p2.x - botTargetX) > 40) {
        p2Inputs.moveX = p2.x < botTargetX ? 1 : -1;
      } else {
        p2Inputs.moveX = 0;
      }

      // Jumping conditions
      const nearbyProjectile = matchState.projectiles.find(proj => 
        proj.ownerId !== p2.id && Math.abs(proj.x - p2.x) < 180 && Math.abs(proj.y - p2.y) < 100
      );
      if (nearbyProjectile && Math.random() < 0.25) {
        p2Inputs.jump = true;
      } else if (Math.random() < 0.02) {
        p2Inputs.jump = true; // casual jump
      } else {
        p2Inputs.jump = false;
      }

      // Skill casts trigger
      if (!p2.isSilenced && !p2.isStunned) {
        if (p2.ultiGauge >= 100 && p2Cooldowns.R <= 0) {
          p2Inputs.skill = 'R';
        } else if (p2.mana >= 35 && p2Cooldowns.A <= 0 && Math.random() < 0.08) {
          p2Inputs.skill = 'A';
        } else if (p2.mana >= 30 && p2Cooldowns.S <= 0 && Math.random() < 0.04) {
          p2Inputs.skill = 'S';
        }
      }
    }

    // 4. Update both players' active states, buffs/debuffs
    [matchState.p1, matchState.p2].forEach((player, idx) => {
      // Mana natural recovery
      const isOverloaded = player.activeBuffs.some(b => b.type === 'photosynthesis');
      const specManaRegen = isOverloaded ? 1.5 : 0.4;
      player.mana = Math.min(player.maxMana, player.mana + specManaRegen);

      // Process buff/debuff timers
      player.activeBuffs.forEach(b => {
        b.duration -= 33;
      });
      player.activeBuffs = player.activeBuffs.filter(b => b.duration > 0);

      // Derived states
      player.isStunned = player.activeBuffs.some(b => b.type === 'stun' || b.type === 'freeze' || b.type === 'frost_prison');
      player.isSilenced = player.activeBuffs.some(b => b.type === 'silence');
      player.isBlinded = player.activeBuffs.some(b => b.type === 'blind');
      player.isSuperArmor = player.activeBuffs.some(b => b.type === 'super_armor' || b.type === 'glacier_fortress');
      player.isInvincible = player.activeBuffs.some(b => b.type === 'invincible' || b.type === 'thunderstorm_drive');

      // Reduce cooldowns
      const coolDownRates = isOverloaded ? 3 : 1; 
      const cds = idx === 0 ? p1Cooldowns : p2Cooldowns;
      if (cds.A > 0) cds.A = Math.max(0, cds.A - coolDownRates);
      if (cds.S > 0) cds.S = Math.max(0, cds.S - coolDownRates);
      if (cds.R > 0) cds.R = Math.max(0, cds.R - coolDownRates);

      // Handle Inputs if not stunned
      const inputs = idx === 0 ? p1Inputs : p2Inputs;
      if (!player.isStunned) {
        // Evaluate slow percentage
        let speedFactor = 1.0;
        const speedBuffs = player.activeBuffs.filter(b => b.type === 'slow' || b.type === 'abyssal_spore' || b.type === 'absolute_zero');
        if (speedBuffs.length > 0) {
          // find highest slow value
          const maxSlow = Math.max(...speedBuffs.map(b => b.value || 0.5));
          speedFactor = Math.max(0.1, 1 - maxSlow);
        }

        // Apply sandstorm reverse effect
        const inSandstorm = matchState.effects.some(e => e.type === 'sandstorm' && Math.abs(e.x - player.x) < e.radius);
        const directionMultiplier = inSandstorm ? -1 : 1;

        // Apply horizontal movement
        player.vx = inputs.moveX * PLAYER_SPEED * speedFactor * directionMultiplier;
        if (inputs.moveX !== 0) {
          player.facingLeft = inputs.moveX < 0;
        }

        // Apply vertical jumping (only if on ground)
        if (inputs.jump && player.y >= FLOOR_Y) {
          player.vy = JUMP_FORCE;
          player.isJumping = true;
        }
      } else {
        // If stunned or frozen, horizontal velocity freezes
        player.vx = 0;
      }

      // Apply Gravity
      player.y += player.vy;
      player.x += player.vx;
      
      if (player.y < FLOOR_Y) {
        player.vy += GRAVITY;
      } else {
        player.y = FLOOR_Y;
        player.vy = 0;
        player.isJumping = false;
      }

      // Constrain inside Arena bounds
      player.x = Math.max(40, Math.min(ARENA_WIDTH - 40, player.x));

      // Process casted skill trigger
      if (inputs.skill && !player.isStunned) {
        const p1Elems_toUse = idx === 0 ? p1Elems : p2Elems;
        const opp = idx === 0 ? matchState.p2 : matchState.p1;
        const cooldowns = idx === 0 ? p1Cooldowns : p2Cooldowns;

        if (inputs.skill === 'A' && cooldowns.A === 0 && player.mana >= 25 && !player.isSilenced) {
          // ELEMENT S1 Active (Skill A)
          player.mana -= 25;
          cooldowns.A = 45; // 1.5s
          castSkill1(player, opp, p1Elems_toUse[0], matchState);
        } 
        else if (inputs.skill === 'S' && cooldowns.S === 0 && player.mana >= 20 && !player.isSilenced) {
          // ELEMENT S2 Active (Skill S)
          player.mana -= 20;
          cooldowns.S = 60; // 2.0s
          castSkill2(player, opp, p1Elems_toUse[1], matchState);
        }
        else if (inputs.skill === 'R' && cooldowns.R === 0 && player.ultiGauge >= 100) {
          // COMBINATION ULTIMATE (Skill R)
          player.ultiGauge = 0;
          cooldowns.R = 150; // 5.0 seconds battle CD
          castUltimate(player, opp, p1Elems_toUse[0], p1Elems_toUse[1], matchState);
        }

        // Reset inputs skill trigger so we only register one click per frame
        inputs.skill = null;
      }
    });

    // 5. Update projectiles physics
    matchState.projectiles.forEach(proj => {
      proj.x += proj.vx;
      proj.y += proj.vy;
      proj.duration -= 33;

      // Collide with opponents
      const target = proj.ownerId === matchState.p1.id ? matchState.p2 : matchState.p1;
      const dist = Math.sqrt((proj.x - target.x) ** 2 + (proj.y - target.y) ** 2);
      if (dist < (proj.radius + 30) && !target.isInvincible) {
        // HIT!
        proj.duration = 0; // expire projectile
        matchState.shakeIntensity = Math.max(matchState.shakeIntensity, 6);

        // Calculate damage
        let actualDamage = proj.damage;
        // Check Earth Stone armor / Fortress reduction
        const hasFortress = target.activeBuffs.some(b => b.type === 'glacier_fortress');
        const hasStoneArmor = target.activeBuffs.some(b => b.type === 'super_armor');
        if (hasFortress) {
          actualDamage *= 0.4; // 60% reduction
          // slow attacker if human
          const attacker = proj.ownerId === matchState.p1.id ? matchState.p1 : matchState.p2;
          attacker.activeBuffs.push({ type: 'slow', duration: 1500, maxDuration: 1500, value: 0.4 });
        } else if (hasStoneArmor) {
          actualDamage *= 0.7; // 30% reduction
        }

        target.health = Math.max(0, target.health - actualDamage);

        // Charging Ultimate meters of attacker
        const attackerObj = proj.ownerId === matchState.p1.id ? matchState.p1 : matchState.p2;
        attackerObj.ultiGauge = Math.min(100, attackerObj.ultiGauge + 15);

        // Inflict corresponding debuffs based on element type
        handleProjectileDebuffs(proj.type, target, matchState, attackerObj);
      }
    });
    // Filter expired project
    matchState.projectiles = matchState.projectiles.filter(p => p.duration > 0);

    // 6. Update active area fields/triggers
    matchState.effects.forEach(eff => {
      eff.duration -= 33;

      // Volcano lava, blackholes continuously drag / damage target in radius
      const target = eff.ownerId === matchState.p1.id ? matchState.p2 : matchState.p1;
      const dist = Math.sqrt((eff.x - target.x) ** 2 + (eff.y - target.y) ** 2);

      if (dist < eff.radius && !target.isInvincible) {
        // Continuous actions
        if (eff.type === 'volcano_ground') {
          // damage
          target.health = Math.max(0, target.health - 0.5); // continuous molten burn
          if (Math.random() < 0.1) {
            target.activeBuffs.push({ type: 'slow', duration: 1000, maxDuration: 1000, value: 0.3 });
          }
        } else if (eff.type === 'blackhole' || eff.type === 'void_vacuum') {
          // drag force vectors
          const dx = eff.x - target.x;
          const dy = eff.y - target.y;
          const kForce = eff.type === 'void_vacuum' ? 0.08 : 0.04;
          target.x += dx * kForce;
          target.y += dy * kForce;
          target.health = Math.max(0, target.health - 0.2); // mild pull damage
        } else if (eff.type === 'sandstorm') {
          // Continuous damage
          target.health = Math.max(0, target.health - 0.15);
        } else if (eff.type === 'photo_field') {
          // healing the owner
          const owner = eff.ownerId === matchState.p1.id ? matchState.p1 : matchState.p2;
          owner.health = Math.min(owner.maxHealth, owner.health + 0.15);
        }
      }
    });
    matchState.effects = matchState.effects.filter(e => e.duration > 0);

    // 7. Check Victory condition
    if (matchState.p1.health <= 0 || matchState.p2.health <= 0 || matchState.timer <= 0) {
      clearInterval(intervalId);
      
      let winnerId = '';
      let winnerUsername = 'Draw';

      if (matchState.p1.health <= 0 && matchState.p2.health <= 0) {
        // Draw
      } else if (matchState.p1.health <= 0) {
        winnerId = matchState.p2.id;
        winnerUsername = matchState.p2.username;
      } else if (matchState.p2.health <= 0) {
        winnerId = matchState.p1.id;
        winnerUsername = matchState.p1.username;
      } else {
        // Timeout, higher health wins
        if (matchState.p1.health > matchState.p2.health) {
          winnerId = matchState.p1.id;
          winnerUsername = matchState.p1.username;
        } else if (matchState.p2.health > matchState.p1.health) {
          winnerId = matchState.p2.id;
          winnerUsername = matchState.p2.username;
        }
      }

      matchState.winnerId = winnerId;
      serverDb.finishRoom(roomId);
      if (winnerId && winnerId !== 'b1-id' && winnerId !== 'b2-id') {
        serverDb.incrementPlayerWin(winnerId);
      }

      broadcastToRoom(roomId, {
        type: 'match_over',
        winnerId,
        winnerUsername
      });

      activeMatches.delete(roomId);
      return;
    }

    // 8. Broadcast state to clients
    broadcastToRoom(roomId, {
      type: 'game_update',
      state: matchState
    });

  }, 33);

  activeMatches.set(roomId, {
    state: matchState,
    p1Socket: s1,
    p2Socket: s2,
    p1Inputs,
    p2Inputs,
    p1Cooldowns,
    p2Cooldowns,
    isBotMatch,
    intervalId
  });
}

function handleProjectileDebuffs(type: string, target: CharacterState, match: GameMatchState, attacker: CharacterState) {
  if (type === 'fire') {
    // 3s burn damage (as a slow tick or tick trigger)
    target.activeBuffs.push({ type: 'slow', duration: 3000, maxDuration: 3000, value: 0.2 });
    // periodic damage simulation: let's immediately trigger tick damage in buff processing by custom types or handle directly
    target.health = Math.max(0, target.health - 5); // impact burn
  } else if (type === 'ice') {
    // 50% slow
    target.activeBuffs.push({ type: 'slow', duration: 2500, maxDuration: 2500, value: 0.5 });
  } else if (type === 'plant') {
    // Trap snare slow or root duration
    target.activeBuffs.push({ type: 'slow', duration: 1500, maxDuration: 1500, value: 0.8 });
  } else if (type === 'lightning') {
    // stun/shake shock
    target.activeBuffs.push({ type: 'stun', duration: 300, maxDuration: 300 });
  } else if (type === 'void') {
    // drain target energy
    target.mana = Math.max(0, target.mana - 30);
    attacker.mana = Math.min(attacker.maxMana, attacker.mana + 15);
  }
}

// ----------------------------------------------------
// Element Skills Spawning Implementation
// ----------------------------------------------------
function castSkill1(player: CharacterState, opponent: CharacterState, element: ElementId, match: GameMatchState) {
  const dir = player.facingLeft ? -1 : 1;
  const launchX = player.x + (dir * 30);
  const launchY = player.y - 45;

  if (element === 'fire') {
    // Fireball missile
    match.projectiles.push({
      id: 'proj-' + Math.random().toString(36).substring(2, 6),
      ownerId: player.id,
      x: launchX,
      y: launchY,
      vx: dir * 16.0,
      vy: 0,
      radius: 12,
      damage: 13,
      type: 'fire',
      color: '#ef4444',
      duration: 1500
    });
  } 
  else if (element === 'lightning') {
    // Teleport blink + shock rigid
    const nextX = player.x + (dir * 180);
    player.x = Math.max(60, Math.min(ARENA_WIDTH - 60, nextX));
    match.shakeIntensity = 8;
    
    // Shock close targets
    const dist = Math.abs(player.x - opponent.x);
    if (dist < 100) {
      opponent.health = Math.max(0, opponent.health - 8);
      opponent.activeBuffs.push({ type: 'stun', duration: 800, maxDuration: 800 });
    }
  } 
  else if (element === 'ice') {
    // Prozon Burst: Ice explosion aura around player
    match.effects.push({
      id: 'boom-' + Math.random().toString(36).substring(2, 6),
      type: 'ice_burst',
      x: player.x,
      y: player.y - 40,
      radius: 150,
      color: '#06b6d4',
      duration: 600,
      maxDuration: 600,
      ownerId: player.id
    });

    const dist = Math.sqrt((player.x - opponent.x) ** 2 + ((player.y - 30) - (opponent.y - 30)) ** 2);
    if (dist < 150) {
      opponent.health = Math.max(0, opponent.health - 12);
      opponent.activeBuffs.push({ type: 'slow', duration: 3000, maxDuration: 3000, value: 0.5 });
    }
  } 
  else if (element === 'plant') {
    // Spine trap on ground on opponent position
    match.effects.push({
      id: 'trap-' + Math.random().toString(36).substring(2, 6),
      type: 'plant_trap',
      x: opponent.x,
      y: FLOOR_Y,
      radius: 70,
      color: '#22c55e',
      duration: 4000,
      maxDuration: 4000,
      ownerId: player.id
    });

    // Check hit
    if (Math.abs(opponent.x - opponent.x) < 70) {
      opponent.health = Math.max(0, opponent.health - 10);
      opponent.activeBuffs.push({ type: 'stun', duration: 1500, maxDuration: 1500 }); // Root bind
    }
  } 
  else if (element === 'wind') {
    // Wind push wave projectile
    match.projectiles.push({
      id: 'proj-' + Math.random().toString(36).substring(2, 6),
      ownerId: player.id,
      x: launchX,
      y: launchY,
      vx: dir * 18.0,
      vy: 0,
      radius: 20,
      damage: 7,
      type: 'wind',
      color: '#94a3b8',
      duration: 1200
    });
    // In addition, knockback opponent if inside
    const dist = Math.abs(player.x - opponent.x);
    if (dist < 200 && (player.x < opponent.x === !player.facingLeft)) {
      opponent.x = Math.max(50, Math.min(ARENA_WIDTH - 50, opponent.x + (dir * 130)));
    }
  } 
  else if (element === 'light') {
    // Swift laser beam (essentially very fast rail projectile)
    match.projectiles.push({
      id: 'proj-' + Math.random().toString(36).substring(2, 6),
      ownerId: player.id,
      x: launchX,
      y: launchY,
      vx: dir * 35.0,
      vy: 0,
      radius: 8,
      damage: 15,
      type: 'light',
      color: '#fef08a',
      duration: 800
    });
  } 
  else if (element === 'earth') {
    // Rock stone armor buff
    player.activeBuffs.push({
      type: 'super_armor',
      duration: 5000,
      maxDuration: 5000
    });
  } 
  else if (element === 'void') {
    // Void black hole orb missile
    match.projectiles.push({
      id: 'proj-' + Math.random().toString(36).substring(2, 6),
      ownerId: player.id,
      x: launchX,
      y: launchY,
      vx: dir * 10.0,
      vy: 0,
      radius: 35,
      damage: 8,
      type: 'void',
      color: '#a855f7',
      duration: 2000
    });

    // Spawn minor pull area on center
    match.effects.push({
      id: 'eff-' + Math.random().toString(36).substring(2, 6),
      type: 'blackhole',
      x: launchX + (dir * 180),
      y: launchY,
      radius: 120,
      color: '#a855f7',
      duration: 2000,
      maxDuration: 2000,
      ownerId: player.id
    });
  }
}

function castSkill2(player: CharacterState, opponent: CharacterState, element: ElementId, match: GameMatchState) {
  const dir = player.facingLeft ? -1 : 1;
  const launchX = player.x + (dir * 40);
  const launchY = player.y - 45;

  if (element === 'fire') {
    // Fire wall area
    match.effects.push({
      id: 'wall-' + Math.random().toString(36).substring(2, 6),
      type: 'volcano_ground',
      x: player.x,
      y: FLOOR_Y,
      radius: 110,
      color: '#f97316',
      duration: 3500,
      maxDuration: 3500,
      ownerId: player.id
    });
  } 
  else if (element === 'lightning') {
    // Discharge Spark explosion around
    match.effects.push({
      id: 'spark-' + Math.random().toString(36).substring(2, 6),
      type: 'light_burst',
      x: player.x,
      y: player.y - 45,
      radius: 180,
      color: '#eab308',
      duration: 500,
      maxDuration: 500,
      ownerId: player.id
    });

    const dist = Math.sqrt((player.x - opponent.x) ** 2 + ((player.y - 30) - (opponent.y - 30)) ** 2);
    if (dist < 180) {
      opponent.health = Math.max(0, opponent.health - 16);
      opponent.activeBuffs.push({ type: 'stun', duration: 400, maxDuration: 400 });
    }
  } 
  else if (element === 'ice') {
    // Icicle rocket launch (3 needles spray)
    for (let i = -1; i <= 1; i++) {
      match.projectiles.push({
        id: 'proj-' + Math.random().toString(36).substring(2, 6),
        ownerId: player.id,
        x: launchX,
        y: launchY,
        vx: dir * 15.0,
        vy: i * 3.0,
        radius: 6,
        damage: 6,
        type: 'ice',
        color: '#22d3ee',
        duration: 1200
      });
    }
  } 
  else if (element === 'plant') {
    // Heal rose
    player.health = Math.min(player.maxHealth, player.health + 15);
  } 
  else if (element === 'wind') {
    // Wind propel high jump launch
    player.vy = -26.0;
    player.isJumping = true;
    match.effects.push({
      id: 'wind-' + Math.random().toString(36).substring(2, 6),
      type: 'ice_burst',
      x: player.x,
      y: FLOOR_Y,
      radius: 80,
      color: '#e2e8f0',
      duration: 500,
      maxDuration: 500,
      ownerId: player.id
    });
  } 
  else if (element === 'light') {
    // Sun crest shield
    player.activeBuffs.push({
      type: 'super_armor',
      duration: 3500,
      maxDuration: 3500
    });
    // mini health boost
    player.health = Math.min(player.maxHealth, player.health + 8);
  } 
  else if (element === 'earth') {
    // Rock falling from sky onto opponent head
    match.projectiles.push({
      id: 'rock-' + Math.random().toString(36).substring(2, 6),
      ownerId: player.id,
      x: opponent.x,
      y: 100,
      vx: 0,
      vy: 14.0,
      radius: 30,
      damage: 18,
      type: 'earth',
      color: '#78350f',
      duration: 1800
    });
  } 
  else if (element === 'void') {
    // Mana drain stab S2
    const dist = Math.abs(player.x - opponent.x);
    if (dist < 130) {
      opponent.health = Math.max(0, opponent.health - 6);
      opponent.mana = Math.max(0, opponent.mana - 35);
      player.mana = Math.min(player.maxMana, player.mana + 35);
    }
  }
}

function castUltimate(player: CharacterState, opponent: CharacterState, ele1: ElementId, ele2: ElementId, match: GameMatchState) {
  const fusion = getFusionSkill(ele1, ele2);
  match.shakeIntensity = 30; // MEGA SCREEN SHAKE

  // Generate fullscreen flash effect registered as ultimate triggers
  match.effects.push({
    id: 'ult-' + Math.random().toString(36).substring(2, 6),
    type: 'fullscreen_fusion_trigger',
    x: 500,
    y: 250,
    radius: 1000,
    color: fusion.color,
    duration: 1200,
    maxDuration: 1200,
    ownerId: player.id
  });

  // Evaluate distinct combined physical impact instantly on the arena:
  const sortKey = [ele1, ele2].sort().join('+');

  // [Group 1] Fire Combos
  if (sortKey === 'fire+lightning') {
    // Plasma Gaia Burst
    opponent.health = Math.max(0, opponent.health - 35);
    opponent.activeBuffs.push({ type: 'slow', duration: 4000, maxDuration: 4000, value: 0.5 }); // Burn + shock
    opponent.activeBuffs.push({ type: 'stun', duration: 1500, maxDuration: 1500 }); // Shock paralysis
  } 
  else if (sortKey === 'fire+ice') {
    // Steam explosion (Armor piercing fixed damage)
    opponent.health = Math.max(0, opponent.health - 38); // Pure fixed damage ignoring armor mechanics
  } 
  else if (sortKey === 'fire+wind') {
    // Hellfire Typhoon
    opponent.health = Math.max(0, opponent.health - 32);
    opponent.vy = -18.0; // Air born lift!
    opponent.activeBuffs.push({ type: 'slow', duration: 3000, maxDuration: 3000, value: 0.4 });
  } 
  else if (sortKey === 'earth+fire') {
    // Lava volcano eruption
    opponent.health = Math.max(0, opponent.health - 30);
    opponent.vx += (opponent.x > player.x ? 250 : -250); // Hard knockback
    match.effects.push({
      id: 'volc-' + Math.random().toString(36).substring(2, 6),
      type: 'volcano_ground',
      x: opponent.x,
      y: FLOOR_Y,
      radius: 200,
      color: '#ea580c',
      duration: 5000,
      maxDuration: 5000,
      ownerId: player.id
    });
  } 
  else if (sortKey === 'fire+light') {
    // Solar Flare
    opponent.health = Math.max(0, opponent.health - 28);
    opponent.activeBuffs.push({ type: 'blind', duration: 2500, maxDuration: 2500 });
  } 
  else if (sortKey === 'fire+void') {
    // Abyss inferno (Curse status)
    opponent.health = Math.max(0, opponent.health - 30);
    // Inflict skill usage curse
    opponent.activeBuffs.push({ type: 'silence', duration: 3000, maxDuration: 3000 });
  } 
  else if (sortKey === 'fire+plant') {
    // Wildfire Sprout
    opponent.health = Math.max(0, opponent.health - 30);
    opponent.activeBuffs.push({ type: 'stun', duration: 1500, maxDuration: 1500 }); // locked
    opponent.activeBuffs.push({ type: 'slow', duration: 4000, maxDuration: 4000, value: 0.60 });
  }

  // [Group 2] Ice Combos
  else if (sortKey === 'ice+lightning') {
    // Superconduct blizzard
    opponent.health = Math.max(0, opponent.health - 30);
    opponent.activeBuffs.push({ type: 'freeze', duration: 1500, maxDuration: 1500 });
    // Chain stun inside client ticker
    setTimeout(() => {
      opponent.activeBuffs.push({ type: 'stun', duration: 1500, maxDuration: 1500 });
    }, 1500);
  } 
  else if (sortKey === 'ice+wind') {
    // Absolute Zero Blizzard
    opponent.health = Math.max(0, opponent.health - 24);
    opponent.x = opponent.x < player.x ? 60 : ARENA_WIDTH - 60; // Push edge
    opponent.activeBuffs.push({ type: 'absolute_zero', duration: 4000, maxDuration: 4000, value: 0.8 });
  } 
  else if (sortKey === 'earth+ice') {
    // Glacier Fortress
    player.health = Math.min(player.maxHealth, player.health + 10);
    player.activeBuffs.push({ type: 'glacier_fortress', duration: 5000, maxDuration: 5000 });
  } 
  else if (sortKey === 'ice+light') {
    // Frozen Prism
    opponent.health = Math.max(0, opponent.health - 32);
    opponent.activeBuffs.push({ type: 'slow', duration: 4000, maxDuration: 4000, value: 0.5 }); // Attack velocity reduced
  } 
  else if (sortKey === 'ice+void') {
    // Abyssal Frost (Removes mp recover)
    opponent.health = Math.max(0, opponent.health - 25);
    opponent.mana = 0;
    opponent.activeBuffs.push({ type: 'silence', duration: 3000, maxDuration: 3000 });
  } 
  else if (sortKey === 'ice+plant') {
    // Frost Prison
    opponent.health = Math.max(0, opponent.health - 26);
    opponent.activeBuffs.push({ type: 'frost_prison', duration: 3000, maxDuration: 3000 });
  }

  // [Group 3] Lightning Combos
  else if (sortKey === 'lightning+wind') {
    // Thunderstorm Drive
    opponent.health = Math.max(0, opponent.health - 34);
    player.activeBuffs.push({ type: 'thunderstorm_drive', duration: 1500, maxDuration: 1500 });
  } 
  else if (sortKey === 'earth+lightning') {
    // Earth Grounding
    opponent.health = Math.max(0, opponent.health - 28);
    opponent.vy = -15.0; // Air born
    opponent.activeBuffs.push({ type: 'stun', duration: 2000, maxDuration: 2000 });
  } 
  else if (sortKey === 'light+lightning') {
    // Hyper Speed Light
    player.x = opponent.x + (opponent.facingLeft ? 50 : -50); // Teleport directly behind
    opponent.health = Math.max(0, opponent.health - 33);
    opponent.activeBuffs.push({ type: 'stun', duration: 800, maxDuration: 800 });
  } 
  else if (sortKey === 'lightning+void') {
    // Void Blink (Debuff dispel + Black thunderstrike)
    opponent.health = Math.max(0, opponent.health - 35);
    opponent.activeBuffs = []; // Dispel benefits
  } 
  else if (sortKey === 'lightning+plant') {
    // Bio-Electricity
    opponent.health = Math.max(0, opponent.health - 28);
    opponent.activeBuffs.push({ type: 'bio_electric', duration: 5000, maxDuration: 5000 });
  }

  // [Group 4] Wind Combos
  else if (sortKey === 'earth+wind') {
    // Sandstorm Hazard
    opponent.health = Math.max(0, opponent.health - 25);
    match.effects.push({
      id: 'sand-' + Math.random().toString(36).substring(2, 6),
      type: 'sandstorm',
      x: 500,
      y: 250,
      radius: 500,
      color: '#ca8a04',
      duration: 5000,
      maxDuration: 5000,
      ownerId: player.id
    });
  } 
  else if (sortKey === 'light+wind') {
    // Mirage Rush
    opponent.health = Math.max(0, opponent.health - 30);
    opponent.activeBuffs.push({ type: 'blind', duration: 2000, maxDuration: 2000 });
  } 
  else if (sortKey === 'void+wind') {
    // Void Vacuum (Suck blackhole)
    opponent.health = Math.max(0, opponent.health - 30);
    match.effects.push({
      id: 'vac-' + Math.random().toString(36).substring(2, 6),
      type: 'void_vacuum',
      x: player.x + (player.facingLeft ? -250 : 250),
      y: FLOOR_Y - 100,
      radius: 400,
      color: '#581c87',
      duration: 3500,
      maxDuration: 3500,
      ownerId: player.id
    });
  } 
  else if (sortKey === 'plant+wind') {
    // Razor leaf typhoon
    opponent.health = Math.max(0, opponent.health - 28);
    opponent.x = opponent.x + (opponent.x > player.x ? 200 : -200);
    opponent.activeBuffs.push({ type: 'slow', duration: 3000, maxDuration: 3000, value: 0.5 });
  }

  // [Group 5] Earth combos
  else if (sortKey === 'earth+light') {
    // Sacred Prism Wall
    opponent.health = Math.max(0, opponent.health - 30);
    opponent.activeBuffs.push({ type: 'stun', duration: 1500, maxDuration: 1500 });
    // Wall effect
    match.effects.push({
      id: 'pwall-' + Math.random().toString(36).substring(2, 6),
      type: 'prism_wall',
      x: (player.x + opponent.x) / 2,
      y: FLOOR_Y,
      radius: 90,
      color: '#fbbf24',
      duration: 3000,
      maxDuration: 3000,
      ownerId: player.id
    });
  } 
  else if (sortKey === 'earth+void') {
    // Gravitational Collapse (Down & slow)
    opponent.health = Math.max(0, opponent.health - 28);
    opponent.activeBuffs.push({ type: 'stun', duration: 2000, maxDuration: 2000 }); // down lock
    opponent.activeBuffs.push({ type: 'slow', duration: 4000, maxDuration: 4000, value: 0.5 }); // defense reduce 50%
  } 
  else if (sortKey === 'earth+plant') {
    // Root of Yggdrasil (Max HP heal 30% + stomp)
    opponent.health = Math.max(0, opponent.health - 25);
    player.health = Math.min(player.maxHealth, player.health + 30);
  }

  // [Group 6] Light / Void / Plant remaining
  else if (sortKey === 'light+void') {
    // Twilight Eclipse (Absorb 50% & silence)
    const deal = 32;
    opponent.health = Math.max(0, opponent.health - deal);
    player.health = Math.min(player.maxHealth, player.health + (deal / 2));
    opponent.activeBuffs.push({ type: 'silence', duration: 2000, maxDuration: 2000 });
  } 
  else if (sortKey === 'light+plant') {
    // Photosynthesis Overdrive
    opponent.health = Math.max(0, opponent.health - 22);
    player.activeBuffs.push({ type: 'photosynthesis', duration: 5000, maxDuration: 5000 });
    match.effects.push({
      id: 'photo-' + Math.random().toString(36).substring(2, 6),
      type: 'photo_field',
      x: player.x,
      y: FLOOR_Y,
      radius: 180,
      color: '#22c55e',
      duration: 5000,
      maxDuration: 5000,
      ownerId: player.id
    });
  } 
  else if (sortKey === 'plant+void') {
    // Abyssal Spore (Poison 5s + build up slow)
    opponent.health = Math.max(0, opponent.health - 18);
    opponent.activeBuffs.push({ type: 'abyssal_spore', duration: 5000, maxDuration: 5000, value: 0.7 });
  }
}

function broadcastToRoom(roomId: string, message: GameWSMessage) {
  const match = activeMatches.get(roomId);
  if (!match) return;

  const raw = JSON.stringify(message);
  if (match.p1Socket && match.p1Socket.readyState === WebSocket.OPEN) {
    match.p1Socket.send(raw);
  }
  if (match.p2Socket && match.p2Socket.readyState === WebSocket.OPEN) {
    match.p2Socket.send(raw);
  }
}

// ----------------------------------------------------
// WebSocket Server Connection Handler
// ----------------------------------------------------
wss.on('connection', (ws) => {
  let registeredPlayer: { id: string; username: string } | null = null;
  let activeRoomId: string | null = null;

  ws.on('message', (messageRaw) => {
    try {
      const msg: GameWSMessage = JSON.parse(messageRaw.toString());

      if (msg.type === 'join_queue') {
        // Register player if first time
        const dbPlayer = serverDb.getPlayerByUsername(msg.username) || serverDb.createPlayer(msg.username);
        registeredPlayer = { id: dbPlayer.id, username: dbPlayer.username };

        // Remove from any queue first
        waitingQueue = waitingQueue.filter(qp => qp.socket !== ws);

        const newQ: QueuePlayer = {
          socket: ws,
          username: msg.username,
          elem1: msg.elem1,
          elem2: msg.elem2,
          playerId: dbPlayer.id
        };

        // If wait timeout triggers, we start the bot match
        const botTimer = setTimeout(() => {
          const index = waitingQueue.findIndex(qp => qp.socket === ws);
          if (index !== -1) {
            startBotMatchFor(newQ);
          }
        }, 3500); // 3.5 seconds match fallback

        waitingQueue.push(newQ);

      } else if (msg.type === 'leave_queue') {
        waitingQueue = waitingQueue.filter(qp => qp.socket !== ws);

      } else if (msg.type === 'client_input') {
        // Feed input to current room match
        if (registeredPlayer) {
          activeMatches.forEach((match, rId) => {
            if (match.state.p1.id === registeredPlayer!.id) {
              match.p1Inputs.moveX = msg.moveX;
              match.p1Inputs.jump = msg.jump;
              if (msg.skill) {
                match.p1Inputs.skill = msg.skill;
              }
              activeRoomId = rId;
            } else if (match.state.p2.id === registeredPlayer!.id) {
              match.p2Inputs.moveX = msg.moveX;
              match.p2Inputs.jump = msg.jump;
              if (msg.skill) {
                match.p2Inputs.skill = msg.skill;
              }
              activeRoomId = rId;
            }
          });
        }
      } else if (msg.type === 'get_rankings') {
        const top = serverDb.getTopPlayers(12);
        ws.send(JSON.stringify({ type: 'rankings_data', players: top }));
      }
    } catch (e) {
      console.error('WSS Message Error:', e);
    }
  });

  ws.on('close', () => {
    // Cleanup queue
    waitingQueue = waitingQueue.filter(qp => qp.socket !== ws);

    // Stop and forfeit any running match
    if (registeredPlayer) {
      activeMatches.forEach((match, rId) => {
        if (match.state.p1.id === registeredPlayer!.id || match.state.p2.id === registeredPlayer!.id) {
          clearInterval(match.intervalId);
          const oppWinnerId = match.state.p1.id === registeredPlayer!.id ? match.state.p2.id : match.state.p1.id;
          const oppWinnerName = match.state.p1.id === registeredPlayer!.id ? match.state.p2.username : match.state.p1.username;

          if (oppWinnerId && oppWinnerId !== 'b1-id' && oppWinnerId !== 'b2-id') {
            serverDb.incrementPlayerWin(oppWinnerId);
          }

          broadcastToRoom(rId, {
            type: 'match_over',
            winnerId: oppWinnerId,
            winnerUsername: oppWinnerName
          });

          activeMatches.delete(rId);
        }
      });
    }
  });
});

// 2. Vite and static bundle loading setup
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // production static hosting
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[ST] Server listening on http://localhost:${PORT}`);
  });
}

startServer();
