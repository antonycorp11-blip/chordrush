
import React from 'react';
import { NoteName } from '../types';

interface NoteButtonProps {
  note: NoteName;
  onClick: (note: NoteName, x: number, y: number) => void;
  disabled?: boolean;
  extraClass?: string;
}

export const NoteButton: React.FC<NoteButtonProps> = ({ note, onClick, disabled, extraClass }) => {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    onClick(note, x, y);
  };

  // Ajusta o tamanho da fonte dinamicamente com base no comprimento da string
  let fontSize = 'text-2xl sm:text-4xl';
  if (note.length > 25) {
    fontSize = 'text-xs sm:text-base';
  } else if (note.length > 15) {
    fontSize = 'text-sm sm:text-lg';
  } else if (note.length > 8) {
    fontSize = 'text-lg sm:text-2xl';
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={`w-full aspect-[2/1] active:scale-95 font-black rounded-2xl border-2 shadow-xl transition-all flex items-center justify-center p-3 text-center leading-tight
        ${fontSize} ${extraClass || 'bg-white/5 hover:bg-white/15 text-white border-white/20'}`}
    >
      {note}
    </button>
  );
};
