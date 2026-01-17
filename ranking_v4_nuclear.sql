-- 1. RESET E MOTOR V4 (A PROVA DE TUDO)
-- Deleta versões anteriores para não ter confusão
DROP FUNCTION IF EXISTS secure_end_game_v3(TEXT, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_weekly_ranking_v3();

-- 2. SALVAMENTO V4 (Agora com log de retorno mais detalhado)
CREATE OR REPLACE FUNCTION secure_end_game_v4(
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
    -- 1. Localiza ou cria o jogador pelo device_id
    INSERT INTO public.players (device_id, name)
    VALUES (device_id_param, 'JOGADOR NOVO')
    ON CONFLICT (device_id) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_player_id;

    -- 2. Atualiza estatísticas do jogador
    UPDATE public.players SET 
        high_score = GREATEST(COALESCE(high_score, 0), score_param),
        accumulated_xp = COALESCE(accumulated_xp, 0) + xp_param,
        acorde_coins = COALESCE(acorde_coins, 0) + floor(xp_param * 0.1),
        games_played = COALESCE(games_played, 0) + 1
    WHERE id = v_player_id;

    -- 3. Registra a partida COM DATA EXPLÍCITA
    INSERT INTO public.scores (player_id, score, level, xp_earned, created_at)
    VALUES (v_player_id, score_param, level_param, xp_param, now());

    RETURN jsonb_build_object(
        'status', 'success',
        'player_id', v_player_id,
        'points_received', score_param
    );
END; $$;

-- 3. RANKING V4 (Ampliado para os últimos 30 dias para evitar erros de Reset)
CREATE OR REPLACE FUNCTION get_weekly_ranking_v4()
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
    WITH best_scores AS (
        SELECT 
            s.player_id,
            MAX(s.score) as top_score
        FROM public.scores s
        WHERE s.created_at >= (now() - interval '30 days') -- Janela generosa de 30 dias
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
        bs.top_score,
        (SELECT MAX(s2.created_at) FROM public.scores s2 WHERE s2.player_id = p.id AND s2.score = bs.top_score)
    FROM public.players p
    JOIN best_scores bs ON p.id = bs.player_id
    ORDER BY bs.top_score DESC, 9 DESC
    LIMIT 100;
END; $$;

-- 4. LIMPAR SCORES DE TESTE (OPCIONAL - Rodar apenas se quiser zerar agora)
-- TRUNCATE TABLE public.scores;
