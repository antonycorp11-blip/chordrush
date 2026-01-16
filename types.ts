
export type NoteName = string; // Agora permite qualquer string para suportar nomes extensos como "Dó Sustenido menor com sétima"

export interface Chord {
  symbol: string;
  note: NoteName;
  level: number;
}

export interface GameStats {
  playerName: string;
  highScore: number;
  totalXP: number;
}

export enum GameMode {
  NORMAL = 'NORMAL',
  HARD = 'HARD'
}

export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  GAMEOVER = 'GAMEOVER',
  RANKING = 'RANKING'
}

export interface RankingEntry {
  name: string;
  score: number;
  level: number;
  device_id: string;
}
