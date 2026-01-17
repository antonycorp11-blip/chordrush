export const getPlayerTitle = (xp: number) => {
    if (xp >= 50000) return { title: 'Lenda', style: 'text-yellow-400 font-serif italic', border: 'border-yellow-400/50 bg-yellow-400/5' };
    if (xp >= 25000) return { title: 'Mestre', style: 'text-purple-400 font-bold tracking-tighter', border: 'border-purple-400/30 bg-purple-400/5' };
    if (xp >= 10000) return { title: 'Virtuoso', style: 'text-cyan-400 font-black', border: 'border-cyan-400/30 bg-cyan-400/5' };
    if (xp >= 5000) return { title: 'Solista', style: 'text-emerald-400 font-bold', border: 'border-emerald-400/30 bg-emerald-400/5' };
    if (xp >= 2500) return { title: 'Avançado', style: 'text-blue-400 font-semibold', border: 'border-blue-400/20 bg-blue-400/5' };
    if (xp >= 1000) return { title: 'Estudante', style: 'text-orange-400 font-medium', border: 'border-orange-400/20 bg-orange-400/5' };
    return { title: 'Iniciante', style: 'text-white/40 font-normal', border: 'border-white/10 bg-white/5' };
};
