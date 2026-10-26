/* ====================================================================
   MONTREAL TÊNIS CLUBE - SERVIÇO DE NOTIFICAÇÕES (UAZAPI / N8N / WHATSAPP)
   ==================================================================== */

import { CONFIG } from './config.js';
import { db, callRPC } from './supabase.js';
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

/**
 * Normaliza e formata número de telefone para o padrão do WhatsApp (com DDI 55).
 * Ex: "(41) 98873-1963", "+55 41988731963", "41988731963" -> "5541988731963"
 */
export function formatWhatsAppNumber(phone) {
    if (!phone) return null;
    let clean = String(phone).replace(/\D/g, '');
    if (!clean) return null;
    if (clean.startsWith('0')) clean = clean.substring(1);
    if (clean.length === 10 || clean.length === 11) {
        clean = '55' + clean;
    }
    return clean;
}

/**
 * Notifica um jogador específico via WhatsApp quando ele for convidado para uma partida.
 * A mensagem é enviada DIRETAMENTE ao número do convidado (NÃO vai para o grupo do WhatsApp).
 */
export async function notifyDirectGameInvite(game, creator, invitedPlayer, alreadyConfirmed = false) {
    if (!CONFIG.NOTIFICATIONS || !CONFIG.NOTIFICATIONS.ENABLED) {
        return { success: false, reason: 'Notifications disabled' };
    }

    const targetPhone = formatWhatsAppNumber(invitedPlayer?.phone);
    if (!targetPhone) {
        console.warn('Telefone do convidado não disponível para notificação direta WhatsApp.');
        return { success: false, reason: 'Telefone do convidado não disponível' };
    }

    const gameId = game.id;
    const creatorName = creator?.display_name || creator?.name || 'Um tenista da Montreal';
    const invitedName = invitedPlayer?.display_name || invitedPlayer?.name || 'Tenista';
    const level = game.accepted_level || 'C';
    const friendlyDate = formatFriendlyDate(game.game_date);
    const friendlyTime = formatTimeHM(game.start_time);
    const duration = game.duration_minutes ? `${game.duration_minutes} min` : '60 min';
    
    const baseUrl = CONFIG.APP_PUBLIC_URL || (window.location.origin + window.location.pathname.replace(/\/+$/, ''));
    const gameLink = `${baseUrl}/#/jogos/${gameId}`;

    let messageText;
    if (alreadyConfirmed) {
        messageText = 
`🎾 *NOVA PARTIDA AGENDADA NO RANKING MONTREAL!* 🎾

Olá, *${invitedName}*!
*${creatorName}* acabou de registrar uma partida com você no Ranking Montreal:

🏆 *Nível:* Nível ${level} (${game.gender_category || 'Masculino'})
📅 *Data:* ${friendlyDate} às ${friendlyTime}
⏱️ *Duração:* ${duration}
🎾 *Formato:* 1 Set até 8 games (No-Ad)
📍 *Local:* Montreal Tênis Clube
✅ *Status:* Partida Confirmada

Acesse o aplicativo para ver os detalhes e registrar o placar após o jogo:
👉 ${gameLink}

Bom jogo e nos vemos em quadra! 🎾🔥`;
    } else {
        messageText = 
`🎾 *VOCÊ RECEBEU UM CONVITE PARA JOGAR NO RANKING MONTREAL!* 🎾

Olá, *${invitedName}*!
*${creatorName}* convidou você para uma partida oficial do Ranking Montreal:

🏆 *Nível:* Nível ${level} (${game.gender_category || 'Masculino'})
📅 *Data:* ${friendlyDate} às ${friendlyTime}
⏱️ *Duração:* ${duration}
🎾 *Formato:* 1 Set até 8 games (No-Ad)
📍 *Local:* Montreal Tênis Clube

Acesse o aplicativo para conferir os detalhes e confirmar a partida:
👉 ${gameLink}

Bora pro jogo? 🎾🔥`;
    }

    const payload = {
        event: alreadyConfirmed ? 'direct_game_scheduled' : 'direct_game_invite',
        game_id: gameId,
        creator_name: creatorName,
        creator_code: creator?.customer_code,
        invited_name: invitedName,
        invited_code: invitedPlayer?.customer_code,
        invited_phone: targetPhone,
        level: level,
        game_date: game.game_date,
        friendly_date: friendlyDate,
        start_time: game.start_time,
        friendly_time: friendlyTime,
        duration_minutes: game.duration_minutes,
        already_confirmed: alreadyConfirmed,
        game_link: gameLink,
        target_phone: targetPhone,
        formatted_message: messageText
    };

    let notificationStatus = 'pending';

    try {
        if (CONFIG.NOTIFICATIONS.N8N_WEBHOOK_URL) {
            await fetch(CONFIG.NOTIFICATIONS.N8N_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            notificationStatus = 'sent_via_n8n';
        } else if (CONFIG.NOTIFICATIONS.UAZAPI_SERVER_URL && CONFIG.NOTIFICATIONS.UAZAPI_TOKEN) {
            const endpoint = `${CONFIG.NOTIFICATIONS.UAZAPI_SERVER_URL.replace(/\/+$/, '')}/send/text`;
            const resp = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'token': CONFIG.NOTIFICATIONS.UAZAPI_TOKEN
                },
                body: JSON.stringify({
                    number: targetPhone,
                    text: messageText
                })
            });
            notificationStatus = resp.ok ? 'sent' : 'failed';
        }
    } catch (err) {
        console.error('Erro ao disparar notificação direta via WhatsApp:', err);
        notificationStatus = 'error';
    }

    try {
        await db.from('mt_game_notifications').insert({
            customer_code: invitedPlayer?.customer_code,
            event_type: alreadyConfirmed ? 'direct_scheduled' : 'invite',
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


/**
 * Notifica o grupo de WhatsApp do Ranking quando um tenista aceita e entra em uma partida aberta.
 */
export async function notifyOpenGameJoined(game, creator, challenger) {
    if (!CONFIG.NOTIFICATIONS || !CONFIG.NOTIFICATIONS.ENABLED) {
        return { success: false, reason: 'Notifications disabled' };
    }

    const gameId = game.id;
    const challengerName = challenger?.display_name || challenger?.name || 'Um tenista';
    const creatorName = creator?.display_name || creator?.name || 'Criador';
    const level = game.accepted_level || 'C';
    const friendlyDate = formatFriendlyDate(game.game_date);
    const friendlyTime = formatTimeHM(game.start_time);

    const messageText = 
`🎾 *DESAFIO ACEITO NO RANKING!*

A partida aberta foi aceita e confirmada!

👤 *Jogadores:* ${creatorName} vs ${challengerName}
🏆 *Nível:* Nível ${level} (${game.gender_category || 'Masculino'})
📅 *Data:* ${friendlyDate} às ${friendlyTime}
📍 *Local:* Montreal Tênis Clube

Partida fechada e confirmada. Boa sorte aos tenistas! 🎾🔥`;

    const payload = {
        event: 'open_game_joined',
        game_id: gameId,
        creator_name: creatorName,
        challenger_name: challengerName,
        level: level,
        game_date: game.game_date,
        start_time: game.start_time,
        formatted_message: messageText
    };

    let notificationStatus = 'pending';

    try {
        if (CONFIG.NOTIFICATIONS.UAZAPI_SERVER_URL && CONFIG.NOTIFICATIONS.UAZAPI_TOKEN && CONFIG.NOTIFICATIONS.RANKING_GROUP_JID) {
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
            notificationStatus = resp.ok ? 'sent' : 'failed';
        }
    } catch (err) {
        console.error('Erro ao notificar aceite de jogo no WhatsApp:', err);
        notificationStatus = 'error';
    }

    try {
        await db.from('mt_game_notifications').insert({
            customer_code: challenger?.customer_code,
            event_type: 'game_joined',
            game_id: gameId,
            payload: payload,
            status: notificationStatus,
            sent_at: notificationStatus === 'sent' ? new Date().toISOString() : null
        });
    } catch (dbErr) {
        console.warn('Erro ao registrar log de aceite no banco:', dbErr);
    }

    return { success: notificationStatus === 'sent', status: notificationStatus };
}

/**
 * Envia notificação ao grupo de WhatsApp anunciando o lançamento da Retrospectiva Oficial da Temporada.
 * Enviado no dia 01/12 (ou disparado manualmente pelo Administrador).
 */
export async function notifyRetrospectiveRelease(year = new Date().getFullYear()) {
    if (!CONFIG.NOTIFICATIONS || !CONFIG.NOTIFICATIONS.ENABLED) {
        return { success: false, reason: 'Notifications disabled' };
    }

    const messageText = 
`🎾🏆 *RETROSPECTIVA ${year} LIBERADA NO RANKING MONTREAL!* 🏆🎾

A temporada oficial de *${year}* encerrou em 30 de Novembro e os números finais estão consolidados no saibro da Montreal! 🔥

✨ *O que você encontra no aplicativo:*
🥇 *Hall de Campeões & Pódios:* Conheça os atletas que conquistaram o 1º, 2º e 3º lugar em cada categoria e nível!
📊 *Recordes do Ano:* Descubra quem foi o Fominha do Ano, o Maior Pontuador, o Mais Eficiente e os Grandes Duelos do clube!
📸 *Seu Story de Atleta (Estilo Spotify Wrapped):* Veja quantas partidas você disputou, seus pontos, suas vitórias, seu maior rival e gere seu card exclusivo para postar nos Stories do Instagram!

👉 *Acesse sua Retrospectiva agora mesmo:*
🔗 https://ranking.montrealtenis.com.br/#/ranking

Compartilhe seu Story e marque a Montreal: *@montreal.tenisclube* 🎾✨`;

    const payload = {
        event: 'retrospective_released',
        season_year: year,
        target_group_jid: CONFIG.NOTIFICATIONS.RANKING_GROUP_JID,
        formatted_message: messageText
    };

    let notificationStatus = 'pending';

    try {
        if (CONFIG.NOTIFICATIONS.N8N_WEBHOOK_URL) {
            await fetch(CONFIG.NOTIFICATIONS.N8N_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            notificationStatus = 'sent_via_n8n';
        } else if (CONFIG.NOTIFICATIONS.UAZAPI_SERVER_URL && CONFIG.NOTIFICATIONS.UAZAPI_TOKEN && CONFIG.NOTIFICATIONS.RANKING_GROUP_JID) {
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
            notificationStatus = resp.ok ? 'sent' : 'failed';
        }
    } catch (err) {
        console.error('Erro ao notificar retrospectiva no WhatsApp:', err);
        notificationStatus = 'error';
    }

    try {
        await db.from('mt_game_notifications').insert({
            event_type: 'retrospective_released',
            payload: payload,
            status: notificationStatus,
            sent_at: (notificationStatus === 'sent' || notificationStatus === 'sent_via_n8n') ? new Date().toISOString() : null
        });
    } catch (dbErr) {
        console.warn('Erro ao registrar log de retrospectiva no banco:', dbErr);
    }

    return { 
        success: (notificationStatus === 'sent' || notificationStatus === 'sent_via_n8n'), 
        status: notificationStatus 
    };
}

/**
 * Busca partidas concluídas sem placar e dispara lembretes via WhatsApp
 * para os 2 atletas participantes nas 3 cadências:
 * 1) 15 minutos após o jogo
 * 2) No dia seguinte (+24h)
 * 3) 4 dias após (+96h)
 */
export async function processPendingScoreReminders() {
    if (!CONFIG.NOTIFICATIONS || !CONFIG.NOTIFICATIONS.ENABLED) {
        return { success: false, reason: 'Notificações desabilitadas nas configurações.' };
    }

    try {
        const pendingList = await callRPC('fn_mt_game_obter_pendencias_lembrete_placar');
        if (!pendingList || pendingList.length === 0) {
            return { success: true, total_pending: 0, sent_count: 0, message: 'Nenhuma partida pendente de lembrete no momento.' };
        }

        let sentCount = 0;
        let failCount = 0;

        for (const item of pendingList) {
            try {
                if (CONFIG.NOTIFICATIONS.UAZAPI_SERVER_URL && CONFIG.NOTIFICATIONS.UAZAPI_TOKEN && item.athlete_phone) {
                    const endpoint = `${CONFIG.NOTIFICATIONS.UAZAPI_SERVER_URL.replace(/\/+$/, '')}/send/text`;
                    const resp = await fetch(endpoint, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'token': CONFIG.NOTIFICATIONS.UAZAPI_TOKEN
                        },
                        body: JSON.stringify({
                            number: item.athlete_phone,
                            text: item.formatted_message
                        })
                    });

                    if (resp.ok) {
                        sentCount++;
                        // Registra o envio para este atleta e estágio
                        await callRPC('fn_mt_game_registrar_lembrete_enviado', {
                            p_game_id: item.game_id,
                            p_stage: item.stage,
                            p_customer_code: item.athlete_customer_code
                        });
                    } else {
                        failCount++;
                    }
                }
            } catch (errItem) {
                console.warn(`Erro ao enviar lembrete para ${item.athlete_name}:`, errItem);
                failCount++;
            }
        }

        return {
            success: true,
            total_pending: pendingList.length,
            sent_count: sentCount,
            fail_count: failCount
        };
    } catch (err) {
        console.error('Erro ao processar lembretes de placar:', err);
        return { success: false, error: err.message };
    }
}

/**
 * Busca atletas sem jogar há mais de 1 semana (> 7 dias) e dispara lembretes individuais via WhatsApp
 * incentivando o agendamento de novas partidas oficiais pelo ranking.
 */
export async function processInactivityReminders(minDays = 7, cooldownDays = 7) {
    if (!CONFIG.NOTIFICATIONS || !CONFIG.NOTIFICATIONS.ENABLED) {
        return { success: false, reason: 'Notificações desabilitadas nas configurações.' };
    }

    try {
        const inactiveList = await callRPC('fn_mt_ranking_obter_atletas_inativos_lembrete', {
            p_min_days_inactive: minDays,
            p_cooldown_days: cooldownDays
        });

        if (!inactiveList || inactiveList.length === 0) {
            return { success: true, total_pending: 0, sent_count: 0, message: 'Nenhum atleta elegível para lembrete de inatividade no momento.' };
        }

        let sentCount = 0;
        let failCount = 0;

        for (const item of inactiveList) {
            try {
                if (CONFIG.NOTIFICATIONS.UAZAPI_SERVER_URL && CONFIG.NOTIFICATIONS.UAZAPI_TOKEN && item.athlete_phone) {
                    const endpoint = `${CONFIG.NOTIFICATIONS.UAZAPI_SERVER_URL.replace(/\/+$/, '')}/send/text`;
                    const resp = await fetch(endpoint, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'token': CONFIG.NOTIFICATIONS.UAZAPI_TOKEN
                        },
                        body: JSON.stringify({
                            number: item.athlete_phone,
                            text: item.formatted_message
                        })
                    });

                    if (resp.ok) {
                        sentCount++;
                        await callRPC('fn_mt_ranking_registrar_lembrete_inatividade', {
                            p_customer_code: item.customer_code,
                            p_days_inactive: item.days_inactive
                        });
                    } else {
                        failCount++;
                    }
                }
            } catch (errItem) {
                console.warn(`Erro ao enviar lembrete de inatividade para ${item.athlete_name}:`, errItem);
                failCount++;
            }
        }

        return {
            success: true,
            total_pending: inactiveList.length,
            sent_count: sentCount,
            fail_count: failCount
        };
    } catch (err) {
        console.error('Erro ao processar lembretes de inatividade:', err);
        return { success: false, error: err.message };
    }
}

/**
 * Envia uma mensagem motivacional semanal no grupo do WhatsApp da Montreal
 * estimulando todos os tenistas a movimentarem a rodada e criarem desafios abertos.
 */
export async function notifyWeeklyRankingRound() {
    if (!CONFIG.NOTIFICATIONS || !CONFIG.NOTIFICATIONS.ENABLED) {
        return { success: false, reason: 'Notificações desabilitadas nas configurações.' };
    }

    const groupJid = CONFIG.NOTIFICATIONS.RANKING_GROUP_JID;
    if (!groupJid) {
        return { success: false, reason: 'Grupo do WhatsApp não configurado nas configurações.' };
    }

    const baseUrl = CONFIG.APP_PUBLIC_URL || (window.location.origin + window.location.pathname.replace(/\/+$/, ''));
    const createGameLink = `${baseUrl}/#/jogos/criar`;
    const openGamesLink = `${baseUrl}/#/jogos/abertos`;

    const messageText = 
`🎾 *SEMANA DO RANKING MONTREAL: BORA PRO SAIBRO!* 🎾

Fala, tenistas da Montreal! 🔥
Começando mais uma semana decisiva para movimentar o Ranking!

💡 *Dicas para a rodada desta semana:*
• Mantenha o ritmo de jogos para subir na tabela e evitar perda por inatividade;
• Cada vitória soma +30 pontos e a participação soma +10 pontos no seu nível;
• Atletas podem desafiar tenistas do seu nível atual ou de 1 nível acima!

📱 *Como jogar nesta semana:*
1️⃣ *Crie um Desafio Aberto:* Escolha seu horário ideal e o app avisa todo mundo no grupo!
👉 ${createGameLink}

2️⃣ *Confira as Vagas Abertas:* Veja quem já está esperando adversário no app:
👉 ${openGamesLink}

3️⃣ *Convite um Amigo Direto:* Agende sua partida buscando qualquer tenista do clube pelo WhatsApp.

Uma ótima semana e excelentes jogos a todos no Montreal Tênis Clube! 🎾👊`;

    try {
        if (CONFIG.NOTIFICATIONS.UAZAPI_SERVER_URL && CONFIG.NOTIFICATIONS.UAZAPI_TOKEN) {
            const endpoint = `${CONFIG.NOTIFICATIONS.UAZAPI_SERVER_URL.replace(/\/+$/, '')}/send/text`;
            const resp = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'token': CONFIG.NOTIFICATIONS.UAZAPI_TOKEN
                },
                body: JSON.stringify({
                    number: groupJid,
                    text: messageText
                })
            });

            if (resp.ok) {
                // Registra log da mensagem de grupo
                try {
                    await db.from('mt_game_notifications').insert({
                        customer_code: 'SYSTEM_ADMIN',
                        event_type: 'weekly_group_round_call',
                        status: 'sent',
                        sent_at: new Date().toISOString(),
                        payload: {
                            event: 'weekly_group_round_call',
                            target_group_jid: groupJid,
                            formatted_message: messageText
                        }
                    });
                } catch (dbErr) {
                    console.warn('Erro ao registrar log de notificação semanal no banco:', dbErr);
                }

                return { success: true, message: 'Mensagem semanal da rodada enviada com sucesso no grupo do WhatsApp!' };
            } else {
                const errJson = await resp.json().catch(() => ({}));
                return { success: false, error: errJson.message || 'Falha ao enviar para o grupo via Uazapi.' };
            }
        }
        return { success: false, reason: 'Uazapi não configurado.' };
    } catch (err) {
        console.error('Erro ao enviar mensagem semanal no grupo:', err);
        return { success: false, error: err.message };
    }
}

/**
 * Busca jogos abertos sem adversário e dispara uma única mensagem consolidada
 * de resumo para o grupo do ranking no WhatsApp (cooldown de 3 dias / 70h).
 */
export async function processOpenGamesDigest(ignoreCooldown = false) {
    if (!CONFIG.NOTIFICATIONS || !CONFIG.NOTIFICATIONS.ENABLED) {
        return { success: false, reason: 'Notificações desabilitadas nas configurações.' };
    }

    try {
        const digestList = await callRPC('fn_mt_ranking_obter_resumo_jogos_abertos_grupo', {
            p_min_hours_between_sends: 70,
            p_ignore_cooldown: ignoreCooldown
        });

        if (!digestList || digestList.length === 0) {
            return { 
                success: true, 
                total_open_games: 0, 
                sent: false, 
                message: ignoreCooldown ? 'Nenhum jogo aberto sem adversário no momento.' : 'Nenhum envio necessário (sem jogos abertos ou disparado nos últimos 3 dias).' 
            };
        }

        const digest = digestList[0];
        const targetGroup = digest.target_group_jid || CONFIG.NOTIFICATIONS.RANKING_GROUP_JID;

        if (CONFIG.NOTIFICATIONS.UAZAPI_SERVER_URL && CONFIG.NOTIFICATIONS.UAZAPI_TOKEN && targetGroup) {
            const endpoint = `${CONFIG.NOTIFICATIONS.UAZAPI_SERVER_URL.replace(/\/+$/, '')}/send/text`;
            const resp = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'token': CONFIG.NOTIFICATIONS.UAZAPI_TOKEN
                },
                body: JSON.stringify({
                    number: targetGroup,
                    text: digest.formatted_message
                })
            });

            if (resp.ok) {
                // Registra o envio no banco
                await callRPC('fn_mt_ranking_registrar_resumo_jogos_abertos', {
                    p_total_games: digest.total_open_games,
                    p_game_ids: digest.open_game_ids
                });

                return {
                    success: true,
                    total_open_games: digest.total_open_games,
                    sent: true,
                    message: `Resumo com ${digest.total_open_games} jogo(s) aberto(s) enviado com sucesso no grupo do WhatsApp!`
                };
            } else {
                const errJson = await resp.json().catch(() => ({}));
                return { success: false, error: errJson.message || 'Falha ao enviar resumo para o grupo via Uazapi.' };
            }
        }
        return { success: false, reason: 'Uazapi não configurado.' };
    } catch (err) {
        console.error('Erro ao processar resumo de jogos abertos:', err);
        return { success: false, error: err.message };
    }
}

/**
 * Envia o código de segurança (OTP) de 6 dígitos diretamente para o WhatsApp do atleta
 * para validação de identidade no login do aplicativo.
 */
export async function sendAuthCodeWhatsApp(whatsappNumber, name, code) {
    if (!CONFIG.NOTIFICATIONS || !CONFIG.NOTIFICATIONS.ENABLED) {
        return { success: false, reason: 'Notifications disabled' };
    }

    const targetNumber = formatWhatsAppNumber(whatsappNumber);
    if (!targetNumber) {
        return { success: false, reason: 'Número de WhatsApp inválido' };
    }

    const firstName = (name || 'Atleta').trim().split(' ')[0];
    const messageText = 
`🎾 *CÓDIGO DE ACESSO - RANKING MONTREAL* 🎾

Olá, *${firstName}*!
Seu código de segurança para entrar no aplicativo do Ranking é:

🔑 *${code}*

_(Válido por 10 minutos. Nunca compartilhe este código com ninguém)._`;

    const payload = {
        event: 'auth_otp',
        target_phone: targetNumber,
        athlete_name: name,
        code: code,
        formatted_message: messageText
    };

    let notificationStatus = 'pending';

    try {
        if (CONFIG.NOTIFICATIONS.UAZAPI_SERVER_URL && CONFIG.NOTIFICATIONS.UAZAPI_TOKEN) {
            const endpoint = `${CONFIG.NOTIFICATIONS.UAZAPI_SERVER_URL.replace(/\/+$/, '')}/send/text`;
            const resp = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'token': CONFIG.NOTIFICATIONS.UAZAPI_TOKEN
                },
                body: JSON.stringify({
                    number: targetNumber,
                    text: messageText
                })
            });

            if (resp.ok) {
                notificationStatus = 'sent';
            } else {
                const errData = await resp.json().catch(() => ({}));
                console.warn('Erro ao disparar código WhatsApp via Uazapi:', errData);
                notificationStatus = 'failed';
            }
        }
    } catch (err) {
        console.error('Falha de rede ao disparar código WhatsApp:', err);
        notificationStatus = 'error';
    }

    try {
        await db.from('mt_game_notifications').insert({
            event_type: 'auth_otp',
            payload: payload,
            status: notificationStatus,
            sent_at: notificationStatus === 'sent' ? new Date().toISOString() : null
        });
    } catch (dbErr) {
        console.warn('Erro ao gravar log de código no banco:', dbErr);
    }

    return { 
        success: notificationStatus === 'sent', 
        status: notificationStatus 
    };
}



