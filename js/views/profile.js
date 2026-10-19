/* ====================================================================
   MONTREAL TÊNIS CLUBE - PERFIL ESPORTIVO E CONFIGURAÇÕES
   ==================================================================== */

import { state } from '../state.js';
import { callRPC } from '../supabase.js';
import { logout } from '../auth.js';
import { formatPhone, getInitials } from '../utils.js?v=1.4.8';
import { CONFIG } from '../config.js';

export async function renderProfile() {
    const container = document.getElementById('view-content');
    const user = state.getUser();

    if (!user) return;

    container.innerHTML = `
        <div class="view-container active">
            <h2 style="font-size: var(--font-size-xl); font-weight: 800; margin-bottom: var(--space-md);">Meu Perfil Esportivo</h2>

            <!-- Card Principal -->
            <div class="card" style="text-align: center; padding: var(--space-lg) var(--space-md);">
                <div class="ranking-avatar" style="width: 72px; height: 72px; font-size: 28px; margin: 0 auto var(--space-sm) auto;">
                    ${getInitials(user.display_name)}
                </div>
                <h3 style="font-size: var(--font-size-lg); font-weight: 800;">${user.display_name}</h3>
                <p style="font-size: var(--font-size-xs); color: var(--color-text-secondary); margin-bottom: var(--space-sm);">
                    ${formatPhone(user.phone)}
                </p>

                <div style="display: flex; justify-content: center; gap: var(--space-xs); margin-bottom: var(--space-md); flex-wrap: wrap;">
                    <span class="badge badge-level-${user.current_level}">Nível ${user.current_level}</span>
                    <span class="badge" style="background: rgba(0,0,0,0.06); color: var(--color-preto); font-weight: 700;">🎾 ${user.gender || 'Masculino'}</span>
                    <span class="badge badge-success">Ranking #${user.rank_position}</span>
                    ${user.is_admin ? `<span class="badge badge-danger">Admin</span>` : ''}
                </div>

                <div style="display: flex; justify-content: space-around; background-color: var(--color-bg-input); padding: var(--space-sm); border-radius: var(--radius-md); border: 1px solid var(--color-border);">
                    <div>
                        <span style="font-size: var(--font-size-lg); font-weight: 800; color: var(--color-primary-yellow);">${user.total_points}</span>
                        <span style="display: block; font-size: 11px; color: var(--color-text-muted);">Pontos</span>
                    </div>
                    <div>
                        <span style="font-size: var(--font-size-lg); font-weight: 800; color: var(--color-text-primary);">${user.total_games}</span>
                        <span style="display: block; font-size: 11px; color: var(--color-text-muted);">Jogos</span>
                    </div>
                    <div>
                        <span style="font-size: var(--font-size-lg); font-weight: 800; color: var(--color-success);">${user.total_wins}</span>
                        <span style="display: block; font-size: 11px; color: var(--color-text-muted);">Vitórias</span>
                    </div>
                </div>
            </div>

            <!-- Editar Dados Esportivos -->
            <div class="card">
                <span class="card-title" style="font-size: var(--font-size-base);">⚙️ Configurações Esportivas</span>
                <div class="form-group">
                    <label class="form-label">Seu Nível Atual</label>
                    <select class="form-control" id="profile-level">
                        <option value="A" ${user.current_level === 'A' ? 'selected' : ''}>Nível A (Avançado/Competitivo)</option>
                        <option value="B" ${user.current_level === 'B' ? 'selected' : ''}>Nível B (Avançado/Intermediário)</option>
                        <option value="C" ${user.current_level === 'C' ? 'selected' : ''}>Nível C (Intermediário)</option>
                        <option value="D" ${user.current_level === 'D' ? 'selected' : ''}>Nível D (Iniciante)</option>
                    </select>
                </div>

                <div id="level-desc-box" style="font-size: var(--font-size-xs); color: var(--color-text-secondary); background-color: var(--color-bg-input); padding: var(--space-sm); border-radius: var(--radius-sm); margin-bottom: var(--space-md);">
                    ${CONFIG.LEVEL_DESCRIPTIONS[user.current_level]}
                </div>

                <div class="form-group">
                    <label class="form-label">Categoria de Ranking (Gênero)</label>
                    <select class="form-control" id="profile-gender">
                        <option value="Masculino" ${user.gender !== 'Feminino' ? 'selected' : ''}>🎾 Masculino</option>
                        <option value="Feminino" ${user.gender === 'Feminino' ? 'selected' : ''}>🎾 Feminino</option>
                    </select>
                </div>

                <button class="btn btn-primary btn-sm" id="btn-save-profile-settings">
                    Salvar Alterações
                </button>
            </div>

            <!-- Sair -->
            <button class="btn btn-danger" id="btn-logout" style="margin-top: var(--space-md);">
                🚪 Sair da Minha Conta
            </button>
        </div>
    `;

    document.getElementById('profile-level')?.addEventListener('change', (e) => {
        const selected = e.target.value;
        const box = document.getElementById('level-desc-box');
        if (box) box.textContent = CONFIG.LEVEL_DESCRIPTIONS[selected] || '';
    });

    document.getElementById('btn-save-profile-settings')?.addEventListener('click', async () => {
        const newLevel = document.getElementById('profile-level').value;
        const newGender = document.getElementById('profile-gender').value;
        const btn = document.getElementById('btn-save-profile-settings');
        btn.disabled = true;
        btn.textContent = "Salvando...";

        try {
            await callRPC('fn_mt_game_salvar_perfil', {
                p_customer_code: user.customer_code,
                p_display_name: user.display_name,
                p_level: newLevel,
                p_gender: newGender
            });
            user.current_level = newLevel;
            user.gender = newGender;
            state.setUser(user);
            alert("Perfil esportivo atualizado com sucesso!");
            renderProfile();
        } catch (e) {
            alert("Erro ao atualizar dados: " + e.message);
        } finally {
            btn.disabled = false;
            btn.textContent = "Salvar Alterações";
        }
    });

    document.getElementById('btn-logout')?.addEventListener('click', () => {
        logout();
        window.location.reload();
    });
}
