
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
import { StoryModal } from './components/StoryModal';
import { DialogueOverlay } from './components/DialogueOverlay';
import { BossVictoryModal } from './components/BossVictoryModal';
import { ARENA_DIALOGUES, DialogueInteraction } from './utils/dialogues';
import { getCurrentArena, ARENAS } from './utils/arenas';

const App: React.FC = () => {
  const [stats, setStats] = useState<GameStats>(() => {
    const saved = localStorage.getItem('chordRush_stats');
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        playerName: parsed.playerName || '',
        highScore: parsed.highScore || 0,
        acordeCoins: parsed.acordeCoins || 0,
        selectedCardId: parsed.selectedCardId,
        accumulatedXP: parsed.accumulatedXP || 0,
        recoveryPin: parsed.recoveryPin,
        unlockedArenaId: parsed.unlockedArenaId || 1,
        seenStoryIds: parsed.seenStoryIds || [],
        lastPlayedArenaId: parsed.lastPlayedArenaId || 1
      };
    }
    return { playerName: '', highScore: 0, acordeCoins: 0, accumulatedXP: 0, recoveryPin: '', unlockedArenaId: 1, seenStoryIds: [], lastPlayedArenaId: 1 };
  });

  const calculateCurrentArena = () => {
    const xpArena = getCurrentArena(stats.accumulatedXP || 0);
    const unlockedId = stats.unlockedArenaId || 1;
    const lastPlayedId = stats.lastPlayedArenaId || 1;

    // Priorizamos a que ele jogou por último, DESDE QUE ele tenha XP e Progressão para ela
    // Se o lastPlayedId for maior do que ele desbloqueou, forçamos o unlockId.
    const effectiveUnlocked = Math.min(xpArena.id, unlockedId);

    // Se a arena que ele jogou por último ainda é válida (desbloqueada), usamos ela.
    // Caso contrário, usamos a maior possível.
    const selectedId = (lastPlayedId <= effectiveUnlocked) ? lastPlayedId : effectiveUnlocked;

    return ARENAS.find(a => a.id === selectedId) || ARENAS[0];
  };

  const currentArena = calculateCurrentArena();

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
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryPinInput, setRecoveryPinInput] = useState('');
  const [tempName, setTempName] = useState('');
  const [showNameModal, setShowNameModal] = useState(false);
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

  const [bossStatus, setBossStatus] = useState<'idle' | 'taking-damage' | 'attacking'>('idle');
  const [playerHP, setPlayerHP] = useState(100);
  const [activeMissionNotifId, setActiveMissionNotifId] = useState<string | null>(null);
  const notifTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [projectiles, setProjectiles] = useState<Array<{ id: number, x: number, y: number, isSpecial: boolean }>>([]);
  const [isSpecialCharged, setIsSpecialCharged] = useState(false);
  const [showBossIntro, setShowBossIntro] = useState(false);
  const [bossPhrase, setBossPhrase] = useState('');
  const [activeStoryId, setActiveStoryId] = useState<number | null>(null);
  const [showBossVictory, setShowBossVictory] = useState(false);
  const [victoryHandled, setVictoryHandled] = useState(false);
  const [interferenceActive, setInterferenceActive] = useState<string | null>(null);
  const [isGameCompleted, setIsGameCompleted] = useState(false);

  // Dialogue System State
  const [activeDialogue, setActiveDialogue] = useState<DialogueInteraction | null>(null);
  const dialogueTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastDialogueIdRef = useRef<string | null>(null);
  const lastAttackTimeRef = useRef<number>(Date.now());
  const [isShaking, setIsShaking] = useState(false);
  const counterAttackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Constants have been moved to ARENAS config.
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const attackSfxRef = useRef<HTMLAudioElement | null>(null);
  const damageSfxRef = useRef<HTMLAudioElement | null>(null);

  const startBattleMusic = () => {
    const musicPath = currentArena.bgm;

    // Check if we need to switch tracks
    if (!bgmRef.current || !bgmRef.current.src.includes(encodeURI(musicPath))) {
      if (bgmRef.current) {
        bgmRef.current.pause();
      }
      bgmRef.current = new Audio(musicPath);
      bgmRef.current.loop = true;
      bgmRef.current.volume = 0.3;
    }

    bgmRef.current.play().catch(e => console.log("Áudio aguardando interação"));
  };

  const playAttackSfx = () => {
    if (!attackSfxRef.current) attackSfxRef.current = new Audio('/assets/audio/attack.mp3');
    attackSfxRef.current.currentTime = 0;
    attackSfxRef.current.volume = 0.4;
    attackSfxRef.current.play().catch(() => { });
  };

  const playDamageSfx = () => {
    if (!damageSfxRef.current) damageSfxRef.current = new Audio('/assets/audio/damage.mp3');
    damageSfxRef.current.currentTime = 0;
    damageSfxRef.current.volume = 0.5;
    damageSfxRef.current.play().catch(() => { });
  };

  const stopBattleMusic = () => {
    if (bgmRef.current) {
      bgmRef.current.pause();
      bgmRef.current.currentTime = 0;
    }
  };

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isEndingRef = useRef(false);
  const reactionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [bossReactionSpeech, setBossReactionSpeech] = useState<string | null>(null);

  const scoreRef = useRef(0);
  const levelRef = useRef(1);
  const sessionXPRef = useRef(0);

  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { levelRef.current = currentLevel; }, [currentLevel]);
  useEffect(() => { levelRef.current = currentLevel; }, [currentLevel]);
  useEffect(() => { sessionXPRef.current = sessionXP; }, [sessionXP]);

  useEffect(() => {
    localStorage.setItem('chordRush_stats', JSON.stringify(stats));
  }, [stats]);



  const [isLocked, setIsLocked] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState('Iniciando Boot...');
  const [debugError, setDebugError] = useState<string | null>(null);

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


  useEffect(() => {
    const initializeApp = async () => {
      try {
        setStatusMessage('Lendo Parâmetros de URL...');
        const params = new URLSearchParams(window.location.search);
        const pin = params.get('pin');
        let authorized = false;

        // 1. PIN CHECK
        if (pin) {
          setStatusMessage(`Validando PIN: ${pin}...`);
          try {
            const { data, error } = await supabase
              .from('players')
              .select('device_id')
              .eq('recovery_pin', pin)
              .maybeSingle();

            if (error) {
              throw error;
            }

            if (data && data.device_id) {
              setStatusMessage('PIN Válido! Autenticando...');
              // Login with PIN
              localStorage.setItem('chordRush_deviceId', data.device_id);
              sessionStorage.setItem('acorde_gallery_access', 'true');
              authorized = true;
            } else {
              setDebugError("PIN Inválido: Usuário não encontrado.");
              setStatusMessage("Falha na validação do PIN.");
            }
          } catch (err: any) {
            console.error("Erro Supabase PIN", err);
            setDebugError("Erro Supabase: " + (err.message || JSON.stringify(err)));
          }
        } else {
          setStatusMessage('Verificando Sessão Existente...');
          // 2. SESSION CHECK
          const hasAccess = sessionStorage.getItem('acorde_gallery_access') === 'true';
          const savedId = localStorage.getItem('chordRush_deviceId');
          if (hasAccess && savedId) {
            authorized = true;
            setStatusMessage('Sessão Restaurada.');
          } else {
            setStatusMessage('Nenhuma sessão ativa encontrada.');
          }
        }

        if (!authorized) {
          if (!debugError) setStatusMessage('Acesso Negado. Bloqueando...');
          // Delay curto para ler a mensagem se quiser
          setTimeout(() => setIsLoading(false), 500);
          setIsLocked(true);
          return; // Stop initialization
        }

        // If authorized, proceed to unlock and sync
        setStatusMessage('Desbloqueando Sistema...');
        setIsLocked(false);

        // 3. SYNC PROFILE
        setStatusMessage('Sincronizando Perfil...');
        const deviceId = getDeviceId();
        const { data: profileData, error: profileError } = await supabase
          .from('players')
          .select('name, selected_card_id, acorde_coins, accumulated_xp, recovery_pin, unlocked_arena_id, seen_story_ids, last_played_arena_id')
          .eq('device_id', deviceId)
          .maybeSingle();

        if (profileError) {
          setDebugError("Erro Sync Perfil: " + profileError.message);
        }

        if (profileData) {
          setStatusMessage('Perfil Carregado! Montando Interface...');
          setStats(prev => ({
            ...prev,
            playerName: profileData.name || prev.playerName,
            selectedCardId: profileData.selected_card_id,
            acordeCoins: (profileData.acorde_coins !== null && profileData.acorde_coins !== undefined) ? profileData.acorde_coins : prev.acordeCoins,
            accumulatedXP: (profileData.accumulated_xp !== null && profileData.accumulated_xp !== undefined) ? profileData.accumulated_xp : prev.accumulatedXP,
            recoveryPin: profileData.recovery_pin,
            unlockedArenaId: profileData.unlocked_arena_id || prev.unlockedArenaId || 1,
            seenStoryIds: profileData.seen_story_ids || prev.seenStoryIds || [],
            lastPlayedArenaId: profileData.last_played_arena_id || prev.lastPlayedArenaId || 1
          }));

          fetchDailyMissions();
        } else {
          setStatusMessage('Novo Perfil Detectado.');
          setShowNameModal(true);
        }

        setStatusMessage('Inicialização Completa!');
        setIsLoading(false); // RELEASE THE KRAKEN (GAME)

      } catch (err: any) {
        console.error("Crash Init", err);
        setDebugError("Crash Geral: " + (err.message || JSON.stringify(err)));
      }
    };

    const currentVersion = '8.0.0';
    const lastSeen = localStorage.getItem('chordRush_version');
    if (lastSeen !== currentVersion) {
      setShowChangelog(true);
    }

    initializeApp();
  }, []);


  const closeChangelog = () => {
    localStorage.setItem('chordRush_version', '8.0.0');
    setShowChangelog(false);
  };

  const savePlayerProfile = async () => {
    const deviceId = getDeviceId();
    const nameToSave = tempName.trim().toUpperCase() || `JOGADOR-${deviceId.slice(0, 4)}`;

    // OPTIMISTIC UPDATE: Update UI immediately so user isn't stuck
    setStats(prev => ({ ...prev, playerName: nameToSave }));
    setIsRenaming(false);
    setShowNameModal(false);
    setTempName('');

    // Run Backend Sync in Background
    try {
      const { error } = await supabase.rpc('update_player_name_secure', {
        device_id_param: deviceId,
        new_name: nameToSave
      });

      if (error) {
        console.error('Background Sync Error:', error);
        // Silently fail or retry - for now we let the user play
      }

      // Re-sincroniza PIN
      const { data: newData } = await supabase
        .from('players')
        .select('recovery_pin')
        .eq('device_id', deviceId)
        .maybeSingle();

      if (newData) {
        setStats(prev => ({ ...prev, recoveryPin: newData.recovery_pin }));
      }
    } catch (err) {
      console.error('Erro ao salvar perfil (Background):', err);
    }
  };

  const recoverAccount = async (name: string, pin: string) => {
    const deviceId = getDeviceId();
    try {
      const { data, error } = await supabase.rpc('recover_player_account', {
        p_name: name.toUpperCase().trim(),
        p_pin: pin.trim(),
        p_new_device_id: deviceId
      });

      if (error) throw error;

      if (data?.success) {
        alert('✅ Conta recuperada com sucesso!');
        // Re-sincroniza tudo
        const { data: recoveredProfile } = await supabase
          .from('players')
          .select('name, selected_card_id, acorde_coins, accumulated_xp, recovery_pin, unlocked_arena_id, seen_story_ids, last_played_arena_id')
          .eq('device_id', deviceId)
          .maybeSingle();

        if (recoveredProfile) {
          setStats({
            playerName: recoveredProfile.name || '',
            selectedCardId: recoveredProfile.selected_card_id,
            highScore: 0,
            acordeCoins: recoveredProfile.acorde_coins || 0,
            accumulatedXP: recoveredProfile.accumulated_xp || 0,
            recoveryPin: recoveredProfile.recovery_pin || '',
            unlockedArenaId: recoveredProfile.unlocked_arena_id || 1,
            seenStoryIds: recoveredProfile.seen_story_ids || [],
            lastPlayedArenaId: recoveredProfile.last_played_arena_id || 1
          });
        }
        setIsRenaming(false);
        return true;
      } else {
        alert('❌ Erro: ' + (data?.message || 'Falha na recuperação'));
        return false;
      }
    } catch (err: any) {
      console.error('Erro na recuperação:', err);
      alert('Erro crítico: ' + err.message);
      return false;
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

      // Atualizar saldos localmente (Claves não dão mais XP para não derrotar o Boss via Menu)
      if (data.type === 'acorde_coins') {
        setStats(prev => ({ ...prev, acordeCoins: prev.acordeCoins + data.amount }));
      }
    } catch (err) {
      console.error('Erro ao abrir clave:', err);
    }
  };

  const startNewGame = async (selectedMode: GameMode) => {
    // Check for story trigger BEFORE starting
    // Use 'currentArena.id' because it already handles Debug vs XP logic correctly at the top of the component
    const targetArenaId = currentArena.id;

    if (selectedMode !== GameMode.RUSH && !stats.seenStoryIds?.includes(targetArenaId)) {
      setActiveStoryId(targetArenaId);
      return; // Pause start until story is closed
    }

    if (timerRef.current) clearInterval(timerRef.current);
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);

    isEndingRef.current = false;
    lastAttackTimeRef.current = Date.now();
    setPlayerHP(100);
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
    // Persiste última arena jogada
    supabase.rpc('save_last_played_arena', { device_id_param: deviceId, arena_id: targetArenaId });

    setChordsPool(initialPool);
    setCurrentIndex(0);
    setCurrentOptions(generateOptions(initialPool[0]));

    // Iniciar Sequência de Intro do Boss (Pular no RUSH)
    if (selectedMode !== GameMode.RUSH) {
      const introPhrases = currentArena.boss.phrases.intro;
      const phrase = introPhrases[Math.floor(Math.random() * introPhrases.length)];
      setBossPhrase(phrase);
      setShowBossIntro(true);
      setTimeout(() => {
        setShowBossIntro(false);
      }, 4000);
    } else {
      setShowBossIntro(false);
    }

    setGameState(GameState.PLAYING);
    startBattleMusic();

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
    // Timer Lógica: Só roda se estiver PLAYING, sem intro e SEM dialogo ativo
    if (gameState === GameState.PLAYING && !showBossIntro && !activeDialogue) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => prev <= 1 ? 0 : prev - 1);
      }, 1000);

      // Configurar gatilho aleatório de diálogo
      if (!dialogueTimerRef.current) {
        dialogueTimerRef.current = setInterval(() => {
          // 15% chance a cada 5 segundos (verificado aqui a cada 1s no loop principal seria mto frequente, melhor separado ou check simples)
          // Vamos fazer um check a cada 1s mesmo, mas com chance muito baixa (ex: 2% por segundo -> ~ uma vez a cada 50s)
          // Usuário pediu "aleatoriamente". Vamos tentar algo como: a cada tick do relógio principal?
          // Melhor não poluir o timer principal.
        }, 1000);
      }
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      if (counterAttackTimerRef.current) clearInterval(counterAttackTimerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (counterAttackTimerRef.current) clearInterval(counterAttackTimerRef.current);
    };
  }, [gameState, showBossIntro, activeDialogue]);

  // EFEITO DE CONTRA-ATAQUE (BOSS BATE SE JOGADOR DEMORAR)
  useEffect(() => {
    if (gameState === GameState.PLAYING && !showBossIntro && !activeDialogue) {
      counterAttackTimerRef.current = setInterval(() => {
        const now = Date.now();
        const timeSinceLast = now - lastAttackTimeRef.current;
        const attackThreshold = currentArena.id === 5 ? 4000 : currentArena.id === 4 ? 3500 : 3000;

        if (timeSinceLast > attackThreshold) {
          // BOSS ATACA!
          setPlayerHP(prev => {
            const damage = 2 + (currentArena.id);
            const newHP = Math.max(0, prev - damage);
            if (newHP <= 0 && !isEndingRef.current) {
              setTimeout(() => endGame(), 100);
            }
            return newHP;
          });

          setBossStatus('attacking');
          setIsShaking(true);
          playDamageSfx(); // Som de dano no jogador

          // BOSS FALA AO ATACAR
          const attackPhrases = currentArena.boss.phrases.error;
          setBossReactionSpeech(attackPhrases[Math.floor(Math.random() * attackPhrases.length)]);

          setTimeout(() => {
            setBossStatus('idle');
            setIsShaking(false);
          }, 500);

          lastAttackTimeRef.current = now; // Reset timer for next hit
        }
      }, 200);
    }
    return () => { if (counterAttackTimerRef.current) clearInterval(counterAttackTimerRef.current); };
  }, [gameState, showBossIntro, activeDialogue, currentArena.id]);

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
    stopBattleMusic();
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

    // VERIFICAR DESBLOQUEIO DE ARENA (Feature de Progressão)
    // Se o jogador venceu (Score > 0 implica vitória do nível ou término com pontos)
    // E estava na arena máxima desbloqueada
    // E a barra de progresso estava cheia (Boss HP <= 0)
    const currentUnlockedId = stats.unlockedArenaId || 1;
    // Recalcula progresso localmente para ter certeza
    const xpArenaForCalc = getCurrentArena((stats.accumulatedXP || 0) + finalXP);
    // Nota: O cálculo exato de arenaProgress depende do minXP da arena atual.
    // Mas simplificando: Se a arena atual (pelo ID) é menor que a arena de XP, então progresso é 100%
    const isBossDefeated = (stats.accumulatedXP || 0) + finalXP >= nextArena.minXP;

    // Se estavamos jogando na arena limite E o Boss estava "vulnerável" (HP zero / Progresso 100%) - SOMENTE NO MODO HISTÓRIA
    if (mode !== GameMode.RUSH && currentArena.id === currentUnlockedId && isBossDefeated && finalScore > 0) {
      // Desbloquear próxima arena
      const nextId = currentUnlockedId + 1;
      // Verifica se existe próxima arena
      const existsNext = ARENAS.find(a => a.id === nextId);

      if (existsNext) {
        try {
          // Atualiza Local
          setStats(prev => ({ ...prev, unlockedArenaId: nextId, lastPlayedArenaId: nextId }));
          alert(`🏆 GUARDIÃO DERROTADO! Arena ${nextId} Desbloqueada!`);

          // Atualiza Remoto via RPC
          await supabase.rpc('unlock_next_arena', {
            device_id_param: deviceId,
            current_arena_id: currentUnlockedId
          });
        } catch (err) {
          console.error("Erro ao desbloquear arena:", err);
        }
      }
    }
  };

  const handleBossDefeatedAdvance = async () => {
    setShowBossVictory(false);
    stopBattleMusic();

    const finalScore = score;
    const finalLevel = currentLevel;
    const finalXP = sessionXP; // Note: this is the sessionXP *before* the last hit that triggered it? 
    // No, sessionXP state updates are async. But we should be close enough.
    // Actually, we should probably update state before calling this.
    // Given the modal pauses flow, sessionXP should be settled.

    const nextId = (stats.unlockedArenaId || 1) + 1;

    // Update Local Stats
    setStats(prev => ({
      ...prev,
      highScore: Math.max(prev.highScore, finalScore),
      acordeCoins: prev.acordeCoins + Math.floor(finalXP * 0.1),
      accumulatedXP: (prev.accumulatedXP || 0) + finalXP,
      unlockedArenaId: nextId,
      lastPlayedArenaId: nextId
    }));

    // Async Save
    const deviceId = getDeviceId();
    supabase.rpc('secure_end_game_v5', {
      device_id_param: deviceId,
      score_param: finalScore,
      level_param: finalLevel,
      xp_param: finalXP
    });
    supabase.rpc('unlock_next_arena', {
      device_id_param: deviceId,
      current_arena_id: nextId - 1 // Pass the arena that was just completed
    });

    // Trigger Story & New Game flow
    if (nextId >= 6) {
      setActiveStoryId(6); // Final desfecho story
    } else {
      setActiveStoryId(nextId);
    }
  };

  const handleAnswer = (selectedNote: NoteName, clickX?: number, clickY?: number) => {
    const currentChord = chordsPool[currentIndex];
    if (selectedNote === currentChord.note) {
      const pointsGain = 10 * currentLevel;
      const newScore = score + pointsGain;
      const newHits = (prevHits: number) => prevHits + 1;
      const newCombo = combo + 1;
      // DANO ESCALÁVEL (Balanceado): Metade do poder anterior
      // Arena 1: 1x
      // Arena 2: 2x
      // Arena 3: 5x
      // Arena 4: 8x
      // Arena 5: 13x
      const arenaMultiplier = Math.max(1, currentArena.id);
      const xpGain = getXPForLevel(currentLevel) * arenaMultiplier;
      const bonus = getTimeBonus(currentLevel);

      lastAttackTimeRef.current = Date.now();

      // MECÂNICA DE INTERFERÊNCIA (BOSS 4 E 5) - DESATIVADA NO RUSH
      if (mode !== GameMode.RUSH && currentArena.id >= 4) {
        // Chance de trocar alternativas (40%)
        if (Math.random() < 0.4) {
          setCurrentOptions(prev => shuffle([...prev]));
          setIsShaking(true);
          setInterferenceActive("BOTÕES EMBARALHADOS!");
          setTimeout(() => {
            setIsShaking(false);
            setInterferenceActive(null);
          }, 1200);
          setBossReactionSpeech("PRESTE ATENÇÃO!");
          setTimeout(() => setBossReactionSpeech(null), 1500);
        }
        // Chance de trocar a nota alvo (30%)
        else if (Math.random() < 0.3) {
          const newIdx = Math.floor(Math.random() * chordsPool.length);
          setCurrentIndex(newIdx);
          setCurrentOptions(generateOptions(chordsPool[newIdx]));
          setIsShaking(true);
          setInterferenceActive("NOTA ALTERADA!");
          setTimeout(() => {
            setIsShaking(false);
            setInterferenceActive(null);
          }, 1200);
          setBossReactionSpeech("MUDE O TON!");
          setTimeout(() => setBossReactionSpeech(null), 1500);
        }
      }

      setScore(newScore);
      setHits(prev => prev + 1);
      setCombo(newCombo);
      setSessionXP(prev => prev + xpGain);
      setFeedback({ type: 'correct', note: currentChord.note });
      setTimeLeft(prev => Math.min(prev + bonus, 600));
      setTimeAdded(bonus);
      setTimeout(() => setTimeAdded(null), 1000);

      // Check Boss Victory
      const currentTotalXP = (stats.accumulatedXP || 0) + sessionXP + xpGain; // sessionXP is stale in this render, but we just updated state. using prev + gain would be safer but complex to access.
      // Actually setSessionXP updater was: prev => prev + xpGain. 
      // We can use (sessionXP + xpGain) as approximation or ref.
      // Better: use sessionXPRef.current? No, updated in effect.
      // Let's use the calculated value:
      const estimatedSessionXP = sessionXP + xpGain;
      const estimatedTotalXP = (stats.accumulatedXP || 0) + estimatedSessionXP;

      const nextArena = ARENAS.find(a => a.id === currentArena.id + 1);
      if (mode !== GameMode.RUSH && nextArena && estimatedTotalXP >= nextArena.minXP && !victoryHandled) {
        setVictoryHandled(true);
        setShowBossVictory(true);
        if (timerRef.current) clearInterval(timerRef.current);
      }

      setMissionProgress(prev => {
        const isBemol = currentChord.symbol.includes('b');
        const isSust = currentChord.symbol.includes('#');
        const isMinor = currentChord.symbol.includes('m');

        const progressedMission = dailyMissions.find(m => {
          if (m.is_completed) return false;
          if (isBemol && m.goal_type === 'bemol_count') return true;
          if (isSust && m.goal_type === 'sustenido_count') return true;
          if (isMinor && m.goal_type === 'minor_count') return true;
          if (m.goal_type === 'session_xp') return true;
          if (m.goal_type === 'perfect_sequence') return true;
          return false;
        });

        if (progressedMission) {
          setActiveMissionNotifId(progressedMission.id);
          if (notifTimeoutRef.current) clearTimeout(notifTimeoutRef.current);
          notifTimeoutRef.current = setTimeout(() => setActiveMissionNotifId(null), 2000);
        }

        return {
          ...prev,
          bemol: isBemol ? prev.bemol + 1 : prev.bemol,
          sustenido: isSust ? prev.sustenido + 1 : prev.sustenido,
          minor: isMinor ? prev.minor + 1 : prev.minor,
          perfectCount: prev.perfectCount + 1,
          maxCombo: Math.max(prev.maxCombo, newCombo)
        };
      });

      // Lógica de Ataque Especial & Gatilho de Diálogo
      if (isSpecialCharged) {
        setSessionXP(prev => prev + (xpGain * 2));
        setIsSpecialCharged(false);

        // TRIGGER DIALOGUE AFTER SPECIAL ATTACK (1.5s delay for animation) - DISABLED IN RUSH
        if (mode !== GameMode.RUSH) {
          setTimeout(() => {
            const interactions = ARENA_DIALOGUES[currentArena.id] || [];
            if (interactions.length > 0) {
              if (true) {
                let pool = interactions;
                if (interactions.length > 1 && lastDialogueIdRef.current) {
                  pool = interactions.filter(i => i.id !== lastDialogueIdRef.current);
                }
                const randomInteraction = pool[Math.floor(Math.random() * pool.length)];
                lastDialogueIdRef.current = randomInteraction.id;
                setActiveDialogue(randomInteraction);
              }
            }
          }, 1500);
        }

      } else if (newCombo > 0 && newCombo % 10 === 0) {
        setIsSpecialCharged(true);
      }

      // Lançar Projetil (Somente no MODO HISTÓRIA)
      if (mode !== GameMode.RUSH) {
        const projId = Date.now();
        let startX = 0;
        let startY = 0;
        if (clickX !== undefined && clickY !== undefined) {
          startX = clickX - window.innerWidth / 2;
          startY = clickY - (window.innerHeight - 200);
        }

        setProjectiles(prev => [...prev, { id: projId, x: startX, y: startY, isSpecial: isSpecialCharged }]);
        playAttackSfx();

        if (Math.random() > 0.6) {
          const damagePhrases = currentArena.boss.phrases.damage;
          const reaction = damagePhrases[Math.floor(Math.random() * damagePhrases.length)];
          setBossReactionSpeech(reaction);
          if (reactionTimeoutRef.current) clearTimeout(reactionTimeoutRef.current);
          reactionTimeoutRef.current = setTimeout(() => setBossReactionSpeech(null), 2000);
        }

        setTimeout(() => {
          setProjectiles(prev => prev.filter(p => p.id !== projId));
          setBossStatus('taking-damage');
          playDamageSfx();
          setTimeout(() => setBossStatus('idle'), 400);
        }, 700);
      }

      if ((hits + 1) % 10 === 0 && (hits + 1) > 0 && currentLevel < 7) setCurrentLevel(prev => prev + 1);
    } else {
      setFeedback({ type: 'wrong', note: currentChord.note });
      setCombo(0);
      setIsSpecialCharged(false);
      setBossStatus('attacking');
      setPlayerHP(prev => Math.max(0, prev - 10));
      setTimeout(() => setBossStatus('idle'), 500);

      // Reação do Boss ao Erro (DESATIVADA NO RUSH)
      if (mode !== GameMode.RUSH && Math.random() > 0.4) {
        const errorPhrases = currentArena.boss.phrases.error;
        const reaction = errorPhrases[Math.floor(Math.random() * errorPhrases.length)];
        setBossReactionSpeech(reaction);
        if (reactionTimeoutRef.current) clearTimeout(reactionTimeoutRef.current);
        reactionTimeoutRef.current = setTimeout(() => setBossReactionSpeech(null), 2000);
      }
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



  const nextArena = ARENAS.find(a => a.id === currentArena.id + 1);

  let arenaProgress = 0;
  const effectiveAccumulatedXP = (stats.accumulatedXP || 0);

  const currentTotalXP = effectiveAccumulatedXP + sessionXP;

  if (nextArena) {
    // Arenas 1-4
    const range = nextArena.minXP - currentArena.minXP;
    const currentInArena = Math.max(0, currentTotalXP - currentArena.minXP);
    arenaProgress = Math.min(100, (currentInArena / range) * 100);
  } else {
    // Arena 5 (Final)
    const finalRange = 25000;
    const currentInArena = Math.max(0, currentTotalXP - currentArena.minXP);
    arenaProgress = Math.min(100, (currentInArena / finalRange) * 100);
  }

  const bossHP = 100 - arenaProgress;
  const isPlaying = gameState === GameState.PLAYING;


  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black z-[10000] flex flex-col items-center justify-center p-8 text-center font-mono">
        <div className="w-12 h-12 border-4 border-yellow-500 border-t-white rounded-full animate-spin mb-6"></div>
        <h2 className="text-xl text-yellow-500 font-bold mb-2">DEBUG MODE</h2>
        <p className="text-white text-lg animate-pulse mb-4">{statusMessage}</p>
        {debugError && (
          <div className="bg-red-900/50 border border-red-500 p-4 rounded-xl text-red-200 text-xs text-left w-full max-w-md break-all">
            <strong>ERRO CRÍTICO:</strong><br />
            {debugError}
            <button onClick={() => window.location.reload()} className="mt-4 w-full bg-red-600 text-white font-bold py-2 rounded uppercase hover:bg-red-500">Tentar Recarregar</button>
          </div>
        )}
        <div className="absolute bottom-4 text-white/20 text-[10px]">Chord Rush v8.0.0 (Slave Mode)</div>
      </div>
    );
  }

  if (isLocked) {
    return (
      <div className="fixed inset-0 bg-[#050505] flex flex-col items-center justify-center p-6 text-center z-[9999] font-sans">
        <h1 className="text-4xl font-black text-red-600 mb-6 tracking-widest uppercase">Acesso Restrito</h1>
        <p className="text-white/60 mb-8 max-w-md leading-relaxed text-sm">
          O <strong className="text-white">Chord Rush</strong> é um módulo exclusivo da <strong>Acorde Gallery</strong>.
          <br /><br />
          Para jogar, acesse a plataforma oficial.
        </p>
        <a
          href="https://acorde-gallery.vercel.app"
          className="bg-purple-700 hover:bg-purple-600 text-white font-bold py-4 px-8 rounded-xl text-lg uppercase tracking-widest transition-all shadow-lg shadow-purple-900/20"
        >
          Ir para Acorde Gallery
        </a>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#050505] flex items-center justify-center overflow-hidden">
      {/* Container "Mobile View" para Desktop */}
      <div
        className={`relative w-full h-full max-w-[480px] mx-auto shadow-[0_0_100px_rgba(0,0,0,0.5)] transition-all duration-1000 flex flex-col items-center select-none overflow-hidden ${isPlaying ? currentArena.colors.text : 'text-white'} ${isShaking ? 'shake' : ''}`}
        style={isPlaying ? {
          backgroundImage: (mode === GameMode.RUSH) ? 'none' : `url(${currentArena.bgImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundColor: (mode === GameMode.RUSH) ? '#050505' : '#0a0a0a'
        } : {
          backgroundColor: '#0a0a0a'
        }}
      >
        {/* Overlay de Proteção para Legibilidade (Apenas no Jogo) */}
        {isPlaying && <div className="absolute inset-0 z-0 pointer-events-none bg-black/40" />}

        {interferenceActive && (
          <div className="absolute inset-0 z-[150] pointer-events-none flex flex-col items-center justify-center bg-purple-900/40 animate-pulse overflow-hidden">
            <div className="text-white font-black text-4xl tracking-tighter uppercase mb-4 drop-shadow-[0_0_15px_rgba(255,255,255,0.8)] animate-bounce text-center px-6">
              {interferenceActive}
            </div>
            <div className="flex gap-2">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="w-1 h-32 bg-white/20 animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
              ))}
            </div>
          </div>
        )}

        {isPlaying && isGameCompleted && (
          <div className="fixed inset-0 z-[250] bg-black flex flex-col items-center justify-center p-8 animate-in zoom-in duration-1000 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-purple-900/30 to-black pointer-events-none" />
            <div className="relative z-10 flex flex-col items-center text-center">
              <i className="fa-solid fa-guitar text-8xl text-yellow-500 mb-6 drop-shadow-[0_0_30px_rgba(250,204,21,0.5)] animate-bounce"></i>
              <h1 className="text-5xl font-black italic tracking-tighter text-white uppercase leading-none mb-2 font-medieval">VITÓRIA GRANDIOSA!</h1>
              <p className="text-yellow-500 font-orange-500 uppercase tracking-[0.4em] text-[10px] font-black mb-8">A Harmonia foi Restaurada</p>

              <div className="space-y-4 max-w-xs text-center mb-10">
                <p className="text-white/60 text-xs leading-relaxed italic">"O Lorde Silêncio foi banido para o Vazio. Através de seus dedos, a Sinfonia Perdida volta a ecoar nos corações de Acordelot."</p>
              </div>

              <div className="flex flex-col gap-3 w-full max-w-[280px]">
                <button
                  onClick={() => {
                    setIsGameCompleted(false);
                    setGameState(GameState.MENU);
                  }}
                  className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black py-5 rounded-2xl text-lg uppercase tracking-widest active:scale-95 transition-all shadow-[0_8px_0_#a16207]"
                >
                  VOLTAR AO MENU
                </button>
                <p className="text-white/20 text-[8px] font-bold uppercase tracking-widest mt-4">Obrigado por jogar Chord Rush</p>
              </div>
            </div>

            {/* Efeitos de Fundo */}
            <div className="absolute inset-0 pointer-events-none">
              {[...Array(20)].map((_, i) => (
                <div key={i} className="absolute bg-yellow-500/20 w-1 h-1 rounded-full animate-float" style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 5}s`,
                  animationDuration: `${3 + Math.random() * 5}s`
                }} />
              ))}
            </div>
          </div>
        )}

        {gameState === GameState.PLAYING && playerHP <= 0 && (
          <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-8 animate-in fade-in">
            <div className="relative mb-8">
              <i className="fa-solid fa-skull text-8xl text-red-600 animate-bounce"></i>
              <div className="absolute inset-0 bg-red-600/20 blur-3xl rounded-full"></div>
            </div>
            <h2 className="text-5xl font-black text-red-600 mb-2 font-medieval text-center">DERROTADO</h2>
            <p className="text-white/60 text-center mb-10 uppercase tracking-[0.3em] text-[10px] font-bold">Sua melodia foi silenciada...</p>
            <button
              onClick={() => endGame()}
              className="w-full max-w-[240px] bg-red-600 hover:bg-red-500 text-white font-black py-5 rounded-2xl text-lg uppercase tracking-widest active:scale-95 transition-all shadow-[0_8px_0_#991b1b]"
            >
              RETORNAR AO MENU
            </button>
          </div>
        )}

        {gameState === GameState.MENU && (
          <div className="w-full h-full flex flex-col items-center justify-center p-4 overflow-hidden relative">

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
                <h1 className="text-5xl font-black tracking-tighter italic leading-none block font-medieval">
                  CHORD<span className="text-orange-500">RUSH</span>
                </h1>
                <div className="flex flex-col items-center gap-1 mt-1">
                  <h2 className="text-xl font-black uppercase tracking-[0.2em] text-purple-500 font-medieval drop-shadow-lg animate-pulse">
                    Lorde Silêncio
                  </h2>
                  <p className={`font-black tracking-[0.3em] text-[10px] uppercase ${currentArena.colors.accent} mt-2`}>Master the Fretboard</p>
                  <div className="flex items-center gap-2">
                    <p className="text-white/20 font-black text-[9px] uppercase tracking-widest">Version 7.6.0</p>
                    <span className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest border ${currentArena.colors.border} ${currentArena.colors.secondary}`}>
                      {currentArena.name}
                    </span>
                  </div>
                </div>
              </div>

              <div className="w-full space-y-4">
                {((showNameModal || isRenaming) && syncDone) ? (
                  <div className="space-y-4 animate-in fade-in slide-in-from-bottom duration-500">
                    <div className="space-y-2">
                      <p className="text-white/40 text-[10px] font-black uppercase tracking-widest text-center">
                        {isRecovering ? 'Digite seus dados de acesso' : (tempName.length <= 1 ? 'Seu nome é muito curto' : 'Como quer ser chamado?')}
                      </p>
                      <input
                        type="text"
                        placeholder="DIGITE SEU NOME"
                        value={tempName || ''}
                        onChange={(e) => setTempName(e.target.value.toUpperCase())}
                        className="w-full bg-white/5 border-2 border-white/10 rounded-2xl p-5 text-center text-xl font-black uppercase focus:outline-none focus:border-white/30 transition-all placeholder:text-white/10"
                      />
                      {isRecovering && (
                        <input
                          type="tel"
                          maxLength={4}
                          placeholder="PIN (4 DÍGITOS)"
                          value={recoveryPinInput}
                          onChange={(e) => setRecoveryPinInput(e.target.value)}
                          className="w-full bg-white/5 border-2 border-white/10 rounded-2xl p-5 text-center text-xl font-black uppercase focus:outline-none focus:border-white/30 transition-all placeholder:text-white/10 mt-2"
                        />
                      )}
                      <p className="text-[9px] text-white/20 text-center uppercase font-bold">Mínimo 2 caracteres</p>
                    </div>

                    {isRecovering ? (
                      <button
                        onClick={() => tempName.trim().length >= 2 && recoveryPinInput.length === 4 && recoverAccount(tempName, recoveryPinInput)}
                        disabled={tempName.trim().length < 2 || recoveryPinInput.length < 4}
                        className={`w-full relative overflow-hidden bg-orange-500 text-white font-black py-5 rounded-2xl text-2xl transition-all shadow-[0_8px_0_#c2410c] active:shadow-none active:translate-y-[8px] uppercase ${(tempName.trim().length < 2 || recoveryPinInput.length < 4) ? 'opacity-30 cursor-not-allowed' : 'hover:bg-orange-600'}`}
                      >
                        RESGATAR CONTA
                      </button>
                    ) : (
                      <button
                        onClick={() => tempName.trim().length >= 2 && savePlayerProfile()}
                        disabled={tempName.trim().length < 2}
                        className={`w-full relative overflow-hidden ${currentArena.colors.button} font-black py-5 rounded-2xl text-2xl transition-all shadow-[0_8px_0_rgba(0,0,0,0.1)] active:shadow-none active:translate-y-[8px] uppercase ${tempName.trim().length < 2 ? 'opacity-30 cursor-not-allowed' : 'hover:brightness-110'}`}
                      >
                        CONFIRMAR NOME
                      </button>
                    )}

                    <div className="flex flex-col gap-2">
                      {/* Recovery Button Removed - Gallery Auth Only */}

                      {(isRenaming || (showNameModal && stats.playerName)) && (
                        <button onClick={() => { setIsRenaming(false); setShowNameModal(false); setTempName(''); }} className="w-full text-white/30 text-[10px] font-black uppercase tracking-widest py-2">Cancelar</button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5 w-full">
                    <div className="flex flex-col gap-3 w-full">
                      <button
                        onClick={() => stats.playerName.trim() && startNewGame(GameMode.NORMAL)}
                        disabled={!stats.playerName.trim() || !syncDone}
                        className={`w-full relative overflow-hidden ${currentArena.colors.button} font-black py-5 rounded-2xl text-2xl transition-all shadow-[0_8px_0_rgba(0,0,0,0.2)] active:shadow-none active:translate-y-[8px] uppercase ${(!stats.playerName.trim() || !syncDone) ? 'opacity-30 cursor-not-allowed' : 'hover:brightness-110'}`}
                      >
                        MODO HISTÓRIA
                      </button>

                      <button
                        onClick={() => stats.playerName.trim() && startNewGame(GameMode.RUSH)}
                        disabled={!stats.playerName.trim() || !syncDone}
                        className={`w-full relative overflow-hidden bg-slate-800 border-2 border-slate-700 text-white font-black py-4 rounded-2xl text-xl transition-all shadow-[0_4px_0_#1e293b] active:shadow-none active:translate-y-[4px] uppercase ${(!stats.playerName.trim() || !syncDone) ? 'opacity-30 cursor-not-allowed' : 'hover:bg-slate-700'}`}
                      >
                        MODO RUSH
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setGameState(GameState.STORE)}
                        className={`w-full relative overflow-hidden ${currentArena.colors.secondary} border ${currentArena.colors.border} ${currentArena.colors.text} font-black p-4 rounded-2xl text-[11px] tracking-widest transition-all flex items-center justify-center gap-2 hover:brightness-125 active:scale-95 uppercase`}
                      >
                        <i className={`fa-solid fa-cart-shopping ${currentArena.colors.accent}`}></i>
                        Loja de Cards
                      </button>
                      <button
                        onClick={() => setGameState(GameState.RANKING)}
                        className={`w-full ${currentArena.colors.secondary} border ${currentArena.colors.border} ${currentArena.colors.text} font-black p-4 rounded-2xl text-[11px] tracking-widest transition-all flex items-center justify-center gap-2 hover:brightness-125 active:scale-95 uppercase`}
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
                              {stats.recoveryPin && (
                                <div className="bg-orange-500/20 px-2 py-1 rounded-lg border border-orange-500/30 flex items-center gap-1.5" title="Seu código de recuperação">
                                  <span className="text-[8px] font-black text-orange-500 uppercase tracking-tighter">PIN:</span>
                                  <span className="text-xs font-black text-white tracking-widest">{stats.recoveryPin}</span>
                                </div>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTempName(stats.playerName);
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

        {gameState === GameState.PLAYING && (
          <div className="w-full h-full max-h-screen flex flex-col p-4 overflow-hidden relative font-medieval">

            {/* BOSS INTRO OVERLAY */}
            {showBossIntro && (
              <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm px-6">
                <div className="relative mb-12 animate-float flex flex-col items-center">
                  <div className="speech-bubble px-6 py-4 mb-16 max-w-[280px] text-center animate-slide-up shadow-2xl">
                    <span className="text-stone-900 font-medieval text-sm font-bold italic leading-relaxed">
                      "{bossPhrase}"
                    </span>
                  </div>
                  <div className="relative">
                    <img
                      src={currentArena.boss.image}
                      className="w-64 h-64 object-contain pixelated drop-shadow-[0_0_50px_rgba(255,255,255,0.15)]"
                      alt="Boss Intro"
                    />
                    <div className="absolute inset-0 bg-white/5 animate-pulse rounded-full blur-3xl -z-10" />
                  </div>
                </div>
                <div className="text-center">
                  <h2 className="text-white font-medieval text-2xl font-black uppercase tracking-[0.2em] mb-2 text-shadow-lg">
                    {currentArena.boss.name}
                  </h2>
                  <div className="h-1 w-32 bg-red-600 mx-auto rounded-full animate-width" />
                </div>
              </div>
            )}

            {/* STATS BAR (TOP) */}
            <div className="w-full flex justify-between items-center z-20 py-3 px-4 bg-stone-950 border-b-2 border-stone-800 shadow-2xl">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-black uppercase text-blue-400 tracking-tighter">Energia</span>
                <div className="w-24 h-2.5 bg-black/60 rounded-full border border-stone-800 overflow-hidden">
                  <div className="h-full bg-blue-500 transition-all duration-300 shadow-[0_0_8px_rgba(59,130,246,0.6)]" style={{ width: `${playerHP}%` }} />
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <span className="text-[10px] font-black text-white/40 uppercase block">Tempo</span>
                  <span className={`text-base font-black tabular-nums transition-all ${timeLeft < 10 ? 'text-red-500 animate-pulse' : 'text-white'}`}>{formatTime(timeLeft)}</span>
                </div>
                {mode !== GameMode.RUSH && (
                  <div className="text-center">
                    <span className="text-[10px] font-black text-yellow-600/60 uppercase block font-medieval">Arena</span>
                    <span className="text-sm font-black text-yellow-500 uppercase tracking-tighter">{currentArena.id}</span>
                  </div>
                )}
                <div className="text-center">
                  <span className="text-[10px] font-black text-orange-600/60 uppercase block">XP</span>
                  <span className="text-base font-black text-orange-400">+{sessionXP}</span>
                </div>
              </div>
              <button
                onClick={endGame}
                className="w-10 h-10 flex items-center justify-center bg-red-950/40 text-red-500 rounded-xl active:scale-90 border-2 border-red-900/30 transition-all hover:bg-red-900/60"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <div className="flex-1 flex flex-col items-center justify-start relative pt-4">
              {/* PROJECTILES LAYER */}
              {projectiles.map(p => (
                <div
                  key={p.id}
                  className={`absolute z-[60] pointer-events-none animate-projectile ${p.isSpecial ? 'w-24 h-24' : 'w-12 h-12'}`}
                  style={{
                    bottom: '220px',
                    left: '50%',
                    '--start-x': `${p.x}px`,
                    '--start-y': `${p.y}px`
                  } as any}
                >
                  <div className={`w-full h-full rounded-full ${p.isSpecial ? 'bg-amber-400 shadow-[0_0_50px_#fbbf24]' : 'bg-cyan-400 shadow-[0_0_25px_#22d3ee]'} animate-pulse ring-2 ring-white/50`} />
                </div>
              ))}

              {/* BOSS AREA (CENTER-TOP) - HIDDEN IN RUSH */}
              {mode !== GameMode.RUSH ? (
                <div className="w-full flex flex-col items-center justify-center gap-2 mt-4">
                  <div className="w-full max-w-[280px] mb-4">
                    <div className="w-full h-5 bg-stone-950 rounded-full border-2 border-stone-700 overflow-hidden relative shadow-[0_0_15px_rgba(0,0,0,0.8)]">
                      <div className={`h-full bg-gradient-to-r ${bossHP <= 0 ? 'from-stone-600 to-stone-800' : 'from-red-600 via-red-500 to-rose-400'} rounded-full transition-all duration-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]`} style={{ width: `${Math.max(0, bossHP)}%` }} />
                      <div className="absolute inset-x-0 top-0 h-full flex items-center justify-between px-3">
                        <span className="text-[10px] font-black text-white uppercase tracking-wider drop-shadow-md">{currentArena.boss.name}</span>
                        <span className="text-[10px] font-black text-white drop-shadow-md">{Math.ceil(bossHP)}%</span>
                      </div>
                      {/* Tick marks for HP bar */}
                      <div className="absolute inset-0 flex justify-evenly pointer-events-none opacity-20">
                        {[1, 2, 3, 4].map(i => <div key={i} className="w-[1px] h-full bg-white" />)}
                      </div>
                    </div>
                  </div>

                  <div className="relative">
                    {/* BOSS REACTION SPEECH BUBBLE (Moved outside to avoid grayscale) */}
                    {bossReactionSpeech && (
                      <div className="absolute top-4 -right-12 z-[70] animate-bounce w-[90vw] max-w-[160px] flex justify-center pointer-events-none">
                        <div className="bg-white px-3 py-2 rounded-xl border-4 border-stone-800 shadow-2xl relative w-full text-center">
                          <p className="text-stone-900 font-black text-[9px] leading-tight text-center italic drop-shadow-sm break-words whitespace-normal">"{bossReactionSpeech}"</p>
                          <div className="absolute top-4 -left-4 w-0 h-0 border-[8px] border-transparent border-r-stone-800" />
                          <div className="absolute top-4 -left-3 w-0 h-0 border-[6px] border-transparent border-r-white" />
                        </div>
                      </div>
                    )}

                    <div className={`relative w-64 h-64 transition-all duration-300 ${bossStatus === 'taking-damage' ? 'animate-shake damage-flash scale-95' : bossStatus === 'attacking' ? 'scale-110' : 'scale-100'} ${(bossHP <= 0 && !showBossVictory) ? 'opacity-0 scale-0' : (bossHP <= 0 ? 'grayscale opacity-50' : '')}`}>
                      <img src={currentArena.boss.image} className="w-full h-full object-contain object-bottom pixelated" style={{ filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.8))' }} />
                      {bossStatus === 'taking-damage' && <div className="absolute inset-0 bg-white/30 mix-blend-overlay animate-pulse rounded-full blur-3xl" />}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-20" /> // Spacer for RUSH mode
              )}

              {/* CHORD DISPLAY (CENTER-BOTTOM) */}
              <div className="flex-1 flex flex-col items-center justify-center -mt-6">
                <div className={`text-8xl font-black tracking-tighter transition-all duration-500 drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)] ${isSpecialCharged ? 'text-yellow-400 scale-110 special-glow' : feedback?.type === 'wrong' ? 'shake text-red-500' : 'text-white'}`}>
                  {chordsPool[currentIndex]?.symbol}
                </div>
                {isSpecialCharged && (
                  <div className="mt-4 animate-bounce bg-yellow-400 text-black px-4 py-1 rounded-full text-[8px] font-black uppercase tracking-widest shadow-[0_0_20px_#fbbf24]">
                    ATAQUE ESPECIAL PRONTO!
                  </div>
                )}
              </div>

              <div className="absolute top-24 right-4 pointer-events-none z-50">
                {feedback && feedback.type === 'wrong' && (
                  <div className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest pop-in shadow-2xl flex flex-col items-center border-2 bg-white text-red-600 border-red-200">
                    <span className="text-[8px] opacity-60 mb-0.5">ERROU!</span>
                    <span className="text-lg leading-none font-sans">{feedback.note}</span>
                  </div>
                )}
                {bossHP <= 0 && (
                  <div className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest pop-in shadow-2xl flex flex-col items-center border-2 bg-yellow-500 text-black border-yellow-300 font-medieval">
                    <i className="fa-solid fa-crown animate-bounce mb-1"></i>
                    <span>VITÓRIA!</span>
                  </div>
                )}
              </div>
            </div>

            {/* MISSIONS DYNAMIC NOTIFICATION - Moved to bottom to avoid overlapping with boss bubbles */}
            <div className="fixed bottom-32 left-1/2 -translate-x-1/2 z-[100] pointer-events-none">
              {dailyMissions.filter(m => m.id === activeMissionNotifId).map(m => {
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
                  <div key={m.id} className="bg-stone-900 shadow-2xl border-2 border-yellow-500/50 p-2 rounded-xl flex items-center gap-3 animate-slide-up min-w-[180px]">
                    <i className="fa-solid fa-scroll text-yellow-500"></i>
                    <div className="flex-1">
                      <div className="text-[7px] font-black text-yellow-500 uppercase">{m.title}</div>
                      <div className="text-[6px] text-white/50">{currentProgress}/{m.goal_value}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* COMBO & CONTROLS */}
            <div className="w-full flex flex-col gap-4 mt-auto pb-4">
              <div className="w-full h-5 bg-stone-900/80 rounded-xl overflow-hidden border-2 border-stone-700 relative shadow-inner">
                <div
                  className={`h-full transition-all duration-500 ease-out flex items-center justify-end px-3 ${isOnFire ? 'bg-gradient-to-r from-orange-600 via-red-600 to-red-800 animate-pulse' : (mode === GameMode.RUSH ? 'bg-blue-600' : `bg-gradient-to-r ${currentArena.colors.primary}`)}`}
                  style={{ width: `${progressPercentage}%` }}
                >
                  {combo >= 2 && <span className="text-[8px] font-medieval font-black text-white/90 tracking-[0.2em]"> {combo} COMBO </span>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {currentOptions.map((opt, i) => (
                  <NoteButton
                    key={`${currentIndex}-${i}-${opt}`}
                    note={opt}
                    disabled={feedback !== null}
                    onClick={handleAnswer}
                    extraClass={feedback === null
                      ? `${mode === GameMode.RUSH ? 'bg-slate-900 border-slate-700 text-slate-100 shadow-[0_4px_0_#0f172a]' : currentArena.colors.button} rounded-2xl p-6 text-3xl font-medieval active:translate-y-[4px] active:shadow-none transition-all hover:brightness-110 border-2`
                      : 'opacity-30 grayscale'}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

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

        {gameState === GameState.RANKING && (<RankingBoard onBack={() => setGameState(GameState.MENU)} playerName={stats.playerName} />)}

        {
          gameState === GameState.STORE && (
            <CardStore
              onBack={() => setGameState(GameState.MENU)}
              acordeCoins={stats.acordeCoins}
              onXPUpdate={(newXP) => setStats(prev => ({ ...prev, acordeCoins: newXP }))}
              accumulatedXP={stats.accumulatedXP || 0}
              selectedCardId={stats.selectedCardId}
              onCardSelect={(cardId) => setStats(prev => ({ ...prev, selectedCardId: cardId }))}
              unlockedArenaId={stats.unlockedArenaId || 1}
              onPlayStory={(id) => {
                setStats(prev => ({ ...prev, lastPlayedArenaId: id }));
                setActiveStoryId(id);
              }}
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
          activeStoryId !== null && (
            <StoryModal
              arenaId={activeStoryId}
              onClose={() => {
                const newSeen = [...(stats.seenStoryIds || []), activeStoryId];
                setStats(prev => ({ ...prev, seenStoryIds: newSeen }));

                // Persistir no Banco
                const deviceId = getDeviceId();
                supabase.rpc('mark_story_seen', {
                  device_id_param: deviceId,
                  story_id: activeStoryId
                });

                const currentStoryId = activeStoryId;
                setActiveStoryId(null);

                if (currentStoryId === 6) {
                  setIsGameCompleted(true);
                } else if (gameState !== GameState.STORE) {
                  startNewGame(mode);
                }
              }}
            />
          )
        }

        {
          activeDialogue && (
            <DialogueOverlay
              interaction={activeDialogue}
              bossName={currentArena.boss.name}
              bossImage={currentArena.boss.image}
              onContinue={() => setActiveDialogue(null)}
            />
          )
        }

        {
          showBossVictory && (
            <BossVictoryModal
              bossName={currentArena.boss.name}
              nextArenaName={ARENAS.find(a => a.id === currentArena.id + 1)?.name.replace(/Arena [IV]+: /, '') || 'Próxima Arena'}
              hasNextArena={!!ARENAS.find(a => a.id === currentArena.id + 1)}
              onContinue={() => {
                setShowBossVictory(false);
                // Resume timer
                if (timerRef.current) clearInterval(timerRef.current); // safe clear
                timerRef.current = setInterval(() => {
                  setTimeLeft(prev => prev <= 1 ? 0 : prev - 1);
                }, 1000);
              }}
              onAdvance={handleBossDefeatedAdvance}
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
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-yellow-500 mb-2 block">Proteção de Dados</span>
                  <h2 className="text-4xl font-black italic tracking-tighter uppercase leading-none text-white">STORY <span className="text-yellow-500">MODE</span></h2>
                </div>
                <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2 no-scrollbar text-left text-white">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 flex-shrink-0 bg-yellow-500/10 rounded-2xl flex items-center justify-center text-yellow-500 border border-yellow-500/20">
                      <i className="fa-solid fa-book text-xl"></i>
                    </div>
                    <div>
                      <h4 className="font-black text-xs uppercase tracking-widest text-white mb-1">Modo História Liberado!</h4>
                      <p className="text-[11px] text-white/50 leading-relaxed">Agora cada arena tem sua própria narrativa cinematográfica. Descubra os segredos por trás do Lorde Silêncio.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-10 h-10 flex-shrink-0 bg-orange-500/10 rounded-2xl flex items-center justify-center text-orange-500 border border-orange-500/20">
                      <i className="fa-solid fa-key text-xl"></i>
                    </div>
                    <div>
                      <h4 className="font-black text-xs uppercase tracking-widest text-white mb-1">Sincronização Total</h4>
                      <p className="text-[11px] text-white/50 leading-relaxed">Seu progresso de arenas e história agora é salvo na nuvem via PIN.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-10 h-10 flex-shrink-0 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-400 border border-blue-500/20">
                      <i className="fa-solid fa-shield-halved text-xl"></i>
                    </div>
                    <div>
                      <h4 className="font-black text-xs uppercase tracking-widest text-white mb-1">Segurança V5</h4>
                      <p className="text-[11px] text-white/50 leading-relaxed">Ranking e pontuações protegidas contra manipulação com validação de servidor.</p>
                    </div>
                  </div>
                </div>
                <button onClick={closeChangelog} className="w-full mt-8 bg-white text-black font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-xl">VAMOS NESSA!</button>
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
                <div className="mb-8 text-center uppercase">
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
          )}
      </div>
    </div>
  );
};

export default App;
