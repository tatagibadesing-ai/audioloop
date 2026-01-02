import { createClient } from '@supabase/supabase-js'

// Configuração do Supabase
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null

// Helper para obter token de autenticação
export const getAuthToken = async () => {
    if (!supabase) return null
    const sessionData = await supabase.auth.getSession()
    return sessionData.data.session?.access_token || null
}
