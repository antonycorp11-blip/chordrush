
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

    const getRarityStyles = (rarity: Rarity) => {
        switch (rarity) {
            case 'comum': return { color: 'text-blue-400', border: 'border-white/10', font: 'font-sans' };
            case 'raro': return { color: 'text-cyan-400', border: 'border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.4)]', font: 'font-["Press_Start_2P"] text-[8px]' };
            case 'épico': return { color: 'text-orange-500', border: 'border-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.6)]', font: 'font-["Bangers"] text-xl tracking-widest' };
            case 'lendário': return { color: 'text-yellow-400', border: 'border-yellow-400 shadow-[0_0_25px_rgba(250,204,21,0.8)] border-[3px]', font: 'font-["Bangers"] text-2xl tracking-[0.1em]' };
            default: return { color: 'text-white', border: 'border-white/10', font: 'font-sans text-xs' };
        }
    };

    return (
        <div className="w-full h-full flex flex-col bg-[#050505] overflow-hidden">
            <div className="w-full max-w-lg mx-auto flex flex-col h-full p-6">
                {/* Header */}
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
                        <div className="mt-2 bg-orange-500/10 px-3 py-1 rounded-full border border-orange-500/20 flex items-center gap-2">
                            <i className="fa-solid fa-bolt text-[10px] text-orange-500"></i>
                            <span className="text-xs font-black text-white tabular-nums">{totalXP.toLocaleString()} XP</span>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex gap-2 mb-6 overflow-x-auto pb-2 no-scrollbar">
                    {(['all', 'comum', 'raro', 'épico', 'lendário'] as const).map(r => (
                        <button
                            key={r}
                            onClick={() => setFilter(r)}
                            className={`px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border-2 ${filter === r
                                ? 'bg-orange-500 border-orange-400 text-white shadow-[0_0_20px_rgba(249,115,22,0.4)]'
                                : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10'
                                }`}
                        >
                            {r === 'all' ? 'Ver Todos' : r}
                        </button>
                    ))}
                </div>

                {/* Grid - NOW HORIZONTAL AS REQUESTED */}
                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-4">
                        <div className="w-10 h-10 border-[3px] border-orange-500/10 border-t-orange-500 rounded-full animate-spin"></div>
                        <span className="text-white/20 font-black uppercase tracking-widest text-[9px]">Carregando Acervo...</span>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto pr-2 no-scrollbar space-y-4 pb-10">
                        {filteredCards.map(card => {
                            const isOwned = ownedCards.includes(card.id);
                            const isSelected = selectedCardId === card.id;
                            const styles = getRarityStyles(card.rarity);

                            return (
                                <div
                                    key={card.id}
                                    onClick={() => isOwned ? selectCard(card.id) : buyCard(card)}
                                    className={`
                                        relative w-full p-6 rounded-[32px] border-2 transition-all duration-300 cursor-pointer overflow-hidden
                                        ${isSelected ? 'scale-[1.02] z-10' : 'scale-100 opacity-90 hover:opacity-100'}
                                        ${styles.border}
                                    `}
                                    style={{ background: card.image }}
                                >
                                    {/* Overlay for legibility */}
                                    <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]"></div>

                                    <div className="relative z-10 flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className={`${styles.color} ${styles.font} uppercase mb-1`}>
                                                {card.rarity}
                                            </span>
                                            <h3 className="text-white font-black text-xl uppercase tracking-tighter italic">
                                                {card.name}
                                            </h3>
                                        </div>

                                        <div className="flex flex-col items-end">
                                            {!isOwned ? (
                                                <div className="bg-white text-black px-4 py-2 rounded-xl font-black text-xs shadow-lg uppercase">
                                                    Gratis
                                                </div>
                                            ) : (
                                                <div className={`
                                                    w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all
                                                    ${isSelected ? 'bg-orange-500 border-white text-white rotate-0' : 'bg-white/10 border-white/20 text-white/40'}
                                                `}>
                                                    <i className={`fa-solid ${isSelected ? 'fa-check' : 'fa-hand-pointer'}`}></i>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Selected Glow */}
                                    {isSelected && (
                                        <div className="absolute inset-0 border-2 border-white/50 rounded-[30px] animate-pulse"></div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
