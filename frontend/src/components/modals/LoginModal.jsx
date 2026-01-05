import { useState } from "react"
import { toast } from "react-hot-toast"
import { showToast } from "../ui/PremiumToast"

export default function LoginModal({ onClose, supabase }) {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [mode, setMode] = useState('login') // login ou signup

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!supabase) return showToast.error('Supabase não configurado')

        setLoading(true)
        setError('')

        try {
            if (mode === 'login') {
                const { error } = await supabase.auth.signInWithPassword({ email, password })
                if (error) throw error
                onClose()
            } else {
                const { error } = await supabase.auth.signUp({ email, password })
                if (error) throw error
                setError('Verifique seu email para confirmar o cadastro!')
            }
        } catch (e) {
            setError(e.message || 'Erro')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200
        }} onClick={onClose}>
            <div style={{
                background: '#fff', borderRadius: '16px', padding: '32px',
                width: '90%', maxWidth: '400px', boxShadow: '0 25px 50px rgba(0,0,0,0.25)'
            }} onClick={e => e.stopPropagation()}>
                <h2 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '24px', textAlign: 'center' }}>
                    {mode === 'login' ? 'Entrar' : 'Criar Conta'}
                </h2>

                <form onSubmit={handleSubmit}>
                    <input
                        type="email" placeholder="Email" value={email}
                        onChange={e => setEmail(e.target.value)} required
                        style={{
                            width: '100%', padding: '12px 16px', marginBottom: '12px',
                            border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '16px', boxSizing: 'border-box'
                        }}
                    />
                    <input
                        type="password" placeholder="Senha (mín. 6 caracteres)" value={password}
                        onChange={e => setPassword(e.target.value)} required minLength={6}
                        style={{
                            width: '100%', padding: '12px 16px', marginBottom: '16px',
                            border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '16px', boxSizing: 'border-box'
                        }}
                    />

                    {error && (
                        <p style={{
                            color: error.includes('Verifique') ? '#22c55e' : '#ef4444',
                            fontSize: '14px', marginBottom: '12px', textAlign: 'center'
                        }}>
                            {error}
                        </p>
                    )}

                    <button type="submit" disabled={loading} style={{
                        width: '100%', padding: '12px', background: '#2546C7',
                        color: '#fff', border: 'none', borderRadius: '8px',
                        fontSize: '16px', fontWeight: '500', cursor: 'pointer', marginBottom: '12px'
                    }}>
                        {loading ? 'Aguarde...' : (mode === 'login' ? 'Entrar' : 'Cadastrar')}
                    </button>

                    <button type="button" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                        style={{
                            width: '100%', padding: '12px', background: 'transparent',
                            color: '#2546C7', border: '1px solid #2546C7', borderRadius: '8px',
                            fontSize: '14px', cursor: 'pointer'
                        }}>
                        {mode === 'login' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entre'}
                    </button>
                </form>
            </div>
        </div>
    )
}
