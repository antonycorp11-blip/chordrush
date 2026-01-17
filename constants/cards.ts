import { Card } from '../types';

export const CARDS: Card[] = [
    // COMUM - 5,000 XP (6 models)
    { id: 'c1', name: 'Blue Wave', rarity: 'comum', price: 5000, image: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)' },
    { id: 'c2', name: 'Green Rhythm', rarity: 'comum', price: 5000, image: 'linear-gradient(135deg, #064e3b 0%, #10b981 100%)' },
    { id: 'c3', name: 'Slate Beats', rarity: 'comum', price: 5000, image: 'linear-gradient(135deg, #334155 0%, #64748b 100%)' },
    { id: 'c4', name: 'Teal Pulse', rarity: 'comum', price: 5000, image: 'linear-gradient(135deg, #134e4a 0%, #14b8a6 100%)' },
    { id: 'c5', name: 'Indigo Groove', rarity: 'comum', price: 5000, image: 'linear-gradient(135deg, #312e81 0%, #6366f1 100%)' },
    { id: 'c6', name: 'Carbon Bass', rarity: 'comum', price: 5000, image: 'linear-gradient(135deg, #171717 0%, #404040 100%)' },

    // RARO - 10,000 XP (6 models)
    { id: 'r1', name: 'Neon Purple', rarity: 'raro', price: 10000, image: 'linear-gradient(135deg, #581c87 0%, #a855f7 100%)' },
    { id: 'r2', name: 'Electric Pink', rarity: 'raro', price: 10000, image: 'linear-gradient(135deg, #831843 0%, #ec4899 100%)' },
    { id: 'r3', name: 'Cyan Glow', rarity: 'raro', price: 10000, image: 'linear-gradient(135deg, #164e63 0%, #06b6d4 100%)' },
    { id: 'r4', name: 'Orange Flare', rarity: 'raro', price: 10000, image: 'linear-gradient(135deg, #7c2d12 0%, #f97316 100%)' },
    { id: 'r5', name: 'Emerald Spark', rarity: 'raro', price: 10000, image: 'linear-gradient(135deg, #065f46 0%, #34d399 100%)' },
    { id: 'r6', name: 'Viole Ray', rarity: 'raro', price: 10000, image: 'linear-gradient(135deg, #4c1d95 0%, #8b5cf6 100%)' },

    // ÉPICO - 30,000 XP (4 models)
    { id: 'e1', name: 'Golden Chord', rarity: 'épico', price: 30000, image: 'linear-gradient(135deg, #78350f 0%, #f59e0b 50%, #fbbf24 100%)' },
    { id: 'e2', name: 'Crimson Power', rarity: 'épico', price: 30000, image: 'linear-gradient(135deg, #7f1d1d 0%, #ef4444 50%, #f87171 100%)' },
    { id: 'e3', name: 'Deep Nebula', rarity: 'épico', price: 30000, image: 'linear-gradient(135deg, #2e1065 0%, #7c3aed 50%, #c084fc 100%)' },
    { id: 'e4', name: 'Abyssal Void', rarity: 'épico', price: 30000, image: 'linear-gradient(135deg, #09090b 0%, #27272a 50%, #52525b 100%)' },

    // LENDÁRIO - 60,000 XP (4 models as adjusted)
    { id: 'l1', name: 'Supernova', rarity: 'lendário', price: 60000, image: 'linear-gradient(135deg, #4338ca 0%, #fbbf24 50%, #ef4444 100%)' },
    { id: 'l2', name: 'Diamond Strings', rarity: 'lendário', price: 60000, image: 'linear-gradient(135deg, #0f172a 0%, #38bdf8 50%, #f8fafc 100%)' },
    { id: 'l3', name: 'Obsidian Gold', rarity: 'lendário', price: 60000, image: 'linear-gradient(135deg, #000000 0%, #78350f 50%, #fbbf24 100%)' },
    { id: 'l4', name: 'Cosmic Symphony', rarity: 'lendário', price: 60000, image: 'radial-gradient(circle at center, #1e1b4b 0%, #312e81 30%, #4338ca 60%, #6366f1 100%)' },
];
