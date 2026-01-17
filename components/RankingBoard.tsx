
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
    const deviceId = getDeviceId();

    const fetchRanking = async () => {
        try {
            // 1. CALIBRAÇÃO: Pegar o score mais recente do mundo (independente de ser baixo ou alto)
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

            // 2. RANKING: Pegar os MAIORES scores (não os mais recentes)
            const { data: scoresData, error: sError } = await supabase
                .from('scores')
                .select('player_id, score, created_at')
                .order('score', { ascending: false })
                .limit(500); // Pegamos bastante para consolidar bem

            if (sError) throw sError;
            if (!scoresData || scoresData.length === 0) {
                setRanking([]);
                setLoading(false);
                return;
            }

            const playerIds = Array.from(new Set(scoresData.map(s => s.player_id)));

            const { data: playersData, error: pError } = await supabase
                .from('players')
                .select('id, device_id, name, xp, total_xp, selected_card_id')
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
                        name: player.name,
                        device_id: player.device_id,
                        xp: player.xp || 0,
                        total_xp: player.total_xp || player.xp || 0,
                        selected_card_id: player.selected_card_id,
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
                    // Atualiza o card se o player record for o mais recente
                    if (sTime >= existing.lastPlayedTime) {
                        existing.selected_card_id = player.selected_card_id;
                    }
                }
            });

            const finalRanking = Array.from(consolidatedMap.values())
                .sort((a, b) => b.bestScore - a.bestScore)
                .slice(0, 100)
                .map(item => ({
                    device_id: item.device_id,
                    name: item.name,
                    xp: item.xp,
                    total_xp: item.total_xp,
                    score: item.bestScore,
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
                    <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.3em] mt-1 italic">V3.0.0 • Lifetime Ranking</span>
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
                            <div className="flex flex-col">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500">Prêmio da Semana</span>
                                </div>
                                <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white leading-none">BARRA DE <span className="text-orange-500">CACAU SHOW</span></h3>
                                <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mt-2">1º LUGAR NO RANKING</p>
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
                                            deadline.setHours(12, 0, 0, 0); // DOMINGO 12H

                                            // Se já passou das 12h de domingo hoje, mostra o próximo domingo
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
                        const playerXP = entry.total_xp || entry.xp || 0; // Usar total_xp para a patente no ranking
                        const titleInfo = getPlayerTitle(playerXP);
                        const progress = getNextLevelProgress(playerXP);
                        // Achar o card selecionado
                        const selectedCard = CARDS.find(c => c.id === entry.selected_card_id);

                        return (
                            <div key={`${entry.name}-${index}`} className={`relative flex items-center justify-between p-5 rounded-[28px] border-2 transition-all duration-300 overflow-hidden ${isMe ? 'border-orange-500 shadow-xl scale-[1.02] z-10' : 'border-white/5'}`}>
                                {/* BACKGROUND DO CARD (Se houver) */}
                                {selectedCard ? (
                                    <>
                                        <div
                                            className="absolute inset-0 bg-cover bg-center opacity-40 grayscale-[0.2]"
                                            style={{ backgroundImage: selectedCard.image }}
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/40 to-black" />
                                    </>
                                ) : (
                                    <div className={`absolute inset-0 ${isMe ? 'bg-neutral-800' : 'bg-neutral-900/60'}`} />
                                )}

                                <div className="flex items-center gap-4 relative z-10 flex-1 min-w-0">
                                    <div className="w-8 flex-shrink-0 flex justify-center">
                                        {index < 3 ? (
                                            <i className={`fa-solid fa-crown text-2xl ${index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-300' : 'text-orange-400'}`}></i>
                                        ) : (
                                            <span className="text-white/30 font-black italic text-lg">#{index + 1}</span>
                                        )}
                                    </div>
                                    <div className="flex flex-col flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className={`px-2 py-0.5 rounded-full border text-[7px] font-black tracking-widest uppercase ${titleInfo.border} ${titleInfo.style}`}>
                                                {titleInfo.title}
                                            </div>
                                            <span className="text-[10px] font-bold text-white/20 whitespace-nowrap">• {getTimeAgo(entry.created_at)}</span>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <span className="text-lg font-black text-white tracking-tight break-words line-clamp-1 uppercase max-w-[150px]">
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
        </div>
    );
};
