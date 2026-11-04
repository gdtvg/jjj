import { pgTable, text, jsonb, integer, timestamp } from 'drizzle-orm/pg-core';
import type { LobbyRoom } from '../src/types/game';
import type { GameEngine } from '../src/game/GameEngine';
export const rooms = pgTable('game_rooms', {
  id: text().primaryKey(),
  lobby: jsonb().$type<LobbyRoom>().notNull(),
  engine: jsonb().$type<ReturnType<GameEngine['snapshot']>>(),
  revision: integer().notNull().default(0),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
export const scores = pgTable('game_scores', {
  id: text().primaryKey(),
  username: text().notNull(),
  wins: integer().notNull().default(0),
  gamesPlayed: integer('games_played').notNull().default(0),
  totalCashEarned: integer('total_cash_earned').notNull().default(0),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
