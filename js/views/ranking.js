/* ====================================================================
   MONTREAL TÊNIS CLUBE - TELA DE RANKING POR TEMPORADA (ANUAL), CATEGORIA E NÍVEL
   ==================================================================== */

import { callRPC } from '../supabase.js';
import { state } from '../state.js';
import { getInitials } from '../utils.js?v=1.4.8';

const currentYear = new Date().getFullYear();
let selectedYear = currentYear;
let selectedLevel = 'C';
let selectedGender = 'Masculino';
let availableSeasons = [];

export async function renderRanking() {
    const container = document.getElementById('view-content');
    const user = state.getUser();

    if (user && user.current_level) {
        selectedLevel = user.current_level;
    }
    if (user && user.gender) {
        selectedGender = user.gender;
    }

    // Busca as temporadas disponíveis via RPC
    try {
        const seasons = await callRPC('fn_mt_game_obter_temporadas') || [];
        if (seasons.length > 0) {
            availableSeasons = seasons;
        } else {
            availableSeasons = [
                { season_year: currentYear, is_current: true, total_games: 0 },
                { season_year: currentYear - 1, is_current: false, total_games: 0 }
            ];
        }
    } catch (e) {
        console.warn("Erro ao buscar temporadas do ranking:", e);
        availableSeasons = [
            { season_year: currentYear, is_current: true, total_games: 0 },
            { season_year: currentYear - 1, is_current: false, total_games: 0 }
        ];
    }

    // Garante que o ano selecionado existe nas temporadas
    if (!availableSeasons.some(s => s.season_year === selectedYear)) {
        selectedYear = availableSeasons[0].season_year;
    }

    const isCurrentSeason = (selectedYear === currentYear);

    container.innerHTML = `
        <div class="view-container active">
            <!-- Header com Título e Seletor de Temporada Anual -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-xs); flex-wrap: wrap; gap: 8px;">
                <div>
                    <h2 style="font-size: var(--font-size-xl); font-weight: 800; color: var(--color-preto); margin-bottom: 2px;">
                        Ranking do Clube
                    </h2>
                    <p style="font-size: var(--font-size-xs); color: var(--color-grey-text);">
                        Classificação oficial por temporada anual e categoria.
                    </p>
                </div>
                
                <!-- Seletor de Temporada / Ano -->
                <div style="display: flex; align-items: center; gap: 6px; background: #ffffff; padding: 4px 10px; border-radius: var(--radius-md); border: 1.5px solid var(--color-saibro); box-shadow: 0 1px 4px rgba(0,0,0,0.06);">
                    <span style="font-size: 13px;">📅</span>
                    <select id="select-ranking-season" style="border: none; background: transparent; font-size: 13px; font-weight: 800; color: var(--color-saibro); cursor: pointer; outline: none;">
                        ${availableSeasons.map(s => `
                            <option value="${s.season_year}" ${s.season_year === selectedYear ? 'selected' : ''}>
                                Temporada ${s.season_year} ${s.is_current ? '(Atual)' : '(Histórico)'}
                            </option>
                        `).join('')}
                    </select>
                </div>
            </div>

            <!-- Banner Informativo do Ciclo da Temporada -->
            <div id="season-status-banner" style="margin-bottom: var(--space-md);">
                ${isCurrentSeason ? `
                    <div style="font-size: 11px; font-weight: 700; color: #15803d; background: rgba(34, 197, 94, 0.08); border: 1px solid rgba(34, 197, 94, 0.25); padding: 7px 12px; border-radius: var(--radius-sm); display: flex; align-items: center; gap: 6px; line-height: 1.4;">
                        <span>⚡</span> <span><strong>Temporada ${selectedYear} em andamento:</strong> pontuações válidas até 31/12/${selectedYear}. A cada virada de ano, inicia-se um novo ranking zerado!</span>
                    </div>
                ` : `
                    <div style="font-size: 11px; font-weight: 700; color: #b45309; background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.3); padding: 7px 12px; border-radius: var(--radius-sm); display: flex; align-items: center; gap: 6px; line-height: 1.4;">
                        <span>🏛️</span> <span><strong>Temporada Histórica de ${selectedYear} (Encerrada):</strong> Classificação final e campeões consolidados do ano.</span>
                    </div>
                `}
            </div>

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
                <p style="text-align: center; color: var(--color-grey-text); padding: var(--space-lg);">Carregando ranking da temporada...</p>
            </div>
        </div>
    `;

    // Configura listener da seleção de temporada
    document.getElementById('select-ranking-season')?.addEventListener('change', async (e) => {
        selectedYear = parseInt(e.target.value, 10);
        
        const bannerContainer = document.getElementById('season-status-banner');
        const isCurrent = (selectedYear === currentYear);
        if (bannerContainer) {
            bannerContainer.innerHTML = isCurrent ? `
                <div style="font-size: 11px; font-weight: 700; color: #15803d; background: rgba(34, 197, 94, 0.08); border: 1px solid rgba(34, 197, 94, 0.25); padding: 7px 12px; border-radius: var(--radius-sm); display: flex; align-items: center; gap: 6px; line-height: 1.4;">
                    <span>⚡</span> <span><strong>Temporada ${selectedYear} em andamento:</strong> pontuações válidas até 31/12/${selectedYear}. A cada virada de ano, inicia-se um novo ranking zerado!</span>
                </div>
            ` : `
                <div style="font-size: 11px; font-weight: 700; color: #b45309; background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.3); padding: 7px 12px; border-radius: var(--radius-sm); display: flex; align-items: center; gap: 6px; line-height: 1.4;">
                    <span>🏛️</span> <span><strong>Temporada Histórica de ${selectedYear} (Encerrada):</strong> Classificação final e campeões consolidados do ano.</span>
                </div>
            `;
        }

        await loadRankingList(selectedLevel, selectedGender, selectedYear);
    });

    // Configura listeners das tabs de gênero
    document.querySelectorAll('.btn-gender').forEach(btn => {
        btn.addEventListener('click', async () => {
            document.querySelectorAll('.btn-gender').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedGender = btn.getAttribute('data-gender');
            await loadRankingList(selectedLevel, selectedGender, selectedYear);
        });
    });

    // Configura listeners das tabs de nível
    document.querySelectorAll('.btn-level').forEach(btn => {
        btn.addEventListener('click', async () => {
            document.querySelectorAll('.btn-level').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedLevel = btn.getAttribute('data-level');
            await loadRankingList(selectedLevel, selectedGender, selectedYear);
        });
    });

    await loadRankingList(selectedLevel, selectedGender, selectedYear);
}

async function loadRankingList(level, gender, year) {
    const listContainer = document.getElementById('ranking-list-container');
    if (!listContainer) return;

    listContainer.innerHTML = `<p style="text-align: center; color: var(--color-grey-text); padding: var(--space-lg);">Carregando ranking da temporada ${year}...</p>`;

    try {
        const user = state.getUser();
        const isCurrentSeason = (year === currentYear);

        const ranking = await callRPC('fn_mt_game_obter_ranking', { 
            p_level_code: level,
            p_gender: gender,
            p_year: year 
        }) || [];

        if (ranking.length === 0) {
            listContainer.innerHTML = `
                <div class="card" style="text-align: center; padding: var(--space-xl);">
                    <div style="font-size: 32px; margin-bottom: 8px;">📋</div>
                    <p style="color: var(--color-preto); font-weight: 700; font-size: var(--font-size-base); margin-bottom: 4px;">
                        Nenhum registro na Temporada de ${year}
                    </p>
                    <p style="color: var(--color-grey-text); font-size: var(--font-size-xs); line-height: 1.4;">
                        ${isCurrentSeason 
                            ? `Nenhum jogador pontuou na categoria <strong>${gender} • Nível ${level}</strong> em ${year} ainda. Crie ou aceite um desafio para ser o primeiro a pontuar!`
                            : `Não há partidas registradas na categoria <strong>${gender} • Nível ${level}</strong> no histórico de ${year}.`
                        }
                    </p>
                </div>
            `;
            return;
        }

        listContainer.innerHTML = `
            <div class="ranking-list">
                ${ranking.map((item, idx) => {
                    const isMe = user && String(user.customer_code).trim() === String(item.customer_code).trim();
                    const isChampion = !isCurrentSeason && idx === 0 && item.total_points > 0;

                    let posBadge = `#${item.rank_position || (idx + 1)}`;
                    if (idx === 0 && item.total_points > 0) posBadge = '🥇';
                    else if (idx === 1 && item.total_points > 0) posBadge = '🥈';
                    else if (idx === 2 && item.total_points > 0) posBadge = '🥉';

                    return `
                        <div class="ranking-card" style="
                            ${isChampion ? 'border: 2px solid #f59e0b; background: linear-gradient(135deg, rgba(254, 243, 199, 0.4), #ffffff);' : (isMe ? 'border: 2px solid var(--color-saibro); background-color: rgba(192, 81, 49, 0.04);' : '')}
                        ">
                            <div class="ranking-pos" style="${idx < 3 && item.total_points > 0 ? 'font-size: 20px;' : ''}">
                                ${posBadge}
                            </div>
                            <div class="ranking-avatar" style="${isChampion ? 'background: #f59e0b; color: white;' : ''}">
                                ${getInitials(item.display_name)}
                            </div>
                            <div class="ranking-info">
                                <div class="ranking-name" style="${isMe ? 'color: var(--color-saibro); font-weight: 800;' : ''}">
                                    ${item.display_name} 
                                    ${isMe ? '<span style="font-size: 10px; font-weight: 800; background: var(--color-saibro); color: #fff; padding: 1px 6px; border-radius: 4px; vertical-align: middle; margin-left: 4px;">VOCÊ</span>' : ''}
                                    ${isChampion ? `<span class="badge" style="font-size: 10px; font-weight: 800; background: #fef3c7; color: #b45309; border: 1px solid #fde68a; margin-left: 4px;">👑 Campeão ${year}</span>` : ''}
                                    ${item.current_level && item.current_level !== level ? `<span class="badge" style="font-size: 10px; padding: 2px 6px; margin-left: 4px; background: rgba(192, 81, 49, 0.12); color: var(--color-saibro); font-weight: 800; border: 1px solid rgba(192, 81, 49, 0.3);">Desafiante (Nível ${item.current_level})</span>` : ''}
                                </div>
                                <div class="ranking-stats">
                                    <span>${item.total_games} jogos</span> • 
                                    <span style="color: var(--color-success); font-weight: 700;">${item.total_wins}V</span> • 
                                    <span style="color: var(--color-danger); font-weight: 700;">${item.total_losses}D</span>
                                </div>
                            </div>
                            <div class="ranking-points" style="${isChampion ? 'color: #b45309; font-weight: 800;' : ''}">
                                ${item.total_points} pts
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    } catch (e) {
        console.error("Erro ao carregar ranking:", e);
        listContainer.innerHTML = `<p style="color: var(--color-danger); text-align: center;">Erro ao carregar dados do ranking da temporada ${year}.</p>`;
    }
}

