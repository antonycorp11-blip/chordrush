-- 1. Criar uma VIEW robusta para o Ranking Semanal
-- Isso tira a lógica complexa do frontend e garante que o banco decida quem está no topo
CREATE OR REPLACE VIEW weekly_ranking_v2 AS
SELECT 
    p.id as player_id,
    p.name,
    p.device_id,
    p.acorde_coins,
    p.accumulated_xp,
    p.selected_card_id,
    p.games_played,
    MAX(s.score) as score,
    MAX(s.created_at) as created_at
FROM players p
JOIN scores s ON p.id = s.player_id
WHERE s.created_at >= date_trunc('week', CURRENT_DATE)
GROUP BY p.id, p.name, p.device_id, p.acorde_coins, p.accumulated_xp, p.selected_card_id, p.games_played
ORDER BY score DESC
LIMIT 100;

-- 2. Corrigir a função de fim de jogo para ser ATÔMICA e retornar sucesso
CREATE OR REPLACE FUNCTION secure_end_game_v2(
    device_id_param TEXT,
    score_param INTEGER,
    level_param INTEGER,
    xp_param INTEGER
)
RETURNS TABLE (success BOOLEAN, new_high_score INTEGER) 
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_player_id UUID;
    v_old_high_score INTEGER;
BEGIN
    -- Busca o jogador
    SELECT id, high_score INTO v_player_id, v_old_high_score FROM players WHERE device_id = device_id_param;
    
    IF v_player_id IS NULL THEN
        INSERT INTO players (device_id, name)
        VALUES (device_id_param, 'JOGADOR ANÔNIMO')
        RETURNING id, high_score INTO v_player_id, v_old_high_score;
    END IF;

    -- Atualiza dados do jogador
    UPDATE players SET 
        high_score = GREATEST(COALESCE(high_score, 0), score_param),
        accumulated_xp = COALESCE(accumulated_xp, 0) + xp_param,
        acorde_coins = COALESCE(acorde_coins, 0) + floor(xp_param * 0.1)
    WHERE id = v_player_id;

    -- Registra o score (Importante para o ranking semanal)
    INSERT INTO scores (player_id, score, level, xp_earned, created_at)
    VALUES (v_player_id, score_param, level_param, xp_param, now());

    RETURN QUERY SELECT TRUE, GREATEST(COALESCE(v_old_high_score, 0), score_param);
END; $$;
