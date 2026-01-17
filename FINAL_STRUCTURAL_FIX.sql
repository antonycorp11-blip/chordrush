-- 1. CORREÇÃO CIRÚRGICA DA TABELA PLAYERS
-- Adiciona as colunas que o banco reclamou que não existem
-- Usamos 'IF NOT EXISTS' e verificamos antes para não dar erro
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS high_score INTEGER DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS games_played INTEGER DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS acorde_coins INTEGER DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS accumulated_xp INTEGER DEFAULT 0;

-- 2. LIMPEZA DE FUNÇÕES PARA REINSTALAÇÃO LIMPA
DROP FUNCTION IF EXISTS secure_end_game_v5(TEXT, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_ranking_v5();

-- 3. MOTOR V5.1 (CORRIGIDO E TESTADO COM A COLUNA FALTANTE)
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
BEGIN
    -- Busca o jogador de forma segura
    SELECT id INTO v_player_id FROM public.players WHERE device_id = device_id_param;
    
    -- Cria se não existir (Mantendo o device_id como chave única)
    IF v_player_id IS NULL THEN
        INSERT INTO public.players (device_id, name, acorde_coins, accumulated_xp, high_score, games_played)
        VALUES (device_id_param, 'JOGADOR NOVO', 0, 0, score_param, 1)
        RETURNING id INTO v_player_id;
    ELSE
        -- Atualiza estatísticas (Agora com a coluna high_score garantida)
        UPDATE public.players SET 
            high_score = GREATEST(COALESCE(high_score, 0), score_param),
            accumulated_xp = COALESCE(accumulated_xp, 0) + xp_param,
            acorde_coins = COALESCE(acorde_coins, 0) + floor(xp_param * 0.1),
            games_played = COALESCE(games_played, 0) + 1
        WHERE id = v_player_id;
    END IF;

    -- Tenta inserir o score. Se a tabela scores não existir, o erro vai aparecer aqui.
    INSERT INTO public.scores (player_id, score, level, xp_earned, created_at)
    VALUES (v_player_id, score_param, level_param, xp_param, now());

    RETURN jsonb_build_object('status', 'success', 'player_id', v_player_id, 'score_saved', score_param);
END; $$;

-- 4. RANKING V5.1 (FILTRO DE 7 DIAS REATIVADO)
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
        WHERE s.created_at >= (now() - interval '7 days') -- Voltamos aos 7 dias
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
