
import React from 'react';
import { NoteName } from '../types';

interface NoteButtonProps {
  note: NoteName;
  onClick: (note: NoteName) => void;
  disabled?: boolean;
}

export const NoteButton: React.FC<NoteButtonProps> = ({ note, onClick, disabled }) => {
  // Ajusta o tamanho da fonte dinamicamente com base no comprimento da string
  let fontSize = 'text-2xl';
  if (note.length > 25) {
    fontSize = 'text-[10px]';
  } else if (note.length > 15) {
    fontSize = 'text-xs';
  } else if (note.length > 8) {
    fontSize = 'text-sm';
  }
  
  return (
    <button
      onClick={() => onClick(note)}
      disabled={disabled}
      className={`w-full aspect-[2/1] bg-white/5 hover:bg-white/15 active:scale-95 text-white font-black rounded-2xl border-2 border-white/20 shadow-xl transition-all flex items-center justify-center p-3 text-center leading-tight
        ${fontSize}`}
    >
      {note}
    </button>
  );
};
