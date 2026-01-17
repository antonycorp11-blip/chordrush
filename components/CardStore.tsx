
import React, { useState, useEffect } from 'react';
import { supabase, getDeviceId } from '../utils/supabaseClient';
import { Card, Rarity } from '../types';
import { CARDS, ExtendedCard } from '../constants/cards';

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
    const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle');

    useEffect(() => {
        fetchOwnedCards();
    }, []);

    const fetchOwnedCards = async () => {
        setLoading(true);
        try {
            const deviceId = getDeviceId();
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

                if (error) throw error;
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

    const resetCardsAndXP = async () => {
        if (!confirm('!!! ATENÇÃO !!!\nIsso vai deletar todos os seus cards e resetar seu XP para 0. Prosseguir?')) return;

        setSyncStatus('syncing');
        try {
            const deviceId = getDeviceId();
            const { data: playerData } = await supabase
                .from('players')
                .select('id')
                .eq('device_id', deviceId)
                .single();

            if (playerData) {
                // Delete all ownership records
                const { error: delError } = await supabase
                    .from('player_cards')
                    .delete()
                    .eq('player_id', playerData.id);

                if (delError) throw delError;

                // Reset XP to 0 and Deselect Card
                const { error: upError } = await supabase
                    .from('players')
                    .update({ xp: 0, selected_card_id: null })
                    .eq('id', playerData.id);

                if (upError) throw upError;

                setOwnedCards([]);
                onXPUpdate(0);
                onCardSelect('');
                alert('SUCESSO: Perfil limpo! Agora você pode testar a compra.');
                window.location.reload(); // Forçar recarregamento para limpar tudo
            }
        } catch (err: any) {
            alert('ERRO AO RESETAR: ' + (err.message || 'Erro desconhecido'));
            setSyncStatus('error');
        } finally {
            setSyncStatus('idle');
        }
    };

    const buyCard = async (card: ExtendedCard) => {
        if (!card.isReady) return;
        if (card.price > 0 && totalXP < card.price) {
            alert('XP INSUFICIENTE: Continue jogando para desbloquear!');
            return;
        }

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
            alert('🎉 CARD DESBLOQUEADO COM SUCESSO!');
        } catch (err: any) {
            alert('Erro na compra: ' + err.message);
        }
    };

    const selectCard = async (cardId: string) => {
        try {
            const deviceId = getDeviceId();
            const { error } = await supabase
                .from('players')
                .update({ selected_card_id: cardId || null })
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
            case 'comum': return { color: 'text-blue-400', border: 'border-white/10' };
            case 'raro': return { color: 'text-cyan-400', border: 'border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.4)]' };
            case 'épico': return { color: 'text-orange-500', border: 'border-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.6)]' };
            case 'lendário': return { color: 'text-yellow-400', border: 'border-yellow-400 shadow-[0_0_25px_rgba(250,204,21,0.8)] border-[3px]' };
            default: return { color: 'text-white', border: 'border-white/10' };
        }
    };

    return (
        <div className="w-full h-full flex flex-col bg-[#050505] overflow-hidden">
            <div className="w-full max-w-lg mx-auto flex flex-col h-full p-6">
                <div className="flex items-center justify-between mb-8">
                    <button
                        onClick={onBack}
                        className="w-12 h-12 flex items-center justify-center bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 active:scale-95 transition-all text-white"
                    >
                        <i className="fa-solid fa-chevron-left text-xl"></i>
                    </button>
                    <div className="flex flex-col items-end">
                        <h2 className="text-3xl font-black italic tracking-tighter text-white uppercase leading-none">
                            LOJA DE <span className="text-orange-500">CARDS</span>
                        </h2>
                        <div className="mt-2 bg-white/5 px-3 py-1 rounded-full border border-white/10 flex items-center gap-2">
                            <i className="fa-solid fa-bolt text-[10px] text-orange-500"></i>
                            <span className="text-xs font-black text-white tabular-nums">{totalXP.toLocaleString()} XP</span>
                        </div>
                    </div>
                </div>

                <div className="flex gap-2 mb-6 overflow-x-auto pb-2 no-scrollbar">
                    <button
                        onClick={resetCardsAndXP}
                        className={`px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase border-2 transition-all flex items-center gap-2 ${syncStatus === 'syncing' ? 'bg-orange-500 border-orange-400 text-white animate-pulse' : 'bg-red-500/10 border-red-500/30 text-red-500 hover:bg-red-500/20'}`}
                    >
                        <i className={`fa-solid ${syncStatus === 'syncing' ? 'fa-spinner fa-spin' : 'fa-trash-can'}`}></i>
                        DEBUG: RESETAR TUDO
                    </button>
                    {(['all', 'comum', 'raro', 'épico', 'lendário'] as const).map(r => (
                        <button
                            key={r}
                            onClick={() => setFilter(r)}
                            className={`px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border-2 ${filter === r
                                ? 'bg-orange-500 border-orange-400 text-white shadow-[0_0_20px_rgba(249,115,22,0.4)]'
                                : 'bg-white/5 border-white/5 text-white/40'
                                }`}
                        >
                            {r === 'all' ? 'Ver Todos' : r}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-4">
                        <div className="w-10 h-10 border-[3px] border-orange-500/10 border-t-orange-500 rounded-full animate-spin"></div>
                        <span className="text-white/20 font-black uppercase tracking-widest text-[9px]">Carregando...</span>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto pr-2 no-scrollbar space-y-4 pb-10">

                        {/* OPÇÃO DE NENHUM CARD - SEMPRE VISÍVEL NO TOPO */}
                        <div
                            onClick={() => selectCard('')}
                            className={`
                                relative w-full p-6 rounded-[32px] border-2 transition-all duration-300 cursor-pointer overflow-hidden
                                ${!selectedCardId ? 'border-orange-500 bg-neutral-800 shadow-xl' : 'border-white/5 bg-neutral-900/40 opacity-40'}
                            `}
                        >
                            <div className="flex items-center justify-between relative z-10">
                                <div className="flex flex-col">
                                    <span className="text-white/40 font-black uppercase text-[10px] tracking-widest mb-1">Visual Original</span>
                                    <h3 className="text-white font-black text-2xl uppercase tracking-tighter italic">Nenhum Card</h3>
                                </div>
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 ${!selectedCardId ? 'bg-orange-500 border-white text-white' : 'bg-black/40 border-white/20 text-white/40'}`}>
                                    <i className={`fa-solid ${!selectedCardId ? 'fa-check text-xl' : 'fa-ban'}`}></i>
                                </div>
                            </div>
                        </div>

                        {filteredCards.map(card => {
                            const isOwned = ownedCards.includes(card.id);
                            const isSelected = selectedCardId === card.id;
                            const isReady = card.isReady;
                            const styles = getRarityStyles(card.rarity);
                            const canAfford = totalXP >= card.price;

                            return (
                                <div
                                    key={card.id}
                                    onClick={() => {
                                        if (!isReady) return;
                                        if (isOwned) selectCard(card.id);
                                        else buyCard(card);
                                    }}
                                    className={`
                                        relative w-full p-6 rounded-[32px] border-2 transition-all duration-300 overflow-hidden
                                        ${isReady ? 'cursor-pointer' : 'cursor-not-allowed'}
                                        ${isSelected ? 'scale-[1.03] z-10 border-orange-500' : 'scale-100'}
                                        ${styles.border}
                                    `}
                                    style={{
                                        backgroundImage: isReady ? `${card.image}` : 'none',
                                        backgroundSize: 'cover',
                                        backgroundPosition: 'center'
                                    }}
                                >
                                    <div className={`absolute inset-0 bg-black/50 backdrop-blur-[0.5px] ${!isReady ? 'bg-black/80' : ''}`}></div>

                                    {!isReady && (
                                        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-4">
                                            <div className="bg-orange-500/20 text-orange-500 border border-orange-500/30 font-black text-[8px] px-3 py-1 rounded-full uppercase tracking-widest mb-1">
                                                Em Produção
                                            </div>
                                            <span className="text-white/20 font-black text-sm uppercase tracking-widest">Pixel Art em Breve</span>
                                        </div>
                                    )}

                                    <div className="relative z-10 flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className={`${styles.color} font-black uppercase text-[10px] tracking-widest mb-1`}>
                                                {card.rarity}
                                            </span>
                                            <h3 className="text-white font-black text-2xl uppercase tracking-tighter italic">
                                                {card.name}
                                            </h3>
                                        </div>

                                        <div className="flex flex-col items-end">
                                            {!isOwned ? (
                                                <div className={`px-4 py-2 rounded-2xl font-black text-xs shadow-xl uppercase transition-all flex items-center gap-2 ${canAfford ? 'bg-white text-black active:scale-95' : 'bg-black/40 text-white/20 border border-white/10'}`}>
                                                    <i className="fa-solid fa-bolt"></i>
                                                    {card.price.toLocaleString()}
                                                </div>
                                            ) : (
                                                <div className={`
                                                    w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-all
                                                    ${isSelected ? 'bg-orange-500 border-white text-white' : 'bg-black/40 border-white/20 text-white/40'}
                                                `}>
                                                    <i className={`fa-solid ${isSelected ? 'fa-check text-xl' : 'fa-hand-pointer'}`}></i>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
