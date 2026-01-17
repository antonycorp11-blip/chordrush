
import { Card } from '../types';

// Usaremos patterns puramente CSS de alta qualidade (Gradients + Repeating Designs)
// Isso evita que links externos quebrem o visual e garante performance.
export const CARDS: Card[] = [
    // COMUM - 5,000 XP
    {
        id: 'c1', name: 'Blue Rhythm', rarity: 'comum', price: 0,
        image: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)'
    },
    {
        id: 'c2', name: 'Emerald Deck', rarity: 'comum', price: 0,
        image: 'linear-gradient(135deg, #064e3b 0%, #10b981 100%)'
    },
    {
        id: 'c3', name: 'Slate Echo', rarity: 'comum', price: 0,
        image: 'linear-gradient(135deg, #334155 0%, #64748b 100%)'
    },
    {
        id: 'c4', name: 'Teal Pulse', rarity: 'comum', price: 0,
        image: 'linear-gradient(135deg, #134e4a 0%, #14b8a6 100%)'
    },
    {
        id: 'c5', name: 'Indigo Beat', rarity: 'comum', price: 0,
        image: 'linear-gradient(135deg, #312e81 0%, #6366f1 100%)'
    },
    {
        id: 'c6', name: 'Carbon Note', rarity: 'comum', price: 0,
        image: 'linear-gradient(135deg, #171717 0%, #404040 100%)'
    },

    // RARO - 10,000 XP (Neon Styles)
    {
        id: 'r1', name: 'Neon Purple', rarity: 'raro', price: 0,
        image: 'repeating-linear-gradient(45deg, #581c87, #581c87 10px, #6b21a8 10px, #6b21a8 20px)'
    },
    {
        id: 'r2', name: 'Electric Pink', rarity: 'raro', price: 0,
        image: 'linear-gradient(to right, #831843, #db2777, #831843)'
    },
    {
        id: 'r3', name: 'Cyber Cyan', rarity: 'raro', price: 0,
        image: 'linear-gradient(135deg, #164e63 0%, #0891b2 50%, #164e63 100%)'
    },
    {
        id: 'r4', name: 'Vulcan Flare', rarity: 'raro', price: 0,
        image: 'linear-gradient(45deg, #7c2d12, #ea580c)'
    },
    {
        id: 'r5', name: 'Acid Green', rarity: 'raro', price: 0,
        image: 'linear-gradient(to bottom, #064e3b, #10b981, #064e3b)'
    },
    {
        id: 'r6', name: 'Vortex Violet', rarity: 'raro', price: 0,
        image: 'radial-gradient(circle, #4c1d95, #1e1b4b)'
    },

    // ÉPICO - 30,000 XP
    {
        id: 'e1', name: 'Molten Gold', rarity: 'épico', price: 0,
        image: 'linear-gradient(135deg, #78350f 0%, #fbbf24 50%, #78350f 100%)'
    },
    {
        id: 'e2', name: 'Crimson Storm', rarity: 'épico', price: 0,
        image: 'linear-gradient(to top, #7f1d1d, #ef4444, #7f1d1d)'
    },
    {
        id: 'e3', name: 'Deep Nebula', rarity: 'épico', price: 0,
        image: 'radial-gradient(ellipse at center, #2e1065 0%, #000000 100%)'
    },
    {
        id: 'e4', name: 'Abyssal Key', rarity: 'épico', price: 0,
        image: 'linear-gradient(45deg, #0f172a, #334155, #0f172a)'
    },

    // LENDÁRIO - 60,000 XP
    {
        id: 'l1', name: 'Supernova', rarity: 'lendário', price: 0,
        image: 'linear-gradient(135deg, #ef4444, #f59e0b, #3b82f6, #8b5cf6, #ef4444)'
    },
    {
        id: 'l2', name: 'Diamond Strings', rarity: 'lendário', price: 0,
        image: 'linear-gradient(to bottom, #0f172a, #38bdf8, #f8fafc, #38bdf8, #0f172a)'
    },
    {
        id: 'l3', name: 'Solar Crown', rarity: 'lendário', price: 0,
        image: 'radial-gradient(circle, #fbbf24 0%, #78350f 70%, #000000 100%)'
    },
    {
        id: 'l4', name: 'Galaxy Master', rarity: 'lendário', price: 0,
        image: 'repeating-linear-gradient(-45deg, #000 0, #000 20px, #1e1b4b 20px, #1e1b4b 40px)'
    },
];
