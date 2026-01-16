
import { Chord, NoteName } from './types';

/**
 * PADRONIZAÇÃO DO MAPEAMENTO (CORREÇÃO 2)
 * Converte qualquer cifra para seu nome completo por extenso.
 * Resolve o problema de aceitar "Sol" para "Gm".
 */
export const getChordFullName = (symbol: string): NoteName => {
  let name = '';

  // 1. Identifica a Raiz
  const root = symbol.charAt(0);
  switch (root) {
    case 'C': name = 'Dó'; break;
    case 'D': name = 'Ré'; break;
    case 'E': name = 'Mi'; break;
    case 'F': name = 'Fá'; break;
    case 'G': name = 'Sol'; break;
    case 'A': name = 'Lá'; break;
    case 'B': name = 'Si'; break;
    default: name = 'Dó';
  }

  // 2. Identifica Acidentes (♯ / ♭)
  if (symbol.includes('#')) {
    name += ' Sustenido';
  } else if (symbol.includes('b')) {
    name += ' Bemol';
  }

  // 3. Identifica Qualidade (Menor) - PRIORIDADE CRÍTICA (CORREÇÃO 1)
  // Verifica 'm' mas ignora 'm7' por enquanto para processar em ordem
  if (symbol.includes('m') && !symbol.includes('dim')) {
     name += ' menor';
  }

  // 4. Identifica Extensões
  if (symbol.includes('7M')) {
    name += ' com Sétima Maior';
  } else if (symbol.includes('7')) {
    name += ' com Sétima';
  } else if (symbol.includes('sus2')) {
    name += ' sus2';
  } else if (symbol.includes('sus4')) {
    name += ' sus4';
  } else if (symbol.includes('add9')) {
    name += ' com Nona';
  } else if (symbol.includes('dim')) {
    name += ' diminuto';
  } else if (symbol.includes('aug')) {
    name += ' aumentado';
  }

  return name.trim();
};

const createChords = (symbols: string[], level: number): Chord[] => {
  return symbols.map(s => ({
    symbol: s,
    note: getChordFullName(s),
    level
  }));
};

/**
 * Nível 1: Maiores Naturais
 */
export const CHORDS_LEVEL_1 = createChords(['C', 'D', 'E', 'F', 'G', 'A', 'B'], 1);

/**
 * Nível 2: Menores Naturais (CORREÇÃO 1: Agora mapeados como "menor")
 */
export const CHORDS_LEVEL_2 = createChords(['Cm', 'Dm', 'Em', 'Fm', 'Gm', 'Am', 'Bm'], 2);

/**
 * Nível 3: Acidentes Maiores e Menores
 */
export const CHORDS_LEVEL_3 = createChords([
  'C#', 'D#', 'F#', 'G#', 'A#', 'Db', 'Eb', 'Gb', 'Ab', 'Bb',
  'C#m', 'D#m', 'F#m', 'G#m', 'A#m', 'Dbm', 'Ebm', 'Gbm', 'Abm', 'Bbm'
], 3);

/**
 * Nível 4: Sétimas
 */
export const CHORDS_LEVEL_4 = createChords([
  'C7', 'D7', 'E7', 'F7', 'G7', 'A7', 'B7',
  'C#7', 'D#7', 'F#7', 'G#7', 'A#7', 'Db7', 'Eb7', 'Gb7', 'Ab7', 'Bb7'
], 4);

/**
 * Nível 5: m7 e 7M
 */
export const CHORDS_LEVEL_5 = createChords([
  'Cm7', 'Dm7', 'Em7', 'Fm7', 'Gm7', 'Am7', 'Bm7',
  'C7M', 'D7M', 'E7M', 'F7M', 'G7M', 'A7M', 'B7M'
], 5);

/**
 * Nível 6: Complexos
 */
export const CHORDS_LEVEL_6 = createChords([
  'Csus2', 'Csus4', 'Dsus2', 'Dsus4', 'Fsus2', 'Fsus4', 'Gsus2', 'Gsus4',
  'Cadd9', 'Dadd9', 'Eadd9', 'Fadd9', 'Gadd9', 'Aadd9',
  'Cdim', 'Ddim', 'Edim', 'Fdim', 'Gdim', 'Adim', 'Bdim',
  'Caug', 'Daug', 'Eaug', 'Faug', 'Gaug', 'Aaug'
], 6);

export const ALL_CHORDS = [
  ...CHORDS_LEVEL_1,
  ...CHORDS_LEVEL_2,
  ...CHORDS_LEVEL_3,
  ...CHORDS_LEVEL_4,
  ...CHORDS_LEVEL_5,
  ...CHORDS_LEVEL_6
];

/**
 * Lista base de nomes de notas para geração de distratores
 */
export const BASE_NOTE_NAMES = ['Dó', 'Ré', 'Mi', 'Fá', 'Sol', 'Lá', 'Si'];

export const THEMES = {
  1: 'bg-neutral-900',
  2: 'bg-stone-800',
  3: 'bg-stone-700',
  4: 'bg-stone-600',
  5: 'bg-orange-900',
  6: 'bg-orange-700',
  7: 'bg-orange-500',
};
