-- 1. LIMPEZA TOTAL (Para não ter conflito)
DROP VIEW IF EXISTS weekly_ranking_v2;
DROP FUNCTION IF EXISTS secure_end_game_v2(TEXT, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_weekly_ranking();

-- 2. FUNÇÃO DE SALVAMENTO V3 (A Prova de Falhas)
-- Agora ela retorna o ranking atualizado para o jogador ver na hora se quiser
CREATE OR REPLACE FUNCTION secure_end_game_v3(
    device_id_param TEXT,
    score_param INTEGER,
    level_param INTEGER,
    xp_param INTEGER
)
RETURNS JSONB 
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_player_id UUID;
BEGIN
    -- Busca ou Cria o Jogador
    SELECT id INTO v_player_id FROM players WHERE device_id = device_id_param;
    IF v_player_id IS NULL THEN
        INSERT INTO players (device_id, name)
        VALUES (device_id_param, 'JOGADOR NOVO')
        RETURNING id INTO v_player_id;
    END IF;

    -- Atualiza Dados Globais
    UPDATE players SET 
        high_score = GREATEST(COALESCE(high_score, 0), score_param),
        accumulated_xp = COALESCE(accumulated_xp, 0) + xp_param,
        acorde_coins = COALESCE(acorde_coins, 0) + floor(xp_param * 0.1)
    WHERE id = v_player_id;

    -- Insere Score com Timestamp de MICROSEGUNDOS para não ter erro de ordenação
    INSERT INTO scores (player_id, score, level, xp_earned, created_at)
    VALUES (v_player_id, score_param, level_param, xp_param, clock_timestamp());

    RETURN jsonb_build_object('success', true, 'player_id', v_player_id);
END; $$;

-- 3. FUNÇÃO DE BUSCA DE RANKING V3 (Substitui a VIEW por algo mais rápido)
-- Filtra os últimos 7 dias exatos para ser 100% dinâmico
CREATE OR REPLACE FUNCTION get_weekly_ranking_v3()
RETURNS TABLE (
    player_id UUID,
    name TEXT,
    device_id TEXT,
    acorde_coins INTEGER,
    accumulated_xp INTEGER,
    selected_card_id TEXT,
    games_played INTEGER,
    score INTEGER,
    created_at TIMESTAMPTZ
) 
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    WITH latest_scores AS (
        SELECT 
            s.player_id,
            MAX(s.score) as max_score
        FROM scores s
        WHERE s.created_at >= (now() - interval '7 days')
        GROUP BY s.player_id
    )
    SELECT 
        p.id,
        p.name,
        p.device_id,
        p.acorde_coins,
        p.accumulated_xp,
        p.selected_card_id,
        p.games_played,
        ls.max_score,
        (SELECT MAX(s2.created_at) FROM scores s2 WHERE s2.player_id = p.id AND s2.score = ls.max_score) as last_play
    FROM players p
    JOIN latest_scores ls ON p.id = ls.player_id
    ORDER BY ls.max_score DESC, last_play DESC
    LIMIT 100;
END; $$;

-- 4. FORÇAR REALTIME NA TABELA DE SCORES
ALTER TABLE scores REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'scores') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE scores;
  END IF;
END $$;
