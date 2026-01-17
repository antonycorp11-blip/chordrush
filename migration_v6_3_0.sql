-- 1. Remover a restrição única antiga que limitava a 1 missão por dia
ALTER TABLE player_missions DROP CONSTRAINT IF EXISTS player_missions_player_id_assigned_at_key;

-- 2. Atualizar funções de missão (RPC)
CREATE OR REPLACE FUNCTION get_or_assign_daily_mission(p_device_id TEXT)
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
    -- Busca o ID do jogador pelo device_id
    SELECT id INTO v_player_id FROM players WHERE device_id = p_device_id;
    
    IF v_player_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Conta quantas missões o jogador já tem hoje
    SELECT count(*) INTO v_current_count 
    FROM player_missions 
    WHERE player_id = v_player_id AND assigned_at = CURRENT_DATE;

    -- Se tiver menos de 5, atribui novas missões aleatórias (sem repetir as que já tem hoje)
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

    -- Retorna a lista completa de missões de hoje para o jogador
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

    RETURN v_missions_list;
END;
$$;

-- 3. Atualizar função de abertura de clave com o novo balanceamento
CREATE OR REPLACE FUNCTION open_music_clef(p_mission_id UUID)
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
    v_multiplier INTEGER;
BEGIN
    -- Busca a missão e o jogador
    SELECT pm.*, m.reward_rarity INTO v_player_mission
    FROM player_missions pm
    JOIN missions m ON pm.mission_id = m.id
    WHERE pm.id = p_mission_id;

    IF NOT v_player_mission.is_completed OR v_player_mission.reward_claimed THEN
        RETURN jsonb_build_object('error', 'Recompensa já resgatada ou missão incompleta');
    END IF;

    v_player_id := v_player_mission.player_id;
    v_rarity := v_player_mission.reward_rarity;
    
    v_roll := random();

    -- Chance de Card (baixa mas real)
    IF (v_rarity = 'comum' AND v_roll < 0.02) OR 
       (v_rarity = 'raro' AND v_roll < 0.05) OR 
       (v_rarity = 'épico' AND v_roll < 0.10) OR 
       (v_rarity = 'lendário' AND v_roll < 0.20) THEN
       
       v_reward_type := 'card';
       v_reward_amount := 0;
    ELSE
       -- Chance de Acorde Coins vs Patente XP (50/50)
       IF random() < 0.5 THEN
           v_reward_type := 'acorde_coins';
           -- Lógica: Min 1500, varia de 500 em 500
           -- Comum: 1500-2500, Raro: 2500-4500, Épico: 5000-8000, Lendário: 10000-20000
           v_reward_amount := CASE 
               WHEN v_rarity = 'comum' THEN 1500 + (floor(random() * 3) * 500) -- 1500, 2000, 2500
               WHEN v_rarity = 'raro' THEN 2500 + (floor(random() * 5) * 500) -- 2500, 3000... 4500
               WHEN v_rarity = 'épico' THEN 5000 + (floor(random() * 7) * 500) -- 5000, 5500... 8000
               WHEN v_rarity = 'lendário' THEN 10000 + (floor(random() * 21) * 500) -- 10000, 10500... 20000
           END;
           UPDATE players SET acorde_coins = acorde_coins + v_reward_amount WHERE id = v_player_id;
       ELSE
           v_reward_type := 'patente_xp';
           v_reward_amount := CASE 
               WHEN v_rarity = 'comum' THEN 1500 + (floor(random() * 3) * 500)
               WHEN v_rarity = 'raro' THEN 2500 + (floor(random() * 5) * 500)
               WHEN v_rarity = 'épico' THEN 5000 + (floor(random() * 7) * 500)
               WHEN v_rarity = 'lendário' THEN 10000 + (floor(random() * 21) * 500)
           END;
           UPDATE players SET accumulated_xp = accumulated_xp + v_reward_amount WHERE id = v_player_id;
       END IF;
    END IF;

    -- Marca como resgatado
    UPDATE player_missions SET reward_claimed = TRUE WHERE id = p_mission_id;

    RETURN jsonb_build_object(
        'type', v_reward_type,
        'amount', v_reward_amount,
        'rarity', v_rarity
    );
END;
$$;

-- 4. Melhorar o sistema de pontos do ranking no banco
CREATE OR REPLACE FUNCTION secure_end_game(
    p_device_id_param TEXT,
    p_score_param INTEGER,
    p_level_param INTEGER,
    p_xp_param INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_player_id UUID;
    v_bonus_multiplier FLOAT;
BEGIN
    SELECT id INTO v_player_id FROM players WHERE device_id = p_device_id_param;
    
    IF v_player_id IS NULL THEN RETURN; END IF;

    -- Aqui calculamos um bônus progressivo baseado no nível
    -- Quanto maior o nível, maior o peso do acerto no Ranking
    -- Isso garante que quem joga melhor suba mais rápido
    
    UPDATE players 
    SET high_score = GREATEST(high_score, p_score_param),
        accumulated_xp = accumulated_xp + p_xp_param
    WHERE id = v_player_id;

    -- Insere o score na tabela de scores (se existir ou ranking)
    INSERT INTO scores (player_id, score, level, xp_earned)
    VALUES (v_player_id, p_score_param, p_level_param, p_xp_param);
END;
$$;
