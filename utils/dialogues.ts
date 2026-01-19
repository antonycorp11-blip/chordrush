
// Dialogues for random in-game events
// Format: Arena ID -> Array of interactions

export interface DialogueInteraction {
    id: string;
    bossLine: string;
    playerLine: string; // The "thought" or retort of the bard
}

export const ARENA_DIALOGUES: Record<number, DialogueInteraction[]> = {
    1: [ // Golem (Jungle)
        { id: '1-1', bossLine: "A pedra silencia...", playerLine: "Mas o ritmo quebra a pedra!" },
        { id: '1-2', bossLine: "Você perturba as raízes!", playerLine: "Estou apenas afinando a floresta." },
        { id: '1-3', bossLine: "Sinta o peso dos séculos.", playerLine: "Minha música é atemporal!" },
        { id: '1-4', bossLine: "Sua melodia é frágil.", playerLine: "Ela é forte como um carvalho!" },
        { id: '1-5', bossLine: "Volte ao silêncio...", playerLine: "Jamais! O show tem que continuar!" }
    ],
    2: [ // Spider (Crystal)
        { id: '2-1', bossLine: "Preso na minha teia...", playerLine: "Vou cortar esses fios com um solo!" },
        { id: '2-2', bossLine: "O cristal reflete seu medo.", playerLine: "Ele reflete minha vitória!" },
        { id: '2-3', bossLine: "Tão frágil quanto vidro.", playerLine: "Tão afiado quanto um diamante!" },
        { id: '2-4', bossLine: "Ouça os ecos da escuridão.", playerLine: "Vou iluminar tudo com meu som!" },
        { id: '2-5', bossLine: "Não há saída deste labirinto.", playerLine: "A música sempre encontra um caminho." }
    ],
    3: [ // Guard (Acordelot Gates)
        { id: '3-1', bossLine: "Ninguém entra na Cidade da Harmonia sem permissão.", playerLine: "Minha música é meu passaporte!" },
        { id: '3-2', bossLine: "A cidade está fechada por ordem do Maestro.", playerLine: "Eu vim para vê-lo, saia da frente!" },
        { id: '3-3', bossLine: "Seu ritmo é desajeitado, forasteiro.", playerLine: "Vou te ensinar um novo compasso!" },
        { id: '3-4', bossLine: "Volte para a dissonância de onde veio.", playerLine: "A verdadeira harmonia exige mudança!" },
        { id: '3-5', bossLine: "Meus escudos não vibram com suas notas.", playerLine: "Vou tocar até eles racharem!" }
    ],
    4: [ // The Last Maestro (Conservatory)
        { id: '4-1', bossLine: "Mostre-me se você entende a dor da música.", playerLine: "Eu toco a esperança, não a dor!" },
        { id: '4-2', bossLine: "Você está desafinando... de propósito?", playerLine: "Isso se chama improviso, Maestro!" },
        { id: '4-3', bossLine: "O silêncio é a única nota perfeita.", playerLine: "O silêncio é o fim, a música é a vida!" },
        { id: '4-4', bossLine: "Não me decepcione, pequeno bardo.", playerLine: "Vou te surpreender!" },
        { id: '4-5', bossLine: "Essa melodia... é nostálgica.", playerLine: "É o som do futuro!" }
    ],
    5: [ // Lord Silence (Void)
        { id: '5-1', bossLine: "Sua existência é um erro sonoro.", playerLine: "Eu sou o erro que vai consertar o mundo!" },
        { id: '5-2', bossLine: "Cale-se! O vazio exige paz.", playerLine: "Nunca! O mundo precisa de barulho!" },
        { id: '5-3', bossLine: "Eu consumi orquestras inteiras.", playerLine: "Mas não consegue engolir meu solo!" },
        { id: '5-4', bossLine: "Sinta o frio do zero absoluto.", playerLine: "Minhas mãos estão pegando fogo!" },
        { id: '5-5', bossLine: "A Grande Dissonância sou eu.", playerLine: "E eu sou o Grande Acorde Final!" }
    ]
};
