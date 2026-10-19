/* ====================================================================
   MONTREAL TÊNIS CLUBE - CENTRAL DE JOGOS & MEUS JOGOS EXCLUSIVOS
   ==================================================================== */

import { state } from '../state.js';
import { db } from '../supabase.js';
import { formatDateBR, formatTimeHM, getGameStatusLabel, isLevelEligible } from '../utils.js?v=1.5.7';

let activeMainTab = 'my_games'; // 'my_games', 'open', 'all'
let myGamesFilter = 'all';      // 'all', 'upcoming', 'history'

const isSameUser = (code1, code2) => {
    if (!code1 || !code2) return false;
    return String(code1).trim() === String(code2).trim() || parseInt(code1, 10) === parseInt(code2, 10);
};

export async function renderMyGames(params = {}) {
    const container = document.getElementById('view-content');
    const user = state.getUser();

    if (!user) return;

    if (params && params.tab) {
        if (params.tab === 'open') activeMainTab = 'open';
        else if (params.tab === 'all') activeMainTab = 'all';
        else if (params.tab === 'my_games') activeMainTab = 'my_games';
    } else if (window.location.hash.includes('/abertos')) {
        activeMainTab = 'open';
    } else if (window.location.hash.includes('/todos')) {
        activeMainTab = 'all';
    }

    container.innerHTML = `
        <div class="view-container active">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-md);">
                <div>
                    <h2 style="font-size: var(--font-size-xl); font-weight: 800; color: var(--color-preto); margin: 0;">Central de Jogos</h2>
                    <p style="font-size: var(--font-size-xs); color: var(--color-grey-text); margin: 2px 0 0 0;">Partidas, desafios abertos e resultados</p>
                </div>
                <button class="btn btn-primary btn-sm" id="btn-top-create-game" style="width: auto; padding: 6px 12px; font-size: 12px; font-weight: 800;">
                    ➕ Novo Jogo
                </button>
            </div>

            <!-- Tabs Principais -->
            <div class="ranking-tabs" style="margin-bottom: var(--space-sm);">
                <button class="tab-btn ${activeMainTab === 'my_games' ? 'active' : ''}" id="tab-my-games">
                    👤 Meus Jogos
                </button>
                <button class="tab-btn ${activeMainTab === 'open' ? 'active' : ''}" id="tab-open-games">
                    📢 Desafios Abertos
                </button>
                <button class="tab-btn ${activeMainTab === 'all' ? 'active' : ''}" id="tab-all-games">
                    🌐 Todos do Clube
                </button>
            </div>

            <!-- Área de Sub-filtros para "Meus Jogos" -->
            <div id="my-games-subfilter-container" style="${activeMainTab === 'my_games' ? 'display: block;' : 'display: none;'} margin-bottom: var(--space-sm);">
                <div style="display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px;">
                    <button class="btn-subfilter ${myGamesFilter === 'all' ? 'active' : ''}" data-filter="all" style="
                        flex: 0 0 auto;
                        padding: 6px 14px;
                        border-radius: var(--radius-full);
                        font-size: 12px;
                        font-weight: 700;
                        border: 1px solid ${myGamesFilter === 'all' ? 'var(--color-saibro)' : 'var(--color-grey-border)'};
                        background-color: ${myGamesFilter === 'all' ? 'var(--color-saibro)' : '#ffffff'};
                        color: ${myGamesFilter === 'all' ? '#ffffff' : 'var(--color-preto)'};
                        cursor: pointer;
                        transition: var(--transition-fast);
                    ">
                        🎾 Todos <span id="count-badge-all"></span>
                    </button>
                    <button class="btn-subfilter ${myGamesFilter === 'upcoming' ? 'active' : ''}" data-filter="upcoming" style="
                        flex: 0 0 auto;
                        padding: 6px 14px;
                        border-radius: var(--radius-full);
                        font-size: 12px;
                        font-weight: 700;
                        border: 1px solid ${myGamesFilter === 'upcoming' ? 'var(--color-saibro)' : 'var(--color-grey-border)'};
                        background-color: ${myGamesFilter === 'upcoming' ? 'var(--color-saibro)' : '#ffffff'};
                        color: ${myGamesFilter === 'upcoming' ? '#ffffff' : 'var(--color-preto)'};
                        cursor: pointer;
                        transition: var(--transition-fast);
                    ">
                        ⏳ Agendados <span id="count-badge-upcoming"></span>
                    </button>
                    <button class="btn-subfilter ${myGamesFilter === 'history' ? 'active' : ''}" data-filter="history" style="
                        flex: 0 0 auto;
                        padding: 6px 14px;
                        border-radius: var(--radius-full);
                        font-size: 12px;
                        font-weight: 700;
                        border: 1px solid ${myGamesFilter === 'history' ? 'var(--color-saibro)' : 'var(--color-grey-border)'};
                        background-color: ${myGamesFilter === 'history' ? 'var(--color-saibro)' : '#ffffff'};
                        color: ${myGamesFilter === 'history' ? '#ffffff' : 'var(--color-preto)'};
                        cursor: pointer;
                        transition: var(--transition-fast);
                    ">
                        🏆 Concluídos <span id="count-badge-history"></span>
                    </button>
                </div>
            </div>

            <div id="games-list-container">
                <p style="text-align: center; color: var(--color-grey-text); padding: var(--space-lg);">Carregando partidas...</p>
            </div>
        </div>
    `;

    document.getElementById('btn-top-create-game')?.addEventListener('click', () => {
        window.location.hash = '#/jogos/criar';
    });

    document.getElementById('tab-my-games')?.addEventListener('click', () => {
        activeMainTab = 'my_games';
        renderMyGames();
    });

    document.getElementById('tab-open-games')?.addEventListener('click', () => {
        activeMainTab = 'open';
        renderMyGames();
    });

    document.getElementById('tab-all-games')?.addEventListener('click', () => {
        activeMainTab = 'all';
        renderMyGames();
    });

    document.querySelectorAll('.btn-subfilter').forEach(btn => {
        btn.addEventListener('click', () => {
            myGamesFilter = btn.getAttribute('data-filter') || 'all';
            document.querySelectorAll('.btn-subfilter').forEach(b => {
                const isActive = b.getAttribute('data-filter') === myGamesFilter;
                b.style.backgroundColor = isActive ? 'var(--color-saibro)' : '#ffffff';
                b.style.color = isActive ? '#ffffff' : 'var(--color-preto)';
                b.style.borderColor = isActive ? 'var(--color-saibro)' : 'var(--color-grey-border)';
            });
            loadGamesList(user);
        });
    });

    await loadGamesList(user);
}

async function loadGamesList(user) {
    const listContainer = document.getElementById('games-list-container');
    if (!listContainer) return;

    try {
        let gamesToDisplay = [];
        let allUserGames = [];

        // -------------------------------------------------------------
        // CASO 1: ABA "MEUS JOGOS" (Apenas os jogos da pessoa logada)
        // -------------------------------------------------------------
        if (activeMainTab === 'my_games') {
            // Códigos do usuário (com ou sem zeros à esquerda)
            const userCodes = [String(user.customer_code).trim()];
            const parsedNum = parseInt(user.customer_code, 10);
            if (!isNaN(parsedNum) && !userCodes.includes(String(parsedNum))) {
                userCodes.push(String(parsedNum));
            }

            // Busca IDs de jogos onde o usuário é participante
            const { data: myParts } = await db.from('mt_game_participants')
                .select('game_id')
                .in('customer_code', userCodes);
            const partGameIds = myParts?.map(p => p.game_id) || [];

            // Busca IDs de jogos criados pelo usuário
            const { data: createdGames } = await db.from('mt_games')
                .select('id')
                .in('creator_customer_code', userCodes);
            const createdGameIds = createdGames?.map(g => g.id) || [];

            const allMyGameIds = [...new Set([...partGameIds, ...createdGameIds])];

            if (allMyGameIds.length > 0) {
                const { data: allGames } = await db.from('mt_games')
                    .select('*')
                    .in('id', allMyGameIds)
                    .order('game_date', { ascending: false });
                allUserGames = allGames || [];
            }

            const activeStatuses = ['draft', 'open', 'awaiting_confirmation', 'confirmed', 'in_progress'];
            const completedStatuses = ['completed', 'result_pending_validation', 'cancelled', 'disputed'];

            const upcomingGames = allUserGames.filter(g => activeStatuses.includes(g.status))
                .sort((a, b) => (a.game_date + ' ' + (a.start_time || '')).localeCompare(b.game_date + ' ' + (b.start_time || '')));
            
            const historyGames = allUserGames.filter(g => completedStatuses.includes(g.status))
                .sort((a, b) => (b.game_date + ' ' + (b.start_time || '')).localeCompare(a.game_date + ' ' + (a.start_time || '')));

            // Atualiza contadores nas pílulas
            const badgeAll = document.getElementById('count-badge-all');
            const badgeUpcoming = document.getElementById('count-badge-upcoming');
            const badgeHistory = document.getElementById('count-badge-history');
            if (badgeAll) badgeAll.textContent = `(${allUserGames.length})`;
            if (badgeUpcoming) badgeUpcoming.textContent = `(${upcomingGames.length})`;
            if (badgeHistory) badgeHistory.textContent = `(${historyGames.length})`;

            if (myGamesFilter === 'upcoming') {
                gamesToDisplay = upcomingGames;
            } else if (myGamesFilter === 'history') {
                gamesToDisplay = historyGames;
            } else {
                // Em "Todos", prioriza ativos primeiro, depois histórico mais recente
                gamesToDisplay = [...upcomingGames, ...historyGames];
            }
        } 
        // -------------------------------------------------------------
        // CASO 2: ABA "DESAFIOS ABERTOS" (Jogos do clube aguardando adversário)
        // -------------------------------------------------------------
        else if (activeMainTab === 'open') {
            const { data } = await db.from('mt_games')
                .select('*')
                .eq('status', 'open')
                .order('game_date', { ascending: true });
            gamesToDisplay = data || [];
        } 
        // -------------------------------------------------------------
        // CASO 3: ABA "TODOS DO CLUBE" (Todas as partidas gerais)
        // -------------------------------------------------------------
        else if (activeMainTab === 'all') {
            const { data } = await db.from('mt_games')
                .select('*')
                .order('game_date', { ascending: false })
                .limit(40);
            gamesToDisplay = data || [];
        }

        // Caso vazio
        if (gamesToDisplay.length === 0) {
            let emptyMsg = "Nenhuma partida encontrada.";
            let btnAction = `
                <button class="btn btn-primary btn-sm" style="margin-top: var(--space-md); width: auto;" onclick="window.location.hash='#/jogos/criar'">
                    ➕ Criar um Jogo Agora
                </button>
            `;

            if (activeMainTab === 'my_games') {
                if (myGamesFilter === 'upcoming') {
                    emptyMsg = "Você não possui partidas agendadas no momento.";
                } else if (myGamesFilter === 'history') {
                    emptyMsg = "Seu histórico ainda não possui partidas concluídas.";
                } else {
                    emptyMsg = "Você ainda não participou nem criou nenhuma partida no ranking.";
                }
            } else if (activeMainTab === 'open') {
                emptyMsg = "Nenhum desafio aberto aguardando adversário no momento.";
            }

            listContainer.innerHTML = `
                <div class="card" style="text-align: center; padding: var(--space-xl);">
                    <div style="font-size: 38px; margin-bottom: 8px;">🎾</div>
                    <p style="color: var(--color-grey-text); font-size: var(--font-size-sm);">${emptyMsg}</p>
                    ${btnAction}
                </div>
            `;
            return;
        }

        // -------------------------------------------------------------
        // BUSCA PARTICIPANTES, NOMES E PLACARES DE TODAS AS PARTIDAS
        // -------------------------------------------------------------
        const gameIds = gamesToDisplay.map(g => g.id);

        // 1. Participantes
        const { data: allParticipants } = await db.from('mt_game_participants')
            .select('*')
            .in('game_id', gameIds);

        // 2. Perfis e Clientes
        const participantCodes = (allParticipants || []).map(p => p.customer_code);
        const creatorCodes = gamesToDisplay.map(g => g.creator_customer_code);
        const codesToFetch = [...new Set([...participantCodes, ...creatorCodes].filter(Boolean))];

        let playerMap = {};
        if (codesToFetch.length > 0) {
            const { data: profiles } = await db.from('mt_game_profiles')
                .select('customer_code, display_name, current_level, avatar_url')
                .in('customer_code', codesToFetch);
            if (profiles) {
                profiles.forEach(p => { playerMap[p.customer_code] = p; });
            }
            const missing = codesToFetch.filter(c => !playerMap[c]);
            if (missing.length > 0) {
                const { data: clientes } = await db.from('mt_clientes')
                    .select('customer_code, name')
                    .in('customer_code', missing);
                if (clientes) {
                    clientes.forEach(c => {
                        playerMap[c.customer_code] = { customer_code: c.customer_code, display_name: c.name };
                    });
                }
            }
        }

        // 3. Placares
        const { data: results } = await db.from('mt_game_results')
            .select('*')
            .in('game_id', gameIds);

        const resultMap = {};
        const setsByResultId = {};

        if (results && results.length > 0) {
            results.forEach(r => { resultMap[r.game_id] = r; });
            const resultIds = results.map(r => r.id);
            const { data: sets } = await db.from('mt_game_result_sets')
                .select('*')
                .in('result_id', resultIds)
                .order('set_number', { ascending: true });

            if (sets) {
                sets.forEach(s => {
                    if (!setsByResultId[s.result_id]) setsByResultId[s.result_id] = [];
                    setsByResultId[s.result_id].push(s);
                });
            }
        }

        // -------------------------------------------------------------
        // RENDERIZAÇÃO DOS CARDS
        // -------------------------------------------------------------
        listContainer.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: var(--space-sm);">
                ${gamesToDisplay.map(game => {
                    const statusLabel = getGameStatusLabel(game.status);
                    const isCompleted = game.status === 'completed';
                    const isPendingResult = game.status === 'result_pending_validation';
                    const isConfirmed = game.status === 'confirmed';
                    const isOpen = game.status === 'open';

                    const res = resultMap[game.id];
                    let scoreFormatted = '';
                    if (res && setsByResultId[res.id]) {
                        const gameSets = setsByResultId[res.id];
                        const s1 = gameSets.find(s => s.set_number === 1);
                        const s2 = gameSets.find(s => s.set_number === 2);
                        const s3 = gameSets.find(s => s.set_number === 3);

                        // Formato Oficial Montreal (1 Set até 8 games)
                        if (s1 && (!s2 || s2.player1_games === null || s2.player1_games === undefined)) {
                            if (s1.tiebreak_player1 !== null && s1.tiebreak_player1 !== undefined) {
                                scoreFormatted = `${s1.player1_games}x${s1.player2_games} (TB: ${s1.tiebreak_player1}x${s1.tiebreak_player2})`;
                            } else {
                                scoreFormatted = `${s1.player1_games}x${s1.player2_games}`;
                            }
                        } else {
                            // Legado múltiplos sets
                            const parts = [];
                            if (s1 && s1.player1_games !== null) parts.push(`1º Set: ${s1.player1_games}x${s1.player2_games}`);
                            if (s2 && s2.player1_games !== null) parts.push(`2º Set: ${s2.player1_games}x${s2.player2_games}`);
                            if (s3 && s3.tiebreak_player1 !== null) parts.push(`STB: ${s3.tiebreak_player1}x${s3.tiebreak_player2}`);
                            scoreFormatted = parts.join(' | ');
                        }
                    }

                    // Identificação dos jogadores e adversário
                    const gameParts = (allParticipants || []).filter(p => p.game_id === game.id);
                    const myPart = gameParts.find(p => isSameUser(p.customer_code, user.customer_code));
                    const isUserInvolved = !!myPart || isSameUser(game.creator_customer_code, user.customer_code);

                    const oppPart = gameParts.find(p => !isSameUser(p.customer_code, user.customer_code));
                    let oppName = null;
                    let oppLevel = null;

                    if (oppPart) {
                        const oppProf = playerMap[oppPart.customer_code];
                        oppName = oppProf?.display_name || "Adversário";
                        oppLevel = oppProf?.current_level;
                    } else if (!isSameUser(game.creator_customer_code, user.customer_code)) {
                        const creatorProf = playerMap[game.creator_customer_code];
                        oppName = creatorProf?.display_name || "Tenista Montreal";
                        oppLevel = creatorProf?.current_level;
                    }

                    const isCreator = isSameUser(game.creator_customer_code, user.customer_code);
                    const creatorName = isCreator ? "Você" : (playerMap[game.creator_customer_code]?.display_name || "Tenista Montreal");

                    // Resultado da pessoa logada
                    const isWinner = res && isSameUser(res.winner_customer_code, user.customer_code);
                    const isLoser = res && res.winner_customer_code && !isWinner && isUserInvolved;

                    // Cor da borda do card
                    let borderLeftColor = 'var(--color-grey-border)';
                    if (isCompleted) {
                        borderLeftColor = isWinner ? '#16a34a' : 'var(--color-saibro)';
                    } else if (isConfirmed) {
                        borderLeftColor = 'var(--color-booking-blue)';
                    } else if (isOpen) {
                        borderLeftColor = 'var(--color-warning)';
                    }

                    return `
                        <div class="card" style="margin-bottom: var(--space-sm); cursor: pointer; border-left: 5px solid ${borderLeftColor}; transition: transform 0.15s ease;" onclick="window.location.hash='#/jogos/${game.id}'">
                            <!-- Cabeçalho do Card: Nível, Gênero, Status e Data -->
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                                <div style="display: flex; align-items: center; gap: 5px; flex-wrap: wrap;">
                                    <span class="badge badge-level-${game.accepted_level}">Nível ${game.accepted_level}</span>
                                    <span class="badge" style="background: rgba(0,0,0,0.06); color: var(--color-preto); font-weight: 700;">🎾 ${game.gender_category || 'Masculino'}</span>
                                    <span class="badge ${isCompleted || isConfirmed ? 'badge-success' : 'badge-warning'}">
                                        ${statusLabel}
                                    </span>
                                    ${activeMainTab === 'open' ? `
                                        <span class="badge" style="font-size: 10px; ${isLevelEligible(user.current_level, game.accepted_level) ? 'background: rgba(40, 167, 69, 0.1); color: #2e7d32; border: 1px solid rgba(40, 167, 69, 0.3); font-weight: 800;' : 'background: rgba(0,0,0,0.05); color: var(--color-grey-text);'}">
                                            ${isLevelEligible(user.current_level, game.accepted_level) ? '✅ Apto p/ Jogar' : '🔒 Nível Incompatível'}
                                        </span>
                                    ` : ''}
                                </div>
                                <span style="font-size: var(--font-size-xs); color: var(--color-grey-text); font-weight: 700; white-space: nowrap;">
                                    📅 ${formatDateBR(game.game_date)}
                                </span>
                            </div>

                            <!-- Seção de Confronto (VS) em Destaque -->
                            <div style="margin: 10px 0 8px 0; display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.025); padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid rgba(0,0,0,0.05);">
                                <div style="display: flex; align-items: center; gap: 6px;">
                                    <div style="width: 26px; height: 26px; border-radius: 50%; background: var(--color-creme); color: var(--color-saibro); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 11px; border: 1px solid var(--color-grey-border);">
                                        👤
                                    </div>
                                    <span style="font-size: 13px; font-weight: 800; color: var(--color-preto);">
                                        ${isUserInvolved ? 'Você' : creatorName}
                                    </span>
                                </div>

                                <div style="font-size: 11px; font-weight: 900; color: var(--color-grey-text); padding: 2px 7px; border-radius: 8px; background: rgba(0,0,0,0.06);">
                                    VS
                                </div>

                                <div style="display: flex; align-items: center; gap: 6px; text-align: right;">
                                    ${oppName ? `
                                        <div>
                                            <span style="font-size: 13px; font-weight: 800; color: var(--color-preto); display: block;">${oppName}</span>
                                            ${oppLevel ? `<span style="font-size: 10px; color: var(--color-grey-text); font-weight: 600;">Nível ${oppLevel}</span>` : ''}
                                        </div>
                                        <div style="width: 26px; height: 26px; border-radius: 50%; background: #e0f2fe; color: #0284c7; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 11px; border: 1px solid rgba(2,132,199,0.2);">
                                            🎾
                                        </div>
                                    ` : (isOpen ? `
                                        <span style="font-size: 11px; color: var(--color-saibro); font-style: italic; font-weight: 700;">
                                            ⏳ Aguardando Adversário...
                                        </span>
                                    ` : `
                                        <span style="font-size: 11px; color: var(--color-grey-text); font-style: italic;">
                                            A Definir
                                        </span>
                                    `)}
                                </div>
                            </div>

                            <!-- Placar e Faixa de Resultado (para jogos finalizados) -->
                            ${scoreFormatted ? `
                                <div style="display: flex; justify-content: space-between; align-items: center; background: ${isWinner ? 'rgba(34,197,94,0.08)' : (isLoser ? 'rgba(192,81,49,0.08)' : 'rgba(0,0,0,0.04)')}; padding: 7px 12px; border-radius: var(--radius-sm); margin-bottom: 6px; border: 1px solid ${isWinner ? 'rgba(34,197,94,0.2)' : 'rgba(192,81,49,0.2)'};">
                                    <span style="font-size: 11px; font-weight: 800; color: ${isWinner ? '#15803d' : (isLoser ? 'var(--color-saibro)' : 'var(--color-preto)')};">
                                        ${isWinner ? '🏆 Sua Vitória (+30 pts)' : (isLoser ? '🎾 Participação (+10 pts)' : '🏁 Partida Concluída')}
                                    </span>
                                    <span style="font-size: 12px; font-weight: 800; color: var(--color-preto); letter-spacing: 0.5px;">
                                        Placar: ${scoreFormatted}
                                    </span>
                                </div>
                            ` : ''}

                            <!-- Rodapé do Card: Horário, Local e Botão de Ação -->
                            <div style="display: flex; justify-content: space-between; align-items: center; font-size: var(--font-size-xs); color: var(--color-grey-text); margin-top: 4px; padding-top: 4px; border-top: 1px dashed rgba(0,0,0,0.06);">
                                <span>
                                    ⏰ ${formatTimeHM(game.start_time)} • 📍 ${game.location_id === 1 ? 'Montreal' : 'Outro Local'} 
                                    • Quadra: ${game.court_reservation_status === 'reserva_declarada' ? '✅ Informada' : '⚠️ Pendente'}
                                </span>
                                
                                ${activeMainTab === 'open' && !isUserInvolved ? `
                                    <span class="badge badge-success" style="font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 12px; box-shadow: 0 2px 6px rgba(40,167,69,0.25);">
                                        🎾 Entrar na Partida →
                                    </span>
                                ` : `
                                    <span style="font-weight: 700; color: var(--color-saibro); font-size: 11px;">
                                        Ver Detalhes →
                                    </span>
                                `}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    } catch (e) {
        console.error("Erro ao carregar jogos:", e);
        listContainer.innerHTML = `<p style="color: var(--color-danger); text-align: center;">Erro ao carregar partidas.</p>`;
    }
}
