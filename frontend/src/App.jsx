import { useState, useRef, useEffect } from "react"
import { createClient } from '@supabase/supabase-js'

// Configuração
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
const supabase = SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null

const API_URL = import.meta.env.VITE_API_URL ||
    (window.location.hostname === 'localhost' ? 'http://localhost:5000' :
        window.location.origin.replace(':3000', ':5000'))

// Email do admin (hardcoded para segurança - verificação dupla no backend)
const ADMIN_EMAIL = '2closett@gmail.com'

const VOICES = [
    { value: 'pt-BR-AntonioNeural', label: 'Antônio (PT-BR)' },
    { value: 'pt-BR-FranciscaNeural', label: 'Francisca (PT-BR)' },
    { value: 'pt-BR-ThalitaNeural', label: 'Thalita (PT-BR)' },
    { value: 'en-US-GuyNeural', label: 'Guy (EN-US)' },
    { value: 'en-US-JennyNeural', label: 'Jenny (EN-US)' }
]

const formatTime = (seconds) => {
    if (seconds <= 0) return "0s"
    if (seconds < 60) return `${Math.round(seconds)}s`
    if (seconds < 3600) {
        const m = Math.floor(seconds / 60)
        const s = Math.round(seconds % 60)
        return s > 0 ? `${m}m ${s}s` : `${m}m`
    }
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    return m > 0 ? `${h}h ${m}m` : `${h}h`
}

const estimateAudioDuration = (text) => {
    const words = text.trim().split(/\s+/).length
    const seconds = Math.ceil(words / 150 * 60)
    return formatTime(seconds)
}

// ==================== COMPONENTE PRINCIPAL ====================
export default function App() {
    const [page, setPage] = useState(window.location.hash === '#admin' ? 'admin' : 'home')
    const [user, setUser] = useState(null)
    const [showLoginModal, setShowLoginModal] = useState(false)

    useEffect(() => {
        if (!supabase) return

        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null)
        })

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null)
        })

        return () => subscription.unsubscribe()
    }, [])

    useEffect(() => {
        const handleHash = () => {
            setPage(window.location.hash === '#admin' ? 'admin' : 'home')
        }
        window.addEventListener('hashchange', handleHash)
        return () => window.removeEventListener('hashchange', handleHash)
    }, [])

    const isAdmin = user?.email === ADMIN_EMAIL

    return (
        <div style={{ minHeight: '100vh' }}>
            <Header user={user} isAdmin={isAdmin} setShowLoginModal={setShowLoginModal} />

            {page === 'admin' ? (
                <AdminPage user={user} isAdmin={isAdmin} setShowLoginModal={setShowLoginModal} />
            ) : (
                <HomePage user={user} />
            )}

            {showLoginModal && (
                <LoginModal onClose={() => setShowLoginModal(false)} />
            )}
        </div>
    )
}

// ==================== HEADER ====================
function Header({ user, isAdmin, setShowLoginModal }) {
    const handleLogout = async () => {
        if (supabase) await supabase.auth.signOut()
    }

    return (
        <header style={{
            position: 'fixed', top: 0, left: 0, right: 0, height: '60px',
            background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(15px)',
            borderBottom: '1px solid rgba(255,255,255,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 24px', zIndex: 100
        }}>
            <a href="#" style={{ fontWeight: '600', fontSize: '18px', color: '#0f172a', textDecoration: 'none' }}>
                AudioLoop
            </a>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                {isAdmin && (
                    <a href="#admin" style={{
                        background: '#2546C7', color: '#fff', padding: '6px 14px',
                        borderRadius: '8px', fontSize: '13px', fontWeight: '500', textDecoration: 'none'
                    }}>
                        Painel Admin
                    </a>
                )}

                {user ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '14px', color: '#64748b' }}>{user.email}</span>
                        <button onClick={handleLogout} style={{
                            background: 'transparent', border: '1px solid #e2e8f0',
                            borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '14px'
                        }}>
                            Sair
                        </button>
                    </div>
                ) : (
                    <button onClick={() => setShowLoginModal(true)} style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        background: '#f1f5f9', border: 'none', borderRadius: '8px',
                        padding: '8px 16px', cursor: 'pointer', fontSize: '14px', color: '#475569'
                    }}>
                        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Entrar
                    </button>
                )}
            </div>
        </header>
    )
}

// ==================== MODAL DE LOGIN ====================
function LoginModal({ onClose }) {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [mode, setMode] = useState('login') // login ou signup

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!supabase) return alert('Supabase não configurado')

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

// ==================== PÁGINA HOME (Gerador) ====================
function HomePage({ user }) {
    const [text, setText] = useState("")
    const [voice, setVoice] = useState("pt-BR-AntonioNeural")
    const [isLoading, setIsLoading] = useState(false)
    const [audioUrl, setAudioUrl] = useState(null)
    const [audiobooks, setAudiobooks] = useState([])
    const [loadingBooks, setLoadingBooks] = useState(true)
    const fileInputRef = useRef(null)

    useEffect(() => {
        loadAudiobooks()
    }, [])

    const loadAudiobooks = async () => {
        try {
            const res = await fetch(`${API_URL}/api/audiobooks`)
            const data = await res.json()
            setAudiobooks(data.audiobooks || [])
        } catch (e) {
            console.error('Erro ao carregar audiobooks:', e)
        } finally {
            setLoadingBooks(false)
        }
    }

    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        try {
            const formData = new FormData()
            formData.append('file', file)
            const res = await fetch(`${API_URL}/api/extract`, { method: 'POST', body: formData })
            if (!res.ok) throw new Error((await res.json()).error || 'Erro')
            const data = await res.json()
            setText(data.text)
        } catch (e) {
            alert(`Erro: ${e.message}`)
        }
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    const handleGenerate = async () => {
        if (!text.trim()) return
        setIsLoading(true)
        setAudioUrl(null)
        try {
            const res = await fetch(`${API_URL}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, voice })
            })
            if (!res.ok) throw new Error()
            const blob = await res.blob()
            setAudioUrl(URL.createObjectURL(blob))
        } catch {
            alert('Erro ao gerar áudio.')
        } finally {
            setIsLoading(false)
        }
    }

    const handleDownload = () => {
        if (!audioUrl) return
        const a = document.createElement('a')
        a.href = audioUrl
        a.download = `audiobook-${Date.now()}.mp3`
        a.click()
    }

    return (
        <>
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '80px 24px 64px',
                backgroundImage: "url('/background.jpg')",
                backgroundSize: 'cover',
                backgroundPosition: 'bottom',
                boxSizing: 'border-box'
            }}>
                {/* Título */}
                <div style={{ textAlign: 'center', marginBottom: '48px', maxWidth: '900px', width: '100%', margin: '0 auto 48px' }}>
                    <h1 style={{ fontSize: '48px', fontWeight: '600', marginBottom: '16px', color: '#0f172a', letterSpacing: '-0.02em' }}>
                        Gerador de Audiobook Profissional
                    </h1>
                    <p style={{ fontSize: '22px', color: 'rgba(15,23,42,0.7)', fontWeight: '400' }}>
                        Transforme qualquer texto em audiobook com vozes neurais da Microsoft.
                    </p>
                </div>

                {/* Card Gerador Estilo Moderno/Dark */}
                <div style={{
                    maxWidth: '850px', width: '100%', margin: '0 auto 24px',
                    background: '#1a1a1a', borderRadius: '32px',
                    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                    padding: '12px', boxSizing: 'border-box'
                }}>
                    <div style={{ padding: '16px 20px 8px' }}>
                        <textarea
                            value={text} onChange={(e) => { setText(e.target.value); setAudioUrl(null); }}
                            placeholder="Peça para gerar um audiobook de..."
                            disabled={isLoading}
                            style={{
                                width: '100%', minHeight: '60px', background: 'transparent', border: 'none',
                                outline: 'none', resize: 'none', fontSize: '18px', lineHeight: '1.6', color: '#FCFBF8',
                                fontFamily: "'Figtree', sans-serif", boxSizing: 'border-box'
                            }}
                        />
                    </div>

                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 12px', gap: '8px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt" onChange={handleFileUpload} style={{ display: 'none' }} />
                            <button onClick={() => fileInputRef.current?.click()} disabled={isLoading}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px',
                                    background: 'transparent', border: '1px solid #40403F',
                                    borderRadius: '20px', color: '#FCFBF8', cursor: 'pointer', fontSize: '14px', fontWeight: '600',
                                    fontFamily: "'Figtree', sans-serif", transition: 'border-color 0.2s, background 0.2s'
                                }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = '#FCFBF8'; e.currentTarget.style.background = 'rgba(252, 251, 248, 0.05)'; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = '#40403F'; e.currentTarget.style.background = 'transparent'; }}
                            >
                                <svg width="18" height="18" fill="none" stroke="#FCFBF8" strokeWidth="2.5" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                </svg>
                                Anexar
                            </button>

                            <div style={{ position: 'relative' }}>
                                <select value={voice} onChange={(e) => setVoice(e.target.value)} disabled={isLoading}
                                    style={{
                                        padding: '8px 14px', background: 'transparent', border: '1px solid #40403F',
                                        borderRadius: '20px', color: '#FCFBF8', fontSize: '14px', cursor: 'pointer', appearance: 'none',
                                        paddingRight: '30px', outline: 'none', fontFamily: "'Figtree', sans-serif", fontWeight: '600'
                                    }}>
                                    {VOICES.map((v) => <option key={v.value} value={v.value} style={{ background: '#1a1a1a' }}>{v.label}</option>)}
                                </select>
                                <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#FCFBF8', fontSize: '14px', fontWeight: 'bold' }}>▾</span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {text && <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>
                                ~{estimateAudioDuration(text)}
                            </span>}

                            <button onClick={handleGenerate} disabled={isLoading || !text.trim()}
                                style={{
                                    width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    background: isLoading || !text.trim() ? '#91918e' : '#FCFBF8',
                                    border: 'none', borderRadius: '50%',
                                    color: '#03030D', // Cor escura em ambos os estados conforme pedido
                                    cursor: isLoading || !text.trim() ? 'not-allowed' : 'pointer',
                                    transition: 'transform 0.1s, background 0.2s',
                                    boxShadow: text.trim() ? '0 4px 12px rgba(255,255,255,0.1)' : 'none'
                                }}
                                onMouseEnter={e => { if (!isLoading && text.trim()) e.currentTarget.style.transform = 'scale(1.05)'; }}
                                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                            >
                                {isLoading ? (
                                    <svg style={{ animation: 'spin 1s linear infinite' }} width="20" height="20" fill="none" viewBox="0 0 24 24">
                                        <circle opacity="0.1" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path opacity="1" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                ) : (
                                    <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Player */}
                {audioUrl && (
                    <div style={{
                        maxWidth: '900px', width: '100%', margin: '0 auto 48px', background: 'rgba(255,255,255,0.9)',
                        borderRadius: '12px', border: '1px solid rgba(0,0,0,0.1)', padding: '16px 20px',
                        display: 'flex', alignItems: 'center', gap: '16px'
                    }}>
                        <audio controls src={audioUrl} style={{ flex: 1, height: '40px' }} />
                        <button onClick={handleDownload} title="Baixar MP3" style={{
                            width: '40px', height: '40px', display: 'flex',
                            alignItems: 'center', justifyContent: 'center', background: '#f1f5f9',
                            border: '1px solid #e2e8f0', borderRadius: '50%', color: '#64748b', cursor: 'pointer'
                        }}>
                            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                        </button>
                    </div>
                )}

                <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
            </div>

            {/* ========== SEÇÃO AUDIOBOOKS - DARK THEME ========== */}
            <div style={{
                width: '100%',
                background: '#03030D',
                padding: '64px 24px'
            }}>
                <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
                    <h2 style={{ fontSize: '28px', fontWeight: '600', marginBottom: '32px', color: '#ffffff' }}>
                        Audiobooks Disponíveis
                    </h2>

                    {loadingBooks ? (
                        <p style={{ color: 'rgba(255,255,255,0.5)' }}>Carregando...</p>
                    ) : audiobooks.length === 0 ? (
                        <p style={{ color: 'rgba(255,255,255,0.5)' }}>Nenhum audiobook publicado ainda.</p>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
                            {audiobooks.map((book) => (
                                <div key={book.id} style={{
                                    background: 'rgba(255,255,255,0.03)',
                                    borderRadius: '16px',
                                    border: 'none',
                                    overflow: 'hidden',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                                    transition: 'transform 0.2s, box-shadow 0.2s, background 0.2s'
                                }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.transform = 'translateY(-6px)';
                                        e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.5)';
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                                    }}
                                >
                                    {book.cover_url ? (
                                        <img src={book.cover_url} alt={book.title} style={{ width: '100%', height: 'auto', display: 'block' }} />
                                    ) : (
                                        <div style={{ width: '100%', height: '200px', background: 'linear-gradient(135deg, #2546C7 0%, #1a3399 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <span style={{ fontSize: '48px' }}>🎧</span>
                                        </div>
                                    )}
                                    <div style={{ padding: '24px' }}>
                                        <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px', color: '#ffffff' }}>{book.title}</h3>
                                        {book.description && (
                                            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', marginBottom: '20px', lineHeight: '1.6' }}>
                                                {book.description.slice(0, 100)}{book.description.length > 100 ? '...' : ''}
                                            </p>
                                        )}
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            {book.duration_seconds ? (
                                                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    {formatTime(book.duration_seconds)}
                                                </span>
                                            ) : <span />}
                                            {book.audio_url && (
                                                <a href={book.audio_url} target="_blank" rel="noopener noreferrer"
                                                    style={{
                                                        background: '#2546C7', color: '#fff',
                                                        padding: '8px 16px', borderRadius: '8px', fontSize: '14px',
                                                        textDecoration: 'none', fontWeight: '500'
                                                    }}>
                                                    ▶ Ouvir
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </>
    )
}

// ==================== PÁGINA ADMIN ====================
function AdminPage({ user, isAdmin, setShowLoginModal }) {
    const [audiobooks, setAudiobooks] = useState([])
    const [loading, setLoading] = useState(true)

    // Form
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [audioFile, setAudioFile] = useState(null)
    const [coverFile, setCoverFile] = useState(null)
    const [saving, setSaving] = useState(false)
    const [editingId, setEditingId] = useState(null)
    const [existingAudioUrl, setExistingAudioUrl] = useState('')
    const [existingCoverUrl, setExistingCoverUrl] = useState('')

    useEffect(() => {
        if (isAdmin) loadAudiobooks()
    }, [isAdmin])

    const loadAudiobooks = async () => {
        try {
            const res = await fetch(`${API_URL}/api/audiobooks`)
            const data = await res.json()
            setAudiobooks(data.audiobooks || [])
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!title) return alert('Título é obrigatório')
        if (!editingId && !audioFile) return alert('O arquivo de áudio é obrigatório para novos audiobooks')

        setSaving(true)
        try {
            const session = await supabase.auth.getSession()
            const token = session.data.session?.access_token
            if (!token) throw new Error('Não autenticado')

            let audioUrl = existingAudioUrl
            let coverUrl = existingCoverUrl

            // Upload do áudio se um novo arquivo for selecionado
            if (audioFile) {
                const audioName = `${Date.now()}-${audioFile.name}`
                const { error: audioError } = await supabase.storage.from('audios').upload(audioName, audioFile, { upsert: true })
                if (audioError) throw audioError
                audioUrl = `${SUPABASE_URL}/storage/v1/object/public/audios/${audioName}`
            }

            // Upload da capa se um novo arquivo for selecionado
            if (coverFile) {
                const coverName = `${Date.now()}-${coverFile.name}`
                const { error: coverError } = await supabase.storage.from('covers').upload(coverName, coverFile, { upsert: true })
                if (!coverError) {
                    coverUrl = `${SUPABASE_URL}/storage/v1/object/public/covers/${coverName}`
                }
            }

            const body = { title, description, audio_url: audioUrl, cover_url: coverUrl }

            const res = await fetch(`${API_URL}/api/audiobooks${editingId ? `/${editingId}` : ''}`, {
                method: editingId ? 'PUT' : 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            })

            if (!res.ok) throw new Error((await res.json()).error || 'Erro ao salvar')

            alert(editingId ? 'Audiobook atualizado!' : 'Audiobook publicado!')
            resetForm()
            loadAudiobooks()
        } catch (e) {
            alert(`Erro: ${e.message}`)
        } finally {
            setSaving(false)
        }
    }

    const resetForm = () => {
        setTitle('')
        setDescription('')
        setAudioFile(null)
        setCoverFile(null)
        setEditingId(null)
        setExistingAudioUrl('')
        setExistingCoverUrl('')
    }

    const startEdit = (book) => {
        setTitle(book.title)
        setDescription(book.description || '')
        setEditingId(book.id)
        setExistingAudioUrl(book.audio_url)
        setExistingCoverUrl(book.cover_url || '')
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const handleDelete = async (id) => {
        if (!confirm('Deletar este audiobook?')) return
        try {
            const session = await supabase.auth.getSession()
            const token = session.data.session?.access_token
            await fetch(`${API_URL}/api/audiobooks/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            })
            loadAudiobooks()
        } catch (e) {
            alert('Erro ao deletar')
        }
    }

    // Não logado
    if (!user) {
        return (
            <div style={{ paddingTop: '100px', textAlign: 'center' }}>
                <h1 style={{ fontSize: '32px', marginBottom: '16px' }}>Área Restrita</h1>
                <p style={{ color: '#64748b', marginBottom: '24px' }}>Faça login para acessar o painel admin.</p>
                <button onClick={() => setShowLoginModal(true)} style={{
                    background: '#2546C7', color: '#fff', padding: '12px 24px',
                    border: 'none', borderRadius: '8px', fontSize: '16px', cursor: 'pointer'
                }}>
                    Fazer Login
                </button>
            </div>
        )
    }

    // Não é admin
    if (!isAdmin) {
        return (
            <div style={{ paddingTop: '100px', textAlign: 'center' }}>
                <h1 style={{ fontSize: '32px', marginBottom: '16px' }}>Acesso Negado</h1>
                <p style={{ color: '#64748b' }}>Você não tem permissão para acessar esta página.</p>
                <a href="#" style={{ color: '#2546C7', marginTop: '16px', display: 'inline-block' }}>Voltar para Home</a>
            </div>
        )
    }

    // Admin Panel
    return (
        <div style={{ paddingTop: '80px', padding: '80px 24px 48px', maxWidth: '1000px', margin: '0 auto' }}>
            <h1 style={{ fontSize: '32px', fontWeight: '600', marginBottom: '32px' }}>
                🎛️ Painel Admin
            </h1>

            {/* Formulário de Novo Audiobook */}
            <div style={{
                background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0',
                padding: '24px', marginBottom: '48px'
            }}>
                <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '24px' }}>
                    {editingId ? 'Editar Audiobook' : 'Publicar Novo Audiobook'}
                </h2>

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }}>
                            Título *
                        </label>
                        <input
                            type="text" value={title} onChange={e => setTitle(e.target.value)} required
                            style={{
                                width: '100%', padding: '12px', border: '1px solid #e2e8f0',
                                borderRadius: '8px', fontSize: '16px', boxSizing: 'border-box'
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }}>
                            Descrição
                        </label>
                        <textarea
                            value={description} onChange={e => setDescription(e.target.value)} rows={3}
                            style={{
                                width: '100%', padding: '12px', border: '1px solid #e2e8f0',
                                borderRadius: '8px', fontSize: '16px', resize: 'vertical', boxSizing: 'border-box'
                            }}
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }}>
                                Arquivo de Áudio (MP3) *
                            </label>
                            <input
                                type="file" accept="audio/*" onChange={e => setAudioFile(e.target.files?.[0])} required={!editingId}
                                style={{ fontSize: '14px' }}
                            />
                            {editingId && <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Deixe vazio para manter o atual</p>}
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }}>
                                Capa (opcional)
                            </label>
                            <input
                                type="file" accept="image/*" onChange={e => setCoverFile(e.target.files?.[0])}
                                style={{ fontSize: '14px' }}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button type="submit" disabled={saving} style={{
                            background: '#2546C7', color: '#fff', padding: '12px 24px',
                            border: 'none', borderRadius: '8px', fontSize: '16px',
                            fontWeight: '500', cursor: saving ? 'not-allowed' : 'pointer'
                        }}>
                            {saving ? 'Salvando...' : (editingId ? 'Salvar Alterações' : 'Publicar Audiobook')}
                        </button>

                        {editingId && (
                            <button type="button" onClick={resetForm} style={{
                                background: 'transparent', color: '#64748b', padding: '12px 24px',
                                border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '16px',
                                cursor: 'pointer'
                            }}>
                                Cancelar
                            </button>
                        )}
                    </div>
                </form>
            </div>

            {/* Lista de Audiobooks */}
            <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px' }}>
                Audiobooks Publicados ({audiobooks.length})
            </h2>

            {loading ? (
                <p>Carregando...</p>
            ) : audiobooks.length === 0 ? (
                <p style={{ color: '#64748b' }}>Nenhum audiobook publicado.</p>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {audiobooks.map((book) => (
                        <div key={book.id} style={{
                            display: 'flex', alignItems: 'center', gap: '16px',
                            background: '#fff', padding: '16px', borderRadius: '12px',
                            border: '1px solid #e2e8f0'
                        }}>
                            {book.cover_url && (
                                <img src={book.cover_url} alt="" style={{
                                    width: '60px', height: '60px',
                                    objectFit: 'contain', borderRadius: '8px', background: '#f8fafc'
                                }} />
                            )}
                            <div style={{ flex: 1 }}>
                                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>{book.title}</h3>
                                <p style={{ fontSize: '13px', color: '#64748b' }}>
                                    {book.description?.slice(0, 80) || 'Sem descrição'}
                                </p>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => startEdit(book)} style={{
                                    background: '#f1f5f9', color: '#475569', border: 'none',
                                    padding: '8px 16px', borderRadius: '6px', fontSize: '14px', cursor: 'pointer'
                                }}>
                                    Editar
                                </button>
                                <button onClick={() => handleDelete(book.id)} style={{
                                    background: '#fee2e2', color: '#dc2626', border: 'none',
                                    padding: '8px 16px', borderRadius: '6px', fontSize: '14px', cursor: 'pointer'
                                }}>
                                    Excluir
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
