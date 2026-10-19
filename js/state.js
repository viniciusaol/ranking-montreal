/* ====================================================================
   MONTREAL TÊNIS CLUBE - GERENCIADOR DE ESTADO LOCAL
   ==================================================================== */

import { CONFIG } from './config.js';

class StateManager {
    constructor() {
        this.user = null;
        this.currentView = 'home';
        this.draftGame = this.loadDraftGame();
    }

    setUser(user) {
        this.user = user;
        if (user) {
            localStorage.setItem(CONFIG.STORAGE_KEYS.USER_PROFILE, JSON.stringify(user));
        } else {
            localStorage.removeItem(CONFIG.STORAGE_KEYS.USER_PROFILE);
            localStorage.removeItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN);
        }
    }

    getUser() {
        if (!this.user) {
            const saved = localStorage.getItem(CONFIG.STORAGE_KEYS.USER_PROFILE);
            if (saved) {
                try {
                    this.user = JSON.parse(saved);
                } catch (e) {
                    this.user = null;
                }
            }
        }
        return this.user;
    }

    saveDraftGame(draft) {
        this.draftGame = { ...this.draftGame, ...draft };
        sessionStorage.setItem(CONFIG.STORAGE_KEYS.DRAFT_GAME, JSON.stringify(this.draftGame));
    }

    loadDraftGame() {
        const saved = sessionStorage.getItem(CONFIG.STORAGE_KEYS.DRAFT_GAME);
        return saved ? JSON.parse(saved) : {};
    }

    clearDraftGame() {
        this.draftGame = {};
        sessionStorage.removeItem(CONFIG.STORAGE_KEYS.DRAFT_GAME);
    }
}

export const state = new StateManager();
