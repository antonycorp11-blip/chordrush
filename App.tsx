
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
        <div className="w-full h-full max-h-screen flex flex-col items-center justify-center p-4 overflow-hidden relative bg-[#121212]">

          <div className="w-full max-w-sm flex flex-col items-center gap-6">
            <div className="text-center">
              <h1 className="text-6xl sm:text-8xl font-black tracking-tighter italic leading-none block">
                CHORD<span className="text-orange-500">RUSH</span>
              </h1>
              <p className="text-orange-500 font-black tracking-[0.3em] text-xs uppercase">Master the Fretboard v2</p>
            </div>

            <div className="w-full space-y-3">
              <div className="relative group">
                <input
                  type="text"
                  placeholder="Seu Nome"
                  value={stats.playerName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full bg-black/40 border-2 border-white/5 rounded-2xl p-4 text-center text-xl font-black uppercase focus:outline-none focus:border-orange-500 transition-all placeholder:text-white/10"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => startNewGame(GameMode.NORMAL)}
                  className="bg-white text-black font-black py-4 rounded-xl text-lg active:scale-95 transition-all shadow-xl border-b-4 border-neutral-300 uppercase"
                >
                  Normal
                </button>
                <button
                  onClick={() => startNewGame(GameMode.HARD)}
                  className="bg-orange-500 text-white font-black py-4 rounded-xl text-lg active:scale-95 transition-all shadow-xl border-b-4 border-orange-700 uppercase"
                >
                  Difícil
                </button>
              </div>

              <button
                onClick={() => setGameState(GameState.RANKING)}
                className="w-full bg-gradient-to-r from-yellow-400 to-yellow-600 text-yellow-950 font-black p-4 rounded-xl text-lg active:scale-95 transition-all shadow-2xl border-b-4 border-yellow-700 flex items-center justify-center gap-3"
              >
                <i className="fa-solid fa-trophy text-xl"></i>
                RANKING SEMANAL
              </button>
            </div>

            <div className="w-full bg-black/20 rounded-2xl p-4 border border-white/5 shadow-2xl backdrop-blur-sm">
              <div className="flex justify-between items-center">
                <div className="flex flex-col">
                  <h3 className="text-white/40 text-[9px] font-black uppercase tracking-widest">Jogador</h3>
                  <span className="font-black text-lg text-white truncate max-w-[140px]">{stats.playerName || '---'}</span>
                </div>
                <div className="text-right flex flex-col">
                  <h3 className="text-white/40 text-[9px] font-black uppercase tracking-widest">Recorde</h3>
                  <span className="text-2xl font-black text-orange-400">{stats.highScore}</span>
                </div>
              </div>
              <div className="pt-3 mt-3 border-t border-white/5 flex items-center justify-center gap-2">
                <i className="fa-solid fa-bolt text-xs text-orange-400"></i>
                <span className="text-xs font-black text-white/50">{stats.totalXP.toLocaleString()} XP</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PLAYING SCREEN */}
      {gameState === GameState.PLAYING && (
        <div className="w-full h-full max-h-screen flex flex-col p-4 overflow-hidden relative">
          {/* Header */}
          <div className="flex justify-between items-center mb-2 relative">
            <div className="flex flex-col relative">
              <span className="text-[8px] font-black opacity-40 uppercase tracking-widest">Tempo</span>
              <div className="flex items-center gap-2">
                <span className={`text-xl font-black tabular-nums transition-all ${timeLeft < 10 ? 'text-red-500 animate-pulse scale-110' : ''}`}>
                  {formatTime(timeLeft)}
                </span>
                {timeAdded && (
                  <span className="absolute -right-8 top-4 text-green-400 font-black text-xs animate-bounce">
                    +{timeAdded}s
                  </span>
                )}
              </div>
            </div>

            <div className="text-center bg-black/30 px-4 py-1 rounded-full border border-white/10 flex flex-col items-center">
              <span className="text-[8px] font-black opacity-40 uppercase tracking-widest block">Nível</span>
              <span className="text-lg font-black text-orange-400">{currentLevel}</span>
            </div>

            <div className="flex flex-col items-end">
              <span className="text-[8px] font-black opacity-40 uppercase tracking-widest">Sessão XP</span>
              <span className="text-xl font-black tabular-nums">{sessionXP}</span>
            </div>
          </div>

          {/* Barra de Progresso de Nível */}
          <div className="w-full h-3 bg-black/40 rounded-full overflow-hidden mb-4 border border-white/10 shadow-inner relative">
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
                <span className="text-[6px] font-black text-white/80 whitespace-nowrap drop-shadow-md">
                  {combo} COMBO!
                </span>
              )}
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center relative min-h-0">
            <div className={`text-[100px] sm:text-[140px] md:text-[180px] font-black tracking-tighter transition-transform duration-300 drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)] ${feedback ? 'scale-110' : 'scale-100'} ${feedback?.type === 'wrong' ? 'shake text-red-500' : 'text-white'}`}>
              {chordsPool[currentIndex]?.symbol}
            </div>

            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              {feedback && (
                <div className={`px-8 py-4 rounded-[28px] text-lg font-black uppercase tracking-widest pop-in shadow-[0_20px_50px_rgba(0,0,0,0.4)] flex flex-col items-center border-[3px] z-50 ${feedback.type === 'correct' ? 'bg-green-500 text-white border-green-400' : 'bg-white text-red-600 border-red-200'}`}>
                  {feedback.type === 'correct' ? (
                    <div className="flex items-center gap-2">
                      <i className="fa-solid fa-fire text-yellow-300"></i>
                      <span>PERFEITO! {combo > 1 ? `x${combo}` : ''}</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] opacity-60 mb-1">ERRADO! RESPOSTA:</span>
                      <span className="text-2xl leading-none">{feedback.note}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Opções de Resposta */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {currentOptions.map((opt, i) => (
              <NoteButton
                key={`${currentIndex}-${i}-${opt}`}
                note={opt}
                disabled={feedback !== null}
                onClick={handleAnswer}
              />
            ))}
          </div>
        </div>
      )}

      {/* GAME OVER SCREEN */}
      {gameState === GameState.GAMEOVER && (
        <div className="w-full h-full max-h-screen flex flex-col items-center justify-between p-6 bg-neutral-900 pop-in overflow-hidden text-center pt-8 pb-8">
          <div className="w-full">
            <div className="text-white/30 text-[10px] font-black uppercase tracking-[0.4em] mb-2">Sessão Finalizada</div>
            <h2 className="text-4xl font-black italic tracking-tighter">FIM DE <span className="text-orange-500">JOGO</span></h2>
          </div>

          <div className="w-full max-w-sm space-y-4">
            <div className="bg-white/5 rounded-3xl p-6 border border-white/10 text-center flex flex-col items-center gap-1 shadow-inner">
              <span className="text-xs font-bold opacity-40 uppercase tracking-widest">Acertos na Sessão</span>
              <span className="text-7xl font-black text-white drop-shadow-lg">{score}</span>
              <div className="px-4 py-1 bg-orange-500/20 text-orange-500 rounded-full text-[10px] font-black uppercase tracking-widest mt-2 border border-orange-500/30">
                {score >= stats.highScore ? '🔥 NOVO RECORDE 🔥' : `RECORDE: ${stats.highScore}`}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-black/30 rounded-2xl p-4 text-center border border-white/5">
                <span className="text-[8px] font-black opacity-40 block uppercase mb-1 tracking-widest">XP Ganho</span>
                <span className="text-xl font-black text-green-400">+{sessionXP}</span>
              </div>
              <div className="bg-black/30 rounded-2xl p-4 text-center border border-white/5">
                <span className="text-[8px] font-black opacity-40 block uppercase mb-1 tracking-widest">Nível Final</span>
                <span className="text-xl font-black text-orange-400">{currentLevel}</span>
              </div>
            </div>
          </div>

          <div className="w-full max-w-sm space-y-3">
            <button
              onClick={() => startNewGame(mode)}
              className="w-full bg-orange-500 text-white font-black p-4 rounded-2xl text-lg active:scale-95 transition-all shadow-2xl border-b-4 border-orange-700 uppercase"
            >
              Jogar Novamente
            </button>
            <button
              onClick={() => setGameState(GameState.MENU)}
              className="w-full bg-white/10 text-white font-black p-4 rounded-2xl text-lg active:scale-95 transition-all border-b-4 border-white/5 uppercase"
            >
              Voltar ao Menu
            </button>

            <button
              onClick={() => setGameState(GameState.RANKING)}
              className="w-full py-2 text-yellow-500 font-bold uppercase tracking-widest text-[10px] active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-trophy"></i>
              Ranking Global
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
