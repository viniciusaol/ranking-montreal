/* ====================================================================
   MONTREAL TÊNIS CLUBE - PAINEL ADMINISTRATIVO (ADMIN VIEW)
   ==================================================================== */

import { state } from '../state.js';
import { db } from '../supabase.js';
import { formatDateBR } from '../utils.js?v=1.4.8';

export async function renderAdmin() {
    const container = document.getElementById('view-content');
    const user = state.getUser();

    if (!user || !user.is_admin) {
        container.innerHTML = `<p style="color: var(--color-danger); text-align: center; padding: var(--space-xl);">Acesso restrito a administradores da Montreal.</p>`;
        return;
    }

    container.innerHTML = `
        <div class="view-container active">
            <h2 style="font-size: var(--font-size-xl); font-weight: 800; margin-bottom: var(--space-md);">Painel Administrativo</h2>

            <div class="card">
                <span class="card-title">📊 Resumo do Sistema</span>
                <p style="font-size: var(--font-size-sm); color: var(--color-text-secondary);">
                    Gerencie elegibilidade, jogos e contestações de resultados.
                </p>
            </div>

            <div id="admin-disputes-container">
                <p style="text-align: center; color: var(--color-text-muted); padding: var(--space-md);">Carregando contestações...</p>
            </div>
        </div>
    `;

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
