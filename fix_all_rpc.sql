-- 1. Remover a restrição única antiga que limitava a 1 missão por dia
ALTER TABLE player_missions DROP CONSTRAINT IF EXISTS player_missions_player_id_assigned_at_key;

-- 2. Garantir que as colunas existam
ALTER TABLE players ADD COLUMN IF NOT EXISTS acorde_coins INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS accumulated_xp INTEGER DEFAULT 0;

-- 3. DROP das funções para evitar erro de assinatura (42P13)
DROP FUNCTION IF EXISTS get_or_assign_daily_mission(TEXT);
DROP FUNCTION IF EXISTS open_music_clef(UUID);
DROP FUNCTION IF EXISTS secure_end_game(TEXT, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS update_player_name_secure(TEXT, TEXT);
DROP FUNCTION IF EXISTS start_game_session(TEXT);

-- 4. Função Principal de Missões (Retorna 5 missões)
CREATE OR REPLACE FUNCTION get_or_assign_daily_mission(device_id_param TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_player_id UUID;
    v_mission RECORD;
    v_missions_list JSONB;
    v_current_count INTEGER;
BEGIN
    SELECT id INTO v_player_id FROM players WHERE device_id = device_id_param;
    IF v_player_id IS NULL THEN RETURN NULL; END IF;

    SELECT count(*) INTO v_current_count 
    FROM player_missions 
    WHERE player_id = v_player_id AND assigned_at = CURRENT_DATE;

    IF v_current_count < 5 THEN
        INSERT INTO player_missions (player_id, mission_id)
        SELECT v_player_id, m.id
        FROM missions m
        WHERE m.id NOT IN (
            SELECT mission_id FROM player_missions 
            WHERE player_id = v_player_id AND assigned_at = CURRENT_DATE
        )
        ORDER BY random()
        LIMIT (5 - v_current_count);
    END IF;

    SELECT jsonb_agg(
        jsonb_build_object(
            'id', pm.id,
            'current_value', pm.current_value,
            'is_completed', pm.is_completed,
            'reward_claimed', pm.reward_claimed,
            'assigned_at', pm.assigned_at,
            'title', m.title,
            'description', m.description,
            'goal_type', m.goal_type,
            'goal_value', m.goal_value,
            'reward_rarity', m.reward_rarity
        )
    ) INTO v_missions_list
    FROM player_missions pm
    JOIN missions m ON pm.mission_id = m.id
    WHERE pm.player_id = v_player_id AND pm.assigned_at = CURRENT_DATE;

    RETURN COALESCE(v_missions_list, '[]'::jsonb);
END;
$$;

-- 5. Função de Abertura de Clave
CREATE OR REPLACE FUNCTION open_music_clef(mission_id_param UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_player_mission RECORD;
    v_player_id UUID;
    v_rarity TEXT;
    v_reward_type TEXT;
    v_reward_amount INTEGER;
    v_roll FLOAT;
BEGIN
    SELECT pm.*, m.reward_rarity INTO v_player_mission
    FROM player_missions pm
    JOIN missions m ON pm.mission_id = m.id
    WHERE pm.id = mission_id_param;

    IF NOT v_player_mission.is_completed OR v_player_mission.reward_claimed THEN
        RETURN jsonb_build_object('error', 'Recompensa já resgatada ou missão incompleta');
    END IF;

    v_player_id := v_player_mission.player_id;
    v_rarity := v_player_mission.reward_rarity;
    v_roll := random();

    IF (v_rarity = 'comum' AND v_roll < 0.02) OR 
       (v_rarity = 'raro' AND v_roll < 0.05) OR 
       (v_rarity = 'épico' AND v_roll < 0.10) OR 
       (v_rarity = 'lendário' AND v_roll < 0.20) THEN
       v_reward_type := 'card';
       v_reward_amount := 0;
    ELSE
       IF random() < 0.5 THEN
           v_reward_type := 'acorde_coins';
           v_reward_amount := CASE 
               WHEN v_rarity = 'comum' THEN 1500 + (floor(random() * 3) * 500)
               WHEN v_rarity = 'raro' THEN 2500 + (floor(random() * 5) * 500)
               WHEN v_rarity = 'épico' THEN 5000 + (floor(random() * 7) * 500)
               WHEN v_rarity = 'lendário' THEN 10000 + (floor(random() * 21) * 500)
           END;
           UPDATE players SET acorde_coins = COALESCE(acorde_coins, 0) + v_reward_amount WHERE id = v_player_id;
       ELSE
           v_reward_type := 'patente_xp';
           v_reward_amount := CASE 
               WHEN v_rarity = 'comum' THEN 1500 + (floor(random() * 3) * 500)
               WHEN v_rarity = 'raro' THEN 2500 + (floor(random() * 5) * 500)
               WHEN v_rarity = 'épico' THEN 5000 + (floor(random() * 7) * 500)
               WHEN v_rarity = 'lendário' THEN 10000 + (floor(random() * 21) * 500)
           END;
           UPDATE players SET accumulated_xp = COALESCE(accumulated_xp, 0) + v_reward_amount WHERE id = v_player_id;
       END IF;
    END IF;

    UPDATE player_missions SET reward_claimed = TRUE WHERE id = mission_id_param;

    RETURN jsonb_build_object(
        'type', v_reward_type,
        'amount', v_reward_amount,
        'rarity', v_rarity
    );
END;
$$;

-- 6. Função de Fim de Jogo (Segura)
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
    v_coins_bonus INTEGER;
BEGIN
    SELECT id INTO v_player_id FROM players WHERE device_id = device_id_param;
    IF v_player_id IS NULL THEN RETURN; END IF;

    v_coins_bonus := floor(xp_param * 0.1);

    UPDATE players 
    SET high_score = GREATEST(COALESCE(high_score, 0), score_param),
        accumulated_xp = COALESCE(accumulated_xp, 0) + xp_param,
        acorde_coins = COALESCE(acorde_coins, 0) + v_coins_bonus
    WHERE id = v_player_id;

    INSERT INTO scores (player_id, score, level, xp_earned)
    VALUES (v_player_id, score_param, level_param, xp_param);
END;
$$;

-- 7. Função para Trocar Nome (Segura)
CREATE OR REPLACE FUNCTION update_player_name_secure(
    device_id_param TEXT,
    new_name TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE players SET name = new_name WHERE device_id = device_id_param;
END;
$$;

-- 8. Função de Início de Sessão (Placeholder para segurança futura)
CREATE OR REPLACE FUNCTION start_game_session(device_id_param TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Log ou validação de início pode ser feita aqui
    UPDATE players SET games_played = COALESCE(games_played, 0) + 1 WHERE device_id = device_id_param;
END;
$$;
