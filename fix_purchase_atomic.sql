-- 1. FUNÇÃO DE COMPRA ATÔMICA (RESOLVE O BUG DO SALDO)
-- Esta função garante que o card é entregue e o saldo é removido EM UM SÓ PASSO.
CREATE OR REPLACE FUNCTION purchase_card(
    device_id_param TEXT,
    card_id_param TEXT,
    card_price_param INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_player_id UUID;
    v_current_coins INTEGER;
BEGIN
    -- 1. Busca o jogador e o saldo atual de forma travada (FOR UPDATE)
    SELECT id, acorde_coins INTO v_player_id, v_current_coins 
    FROM public.players 
    WHERE device_id = device_id_param 
    FOR UPDATE;

    IF v_player_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Jogador não encontrado');
    END IF;

    -- 2. Verifica se já possui o card (Evita compra dupla por lag)
    IF EXISTS (SELECT 1 FROM public.player_cards WHERE player_id = v_player_id AND card_id = card_id_param) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Você já possui este card');
    END IF;

    -- 3. Verifica saldo real no banco
    IF v_current_coins < card_price_param THEN
        RETURN jsonb_build_object('success', false, 'message', 'Saldo insuficiente no banco');
    END IF;

    -- 4. REALIZA A TRANSAÇÃO
    -- A. Deduz o saldo
    UPDATE public.players 
    SET acorde_coins = acorde_coins - card_price_param 
    WHERE id = v_player_id;

    -- B. Entrega o card
    INSERT INTO public.player_cards (player_id, card_id) 
    VALUES (v_player_id, card_id_param);

    RETURN jsonb_build_object(
        'success', true, 
        'new_balance', v_current_coins - card_price_param
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- 2. FUNÇÃO DE SELEÇÃO DE CARD (SEGURA)
CREATE OR REPLACE FUNCTION select_player_card(
    device_id_param TEXT,
    card_id_param TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_player_id UUID;
BEGIN
    SELECT id INTO v_player_id FROM public.players WHERE device_id = device_id_param;
    
    IF v_player_id IS NULL THEN
        RETURN jsonb_build_object('success', false);
    END IF;

    -- Se card_id_param for vazio, remove o card (estilo padrão)
    IF card_id_param = '' OR card_id_param IS NULL THEN
        UPDATE public.players SET selected_card_id = NULL WHERE id = v_player_id;
        RETURN jsonb_build_object('success', true);
    END IF;

    -- Só deixa equipar se o jogador TIVER o card
    IF EXISTS (SELECT 1 FROM public.player_cards WHERE player_id = v_player_id AND card_id = card_id_param) THEN
        UPDATE public.players SET selected_card_id = card_id_param WHERE id = v_player_id;
        RETURN jsonb_build_object('success', true);
    ELSE
        RETURN jsonb_build_object('success', false, 'message', 'Você não possui este card');
    END IF;
END;
$$;
