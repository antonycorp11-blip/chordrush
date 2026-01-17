
import React, { useState, useEffect } from 'react';
import { supabase, getDeviceId } from '../utils/supabaseClient';
import { Card, Rarity, GameStats } from '../types';
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

            // Get player ID first
            const { data: playerData } = await supabase
                .from('players')
                .select('id')
                .eq('device_id', deviceId)
                .single();

            if (playerData) {
                const { data, error } = await supabase
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

            // 1. Add to owned cards in database
            const { error: buyError } = await supabase
                .from('player_cards')
                .insert({ player_id: playerData.id, card_id: card.id });

            if (buyError) throw buyError;

            // 2. Deduct XP in database
            const { error: xpError } = await supabase
                .from('players')
                .update({ xp: totalXP - card.price })
                .eq('id', playerData.id);

            if (xpError) throw xpError;

            // 3. Update local state
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

            // Update in database
            const { error } = await supabase
                .from('players')
                .update({ selected_card_id: cardId })
                .eq('device_id', deviceId);

            if (error) throw error;

            // Update local app state
            onCardSelect(cardId);
        } catch (err) {
            console.error('Error selecting card:', err);
        }
    };

    const filteredCards = filter === 'all'
        ? CARDS
        : CARDS.filter(c => c.rarity === filter);

    const rarityColors = {
        'comum': 'text-blue-400',
        'raro': 'text-purple-400',
        'épico': 'text-orange-400',
        'lendário': 'text-yellow-400'
    };

    return (
        <div className="w-full h-full flex flex-col items-center bg-neutral-900 overflow-hidden relative">
            {/* Background Effects */}
            <div className="absolute top-[-10%] left-[-10%] w-[400px] h-[400px] bg-purple-600/10 blur-[120px] rounded-full pointer-events-none"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none"></div>

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
                        <h2 className="text-4xl font-black italic tracking-tighter text-white uppercase leading-none">
                            LOJA DE <span className="text-orange-500 underline decoration-4 underline-offset-4">CARDS</span>
                        </h2>
                        <div className="flex items-center gap-2 mt-2">
                            <i className="fa-solid fa-bolt text-xs text-orange-500"></i>
                            <span className="text-sm font-black text-white">{totalXP.toLocaleString()} XP</span>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
                    {(['all', 'comum', 'raro', 'épico', 'lendário'] as const).map(r => (
                        <button
                            key={r}
                            onClick={() => setFilter(r)}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border-2 ${filter === r
                                ? 'bg-orange-500 border-orange-400 text-white'
                                : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10'
                                }`}
                        >
                            {r === 'all' ? 'Todos' : r}
                        </button>
                    ))}
                </div>

                {/* Grid */}
                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-4">
                        <div className="w-12 h-12 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin"></div>
                        <span className="text-white/20 font-black uppercase tracking-widest text-xs">Carregando Loja...</span>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto pr-2 scrollbar-hide">
                        <div className="grid grid-cols-2 gap-4 pb-10">
                            {filteredCards.map(card => {
                                const isOwned = ownedCards.includes(card.id);
                                const isSelected = selectedCardId === card.id;
                                const canAfford = totalXP >= card.price;

                                return (
                                    <div
                                        key={card.id}
                                        className={`group relative flex flex-col p-3 rounded-3xl border-2 transition-all duration-300 ${isSelected
                                            ? 'border-orange-500 bg-orange-500/10'
                                            : 'border-white/5 bg-white/5 hover:border-white/20'
                                            }`}
                                    >
                                        {/* Preview Card */}
                                        <div
                                            className="w-full aspect-[4/3] rounded-2xl mb-3 shadow-xl overflow-hidden relative"
                                            style={{ background: card.image }}
                                        >
                                            <div className="absolute inset-0 bg-black/10"></div>
                                            <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/40 backdrop-blur-sm rounded-md border border-white/10">
                                                <span className={`text-[8px] font-black uppercase tracking-widest ${rarityColors[card.rarity]}`}>
                                                    {card.rarity}
                                                </span>
                                            </div>
                                        </div>

                                        <h3 className="text-white font-black text-sm uppercase tracking-tight mb-1 truncate">{card.name}</h3>

                                        {!isOwned ? (
                                            <button
                                                onClick={() => buyCard(card)}
                                                disabled={!canAfford}
                                                className={`w-full py-2.5 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all border-b-4 ${canAfford
                                                    ? 'bg-white text-black border-neutral-300 active:scale-95'
                                                    : 'bg-white/5 text-white/20 border-white/5 cursor-not-allowed'
                                                    }`}
                                            >
                                                {card.price.toLocaleString()} XP
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => selectCard(card.id)}
                                                className={`w-full py-2.5 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all border-b-4 ${isSelected
                                                    ? 'bg-orange-500 text-white border-orange-700'
                                                    : 'bg-white/20 text-white border-white/10 hover:bg-white/30 active:scale-95'
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
