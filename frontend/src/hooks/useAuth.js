import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { ADMIN_EMAIL } from '../constants'

/**
 * Hook customizado para gerenciamento de autenticação
 * Centraliza a lógica de sessão, login, logout e verificação de admin
 */
export function useAuth() {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!supabase) {
            setLoading(false)
            return
        }

        // Obter sessão atual
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null)
            setLoading(false)
        })

        // Escutar mudanças de autenticação
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null)
        })

        return () => subscription.unsubscribe()
    }, [])

    const isAdmin = user?.email === ADMIN_EMAIL

    const logout = async () => {
        if (supabase) {
            await supabase.auth.signOut()
        }
    }

    const getToken = async () => {
        if (!supabase) return null
        const sessionData = await supabase.auth.getSession()
        return sessionData.data.session?.access_token || null
    }

    return {
        user,
        isAdmin,
        loading,
        logout,
        getToken,
        supabase
    }
}
