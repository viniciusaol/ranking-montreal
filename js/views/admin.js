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
                    Gerencie contestações, moderação e disparos automáticos de notificações do ranking.
                </p>
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

    // Carrega pendências de lembrete de placar
    loadScoreReminders();

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

