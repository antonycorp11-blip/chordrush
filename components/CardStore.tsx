
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
        if (totalXP < card.price) return;
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

            const { error: xpError } = await supabase
                .from('players')
                .update({ xp: totalXP - card.price })
                .eq('id', playerData.id);

            if (xpError) throw xpError;

            setOwnedCards(prev => [...prev, card.id]);
            onXPUpdate(totalXP - card.price);
        } catch (err) {
            console.error('Error buying card:', err);
            alert('Erro ao realizar a compra.');
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
            case 'comum': return { color: 'text-blue-400', border: 'border-white/20', bg: 'bg-white/5', font: 'font-sans' };
            case 'raro': return { color: 'text-purple-400', border: 'border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.4)]', bg: 'bg-purple-500/10', font: 'font-["Press_Start_2P"] text-[6px]' };
            case 'épico': return { color: 'text-orange-400', border: 'border-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.6)]', bg: 'bg-orange-500/20', font: 'font-["Bangers"] text-[12px] tracking-widest' };
            case 'lendário': return { color: 'text-yellow-400', border: 'border-yellow-400 border-[3px] shadow-[0_0_30px_rgba(250,204,21,0.8)] animate-pulse', bg: 'bg-yellow-400/20', font: 'font-["Bangers"] text-sm tracking-[0.15em]' };
            default: return { color: 'text-white', border: 'border-white/10', bg: 'bg-white/5', font: 'font-sans' };
        }
    };

    return (
        <div className="w-full h-full flex flex-col items-center bg-[#0a0a0a] overflow-hidden relative">
            {/* Background Effects */}
            <div className="absolute top-[-10%] left-[-10%] w-[400px] h-[400px] bg-blue-600/5 blur-[120px] rounded-full pointer-events-none"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-orange-600/5 blur-[120px] rounded-full pointer-events-none"></div>

            <div className="w-full max-w-lg flex flex-col h-full z-10 p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <button
                        onClick={onBack}
                        className="w-12 h-12 flex items-center justify-center bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 hover:bg-white/15 active:scale-95 transition-all text-white shadow-xl"
                    >
                        <i className="fa-solid fa-chevron-left text-xl"></i>
                    </button>
                    <div className="flex flex-col items-end">
                        <h2 className="text-3xl font-black italic tracking-tighter text-white uppercase leading-none">
                            LOJA DE <span className="text-orange-500">CARDS</span>
                        </h2>
                        <div className="flex items-center gap-2 mt-2 bg-orange-500/10 px-3 py-1 rounded-full border border-orange-500/20">
                            <i className="fa-solid fa-bolt text-[10px] text-orange-500"></i>
                            <span className="text-xs font-black text-white tabular-nums">{totalXP.toLocaleString()} XP</span>
                        </div>
                    </div>
                </div>

                {/* Filters */}
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

                {/* Grid */}
                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-4">
                        <div className="w-12 h-12 border-[3px] border-orange-500/10 border-t-orange-500 rounded-full animate-spin"></div>
                        <span className="text-white/20 font-black uppercase tracking-widest text-[9px]">Carregando Acervo...</span>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto pr-2 no-scrollbar">
                        <div className="grid grid-cols-2 gap-4 pb-10">
                            {filteredCards.map(card => {
                                const isOwned = ownedCards.includes(card.id);
                                const isSelected = selectedCardId === card.id;
                                const canAfford = totalXP >= card.price;
                                const style = getRarityStyle(card.rarity);

                                return (
                                    <div
                                        key={card.id}
                                        className={`group relative flex flex-col p-3 rounded-[32px] border-2 transition-all duration-300 ${isSelected
                                            ? 'border-orange-500 bg-orange-500/10 scale-[0.98]'
                                            : 'border-white/5 bg-white/5 hover:border-white/20'
                                            }`}
                                    >
                                        {/* Preview Card Body */}
                                        <div
                                            className={`w-full aspect-[3/4] rounded-[24px] mb-4 shadow-2xl overflow-hidden relative border-2 ${style.border}`}
                                            style={{
                                                backgroundImage: `url(${card.image}), linear-gradient(to bottom, transparent, rgba(0,0,0,0.8))`,
                                                backgroundSize: 'cover',
                                                backgroundPosition: 'center'
                                            }}
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>

                                            {/* Rarity Label with Custom Font */}
                                            <div className="absolute bottom-3 left-0 right-0 flex justify-center">
                                                <div className={`px-2 py-0.5 bg-black/60 backdrop-blur-md rounded-md border border-white/10 ${style.font} ${style.color} uppercase`}>
                                                    {card.rarity}
                                                </div>
                                            </div>

                                            {/* Selection Glow */}
                                            {isSelected && (
                                                <div className="absolute inset-0 border-[3px] border-orange-500 rounded-[22px] animate-pulse"></div>
                                            )}
                                        </div>

                                        <h3 className="text-white font-black text-[11px] uppercase tracking-wide mb-3 px-1 truncate leading-tight">{card.name}</h3>

                                        {!isOwned ? (
                                            <button
                                                onClick={() => buyCard(card)}
                                                disabled={!canAfford}
                                                className={`w-full py-3 rounded-2xl font-black text-[11px] uppercase tracking-wider transition-all shadow-lg ${canAfford
                                                    ? 'bg-white text-black active:translate-y-1'
                                                    : 'bg-white/5 text-white/20 cursor-not-allowed'
                                                    }`}
                                            >
                                                {card.price.toLocaleString()} XP
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => selectCard(card.id)}
                                                className={`w-full py-3 rounded-2xl font-black text-[11px] uppercase tracking-wider transition-all shadow-lg ${isSelected
                                                    ? 'bg-orange-500 text-white shadow-[0_5px_15px_rgba(249,115,22,0.4)] translate-y-0.5'
                                                    : 'bg-white/20 text-white hover:bg-white/30 active:translate-y-1'
                                                    }`}
                                            >
                                                {isSelected ? 'Equipado' : 'Equipar'}
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
