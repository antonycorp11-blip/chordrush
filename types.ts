
export type NoteName = string; // Agora permite qualquer string para suportar nomes extensos como "Dó Sustenido menor com sétima"

export interface Chord {
  symbol: string;
  note: NoteName;
  level: number;
}

export interface GameStats {
  playerName: string;
  highScore: number;
  totalXP: number;      // Saldo para gastar
  accumulatedXP: number; // XP Total da vida (para patentes)
  selectedCardId?: string;
}

export enum GameMode {
  NORMAL = 'NORMAL',
  HARD = 'HARD'
}

export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  GAMEOVER = 'GAMEOVER',
  RANKING = 'RANKING',
  STORE = 'STORE'
}

export interface RankingEntry {
  id: string;             // Database ID
  name: string;
  score: number;
  level: number;
  device_id: string;
  selected_card_id?: string;
  xp: number;             // Saldo
  total_xp: number;       // Acumulado
  created_at: string;
}

export type Rarity = 'comum' | 'raro' | 'épico' | 'lendário';

export interface Card {
  id: string;
  name: string;
  rarity: Rarity;
  price: number;
  image: string;
}
