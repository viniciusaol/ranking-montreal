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
    p_tb_p1 integer DEFAULT NULL::integer,
    p_tb_p2 integer DEFAULT NULL::integer,
    p_s2_p1 integer DEFAULT NULL::integer,
    p_s2_p2 integer DEFAULT NULL::integer
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_result_id bigint;
    v_game_level varchar(5);
    v_game_date date;
    v_loser_code text;
    v_winner_level varchar(5);
    v_loser_level varchar(5);
    v_winner_games integer;
    v_loser_games integer;
    v_had_tiebreak boolean := false;
    v_winner_points integer := 40; -- 10 participação + 30 vitória
    v_loser_points integer := 10;  -- 10 participação
    
    -- Configs
    v_cfg RECORD;
    v_level_val_winner integer := 1;
    v_level_val_loser integer := 1;
    v_confrontos_count integer := 0;
BEGIN
    -- 1. Regra de segurança: Apenas quem está registrado na partida pode lançar o placar
    IF NOT EXISTS (SELECT 1 FROM public.mt_game_participants WHERE game_id = p_game_id AND customer_code = p_reported_by) THEN
        RAISE EXCEPTION 'Apenas os jogadores registrados nesta partida podem lançar o placar.';
    END IF;

    -- Busca o nível e a data do jogo
    SELECT accepted_level, game_date INTO v_game_level, v_game_date FROM public.mt_games WHERE id = p_game_id;
    IF v_game_level IS NULL THEN
        v_game_level := 'C';
    END IF;
    IF v_game_date IS NULL THEN
        v_game_date := CURRENT_DATE;
    END IF;

    -- 2. Regra da Temporada Montreal: Em dezembro não há partidas do ranking (recesso oficial)
    IF EXTRACT(MONTH FROM v_game_date) = 12 THEN
        RAISE EXCEPTION 'Em dezembro o ranking está em recesso e nenhuma partida do ranking pode ser registrada. A temporada anual ocorre de janeiro a novembro (30/11).';
    END IF;

    -- Identifica o perdedor da partida
    SELECT customer_code INTO v_loser_code
    FROM public.mt_game_participants
    WHERE game_id = p_game_id AND customer_code <> p_winner_code
    LIMIT 1;

    -- 3. Regra de Limite de Confrontos (Máximo 2 vezes nos últimos 30 dias para fins de pontuação)
    IF v_loser_code IS NOT NULL THEN
        SELECT COUNT(DISTINCT g.id)::integer INTO v_confrontos_count
        FROM public.mt_games g
        JOIN public.mt_game_participants p1 ON p1.game_id = g.id AND p1.customer_code = p_winner_code
        JOIN public.mt_game_participants p2 ON p2.game_id = g.id AND p2.customer_code = v_loser_code
        WHERE g.id <> p_game_id
          AND g.status = 'completed'
          AND g.game_date >= (v_game_date - INTERVAL '30 days')::date
          AND g.game_date <= v_game_date;

        IF v_confrontos_count >= 2 THEN
            RAISE EXCEPTION 'Pelo regulamento oficial (Regra 5), cada atleta pode enfrentar o mesmo adversário no máximo duas vezes em um período de 30 dias para fins de pontuação. Vocês já disputaram % partida(s) neste período.', v_confrontos_count;
        END IF;
    END IF;

    -- Busca a configuração ativa do ranking
    SELECT * INTO v_cfg FROM public.mt_ranking_config WHERE id = 1 LIMIT 1;
    IF v_cfg.id IS NOT NULL THEN
        -- Racional: Participação (points_loser) + Vitória (points_winner)
        v_loser_points := COALESCE(v_cfg.points_loser, 10);
        v_winner_points := v_loser_points + COALESCE(v_cfg.points_winner, 30);
    END IF;

    -- Calcula games e se houve tiebreak
    v_winner_games := GREATEST(COALESCE(p_s1_p1, 0), COALESCE(p_s1_p2, 0));
    v_loser_games := LEAST(COALESCE(p_s1_p1, 0), COALESCE(p_s1_p2, 0));
    v_had_tiebreak := (p_tb_p1 IS NOT NULL AND p_tb_p2 IS NOT NULL) OR (v_winner_games = 8 AND v_loser_games = 7) OR (v_winner_games = 9 AND v_loser_games = 8);

    -- Aplica Bônus Cumulativos (concedidos apenas ao vencedor)
    IF v_cfg.id IS NOT NULL THEN
        -- Bônus de Vitória com Pneu: 8x0 em um set (perdedor com 0 games)
        IF COALESCE(v_cfg.bonus_bagel_shutout, 0) > 0 AND v_loser_games = 0 THEN
            v_winner_points := v_winner_points + v_cfg.bonus_bagel_shutout;
        END IF;

        -- Bônus de Underdog (vitória contra jogador de nível superior)
        IF COALESCE(v_cfg.bonus_underdog_win, 0) > 0 AND v_loser_code IS NOT NULL THEN
            SELECT current_level INTO v_winner_level FROM public.mt_game_profiles WHERE customer_code = p_winner_code;
            SELECT current_level INTO v_loser_level FROM public.mt_game_profiles WHERE customer_code = v_loser_code;

            v_level_val_winner := CASE v_winner_level WHEN 'A' THEN 4 WHEN 'B' THEN 3 WHEN 'C' THEN 2 WHEN 'D' THEN 1 ELSE 2 END;
            v_level_val_loser := CASE v_loser_level WHEN 'A' THEN 4 WHEN 'B' THEN 3 WHEN 'C' THEN 2 WHEN 'D' THEN 1 ELSE 2 END;

            IF v_level_val_winner < v_level_val_loser THEN
                v_winner_points := v_winner_points + v_cfg.bonus_underdog_win;
            END IF;
        END IF;

        -- Bônus Opcional de Combatividade no Tiebreak
        IF COALESCE(v_cfg.bonus_tiebreak_loss, 0) > 0 AND v_had_tiebreak THEN
            v_loser_points := v_loser_points + v_cfg.bonus_tiebreak_loss;
        END IF;

        -- Pontos Opcionais por Game Vencido
        IF COALESCE(v_cfg.points_per_game_won, 0) > 0 THEN
            v_winner_points := v_winner_points + (v_winner_games * v_cfg.points_per_game_won);
            v_loser_points := v_loser_points + (v_loser_games * v_cfg.points_per_game_won);
        END IF;
    END IF;

    -- Deleta eventos anteriores deste jogo para evitar pontuação duplicada
    DELETE FROM public.mt_ranking_events WHERE game_id = p_game_id;
    DELETE FROM public.mt_game_result_sets WHERE result_id IN (SELECT id FROM public.mt_game_results WHERE game_id = p_game_id);
    DELETE FROM public.mt_game_results WHERE game_id = p_game_id;

    -- Insere o resultado já VALIDADO imediatamente
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

    -- Insere Set 1
    INSERT INTO public.mt_game_result_sets (
        result_id,
        set_number,
        player1_games,
        player2_games,
        tiebreak_player1,
        tiebreak_player2
    ) VALUES (
        v_result_id,
        1,
        p_s1_p1,
        p_s1_p2,
        CASE WHEN p_s2_p1 IS NULL THEN p_tb_p1 ELSE NULL END,
        CASE WHEN p_s2_p1 IS NULL THEN p_tb_p2 ELSE NULL END
    );

    -- Insere Set 2 caso informado
    IF p_s2_p1 IS NOT NULL AND p_s2_p2 IS NOT NULL THEN
        INSERT INTO public.mt_game_result_sets (result_id, set_number, player1_games, player2_games)
        VALUES (v_result_id, 2, p_s2_p1, p_s2_p2);

        IF p_tb_p1 IS NOT NULL AND p_tb_p2 IS NOT NULL THEN
            INSERT INTO public.mt_game_result_sets (result_id, set_number, player1_games, player2_games, tiebreak_player1, tiebreak_player2)
            VALUES (v_result_id, 3, CASE WHEN p_tb_p1 > p_tb_p2 THEN 1 ELSE 0 END, CASE WHEN p_tb_p2 > p_tb_p1 THEN 1 ELSE 0 END, p_tb_p1, p_tb_p2);
        END IF;
    END IF;

    -- Atualiza o status do jogo para 'completed' imediatamente
    UPDATE public.mt_games
    SET status = 'completed'
    WHERE id = p_game_id;

    -- Credita os pontos do ranking para o vencedor
    INSERT INTO public.mt_ranking_events (
        customer_code,
        game_id,
        level_code,
        points_change,
        reason,
        created_at
    ) VALUES (
        p_winner_code,
        p_game_id,
        v_game_level,
        v_winner_points,
        'victory',
        NOW()
    );

    -- Credita os pontos do ranking para o perdedor
    IF v_loser_code IS NOT NULL THEN
        INSERT INTO public.mt_ranking_events (
            customer_code,
            game_id,
            level_code,
            points_change,
            reason,
            created_at
        ) VALUES (
            v_loser_code,
            p_game_id,
            v_game_level,
            v_loser_points,
            'defeat',
            NOW()
        );
    END IF;

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

-- ====================================================================
-- RPC: VERIFICAÇÃO DE LIMITE DE CONFRONTOS (MÁXIMO 2X A CADA 30 DIAS)
-- ====================================================================
CREATE OR REPLACE FUNCTION public.fn_mt_game_verificar_limite_confrontos(
    p_player1_code text,
    p_player2_code text,
    p_game_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    can_play boolean,
    games_count integer,
    opponent_name text,
    message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_ref_date date := COALESCE(p_game_date, CURRENT_DATE);
    v_count integer;
    v_opponent_name text;
BEGIN
    SELECT COALESCE(p.display_name, c.name, 'Adversário') INTO v_opponent_name
    FROM public.mt_game_profiles p
    LEFT JOIN public.mt_clientes c ON c.customer_code = p.customer_code
    WHERE p.customer_code = p_player2_code;

    IF v_opponent_name IS NULL THEN
        SELECT COALESCE(c.name, 'Adversário') INTO v_opponent_name
        FROM public.mt_clientes c
        WHERE c.customer_code = p_player2_code;
    END IF;

    SELECT COUNT(DISTINCT g.id)::integer INTO v_count
    FROM public.mt_games g
    JOIN public.mt_game_participants p1 ON p1.game_id = g.id AND p1.customer_code = p_player1_code
    JOIN public.mt_game_participants p2 ON p2.game_id = g.id AND p2.customer_code = p_player2_code
    WHERE g.status IN ('completed', 'confirmed')
      AND g.game_date >= (v_ref_date - INTERVAL '30 days')::date
      AND g.game_date <= v_ref_date;

    IF v_count >= 2 THEN
        RETURN QUERY SELECT 
            false, 
            v_count, 
            COALESCE(v_opponent_name, 'Adversário'), 
            format('Pelo regulamento oficial do Ranking Montreal (Regra 5), cada atleta pode enfrentar o mesmo adversário no máximo duas vezes em um período de 30 dias para fins de pontuação. Você e %s já disputaram %s partida(s) nos últimos 30 dias, portanto não é permitido jogar valendo pontos no ranking.', COALESCE(v_opponent_name, 'este adversário'), v_count);
    ELSE
        RETURN QUERY SELECT 
            true, 
            v_count, 
            COALESCE(v_opponent_name, 'Adversário'), 
            'Confronto permitido pelo regulamento.';
    END IF;
END;
$$;

-- ====================================================================
-- RPC: OBTENÇÃO DO RANKING OFICIAL (PONTUAÇÃO = ACUMULADO × % APROVEITAMENTO × PENALIDADE)
-- ====================================================================
CREATE OR REPLACE FUNCTION public.fn_mt_game_obter_ranking(
    p_level_code character varying,
    p_gender text DEFAULT 'Masculino'::text,
    p_year integer DEFAULT NULL::integer
)
RETURNS TABLE (
    rank_position bigint,
    customer_code text,
    display_name text,
    avatar_url text,
    total_points numeric,
    accumulated_points bigint,
    win_rate numeric,
    days_inactive integer,
    inactivity_penalty_pct numeric,
    total_games bigint,
    total_wins bigint,
    total_losses bigint,
    gender text,
    current_level text,
    season_year integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_current_year integer := EXTRACT(YEAR FROM CURRENT_DATE)::integer;
    v_year integer := COALESCE(p_year, v_current_year);
    v_is_current boolean := (v_year = v_current_year);
BEGIN
    RETURN QUERY
    WITH events_filtered AS (
        SELECT 
            e.customer_code,
            e.game_id,
            e.level_code,
            e.points_change,
            e.reason,
            COALESCE(g.game_date, e.created_at::date) as game_date,
            EXTRACT(YEAR FROM COALESCE(g.game_date, e.created_at::date))::integer as evt_year
        FROM public.mt_ranking_events e
        LEFT JOIN public.mt_games g ON g.id = e.game_id
        WHERE EXTRACT(YEAR FROM COALESCE(g.game_date, e.created_at::date))::integer = v_year
          AND COALESCE(g.game_date, e.created_at::date) <= make_date(v_year, 11, 30)
          AND COALESCE(g.game_date, e.created_at::date) >= make_date(v_year, 1, 1)
    ),
    stats AS (
        SELECT 
            p.customer_code,
            p.display_name,
            p.avatar_url,
            COALESCE(SUM(ef.points_change), 0)::bigint as accumulated_points,
            COUNT(DISTINCT ef.game_id)::bigint as total_games,
            COUNT(DISTINCT CASE WHEN ef.reason = 'victory' THEN ef.game_id END)::bigint as total_wins,
            COUNT(DISTINCT CASE WHEN ef.reason = 'defeat' THEN ef.game_id END)::bigint as total_losses,
            COALESCE(p.gender, 'Masculino') as gender,
            p.current_level::text as current_level,
            MAX(ef.game_date) as last_game_date
        FROM public.mt_game_profiles p
        LEFT JOIN events_filtered ef ON ef.customer_code = p.customer_code AND ef.level_code = p_level_code
        WHERE (
            (v_is_current AND (p.current_level = p_level_code OR ef.customer_code IS NOT NULL))
            OR
            (NOT v_is_current AND ef.customer_code IS NOT NULL)
        )
          AND p.is_active = true
          AND (p_gender IS NULL OR COALESCE(p.gender, 'Masculino') = p_gender)
        GROUP BY p.customer_code, p.display_name, p.avatar_url, p.gender, p.current_level
    ),
    calculated AS (
        SELECT 
            s.customer_code,
            s.display_name,
            s.avatar_url,
            s.accumulated_points,
            s.total_games,
            s.total_wins,
            s.total_losses,
            s.gender,
            s.current_level,
            CASE 
                WHEN s.total_games > 0 THEN ROUND((s.total_wins::numeric / s.total_games::numeric) * 100.0, 1)
                ELSE 0.0 
            END as win_rate,
            CASE 
                WHEN v_is_current AND s.total_games > 0 AND s.last_game_date IS NOT NULL THEN (CURRENT_DATE - s.last_game_date)::integer
                ELSE 0 
            END as days_inactive,
            CASE 
                WHEN v_is_current AND s.total_games > 0 AND s.last_game_date IS NOT NULL AND (CURRENT_DATE - s.last_game_date) > 30 THEN
                    POWER(0.95, FLOOR(((CURRENT_DATE - s.last_game_date) - 31)::numeric / 15.0)::integer + 1)
                ELSE 1.0 
            END as penalty_factor
        FROM stats s
    )
    SELECT 
        DENSE_RANK() OVER (
            ORDER BY 
                ROUND(c.accumulated_points * (c.win_rate / 100.0) * c.penalty_factor, 1) DESC,
                c.win_rate DESC,
                c.total_wins DESC,
                c.display_name ASC
        )::bigint as rank_position,
        c.customer_code,
        c.display_name,
        c.avatar_url,
        ROUND(c.accumulated_points * (c.win_rate / 100.0) * c.penalty_factor, 1) as total_points,
        c.accumulated_points,
        c.win_rate,
        c.days_inactive,
        ROUND((1.0 - c.penalty_factor) * 100.0, 1) as inactivity_penalty_pct,
        c.total_games,
        c.total_wins,
        c.total_losses,
        c.gender,
        c.current_level,
        v_year as season_year
    FROM calculated c
    ORDER BY 
        total_points DESC,
        win_rate DESC,
        total_wins DESC,
        display_name ASC;
END;

-- -----------------------------------------------------------------------------
-- RPC: fn_mt_admin_alterar_nivel_atleta
-- Permite que o administrador altere o nível de qualquer atleta com histórico/auditoria
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_mt_admin_alterar_nivel_atleta(
    p_admin_code text,
    p_target_customer_code text,
    p_new_level character varying,
    p_reason text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_is_admin boolean := false;
    v_old_level varchar(5);
    v_target_name text;
BEGIN
    SELECT is_admin INTO v_is_admin 
    FROM public.mt_game_profiles 
    WHERE customer_code = p_admin_code;

    IF v_is_admin IS NOT TRUE THEN
        RAISE EXCEPTION 'Acesso negado: apenas administradores da Montreal podem alterar níveis de atletas.';
    END IF;

    IF p_new_level NOT IN ('A', 'B', 'C', 'D') THEN
        RAISE EXCEPTION 'Nível inválido: %. Escolha entre A, B, C ou D.', p_new_level;
    END IF;

    SELECT current_level, display_name 
    INTO v_old_level, v_target_name
    FROM public.mt_game_profiles
    WHERE customer_code = p_target_customer_code;

    IF v_old_level IS NULL THEN
        RAISE EXCEPTION 'Atleta não encontrado no sistema.';
    END IF;

    IF v_old_level = p_new_level THEN
        RETURN json_build_object(
            'success', true,
            'message', 'O atleta já está cadastrado no nível ' || p_new_level || '.',
            'customer_code', p_target_customer_code,
            'display_name', v_target_name,
            'previous_level', v_old_level,
            'new_level', p_new_level
        );
    END IF;

    UPDATE public.mt_game_profiles
    SET current_level = p_new_level,
        updated_at = now()
    WHERE customer_code = p_target_customer_code;

    INSERT INTO public.mt_game_level_history (
        customer_code, 
        previous_level, 
        new_level, 
        changed_by, 
        reason
    )
    VALUES (
        p_target_customer_code, 
        v_old_level, 
        p_new_level, 
        p_admin_code, 
        COALESCE(p_reason, 'Alteração de nível efetuada pelo Administrador.')
    );

    RETURN json_build_object(
        'success', true,
        'message', 'Nível de ' || v_target_name || ' alterado com sucesso de ' || v_old_level || ' para ' || p_new_level || '.',
        'customer_code', p_target_customer_code,
        'display_name', v_target_name,
        'previous_level', v_old_level,
        'new_level', p_new_level
    );
END;
$function$;

-- ====================================================================
-- FECHAR JOGO / DESAFIO ABERTO MANUALMENTE PELO CRIADOR OU ADMIN
-- ====================================================================
CREATE OR REPLACE FUNCTION public.fn_mt_game_fechar_jogo_aberto(
    p_game_id uuid,
    p_customer_code text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_creator_code text;
    v_status text;
    v_is_admin boolean := false;
BEGIN
    SELECT creator_customer_code, status 
    INTO v_creator_code, v_status
    FROM public.mt_games 
    WHERE id = p_game_id;

    IF v_status IS NULL THEN
        RAISE EXCEPTION 'Partida não encontrada.';
    END IF;

    IF v_status NOT IN ('open', 'awaiting_confirmation') THEN
        RAISE EXCEPTION 'Apenas partidas abertas ou aguardando confirmação podem ser fechadas (status atual: %).', v_status;
    END IF;

    SELECT COALESCE(is_admin, false) INTO v_is_admin
    FROM public.mt_game_profiles
    WHERE customer_code = p_customer_code;

    IF v_creator_code IS DISTINCT FROM p_customer_code AND NOT v_is_admin THEN
        RAISE EXCEPTION 'Acesso negado: apenas o criador deste desafio ou o administrador podem fechá-lo.';
    END IF;

    UPDATE public.mt_games
    SET status = 'cancelled',
        notes = COALESCE(notes, '') || ' [Fechado manualmente: sem adversário]',
        updated_at = now()
    WHERE id = p_game_id;

    UPDATE public.mt_game_participants
    SET invite_status = 'cancelled'
    WHERE game_id = p_game_id AND invite_status = 'pending';

    INSERT INTO public.mt_game_notifications (
        game_id,
        customer_code,
        event_type,
        status,
        sent_at,
        payload
    ) VALUES (
        p_game_id,
        p_customer_code,
        'open_game_closed_manually',
        'sent',
        now(),
        jsonb_build_object(
            'event', 'open_game_closed_manually',
            'game_id', p_game_id,
            'closed_by', p_customer_code
        )
    );

    RETURN json_build_object(
        'success', true,
        'message', 'Desafio aberto fechado com sucesso.'
    );
END;
$function$;

-- ====================================================================
-- OBTENÇÃO DE PENDÊNCIAS DE LEMBRETE (PRÉ-JOGO, PLACAR & AUTO-CANCELAMENTO)
-- Executado a cada 5 ou 15 min pelo n8n
-- ====================================================================
DROP FUNCTION IF EXISTS public.fn_mt_game_obter_pendencias_lembrete_placar();

CREATE OR REPLACE FUNCTION public.fn_mt_game_obter_pendencias_lembrete_placar()
RETURNS TABLE(
    game_id uuid,
    stage integer,
    stage_label text,
    athlete_customer_code text,
    athlete_name text,
    athlete_phone text,
    opponent_name text,
    game_date date,
    start_time time without time zone,
    level_code text,
    game_link text,
    formatted_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    r RECORD;
    r_pre RECORD;
    r_open RECORD;
    v_start_time timestamptz;
    v_end_time timestamptz;
    v_now timestamptz := now();
    v_stage integer;
    v_stage_label text;
    v_part1 RECORD;
    v_part2 RECORD;
    v_p1_phone text;
    v_p2_phone text;
    v_date_str text;
    v_time_str text;
    v_link text;
    v_msg1 text;
    v_msg2 text;
BEGIN
    -- 1. FECHAMENTO AUTOMÁTICO DE JOGOS ABERTOS COM 4 OU MAIS DIAS SEM ADVERSÁRIO / SEM RESULTADO
    UPDATE public.mt_games g
    SET status = 'cancelled',
        notes = COALESCE(g.notes, '') || ' [Cancelado automaticamente após 4 dias em aberto sem adversário]',
        updated_at = now()
    WHERE g.status = 'open'
      AND g.game_date <= (CURRENT_DATE - INTERVAL '4 days')
      AND NOT EXISTS (
          SELECT 1 FROM public.mt_game_results res WHERE res.game_id = g.id
      );

    -- ====================================================================
    -- 2. LEMBRETE PRÉ-JOGO: 10 MINUTOS ANTES DA PARTIDA (ESTÁGIO 5)
    -- Envia regras oficiais da partida e relembra de lançar o placar
    -- ====================================================================
    FOR r_pre IN
        SELECT 
            g.id,
            g.game_date,
            g.start_time,
            COALESCE(g.duration_minutes, 60) as duration_minutes,
            g.accepted_level,
            g.gender_category,
            g.location_id
        FROM public.mt_games g
        WHERE g.status = 'confirmed'
          AND g.game_date >= (CURRENT_DATE - INTERVAL '1 day')
          AND g.game_date <= (CURRENT_DATE + INTERVAL '1 day')
          AND NOT EXISTS (
              SELECT 1 FROM public.mt_game_results res WHERE res.game_id = g.id
          )
    LOOP
        v_start_time := timezone('America/Sao_Paulo', (r_pre.game_date + r_pre.start_time)::timestamp);

        -- Dispara se estiver na janela de 20 minutos antes até 5 minutos após o horário agendado
        IF v_now >= (v_start_time - interval '20 minutes') AND v_now <= (v_start_time + interval '5 minutes') THEN
            SELECT p.customer_code, COALESCE(gp.display_name, c.name, 'Atleta') as name, c.mobile_normalizado, c.mobile
            INTO v_part1
            FROM public.mt_game_participants p
            LEFT JOIN public.mt_game_profiles gp ON gp.customer_code = p.customer_code
            LEFT JOIN public.mt_clientes c ON c.customer_code = p.customer_code
            WHERE p.game_id = r_pre.id AND p.invite_status = 'accepted'
            ORDER BY p.role = 'creator' DESC, p.id ASC
            LIMIT 1 OFFSET 0;

            SELECT p.customer_code, COALESCE(gp.display_name, c.name, 'Adversário') as name, c.mobile_normalizado, c.mobile
            INTO v_part2
            FROM public.mt_game_participants p
            LEFT JOIN public.mt_game_profiles gp ON gp.customer_code = p.customer_code
            LEFT JOIN public.mt_clientes c ON c.customer_code = p.customer_code
            WHERE p.game_id = r_pre.id AND p.invite_status = 'accepted'
            ORDER BY p.role = 'creator' DESC, p.id ASC
            LIMIT 1 OFFSET 1;

            IF v_part1.customer_code IS NOT NULL AND v_part2.customer_code IS NOT NULL THEN
                v_p1_phone := public.fn_mt_normalizar_telefone(COALESCE(v_part1.mobile_normalizado, v_part1.mobile));
                v_p2_phone := public.fn_mt_normalizar_telefone(COALESCE(v_part2.mobile_normalizado, v_part2.mobile));

                IF length(v_p1_phone) IN (10, 11) THEN v_p1_phone := '55' || v_p1_phone; END IF;
                IF length(v_p2_phone) IN (10, 11) THEN v_p2_phone := '55' || v_p2_phone; END IF;

                v_date_str := to_char(r_pre.game_date, 'DD/MM/YYYY');
                v_time_str := to_char(r_pre.start_time, 'HH24:MI');
                v_link := 'https://ranking.montrealtenis.com.br/#/jogos/' || r_pre.id;

                v_msg1 := '🎾 *LEMBRETE: SUA PARTIDA COMEÇA EM BREVE!* 🎾' || E'\n\n' ||
                          'Olá, *' || v_part1.name || '*!' || E'\n' ||
                          'Sua partida do Ranking Montreal contra *' || v_part2.name || '* está agendada para daqui a pouco às *' || v_time_str || '* no saibro da Montreal! 🔥' || E'\n\n' ||
                          '🏆 *Nível:* Nível ' || r_pre.accepted_level || E'\n' ||
                          '📅 *Data:* ' || v_date_str || ' às ' || v_time_str || E'\n' ||
                          '📍 *Local:* Montreal Tênis Clube' || E'\n\n' ||
                          '📋 *1. FORMATO OFICIAL DAS PARTIDAS:*' || E'\n' ||
                          '• *1 Set até 8 games (No-Ad):* Partida disputada em 1 set até 8 games.' || E'\n' ||
                          '• *Empate em 7x7:* Disputa-se um Tiebreak até 7 pontos (com diferença de 2) e o vencedor fecha por 8x7.' || E'\n' ||
                          '• *No-Ad (Sem vantagem):* No empate em 40x40, o recebedor escolhe o lado da quadra para receber o saque decisivo.' || E'\n\n' ||
                          '📝 *LEMBRETE DO PLACAR:*' || E'\n' ||
                          'Ao finalizar a partida, não se esqueçam de acessar o aplicativo e registrar o resultado para computar os pontos oficiais no ranking (+30 vitória / +10 participação):' || E'\n' ||
                          '👉 ' || v_link || E'\n\n' ||
                          'Qualquer um dos dois jogadores pode lançar o resultado pelo app. Boa partida e bom jogo! 🎾🔥';

                v_msg2 := '🎾 *LEMBRETE: SUA PARTIDA COMEÇA EM BREVE!* 🎾' || E'\n\n' ||
                          'Olá, *' || v_part2.name || '*!' || E'\n' ||
                          'Sua partida do Ranking Montreal contra *' || v_part1.name || '* está agendada para daqui a pouco às *' || v_time_str || '* no saibro da Montreal! 🔥' || E'\n\n' ||
                          '🏆 *Nível:* Nível ' || r_pre.accepted_level || E'\n' ||
                          '📅 *Data:* ' || v_date_str || ' às ' || v_time_str || E'\n' ||
                          '📍 *Local:* Montreal Tênis Clube' || E'\n\n' ||
                          '📋 *1. FORMATO OFICIAL DAS PARTIDAS:*' || E'\n' ||
                          '• *1 Set até 8 games (No-Ad):* Partida disputada em 1 set até 8 games.' || E'\n' ||
                          '• *Empate em 7x7:* Disputa-se um Tiebreak até 7 pontos (com diferença de 2) e o vencedor fecha por 8x7.' || E'\n' ||
                          '• *No-Ad (Sem vantagem):* No empate em 40x40, o recebedor escolhe o lado da quadra para receber o saque decisivo.' || E'\n\n' ||
                          '📝 *LEMBRETE DO PLACAR:*' || E'\n' ||
                          'Ao finalizar a partida, não se esqueçam de acessar o aplicativo e registrar o resultado para computar os pontos oficiais no ranking (+30 vitória / +10 participação):' || E'\n' ||
                          '👉 ' || v_link || E'\n\n' ||
                          'Qualquer um dos dois jogadores pode lançar o resultado pelo app. Boa partida e bom jogo! 🎾🔥';

                IF v_p1_phone IS NOT NULL AND length(v_p1_phone) >= 10 THEN
                    IF NOT EXISTS (
                        SELECT 1 FROM public.mt_game_notifications n 
                        WHERE n.game_id = r_pre.id AND n.event_type = 'score_reminder_stage5' AND n.customer_code = v_part1.customer_code
                    ) THEN
                        RETURN QUERY SELECT 
                            r_pre.id, 
                            5 as stage, 
                            'Lembrete Pré-Jogo (10 min antes)' as stage_label, 
                            v_part1.customer_code as athlete_customer_code, 
                            v_part1.name as athlete_name, 
                            v_p1_phone as athlete_phone, 
                            v_part2.name as opponent_name, 
                            r_pre.game_date, 
                            r_pre.start_time, 
                            r_pre.accepted_level as level_code, 
                            v_link as game_link, 
                            v_msg1 as formatted_message;
                    END IF;
                END IF;

                IF v_p2_phone IS NOT NULL AND length(v_p2_phone) >= 10 THEN
                    IF NOT EXISTS (
                        SELECT 1 FROM public.mt_game_notifications n 
                        WHERE n.game_id = r_pre.id AND n.event_type = 'score_reminder_stage5' AND n.customer_code = v_part2.customer_code
                    ) THEN
                        RETURN QUERY SELECT 
                            r_pre.id, 
                            5 as stage, 
                            'Lembrete Pré-Jogo (10 min antes)' as stage_label, 
                            v_part2.customer_code as athlete_customer_code, 
                            v_part2.name as athlete_name, 
                            v_p2_phone as athlete_phone, 
                            v_part1.name as opponent_name, 
                            r_pre.game_date, 
                            r_pre.start_time, 
                            r_pre.accepted_level as level_code, 
                            v_link as game_link, 
                            v_msg2 as formatted_message;
                    END IF;
                END IF;
            END IF;
        END IF;
    END LOOP;

    -- ====================================================================
    -- 3. LEMBRETES DE PLACAR PÓS-JOGO (ESTÁGIOS 1, 2 E 3)
    -- ====================================================================
    FOR r IN
        SELECT 
            g.id,
            g.game_date,
            g.start_time,
            COALESCE(g.duration_minutes, 60) as duration_minutes,
            g.accepted_level,
            g.gender_category
        FROM public.mt_games g
        WHERE g.status = 'confirmed'
          AND g.game_date >= (CURRENT_DATE - INTERVAL '14 days')
          AND NOT EXISTS (
              SELECT 1 FROM public.mt_game_results res WHERE res.game_id = g.id
          )
    LOOP
        v_end_time := timezone('America/Sao_Paulo', (r.game_date + r.start_time)::timestamp) + (r.duration_minutes * interval '1 minute');

        v_stage := NULL;
        IF v_now >= (v_end_time + interval '4 days') THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.mt_game_notifications n 
                WHERE n.game_id = r.id AND n.event_type = 'score_reminder_stage3'
            ) THEN
                v_stage := 3;
                v_stage_label := '3º Aviso (4 dias após)';
            END IF;
        ELSIF v_now >= (v_end_time + interval '24 hours') THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.mt_game_notifications n 
                WHERE n.game_id = r.id AND n.event_type = 'score_reminder_stage2'
            ) THEN
                v_stage := 2;
                v_stage_label := '2º Aviso (Dia seguinte)';
            END IF;
        ELSIF v_now >= (v_end_time + interval '15 minutes') THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.mt_game_notifications n 
                WHERE n.game_id = r.id AND n.event_type = 'score_reminder_stage1'
            ) THEN
                v_stage := 1;
                v_stage_label := '1º Aviso (15 min após)';
            END IF;
        END IF;

        IF v_stage IS NOT NULL THEN
            SELECT p.customer_code, COALESCE(gp.display_name, c.name, 'Atleta') as name, c.mobile_normalizado, c.mobile
            INTO v_part1
            FROM public.mt_game_participants p
            LEFT JOIN public.mt_game_profiles gp ON gp.customer_code = p.customer_code
            LEFT JOIN public.mt_clientes c ON c.customer_code = p.customer_code
            WHERE p.game_id = r.id AND p.invite_status = 'accepted'
            ORDER BY p.role = 'creator' DESC, p.id ASC
            LIMIT 1 OFFSET 0;

            SELECT p.customer_code, COALESCE(gp.display_name, c.name, 'Adversário') as name, c.mobile_normalizado, c.mobile
            INTO v_part2
            FROM public.mt_game_participants p
            LEFT JOIN public.mt_game_profiles gp ON gp.customer_code = p.customer_code
            LEFT JOIN public.mt_clientes c ON c.customer_code = p.customer_code
            WHERE p.game_id = r.id AND p.invite_status = 'accepted'
            ORDER BY p.role = 'creator' DESC, p.id ASC
            LIMIT 1 OFFSET 1;

            IF v_part1.customer_code IS NOT NULL AND v_part2.customer_code IS NOT NULL THEN
                v_p1_phone := public.fn_mt_normalizar_telefone(COALESCE(v_part1.mobile_normalizado, v_part1.mobile));
                v_p2_phone := public.fn_mt_normalizar_telefone(COALESCE(v_part2.mobile_normalizado, v_part2.mobile));

                IF length(v_p1_phone) IN (10, 11) THEN v_p1_phone := '55' || v_p1_phone; END IF;
                IF length(v_p2_phone) IN (10, 11) THEN v_p2_phone := '55' || v_p2_phone; END IF;

                v_date_str := to_char(r.game_date, 'DD/MM/YYYY');
                v_time_str := to_char(r.start_time, 'HH24:MI');
                v_link := 'https://ranking.montrealtenis.com.br/#/jogos/' || r.id;

                IF v_stage = 1 THEN
                    v_msg1 := '🎾 *LEMBRETE DE PLACAR: COMO FOI A PARTIDA?* 🎾' || E'\n\n' ||
                              'Olá, *' || v_part1.name || '*!' || E'\n' ||
                              'Sua partida contra *' || v_part2.name || '* acabou de encerrar no saibro da Montreal! 🔥' || E'\n\n' ||
                              '🏆 *Nível:* Nível ' || r.accepted_level || E'\n' ||
                              '📅 *Data:* ' || v_date_str || ' às ' || v_time_str || E'\n' ||
                              '📍 *Local:* Montreal Tênis Clube' || E'\n\n' ||
                              'Para computar os seus pontos (+30 vitória / +10 participação) e atualizar sua posição no ranking, acesse o aplicativo e registre o placar final:' || E'\n' ||
                              '👉 ' || v_link || E'\n\n' ||
                              'Qualquer um dos dois jogadores pode lançar o resultado! 🎾';

                    v_msg2 := '🎾 *LEMBRETE DE PLACAR: COMO FOI A PARTIDA?* 🎾' || E'\n\n' ||
                              'Olá, *' || v_part2.name || '*!' || E'\n' ||
                              'Sua partida contra *' || v_part1.name || '* acabou de encerrar no saibro da Montreal! 🔥' || E'\n\n' ||
                              '🏆 *Nível:* Nível ' || r.accepted_level || E'\n' ||
                              '📅 *Data:* ' || v_date_str || ' às ' || v_time_str || E'\n' ||
                              '📍 *Local:* Montreal Tênis Clube' || E'\n\n' ||
                              'Para computar os seus pontos (+30 vitória / +10 participação) e atualizar sua posição no ranking, acesse o aplicativo e registre o placar final:' || E'\n' ||
                              '👉 ' || v_link || E'\n\n' ||
                              'Qualquer um dos dois jogadores pode lançar o resultado! 🎾';
                ELSIF v_stage = 2 THEN
                    v_msg1 := '🎾 *LEMBRETE: PLACAR PENDENTE NO RANKING MONTREAL* 🎾' || E'\n\n' ||
                              'Olá, *' || v_part1.name || '*!' || E'\n' ||
                              'O resultado da sua partida de ontem contra *' || v_part2.name || '* ainda não foi registrado no aplicativo.' || E'\n\n' ||
                              'Para que os pontos da rodada sejam contabilizados para você no ranking oficial, não se esqueça de informar o placar:' || E'\n' ||
                              '👉 ' || v_link || E'\n\n' ||
                              'Leva menos de 1 minuto para lançar! ⏱️🎾';

                    v_msg2 := '🎾 *LEMBRETE: PLACAR PENDENTE NO RANKING MONTREAL* 🎾' || E'\n\n' ||
                              'Olá, *' || v_part2.name || '*!' || E'\n' ||
                              'O resultado da sua partida de ontem contra *' || v_part1.name || '* ainda não foi registrado no aplicativo.' || E'\n\n' ||
                              'Para que os pontos da rodada sejam contabilizados para você no ranking oficial, não se esqueça de informar o placar:' || E'\n' ||
                              '👉 ' || v_link || E'\n\n' ||
                              'Leva menos de 1 minuto para lançar! ⏱️🎾';
                ELSE
                    v_msg1 := '⚠️ *ÚLTIMO AVISO: PLACAR DA PARTIDA NÃO REGISTRADO* ⚠️' || E'\n\n' ||
                              'Olá, *' || v_part1.name || '*!' || E'\n' ||
                              'A partida realizada em ' || v_date_str || ' entre você e *' || v_part2.name || '* ainda consta sem resultado no Ranking Montreal.' || E'\n\n' ||
                              'Lembre-se que partidas sem placar não pontuam na tabela. Por favor, acesse o app e conclua o lançamento do placar:' || E'\n' ||
                              '👉 ' || v_link || E'\n\n' ||
                              'Contamos com sua colaboração para manter o ranking atualizado! 🎾';

                    v_msg2 := '⚠️ *ÚLTIMO AVISO: PLACAR DA PARTIDA NÃO REGISTRADO* ⚠️' || E'\n\n' ||
                              'Olá, *' || v_part2.name || '*!' || E'\n' ||
                              'A partida realizada em ' || v_date_str || ' entre você e *' || v_part1.name || '* ainda consta sem resultado no Ranking Montreal.' || E'\n\n' ||
                              'Lembre-se que partidas sem placar não pontuam na tabela. Por favor, acesse o app e conclua o lançamento do placar:' || E'\n' ||
                              '👉 ' || v_link || E'\n\n' ||
                              'Contamos com sua colaboração para manter o ranking atualizado! 🎾';
                END IF;

                IF v_p1_phone IS NOT NULL AND length(v_p1_phone) >= 10 THEN
                    RETURN QUERY SELECT 
                        r.id, v_stage, v_stage_label, v_part1.customer_code, v_part1.name, v_p1_phone, v_part2.name, r.game_date, r.start_time, r.accepted_level, v_link, v_msg1;
                END IF;

                IF v_p2_phone IS NOT NULL AND length(v_p2_phone) >= 10 THEN
                    RETURN QUERY SELECT 
                        r.id, v_stage, v_stage_label, v_part2.customer_code, v_part2.name, v_p2_phone, v_part1.name, r.game_date, r.start_time, r.accepted_level, v_link, v_msg2;
                END IF;
            END IF;
        END IF;
    END LOOP;

    -- ====================================================================
    -- 4. AVISO PARA O CRIADOR DE JOGO ABERTO (APÓS A DATA DO JOGO SEM ADVERSÁRIO)
    -- ====================================================================
    FOR r_open IN
        SELECT 
            g.id,
            g.game_date,
            g.start_time,
            COALESCE(g.duration_minutes, 60) as duration_minutes,
            g.accepted_level,
            g.creator_customer_code
        FROM public.mt_games g
        WHERE g.status = 'open'
          AND g.game_date <= CURRENT_DATE
          AND g.game_date >= (CURRENT_DATE - INTERVAL '4 days')
          AND g.creator_customer_code IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM public.mt_game_results res WHERE res.game_id = g.id
          )
          AND NOT EXISTS (
              SELECT 1 FROM public.mt_game_notifications n 
              WHERE n.game_id = g.id AND n.event_type = 'score_reminder_stage4'
          )
    LOOP
        v_end_time := timezone('America/Sao_Paulo', (r_open.game_date + r_open.start_time)::timestamp) + (r_open.duration_minutes * interval '1 minute');

        -- Dispara o aviso após o término do dia do jogo (a partir de 12 horas após o jogo até antes de 4 dias)
        IF v_now >= (v_end_time + interval '12 hours') AND v_now < (v_end_time + interval '4 days') THEN
            SELECT gp.customer_code, COALESCE(gp.display_name, c.name, 'Atleta') as name, c.mobile_normalizado, c.mobile
            INTO v_part1
            FROM public.mt_game_profiles gp
            LEFT JOIN public.mt_clientes c ON c.customer_code = gp.customer_code
            WHERE gp.customer_code = r_open.creator_customer_code
            LIMIT 1;

            IF v_part1.customer_code IS NOT NULL THEN
                v_p1_phone := public.fn_mt_normalizar_telefone(COALESCE(v_part1.mobile_normalizado, v_part1.mobile));
                IF length(v_p1_phone) IN (10, 11) THEN v_p1_phone := '55' || v_p1_phone; END IF;

                IF v_p1_phone IS NOT NULL AND length(v_p1_phone) >= 10 THEN
                    v_date_str := to_char(r_open.game_date, 'DD/MM/YYYY');
                    v_time_str := to_char(r_open.start_time, 'HH24:MI');
                    v_link := 'https://ranking.montrealtenis.com.br/#/jogos/' || r_open.id;

                    v_msg1 := '🎾 *SEU DESAFIO ABERTO NO RANKING MONTREAL* 🎾' || E'\n\n' ||
                              'Olá, *' || v_part1.name || '*!' || E'\n' ||
                              'Você abriu um desafio no Ranking para *' || v_date_str || ' às ' || v_time_str || '*, mas ele ainda consta em aberto (sem adversário definido) no aplicativo.' || E'\n\n' ||
                              '❓ *A partida aconteceu com algum tenista?*' || E'\n' ||
                              '• *Se jogou com alguém:* Acesse o link abaixo para vincular o adversário e lançar o placar:' || E'\n' ||
                              '👉 ' || v_link || E'\n\n' ||
                              '• *Se não conseguiu adversário:* Você pode fechar o desafio pelo app no botão "Fechar Desafio".' || E'\n\n' ||
                              '⏱️ *Aviso:* Caso não informe o placar ou não feche manualmente, este desafio será *cancelado e fechado automaticamente em até 4 dias*. 🎾';

                    RETURN QUERY SELECT 
                        r_open.id, 
                        4 as stage, 
                        'Aviso: Desafio Aberto Sem Adversário' as stage_label, 
                        v_part1.customer_code as athlete_customer_code, 
                        v_part1.name as athlete_name, 
                        v_p1_phone as athlete_phone, 
                        'Sem Adversário' as opponent_name, 
                        r_open.game_date, 
                        r_open.start_time, 
                        r_open.accepted_level as level_code, 
                        v_link as game_link, 
                        v_msg1 as formatted_message;
                END IF;
            END IF;
        END IF;
    END LOOP;
END;
$function$;

-- ====================================================================
-- OBTENÇÃO DE ATLETAS INATIVOS (> 7 DIAS SEM JOGAR) PARA LEMBRETE NO WHATSAPP
-- ====================================================================
CREATE OR REPLACE FUNCTION public.fn_mt_ranking_obter_atletas_inativos_lembrete(
    p_min_days_inactive integer DEFAULT 7,
    p_cooldown_days integer DEFAULT 7
)
RETURNS TABLE(
    customer_code text,
    athlete_name text,
    athlete_phone text,
    level_code text,
    days_inactive integer,
    last_activity_date date,
    game_link text,
    formatted_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    r RECORD;
    v_phone text;
    v_link text := 'https://ranking.montrealtenis.com.br/#/jogos/criar';
    v_msg text;
BEGIN
    FOR r IN
        SELECT 
            p.customer_code,
            COALESCE(p.display_name, c.name, 'Tenista') as athlete_name,
            COALESCE(c.mobile_normalizado, c.mobile) as raw_phone,
            p.current_level::text as current_level,
            COALESCE(MAX(g.game_date), p.created_at::date) as last_activity_date,
            (CURRENT_DATE - COALESCE(MAX(g.game_date), p.created_at::date))::integer as days_inactive
        FROM public.mt_game_profiles p
        LEFT JOIN public.mt_clientes c ON c.customer_code = p.customer_code
        LEFT JOIN public.mt_game_participants part ON part.customer_code = p.customer_code AND part.invite_status = 'accepted'
        LEFT JOIN public.mt_games g ON g.id = part.game_id AND (g.status = 'completed' OR EXISTS (SELECT 1 FROM public.mt_game_results res WHERE res.game_id = g.id))
        WHERE p.is_active = true
        GROUP BY p.customer_code, p.display_name, c.name, c.mobile_normalizado, c.mobile, p.current_level, p.created_at
        HAVING (CURRENT_DATE - COALESCE(MAX(g.game_date), p.created_at::date)) >= p_min_days_inactive
        ORDER BY days_inactive DESC
    LOOP
        -- 1. Verifica se já não possui partida confirmada agendada para hoje ou data futura
        IF EXISTS (
            SELECT 1 
            FROM public.mt_game_participants part2
            JOIN public.mt_games g2 ON g2.id = part2.game_id
            WHERE part2.customer_code = r.customer_code
              AND part2.invite_status = 'accepted'
              AND g2.game_date >= CURRENT_DATE
              AND g2.status = 'confirmed'
        ) THEN
            CONTINUE;
        END IF;

        -- 2. Anti-spam / Cooldown: Verifica se já não recebeu lembrete de inatividade no período de cooldown
        IF EXISTS (
            SELECT 1 
            FROM public.mt_game_notifications n
            WHERE n.customer_code = r.customer_code
              AND n.event_type = 'inactivity_reminder'
              AND n.sent_at >= (now() - (p_cooldown_days || ' days')::interval)
        ) THEN
            CONTINUE;
        END IF;

        -- 3. Normalização e Validação do Telefone
        v_phone := public.fn_mt_normalizar_telefone(r.raw_phone);
        IF length(v_phone) IN (10, 11) THEN
            v_phone := '55' || v_phone;
        END IF;

        IF v_phone IS NOT NULL AND length(v_phone) >= 10 THEN
            v_msg := '🎾 *BORA PRA QUADRA? O RANKING MONTREAL TE ESPERA!* 🎾' || E'\n\n' ||
                     'Olá, *' || r.athlete_name || '*! Tudo bem?' || E'\n' ||
                     'Notamos que você está há *' || r.days_inactive || ' dias* sem disputar uma partida oficial pelo Ranking da Montreal no saibro! 🔥' || E'\n\n' ||
                     '🏆 *Seu Nível Atual:* Nível ' || r.current_level || E'\n' ||
                     '📈 *Dica do Ranking:* Jogar partidas regulares mantém seu ritmo de jogo afiado, soma pontos para subir na tabela e evita penalização por inatividade.' || E'\n\n' ||
                     'Bora movimentar a raquete esta semana? Você pode:' || E'\n' ||
                     '1️⃣ *Abrir um Desafio Aberto:* Escolha o dia/horário ideal e o app avisa outros tenistas do seu nível!' || E'\n' ||
                     '2️⃣ *Convidar um Amigo Direto:* Agende com qualquer tenista cadastrado no clube buscando pelo WhatsApp.' || E'\n' ||
                     '3️⃣ *Entrar em Jogos Abertos:* Veja partidas aguardando adversário no seu nível.' || E'\n\n' ||
                     '👉 *Acesse o app para marcar sua partida agora:*' || E'\n' ||
                     v_link || E'\n\n' ||
                     'Nos vemos no saibro da Montreal! 🎾👊';

            RETURN QUERY SELECT 
                r.customer_code,
                r.athlete_name,
                v_phone,
                r.current_level,
                r.days_inactive,
                r.last_activity_date,
                v_link,
                v_msg;
        END IF;
    END LOOP;
END;
$function$;

-- ====================================================================
-- REGISTRAR ENVIO DE LEMBRETE DE INATIVIDADE
-- ====================================================================
CREATE OR REPLACE FUNCTION public.fn_mt_ranking_registrar_lembrete_inatividade(
    p_customer_code text,
    p_days_inactive integer DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
    INSERT INTO public.mt_game_notifications (
        customer_code,
        event_type,
        status,
        sent_at,
        payload
    ) VALUES (
        p_customer_code,
        'inactivity_reminder',
        'sent',
        now(),
        jsonb_build_object(
            'event', 'inactivity_reminder_sent',
            'days_inactive', p_days_inactive,
            'customer_code', p_customer_code
        )
    );
    RETURN true;
EXCEPTION WHEN OTHERS THEN
    RETURN false;
END;
$function$;



