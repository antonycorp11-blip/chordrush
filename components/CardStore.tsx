
import React, { useState, useEffect } from 'react';
import { supabase, getDeviceId } from '../utils/supabaseClient';
import { Card, Rarity } from '../types';
import { CARDS, ExtendedCard } from '../constants/cards';

interface CardStoreProps {
    onBack: () => void;
    totalXP: number;
    onXPUpdate: (newXP: number) => void;
    accumulatedXP: number; // XP Lifetime
    selectedCardId?: string;
    onCardSelect: (cardId: string) => void;
}

export const CardStore: React.FC<CardStoreProps> = ({
    onBack,
    totalXP, // Este é o SALDO
    onXPUpdate,
    accumulatedXP,
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
        setLoading(true);
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

    const buyCard = async (card: ExtendedCard) => {
        if (!card.isReady) return;
        if (card.price > 0 && totalXP < card.price) {
            alert('XP insuficiente para comprar este card!');
            return;
        }

        try {
            const deviceId = getDeviceId();

            // Usamos a função RPC segura para que o Matheus não mude o preço no console
            const { error: buyError } = await supabase.rpc('purchase_card', {
                device_id_param: deviceId,
                card_id_param: card.id,
                card_price_param: card.price
            });

            if (buyError) throw buyError;

            // Atualiza o saldo localmente para refletir a compra
            onXPUpdate(totalXP - card.price);
            setOwnedCards(prev => [...prev, card.id]);
            alert(`Card "${card.name}" adquirido com sucesso!`);
        } catch (err: any) {
            console.error('Error buying card (Security):', err);
            alert('Erro na compra: ' + err.message);
        }
    };

    const selectCard = async (cardId: string) => {
        try {
            const deviceId = getDeviceId();

            // Usamos RPC para selecionar o card com segurança
            const { error } = await supabase.rpc('select_player_card', {
                device_id_param: deviceId,
                card_id_param: cardId
            });

            if (error) throw error;
            onCardSelect(cardId);
        } catch (err) {
            console.error('Error selecting card (Security):', err);
        }
    };

    const filteredCards = filter === 'all'
        ? CARDS
        : CARDS.filter(c => c.rarity === filter);

    const getRarityStyles = (rarity: Rarity) => {
        switch (rarity) {
            case 'comum': return { color: 'text-blue-400', border: 'border-white/10', glow: 'shadow-[0_0_15px_rgba(255,255,255,0.1)]' };
            case 'raro': return { color: 'text-cyan-400', border: 'border-cyan-500/50', glow: 'shadow-[0_0_20px_rgba(6,182,212,0.3)]' };
            case 'épico': return { color: 'text-orange-500', border: 'border-orange-500', glow: 'shadow-[0_0_25px_rgba(249,115,22,0.4)]' };
            case 'lendário': return { color: 'text-yellow-400', border: 'border-yellow-400', glow: 'shadow-[0_0_30px_rgba(250,204,21,0.5)] border-[3px]' };
            default: return { color: 'text-white', border: 'border-white/10', glow: '' };
        }
    };

    return (
        <div className="w-full h-full flex flex-col bg-[#050505] overflow-hidden">
            <div className="w-full max-w-lg mx-auto flex flex-col h-full p-4 sm:p-6">
                <div className="flex items-center justify-between mb-6">
                    <button
                        onClick={onBack}
                        className="w-12 h-12 flex items-center justify-center bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 hover:bg-white/15 active:scale-95 transition-all text-white"
                    >
                        <i className="fa-solid fa-chevron-left text-xl"></i>
                    </button>
                    <div className="flex flex-col items-end">
                        <h2 className="text-2xl font-black italic tracking-tighter text-white uppercase leading-none">
                            LOJA DE <span className="text-orange-500">CARDS</span>
                        </h2>
                        <div className="mt-2 bg-white/5 px-3 py-1 rounded-full border border-white/10 flex items-center gap-2">
                            <i className="fa-solid fa-wallet text-[10px] text-orange-500"></i>
                            <span className="text-[11px] font-black text-white tabular-nums">{totalXP.toLocaleString()} <span className="text-[8px] opacity-40 uppercase">Saldo</span></span>
                        </div>
                    </div>
                </div>

                <div className="flex gap-2 mb-6 overflow-x-auto pb-2 no-scrollbar">
                    {(['all', 'comum', 'raro', 'épico', 'lendário'] as const).map(r => (
                        <button
                            key={r}
                            onClick={() => setFilter(r)}
                            className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap border ${filter === r
                                ? 'bg-orange-500 border-orange-400 text-white shadow-lg'
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
                    <div className="flex-1 overflow-y-auto pr-1 no-scrollbar pb-10">
                        <div className="grid grid-cols-2 gap-3 sm:gap-4">

                            {/* OPÇÃO DE NENHUM CARD */}
                            <div
                                onClick={() => selectCard('')}
                                className={`
                                    relative aspect-[2/3] rounded-[24px] border-2 transition-all duration-300 cursor-pointer overflow-hidden flex flex-col items-center justify-center p-4 text-center
                                    ${!selectedCardId ? 'border-orange-500 bg-neutral-800 ring-4 ring-orange-500/20' : 'border-white/5 bg-neutral-900/40'}
                                `}
                            >
                                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/40"></div>
                                <div className="relative z-10 flex flex-col items-center gap-4">
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${!selectedCardId ? 'bg-orange-500 border-white text-white' : 'bg-black/40 border-white/20 text-white/40'}`}>
                                        <i className={`fa-solid ${!selectedCardId ? 'fa-check text-xl' : 'fa-ban text-xl'}`}></i>
                                    </div>
                                    <div>
                                        <h3 className="text-white font-black text-sm uppercase tracking-tighter italic">Nenhum Card</h3>
                                        <p className="text-[8px] text-white/40 font-black uppercase tracking-widest mt-1">Estilo Padrão</p>
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
                                            relative aspect-[2/3] rounded-[24px] border-2 transition-all duration-300 overflow-hidden
                                            ${isReady ? 'cursor-pointer hover:translate-y-[-4px]' : 'cursor-not-allowed opacity-90'}
                                            ${isSelected ? 'z-10 ring-4 ring-orange-500/20' : 'scale-100'}
                                            ${styles.border} ${styles.glow}
                                        `}
                                        style={{
                                            backgroundImage: isReady ? `${card.image}` : 'none',
                                            backgroundSize: 'cover',
                                            backgroundPosition: 'center'
                                        }}
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"></div>

                                        {/* BARRA ANTIGA DE "EM DESENVOLVIMENTO" */}
                                        {!isReady && (
                                            <div className="absolute inset-0 z-20 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center p-2 text-center">
                                                <div className="bg-orange-500 text-white font-black text-[7px] px-2 py-0.5 rounded-full uppercase tracking-widest mb-1 shadow-lg">
                                                    Em Breve
                                                </div>
                                                <span className="text-white/40 font-black text-xs italic uppercase tracking-tighter">Em Produção</span>
                                            </div>
                                        )}

                                        <div className="absolute inset-x-0 bottom-0 p-4 z-10 flex flex-col">
                                            <span className={`${styles.color} font-black uppercase text-[8px] tracking-[0.2em] mb-0.5`}>
                                                {card.rarity}
                                            </span>
                                            <h3 className="text-white font-black text-base uppercase tracking-tighter italic leading-none truncate">
                                                {card.name}
                                            </h3>

                                            <div className="mt-3">
                                                {!isOwned ? (
                                                    <div className={`w-full py-1.5 rounded-xl font-black text-[9px] shadow-xl uppercase transition-all flex items-center justify-center gap-1.5 border ${canAfford ? 'bg-white text-black border-white' : 'bg-black/60 text-white/20 border-white/10'}`}>
                                                        <i className="fa-solid fa-bolt text-[8px]"></i>
                                                        {card.price.toLocaleString()}
                                                    </div>
                                                ) : (
                                                    <div className={`
                                                        w-full py-1.5 rounded-xl flex items-center justify-center border transition-all text-[9px] font-black uppercase tracking-widest
                                                        ${isSelected ? 'bg-orange-500 border-white text-white' : 'bg-black/60 border-white/20 text-white/40'}
                                                    `}>
                                                        {isSelected ? 'Equipado' : 'Selecionar'}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
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
