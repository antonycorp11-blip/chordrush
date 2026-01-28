-- LISTA DE PINS DOS JOGADORES
-- Rode este script no Editor SQL do Supabase para ver a lista de todos os alunos e seus PINs.

SELECT 
    name as "Nome do Jogador", 
    recovery_pin as "PIN",
    acorde_coins as "Coins",
    accumulated_xp as "XP"
FROM players
ORDER BY name ASC;

-- Se precisar exportar para CSV, o Supabase tem um botão de "download CSV" nos resultados.
