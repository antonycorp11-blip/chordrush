
import React from 'react';

interface BossVictoryModalProps {
    bossName: string;
    nextArenaName?: string;
    onContinue: () => void;
    onAdvance: () => void;
    hasNextArena: boolean;
}

export const BossVictoryModal: React.FC<BossVictoryModalProps> = ({
    bossName,
    nextArenaName,
    onContinue,
    onAdvance,
    hasNextArena
}) => {
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in zoom-in duration-300">
            <div className="bg-neutral-900 border-2 border-yellow-500/50 rounded-[40px] p-8 max-w-sm w-full text-center relative shadow-[0_0_100px_rgba(234,179,8,0.3)]">

                {/* Crown Icon */}
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-600 rounded-full border-4 border-neutral-900 flex items-center justify-center shadow-lg animate-bounce">
                    <i className="fa-solid fa-crown text-3xl text-white drop-shadow-md"></i>
                </div>

                <div className="mt-8">
                    <h2 className="text-3xl font-black italic uppercase text-white tracking-tighter leading-none mb-2">
                        {bossName}
                    </h2>
                    <p className="text-sm font-black text-red-500 uppercase tracking-[0.3em] mb-6">
                        DERROTADO!
                    </p>

                    <div className="w-full h-1 bg-white/10 rounded-full mb-6"></div>

                    <div className="space-y-3">
                        {hasNextArena ? (
                            <button
                                onClick={onAdvance}
                                className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-xs shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 group"
                            >
                                <span>Ir para {nextArenaName || 'Próxima Arena'}</span>
                                <i className="fa-solid fa-arrow-right group-hover:translate-x-1 transition-transform"></i>
                            </button>
                        ) : (
                            <div className="bg-white/5 p-4 rounded-2xl text-[10px] text-white/50 font-medium uppercase tracking-widest mb-2">
                                Você conquistou todas as arenas!
                            </div>
                        )}

                        <button
                            onClick={onContinue}
                            className="w-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white font-bold py-3 rounded-2xl uppercase tracking-widest text-[10px] active:scale-95 transition-all"
                        >
                            Continuar nesta Arena
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
