
import React, { useState, useEffect } from 'react';
import { supabase, getDeviceId } from '../utils/supabaseClient';
import { Card, Rarity } from '../types';
import { CARDS } from '../constants/cards';

interface CardStoreProps {
    onBack: () => void;
    totalXP: number;
    onXPUpdate: (newXP: number) => void;
    selectedCardId?: string;
    onCardSelect: (cardId: string) => void;
}

export const CardStore: React.FC<CardStoreProps> = ({
    onBack,
    totalXP,
    onXPUpdate,
    selectedCardId,
    onCardSelect
}) => {
    const [ownedCards, setOwnedCards] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<Rarity | 'all'>('all');

    useEffect(() => {
        fetchOwnedCards();
    }, []);

    const fetchOwnedCards = async () => {
        try {
            const deviceId = getDeviceId();
            const { data: playerData } = await supabase
                .from('players')
                .select('id')
                .eq('device_id', deviceId)
                .single();

            if (playerData) {
                const { data } = await supabase
                    .from('player_cards')
                    .select('card_id')
                    .eq('player_id', playerData.id);

                if (data) {
                    setOwnedCards(data.map(c => c.card_id));
                }
            }
        } catch (err) {
            console.error('Error fetching owned cards:', err);
        } finally {
            setLoading(false);
        }
    };

    const buyCard = async (card: Card) => {
        // Se for zero, pulamos a checagem de XP
        if (card.price > 0 && totalXP < card.price) return;
        try {
            const deviceId = getDeviceId();
            const { data: playerData } = await supabase
                .from('players')
                .select('id')
                .eq('device_id', deviceId)
                .single();

            if (!playerData) return;

            const { error: buyError } = await supabase
                .from('player_cards')
                .insert({ player_id: playerData.id, card_id: card.id });

            if (buyError) throw buyError;

            // Só reduz XP se o preço for maior que 0
            if (card.price > 0) {
                const { error: xpError } = await supabase
                    .from('players')
                    .update({ xp: totalXP - card.price })
                    .eq('id', playerData.id);

                if (xpError) throw xpError;
                onXPUpdate(totalXP - card.price);
            }

            setOwnedCards(prev => [...prev, card.id]);
        } catch (err) {
            console.error('Error buying card:', err);
            // alert('Erro ao realizar a compra.'); // Silenciando para teste
        }
    };

    const selectCard = async (cardId: string) => {
        try {
            const deviceId = getDeviceId();
            const { error } = await supabase
                .from('players')
                .update({ selected_card_id: cardId })
                .eq('device_id', deviceId);

            if (error) throw error;
            onCardSelect(cardId);
        } catch (err) {
            console.error('Error selecting card:', err);
        }
    };

    const filteredCards = filter === 'all'
        ? CARDS
        : CARDS.filter(c => c.rarity === filter);

    const getRarityStyle = (rarity: Rarity) => {
        switch (rarity) {
            case 'comum': return { color: 'text-blue-400', border: 'border-white/10 shadow-none', bg: 'bg-white/5', font: 'font-sans' };
            case 'raro': return { color: 'text-cyan-400', border: 'border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.6)] border-[4px]', bg: 'bg-black', font: 'font-["Press_Start_2P"] text-[6px]' };
            case 'épico': return { color: 'text-orange-500', border: 'border-orange-500 shadow-[0_0_30px_rgba(249,115,22,0.8)] border-[6px]', bg: 'bg-black', font: 'font-["Bangers"] text-sm tracking-widest' };
            case 'lendário': return { color: 'text-yellow-400', border: 'border-yellow-400 border-[8px] shadow-[0_0_50px_rgba(250,204,21,1)] animate-bounce-slow', bg: 'bg-black', font: 'font-["Bangers"] text-lg tracking-[0.2em]' };
            default: return { color: 'text-white', border: 'border-white/10', bg: 'bg-white/5', font: 'font-sans' };
        }
    };

    return (
        <div className="w-full h-full flex flex-col items-center bg-[#050505] overflow-hidden relative">
            <style>{`
                @keyframes bounce-slow {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-5px); }
                }
                .animate-bounce-slow {
                    animation: bounce-slow 2s ease-in-out infinite;
                }
                .no-scrollbar::-webkit-scrollbar { display: none; }
            `}</style>

            <div className="w-full max-w-lg flex flex-col h-full z-10 p-6">
                <div className="flex items-center justify-between mb-8">
                    <button
                        onClick={onBack}
                        className="w-12 h-12 flex items-center justify-center bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 hover:bg-white/15 active:scale-95 transition-all text-white"
                    >
                        <i className="fa-solid fa-chevron-left text-xl"></i>
                    </button>
                    <div className="flex flex-col items-end">
                        <h2 className="text-3xl font-black italic tracking-tighter text-white uppercase leading-none">
                            LOJA DE <span className="text-orange-500">CARDS</span>
                        </h2>
                        <div className="flex items-center gap-2 mt-2 bg-white/5 px-3 py-1 rounded-full border border-white/10">
                            <i className="fa-solid fa-bolt text-[10px] text-orange-500"></i>
                            <span className="text-xs font-black text-white tabular-nums">{totalXP.toLocaleString()} XP</span>
                        </div>
                    </div>
                </div>

                <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-none no-scrollbar">
                    {(['all', 'comum', 'raro', 'épico', 'lendário'] as const).map(r => (
                        <button
                            key={r}
                            onClick={() => setFilter(r)}
                            className={`px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border-2 ${filter === r
                                ? 'bg-orange-500 border-orange-400 text-white shadow-[0_0_20px_rgba(249,115,22,0.4)]'
                                : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10 hover:border-white/10'
                                }`}
                        >
                            {r === 'all' ? 'Ver Todos' : r}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-4">
                        <div className="w-12 h-12 border-[3px] border-orange-500/10 border-t-orange-500 rounded-full animate-spin"></div>
                        <span className="text-white/20 font-black uppercase tracking-widest text-[9px]">Carregando Acervo...</span>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto pr-2 no-scrollbar">
                        <div className="grid grid-cols-2 gap-6 pb-10">
                            {filteredCards.map(card => {
                                const isOwned = ownedCards.includes(card.id);
                                const isSelected = selectedCardId === card.id;
                                const style = getRarityStyle(card.rarity);

                                return (
                                    <div
                                        key={card.id}
                                        className={`group relative flex flex-col animate-pop-in`}
                                    >
                                        <div
                                            onClick={() => isOwned ? selectCard(card.id) : buyCard(card)}
                                            className={`
                                                w-full aspect-[3/4.5] rounded-[32px] overflow-hidden relative cursor-pointer
                                                transition-all duration-300 border-2
                                                ${style.border} ${isSelected ? 'scale-105 z-10' : 'scale-100 hover:scale-[1.03]'}
                                            `}
                                            style={{
                                                background: card.image,
                                            }}
                                        >
                                            {/* Decorativos de Borda para Épicos e Lendários */}
                                            {card.rarity === 'lendário' && (
                                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.2),transparent)] animate-pulse"></div>
                                            )}

                                            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80"></div>

                                            <div className="absolute bottom-5 left-0 right-0 flex flex-col items-center gap-1">
                                                <div className={`px-3 py-1 bg-black/80 backdrop-blur-md rounded-lg border border-white/20 ${style.font} ${style.color} uppercase`}>
                                                    {card.rarity}
                                                </div>
                                                <h3 className="text-white font-black text-[12px] uppercase tracking-tighter text-center px-2">{card.name}</h3>
                                            </div>

                                            {isSelected && (
                                                <div className="absolute top-4 right-4 bg-orange-500 text-white w-8 h-8 rounded-full flex items-center justify-center border-2 border-white shadow-lg animate-bounce-slow">
                                                    <i className="fa-solid fa-check text-sm"></i>
                                                </div>
                                            )}
                                        </div>

                                        {!isOwned && (
                                            <button
                                                onClick={() => buyCard(card)}
                                                className="mt-3 w-full py-3 bg-white text-black rounded-2xl font-black text-xs uppercase tracking-widest"
                                            >
                                                LIBERAR
                                            </button>
                                        )}
                                        {isOwned && !isSelected && (
                                            <button
                                                onClick={() => selectCard(card.id)}
                                                className="mt-3 w-full py-3 bg-white/10 text-white/40 rounded-2xl font-black text-xs uppercase tracking-widest"
                                            >
                                                USAR CARD
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
