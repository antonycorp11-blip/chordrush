
import React from 'react';
import { supabase, getDeviceId } from '../utils/supabaseClient';
import { RankingEntry } from '../types';
import { getPlayerTitle, getNextLevelProgress } from '../utils/titles';

interface RankingBoardProps {
    onBack: () => void;
}

export const RankingBoard: React.FC<RankingBoardProps> = ({ onBack }) => {
    const [ranking, setRanking] = React.useState<RankingEntry[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [now, setNow] = React.useState(Date.now());
    const deviceId = getDeviceId();

    const fetchRanking = async () => {
        setLoading(true);
        try {
            // 1. Buscamos TODOS os scores recentes (top 500 para garantir cobertura)
            const { data: scoresData, error: sError } = await supabase
                .from('scores')
                .select('player_id, score, created_at')
                .order('score', { ascending: false })
                .limit(500);

            if (!scoresData || sError) throw sError;

            // 2. Buscamos os Top 1000 jogadores por XP para garantir que pegamos as patentes reais
            // mesmo que o XP esteja em um "perfil" diferente do score (mesmo nome)
            const { data: allPlayers, error: pError } = await supabase
                .from('players')
                .select('id, device_id, name, xp, selected_card_id')
                .order('xp', { ascending: false })
                .limit(1000);

            if (!allPlayers || pError) throw pError;

            // Criamos um mapa de XP por NOME (para consolidar jogadores que trocaram de aparelho ou resetaram)
            const nameToXPMap = new Map();
            allPlayers.forEach(p => {
                if (!p.name) return;
                const nameKey = p.name.trim().toUpperCase();
                const currentMaxXP = nameToXPMap.get(nameKey)?.xp || 0;
                if (p.xp > currentMaxXP) {
                    nameToXPMap.set(nameKey, { xp: p.xp, device_id: p.device_id, card: p.selected_card_id });
                }
            });

            // Mapa de PlayerID para objeto Player (para busca rápida via score)
            const playersById = new Map(allPlayers.map(p => [p.id, p]));

            // Agrupar dados por NOME para o Ranking Final
            const consolidatedRankingMap = new Map();

            scoresData.forEach(s => {
                const player = playersById.get(s.player_id);
                if (!player || !player.name) return;

                const nameKey = player.name.trim().toUpperCase();
                const xpData = nameToXPMap.get(nameKey) || { xp: player.xp || 0, device_id: player.device_id, card: player.selected_card_id };

                const existing = consolidatedRankingMap.get(nameKey);
                const sTime = new Date(s.created_at).getTime();

                if (!existing) {
                    consolidatedRankingMap.set(nameKey, {
                        name: player.name,
                        device_id: xpData.device_id,
                        xp: xpData.xp,
                        selected_card_id: xpData.card,
                        score: s.score,
                        lastPlayedAt: s.created_at,
                        lastPlayedTime: sTime
                    });
                } else {
                    // Update best score
                    if (s.score > existing.score) {
                        existing.score = s.score;
                    }
                    // Update last played
                    if (sTime > existing.lastPlayedTime) {
                        existing.lastPlayedAt = s.created_at;
                        existing.lastPlayedTime = sTime;
                    }
                    // Ensure we have the best XP found for this name
                    existing.xp = Math.max(existing.xp, xpData.xp);
                }
            });

            const finalRanking = Array.from(consolidatedRankingMap.values())
                .sort((a, b) => b.score - a.score)
                .slice(0, 50);

            setRanking(finalRanking as any);
        } catch (err) {
            console.error('Erro no ranking v2.0:', err);
        }
        setLoading(false);
    };

    React.useEffect(() => {
        fetchRanking();
        const timer = setInterval(() => setNow(Date.now()), 10000);

        const channel = supabase
            .channel('ranking_v2')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'scores' }, () => fetchRanking())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => fetchRanking())
            .subscribe();

        return () => {
            clearInterval(timer);
            supabase.removeChannel(channel);
        };
    }, []);

    const getTimeAgo = (dateString: string) => {
        if (!dateString) return '---';
        const past = new Date(dateString).getTime();
        const diff = Math.floor((Date.now() - past) / 1000);

        if (diff < 20) return 'Agora';
        if (diff < 60) return '1m';
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
                    <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.3em] mt-1">Status da Temporada v2.0</span>
                </div>
            </div>

            {loading && ranking.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-4">
                    <div className="w-10 h-10 border-[3px] border-orange-500/10 border-t-orange-500 rounded-full animate-spin"></div>
                    <span className="text-white/20 font-black uppercase tracking-widest text-[9px]">Sincronizando Patentes...</span>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto px-4 pt-4 pb-10 space-y-3 no-scrollbar">
                    {ranking.map((entry, index) => {
                        const isMe = entry.device_id === deviceId;
                        const playerXP = entry.xp || 0;
                        const titleInfo = getPlayerTitle(playerXP);
                        const progress = getNextLevelProgress(playerXP);

                        return (
                            <div key={`${entry.name}-${index}`} className={`relative flex items-center justify-between p-5 rounded-[28px] border-2 transition-all duration-300 ${isMe ? 'bg-neutral-800 border-orange-500 shadow-xl scale-[1.02] z-10' : 'bg-neutral-900/60 border-white/5 opacity-90'}`}>
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
                                            <span className="text-lg font-black text-white tracking-tight break-words line-clamp-1 uppercase whitespace-nowrap overflow-hidden">
                                                {entry.name}
                                            </span>
                                            {isMe && <span className="text-[8px] bg-orange-500 text-white px-1.5 py-0.5 rounded font-black uppercase tracking-tighter">VOCÊ</span>}
                                        </div>

                                        <div className="w-24 h-1 bg-white/5 rounded-full mt-2 overflow-hidden">
                                            <div className="h-full bg-orange-500 rounded-full transition-all duration-1000" style={{ width: `${progress}%` }}></div>
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
