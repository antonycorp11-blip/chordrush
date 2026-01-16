
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
    setGameState(GameState.GAMEOVER);

    setStats(prev => ({
      ...prev,
      highScore: Math.max(prev.highScore, score),
      totalXP: prev.totalXP + sessionXP
    }));

    // Envia score para o backend
    await saveScoreToBackend(score, currentLevel);
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
        <div className="w-full h-full flex flex-col items-center justify-center p-8 overflow-y-auto">

          <div className="absolute top-6 left-0 right-0 flex flex-col items-center gap-2 pointer-events-none">
            <button
              className="px-6 py-2 bg-black/40 text-[10px] font-black text-orange-400 rounded-full border border-orange-500/20 uppercase tracking-widest pointer-events-auto hover:bg-black/60 transition-all active:scale-95 shadow-lg"
              onClick={() => alert('Troca de XP por G-Coins em breve!')}
            >
              <i className="fa-solid fa-coins mr-2"></i>
              Trocar XP por G-Coins
            </button>
            <div className="text-[10px] text-white/30 font-bold uppercase tracking-widest">
              Saldo: 0 G-Coins
            </div>
          </div>

          <div className="mt-8 mb-4 flex items-center justify-center">
            <div className="w-40 h-40 bg-orange-500 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(249,115,22,0.3)] animate-pulse">
              <i className="fa-solid fa-music text-6xl text-white"></i>
            </div>
          </div>

          <h1 className="text-6xl font-black mb-2 tracking-tighter italic">CHORD<span className="text-orange-500">RUSH</span></h1>
          <p className="text-white/50 mb-10 font-bold tracking-widest text-xs uppercase">Treinamento de Cifras</p>

          <div className="w-full max-w-sm space-y-4">
            <input
              type="text"
              placeholder="SEU NOME"
              value={stats.playerName}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full bg-white/10 border-2 border-white/20 rounded-2xl p-4 text-center text-xl font-bold focus:outline-none focus:border-orange-500 transition-colors shadow-inner"
            />

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => startNewGame(GameMode.NORMAL)}
                className="bg-white text-black font-black p-5 rounded-2xl text-lg hover:bg-neutral-200 active:scale-95 transition-all shadow-xl border-b-4 border-neutral-300"
              >
                NORMAL
              </button>
              <button
                onClick={() => startNewGame(GameMode.HARD)}
                className="bg-orange-500 text-white font-black p-5 rounded-2xl text-lg hover:bg-orange-600 active:scale-95 transition-all shadow-xl border-b-4 border-orange-700"
              >
                DIFÍCIL
              </button>
            </div>

            <button
              onClick={() => setGameState(GameState.RANKING)}
              className="w-full bg-yellow-400 text-yellow-900 font-black p-4 rounded-2xl text-lg hover:bg-yellow-300 active:scale-95 transition-all shadow-xl border-b-4 border-yellow-600 mt-4 flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-trophy"></i>
              VER RANKING SEMANAL
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

          {/* Main Area */}
          <div className="flex-1 flex flex-col items-center justify-center relative">
            <div className={`text-[100px] md:text-[150px] font-black tracking-tighter transition-transform duration-300 drop-shadow-xl ${feedback ? 'scale-110' : 'scale-100'} ${feedback?.type === 'wrong' ? 'shake text-red-500' : ''}`}>
              {chordsPool[currentIndex]?.symbol}
            </div>

            <div className="h-24 flex items-center justify-center text-center px-4">
              {feedback && (
                <div className={`px-8 py-4 rounded-3xl text-base font-black uppercase tracking-widest pop-in shadow-2xl flex flex-col items-center border-2 ${feedback.type === 'correct' ? 'bg-green-500 text-white border-green-400' : 'bg-white text-red-600 border-red-200'}`}>
                  {feedback.type === 'correct' ? (
                    <div className="flex items-center gap-2">
                      <i className="fa-solid fa-fire animate-bounce text-yellow-300"></i>
                      <span>ACERTOU! {combo > 1 ? `x${combo}` : ''}</span>
                    </div>
                  ) : (
                    <>
                      <span className="text-[10px] font-black opacity-60 mb-1">RESPOSTA CORRETA:</span>
                      <span className="text-lg leading-none">{feedback.note}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Opções de Resposta */}
          <div className="grid grid-cols-2 gap-4 mb-8">
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
