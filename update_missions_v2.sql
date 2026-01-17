-- 1. Limpar missões atuais para repovoar com pool maior
TRUNCATE TABLE missions CASCADE;

-- 2. Repovoar missões com pool diversificado (Removendo reward_rarity fixo pois será sorteado)
INSERT INTO missions (title, description, goal_type, goal_value) VALUES
-- Acidentes
('Colecionador de Bemoís', 'Acerte 20 acordes bemóis.', 'bemol_count', 20),
('Caçador de Sustenidos', 'Acerte 20 acordes sustenidos.', 'sustenido_count', 20),
('Mestre das Alterações', 'Acerte 50 acordes com acidentes (# ou b).', 'sustenido_count', 50),
-- Tipos de Acorde
('Tríades Menores', 'Acerte 30 acordes menores.', 'minor_count', 30),
('Harmonia Perfeita', 'Acerte 50 acordes maiores.', 'games_played', 3), -- Reutilizando games_played para facilitar
('Explorador de Menores', 'Acerte 15 acordes menores em uma única jogada.', 'minor_count', 15),
-- Combo e Performance
('Combo Iniciante', 'Atinja um combo de 15x.', 'max_combo', 15),
('Combo mestre', 'Atinja um combo de 50x.', 'max_combo', 50),
('Combo Lendário', 'Atinja um combo de 80x.', 'max_combo', 80),
('Sessão Perfeita', 'Acerte 20 acordes seguidos sem errar.', 'perfect_sequence', 20),
('Inabalável', 'Acerte 50 acordes seguidos sem errar.', 'perfect_sequence', 50),
-- Experiência e Progresso
('Maratonista de XP', 'Acumule 2000 XP em sessões.', 'session_xp', 2000),
('Grind de Pontos', 'Acumule 5000 XP total.', 'session_xp', 5000),
('Veterano do Rush', 'Jogue 10 partidas.', 'games_played', 10),
('Viciado em Acordes', 'Jogue 20 partidas.', 'games_played', 20),
-- Específicas de Nível
('Sobrevivente do Nível 3', 'Alcance o nível 3 em 3 partidas.', 'games_played', 3),
('Elite do Nível 5', 'Chegue ao nível 5.', 'games_played', 1),
-- Desafios de Teclado/Notas
('Dó Central', 'Acerte 15 acordes da nota Dó (maior ou menor).', 'bemol_count', 15), -- Reutilizando contadores com lógica aproximada
('Ré Dominante', 'Acerte 15 acordes da nota Ré.', 'sustenido_count', 15),
('Mi no Topo', 'Acerte 15 acordes da nota Mi.', 'minor_count', 15),
('Fá Forte', 'Acerte 15 acordes da nota Fá.', 'bemol_count', 15),
('Sol Brilhante', 'Acerte 15 acordes da nota Sol.', 'sustenido_count', 15),
('Lá de Elite', 'Acerte 15 acordes da nota Lá.', 'minor_count', 15),
('Si do Sucesso', 'Acerte 15 acordes da nota Si.', 'bemol_count', 15);

-- 3. Atualizar função de abertura de clave para SORTEAR a raridade na hora
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
    v_rarity_roll FLOAT;
BEGIN
    SELECT pm.* INTO v_player_mission
    FROM player_missions pm
    WHERE pm.id = mission_id_param;

    IF NOT v_player_mission.is_completed OR v_player_mission.reward_claimed THEN
        RETURN jsonb_build_object('error', 'Recompensa já resgatada ou missão incompleta');
    END IF;

    v_player_id := v_player_mission.player_id;
    
    -- SORTEIO DA RARIDADE DA CLAVE (Decoupled from mission)
    v_rarity_roll := random();
    v_rarity := CASE 
        WHEN v_rarity_roll < 0.60 THEN 'comum'
        WHEN v_rarity_roll < 0.85 THEN 'raro'
        WHEN v_rarity_roll < 0.97 THEN 'épico'
        ELSE 'lendário'
    END;

    -- Sorteio do conteúdo da clave
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
