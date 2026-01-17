-- 1. Adicionar acorde_coins à tabela de jogadores
ALTER TABLE players ADD COLUMN IF NOT EXISTS acorde_coins INTEGER DEFAULT 0;

-- 2. Criar tabela de definições de missões (Pool)
CREATE TABLE IF NOT EXISTS missions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    goal_type TEXT NOT NULL, -- 'bemol_count', 'sustenido_count', 'max_combo', 'games_played', etc.
    goal_value INTEGER NOT NULL,
    reward_rarity TEXT CHECK (reward_rarity IN ('comum', 'raro', 'épico', 'lendário')) DEFAULT 'comum',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Criar tabela de missões dos jogadores (Progresso Diário)
CREATE TABLE IF NOT EXISTS player_missions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
    current_value INTEGER DEFAULT 0,
    is_completed BOOLEAN DEFAULT FALSE,
    reward_claimed BOOLEAN DEFAULT FALSE,
    assigned_at DATE DEFAULT CURRENT_DATE,
    UNIQUE(player_id, assigned_at)
);

-- 4. Povoar com algumas missões iniciais
INSERT INTO missions (title, description, goal_type, goal_value, reward_rarity) VALUES
('Mestre dos Bemóis', 'Acerte 10 acordes bemóis em uma única partida.', 'bemol_count', 10, 'comum'),
('Sustenido Pro', 'Acerte 15 acordes sustenidos em uma única partida.', 'sustenido_count', 15, 'raro'),
('Combo Incendiário', 'Atinja um combo de 30x.', 'max_combo', 30, 'épico'),
('Persistência', 'Jogue 5 partidas no modo normal.', 'games_played', 5, 'comum'),
('Perfeccionista', 'Acerte 40 acordes sem errar nenhum.', 'perfect_sequence', 40, 'lendário'),
('Velocidade da Luz', 'Ganhe 1500 XP em uma única partida.', 'session_xp', 1500, 'épico'),
('Acorde menor', 'Acerte 20 acordes menores em uma única partida.', 'minor_count', 20, 'raro');

-- 5. Função para atribuir missão diária (RPC)
CREATE OR REPLACE FUNCTION get_or_assign_daily_mission(p_device_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_player_id UUID;
    v_mission RECORD;
    v_player_mission RECORD;
BEGIN
    -- Busca o ID do jogador pelo device_id
    SELECT id INTO v_player_id FROM players WHERE device_id = p_device_id;
    
    IF v_player_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Verifica se já tem missão hoje
    SELECT pm.*, m.title, m.description, m.goal_type, m.goal_value, m.reward_rarity
    INTO v_player_mission
    FROM player_missions pm
    JOIN missions m ON pm.mission_id = m.id
    WHERE pm.player_id = v_player_id AND pm.assigned_at = CURRENT_DATE;

    IF FOUND THEN
        RETURN row_to_json(v_player_mission)::JSONB;
    END IF;

    -- Sorteia uma nova missão
    SELECT * INTO v_mission FROM missions ORDER BY random() LIMIT 1;

    -- Insere para o jogador
    INSERT INTO player_missions (player_id, mission_id)
    VALUES (v_player_id, v_mission.id)
    RETURNING * INTO v_player_mission;

    -- Retorna os dados completos
    RETURN jsonb_build_object(
        'id', v_player_mission.id,
        'current_value', v_player_mission.current_value,
        'is_completed', v_player_mission.is_completed,
        'reward_claimed', v_player_mission.reward_claimed,
        'assigned_at', v_player_mission.assigned_at,
        'title', v_mission.title,
        'description', v_mission.description,
        'goal_type', v_mission.goal_type,
        'goal_value', v_mission.goal_value,
        'reward_rarity', v_mission.reward_rarity
    );
END;
$$;

-- 6. Função para abrir Clave (RPC)
CREATE OR REPLACE FUNCTION open_music_clef(p_mission_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_player_mission RECORD;
    v_player_id UUID;
    v_rarity TEXT;
    v_reward_type TEXT; -- 'acorde_coins', 'patente_xp', 'card'
    v_reward_amount INTEGER;
    v_reward_card_id TEXT;
    v_roll FLOAT;
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
    
    -- Lógica de Sorteio
    v_roll := random();

    -- Chance de Card (baixa mas real)
    IF (v_rarity = 'comum' AND v_roll < 0.02) OR 
       (v_rarity = 'raro' AND v_roll < 0.05) OR 
       (v_rarity = 'épico' AND v_roll < 0.10) OR 
       (v_rarity = 'lendário' AND v_roll < 0.20) THEN
       
       v_reward_type := 'card';
       -- Aqui sorteamos um card compatível (simplificado por conta da lista estar no frontend)
       -- No frontend lidaremos com a escolha do card baseado na raridade
    ELSE
       -- Chance de Acorde Coins vs Patente XP (60/40)
       IF random() < 0.6 THEN
           v_reward_type := 'acorde_coins';
           v_reward_amount := CASE 
               WHEN v_rarity = 'comum' THEN (random() * 50 + 50)::int
               WHEN v_rarity = 'raro' THEN (random() * 150 + 100)::int
               WHEN v_rarity = 'épico' THEN (random() * 400 + 200)::int
               WHEN v_rarity = 'lendário' THEN (random() * 800 + 400)::int
           END;
           UPDATE players SET acorde_coins = acorde_coins + v_reward_amount WHERE id = v_player_id;
       ELSE
           v_reward_type := 'patente_xp';
           v_reward_amount := CASE 
               WHEN v_rarity = 'comum' THEN (random() * 100 + 100)::int
               WHEN v_rarity = 'raro' THEN (random() * 300 + 200)::int
               WHEN v_rarity = 'épico' THEN (random() * 800 + 500)::int
               WHEN v_rarity = 'lendário' THEN (random() * 2000 + 1000)::int
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
