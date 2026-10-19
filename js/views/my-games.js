/* ====================================================================
   MONTREAL TÊNIS CLUBE - CENTRAL DE JOGOS & HISTÓRICO COM PLACAR
   ==================================================================== */

import { state } from '../state.js';
import { db } from '../supabase.js';
import { formatDateBR, formatTimeHM, getGameStatusLabel, isLevelEligible } from '../utils.js?v=1.4.8';

let activeTab = 'upcoming'; // 'upcoming', 'open', 'history'

export async function renderMyGames(params = {}) {
    const container = document.getElementById('view-content');
    const user = state.getUser();

    if (!user) return;

    if (params && params.tab) {
        activeTab = params.tab;
    } else if (window.location.hash.includes('/abertos')) {
        activeTab = 'open';
    }

    container.innerHTML = `
        <div class="view-container active">
            <h2 style="font-size: var(--font-size-xl); font-weight: 800; margin-bottom: var(--space-md); color: var(--color-preto);">Central de Jogos</h2>

            <!-- Tabs Principais -->
            <div class="ranking-tabs">
                <button class="tab-btn ${activeTab === 'upcoming' ? 'active' : ''}" id="tab-upcoming-games">Próximos</button>
                <button class="tab-btn ${activeTab === 'open' ? 'active' : ''}" id="tab-open-games">Jogos Abertos</button>
                <button class="tab-btn ${activeTab === 'history' ? 'active' : ''}" id="tab-history-games">Histórico</button>
            </div>

            <div id="games-list-container">
                <p style="text-align: center; color: var(--color-grey-text); padding: var(--space-lg);">Carregando partidas...</p>
            </div>
        </div>
    `;

    document.getElementById('tab-upcoming-games')?.addEventListener('click', () => {
        activeTab = 'upcoming';
        renderMyGames();
    });

    document.getElementById('tab-open-games')?.addEventListener('click', () => {
        activeTab = 'open';
        renderMyGames();
    });

    document.getElementById('tab-history-games')?.addEventListener('click', () => {
        activeTab = 'history';
        renderMyGames();
    });

    await loadGamesList(user);
}

async function loadGamesList(user) {
    const listContainer = document.getElementById('games-list-container');
    if (!listContainer) return;

    try {
        let games = [];

        if (activeTab === 'upcoming') {
            const { data: myParts } = await db.from('mt_game_participants').select('game_id').eq('customer_code', user.customer_code);
            const gameIds = myParts?.map(p => p.game_id) || [];
            if (gameIds.length > 0) {
                const { data } = await db.from('mt_games')
                    .select('*')
                    .in('id', gameIds)
                    .in('status', ['draft', 'open', 'awaiting_confirmation', 'confirmed', 'in_progress'])
                    .order('game_date', { ascending: true });
                games = data || [];
            }
        } else if (activeTab === 'open') {
            const { data } = await db.from('mt_games')
                .select('*')
                .eq('status', 'open')
                .order('game_date', { ascending: true });
            games = data || [];
        } else if (activeTab === 'history') {
            const { data: myParts } = await db.from('mt_game_participants').select('game_id').eq('customer_code', user.customer_code);
            const gameIds = myParts?.map(p => p.game_id) || [];
            if (gameIds.length > 0) {
                const { data } = await db.from('mt_games')
                    .select('*')
                    .in('id', gameIds)
                    .in('status', ['completed', 'result_pending_validation', 'cancelled', 'disputed'])
                    .order('game_date', { ascending: false });
                games = data || [];
            }
        }

        if (games.length === 0) {
            let emptyMsg = "Nenhum jogo encontrado nesta categoria.";
            if (activeTab === 'upcoming') emptyMsg = "Você não possui partidas agendadas.";
            if (activeTab === 'open') emptyMsg = "Nenhum jogo aberto disponível no momento.";
            if (activeTab === 'history') emptyMsg = "Seu histórico de jogos ainda está vazio.";

            listContainer.innerHTML = `
                <div class="card" style="text-align: center; padding: var(--space-xl);">
                    <p style="color: var(--color-grey-text); font-size: var(--font-size-sm);">${emptyMsg}</p>
                    <button class="btn btn-primary btn-sm" style="margin-top: var(--space-md); width: auto;" onclick="window.location.hash='#/jogos/criar'">
                        ➕ Criar um Jogo Agora
                    </button>
                </div>
            `;
            return;
        }

        // Busca placares existentes das partidas listadas
        const gameIds = games.map(g => g.id);
        const { data: results } = await db.from('mt_game_results').select('*').in('game_id', gameIds);
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

        // Busca perfis dos criadores para os jogos abertos
        const creatorCodes = [...new Set(games.map(g => g.creator_customer_code).filter(Boolean))];
        let creatorMap = {};
        if (creatorCodes.length > 0) {
            const { data: profiles } = await db.from('mt_game_profiles').select('customer_code, display_name').in('customer_code', creatorCodes);
            if (profiles) profiles.forEach(p => { creatorMap[p.customer_code] = p.display_name; });
            const missing = creatorCodes.filter(c => !creatorMap[c]);
            if (missing.length > 0) {
                const { data: clientes } = await db.from('mt_clientes').select('customer_code, name').in('customer_code', missing);
                if (clientes) clientes.forEach(c => { creatorMap[c.customer_code] = c.name; });
            }
        }

        listContainer.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: var(--space-sm);">
                ${games.map(game => {
                    const statusLabel = getGameStatusLabel(game.status);
                    const res = resultMap[game.id];
                    let scoreFormatted = '';
                    if (res && setsByResultId[res.id]) {
                        const gameSets = setsByResultId[res.id];
                        const s1 = gameSets.find(s => s.set_number === 1);
                        const s2 = gameSets.find(s => s.set_number === 2);
                        const s3 = gameSets.find(s => s.set_number === 3);

                        // Formato de 1 Set até 8 (novo regulamento oficial)
                        if (s1 && (!s2 || s2.player1_games === null || s2.player1_games === undefined)) {
                            if (s1.tiebreak_player1 !== null && s1.tiebreak_player1 !== undefined) {
                                scoreFormatted = `${s1.player1_games}x${s1.player2_games} (TB: ${s1.tiebreak_player1}x${s1.tiebreak_player2})`;
                            } else {
                                scoreFormatted = `${s1.player1_games}x${s1.player2_games}`;
                            }
                        } else {
                            // Legado de múltiplos sets
                            const parts = [];
                            if (s1 && s1.player1_games !== null && s1.player1_games !== undefined) {
                                parts.push(`1º Set: ${s1.player1_games}x${s1.player2_games}`);
                            }
                            if (s2 && s2.player1_games !== null && s2.player1_games !== undefined) {
                                parts.push(`2º Set: ${s2.player1_games}x${s2.player2_games}`);
                            }
                            if (s3 && s3.tiebreak_player1 !== null && s3.tiebreak_player1 !== undefined) {
                                parts.push(`STB: ${s3.tiebreak_player1}x${s3.tiebreak_player2}`);
                            }
                            scoreFormatted = parts.join(' | ');
                        }
                    }

                    const isCreator = String(game.creator_customer_code).trim() === String(user.customer_code).trim();
                    const creatorName = isCreator ? "Você" : (creatorMap[game.creator_customer_code] || "Tenista");

                    return `
                        <div class="card" style="margin-bottom: var(--space-sm); cursor: pointer;" onclick="window.location.hash='#/jogos/${game.id}'">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                                <div>
                                    <span class="badge badge-level-${game.accepted_level}">Nível ${game.accepted_level}</span>
                                    <span class="badge" style="background: rgba(0,0,0,0.06); color: var(--color-preto); font-weight: 700; margin-left: 4px;">🎾 ${game.gender_category || 'Masculino'}</span>
                                    <span class="badge ${game.status === 'completed' || game.status === 'confirmed' ? 'badge-success' : 'badge-warning'}" style="margin-left: 4px;">
                                        ${statusLabel}
                                    </span>
                                    ${activeTab === 'open' ? `
                                        <span class="badge" style="margin-left: 4px; font-size: 10px; ${isLevelEligible(user.current_level, game.accepted_level) ? 'background: rgba(40, 167, 69, 0.1); color: #2e7d32; border: 1px solid rgba(40, 167, 69, 0.3); font-weight: 800;' : 'background: rgba(0,0,0,0.05); color: var(--color-grey-text);'}">
                                            ${isLevelEligible(user.current_level, game.accepted_level) ? '✅ Apto p/ Jogar' : '🔒 Nível Incompatível'}
                                        </span>
                                    ` : ''}
                                </div>
                                <span style="font-size: var(--font-size-xs); color: var(--color-grey-text); font-weight: 700;">
                                    ${formatDateBR(game.game_date)}
                                </span>
                            </div>

                            <div style="margin-top: var(--space-sm); font-weight: 800; font-size: var(--font-size-base); color: var(--color-preto);">
                                ${game.sport} (${game.game_type}) às ${formatTimeHM(game.start_time)}
                            </div>

                            ${scoreFormatted ? `
                                <div style="font-size: var(--font-size-xs); font-weight: 800; color: var(--color-saibro); background: rgba(192, 81, 49, 0.08); padding: 6px 10px; border-radius: var(--radius-sm); margin-top: 6px;">
                                    🏆 Placar: ${scoreFormatted}
                                </div>
                            ` : ''}

                            <div style="font-size: var(--font-size-xs); color: var(--color-grey-text); margin-top: 4px;">
                                📍 ${game.location_id === 1 ? 'Montreal Tênis Clube' : 'Outro Local'} 
                                • Quadra: ${game.court_reservation_status === 'reserva_declarada' ? '✅ Informada' : '⚠️ Pendente'}
                            </div>

                            ${activeTab === 'open' ? `
                                <div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed var(--color-grey-border); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
                                    <span style="font-size: 12px; color: var(--color-grey-text);">
                                        Desafio de: <strong style="color: var(--color-preto);">${creatorName}</strong>
                                    </span>
                                    ${isCreator ? `
                                        <span style="font-size: 11px; font-weight: 700; color: #0056b3; background: rgba(0,123,255,0.08); border: 1px solid rgba(0,123,255,0.2); padding: 4px 10px; border-radius: 12px;">
                                            👤 Seu Desafio (Aguardando)
                                        </span>
                                    ` : (isLevelEligible(user.current_level, game.accepted_level) ? `
                                        <span class="badge badge-success" style="font-size: 11px; font-weight: 800; padding: 6px 12px; border-radius: 12px; box-shadow: 0 2px 6px rgba(40,167,69,0.25);">
                                            🎾 Entrar na Partida →
                                        </span>
                                    ` : `
                                        <span style="font-size: 10px; color: var(--color-grey-text); background: rgba(0,0,0,0.05); padding: 4px 8px; border-radius: 12px;">
                                            🔒 Incompatível
                                        </span>
                                    `)}
                                </div>
                            ` : ''}
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
