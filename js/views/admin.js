import { state } from '../state.js';
import { db, callRPC } from '../supabase.js';
import { formatDateBR, formatPhone, getInitials } from '../utils.js?v=1.4.8';
import { processPendingScoreReminders, processInactivityReminders, notifyWeeklyRankingRound, processOpenGamesDigest } from '../notifications.js?v=1.7.2';

let allActivatedAthletes = [];

export async function renderAdmin() {
    const container = document.getElementById('view-content');
    const user = state.getUser();

    if (!user || !user.is_admin) {
        container.innerHTML = `<p style="color: var(--color-danger); text-align: center; padding: var(--space-xl);">Acesso restrito a administradores da Montreal.</p>`;
        return;
    }

    container.innerHTML = `
        <div class="view-container active">
            <h2 style="font-size: var(--font-size-xl); font-weight: 800; margin-bottom: var(--space-md);">👑 Painel Administrativo</h2>

            <div class="card">
                <span class="card-title">📊 Resumo do Sistema</span>
                <p style="font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-bottom: 12px;">
                    Gerencie contestações, moderação, regras do ranking, novos cadastros e lembretes automáticos.
                </p>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px;">
                    <div style="background: rgba(34, 197, 94, 0.08); border: 1px solid rgba(34, 197, 94, 0.2); border-radius: var(--radius-sm); padding: 10px; text-align: center;">
                        <div id="stat-total-athletes" style="font-size: 22px; font-weight: 800; color: #166534;">-</div>
                        <div style="font-size: 11px; font-weight: 700; color: var(--color-grey-text);">Atletas Ativos</div>
                    </div>
                    <div style="background: rgba(194, 65, 12, 0.08); border: 1px solid rgba(194, 65, 12, 0.2); border-radius: var(--radius-sm); padding: 10px; text-align: center;">
                        <div id="stat-total-games" style="font-size: 22px; font-weight: 800; color: var(--color-saibro);">0</div>
                        <div style="font-size: 11px; font-weight: 700; color: var(--color-grey-text);">Jogos Realizados</div>
                    </div>
                    <div style="background: rgba(234, 179, 8, 0.08); border: 1px solid rgba(234, 179, 8, 0.25); border-radius: var(--radius-sm); padding: 10px; text-align: center;">
                        <div id="stat-pending-reminders" style="font-size: 22px; font-weight: 800; color: #b45309;">-</div>
                        <div style="font-size: 11px; font-weight: 700; color: var(--color-grey-text);">Lembretes Pendentes</div>
                    </div>
                </div>
            </div>

            <!-- Seção de Atletas Cadastrados e Ativados no Ranking -->
            <div class="card" style="border-left: 5px solid var(--color-verde);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; flex-wrap: wrap; margin-bottom: 12px;">
                    <div>
                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                            <span class="card-title" style="color: #166534; margin-bottom: 0;">
                                👥 Atletas Ativados no Ranking
                            </span>
                            <span id="admin-athletes-count-badge" class="badge" style="background: rgba(34, 197, 94, 0.15); color: #166534; font-weight: 800; font-size: 11px;">
                                Carregando...
                            </span>
                        </div>
                        <div style="font-size: 12px; color: var(--color-grey-text); line-height: 1.4; margin-top: 4px;">
                            Lista de tenistas que já acessaram o link, validaram o telefone e ativaram seu perfil.
                        </div>
                    </div>
                    <button type="button" class="btn btn-secondary btn-sm" id="btn-refresh-athletes" style="font-size: 11px; padding: 5px 10px; display: inline-flex; align-items: center; gap: 4px; font-weight: 700;">
                        🔄 Atualizar Lista
                    </button>
                </div>

                <!-- Barra de busca e filtros rápidos -->
                <div style="display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap;">
                    <input type="text" id="filter-athletes-search" class="form-control" placeholder="🔍 Buscar por nome ou telefone..." style="flex: 1; min-width: 170px; font-size: 12px; padding: 7px 10px;">
                    <select id="filter-athletes-level" class="form-control" style="width: auto; min-width: 120px; font-size: 12px; padding: 7px 10px; font-weight: 700;">
                        <option value="ALL">Todos os Níveis</option>
                        <option value="A">Nível A</option>
                        <option value="B">Nível B</option>
                        <option value="C">Nível C</option>
                        <option value="D">Nível D</option>
                    </select>
                </div>

                <!-- Lista de atletas -->
                <div id="admin-athletes-list" style="display: flex; flex-direction: column; gap: 8px;">
                    <p style="text-align: center; color: var(--color-grey-text); font-size: 12px; margin: 12px 0;">Consultando atletas cadastrados...</p>
                </div>
            </div>

            <!-- Seção de Configuração de Regras e Pontuação do Ranking -->
            <div class="card" style="border-left: 5px solid var(--color-saibro);">
                <div style="margin-bottom: 12px;">
                    <span class="card-title" style="color: var(--color-saibro); margin-bottom: 2px;">
                        ⚙️ Regras & Pontuação do Ranking
                    </span>
                    <div style="font-size: 12px; color: var(--color-grey-text); line-height: 1.4;">
                        Defina a pontuação oficial atribuída aos tenistas e critérios de bônus. As alterações espelham automaticamente no regulamento na Home.
                    </div>
                </div>

                <form id="form-ranking-config">
                    <!-- Pontuação Base -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                        <div class="form-group" style="margin-bottom: 0;">
                            <label class="form-label" style="font-weight: 700; font-size: 12px;">🏆 Pontos Adicionais por Vitória</label>
                            <input type="number" class="form-control" id="cfg-points-winner" min="1" max="500" required style="font-weight: 800; font-size: 16px; color: var(--color-saibro);">
                            <span style="font-size: 10px; color: var(--color-grey-text); display: block; margin-top: 2px;">Adicional somado à participação para o vencedor (+30)</span>
                        </div>

                        <div class="form-group" style="margin-bottom: 0;">
                            <label class="form-label" style="font-weight: 700; font-size: 12px;">🎾 Pontos de Participação</label>
                            <input type="number" class="form-control" id="cfg-points-loser" min="0" max="500" required style="font-weight: 800; font-size: 16px;">
                            <span style="font-size: 10px; color: var(--color-grey-text); display: block; margin-top: 2px;">Concedido a ambos independentemente do resultado (+10)</span>
                        </div>
                    </div>

                    <!-- Bônus e Critérios Extras (Colapsável) -->
                    <details style="background: rgba(0,0,0,0.02); border: 1px solid var(--color-grey-border); border-radius: var(--radius-sm); padding: 10px; margin-bottom: 14px;">
                        <summary style="font-size: 12px; font-weight: 800; color: var(--color-preto); cursor: pointer;">
                            ✨ Bônus Adicionais & Critérios Oficiais
                        </summary>
                        <div style="font-size: 11px; color: var(--color-grey-text); margin: 6px 0 10px 0;">
                            Valores maiores que 0 serão somados aos pontos base do vencedor e espelhados no regulamento oficial.
                        </div>

                        <div style="display: flex; flex-direction: column; gap: 10px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                                <div>
                                    <div style="font-weight: 700; font-size: 12px;">🔥 Vitória com Pneu (8x0 em um set)</div>
                                    <div style="font-size: 10px; color: var(--color-grey-text);">Adversário com 0 games na partida (ex: 8x0) • Padrão +5 pts</div>
                                </div>
                                <input type="number" class="form-control" id="cfg-bonus-bagel" min="0" max="100" style="width: 75px; text-align: center; font-weight: 700;">
                            </div>

                            <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                                <div>
                                    <div style="font-weight: 700; font-size: 12px;">⚔️ Combatividade no Tiebreak</div>
                                    <div style="font-size: 10px; color: var(--color-grey-text);">Bônus ao atleta derrotado no tiebreak decisivo (8x7)</div>
                                </div>
                                <input type="number" class="form-control" id="cfg-bonus-tiebreak" min="0" max="100" style="width: 75px; text-align: center; font-weight: 700;">
                            </div>

                            <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                                <div>
                                    <div style="font-weight: 700; font-size: 12px;">⭐ Vitória Contra Nível Superior</div>
                                    <div style="font-size: 10px; color: var(--color-grey-text);">Underdog bonus: vencedor de nível inferior ao adversário</div>
                                </div>
                                <input type="number" class="form-control" id="cfg-bonus-underdog" min="0" max="100" style="width: 75px; text-align: center; font-weight: 700;">
                            </div>

                            <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                                <div>
                                    <div style="font-weight: 700; font-size: 12px;">🎾 Ponto Extra por Game Vencido</div>
                                    <div style="font-size: 10px; color: var(--color-grey-text);">Cada game conquistado na partida soma X pontos</div>
                                </div>
                                <input type="number" class="form-control" id="cfg-pts-per-game" min="0" max="50" style="width: 75px; text-align: center; font-weight: 700;">
                            </div>
                        </div>
                    </details>

                    <!-- Observações Personalizadas para o Regulamento -->
                    <div class="form-group" style="margin-bottom: 12px;">
                        <label class="form-label" style="font-weight: 700; font-size: 12px;">📝 Observações / Avisos no Regulamento (Opcional)</label>
                        <textarea class="form-control" id="cfg-custom-notes" rows="2" style="font-size: 12px;" placeholder="Ex: Todos os atletas devem registrar o placar no aplicativo logo após o término do set."></textarea>
                    </div>

                    <div id="cfg-status-msg" style="display: none; font-size: 12px; margin-bottom: 10px; font-weight: 700;"></div>

                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        <button type="submit" class="btn btn-primary" id="btn-save-ranking-config" style="font-weight: 800;">
                            💾 Salvar Configurações do Ranking
                        </button>
                        <button type="button" class="btn btn-secondary btn-sm" id="btn-recalc-season-games" style="font-size: 11px; padding: 6px; font-weight: 600;">
                            🔄 Aplicar e Recalcular Pontuações dos Jogos da Temporada Atual
                        </button>
                    </div>
                </form>
            </div>

            <!-- Seção de Lembretes Automáticos de Placar -->
            <div class="card" style="border-left: 5px solid #25d366;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; flex-wrap: wrap;">
                    <div>
                        <span class="card-title" style="color: #128c7e; margin-bottom: 2px;">
                            🔔 Lembretes de Placar Pendente (WhatsApp)
                        </span>
                        <div style="font-size: 11px; color: var(--color-grey-text); line-height: 1.4;">
                            Disparo automático e individual aos 2 atletas envolvidos nas seguintes cadências:<br>
                            • <strong>1º Lembrete:</strong> 15 min após a realização do jogo.<br>
                            • <strong>2º Lembrete:</strong> No dia seguinte (+24h).<br>
                            • <strong>3º Lembrete:</strong> Depois de 4 dias (+96h).
                        </div>
                    </div>
                </div>

                <div id="admin-score-reminders-box" style="margin-top: 14px; background: rgba(0,0,0,0.02); padding: 12px; border-radius: var(--radius-sm); border: 1px dashed var(--color-grey-border);">
                    <p style="text-align: center; color: var(--color-grey-text); font-size: 12px; margin: 0;">Consultando partidas com placar pendente...</p>
                </div>

                <div style="margin-top: 12px; display: flex; gap: 8px; justify-content: flex-end;">
                    <button class="btn btn-primary btn-sm" id="btn-trigger-score-reminders" style="background: #25d366; border-color: #25d366; font-size: 12px; font-weight: 800;">
                        📢 Verificar e Disparar Lembretes Agora
                    </button>
                </div>
            </div>

            <!-- Seção de Lembretes de Inatividade & Engajamento Semanal -->
            <div class="card" style="border-left: 5px solid #0284c7;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; flex-wrap: wrap;">
                    <div>
                        <span class="card-title" style="color: #0284c7; margin-bottom: 2px;">
                            🏃 Lembretes de Inatividade (> 7 dias sem jogar) & Grupo
                        </span>
                        <div style="font-size: 11px; color: var(--color-grey-text); line-height: 1.4;">
                            • <strong>Individual no Privado:</strong> Notifica diretamente pelo WhatsApp atletas sem jogos há mais de 1 semana com link para agendar jogo (cooldown de 7 dias entre envios).<br>
                            • <strong>Chamada Geral no Grupo:</strong> Dispara mensagem motivacional semanal no grupo oficial do ranking da Montreal incentivando a rodada da semana.
                        </div>
                    </div>
                </div>

                <div id="admin-inactivity-reminders-box" style="margin-top: 14px; background: rgba(0,0,0,0.02); padding: 12px; border-radius: var(--radius-sm); border: 1px dashed var(--color-grey-border);">
                    <p style="text-align: center; color: var(--color-grey-text); font-size: 12px; margin: 0;">Consultando atletas sem jogar há mais de 1 semana...</p>
                </div>

                <div style="margin-top: 12px; display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap;">
                    <button class="btn btn-secondary btn-sm" id="btn-trigger-open-games-digest" style="font-size: 12px; font-weight: 700; color: var(--color-saibro); border-color: rgba(192, 81, 49, 0.4); background: white;">
                        🎾 Resumo de Jogos Abertos no Grupo
                    </button>
                    <button class="btn btn-secondary btn-sm" id="btn-trigger-weekly-group" style="font-size: 12px; font-weight: 700; color: #0284c7; border-color: rgba(2, 132, 199, 0.4); background: white;">
                        📢 Chamada da Semana no Grupo
                    </button>
                    <button class="btn btn-primary btn-sm" id="btn-trigger-inactivity-reminders" style="background: #0284c7; border-color: #0284c7; font-size: 12px; font-weight: 800;">
                        👤 Disparar Lembretes Privados
                    </button>
                </div>
            </div>

            <div id="admin-disputes-container">
                <p style="text-align: center; color: var(--color-text-muted); padding: var(--space-md);">Carregando contestações...</p>
            </div>
        </div>
    `;

    // Carrega dados do painel admin
    loadActivatedAthletes(user);
    loadRankingConfig();
    loadScoreReminders();
    loadInactivityReminders();
    loadSystemStats();

    // Listeners da Seção de Atletas
    document.getElementById('btn-refresh-athletes')?.addEventListener('click', async () => {
        const btn = document.getElementById('btn-refresh-athletes');
        btn.disabled = true;
        btn.textContent = 'Carregando...';
        await loadActivatedAthletes(user);
        btn.disabled = false;
        btn.textContent = '🔄 Atualizar Lista';
    });

    document.getElementById('filter-athletes-search')?.addEventListener('input', () => {
        renderFilteredAthletes();
    });

    document.getElementById('filter-athletes-level')?.addEventListener('change', () => {
        renderFilteredAthletes();
    });

    // Listener para Salvar Configurações do Ranking
    document.getElementById('form-ranking-config')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btnSave = document.getElementById('btn-save-ranking-config');
        const statusMsg = document.getElementById('cfg-status-msg');

        const payload = {
            points_winner: parseInt(document.getElementById('cfg-points-winner')?.value || '30', 10),
            points_loser: parseInt(document.getElementById('cfg-points-loser')?.value || '10', 10),
            bonus_bagel_shutout: parseInt(document.getElementById('cfg-bonus-bagel')?.value || '0', 10),
            bonus_tiebreak_loss: parseInt(document.getElementById('cfg-bonus-tiebreak')?.value || '0', 10),
            bonus_underdog_win: parseInt(document.getElementById('cfg-bonus-underdog')?.value || '0', 10),
            points_per_game_won: parseInt(document.getElementById('cfg-pts-per-game')?.value || '0', 10),
            custom_notes: document.getElementById('cfg-custom-notes')?.value || ''
        };

        btnSave.disabled = true;
        btnSave.textContent = "Salvando configurações...";
        statusMsg.style.display = 'none';

        try {
            const res = await callRPC('fn_mt_ranking_salvar_config', {
                p_admin_code: user.customer_code,
                p_config: payload
            });

            statusMsg.textContent = "✅ Configurações salvas com sucesso! As novas regras já estão ativas e refletidas na Home.";
            statusMsg.style.color = "#166534";
            statusMsg.style.display = 'block';
            setTimeout(() => { statusMsg.style.display = 'none'; }, 5000);
        } catch (err) {
            statusMsg.textContent = "❌ Erro ao salvar: " + (err.message || err);
            statusMsg.style.color = "var(--color-danger)";
            statusMsg.style.display = 'block';
        } finally {
            btnSave.disabled = false;
            btnSave.textContent = "💾 Salvar Configurações do Ranking";
        }
    });

    // Listener para Recalcular Pontuações da Temporada Atual
    document.getElementById('btn-recalc-season-games')?.addEventListener('click', async () => {
        const confirmed = confirm(
            "⚠️ ATENÇÃO: Deseja realmente recalcular as pontuações de todos os jogos já realizados na Temporada Atual com base nas regras ativas?\\n\\nIsso atualizará a tabela de classificação e os pontos dos atletas no ranking."
        );
        if (!confirmed) return;

        const btnRecalc = document.getElementById('btn-recalc-season-games');
        btnRecalc.disabled = true;
        btnRecalc.textContent = "🔄 Recalculando pontuações da temporada...";

        try {
            const res = await callRPC('fn_mt_ranking_recalcular_temporada_atual', {
                p_admin_code: user.customer_code
            });

            alert("🏆 " + (res?.message || "Pontuações da temporada recalculadas com sucesso!"));
        } catch (err) {
            alert("Erro ao recalcular pontuações: " + (err.message || err));
        } finally {
            btnRecalc.disabled = false;
            btnRecalc.textContent = "🔄 Aplicar e Recalcular Pontuações dos Jogos da Temporada Atual";
        }
    });

    document.getElementById('btn-trigger-score-reminders')?.addEventListener('click', async () => {
        const btn = document.getElementById('btn-trigger-score-reminders');
        btn.disabled = true;
        btn.textContent = "Processando disparos...";

        try {
            const res = await processPendingScoreReminders();
            if (res.success) {
                if (res.sent_count > 0) {
                    alert(`✅ Sucesso! ${res.sent_count} lembrete(s) de placar enviado(s) via WhatsApp diretamente aos atletas.`);
                } else {
                    alert("Tudo em dia! Nenhuma partida necessita de lembrete neste exato momento.");
                }
            } else {
                alert("Erro ao disparar lembretes: " + (res.error || res.reason));
            }
            await loadScoreReminders();
        } catch (err) {
            alert("Erro: " + err.message);
        } finally {
            btn.disabled = false;
            btn.textContent = "📢 Verificar e Disparar Lembretes Agora";
        }
    });

    document.getElementById('btn-trigger-inactivity-reminders')?.addEventListener('click', async () => {
        const btn = document.getElementById('btn-trigger-inactivity-reminders');
        btn.disabled = true;
        btn.textContent = "Disparando lembretes...";

        try {
            const res = await processInactivityReminders();
            if (res.success) {
                if (res.sent_count > 0) {
                    alert(`✅ Sucesso! ${res.sent_count} lembrete(s) de inatividade enviado(s) via WhatsApp aos atletas.`);
                } else {
                    alert("Tudo em dia! Nenhum atleta inativo pendente de lembrete no momento (ou todos já foram notificados nos últimos 7 dias).");
                }
            } else {
                alert("Erro ao disparar lembretes: " + (res.error || res.reason));
            }
            await loadInactivityReminders();
        } catch (err) {
            alert("Erro: " + err.message);
        } finally {
            btn.disabled = false;
            btn.textContent = "📢 Disparar Lembretes Privados Agora";
        }
    });

    document.getElementById('btn-trigger-weekly-group')?.addEventListener('click', async () => {
        const confirmed = confirm("Deseja enviar a mensagem motivacional da rodada da semana agora no grupo oficial do Ranking Montreal no WhatsApp?");
        if (!confirmed) return;

        const btn = document.getElementById('btn-trigger-weekly-group');
        btn.disabled = true;
        btn.textContent = "Enviando no grupo...";

        try {
            const res = await notifyWeeklyRankingRound();
            if (res.success) {
                alert("🎾 Mensagem motivacional enviada com sucesso no grupo do WhatsApp da Montreal!");
            } else {
                alert("Erro ao enviar mensagem no grupo: " + (res.error || res.reason));
            }
        } catch (err) {
            alert("Erro: " + err.message);
        } finally {
            btn.disabled = false;
            btn.textContent = "📢 Chamada da Semana no Grupo";
        }
    });

    document.getElementById('btn-trigger-open-games-digest')?.addEventListener('click', async () => {
        const confirmed = confirm("Deseja verificar os jogos abertos sem adversário e disparar o resumo no grupo oficial do Ranking no WhatsApp?");
        if (!confirmed) return;

        const btn = document.getElementById('btn-trigger-open-games-digest');
        btn.disabled = true;
        btn.textContent = "Verificando e enviando...";

        try {
            const res = await processOpenGamesDigest(true);
            if (res.success) {
                alert(res.message);
            } else {
                alert("Erro ao disparar resumo no grupo: " + (res.error || res.reason));
            }
        } catch (err) {
            alert("Erro: " + err.message);
        } finally {
            btn.disabled = false;
            btn.textContent = "🎾 Resumo de Jogos Abertos no Grupo";
        }
    });

    try {
        const { data: disputedGames } = await db.from('mt_games').select('*').eq('status', 'disputed');
        const disputesBox = document.getElementById('admin-disputes-container');

        if (!disputedGames || disputedGames.length === 0) {
            disputesBox.innerHTML = `
                <div class="card" style="text-align: center; padding: var(--space-lg);">
                    <span style="font-size: 24px; display: block; margin-bottom: 4px;">✅</span>
                    <p style="font-size: var(--font-size-sm); color: var(--color-text-secondary);">Nenhuma contestação de resultado pendente de revisão.</p>
                </div>
            `;
            return;
        }

        disputesBox.innerHTML = `
            <div class="card">
                <span class="card-title" style="color: var(--color-warning);">⚠️ Contestações Pendentes (${disputedGames.length})</span>
                ${disputedGames.map(game => `
                    <div style="padding: var(--space-sm); border-bottom: 1px solid var(--color-border);">
                        <div><strong>Data:</strong> ${formatDateBR(game.game_date)} às ${game.start_time}</div>
                        <div><strong>Jogo ID:</strong> ${game.id}</div>
                    </div>
                `).join('')}
            </div>
        `;
    } catch (e) {
        console.error("Erro no painel admin:", e);
    }
}

async function loadScoreReminders() {
    const box = document.getElementById('admin-score-reminders-box');
    if (!box) return;

    try {
        const list = await callRPC('fn_mt_game_obter_pendencias_lembrete_placar');
        if (!list || list.length === 0) {
            box.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px; color: #166534; font-size: 12px; font-weight: 700;">
                    <span>✅</span> Nenhuma partida com lembrete pendente no momento.
                </div>
            `;
            return;
        }

        box.innerHTML = `
            <div style="font-size: 12px; font-weight: 800; color: #b45309; margin-bottom: 8px;">
                ⚠️ ${list.length} notificação(ões) de lembrete pronta(s) para disparo:
            </div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
                ${list.map(item => `
                    <div style="background: white; border: 1px solid var(--color-border); border-radius: 6px; padding: 8px 10px; font-size: 11px;">
                        <div style="display: flex; justify-content: space-between; font-weight: 700;">
                            <span>${item.athlete_name} (${item.athlete_phone})</span>
                            <span class="badge badge-warning" style="font-size: 9px;">${item.stage_label}</span>
                        </div>
                        <div style="color: var(--color-grey-text); margin-top: 2px;">
                            Jogo vs ${item.opponent_name} • Data: ${item.game_date} às ${item.start_time}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        const statReminders = document.getElementById('stat-pending-reminders');
        if (statReminders) statReminders.textContent = list ? list.length : 0;
    } catch (err) {
        box.innerHTML = `<span style="color: var(--color-danger); font-size: 11px;">Erro ao carregar lembretes: ${err.message}</span>`;
    }
}

async function loadInactivityReminders() {
    const box = document.getElementById('admin-inactivity-reminders-box');
    if (!box) return;

    try {
        const list = await callRPC('fn_mt_ranking_obter_atletas_inativos_lembrete');
        if (!list || list.length === 0) {
            box.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px; color: #166534; font-size: 12px; font-weight: 700;">
                    <span>✅</span> Todos os atletas estão ativos com partidas recentes ou já receberam lembrete nos últimos 7 dias!
                </div>
            `;
            return;
        }

        box.innerHTML = `
            <div style="font-size: 12px; font-weight: 800; color: #0284c7; margin-bottom: 8px;">
                🏃 ${list.length} atleta(s) elegível(is) para lembrete (> 7 dias sem jogar):
            </div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
                ${list.map(item => `
                    <div style="background: white; border: 1px solid var(--color-border); border-radius: 6px; padding: 8px 10px; font-size: 11px;">
                        <div style="display: flex; justify-content: space-between; font-weight: 700;">
                            <span>${item.athlete_name} (${formatPhone(item.athlete_phone)})</span>
                            <span class="badge badge-level-${item.level_code}" style="font-size: 9px;">Nível ${item.level_code}</span>
                        </div>
                        <div style="color: var(--color-saibro); margin-top: 2px; font-weight: 700;">
                            ⏳ ${item.days_inactive} dias sem jogar • Última atividade: ${formatDateBR(item.last_activity_date)}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    } catch (err) {
        box.innerHTML = `<span style="color: var(--color-danger); font-size: 11px;">Erro ao carregar inativos: ${err.message}</span>`;
    }
}

async function loadSystemStats() {
    try {
        const { count: gamesCount } = await db.from('mt_games').select('id', { count: 'exact', head: true });
        const statGames = document.getElementById('stat-total-games');
        if (statGames) statGames.textContent = gamesCount || 0;
    } catch (e) {
        console.warn('Erro ao carregar contagem de jogos:', e);
    }
}

async function loadActivatedAthletes(user) {
    const listContainer = document.getElementById('admin-athletes-list');
    const badge = document.getElementById('admin-athletes-count-badge');
    const statTotal = document.getElementById('stat-total-athletes');
    if (!listContainer) return;

    try {
        const athletes = await callRPC('fn_mt_admin_listar_atletas_ativados', {
            p_admin_code: user.customer_code
        });

        allActivatedAthletes = athletes || [];
        const count = allActivatedAthletes.length;

        if (badge) {
            badge.textContent = `${count} ${count === 1 ? 'Atleta Ativo' : 'Atletas Ativos'}`;
        }
        if (statTotal) {
            statTotal.textContent = count;
        }

        renderFilteredAthletes();
    } catch (err) {
        console.error('Erro ao listar atletas ativados:', err);
        if (listContainer) {
            listContainer.innerHTML = `<span style="color: var(--color-danger); font-size: 12px;">Erro ao carregar atletas: ${err.message}</span>`;
        }
    }
}

function renderFilteredAthletes() {
    const listContainer = document.getElementById('admin-athletes-list');
    const searchVal = (document.getElementById('filter-athletes-search')?.value || '').toLowerCase().trim();
    const levelVal = document.getElementById('filter-athletes-level')?.value || 'ALL';

    if (!listContainer) return;

    const filtered = allActivatedAthletes.filter(athlete => {
        const matchSearch = !searchVal || 
            (athlete.display_name && athlete.display_name.toLowerCase().includes(searchVal)) ||
            (athlete.official_name && athlete.official_name.toLowerCase().includes(searchVal)) ||
            (athlete.phone && athlete.phone.includes(searchVal)) ||
            (athlete.customer_code && athlete.customer_code.includes(searchVal));
        
        const matchLevel = (levelVal === 'ALL') || (athlete.current_level === levelVal);
        return matchSearch && matchLevel;
    });

    if (filtered.length === 0) {
        listContainer.innerHTML = `
            <div style="text-align: center; padding: 18px; color: var(--color-grey-text); font-size: 12px; background: rgba(0,0,0,0.02); border-radius: 6px; border: 1px dashed var(--color-grey-border);">
                Nenhum atleta encontrado com os filtros informados.
            </div>
        `;
        return;
    }

    listContainer.innerHTML = filtered.map(item => {
        const initials = getInitials(item.display_name || item.official_name || 'MT');
        const formattedPhone = formatPhone(item.phone);
        const cleanDigits = (item.phone || '').replace(/\D/g, '');
        const waNumber = cleanDigits.startsWith('55') ? cleanDigits : ('55' + cleanDigits);
        const hasPhone = cleanDigits.length >= 8;

        const dateObj = item.terms_accepted_at ? new Date(item.terms_accepted_at) : (item.created_at ? new Date(item.created_at) : null);
        let dateFormatted = 'Data n/d';
        if (dateObj && !isNaN(dateObj.getTime())) {
            const datePart = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const timePart = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            dateFormatted = `${datePart} às ${timePart}`;
        }

        const firstName = (item.display_name || 'Atleta').split(' ')[0];
        const waMsg = encodeURIComponent(`Olá ${firstName}, seja bem-vindo(a) ao Ranking do Montreal Tênis Clube!`);

        return `
            <div style="
                background: white;
                border: 1px solid var(--color-grey-border);
                border-radius: var(--radius-sm);
                padding: 10px 12px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
                box-shadow: 0 1px 2px rgba(0,0,0,0.03);
            ">
                <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
                    <div style="
                        width: 40px;
                        height: 40px;
                        border-radius: 50%;
                        background: ${item.is_admin ? 'linear-gradient(135deg, #b91c1c, #ef4444)' : 'linear-gradient(135deg, #c2410c, #ea580c)'};
                        color: white;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-weight: 800;
                        font-size: 13px;
                        flex-shrink: 0;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    ">
                        ${initials}
                    </div>
                    <div style="min-width: 0;">
                        <div style="font-weight: 800; font-size: 13px; color: var(--color-preto); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 6px;">
                            <span>${item.display_name}</span>
                            ${item.is_admin ? '<span class="badge badge-danger" style="font-size: 9px; padding: 1px 5px; font-weight: 800;">Admin</span>' : ''}
                        </div>
                        <div style="font-size: 11px; color: var(--color-grey-text); margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            ${item.official_name && item.official_name !== item.display_name ? `<span>${item.official_name} • </span>` : ''}
                            <span>Entrou em ${dateFormatted}</span>
                        </div>
                    </div>
                </div>

                <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                    <div style="text-align: right;">
                        <div style="display: flex; align-items: center; gap: 4px; justify-content: flex-end;">
                            <span style="font-size: 10px; font-weight: 700; color: var(--color-grey-text);">Nível:</span>
                            <select class="admin-change-level-select" 
                                    data-code="${item.customer_code}" 
                                    data-name="${item.display_name || item.official_name || 'Atleta'}" 
                                    data-current="${item.current_level || 'C'}"
                                    title="Clique para alterar o nível deste atleta"
                                    style="font-size: 11px; font-weight: 800; padding: 2px 6px; border-radius: 6px; border: 1.5px solid var(--color-saibro); background: #ffffff; color: var(--color-saibro); cursor: pointer; outline: none;">
                                <option value="A" ${item.current_level === 'A' ? 'selected' : ''}>Nível A</option>
                                <option value="B" ${item.current_level === 'B' ? 'selected' : ''}>Nível B</option>
                                <option value="C" ${item.current_level === 'C' ? 'selected' : ''}>Nível C</option>
                                <option value="D" ${item.current_level === 'D' ? 'selected' : ''}>Nível D</option>
                            </select>
                        </div>
                        <div style="font-size: 10px; color: var(--color-grey-text); margin-top: 2px;">
                            ${item.gender || 'Masculino'}
                        </div>
                    </div>

                    ${hasPhone ? `
                        <a href="https://wa.me/${waNumber}?text=${waMsg}" target="_blank" rel="noopener noreferrer" 
                           title="Enviar mensagem no WhatsApp (${formattedPhone})"
                           style="
                               display: inline-flex;
                               align-items: center;
                               justify-content: center;
                               width: 32px;
                               height: 32px;
                               background: #25d366;
                               color: white;
                               border-radius: 50%;
                               text-decoration: none;
                               font-size: 15px;
                               box-shadow: 0 1px 3px rgba(0,0,0,0.15);
                               cursor: pointer;
                           ">
                            💬
                        </a>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');

    // Listener para alteração de nível pelo administrador
    listContainer.querySelectorAll('.admin-change-level-select').forEach(selectEl => {
        selectEl.addEventListener('change', async (e) => {
            const targetCode = selectEl.getAttribute('data-code');
            const targetName = selectEl.getAttribute('data-name');
            const prevLevel = selectEl.getAttribute('data-current');
            const newLevel = e.target.value;

            if (newLevel === prevLevel) return;

            const confirmed = confirm(`Deseja alterar o nível de "${targetName}" de Nível ${prevLevel} para Nível ${newLevel} no Ranking?`);
            if (!confirmed) {
                e.target.value = prevLevel;
                return;
            }

            e.target.disabled = true;
            try {
                const currentUser = state.getUser();
                await callRPC('fn_mt_admin_alterar_nivel_atleta', {
                    p_admin_code: currentUser.customer_code,
                    p_target_customer_code: targetCode,
                    p_new_level: newLevel,
                    p_reason: `Ajuste administrativo de nível de ${prevLevel} para ${newLevel}.`
                });

                selectEl.setAttribute('data-current', newLevel);

                // Atualiza no cache em memória
                const athleteObj = allActivatedAthletes.find(a => String(a.customer_code) === String(targetCode));
                if (athleteObj) athleteObj.current_level = newLevel;

                // Se o admin alterou o próprio nível
                if (currentUser && String(currentUser.customer_code) === String(targetCode)) {
                    currentUser.current_level = newLevel;
                    state.setUser(currentUser);
                    const badgeLevel = document.getElementById('header-user-level');
                    if (badgeLevel) badgeLevel.textContent = `Nível ${newLevel}`;
                }

                alert(`Nível de ${targetName} alterado para Nível ${newLevel} com sucesso!`);
                renderFilteredAthletes();
            } catch (err) {
                alert(`Erro ao alterar nível: ${err.message}`);
                e.target.value = prevLevel;
            } finally {
                e.target.disabled = false;
            }
        });
    });
}

async function loadRankingConfig() {
    try {
        const cfg = await callRPC('fn_mt_ranking_obter_config');
        if (!cfg) return;

        const inputWinner = document.getElementById('cfg-points-winner');
        const inputLoser = document.getElementById('cfg-points-loser');
        const inputBagel = document.getElementById('cfg-bonus-bagel');
        const inputTiebreak = document.getElementById('cfg-bonus-tiebreak');
        const inputUnderdog = document.getElementById('cfg-bonus-underdog');
        const inputPtsPerGame = document.getElementById('cfg-pts-per-game');
        const inputNotes = document.getElementById('cfg-custom-notes');

        if (inputWinner) inputWinner.value = cfg.points_winner ?? 30;
        if (inputLoser) inputLoser.value = cfg.points_loser ?? 10;
        if (inputBagel) inputBagel.value = cfg.bonus_bagel_shutout ?? 0;
        if (inputTiebreak) inputTiebreak.value = cfg.bonus_tiebreak_loss ?? 0;
        if (inputUnderdog) inputUnderdog.value = cfg.bonus_underdog_win ?? 0;
        if (inputPtsPerGame) inputPtsPerGame.value = cfg.points_per_game_won ?? 0;
        if (inputNotes) inputNotes.value = cfg.custom_notes || '';
    } catch (e) {
        console.error('Erro ao carregar configuração do ranking:', e);
    }
}


