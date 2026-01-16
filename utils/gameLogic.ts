
import { Chord, NoteName } from '../types';
import { 
  CHORDS_LEVEL_1, CHORDS_LEVEL_2, CHORDS_LEVEL_3, 
  CHORDS_LEVEL_4, CHORDS_LEVEL_5, CHORDS_LEVEL_6, ALL_CHORDS,
  BASE_NOTE_NAMES, getChordFullName
} from '../constants';

export const shuffle = <T,>(array: T[]): T[] => {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

export const getChordsForLevel = (level: number): Chord[] => {
  switch (level) {
    case 1: return shuffle(CHORDS_LEVEL_1);
    case 2: return shuffle(CHORDS_LEVEL_2);
    case 3: return shuffle(CHORDS_LEVEL_3);
    case 4: return shuffle(CHORDS_LEVEL_4);
    case 5: return shuffle(CHORDS_LEVEL_5);
    case 6: return shuffle(CHORDS_LEVEL_6);
    case 7: 
      const weighted = [
        ...CHORDS_LEVEL_5, ...CHORDS_LEVEL_5,
        ...CHORDS_LEVEL_6, ...CHORDS_LEVEL_6,
        ...ALL_CHORDS
      ];
      return shuffle(weighted);
    default: return shuffle(CHORDS_LEVEL_1);
  }
};

/**
 * GERAÇÃO DINÂMICA DE OPÇÕES (CORREÇÃO 3 e 4)
 * Garante que as opções sejam sempre novas, embaralhadas e plausíveis.
 */
export const generateOptions = (correctChord: Chord): NoteName[] => {
  const correctName = correctChord.note;
  const options: Set<NoteName> = new Set();
  options.add(correctName);

  // Distrator 1: A mesma nota mas maior/menor (Inverso do correto)
  // Se Gm (Sol menor), adiciona G (Sol). Se G (Sol), adiciona Gm (Sol menor).
  let inverseSymbol = '';
  if (correctChord.symbol.endsWith('m')) {
    inverseSymbol = correctChord.symbol.replace('m', '');
  } else {
    inverseSymbol = correctChord.symbol + 'm';
  }
  
  // Tenta mapear o inverso, se falhar (ex: sus4m não existe), ignora
  try {
     const inverseName = getChordFullName(inverseSymbol);
     if (inverseName !== correctName) options.add(inverseName);
  } catch (e) {}

  // Distratores Extras: Notas aleatórias com a MESMA qualidade do acorde correto
  // Ex: se o correto é "menor", pega outras notas "menor"
  const quality = correctName.split(' ').slice(1).join(' '); // Pega tudo depois da raiz (ex: "menor com Sétima")
  
  const shuffledRoots = shuffle(BASE_NOTE_NAMES);
  for (const root of shuffledRoots) {
    if (options.size >= 4) break;
    const candidate = `${root}${quality ? ' ' + quality : ''}`.trim();
    if (candidate !== correctName) {
      options.add(candidate);
    }
  }

  // Se ainda faltar opções, preenche com notas aleatórias do banco geral
  const allPossibleNames = ALL_CHORDS.map(c => c.note);
  const shuffledGlobal = shuffle(allPossibleNames);
  for (const name of shuffledGlobal) {
    if (options.size >= 4) break;
    options.add(name);
  }

  // CORREÇÃO 4: Embaralha a lista final antes de retornar
  return shuffle(Array.from(options));
};

export const getTimeBonus = (level: number): number => {
  return Math.max(1, Math.floor(level / 1.5));
};

export const getXPForLevel = (level: number): number => {
  return level * 10;
};
