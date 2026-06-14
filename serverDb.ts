/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import { PlayerDB, GameRoomDB, ElementId } from './src/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

interface LocalDBSchema {
  players: PlayerDB[];
  game_rooms: GameRoomDB[];
}

function initDb() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const defaultData: LocalDBSchema = {
      players: [
        { id: 'b1-id', username: 'EasyBot_AI', win_count: 8, created_at: new Date().toISOString() },
        { id: 'b2-id', username: 'ProMaster_Bot', win_count: 18, created_at: new Date().toISOString() },
        { id: 'faker-id', username: 'ElementGod_Faker', win_count: 57, created_at: new Date().toISOString() }
      ],
      game_rooms: []
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2), 'utf-8');
  }
}

function readDb(): LocalDBSchema {
  initDb();
  try {
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    console.error('Failed to read local DB file. Resetting to defaults.', e);
    return { players: [], game_rooms: [] };
  }
}

function writeDb(data: LocalDBSchema) {
  initDb();
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to write local DB file.', e);
  }
}

// PostgreSQL DDL representation as requested for user copying
export const SUPABASE_DDL = `
-- 1. Create players table
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  win_count INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create game_rooms table
CREATE TABLE IF NOT EXISTS game_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_1 UUID REFERENCES players(id) ON DELETE CASCADE,
  player_2 UUID REFERENCES players(id) ON DELETE SET NULL,
  p1_elem_1 TEXT,
  p1_elem_2 TEXT,
  p2_elem_1 TEXT,
  p2_elem_2 TEXT,
  status TEXT DEFAULT 'waiting', -- 'waiting', 'playing', 'finished'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Realtime for game_rooms and players
alter publication supabase_realtime add table game_rooms;
alter publication supabase_realtime add table players;
`.trim();

export const serverDb = {
  getPlayers(): PlayerDB[] {
    const db = readDb();
    return db.players;
  },

  getPlayerByUsername(username: string): PlayerDB | null {
    const db = readDb();
    const clean = username.trim();
    return db.players.find(p => p.username.toLowerCase() === clean.toLowerCase()) || null;
  },

  getPlayerById(id: string): PlayerDB | null {
    const db = readDb();
    return db.players.find(p => p.id === id) || null;
  },

  createPlayer(username: string): PlayerDB {
    const db = readDb();
    const cleanUsername = username.trim();
    const existing = db.players.find(p => p.username.toLowerCase() === cleanUsername.toLowerCase());
    if (existing) {
      return existing;
    }

    const newPlayer: PlayerDB = {
      id: 'p-' + Math.random().toString(36).substring(2, 11) + '-' + Date.now().toString(36),
      username: cleanUsername,
      win_count: 0,
      created_at: new Date().toISOString()
    };
    db.players.push(newPlayer);
    writeDb(db);
    return newPlayer;
  },

  incrementPlayerWin(playerId: string): number {
    const db = readDb();
    const player = db.players.find(p => p.id === playerId);
    if (player) {
      player.win_count += 1;
      writeDb(db);
      return player.win_count;
    }
    return 0;
  },

  getTopPlayers(limit: number = 8): PlayerDB[] {
    const db = readDb();
    return [...db.players].sort((a, b) => b.win_count - a.win_count).slice(0, limit);
  },

  createRoom(p1Id: string, elem1: ElementId, elem2: ElementId): GameRoomDB {
    const db = readDb();
    const newRoom: GameRoomDB = {
      id: 'room-' + Math.random().toString(36).substring(2, 8),
      player_1: p1Id,
      player_2: null,
      p1_elem_1: elem1,
      p1_elem_2: elem2,
      p2_elem_1: null,
      p2_elem_2: null,
      status: 'waiting'
    };
    db.game_rooms.push(newRoom);
    writeDb(db);
    return newRoom;
  },

  joinRoom(roomId: string, p2Id: string, elem1: ElementId, elem2: ElementId): GameRoomDB | null {
    const db = readDb();
    const room = db.game_rooms.find(r => r.id === roomId);
    if (room && room.status === 'waiting' && room.player_1 !== p2Id) {
      room.player_2 = p2Id;
      room.p2_elem_1 = elem1;
      room.p2_elem_2 = elem2;
      room.status = 'playing';
      writeDb(db);
      return room;
    }
    return null;
  },

  finishRoom(roomId: string): void {
    const db = readDb();
    const room = db.game_rooms.find(r => r.id === roomId);
    if (room) {
      room.status = 'finished';
      writeDb(db);
    }
  }
};
