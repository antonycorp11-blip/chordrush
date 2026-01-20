
import React, { useState, useEffect } from 'react';
import { ARENAS } from '../utils/arenas';

interface StoryModalProps {
    arenaId: number;
    onClose: () => void;
}

const STORIES: Record<number, { title: string; text: string[]; color: string }> = {
    1: {
        title: "O Silêncio da Floresta",
        color: "text-emerald-400",
        text: [
            "Há séculos, a música foi banida deste mundo. A Grande Dissonância roubou a melodia dos corações e silenciou os instrumentos.",
            "Você, um jovem bardo com a última Palheta Encantada, ousa entrar na lendária **Selva dos Ecos**.",
            "Dizem que a primeira nota da Sinfonia Perdida está escondida aqui, protegida por raízes que nunca dormem.",
            "Mas cuidado... O **Golem de Runas** despertou. E ele não aceita erros."
        ]
    },
    2: {
        title: "As Profundezas de Cristal",
        color: "text-purple-400",
        text: [
            "O Golem ruiu. Suas pedras revelaram uma fenda brilhante no chão da floresta.",
            "As raízes mergulham fundo na terra, pulsando com uma luz violeta e um zumbido grave que você sente nos ossos.",
            "Para restaurar o Grande Baixo, você deve descer às trevas.",
            "Bem-vindo às **Cavernas de Cristal**. Aqui, cada reflexo esconde um pesadelo..."
        ]
    },
    3: {
        title: "Os Portões de Acordelot",
        color: "text-amber-500",
        text: [
            "A jornada o levou aos limites do mundo conhecido. Diante de você, muralhas brancas tocam o céu.",
            "Esta é **Acordelot**, a cidade lendária onde vive o Último Maestro. Ele é a única esperança para restaurar a música no mundo.",
            "Mas os portões estão trancados. Um **Guarda Real** barra seu caminho com uma alabarda de bronze.",
            "Ele não entende sua canção. Para entrar, você terá que provar que sua melodia é digna."
        ]
    },
    4: {
        title: "O Conservatório Silencioso",
        color: "text-sky-400",
        text: [
            "Acordelot não é o que parecia. A cidade está em ruínas, e o silêncio reina absoluto entre os escombros.",
            "No centro de tudo, o antigo Conservatório ainda está de pé. Dentro dele, uma figura solitária rege uma orquestra fantasma.",
            "É o **Último Maestro**, o guardião final da música. Ele diz que estava esperando por você para um teste final.",
            "'Mostre-me sua harmonia', ele exige. Mas há uma tristeza em seus olhos... e uma escuridão que você não consegue explicar."
        ]
    },
    5: {
        title: "A Revelação do Silêncio",
        color: "text-purple-500",
        text: [
            "O Maestro cai de joelhos... mas sua risada ecoa fria.",
            "A ilusão do Conservatório se desfaz, revelando uma dimensão de puro vazio e caos.",
            "Diante de você, não está mais o velho professor, mas sim **Lorde Silêncio**, a entidade que devorou a música do mundo.",
            "'Eu criei o Golem. Eu teci a Aranha. E agora, vou tomar sua alma!'",
            "Prepare-se. Esta é a batalha final pela harmonia!"
        ]
    },
    6: {
        title: "A Ascensão do Silêncio",
        color: "text-red-500",
        text: [
            "A batalha foi intensa, mas o poder do Lorde Silêncio era vasto demais. Com um golpe final de dissonância, ele partiu sua última corda.",
            "Lorde Silêncio ri enquanto desaparece nas sombras: 'Este mundo agora me pertence. A música é apenas uma memória moribunda'.",
            "Ele fugiu após a vitória, e agora o Silêncio Absoluto tomou conta de cada rua e torre da outrora vibrante Acordelot.",
            "Mas nem tudo está perdido. Você sobreviveu, e enquanto houver um sopro de ritmo em seu peito, a esperança resiste.",
            "A história irá continuar... Agora, você deve seguir treinando e aprimorando sua técnica. A verdadeira batalha final ainda está por vir!"
        ]
    }
};

export const StoryModal: React.FC<StoryModalProps> = ({ arenaId, onClose }) => {
    const [step, setStep] = useState(0);
    const story = STORIES[arenaId];
    const arena = ARENAS.find(a => a.id === arenaId);

    if (!story) {
        onClose();
        return null;
    }

    const currentText = story.text[step];
    const isLast = step === story.text.length - 1;

    // Process bold text markdown
    const renderText = (text: string) => {
        const parts = text.split(/(\*\*.*?\*\*)/g);
        return parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <span key={i} className={`${story.color} font-black not-italic`}>{part.slice(2, -2)}</span>;
            }
            return part;
        });
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-500 p-4 sm:p-6 overflow-hidden">
            {/* Imagem de Fundo (Blurzada e Escurecida) */}
            {arena && (
                <div
                    className="absolute inset-0 z-0 opacity-20 bg-cover bg-center transition-all duration-1000 scale-110"
                    style={{ backgroundImage: `url(${arena.bgImage})` }}
                />
            )}

            <div className="w-full max-w-lg sm:max-w-2xl bg-[#0a0a0a] border border-white/10 rounded-[24px] sm:rounded-[40px] relative shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col ring-1 ring-white/5 max-h-[90vh] overflow-hidden mx-auto">

                {/* Header Decorativo */}
                <div className="absolute top-0 left-0 w-full h-20 bg-gradient-to-b from-black/80 to-transparent pointer-events-none z-10" />
                <div className={`absolute top-0 right-0 p-4 z-20 opacity-20`}>
                    <i className={`fa-solid fa-quote-right text-6xl sm:text-8xl ${story.color}`}></i>
                </div>

                {/* Conteúdo - Adicionado overflow-y-auto para telas pequenas */}
                <div className="relative z-30 p-6 sm:p-12 flex flex-col h-full overflow-y-auto custom-scrollbar">

                    <div className="mb-6 sm:mb-auto">
                        <div className="flex items-center gap-3 mb-4 sm:mb-6">
                            <span className={`px-2 sm:px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[8px] sm:text-[10px] font-black uppercase tracking-[0.2em] ${story.color}`}>
                                Capítulo {arenaId}
                            </span>
                            <div className="h-[1px] flex-1 bg-gradient-to-r from-white/10 to-transparent"></div>
                        </div>

                        <h2 className="text-2xl sm:text-5xl font-black italic text-white uppercase tracking-tighter leading-[0.9] mb-4 sm:mb-8 drop-shadow-lg">
                            {story.title}
                        </h2>

                        <div className="min-h-[80px] sm:min-h-[140px]">
                            <p key={step} className="text-base sm:text-2xl text-white/80 font-serif leading-relaxed animate-in fade-in slide-in-from-right-4 duration-500 drop-shadow-md">
                                {renderText(currentText)}
                            </p>
                        </div>
                    </div>

                    {/* Footer Controls */}
                    <div className="mt-4 sm:mt-12 flex flex-col gap-6 sm:gap-8 pt-4 border-t border-white/5 sm:border-none">
                        {/* Progress Bar */}
                        <div className="flex gap-2">
                            {story.text.map((_, i) => (
                                <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${i === step ? `w-8 sm:w-12 ${story.color.replace('text-', 'bg-')}` : `w-2 sm:w-3 bg-white/10`}`} />
                            ))}
                        </div>

                        <div className="flex items-center justify-between gap-4">
                            <button
                                onClick={onClose}
                                className="px-4 py-3 sm:px-6 sm:py-4 rounded-xl sm:rounded-2xl text-white/30 text-[10px] sm:text-xs font-black uppercase tracking-widest hover:text-white transition-colors"
                            >
                                Pular
                            </button>

                            <button
                                onClick={() => {
                                    if (isLast) onClose();
                                    else setStep(prev => prev + 1);
                                }}
                                className={`flex-1 py-3 px-6 sm:py-4 sm:px-8 rounded-xl sm:rounded-2xl font-black uppercase tracking-widest text-xs sm:text-sm transition-all active:scale-95 shadow-2xl flex items-center justify-center gap-3 group
                                    ${isLast ? 'bg-white text-black hover:bg-gray-100' : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'}
                                `}
                            >
                                <span>{isLast ? 'Começar' : 'Continuar'}</span>
                                {!isLast && <i className="fa-solid fa-arrow-right group-hover:translate-x-1 transition-transform"></i>}
                                {isLast && <i className="fa-solid fa-play"></i>}
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};
