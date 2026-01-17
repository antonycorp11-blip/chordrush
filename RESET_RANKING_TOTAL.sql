-- 1. RESET TOTAL DA TABELA DE SCORES (Limpa o ranking)
TRUNCATE TABLE scores;

-- 2. GARANTIR QUE A TABELA PLAYERS TEM AS COLUNAS CORRETAS
ALTER TABLE players ADD COLUMN IF NOT EXISTS acorde_coins INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS accumulated_xp INTEGER DEFAULT 0;

-- 3. FUNÇÃO DE SALVAMENTO ULTRA-ROBUSTA (SEGURANÇA DEFINER PARA BYPASS RLS)
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
    -- Busca ID ou Cria
    SELECT id INTO v_player_id FROM public.players WHERE device_id = device_id_param;
    
    IF v_player_id IS NULL THEN
        INSERT INTO public.players (device_id, name)
        VALUES (device_id_param, 'JOGADOR NOVO')
        RETURNING id INTO v_player_id;
    END IF;

    -- Atualiza Saldo e Patente
    UPDATE public.players SET 
        high_score = GREATEST(COALESCE(high_score, 0), score_param),
        accumulated_xp = COALESCE(accumulated_xp, 0) + xp_param,
        acorde_coins = COALESCE(acorde_coins, 0) + floor(xp_param * 0.1)
    WHERE id = v_player_id;

    -- Insere o Score (Garante que apareça no ranking)
    INSERT INTO public.scores (player_id, score, level, xp_earned, created_at)
    VALUES (v_player_id, score_param, level_param, xp_param, now());

    RETURN jsonb_build_object('success', TRUE, 'score_saved', score_param);
END; $$;

-- 4. FUNÇÃO DE RANKING SEMANAL (SIMPLIFICADA E DIRETA)
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
    WITH player_best_scores AS (
        SELECT 
            s.player_id,
            MAX(s.score) as top_score
        FROM public.scores s
        WHERE s.created_at >= date_trunc('week', now()) -- Reset toda Segunda 00:00
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
        pbs.top_score,
        (SELECT MAX(s2.created_at) FROM public.scores s2 WHERE s2.player_id = p.id AND s2.score = pbs.top_score)
    FROM public.players p
    JOIN player_best_scores pbs ON p.id = pbs.player_id
    ORDER BY pbs.top_score DESC, 9 DESC
    LIMIT 100;
END; $$;
