-- 1. Habilitar Realtime para a tabela de scores (Isso faz o ranking atualizar sozinho sem dar F5)
ALTER TABLE scores REPLICA IDENTITY FULL;
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'scores') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE scores;
  END IF;
END $$;

-- 2. Garantir que as colunas de saldo e XP estão corretas na tabela players
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='players' AND column_name='accumulated_xp') THEN
        ALTER TABLE players ADD COLUMN accumulated_xp INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='players' AND column_name='acorde_coins') THEN
        ALTER TABLE players ADD COLUMN acorde_coins INTEGER DEFAULT 0;
    END IF;
END $$;

-- 3. Função de Fim de Jogo SUPER RESILIENTE (Garante que o score entre no ranking semanal)
CREATE OR REPLACE FUNCTION secure_end_game(
    device_id_param TEXT,
    score_param INTEGER,
    level_param INTEGER,
    xp_param INTEGER
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_player_id UUID;
BEGIN
    -- 1. Identifica o jogador pelo Device ID
    SELECT id INTO v_player_id FROM players WHERE device_id = device_id_param;
    
    -- 2. Se o jogador não existir, cria ele na hora (Segurança contra falha de registro)
    IF v_player_id IS NULL THEN
        INSERT INTO players (device_id, name)
        VALUES (device_id_param, 'JOGADOR ANÔNIMO')
        RETURNING id INTO v_player_id;
    END IF;

    -- 3. Atualiza o High Score Geral, Saldo de moedas e XP de Patente
    UPDATE players SET 
        high_score = GREATEST(COALESCE(high_score, 0), score_param),
        accumulated_xp = COALESCE(accumulated_xp, 0) + xp_param,
        acorde_coins = COALESCE(acorde_coins, 0) + floor(xp_param * 0.1)
    WHERE id = v_player_id;

    -- 4. Registra o Score (A data 'created_at' será usada para o Ranking Semanal)
    -- Importante: Inserir um novo registro toda vez que jogar para o ranking ser dinâmico!
    INSERT INTO scores (player_id, score, level, xp_earned, created_at)
    VALUES (v_player_id, score_param, level_param, xp_param, now());

END; $$;

-- 4. Função de Setup Inicial de Sessão
CREATE OR REPLACE FUNCTION start_game_session(device_id_param TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$ 
BEGIN
    INSERT INTO players (device_id) VALUES (device_id_param)
    ON CONFLICT (device_id) DO UPDATE SET games_played = COALESCE(players.games_played, 0) + 1;
END; $$;
