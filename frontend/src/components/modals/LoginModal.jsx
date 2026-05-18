import { useState } from "react"
import { Drawer } from "vaul"
import { showToast } from "../ui/PremiumToast"

const inputStyle = {
    width: '100%', padding: '18px 16px', boxSizing: 'border-box',
    background: '#1a1a1a',
    border: 'none', borderRadius: '16px',
    fontSize: '16px', color: '#FCFBF8',
    fontFamily: "'Figtree', sans-serif",
    outline: 'none',
}

export default function LoginModal({ onClose, supabase }) {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [mode, setMode] = useState('login')

    const isMobile = window.innerWidth < 768

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

    const formContent = (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input type="email" placeholder="Email" value={email}
                onChange={e => setEmail(e.target.value)} required style={inputStyle} />
            <input type="password" placeholder="Senha (mín. 6 caracteres)" value={password}
                onChange={e => setPassword(e.target.value)} required minLength={6} style={inputStyle} />

            {error && (
                <p style={{ color: error.includes('Verifique') ? '#4ade80' : '#f87171', fontSize: '14px', textAlign: 'center' }}>
                    {error}
                </p>
            )}

            <button type="submit" disabled={loading} style={{
                width: '100%', padding: '18px', marginTop: '4px',
                background: '#FCFBF8', color: '#090909',
                border: 'none', borderRadius: '16px',
                fontSize: '16px', fontWeight: '600',
                fontFamily: "'Figtree', sans-serif",
                cursor: 'pointer', opacity: loading ? 0.6 : 1,
            }}>
                {loading ? 'Aguarde...' : (mode === 'login' ? 'Entrar' : 'Cadastrar')}
            </button>

            <button type="button" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')} style={{
                width: '100%', padding: '14px',
                background: 'transparent', color: 'rgba(255,255,255,0.35)',
                border: 'none', fontSize: '14px',
                fontFamily: "'Figtree', sans-serif", cursor: 'pointer',
            }}>
                {mode === 'login' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entre'}
            </button>
        </form>
    )

    if (isMobile) {
        return (
            <Drawer.Root open onOpenChange={(open) => { if (!open) onClose() }} shouldScaleBackground>
                <Drawer.Portal>
                    <Drawer.Overlay style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1200 }} />
                    <Drawer.Content style={{
                        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1201,
                        background: '#090909',
                        borderRadius: '24px 24px 0 0',
                        padding: '16px 24px 24px',
                        fontFamily: "'Figtree', sans-serif",
                        outline: 'none',
                    }}>
                        {/* Handle */}
                        <div style={{
                            width: '36px', height: '4px', borderRadius: '2px',
                            background: 'rgba(255,255,255,0.2)',
                            margin: '0 auto 32px',
                        }} />

                        <Drawer.Title style={{
                            fontSize: '20px', fontWeight: '600', color: '#FCFBF8',
                            marginBottom: '24px', textAlign: 'center', letterSpacing: '-0.3px',
                            fontFamily: "'Figtree', sans-serif",
                        }}>
                            {mode === 'login' ? 'Entrar' : 'Criar conta'}
                        </Drawer.Title>

                        {formContent}
                    </Drawer.Content>
                </Drawer.Portal>
            </Drawer.Root>
        )
    }

    // Desktop: modal centralizado
    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0, zIndex: 200,
                background: 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(8px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    width: '100%', maxWidth: '400px',
                    background: '#111111',
                    borderRadius: '24px',
                    padding: '40px 32px',
                    fontFamily: "'Figtree', sans-serif",
                }}
            >
                <h2 style={{
                    fontSize: '22px', fontWeight: '600', color: '#FCFBF8',
                    marginBottom: '28px', textAlign: 'center', letterSpacing: '-0.3px'
                }}>
                    {mode === 'login' ? 'Entrar' : 'Criar conta'}
                </h2>
                {formContent}
            </div>
        </div>
    )
}
