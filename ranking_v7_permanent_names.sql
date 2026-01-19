-- 1. MOTOR DE RANKING V7 (NOMES PERMANENTES + RESET DOMINGO 22:00)
-- Esta versão mantém os jogadores no ranking mesmo que ainda não tenham jogado na semana atual.
CREATE OR REPLACE FUNCTION get_weekly_ranking_v7()
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
    v_cutoff_time := CASE 
        WHEN extract(dow from now()) = 0 AND extract(hour from now()) < 22 
            THEN date_trunc('day', now() - interval '7 days') + interval '22 hours'
        ELSE 
            date_trunc('day', now() - (extract(dow from now())::int % 7) * interval '1 day') + interval '22 hours'
    END;

    RETURN QUERY
    WITH weekly_best AS (
        -- Pega o melhor score de cada um na semana atual
        SELECT s.player_id, MAX(s.score) as top_score, MAX(s.created_at) as last_play
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
        COALESCE(wb.top_score, 0) as score, -- Se não jogou na semana, mostra 0
        wb.last_play as created_at
    FROM public.players p
    LEFT JOIN weekly_best wb ON p.id = wb.player_id
    WHERE p.games_played > 0 -- Mostra apenas quem já jogou pelo menos uma vez na vida
    ORDER BY 
        score DESC,           -- Primeiro quem tem mais pontos na semana
        p.accumulated_xp DESC -- Empate ou 0 pontos: Mantém a ordem por XP (Prestígio)
    LIMIT 100;
END; $$;
