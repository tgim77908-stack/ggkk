/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ElementId = 'fire' | 'lightning' | 'ice' | 'plant' | 'wind' | 'light' | 'earth' | 'void';

export interface ElementInfo {
  id: ElementId;
  name: string;
  emoji: string;
  color: string;
  gradient: string;
  skills: {
    s1: { name: string; desc: string; key: 'A' };
    s2: { name: string; desc: string; key: 'S' };
  };
}

export interface FusionSkill {
  name: string;
  desc: string;
  effect: string;
  color: string;
  animationType: string;
}

export interface PlayerDB {
  id: string;
  username: string;
  win_count: number;
  created_at: string;
}

export interface GameRoomDB {
  id: string;
  player_1: string;
  player_2: string | null;
  p1_elem_1: ElementId | null;
  p1_elem_2: ElementId | null;
  p2_elem_1: ElementId | null;
  p2_elem_2: ElementId | null;
  status: 'waiting' | 'playing' | 'finished';
}

// Real-time synchronization representations
export interface Vector2D {
  x: number;
  y: number;
}

export interface CharacterState {
  id: string;
  username: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  facingLeft: boolean;
  health: number;
  maxHealth: number;
  mana: number;
  maxMana: number;
  ultiGauge: number; // 0 to 100
  activeBuffs: {
    type: string;
    duration: number; // in ms
    maxDuration: number;
    value?: number;
  }[];
  isJumping: boolean;
  isStunned: boolean;
  isSilenced: boolean;
  isBlinded: boolean;
  isSuperArmor: boolean;
  isInvincible: boolean;
}

export interface ProjectileState {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  type: ElementId | 'fusion' | 'normal';
  color: string;
  duration: number; // remaining ms
  effectType?: string;
}

export interface ParticleState {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  life: number; // ms
  maxLife: number;
  shape?: 'circle' | 'square' | 'line' | 'star';
}

export interface SkillEffectTrigger {
  id: string;
  type: string;
  x: number;
  y: number;
  radius: number;
  color: string;
  duration: number;
  maxDuration: number;
  ownerId: string;
  opacity?: number;
}

export interface GameMatchState {
  roomId: string;
  p1: CharacterState;
  p2: CharacterState;
  projectiles: ProjectileState[];
  effects: SkillEffectTrigger[];
  winnerId: string | null;
  timer: number; // in seconds
  shakeIntensity: number;
}

export type GameWSMessage =
  | { type: 'join_queue'; username: string; elem1: ElementId; elem2: ElementId }
  | { type: 'leave_queue' }
  | { type: 'match_found'; roomId: string; p1: PlayerDB; p2: PlayerDB; side: 1 | 2; p1Elems: ElementId[]; p2Elems: ElementId[] }
  | { type: 'client_input'; moveX: number; jump: boolean; skill: 'A' | 'S' | 'R' | null; mouseClickPos?: Vector2D }
  | { type: 'game_update'; state: GameMatchState }
  | { type: 'player_quit'; username: string }
  | { type: 'match_over'; winnerId: string; winnerUsername: string }
  | { type: 'get_rankings' }
  | { type: 'rankings_data'; players: PlayerDB[] }
  | { type: 'ping' }
  | { type: 'pong' };
