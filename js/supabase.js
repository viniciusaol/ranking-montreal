/* ====================================================================
   MONTREAL TÊNIS CLUBE - CONECTOR SUPABASE (ES MODULE)
   ==================================================================== */

import { CONFIG } from './config.js';

// Inicializa o cliente do Supabase a partir do SDK global disponibilizado no index.html
export const db = window.supabase ? window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY) : null;

export async function callRPC(rpcName, params = {}) {
    if (!db) throw new Error("Supabase client não inicializado.");
    const { data, error } = await db.rpc(rpcName, params);
    if (error) {
        console.error(`Erro ao executar RPC ${rpcName}:`, error);
        throw error;
    }
    return data;
}
