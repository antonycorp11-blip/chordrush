
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameState, GameStats, GameMode, Chord, NoteName, PlayerMission } from './types';
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
import { ClefOpeningModal } from './components/ClefOpeningModal';

const App: React.FC = () => {
  const [stats, setStats] = useState<GameStats>(() => {
    const saved = localStorage.getItem('chordRush_stats');
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        playerName: parsed.playerName || '',
        highScore: parsed.highScore || 0,
        totalXP: parsed.totalXP || 0,
        selectedCardId: parsed.selectedCardId,
        accumulatedXP: parsed.accumulatedXP || 0
      };
    }
    return { playerName: '', highScore: 0, acordeCoins: 0, accumulatedXP: 0 };
  });

  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [mode, setMode] = useState<GameMode>(GameMode.NORMAL);
  const [currentLevel, setCurrentLevel] = useState(1);
  const [timeLeft, setTimeLeft] = useState(60);
  const [score, setScore] = useState(0);
  const [hits, setHits] = useState(0);
  const [sessionXP, setSessionXP] = useState(0);
  const [chordsPool, setChordsPool] = useState<Chord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentOptions, setCurrentOptions] = useState<NoteName[]>([]);
  const [feedback, setFeedback] = useState<{ type: 'correct' | 'wrong', note: NoteName } | null>(null);
  const [lastSessionFirstChord, setLastSessionFirstChord] = useState<string | null>(null);
  const [timeAdded, setTimeAdded] = useState<number | null>(null);
  const [combo, setCombo] = useState(0);
  const [showChangelog, setShowChangelog] = useState(false);
  const [showPatentsModal, setShowPatentsModal] = useState(false);
  const [syncDone, setSyncDone] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [dailyMissions, setDailyMissions] = useState<PlayerMission[]>([]);
  const [loadingMission, setLoadingMission] = useState(false);
  const [showClefOpening, setShowClefOpening] = useState(false);
  const [clefReward, setClefReward] = useState<any>(null);
  const [activeOpeningMissionId, setActiveOpeningMissionId] = useState<string | null>(null);
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);
  const [isSavingScore, setIsSavingScore] = useState(false);
  const [missionProgress, setMissionProgress] = useState({
    bemol: 0,
    sustenido: 0,
    minor: 0,
    perfectCount: 0,
    maxCombo: 0
  });

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
      try {
        const deviceId = getDeviceId();
        const { data } = await supabase
          .from('players')
          .select('name, selected_card_id, acorde_coins, accumulated_xp')
          .eq('device_id', deviceId)
          .maybeSingle();

        if (data) {
          setStats(prev => ({
            ...prev,
            playerName: data.name || prev.playerName,
            selectedCardId: data.selected_card_id,
            acordeCoins: (data.acorde_coins !== null && data.acorde_coins !== undefined) ? data.acorde_coins : prev.acordeCoins,
            accumulatedXP: (data.accumulated_xp !== null && data.accumulated_xp !== undefined) ? data.accumulated_xp : prev.accumulatedXP
          }));

          // Buscar missões diárias após o sync do perfil
          fetchDailyMissions();
        }
      } catch (error) {
        console.error('Error syncing profile:', error);
      } finally {
        setSyncDone(true);
      }

      const currentVersion = '6.3.0';
      const lastSeen = localStorage.getItem('chordRush_version');
      if (lastSeen !== currentVersion) {
        setShowChangelog(true);
      }
    };
    syncProfile();
  }, []);

  const closeChangelog = () => {
    localStorage.setItem('chordRush_version', '6.3.0');
    setShowChangelog(false);
  };

  const handleNameChange = (name: string) => {
    setStats(prev => ({ ...prev, playerName: name.toUpperCase() }));
  };

  const savePlayerProfile = async () => {
    const deviceId = getDeviceId();
    const nameToSave = stats.playerName.trim() || `JOGADOR-${deviceId.slice(0, 4)}`;
    try {
      // Usamos RPC para que o Matheus não consiga injetar 'xp: 99999' no meio do comando de nome
      const { error } = await supabase.rpc('update_player_name_secure', {
        device_id_param: deviceId,
        new_name: nameToSave
      });

      if (error) throw error;
      setIsRenaming(false);
      return true;
    } catch (err) {
      console.error('Erro ao salvar perfil (Seguro):', err);
      return null;
    }
  };

  const fetchDailyMissions = async () => {
    try {
      setLoadingMission(true);
      const deviceId = getDeviceId();
      const { data, error } = await supabase.rpc('get_or_assign_daily_mission', {
        device_id_param: deviceId
      });

      if (error) throw error;
      setDailyMissions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Erro ao buscar missões:', err);
    } finally {
      setLoadingMission(false);
    }
  };

  const updateMissionProgress = async () => {
    if (dailyMissions.length === 0) return;

    for (const mission of dailyMissions) {
      if (mission.is_completed) continue;

      let valueToAdd = 0;
      switch (mission.goal_type) {
        case 'bemol_count': valueToAdd = missionProgress.bemol; break;
        case 'sustenido_count': valueToAdd = missionProgress.sustenido; break;
        case 'minor_count': valueToAdd = missionProgress.minor; break;
        case 'max_combo': valueToAdd = missionProgress.maxCombo; break;
        case 'session_xp': valueToAdd = sessionXP; break;
        case 'perfect_sequence': valueToAdd = missionProgress.perfectCount; break;
        case 'games_played': valueToAdd = 1; break;
      }

      if (valueToAdd <= 0) continue;

      try {
        const targetValue = mission.goal_type === 'max_combo' || mission.goal_type === 'perfect_sequence' || mission.goal_type === 'session_xp'
          ? Math.max(mission.current_value, valueToAdd)
          : mission.current_value + valueToAdd;

        const { data, error } = await supabase
          .from('player_missions')
          .update({
            current_value: targetValue,
            is_completed: targetValue >= mission.goal_value
          })
          .eq('id', mission.id)
          .select()
          .single();

        if (error) throw error;

        if (data) {
          setDailyMissions(prev => prev.map(m => m.id === data.id ? { ...m, ...data } : m));
        }
      } catch (err) {
        console.error('Erro ao atualizar missão:', err);
      }
    }
  };

  const openClef = async (missionId: string) => {
    try {
      const { data, error } = await supabase.rpc('open_music_clef', {
        mission_id_param: missionId
      });

      if (error) throw error;

      setClefReward(data);
      setActiveOpeningMissionId(missionId);
      setShowClefOpening(true);

      setDailyMissions(prev => prev.map(m => m.id === missionId ? { ...m, reward_claimed: true } : m));

      // Atualizar saldos localmente
      if (data.type === 'acorde_coins') {
        setStats(prev => ({ ...prev, acordeCoins: prev.acordeCoins + data.amount }));
      } else if (data.type === 'patente_xp') {
        setStats(prev => ({ ...prev, accumulatedXP: prev.accumulatedXP + data.amount }));
      }
    } catch (err) {
      console.error('Erro ao abrir clave:', err);
    }
  };

  const startNewGame = async (selectedMode: GameMode) => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);

    isEndingRef.current = false;
    setMode(selectedMode);
    setCurrentLevel(1);
    setTimeLeft(60);
    setScore(0);
    setHits(0);
    setSessionXP(0);
    setCombo(0);
    setFeedback(null);

    const initialPool = getChordsForLevel(1);
    let firstChord = initialPool[0];
    if (firstChord.symbol === lastSessionFirstChord) {
      shuffle(initialPool);
      firstChord = initialPool[0];
    }
    setLastSessionFirstChord(firstChord.symbol);

    const deviceId = getDeviceId();
    // Segurança: Avisa o banco que uma partida legítima começou (Não bloqueamos para agilizar o início)
    supabase.rpc('start_game_session', { device_id_param: deviceId });

    setChordsPool(initialPool);
    setCurrentIndex(0);
    setCurrentOptions(generateOptions(initialPool[0]));
    setGameState(GameState.PLAYING);

    // Resetar progresso da sessão para missões
    setMissionProgress({
      bemol: 0,
      sustenido: 0,
      minor: 0,
      perfectCount: 0,
      maxCombo: 0
    });
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

    // Captura os valores do estado NO MOMENTO do fim do jogo
    const finalScore = score;
    const finalLevel = currentLevel;
    const finalXP = sessionXP;

    setGameState(GameState.GAMEOVER);
    setStats(prev => ({
      ...prev,
      highScore: Math.max(prev.highScore, finalScore),
      acordeCoins: prev.acordeCoins + Math.floor(finalXP * 0.1),
      accumulatedXP: (prev.accumulatedXP || 0) + finalXP
    }));

    // Sincronizar progresso da missão
    await updateMissionProgress();

    setIsSavingScore(true);
    const deviceId = getDeviceId();
    const { data: saveResult, error } = await supabase.rpc('secure_end_game_v5', {
      device_id_param: deviceId,
      score_param: finalScore,
      level_param: finalLevel,
      xp_param: finalXP
    });

    if (error) {
      console.error('Erro grave V5:', error.message);
      alert('⚠️ ERRO AO SALVAR: ' + error.message);
    } else {
      console.log('Score V5 registrado:', saveResult);
      if (saveResult?.status === 'success') {
        alert('✅ PONTUAÇÃO REGISTRADA: ' + finalScore + ' pts');
      }
    }
    setIsSavingScore(false);
  };

  const handleAnswer = (selectedNote: NoteName) => {
    const currentChord = chordsPool[currentIndex];
    if (selectedNote === currentChord.note) {
      const pointsGain = 10 * currentLevel;
      const newScore = score + pointsGain;
      const newHits = (prevHits: number) => prevHits + 1;
      const newCombo = combo + 1;
      const xpGain = getXPForLevel(currentLevel);
      const bonus = getTimeBonus(currentLevel);

      setScore(newScore);
      setHits(prev => prev + 1);
      setCombo(newCombo);
      setSessionXP(prev => prev + xpGain);
      setFeedback({ type: 'correct', note: currentChord.note });
      setTimeLeft(prev => Math.min(prev + bonus, 600));
      setTimeAdded(bonus);
      setTimeout(() => setTimeAdded(null), 1000);

      // Rastrear progresso da missão
      setMissionProgress(prev => ({
        ...prev,
        bemol: currentChord.symbol.includes('b') ? prev.bemol + 1 : prev.bemol,
        sustenido: currentChord.symbol.includes('#') ? prev.sustenido + 1 : prev.sustenido,
        minor: currentChord.symbol.includes('m') ? prev.minor + 1 : prev.minor,
        perfectCount: prev.perfectCount + 1,
        maxCombo: Math.max(prev.maxCombo, newCombo)
      }));

      // Aumentar nível a cada 10 acertos reais
      if ((hits + 1) % 10 === 0 && (hits + 1) > 0 && currentLevel < 7) setCurrentLevel(prev => prev + 1);
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

  const progressPercentage = (hits % 10) * 10;
  const isGlowing = combo >= 3;
  const isOnFire = combo >= 7;
  const glowIntensity = Math.min(combo * 5, 50);

  const selectedEffectCard = CARDS.find(c => c.id === stats.selectedCardId);

  return (
    <div className={`fixed inset-0 transition-colors duration-1000 ${gameState === GameState.PLAYING ? THEMES[currentLevel as keyof typeof THEMES] : 'bg-[#0a0a0a]'} text-white flex flex-col items-center select-none overflow-hidden`}>

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
                <p className="text-white/20 font-black text-[9px] uppercase tracking-widest">Version 7.2.5</p>
              </div>
            </div>

            <div className="w-full space-y-4">
              {((!stats.playerName || stats.playerName.length <= 1 || isRenaming) && syncDone) ? (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom duration-500">
                  <div className="space-y-2">
                    <p className="text-white/40 text-[10px] font-black uppercase tracking-widest text-center">
                      {stats.playerName.length <= 1 ? 'Seu nome é muito curto' : 'Como quer ser chamado?'}
                    </p>
                    <input
                      type="text"
                      placeholder="DIGITE SEU NOME"
                      value={stats.playerName || ''}
                      onChange={(e) => handleNameChange(e.target.value)}
                      className="w-full bg-white/5 border-2 border-white/10 rounded-2xl p-5 text-center text-xl font-black uppercase focus:outline-none focus:border-white/30 transition-all placeholder:text-white/10"
                    />
                    <p className="text-[9px] text-white/20 text-center uppercase font-bold">Mínimo 2 caracteres</p>
                  </div>
                  <button
                    onClick={() => stats.playerName.trim().length >= 2 && savePlayerProfile()}
                    disabled={stats.playerName.trim().length < 2}
                    className={`w-full relative overflow-hidden bg-white text-black font-black py-5 rounded-2xl text-2xl transition-all shadow-[0_8px_0_#d4d4d4] active:shadow-none active:translate-y-[8px] uppercase ${stats.playerName.trim().length < 2 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-neutral-100'}`}
                  >
                    CONFIRMAR NOME
                  </button>
                  {isRenaming && (
                    <button onClick={() => setIsRenaming(false)} className="w-full text-white/30 text-[10px] font-black uppercase tracking-widest py-2">Cancelar</button>
                  )}
                </div>
              ) : (
                <div className="space-y-5 w-full">
                  <button
                    onClick={() => stats.playerName.trim() && startNewGame(GameMode.NORMAL)}
                    disabled={!stats.playerName.trim() || !syncDone}
                    className={`w-full relative overflow-hidden bg-white text-black font-black py-5 rounded-2xl text-2xl transition-all shadow-[0_8px_0_#d4d4d4] active:shadow-none active:translate-y-[8px] uppercase ${(!stats.playerName.trim() || !syncDone) ? 'opacity-30 cursor-not-allowed' : 'hover:bg-neutral-100'}`}
                  >
                    JOGAR AGORA
                  </button>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setGameState(GameState.STORE)}
                      className="w-full relative overflow-hidden bg-white/5 border border-white/10 text-white font-black p-4 rounded-2xl text-[11px] tracking-widest transition-all flex items-center justify-center gap-2 hover:bg-white/10 active:scale-95 uppercase"
                    >
                      <i className="fa-solid fa-cart-shopping text-white/50"></i>
                      Loja de Cards
                    </button>
                    <button
                      onClick={() => setGameState(GameState.RANKING)}
                      className="w-full bg-white/5 border border-white/10 text-white font-black p-4 rounded-2xl text-[11px] tracking-widest transition-all flex items-center justify-center gap-2 hover:bg-white/10 active:scale-95 uppercase"
                    >
                      <i className="fa-solid fa-trophy text-yellow-500"></i>
                      Ranking Global
                    </button>
                  </div>

                  {syncDone && (
                    <div className="space-y-2">
                      <div
                        onClick={() => setShowPatentsModal(true)}
                        className={`group w-full flex justify-between items-center rounded-[32px] p-6 border shadow-2xl backdrop-blur-md relative overflow-hidden transition-all duration-500 cursor-pointer active:scale-[0.98] ${selectedEffectCard ? 'bg-transparent border-white/10' : 'bg-neutral-900/40 border-white/5'}`}
                      >
                        {/* EFEITOS ESPECIAIS (MESMO DO RANKING) */}
                        {selectedEffectCard?.rarity === 'lendário' && (
                          <>
                            <div className="absolute -inset-10 z-0 animate-pulse blur-3xl opacity-20 rounded-[60px] bg-yellow-400/20" />
                            <div className="absolute inset-x-[-20px] inset-y-[-10px] z-0 pointer-events-none mix-blend-screen opacity-40 overflow-hidden rounded-[40px]">
                              <video autoPlay loop muted playsInline className="w-full h-full object-cover scale-[1.1]">
                                <source src="/assets/cards/l1_effect.mp4" type="video/mp4" />
                              </video>
                            </div>
                          </>
                        )}

                        {selectedEffectCard?.rarity === 'épico' && (
                          <div className="absolute -inset-4 z-0 animate-pulse blur-3xl opacity-20 rounded-[40px] bg-orange-600" />
                        )}

                        {selectedEffectCard && (
                          <>
                            <div className="absolute inset-0 bg-cover bg-center opacity-60 transition-all duration-700" style={{ backgroundImage: selectedEffectCard.image }} />
                            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/60 to-transparent" />

                            {/* BRILHO LATERAL CRISTALINO (MESMO DO RANKING) */}
                            <div className="absolute left-0 top-0 bottom-0 w-1 z-20 overflow-hidden">
                              <div className={`h-full relative ${selectedEffectCard.rarity === 'lendário' ? 'bg-gradient-to-b from-yellow-300 via-white to-yellow-600 shadow-[0_0_15px_rgba(250,204,21,1)]' :
                                selectedEffectCard.rarity === 'épico' ? 'bg-orange-500' :
                                  selectedEffectCard.rarity === 'raro' ? 'bg-cyan-400' :
                                    'bg-blue-400'
                                }`}>
                                <div className={`absolute inset-0 bg-gradient-to-t from-transparent via-white/80 to-transparent ${selectedEffectCard.rarity === 'lendário' ? 'animate-[bounce_2s_infinite]' : 'bg-white/40 animate-[pulse_2s_infinite]'}`} />
                              </div>
                            </div>
                          </>
                        )}

                        <div className="flex flex-col relative z-20 min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <div className={`px-2 py-0.5 rounded-full border transition-all flex items-center gap-1.5 ${getPlayerTitle(stats.accumulatedXP || 0).border}`}>
                              <span className={`text-[6px] uppercase font-black tracking-widest ${getPlayerTitle(stats.accumulatedXP || 0).style}`}>
                                {getPlayerTitle(stats.accumulatedXP || 0).title}
                              </span>
                            </div>
                            <span className="text-[7px] font-black text-white/20 uppercase tracking-[0.2em]">Dossiê do Atleta</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-black text-2xl text-white tracking-tight break-words pr-2 line-clamp-1 uppercase drop-shadow-lg">
                              {stats.playerName || '---'}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsRenaming(true);
                              }}
                              className="bg-white/5 hover:bg-white/10 p-2 rounded-xl text-white/40 transition-colors border border-white/5"
                            >
                              <i className="fa-solid fa-pen text-[x-small]"></i>
                            </button>
                          </div>
                          <div className="flex items-center gap-4 mt-2">
                            <div className="flex flex-col">
                              <span className="text-[6px] text-white/30 font-black uppercase tracking-widest">XP Acumulado</span>
                              <span className="text-xs font-black text-orange-400 tracking-tighter">{(stats.accumulatedXP || 0).toLocaleString()} <span className="text-[6px] opacity-50">XP</span></span>
                            </div>
                            <div className="w-px h-6 bg-white/10" />
                            <div className="flex flex-col">
                              <span className="text-[6px] text-white/30 font-black uppercase tracking-widest">Saldo Atual</span>
                              <div className="flex items-center gap-1">
                                <i className="fa-solid fa-coins text-[8px] text-yellow-500"></i>
                                <span className="text-xs font-black text-white tracking-tighter">{(stats.acordeCoins || 0).toLocaleString()} <span className="text-[6px] opacity-30">Coins</span></span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="relative z-20 ml-2">
                          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <i className="fa-solid fa-chevron-right text-white/10 text-xs"></i>
                          </div>
                        </div>
                      </div>

                      {/* BARRA DE PROGRESSO DO NÍVEL ATUAL */}
                      <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-orange-500 rounded-full transition-all duration-1000"
                          style={{ width: `${getNextLevelProgress(stats.accumulatedXP || 0)}%` }}
                        />
                      </div>

                      {/* ÁREA DE MISSÕES DIÁRIAS (5 MISSÕES) */}
                      <div className="w-full flex flex-col gap-2 mt-4">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-[8px] font-black text-white/40 uppercase tracking-[0.2em]">Missões do Dia</span>
                          <span className="text-[8px] font-black text-orange-500 uppercase">{dailyMissions.filter(m => m.is_completed).length} / 5</span>
                        </div>

                        <div className="flex flex-col gap-2 max-h-[280px] overflow-y-auto no-scrollbar pr-1 pb-2">
                          {loadingMission ? (
                            <div className="flex items-center justify-center py-8 bg-white/5 rounded-2xl border border-white/10">
                              <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                            </div>
                          ) : dailyMissions.length > 0 ? (
                            dailyMissions.map((mission) => (
                              <div
                                key={mission.id}
                                onClick={() => setSelectedMissionId(selectedMissionId === mission.id ? null : mission.id)}
                                className={`w-full rounded-2xl p-4 border transition-all duration-500 relative flex flex-col gap-2 cursor-pointer ${mission.is_completed && !mission.reward_claimed ? 'bg-orange-600/20 border-orange-500/50 shadow-[0_0_20px_rgba(249,115,22,0.1)]' : 'bg-white/5 border-white/10'} ${selectedMissionId === mission.id ? 'ring-2 ring-orange-500/30' : ''}`}
                              >
                                <div className="flex items-center justify-between gap-4 w-full">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-[7px] font-black uppercase tracking-widest text-orange-500">
                                        Recompensa Sorteada
                                      </span>
                                      {mission.is_completed && <span className="bg-green-500 text-white text-[6px] px-1.5 py-0.5 rounded font-black uppercase animate-pulse">Pronto!</span>}
                                    </div>
                                    <h4 className="text-[10px] font-black text-white uppercase leading-tight mb-1">{mission.title}</h4>

                                    <div className="mt-2 w-full h-1 bg-white/10 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full transition-all duration-1000 ${mission.is_completed ? 'bg-green-500' : 'bg-orange-500'}`}
                                        style={{ width: `${Math.min(100, (mission.current_value / mission.goal_value) * 100)}%` }}
                                      />
                                    </div>
                                    <div className="flex justify-between mt-1">
                                      <span className="text-[6px] font-black text-white/30 uppercase tracking-widest">
                                        {mission.current_value.toLocaleString()} / {mission.goal_value.toLocaleString()}
                                      </span>
                                    </div>
                                  </div>

                                  {mission.is_completed && !mission.reward_claimed ? (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); openClef(mission.id); }}
                                      className="px-4 py-2 bg-gradient-to-br from-orange-400 to-orange-600 text-white font-black rounded-xl text-[8px] uppercase tracking-widest transition-all active:scale-95 animate-bounce shadow-xl shadow-orange-500/20"
                                    >
                                      Abrir
                                    </button>
                                  ) : mission.reward_claimed ? (
                                    <div className="opacity-30">
                                      <i className="fa-solid fa-circle-check text-xl text-green-500"></i>
                                    </div>
                                  ) : (
                                    <div className="w-10 h-10 relative flex-shrink-0 grayscale opacity-40">
                                      <img src="/assets/clefs/clef_comum.png" className="w-full h-full object-contain" />
                                    </div>
                                  )}
                                </div>

                                {selectedMissionId === mission.id && (
                                  <div className="border-t border-white/5 pt-2 animate-in fade-in slide-in-from-top duration-300">
                                    <p className="text-[9px] text-white/50 font-medium leading-relaxed uppercase tracking-wider">{mission.description}</p>
                                  </div>
                                )}
                              </div>
                            ))
                          ) : (
                            <div className="text-center py-6 bg-white/5 rounded-2xl border border-white/10">
                              <p className="text-[8px] text-white/20 font-black uppercase">Buscando missões...</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div >
      )}

      {
        gameState === GameState.PLAYING && (
          <div className="w-full h-full max-h-screen flex flex-col p-4 overflow-hidden relative">
            <div className="flex justify-end mb-2">
              <button onClick={endGame} className="px-4 py-2 bg-black/20 text-red-500 border border-red-500/30 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all active:scale-95 flex items-center justify-center gap-2">
                <i className="fa-solid fa-flag-checkered"></i> Encerrar
              </button>
            </div>
            <div className="flex justify-between items-center mb-2 relative">
              {/* Overlay de Missões (Mini) */}
              <div className="absolute top-24 left-0 right-0 flex justify-center gap-2 pointer-events-none z-10 px-4 scale-90 sm:scale-100">
                {dailyMissions.filter(m => !m.is_completed).slice(0, 2).map(m => {
                  let currentProgress = 0;
                  switch (m.goal_type) {
                    case 'bemol_count': currentProgress = missionProgress.bemol; break;
                    case 'sustenido_count': currentProgress = missionProgress.sustenido; break;
                    case 'minor_count': currentProgress = missionProgress.minor; break;
                    case 'max_combo': currentProgress = missionProgress.maxCombo; break;
                    case 'session_xp': currentProgress = sessionXP; break;
                    case 'perfect_sequence': currentProgress = missionProgress.perfectCount; break;
                  }
                  return (
                    <div key={m.id} className="bg-black/80 backdrop-blur-xl p-3 rounded-xl border border-white/10 shadow-2xl animate-in slide-in-from-top duration-500 w-44">
                      <div className="text-[9px] font-black text-orange-500 uppercase tracking-widest leading-tight mb-1 truncate">{m.title}</div>
                      <div className="flex items-center justify-between mt-1 gap-2">
                        <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                          <div
                            className="h-full bg-orange-500 transition-all duration-500 rounded-full"
                            style={{ width: `${Math.min(100, (currentProgress / m.goal_value) * 100)}%` }}
                          />
                        </div>
                        <span className="text-[9px] font-black text-white tabular-nums shrink-0">{currentProgress}/{m.goal_value}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

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
                <span className="text-[8px] font-black opacity-40 uppercase tracking-widest">Ranking Pontos</span>
                <span className="text-xl font-black tabular-nums text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.3)]">{score.toLocaleString()}</span>
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
        )
      }

      {
        gameState === GameState.GAMEOVER && (
          <div className="w-full h-full max-h-screen flex flex-col items-center justify-between p-6 bg-[#0a0a0a] pop-in overflow-hidden text-center pt-8 pb-8">
            <div className="w-full">
              <div className="text-white/30 text-[10px] font-black uppercase tracking-[0.4em] mb-2">Sessão Finalizada</div>
              <h2 className="text-4xl font-black italic tracking-tighter">FIM DE <span className="text-orange-500">JOGO</span></h2>
            </div>
            <div className="w-full max-w-sm space-y-4">
              <div className="bg-white/5 rounded-3xl p-6 border border-white/10 text-center flex flex-col items-center gap-1 shadow-inner">
                <span className="text-xs font-bold opacity-40 uppercase tracking-widest">Sua Pontuação</span>
                <span className="text-6xl font-black text-yellow-400 drop-shadow-[0_0_20px_rgba(250,204,21,0.4)] mb-4">{score.toLocaleString()}</span>

                <div className="grid grid-cols-2 gap-3 w-full">
                  <div className="bg-black/30 rounded-2xl p-4 text-center border border-white/5 flex flex-col items-center">
                    <span className="text-[8px] font-black opacity-40 block uppercase mb-1 tracking-widest">Patente XP</span>
                    <span className="text-xl font-black text-blue-400">+{sessionXP}</span>
                  </div>
                  <div className="bg-black/30 rounded-2xl p-4 text-center border border-white/5 flex flex-col items-center">
                    <span className="text-[8px] font-black opacity-40 block uppercase mb-1 tracking-widest">Coins Ganhos</span>
                    <span className="text-xl font-black text-yellow-500">+{Math.floor(sessionXP * 0.1)}</span>
                  </div>
                </div>
                <div className="w-full mt-3 bg-black/30 rounded-2xl p-4 text-center border border-white/5">
                  <span className="text-[8px] font-black opacity-40 block uppercase mb-1 tracking-widest">Nível Final</span>
                  <span className="text-xl font-black text-orange-400">LEVEL {currentLevel}</span>
                </div>
              </div>

              <div className="w-full space-y-3">
                <button onClick={() => startNewGame(mode)} className="w-full bg-orange-500 text-white font-black p-4 rounded-2xl text-lg active:scale-95 transition-all shadow-2xl border-b-4 border-orange-700 uppercase"> Jogar Novamente </button>
                <button onClick={() => setGameState(GameState.MENU)} className="w-full bg-white/10 text-white font-black p-4 rounded-2xl text-lg active:scale-95 transition-all border-b-4 border-white/5 uppercase"> Voltar ao Menu </button>
                <button
                  onClick={() => setGameState(GameState.RANKING)}
                  disabled={isSavingScore}
                  className={`w-full py-2 text-yellow-500 font-bold uppercase tracking-widest text-[10px] active:scale-95 transition-all flex items-center justify-center gap-2 ${isSavingScore ? 'opacity-50' : ''}`}
                >
                  {isSavingScore ? (
                    <><div className="w-3 h-3 border-2 border-yellow-500/20 border-t-yellow-500 rounded-full animate-spin"></div> Salvando...</>
                  ) : (
                    <><i className="fa-solid fa-trophy"></i> Ranking Semanal</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {gameState === GameState.RANKING && (<RankingBoard onBack={() => setGameState(GameState.MENU)} />)}

      {
        gameState === GameState.STORE && (
          <CardStore
            onBack={() => setGameState(GameState.MENU)}
            acordeCoins={stats.acordeCoins}
            onXPUpdate={(newXP) => setStats(prev => ({ ...prev, acordeCoins: newXP }))}
            accumulatedXP={stats.accumulatedXP || 0}
            selectedCardId={stats.selectedCardId}
            onCardSelect={(cardId) => setStats(prev => ({ ...prev, selectedCardId: cardId }))}
          />
        )
      }

      {
        showClefOpening && clefReward && (
          <ClefOpeningModal
            reward={clefReward}
            onClose={() => {
              setShowClefOpening(false);
              setClefReward(null);
            }}
          />
        )
      }

      {
        showChangelog && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="w-full max-w-md bg-neutral-900 border border-white/10 rounded-[40px] p-8 relative shadow-[0_30px_60px_rgba(0,0,0,0.8)] overflow-hidden text-center">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-500 to-amber-500"></div>
              <button onClick={closeChangelog} className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center bg-white/5 rounded-full text-white/40 hover:text-white transition-colors">
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
              <div className="mb-8">
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-yellow-500 mb-2 block">Polimento de Elite</span>
                <h2 className="text-4xl font-black italic tracking-tighter uppercase leading-none text-white">UPDATE <span className="text-yellow-500">V6.1.0</span></h2>
              </div>
              <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2 no-scrollbar text-left text-white">
                <div className="flex gap-4">
                  <div className="w-10 h-10 flex-shrink-0 bg-yellow-400/10 rounded-2xl flex items-center justify-center text-yellow-300 border border-yellow-400/20">
                    <i className="fa-solid fa-wand-magic-sparkles text-xl"></i>
                  </div>
                  <div>
                    <h4 className="font-black text-xs uppercase tracking-widest text-white mb-1">Efeito Backlight</h4>
                    <p className="text-[11px] text-white/50 leading-relaxed">O efeito especial agora roda **por trás** do card, criando um brilho de borda imponente sem atrapalhar a leitura do seu nome.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-10 h-10 flex-shrink-0 bg-white/10 rounded-2xl flex items-center justify-center text-white border border-white/20">
                    <i className="fa-solid fa-compress text-xl"></i>
                  </div>
                  <div>
                    <h4 className="font-black text-xs uppercase tracking-widest text-white mb-1">Área Refinada</h4>
                    <p className="text-[11px] text-white/50 leading-relaxed">Reduzimos o espaço de ocupação do efeito para que ele fique mais elegante e focado no seu ranking.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-10 h-10 flex-shrink-0 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-500 border border-amber-500/20">
                    <i className="fa-solid fa-eye text-xl"></i>
                  </div>
                  <div>
                    <h4 className="font-black text-xs uppercase tracking-widest text-white mb-1">Legibilidade Pró</h4>
                    <p className="text-[11px] text-white/50 leading-relaxed">Ajustamos a opacidade e as camadas (z-index) para que a Supernova brilhe sem esconder os números.</p>
                  </div>
                </div>
              </div>
              <button onClick={closeChangelog} className="w-full mt-8 bg-white text-black font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-xl">VAMOS JOGAR!</button>
            </div>
          </div>
        )
      }

      {
        showPatentsModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl animate-in zoom-in duration-300 shadow-2xl">
            <div className="w-full max-w-sm bg-neutral-900 border-2 border-white/10 rounded-[40px] p-8 relative shadow-2xl overflow-hidden">
              <button onClick={() => setShowPatentsModal(false)} className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center bg-white/5 rounded-full text-white/40 hover:text-white transition-colors">
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
              <div className="mb-8 text-center sm:text-left">
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-500 mb-2 block">Hierarquia Musical</span>
                <h2 className="text-4xl font-black italic tracking-tighter uppercase leading-none text-white">PATENTES</h2>
                <p className="text-[10px] text-white/30 uppercase font-bold tracking-widest mt-2 px-1">Seu XP Total desbloqueia novos títulos</p>
              </div>
              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2 no-scrollbar text-left">
                {[
                  { name: 'Iniciante', xp: 0, style: 'text-white/40', bg: 'bg-white/5' },
                  { name: 'Estudante', xp: 5000, style: 'text-orange-400', bg: 'bg-orange-400/10' },
                  { name: 'Avançado', xp: 15000, style: 'text-blue-400', bg: 'bg-blue-400/10' },
                  { name: 'Solista', xp: 30000, style: 'text-emerald-400', bg: 'bg-emerald-400/10' },
                  { name: 'Virtuoso', xp: 50000, style: 'text-cyan-400', bg: 'bg-cyan-400/10' },
                  { name: 'Mestre', xp: 75000, style: 'text-purple-400', bg: 'bg-purple-400/10' },
                  { name: 'Lenda', xp: 100000, style: 'text-yellow-400', bg: 'bg-yellow-400/10' },
                ].reverse().map((p, i) => (
                  <div key={i} className={`flex items-center justify-between p-4 rounded-2xl border border-white/5 ${p.bg}`}>
                    <span className={`font-black uppercase tracking-widest text-[11px] ${p.style}`}>{p.name}</span>
                    <div className="flex items-center gap-2">
                      <i className="fa-solid fa-bolt text-[10px] text-orange-500 opacity-50"></i>
                      <span className="text-white font-black tabular-nums text-xs">{p.xp.toLocaleString()} <span className="text-[8px] opacity-30">XP</span></span>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => setShowPatentsModal(false)} className="w-full mt-8 bg-white text-black font-black py-4 rounded-2xl text-xs uppercase tracking-widest active:scale-95 transition-all shadow-xl">FECHAR LISTA</button>
            </div>
          </div>
        )
      }
    </div >
  );
};

export default App;
