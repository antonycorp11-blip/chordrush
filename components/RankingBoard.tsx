
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

    const getMedalColor = (index: number) => {
        switch (index) {
            case 0: return 'text-yellow-400';
            case 1: return 'text-gray-300';
            case 2: return 'text-amber-600';
            default: return 'text-white/50';
        }
    };

    return (
        <div className="w-full h-full flex flex-col items-center p-6 bg-neutral-900 overflow-hidden">
            <div className="w-full max-w-md flex flex-col h-full">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <button
                        onClick={onBack}
                        className="w-10 h-10 flex items-center justify-center bg-white/10 rounded-full hover:bg-white/20 active:scale-95 transition-all text-white"
                    >
                        <i className="fa-solid fa-arrow-left"></i>
                    </button>
                    <div className="flex flex-col items-end">
                        <h2 className="text-2xl font-black italic tracking-tighter text-white">
                            RANKING <span className="text-orange-500">SEMANAL</span>
                        </h2>
                        <span className="text-[10px] text-white/30 uppercase font-bold tracking-widest">
                            Reseta todo Domingo
                        </span>
                    </div>
                </div>

                {/* Loading State */}
                {loading && (
                    <div className="flex-1 flex items-center justify-center">
                        <i className="fa-solid fa-circle-notch fa-spin text-4xl text-orange-500"></i>
                    </div>
                )}

                {/* List */}
                {!loading && (
                    <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-hide">
                        {ranking.length === 0 ? (
                            <div className="text-center text-white/30 py-10 font-bold uppercase tracking-widest">
                                Seja o primeiro da semana!
                            </div>
                        ) : (
                            ranking.map((entry, index) => {
                                const isMe = entry.device_id === myDeviceId;
                                return (
                                    <div
                                        key={index}
                                        className={`
                      relative flex items-center justify-between p-4 rounded-xl border transition-all
                      ${isMe
                                                ? 'bg-orange-500/20 border-orange-500/50 shadow-[0_0_20px_rgba(249,115,22,0.2)] scale-[1.02] z-10'
                                                : 'bg-white/5 border-white/5 hover:bg-white/10'
                                            }
                    `}
                                    >
                                        <div className="flex items-center gap-4">
                                            <span className={`text-2xl font-black w-8 text-center ${getMedalColor(index)}`}>
                                                {index + 1}
                                            </span>
                                            <div className="flex flex-col">
                                                <span className={`font-black text-lg ${isMe ? 'text-white' : 'text-white/80'} uppercase tracking-tight`}>
                                                    {entry.name}
                                                </span>
                                                <span className="text-[10px] text-white/30 font-bold uppercase tracking-widest">
                                                    Nível {entry.level}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="text-right">
                                            <span className={`block text-xl font-black ${isMe ? 'text-orange-400' : 'text-white'} tabular-nums`}>
                                                {entry.score}
                                            </span>
                                            <span className="text-[8px] text-white/20 uppercase font-black tracking-widest block">
                                                Pontos
                                            </span>
                                        </div>

                                        {isMe && (
                                            <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-8 bg-orange-500 rounded-full"></div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
