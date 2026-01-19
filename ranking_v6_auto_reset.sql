-- 1. MOTOR DE RANKING V6 (RESET AUTOMÁTICO DOMINGO 22:00)
-- Esta versão calcula dinamicamente o início da semana competitiva.
CREATE OR REPLACE FUNCTION get_weekly_ranking_v6()
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
DECLARE
    v_cutoff_time TIMESTAMPTZ;
BEGIN
    -- Calcula o último domingo às 22:00
    -- Se agora for domingo ANTES das 22h, o reset foi no domingo PASSADO.
    -- Se agora for domingo DEPOIS das 22h, o reset foi HOJE às 22h.
    v_cutoff_time := CASE 
        WHEN extract(dow from now()) = 0 AND extract(hour from now()) < 22 
            THEN date_trunc('day', now() - interval '7 days') + interval '22 hours'
        ELSE 
            date_trunc('day', now() - (extract(dow from now())::int % 7) * interval '1 day') + interval '22 hours'
    END;

    RETURN QUERY
    WITH best_scores AS (
        SELECT 
            s.player_id,
            MAX(s.score) as top_score
        FROM public.scores s
        WHERE s.created_at >= v_cutoff_time
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
