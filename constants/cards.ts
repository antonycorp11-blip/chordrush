
import { Card } from '../types';

export interface ExtendedCard extends Card {
    isReady?: boolean;
}

export const CARDS: ExtendedCard[] = [
    // COMUM - 5,000 XP
    { id: 'c1', name: 'Vintage Acoustic', rarity: 'comum', price: 5000, image: 'url(/assets/cards/c1.png)', isReady: true },
    { id: 'c2', name: 'Mystic Flute', rarity: 'comum', price: 5000, image: 'url(/assets/cards/c2.png)', isReady: true },
    { id: 'c3', name: 'Festive Tambourine', rarity: 'comum', price: 5000, image: 'url(/assets/cards/c3.png)', isReady: true },
    { id: 'c4', name: 'Space Triangle', rarity: 'comum', price: 5000, image: 'url(/assets/cards/c4.png)', isReady: true },
    { id: 'c5', name: 'Indigo Beat', rarity: 'comum', price: 5000, image: 'url(/assets/cards/c5.png)', isReady: true },
    { id: 'c6', name: 'Carbon Note', rarity: 'comum', price: 5000, image: 'url(/assets/cards/c6.png)', isReady: true },

    // RARO - 10,000 XP
    { id: 'r1', name: 'Thunder Axe', rarity: 'raro', price: 10000, image: 'url(/assets/cards/r1.png)', isReady: true },
    { id: 'r2', name: 'Neon Bass', rarity: 'raro', price: 10000, image: 'url(/assets/cards/r2.png)', isReady: true },
    { id: 'r3', name: 'Cyber Synth', rarity: 'raro', price: 10000, image: 'url(/assets/cards/r3.png)', isReady: true },
    { id: 'r4', name: 'Volt Drums', rarity: 'raro', price: 10000, image: 'url(/assets/cards/r4.png)', isReady: true },
    { id: 'r5', name: 'Sonic Mic', rarity: 'raro', price: 10000, image: 'url(/assets/cards/r5.png)', isReady: true },
    { id: 'r6', name: 'Golden Acoustic', rarity: 'raro', price: 10000, image: 'url(/assets/cards/r6.png)', isReady: true },

    // ÉPICO - 30,000 XP
    { id: 'e1', name: 'Molten Gold', rarity: 'épico', price: 30000, image: 'url(/assets/cards/e1.png)', isReady: true },
    { id: 'e2', name: 'Frostbyte Bass', rarity: 'épico', price: 30000, image: 'url(/assets/cards/e2.png)', isReady: true },
    { id: 'e3', name: 'Deep Nebula', rarity: 'épico', price: 30000, image: 'url(/assets/cards/epic.png)', isReady: false },
    { id: 'e4', name: 'Abyssal Key', rarity: 'épico', price: 30000, image: 'url(/assets/cards/epic.png)', isReady: false },

    // LENDÁRIO - 60,000 XP
    { id: 'l1', name: 'Supernova', rarity: 'lendário', price: 60000, image: 'url(/assets/cards/legendary.png)', isReady: false },
    { id: 'l2', name: 'Diamond Strings', rarity: 'lendário', price: 60000, image: 'url(/assets/cards/legendary.png)', isReady: false },
    { id: 'l3', name: 'Solar Crown', rarity: 'lendário', price: 60000, image: 'url(/assets/cards/legendary.png)', isReady: false },
    { id: 'l4', name: 'Galaxy Master', rarity: 'lendário', price: 60000, image: 'url(/assets/cards/legendary.png)', isReady: false },
];
