/* ====================================================================
   MONTREAL TÊNIS CLUBE - UTILITÁRIOS, MÁSCARAS E RÓTULOS (PORTUGUÊS)
   ==================================================================== */

export function formatDateBR(dateStr) {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
}

export function formatTimeHM(timeStr) {
    if (!timeStr) return '';
    return timeStr.substring(0, 5);
}

export function formatPhone(phoneStr) {
    if (!phoneStr) return '';
    const clean = phoneStr.replace(/\D/g, '');
    if (clean.length === 11) {
        return `(${clean.substring(0,2)}) ${clean.substring(2,7)}-${clean.substring(7)}`;
    }
    if (clean.length === 10) {
        return `(${clean.substring(0,2)}) ${clean.substring(2,6)}-${clean.substring(6)}`;
    }
    return phoneStr;
}

export function getInitials(name) {
    if (!name) return 'MT';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function openMontrealBooking() {
    window.open("https://montrealtenisclubeltda-br.matchpoint.com.es/Booking/Grid.aspx", "_blank", "noopener,noreferrer");
}

// Mapeamento dos status de jogos de banco de dados para português claro
export function getGameStatusLabel(status) {
    const map = {
        'draft': 'Rascunho',
        'open': 'Vaga Aberta',
        'awaiting_confirmation': 'Aguardando Confirmação',
        'confirmed': 'Confirmado',
        'in_progress': 'Em Andamento',
        'awaiting_result': 'Aguardando Placar',
        'result_pending_validation': 'Placar Pendente de Validação',
        'completed': 'Partida Concluída',
        'cancelled': 'Partida Cancelada',
        'disputed': 'Resultado Contestado',
        'voided': 'Partida Anulada'
    };
    return map[status] || status;
}

// Mapeamento dos status de reserva de quadra para português
export function getCourtReservationStatusLabel(status) {
    const map = {
        'nao_necessaria': 'Não Necessária',
        'nao_reservada': 'Ainda Não Reservada',
        'aguardando_reserva': 'Aguardando Reserva',
        'reserva_declarada': 'Reserva Informada pelo Usuário',
        'reserva_confirmada': 'Reserva Confirmada',
        'reserva_cancelada': 'Reserva Cancelada'
    };
    return map[status] || status;
}

// ====================================================================
// REGRAS DE HIERARQUIA DE NÍVEIS E RANKING
// ====================================================================
// Hierarquia: D (Iniciante) -> C (Intermediário) -> B (Avançado/Interm) -> A (Competitivo)
export const LEVEL_ORDER = ['D', 'C', 'B', 'A'];

export const LEVEL_LABELS = {
    'A': 'Nível A (Avançado / Competitivo)',
    'B': 'Nível B (Avançado / Intermediário)',
    'C': 'Nível C (Intermediário)',
    'D': 'Nível D (Iniciante)'
};

/**
 * Retorna os níveis de partida permitidos para um jogador.
 * Regra: Um jogador só pode jogar no seu nível atual ou no máximo 1 degrau acima (pra cima somente).
 * Ex: Nível B -> pode jogar B e A (não pode C nem D).
 *     Nível C -> pode jogar C e B (não pode A nem D).
 */
export function getAllowedGameLevels(userLevel) {
    const lvl = (userLevel || 'C').toUpperCase();
    const idx = LEVEL_ORDER.indexOf(lvl);
    if (idx === -1) return ['C'];
    if (idx === LEVEL_ORDER.length - 1) {
        return [lvl]; // 'A' só pode disputar 'A'
    }
    return [lvl, LEVEL_ORDER[idx + 1]];
}

/**
 * Verifica se um jogador com 'playerLevel' pode participar de uma partida de nível 'gameLevel'.
 */
export function isLevelEligible(playerLevel, gameLevel) {
    if (!playerLevel || !gameLevel) return true;
    const allowed = getAllowedGameLevels(playerLevel);
    return allowed.includes(gameLevel.toUpperCase());
}

/**
 * Retorna o ano da temporada corrente.
 * Regulamento Montreal: a temporada ocorre de Janeiro até 30 de Novembro.
 * Em Dezembro o ranking fica em recesso oficial (sem partidas do ranking).
 */
export function getCurrentSeasonYear(date = new Date()) {
    const d = (date instanceof Date) ? date : new Date(date);
    return d.getFullYear();
}

/**
 * Retorna true se a temporada do ranking está ativa (Janeiro a Novembro).
 * Em Dezembro o ranking fica em recesso oficial.
 */
export function isRankingSeasonActive(date = new Date()) {
    const d = (date instanceof Date) ? date : new Date(date);
    return d.getMonth() !== 11; // 11 = Dezembro (0-indexed)
}

