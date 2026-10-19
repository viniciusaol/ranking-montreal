/* ====================================================================
   MONTREAL TÊNIS CLUBE - SERVIÇO DE NOTIFICAÇÕES (UAZAPI / N8N / WHATSAPP)
   ==================================================================== */

import { CONFIG } from './config.js';
import { db } from './supabase.js';
import { formatDateBR, formatTimeHM } from './utils.js';

/**
 * Retorna os níveis que podem entrar em uma partida de determinado nível.
 * Ex: Em um jogo de Nível B, jogadores de Nível B e C podem participar.
 */
function getAllowedChallengersText(gameLevel) {
    switch (gameLevel) {
        case 'A': return 'Jogadores de Nível A e B';
        case 'B': return 'Jogadores de Nível B e C';
        case 'C': return 'Jogadores de Nível C e D';
        case 'D': return 'Jogadores de Nível D';
        default: return `Jogadores de Nível ${gameLevel}`;
    }
}

/**
 * Converte data ISO (YYYY-MM-DD) em texto amigável com dia da semana.
 */
function formatFriendlyDate(dateStr) {
    if (!dateStr) return '';
    try {
        const [year, month, day] = dateStr.split('-').map(Number);
        const d = new Date(year, month - 1, day);
        const dayNames = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
        const dayName = dayNames[d.getDay()];
        return `${dayName}, ${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
    } catch {
        return formatDateBR(dateStr);
    }
}

/**
 * Notifica o grupo de WhatsApp do Ranking sobre uma nova partida aberta criada.
 * Envia para o n8n (se configurado) ou diretamente via Uazapi.
 */
export async function notifyOpenGameCreated(game, creator) {
    if (!CONFIG.NOTIFICATIONS || !CONFIG.NOTIFICATIONS.ENABLED) {
        return { success: false, reason: 'Notifications disabled' };
    }

    const gameId = game.id;
    const creatorName = creator?.display_name || 'Um tenista da Montreal';
    const level = game.accepted_level || 'C';
    const friendlyDate = formatFriendlyDate(game.game_date);
    const friendlyTime = formatTimeHM(game.start_time);
    const duration = game.duration_minutes ? `${game.duration_minutes} min` : '60 min';
    const allowedChallengers = getAllowedChallengersText(level);
    
    // Link limpo, curto e direto para a aba de Jogos Abertos (sem códigos UUID longos)
    const baseUrl = CONFIG.APP_PUBLIC_URL || (window.location.origin + window.location.pathname.replace(/\/+$/, ''));
    const gameLink = `${baseUrl}/#/jogos/abertos`;

    const messageText = 
`🎾 *NOVO DESAFIO ABERTO NO RANKING!*

👤 *Criador:* ${creatorName}
🏆 *Nível da Partida:* Nível ${level} (${game.gender_category || 'Masculino'})
👥 *Quem pode entrar:* ${allowedChallengers}
📅 *Data:* ${friendlyDate} às ${friendlyTime}
⏱️ *Duração:* ${duration}
🎾 *Formato:* 1 Set até 8 games (No-Ad)
📍 *Local:* Montreal Tênis Clube

Quem topa o desafio? Acesse o app e entre na partida:
👉 ${gameLink}`;

    const payload = {
        event: 'open_game_created',
        game_id: gameId,
        creator_name: creatorName,
        creator_code: creator?.customer_code,
        level: level,
        gender_category: game.gender_category || 'Masculino',
        game_date: game.game_date,
        friendly_date: friendlyDate,
        start_time: game.start_time,
        friendly_time: friendlyTime,
        duration_minutes: game.duration_minutes,
        game_link: gameLink,
        target_group_jid: CONFIG.NOTIFICATIONS.RANKING_GROUP_JID,
        formatted_message: messageText
    };

    let notificationStatus = 'pending';

    try {
        // Opção 1: Se houver URL do n8n configurada, envia para o n8n
        if (CONFIG.NOTIFICATIONS.N8N_WEBHOOK_URL) {
            await fetch(CONFIG.NOTIFICATIONS.N8N_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            notificationStatus = 'sent_via_n8n';
        } 
        // Opção 2: Disparo direto para o Uazapi no grupo
        else if (CONFIG.NOTIFICATIONS.UAZAPI_SERVER_URL && CONFIG.NOTIFICATIONS.UAZAPI_TOKEN && CONFIG.NOTIFICATIONS.RANKING_GROUP_JID) {
            const endpoint = `${CONFIG.NOTIFICATIONS.UAZAPI_SERVER_URL.replace(/\/+$/, '')}/send/text`;
            const resp = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'token': CONFIG.NOTIFICATIONS.UAZAPI_TOKEN
                },
                body: JSON.stringify({
                    number: CONFIG.NOTIFICATIONS.RANKING_GROUP_JID,
                    text: messageText
                })
            });

            if (resp.ok) {
                notificationStatus = 'sent';
            } else {
                const errJson = await resp.json().catch(() => ({}));
                console.warn('Uazapi response error:', errJson);
                notificationStatus = 'failed';
            }
        }
    } catch (err) {
        console.error('Erro ao disparar notificação WhatsApp:', err);
        notificationStatus = 'error';
    }

    // Registra na tabela mt_game_notifications para auditoria e histórico
    try {
        await db.from('mt_game_notifications').insert({
            customer_code: creator?.customer_code,
            event_type: 'open_game',
            game_id: gameId,
            payload: payload,
            status: notificationStatus,
            sent_at: notificationStatus === 'sent' || notificationStatus === 'sent_via_n8n' ? new Date().toISOString() : null
        });
    } catch (dbErr) {
        console.warn('Erro ao registrar log de notificação no banco:', dbErr);
    }

    return { success: notificationStatus === 'sent' || notificationStatus === 'sent_via_n8n', status: notificationStatus };
}
