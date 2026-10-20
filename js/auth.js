/* ====================================================================
   MONTREAL TÊNIS CLUBE - AUTENTICAÇÃO E ELEGIBILIDADE PRIVADA
   ==================================================================== */

import { callRPC } from './supabase.js';
import { state } from './state.js';
import { CONFIG } from './config.js';
import { sendAuthCodeWhatsApp } from './notifications.js';

/**
 * Solicita código de segurança (OTP) de 6 dígitos enviado via WhatsApp.
 */
export async function requestLoginCode(rawPhone) {
    const result = await callRPC('fn_mt_auth_solicitar_codigo', {
        p_phone: rawPhone
    });

    if (!result || result.length === 0 || !result[0].success) {
        const reason = (result && result[0]) ? result[0].message : "Não encontramos um cadastro ativo vinculado a este telefone.";
        throw new Error(reason);
    }

    const authData = result[0];

    // Dispara a mensagem com o código no WhatsApp do atleta
    const sendResult = await sendAuthCodeWhatsApp(authData.whatsapp_number, authData.name, authData.code);
    if (!sendResult.success) {
        console.warn('Falha no envio do WhatsApp:', sendResult);
        throw new Error("Não foi possível enviar a mensagem para o seu WhatsApp no momento. Verifique sua conexão e tente novamente.");
    }

    return {
        success: true,
        customer_code: authData.customer_code,
        name: authData.name,
        whatsapp_number: authData.whatsapp_number,
        message: authData.message
    };
}

/**
 * Valida o código de 6 dígitos recebido no WhatsApp e completa a autenticação.
 */
export async function confirmLoginCode(rawPhone, code) {
    const result = await callRPC('fn_mt_auth_validar_codigo', {
        p_phone: rawPhone,
        p_code: code
    });

    if (!result || result.length === 0 || !result[0].success) {
        const reason = (result && result[0]) ? result[0].message : "Código de verificação incorreto ou expirado.";
        throw new Error(reason);
    }

    const eligibleData = result[0];
    const customerCode = eligibleData.customer_code;

    const profileData = await callRPC('fn_mt_game_obter_perfil', {
        p_customer_code: customerCode
    });

    const userProfile = {
        customer_code: customerCode,
        name: eligibleData.name,
        phone: eligibleData.phone,
        is_aluno: eligibleData.is_aluno,
        is_mensalista: eligibleData.is_mensalista,
        display_name: profileData[0]?.display_name || eligibleData.name,
        current_level: profileData[0]?.current_level || 'C',
        gender: profileData[0]?.gender || 'Masculino',
        avatar_url: profileData[0]?.avatar_url,
        is_admin: profileData[0]?.is_admin || false,
        total_points: profileData[0]?.total_points || 0,
        total_games: profileData[0]?.total_games || 0,
        total_wins: profileData[0]?.total_wins || 0,
        rank_position: profileData[0]?.rank_position || 1,
        terms_accepted: !!profileData[0]?.terms_accepted_at
    };

    localStorage.setItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN, customerCode);
    state.setUser(userProfile);
    return userProfile;
}

export async function loginWithPhone(fullPhone, lastDigits = null) {
    const result = await callRPC('fn_mt_game_login_por_telefone', {
        p_phone: fullPhone,
        p_last_digits: lastDigits
    });

    if (!result || result.length === 0 || !result[0].is_eligible) {
        const reason = (result && result[0]) ? result[0].reason : "Não encontramos um cadastro ativo vinculado a este telefone.";
        throw new Error(reason);
    }

    const eligibleData = result[0];
    const customerCode = eligibleData.customer_code;

    const profileData = await callRPC('fn_mt_game_obter_perfil', {
        p_customer_code: customerCode
    });

    const userProfile = {
        customer_code: customerCode,
        name: eligibleData.name,
        phone: eligibleData.phone,
        is_aluno: eligibleData.is_aluno,
        is_mensalista: eligibleData.is_mensalista,
        display_name: profileData[0]?.display_name || eligibleData.name,
        current_level: profileData[0]?.current_level || 'C',
        gender: profileData[0]?.gender || 'Masculino',
        avatar_url: profileData[0]?.avatar_url,
        is_admin: profileData[0]?.is_admin || false,
        total_points: profileData[0]?.total_points || 0,
        total_games: profileData[0]?.total_games || 0,
        total_wins: profileData[0]?.total_wins || 0,
        rank_position: profileData[0]?.rank_position || 1,
        terms_accepted: !!profileData[0]?.terms_accepted_at
    };

    localStorage.setItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN, customerCode);
    state.setUser(userProfile);
    return userProfile;
}

export function logout() {
    state.setUser(null);
    window.location.hash = '#/login';
}


export function checkAuth() {
    const user = state.getUser();
    return !!user;
}

export async function refreshUserProfile() {
    const user = state.getUser();
    if (!user || !user.customer_code) return null;
    try {
        const profileData = await callRPC('fn_mt_game_obter_perfil', {
            p_customer_code: user.customer_code
        });
        if (profileData && profileData.length > 0) {
            const p = profileData[0];
            const updated = {
                ...user,
                display_name: p.display_name || user.display_name,
                current_level: p.current_level || user.current_level,
                gender: p.gender || user.gender,
                avatar_url: p.avatar_url !== undefined ? p.avatar_url : user.avatar_url,
                is_admin: p.is_admin || false,
                total_points: p.total_points ?? user.total_points,
                total_games: p.total_games ?? user.total_games,
                total_wins: p.total_wins ?? user.total_wins,
                rank_position: p.rank_position ?? user.rank_position,
                terms_accepted: !!p.terms_accepted_at
            };
            state.setUser(updated);
            return updated;
        }
    } catch (e) {
        console.warn('Falha na sincronização silenciosa de perfil:', e);
    }
    return user;
}

