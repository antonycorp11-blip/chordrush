
import React from 'react';
import { DialogueInteraction } from '../utils/dialogues';

interface DialogueOverlayProps {
    interaction: DialogueInteraction;
    onContinue: () => void;
    bossImage: string;
    bossName: string;
}

export const DialogueOverlay: React.FC<DialogueOverlayProps> = ({ interaction, onContinue, bossImage, bossName }) => {
    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="w-full max-w-4xl mx-4 flex flex-col gap-4 sm:gap-6 relative max-h-[90vh] overflow-y-auto custom-scrollbar p-2" onClick={(e) => e.stopPropagation()}>

                {/* BOSS SIDE (Left/Top) */}
                <div className="flex items-start gap-2 sm:gap-4 animate-slide-in-from-left duration-500">
                    <div className="relative shrink-0">
                        <div className="w-16 h-16 sm:w-32 sm:h-32 rounded-full border-2 sm:border-4 border-red-900 bg-black overflow-hidden shadow-[0_0_30px_rgba(220,38,38,0.5)]">
                            <img src={bossImage} className="w-full h-full object-cover scale-125" alt="Boss" />
                        </div>
                        <div className="absolute -bottom-2 sm:-bottom-3 left-1/2 -translate-x-1/2 bg-red-900 text-white text-[8px] sm:text-[10px] font-black uppercase px-2 py-0.5 sm:px-3 sm:py-1 rounded-full whitespace-nowrap shadow-lg border border-red-700">
                            {bossName}
                        </div>
                    </div>
                    <div className="bg-neutral-900/90 border-2 border-red-900/30 p-3 sm:p-6 rounded-2xl sm:rounded-[32px] sm:rounded-tl-none shadow-2xl flex-1 max-w-lg mt-2 sm:mt-4 relative min-w-0">
                        <i className="fa-solid fa-quote-left text-red-900/40 text-lg sm:text-4xl absolute top-2 left-2 sm:top-4 sm:left-4"></i>
                        <p className="text-base sm:text-2xl text-red-100 font-black italic relative z-10 leading-tight break-words">
                            "{interaction.bossLine}"
                        </p>
                    </div>
                </div>

                {/* PLAYER SIDE (Right/Bottom) */}
                <div className="flex items-end justify-end gap-2 sm:gap-4 animate-slide-in-from-right duration-500 delay-150">
                    <div className="bg-blue-950/90 border-2 border-blue-500/30 p-3 sm:p-6 rounded-2xl sm:rounded-[32px] sm:rounded-br-none shadow-2xl flex-1 max-w-lg mb-2 sm:mb-4 text-right relative min-w-0">
                        <i className="fa-solid fa-quote-right text-blue-500/20 text-lg sm:text-4xl absolute bottom-2 right-2 sm:bottom-4 sm:right-4"></i>
                        <p className="text-base sm:text-2xl text-blue-100 font-bold font-medieval relative z-10 leading-tight break-words">
                            "{interaction.playerLine}"
                        </p>
                    </div>
                    <div className="relative shrink-0">
                        <div className="w-16 h-16 sm:w-32 sm:h-32 rounded-full border-2 sm:border-4 border-blue-500 bg-black overflow-hidden shadow-[0_0_30px_rgba(59,130,246,0.5)] flex items-center justify-center">
                            {/* Generic Bard Icon or Avatar */}
                            <i className="fa-solid fa-user-astronaut text-2xl sm:text-5xl text-blue-200"></i>
                        </div>
                        <div className="absolute -bottom-2 sm:-bottom-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[8px] sm:text-[10px] font-black uppercase px-2 py-0.5 sm:px-3 sm:py-1 rounded-full whitespace-nowrap shadow-lg border border-blue-400">
                            Você
                        </div>
                    </div>
                </div>

                {/* Continue Button */}
                <div className="flex justify-center mt-4 sm:mt-8 animate-in fade-in duration-700 delay-300">
                    <button
                        onClick={onContinue}
                        className="bg-white text-black font-black uppercase text-xs sm:text-sm tracking-[0.2em] px-8 py-3 sm:px-12 sm:py-4 rounded-full shadow-[0_0_40px_white] hover:scale-105 active:scale-95 transition-all text-shadow-none animate-pulse"
                    >
                        Continuar Batalha <i className="fa-solid fa-play ml-2 text-xs"></i>
                    </button>
                </div>

            </div>
        </div>
    );
};
