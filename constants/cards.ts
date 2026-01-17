
import { Card } from '../types';

// Usaremos backgrounds gerados via CSS/Inline SVG para garantir estilo gamificado sem depender de links externos instáveis
export const CARDS: Card[] = [
    // COMUM - Pixel Art / 8-Bit (0 XP para teste)
    { id: 'c1', name: 'Retro Ocean', rarity: 'comum', price: 0, image: 'linear-gradient(45deg, #1e3a8a 25%, #1e40af 25%, #1e40af 50%, #1e3a8a 50%, #1e3a8a 75%, #1e40af 75%, #1e40af 100%)' },
    { id: 'c2', name: 'Forest Bit', rarity: 'comum', price: 0, image: 'linear-gradient(to bottom, #065f46, #059669)' },
    { id: 'c3', name: 'Classic Slate', rarity: 'comum', price: 0, image: 'repeating-linear-gradient(45deg, #331133 0, #331133 10%, #442244 10%, #442244 20%)' },
    { id: 'c4', name: 'Teal Block', rarity: 'comum', price: 0, image: 'linear-gradient(90deg, #134e4a 0%, #115e59 50%, #134e4a 100%)' },
    { id: 'c5', name: 'Indigo Byte', rarity: 'comum', price: 0, image: 'linear-gradient(135deg, #312e81, #4338ca)' },
    { id: 'c6', name: 'Mono Bass', rarity: 'comum', price: 0, image: 'linear-gradient(to right, #171717, #262626)' },

    // RARO - Neon Synthwave
    { id: 'r1', name: 'Cyber Guitar', rarity: 'raro', price: 0, image: 'radial-gradient(circle at center, #581c87, #000000)' },
    { id: 'r2', name: 'Pink Laser', rarity: 'raro', price: 0, image: 'linear-gradient(to top, #831843, #db2777)' },
    { id: 'r3', name: 'Cyan Grid', rarity: 'raro', price: 0, image: 'linear-gradient(0deg, transparent 24%, rgba(6, 182, 212, .3) 25%, rgba(6, 182, 212, .3) 26%, transparent 27%, transparent 74%, rgba(6, 182, 212, .3) 75%, rgba(6, 182, 212, .3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(6, 182, 212, .3) 25%, rgba(6, 182, 212, .3) 26%, transparent 27%, transparent 74%, rgba(6, 182, 212, .3) 75%, rgba(6, 182, 212, .3) 76%, transparent 77%, transparent), #083344' },
    { id: 'r4', name: 'Neon Sunset', rarity: 'raro', price: 0, image: 'linear-gradient(to bottom, #f97316, #7c2d12, #000000)' },
    { id: 'r5', name: 'Toxic Bit', rarity: 'raro', price: 0, image: 'linear-gradient(45deg, #064e3b, #10b981)' },
    { id: 'r6', name: 'Electric Ray', rarity: 'raro', price: 0, image: 'linear-gradient(135deg, #4c1d95, #7c3aed)' },

    // ÉPICO - Animated Power
    { id: 'e1', name: 'Inferno Piano', rarity: 'épico', price: 0, image: 'linear-gradient(to top, #450a0a, #991b1b, #ef4444)' },
    { id: 'e2', name: 'Volt Strings', rarity: 'épico', price: 0, image: 'linear-gradient(to bottom, #0f172a, #1d4ed8, #60a5fa)' },
    { id: 'e3', name: 'Nebula Bass', rarity: 'épico', price: 0, image: 'radial-gradient(circle, #2e1065, #1e1b4b, #000000)' },
    { id: 'e4', name: 'Starlight', rarity: 'épico', price: 0, image: 'linear-gradient(to bottom, #111827, #374151)' },

    // LENDÁRIO - Cosmic / Divine
    { id: 'l1', name: 'Solar Flare', rarity: 'lendário', price: 0, image: 'linear-gradient(45deg, #78350f, #d97706, #fbbf24, #d97706, #78350f)' },
    { id: 'l2', name: 'Cosmic Harp', rarity: 'lendário', price: 0, image: 'radial-gradient(circle at 30% 30%, #4338ca, #1e1b4b, #000000)' },
    { id: 'l3', name: 'Godly Ax', rarity: 'lendário', price: 0, image: 'linear-gradient(135deg, #000000 0%, #333333 50%, #000000 100%)' },
    { id: 'l4', name: 'Galaxy Beats', rarity: 'lendário', price: 0, image: 'radial-gradient(ellipse at bottom, #1B2735 0%, #090A0F 100%)' },
];
