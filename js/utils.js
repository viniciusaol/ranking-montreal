/* ====================================================================
   MONTREAL TÊNIS CLUBE - UTILITÁRIOS, MÁSCARAS E RÓTULOS (PORTUGUÊS)
   ==================================================================== */

export function formatDateBR(dateStr) {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
}

/**
 * Retorna a data no formato ISO YYYY-MM-DD respeitando o fuso horário local (Brasil/Curitiba).
 * Evita o bug de fuso horário do .toISOString() que pula para o dia seguinte a partir das 21:00 (UTC-3).
 */
export function getLocalDateISO(d = new Date()) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function formatTimeHM(timeStr) {
    if (!timeStr) return '';
    return timeStr.substring(0, 5);
}

export function formatPhone(phoneStr) {
    if (!phoneStr) return '';
    let clean = phoneStr.replace(/\D/g, '');
    if (clean.startsWith('55') && clean.length > 11) {
        clean = clean.substring(2);
    }
    if (clean.length === 11) {
        return `(${clean.substring(0,2)}) ${clean.substring(2,7)}-${clean.substring(7)}`;
    }
    if (clean.length === 10) {
        return `(${clean.substring(0,2)}) ${clean.substring(2,6)}-${clean.substring(6)}`;
    }
    return phoneStr;
}

export function getWhatsAppUrl(phoneStr, message = '') {
    if (!phoneStr) return '';
    let clean = phoneStr.replace(/\D/g, '');
    if (!clean.startsWith('55') && (clean.length === 10 || clean.length === 11)) {
        clean = '55' + clean;
    }
    return `https://wa.me/${clean}${message ? '?text=' + encodeURIComponent(message) : ''}`;
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

/**
 * Retorna true se a retrospectiva de determinado ano já está disponível.
 * Regulamento Montreal: A retrospectiva de cada ano só fica liberada a partir de 01/12
 * (logo após o fechamento do ranking em 30/11).
 * Anos anteriores já estão consolidados e sempre disponíveis.
 */
export function isRetrospectiveAvailable(year, date = new Date()) {
    const d = (date instanceof Date) ? date : new Date(date);
    const currYear = d.getFullYear();
    const currMonth = d.getMonth(); // 0-indexed: 0 = Jan, 10 = Nov, 11 = Dez

    if (year < currYear) return true;  // Anos anteriores já fecharam
    if (year > currYear) return false; // Anos futuros ainda não aconteceram
    
    // Ano atual: somente disponível a partir de 01/12 (mês 11 em diante)
    return currMonth === 11;
}

/**
 * Retorna o ano da última retrospectiva oficialmente disponível/liberada.
 * Se já estamos em Dezembro, retorna o ano atual.
 * Se estamos entre Janeiro e Novembro, a retrospectiva liberada é a do ano anterior.
 */
export function getLatestAvailableRetrospectiveYear(date = new Date()) {
    const d = (date instanceof Date) ? date : new Date(date);
    const currYear = d.getFullYear();
    const currMonth = d.getMonth();
    return (currMonth === 11) ? currYear : (currYear - 1);
}

