import React, { useState, useEffect } from 'react';
import { Rarity } from '../types';

interface ClefOpeningModalProps {
    reward: {
        type: 'acorde_coins' | 'patente_xp' | 'card';
        amount?: number;
        rarity: Rarity;
    };
    onClose: () => void;
}

export const ClefOpeningModal: React.FC<ClefOpeningModalProps> = ({ reward, onClose }) => {
    const [phase, setPhase] = useState<'shaking' | 'exploding' | 'revealed'>('shaking');

    useEffect(() => {
        const explosionTimer = setTimeout(() => setPhase('exploding'), 2000);
        const revealTimer = setTimeout(() => setPhase('revealed'), 2500);
        return () => {
            clearTimeout(explosionTimer);
            clearTimeout(revealTimer);
        };
    }, []);

    const getRarityColor = (rarity: Rarity) => {
        switch (rarity) {
            case 'comum': return 'from-blue-400 to-blue-600';
            case 'raro': return 'from-cyan-400 to-cyan-600';
            case 'épico': return 'from-purple-500 to-purple-700';
            case 'lendário': return 'from-yellow-400 to-orange-500';
            default: return 'from-gray-400 to-gray-600';
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/95 backdrop-blur-2xl animate-in fade-in duration-500">
            <div className="relative w-full max-w-sm flex flex-col items-center justify-center text-center">

                {phase === 'shaking' && (
                    <div className="flex flex-col items-center animate-bounce">
                        <div className={`w-48 h-48 relative flex items-center justify-center`}>
                            <div className={`absolute inset-0 bg-gradient-to-br ${getRarityColor(reward.rarity)} blur-2xl opacity-40 animate-pulse`} />
                            <img
                                src={`/assets/clefs/clef_${reward.rarity}.png`}
                                alt="Clef"
                                className="w-full h-full object-contain relative z-10 drop-shadow-[0_0_30px_rgba(255,255,255,0.3)]"
                            />
                        </div>
                        <div className="mt-8">
                            <span className="text-white/60 font-black uppercase tracking-[0.3em] text-[10px] animate-pulse">Abrindo Clave {reward.rarity}...</span>
                        </div>
                    </div>
                )}

                {phase === 'exploding' && (
                    <div className="w-full h-full flex items-center justify-center animate-ping">
                        <div className={`w-64 h-64 rounded-full bg-gradient-to-br ${getRarityColor(reward.rarity)} blur-3xl opacity-50`}></div>
                    </div>
                )}

                {phase === 'revealed' && (
                    <div className="animate-in zoom-in spin-in-90 duration-700 flex flex-col items-center w-full">
                        <div className={`w-64 h-64 rounded-[50px] bg-neutral-950 shadow-[0_0_100px_rgba(255,255,255,0.05)] flex flex-col items-center justify-center relative border border-white/10 mb-8 overflow-hidden`}>
                            <div className={`absolute inset-0 bg-gradient-to-br ${getRarityColor(reward.rarity)} opacity-10`} />

                            {reward.type === 'acorde_coins' && (
                                <>
                                    <div className="relative mb-4">
                                        <div className="absolute inset-0 bg-yellow-400 blur-2xl opacity-20 animate-pulse" />
                                        <i className="fa-solid fa-coins text-7xl text-yellow-400 drop-shadow-[0_0_20px_rgba(253,224,71,0.5)] relative z-10"></i>
                                    </div>
                                    <span className="text-5xl font-black text-white italic tracking-tighter">+{reward.amount?.toLocaleString()}</span>
                                    <span className="text-[10px] font-black text-white/50 uppercase tracking-widest mt-1">Acorde Coins</span>
                                </>
                            )}
                            {reward.type === 'patente_xp' && (
                                <>
                                    <i className="fa-solid fa-bolt text-6xl text-orange-400 drop-shadow-[0_0_20px_rgba(249,115,22,0.5)] mb-4"></i>
                                    <span className="text-4xl font-black text-white italic tracking-tighter">+{reward.amount}</span>
                                    <span className="text-[10px] font-black text-white/50 uppercase tracking-widest mt-1">Patente XP</span>
                                </>
                            )}
                            {reward.type === 'card' && (
                                <>
                                    <i className="fa-solid fa-id-card text-7xl text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.5)] mb-4"></i>
                                    <span className="text-2xl font-black text-white italic tracking-tighter uppercase">NOVO CARD!</span>
                                    <span className="text-[10px] font-black text-white/50 uppercase tracking-widest mt-1">{reward.rarity}</span>
                                </>
                            )}
                        </div>

                        <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter mb-2">RECOMPENSA!</h2>
                        <p className="text-white/40 text-xs font-bold uppercase tracking-widest mb-10 px-8">Você abriu uma clave {reward.rarity} e ganhou um prêmio especial!</p>

                        <button
                            onClick={onClose}
                            className="w-full bg-white text-black font-black py-5 rounded-3xl text-lg uppercase tracking-widest active:scale-95 transition-all shadow-2xl"
                        >
                            COLETAR PRÊMIO
                        </button>
                    </div>
                )}

            </div>
        </div>
    );
};
