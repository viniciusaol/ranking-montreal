/* ====================================================================
   MONTREAL TÊNIS CLUBE - PERFIL ESPORTIVO E CONFIGURAÇÕES
   ==================================================================== */

import { state } from '../state.js';
import { callRPC } from '../supabase.js';
import { logout } from '../auth.js';
import { formatPhone, getInitials, getCurrentSeasonYear, isRetrospectiveAvailable, getLatestAvailableRetrospectiveYear } from '../utils.js?v=1.6.5';
import { CONFIG } from '../config.js';

export async function renderProfile() {
    const container = document.getElementById('view-content');
    const user = state.getUser();

    if (!user) return;

    const seasonYear = getCurrentSeasonYear();
    const isRetroOpen = isRetrospectiveAvailable(seasonYear);
    const targetRetroYear = isRetroOpen ? seasonYear : getLatestAvailableRetrospectiveYear();

    container.innerHTML = `
        <div class="view-container active">
            <h2 style="font-size: var(--font-size-xl); font-weight: 800; margin-bottom: var(--space-md);">Meu Perfil Esportivo</h2>

            <!-- Card Principal -->
            <div class="card" style="text-align: center; padding: var(--space-lg) var(--space-md);">
                <div class="ranking-avatar" style="width: 72px; height: 72px; font-size: 28px; margin: 0 auto var(--space-sm) auto;">
                    ${getInitials(user.display_name)}
                </div>
                <h3 style="font-size: var(--font-size-lg); font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 6px;">
                    <span>${user.display_name}</span>
                    <button type="button" onclick="document.getElementById('profile-display-name')?.focus(); document.getElementById('profile-edit-section')?.scrollIntoView({ behavior: 'smooth' });" style="background: none; border: none; font-size: 15px; cursor: pointer; opacity: 0.7; padding: 2px 4px;" title="Editar Nome">✏️</button>
                </h3>
                <p style="font-size: var(--font-size-xs); color: var(--color-text-secondary); margin-bottom: var(--space-sm);">
                    ${formatPhone(user.phone)}
                </p>

                <div style="display: flex; justify-content: center; gap: var(--space-xs); margin-bottom: var(--space-md); flex-wrap: wrap;">
                    <span class="badge badge-level-${user.current_level}">Nível ${user.current_level}</span>
                    <span class="badge" style="background: rgba(0,0,0,0.06); color: var(--color-preto); font-weight: 700;">🎾 ${user.gender || 'Masculino'}</span>
                    <span class="badge badge-success">Ranking #${user.rank_position || 1} (Temporada ${seasonYear})</span>
                    ${user.is_admin ? `<span class="badge badge-danger">Admin</span>` : ''}
                </div>

                <!-- Estatísticas e Pontuação Oficial -->
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; background-color: var(--color-bg-input); padding: var(--space-sm); border-radius: var(--radius-md); border: 1px solid var(--color-border); text-align: center;">
                    <div>
                        <span style="font-size: 16px; font-weight: 900; color: var(--color-saibro); display: block;">${Math.round(Number(user.total_points) || 0)}</span>
                        <span style="display: block; font-size: 10px; color: var(--color-saibro); font-weight: 700;">Pts Ranking</span>
                    </div>
                    <div>
                        <span style="font-size: 16px; font-weight: 900; color: #0284c7; display: block;">${Number(user.win_rate) || 0}%</span>
                        <span style="display: block; font-size: 10px; color: var(--color-grey-text);">Aproveit.</span>
                    </div>
                    <div>
                        <span style="font-size: 16px; font-weight: 900; color: var(--color-preto); display: block;">${Number(user.accumulated_points) || 0}</span>
                        <span style="display: block; font-size: 10px; color: var(--color-grey-text);">Pts Acum.</span>
                    </div>
                    <div id="btn-profile-games-stat" style="cursor: pointer;" title="Ver Meus Jogos">
                        <span style="font-size: 16px; font-weight: 900; color: var(--color-success); display: block;">${user.total_wins || 0}V <span style="font-size: 12px; color: var(--color-grey-text);">/ ${user.total_games || 0}J</span></span>
                        <span style="display: block; font-size: 10px; color: var(--color-success); font-weight: 700;">Vitórias →</span>
                    </div>
                </div>

                ${Number(user.inactivity_penalty_pct) > 0 ? `
                    <div style="margin-top: 10px; background: #fef2f2; border: 1px solid #fecaca; border-radius: var(--radius-sm); padding: 8px 10px; font-size: 11px; color: #991b1b; text-align: left; line-height: 1.4;">
                        ⚠️ <strong>Penalização por Inatividade (-${user.inactivity_penalty_pct}%):</strong> Você está há <strong>${user.days_inactive} dias</strong> sem disputar uma partida oficial. Jogue uma nova partida para reiniciar o prazo de inatividade!
                    </div>
                ` : ''}
            </div>

            <!-- Card de Destaque: Retrospectiva do Ano & Story Instagram -->
            <div class="card" id="btn-profile-retro" style="
                background: ${isRetroOpen ? 'linear-gradient(135deg, #18120f 0%, #29140c 100%)' : 'rgba(0, 0, 0, 0.03)'};
                border: 1.5px ${isRetroOpen ? 'solid #f59e0b' : 'dashed var(--color-grey-border)'};
                border-radius: var(--radius-md);
                padding: 14px 16px;
                margin-bottom: var(--space-md);
                box-shadow: ${isRetroOpen ? '0 4px 14px rgba(0,0,0,0.15)' : 'none'};
                display: flex;
                align-items: center;
                justify-content: space-between;
                cursor: pointer;
            " onclick="window.location.hash='#/retrospectiva/${targetRetroYear}'">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="font-size: 24px; background: ${isRetroOpen ? 'rgba(245, 158, 11, 0.2)' : 'rgba(0, 0, 0, 0.05)'}; width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 1.5px solid ${isRetroOpen ? '#f59e0b' : 'var(--color-grey-border)'}; flex-shrink: 0;">
                        ${isRetroOpen ? '📸' : '🔒'}
                    </div>
                    <div>
                        <div style="font-weight: 800; font-size: 14px; color: ${isRetroOpen ? '#ffffff' : 'var(--color-preto)'}; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                            <span>${isRetroOpen ? `Meu Resumo ${seasonYear}` : `Retrospectiva ${seasonYear}`}</span>
                            <span style="font-size: 9px; font-weight: 800; background: ${isRetroOpen ? 'linear-gradient(135deg, #E1306C, #C13584)' : '#fef3c7'}; color: ${isRetroOpen ? 'white' : '#b45309'}; padding: 2px 6px; border-radius: 4px; ${isRetroOpen ? '' : 'border: 1px solid #fde68a;'}">
                                ${isRetroOpen ? 'STORY INSTAGRAM' : 'LIBERA EM 01/12'}
                            </span>
                        </div>
                        <div style="font-size: 12px; color: ${isRetroOpen ? '#cbd5e1' : 'var(--color-grey-text)'}; margin-top: 2px;">
                            ${isRetroOpen 
                                ? 'Gere seu Story estilo Spotify Wrapped com suas vitórias e compartilhe!' 
                                : `A temporada fecha em 30/11. Acesse retrospectivas anteriores ou confira as datas!`}
                        </div>
                    </div>
                </div>
                <span style="font-size: 18px; color: ${isRetroOpen ? '#f59e0b' : 'var(--color-grey-text)'}; font-weight: 800; flex-shrink: 0;">${isRetroOpen ? '→' : '🔒'}</span>
            </div>

            <!-- Painel Administrativo Exclusivo (Admin) -->
            ${user.is_admin ? `
                <div class="card" style="
                    background: rgba(220, 38, 38, 0.05);
                    border: 1.5px solid rgba(220, 38, 38, 0.25);
                    border-radius: var(--radius-md);
                    padding: 14px 16px;
                    margin-bottom: var(--space-md);
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    cursor: pointer;
                " onclick="window.location.hash='#/admin'">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="font-size: 22px; background: rgba(220, 38, 38, 0.1); width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                            👑
                        </div>
                        <div>
                            <div style="font-weight: 800; font-size: 14px; color: #991b1b; display: flex; align-items: center; gap: 6px;">
                                Painel do Administrador
                                <span style="font-size: 9px; font-weight: 800; background: #fee2e2; color: #991b1b; padding: 2px 6px; border-radius: 4px;">ACESSO VIP</span>
                            </div>
                            <div style="font-size: 12px; color: var(--color-grey-text); margin-top: 2px;">
                                Moderação de contestações, gestão e controle do clube
                            </div>
                        </div>
                    </div>
                    <span style="font-size: 18px; color: #dc2626; font-weight: 800; flex-shrink: 0;">→</span>
                </div>
            ` : ''}

            <!-- Atalho Meus Jogos Exclusivos -->
            <div class="card" id="btn-profile-my-games" style="cursor: pointer; display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-left: 5px solid var(--color-saibro); margin-bottom: var(--space-md); transition: transform 0.15s ease;" onclick="window.location.hash='#/jogos'">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="font-size: 24px; background: rgba(192, 81, 49, 0.1); width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">🎾</div>
                    <div>
                        <div style="font-weight: 800; font-size: 14px; color: var(--color-preto);">Minhas Partidas & Histórico</div>
                        <div style="font-size: 12px; color: var(--color-grey-text);">Ver apenas os jogos em que você está envolvido (agendados e histórico)</div>
                    </div>
                </div>
                <span style="font-size: 18px; color: var(--color-saibro); font-weight: 800;">→</span>
            </div>

            <!-- Editar Dados do Perfil e Nível Esportivo -->
            <div class="card" id="profile-edit-section">
                <span class="card-title" style="font-size: var(--font-size-base);">⚙️ Editar Dados do Perfil</span>

                <div class="form-group" style="text-align: left;">
                    <label class="form-label">Nome Exibido no Ranking</label>
                    <input type="text" class="form-control" id="profile-display-name" value="${user.display_name || user.name || ''}" placeholder="Seu nome no ranking" maxlength="50" required>
                    <span style="font-size: 11px; color: var(--color-grey-text); display: block; margin-top: 4px;">
                        Nome visível para outros atletas no ranking, convites de jogos e histórico.
                    </span>
                </div>

                <div class="form-group" style="text-align: left;">
                    <label class="form-label">Seu Nível Atual</label>
                    <select class="form-control" id="profile-level">
                        <option value="A" ${user.current_level === 'A' ? 'selected' : ''}>Nível A (Avançado/Competitivo)</option>
                        <option value="B" ${user.current_level === 'B' ? 'selected' : ''}>Nível B (Avançado/Intermediário)</option>
                        <option value="C" ${user.current_level === 'C' ? 'selected' : ''}>Nível C (Intermediário)</option>
                        <option value="D" ${user.current_level === 'D' ? 'selected' : ''}>Nível D (Iniciante)</option>
                    </select>
                </div>

                <div id="level-desc-box" style="font-size: var(--font-size-xs); color: var(--color-text-secondary); background-color: var(--color-bg-input); padding: var(--space-sm); border-radius: var(--radius-sm); margin-bottom: var(--space-md); text-align: left;">
                    ${CONFIG.LEVEL_DESCRIPTIONS[user.current_level]}
                </div>

                <div class="form-group" style="text-align: left;">
                    <label class="form-label">Categoria de Ranking (Gênero)</label>
                    <select class="form-control" id="profile-gender">
                        <option value="Masculino" ${user.gender !== 'Feminino' ? 'selected' : ''}>🎾 Masculino</option>
                        <option value="Feminino" ${user.gender === 'Feminino' ? 'selected' : ''}>🎾 Feminino</option>
                    </select>
                </div>

                <button class="btn btn-primary" id="btn-save-profile-settings" style="width: 100%;">
                    Salvar Alterações
                </button>
            </div>

            <!-- Sair -->
            <button class="btn btn-danger" id="btn-logout" style="margin-top: var(--space-md);">
                🚪 Sair da Minha Conta
            </button>
        </div>
    `;

    document.getElementById('btn-profile-games-stat')?.addEventListener('click', () => {
        window.location.hash = '#/jogos';
    });

    document.getElementById('profile-level')?.addEventListener('change', (e) => {
        const selected = e.target.value;
        const box = document.getElementById('level-desc-box');
        if (box) box.textContent = CONFIG.LEVEL_DESCRIPTIONS[selected] || '';
    });

    document.getElementById('btn-save-profile-settings')?.addEventListener('click', async () => {
        const inputName = document.getElementById('profile-display-name');
        const newName = (inputName?.value || '').trim();
        const newLevel = document.getElementById('profile-level').value;
        const newGender = document.getElementById('profile-gender').value;

        if (!newName || newName.length < 3) {
            alert("Por favor, digite um nome de exibição válido (mínimo de 3 caracteres).");
            inputName?.focus();
            return;
        }

        const btn = document.getElementById('btn-save-profile-settings');
        btn.disabled = true;
        btn.textContent = "Salvando alterações...";

        try {
            await callRPC('fn_mt_game_salvar_perfil', {
                p_customer_code: user.customer_code,
                p_display_name: newName,
                p_level: newLevel,
                p_gender: newGender
            });
            user.display_name = newName;
            user.current_level = newLevel;
            user.gender = newGender;
            state.setUser(user);

            // Atualiza o header superior dinamicamente
            const badgeName = document.getElementById('header-user-name');
            const badgeLevel = document.getElementById('header-user-level');
            if (badgeName) badgeName.textContent = newName.split(' ')[0];
            if (badgeLevel) badgeLevel.textContent = `Nível ${newLevel}`;

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
