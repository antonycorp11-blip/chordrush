-- Atualiza a tabela players para suportar o rastreamento de histórias vistas
-- Isso garante que se o jogador trocar de navegador/dispositivo, ele não precise ver a história de novo se já viu.

ALTER TABLE players ADD COLUMN IF NOT EXISTS seen_story_ids INTEGER[] DEFAULT '{}';

-- Atualiza a função de atualização de nome para não resetar esse campo
-- (Geralmente não reseta a menos que o UPDATE seja total, mas é bom garantir)

-- Se houver necessidade de atualizar o RPC de sincronização segura:
-- secure_end_game_v5 (não mexe em seen_story_ids)
-- unlock_next_arena (não mexe em seen_story_ids)

-- Adicionamos uma nova função para marcar história como vista no banco
CREATE OR REPLACE FUNCTION mark_story_seen(device_id_param TEXT, story_id INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE players 
    SET seen_story_ids = array_append(seen_story_ids, story_id)
    WHERE device_id = device_id_param 
    AND NOT (seen_story_ids @> ARRAY[story_id]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
