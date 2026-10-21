/* ====================================================================
   MONTREAL TÊNIS CLUBE - DETALHES E REGISTRO DE PLACAR (RPC CONECTADO)
   ==================================================================== */

import { state } from '../state.js';
import { db, callRPC } from '../supabase.js';
import { formatDateBR, formatTimeHM, openMontrealBooking, getGameStatusLabel, getCourtReservationStatusLabel, isLevelEligible, getAllowedGameLevels } from '../utils.js?v=1.4.8';
import { notifyOpenGameJoined } from '../notifications.js';

const isSameUser = (code1, code2) => {
    if (!code1 || !code2) return false;
    return String(code1).trim() === String(code2).trim() || parseInt(code1, 10) === parseInt(code2, 10);
};

export async function renderGameDetail(params) {
    const container = document.getElementById('view-content');
    const user = state.getUser();
    const gameId = params.gameId;
    let selectedScoreOpponent = null;

    if (!user || !gameId) {
        container.innerHTML = `<p style="color: var(--color-danger); text-align: center;">Jogo não localizado.</p>`;
        return;
    }

    try {
        const { data: game, error } = await db.from('mt_games').select('*').eq('id', gameId).single();
        if (error || !game) throw error || new Error("Jogo não encontrado.");

        let rankingConfig = { points_winner: 30, points_loser: 10 };
        try {
            const fetched = await callRPC('fn_mt_ranking_obter_config');
            if (fetched) rankingConfig = fetched;
        } catch (e) {
            console.warn('Erro ao obter config em game-detail:', e);
        }

        const { data: participants } = await db.from('mt_game_participants').select('*').eq('game_id', gameId);
        
        // Busca os nomes e perfis dos participantes e do criador
        const participantCodes = (participants || []).map(p => p.customer_code);
        const codesToFetch = [...new Set([...participantCodes, game.creator_customer_code].filter(Boolean))];
        let playerNames = {};
        if (codesToFetch.length > 0) {
            const { data: profiles } = await db.from('mt_game_profiles')
                .select('customer_code, display_name')
                .in('customer_code', codesToFetch);
            if (profiles) {
                profiles.forEach(p => { playerNames[p.customer_code] = p.display_name; });
            }
            const missingCodes = codesToFetch.filter(c => !playerNames[c]);
            if (missingCodes.length > 0) {
                const { data: clientes } = await db.from('mt_clientes')
                    .select('customer_code, name')
                    .in('customer_code', missingCodes);
                if (clientes) {
                    clientes.forEach(c => { playerNames[c.customer_code] = c.name; });
                }
            }
        }

        const isCreator = isSameUser(game.creator_customer_code, user.customer_code);
        const myParticipant = participants?.find(p => isSameUser(p.customer_code, user.customer_code));
        const isJoined = !!myParticipant;

        const creatorName = isCreator ? (user.display_name || user.name || "Você") : (playerNames[game.creator_customer_code] || "Tenista da Montreal");
        const creatorFirstName = isCreator ? "Você" : creatorName.split(' ')[0];

        const opponentParticipant = participants?.find(p => !isSameUser(p.customer_code, user.customer_code));
        const opponentName = opponentParticipant ? (playerNames[opponentParticipant.customer_code] || "Adversário") : "Aguardando Adversário";
        const opponentFirstName = opponentParticipant ? opponentName.split(' ')[0] : "A Definir";
        const userFirstName = (user.display_name || user.name || "Você").split(' ')[0];

        // Busca o resultado completo cadastrado via RPC
        let latestResult = null;
        try {
            const resData = await callRPC('fn_mt_game_obter_resultado_completo', { p_game_id: gameId });
            if (resData && resData.length > 0 && resData[0].result_id) {
                latestResult = resData[0];
            }
        } catch (e) {
            console.warn("Erro ao buscar resultado:", e);
        }

        // Se o usuário é participante e ainda não há placar registrado, busca adversários recentes
        let recentOpponents = [];
        if (isJoined && !latestResult) {
            try {
                const rawRecents = await callRPC('fn_mt_game_obter_adversarios_recentes', { p_customer_code: user.customer_code }) || [];
                recentOpponents = rawRecents.filter(o => 
                    !isSameUser(o.customer_code, user.customer_code) &&
                    (!opponentParticipant || !isSameUser(o.customer_code, opponentParticipant.customer_code))
                );
            } catch (e) {
                console.warn("Erro ao buscar adversários recentes:", e);
            }
        }

        const statusLabel = getGameStatusLabel(game.status);
        const courtStatusLabel = getCourtReservationStatusLabel(game.court_reservation_status);
        const reporterIsMe = latestResult && isSameUser(latestResult.reported_by, user.customer_code);
        const reporterName = reporterIsMe ? (user.display_name || "Você") : (playerNames[latestResult?.reported_by] || opponentName || "Adversário");
        const otherName = reporterIsMe ? (opponentName || "Adversário") : (user.display_name || "Você");

        container.innerHTML = `
            <div class="view-container active">
                <button class="btn btn-secondary btn-sm" style="margin-bottom: var(--space-md); width: auto;" id="btn-back-games">
                    ← Voltar para Central de Jogos
                </button>

                <div class="card" style="border-top: 4px solid var(--color-saibro);">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; flex-wrap: wrap;">
                        <div>
                            <span class="badge badge-level-${game.accepted_level}">Nível ${game.accepted_level}</span>
                            <span class="badge" style="background: rgba(0,0,0,0.06); color: var(--color-preto); font-weight: 700; margin-left: 4px;">🎾 ${game.gender_category || 'Masculino'}</span>
                            <span class="badge ${game.status === 'confirmed' || game.status === 'completed' ? 'badge-success' : 'badge-warning'}" style="margin-left: 4px;">
                                ${statusLabel}
                            </span>
                            <h2 style="font-size: var(--font-size-xl); font-weight: 800; margin-top: var(--space-xs); color: var(--color-preto);">
                                Partida de ${game.sport} (${game.game_type})
                            </h2>
                        </div>
                    </div>

                    <div style="margin-top: var(--space-md); display: flex; flex-direction: column; gap: var(--space-xs); font-size: var(--font-size-sm); color: var(--color-preto);">
                        <div>📅 <strong>Data:</strong> ${formatDateBR(game.game_date)}</div>
                        <div>⏰ <strong>Horário:</strong> ${formatTimeHM(game.start_time)} (${game.duration_minutes} min)</div>
                        <div>📍 <strong>Local:</strong> ${game.location_id === 1 ? 'Montreal Tênis Clube' : 'Outro Local'}</div>
                    </div>

                    ${game.notes ? `
                        <div style="margin-top: var(--space-md); padding: var(--space-sm); background-color: rgba(0,0,0,0.03); border-radius: var(--radius-sm); font-size: var(--font-size-xs); color: var(--color-grey-text);">
                            📝 <strong>Obs:</strong> ${game.notes}
                        </div>
                    ` : ''}
                </div>

                <!-- Banner Oficial de Regras da Partida -->
                <div class="card" style="background: rgba(192, 81, 49, 0.04); border: 1.5px solid rgba(192, 81, 49, 0.25); padding: 12px 14px;">
                    <div style="display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 800; color: var(--color-saibro); margin-bottom: 6px;">
                        <span>📋</span> Regras Oficiais da Partida do Ranking:
                    </div>
                    <div style="font-size: 11px; color: var(--color-preto); line-height: 1.45;">
                        • <strong>1 Set até 8 games:</strong> vence o primeiro jogador a somar 8 games.<br>
                        • <strong>Sem Vantagem (No-Ad):</strong> em 40x40 (deuce), joga-se ponto decisivo (recebedor escolhe o lado).<br>
                        • <strong>Empate em 7x7:</strong> disputa-se Tiebreak convencional até 7 pontos (diferença de 2). Quem vencer fecha o jogo por 8x7!<br>
                        • <strong>Pontuação:</strong> +30 pts para o vencedor • +10 pts de participação para o outro jogador.
                    </div>
                </div>

                <!-- Status Especial de Desafio Aberto / CTA Principal para Entrar na Partida -->
                ${!isJoined && game.status === 'open' && (participants?.length || 0) < 2 ? `
                    <div class="card" style="background: #f0fdf4; border: 2px solid #22c55e; text-align: center; padding: 22px 16px; margin-bottom: var(--space-md); box-shadow: 0 4px 14px rgba(34, 197, 94, 0.15);">
                        ${isLevelEligible(user.current_level, game.accepted_level) ? `
                            <div style="font-size: 34px; margin-bottom: 6px;">🎾</div>
                            <h2 style="font-size: 18px; font-weight: 800; color: #15803d; margin-bottom: 6px;">
                                Desafio Aberto por ${creatorFirstName}!
                            </h2>
                            <p style="font-size: 13px; color: #166534; margin-bottom: 16px; line-height: 1.45;">
                                Você é <strong>Nível ${user.current_level}</strong> e está apto a disputar esta partida válida pelo ranking de <strong>Nível ${game.accepted_level}</strong>.<br>
                                Clique no botão abaixo para aceitar o desafio e entrar na partida!
                            </p>
                            <button class="btn btn-primary" id="btn-join-open-game" style="font-size: 16px; font-weight: 800; padding: 14px 28px; width: 100%; max-width: 320px; margin: 0 auto; background: #16a34a; border-color: #16a34a; box-shadow: 0 4px 14px rgba(22, 163, 74, 0.35); cursor: pointer;">
                                🎾 Entrar na Partida
                            </button>
                        ` : `
                            <div style="font-size: 30px; margin-bottom: 6px;">🔒</div>
                            <h3 style="font-size: 16px; font-weight: 800; color: #dc3545; margin-bottom: 6px;">
                                Partida restrita ao Nível ${game.accepted_level}
                            </h3>
                            <p style="font-size: 12px; color: var(--color-grey-text); margin-bottom: 10px; line-height: 1.4;">
                                Pelas regras do ranking, é permitido disputar partidas do seu nível atual ou no máximo 1 degrau acima.<br>
                                Seu nível atual é <strong>${user.current_level}</strong> (permitido jogar níveis <strong>${getAllowedGameLevels(user.current_level).join(' ou ')}</strong>).
                            </p>
                            <div style="font-size: 11px; font-weight: 700; color: var(--color-danger); background: rgba(220, 53, 69, 0.08); padding: 8px 14px; border-radius: var(--radius-sm); display: inline-block;">
                                🔒 Inscrição bloqueada para o seu nível
                            </div>
                        `}
                    </div>
                ` : ''}

                ${isCreator && game.status === 'open' && !opponentParticipant ? `
                    <div class="card" style="background: rgba(0, 123, 255, 0.05); border: 2px solid #007bff; text-align: center; padding: 22px 16px; margin-bottom: var(--space-md); border-radius: var(--radius-md);">
                        <div style="font-size: 34px; margin-bottom: 6px;">📢</div>
                        <h3 style="font-size: 16px; font-weight: 800; color: #0056b3; margin-bottom: 6px;">
                            Você criou este Desafio Aberto!
                        </h3>
                        <p style="font-size: 13px; color: var(--color-preto); margin-bottom: 12px; line-height: 1.45;">
                            O link e o aviso deste desafio foram enviados no grupo do WhatsApp.<br>
                            Assim que outro tenista de <strong>Nível ${game.accepted_level}</strong> clicar no link e entrar na partida, ele entrará automaticamente aqui como seu adversário.
                        </p>
                        <div style="display: inline-flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; color: #0056b3; background: rgba(0, 123, 255, 0.12); padding: 8px 18px; border-radius: 20px;">
                            <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #007bff;"></span>
                            Aguardando outro tenista aceitar o desafio pelo app...
                        </div>
                    </div>
                ` : ''}

                <!-- Status de Convite Direto para o Convidado Aceitar / Recusar -->
                ${myParticipant && myParticipant.invite_status === 'pending' && !latestResult ? `
                    <div class="card" style="background: #f0fdf4; border: 2px solid #22c55e; text-align: center; padding: 22px 16px; margin-bottom: var(--space-md); box-shadow: 0 4px 14px rgba(34, 197, 94, 0.15);">
                        <div style="font-size: 34px; margin-bottom: 6px;">✉️</div>
                        <h2 style="font-size: 18px; font-weight: 800; color: #15803d; margin-bottom: 6px;">
                            ${creatorFirstName} Convidou Você para Jogar!
                        </h2>
                        <p style="font-size: 13px; color: #166534; margin-bottom: 16px; line-height: 1.45;">
                            Esta partida foi agendada diretamente com você. Confirme sua presença para oficializar a partida no Ranking Montreal!
                        </p>
                        <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                            <button class="btn btn-primary" id="btn-accept-direct-invite" style="font-size: 15px; font-weight: 800; padding: 12px 24px; background: #16a34a; border-color: #16a34a; box-shadow: 0 4px 14px rgba(22, 163, 74, 0.35); cursor: pointer;">
                                ✅ Aceitar Convite
                            </button>
                            <button class="btn btn-secondary" id="btn-decline-direct-invite" style="font-size: 13px; font-weight: 700; padding: 12px 20px; color: var(--color-danger); border-color: rgba(220, 53, 69, 0.4); cursor: pointer;">
                                ✕ Não posso jogar
                            </button>
                        </div>
                    </div>
                ` : ''}

                <!-- Status de Convite Direto para o Criador (quando aguardando confirmação do convidado) -->
                ${isCreator && game.status === 'awaiting_confirmation' && !latestResult ? `
                    <div class="card" style="background: rgba(245, 158, 11, 0.08); border: 2px solid #f59e0b; text-align: center; padding: 20px 16px; margin-bottom: var(--space-md); border-radius: var(--radius-md);">
                        <div style="font-size: 32px; margin-bottom: 6px;">⏳</div>
                        <h3 style="font-size: 16px; font-weight: 800; color: #b45309; margin-bottom: 6px;">
                            Aguardando Confirmação de ${opponentFirstName}
                        </h3>
                        <p style="font-size: 13px; color: var(--color-preto); margin-bottom: 8px; line-height: 1.45;">
                            Uma notificação exclusiva com o link desta partida foi enviada diretamente no WhatsApp de <strong>${opponentName}</strong>.<br>
                            A partida ficará com status <em>Confirmada</em> assim que o atleta aceitar pelo app!
                        </p>
                    </div>
                ` : ''}

                ${!isJoined && (game.status !== 'open' || (participants?.length || 0) >= 2) && !latestResult ? `
                    <div class="card" style="text-align: center; color: var(--color-grey-text); font-size: 12px; padding: var(--space-md); margin-bottom: var(--space-md); background: rgba(0,0,0,0.02);">
                        🔒 Esta partida já possui jogadores definidos. Apenas os participantes registrados podem lançar o placar.
                    </div>
                ` : ''}

                <!-- Participantes da Partida & Opção de Trocar Adversário antes do Placar -->
                <div class="card" style="border-left: 4px solid var(--color-saibro);">
                    <div class="card-title" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <span>👥 Jogadores da Partida</span>
                        ${isJoined && !latestResult ? `
                            <button type="button" class="btn btn-secondary btn-sm" id="btn-toggle-edit-opponent" style="font-size: 11px; padding: 4px 10px; width: auto;">
                                ✏️ ${opponentParticipant ? 'Trocar Adversário' : 'Definir Adversário'}
                            </button>
                        ` : ''}
                    </div>

                    ${isJoined ? `
                        <div style="display: flex; justify-content: space-around; align-items: center; background: rgba(0,0,0,0.03); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--color-grey-border);">
                            <div style="text-align: center; flex: 1;">
                                <div style="font-size: 11px; color: var(--color-grey-text); font-weight: 700; text-transform: uppercase;">Você</div>
                                <div style="font-size: 14px; font-weight: 800; color: var(--color-saibro); margin-top: 2px;">
                                    👤 ${userFirstName}
                                </div>
                                <div style="font-size: 10px; color: var(--color-grey-text);">${isCreator ? '(Criador)' : '(Jogador)'}</div>
                            </div>
                            <div style="font-weight: 800; color: var(--color-grey-text); font-size: 13px;">VS</div>
                            <div style="text-align: center; flex: 1;">
                                <div style="font-size: 11px; color: var(--color-grey-text); font-weight: 700; text-transform: uppercase;">Adversário</div>
                                <div style="font-size: 14px; font-weight: 800; color: ${opponentParticipant ? 'var(--color-preto)' : 'var(--color-grey-text)'}; margin-top: 2px;">
                                    🎾 ${opponentName}
                                </div>
                                <div style="font-size: 10px; color: var(--color-grey-text);">${opponentParticipant ? 'Confirmado' : 'Aguardando Desafiante'}</div>
                            </div>
                        </div>
                    ` : `
                        <div style="display: flex; justify-content: space-around; align-items: center; background: rgba(0,0,0,0.03); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--color-grey-border);">
                            <div style="text-align: center; flex: 1;">
                                <div style="font-size: 11px; color: var(--color-grey-text); font-weight: 700; text-transform: uppercase;">Criador do Desafio</div>
                                <div style="font-size: 14px; font-weight: 800; color: var(--color-saibro); margin-top: 2px;">
                                    👤 ${creatorName}
                                </div>
                                <div style="font-size: 10px; color: var(--color-grey-text);">Nível ${game.accepted_level}</div>
                            </div>
                            <div style="font-weight: 800; color: var(--color-grey-text); font-size: 13px;">VS</div>
                            <div style="text-align: center; flex: 1;">
                                <div style="font-size: 11px; color: var(--color-grey-text); font-weight: 700; text-transform: uppercase;">Adversário</div>
                                <div style="font-size: 14px; font-weight: 800; color: ${opponentParticipant ? 'var(--color-preto)' : 'var(--color-saibro)'}; margin-top: 2px;">
                                    🎾 ${opponentParticipant ? opponentName : 'Vaga Aberta'}
                                </div>
                                <div style="font-size: 10px; color: var(--color-grey-text);">${opponentParticipant ? 'Confirmado' : 'Aguardando Inscrição'}</div>
                            </div>
                        </div>
                    `}

                    <!-- Painel de Troca de Adversário (oculto até clicar em Trocar) -->
                    ${isJoined && !latestResult ? `
                        <div id="panel-edit-opponent" style="display: none; margin-top: var(--space-md); padding: 14px; background: rgba(192, 81, 49, 0.05); border: 1.5px dashed var(--color-saibro); border-radius: var(--radius-md);">
                            <div style="font-weight: 800; font-size: 13px; color: var(--color-saibro); margin-bottom: 4px;">
                                🔄 ${opponentParticipant ? 'Alterar Adversário' : 'Selecionar Adversário'}
                            </div>
                            <p style="font-size: 11px; color: var(--color-grey-text); margin-bottom: 10px; line-height: 1.3;">
                                Você pode trocar o adversário antes de registrar o placar. Após registrar o placar, a partida fica concluída no ranking e bloqueada.
                            </p>

                            ${recentOpponents.length > 0 ? `
                                <div class="form-group" style="margin-bottom: 8px;">
                                    <label class="form-label" style="font-size: 11px;">Adversários Recentes</label>
                                    <select class="form-control" id="edit-select-recent-opponent" style="font-size: 12px;">
                                        <option value="" selected>Escolha um adversário recente...</option>
                                        ${recentOpponents.map(o => `<option value="${o.customer_code}" data-name="${o.display_name}" data-level="${o.current_level}">${o.display_name} (Nível ${o.current_level})</option>`).join('')}
                                    </select>
                                </div>
                            ` : ''}

                            <div class="form-group" style="margin-bottom: 8px;">
                                <label class="form-label" style="font-size: 11px;">Ou buscar por Telefone (com DDD)</label>
                                <div style="display: flex; gap: var(--space-xs);">
                                    <input type="tel" class="form-control" id="edit-input-search-phone" placeholder="(41) 99999-9999" maxlength="15" style="font-size: 12px;">
                                    <button type="button" class="btn btn-secondary btn-sm" id="btn-edit-search-phone" style="width: 100px; font-size: 11px;">
                                        🔍 Buscar
                                    </button>
                                </div>
                            </div>

                            <div id="edit-opponent-notfound" style="display: none; margin-bottom: 12px; padding: 12px 14px; background: rgba(220, 53, 69, 0.08); border: 1px solid rgba(220, 53, 69, 0.3); border-radius: var(--radius-sm);">
                                <div style="font-weight: 800; color: var(--color-danger); font-size: 12px; display: flex; align-items: center; gap: 6px;">
                                    <span>⚠️</span> Pessoa não encontrada
                                </div>
                                <div style="font-size: 11px; color: var(--color-grey-text); margin-top: 3px; line-height: 1.4;">
                                    Nenhum jogador cadastrado na Montreal foi localizado com este número. Certifique-se de digitar o DDD (ex: 41 99999-9999). Apenas alunos e mensalistas cadastrados no clube participam do ranking.
                                </div>
                            </div>

                            <div id="edit-opponent-selected-box" style="display: none; margin-bottom: 12px; padding: 10px 12px; background: rgba(46, 125, 50, 0.1); border: 1px solid var(--color-success); border-radius: var(--radius-sm);">
                                <div style="font-weight: 800; color: #2e7d32; font-size: 12px;" id="edit-opponent-selected-name">
                                    ✅ Novo Adversário Selecionado
                                </div>
                            </div>

                            <div style="display: flex; gap: 8px; justify-content: flex-end;">
                                <button type="button" class="btn btn-secondary btn-sm" id="btn-cancel-edit-opponent" style="font-size: 11px; padding: 6px 12px; width: auto;">
                                    Cancelar
                                </button>
                                <button type="button" class="btn btn-primary btn-sm" id="btn-confirm-edit-opponent" style="font-size: 11px; padding: 6px 14px; width: auto; display: none;">
                                    ✅ Salvar Novo Adversário
                                </button>
                            </div>
                        </div>
                    ` : ''}
                </div>

                <!-- Reserva de Quadra -->
                <div class="card" style="border: 1.5px solid var(--color-booking-blue);">
                    <div class="card-title" style="color: var(--color-booking-blue);">
                        <span>🎾 Reserva da Quadra</span>
                        <span class="badge ${game.court_reservation_status === 'reserva_declarada' ? 'badge-success' : 'badge-warning'}">
                            ${courtStatusLabel}
                        </span>
                    </div>

                    <p style="font-size: var(--font-size-xs); color: var(--color-grey-text); margin-bottom: var(--space-md);">
                        A organização do jogo dentro do aplicativo não realiza a reserva automática da quadra no Matchpoint.
                    </p>

                    <div style="display: flex; flex-direction: column; gap: var(--space-sm);">
                        <button class="btn btn-booking btn-sm" id="btn-detail-booking">
                            Reservar na Montreal (Matchpoint)
                        </button>

                        ${game.court_reservation_status !== 'reserva_declarada' ? `
                            <button class="btn btn-secondary btn-sm" id="btn-confirm-reservation">
                                ✅ Confirmar que a quadra já foi reservada
                            </button>
                        ` : ''}
                    </div>
                </div>

                <!-- Card de Placar Oficial Registrado -->
                ${latestResult ? `
                    <div class="card" style="border-left: 5px solid var(--color-success);">
                        <div class="card-title">
                            <span>🏆 Placar da Partida</span>
                            <span class="badge badge-success">
                                Partida Concluída
                            </span>
                        </div>

                        <div style="background: rgba(0,0,0,0.03); padding: var(--space-md); border-radius: var(--radius-md); margin-top: var(--space-sm); border: 1px solid var(--color-grey-border);">
                            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--color-grey-border); padding-bottom: 8px; margin-bottom: 10px; font-size: 12px; font-weight: 800;">
                                <span style="color: var(--color-saibro); flex: 1; text-align: center;">👤 ${reporterName}</span>
                                <span style="color: var(--color-grey-text); width: 30px; text-align: center;">vs</span>
                                <span style="color: var(--color-preto); flex: 1; text-align: center;">🎾 ${otherName}</span>
                            </div>

                            ${latestResult.set2_p1 === null || latestResult.set2_p1 === undefined ? `
                                <!-- Formato Oficial: 1 Set até 8 games -->
                                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 10px 0;">
                                    <div style="display: flex; align-items: center; justify-content: center; gap: 24px;">
                                        <div style="text-align: center;">
                                            <span style="font-size: 38px; color: ${latestResult.set1_p1 > latestResult.set1_p2 ? 'var(--color-saibro)' : 'var(--color-preto)'}; font-weight: 800; display: block; line-height: 1;">
                                                ${latestResult.set1_p1}
                                            </span>
                                            ${latestResult.winner_customer_code === latestResult.reported_by ? `<span style="font-size: 10px; color: #2e7d32; font-weight: 800; text-transform: uppercase;">🏆 Vencedor</span>` : ''}
                                        </div>
                                        <span style="font-size: 24px; color: var(--color-grey-border); font-weight: 700;">x</span>
                                        <div style="text-align: center;">
                                            <span style="font-size: 38px; color: ${latestResult.set1_p2 > latestResult.set1_p1 ? 'var(--color-saibro)' : 'var(--color-preto)'}; font-weight: 800; display: block; line-height: 1;">
                                                ${latestResult.set1_p2}
                                            </span>
                                            ${latestResult.winner_customer_code !== latestResult.reported_by ? `<span style="font-size: 10px; color: #2e7d32; font-weight: 800; text-transform: uppercase;">🏆 Vencedor</span>` : ''}
                                        </div>
                                    </div>
                                    ${latestResult.tb_p1 !== null && latestResult.tb_p1 !== undefined ? `
                                        <div style="margin-top: 10px; font-size: 12px; font-weight: 800; color: var(--color-saibro); background: rgba(192, 81, 49, 0.08); padding: 4px 14px; border-radius: 12px; border: 1px solid rgba(192, 81, 49, 0.2);">
                                            Tiebreak: ${latestResult.tb_p1} x ${latestResult.tb_p2}
                                        </div>
                                    ` : ''}
                                </div>
                            ` : `
                                <!-- Formato Legado com múltiplos sets -->
                                <div style="display: flex; flex-direction: column; gap: 8px;">
                                    <div style="display: flex; align-items: center; font-size: var(--font-size-base); font-weight: 800;">
                                        <span style="font-size: 12px; color: var(--color-grey-text); font-weight: 600; width: 70px; text-align: left;">1º Set:</span>
                                        <span style="color: var(--color-saibro); flex: 1; text-align: center; font-size: 20px;">${latestResult.set1_p1}</span>
                                        <span style="color: var(--color-grey-border); width: 30px; text-align: center;">x</span>
                                        <span style="color: var(--color-preto); flex: 1; text-align: center; font-size: 20px;">${latestResult.set1_p2}</span>
                                    </div>
                                    <div style="display: flex; align-items: center; font-size: var(--font-size-base); font-weight: 800;">
                                        <span style="font-size: 12px; color: var(--color-grey-text); font-weight: 600; width: 70px; text-align: left;">2º Set:</span>
                                        <span style="color: var(--color-saibro); flex: 1; text-align: center; font-size: 20px;">${latestResult.set2_p1}</span>
                                        <span style="color: var(--color-grey-border); width: 30px; text-align: center;">x</span>
                                        <span style="color: var(--color-preto); flex: 1; text-align: center; font-size: 20px;">${latestResult.set2_p2}</span>
                                    </div>
                                    ${latestResult.tb_p1 !== null && latestResult.tb_p1 !== undefined ? `
                                        <div style="display: flex; align-items: center; font-size: var(--font-size-base); font-weight: 800; border-top: 1px dashed var(--color-grey-border); padding-top: 6px;">
                                            <span style="font-size: 11px; color: var(--color-grey-text); font-weight: 600; width: 70px; text-align: left;">Super TB:</span>
                                            <span style="color: var(--color-saibro); flex: 1; text-align: center; font-size: 18px;">${latestResult.tb_p1}</span>
                                            <span style="color: var(--color-grey-border); width: 30px; text-align: center;">x</span>
                                            <span style="color: var(--color-preto); flex: 1; text-align: center; font-size: 18px;">${latestResult.tb_p2}</span>
                                        </div>
                                    ` : ''}
                                </div>
                            `}
                        </div>

                        <div style="font-size: 12px; color: #2e7d32; text-align: center; margin-top: 12px; font-weight: 700; background: rgba(46, 125, 50, 0.08); padding: 8px 12px; border-radius: var(--radius-sm); line-height: 1.4;">
                            ✅ Placar oficial confirmado e computado no ranking (+30 pts para o vencedor / +10 pts de participação).
                        </div>

                        ${game.status !== 'disputed' ? `
                            <div style="text-align: center; margin-top: 10px;">
                                <button class="btn btn-secondary btn-sm" id="btn-dispute-score" style="font-size: 11px; padding: 4px 10px; color: var(--color-grey-text); border: none; background: transparent; text-decoration: underline; cursor: pointer;">
                                    Houve algum erro no placar? Contestar
                                </button>
                            </div>
                        ` : `
                            <div style="font-size: 11px; color: var(--color-danger); text-align: center; margin-top: 8px; font-weight: 700;">
                                ⚠️ Partida com contestação aberta em análise.
                            </div>
                        `}
                    </div>
                ` : ''}

                <!-- Opção para lançar placar antecipado se o criador já jogou sem o adversário aceitar pelo app -->
                ${isJoined && !latestResult && isCreator && game.status === 'open' && !opponentParticipant ? `
                    <div class="card" style="border: 1px dashed var(--color-grey-border); background: rgba(0,0,0,0.02); text-align: center; padding: 16px;">
                        <div style="font-size: 13px; font-weight: 700; color: var(--color-preto); margin-bottom: 4px;">
                            Já disputou esta partida antes de alguém aceitar no app?
                        </div>
                        <p style="font-size: 11px; color: var(--color-grey-text); margin-bottom: 10px;">
                            Se você combinou direto na quadra, pode escolher seu adversário manualmente e registrar o placar agora.
                        </p>
                        <button type="button" class="btn btn-secondary btn-sm" id="btn-toggle-manual-score" style="width: auto; margin: 0 auto; font-size: 11px; padding: 6px 14px;">
                            📝 Lançar Placar e Escolher Adversário Manualmente
                        </button>
                    </div>
                ` : ''}

                <!-- Form de Registro de Placar (Apenas se ainda NÃO houver placar cadastrado) -->
                ${isJoined && !latestResult ? `
                    <div class="card" id="card-score-form" style="${isCreator && game.status === 'open' && !opponentParticipant ? 'display: none; ' : ''}border-left: 5px solid var(--color-saibro);">
                        <div class="card-title">
                            <span>📝 Registrar Placar da Partida</span>
                        </div>

                        <form id="form-register-score" novalidate>
                            ${!opponentParticipant ? `
                                <!-- Seletor Obrigatório de Adversário caso ainda não tenha sido vinculado -->
                                <div style="background: rgba(192, 81, 49, 0.05); border: 1.5px dashed var(--color-saibro); border-radius: var(--radius-md); padding: 12px 14px; margin-bottom: var(--space-md);">
                                    <div style="font-weight: 800; font-size: 13px; color: var(--color-saibro); margin-bottom: 4px; display: flex; align-items: center; justify-content: space-between;">
                                        <span>🎾 Quem jogou contra você?</span>
                                        <span class="badge badge-warning" style="font-size: 10px;">Obrigatório para o Ranking</span>
                                    </div>
                                    <p style="font-size: 11px; color: var(--color-grey-text); margin-bottom: 10px; line-height: 1.3;">
                                        Para registrar a participação e pontuar no ranking (+30 vitória / +10 participação), selecione o seu adversário.
                                    </p>

                                    ${recentOpponents.length > 0 ? `
                                        <div class="form-group" style="margin-bottom: 8px;">
                                            <select class="form-control" id="score-select-recent-opponent" style="font-size: 13px;">
                                                <option value="" selected>Escolha um adversário recente...</option>
                                                ${recentOpponents.map(o => `<option value="${o.customer_code}" data-name="${o.display_name}" data-level="${o.current_level}">${o.display_name} (Nível ${o.current_level})</option>`).join('')}
                                            </select>
                                        </div>
                                    ` : ''}

                                    <div style="display: flex; gap: var(--space-xs);">
                                        <input type="tel" class="form-control" id="score-input-search-phone" placeholder="Ou digite o telefone do adversário (com DDD)" maxlength="15" style="font-size: 12px;">
                                        <button type="button" class="btn btn-secondary btn-sm" id="btn-score-search-phone" style="width: 100px; font-size: 12px;">
                                            🔍 Buscar
                                        </button>
                                    </div>

                                    <div id="score-selected-opponent-box" style="display: none; margin-top: 10px; padding: 8px 12px; background: rgba(46, 125, 50, 0.1); border: 1px solid var(--color-success); border-radius: var(--radius-sm);">
                                        <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                                            <div style="font-weight: 800; color: #2e7d32; font-size: 12px;" id="score-selected-opponent-name">
                                                ✅ Adversário selecionado
                                            </div>
                                            <button type="button" class="btn btn-secondary btn-sm" id="btn-remove-score-selected-opponent" style="font-size: 10px; padding: 2px 8px; color: var(--color-danger); background: white; border-color: rgba(220, 53, 69, 0.3); width: auto;">
                                                ✕ Trocar
                                            </button>
                                        </div>
                                    </div>

                                    <div id="score-opponent-notfound" style="display: none; margin-top: 10px; padding: 12px 14px; background: rgba(220, 53, 69, 0.08); border: 1px solid rgba(220, 53, 69, 0.3); border-radius: var(--radius-sm);">
                                        <div style="font-weight: 800; color: var(--color-danger); font-size: 12px; display: flex; align-items: center; gap: 6px;">
                                            <span>⚠️</span> Pessoa não encontrada
                                        </div>
                                        <div style="font-size: 11px; color: var(--color-grey-text); margin-top: 3px; line-height: 1.4;">
                                            Nenhum jogador cadastrado na Montreal foi localizado com este número. Certifique-se de digitar o DDD (ex: 41 99999-9999). Apenas alunos e mensalistas cadastrados no clube participam do ranking.
                                        </div>
                                    </div>
                                </div>
                            ` : ''}

                            <!-- Box Placar 1 Set até 8 games -->
                            <div style="background: rgba(0,0,0,0.02); border: 1px solid var(--color-grey-border); border-radius: var(--radius-md); padding: 14px 12px; margin-bottom: var(--space-md);">
                                <div style="display: flex; align-items: center; justify-content: space-between; gap: var(--space-xs); margin-bottom: 12px;">
                                    <!-- Coluna VOCÊ -->
                                    <div style="flex: 1; text-align: center;">
                                        <div style="font-size: 12px; font-weight: 800; color: var(--color-saibro);">
                                            👤 Você (${userFirstName})
                                        </div>
                                    </div>

                                    <div style="width: 30px; text-align: center; font-weight: 800; color: var(--color-grey-text); font-size: 12px;">
                                        vs
                                    </div>

                                    <!-- Coluna ADVERSÁRIO -->
                                    <div style="flex: 1; text-align: center;">
                                        <div style="font-size: 12px; font-weight: 800; color: var(--color-preto);" id="score-opponent-header-name">
                                            🎾 ${opponentFirstName}
                                        </div>
                                    </div>
                                </div>

                                <div style="display: flex; align-items: center; justify-content: center; gap: 14px;">
                                    <div style="width: 100px; text-align: center;">
                                        <label style="font-size: 11px; font-weight: 700; color: var(--color-grey-text); display: block; margin-bottom: 4px;">Seus Games</label>
                                        <input type="number" class="form-control" id="score-games-p1" min="0" max="8" placeholder="-" 
                                            style="text-align: center; font-size: 26px; font-weight: 800; height: 52px; color: var(--color-saibro); border-color: rgba(192, 81, 49, 0.4); background-color: rgba(192, 81, 49, 0.03);">
                                    </div>

                                    <div style="font-size: 24px; font-weight: 800; color: var(--color-grey-text); margin-top: 18px;">
                                        x
                                    </div>

                                    <div style="width: 100px; text-align: center;">
                                        <label style="font-size: 11px; font-weight: 700; color: var(--color-grey-text); display: block; margin-bottom: 4px;">Games do Adv.</label>
                                        <input type="number" class="form-control" id="score-games-p2" min="0" max="8" placeholder="-" 
                                            style="text-align: center; font-size: 26px; font-weight: 800; height: 52px; color: var(--color-preto);">
                                    </div>
                                </div>

                                <!-- Box de Tiebreak (aberto quando for 7x7 ou 8x7 / 7x8) -->
                                <div id="box-tiebreak" style="display: none; margin-top: 14px; padding: 12px; background: rgba(192, 81, 49, 0.06); border: 1.5px dashed var(--color-saibro); border-radius: var(--radius-sm);">
                                    <div style="font-weight: 800; font-size: 12px; color: var(--color-saibro); text-align: center; margin-bottom: 8px;">
                                        🎾 Empate em 7x7! Digite os pontos do Tiebreak (até 7 pontos):
                                    </div>
                                    <div style="display: flex; align-items: center; justify-content: center; gap: 12px;">
                                        <div style="width: 80px; text-align: center;">
                                            <label style="font-size: 10px; font-weight: 700; color: var(--color-grey-text); display: block; margin-bottom: 2px;">Seus Pontos</label>
                                            <input type="number" class="form-control" id="score-tb-p1" min="0" max="30" placeholder="0" 
                                                style="text-align: center; font-size: 20px; font-weight: 800; height: 42px; color: var(--color-saibro);">
                                        </div>
                                        <div style="font-size: 16px; font-weight: 800; color: var(--color-grey-text); margin-top: 14px;">x</div>
                                        <div style="width: 80px; text-align: center;">
                                            <label style="font-size: 10px; font-weight: 700; color: var(--color-grey-text); display: block; margin-bottom: 2px;">Pontos Adv.</label>
                                            <input type="number" class="form-control" id="score-tb-p2" min="0" max="30" placeholder="0" 
                                                style="text-align: center; font-size: 20px; font-weight: 800; height: 42px; color: var(--color-preto);">
                                        </div>
                                    </div>
                                    <div style="font-size: 10px; color: var(--color-grey-text); text-align: center; margin-top: 6px;">
                                        Mínimo de 7 pontos com 2 de vantagem (ex: 7x5, 7x4, 8x6, 9x7).
                                    </div>
                                </div>

                                <!-- Feedback do Placar em tempo real -->
                                <div id="score-status-feedback" style="display: none; margin-top: 12px; font-size: 12px; font-weight: 700; text-align: center; padding: 6px 10px; border-radius: var(--radius-sm);">
                                </div>
                            </div>

                            <button type="submit" class="btn btn-primary" id="btn-submit-score">
                                🏆 Salvar Placar e Atualizar Ranking
                            </button>
                        </form>
                    </div>
                ` : ''}

            </div>
        `;

        document.getElementById('btn-back-games')?.addEventListener('click', () => {
            window.location.hash = '#/jogos';
        });

        document.getElementById('btn-toggle-manual-score')?.addEventListener('click', () => {
            const formCard = document.getElementById('card-score-form');
            if (formCard) {
                const isHidden = formCard.style.display === 'none';
                formCard.style.display = isHidden ? 'block' : 'none';
                if (isHidden) {
                    formCard.scrollIntoView({ behavior: 'smooth' });
                }
            }
        });

        document.getElementById('btn-join-open-game')?.addEventListener('click', async () => {
            if (!isLevelEligible(user.current_level, game.accepted_level)) {
                alert(`Você é Nível ${user.current_level} e não pode entrar em uma partida de Nível ${game.accepted_level}.\n\nRegra do Ranking: Jogadores só podem disputar partidas no seu nível atual ou 1 degrau acima (${getAllowedGameLevels(user.current_level).join(', ')}).`);
                return;
            }
            const btn = document.getElementById('btn-join-open-game');
            if (btn) {
                btn.disabled = true;
                btn.textContent = 'Entrando na partida...';
            }
            try {
                await db.from('mt_game_participants').insert({
                    game_id: gameId,
                    customer_code: user.customer_code,
                    role: 'player',
                    invite_status: 'accepted'
                });
                await db.from('mt_games').update({ status: 'confirmed' }).eq('id', gameId);

                // Notifica o grupo de WhatsApp em segundo plano
                try {
                    notifyOpenGameJoined(game, { customer_code: game.creator_customer_code, display_name: creatorName }, user);
                } catch (notifErr) {
                    console.warn('Erro ao notificar aceite no WhatsApp:', notifErr);
                }

                alert(`Você entrou na partida com sucesso!\n\nAgora você e ${creatorName} são os jogadores confirmados desta partida oficial do Ranking.`);
                renderGameDetail(params);
            } catch (errJoin) {
                console.error("Erro ao entrar na partida:", errJoin);
                alert("Erro ao entrar na partida: " + (errJoin.message || 'Tente novamente.'));
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = '🎾 Entrar na Partida';
                }
            }
        });

        // Listener para aceitar convite direto
        document.getElementById('btn-accept-direct-invite')?.addEventListener('click', async () => {
            const btn = document.getElementById('btn-accept-direct-invite');
            if (btn) {
                btn.disabled = true;
                btn.textContent = 'Confirmando presença...';
            }
            try {
                await db.from('mt_game_participants')
                    .update({ invite_status: 'accepted' })
                    .eq('game_id', gameId)
                    .eq('customer_code', user.customer_code);

                await db.from('mt_games').update({ status: 'confirmed' }).eq('id', gameId);

                alert(`Convite aceito com sucesso!\n\nA partida entre você e ${creatorName} está confirmada no Ranking Montreal.`);
                renderGameDetail(params);
            } catch (errAcc) {
                console.error("Erro ao aceitar convite:", errAcc);
                alert("Erro ao aceitar convite: " + errAcc.message);
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = '✅ Aceitar Convite';
                }
            }
        });

        // Listener para recusar convite direto
        document.getElementById('btn-decline-direct-invite')?.addEventListener('click', async () => {
            if (!confirm(`Deseja recusar o convite para esta partida?`)) return;
            try {
                await db.from('mt_game_participants')
                    .delete()
                    .eq('game_id', gameId)
                    .eq('customer_code', user.customer_code);

                await db.from('mt_games').update({ status: 'cancelled' }).eq('id', gameId);

                alert("Convite recusado. A partida foi cancelada.");
                window.location.hash = '#/jogos';
            } catch (errDec) {
                console.error("Erro ao recusar convite:", errDec);
                alert("Erro ao recusar convite: " + errDec.message);
            }
        });

        document.getElementById('btn-detail-booking')?.addEventListener('click', openMontrealBooking);

        document.getElementById('btn-confirm-reservation')?.addEventListener('click', async () => {
            try {
                await db.from('mt_games').update({
                    court_reservation_status: 'reserva_declarada',
                    court_reservation_confirmed_by: user.customer_code,
                    court_reservation_confirmed_at: new Date().toISOString()
                }).eq('id', gameId);
                alert("Status da reserva atualizado com sucesso!");
                renderGameDetail(params);
            } catch (e) {
                alert("Erro ao atualizar reserva.");
            }
        });

        // Gestão dinâmica do formulário de 1 Set até 8 games com Tiebreak em 7x7
        const gamesP1El = document.getElementById('score-games-p1');
        const gamesP2El = document.getElementById('score-games-p2');
        const boxTiebreak = document.getElementById('box-tiebreak');
        const tbP1El = document.getElementById('score-tb-p1');
        const tbP2El = document.getElementById('score-tb-p2');
        const feedbackEl = document.getElementById('score-status-feedback');

        const updateScoreUI = () => {
            if (!gamesP1El || !gamesP2El) return;
            const g1Str = gamesP1El.value.trim();
            const g2Str = gamesP2El.value.trim();
            
            if (g1Str === '' && g2Str === '') {
                if (boxTiebreak) boxTiebreak.style.display = 'none';
                if (feedbackEl) feedbackEl.style.display = 'none';
                return;
            }

            const g1 = parseInt(g1Str, 10);
            const g2 = parseInt(g2Str, 10);

            // Auto preenche 0 se um lado for 8 e o outro estiver em branco
            if (g1 === 8 && g2Str === '') gamesP2El.value = '0';
            if (g2 === 8 && g1Str === '') gamesP1El.value = '0';

            // Se for 7x7 ou 8x7 ou 7x8: ativa o box de Tiebreak
            const isTiebreak = (!isNaN(g1) && !isNaN(g2)) && 
                ((g1 === 7 && g2 === 7) || (g1 === 8 && g2 === 7) || (g1 === 7 && g2 === 8));

            if (boxTiebreak) {
                boxTiebreak.style.display = isTiebreak ? 'block' : 'none';
            }

            if (feedbackEl) {
                feedbackEl.style.display = 'block';
                if (isNaN(g1) || isNaN(g2)) {
                    feedbackEl.style.background = 'rgba(0,0,0,0.04)';
                    feedbackEl.style.color = 'var(--color-grey-text)';
                    feedbackEl.textContent = 'Digite a quantidade de games de cada jogador.';
                } else if (g1 === 8 && g2 < 7) {
                    feedbackEl.style.background = 'rgba(46, 125, 50, 0.1)';
                    feedbackEl.style.color = '#2e7d32';
                    feedbackEl.textContent = `🎉 Vitória sua por 8 x ${g2}! (+${rankingConfig.points_winner} pontos no ranking)`;
                } else if (g2 === 8 && g1 < 7) {
                    feedbackEl.style.background = 'rgba(0,0,0,0.05)';
                    feedbackEl.style.color = 'var(--color-preto)';
                    feedbackEl.textContent = `🎾 Vitória do adversário por 8 x ${g1}. (+${rankingConfig.points_loser} pontos de participação)`;
                } else if (isTiebreak) {
                    const tb1 = parseInt(tbP1El?.value || '0', 10);
                    const tb2 = parseInt(tbP2El?.value || '0', 10);
                    const maxTb = Math.max(tb1, tb2);
                    const minTb = Math.min(tb1, tb2);
                    if (maxTb >= 7 && (maxTb - minTb >= 2)) {
                        if (tb1 > tb2) {
                            feedbackEl.style.background = 'rgba(46, 125, 50, 0.1)';
                            feedbackEl.style.color = '#2e7d32';
                            feedbackEl.textContent = `🎉 Vitória sua por 8 x 7 no Tiebreak (${tb1} x ${tb2})! (+${rankingConfig.points_winner} pts no ranking)`;
                        } else {
                            feedbackEl.style.background = 'rgba(0,0,0,0.05)';
                            feedbackEl.style.color = 'var(--color-preto)';
                            feedbackEl.textContent = `🎾 Vitória do adversário por 8 x 7 no Tiebreak (${tb1} x ${tb2}). (+${rankingConfig.points_loser} pts)`;
                        }
                    } else {
                        feedbackEl.style.background = 'rgba(192, 81, 49, 0.08)';
                        feedbackEl.style.color = 'var(--color-saibro)';
                        feedbackEl.textContent = '🎾 Partida em Tiebreak! Digite a pontuação (mínimo de 7 com 2 de vantagem).';
                    }
                } else if (g1 > 8 || g2 > 8) {
                    feedbackEl.style.background = 'rgba(220, 53, 69, 0.1)';
                    feedbackEl.style.color = 'var(--color-danger)';
                    feedbackEl.textContent = '⚠️ O set vai até 8 games (máximo permitido: 8 games).';
                } else {
                    feedbackEl.style.background = 'rgba(0,0,0,0.04)';
                    feedbackEl.style.color = 'var(--color-grey-text)';
                    feedbackEl.textContent = 'Partida do ranking: vence quem atingir 8 games primeiro.';
                }
            }
        };

        gamesP1El?.addEventListener('input', updateScoreUI);
        gamesP2El?.addEventListener('input', updateScoreUI);
        tbP1El?.addEventListener('input', updateScoreUI);
        tbP2El?.addEventListener('input', updateScoreUI);

        document.getElementById('score-input-search-phone')?.addEventListener('input', () => {
            const notfoundBox = document.getElementById('score-opponent-notfound');
            if (notfoundBox) notfoundBox.style.display = 'none';
        });

        document.getElementById('score-select-recent-opponent')?.addEventListener('change', (e) => {
            const notfoundBox = document.getElementById('score-opponent-notfound');
            if (notfoundBox) notfoundBox.style.display = 'none';

            const opt = e.target.options[e.target.selectedIndex];
            if (opt && opt.value) {
                const oppLevel = opt.getAttribute('data-level');
                if (!isLevelEligible(oppLevel, game.accepted_level)) {
                    alert(`O adversário selecionado (${opt.getAttribute('data-name')}) é Nível ${oppLevel} e não pode participar de uma partida de Nível ${game.accepted_level}.\n\nRegra do Ranking: Jogadores só podem disputar partidas no seu nível atual ou 1 degrau acima.`);
                    e.target.value = '';
                    return;
                }
                selectedScoreOpponent = {
                    customer_code: opt.value,
                    display_name: opt.getAttribute('data-name'),
                    current_level: oppLevel
                };
                const box = document.getElementById('score-selected-opponent-box');
                document.getElementById('score-selected-opponent-name').textContent = `✅ Adversário: ${selectedScoreOpponent.display_name} (Nível ${selectedScoreOpponent.current_level})`;
                box.style.display = 'block';
                const headerName = document.getElementById('score-opponent-header-name');
                if (headerName) headerName.textContent = selectedScoreOpponent.display_name.split(' ')[0];
            }
        });

        document.getElementById('btn-score-search-phone')?.addEventListener('click', async () => {
            const input = document.getElementById('score-input-search-phone');
            const phone = input?.value.trim();
            const notfoundBox = document.getElementById('score-opponent-notfound');
            const box = document.getElementById('score-selected-opponent-box');

            if (notfoundBox) notfoundBox.style.display = 'none';

            if (!phone) {
                alert("Digite o telefone com DDD do adversário para buscar.");
                return;
            }
            try {
                const res = await callRPC('fn_mt_game_buscar_convidado_por_telefone', { p_phone: phone });
                if (res && res.length > 0 && res[0].found) {
                    const foundData = res[0];
                    if (isSameUser(foundData.customer_code, user.customer_code)) {
                        alert("Você não pode selecionar a si mesmo como adversário.");
                        return;
                    }
                    if (!isLevelEligible(foundData.current_level, game.accepted_level)) {
                        alert(`O adversário localizado (${foundData.display_name}) é Nível ${foundData.current_level} e não pode participar desta partida de Nível ${game.accepted_level}.\n\nRegra do Ranking: Jogadores só podem disputar partidas no seu nível atual ou 1 degrau acima.`);
                        return;
                    }
                    selectedScoreOpponent = {
                        customer_code: foundData.customer_code,
                        display_name: foundData.display_name,
                        current_level: foundData.current_level
                    };
                    document.getElementById('score-selected-opponent-name').textContent = `✅ Adversário: ${selectedScoreOpponent.display_name} (Nível ${selectedScoreOpponent.current_level})`;
                    if (box) box.style.display = 'block';
                    if (notfoundBox) notfoundBox.style.display = 'none';
                    const headerName = document.getElementById('score-opponent-header-name');
                    if (headerName) headerName.textContent = selectedScoreOpponent.display_name.split(' ')[0];
                } else {
                    selectedScoreOpponent = null;
                    if (box) box.style.display = 'none';
                    if (notfoundBox) notfoundBox.style.display = 'block';
                }
            } catch (e) {
                alert("Erro ao buscar jogador: " + e.message);
            }
        });

        // Listener para remover adversário selecionado no formulário de placar
        document.getElementById('btn-remove-score-selected-opponent')?.addEventListener('click', () => {
            selectedScoreOpponent = null;
            const box = document.getElementById('score-selected-opponent-box');
            if (box) box.style.display = 'none';
            const notfoundBox = document.getElementById('score-opponent-notfound');
            if (notfoundBox) notfoundBox.style.display = 'none';
            const input = document.getElementById('score-input-search-phone');
            if (input) input.value = '';
            const selectRecent = document.getElementById('score-select-recent-opponent');
            if (selectRecent) selectRecent.value = '';
            const headerName = document.getElementById('score-opponent-header-name');
            if (headerName) headerName.textContent = "A Definir";
        });

        // ====================================================================
        // GESTÃO DE TROCA DE ADVERSÁRIO ANTES DO PLACAR
        // ====================================================================
        let tempSelectedOpponent = null;

        document.getElementById('btn-toggle-edit-opponent')?.addEventListener('click', () => {
            const panel = document.getElementById('panel-edit-opponent');
            if (panel) {
                const isHidden = panel.style.display === 'none' || !panel.style.display;
                panel.style.display = isHidden ? 'block' : 'none';
                if (isHidden) {
                    panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        });

        document.getElementById('btn-cancel-edit-opponent')?.addEventListener('click', () => {
            const panel = document.getElementById('panel-edit-opponent');
            if (panel) panel.style.display = 'none';
            tempSelectedOpponent = null;
            const btnConfirm = document.getElementById('btn-confirm-edit-opponent');
            if (btnConfirm) btnConfirm.style.display = 'none';
            const selBox = document.getElementById('edit-opponent-selected-box');
            if (selBox) selBox.style.display = 'none';
            const notfoundBox = document.getElementById('edit-opponent-notfound');
            if (notfoundBox) notfoundBox.style.display = 'none';
            const phoneInput = document.getElementById('edit-input-search-phone');
            if (phoneInput) phoneInput.value = '';
            const selectRecent = document.getElementById('edit-select-recent-opponent');
            if (selectRecent) selectRecent.value = '';
        });

        document.getElementById('edit-input-search-phone')?.addEventListener('input', () => {
            const notfoundBox = document.getElementById('edit-opponent-notfound');
            if (notfoundBox) notfoundBox.style.display = 'none';
        });

        document.getElementById('edit-select-recent-opponent')?.addEventListener('change', (e) => {
            const notfoundBox = document.getElementById('edit-opponent-notfound');
            if (notfoundBox) notfoundBox.style.display = 'none';

            const opt = e.target.options[e.target.selectedIndex];
            if (opt && opt.value) {
                if (isSameUser(opt.value, user.customer_code)) {
                    alert("Você não pode selecionar a si mesmo como adversário.");
                    e.target.value = '';
                    return;
                }
                const oppLevel = opt.getAttribute('data-level');
                if (!isLevelEligible(oppLevel, game.accepted_level)) {
                    alert(`O jogador ${opt.getAttribute('data-name')} é Nível ${oppLevel} e não pode disputar uma partida de Nível ${game.accepted_level}.\n\nRegra do Ranking: Jogadores só podem disputar partidas no seu nível atual ou 1 degrau acima.`);
                    e.target.value = '';
                    return;
                }
                tempSelectedOpponent = {
                    customer_code: opt.value,
                    display_name: opt.getAttribute('data-name'),
                    current_level: oppLevel
                };

                const selBox = document.getElementById('edit-opponent-selected-box');
                const selName = document.getElementById('edit-opponent-selected-name');
                const btnConfirm = document.getElementById('btn-confirm-edit-opponent');
                selName.textContent = `✅ Novo Adversário Selecionado: ${tempSelectedOpponent.display_name} (Nível ${tempSelectedOpponent.current_level})`;
                selBox.style.display = 'block';
                btnConfirm.style.display = 'inline-block';

                const phoneInput = document.getElementById('edit-input-search-phone');
                if (phoneInput) phoneInput.value = '';
            }
        });

        document.getElementById('btn-edit-search-phone')?.addEventListener('click', async () => {
            const input = document.getElementById('edit-input-search-phone');
            const phone = input?.value.trim();
            const notfoundBox = document.getElementById('edit-opponent-notfound');
            const selBox = document.getElementById('edit-opponent-selected-box');
            const btnConfirm = document.getElementById('btn-confirm-edit-opponent');

            if (notfoundBox) notfoundBox.style.display = 'none';

            if (!phone) {
                alert("Digite o telefone com DDD para buscar o adversário.");
                return;
            }
            try {
                const res = await callRPC('fn_mt_game_buscar_convidado_por_telefone', { p_phone: phone });
                if (res && res.length > 0 && res[0].found) {
                    const foundData = res[0];
                    if (isSameUser(foundData.customer_code, user.customer_code)) {
                        alert("Você não pode selecionar a si mesmo como adversário.");
                        return;
                    }
                    if (!isLevelEligible(foundData.current_level, game.accepted_level)) {
                        alert(`O jogador localizado (${foundData.display_name}) é Nível ${foundData.current_level} e não pode disputar uma partida de Nível ${game.accepted_level}.\n\nRegra do Ranking: Jogadores só podem disputar partidas no seu nível atual ou 1 degrau acima.`);
                        return;
                    }
                    tempSelectedOpponent = {
                        customer_code: foundData.customer_code,
                        display_name: foundData.display_name,
                        current_level: foundData.current_level
                    };

                    const selName = document.getElementById('edit-opponent-selected-name');
                    selName.textContent = `✅ Novo Adversário Localizado: ${tempSelectedOpponent.display_name} (Nível ${tempSelectedOpponent.current_level})`;
                    if (selBox) selBox.style.display = 'block';
                    if (btnConfirm) btnConfirm.style.display = 'inline-block';
                    if (notfoundBox) notfoundBox.style.display = 'none';

                    const selRecent = document.getElementById('edit-select-recent-opponent');
                    if (selRecent) selRecent.value = '';
                } else {
                    tempSelectedOpponent = null;
                    if (selBox) selBox.style.display = 'none';
                    if (btnConfirm) btnConfirm.style.display = 'none';
                    if (notfoundBox) notfoundBox.style.display = 'block';
                }
            } catch (e) {
                alert("Erro ao buscar jogador: " + e.message);
            }
        });

        document.getElementById('btn-confirm-edit-opponent')?.addEventListener('click', async () => {
            if (!tempSelectedOpponent || !tempSelectedOpponent.customer_code) {
                alert("Selecione um adversário para confirmar a alteração.");
                return;
            }

            if (!confirm(`Confirmar a alteração do adversário para ${tempSelectedOpponent.display_name}?`)) {
                return;
            }

            try {
                // Remove o adversário anterior se existir
                if (opponentParticipant) {
                    await db.from('mt_game_participants')
                        .delete()
                        .eq('game_id', gameId)
                        .eq('customer_code', opponentParticipant.customer_code);
                }

                // Insere o novo adversário
                await db.from('mt_game_participants').insert({
                    game_id: gameId,
                    customer_code: tempSelectedOpponent.customer_code,
                    role: 'player',
                    invite_status: 'accepted'
                });

                // Atualiza o jogo para confirmed caso estivesse open
                await db.from('mt_games').update({ status: 'confirmed' }).eq('id', gameId);

                alert("Adversário alterado com sucesso!");
                renderGameDetail(params);
            } catch (errEdit) {
                console.error("Erro ao alterar adversário:", errEdit);
                alert("Erro ao alterar adversário: " + errEdit.message);
            }
        });

        document.getElementById('form-register-score')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await submitGameScore(user, game, participants, selectedScoreOpponent);
        });

        document.getElementById('btn-validate-score')?.addEventListener('click', async () => {
            await validateGameScore(user, game, latestResult, participants);
        });

        document.getElementById('btn-dispute-score')?.addEventListener('click', async () => {
            await db.from('mt_games').update({ status: 'disputed' }).eq('id', gameId);
            alert("O resultado foi marcado como contestado e enviado para a administração da Montreal.");
            renderGameDetail(params);
        });

    } catch (e) {
        console.error("Erro ao carregar detalhes do jogo:", e);
        container.innerHTML = `<p style="color: var(--color-danger); text-align: center; padding: var(--space-lg);">Erro ao carregar partida.</p>`;
    }
}

async function submitGameScore(user, game, participants, selectedScoreOpponent = null) {
    const g1El = document.getElementById('score-games-p1');
    const g2El = document.getElementById('score-games-p2');
    const tb1El = document.getElementById('score-tb-p1');
    const tb2El = document.getElementById('score-tb-p2');

    // Regra de segurança: Apenas jogadores registrados nesta partida podem lançar o placar
    const isParticipant = participants?.some(p => isSameUser(p.customer_code, user.customer_code));
    if (!isParticipant) {
        alert("Apenas os jogadores registrados nesta partida têm permissão para lançar o placar.");
        return;
    }

    // Verifica se já existe um adversário vinculado à partida
    const opponentPart = participants?.find(p => !isSameUser(p.customer_code, user.customer_code));
    let finalOpponentCode = opponentPart?.customer_code;

    if (!finalOpponentCode) {
        if (!selectedScoreOpponent || !selectedScoreOpponent.customer_code) {
            alert("Por favor, selecione quem jogou contra você nesta partida. É obrigatório identificar ambos os jogadores para computar os pontos do ranking (+30 vitória / +10 participação).");
            document.getElementById('score-input-search-phone')?.focus();
            return;
        }
        finalOpponentCode = selectedScoreOpponent.customer_code;

        // Vincula o adversário imediatamente como participante aceito da partida
        try {
            await db.from('mt_game_participants').insert({
                game_id: game.id,
                customer_code: finalOpponentCode,
                role: 'player',
                invite_status: 'accepted'
            });
        } catch (errPart) {
            console.warn("Erro ao vincular participante:", errPart);
        }
    }

    // Se preencheu um lado e deixou o outro vazio com 8, assume 0 games (ex: 8x0 ou 0x8)
    if (g1El.value.trim() !== '' && g2El.value.trim() === '') g2El.value = '0';
    if (g2El.value.trim() !== '' && g1El.value.trim() === '') g1El.value = '0';

    const g1Str = g1El.value.trim();
    const g2Str = g2El.value.trim();

    if (g1Str === '' || g2Str === '') {
        alert("Por favor, preencha os games da partida (1 set até 8 games).");
        g1El.focus();
        return;
    }

    let g1 = parseInt(g1Str, 10);
    let g2 = parseInt(g2Str, 10);

    if (isNaN(g1) || isNaN(g2) || g1 < 0 || g2 < 0) {
        alert("Digite um número válido de games.");
        return;
    }

    let tb1 = null;
    let tb2 = null;
    let winnerCode = null;

    // Cenário 1: Jogo com Tiebreak (empate em 7x7 ou digitado 8x7 / 7x8)
    if ((g1 === 7 && g2 === 7) || (g1 === 8 && g2 === 7) || (g1 === 7 && g2 === 8)) {
        const tb1Str = tb1El?.value.trim() || '';
        const tb2Str = tb2El?.value.trim() || '';

        if (tb1Str === '' || tb2Str === '') {
            alert("A partida empatou em 7x7! É obrigatório preencher a pontuação do Tiebreak (até 7 pontos) para definir o vencedor.");
            tb1El?.focus();
            return;
        }

        tb1 = parseInt(tb1Str, 10);
        tb2 = parseInt(tb2Str, 10);

        if (isNaN(tb1) || isNaN(tb2) || tb1 < 0 || tb2 < 0) {
            alert("Digite pontos válidos para o Tiebreak.");
            return;
        }

        if (tb1 === tb2) {
            alert("No Tiebreak não pode haver empate. Quem atingir pelo menos 7 pontos com 2 de vantagem vence.");
            return;
        }

        const maxTb = Math.max(tb1, tb2);
        const minTb = Math.min(tb1, tb2);
        if (maxTb < 7 || (maxTb - minTb < 2)) {
            alert("No Tiebreak, o vencedor deve ter pelo menos 7 pontos e no mínimo 2 pontos de diferença (ex: 7x5, 7x4, 8x6, 9x7).");
            return;
        }

        if (tb1 > tb2) {
            g1 = 8;
            g2 = 7;
            winnerCode = user.customer_code;
        } else {
            g1 = 7;
            g2 = 8;
            winnerCode = finalOpponentCode;
        }
    } 
    // Cenário 2: Vitória direta sem Tiebreak (8x0 até 8x6 ou 0x8 até 6x8)
    else if ((g1 === 8 && g2 <= 6) || (g2 === 8 && g1 <= 6)) {
        winnerCode = g1 === 8 ? user.customer_code : finalOpponentCode;
    } 
    else {
        alert(`Placar inválido (${g1} x ${g2}).\n\nRegras Oficiais do Ranking Montreal:\n• O jogo é em 1 set até 8 games (vencedor fecha em 8 games, ex: 8x4, 8x6).\n• Se empatar em 7x7, vai para o Tiebreak até 7 pontos e o vencedor fecha por 8x7.`);
        return;
    }

    if (game.game_date) {
        const parts = game.game_date.split('-');
        if (parts.length === 3 && parseInt(parts[1], 10) === 12) {
            alert("⚠️ Em dezembro NÃO há partidas do ranking (período de recesso oficial).\n\nA temporada ocorre exclusivamente de Janeiro a 30 de Novembro. A nova temporada com pontuações zeradas iniciará em Janeiro!");
            return;
        }
    }

    const btnSubmit = document.getElementById('btn-submit-score');
    btnSubmit.disabled = true;
    btnSubmit.textContent = "Salvando e pontuando no ranking...";

    try {
        await callRPC('fn_mt_game_registrar_resultado', {
            p_game_id: game.id,
            p_reported_by: user.customer_code,
            p_winner_code: winnerCode,
            p_s1_p1: g1,
            p_s1_p2: g2,
            p_s2_p1: null,
            p_s2_p2: null,
            p_tb_p1: tb1,
            p_tb_p2: tb2
        });

        alert(`🏆 Placar registrado com sucesso! O ranking já foi atualizado com os pontos oficiais da partida (+${rankingConfig.points_winner} pts vitória / +${rankingConfig.points_loser} pts participação).`);
        renderGameDetail({ gameId: game.id });
    } catch (e) {
        console.error("Erro ao registrar placar:", e);
        alert("Erro ao registrar placar: " + e.message);
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.textContent = "🏆 Salvar Placar e Atualizar Ranking";
    }
}

async function validateGameScore(user, game, result, participants) {
    try {
        await db.from('mt_game_results').update({ validation_status: 'validated' }).eq('id', result.result_id);
        await db.from('mt_games').update({ status: 'completed' }).eq('id', game.id);

        const winnerCode = result.winner_customer_code;

        for (const p of participants) {
            const isWinner = p.customer_code === winnerCode;
            const pointsEarned = isWinner ? 30 : 10;

            const { data: prof } = await db.from('mt_game_profiles').select('*').eq('customer_code', p.customer_code).single();
            if (prof) {
                await db.from('mt_game_profiles').update({
                    total_points: (prof.total_points || 0) + pointsEarned,
                    total_games: (prof.total_games || 0) + 1,
                    total_wins: isWinner ? (prof.total_wins || 0) + 1 : (prof.total_wins || 0)
                }).eq('customer_code', p.customer_code);
            }

            await db.from('mt_ranking_events').insert({
                customer_code: p.customer_code,
                game_id: game.id,
                event_type: isWinner ? 'win' : 'participation',
                points: pointsEarned,
                description: isWinner ? `Vitória na partida (${game.game_type})` : `Participação na partida (${game.game_type})`
            });
        }

        alert("Placar validado com sucesso! Os pontos do ranking foram atualizados (+30 para o vencedor, +10 para a participação).");
        renderGameDetail({ gameId: game.id });
    } catch (e) {
        console.error("Erro ao validar resultado:", e);
        alert("Erro ao validar placar: " + e.message);
    }
}
