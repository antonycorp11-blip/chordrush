
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameState, GameStats, GameMode, Chord, NoteName } from './types';
import { THEMES } from './constants';
import {
  getChordsForLevel,
  generateOptions,
  getTimeBonus,
  getXPForLevel,
  shuffle
} from './utils/gameLogic';
import { NoteButton } from './components/NoteButton';
import { supabase, getDeviceId } from './utils/supabaseClient';
import { RankingBoard } from './components/RankingBoard';

const App: React.FC = () => {
  // Global State com carregamento inicial robusto do LocalStorage
  const [stats, setStats] = useState<GameStats>(() => {
    const saved = localStorage.getItem('chordRush_stats');
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        playerName: parsed.playerName || '',
        highScore: parsed.highScore || 0,
        totalXP: parsed.totalXP || 0
      };
    }
    return { playerName: '', highScore: 0, totalXP: 0 };
  });

  const [gameState, setGameState] = useState<GameState>(GameState.MENU);

  // Game Play State
  const [mode, setMode] = useState<GameMode>(GameMode.NORMAL);
  const [currentLevel, setCurrentLevel] = useState(1);
  const [timeLeft, setTimeLeft] = useState(60);
  const [score, setScore] = useState(0);
  const [sessionXP, setSessionXP] = useState(0);
  const [chordsPool, setChordsPool] = useState<Chord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentOptions, setCurrentOptions] = useState<NoteName[]>([]);
  const [feedback, setFeedback] = useState<{ type: 'correct' | 'wrong', note: NoteName } | null>(null);
  const [lastSessionFirstChord, setLastSessionFirstChord] = useState<string | null>(null);
  const [timeAdded, setTimeAdded] = useState<number | null>(null);
  const [combo, setCombo] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Refs para evitar "stale closure" no timer (garantir score atualizado no fim do jogo)
  const scoreRef = useRef(0);
  const levelRef = useRef(1);
  const sessionXPRef = useRef(0);

  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { levelRef.current = currentLevel; }, [currentLevel]);
  useEffect(() => { sessionXPRef.current = sessionXP; }, [sessionXP]);

  // Persistence: Salva sempre que stats mudar
  useEffect(() => {
    localStorage.setItem('chordRush_stats', JSON.stringify(stats));
  }, [stats]);

  // Função para atualizar nome e salvar imediatamente
  const handleNameChange = (name: string) => {
    setStats(prev => ({ ...prev, playerName: name.toUpperCase() }));
  };

  // Supabase Integration Hooks
  const savePlayerProfile = async () => {
    const deviceId = getDeviceId();
    const nameToSave = stats.playerName.trim() || `JOGADOR-${deviceId.slice(0, 4)}`;

    try {
      const { data, error } = await supabase
        .from('players')
        .upsert({
          device_id: deviceId,
          name: nameToSave
        }, { onConflict: 'device_id' })
        .select()
        .single();

      if (error) throw error;
      return data.id;
    } catch (err) {
      console.error('Erro ao salvar perfil:', err);
      return null;
    }
  };

  const saveScoreToBackend = async (finalScore: number, finalLevel: number) => {
    try {
      const deviceId = getDeviceId();
      // Primeiro garante que o player existe
      let { data: playerData, error: fetchError } = await supabase
        .from('players')
        .select('id')
        .eq('device_id', deviceId)
        .maybeSingle();

      if (!playerData) {
        // Se não existir, tenta criar (último recurso)
        const nameToSave = stats.playerName.trim() || `JOGADOR-${deviceId.slice(0, 4)}`;
        const { data: newData, error: createError } = await supabase
          .from('players')
          .insert({ device_id: deviceId, name: nameToSave })
          .select('id')
          .single();

        if (createError) throw createError;
        playerData = newData;
      }

      if (playerData) {
        const { error: insertError } = await supabase.from('scores').insert({
          player_id: playerData.id,
          score: finalScore,
          level: finalLevel
        });
        if (insertError) throw insertError;
      }
    } catch (err) {
      console.error('Erro ao salvar pontuação:', err);
    }
  };

  // Game Logic
  const startNewGame = async (selectedMode: GameMode) => {
    // Salva/Atualiza o nome no backend ao iniciar e espera terminar
    await savePlayerProfile();
    setMode(selectedMode);
    const startLevel = selectedMode === GameMode.HARD ? 3 : 1;
    setCurrentLevel(startLevel);
    setTimeLeft(60);
    setScore(0);
    setSessionXP(0);
    setTimeAdded(null);
    setCombo(0);

    // Initial pool
    let initialPool = getChordsForLevel(startLevel);

    // Rule: First chord cannot be same as previous session's first
    if (lastSessionFirstChord && initialPool[0].symbol === lastSessionFirstChord) {
      initialPool = shuffle(initialPool);
    }

    setLastSessionFirstChord(initialPool[0].symbol);
    setChordsPool(initialPool);
    setCurrentIndex(0);
    setCurrentOptions(generateOptions(initialPool[0]));
    setGameState(GameState.PLAYING);

    // Start Timer
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          endGame();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const endGame = async () => {
    if (timerRef.current) clearInterval(timerRef.current);

    // Captura os valores reais dos refs (evita o problema do score fixado em 0)
    const finalScore = scoreRef.current;
    const finalLevel = levelRef.current;
    const finalXP = sessionXPRef.current;

    setGameState(GameState.GAMEOVER);

    setStats(prev => ({
      ...prev,
      highScore: Math.max(prev.highScore, finalScore),
      totalXP: prev.totalXP + finalXP
    }));

    // Envia score real para o backend
    await saveScoreToBackend(finalScore, finalLevel);
  };

  const handleAnswer = (selectedNote: NoteName) => {
    const currentChord = chordsPool[currentIndex];
    const isCorrect = selectedNote === currentChord.note;

    if (isCorrect) {
      setFeedback({ type: 'correct', note: selectedNote });
      setCombo(prev => prev + 1);

      const xp = getXPForLevel(currentLevel);
      const bonus = getTimeBonus(currentLevel);

      setScore(prev => prev + 1);
      setSessionXP(prev => prev + xp);
      setTimeLeft(prev => Math.min(prev + bonus, 240)); // Cap at 4 mins

      // Mostrar indicador de tempo adicionado
      setTimeAdded(bonus);
      setTimeout(() => setTimeAdded(null), 1000);

      // Progress levels (Sobe a cada 10 acertos)
      if (score > 0 && (score + 1) % 10 === 0 && currentLevel < 7) {
        setCurrentLevel(prev => prev + 1);
      }
    } else {
      setFeedback({ type: 'wrong', note: currentChord.note });
      setCombo(0);
    }

    // Auto next after feedback delay
    setTimeout(() => {
      setFeedback(null);
      nextChord();
    }, 800);
  };

  const nextChord = () => {
    let nextIdx = currentIndex + 1;
    let pool = chordsPool;

    if (nextIdx >= chordsPool.length) {
      pool = getChordsForLevel(currentLevel);
      nextIdx = 0;
    }

    setChordsPool(pool);
    setCurrentIndex(nextIdx);
    setCurrentOptions(generateOptions(pool[nextIdx]));
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calcula o progresso para o próximo nível (baseado em 10 acertos por nível)
  const progressPercentage = (score % 10) * 10;

  // Lógica de brilho e fogo baseada no combo
  const isGlowing = combo >= 3;
  const isOnFire = combo >= 7;
  const glowIntensity = Math.min(combo * 5, 50);

  return (
    <div className={`fixed inset-0 transition-colors duration-1000 ${gameState === GameState.PLAYING ? THEMES[currentLevel as keyof typeof THEMES] : 'bg-neutral-900'} text-white flex flex-col items-center select-none overflow-hidden`}>

      {/* MENU SCREEN */}
      {gameState === GameState.MENU && (
        <div className="w-full h-full flex flex-col items-center justify-start p-6 overflow-y-auto relative bg-neutral-900 pt-10">

          {/* Logo da Escola (Acima de tudo) */}
          <div className="w-full max-w-[240px] mb-8 animate-fade-in">
            <img
              src="/school_logo.png"
              alt="Logo Studio Acorde"
              className="w-full h-auto object-contain drop-shadow-[0_5px_15px_rgba(249,115,22,0.3)]"
              onError={(e) => {
                // Tenta carregar sem a barra inicial se falhar
                if (!e.currentTarget.src.includes('public')) {
                  e.currentTarget.src = 'school_logo.png';
                } else {
                  e.currentTarget.style.display = 'none';
                }
              }}
            />
          </div>

          <div className="mb-6 flex items-center justify-center">
            <div className="relative group">
              <div className="absolute inset-0 bg-orange-500 rounded-[30px] blur-2xl opacity-10 group-hover:opacity-30 transition-opacity"></div>
              <div className="w-32 h-32 md:w-40 md:h-40 bg-gradient-to-br from-neutral-800 to-neutral-900 rounded-[30px] flex items-center justify-center shadow-2xl border border-white/10 overflow-hidden relative">
                <img
                  src="/logo_game.png"
                  alt="Chord Rush Icon"
                  className="w-full h-full object-cover p-3 group-hover:scale-110 transition-transform duration-500"
                  onError={(e) => { e.currentTarget.src = 'logo_game.png' }}
                />
              </div>
            </div>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter italic leading-none">
              CHORD<span className="text-orange-500">RUSH</span>
            </h1>
            <div className="flex items-center justify-center gap-2 mt-2">
              <div className="h-px w-6 bg-orange-500/30"></div>
              <p className="text-orange-500 font-black tracking-[0.3em] text-[8px] md:text-[10px] uppercase">Master the Fretboard</p>
              <div className="h-px w-6 bg-orange-500/30"></div>
            </div>
          </div>

          <div className="w-full max-w-sm space-y-5">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-2xl blur opacity-10 group-focus-within:opacity-30 transition duration-1000"></div>
              <input
                type="text"
                placeholder="DIGITE SEU NOME"
                value={stats.playerName}
                onChange={(e) => handleNameChange(e.target.value)}
                className="relative w-full bg-neutral-950 border-2 border-white/5 rounded-2xl p-4 text-center text-xl font-black uppercase focus:outline-none focus:border-orange-500 transition-all shadow-2xl placeholder:text-white/10"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => startNewGame(GameMode.NORMAL)}
                className="group relative overflow-hidden bg-white text-black font-black py-5 rounded-2xl text-lg active:scale-95 transition-all shadow-xl border-b-4 border-neutral-300"
              >
                <span className="relative z-10 uppercase">Normal</span>
              </button>
              <button
                onClick={() => startNewGame(GameMode.HARD)}
                className="group relative overflow-hidden bg-orange-500 text-white font-black py-5 rounded-2xl text-lg active:scale-95 transition-all shadow-xl border-b-4 border-orange-700"
              >
                <span className="relative z-10 uppercase">Difícil</span>
              </button>
            </div>

            <button
              onClick={() => setGameState(GameState.RANKING)}
              className="w-full bg-gradient-to-r from-yellow-400 to-yellow-600 text-yellow-950 font-black p-5 rounded-2xl text-lg active:scale-95 transition-all shadow-2xl border-b-4 border-yellow-700 flex items-center justify-center gap-3"
            >
              <i className="fa-solid fa-trophy text-xl"></i>
              RANKING SEMANAL
            </button>
          </div>

          <div className="mt-10 w-full max-w-sm bg-black/30 rounded-3xl p-6 border border-white/10 shadow-2xl backdrop-blur-sm">
            <div className="flex justify-between items-center mb-4">
              <div className="flex flex-col">
                <h3 className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-1">Jogador Ativo</h3>
                <span className="font-black text-xl text-white truncate max-w-[150px]">{stats.playerName || 'DESCONHECIDO'}</span>
              </div>
              <div className="text-right flex flex-col">
                <h3 className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-1">Melhor Score</h3>
                <span className="text-3xl font-black text-orange-500 drop-shadow-sm">{stats.highScore} <span className="text-xs">PTS</span></span>
              </div>
            </div>
            <div className="pt-4 border-t border-white/5 flex flex-col items-center">
              <span className="text-white/30 text-[10px] font-black uppercase tracking-widest mb-1">Patrimônio de XP</span>
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-bolt text-orange-400 text-sm"></i>
                <span className="text-2xl font-black text-white">{stats.totalXP.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PLAYING SCREEN */}
      {gameState === GameState.PLAYING && (
        <div className="w-full h-full flex flex-col p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-4 relative">
            <div className="flex flex-col relative">
              <span className="text-[10px] font-black opacity-40 uppercase tracking-widest">Tempo</span>
              <div className="flex items-center gap-2">
                <span className={`text-2xl font-black tabular-nums transition-all ${timeLeft < 10 ? 'text-red-500 animate-pulse scale-110' : ''}`}>
                  {formatTime(timeLeft)}
                </span>
                {timeAdded && (
                  <span className="absolute -right-8 top-4 text-green-400 font-black text-sm animate-bounce">
                    +{timeAdded}s
                  </span>
                )}
              </div>
            </div>

            <div className="text-center bg-black/30 px-6 py-2 rounded-full border border-white/10 flex flex-col items-center">
              <span className="text-[10px] font-black opacity-40 uppercase tracking-widest block">Nível</span>
              <span className="text-xl font-black text-orange-400">{currentLevel}</span>
            </div>

            <div className="flex flex-col items-end">
              <span className="text-[10px] font-black opacity-40 uppercase tracking-widest">Sessão XP</span>
              <span className="text-2xl font-black tabular-nums">{sessionXP}</span>
            </div>
          </div>

          {/* Barra de Progresso de Nível */}
          <div className="w-full h-4 bg-black/40 rounded-full overflow-hidden mb-4 border border-white/10 shadow-inner relative">
            <div
              className={`h-full transition-all duration-500 ease-out flex items-center justify-end px-2
                ${isOnFire ? 'fire-effect bg-gradient-to-r from-yellow-400 via-orange-500 to-red-600' : 'bg-gradient-to-r from-orange-400 to-orange-600'}
                ${isGlowing ? 'glow-pulse' : ''}
              `}
              style={{
                width: `${progressPercentage}%`,
                boxShadow: isGlowing ? `0 0 ${glowIntensity}px rgba(249,115,22,0.8)` : 'none'
              }}
            >
              {combo >= 2 && (
                <span className="text-[8px] font-black text-white/80 whitespace-nowrap drop-shadow-md">
                  {combo} COMBO!
                </span>
              )}
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center relative py-10">
            <div className={`text-[120px] md:text-[180px] font-black tracking-tighter transition-transform duration-300 drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)] ${feedback ? 'scale-110' : 'scale-100'} ${feedback?.type === 'wrong' ? 'shake text-red-500' : 'text-white'}`}>
              {chordsPool[currentIndex]?.symbol}
            </div>

            <div className="absolute bottom-0 w-full flex items-center justify-center">
              {feedback && (
                <div className={`px-10 py-5 rounded-[32px] text-xl font-black uppercase tracking-widest pop-in shadow-[0_20px_50px_rgba(0,0,0,0.4)] flex flex-col items-center border-[3px] ${feedback.type === 'correct' ? 'bg-green-500 text-white border-green-400' : 'bg-white text-red-600 border-red-200'}`}>
                  {feedback.type === 'correct' ? (
                    <div className="flex items-center gap-3">
                      <i className="fa-solid fa-fire text-yellow-300 animate-bounce"></i>
                      <span>PERFEITO! {combo > 1 ? `x${combo}` : ''}</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <span className="text-[12px] opacity-60 mb-1">ERRADO! RESPOSTA:</span>
                      <span className="text-3xl leading-none">{feedback.note}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Opções de Resposta */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {currentOptions.map((opt, i) => (
              <NoteButton
                key={`${currentIndex}-${i}-${opt}`}
                note={opt}
                disabled={feedback !== null}
                onClick={handleAnswer}
              />
            ))}
          </div>

          <div className="flex justify-center pb-2 h-4"></div>
        </div>
      )}

      {/* GAME OVER SCREEN */}
      {gameState === GameState.GAMEOVER && (
        <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-neutral-900 pop-in overflow-y-auto text-center">
          <div className="text-white/30 text-xs font-black uppercase tracking-[0.4em] mb-4">Sessão Finalizada</div>
          <h2 className="text-5xl font-black mb-8 italic tracking-tighter">FIM DE <span className="text-orange-500">JOGO</span></h2>

          <div className="w-full max-w-sm space-y-6 mb-12">
            <div className="bg-white/5 rounded-3xl p-8 border border-white/10 text-center flex flex-col items-center gap-2 shadow-inner">
              <span className="text-sm font-bold opacity-40 uppercase tracking-widest">Acertos na Sessão</span>
              <span className="text-8xl font-black text-white drop-shadow-lg">{score}</span>
              <div className="px-4 py-1 bg-orange-500/20 text-orange-500 rounded-full text-xs font-black uppercase tracking-widest mt-2 border border-orange-500/30">
                {score >= stats.highScore ? '🔥 NOVO RECORDE 🔥' : `RECORDE ATUAL: ${stats.highScore}`}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-black/30 rounded-2xl p-5 text-center border border-white/5">
                <span className="text-[10px] font-black opacity-40 block uppercase mb-1 tracking-widest">XP Ganho</span>
                <span className="text-2xl font-black text-green-400">+{sessionXP}</span>
              </div>
              <div className="bg-black/30 rounded-2xl p-5 text-center border border-white/5">
                <span className="text-[10px] font-black opacity-40 block uppercase mb-1 tracking-widest">Nível Final</span>
                <span className="text-2xl font-black text-orange-400">{currentLevel}</span>
              </div>
            </div>
          </div>

          <div className="w-full max-w-sm space-y-4">
            <button
              onClick={() => startNewGame(mode)}
              className="w-full bg-orange-500 text-white font-black p-6 rounded-2xl text-xl hover:bg-orange-600 active:scale-95 transition-all shadow-2xl border-b-4 border-orange-700"
            >
              JOGAR NOVAMENTE
            </button>
            <button
              onClick={() => setGameState(GameState.MENU)}
              className="w-full bg-white/10 text-white font-black p-6 rounded-2xl text-xl hover:bg-white/20 active:scale-95 transition-all border-b-4 border-white/5"
            >
              VOLTAR AO MENU
            </button>

            <button
              onClick={() => setGameState(GameState.RANKING)}
              className="w-full bg-yellow-500/10 text-yellow-500 p-4 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-yellow-500/20 active:scale-95 transition-all mt-4"
            >
              <i className="fa-solid fa-trophy mr-2"></i>
              Ver Ranking Global
            </button>
          </div>
        </div>
      )}

      {/* RANKING SCREEN */}
      {gameState === GameState.RANKING && (
        <RankingBoard onBack={() => setGameState(GameState.MENU)} />
      )}
    </div>
  );
};

export default App;
