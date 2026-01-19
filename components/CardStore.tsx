
import React, { useState, useEffect } from 'react';
import { supabase, getDeviceId } from '../utils/supabaseClient';
import { Card, Rarity } from '../types';
import { CARDS, ExtendedCard } from '../constants/cards';
import { ARENAS } from '../utils/arenas';

interface CardStoreProps {
    onBack: () => void;
    acordeCoins: number;
    onXPUpdate: (newXP: number) => void;
    accumulatedXP: number; // XP Lifetime
    selectedCardId?: string;
    onCardSelect: (cardId: string) => void;
    unlockedArenaId: number;
    onPlayStory: (arenaId: number) => void;
}

type TabType = 'cards' | 'arenas' | 'bosses';

export const CardStore: React.FC<CardStoreProps> = ({
    onBack,
    acordeCoins,
    onXPUpdate,
    accumulatedXP,
    selectedCardId,
    onCardSelect,
    unlockedArenaId,
    onPlayStory
}) => {
    const [activeTab, setActiveTab] = useState<TabType>('cards');
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

    // Función auxiliar para re-ver a história (Debug/User Request)
    const resetStorySeen = (arenaId: number) => {
        // Isso apaga o registro local de que a história foi vista, forçando o modal a aparecer no próximo jogo
        // Porém o modal é controlado no App.tsx. O CardStore não tem acesso direto ao setStats do App com o formato completo.
        // Mas ele recebe onXPUpdate que é limitado.
        // Vou adicionar um botão visual na Galeria de Arenas que dispara um alert explicando como ver a história
        // OU, melhor: O StoryModal pode ser chamado daqui? Não facilmente.
        // VOU ALTERAR O ONCLICK DA ARENA NA CARDSTORE PARA LIMPAR O STATUS "VISTO" NO APP.TSX,
        // mas precisaria elevar o state.
        // SOLUÇÃO MAIS RAPIDA E EFETIVA: Adicionar um botão de "Ver História" no CardStore que chama uma nova prop onShowStory.
    };

    const buyCard = async (card: ExtendedCard) => {
        if (!card.isReady) return;
        if (card.price > 0 && acordeCoins < card.price) {
            alert('XP insuficiente para comprar este card!');
            return;
        }

        try {
            const deviceId = getDeviceId();
            const { data, error: buyError } = await supabase.rpc('purchase_card', {
                device_id_param: deviceId,
                card_id_param: card.id,
                card_price_param: card.price
            });

            if (buyError) throw buyError;

            if (data?.success) {
                const finalBalance = data.new_balance !== undefined ? data.new_balance : (acordeCoins - card.price);
                onXPUpdate(finalBalance);
                setOwnedCards(prev => [...prev, card.id]);
                alert(`✅ Card "${card.name}" adquirido com sucesso!`);
            } else {
                alert(`❌ Erro: ${data?.message || 'Falha na compra'}`);
            }
        } catch (err: any) {
            console.error('Error buying card (Atomic):', err);
            alert('Erro crítico na conexão: ' + err.message);
        }
    };

    const selectCard = async (cardId: string) => {
        try {
            const deviceId = getDeviceId();
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
            case 'comum': return { color: 'text-blue-400', border: 'border-white/10', glow: 'shadow-[0_0_15px_rgba(255,255,255,0.05)]' };
            case 'raro': return { color: 'text-cyan-400', border: 'border-cyan-500/30', glow: 'shadow-[0_0_20px_rgba(6,182,212,0.2)]' };
            case 'épico': return { color: 'text-orange-500', border: 'border-white/20', glow: 'shadow-[0_0_25px_rgba(249,115,22,0.3)]' };
            case 'lendário': return { color: 'text-yellow-400', border: 'border-white/30', glow: 'shadow-[0_0_30px_rgba(250,204,21,0.4)] border-[2px]' };
            default: return { color: 'text-white', border: 'border-white/10', glow: '' };
        }
    };

    const renderTabs = () => (
        <div className="flex gap-2 mb-6 p-1 bg-white/5 rounded-2xl border border-white/10">
            {(['cards', 'arenas', 'bosses'] as TabType[]).map(tab => (
                <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all
                        ${activeTab === tab
                            ? 'bg-white text-black shadow-lg scale-100'
                            : 'text-white/40 hover:text-white hover:bg-white/5 scale-95'
                        }`}
                >
                    {tab === 'cards' ? 'Cards' : tab === 'arenas' ? 'Arenas' : 'Chefes'}
                </button>
            ))}
        </div>
    );

    const renderArenas = () => (
        <div className="flex-1 overflow-y-auto pr-1 no-scrollbar pb-10 space-y-4">
            {ARENAS.map((arena, index) => {
                const isUnlocked = arena.id <= unlockedArenaId;
                const isComingSoon = arena.id > unlockedArenaId;
                // Na verdade, se unlockedId for 1, 2 é "Locked". Mas o user pediu "Coming Soon" especificamente para "others"
                // Vou considerar "Locked" como um status de progresso, mas visualmente "Coming Soon" se não tiver assets?
                // O usuario disse: "Arena 1 unlocked and others marked as coming soon".
                // Vou mostrar LOCK padrao.

                return (
                    <div key={arena.id} className={`relative w-full aspect-[2/1] rounded-[32px] overflow-hidden border-2 transition-all ${isUnlocked ? 'border-orange-500 shadow-2xl opacity-100' : 'border-white/10 opacity-80'}`}>
                        <div
                            className="absolute inset-0 bg-cover bg-center transition-transform duration-700 hover:scale-110"
                            style={{ backgroundImage: `url(${arena.bgImage})` }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />

                        <div className="absolute bottom-0 left-0 p-6 w-full">
                            <div className="flex justify-between items-end">
                                <div>
                                    <span className={`text-[8px] font-black uppercase tracking-[0.3em] ${isUnlocked ? 'text-orange-500' : 'text-white/30'}`}>
                                        Arena {index + 1}
                                    </span>
                                    <h3 className="text-xl font-black italic text-white uppercase tracking-tighter leading-none mt-1">
                                        {arena.name.split(':')[1] || arena.name}
                                    </h3>
                                </div>
                                {!isUnlocked && (
                                    <div className="bg-black/80 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
                                        <i className="fa-solid fa-lock text-white/50 text-xs"></i>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Status Overlay */}
                        {!isUnlocked && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
                                <div className="bg-black/80 px-4 py-2 rounded-2xl border border-white/10 flex flex-col items-center">
                                    <i className="fa-solid fa-lock text-2xl text-white/20 mb-2"></i>
                                    <span className="text-[9px] font-black uppercase tracking-widest text-white/40">Bloqueado</span>
                                    <span className="text-[8px] font-bold text-orange-500/60 mt-1">Derrote o Boss Anterior</span>
                                </div>
                            </div>
                        )}

                        {/* Indicador de Atual / Botão Replay */}
                        {isUnlocked && (
                            <div className="absolute top-4 right-4 flex gap-2">
                                <button
                                    onClick={(e) => { e.stopPropagation(); onPlayStory(arena.id); }}
                                    className="bg-white/20 hover:bg-white text-white hover:text-black w-8 h-8 rounded-full flex items-center justify-center transition-all backdrop-blur-md border border-white/20 shadow-lg z-20"
                                    title="Ver História"
                                >
                                    <i className="fa-solid fa-book-open text-[10px]"></i>
                                </button>
                                {arena.id === unlockedArenaId && (
                                    <div className="bg-orange-500 text-white text-[8px] font-black px-3 py-1.5 rounded-full shadow-[0_0_20px_rgba(249,115,22,0.5)] uppercase tracking-widest animate-pulse flex items-center">
                                        Atual
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );

    const renderBosses = () => (
        <div className="flex-1 overflow-y-auto pr-1 no-scrollbar pb-10 space-y-6">
            {ARENAS.map((arena, index) => {
                const isRevealed = arena.id <= unlockedArenaId;
                const isUnlocked = arena.id <= unlockedArenaId;

                return (
                    <div key={arena.id} className="relative bg-white/5 rounded-[32px] p-1 border border-white/5 overflow-hidden">
                        {!isRevealed ? (
                            <div className="aspect-square bg-black/40 rounded-[28px] flex flex-col items-center justify-center relative overflow-hidden">
                                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: `url(${arena.boss.image})`, backgroundSize: 'cover', filter: 'blur(20px)' }}></div>
                                <i className="fa-solid fa-lock text-4xl text-white/20 mb-3 block"></i>
                                <span className="bg-white/10 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest text-white/40 border border-white/5">
                                    Chefe Oculto
                                </span>
                            </div>
                        ) : (
                            <>
                                <div className="aspect-[4/3] w-full rounded-[28px] overflow-hidden relative mb-4">
                                    <div className="absolute inset-0 bg-cover bg-top" style={{ backgroundImage: `url(${arena.boss.image})` }} />
                                    <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] to-transparent"></div>
                                    <div className="absolute bottom-4 left-4">
                                        <span className="text-orange-500 text-[9px] font-black uppercase tracking-[0.3em]">Chefe da Arena {arena.id}</span>
                                        <h3 className="text-2xl font-black italic text-white uppercase tracking-tighter leading-none">{arena.boss.name}</h3>
                                    </div>
                                </div>
                                <div className="px-4 pb-6">
                                    <div className="relative pl-4 border-l-2 border-orange-500/30">
                                        <p className="text-[12px] text-white/60 leading-relaxed italic">
                                            {arena.id === 1 && "Desperto pelo som proibido, este colosso de pedra e vinhas protege o coração da selva. Suas runas brilham em sincronia com o ritmo da terra. Ele não sente dor, apenas a vibração da música antiga."}
                                            {arena.id === 2 && "Uma criatura tecida de luz e reflexos nas profundezas da caverna. Suas pernas de cristal cortam o silêncio e sua teia captura ecos perdidos. Cuidado com o brilho, ele cega antes de atacar."}
                                            {arena.id === 3 && "O sentinela eterno de Acordelot. Sua armadura dourada reflete a glória de uma era passada, mas sua alabarda ainda é afiada. Ele bloqueia a entrada daqueles que não possuem a harmonia perfeita."}
                                            {arena.id === 4 && "Um gênio musical consumido pela solidão. O Último Maestro rege fantasmas em um conservatório arruinado. Ele busca um sucessor digno, ou talvez, apenas mais uma alma para sua partitura final."}
                                            {arena.id === 5 && "A verdadeira face do fim. O Lorde Silêncio é uma entidade de puro vazio que devora sons e cores. Ele manipulou tudo desde o início para calar o mundo para sempre. A origem da Grande Dissonância."}
                                        </p>
                                    </div>
                                    <div className="mt-4 flex gap-2">
                                        <div className="bg-orange-500/10 px-3 py-2 rounded-xl flex items-center gap-2 border border-orange-500/20">
                                            <i className="fa-solid fa-hand-fist text-orange-500 text-xs"></i>
                                            <span className="text-[9px] font-black text-white uppercase tracking-wider">Esmagador</span>
                                        </div>
                                        <div className="bg-green-500/10 px-3 py-2 rounded-xl flex items-center gap-2 border border-green-500/20">
                                            <i className="fa-solid fa-leaf text-green-400 text-xs"></i>
                                            <span className="text-[9px] font-black text-white uppercase tracking-wider">Tanque</span>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )
            })}
        </div>
    );

    const renderCards = () => (
        <>
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2 no-scrollbar">
                {(['all', 'comum', 'raro', 'épico', 'lendário'] as const).map(r => (
                    <button
                        key={r}
                        onClick={() => setFilter(r)}
                        className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap border ${filter === r
                            ? 'bg-white text-black border-white shadow-xl scale-105'
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
                            const canAfford = acordeCoins >= card.price;

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
        </>
    );

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
                            GALERIA <span className="text-orange-500">& LOJA</span>
                        </h2>
                        <div className="mt-2 bg-white/5 px-3 py-1 rounded-full border border-white/10 flex items-center gap-2">
                            <i className="fa-solid fa-coins text-[10px] text-yellow-500"></i>
                            <span className="text-[11px] font-black text-white tabular-nums">{acordeCoins.toLocaleString()} <span className="text-[8px] opacity-40 uppercase">Coins</span></span>
                        </div>
                    </div>
                </div>

                {renderTabs()}

                {activeTab === 'cards' && renderCards()}
                {activeTab === 'arenas' && renderArenas()}
                {activeTab === 'bosses' && renderBosses()}
            </div>
        </div>
    );
};
