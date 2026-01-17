-- 1. Garantir que a tabela 'scores' tenha todas as colunas necessárias para evitar erros de insert
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='scores' AND column_name='level') THEN
        ALTER TABLE scores ADD COLUMN level INTEGER DEFAULT 1;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='scores' AND column_name='xp_earned') THEN
        ALTER TABLE scores ADD COLUMN xp_earned INTEGER DEFAULT 0;
    END IF;
END $$;

-- 2. Corrigir função de salvar nome para criar o jogador se ele não existir (UPSERT)
-- Sem isso, novos jogadores nunca entravam na tabela 'players' e seus scores eram ignorados
CREATE OR REPLACE FUNCTION update_player_name_secure(
    device_id_param TEXT,
    new_name TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO players (device_id, name)
    VALUES (device_id_param, new_name)
    ON CONFLICT (device_id) DO UPDATE
    SET name = EXCLUDED.name;
END;
$$;

-- 3. Corrigir função de fim de jogo para ser mais resiliente
CREATE OR REPLACE FUNCTION secure_end_game(
    device_id_param TEXT,
    score_param INTEGER,
    level_param INTEGER,
    xp_param INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_player_id UUID;
BEGIN
    -- Busca o ID ou cria se por acaso não existir (segurança extra)
    SELECT id INTO v_player_id FROM players WHERE device_id = device_id_param;
    
    IF v_player_id IS NULL THEN
        INSERT INTO players (device_id, name)
        VALUES (device_id_param, 'JOGADOR ANÔNIMO')
        RETURNING id INTO v_player_id;
    END IF;

    -- Atualiza dados do jogador
    UPDATE players 
    SET high_score = GREATEST(COALESCE(high_score, 0), score_param),
        accumulated_xp = COALESCE(accumulated_xp, 0) + xp_param,
        acorde_coins = COALESCE(acorde_coins, 0) + floor(xp_param * 0.1)
    WHERE id = v_player_id;

    -- Registra o score na tabela de ranking
    INSERT INTO scores (player_id, score, level, xp_earned)
    VALUES (v_player_id, score_param, level_param, xp_param);
END;
$$;

-- 4. Função de Início de Sessão (Também deve garantir que o player exista)
CREATE OR REPLACE FUNCTION start_game_session(device_id_param TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO players (device_id)
    VALUES (device_id_param)
    ON CONFLICT (device_id) DO UPDATE
    SET games_played = COALESCE(players.games_played, 0) + 1;
END;
$$;
