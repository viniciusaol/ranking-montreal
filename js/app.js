/* ====================================================================
   MONTREAL TÊNIS CLUBE - PONTO DE ENTRADA DA APLICAÇÃO (APP.JS)
   ==================================================================== */

import { router } from './router.js';
import { state } from './state.js';
import { loginWithPhone, checkAuth } from './auth.js';
import { callRPC } from './supabase.js';
import { CONFIG } from './config.js';

import { renderHome } from './views/home.js?v=1.5.7';
import { renderRanking } from './views/ranking.js?v=1.5.7';
import { renderGameCreate } from './views/game-create.js?v=1.5.7';
import { renderGameDetail } from './views/game-detail.js?v=1.5.7';
import { renderMyGames } from './views/my-games.js?v=1.5.7';
import { renderProfile } from './views/profile.js?v=1.5.7';
import { renderAdmin } from './views/admin.js?v=1.5.7';
import { renderRetrospective } from './views/retrospective.js?v=1.6.0';

// Registrar Rotas
router.addRoute('/home', renderHome);
router.addRoute('/ranking', renderRanking);
router.addRoute('/retrospectiva', renderRetrospective);
router.addRoute('/jogos/criar', renderGameCreate);
router.addRoute('/jogos/detail', renderGameDetail);
router.addRoute('/jogos', renderMyGames);
router.addRoute('/perfil', renderProfile);
router.addRoute('/admin', renderAdmin);

document.addEventListener('DOMContentLoaded', async () => {
    // Registra Service Worker se suportado (PWA Ready)
    if ('serviceWorker' in navigator) {
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            try {
                const regs = await navigator.serviceWorker.getRegistrations();
                for (let reg of regs) await reg.unregister();
                if ('caches' in window) {
                    const keys = await caches.keys();
                    for (let k of keys) await caches.delete(k);
                }
            } catch (e) {
                console.warn('SW cleanup error:', e);
            }
        } else {
            try {
                await navigator.serviceWorker.register('./sw.js');
            } catch (e) {
                console.log('SW registration error:', e);
            }
        }
    }

    setupAuthModal();
    setupOnboardingModal();
    setupBottomNav();

    if (checkAuth()) {
        updateHeaderUserBadge();
        checkPendingOnboarding();
    }
});

function setupAuthModal() {
    const authOverlay = document.getElementById('auth-modal-overlay');
    const formLogin = document.getElementById('form-login-phone');
    const inputPhone = document.getElementById('login-phone-number');
    const authErrorMsg = document.getElementById('auth-error-msg');
    const btnSubmit = document.getElementById('btn-submit-login');

    if (!checkAuth()) {
        authOverlay?.classList.add('active');
    }

    // Máscara automática de telefone
    inputPhone?.addEventListener('input', (e) => {
        let clean = e.target.value.replace(/\D/g, '');
        if (clean.length > 11) clean = clean.substring(0, 11);
        
        if (clean.length > 6) {
            e.target.value = `(${clean.substring(0,2)}) ${clean.substring(2,7)}-${clean.substring(7)}`;
        } else if (clean.length > 2) {
            e.target.value = `(${clean.substring(0,2)}) ${clean.substring(2)}`;
        } else {
            e.target.value = clean;
        }
    });

    formLogin?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const rawPhone = inputPhone.value.trim();
        const cleanDigits = rawPhone.replace(/\D/g, '');

        if (!cleanDigits || cleanDigits.length < 10) {
            authErrorMsg.textContent = "Digite o seu telefone cadastrado completo com DDD.";
            authErrorMsg.style.display = 'block';
            return;
        }

        btnSubmit.disabled = true;
        btnSubmit.textContent = "Validando cadastro...";
        authErrorMsg.style.display = 'none';

        try {
            const user = await loginWithPhone(rawPhone);
            authOverlay.classList.remove('active');
            updateHeaderUserBadge();
            
            // Verifica se precisa de Onboarding no primeiro acesso
            if (!user.terms_accepted) {
                showOnboardingModal(user);
            } else {
                const redirectTarget = sessionStorage.getItem('mt_redirect_after_login');
                sessionStorage.removeItem('mt_redirect_after_login');
                router.navigate(redirectTarget && redirectTarget !== '/login' ? redirectTarget : '/home');
            }
        } catch (err) {
            authErrorMsg.textContent = err.message || "Não foi possível realizar o login.";
            authErrorMsg.style.display = 'block';
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.textContent = "Entrar no Aplicativo";
        }
    });
}

function checkPendingOnboarding() {
    const user = state.getUser();
    if (user && !user.terms_accepted) {
        showOnboardingModal(user);
    }
}

function showOnboardingModal(user) {
    const overlay = document.getElementById('onboarding-modal-overlay');
    const inputName = document.getElementById('onboarding-name');
    const selectLevel = document.getElementById('onboarding-level');
    const selectGender = document.getElementById('onboarding-gender');

    if (inputName) inputName.value = user.display_name || user.name;
    if (selectLevel) selectLevel.value = user.current_level || 'C';
    if (selectGender) selectGender.value = user.gender || 'Masculino';

    overlay?.classList.add('active');
}

function setupOnboardingModal() {
    const overlay = document.getElementById('onboarding-modal-overlay');
    const form = document.getElementById('form-onboarding');
    const selectLevel = document.getElementById('onboarding-level');
    const selectGender = document.getElementById('onboarding-gender');
    const descBox = document.getElementById('onboarding-level-desc');

    selectLevel?.addEventListener('change', (e) => {
        const lvl = e.target.value;
        if (descBox) descBox.textContent = CONFIG.LEVEL_DESCRIPTIONS[lvl] || '';
    });

    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = state.getUser();
        if (!user) return;

        const name = document.getElementById('onboarding-name').value.trim();
        const level = selectLevel.value;
        const gender = selectGender?.value || 'Masculino';

        try {
            await callRPC('fn_mt_game_salvar_perfil', {
                p_customer_code: user.customer_code,
                p_display_name: name,
                p_level: level,
                p_gender: gender
            });

            user.display_name = name;
            user.current_level = level;
            user.gender = gender;
            user.terms_accepted = true;
            state.setUser(user);

            overlay?.classList.remove('active');
            updateHeaderUserBadge();
            const redirectTarget = sessionStorage.getItem('mt_redirect_after_login');
            sessionStorage.removeItem('mt_redirect_after_login');
            router.navigate(redirectTarget && redirectTarget !== '/login' ? redirectTarget : '/home');
        } catch (err) {
            alert("Erro ao salvar cadastro: " + err.message);
        }
    });
}

function updateHeaderUserBadge() {
    const user = state.getUser();
    const badgeName = document.getElementById('header-user-name');
    const badgeLevel = document.getElementById('header-user-level');

    if (user && badgeName && badgeLevel) {
        badgeName.textContent = user.display_name.split(' ')[0];
        badgeLevel.textContent = `Nível ${user.current_level}`;
    }
}

function setupBottomNav() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const route = item.getAttribute('data-route');
            if (route) {
                router.navigate(route);
            }
        });
    });
}
