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
