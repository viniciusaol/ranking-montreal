-- ====================================================================
-- MONTREAL TÊNIS CLUBE - RANKING E ORGANIZAÇÃO DE JOGOS (V1.1)
-- ====================================================================
-- Migração e Definição de Banco de Dados (Supabase PostgreSQL 17)

-- 1. Níveis e Categorias Esportivas
CREATE TABLE IF NOT EXISTS public.mt_game_levels (
    level_code varchar(5) PRIMARY KEY,
    name text NOT NULL,
    description text NOT NULL,
    sort_order integer NOT NULL,
    created_at timestamptz DEFAULT now()
);

INSERT INTO public.mt_game_levels (level_code, name, description, sort_order) VALUES
('A', 'Nível A', 'Jogador competitivo e experiente. Trocas intensas, saque e devolução consistentes, tática avançada.', 1),
('B', 'Nível B', 'Jogador avançado / intermediário avançado. Bom controle, ritmo forte e consistência.', 2),
('C', 'Nível C', 'Jogador intermediário. Joga partidas completas, troca de fundo regular, em desenvolvimento de ritmo.', 3),
('D', 'Nível D', 'Jogador iniciante / em evolução. Desenvolvendo golpes e saques, aprendendo contagem e regras.', 4)
ON CONFLICT (level_code) DO NOTHING;

-- 2. Perfis Esportivos dos Clientes
CREATE TABLE IF NOT EXISTS public.mt_game_profiles (
    customer_code text PRIMARY KEY REFERENCES public.mt_clientes(customer_code) ON DELETE CASCADE,
    display_name text NOT NULL,
    current_level varchar(5) NOT NULL REFERENCES public.mt_game_levels(level_code) DEFAULT 'C',
    gender text DEFAULT 'Masculino' CHECK (gender IN ('Masculino', 'Feminino')),
    avatar_url text,
    is_active boolean DEFAULT true,
    is_admin boolean DEFAULT false,
    terms_accepted_at timestamptz,
    privacy_accepted_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 3. Histórico de Nível
CREATE TABLE IF NOT EXISTS public.mt_game_level_history (
    id bigserial PRIMARY KEY,
    customer_code text NOT NULL REFERENCES public.mt_clientes(customer_code) ON DELETE CASCADE,
    previous_level varchar(5),
    new_level varchar(5) NOT NULL,
    changed_by text NOT NULL,
    reason text,
    created_at timestamptz DEFAULT now()
);

-- 4. Preferências de Notificação
CREATE TABLE IF NOT EXISTS public.mt_game_notification_preferences (
    customer_code text PRIMARY KEY REFERENCES public.mt_clientes(customer_code) ON DELETE CASCADE,
    notify_same_level boolean DEFAULT true,
    notify_level_above boolean DEFAULT true,
    notify_level_below boolean DEFAULT false,
    notify_invites boolean DEFAULT true,
    notify_reminders boolean DEFAULT true,
    notify_ranking_updates boolean DEFAULT true,
    notify_court_availability boolean DEFAULT true,
    updated_at timestamptz DEFAULT now()
);

-- 5. Locais de Jogo
CREATE TABLE IF NOT EXISTS public.mt_game_locations (
    id serial PRIMARY KEY,
    name text NOT NULL,
    address text,
    is_montreal boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

INSERT INTO public.mt_game_locations (id, name, is_montreal, is_active) VALUES
(1, 'Montreal Tênis Clube', true, true),
(2, 'Outro Local', false, true)
ON CONFLICT (id) DO NOTHING;

-- 6. Jogos Organizados
CREATE TABLE IF NOT EXISTS public.mt_games (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_customer_code text NOT NULL REFERENCES public.mt_clientes(customer_code),
    sport text NOT NULL DEFAULT 'Tênis',
    game_type text NOT NULL DEFAULT 'Simples',
    gender_category text NOT NULL DEFAULT 'Masculino' CHECK (gender_category IN ('Masculino', 'Feminino', 'Misto')),
    accepted_level varchar(5) NOT NULL REFERENCES public.mt_game_levels(level_code),
    game_date date NOT NULL,
    start_time time NOT NULL,
    duration_minutes integer NOT NULL DEFAULT 60,
    end_time time,
    location_id integer NOT NULL REFERENCES public.mt_game_locations(id),
    court_name text,
    is_friendly boolean DEFAULT true,
    notes text,
    
    status text NOT NULL DEFAULT 'open' CHECK (status IN (
        'draft', 'open', 'awaiting_confirmation', 'confirmed', 
        'in_progress', 'awaiting_result', 'result_pending_validation', 
        'completed', 'cancelled', 'disputed', 'voided'
    )),
    
    court_reservation_status text NOT NULL DEFAULT 'nao_reservada' CHECK (court_reservation_status IN (
        'nao_necessaria', 'nao_reservada', 'aguardando_reserva', 
        'reserva_declarada', 'reserva_confirmada', 'reserva_cancelada'
    )),
    court_reservation_source text DEFAULT 'user_declared' CHECK (court_reservation_source IN (
        'user_declared', 'matchpoint', 'admin', 'integration', 'unknown'
    )),
    court_reservation_confirmed_by text REFERENCES public.mt_clientes(customer_code),
    court_reservation_confirmed_at timestamptz,
    booking_external_url text DEFAULT 'https://montrealtenisclubeltda-br.matchpoint.com.es/Booking/Grid.aspx',

    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 7. Participantes do Jogo
CREATE TABLE IF NOT EXISTS public.mt_game_participants (
    id bigserial PRIMARY KEY,
    game_id uuid NOT NULL REFERENCES public.mt_games(id) ON DELETE CASCADE,
    customer_code text NOT NULL REFERENCES public.mt_clientes(customer_code),
    role text NOT NULL DEFAULT 'player' CHECK (role IN ('creator', 'player', 'guest')),
    invite_status text NOT NULL DEFAULT 'pending' CHECK (invite_status IN (
        'pending', 'accepted', 'declined', 'expired', 'cancelled', 'requested'
    )),
    requested_at timestamptz DEFAULT now(),
    responded_at timestamptz,
    CONSTRAINT mt_game_participants_unique UNIQUE (game_id, customer_code)
);

-- 8. Resultados
CREATE TABLE IF NOT EXISTS public.mt_game_results (
    id bigserial PRIMARY KEY,
    game_id uuid UNIQUE NOT NULL REFERENCES public.mt_games(id) ON DELETE CASCADE,
    winner_customer_code text REFERENCES public.mt_clientes(customer_code),
    is_wo boolean DEFAULT false,
    is_abandonment boolean DEFAULT false,
    reported_by text NOT NULL REFERENCES public.mt_clientes(customer_code),
    reported_at timestamptz DEFAULT now(),
    notes text,
    validation_status text NOT NULL DEFAULT 'pending' CHECK (validation_status IN ('pending', 'validated', 'disputed', 'rejected'))
);

-- 9. Sets do Resultado
CREATE TABLE IF NOT EXISTS public.mt_game_result_sets (
    id bigserial PRIMARY KEY,
    result_id bigint NOT NULL REFERENCES public.mt_game_results(id) ON DELETE CASCADE,
    set_number integer NOT NULL,
    player1_games integer NOT NULL,
    player2_games integer NOT NULL,
    tiebreak_player1 integer,
    tiebreak_player2 integer
);

-- 10. Confirmação de Resultado
CREATE TABLE IF NOT EXISTS public.mt_game_result_confirmations (
    id bigserial PRIMARY KEY,
    result_id bigint NOT NULL REFERENCES public.mt_game_results(id) ON DELETE CASCADE,
    customer_code text NOT NULL REFERENCES public.mt_clientes(customer_code),
    confirmed boolean NOT NULL,
    dispute_reason text,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT mt_game_result_confirmations_unique UNIQUE (result_id, customer_code)
);

-- 11. Eventos de Pontuação e Ranking
CREATE TABLE IF NOT EXISTS public.mt_ranking_events (
    id bigserial PRIMARY KEY,
    customer_code text NOT NULL REFERENCES public.mt_clientes(customer_code),
    game_id uuid REFERENCES public.mt_games(id),
    level_code varchar(5) NOT NULL REFERENCES public.mt_game_levels(level_code),
    points_change integer NOT NULL,
    reason text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- 12. Notificações
CREATE TABLE IF NOT EXISTS public.mt_game_notifications (
    id bigserial PRIMARY KEY,
    customer_code text NOT NULL REFERENCES public.mt_clientes(customer_code),
    event_type text NOT NULL,
    game_id uuid REFERENCES public.mt_games(id),
    payload jsonb NOT NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    sent_at timestamptz,
    created_at timestamptz DEFAULT now()
);

-- ====================================================================
-- RPC: REGISTRO DE PLACAR DIRETO (VALIDAÇÃO IMEDIATA PARA O RANKING)
-- ====================================================================
CREATE OR REPLACE FUNCTION public.fn_mt_game_registrar_resultado(
    p_game_id uuid,
    p_reported_by text,
    p_winner_code text,
    p_s1_p1 integer,
    p_s1_p2 integer,
    p_s2_p1 integer,
    p_s2_p2 integer,
    p_tb_p1 integer DEFAULT NULL::integer,
    p_tb_p2 integer DEFAULT NULL::integer
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_result_id bigint;
    v_game_level varchar(5);
    r_part RECORD;
    v_is_winner boolean;
    v_points integer;
    v_reason text;
BEGIN
    -- 1. Regra de segurança: Apenas jogadores registrados nesta partida podem lançar o placar
    IF NOT EXISTS (SELECT 1 FROM public.mt_game_participants WHERE game_id = p_game_id AND customer_code = p_reported_by) THEN
        RAISE EXCEPTION 'Apenas os jogadores registrados nesta partida podem lançar o placar.';
    END IF;

    SELECT accepted_level INTO v_game_level FROM public.mt_games WHERE id = p_game_id;
    IF v_game_level IS NULL THEN
        v_game_level := 'C';
    END IF;

    DELETE FROM public.mt_ranking_events WHERE game_id = p_game_id;
    DELETE FROM public.mt_game_result_sets WHERE result_id IN (SELECT id FROM public.mt_game_results WHERE game_id = p_game_id);
    DELETE FROM public.mt_game_results WHERE game_id = p_game_id;

    INSERT INTO public.mt_game_results (
        game_id,
        reported_by,
        winner_customer_code,
        validation_status,
        reported_at
    ) VALUES (
        p_game_id,
        p_reported_by,
        p_winner_code,
        'validated',
        NOW()
    ) RETURNING id INTO v_result_id;

    INSERT INTO public.mt_game_result_sets (result_id, set_number, player1_games, player2_games)
    VALUES (v_result_id, 1, p_s1_p1, p_s1_p2);

    INSERT INTO public.mt_game_result_sets (result_id, set_number, player1_games, player2_games)
    VALUES (v_result_id, 2, p_s2_p1, p_s2_p2);

    IF p_tb_p1 IS NOT NULL AND p_tb_p2 IS NOT NULL THEN
        INSERT INTO public.mt_game_result_sets (result_id, set_number, player1_games, player2_games, tiebreak_player1, tiebreak_player2)
        VALUES (v_result_id, 3, CASE WHEN p_tb_p1 > p_tb_p2 THEN 1 ELSE 0 END, CASE WHEN p_tb_p2 > p_tb_p1 THEN 1 ELSE 0 END, p_tb_p1, p_tb_p2);
    END IF;

    UPDATE public.mt_games
    SET status = 'completed'
    WHERE id = p_game_id;

    FOR r_part IN SELECT customer_code FROM public.mt_game_participants WHERE game_id = p_game_id LOOP
        v_is_winner := (r_part.customer_code = p_winner_code);
        v_points := CASE WHEN v_is_winner THEN 30 ELSE 10 END;
        v_reason := CASE WHEN v_is_winner THEN 'victory' ELSE 'defeat' END;

        INSERT INTO public.mt_ranking_events (
            customer_code,
            game_id,
            level_code,
            points_change,
            reason,
            created_at
        ) VALUES (
            r_part.customer_code,
            p_game_id,
            v_game_level,
            v_points,
            v_reason,
            NOW()
        );
    END LOOP;

    RETURN v_result_id;
END;
$function$;

-- ====================================================================
-- RPC: LISTAR ATLETAS ATIVADOS NO RANKING (EXCLUSIVO ADMIN)
-- ====================================================================
CREATE OR REPLACE FUNCTION public.fn_mt_admin_listar_atletas_ativados(p_admin_code text)
RETURNS TABLE (
    customer_code text,
    display_name text,
    official_name text,
    phone text,
    current_level character varying,
    gender text,
    is_admin boolean,
    terms_accepted_at timestamp with time zone,
    created_at timestamp with time zone,
    total_games bigint,
    total_points bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_is_admin boolean;
BEGIN
    SELECT COALESCE(p.is_admin, false) INTO v_is_admin
    FROM public.mt_game_profiles p
    WHERE p.customer_code = p_admin_code;

    IF NOT COALESCE(v_is_admin, false) THEN
        RAISE EXCEPTION 'Acesso restrito a administradores.';
    END IF;

    RETURN QUERY
    SELECT 
        p.customer_code,
        p.display_name,
        COALESCE(c.name, p.display_name) AS official_name,
        COALESCE(c.mobile, c.mobile_normalizado, '') AS phone,
        p.current_level,
        COALESCE(p.gender, 'Masculino') AS gender,
        COALESCE(p.is_admin, false) AS is_admin,
        p.terms_accepted_at,
        p.created_at,
        COALESCE((
            SELECT COUNT(*) 
            FROM public.mt_game_participants gp 
            WHERE gp.customer_code = p.customer_code
        ), 0)::bigint AS total_games,
        COALESCE((
            SELECT SUM(re.points_change) 
            FROM public.mt_ranking_events re 
            WHERE re.customer_code = p.customer_code
        ), 0)::bigint AS total_points
    FROM public.mt_game_profiles p
    LEFT JOIN public.mt_clientes c ON c.customer_code = p.customer_code
    WHERE p.is_active = true
    ORDER BY COALESCE(p.terms_accepted_at, p.created_at) DESC;
END;
$$;

