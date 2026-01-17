
import React from 'react';
import { supabase, getDeviceId } from '../utils/supabaseClient';
import { RankingEntry } from '../types';
import { getPlayerTitle, getNextLevelProgress } from '../utils/titles';
import { CARDS } from '../constants/cards';

interface RankingBoardProps {
    onBack: () => void;
}

export const RankingBoard: React.FC<RankingBoardProps> = ({ onBack }) => {
    const [ranking, setRanking] = React.useState<RankingEntry[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [now, setNow] = React.useState(Date.now());
    const [drift, setDrift] = React.useState(0);
    const [selectedPlayer, setSelectedPlayer] = React.useState<any>(null);
    const [ownedCards, setOwnedCards] = React.useState<string[]>([]);
    const [profileLoading, setProfileLoading] = React.useState(false);

    const deviceId = getDeviceId();

    const fetchRanking = async () => {
        try {
            const { data: latestData } = await supabase
                .from('scores')
                .select('created_at')
                .order('created_at', { ascending: false })
                .limit(1);

            if (latestData?.[0]) {
                const serverLatest = new Date(latestData[0].created_at).getTime();
                const localNow = Date.now();
                setDrift(localNow - serverLatest);
            }

            const { data: scoresData, error: sError } = await supabase
                .from('scores')
                .select('player_id, score, created_at')
                .order('score', { ascending: false })
                .limit(500);

            if (sError) throw sError;
            if (!scoresData || scoresData.length === 0) {
                setRanking([]);
                setLoading(false);
                return;
            }

            const playerIds = Array.from(new Set(scoresData.map(s => s.player_id)));

            const { data: playersData, error: pError } = await supabase
                .from('players')
                .select('id, device_id, name, xp, total_xp, selected_card_id, games_played')
                .in('id', playerIds);

            if (pError) throw pError;

            const playersMap = new Map();
            playersData?.forEach(p => playersMap.set(p.id, p));

            const consolidatedMap = new Map();
            scoresData.forEach(s => {
                const player = playersMap.get(s.player_id);
                if (!player || !player.name) return;

                const nameKey = player.name.trim().toUpperCase();
                const sTime = new Date(s.created_at).getTime();
                const existing = consolidatedMap.get(nameKey);

                if (!existing) {
                    consolidatedMap.set(nameKey, {
                        id: player.id,
                        name: player.name,
                        device_id: player.device_id,
                        xp: player.xp || 0,
                        total_xp: player.total_xp || player.xp || 0,
                        selected_card_id: player.selected_card_id,
                        games_played: player.games_played || 0,
                        bestScore: s.score,
                        lastPlayedTime: sTime,
                        lastPlayedAt: s.created_at
                    });
                } else {
                    if (s.score > existing.bestScore) existing.bestScore = s.score;
                    if (sTime > existing.lastPlayedTime) {
                        existing.lastPlayedTime = sTime;
                        existing.lastPlayedAt = s.created_at;
                    }
                    existing.xp = player.xp || 0;
                    existing.total_xp = player.total_xp || player.xp || 0;
                }
            });

            const finalRanking = Array.from(consolidatedMap.values())
                .sort((a, b) => b.bestScore - a.bestScore)
                .slice(0, 100)
                .map(item => ({
                    id: item.id,
                    device_id: item.device_id,
                    name: item.name,
                    xp: item.xp,
                    total_xp: item.total_xp,
                    score: item.bestScore,
                    games_played: item.games_played,
                    created_at: item.lastPlayedAt,
                    selected_card_id: item.selected_card_id
                }));

            setRanking(finalRanking as any);
        } catch (err) {
            console.error('Erro ao processar ranking:', err);
        } finally {
            setLoading(false);
        }
    };

    const handlePlayerClick = async (player: any) => {
        setProfileLoading(true);
        setSelectedPlayer(player);
        try {
            // Buscar cards desbloqueados
            const { data: cards } = await supabase
                .from('player_cards')
                .select('card_id')
                .eq('player_id', player.id);

            setOwnedCards(cards?.map(c => c.card_id) || []);
        } catch (err) {
            console.error('Erro ao buscar perfil detalhado:', err);
        } finally {
            setProfileLoading(false);
        }
    };

    React.useEffect(() => {
        fetchRanking();
        const clockTimer = setInterval(() => setNow(Date.now()), 1000);
        const refreshTimer = setInterval(fetchRanking, 30000);

        const channel = supabase
            .channel('ranking_updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'scores' }, () => fetchRanking())
            .subscribe();

        return () => {
            clearInterval(clockTimer);
            clearInterval(refreshTimer);
            supabase.removeChannel(channel);
        };
    }, []);

    const getTimeAgo = (dateString: string) => {
        if (!dateString) return '---';
        const past = new Date(dateString).getTime();
        const adjustedNow = now - drift;
        const diff = Math.max(0, Math.floor((adjustedNow - past) / 1000));

        if (diff < 30) return 'Agora';
        if (diff < 60) return `${diff}s`;
        if (diff < 3600) return `${Math.floor(diff / 60)}m`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
        return `${Math.floor(diff / 86400)}d`;
    };

    return (
        <div className="w-full h-full flex flex-col bg-[#050505] overflow-hidden">
            <div className="p-6 pb-2 flex items-center justify-between z-10">
                <button onClick={onBack} className="w-12 h-12 flex items-center justify-center bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 active:scale-95 transition-all text-white shadow-lg">
                    <i className="fa-solid fa-chevron-left text-xl"></i>
                </button>
                <div className="flex flex-col items-end text-right">
                    <h2 className="text-3xl font-black italic tracking-tighter text-white uppercase leading-none">RANKING <span className="text-orange-500">GLOBAL</span></h2>
                    <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.3em] mt-1 italic">V5.0.0 • Era Lendária</span>
                </div>
            </div>

            {loading && ranking.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-4">
                    <div className="w-10 h-10 border-[3px] border-orange-500/10 border-t-orange-500 rounded-full animate-spin"></div>
                    <span className="text-white/20 font-black uppercase tracking-widest text-[9px]">Sincronizando Ranking...</span>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto px-4 pt-4 pb-10 space-y-3 no-scrollbar">
                    {/* WEEKLY PRIZE BANNER */}
                    <div className="relative w-full p-6 rounded-[32px] border-2 border-orange-500/30 bg-orange-500/10 overflow-hidden mb-6 group animate-in slide-in-from-top duration-500">
                        <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 via-transparent to-orange-500/10 active:opacity-40 transition-opacity"></div>
                        <div className="absolute -right-4 -top-4 w-24 h-24 bg-orange-500/10 rounded-full blur-2xl group-hover:bg-orange-500/20 transition-all"></div>

                        <div className="relative z-10 flex items-center justify-between">
                            <div className="flex flex-col text-left">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500 text-left">Prêmio da Semana</span>
                                </div>
                                <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white leading-none text-left">BARRA DE <span className="text-orange-500 text-left">CACAU SHOW</span></h3>
                                <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mt-2 text-left">1º LUGAR NO RANKING</p>
                            </div>
                            <div className="flex flex-col items-end">
                                <div className="bg-white/5 border border-white/10 px-3 py-1.5 rounded-2xl flex flex-col items-center min-w-[70px]">
                                    <span className="text-[8px] font-black text-white/30 uppercase tracking-widest mb-0.5">Prazo Até</span>
                                    <span className="text-sm font-black text-white tabular-nums tracking-tight">
                                        {(() => {
                                            const d = new Date(now);
                                            const daysToAdd = (7 - d.getDay()) % 7;
                                            const deadline = new Date(now);
                                            deadline.setDate(d.getDate() + daysToAdd);
                                            deadline.setHours(12, 0, 0, 0);

                                            if (now > deadline.getTime()) {
                                                deadline.setDate(deadline.getDate() + 7);
                                            }

                                            const diff = deadline.getTime() - now;
                                            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                                            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                                            const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                                            return days > 0 ? `${days}d ${hours}h` : `${hours}h ${mins}m`;
                                        })()}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {ranking.map((entry, index) => {
                        const isMe = entry.device_id === deviceId;
                        const playerXP = entry.total_xp || entry.xp || 0;
                        const titleInfo = getPlayerTitle(playerXP);
                        const progress = getNextLevelProgress(playerXP);
                        const selectedCard = CARDS.find(c => c.id === entry.selected_card_id);

                        return (
                            <div
                                key={`${entry.name}-${index}`}
                                onClick={() => handlePlayerClick(entry)}
                                className={`
                                    relative flex items-center justify-between p-5 rounded-[28px] border-2 transition-all duration-300 cursor-pointer active:scale-95
                                    ${isMe ? 'border-orange-500 shadow-xl scale-[1.02] z-10' : 'border-white/5 hover:border-white/20'}
                                    ${selectedCard?.rarity === 'épico' ? 'shadow-[0_0_20px_rgba(249,115,22,0.3)]' : ''}
                                    ${selectedCard?.rarity === 'lendário' ? 'shadow-[0_0_30px_rgba(250,204,21,0.4)]' : ''}
                                `}
                            >
                                {/* AURA EXTERNA (QUE PULA PRA FORA) */}
                                {selectedCard && (selectedCard.rarity === 'épico' || selectedCard.rarity === 'lendário') && (
                                    <div className={`absolute -inset-4 z-0 animate-pulse blur-3xl opacity-50 rounded-[40px] ${selectedCard.rarity === 'épico' ? 'bg-orange-600' : 'bg-yellow-400'
                                        }`} />
                                )}

                                {/* EFEITO LENDÁRIO: ELEMENTOS GRÁFICOS REAIS */}
                                {selectedCard?.rarity === 'lendário' && (
                                    <div className="absolute inset-0 z-0 pointer-events-none">
                                        {/* RAIOS DE LUZ FÍSICOS (DENTRO E FORA) */}
                                        <div className="absolute inset-x-[-100%] inset-y-[-100%] animate-[spin_15s_linear_infinite] opacity-40">
                                            {[...Array(8)].map((_, i) => (
                                                <div
                                                    key={i}
                                                    className="absolute top-1/2 left-1/2 w-[300%] h-6 bg-gradient-to-r from-transparent via-yellow-400/30 to-transparent -translate-x-1/2 -translate-y-1/2"
                                                    style={{ transform: `translate(-50%, -50%) rotate(${i * 45}deg)` }}
                                                />
                                            ))}
                                        </div>

                                        {/* ESTRELAS/BRILHOS QUE PULAM NO CARD */}
                                        <div className="absolute inset-0 z-20">
                                            <div className="absolute top-[20%] right-[15%] animate-bounce opacity-80">
                                                <i className="fa-solid fa-star text-[10px] text-yellow-200 drop-shadow-[0_0_8px_white]"></i>
                                            </div>
                                            <div className="absolute bottom-[25%] left-[30%] animate-pulse opacity-60" style={{ animationDelay: '1s' }}>
                                                <i className="fa-solid fa-star text-[8px] text-yellow-100 drop-shadow-[0_0_5px_white]"></i>
                                            </div>
                                            <div className="absolute top-[50%] right-[40%] animate-ping opacity-30" style={{ animationDelay: '0.5s' }}>
                                                <i className="fa-solid fa-star text-[6px] text-white"></i>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* CONTAINER PARA CLIPAR O FUNDO */}
                                <div className="absolute inset-0 rounded-[28px] overflow-hidden z-[1]">
                                    {selectedCard ? (
                                        <>
                                            {/* CARD BACKGROUND */}
                                            <div
                                                className="absolute inset-0 bg-cover bg-center opacity-95 transition-all duration-700 scale-[1.1] brightness-110"
                                                style={{ backgroundImage: selectedCard.image }}
                                            />
                                            {/* GRADIENTE DE LEITURA */}
                                            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/40 to-transparent" />

                                            {/* BRILHO LATERAL CRISTALINO */}
                                            <div className="absolute left-0 top-0 bottom-0 w-1.5 z-20 overflow-hidden">
                                                <div className={`h-full relative ${selectedCard.rarity === 'lendário' ? 'bg-gradient-to-b from-yellow-300 via-white to-yellow-600 shadow-[0_0_15px_rgba(250,204,21,1)]' :
                                                        selectedCard.rarity === 'épico' ? 'bg-orange-500' :
                                                            selectedCard.rarity === 'raro' ? 'bg-cyan-400' :
                                                                'bg-blue-400'
                                                    }`}>
                                                    {/* VARREDURA DE BRILHO (DIAMOND SWEEP) */}
                                                    <div className={`absolute inset-0 bg-gradient-to-t from-transparent via-white/80 to-transparent ${selectedCard.rarity === 'lendário' ? 'animate-[bounce_2s_infinite]' : 'bg-white/40 animate-[pulse_2s_infinite]'}`}></div>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <div className={`absolute inset-0 ${isMe ? 'bg-neutral-800' : 'bg-neutral-900/60'}`} />
                                    )}
                                </div>

                                <div className="flex items-center gap-4 relative z-10 flex-1 min-w-0">
                                    <div className="w-8 flex-shrink-0 flex justify-center text-left">
                                        {index < 3 ? (
                                            <i className={`fa-solid fa-crown text-2xl ${index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-300' : 'text-orange-400'}`}></i>
                                        ) : (
                                            <span className="text-white/30 font-black italic text-lg text-left">#{index + 1}</span>
                                        )}
                                    </div>
                                    <div className="flex flex-col flex-1 min-w-0 text-left">
                                        <div className="flex items-center gap-2 mb-1 text-left">
                                            <div className={`px-2 py-0.5 rounded-full border text-[7px] font-black tracking-widest uppercase ${titleInfo.border} ${titleInfo.style}`}>
                                                {titleInfo.title}
                                            </div>
                                            <span className="text-[10px] font-bold text-white/20 whitespace-nowrap">• {getTimeAgo(entry.created_at)}</span>
                                        </div>

                                        <div className="flex items-center gap-2 text-left">
                                            <span className="text-lg font-black text-white tracking-tight break-words line-clamp-1 uppercase max-w-[150px] text-left">
                                                {entry.name}
                                            </span>
                                            {isMe && <span className="text-[8px] bg-orange-500 text-white px-1.5 py-0.5 rounded font-black uppercase tracking-tighter">VOCÊ</span>}
                                        </div>

                                        <div className="w-24 h-1 bg-white/10 rounded-full mt-2 overflow-hidden flex">
                                            <div className="h-full bg-orange-500 rounded-full transition-all duration-1000" style={{ width: `${Math.max(2, progress)}%` }}></div>
                                        </div>
                                    </div>
                                </div>

                                <div className="text-right relative z-10 flex-shrink-0">
                                    <div className="text-2xl font-black text-white italic tracking-tighter leading-none"> {entry.score.toLocaleString()} </div>
                                    <span className="text-[8px] font-black uppercase tracking-widest text-white/20">Pontos</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* MODAL DE PERFIL DO JOGADOR */}
            {selectedPlayer && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl animate-in fade-in duration-300">
                    <div className="w-full max-w-sm bg-neutral-900 border-2 border-white/10 rounded-[40px] p-8 relative shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        {/* DECORAÇÃO BACKGROUND */}
                        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-orange-500/20 to-transparent"></div>

                        <button onClick={() => setSelectedPlayer(null)} className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center bg-white/5 rounded-full text-white/40 hover:text-white transition-colors z-20">
                            <i className="fa-solid fa-xmark text-xl"></i>
                        </button>

                        <div className="relative z-10 text-center flex flex-col items-center">
                            <div className="mb-4">
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-500 mb-2 block">Dossiê do Jogador</span>
                                <h2 className="text-3xl font-black italic tracking-tighter uppercase leading-tight text-white">{selectedPlayer.name}</h2>
                            </div>

                            <div className="grid grid-cols-2 gap-3 w-full mb-8">
                                <div className="bg-white/5 rounded-3xl p-4 border border-white/10 shadow-inner flex flex-col items-center">
                                    <span className="text-[8px] font-black text-white/30 uppercase tracking-widest mb-1">XP Account</span>
                                    <span className="text-xl font-black text-white tabular-nums">{(selectedPlayer.total_xp || 0).toLocaleString()}</span>
                                </div>
                                <div className="bg-white/5 rounded-3xl p-4 border border-white/10 shadow-inner flex flex-col items-center">
                                    <span className="text-[8px] font-black text-white/30 uppercase tracking-widest mb-1">High Score</span>
                                    <span className="text-xl font-black text-orange-500 tabular-nums">{(selectedPlayer.score || 0).toLocaleString()}</span>
                                </div>
                                <div className="bg-white/5 rounded-3xl p-4 border border-white/10 shadow-inner flex flex-col items-center">
                                    <span className="text-[8px] font-black text-white/30 uppercase tracking-widest mb-1">Partidas</span>
                                    <span className="text-xl font-black text-emerald-400 tabular-nums">{selectedPlayer.games_played || 0}</span>
                                </div>
                                <div className="bg-white/5 rounded-3xl p-4 border border-white/10 shadow-inner flex flex-col items-center">
                                    <span className="text-[8px] font-black text-white/30 uppercase tracking-widest mb-1">Patente</span>
                                    <span className={`text-[10px] font-black uppercase tracking-tight py-1 px-3 rounded-full border mt-1 ${getPlayerTitle(selectedPlayer.total_xp).border} ${getPlayerTitle(selectedPlayer.total_xp).style}`}>
                                        {getPlayerTitle(selectedPlayer.total_xp).title}
                                    </span>
                                </div>
                            </div>

                            <div className="w-full text-left">
                                <div className="flex items-center justify-between mb-4">
                                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Coleção de Cards</h4>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black text-orange-500 tabular-nums">{ownedCards.length}</span>
                                        <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">/ {CARDS.filter(c => c.isReady).length}</span>
                                    </div>
                                </div>

                                {profileLoading ? (
                                    <div className="flex justify-center py-10 opacity-20">
                                        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-4 gap-2 max-h-[35vh] overflow-y-auto no-scrollbar pb-6 px-1">
                                        {CARDS.filter(c => c.isReady).map(card => {
                                            const isOwned = ownedCards.includes(card.id);
                                            const rarityColors: Record<string, string> = {
                                                'comum': 'border-blue-500/20',
                                                'raro': 'border-cyan-500/30',
                                                'épico': 'border-orange-500/40',
                                                'lendário': 'border-yellow-400/50'
                                            };

                                            return (
                                                <div
                                                    key={card.id}
                                                    className={`aspect-[2/3] rounded-xl border-2 transition-all relative overflow-hidden group ${isOwned ? `${rarityColors[card.rarity] || 'border-white/20'} bg-white/5` : 'border-white/5 bg-white/5 opacity-30 grayscale'}`}
                                                >
                                                    {/* CARD IMAGE - SEMPRE VISÍVEL MAS COM FILTRO SE BLOQUEADO */}
                                                    <div
                                                        className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110"
                                                        style={{ backgroundImage: card.image }}
                                                    />

                                                    {/* EFEITO DE LOCK SE NÃO POSSUIR */}
                                                    {!isOwned && (
                                                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
                                                            <i className="fa-solid fa-lock text-[10px] text-white/40"></i>
                                                        </div>
                                                    )}

                                                    {/* OVERLAY DE BRILHO SE POSSUIR */}
                                                    {isOwned && card.rarity !== 'comum' && (
                                                        <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 pointer-events-none"></div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        <button onClick={() => setSelectedPlayer(null)} className="w-full mt-4 bg-white text-black font-black py-4 rounded-3xl text-[10px] uppercase tracking-[0.2em] active:scale-95 transition-all shadow-2xl z-20 hover:bg-orange-500 hover:text-white">VOLTAR AO RANKING</button>
                    </div>
                </div>
            )}
        </div>
    );
};
