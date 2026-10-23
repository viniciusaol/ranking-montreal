/* ====================================================================
   MONTREAL TÊNIS CLUBE - TELA DE RANKING POR TEMPORADA (ANUAL), CATEGORIA E NÍVEL
   ==================================================================== */

import { callRPC } from '../supabase.js';
import { state } from '../state.js';
import { getInitials, getCurrentSeasonYear, isRetrospectiveAvailable } from '../utils.js?v=1.6.5';

const currentYear = getCurrentSeasonYear();
let selectedYear = currentYear;
let selectedLevel = 'C';
let selectedGender = 'Masculino';
let availableSeasons = [];

function getSeasonBannerHTML(year, isCurrent) {
    const isDecember = (new Date().getMonth() === 11);
    if (isCurrent) {
        if (isDecember) {
            return `
                <div style="font-size: 11px; font-weight: 700; color: #b45309; background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.3); padding: 8px 12px; border-radius: var(--radius-sm); display: flex; align-items: center; gap: 6px; line-height: 1.45;">
                    <span>⏸️</span> <span><strong>Temporada ${year} Encerrada (30/11):</strong> Dezembro em recesso oficial (sem partidas do ranking). A Retrospectiva oficial está liberada! A nova temporada inicia em Janeiro com pontuações zeradas.</span>
                </div>
            `;
        } else {
            return `
                <div style="font-size: 11px; font-weight: 700; color: #15803d; background: rgba(34, 197, 94, 0.08); border: 1px solid rgba(34, 197, 94, 0.25); padding: 8px 12px; border-radius: var(--radius-sm); display: flex; align-items: center; gap: 6px; line-height: 1.45;">
                    <span>⚡</span> <span><strong>Temporada ${year} em andamento:</strong> jogos válidos de Janeiro até 30/11/${year}. A Retrospectiva e Campeões oficiais serão liberados em 01/12!</span>
                </div>
            `;
        }
    } else {
        return `
            <div style="font-size: 11px; font-weight: 700; color: #b45309; background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.3); padding: 8px 12px; border-radius: var(--radius-sm); display: flex; align-items: center; gap: 6px; line-height: 1.45;">
                <span>🏛️</span> <span><strong>Temporada Histórica de ${year} (Encerrada em 30/11/${year}):</strong> Classificação final e pódios oficiais consolidados do ano.</span>
            </div>
        `;
    }
}

function getRetroCardHTML(year) {
    const isAvail = isRetrospectiveAvailable(year);

    if (isAvail) {
        return `
            <div id="btn-ranking-retro-card" class="card" style="
                background: linear-gradient(135deg, #18120f 0%, #29140c 100%);
                border: 1.5px solid #f59e0b;
                border-radius: var(--radius-md);
                padding: 12px 14px;
                margin-bottom: var(--space-md);
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
                cursor: pointer;
            ">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="font-size: 24px; background: rgba(245, 158, 11, 0.15); width: 42px; height: 42px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 1.5px solid #f59e0b; flex-shrink: 0;">
                        ✨
                    </div>
                    <div>
                        <div style="font-weight: 800; font-size: 13px; color: #ffffff; display: flex; align-items: center; gap: 6px;">
                            <span>Retrospectiva ${year}</span>
                            <span style="font-size: 9px; font-weight: 800; background: linear-gradient(135deg, #22c55e, #16a34a); color: white; padding: 1px 6px; border-radius: 4px;">CONSOLIDADA</span>
                        </div>
                        <div style="font-size: 11px; color: #cbd5e1; margin-top: 1px; line-height: 1.3;">
                            Galeria de Campeões, pódios e seu <strong>Story para o Instagram</strong>!
                        </div>
                    </div>
                </div>
                <div style="font-size: 18px; color: #f59e0b; font-weight: 800; flex-shrink: 0;">
                    →
                </div>
            </div>
        `;
    } else {
        return `
            <div id="btn-ranking-retro-card" class="card" style="
                background: rgba(0, 0, 0, 0.03);
                border: 1.5px dashed var(--color-grey-border);
                border-radius: var(--radius-md);
                padding: 12px 14px;
                margin-bottom: var(--space-md);
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
                cursor: pointer;
            ">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="font-size: 20px; background: rgba(0, 0, 0, 0.05); width: 42px; height: 42px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 1px solid var(--color-grey-border); flex-shrink: 0;">
                        🔒
                    </div>
                    <div>
                        <div style="font-weight: 800; font-size: 13px; color: var(--color-preto); display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                            <span>Retrospectiva ${year}</span>
                            <span style="font-size: 9px; font-weight: 800; background: #fef3c7; color: #b45309; border: 1px solid #fde68a; padding: 1px 6px; border-radius: 4px;">LIBERA EM 01/12</span>
                        </div>
                        <div style="font-size: 11px; color: var(--color-grey-text); margin-top: 2px; line-height: 1.35;">
                            Disponível a partir de 01/12, após o fechamento do ranking em 30/11. Continue jogando para pontuar!
                        </div>
                    </div>
                </div>
                <div style="font-size: 14px; color: var(--color-grey-text); font-weight: 800; flex-shrink: 0;">
                    🔒
                </div>
            </div>
        `;
    }
}

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
                        Classificação oficial por temporada anual (até 30/11) e categoria.
                    </p>
                </div>
                
                <!-- Seletor de Temporada / Ano -->
                <div style="display: flex; align-items: center; gap: 6px; background: #ffffff; padding: 4px 10px; border-radius: var(--radius-md); border: 1.5px solid var(--color-saibro); box-shadow: 0 1px 4px rgba(0,0,0,0.06);">
                    <span style="font-size: 13px;">📅</span>
                    <select id="select-ranking-season" style="border: none; background: transparent; font-size: 13px; font-weight: 800; color: var(--color-saibro); cursor: pointer; outline: none;">
                        ${availableSeasons.map(s => `
                            <option value="${s.season_year}" ${s.season_year === selectedYear ? 'selected' : ''}>
                                Temporada ${s.season_year} ${s.is_current ? '(Atual • até 30/11)' : '(Histórico • até 30/11)'}
                            </option>
                        `).join('')}
                    </select>
                </div>
            </div>

            <!-- Banner Informativo do Ciclo da Temporada -->
            <div id="season-status-banner" style="margin-bottom: var(--space-xs);">
                ${getSeasonBannerHTML(selectedYear, isCurrentSeason)}
            </div>

            <!-- Card de Destaque da Retrospectiva & Story Instagram (Dinâmico por Ano) -->
            <div id="ranking-retro-card-container">
                ${getRetroCardHTML(selectedYear)}
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

    function attachRetroCardListener() {
        document.getElementById('btn-ranking-retro-card')?.addEventListener('click', () => {
            window.location.hash = `#/retrospectiva/${selectedYear}`;
        });
    }

    attachRetroCardListener();

    // Configura listener da seleção de temporada
    document.getElementById('select-ranking-season')?.addEventListener('change', async (e) => {
        selectedYear = parseInt(e.target.value, 10);
        
        const bannerContainer = document.getElementById('season-status-banner');
        const isCurrent = (selectedYear === currentYear);
        if (bannerContainer) {
            bannerContainer.innerHTML = getSeasonBannerHTML(selectedYear, isCurrent);
        }

        const retroContainer = document.getElementById('ranking-retro-card-container');
        if (retroContainer) {
            retroContainer.innerHTML = getRetroCardHTML(selectedYear);
            attachRetroCardListener();
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
            <div style="font-size: 11px; color: var(--color-grey-text); margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; padding: 0 4px; flex-wrap: wrap; gap: 4px;">
                <span>Classificação: <strong>Pontos no Ranking</strong></span>
                <span>Desempate: <strong>% Apr. > Vitórias</strong></span>
            </div>
            <div class="ranking-list">
                ${ranking.map((item, idx) => {
                    const isMe = user && String(user.customer_code).trim() === String(item.customer_code).trim();
                    const isChampion = !isCurrentSeason && idx === 0 && item.total_points > 0;
                    const finalPoints = Math.round(Number(item.total_points) || 0);
                    const winRate = Number(item.win_rate) || 0;
                    const penaltyPct = Number(item.inactivity_penalty_pct) || 0;

                    let posBadge = `#${item.rank_position || (idx + 1)}`;
                    if (idx === 0 && finalPoints > 0) posBadge = '🥇';
                    else if (idx === 1 && finalPoints > 0) posBadge = '🥈';
                    else if (idx === 2 && finalPoints > 0) posBadge = '🥉';

                    return `
                        <div class="ranking-card" style="
                            ${isChampion ? 'border: 2px solid #f59e0b; background: linear-gradient(135deg, rgba(254, 243, 199, 0.4), #ffffff);' : (isMe ? 'border: 2px solid var(--color-saibro); background-color: rgba(192, 81, 49, 0.04);' : '')}
                        ">
                            <div class="ranking-pos" style="${idx < 3 && finalPoints > 0 ? 'font-size: 20px;' : ''}">
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
                                    ${penaltyPct > 0 ? `<span class="badge" style="font-size: 9px; padding: 1px 5px; margin-left: 4px; background: #fee2e2; color: #b91c1c; font-weight: 800;" title="Inativo há ${item.days_inactive} dias (-${penaltyPct}%)">⚠️ -${penaltyPct}% inat.</span>` : ''}
                                </div>
                                <div class="ranking-stats">
                                    <span>${item.total_games} jogos</span> • 
                                    <span style="color: var(--color-success); font-weight: 700;">${item.total_wins}V</span> • 
                                    <span style="color: var(--color-danger); font-weight: 700;">${item.total_losses}D</span> • 
                                    <span style="color: var(--color-saibro); font-weight: 800;">${winRate}% apr.</span>
                                </div>
                                ${user && user.is_admin ? `
                                    <div style="margin-top: 4px;">
                                        <select class="admin-ranking-level-select" 
                                                data-code="${item.customer_code}" 
                                                data-name="${item.display_name}" 
                                                data-current="${item.current_level || level}"
                                                title="Administrador: Alterar nível deste atleta no ranking"
                                                style="font-size: 10px; font-weight: 800; padding: 1px 5px; border-radius: 4px; border: 1px solid rgba(220, 38, 38, 0.4); background: #fff5f5; color: #991b1b; cursor: pointer; outline: none;">
                                            <option value="A" ${(item.current_level || level) === 'A' ? 'selected' : ''}>👑 Nível A</option>
                                            <option value="B" ${(item.current_level || level) === 'B' ? 'selected' : ''}>👑 Nível B</option>
                                            <option value="C" ${(item.current_level || level) === 'C' ? 'selected' : ''}>👑 Nível C</option>
                                            <option value="D" ${(item.current_level || level) === 'D' ? 'selected' : ''}>👑 Nível D</option>
                                        </select>
                                    </div>
                                ` : ''}
                            </div>
                            <div class="ranking-points" style="text-align: right; ${isChampion ? 'color: #b45309; font-weight: 800;' : ''}">
                                <div style="font-size: 16px; font-weight: 900; color: var(--color-saibro);">${finalPoints} pts</div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        if (user && user.is_admin) {
            listContainer.querySelectorAll('.admin-ranking-level-select').forEach(selectEl => {
                selectEl.addEventListener('change', async (e) => {
                    const targetCode = selectEl.getAttribute('data-code');
                    const targetName = selectEl.getAttribute('data-name');
                    const prevLevel = selectEl.getAttribute('data-current');
                    const newLevel = e.target.value;

                    if (newLevel === prevLevel) return;

                    const confirmed = confirm(`[ADMIN] Deseja alterar o nível de "${targetName}" de Nível ${prevLevel} para Nível ${newLevel}?`);
                    if (!confirmed) {
                        e.target.value = prevLevel;
                        return;
                    }

                    selectEl.disabled = true;
                    try {
                        await callRPC('fn_mt_admin_alterar_nivel_atleta', {
                            p_admin_code: user.customer_code,
                            p_target_customer_code: targetCode,
                            p_new_level: newLevel,
                            p_reason: `Ajuste administrativo direto pelo ranking de ${prevLevel} para ${newLevel}.`
                        });

                        if (String(user.customer_code) === String(targetCode)) {
                            user.current_level = newLevel;
                            state.setUser(user);
                            const badgeLevel = document.getElementById('header-user-level');
                            if (badgeLevel) badgeLevel.textContent = `Nível ${newLevel}`;
                        }

                        alert(`Nível de ${targetName} alterado para Nível ${newLevel} com sucesso!`);
                        await loadRankingList(selectedLevel, selectedGender, selectedYear);
                    } catch (err) {
                        alert(`Erro ao alterar nível: ${err.message}`);
                        e.target.value = prevLevel;
                    } finally {
                        selectEl.disabled = false;
                    }
                });
            });
        }
    } catch (e) {
        console.error("Erro ao carregar ranking:", e);
        listContainer.innerHTML = `<p style="color: var(--color-danger); text-align: center;">Erro ao carregar dados do ranking da temporada ${year}.</p>`;
    }
}

