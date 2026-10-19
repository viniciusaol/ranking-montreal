/* ====================================================================
   MONTREAL TÊNIS CLUBE - CRIAÇÃO DE JOGO (OPÇÃO DE CONFIRMAÇÃO PRÉVIA)
   ==================================================================== */

import { state } from '../state.js';
import { db, callRPC } from '../supabase.js';
import { openMontrealBooking, getAllowedGameLevels, isLevelEligible, LEVEL_LABELS } from '../utils.js?v=1.4.8';
import { notifyOpenGameCreated } from '../notifications.js?v=1.5.0';

let selectedInvitedPlayer = null;

const isSameUser = (code1, code2) => {
    if (!code1 || !code2) return false;
    return String(code1).trim() === String(code2).trim() || parseInt(code1, 10) === parseInt(code2, 10);
};

export async function renderGameCreate() {
    const container = document.getElementById('view-content');
    const user = state.getUser();

    if (!user) return;

    const draft = state.loadDraftGame();
    const todayStr = new Date().toISOString().split('T')[0];
    selectedInvitedPlayer = null;

    const userLevel = (user.current_level || 'C').toUpperCase();
    const allowedGameLevels = getAllowedGameLevels(userLevel);

    let recentOpponents = [];
    try {
        const rawRecents = await callRPC('fn_mt_game_obter_adversarios_recentes', { p_customer_code: user.customer_code }) || [];
        recentOpponents = rawRecents.filter(o => !isSameUser(o.customer_code, user.customer_code));
    } catch (e) {
        console.warn("Erro ao buscar adversários recentes:", e);
    }

    container.innerHTML = `
        <div class="view-container active">
            <h2 style="font-size: var(--font-size-xl); font-weight: 800; margin-bottom: var(--space-xs); color: var(--color-preto);">Abrir Novo Jogo</h2>
            <p style="font-size: var(--font-size-sm); color: var(--color-grey-text); margin-bottom: var(--space-md);">
                Escolha se deseja publicar um jogo aberto ou convidar um adversário diretamente.
            </p>

            <form id="form-game-create">
                <!-- Modo do Jogo: Aberto vs Com Convidado -->
                <div class="card" style="border-left: 5px solid var(--color-saibro);">
                    <span class="card-title" style="font-size: var(--font-size-base);">1. Formato de Desafio</span>
                    
                    <div class="form-group">
                        <label class="form-label">Como deseja criar a partida?</label>
                        <select class="form-control" id="game-mode">
                            <option value="open" selected>🌐 Jogo Aberto (Aguardar qualquer adversário no ranking)</option>
                            <option value="invited">✉️ Jogo com Convidado (Adversários recentes ou novo por telefone)</option>
                        </select>
                    </div>

                    <!-- Bloco privado para convidar parceiro -->
                    <div id="group-invited-player" style="display: none; margin-top: var(--space-md);">
                        ${recentOpponents.length > 0 ? `
                            <div class="form-group">
                                <label class="form-label">Seus Adversários Recentes</label>
                                <select class="form-control" id="select-recent-opponent">
                                    <option value="" selected>Escolha um jogador recente ou busque por telefone abaixo...</option>
                                    ${recentOpponents.map(o => `<option value="${o.customer_code}" data-name="${o.display_name}" data-level="${o.current_level}">${o.display_name} (Nível ${o.current_level})</option>`).join('')}
                                </select>
                            </div>
                        ` : ''}

                        <div class="form-group">
                            <label class="form-label">Convidar Novo Jogador pelo Telefone (com DDD)</label>
                            <div style="display: flex; gap: var(--space-xs);">
                                <input type="tel" class="form-control" id="input-search-phone" placeholder="(41) 99999-9999" maxlength="15">
                                <button type="button" class="btn btn-secondary btn-sm" id="btn-search-phone" style="width: 120px; font-size: 12px;">
                                    🔍 Buscar
                                </button>
                            </div>
                        </div>

                        <!-- Card de Resultado da Busca Privada / Seleção -->
                        <div id="invited-player-result" style="display: none; padding: var(--space-md); background: rgba(40, 167, 69, 0.08); border: 1px solid var(--color-success); border-radius: var(--radius-md); margin-top: var(--space-xs); margin-bottom: var(--space-md);">
                            <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                                <div>
                                    <div style="font-weight: 800; color: #2e7d32; font-size: var(--font-size-sm);" id="invited-player-name">
                                        Jogador Localizado
                                    </div>
                                    <div style="font-size: var(--font-size-xs); color: var(--color-grey-text); margin-top: 2px;" id="invited-player-level">
                                        Nível C
                                    </div>
                                </div>
                                <button type="button" class="btn btn-secondary btn-sm" id="btn-remove-invited-player" style="font-size: 11px; padding: 4px 10px; border-color: rgba(220, 53, 69, 0.4); color: var(--color-danger); background: white; width: auto;">
                                    ✕ Trocar
                                </button>
                            </div>
                        </div>

                        <!-- Card de Pessoa Não Encontrada -->
                        <div id="invited-player-notfound" style="display: none; padding: 12px 14px; background: rgba(220, 53, 69, 0.08); border: 1px solid rgba(220, 53, 69, 0.3); border-radius: var(--radius-md); margin-top: var(--space-xs); margin-bottom: var(--space-md);">
                            <div style="font-weight: 800; color: var(--color-danger); font-size: 13px; display: flex; align-items: center; gap: 6px;">
                                <span>⚠️</span> Pessoa não encontrada
                            </div>
                            <div style="font-size: 11px; color: var(--color-grey-text); margin-top: 4px; line-height: 1.4;">
                                Nenhum jogador cadastrado na Montreal foi localizado com este número. Certifique-se de digitar o DDD (ex: 41 99999-9999). Apenas alunos e mensalistas cadastrados no clube participam do ranking.
                            </div>
                        </div>

                        <!-- Opção de confirmação prévia -->
                        <div class="form-group" style="margin-bottom: 0;">
                            <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; text-transform: none; font-weight: 600; cursor: pointer; color: var(--color-preto);">
                                <input type="checkbox" id="check-already-confirmed">
                                <span>Já combinei e o convidado já confirmou comigo previamente.</span>
                            </label>
                        </div>
                    </div>
                </div>

                <!-- Nível e Modalidade -->
                <div class="card">
                    <span class="card-title" style="font-size: var(--font-size-base);">2. Categoria e Nível</span>
                    <div class="form-group">
                        <label class="form-label">Categoria de Gênero</label>
                        <select class="form-control" id="game-gender-category">
                            <option value="Masculino" ${(draft.gender_category || user.gender) !== 'Feminino' ? 'selected' : ''}>🎾 Masculino</option>
                            <option value="Feminino" ${(draft.gender_category || user.gender) === 'Feminino' ? 'selected' : ''}>🎾 Feminino</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Nível da Partida (Pontua no Ranking deste Nível)</label>
                        <select class="form-control" id="game-level">
                            ${allowedGameLevels.map(lvl => {
                                const isCurrent = lvl === userLevel;
                                const desc = LEVEL_LABELS[lvl] || `Nível ${lvl}`;
                                const tag = isCurrent ? ' (Seu Nível Atual)' : ' ⬆️ (Desafio 1 Nível Acima)';
                                const isSelected = (draft.accepted_level || userLevel) === lvl;
                                return `<option value="${lvl}" ${isSelected ? 'selected' : ''}>${desc}${tag}</option>`;
                            }).join('')}
                        </select>
                        <div style="font-size: 11px; color: var(--color-grey-text); margin-top: 4px; line-height: 1.3;">
                            💡 Pelas regras do ranking, você pode criar partidas do seu nível atual (<strong>${userLevel}</strong>)${allowedGameLevels.length > 1 ? ` ou subir 1 degrau e desafiar o <strong>${allowedGameLevels[1]}</strong>` : ''}.
                        </div>
                    </div>

                    <div class="form-group" style="margin-bottom: 0;">
                        <label class="form-label">Modalidade e Formato Oficial</label>
                        <select class="form-control" id="game-type">
                            <option value="Simples" selected>Simples (1 Set até 8 games • No-Ad)</option>
                        </select>
                    </div>

                    <div style="background: rgba(192, 81, 49, 0.06); border: 1px solid rgba(192, 81, 49, 0.25); border-radius: var(--radius-sm); padding: 10px 12px; margin-top: 12px; font-size: 11px; line-height: 1.4; color: var(--color-preto);">
                        <strong style="color: var(--color-saibro); display: flex; align-items: center; gap: 4px; margin-bottom: 4px; font-size: 12px;">
                            <span>🎾</span> Regulamento Oficial do Ranking Montreal:
                        </strong>
                        • <strong>1 Set até 8 games:</strong> vence o jogador que alcançar 8 games primeiro.<br>
                        • <strong>Sem Vantagem (No-Ad):</strong> em 40x40 (deuce), joga-se ponto decisivo (recebedor escolhe o lado do saque).<br>
                        • <strong>Empate em 7x7:</strong> disputa-se Tiebreak até 7 pontos (com diferença de 2). Quem vencer fecha a partida em 8x7!
                    </div>
                </div>

                <!-- Data e Horário -->
                <div class="card">
                    <span class="card-title" style="font-size: var(--font-size-base);">3. Data e Horário</span>
                    <div class="form-group">
                        <label class="form-label">Data do Jogo</label>
                        <input type="date" class="form-control" id="game-date" value="${draft.game_date || todayStr}" min="${todayStr}">
                    </div>

                    <div style="display: flex; gap: var(--space-sm);">
                        <div class="form-group" style="flex: 1; margin-bottom: 0;">
                            <label class="form-label">Horário Inicial</label>
                            <input type="time" class="form-control" id="game-time" value="${draft.start_time || '18:00'}">
                        </div>

                        <div class="form-group" style="flex: 1; margin-bottom: 0;">
                            <label class="form-label">Duração</label>
                            <select class="form-control" id="game-duration">
                                <option value="60" ${draft.duration_minutes === 60 ? 'selected' : ''}>60 min (1h)</option>
                                <option value="120" ${draft.duration_minutes === 120 ? 'selected' : ''}>120 min (2h)</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- Local e Reserva -->
                <div class="card">
                    <span class="card-title" style="font-size: var(--font-size-base);">4. Local e Reserva</span>
                    <div class="form-group">
                        <label class="form-label">Local da Partida</label>
                        <select class="form-control" id="game-location">
                            <option value="1" selected>Montreal Tênis Clube</option>
                            <option value="2">Outro Local</option>
                        </select>
                    </div>

                    <div id="montreal-booking-info" style="background-color: rgba(41, 128, 185, 0.08); border: 1px solid var(--color-booking-blue); border-radius: var(--radius-md); padding: var(--space-md); margin-top: var(--space-sm);">
                        <div style="display: flex; align-items: center; gap: var(--space-xs); color: var(--color-booking-blue); font-weight: 800; font-size: var(--font-size-sm); margin-bottom: 4px;">
                            <span>ℹ️ Informação de Reserva da Quadra</span>
                        </div>
                        <p style="font-size: var(--font-size-xs); color: var(--color-grey-text); margin-bottom: var(--space-md); line-height: 1.4;">
                            A criação do jogo dentro do aplicativo <strong>não reserva a quadra automaticamente</strong>. Faça a reserva no sistema oficial da Montreal.
                        </p>
                        <button type="button" class="btn btn-booking btn-sm" id="btn-draft-reserve">
                            Reservar na Montreal (Matchpoint)
                        </button>
                    </div>

                    <div class="form-group" style="margin-top: var(--space-md); margin-bottom: 0;">
                        <label class="form-label">Status da Reserva da Quadra</label>
                        <select class="form-control" id="court-status">
                            <option value="nao_reservada">Ainda não reservada</option>
                            <option value="reserva_declarada">Já reservei a quadra</option>
                        </select>
                    </div>
                </div>

                <!-- Observações -->
                <div class="card">
                    <div class="form-group" style="margin-bottom: 0;">
                        <label class="form-label">Observações (Opcional)</label>
                        <input type="text" class="form-control" id="game-notes" placeholder="Ex: Preferência por quadra coberta / bolas novas" value="${draft.notes || ''}">
                    </div>
                </div>

                <button type="submit" class="btn btn-primary" id="btn-submit-game" style="margin-bottom: var(--space-lg);">
                    🚀 Criar Partida
                </button>
            </form>
        </div>
    `;

    document.getElementById('game-mode')?.addEventListener('change', (e) => {
        const mode = e.target.value;
        const groupInvited = document.getElementById('group-invited-player');
        groupInvited.style.display = mode === 'invited' ? 'block' : 'none';
    });

    document.getElementById('btn-remove-invited-player')?.addEventListener('click', () => {
        selectedInvitedPlayer = null;
        const resultBox = document.getElementById('invited-player-result');
        if (resultBox) resultBox.style.display = 'none';
        const notfoundBox = document.getElementById('invited-player-notfound');
        if (notfoundBox) notfoundBox.style.display = 'none';
        const phoneInput = document.getElementById('input-search-phone');
        if (phoneInput) phoneInput.value = '';
        const recentSelect = document.getElementById('select-recent-opponent');
        if (recentSelect) recentSelect.value = '';
    });

    document.getElementById('input-search-phone')?.addEventListener('input', () => {
        const notfoundBox = document.getElementById('invited-player-notfound');
        if (notfoundBox) notfoundBox.style.display = 'none';
    });

    document.getElementById('select-recent-opponent')?.addEventListener('change', (e) => {
        const notfoundBox = document.getElementById('invited-player-notfound');
        if (notfoundBox) notfoundBox.style.display = 'none';

        const opt = e.target.options[e.target.selectedIndex];
        if (opt && opt.value) {
            if (isSameUser(opt.value, user.customer_code)) {
                alert("Você não pode selecionar a si mesmo como adversário.");
                e.target.value = '';
                return;
            }
            const currentSelectedLevel = document.getElementById('game-level')?.value || userLevel;
            const oppLevel = opt.getAttribute('data-level');
            if (!isLevelEligible(oppLevel, currentSelectedLevel)) {
                alert(`O jogador ${opt.getAttribute('data-name')} é Nível ${oppLevel} e não pode disputar uma partida de Nível ${currentSelectedLevel}.\n\nRegra do Ranking: Cada jogador só pode disputar partidas no seu nível atual ou 1 degrau acima.`);
                e.target.value = '';
                return;
            }
            selectedInvitedPlayer = {
                customer_code: opt.value,
                display_name: opt.getAttribute('data-name'),
                current_level: oppLevel
            };

            const resultBox = document.getElementById('invited-player-result');
            document.getElementById('invited-player-name').textContent = `✅ Jogador Selecionado: ${selectedInvitedPlayer.display_name}`;
            document.getElementById('invited-player-level').textContent = `Nível ${selectedInvitedPlayer.current_level}`;
            resultBox.style.display = 'block';

            const phoneInput = document.getElementById('input-search-phone');
            if (phoneInput) phoneInput.value = '';
        }
    });

    document.getElementById('btn-search-phone')?.addEventListener('click', async () => {
        const phoneInput = document.getElementById('input-search-phone');
        const phone = phoneInput.value.trim();
        const resultBox = document.getElementById('invited-player-result');
        const notfoundBox = document.getElementById('invited-player-notfound');

        if (notfoundBox) notfoundBox.style.display = 'none';

        if (!phone) {
            alert("Digite o número de telefone com DDD para realizar a busca.");
            return;
        }

        try {
            const res = await callRPC('fn_mt_game_buscar_convidado_por_telefone', { p_phone: phone });

            if (res && res.length > 0 && res[0].found) {
                const foundData = res[0];
                if (isSameUser(foundData.customer_code, user.customer_code)) {
                    alert("Você não pode selecionar a si mesmo como adversário.");
                    phoneInput.value = '';
                    return;
                }
                const currentSelectedLevel = document.getElementById('game-level')?.value || userLevel;
                if (!isLevelEligible(foundData.current_level, currentSelectedLevel)) {
                    alert(`O jogador localizado (${foundData.display_name}) é Nível ${foundData.current_level} e não pode disputar uma partida de Nível ${currentSelectedLevel}.\n\nRegra do Ranking: Cada jogador só pode disputar partidas no seu nível atual ou 1 degrau acima.`);
                    phoneInput.value = '';
                    return;
                }
                selectedInvitedPlayer = {
                    customer_code: foundData.customer_code,
                    display_name: foundData.display_name,
                    current_level: foundData.current_level
                };

                document.getElementById('invited-player-name').textContent = `✅ Jogador Localizado: ${foundData.display_name}`;
                document.getElementById('invited-player-level').textContent = `Nível ${foundData.current_level}`;
                resultBox.style.display = 'block';
                if (notfoundBox) notfoundBox.style.display = 'none';

                const recentSelect = document.getElementById('select-recent-opponent');
                if (recentSelect) recentSelect.value = '';
            } else {
                selectedInvitedPlayer = null;
                if (resultBox) resultBox.style.display = 'none';
                if (notfoundBox) notfoundBox.style.display = 'block';
            }
        } catch (e) {
            alert("Erro na busca: " + e.message);
        }
    });

    document.getElementById('game-level')?.addEventListener('change', (e) => {
        const newLvl = e.target.value;
        if (selectedInvitedPlayer && !isLevelEligible(selectedInvitedPlayer.current_level, newLvl)) {
            alert(`O jogador convidado (${selectedInvitedPlayer.display_name} - Nível ${selectedInvitedPlayer.current_level}) não pode disputar partidas de Nível ${newLvl}.\n\nA seleção do adversário foi cancelada para você escolher um participante elegível.`);
            selectedInvitedPlayer = null;
            const resultBox = document.getElementById('invited-player-result');
            if (resultBox) resultBox.style.display = 'none';
            const phoneInput = document.getElementById('input-search-phone');
            if (phoneInput) phoneInput.value = '';
            const recentSelect = document.getElementById('select-recent-opponent');
            if (recentSelect) recentSelect.value = '';
        }
    });

    document.getElementById('btn-draft-reserve')?.addEventListener('click', () => {
        saveCurrentFormToDraft();
        openMontrealBooking();
    });

    document.getElementById('form-game-create')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleGameCreation(user);
    });
}

function saveCurrentFormToDraft() {
    state.saveDraftGame({
        accepted_level: document.getElementById('game-level').value,
        gender_category: document.getElementById('game-gender-category')?.value || 'Masculino',
        game_type: document.getElementById('game-type').value,
        game_date: document.getElementById('game-date').value,
        start_time: document.getElementById('game-time').value,
        duration_minutes: parseInt(document.getElementById('game-duration').value),
        location_id: parseInt(document.getElementById('game-location').value),
        court_reservation_status: document.getElementById('court-status').value,
        notes: document.getElementById('game-notes').value
    });
}

async function handleGameCreation(user) {
    const btn = document.getElementById('btn-submit-game');
    const mode = document.getElementById('game-mode').value;
    const alreadyConfirmed = document.getElementById('check-already-confirmed')?.checked || false;

    if (mode === 'invited' && !selectedInvitedPlayer) {
        alert("Por favor, selecione um jogador recente ou faça a busca pelo número de telefone.");
        return;
    }

    btn.disabled = true;
    btn.textContent = "Criando Partida...";

    try {
        let initialStatus = 'open';
        if (mode === 'invited') {
            initialStatus = alreadyConfirmed ? 'confirmed' : 'awaiting_confirmation';
        }

        const gameData = {
            creator_customer_code: user.customer_code,
            accepted_level: document.getElementById('game-level').value,
            gender_category: document.getElementById('game-gender-category')?.value || 'Masculino',
            game_type: document.getElementById('game-type').value,
            game_date: document.getElementById('game-date').value,
            start_time: document.getElementById('game-time').value,
            duration_minutes: parseInt(document.getElementById('game-duration').value),
            location_id: parseInt(document.getElementById('game-location').value),
            court_reservation_status: document.getElementById('court-status').value,
            notes: document.getElementById('game-notes').value,
            status: initialStatus
        };

        const { data: game, error } = await db.from('mt_games').insert(gameData).select().single();
        if (error) throw error;

        // Insere o criador como participante aceito
        await db.from('mt_game_participants').insert({
            game_id: game.id,
            customer_code: user.customer_code,
            role: 'creator',
            invite_status: 'accepted'
        });

        // Se houver convidado direto
        if (mode === 'invited' && selectedInvitedPlayer) {
            await db.from('mt_game_participants').insert({
                game_id: game.id,
                customer_code: selectedInvitedPlayer.customer_code,
                role: 'player',
                invite_status: alreadyConfirmed ? 'accepted' : 'pending'
            });

            if (!alreadyConfirmed) {
                // Enfileira notificação para o convidado confirmar via WhatsApp/App
                await db.from('mt_game_notifications').insert({
                    customer_code: selectedInvitedPlayer.customer_code,
                    event_type: 'invite',
                    game_id: game.id,
                    payload: {
                        creator_name: user.display_name,
                        game_date: game.game_date,
                        start_time: game.start_time
                    }
                });
            }
        }

        if (mode === 'open') {
            // Dispara notificação no grupo de WhatsApp do Ranking via Uazapi / n8n
            notifyOpenGameCreated(game, user).catch(errNotify => {
                console.warn("Erro ao disparar notificação no WhatsApp:", errNotify);
            });
        }

        state.clearDraftGame();
        if (mode === 'open') {
            alert("Partida aberta criada com sucesso! O aviso foi publicado no grupo de WhatsApp do Ranking.");
        } else {
            alert(alreadyConfirmed ? "Partida confirmada criada com sucesso!" : "Convite enviado com sucesso para o adversário!");
        }
        window.location.hash = `#/jogos/${game.id}`;
    } catch (err) {
        console.error("Erro ao criar jogo:", err);
        alert("Não foi possível criar a partida: " + (err.message || "Erro de conexão."));
    } finally {
        btn.disabled = false;
        btn.textContent = "🚀 Criar Partida";
    }
}
