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
                            📜 Como Funciona o Ranking
                        </span>
                        <span style="font-size: 11px; color: var(--color-grey-text);">
                            Regras de jogo, formato e pontuações oficiais
                        </span>
                    </div>
                    <span id="rules-toggle-chevron" style="font-size: 12px; font-weight: 800; color: #0284c7; background: rgba(2, 132, 199, 0.1); padding: 4px 10px; border-radius: 20px; transition: var(--transition-fast);">
                        Ver Regras ▼
                    </span>
                </div>

                <div id="rules-expandable-content" style="display: none; margin-top: 14px; border-top: 1px solid var(--color-grey-border); padding-top: 12px;">
                    <!-- Formato do Jogo -->
                    <div style="margin-bottom: 12px;">
                        <div style="font-size: 12px; font-weight: 800; color: var(--color-preto); margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
                            <span>🎾</span> Formato Oficial das Partidas
                        </div>
                        <div style="font-size: 12px; color: var(--color-text-secondary); line-height: 1.5; background: rgba(0,0,0,0.02); padding: 10px; border-radius: 8px;">
                            • <strong>${cfg.game_format_name}:</strong> ${cfg.game_format_details}
                        </div>
                    </div>

                    <!-- Pontuação Oficial (Espelhada Dinamicamente) -->
                    <div style="margin-bottom: 12px;">
                        <div style="font-size: 12px; font-weight: 800; color: var(--color-preto); margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                            <span>📊</span> Pontuação Oficial no Ranking
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                            <div style="background: rgba(194, 65, 12, 0.08); border: 1px solid rgba(194, 65, 12, 0.2); border-radius: 8px; padding: 10px; text-align: center;">
                                <span style="font-size: 11px; font-weight: 700; color: var(--color-saibro); display: block;">🏆 VITÓRIA</span>
                                <span style="font-size: 20px; font-weight: 900; color: var(--color-saibro);">+${cfg.points_winner}</span>
                                <span style="font-size: 10px; color: var(--color-grey-text); display: block;">pontos</span>
                            </div>
                            <div style="background: rgba(0,0,0,0.03); border: 1px solid var(--color-grey-border); border-radius: 8px; padding: 10px; text-align: center;">
                                <span style="font-size: 11px; font-weight: 700; color: var(--color-preto); display: block;">🎾 PARTICIPAÇÃO</span>
                                <span style="font-size: 20px; font-weight: 900; color: var(--color-preto);">+${cfg.points_loser}</span>
                                <span style="font-size: 10px; color: var(--color-grey-text); display: block;">pontos (derrota)</span>
                            </div>
                        </div>
                    </div>

                    <!-- Bônus Ativos (se houver algum maior que 0) -->
                    ${activeBonuses.length > 0 ? `
                        <div style="margin-bottom: 12px;">
                            <div style="font-size: 12px; font-weight: 800; color: #b45309; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                                <span>✨</span> Bônus Adicionais Ativos na Temporada
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 6px;">
                                ${activeBonuses.map(b => `
                                    <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 8px 10px; display: flex; justify-content: space-between; align-items: center; font-size: 11px;">
                                        <div>
                                            <span style="font-weight: 800; color: #92400e;">${b.icon} ${b.title}</span>
                                            <div style="color: #78350f; font-size: 10px;">${b.desc}</div>
                                        </div>
                                        <span style="font-weight: 900; color: #b45309; font-size: 13px;">${b.points}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}

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
