/* ====================================================================
   MONTREAL TÊNIS CLUBE - CONFIGURAÇÕES CENTRAIS (V1.1)
   ==================================================================== */

export const CONFIG = {
    APP_NAME: "Montreal Ranking",
    APP_VERSION: "1.2.0",
    APP_PUBLIC_URL: "https://ranking.montrealtenis.com.br",
    
    // Link Oficial para Reserva de Quadras na Montreal
    MONTREAL_BOOKING_URL: "https://montrealtenisclubeltda-br.matchpoint.com.es/Booking/Grid.aspx",
    
    // Supabase (Projeto: Redirection/Montreal)
    SUPABASE_URL: "https://ehhjnwosqcrfwonqhfoz.supabase.co",
    SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVoaGpud29zcWNyZndvbnFoZm96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4OTc4NjksImV4cCI6MjA3ODQ3Mzg2OX0.qxbGgdq3lOiOmXuY8fMok7xlNluKPQIKoC3zQroUYSQ",

    // Níveis e Descrições Oficiais
    LEVEL_DESCRIPTIONS: {
        A: "Jogador competitivo e experiente. Trocas intensas, saque e devolução consistentes, visão tática avançada.",
        B: "Jogador avançado ou intermediário avançado. Trocas consistentes, controle de saque, jogo em ritmo forte.",
        C: "Jogador intermediário. Conhece regras e contagem, joga partidas completas, troca regular de fundo.",
        D: "Jogador iniciante ou em evolução. Desenvolvendo golpes e saques, aprendendo regras e posicionamento."
    },

    STORAGE_KEYS: {
        AUTH_TOKEN: "mt_ranking_auth_code",
        USER_PROFILE: "mt_ranking_user_profile",
        DRAFT_GAME: "mt_ranking_draft_game"
    },

    // Notificações WhatsApp / Uazapi / n8n
    NOTIFICATIONS: {
        ENABLED: true,
        UAZAPI_SERVER_URL: "https://montrealtenis.uazapi.com",
        UAZAPI_TOKEN: "4a87a0fd-84b0-404d-83e3-de5d2d7d0022",
        RANKING_GROUP_JID: "120363428928893345@g.us",
        N8N_WEBHOOK_URL: "" // Preencher caso deseje rotear via Webhook do n8n
    }
};
