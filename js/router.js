/* ====================================================================
   MONTREAL TÊNIS CLUBE - ROTEADOR SPA & DEEP LINKS (CORRIGIDO)
   ==================================================================== */

import { checkAuth } from './auth.js';

class Router {
    constructor() {
        this.routes = {};
        window.addEventListener('hashchange', () => this.handleRoute());
        window.addEventListener('load', () => this.handleRoute());
    }

    addRoute(path, viewHandler) {
        this.routes[path] = viewHandler;
    }

    navigate(path) {
        window.location.hash = `#${path}`;
    }

    async handleRoute() {
        let hash = window.location.hash.slice(1) || '/home';
        
        if (hash === '/login' && checkAuth()) {
            this.navigate('/home');
            return;
        }

        if (hash !== '/login' && !checkAuth()) {
            this.navigate('/login');
            return;
        }

        // Trata rota de criação vs detalhe do jogo
        let routeKey = hash;
        let params = {};

        if (hash === '/jogos/criar') {
            routeKey = '/jogos/criar';
        } else if (hash === '/jogos/abertos') {
            routeKey = '/jogos';
            params.tab = 'open';
        } else if (hash.startsWith('/jogos/') && hash !== '/jogos') {
            const parts = hash.split('/');
            routeKey = '/jogos/detail';
            params.gameId = parts[2];
        }

        const handler = this.routes[routeKey] || this.routes['/home'];
        
        // Atualiza navegação inferior (BottomNav)
        this.updateNavUI(routeKey);

        if (handler) {
            await handler(params);
        }
    }

    updateNavUI(routeKey) {
        document.querySelectorAll('.nav-item').forEach(el => {
            const route = el.getAttribute('data-route');
            if (route === routeKey) {
                el.classList.add('active');
            } else {
                el.classList.remove('active');
            }
        });
    }
}

export const router = new Router();
