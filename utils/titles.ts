
export const getPlayerTitle = (xp: number) => {
    if (xp >= 100000) return { title: 'Lenda do Fretboard', style: 'text-yellow-400 font-serif italic', border: 'border-yellow-400/50' };
    if (xp >= 75000) return { title: 'Mestre das Cordas', style: 'text-purple-400 font-bold tracking-tighter', border: 'border-purple-400/30' };
    if (xp >= 50000) return { title: 'Virtuoso', style: 'text-cyan-400 font-black', border: 'border-cyan-400/30' };
    if (xp >= 30000) return { title: 'Solista Profissional', style: 'text-emerald-400 font-bold', border: 'border-emerald-400/30' };
    if (xp >= 15000) return { title: 'Ritmo Avançado', style: 'text-blue-400 font-semibold', border: 'border-blue-400/20' };
    if (xp >= 5000) return { title: 'Estudante Dedicado', style: 'text-orange-400 font-medium', border: 'border-orange-400/20' };
    return { title: 'Iniciante', style: 'text-white/40 font-normal', border: 'border-white/10' };
};
