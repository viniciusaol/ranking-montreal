/* ====================================================================
   MONTREAL TÊNIS CLUBE - TELA INICIAL (COM CONSULTA DE 5 DIAS)
   ==================================================================== */

import { state } from '../state.js';
import { callRPC } from '../supabase.js';
import { formatDateBR, openMontrealBooking, getCurrentSeasonYear } from '../utils.js?v=1.5.7';

let selectedDate = new Date().toISOString().split('T')[0];

export async function renderHome() {
    const container = document.getElementById('view-content');
    const user = state.getUser();

    if (!user) return;

    const seasonYear = getCurrentSeasonYear();

    // Carrega configurações ativas de pontuação e regras do ranking
    let cfg = {
        points_winner: 30,
        points_loser: 10,
        bonus_bagel_shutout: 0,
        bonus_tiebreak_loss: 0,
        bonus_underdog_win: 0,
        points_per_game_won: 0,
        game_format_name: '1 Set até 8 games (No-Ad)',
        game_format_details: 'Partida disputada em 1 set até 8 games. Em caso de empate em 7x7, disputa-se um Tiebreak até 7 pontos (com diferença de 2) e o vencedor fecha a partida por 8x7. Todos os games são disputados sem vantagem (No-Ad — no 40x40 o recebedor escolhe o lado para receber o saque decisivo).',
        custom_notes: ''
    };
    try {
        const fetchedCfg = await callRPC('fn_mt_ranking_obter_config');
        if (fetchedCfg) cfg = { ...cfg, ...fetchedCfg };
    } catch (e) {
        console.warn('Erro ao carregar regras na Home:', e);
    }

    const activeBonuses = [];
    if (cfg.bonus_bagel_shutout > 0) {
        activeBonuses.push({
            icon: '🔥',
            title: 'Vitória Dominante (Pneu)',
            desc: 'Adversário com 2 ou menos games na partida',
            points: `+${cfg.bonus_bagel_shutout} pts`
        });
    }
    if (cfg.bonus_tiebreak_loss > 0) {
        activeBonuses.push({
            icon: '⚔️',
            title: 'Combatividade no Tiebreak',
            desc: 'Derrota disputada decidida no tiebreak (8x7)',
            points: `+${cfg.bonus_tiebreak_loss} pts`
        });
    }
    if (cfg.bonus_underdog_win > 0) {
        activeBonuses.push({
            icon: '⭐',
            title: 'Desafio a Nível Superior',
            desc: 'Vitória contra adversário de nível acima',
            points: `+${cfg.bonus_underdog_win} pts`
        });
    }
    if (cfg.points_per_game_won > 0) {
        activeBonuses.push({
            icon: '🎾',
            title: 'Pontos por Game Vencido',
            desc: 'Cada game conquistado no set soma pontos adicionais',
            points: `+${cfg.points_per_game_won} pts / game`
        });
    }

    // Gera lista dos próximos 5 dias a partir de hoje
    const dateOptions = [];
    const today = new Date();
    for (let i = 0; i < 5; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        const iso = d.toISOString().split('T')[0];
        
        let label = '';
        if (i === 0) label = 'Hoje';
        else if (i === 1) label = 'Amanhã';
        else {
            const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
            label = `${dayNames[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
        }
        
        dateOptions.push({ iso, label, fullDate: d });
    }

    // Garante que a data selecionada esteja no alcance
    if (!dateOptions.some(opt => opt.iso === selectedDate)) {
        selectedDate = dateOptions[0].iso;
    }

    container.innerHTML = `
        <div class="view-container active">
            <!-- Card de Perfil -->
            <div class="card" style="border-left: 5px solid var(--color-saibro);">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <span style="font-size: var(--font-size-xs); color: var(--color-grey-text); text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Bem-vindo(a)</span>
                        <h2 style="font-size: var(--font-size-xl); font-weight: 800; margin-top: 2px; color: var(--color-preto);">${user.display_name}</h2>
                        <div style="display: flex; gap: var(--space-xs); margin-top: var(--space-xs); flex-wrap: wrap;">
                            <span class="badge badge-level-${user.current_level}">Nível ${user.current_level}</span>
                            <span class="badge badge-success">Posição #${user.rank_position} (Temporada ${seasonYear})</span>
                            <span class="badge" style="background: rgba(192, 81, 49, 0.1); color: var(--color-saibro); font-weight: 800; cursor: pointer;" onclick="window.location.hash='#/jogos'">
                                🎾 Meus Jogos →
                            </span>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <span style="font-size: var(--font-size-2xl); font-weight: 800; color: var(--color-saibro);">${user.total_points}</span>
                        <span style="display: block; font-size: var(--font-size-xs); color: var(--color-grey-text);">Pontos (até 30/11)</span>
                    </div>
                </div>
            </div>

            <!-- Card de Booking Oficial -->
            <div class="card" style="border: 1.5px solid var(--color-booking-blue);">
                <div class="card-title" style="color: var(--color-booking-blue);">
                    <span>🎾 Reserva de Quadras na Montreal</span>
                </div>
                <p style="font-size: var(--font-size-sm); color: var(--color-grey-text); margin-bottom: var(--space-md);">
                    Acesse o sistema oficial de reservas (Matchpoint) para garantir o horário do seu jogo.
                </p>
                <button class="btn btn-booking" id="btn-home-booking">
                    Reservar na Montreal (Matchpoint)
                </button>
            </div>

            <!-- Card de Regulamento Dinâmico & Como Funciona o Ranking -->
            <div class="card" style="border-left: 5px solid #0284c7;">
                <div style="display: flex; justify-content: space-between; align-items: center; cursor: pointer;" id="toggle-rules-banner">
                    <div>
                        <span class="card-title" style="margin: 0; color: #0369a1; display: flex; align-items: center; gap: 6px;">
                            📜 Regulamento Oficial do Ranking
                        </span>
                        <span style="font-size: 11px; color: var(--color-grey-text);">
                            Pontuação, cálculo da classificação, inatividade e regras
                        </span>
                    </div>
                    <span id="rules-toggle-chevron" style="font-size: 12px; font-weight: 800; color: #0284c7; background: rgba(2, 132, 199, 0.1); padding: 4px 10px; border-radius: 20px; transition: var(--transition-fast);">
                        Ver Regulamento ▼
                    </span>
                </div>

                <div id="rules-expandable-content" style="display: none; margin-top: 14px; border-top: 1px solid var(--color-grey-border); padding-top: 12px;">
                    
                    <!-- 1. Formato Oficial das Partidas -->
                    <div style="margin-bottom: 14px;">
                        <div style="font-size: 12px; font-weight: 800; color: var(--color-preto); margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                            <span style="background: rgba(2, 132, 199, 0.15); color: #0284c7; padding: 2px 6px; border-radius: 4px; font-size: 11px;">1</span>
                            <span>Formato Oficial das Partidas</span>
                        </div>
                        <div style="font-size: 12px; color: var(--color-text-secondary); line-height: 1.5; background: rgba(0,0,0,0.02); padding: 10px; border-radius: 8px; border: 1px solid var(--color-grey-border);">
                            • <strong>1 Set até 8 games (No-Ad):</strong> Partida disputada em 1 set até 8 games.<br>
                            • <strong>Empate em 7x7:</strong> Disputa-se um Tiebreak até 7 pontos (com diferença de 2) e o vencedor fecha por 8x7.<br>
                            • <strong>No-Ad (Sem vantagem):</strong> No empate em 40x40, o recebedor escolhe o lado da quadra para receber o saque decisivo.
                        </div>
                    </div>

                    <!-- 2. Pontuação por Partida -->
                    <div style="margin-bottom: 14px;">
                        <div style="font-size: 12px; font-weight: 800; color: var(--color-preto); margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                            <span style="background: rgba(2, 132, 199, 0.15); color: #0284c7; padding: 2px 6px; border-radius: 4px; font-size: 11px;">2</span>
                            <span>Pontuação por Partida</span>
                        </div>
                        <div style="background: white; border: 1px solid var(--color-grey-border); border-radius: 8px; overflow: hidden; margin-bottom: 8px;">
                            <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                                <thead>
                                    <tr style="background: rgba(0,0,0,0.03); border-bottom: 1px solid var(--color-grey-border); text-align: left;">
                                        <th style="padding: 7px 10px; font-weight: 800;">Critério</th>
                                        <th style="padding: 7px 10px; font-weight: 800; text-align: right;">Pontos</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr style="border-bottom: 1px solid rgba(0,0,0,0.04);">
                                        <td style="padding: 7px 10px;">🎾 Participação na partida (ambos recebem)</td>
                                        <td style="padding: 7px 10px; text-align: right; font-weight: 800; color: var(--color-saibro);">+10</td>
                                    </tr>
                                    <tr style="border-bottom: 1px solid rgba(0,0,0,0.04); background: rgba(34, 197, 94, 0.04);">
                                        <td style="padding: 7px 10px; font-weight: 700;">🏆 Vitória na partida (adicional)</td>
                                        <td style="padding: 7px 10px; text-align: right; font-weight: 800; color: #16a34a;">+30</td>
                                    </tr>
                                    <tr style="border-bottom: 1px solid rgba(0,0,0,0.04);">
                                        <td style="padding: 7px 10px;">🔥 Vitória com pneu (8x0 em um set)</td>
                                        <td style="padding: 7px 10px; text-align: right; font-weight: 800; color: #b45309;">+5</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 7px 10px;">⭐ Vitória contra jogador de nível superior</td>
                                        <td style="padding: 7px 10px; text-align: right; font-weight: 800; color: #7c3aed;">+3</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div style="font-size: 11px; color: var(--color-grey-text); line-height: 1.45; padding: 0 4px;">
                            • Os pontos de participação (+10) são concedidos independentemente do resultado.<br>
                            • Os bônus são cumulativos (vencedor pode somar 10 + 30 + 5 + 3 = 48 pts).<br>
                            • O bônus de pneu é limitado a uma vez por partida e concedido apenas ao vencedor.
                        </div>
                    </div>

                    <!-- 3. Cálculo da Classificação -->
                    <div style="margin-bottom: 14px;">
                        <div style="font-size: 12px; font-weight: 800; color: var(--color-preto); margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                            <span style="background: rgba(2, 132, 199, 0.15); color: #0284c7; padding: 2px 6px; border-radius: 4px; font-size: 11px;">3</span>
                            <span>Cálculo da Classificação Oficial</span>
                        </div>
                        <p style="font-size: 11px; color: var(--color-text-secondary); line-height: 1.45; margin-bottom: 8px;">
                            Para equilibrar desempenho e participação, a pontuação acumulada é multiplicada pelo percentual de vitórias do jogador:
                        </p>
                        
                        <!-- Fórmula em Destaque -->
                        <div style="background: linear-gradient(135deg, rgba(2, 132, 199, 0.08), rgba(194, 65, 12, 0.08)); border: 1.5px solid rgba(2, 132, 199, 0.3); border-radius: 8px; padding: 10px; text-align: center; margin-bottom: 8px;">
                            <div style="font-size: 12px; font-weight: 800; color: #0369a1;">
                                Pontuação no Ranking = Pontos Acumulados × Aproveitamento (%)
                            </div>
                        </div>

                        <!-- Card de Exemplo Oficial -->
                        <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; font-size: 11px;">
                            <div style="font-weight: 800; color: #334155; margin-bottom: 4px;">📌 Exemplo Prático:</div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; color: #475569; margin-bottom: 6px;">
                                <div>• Partidas disputadas: <strong>10</strong></div>
                                <div>• Vitórias: <strong>6</strong></div>
                                <div>• Pontos acumulados: <strong>280</strong></div>
                                <div>• Aproveitamento: <strong>60%</strong></div>
                            </div>
                            <div style="border-top: 1px dashed #cbd5e1; padding-top: 6px; font-size: 12px; font-weight: 800; color: var(--color-saibro); text-align: center;">
                                👉 Pontuação no Ranking: 280 × 60% = <strong>168 pontos</strong>
                            </div>
                        </div>
                        <div style="font-size: 10px; color: var(--color-grey-text); margin-top: 6px; font-style: italic;">
                            "Dessa forma, jogar mais contribui para a classificação, mas um baixo aproveitamento reduz a vantagem de quem acumula muitas partidas."
                        </div>
                    </div>

                    <!-- 4. Penalização por Inatividade -->
                    <div style="margin-bottom: 14px;">
                        <div style="font-size: 12px; font-weight: 800; color: var(--color-preto); margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                            <span style="background: rgba(2, 132, 199, 0.15); color: #0284c7; padding: 2px 6px; border-radius: 4px; font-size: 11px;">4</span>
                            <span>Penalização por Inatividade</span>
                        </div>
                        <p style="font-size: 11px; color: var(--color-text-secondary); margin-bottom: 8px;">
                            Para incentivar a participação contínua no clube:
                        </p>
                        <div style="background: white; border: 1px solid var(--color-grey-border); border-radius: 8px; overflow: hidden; margin-bottom: 8px;">
                            <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                                <thead>
                                    <tr style="background: rgba(0,0,0,0.03); border-bottom: 1px solid var(--color-grey-border); text-align: left;">
                                        <th style="padding: 7px 10px; font-weight: 800;">Período sem Jogar</th>
                                        <th style="padding: 7px 10px; font-weight: 800; text-align: right;">Penalização</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr style="border-bottom: 1px solid rgba(0,0,0,0.04);">
                                        <td style="padding: 6px 10px;">Até 30 dias</td>
                                        <td style="padding: 6px 10px; text-align: right; color: #16a34a; font-weight: 800;">Sem penalização</td>
                                    </tr>
                                    <tr style="border-bottom: 1px solid rgba(0,0,0,0.04); background: rgba(234, 179, 8, 0.05);">
                                        <td style="padding: 6px 10px;">31 a 45 dias</td>
                                        <td style="padding: 6px 10px; text-align: right; color: #b45309; font-weight: 800;">-5%</td>
                                    </tr>
                                    <tr style="border-bottom: 1px solid rgba(0,0,0,0.04);">
                                        <td style="padding: 6px 10px;">46 a 60 dias</td>
                                        <td style="padding: 6px 10px; text-align: right; color: #ea580c; font-weight: 800;">-5% adicional</td>
                                    </tr>
                                    <tr style="border-bottom: 1px solid rgba(0,0,0,0.04);">
                                        <td style="padding: 6px 10px;">61 a 75 dias</td>
                                        <td style="padding: 6px 10px; text-align: right; color: #dc2626; font-weight: 800;">-5% adicional</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 6px 10px;">A cada 15 dias seguintes</td>
                                        <td style="padding: 6px 10px; text-align: right; color: #b91c1c; font-weight: 800;">-5% adicional</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div style="font-size: 11px; color: var(--color-grey-text); line-height: 1.45; padding: 0 4px;">
                            • Cada desconto incide sobre a pontuação restante.<br>
                            • O prazo é contado a partir da data da última partida oficial.<br>
                            • Ao disputar uma nova partida, o prazo de inatividade é reiniciado.<br>
                            • Os pontos descontados não são recuperados automaticamente.
                        </div>
                    </div>

                    <!-- 5. Regras Gerais -->
                    <div style="margin-bottom: 14px;">
                        <div style="font-size: 12px; font-weight: 800; color: var(--color-preto); margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                            <span style="background: rgba(2, 132, 199, 0.15); color: #0284c7; padding: 2px 6px; border-radius: 4px; font-size: 11px;">5</span>
                            <span>Regras Gerais de Participação</span>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 6px; font-size: 11px; color: var(--color-text-secondary); line-height: 1.45;">
                            <div style="background: rgba(0,0,0,0.02); padding: 8px 10px; border-radius: 6px;">
                                • Somente partidas oficiais registradas no sistema Montreal serão consideradas.
                            </div>
                            <div style="background: rgba(0,0,0,0.02); padding: 8px 10px; border-radius: 6px;">
                                • Não haverá limite de partidas disputadas na temporada.
                            </div>
                            <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 8px 10px; border-radius: 6px; color: #991b1b;">
                                ⚠️ <strong>Limite de Confrontos:</strong> Cada jogador poderá enfrentar o mesmo adversário <strong>no máximo 2 vezes em um período de 30 dias</strong> para fins de pontuação. O app bloqueia automaticamente a entrada em partidas que excedam esse limite.
                            </div>
                            <div style="background: rgba(0,0,0,0.02); padding: 8px 10px; border-radius: 6px;">
                                • Partidas encerradas por W.O. não geram pontos de participação ou vitória.
                            </div>
                            <div style="background: rgba(0,0,0,0.02); padding: 8px 10px; border-radius: 6px;">
                                • <strong>Critérios de desempate:</strong> 1º Maior aproveitamento (%), 2º Maior número de vitórias e 3º Confronto direto, nessa ordem.
                            </div>
                        </div>
                    </div>

                    <!-- Calendário da Temporada -->
                    <div style="margin-bottom: 10px;">
                        <div style="font-size: 12px; font-weight: 800; color: var(--color-preto); margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
                            <span>📅</span> Temporada & Retrospectiva
                        </div>
                        <div style="font-size: 11px; color: var(--color-grey-text); line-height: 1.4;">
                            • <strong>Jogos Válidos:</strong> De 01 de Janeiro a 30 de Novembro.<br>
                            • <strong>Recesso Oficial:</strong> Durante todo o mês de Dezembro.<br>
                            • <strong>01 de Dezembro:</strong> Lançamento oficial da Retrospectiva Anual e Hall de Campeões.
                        </div>
                    </div>

                    <!-- Observações personalizadas do Admin (se houver) -->
                    ${cfg.custom_notes ? `
                        <div style="background: rgba(2, 132, 199, 0.06); border: 1px solid rgba(2, 132, 199, 0.2); border-radius: 8px; padding: 10px; font-size: 11px; color: #0369a1; line-height: 1.4;">
                            <strong>📌 Aviso da Organização:</strong><br>${cfg.custom_notes}
                        </div>
                    ` : ''}
                </div>
            </div>

            <!-- Quadras Disponíveis com Carrossel / Selector de 5 Dias -->
            <div class="card">
                <div class="card-title" style="margin-bottom: 8px;">
                    <span>⚡ Quadras Livres na Montreal</span>
                </div>

                <!-- Seletor em Pílulas para os Próximos 5 Dias -->
                <div class="date-pills-wrapper" style="display: flex; gap: 6px; overflow-x: auto; padding-bottom: 8px; margin-bottom: 12px; scrollbar-width: none;">
                    ${dateOptions.map(opt => `
                        <button class="btn-date-pill ${opt.iso === selectedDate ? 'active' : ''}" data-date="${opt.iso}" style="
                            flex: 0 0 auto;
                            padding: 6px 12px;
                            border-radius: var(--radius-full);
                            font-size: 12px;
                            font-weight: 700;
                            border: 1px solid ${opt.iso === selectedDate ? 'var(--color-saibro)' : 'var(--color-grey-border)'};
                            background-color: ${opt.iso === selectedDate ? 'var(--color-saibro)' : '#ffffff'};
                            color: ${opt.iso === selectedDate ? '#ffffff' : 'var(--color-preto)'};
                            transition: var(--transition-fast);
                            cursor: pointer;
                        ">
                            ${opt.label}
                        </button>
                    `).join('')}
                </div>
                
                <div id="home-slots-container">
                    <p style="text-align: center; color: var(--color-grey-text); padding: var(--space-md) 0;">Buscando horários...</p>
                </div>
            </div>

            <!-- Atalho Abrir Jogo -->
            <button class="btn btn-primary" id="btn-home-create-game">
                ➕ Abrir Novo Jogo
            </button>
        </div>
    `;

    // Listener para o Regulamento Expansível
    const banner = document.getElementById('toggle-rules-banner');
    const content = document.getElementById('rules-expandable-content');
    const chevron = document.getElementById('rules-toggle-chevron');

    banner?.addEventListener('click', () => {
        if (!content || !chevron) return;
        const isHidden = content.style.display === 'none';
        content.style.display = isHidden ? 'block' : 'none';
        chevron.textContent = isHidden ? 'Recolher ▲' : 'Ver Regras ▼';
        chevron.style.background = isHidden ? 'rgba(2, 132, 199, 0.2)' : 'rgba(2, 132, 199, 0.1)';
    });

    // Listeners das Pílulas de Data
    document.querySelectorAll('.btn-date-pill').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            selectedDate = btn.getAttribute('data-date');
            document.querySelectorAll('.btn-date-pill').forEach(b => {
                b.style.backgroundColor = '#ffffff';
                b.style.color = 'var(--color-preto)';
                b.style.borderColor = 'var(--color-grey-border)';
            });
            btn.style.backgroundColor = 'var(--color-saibro)';
            btn.style.color = '#ffffff';
            btn.style.borderColor = 'var(--color-saibro)';
            await loadCourtSlots(selectedDate);
        });
    });

    document.getElementById('btn-home-booking')?.addEventListener('click', openMontrealBooking);
    document.getElementById('btn-home-create-game')?.addEventListener('click', () => {
        window.location.hash = '#/jogos/criar';
    });

    await loadCourtSlots(selectedDate);
}

async function loadCourtSlots(targetDate) {
    const slotsContainer = document.getElementById('home-slots-container');
    if (!slotsContainer) return;

    try {
        const freeSlots = await callRPC('fn_mt_buscar_quadras_livres', { target_date: targetDate }) || [];

        if (freeSlots.length === 0) {
            slotsContainer.innerHTML = `
                <p style="font-size: var(--font-size-sm); color: var(--color-grey-text); text-align: center; padding: var(--space-md) 0;">
                    Nenhuma quadra vaga encontrada para ${formatDateBR(targetDate)}.
                </p>
            `;
            return;
        }

        slotsContainer.innerHTML = `
            <div style="max-height: 240px; overflow-y: auto; padding-right: 4px;">
                ${freeSlots.map(slot => `
                    <div class="court-slot-item">
                        <div class="court-slot-info">
                            <span class="court-slot-time">${slot.horario_livre}</span>
                            <span class="court-slot-name">${slot.court}</span>
                        </div>
                        <button class="btn btn-booking btn-sm btn-reserve-slot" data-court="${slot.court}" data-time="${slot.horario_livre}">
                            Reservar
                        </button>
                    </div>
                `).join('')}
            </div>
            <span style="font-size: 11px; color: var(--color-grey-text); display: block; margin-top: var(--space-xs); text-align: center;">
                Horários sujeitos à confirmação no sistema de reservas da Montreal.
            </span>
        `;

        document.querySelectorAll('.btn-reserve-slot').forEach(btn => {
            btn.addEventListener('click', () => {
                openMontrealBooking();
            });
        });
    } catch (e) {
        console.error("Erro ao carregar quadras vagas:", e);
        slotsContainer.innerHTML = `<p style="color: var(--color-danger); text-align: center;">Erro ao buscar horários.</p>`;
    }
}
