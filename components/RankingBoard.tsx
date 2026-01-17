
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
        // Primeiro, pegamos todos os jogadores e seus XPs
        const { data: playersData } = await supabase
            .from('players')
            .select('device_id, name, xp, id, selected_card_id');

        // Depois pegamos o melhor score de cada um
        const { data: scoresData } = await supabase
            .from('scores')
            .select('player_id, score, created_at, level')
            .order('score', { ascending: false });

        if (playersData && scoresData) {
            // Criar mapa do melhor score por player
            const bestScores = new Map();
            scoresData.forEach(s => {
                if (!bestScores.has(s.player_id)) {
                    bestScores.set(s.player_id, s);
                }
            });

            const formatted = playersData
                .map(p => {
                    const best = bestScores.get(p.id);
                    if (!best) return null;
                    return {
                        device_id: p.device_id,
                        name: p.name,
                        xp: p.xp || 0,
                        selected_card_id: p.selected_card_id,
                        score: best.score,
                        created_at: best.created_at,
                        level: best.level
                    };
                })
                .filter(Boolean)
                .sort((a, b) => (b?.score || 0) - (a?.score || 0))
                .slice(0, 50);

            setRanking(formatted as any);
        }
        setLoading(false);
    };

    React.useEffect(() => {
        fetchRanking();
        const timer = setInterval(() => setNow(Date.now()), 10000);

        const channel = supabase
            .channel('ranking_live')
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
        const diff = Math.floor((now - past) / 1000);

        if (diff < 60) return 'Agora';
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
                    <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.3em] mt-1">Status da Temporada</span>
                </div>
            </div>

            {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-4">
                    <div className="w-10 h-10 border-[3px] border-orange-500/10 border-t-orange-500 rounded-full animate-spin"></div>
                    <span className="text-white/20 font-black uppercase tracking-widest text-[9px]">Calculando...</span>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto px-4 pt-4 pb-10 space-y-3 no-scrollbar">
                    {ranking.map((entry, index) => {
                        const isMe = entry.device_id === deviceId;
                        const playerXP = entry.xp || 0;
                        const titleInfo = getPlayerTitle(playerXP);
                        const progress = getNextLevelProgress(playerXP);

                        return (
                            <div key={index} className={`relative flex items-center justify-between p-5 rounded-[28px] border-2 transition-all duration-300 ${isMe ? 'bg-neutral-800 border-orange-500 shadow-xl scale-[1.02] z-10' : 'bg-neutral-900/60 border-white/5 opacity-90'}`}>
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
                                            <span className="text-lg font-black text-white tracking-tight break-words line-clamp-1 uppercase">
                                                {entry.name}
                                            </span>
                                            {isMe && <span className="text-[8px] bg-orange-500 text-white px-1.5 py-0.5 rounded font-black uppercase tracking-tighter">VOCÊ</span>}
                                        </div>

                                        {/* Barra de Progresso da Patente */}
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
