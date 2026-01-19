-- 1. IDENTIFICAR O JOGADOR PELO DEVICE_ID
-- (O script abaixo assume o seu device_id atual do navegador/celular)
DO $$
DECLARE
    v_player_id UUID;
BEGIN
    -- Busca o seu ID de jogador
    SELECT id INTO v_player_id FROM public.players 
    WHERE device_id = (SELECT device_id FROM public.players WHERE name ILIKE '%ANTONY%' LIMIT 1); 
    -- Se não achar pelo nome, você pode rodar: SELECT id FROM players WHERE device_id = 'SEU_DEVICE_ID'

    IF v_player_id IS NOT NULL THEN
        -- Remove todos os cards associados à sua conta
        DELETE FROM public.player_cards WHERE player_id = v_player_id;
        
        -- Garante que o card selecionado no perfil seja resetado para nulo
        UPDATE public.players SET selected_card_id = NULL WHERE id = v_player_id;
    END IF;
END $$;
