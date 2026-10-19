-- ====================================================================
-- MONTREAL RANKING & JOGOS - SCRIPT DE ROLLBACK / DESINSTALAÇÃO RÁPIDA
-- ====================================================================
-- Ao executar este script no Supabase, todas as tabelas e RPCs criadas
-- para o módulo de ranking serão removidas.
-- As tabelas originais do clube (mt_clientes, mt_bookings, etc.) NÃO são alteradas.

DROP TABLE IF EXISTS public.mt_game_notifications CASCADE;
DROP TABLE IF EXISTS public.mt_ranking_events CASCADE;
DROP TABLE IF EXISTS public.mt_game_result_confirmations CASCADE;
DROP TABLE IF EXISTS public.mt_game_result_sets CASCADE;
DROP TABLE IF EXISTS public.mt_game_results CASCADE;
DROP TABLE IF EXISTS public.mt_game_participants CASCADE;
DROP TABLE IF EXISTS public.mt_games CASCADE;
DROP TABLE IF EXISTS public.mt_game_locations CASCADE;
DROP TABLE IF EXISTS public.mt_game_notification_preferences CASCADE;
DROP TABLE IF EXISTS public.mt_game_level_history CASCADE;
DROP TABLE IF EXISTS public.mt_game_profiles CASCADE;
DROP TABLE IF EXISTS public.mt_game_levels CASCADE;

DROP FUNCTION IF EXISTS public.fn_mt_game_verificar_elegibilidade(text) CASCADE;
DROP FUNCTION IF EXISTS public.fn_mt_game_obter_perfil(text) CASCADE;
DROP FUNCTION IF EXISTS public.fn_mt_game_salvar_perfil(text, text, varchar, text) CASCADE;
DROP FUNCTION IF EXISTS public.fn_mt_game_obter_ranking(varchar) CASCADE;
