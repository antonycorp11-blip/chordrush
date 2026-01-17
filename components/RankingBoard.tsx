
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

    const getNameFontStyle = (cardId?: string) => {
        if (!cardId) return 'font-black';
        const card = CARDS.find(c => c.id === cardId);
        if (!card) return 'font-black';
        switch (card.rarity) {
            case 'raro': return 'font-["Press_Start_2P"] text-[10px] tracking-normal uppercase';
            case 'épico': return 'font-["Bangers"] text-2xl tracking-widest uppercase';
            case 'lendário': return 'font-["Bangers"] text-3xl tracking-[0.1em] text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.6)] uppercase';
            default: return 'font-black';
        }
    };

    return (
        <div className="w-full h-full flex flex-col bg-[#050505] overflow-hidden">
            <div className="p-6 pb-2 flex items-center justify-between z-10">
                <button onClick={onBack} className="w-12 h-12 flex items-center justify-center bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 hover:bg-white/15 active:scale-95 transition-all text-white">
                    <i className="fa-solid fa-chevron-left text-xl"></i>
                </button>
                <div className="flex flex-col items-end">
                    <h2 className="text-3xl font-black italic tracking-tighter text-white uppercase leading-none">RANKING <span className="text-orange-500">GLOBAL</span></h2>
                    <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.3em] mt-1">Status da Temporada</span>
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
                                    relative flex items-center justify-between p-6 rounded-[32px] border-2 transition-all duration-500 overflow-hidden
                                    ${isMe ? 'scale-[1.02] z-10' : 'scale-100'}
                                    ${card ? 'border-white/20' : isMe ? 'bg-orange-500/20 border-orange-500/50' : 'bg-white/5 border-white/10'}
                                `}
                                style={card ? { background: card.image } : {}}
                            >
                                {card && <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] pointer-events-none"></div>}

                                <div className="flex items-center gap-4 relative z-10">
                                    <div className="w-10 flex justify-center">
                                        {isTop3 ? <i className={`fa-solid fa-crown ${getRankingIcon(index)}`}></i> : <span className="text-white/20 font-black italic text-xl">#{index + 1}</span>}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className={`text-white truncate max-w-[160px] leading-tight ${getNameFontStyle(entry.selected_card_id)}`}> {entry.name} </span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-white/40">Nível {entry.level}</span>
                                            {isMe && <span className="text-[8px] bg-orange-500 text-white px-1.5 py-0.5 rounded font-black uppercase">Você</span>}
                                        </div>
                                    </div>
                                </div>

                                <div className="text-right relative z-10">
                                    <div className="text-2xl font-black text-white italic tracking-tighter leading-none"> {entry.score.toLocaleString()} </div>
                                    <span className="text-[8px] font-black uppercase tracking-widest text-white/30">Pontos</span>
                                </div>
                                {isMe && <div className="absolute inset-0 border-2 border-orange-500/30 rounded-[30px] animate-pulse pointer-events-none"></div>}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
