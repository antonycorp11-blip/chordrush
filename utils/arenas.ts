
export interface ArenaConfig {
    id: number;
    name: string;
    minXP: number;
    bgImage: string;
    bgm: string; // Background Music Path
    boss: {
        name: string;
        image: string;
        phrases: {
            intro: string[];
            damage: string[];
            error: string[];
        };
    };
    colors: {
        primary: string;    // Barra de Vida/Ações Principais
        secondary: string;  // Backgrounds de painéis
        accent: string;     // Destaques (Ouro/Fogo)
        background: string;
        button: string;     // Estilo do botão de nota
        buttonText: string;
        text: string;
        border: string;     // Molduras
    };
}

export const ARENAS: ArenaConfig[] = [
    {
        id: 1,
        name: 'Arena I: Selva dos Ecos',
        minXP: 0,
        bgImage: '/assets/arenas/arena_1_bg_mystic_forest.png',
        bgm: '/assets/audio/battle_theme.mp3',
        boss: {
            name: 'Golem de Runas',
            image: '/assets/arenas/boss_1_golem.png',
            phrases: {
                intro: [
                    "Quem ousa perturbar o silêncio da Floresta?",
                    "A harmonia da natureza é meu escudo!",
                    "Sinta o peso de mil anos de música sagrada!",
                    "Apenas o mestre do som pode atravessar as rochas.",
                    "Minhas raízes são profundas... e você?",
                ],
                damage: [
                    "Rochas... quebrando!",
                    "Essa nota vibrou na minha alma...",
                    "A natureza estremece!",
                    "Arggh! Harmonia forte...",
                ],
                error: [
                    "Desafinado! A floresta te rejeita.",
                    "Suas notas não movem pedras.",
                    "Silêncio, intruso!",
                    "Seu ritmo é fraco como graveto.",
                ]
            }
        },
        colors: {
            primary: 'from-emerald-700 to-green-900',
            secondary: 'bg-green-950/70',
            accent: 'text-green-300',
            background: 'bg-[#041a0f]',
            button: 'bg-green-900 border-green-700 text-green-100 shadow-[0_4px_0_#064e3b]',
            buttonText: 'text-green-100',
            text: 'text-green-50',
            border: 'border-green-800/50'
        }
    },
    {
        id: 2,
        name: 'Arena II: Cavernas de Cristal',
        minXP: 10000,
        bgImage: '/assets/arenas/arena_2_crystal_cave.png',
        bgm: '/assets/audio/arena_2_theme.mp3',
        boss: {
            name: 'Aracna de Cristal',
            image: '/assets/arenas/boss_2_crystal_spider.png',
            phrases: {
                intro: [
                    "Bem-vindo à minha teia de reflexos...",
                    "Cada eco aqui é uma armadilha.",
                    "Seu som será devorado pela escuridão.",
                    "Tente não se perder nos espelhos...",
                    "A frequência certa quebra o cristal, sabia?",
                ],
                damage: [
                    "Hiss! Meu casco rachou!",
                    "Brilho... intenso demais!",
                    "Essa frequência dói!",
                    "Você cortou minha teia!",
                ],
                error: [
                    "Preso na teia da dissonância!",
                    "Sua música é frágil como vidro.",
                    "Errou... agora você é meu.",
                    "Reflexos tortos, notas tortas.",
                ]
            }
        },
        colors: {
            primary: 'from-purple-600 to-indigo-900',
            secondary: 'bg-indigo-950/70',
            accent: 'text-purple-300',
            background: 'bg-[#0f0518]',
            button: 'bg-indigo-900 border-indigo-700 text-indigo-100 shadow-[0_4px_0_#312e81]',
            buttonText: 'text-indigo-100',
            text: 'text-purple-50',
            border: 'border-purple-800/50'
        }
    },
    {
        id: 3,
        name: 'Arena III: Portões Dourados',
        minXP: 35000,
        bgImage: '/assets/arenas/arena_3_ruins.png',
        bgm: '/assets/audio/arena_3_theme.mp3',
        boss: {
            name: 'Guarda dos Portões',
            image: '/assets/arenas/boss_3.png',
            phrases: {
                intro: [
                    "Ninguém entra em Acordelot sem permissão!",
                    "Atrás de mim está a cidade da música eterna.",
                    "A lei é absoluta: só a música perfeita passa.",
                    "Minha alabarda julgará seu compasso.",
                    "Afaste-se dos portões, forasteiro!",
                ],
                damage: [
                    "Minha armadura... amassada?!",
                    "Gah! Um acorde digno da realeza...",
                    "Você tem força, admito.",
                    "Os portões... vibraram?!",
                ],
                error: [
                    "Permissão negada!",
                    "Fora do tom, fora da cidade.",
                    "Isso é ruído, não música!",
                    "Volte para a periferia!",
                ]
            }
        },
        colors: {
            primary: 'from-amber-600 to-yellow-800',
            secondary: 'bg-stone-900/60',
            accent: 'text-amber-400',
            background: 'bg-[#1a150b]',
            button: 'bg-amber-950 border-amber-700 text-amber-100 shadow-[0_4px_0_#78350f]',
            buttonText: 'text-amber-100',
            text: 'text-amber-50',
            border: 'border-amber-700/50'
        }
    },
    {
        id: 4,
        name: 'Arena IV: O Conservatório Silencioso',
        minXP: 75000,
        bgImage: '/assets/arenas/arena_4_conservatory.png',
        bgm: '/assets/audio/arena_4_theme.mp3',
        boss: {
            name: 'O Último Maestro',
            image: '/assets/arenas/boss_4_maestro.png',
            phrases: {
                intro: [
                    "Bem-vindo, meu jovem. Vamos começar a aula?",
                    "Mostre-me se você é capaz de salvar a música.",
                    "Não retenha nada. Quero ver todo o seu potencial.",
                    "A música exige sacrifício. Você está pronto?",
                    "Um verdadeiro virtuoso nunca falha no tempo.",
                ],
                damage: [
                    "Exlêndido! Ma-ra-vi-lho-so!",
                    "Isso! Sinta a música fluir!",
                    "Sim... é desse poder que eu preciso...",
                    "Bravo! Mais, eu quero mais!",
                ],
                error: [
                    "Não, não, não! De novo!",
                    "Falta emoção, falta alma!",
                    "Você me desaponta, criança.",
                    "Assim você nunca restaurará o mundo.",
                ]
            }
        },
        colors: {
            primary: 'from-blue-600 to-sky-900',
            secondary: 'bg-slate-900/80',
            accent: 'text-sky-300',
            background: 'bg-[#0b101a]',
            button: 'bg-sky-950 border-sky-700 text-sky-100 shadow-[0_4px_0_#0369a1]',
            buttonText: 'text-sky-100',
            text: 'text-sky-50',
            border: 'border-sky-700/50'
        }
    },
    {
        id: 5,
        name: 'A Revelação: Lorde Silêncio',
        minXP: 150000,
        bgImage: '/assets/arenas/arena_5_dimension.png',
        bgm: '/assets/audio/arena_5_theme.mp3',
        boss: {
            name: 'Lorde Silêncio',
            image: '/assets/arenas/boss_5_lord_silence.png',
            phrases: {
                intro: [
                    "Tolo! Eu SOU o fim da música!",
                    "O Golem, a Aranha... meros brinquedos meus.",
                    "Eu drenei este mundo para criar meu silêncio perfeito.",
                    "Sua 'esperança' era minha marionete o tempo todo.",
                    "Agora, entregue-me a última nota!",
                ],
                damage: [
                    "ARGH! Essa luz... queima a escuridão!",
                    "Como você ousa tocar tão alto?!",
                    "Meus ouvidos! Pare com essa harmonia!",
                    "O vazio... está recuando?!",
                ],
                error: [
                    "Isso... deixe o som morrer...",
                    "Sim, abrace o silêncio eterno.",
                    "Sua música não tem poder aqui.",
                    "Shhh... durma para sempre.",
                ]
            }
        },
        colors: {
            primary: 'from-gray-900 to-black',
            secondary: 'bg-black/80',
            accent: 'text-purple-500',
            background: 'bg-[#050505]',
            button: 'bg-gray-950 border-gray-800 text-purple-500 shadow-[0_4px_0_#581c87]',
            buttonText: 'text-purple-200',
            text: 'text-gray-300',
            border: 'border-purple-900/40'
        }
    }
];

export const getCurrentArena = (xp: number): ArenaConfig => {
    return [...ARENAS].reverse().find(arena => xp >= arena.minXP) || ARENAS[0];
};
