
export const getPlayerTitle = (xp: number) => {
    if (xp >= 100000) return { title: 'Lenda', style: 'text-yellow-400', border: 'border-yellow-400/50 bg-yellow-400/10', nextXP: 100000 };
    if (xp >= 75000) return { title: 'Mestre', style: 'text-purple-400', border: 'border-purple-400/30 bg-purple-400/10', nextXP: 100000 };
    if (xp >= 50000) return { title: 'Virtuoso', style: 'text-cyan-400', border: 'border-cyan-400/30 bg-cyan-400/10', nextXP: 75000 };
    if (xp >= 30000) return { title: 'Solista', style: 'text-emerald-400', border: 'border-emerald-400/30 bg-emerald-400/10', nextXP: 50000 };
    if (xp >= 15000) return { title: 'Avançado', style: 'text-blue-400', border: 'border-blue-400/20 bg-blue-400/10', nextXP: 30000 };
    if (xp >= 5000) return { title: 'Estudante', style: 'text-orange-400', border: 'border-orange-400/20 bg-orange-400/10', nextXP: 15000 };
    return { title: 'Iniciante', style: 'text-white/40', border: 'border-white/10 bg-white/5', nextXP: 5000 };
};

export const getNextLevelProgress = (xp: number) => {
    const title = getPlayerTitle(xp);
    if (xp >= 100000) return 100;

    // Calcula o XP base da patente atual
    let currentBaseXP = 0;
    if (xp >= 75000) currentBaseXP = 75000;
    else if (xp >= 50000) currentBaseXP = 50000;
    else if (xp >= 30000) currentBaseXP = 30000;
    else if (xp >= 15000) currentBaseXP = 15000;
    else if (xp >= 5000) currentBaseXP = 5000;
    else currentBaseXP = 0;

    const needed = title.nextXP - currentBaseXP;
    const progress = xp - currentBaseXP;
    return Math.min(Math.floor((progress / needed) * 100), 100);
};
