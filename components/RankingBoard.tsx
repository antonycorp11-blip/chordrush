
import React from 'react';
import { supabase, getDeviceId } from '../utils/supabaseClient';
import { RankingEntry } from '../types';
import { CARDS } from '../constants/cards';

interface RankingBoardProps {
    onBack: () => void;
}

export const RankingBoard: React.FC<RankingBoardProps> = ({ onBack }) => {
    const [ranking, setRanking] = React.useState<RankingEntry[]>([]);
    const [loading, setLoading] = React.useState(true);
    const deviceId = getDeviceId();

    React.useEffect(() => {
        const fetchRanking = async () => {
            const { data } = await supabase.from('weekly_ranking').select('*');
            if (data) setRanking(data);
            setLoading(false);
        };
        fetchRanking();
    }, []);

    const getRankingIcon = (index: number) => {
        switch (index) {
            case 0: return 'text-yellow-400 text-3xl drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]';
            case 1: return 'text-gray-300 text-2xl';
            case 2: return 'text-orange-400 text-xl';
            default: return 'text-white/20 text-sm';
        }
    };

    // Fonte Premium Limpa (Outfit) para evitar que o nome fique feio ou cortado
    const getNameFontStyle = (cardId?: string) => {
        const base = "font-black tracking-tight leading-tight";
        if (!cardId) return `${base} text-white`;

        const card = CARDS.find(c => c.id === cardId);
        if (!card) return `${base} text-white`;

        switch (card.rarity) {
            case 'lendário': return `${base} text-yellow-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]`;
            case 'épico': return `${base} text-orange-500`;
            case 'raro': return `${base} text-cyan-400`;
            default: return `${base} text-white`;
        }
    };

    return (
        <div className="w-full h-full flex flex-col bg-[#050505] overflow-hidden">
            {/* Header */}
            <div className="p-6 pb-2 flex items-center justify-between z-10">
                <button onClick={onBack} className="w-12 h-12 flex items-center justify-center bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 hover:bg-white/15 active:scale-95 transition-all text-white shadow-lg">
                    <i className="fa-solid fa-chevron-left text-xl"></i>
                </button>
                <div className="flex flex-col items-end text-right">
                    <h2 className="text-3xl font-black italic tracking-tighter text-white uppercase leading-none">RANKING <span className="text-orange-500">GLOBAL</span></h2>
                    <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.3em] mt-1 whitespace-nowrap">Status da Temporada</span>
                </div>
            </div>

            {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-4">
                    <div className="w-10 h-10 border-[3px] border-orange-500/10 border-t-orange-500 rounded-full animate-spin"></div>
                    <span className="text-white/20 font-black uppercase tracking-widest text-[9px]">Calculando Posições...</span>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto px-4 pt-4 pb-10 space-y-4 no-scrollbar">
                    {ranking.map((entry, index) => {
                        const isMe = entry.device_id === deviceId;
                        const card = CARDS.find(c => c.id === entry.selected_card_id);
                        const isTop3 = index < 3;

                        return (
                            <div
                                key={index}
                                className={`
                                    relative flex items-center justify-between p-6 rounded-[32px] border-2 transition-all duration-300 overflow-hidden
                                    ${isMe ? 'bg-neutral-800 border-orange-500 shadow-lg scale-[1.02] z-10' : 'bg-neutral-900/50 border-white/5 opacity-80'}
                                `}
                            >
                                <div className="flex items-center gap-4 relative z-10 flex-1 min-w-0">
                                    <div className="w-10 flex-shrink-0 flex justify-center">
                                        {isTop3 ? <i className={`fa-solid fa-crown ${getRankingIcon(index)}`}></i> : <span className="text-white/20 font-black italic text-xl">#{index + 1}</span>}
                                    </div>
                                    <div className="flex flex-col flex-1 min-w-0">
                                        <span className="text-xl font-black text-white tracking-tight break-words pr-2">
                                            {entry.name}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Nível {entry.level}</span>
                                            {isMe && <span className="text-[9px] bg-orange-500 text-white px-2 py-0.5 rounded-lg font-black uppercase tracking-tighter shadow-sm">Você</span>}
                                        </div>
                                    </div>
                                </div>

                                <div className="text-right relative z-10 flex-shrink-0">
                                    <div className="text-3xl font-black text-white italic tracking-tighter leading-none"> {entry.score.toLocaleString()} </div>
                                    <span className="text-[9px] font-black uppercase tracking-widest text-white/30">Pontos</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
