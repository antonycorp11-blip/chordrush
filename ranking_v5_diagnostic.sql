-- 1. LIMPEZA TOTAL (PARA NÃO RESTAR DÚVIDA)
DROP FUNCTION IF EXISTS secure_end_game_v4(TEXT, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_weekly_ranking_v4();

-- 2. RECONSTRUIR TABELA DE SCORES (SÓ POR SEGURANÇA)
-- Não vamos tocar na tabela players para não perder os cards
CREATE TABLE IF NOT EXISTS public.scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
    score INTEGER NOT NULL,
    level INTEGER DEFAULT 1,
    xp_earned INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. MOTOR DE SALVAMENTO V5 (TOTALMENTE INDESTRUTÍVEL)
CREATE OR REPLACE FUNCTION secure_end_game_v5(
    device_id_param TEXT,
    score_param INTEGER,
    level_param INTEGER,
    xp_param INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_player_id UUID;
    v_new_coins INTEGER;
    v_new_xp INTEGER;
BEGIN
    -- Localiza o jogador ou cria se não existir de forma limpa
    SELECT id INTO v_player_id FROM public.players WHERE device_id = device_id_param;
    
    IF v_player_id IS NULL THEN
        INSERT INTO public.players (device_id, name, acorde_coins, accumulated_xp)
        VALUES (device_id_param, 'JOGADOR NOVO', 0, 0)
        RETURNING id INTO v_player_id;
    END IF;

    -- Calcula os novos valores antes de atualizar (para ter certeza)
    v_new_coins := floor(xp_param * 0.1);
    v_new_xp := xp_param;

    -- Atualiza o perfil do jogador
    UPDATE public.players SET 
        high_score = GREATEST(COALESCE(high_score, 0), score_param),
        accumulated_xp = COALESCE(accumulated_xp, 0) + v_new_xp,
        acorde_coins = COALESCE(acorde_coins, 0) + v_new_coins,
        games_played = COALESCE(games_played, 0) + 1
    WHERE id = v_player_id;

    -- Insere o score garantindo que o player_id não seja nulo
    INSERT INTO public.scores (player_id, score, level, xp_earned, created_at)
    VALUES (v_player_id, score_param, level_param, xp_param, now());

    RETURN jsonb_build_object(
        'status', 'success',
        'player_id', v_player_id,
        'points', score_param,
        'coins_added', v_new_coins
    );
END; $$;

-- 4. MOTOR DE RANKING V5 (SEM FILTROS AGRESSIVOS PARA DEBUGE)
CREATE OR REPLACE FUNCTION get_ranking_v5()
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
        -- Por enquanto vamos remover o filtro de 7 dias para ver se APARECE ALGO
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

-- 5. TRUNCATE OPCIONAL (LIBERAR APENAS SE O USUÁRIO QUISER)
-- TRUNCATE TABLE public.scores;
