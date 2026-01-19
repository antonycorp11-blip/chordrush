
export type NoteName = string; // Agora permite qualquer string para suportar nomes extensos como "Dó Sustenido menor com sétima"

export interface Chord {
  symbol: string;
  note: NoteName;
  level: number;
}

export interface GameStats {
  playerName: string;
  highScore: number;
  acordeCoins: number;      // Saldo (para gastar na loja)
  accumulatedXP: number; // XP de Patente (acumulado da vida)
  selectedCardId?: string;
  recoveryPin?: string;
}

export interface Mission {
  id: string;
  title: string;
  description: string;
  goal_type: string;
  goal_value: number;
  reward_rarity: Rarity;
}

export interface PlayerMission extends Mission {
  current_value: number;
  is_completed: boolean;
  reward_claimed: boolean;
  assigned_at: string;
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
  acorde_coins: number;             // Saldo
  accumulated_xp: number;       // Patente XP
  created_at: string;
  recovery_pin?: string;
}

export type Rarity = 'comum' | 'raro' | 'épico' | 'lendário';

export interface Card {
  id: string;
  name: string;
  rarity: Rarity;
  price: number;
  image: string;
}
