/* ====================================================================
   MONTREAL TÊNIS CLUBE - AUTENTICAÇÃO E ELEGIBILIDADE PRIVADA
   ==================================================================== */

import { callRPC } from './supabase.js';
import { state } from './state.js';
import { CONFIG } from './config.js';

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
