/* ====================================================================
   MONTREAL TÊNIS CLUBE - PONTO DE ENTRADA DA APLICAÇÃO (APP.JS)
   ==================================================================== */

import { router } from './router.js';
import { state } from './state.js';
import { requestLoginCode, confirmLoginCode, loginWithPhone, checkAuth, refreshUserProfile } from './auth.js?v=1.8.0';
import { callRPC } from './supabase.js';
import { CONFIG } from './config.js';

import { renderHome } from './views/home.js?v=1.9.1';
import { renderRanking } from './views/ranking.js?v=1.5.7';
import { renderGameCreate } from './views/game-create.js?v=1.7.0';
import { renderGameDetail } from './views/game-detail.js?v=1.9.0';
import { renderMyGames } from './views/my-games.js?v=1.5.7';
import { renderProfile } from './views/profile.js?v=1.6.8';
import { renderAdmin } from './views/admin.js?v=1.9.1';
import { renderRetrospective } from './views/retrospective.js?v=1.6.8';

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
        refreshUserProfile().then(() => {
            updateHeaderUserBadge();
        });
    }
});

function setupAuthModal() {
    const authOverlay = document.getElementById('auth-modal-overlay');
    const stepPhone = document.getElementById('auth-step-phone');
    const stepCode = document.getElementById('auth-step-code');
    const formLogin = document.getElementById('form-login-phone');
    const formCode = document.getElementById('form-login-code');
    const inputPhone = document.getElementById('login-phone-number');
    const inputCode = document.getElementById('login-auth-code');
    const phoneDisplay = document.getElementById('auth-phone-display');
    const authErrorMsg = document.getElementById('auth-error-msg');
    const authCodeErrorMsg = document.getElementById('auth-code-error-msg');
    const btnSubmit = document.getElementById('btn-submit-login');
    const btnSubmitCode = document.getElementById('btn-submit-code');
    const btnBackToPhone = document.getElementById('btn-back-to-phone');
    const btnResendCode = document.getElementById('btn-resend-code');

    let resendTimer = null;
    let resendCountdown = 0;

    function startResendCooldown(seconds = 60) {
        clearInterval(resendTimer);
        resendCountdown = seconds;
        if (btnResendCode) {
            btnResendCode.disabled = true;
            btnResendCode.textContent = `Reenviar em ${resendCountdown}s`;
        }

        resendTimer = setInterval(() => {
            resendCountdown--;
            if (resendCountdown <= 0) {
                clearInterval(resendTimer);
                if (btnResendCode) {
                    btnResendCode.disabled = false;
                    btnResendCode.textContent = 'Reenviar código';
                }
            } else {
                if (btnResendCode) {
                    btnResendCode.textContent = `Reenviar em ${resendCountdown}s`;
                }
            }
        }, 1000);
    }

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

    // Sanitização e auto-avanço no campo de código de 6 dígitos
    inputCode?.addEventListener('input', (e) => {
        let clean = e.target.value.replace(/\D/g, '').substring(0, 6);
        e.target.value = clean;
        if (authCodeErrorMsg) authCodeErrorMsg.style.display = 'none';

        // Se completou os 6 dígitos, dispara a validação automaticamente
        if (clean.length === 6) {
            if (typeof formCode.requestSubmit === 'function') {
                formCode.requestSubmit();
            } else {
                formCode.dispatchEvent(new Event('submit', { cancelable: true }));
            }
        }
    });

    // Etapa 1: Enviar código via WhatsApp
    async function handleRequestCode() {
        const rawPhone = inputPhone.value.trim();
        const cleanDigits = rawPhone.replace(/\D/g, '');

        if (!cleanDigits || cleanDigits.length < 10) {
            authErrorMsg.textContent = "Digite o seu telefone cadastrado completo com DDD.";
            authErrorMsg.style.display = 'block';
            return;
        }

        btnSubmit.disabled = true;
        btnSubmit.textContent = "Enviando código no WhatsApp...";
        authErrorMsg.style.display = 'none';

        try {
            await requestLoginCode(rawPhone);
            if (phoneDisplay) phoneDisplay.textContent = `📱 ${inputPhone.value || rawPhone}`;
            if (stepPhone) stepPhone.style.display = 'none';
            if (stepCode) stepCode.style.display = 'block';
            if (inputCode) {
                inputCode.value = '';
                inputCode.focus();
            }
            if (authCodeErrorMsg) authCodeErrorMsg.style.display = 'none';
            startResendCooldown(60);
        } catch (err) {
            authErrorMsg.textContent = err.message || "Não foi possível enviar o código.";
            authErrorMsg.style.display = 'block';
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.textContent = "Receber Código no WhatsApp";
        }
    }

    formLogin?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleRequestCode();
    });

    // Etapa 2: Validar código de 6 dígitos
    formCode?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const rawPhone = inputPhone.value.trim();
        const code = inputCode.value.trim();

        if (!code || code.length !== 6) {
            authCodeErrorMsg.textContent = "Digite os 6 dígitos do código recebido no seu WhatsApp.";
            authCodeErrorMsg.style.display = 'block';
            return;
        }

        btnSubmitCode.disabled = true;
        btnSubmitCode.textContent = "Validando código...";
        authCodeErrorMsg.style.display = 'none';

        try {
            const user = await confirmLoginCode(rawPhone, code);
            clearInterval(resendTimer);
            authOverlay.classList.remove('active');
            
            // Restaura o modal para a etapa 1 para sessões futuras
            setTimeout(() => {
                if (stepCode) stepCode.style.display = 'none';
                if (stepPhone) stepPhone.style.display = 'block';
                if (inputCode) inputCode.value = '';
            }, 500);

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
            authCodeErrorMsg.textContent = err.message || "Código incorreto. Tente novamente.";
            authCodeErrorMsg.style.display = 'block';
            inputCode.select();
        } finally {
            btnSubmitCode.disabled = false;
            btnSubmitCode.textContent = "Confirmar e Entrar";
        }
    });

    // Voltar para a Etapa 1 (trocar número)
    btnBackToPhone?.addEventListener('click', () => {
        if (stepCode) stepCode.style.display = 'none';
        if (stepPhone) stepPhone.style.display = 'block';
        if (authErrorMsg) authErrorMsg.style.display = 'none';
        inputPhone.focus();
    });

    // Reenviar código via WhatsApp
    btnResendCode?.addEventListener('click', async () => {
        if (resendCountdown > 0) return;
        btnResendCode.disabled = true;
        btnResendCode.textContent = "Reenviando...";
        if (authCodeErrorMsg) authCodeErrorMsg.style.display = 'none';

        try {
            await requestLoginCode(inputPhone.value.trim());
            if (inputCode) {
                inputCode.value = '';
                inputCode.focus();
            }
            startResendCooldown(60);
        } catch (err) {
            if (authCodeErrorMsg) {
                authCodeErrorMsg.textContent = err.message || "Erro ao reenviar código.";
                authCodeErrorMsg.style.display = 'block';
            }
            btnResendCode.disabled = false;
            btnResendCode.textContent = "Reenviar código";
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
