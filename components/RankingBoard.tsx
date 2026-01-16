
import React, { useEffect, useState } from 'react';
import { supabase, getDeviceId } from '../utils/supabaseClient';
import { RankingEntry } from '../types';

interface RankingBoardProps {
    onBack: () => void;
}

export const RankingBoard: React.FC<RankingBoardProps> = ({ onBack }) => {
    const [ranking, setRanking] = useState<RankingEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const myDeviceId = getDeviceId();

    useEffect(() => {
        fetchRanking();
    }, []);

    const fetchRanking = async () => {
        try {
            const { data, error } = await supabase
                .from('weekly_ranking')
                .select('*')
                .limit(50);

            if (error) {
                console.error('Error fetching ranking:', error);
            } else {
                setRanking(data || []);
            }
        } catch (err) {
            console.error('Unexpected error:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full h-full flex flex-col items-center bg-neutral-900 overflow-hidden relative">
            {/* Background Glows */}
            <div className="absolute top-[-10%] right-[-10%] w-[300px] h-[300px] bg-orange-600/20 blur-[120px] rounded-full pointer-events-none"></div>
            <div className="absolute bottom-[-10%] left-[-10%] w-[300px] h-[300px] bg-yellow-600/10 blur-[120px] rounded-full pointer-events-none"></div>

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
                            HALL OF <span className="text-orange-500 underline decoration-4 underline-offset-4">FAME</span>
                        </h2>
                        <span className="text-[10px] text-orange-500/60 uppercase font-black tracking-[0.3em] mt-2">
                            Weekly Tournament
                        </span>
                    </div>
                </div>

                {/* Loading State */}
                {loading && (
                    <div className="flex-1 flex flex-col items-center justify-center gap-4">
                        <div className="w-12 h-12 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin"></div>
                        <span className="text-white/20 font-black uppercase tracking-widest text-xs">Syncing Scores...</span>
                    </div>
                )}

                {/* List */}
                {!loading && (
                    <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-hide py-2">
                        {ranking.length === 0 ? (
                            <div className="text-center text-white/20 py-20 bg-white/5 rounded-3xl border border-dashed border-white/10">
                                <i className="fa-solid fa-ghost text-4xl mb-4 opacity-50"></i>
                                <p className="font-black uppercase tracking-widest text-sm">No legends yet...</p>
                            </div>
                        ) : (
                            ranking.map((entry, index) => {
                                const isMe = entry.device_id === myDeviceId;
                                const isTop3 = index < 3;

                                return (
                                    <div
                                        key={index}
                                        className={`
                      group relative flex items-center justify-between p-5 rounded-3xl border transition-all duration-300
                      ${isMe
                                                ? 'bg-gradient-to-br from-orange-600/30 to-orange-900/40 border-orange-500/50 shadow-[0_0_30px_rgba(249,115,22,0.3)] scale-[1.03] z-10'
                                                : isTop3
                                                    ? 'bg-white/10 border-white/10 hover:border-white/20 hover:bg-white/15'
                                                    : 'bg-white/5 border-transparent hover:bg-white/10'
                                            }
                    `}
                                    >
                                        <div className="flex items-center gap-5">
                                            <div className="relative">
                                                <div className={`
                          w-12 h-12 flex items-center justify-center rounded-2xl font-black text-xl shadow-inner
                          ${index === 0 ? 'bg-gradient-to-br from-yellow-300 to-yellow-600 text-yellow-950 scale-110 shadow-yellow-400/50' :
                                                        index === 1 ? 'bg-gradient-to-br from-gray-200 to-gray-500 text-gray-950' :
                                                            index === 2 ? 'bg-gradient-to-br from-amber-600 to-amber-800 text-amber-100' :
                                                                'bg-black/40 text-white/40 border border-white/5'}
                        `}>
                                                    {index + 1}
                                                </div>
                                                {index === 0 && (
                                                    <i className="fa-solid fa-crown absolute -top-3 -right-3 text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)] rotate-12 text-xl"></i>
                                                )}
                                            </div>

                                            <div className="flex flex-col">
                                                <span className={`font-black text-xl tracking-tight uppercase ${isMe ? 'text-white' : 'text-white/90'}`}>
                                                    {entry.name}
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    <div className="px-2 py-0.5 bg-orange-500/20 rounded-md">
                                                        <span className="text-[9px] text-orange-400 font-black uppercase tracking-widest">
                                                            Nível {entry.level}
                                                        </span>
                                                    </div>
                                                    {isMe && <span className="text-[9px] text-white/40 font-black uppercase italic">Você</span>}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="text-right">
                                            <div className="flex flex-col items-end">
                                                <span className={`text-3xl font-black leading-none ${isMe ? 'text-orange-400' : index === 0 ? 'text-yellow-400' : 'text-white'} tabular-nums`}>
                                                    {entry.score}
                                                </span>
                                                <span className="text-[9px] text-white/30 uppercase font-black tracking-widest mt-1">
                                                    Points
                                                </span>
                                            </div>
                                        </div>

                                        {isMe && (
                                            <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-12 bg-orange-500 rounded-full blur-[2px]"></div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}

                {/* Footer Info */}
                <div className="mt-4 p-4 bg-white/5 rounded-2xl border border-white/5 text-center flex items-center justify-center gap-3">
                    <i className="fa-solid fa-circle-info text-orange-500/50"></i>
                    <span className="text-[10px] text-white/40 font-bold uppercase tracking-[0.1em]">
                        Ranking reseta automaticamente todo domingo
                    </span>
                </div>
            </div>
        </div>
    );
};
