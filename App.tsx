
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
import { CardStore } from './components/CardStore';
import { CARDS } from './constants/cards';
import { getPlayerTitle, getNextLevelProgress } from './utils/titles';

const App: React.FC = () => {
  const [stats, setStats] = useState<GameStats>(() => {
    const saved = localStorage.getItem('chordRush_stats');
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        playerName: parsed.playerName || '',
        highScore: parsed.highScore || 0,
        totalXP: parsed.totalXP || 0,
        selectedCardId: parsed.selectedCardId
      };
    }
    return { playerName: '', highScore: 0, totalXP: 0 };
  });

  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
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
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isEndingRef = useRef(false);

  const scoreRef = useRef(0);
  const levelRef = useRef(1);
  const sessionXPRef = useRef(0);

  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { levelRef.current = currentLevel; }, [currentLevel]);
  useEffect(() => { sessionXPRef.current = sessionXP; }, [sessionXP]);

  useEffect(() => {
    localStorage.setItem('chordRush_stats', JSON.stringify(stats));
  }, [stats]);

  useEffect(() => {
    const syncProfile = async () => {
      const deviceId = getDeviceId();
      const { data } = await supabase
        .from('players')
        .select('name, selected_card_id, xp')
        .eq('device_id', deviceId)
        .maybeSingle();

      if (data) {
        setStats(prev => ({
          ...prev,
          playerName: data.name || prev.playerName,
          selectedCardId: data.selected_card_id,
          totalXP: data.xp || prev.totalXP
        }));
      }
    };
    syncProfile();
  }, []);

  const handleNameChange = (name: string) => {
    setStats(prev => ({ ...prev, playerName: name.toUpperCase() }));
  };

  const savePlayerProfile = async () => {
    const deviceId = getDeviceId();
    const nameToSave = stats.playerName.trim() || `JOGADOR-${deviceId.slice(0, 4)}`;
    try {
      const { data, error } = await supabase
        .from('players')
        .upsert({ device_id: deviceId, name: nameToSave }, { onConflict: 'device_id' })
        .select().single();
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
      let { data: playerData } = await supabase.from('players').select('id').eq('device_id', deviceId).maybeSingle();
      if (!playerData) {
        const nameToSave = stats.playerName.trim() || `JOGADOR-${deviceId.slice(0, 4)}`;
        const { data: newData } = await supabase.from('players').insert({ device_id: deviceId, name: nameToSave }).select('id').single();
        playerData = newData;
      }
      if (playerData) {
        await supabase.from('scores').insert({ player_id: playerData.id, score: finalScore, level: finalLevel });
      }
    } catch (err) { console.error('Erro ao salvar pontuação:', err); }
  };

  const startNewGame = async (selectedMode: GameMode) => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    isEndingRef.current = false;
    await savePlayerProfile();
    setMode(selectedMode);
    setCurrentLevel(1);
    setTimeLeft(60);
    setScore(0);
    setSessionXP(0);
    setTimeAdded(null);
    setCombo(0);
    setFeedback(null);
    let initialPool = getChordsForLevel(1);
    if (lastSessionFirstChord && initialPool[0].symbol === lastSessionFirstChord) initialPool = shuffle(initialPool);
    setLastSessionFirstChord(initialPool[0].symbol);
    setChordsPool(initialPool);
    setCurrentIndex(0);
    setCurrentOptions(generateOptions(initialPool[0]));
    setGameState(GameState.PLAYING);
  };

  useEffect(() => {
    if (gameState === GameState.PLAYING) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => prev <= 1 ? 0 : prev - 1);
      }, 1000);
    } else if (timerRef.current) clearInterval(timerRef.current);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [gameState]);

  useEffect(() => {
    if (gameState === GameState.PLAYING && timeLeft === 0 && !isEndingRef.current) endGame();
  }, [timeLeft, gameState]);

  const endGame = async () => {
    if (isEndingRef.current) return;
    isEndingRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    const finalScore = scoreRef.current;
    const finalLevel = levelRef.current;
    const finalXP = sessionXPRef.current;
    setGameState(GameState.GAMEOVER);
    setStats(prev => ({ ...prev, highScore: Math.max(prev.highScore, finalScore), totalXP: prev.totalXP + finalXP }));
    await saveScoreToBackend(finalScore, finalLevel);
    const deviceId = getDeviceId();
    await supabase.rpc('increment_player_xp', { device_id_param: deviceId, xp_to_add: finalXP });
  };

  const handleAnswer = (selectedNote: NoteName) => {
    const currentChord = chordsPool[currentIndex];
    if (selectedNote === currentChord.note) {
      setFeedback({ type: 'correct', note: selectedNote });
      setCombo(prev => prev + 1);
      const xp = getXPForLevel(currentLevel);
      const bonus = getTimeBonus(currentLevel);
      setScore(prev => prev + 1);
      setSessionXP(prev => prev + xp);
      setTimeLeft(prev => Math.min(prev + bonus, 600));
      setTimeAdded(bonus);
      setTimeout(() => setTimeAdded(null), 1000);
      if (score > 0 && (score + 1) % 10 === 0 && currentLevel < 7) setCurrentLevel(prev => prev + 1);
    } else {
      setFeedback({ type: 'wrong', note: currentChord.note });
      setCombo(0);
    }
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    feedbackTimeoutRef.current = setTimeout(() => {
      setFeedback(null);
      if (gameState === GameState.PLAYING) nextChord();
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

  const progressPercentage = (score % 10) * 10;
  const isGlowing = combo >= 3;
  const isOnFire = combo >= 7;
  const glowIntensity = Math.min(combo * 5, 50);

  // Get Equipped Card
  const selectedEffectCard = CARDS.find(c => c.id === stats.selectedCardId);

  return (
    <div className={`fixed inset-0 transition-colors duration-1000 ${gameState === GameState.PLAYING ? THEMES[currentLevel as keyof typeof THEMES] : 'bg-[#0a0a0a]'} text-white flex flex-col items-center select-none overflow-hidden`}>

      {/* MENU SCREEN */}
      {gameState === GameState.MENU && (
        <div className="w-full h-full max-h-screen flex flex-col items-center justify-center p-4 overflow-hidden relative bg-[#0a0a0a]">
          <div className="w-full max-w-sm flex flex-col items-center gap-6 z-10">
            <div className="text-center">
              <div className="h-10 mb-2 flex items-center justify-center opacity-60">
                <img
                  src="school_logo.png"
                  alt="Escola Logo"
                  className="max-h-full w-auto grayscale brightness-200"
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                />
              </div>
              <h1 className="text-5xl sm:text-7xl font-black tracking-tighter italic leading-none block">
                CHORD<span className="text-orange-500">RUSH</span>
              </h1>
              <div className="flex flex-col items-center gap-1 mt-1">
                <p className="text-orange-500 font-black tracking-[0.3em] text-[10px] uppercase">Master the Fretboard</p>
                <p className="text-white/20 font-black text-[9px] uppercase tracking-widest">Version 1.7.1</p>
              </div>
            </div>

            <div className="w-full space-y-4">
              {!stats.playerName && (
                <div className="space-y-2">
                  <p className="text-white/40 text-[10px] font-black uppercase tracking-widest text-center">Identifique-se para Jogar</p>
                  <input
                    type="text"
                    placeholder="DIGITE SEU NOME"
                    value={stats.playerName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className="w-full bg-white/5 border-2 border-white/10 rounded-2xl p-5 text-center text-xl font-black uppercase focus:outline-none focus:border-orange-500 transition-all placeholder:text-white/10"
                  />
                </div>
              )}

              <button
                onClick={() => stats.playerName.trim() && startNewGame(GameMode.NORMAL)}
                disabled={!stats.playerName.trim()}
                className={`w-full relative overflow-hidden bg-white text-black font-black py-5 rounded-2xl text-2xl transition-all shadow-[0_8px_0_#d4d4d4] active:shadow-none active:translate-y-[8px] uppercase ${!stats.playerName.trim() ? 'opacity-30 cursor-not-allowed' : 'hover:bg-neutral-100'}`}
              >
                JOGAR AGORA
              </button>

              <div className="relative w-full group">
                <button
                  disabled={true}
                  className="w-full relative overflow-hidden bg-white/5 border-2 border-white/10 text-white/20 font-black p-5 rounded-2xl text-xl transition-all flex items-center justify-center gap-4 cursor-not-allowed"
                >
                  <i className="fa-solid fa-cart-shopping text-2xl"></i>
                  LOJA DE CARDS
                </button>
                <div className="absolute -top-2 -right-2 bg-orange-500 text-white text-[8px] font-black px-2 py-1 rounded-lg shadow-lg rotate-12 z-20 animate-bounce">
                  NOVIDADES EM BREVE
                </div>
              </div>

              <button
                onClick={() => setGameState(GameState.RANKING)}
                className="w-full bg-white/5 border-2 border-white/10 text-yellow-500 font-black p-4 rounded-2xl text-lg active:scale-95 transition-all flex items-center justify-center gap-3 hover:bg-white/10"
              >
                <i className="fa-solid fa-trophy text-xl"></i>
                RANKING GLOBAL
              </button>
            </div>

            {/* BOX DE JOGADOR - LIMPO SEM SPOILERS */}
            {(() => {
              const title = getPlayerTitle(stats.totalXP);
              const progress = getNextLevelProgress(stats.totalXP);
              return (
                <div
                  className="w-full flex justify-between items-center rounded-[32px] p-6 border-2 shadow-2xl backdrop-blur-md relative overflow-hidden transition-all duration-500 bg-neutral-900/80 border-white/10"
                >
                  <div className="flex flex-col relative z-10 min-w-0 flex-1">
                    <div className={`self-start px-2 py-0.5 rounded-full border mb-1 ${title.border}`}>
                      <span className={`text-[7px] uppercase font-black tracking-widest ${title.style}`}>
                        {title.title}
                      </span>
                    </div>
                    <h3 className="text-white/40 text-[9px] font-black uppercase tracking-[0.2em] mb-1">Status do Perfil</h3>
                    <span className="font-black text-2xl text-white tracking-tight break-words pr-2 line-clamp-1 uppercase">
                      {stats.playerName || '---'}
                    </span>

                    {/* Barra de Progresso da Patente */}
                    <div className="w-20 h-1 bg-white/5 rounded-full mt-2 overflow-hidden">
                      <div className="h-full bg-orange-500 rounded-full transition-all duration-1000" style={{ width: `${progress}%` }}></div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end pl-4 border-l border-white/10 relative z-10 flex-shrink-0">
                    <h3 className="text-white/40 text-[9px] font-black uppercase tracking-[0.2em] mb-1">XP Saldo</h3>
                    <div className="flex items-center gap-2">
                      <i className="fa-solid fa-bolt text-orange-500 text-sm"></i>
                      <span className="text-3xl font-black text-white tabular-nums">{stats.totalXP.toLocaleString()}</span>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/40 mt-1 lowercase">Recorde: {stats.highScore} pts</span>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* PLAYING SCREEN */}
      {gameState === GameState.PLAYING && (
        <div className="w-full h-full max-h-screen flex flex-col p-4 overflow-hidden relative">
          <div className="flex justify-end mb-2">
            <button onClick={endGame} className="px-4 py-2 bg-black/20 text-red-500 border border-red-500/30 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all active:scale-95 flex items-center justify-center gap-2">
              <i className="fa-solid fa-flag-checkered"></i> Encerrar
            </button>
          </div>
          <div className="flex justify-between items-center mb-2 relative">
            <div className="flex flex-col relative">
              <span className="text-[8px] font-black opacity-40 uppercase tracking-widest">Tempo</span>
              <div className="flex items-center gap-2">
                <span className={`text-xl font-black tabular-nums transition-all ${timeLeft < 10 ? 'text-red-500 animate-pulse scale-110' : ''}`}> {formatTime(timeLeft)} </span>
                {timeAdded && <span className="absolute -right-8 top-4 text-green-400 font-black text-xs animate-bounce"> +{timeAdded}s </span>}
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
          <div className="w-full h-3 bg-black/40 rounded-full overflow-hidden mb-4 border border-white/10 relative">
            <div className={`h-full transition-all duration-500 ease-out flex items-center justify-end px-2 ${isOnFire ? 'fire-effect bg-gradient-to-r from-yellow-400 via-orange-500 to-red-600' : 'bg-gradient-to-r from-orange-400 to-orange-600'} ${isGlowing ? 'glow-pulse' : ''}`} style={{ width: `${progressPercentage}%`, boxShadow: isGlowing ? `0 0 ${glowIntensity}px rgba(249,115,22,0.8)` : 'none' }}>
              {combo >= 2 && <span className="text-[6px] font-black text-white/80 whitespace-nowrap drop-shadow-md"> {combo} COMBO! </span>}
            </div>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center relative min-h-0">
            <div className={`text-[100px] sm:text-[140px] md:text-[180px] font-black tracking-tighter transition-transform duration-300 drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)] ${feedback ? 'scale-110' : 'scale-100'} ${feedback?.type === 'wrong' ? 'shake text-red-500' : 'text-white'}`}> {chordsPool[currentIndex]?.symbol} </div>
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              {feedback && (
                <div className={`px-8 py-4 rounded-[28px] text-lg font-black uppercase tracking-widest pop-in shadow-[0_20px_50px_rgba(0,0,0,0.4)] flex flex-col items-center border-[3px] z-50 ${feedback.type === 'correct' ? 'bg-green-500 text-white border-green-400' : 'bg-white text-red-600 border-red-200'}`}>
                  {feedback.type === 'correct' ? (<div className="flex items-center gap-2"> <i className="fa-solid fa-fire text-yellow-300"></i> <span>PERFEITO! {combo > 1 ? `x${combo}` : ''}</span> </div>) : (<div className="flex flex-col items-center"> <span className="text-[10px] opacity-60 mb-1">ERRADO! RESPOSTA:</span> <span className="text-2xl leading-none">{feedback.note}</span> </div>)}
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {currentOptions.map((opt, i) => (<NoteButton key={`${currentIndex}-${i}-${opt}`} note={opt} disabled={feedback !== null} onClick={handleAnswer} />))}
          </div>
        </div>
      )}

      {/* GAME OVER SCREEN */}
      {gameState === GameState.GAMEOVER && (
        <div className="w-full h-full max-h-screen flex flex-col items-center justify-between p-6 bg-[#0a0a0a] pop-in overflow-hidden text-center pt-8 pb-8">
          <div className="w-full">
            <div className="text-white/30 text-[10px] font-black uppercase tracking-[0.4em] mb-2">Sessão Finalizada</div>
            <h2 className="text-4xl font-black italic tracking-tighter">FIM DE <span className="text-orange-500">JOGO</span></h2>
          </div>
          <div className="w-full max-w-sm space-y-4">
            <div className="bg-white/5 rounded-3xl p-6 border border-white/10 text-center flex flex-col items-center gap-1 shadow-inner">
              <span className="text-xs font-bold opacity-40 uppercase tracking-widest">Acertos na Sessão</span>
              <span className="text-7xl font-black text-white drop-shadow-lg">{score}</span>
              <div className="px-4 py-1 bg-orange-500/20 text-orange-500 rounded-full text-[10px] font-black uppercase tracking-widest mt-2 border border-orange-500/30"> {score >= stats.highScore ? '🔥 NOVO RECORDE 🔥' : `RECORDE: ${stats.highScore}`} </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-black/30 rounded-2xl p-4 text-center border border-white/5"> <span className="text-[8px] font-black opacity-40 block uppercase mb-1 tracking-widest">XP Ganho</span> <span className="text-xl font-black text-green-400">+{sessionXP}</span> </div>
              <div className="bg-black/30 rounded-2xl p-4 text-center border border-white/5"> <span className="text-[8px] font-black opacity-40 block uppercase mb-1 tracking-widest">Nível Final</span> <span className="text-xl font-black text-orange-400">{currentLevel}</span> </div>
            </div>
          </div>
          <div className="w-full max-w-sm space-y-3">
            <button onClick={() => startNewGame(mode)} className="w-full bg-orange-500 text-white font-black p-4 rounded-2xl text-lg active:scale-95 transition-all shadow-2xl border-b-4 border-orange-700 uppercase"> Jogar Novamente </button>
            <button onClick={() => setGameState(GameState.MENU)} className="w-full bg-white/10 text-white font-black p-4 rounded-2xl text-lg active:scale-95 transition-all border-b-4 border-white/5 uppercase"> Voltar ao Menu </button>
            <button onClick={() => setGameState(GameState.RANKING)} className="w-full py-2 text-yellow-500 font-bold uppercase tracking-widest text-[10px] active:scale-95 transition-all flex items-center justify-center gap-2"> <i className="fa-solid fa-trophy"></i> Ranking Global </button>
          </div>
        </div>
      )}

      {/* RANKING SCREEN */}
      {gameState === GameState.RANKING && (<RankingBoard onBack={() => setGameState(GameState.MENU)} />)}

      {/* STORE SCREEN */}
      {gameState === GameState.STORE && (
        <CardStore
          onBack={() => setGameState(GameState.MENU)}
          totalXP={stats.totalXP}
          onXPUpdate={(newXP) => setStats(prev => ({ ...prev, totalXP: newXP }))}
          selectedCardId={stats.selectedCardId}
          onCardSelect={(cardId) => setStats(prev => ({ ...prev, selectedCardId: cardId }))}
        />
      )}
    </div>
  );
};

export default App;
