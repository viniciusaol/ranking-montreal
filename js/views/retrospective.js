/* ====================================================================
   MONTREAL TÊNIS CLUBE - RETROSPECTIVA ANUAL & STORY INSTAGRAM
   ==================================================================== */

import { state } from '../state.js';
import { callRPC } from '../supabase.js';
import { getInitials, getCurrentSeasonYear } from '../utils.js?v=1.5.7';

let currentTab = 'story'; // 'story' | 'podiums' | 'records'
let selectedYear = getCurrentSeasonYear();
let availableSeasons = [];
let clubData = null;
let playerData = null;

export async function renderRetrospective(params = {}) {
    const container = document.getElementById('view-content');
    const user = state.getUser();

    if (!user) {
        container.innerHTML = `<p style="color: var(--color-danger); text-align: center; padding: 20px;">Você precisa estar conectado para acessar a Retrospectiva.</p>`;
        return;
    }

    if (params.year) {
        selectedYear = parseInt(params.year, 10);
    } else {
        selectedYear = getCurrentSeasonYear();
    }

    // Busca temporadas disponíveis
    try {
        const seasons = await callRPC('fn_mt_game_obter_temporadas') || [];
        if (seasons.length > 0) {
            availableSeasons = seasons;
        } else {
            availableSeasons = [
                { season_year: selectedYear, is_current: true },
                { season_year: selectedYear - 1, is_current: false }
            ];
        }
    } catch (e) {
        availableSeasons = [
            { season_year: selectedYear, is_current: true },
            { season_year: selectedYear - 1, is_current: false }
        ];
    }

    container.innerHTML = `
        <div class="view-container active" style="padding-bottom: 90px;">
            <!-- Header com Botão Voltar e Seletor de Temporada -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                <button type="button" class="btn btn-secondary btn-sm" id="btn-back-to-ranking" style="width: auto; padding: 6px 12px; font-size: 12px;">
                    ← Voltar ao Ranking
                </button>
                
                <div style="display: flex; align-items: center; gap: 6px; background: #ffffff; padding: 4px 10px; border-radius: var(--radius-md); border: 1.5px solid var(--color-saibro); box-shadow: 0 1px 4px rgba(0,0,0,0.06);">
                    <span style="font-size: 13px;">📅</span>
                    <select id="select-retro-season" style="border: none; background: transparent; font-size: 13px; font-weight: 800; color: var(--color-saibro); cursor: pointer; outline: none;">
                        ${availableSeasons.map(s => `
                            <option value="${s.season_year}" ${s.season_year === selectedYear ? 'selected' : ''}>
                                Temporada ${s.season_year} ${s.is_current ? '(Atual)' : '(Histórico)'}
                            </option>
                        `).join('')}
                    </select>
                </div>
            </div>

            <!-- Título Principal -->
            <div style="margin-bottom: 16px;">
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
                    <span style="font-size: 20px;">✨</span>
                    <h2 style="font-size: var(--font-size-xl); font-weight: 800; color: var(--color-preto); margin: 0;">
                        Retrospectiva ${selectedYear}
                    </h2>
                </div>
                <p style="font-size: var(--font-size-xs); color: var(--color-grey-text); line-height: 1.4;">
                    Resumo oficial de <strong>01/01 a 30/11/${selectedYear}</strong>: campeões, superlativos e seu Story para o Instagram!
                </p>
            </div>

            <!-- Segmented Tabs -->
            <div class="ranking-tabs" style="margin-bottom: 16px;">
                <button class="tab-btn ${currentTab === 'story' ? 'active' : ''}" id="tab-btn-story">
                    🌟 Meu Story
                </button>
                <button class="tab-btn ${currentTab === 'podiums' ? 'active' : ''}" id="tab-btn-podiums">
                    👑 Campeões & Pódios
                </button>
                <button class="tab-btn ${currentTab === 'records' ? 'active' : ''}" id="tab-btn-records">
                    📊 Recordes do Ano
                </button>
            </div>

            <!-- Conteúdo Dinâmico -->
            <div id="retro-content">
                <p style="text-align: center; color: var(--color-grey-text); padding: 30px;">Carregando retrospectiva...</p>
            </div>
        </div>
    `;

    document.getElementById('btn-back-to-ranking')?.addEventListener('click', () => {
        window.location.hash = '#/ranking';
    });

    document.getElementById('select-retro-season')?.addEventListener('change', async (e) => {
        selectedYear = parseInt(e.target.value, 10);
        await loadRetrospectiveData(user);
    });

    document.getElementById('tab-btn-story')?.addEventListener('click', () => {
        currentTab = 'story';
        updateTabButtons();
        renderTabContent(user);
    });

    document.getElementById('tab-btn-podiums')?.addEventListener('click', () => {
        currentTab = 'podiums';
        updateTabButtons();
        renderTabContent(user);
    });

    document.getElementById('tab-btn-records')?.addEventListener('click', () => {
        currentTab = 'records';
        updateTabButtons();
        renderTabContent(user);
    });

    await loadRetrospectiveData(user);
}

function updateTabButtons() {
    document.getElementById('tab-btn-story')?.classList.toggle('active', currentTab === 'story');
    document.getElementById('tab-btn-podiums')?.classList.toggle('active', currentTab === 'podiums');
    document.getElementById('tab-btn-records')?.classList.toggle('active', currentTab === 'records');
}

async function loadRetrospectiveData(user) {
    const content = document.getElementById('retro-content');
    if (!content) return;

    content.innerHTML = `<p style="text-align: center; color: var(--color-grey-text); padding: 30px;">Carregando retrospectiva da temporada ${selectedYear}...</p>`;

    try {
        const [clubRes, playerRes] = await Promise.all([
            callRPC('fn_mt_game_obter_retrospectiva_clube', { p_year: selectedYear }),
            callRPC('fn_mt_game_obter_retrospectiva_jogador', { p_customer_code: user.customer_code, p_year: selectedYear })
        ]);

        clubData = clubRes || {};
        playerData = playerRes || {};

        renderTabContent(user);
    } catch (e) {
        console.error("Erro ao carregar retrospectiva:", e);
        content.innerHTML = `<p style="color: var(--color-danger); text-align: center; padding: 20px;">Erro ao carregar dados da temporada: ${e.message}</p>`;
    }
}

function renderTabContent(user) {
    const content = document.getElementById('retro-content');
    if (!content) return;

    if (currentTab === 'story') {
        renderStoryTab(content, user);
    } else if (currentTab === 'podiums') {
        renderPodiumsTab(content);
    } else if (currentTab === 'records') {
        renderRecordsTab(content);
    }
}

/* ====================================================================
   ABA 1: MEU RESUMO • STORY INSTAGRAM (SPOTIFY WRAPPED STYLE)
   ==================================================================== */
function renderStoryTab(container, user) {
    const p = playerData || {};
    const hasPlayed = (p.total_games || 0) > 0;

    container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center;">
            <div style="text-align: center; margin-bottom: 14px;">
                <span style="font-size: 11px; font-weight: 800; color: #b45309; background: #fef3c7; border: 1px solid #fde68a; padding: 3px 10px; border-radius: 20px; text-transform: uppercase;">
                    📸 Formato Instagram Stories (9:16)
                </span>
                <p style="font-size: 12px; color: var(--color-grey-text); margin-top: 6px;">
                    Seu cartão de atleta do ano! Compartilhe nos Stories ou baixe a imagem em alta resolução.
                </p>
            </div>

            <!-- Card de Visualização do Story (Estilo Spotify Wrapped Montreal) -->
            <div id="story-preview-card" style="
                width: 100%;
                max-width: 360px;
                aspect-ratio: 9/16;
                background: linear-gradient(165deg, #18120f 0%, #29140c 45%, #0f172a 100%);
                border: 2.5px solid #f59e0b;
                border-radius: 24px;
                box-shadow: 0 16px 36px rgba(0, 0, 0, 0.4), 0 0 24px rgba(245, 158, 11, 0.2);
                color: #ffffff;
                padding: 24px 20px;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                position: relative;
                overflow: hidden;
                box-sizing: border-box;
            ">
                <!-- Marca d'água de quadra de tênis decorativa de fundo -->
                <div style="
                    position: absolute;
                    top: -40px;
                    right: -40px;
                    width: 220px;
                    height: 220px;
                    border-radius: 50%;
                    background: radial-gradient(circle, rgba(192, 81, 49, 0.25) 0%, transparent 70%);
                    pointer-events: none;
                "></div>

                <div style="
                    position: absolute;
                    bottom: -30px;
                    left: -30px;
                    width: 200px;
                    height: 200px;
                    border-radius: 50%;
                    background: radial-gradient(circle, rgba(245, 158, 11, 0.15) 0%, transparent 70%);
                    pointer-events: none;
                "></div>

                <!-- Topo: Logo & Temporada -->
                <div style="position: relative; z-index: 2; text-align: center;">
                    <div style="display: flex; align-items: center; justify-content: center; gap: 6px; margin-bottom: 2px;">
                        <span style="font-size: 16px;">🎾</span>
                        <span style="font-size: 11px; font-weight: 800; letter-spacing: 2px; color: #f59e0b; text-transform: uppercase;">
                            Montreal Tênis Clube
                        </span>
                    </div>
                    <div style="font-size: 13px; font-weight: 800; color: #ffffff; letter-spacing: 1px;">
                        RETROSPECTIVA ${selectedYear}
                    </div>
                    <div style="font-size: 9px; color: #a1a1aa; margin-top: 1px;">
                        01/01 a 30/11 • Temporada Oficial
                    </div>
                </div>

                <!-- Centro: Jogador & Distintivo de Conquista -->
                <div style="position: relative; z-index: 2; text-align: center; margin: 10px 0;">
                    <div style="
                        width: 72px;
                        height: 72px;
                        border-radius: 50%;
                        background: linear-gradient(135deg, #f59e0b, #c05131);
                        padding: 3px;
                        margin: 0 auto 8px auto;
                        box-shadow: 0 4px 14px rgba(245, 158, 11, 0.4);
                    ">
                        <div style="
                            width: 100%;
                            height: 100%;
                            border-radius: 50%;
                            background: #18120f;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-size: 24px;
                            font-weight: 800;
                            color: #f59e0b;
                        ">
                            ${getInitials(p.display_name || user.display_name)}
                        </div>
                    </div>

                    <h3 style="font-size: 18px; font-weight: 800; color: #ffffff; margin: 0 0 3px 0; text-shadow: 0 2px 4px rgba(0,0,0,0.4);">
                        ${p.display_name || user.display_name}
                    </h3>
                    
                    <div style="font-size: 11px; color: #e2e8f0; font-weight: 600;">
                        Nível ${p.current_level || user.current_level} • Categoria ${p.gender || 'Masculino'}
                    </div>

                    <!-- Badge Oficial de Conquista -->
                    <div style="
                        background: linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(192, 81, 49, 0.3));
                        border: 1.5px solid #f59e0b;
                        border-radius: 12px;
                        padding: 8px 12px;
                        margin-top: 10px;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                    ">
                        <div style="font-size: 13px; font-weight: 900; color: #fef3c7; letter-spacing: 0.5px;">
                            ${p.badge_title || '🎾 CRAQUE DO SAIBRO'}
                        </div>
                        <div style="font-size: 10px; color: #fde68a; font-weight: 700; margin-top: 1px;">
                            ${p.badge_subtitle || 'Temporada Montreal'}
                        </div>
                    </div>
                </div>

                <!-- Grid de Estatísticas (4 Cards) -->
                <div style="
                    position: relative;
                    z-index: 2;
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 8px;
                    margin: 6px 0;
                ">
                    <!-- Stat 1: Posição & Pontos -->
                    <div style="background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 12px; padding: 8px 10px; text-align: center;">
                        <div style="font-size: 9px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Pontuação</div>
                        <div style="font-size: 18px; font-weight: 900; color: #f59e0b; margin: 1px 0;">
                            ${p.total_points || 0} pts
                        </div>
                        <div style="font-size: 9px; color: #cbd5e1; font-weight: 700;">
                            ${p.rank_position ? `#${p.rank_position} no Ranking` : 'Classificado'}
                        </div>
                    </div>

                    <!-- Stat 2: Jogos & Vitórias -->
                    <div style="background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 12px; padding: 8px 10px; text-align: center;">
                        <div style="font-size: 9px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Partidas</div>
                        <div style="font-size: 18px; font-weight: 900; color: #22c55e; margin: 1px 0;">
                            ${p.total_games || 0} jogos
                        </div>
                        <div style="font-size: 9px; color: #cbd5e1; font-weight: 700;">
                            ${p.total_wins || 0}V • ${p.total_losses || 0}D
                        </div>
                    </div>

                    <!-- Stat 3: Aproveitamento -->
                    <div style="background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 12px; padding: 8px 10px; text-align: center;">
                        <div style="font-size: 9px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Aproveitamento</div>
                        <div style="font-size: 18px; font-weight: 900; color: #38bdf8; margin: 1px 0;">
                            ${p.win_rate || 0}%
                        </div>
                        <div style="font-size: 9px; color: #cbd5e1; font-weight: 700;">
                            ${p.total_games_won || 0} games vencidos
                        </div>
                    </div>

                    <!-- Stat 4: Maior Rival -->
                    <div style="background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 12px; padding: 8px 10px; text-align: center;">
                        <div style="font-size: 9px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Maior Rival</div>
                        <div style="font-size: 13px; font-weight: 800; color: #f43f5e; margin: 3px 0 1px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            ${p.top_rival ? p.top_rival.display_name.split(' ')[0] : 'Em busca'}
                        </div>
                        <div style="font-size: 9px; color: #cbd5e1; font-weight: 700;">
                            ${p.top_rival ? `${p.top_rival.matches_count} duelo(s)` : 'Nenhum duelo'}
                        </div>
                    </div>
                </div>

                <!-- Frase de Impacto -->
                <div style="
                    position: relative;
                    z-index: 2;
                    text-align: center;
                    background: rgba(0, 0, 0, 0.25);
                    border-radius: 8px;
                    padding: 6px 8px;
                    font-size: 10px;
                    font-weight: 700;
                    color: #fcd34d;
                    margin-top: 4px;
                ">
                    ✨ "${p.highlight_stat || 'Batalhas inesquecíveis no saibro da Montreal!'}"
                </div>

                <!-- Rodapé Oficial -->
                <div style="position: relative; z-index: 2; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 8px; margin-top: 6px;">
                    <div style="font-size: 9px; font-weight: 700; color: #e2e8f0; letter-spacing: 0.5px;">
                        ranking.montrealtenis.com.br
                    </div>
                    <div style="font-size: 8px; color: #94a3b8; margin-top: 1px;">
                        @montreal.tenisclube • Curitiba/PR
                    </div>
                </div>
            </div>

            <!-- Botões de Ação para Compartilhar -->
            <div style="width: 100%; max-width: 360px; margin-top: 18px; display: flex; flex-direction: column; gap: 10px;">
                <button class="btn btn-primary" id="btn-share-instagram" style="
                    font-size: 15px;
                    font-weight: 800;
                    padding: 14px 20px;
                    background: linear-gradient(135deg, #E1306C, #C13584, #833AB4);
                    border: none;
                    box-shadow: 0 4px 16px rgba(193, 53, 132, 0.35);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                ">
                    <span>📸</span> Compartilhar no Instagram / Salvar Story
                </button>

                <div style="display: flex; gap: 8px;">
                    <button class="btn btn-secondary" id="btn-share-whatsapp" style="flex: 1; font-size: 12px; padding: 10px 8px; border-color: #25d366; color: #15803d; background: #f0fdf4;">
                        💬 WhatsApp
                    </button>
                    <button class="btn btn-secondary" id="btn-copy-retro-text" style="flex: 1; font-size: 12px; padding: 10px 8px;">
                        📋 Copiar Texto
                    </button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('btn-share-instagram')?.addEventListener('click', async () => {
        const btn = document.getElementById('btn-share-instagram');
        btn.disabled = true;
        btn.innerHTML = `<span>⏳</span> Gerando Story em Alta Resolução...`;

        try {
            await handleShareStoryImage(p, selectedYear);
        } catch (err) {
            console.error("Erro ao gerar Story:", err);
            alert("Erro ao gerar imagem: " + err.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = `<span>📸</span> Compartilhar no Instagram / Salvar Story`;
        }
    });

    document.getElementById('btn-share-whatsapp')?.addEventListener('click', () => {
        handleShareWhatsApp(p, selectedYear);
    });

    document.getElementById('btn-copy-retro-text')?.addEventListener('click', () => {
        handleCopyText(p, selectedYear);
    });
}

/* ====================================================================
   GERAÇÃO DO STORY EM ALTA RESOLUÇÃO (CANVAS 1080x1920)
   ==================================================================== */
async function handleShareStoryImage(p, year) {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d');

    // 1. Fundo Gradiente
    const grad = ctx.createLinearGradient(0, 0, 1080, 1920);
    grad.addColorStop(0, '#150f0c');
    grad.addColorStop(0.4, '#24120a');
    grad.addColorStop(1, '#0b0f19');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1080, 1920);

    // 2. Brilho Saibro Superior
    const radialSaibro = ctx.createRadialGradient(900, 200, 10, 900, 200, 600);
    radialSaibro.addColorStop(0, 'rgba(192, 81, 49, 0.45)');
    radialSaibro.addColorStop(1, 'rgba(192, 81, 49, 0)');
    ctx.fillStyle = radialSaibro;
    ctx.fillRect(0, 0, 1080, 1000);

    // 3. Brilho Dourado Inferior
    const radialGold = ctx.createRadialGradient(200, 1750, 10, 200, 1750, 500);
    radialGold.addColorStop(0, 'rgba(245, 158, 11, 0.25)');
    radialGold.addColorStop(1, 'rgba(245, 158, 11, 0)');
    ctx.fillStyle = radialGold;
    ctx.fillRect(0, 1200, 1080, 720);

    // 4. Linhas sutis de quadra de tênis decorativas
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 4;
    ctx.strokeRect(80, 80, 920, 1760);
    ctx.beginPath();
    ctx.moveTo(80, 960);
    ctx.lineTo(1000, 960);
    ctx.stroke();

    // Borda Dourada Externa do Card
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 10;
    roundRect(ctx, 40, 40, 1000, 1840, 40, false, true);

    // 5. Cabeçalho
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 36px "Hanken Grotesk", sans-serif';
    ctx.fillText('🎾 MONTREAL TÊNIS CLUBE', 540, 160);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 46px "Hanken Grotesk", sans-serif';
    ctx.fillText(`RETROSPECTIVA ${year}`, 540, 225);

    ctx.fillStyle = '#a1a1aa';
    ctx.font = 'bold 26px "Hanken Grotesk", sans-serif';
    ctx.fillText('Temporada Oficial • Jogos Válidos de 01/01 a 30/11', 540, 275);

    // 6. Avatar / Iniciais do Atleta
    const avatarY = 460;
    ctx.save();
    ctx.beginPath();
    ctx.arc(540, avatarY, 110, 0, Math.PI * 2);
    ctx.fillStyle = '#18120f';
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#f59e0b';
    ctx.stroke();

    ctx.fillStyle = '#f59e0b';
    ctx.font = '900 80px "Hanken Grotesk", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(getInitials(p.display_name || 'Tenista'), 540, avatarY);
    ctx.restore();

    // 7. Nome e Nível do Tenista
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 62px "Hanken Grotesk", sans-serif';
    ctx.fillText(p.display_name || 'Tenista Montreal', 540, 640);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 34px "Hanken Grotesk", sans-serif';
    ctx.fillText(`Nível ${p.current_level || 'C'} • Categoria ${p.gender || 'Masculino'}`, 540, 700);

    // 8. Box Principal de Conquista / Título da Temporada
    ctx.save();
    const boxW = 880;
    const boxH = 160;
    const boxX = (1080 - boxW) / 2;
    const boxY = 760;
    
    // Gradiente do Badge
    const badgeGrad = ctx.createLinearGradient(boxX, boxY, boxX + boxW, boxY + boxH);
    badgeGrad.addColorStop(0, 'rgba(245, 158, 11, 0.35)');
    badgeGrad.addColorStop(1, 'rgba(192, 81, 49, 0.45)');
    ctx.fillStyle = badgeGrad;
    roundRect(ctx, boxX, boxY, boxW, boxH, 24, true, false);

    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 4;
    roundRect(ctx, boxX, boxY, boxW, boxH, 24, false, true);

    ctx.fillStyle = '#fef3c7';
    ctx.font = '900 44px "Hanken Grotesk", sans-serif';
    ctx.fillText(p.badge_title || '🎾 CRAQUE DO SAIBRO', 540, boxY + 68);

    ctx.fillStyle = '#fde68a';
    ctx.font = 'bold 30px "Hanken Grotesk", sans-serif';
    ctx.fillText(p.badge_subtitle || 'Temporada Montreal', 540, boxY + 120);
    ctx.restore();

    // 9. Grid de Estatísticas (4 Cards 2x2)
    const cardW = 420;
    const cardH = 210;
    const gap = 40;
    const startX = (1080 - (cardW * 2 + gap)) / 2;
    const startY = 960;

    const stats = [
        {
            label: 'PONTOS NO RANKING',
            val: `${p.total_points || 0} pts`,
            valColor: '#f59e0b',
            sub: p.rank_position ? `#${p.rank_position} na Categoria` : 'Classificado'
        },
        {
            label: 'PARTIDAS DISPUTADAS',
            val: `${p.total_games || 0} jogos`,
            valColor: '#22c55e',
            sub: `${p.total_wins || 0}V • ${p.total_losses || 0}D`
        },
        {
            label: 'APROVEITAMENTO',
            val: `${p.win_rate || 0}%`,
            valColor: '#38bdf8',
            sub: `${p.total_games_won || 0} games conquistados`
        },
        {
            label: 'MAIOR RIVAL DO ANO',
            val: p.top_rival ? p.top_rival.display_name.split(' ')[0] : 'Em busca',
            valColor: '#f43f5e',
            sub: p.top_rival ? `${p.top_rival.matches_count} confronto(s)` : 'Nenhum duelo'
        }
    ];

    stats.forEach((s, idx) => {
        const col = idx % 2;
        const row = Math.floor(idx / 2);
        const cx = startX + col * (cardW + gap);
        const cy = startY + row * (cardH + gap);

        // Fundo do Card
        ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
        roundRect(ctx, cx, cy, cardW, cardH, 20, true, false);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 2;
        roundRect(ctx, cx, cy, cardW, cardH, 20, false, true);

        // Textos
        ctx.fillStyle = '#94a3b8';
        ctx.font = 'bold 22px "Hanken Grotesk", sans-serif';
        ctx.fillText(s.label, cx + cardW / 2, cy + 50);

        ctx.fillStyle = s.valColor;
        ctx.font = '900 48px "Hanken Grotesk", sans-serif';
        ctx.fillText(s.val, cx + cardW / 2, cy + 120);

        ctx.fillStyle = '#cbd5e1';
        ctx.font = 'bold 24px "Hanken Grotesk", sans-serif';
        ctx.fillText(s.sub, cx + cardW / 2, cy + 170);
    });

    // 10. Frase de Destaque
    const quoteY = 1480;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    roundRect(ctx, 100, quoteY, 880, 130, 20, true, false);
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
    ctx.lineWidth = 2;
    roundRect(ctx, 100, quoteY, 880, 130, 20, false, true);

    ctx.fillStyle = '#fcd34d';
    ctx.font = 'bold 36px "Hanken Grotesk", sans-serif';
    ctx.fillText(`✨ "${p.highlight_stat || 'Dedicação e raça nas quadras do Montreal!'}"`, 540, quoteY + 60);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '24px "Hanken Grotesk", sans-serif';
    ctx.fillText('Circuito Oficial de Tênis em Saibro', 540, quoteY + 100);

    // 11. Rodapé
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fillRect(100, 1680, 880, 2);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px "Hanken Grotesk", sans-serif';
    ctx.fillText('ranking.montrealtenis.com.br', 540, 1740);

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 24px "Hanken Grotesk", sans-serif';
    ctx.fillText('Acesse e dispute o ranking oficial do clube • @montreal.tenisclube', 540, 1785);

    // 12. Compartilhamento Nativo ou Download
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const fileName = `retrospectiva-montreal-${year}-${(p.display_name || 'tenista').toLowerCase().replace(/\s+/g, '-')}.png`;
    const file = new File([blob], fileName, { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
            title: `Minha Retrospectiva Montreal ${year}`,
            text: `Confira meus resultados na temporada ${year} do Ranking do Montreal Tênis Clube! 🎾🏆`,
            files: [file]
        });
    } else {
        // Fallback: Download Direto
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        link.click();
        alert("📸 Imagem do Story gerada com sucesso! O arquivo foi baixado no seu dispositivo e está pronto para ser postado nos seus Stories do Instagram.");
    }
}

function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
}

function handleShareWhatsApp(p, year) {
    const text = `🎾 *Minha Retrospectiva Montreal ${year}* 🏆%0A%0A` +
        `👤 *${p.display_name}* (Nível ${p.current_level} • ${p.gender})%0A` +
        `🎖️ *Destaque:* ${p.badge_title}%0A` +
        `📊 *Pontos:* ${p.total_points || 0} pts (Posição #${p.rank_position || 1})%0A` +
        `🎾 *Partidas:* ${p.total_games || 0} (${p.total_wins || 0}V • ${p.total_losses || 0}D)%0A` +
        `⚡ *Aproveitamento:* ${p.win_rate || 0}% de vitórias%0A%0A` +
        `Confira o ranking completo e venha jogar: https://ranking.montrealtenis.com.br`;

    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
}

function handleCopyText(p, year) {
    const text = `🎾 Minha Retrospectiva Montreal ${year} 🏆\n` +
        `👤 ${p.display_name} (Nível ${p.current_level} • ${p.gender})\n` +
        `🎖️ Conquista: ${p.badge_title}\n` +
        `📊 Pontuação: ${p.total_points || 0} pts (Posição #${p.rank_position || 1})\n` +
        `🎾 Partidas: ${p.total_games || 0} jogos (${p.total_wins || 0} vitórias)\n` +
        `⚡ Aproveitamento: ${p.win_rate || 0}%\n\n` +
        `Acesse o ranking da Montreal: https://ranking.montrealtenis.com.br`;

    navigator.clipboard.writeText(text).then(() => {
        alert("📋 Resumo copiado para a área de transferência!");
    }).catch(() => {
        alert("Erro ao copiar texto.");
    });
}

/* ====================================================================
   ABA 2: GALERIA DE CAMPEÕES & PÓDIOS DA TEMPORADA
   ==================================================================== */
function renderPodiumsTab(container) {
    const c = clubData || {};
    const podiums = c.podiums || [];

    if (podiums.length === 0) {
        container.innerHTML = `
            <div class="card" style="text-align: center; padding: 40px 20px;">
                <div style="font-size: 38px; margin-bottom: 8px;">👑</div>
                <h3 style="font-size: 16px; font-weight: 800; color: var(--color-preto); margin-bottom: 6px;">
                    Nenhum pódio consolidado em ${selectedYear}
                </h3>
                <p style="font-size: 12px; color: var(--color-grey-text); line-height: 1.4;">
                    Não há partidas computadas para compor o pódio oficial da temporada de ${selectedYear}.
                </p>
            </div>
        `;
        return;
    }

    // Agrupa por Gênero e Nível
    const categories = {};
    podiums.forEach(item => {
        const key = `${item.gender} • Nível ${item.level_code}`;
        if (!categories[key]) categories[key] = [];
        categories[key].push(item);
    });

    container.innerHTML = `
        <div style="margin-bottom: 12px;">
            <p style="font-size: 12px; color: var(--color-grey-text); margin-bottom: 14px;">
                Galeria oficial com os 3 melhores colocados de cada categoria na <strong>Temporada ${selectedYear}</strong> (pontuações consolidadas até 30/11):
            </p>

            ${Object.entries(categories).map(([catName, list]) => {
                const champ = list.find(l => l.position === 1);
                return `
                    <div class="card" style="margin-bottom: 16px; padding: 16px; border-left: 5px solid #f59e0b;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                            <h3 style="font-size: 15px; font-weight: 800; color: var(--color-preto); margin: 0;">
                                🎾 ${catName}
                            </h3>
                            ${champ ? `
                                <span style="font-size: 11px; font-weight: 800; color: #b45309; background: #fef3c7; border: 1px solid #fde68a; padding: 2px 8px; border-radius: 6px;">
                                    👑 Campeão: ${champ.display_name.split(' ')[0]}
                                </span>
                            ` : ''}
                        </div>

                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            ${list.map(p => {
                                const is1 = p.position === 1;
                                const is2 = p.position === 2;
                                const is3 = p.position === 3;
                                const badge = is1 ? '🥇' : (is2 ? '🥈' : '🥉');
                                const borderColor = is1 ? '#f59e0b' : (is2 ? '#94a3b8' : '#cd7f32');
                                const bgStyle = is1 
                                    ? 'background: linear-gradient(135deg, rgba(254, 243, 199, 0.4), #ffffff); border: 2px solid #f59e0b;' 
                                    : 'background: #ffffff; border: 1px solid var(--color-grey-border);';

                                return `
                                    <div style="
                                        display: flex;
                                        align-items: center;
                                        justify-content: space-between;
                                        padding: 10px 12px;
                                        border-radius: var(--radius-md);
                                        ${bgStyle}
                                    ">
                                        <div style="display: flex; align-items: center; gap: 10px;">
                                            <div style="font-size: 22px; width: 28px; text-align: center;">${badge}</div>
                                            <div style="
                                                width: 38px;
                                                height: 38px;
                                                border-radius: 50%;
                                                background: ${is1 ? '#f59e0b' : 'var(--color-saibro)'};
                                                color: white;
                                                display: flex;
                                                align-items: center;
                                                justify-content: center;
                                                font-weight: 800;
                                                font-size: 14px;
                                            ">
                                                ${getInitials(p.display_name)}
                                            </div>
                                            <div>
                                                <div style="font-size: 13px; font-weight: 800; color: var(--color-preto);">
                                                    ${p.display_name}
                                                    ${is1 ? `<span style="font-size: 10px; font-weight: 800; background: #f59e0b; color: white; padding: 1px 6px; border-radius: 4px; margin-left: 4px;">CAMPEÃO ${selectedYear}</span>` : ''}
                                                </div>
                                                <div style="font-size: 11px; color: var(--color-grey-text);">
                                                    ${p.total_games} jogos • ${p.total_wins} vitórias
                                                </div>
                                            </div>
                                        </div>

                                        <div style="text-align: right;">
                                            <div style="font-size: 15px; font-weight: 800; color: ${is1 ? '#b45309' : 'var(--color-saibro)'};">
                                                ${p.total_points} pts
                                            </div>
                                            <div style="font-size: 10px; color: var(--color-grey-text);">
                                                ${p.position}º lugar
                                            </div>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

/* ====================================================================
   ABA 3: RECORDES & FOMINHAS DO ANO (SUPERLATIVOS)
   ==================================================================== */
function renderRecordsTab(container) {
    const c = clubData || {};
    const mostActive = c.most_active_player;
    const topScorer = c.top_scorer;
    const bestWinrate = c.best_win_rate_player;
    const topRivalry = c.top_rivalry;

    container.innerHTML = `
        <div>
            <!-- Resumo Geral em Números -->
            <div class="card" style="background: linear-gradient(135deg, rgba(192, 81, 49, 0.08), rgba(245, 158, 11, 0.08)); border: 1.5px solid rgba(192, 81, 49, 0.3); margin-bottom: 16px;">
                <div style="font-size: 13px; font-weight: 800; color: var(--color-saibro); margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                    <span>📊</span> Balanço Geral da Temporada ${selectedYear}
                </div>
                <div style="display: flex; justify-content: space-around; text-align: center; padding-top: 6px;">
                    <div>
                        <div style="font-size: 24px; font-weight: 900; color: var(--color-saibro);">${c.total_games || 0}</div>
                        <div style="font-size: 11px; color: var(--color-grey-text); font-weight: 700;">Partidas Oficiais</div>
                    </div>
                    <div>
                        <div style="font-size: 24px; font-weight: 900; color: var(--color-preto);">${c.total_players || 0}</div>
                        <div style="font-size: 11px; color: var(--color-grey-text); font-weight: 700;">Tenistas Ativos</div>
                    </div>
                    <div>
                        <div style="font-size: 24px; font-weight: 900; color: #f59e0b;">${(c.total_games || 0) * 12}</div>
                        <div style="font-size: 11px; color: var(--color-grey-text); font-weight: 700;">Games Disputados</div>
                    </div>
                </div>
            </div>

            <!-- Cards de Superlativos / Destaques -->
            <div style="display: flex; flex-direction: column; gap: 12px;">
                <!-- O Fominha do Ano -->
                <div class="card" style="border-left: 5px solid #f97316;">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
                        <span style="font-size: 26px;">🔥</span>
                        <div>
                            <div style="font-size: 14px; font-weight: 800; color: #ea580c;">O Fominha do Ano</div>
                            <div style="font-size: 11px; color: var(--color-grey-text);">Quem mais entrou em quadra para disputar partidas oficiais</div>
                        </div>
                    </div>
                    ${mostActive ? `
                        <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(249, 115, 22, 0.08); padding: 10px 14px; border-radius: var(--radius-md); margin-top: 6px;">
                            <div style="font-weight: 800; font-size: 14px; color: var(--color-preto);">
                                👤 ${mostActive.display_name}
                                <div style="font-size: 11px; color: var(--color-grey-text); font-weight: 600;">Nível ${mostActive.current_level} • ${mostActive.gender}</div>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-size: 18px; font-weight: 900; color: #ea580c;">${mostActive.total_games} jogos</div>
                                <div style="font-size: 10px; color: var(--color-grey-text); font-weight: 700;">${mostActive.total_wins} vitórias</div>
                            </div>
                        </div>
                    ` : '<p style="font-size: 12px; color: var(--color-grey-text);">Nenhum registro ainda.</p>'}
                </div>

                <!-- Maior Pontuador Geral -->
                <div class="card" style="border-left: 5px solid #f59e0b;">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
                        <span style="font-size: 26px;">⚡</span>
                        <div>
                            <div style="font-size: 14px; font-weight: 800; color: #d97706;">Maior Pontuador Geral</div>
                            <div style="font-size: 11px; color: var(--color-grey-text);">O tenista que acumulou a maior quantidade de pontos no ano</div>
                        </div>
                    </div>
                    ${topScorer ? `
                        <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(245, 158, 11, 0.08); padding: 10px 14px; border-radius: var(--radius-md); margin-top: 6px;">
                            <div style="font-weight: 800; font-size: 14px; color: var(--color-preto);">
                                👤 ${topScorer.display_name}
                                <div style="font-size: 11px; color: var(--color-grey-text); font-weight: 600;">Nível ${topScorer.current_level} • ${topScorer.gender}</div>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-size: 18px; font-weight: 900; color: #d97706;">${topScorer.total_points} pts</div>
                                <div style="font-size: 10px; color: var(--color-grey-text); font-weight: 700;">em ${topScorer.total_games} jogos</div>
                            </div>
                        </div>
                    ` : '<p style="font-size: 12px; color: var(--color-grey-text);">Nenhum registro ainda.</p>'}
                </div>

                <!-- Mais Eficiente / Imparável -->
                <div class="card" style="border-left: 5px solid #22c55e;">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
                        <span style="font-size: 26px;">🎯</span>
                        <div>
                            <div style="font-size: 14px; font-weight: 800; color: #16a34a;">Mais Eficiente (Aproveitamento)</div>
                            <div style="font-size: 11px; color: var(--color-grey-text);">Maior taxa de vitórias da temporada (mínimo de 2 jogos)</div>
                        </div>
                    </div>
                    ${bestWinrate ? `
                        <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(34, 197, 94, 0.08); padding: 10px 14px; border-radius: var(--radius-md); margin-top: 6px;">
                            <div style="font-weight: 800; font-size: 14px; color: var(--color-preto);">
                                👤 ${bestWinrate.display_name}
                                <div style="font-size: 11px; color: var(--color-grey-text); font-weight: 600;">Nível ${bestWinrate.current_level} • ${bestWinrate.gender}</div>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-size: 18px; font-weight: 900; color: #16a34a;">${bestWinrate.win_rate}%</div>
                                <div style="font-size: 10px; color: var(--color-grey-text); font-weight: 700;">${bestWinrate.total_wins}V em ${bestWinrate.total_games} jogos</div>
                            </div>
                        </div>
                    ` : '<p style="font-size: 12px; color: var(--color-grey-text);">Nenhum tenista com 2+ jogos ainda.</p>'}
                </div>

                <!-- Maior Rivalidade / Duelo do Ano -->
                <div class="card" style="border-left: 5px solid #8b5cf6;">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
                        <span style="font-size: 26px;">⚔️</span>
                        <div>
                            <div style="font-size: 14px; font-weight: 800; color: #7c3aed;">Maior Duelo do Ano (Rivalidade)</div>
                            <div style="font-size: 11px; color: var(--color-grey-text);">A dupla de tenistas que mais disputou partidas entre si</div>
                        </div>
                    </div>
                    ${topRivalry && topRivalry.player1_name ? `
                        <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(139, 92, 246, 0.08); padding: 10px 14px; border-radius: var(--radius-md); margin-top: 6px;">
                            <div style="font-weight: 800; font-size: 13px; color: var(--color-preto);">
                                🎾 ${topRivalry.player1_name.split(' ')[0]} <span style="color: var(--color-grey-text);">vs</span> ${topRivalry.player2_name.split(' ')[0]}
                                <div style="font-size: 11px; color: var(--color-grey-text); font-weight: 600;">Clássico da Montreal</div>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-size: 18px; font-weight: 900; color: #7c3aed;">${topRivalry.matches_count} jogos</div>
                                <div style="font-size: 10px; color: var(--color-grey-text); font-weight: 700;">confrontos diretos</div>
                            </div>
                        </div>
                    ` : '<p style="font-size: 12px; color: var(--color-grey-text);">Nenhum confronto duplo registrado ainda.</p>'}
                </div>
            </div>
        </div>
    `;
}
