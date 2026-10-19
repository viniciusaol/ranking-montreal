/* ====================================================================
   MONTREAL TÊNIS CLUBE - TELA DE RANKING POR CATEGORIA (M/F) E NÍVEL (A, B, C, D)
   ==================================================================== */

import { callRPC } from '../supabase.js';
import { state } from '../state.js';
import { getInitials } from '../utils.js?v=1.4.8';

let selectedLevel = 'C';
let selectedGender = 'Masculino';

export async function renderRanking() {
    const container = document.getElementById('view-content');
    const user = state.getUser();

    if (user && user.current_level) {
        selectedLevel = user.current_level;
    }
    if (user && user.gender) {
        selectedGender = user.gender;
    }

    container.innerHTML = `
        <div class="view-container active">
            <h2 style="font-size: var(--font-size-xl); font-weight: 800; margin-bottom: var(--space-xs);">Ranking do Clube</h2>
            <p style="font-size: var(--font-size-xs); color: var(--color-grey-text); margin-bottom: var(--space-md);">
                Classificação atualizada por categoria e nível de jogo.
            </p>

            <!-- Tabs de Categoria / Gênero -->
            <div class="ranking-tabs gender-tabs" style="margin-bottom: var(--space-sm); background: rgba(0,0,0,0.04); border-color: transparent;">
                <button class="tab-btn btn-gender ${selectedGender === 'Masculino' ? 'active' : ''}" data-gender="Masculino">
                    🎾 Masculino
                </button>
                <button class="tab-btn btn-gender ${selectedGender === 'Feminino' ? 'active' : ''}" data-gender="Feminino">
                    🎾 Feminino
                </button>
            </div>

            <!-- Tabs de Níveis -->
            <div class="ranking-tabs level-tabs">
                <button class="tab-btn btn-level ${selectedLevel === 'A' ? 'active' : ''}" data-level="A">Nível A</button>
                <button class="tab-btn btn-level ${selectedLevel === 'B' ? 'active' : ''}" data-level="B">Nível B</button>
                <button class="tab-btn btn-level ${selectedLevel === 'C' ? 'active' : ''}" data-level="C">Nível C</button>
                <button class="tab-btn btn-level ${selectedLevel === 'D' ? 'active' : ''}" data-level="D">Nível D</button>
            </div>

            <!-- Lista do Ranking -->
            <div id="ranking-list-container">
                <p style="text-align: center; color: var(--color-text-muted); padding: var(--space-lg);">Carregando ranking...</p>
            </div>
        </div>
    `;

    // Configura listeners das tabs de gênero
    document.querySelectorAll('.btn-gender').forEach(btn => {
        btn.addEventListener('click', async () => {
            document.querySelectorAll('.btn-gender').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedGender = btn.getAttribute('data-gender');
            await loadRankingList(selectedLevel, selectedGender);
        });
    });

    // Configura listeners das tabs de nível
    document.querySelectorAll('.btn-level').forEach(btn => {
        btn.addEventListener('click', async () => {
            document.querySelectorAll('.btn-level').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedLevel = btn.getAttribute('data-level');
            await loadRankingList(selectedLevel, selectedGender);
        });
    });

    await loadRankingList(selectedLevel, selectedGender);
}

async function loadRankingList(level, gender) {
    const listContainer = document.getElementById('ranking-list-container');
    if (!listContainer) return;

    try {
        const user = state.getUser();
        const ranking = await callRPC('fn_mt_game_obter_ranking', { 
            p_level_code: level,
            p_gender: gender 
        }) || [];

        if (ranking.length === 0) {
            listContainer.innerHTML = `
                <div class="card" style="text-align: center; padding: var(--space-xl);">
                    <p style="color: var(--color-text-secondary); font-size: var(--font-size-sm);">
                        Nenhum jogador ranqueado na categoria <strong>${gender}</strong> • <strong>Nível ${level}</strong> ainda.
                    </p>
                </div>
            `;
            return;
        }

        listContainer.innerHTML = `
            <div class="ranking-list">
                ${ranking.map((item, idx) => {
                    const isMe = user && user.customer_code === item.customer_code;
                    return `
                        <div class="ranking-card" style="${isMe ? 'border: 2px solid var(--color-saibro); background-color: rgba(192, 81, 49, 0.04);' : ''}">
                            <div class="ranking-pos">#${item.rank_position || (idx + 1)}</div>
                            <div class="ranking-avatar">${getInitials(item.display_name)}</div>
                            <div class="ranking-info">
                                <div class="ranking-name" style="${isMe ? 'color: var(--color-saibro); font-weight: 800;' : ''}">
                                    ${item.display_name} ${isMe ? '<span style="font-size: 10px; font-weight: 800; background: var(--color-saibro); color: #fff; padding: 1px 6px; border-radius: 4px; vertical-align: middle; margin-left: 4px;">VOCÊ</span>' : ''}
                                    ${item.current_level && item.current_level !== level ? `<span class="badge" style="font-size: 10px; padding: 2px 6px; margin-left: 4px; background: rgba(192, 81, 49, 0.12); color: var(--color-saibro); font-weight: 800; border: 1px solid rgba(192, 81, 49, 0.3);">Desafiante (Nível ${item.current_level})</span>` : ''}
                                </div>
                                <div class="ranking-stats">
                                    <span>${item.total_games} jogos</span> • 
                                    <span style="color: var(--color-success);">${item.total_wins}V</span> • 
                                    <span style="color: var(--color-danger);">${item.total_losses}D</span>
                                </div>
                            </div>
                            <div class="ranking-points">${item.total_points} pts</div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    } catch (e) {
        console.error("Erro ao carregar ranking:", e);
        listContainer.innerHTML = `<p style="color: var(--color-danger); text-align: center;">Erro ao carregar dados do ranking.</p>`;
    }
}
