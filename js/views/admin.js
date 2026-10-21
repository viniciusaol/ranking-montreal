import { state } from '../state.js';
import { db, callRPC } from '../supabase.js';
import { formatDateBR } from '../utils.js?v=1.4.8';
import { processPendingScoreReminders } from '../notifications.js?v=1.7.0';

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
                <p style="font-size: var(--font-size-sm); color: var(--color-text-secondary);">
                    Gerencie contestações, moderação, regras do ranking e disparos automáticos de notificações.
                </p>
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
                            <label class="form-label" style="font-weight: 700; font-size: 12px;">🏆 Pontos por Vitória</label>
                            <input type="number" class="form-control" id="cfg-points-winner" min="1" max="500" required style="font-weight: 800; font-size: 16px; color: var(--color-saibro);">
                            <span style="font-size: 10px; color: var(--color-grey-text); display: block; margin-top: 2px;">Pontos concedidos ao ganhador</span>
                        </div>

                        <div class="form-group" style="margin-bottom: 0;">
                            <label class="form-label" style="font-weight: 700; font-size: 12px;">🎾 Pontos Participação / Derrota</label>
                            <input type="number" class="form-control" id="cfg-points-loser" min="0" max="500" required style="font-weight: 800; font-size: 16px;">
                            <span style="font-size: 10px; color: var(--color-grey-text); display: block; margin-top: 2px;">Pontos concedidos ao perdedor</span>
                        </div>
                    </div>

                    <!-- Bônus e Critérios Extras (Colapsável) -->
                    <details style="background: rgba(0,0,0,0.02); border: 1px solid var(--color-grey-border); border-radius: var(--radius-sm); padding: 10px; margin-bottom: 14px;">
                        <summary style="font-size: 12px; font-weight: 800; color: var(--color-preto); cursor: pointer;">
                            ✨ Bônus Adicionais & Critérios Extras (Opcionais)
                        </summary>
                        <div style="font-size: 11px; color: var(--color-grey-text); margin: 6px 0 10px 0;">
                            Deixe em <strong>0</strong> caso queira manter o critério desativado. Valores maiores que 0 serão somados aos pontos base e exibidos no regulamento.
                        </div>

                        <div style="display: flex; flex-direction: column; gap: 10px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                                <div>
                                    <div style="font-weight: 700; font-size: 12px;">🔥 Vitória Dominante / Pneu</div>
                                    <div style="font-size: 10px; color: var(--color-grey-text);">Adversário com 2 ou menos games (ex: 8x0, 8x1, 8x2)</div>
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

            <div id="admin-disputes-container">
                <p style="text-align: center; color: var(--color-text-muted); padding: var(--space-md);">Carregando contestações...</p>
            </div>
        </div>
    `;

    // Carrega configurações do ranking e pendências de lembrete de placar
    loadRankingConfig();
    loadScoreReminders();

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
    } catch (err) {
        box.innerHTML = `<span style="color: var(--color-danger); font-size: 11px;">Erro ao carregar lembretes: ${err.message}</span>`;
    }
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


