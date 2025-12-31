import { useState, useRef, useEffect } from "react"
import { createClient } from '@supabase/supabase-js'

// Configuração Supabase (ANON KEY - segura para frontend)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Debug: verificar se as variáveis estão chegando
console.log('Supabase URL:', SUPABASE_URL ? 'Configurado' : 'NÃO CONFIGURADO')
console.log('Supabase Key:', SUPABASE_ANON_KEY ? 'Configurado' : 'NÃO CONFIGURADO')

const supabase = SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null

if (!supabase) {
    console.warn('⚠️ Supabase não configurado. Login desabilitado.')
}

const API_URL = import.meta.env.VITE_API_URL ||
    (window.location.hostname === 'localhost' ? 'http://localhost:5000' :
        window.location.origin.replace(':3000', ':5000'))

const VOICES = [
    { value: 'pt-BR-AntonioNeural', label: 'Antônio (PT-BR)' },
    { value: 'pt-BR-FranciscaNeural', label: 'Francisca (PT-BR)' },
    { value: 'pt-BR-ThalitaNeural', label: 'Thalita (PT-BR)' },
    { value: 'en-US-GuyNeural', label: 'Guy (EN-US)' },
    { value: 'en-US-JennyNeural', label: 'Jenny (EN-US)' }
]

// Formata segundos em texto (1h 20m 30s)
const formatTime = (seconds) => {
    if (seconds <= 0) return "Indefinido"
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

// Estima duração do áudio (~150 palavras por minuto)
const estimateAudioDuration = (text) => {
    const words = text.trim().split(/\s+/).length
    const seconds = Math.ceil(words / 150 * 60)
    return formatTime(seconds)
}

export default function App() {
    // Estados de Autenticação
    const [user, setUser] = useState(null)
    const [isAdmin, setIsAdmin] = useState(false)
    const [showLoginModal, setShowLoginModal] = useState(false)
    const [loginEmail, setLoginEmail] = useState('')
    const [loginPassword, setLoginPassword] = useState('')
    const [loginError, setLoginError] = useState('')
    const [isLoggingIn, setIsLoggingIn] = useState(false)

    // Estados do Gerador de Áudio
    const [text, setText] = useState("")
    const [voice, setVoice] = useState("pt-BR-AntonioNeural")
    const [isLoading, setIsLoading] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [audioUrl, setAudioUrl] = useState(null)
    const [totalEstimatedSeconds, setTotalEstimatedSeconds] = useState(0)
    const [secondsLeft, setSecondsLeft] = useState(0)

    // Estados de Publicação (Admin)
    const [showPublishModal, setShowPublishModal] = useState(false)
    const [publishTitle, setPublishTitle] = useState('')
    const [publishDescription, setPublishDescription] = useState('')
    const [publishCover, setPublishCover] = useState(null)
    const [isPublishing, setIsPublishing] = useState(false)

    // Estados da Lista de Audiobooks
    const [audiobooks, setAudiobooks] = useState([])
    const [loadingAudiobooks, setLoadingAudiobooks] = useState(true)

    const fileInputRef = useRef(null)
    const coverInputRef = useRef(null)

    // Verifica sessão do usuário ao carregar
    useEffect(() => {
        if (!supabase) return

        // Verifica sessão atual
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                setUser(session.user)
                checkAdminStatus(session.access_token)
            }
        })

        // Escuta mudanças de auth
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null)
            if (session) {
                checkAdminStatus(session.access_token)
            } else {
                setIsAdmin(false)
            }
        })

        return () => subscription.unsubscribe()
    }, [])

    // Carrega audiobooks públicos
    useEffect(() => {
        loadAudiobooks()
    }, [])

    // Timer de Countdown (Regressivo)
    useEffect(() => {
        if (!isLoading || secondsLeft <= 0) return

        const timer = setInterval(() => {
            setSecondsLeft(prev => {
                if (prev <= 1) return 1
                return prev - 1
            })
        }, 1000)

        return () => clearInterval(timer)
    }, [isLoading, secondsLeft])

    const progressPercent = totalEstimatedSeconds > 0
        ? Math.min(99, Math.max(0, ((totalEstimatedSeconds - secondsLeft) / totalEstimatedSeconds) * 100))
        : 0

    // Verifica status de admin no backend (SEGURO!)
    const checkAdminStatus = async (token) => {
        try {
            const res = await fetch(`${API_URL}/api/auth/verify`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            })
            const data = await res.json()
            setIsAdmin(data.is_admin === true)
        } catch (e) {
            console.error('Erro ao verificar admin:', e)
            setIsAdmin(false)
        }
    }

    const loadAudiobooks = async () => {
        setLoadingAudiobooks(true)
        try {
            const res = await fetch(`${API_URL}/api/audiobooks`)
            const data = await res.json()
            setAudiobooks(data.audiobooks || [])
        } catch (e) {
            console.error('Erro ao carregar audiobooks:', e)
        } finally {
            setLoadingAudiobooks(false)
        }
    }

    // Login
    const handleLogin = async (e) => {
        e.preventDefault()
        if (!supabase) return alert('Supabase não configurado')

        setIsLoggingIn(true)
        setLoginError('')

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: loginEmail,
                password: loginPassword
            })

            if (error) throw error

            setShowLoginModal(false)
            setLoginEmail('')
            setLoginPassword('')
        } catch (e) {
            setLoginError(e.message || 'Erro ao fazer login')
        } finally {
            setIsLoggingIn(false)
        }
    }

    // Cadastro
    const handleSignUp = async () => {
        if (!supabase) return alert('Supabase não configurado')

        setIsLoggingIn(true)
        setLoginError('')

        try {
            const { data, error } = await supabase.auth.signUp({
                email: loginEmail,
                password: loginPassword
            })

            if (error) throw error

            setLoginError('Verifique seu email para confirmar o cadastro!')
        } catch (e) {
            setLoginError(e.message || 'Erro ao cadastrar')
        } finally {
            setIsLoggingIn(false)
        }
    }

    // Logout
    const handleLogout = async () => {
        if (!supabase) return
        await supabase.auth.signOut()
        setUser(null)
        setIsAdmin(false)
    }

    // Upload de arquivo
    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        setIsUploading(true)
        setAudioUrl(null)
        try {
            const formData = new FormData()
            formData.append('file', file)
            const res = await fetch(`${API_URL}/api/extract`, { method: 'POST', body: formData })
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}))
                throw new Error(errorData.error || res.statusText)
            }
            const data = await res.json()
            setText(data.text)
        } catch (e) {
            console.error(e)
            alert(`Erro ao ler arquivo: ${e.message}`)
        } finally {
            setIsUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    // Gerar áudio
    const handleGenerate = async () => {
        if (!text.trim()) return
        setIsLoading(true)
        setAudioUrl(null)

        const words = text.trim().split(/\s+/).length
        const audioMinutes = words / 150
        const estSecs = Math.max(5, Math.ceil(audioMinutes * 8))

        setTotalEstimatedSeconds(estSecs)
        setSecondsLeft(estSecs)

        try {
            const res = await fetch(`${API_URL}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, voice })
            })
            if (!res.ok) throw new Error()
            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            setAudioUrl(url)
        } catch {
            alert('Erro ao gerar áudio. O texto pode ser muito longo para o servidor gratuito.')
        } finally {
            setIsLoading(false)
            setSecondsLeft(0)
        }
    }

    // Download
    const handleDownload = () => {
        if (!audioUrl) return
        const a = document.createElement('a')
        a.href = audioUrl
        a.download = `audiobook-${Date.now()}.mp3`
        a.click()
    }

    // Publicar audiobook (Admin)
    const handlePublish = async () => {
        if (!audioUrl || !publishTitle.trim()) {
            return alert('Preencha o título')
        }

        setIsPublishing(true)

        try {
            const session = await supabase.auth.getSession()
            const token = session.data.session?.access_token

            if (!token) throw new Error('Não autenticado')

            // Upload da capa (se houver)
            let coverUrl = ''
            if (publishCover) {
                const formData = new FormData()
                formData.append('file', publishCover)

                const coverRes = await fetch(`${API_URL}/api/upload/cover`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                })

                if (coverRes.ok) {
                    const coverData = await coverRes.json()
                    coverUrl = coverData.url
                }
            }

            // Publica o audiobook
            const res = await fetch(`${API_URL}/api/audiobooks`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title: publishTitle,
                    description: publishDescription,
                    audio_url: audioUrl, // Por enquanto usamos o blob URL (em produção, faria upload)
                    cover_url: coverUrl,
                    duration_seconds: Math.ceil((text.trim().split(/\s+/).length / 150) * 60)
                })
            })

            if (!res.ok) {
                const errData = await res.json()
                throw new Error(errData.error || 'Erro ao publicar')
            }

            alert('Audiobook publicado com sucesso!')
            setShowPublishModal(false)
            setPublishTitle('')
            setPublishDescription('')
            setPublishCover(null)
            loadAudiobooks()

        } catch (e) {
            alert(`Erro: ${e.message}`)
        } finally {
            setIsPublishing(false)
        }
    }

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '24px',
            paddingTop: '80px' // Espaço para o header fixo
        }}>

            {/* Header Fixo com Login */}
            <header style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                height: '60px',
                background: 'rgba(255,255,255,0.9)',
                backdropFilter: 'blur(10px)',
                borderBottom: '1px solid rgba(0,0,0,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 24px',
                zIndex: 100
            }}>
                <span style={{ fontWeight: '600', fontSize: '18px', color: '#0f172a' }}>
                    🎧 AudioBook AI
                </span>

                {/* Botão de Login/User */}
                {user ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {isAdmin && (
                            <span style={{
                                background: '#6366f1',
                                color: '#fff',
                                padding: '4px 10px',
                                borderRadius: '12px',
                                fontSize: '12px',
                                fontWeight: '500'
                            }}>
                                Admin
                            </span>
                        )}
                        <span style={{ fontSize: '14px', color: '#64748b' }}>{user.email}</span>
                        <button
                            onClick={handleLogout}
                            style={{
                                background: 'transparent',
                                border: '1px solid #e2e8f0',
                                borderRadius: '8px',
                                padding: '6px 12px',
                                cursor: 'pointer',
                                fontSize: '14px'
                            }}
                        >
                            Sair
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => setShowLoginModal(true)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: '#f1f5f9',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '8px 16px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            color: '#475569'
                        }}
                    >
                        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Entrar
                    </button>
                )}
            </header>

            {/* Título */}
            <div style={{ textAlign: 'center', marginBottom: '48px', maxWidth: '900px' }}>
                <h1 style={{ fontSize: '48px', fontWeight: '600', marginBottom: '16px', lineHeight: '1.2', color: '#0f172a' }}>
                    Gerador de Audiobook Profissional
                </h1>
                <p style={{ fontSize: '18px', color: 'rgba(15,23,42,0.7)' }}>
                    Transforme qualquer texto em um audiobook profissional usando vozes neurais da Microsoft.
                </p>
            </div>

            {/* Card Principal - Gerador */}
            <div style={{
                width: '100%',
                maxWidth: '900px',
                background: 'rgba(255,255,255,0.85)',
                backdropFilter: 'blur(20px)',
                borderRadius: '16px',
                border: '1px solid rgba(255,255,255,0.5)',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)',
                overflow: 'hidden'
            }}>

                {/* Textarea */}
                <div style={{ padding: '24px', position: 'relative' }}>
                    <textarea
                        value={text}
                        onChange={(e) => { setText(e.target.value); setAudioUrl(null); }}
                        placeholder="Cole ou digite seu texto aqui..."
                        disabled={isLoading || isUploading}
                        style={{
                            width: '100%',
                            minHeight: '180px',
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            resize: 'none',
                            fontSize: '16px',
                            lineHeight: '1.6',
                            color: '#1e293b',
                            fontFamily: 'inherit',
                            paddingRight: '120px'
                        }}
                    />

                    {/* Botões à direita */}
                    <div style={{ position: 'absolute', right: '24px', top: '24px', display: 'flex', flexDirection: 'row', gap: '8px' }}>
                        <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt" onChange={handleFileUpload} style={{ display: 'none' }} />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading || isLoading}
                            title="Upload arquivo"
                            style={{
                                width: '40px',
                                height: '40px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: '#f1f5f9',
                                border: 'none',
                                borderRadius: '50%',
                                color: '#64748b',
                                cursor: 'pointer'
                            }}
                        >
                            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                        </button>
                        <button
                            onClick={handleGenerate}
                            disabled={isLoading || !text.trim()}
                            title="Gerar áudio"
                            style={{
                                width: '40px',
                                height: '40px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: isLoading || !text.trim() ? '#94a3b8' : '#6366f1',
                                border: 'none',
                                borderRadius: '50%',
                                color: '#fff',
                                cursor: isLoading || !text.trim() ? 'not-allowed' : 'pointer'
                            }}
                        >
                            {isLoading ? (
                                <svg style={{ animation: 'spin 1s linear infinite' }} width="18" height="18" fill="none" viewBox="0 0 24 24">
                                    <circle opacity="0.25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path opacity="0.75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                            ) : (
                                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                            )}
                        </button>
                    </div>
                </div>

                {/* Barra de Progresso */}
                {isLoading && (
                    <div style={{ padding: '0 24px 16px 24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', color: '#6366f1' }}>
                            <span>{progressPercent >= 99 ? "Finalizando..." : "Gerando áudio..."}</span>
                            <span>{Math.round(progressPercent)}% • Restam approx. {formatTime(secondsLeft)}</span>
                        </div>
                        <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${progressPercent}%`, height: '100%', background: '#6366f1', transition: 'width 1s linear' }} />
                        </div>
                    </div>
                )}

                {/* Seletor de Voz */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '16px',
                    padding: '12px 24px',
                    borderTop: '1px solid rgba(0,0,0,0.08)',
                    background: 'rgba(248,250,252,0.9)'
                }}>
                    <span style={{ fontSize: '14px', color: '#64748b', fontWeight: '500' }}>Voz:</span>
                    <select
                        value={voice}
                        onChange={(e) => setVoice(e.target.value)}
                        disabled={isLoading}
                        style={{
                            padding: '8px 12px',
                            background: '#fff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            color: '#475569',
                            fontSize: '14px',
                            fontWeight: '500',
                            cursor: 'pointer',
                            outline: 'none'
                        }}
                    >
                        {VOICES.map((v) => (
                            <option key={v.value} value={v.value}>{v.label}</option>
                        ))}
                    </select>

                    {text && (
                        <span style={{ fontSize: '13px', color: '#94a3b8', marginLeft: 'auto' }}>
                            ~{estimateAudioDuration(text)} de áudio total
                        </span>
                    )}
                </div>
            </div>

            {/* Preview do Áudio */}
            {audioUrl && (
                <div style={{
                    width: '100%',
                    maxWidth: '900px',
                    marginTop: '16px',
                    background: 'rgba(255,255,255,0.85)',
                    backdropFilter: 'blur(20px)',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.5)',
                    boxShadow: '0 10px 30px -10px rgba(0,0,0,0.1)',
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    animation: 'fadeIn 0.5s ease-out'
                }}>
                    <audio controls src={audioUrl} style={{ flex: 1, height: '40px' }} />

                    <button onClick={handleDownload} title="Baixar MP3" style={{
                        width: '40px', height: '40px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '50%',
                        color: '#64748b', cursor: 'pointer', flexShrink: 0
                    }}>
                        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                    </button>

                    {/* Botão Publicar (Apenas Admin) */}
                    {isAdmin && (
                        <button
                            onClick={() => setShowPublishModal(true)}
                            title="Publicar Audiobook"
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                background: '#6366f1', border: 'none', borderRadius: '8px',
                                padding: '8px 16px', color: '#fff', cursor: 'pointer',
                                fontSize: '14px', fontWeight: '500'
                            }}
                        >
                            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                            Publicar
                        </button>
                    )}
                </div>
            )}

            {/* Lista de Audiobooks Publicados */}
            <div style={{ width: '100%', maxWidth: '900px', marginTop: '48px' }}>
                <h2 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '24px', color: '#0f172a' }}>
                    📚 Audiobooks Disponíveis
                </h2>

                {loadingAudiobooks ? (
                    <p style={{ color: '#64748b' }}>Carregando...</p>
                ) : audiobooks.length === 0 ? (
                    <p style={{ color: '#64748b' }}>Nenhum audiobook publicado ainda.</p>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                        {audiobooks.map((book) => (
                            <div key={book.id} style={{
                                background: 'rgba(255,255,255,0.85)',
                                borderRadius: '12px',
                                border: '1px solid rgba(0,0,0,0.1)',
                                overflow: 'hidden',
                                boxShadow: '0 4px 15px rgba(0,0,0,0.05)'
                            }}>
                                {book.cover_url && (
                                    <img src={book.cover_url} alt={book.title} style={{ width: '100%', height: '160px', objectFit: 'cover' }} />
                                )}
                                <div style={{ padding: '16px' }}>
                                    <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px', color: '#0f172a' }}>
                                        {book.title}
                                    </h3>
                                    {book.description && (
                                        <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '12px', lineHeight: '1.5' }}>
                                            {book.description.slice(0, 100)}{book.description.length > 100 ? '...' : ''}
                                        </p>
                                    )}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {book.duration_seconds && (
                                            <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                                                {formatTime(book.duration_seconds)}
                                            </span>
                                        )}
                                        {book.audio_url && (
                                            <a
                                                href={book.audio_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{
                                                    marginLeft: 'auto',
                                                    background: '#6366f1',
                                                    color: '#fff',
                                                    padding: '6px 12px',
                                                    borderRadius: '6px',
                                                    fontSize: '12px',
                                                    textDecoration: 'none',
                                                    fontWeight: '500'
                                                }}
                                            >
                                                Ouvir
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal de Login */}
            {showLoginModal && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200
                }} onClick={() => setShowLoginModal(false)}>
                    <div style={{
                        background: '#fff', borderRadius: '16px', padding: '32px',
                        width: '90%', maxWidth: '400px', boxShadow: '0 25px 50px rgba(0,0,0,0.25)'
                    }} onClick={e => e.stopPropagation()}>
                        <h2 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '24px', textAlign: 'center' }}>
                            Entrar
                        </h2>

                        <form onSubmit={handleLogin}>
                            <input
                                type="email"
                                placeholder="Email"
                                value={loginEmail}
                                onChange={e => setLoginEmail(e.target.value)}
                                style={{
                                    width: '100%', padding: '12px 16px', marginBottom: '12px',
                                    border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '16px'
                                }}
                                required
                            />
                            <input
                                type="password"
                                placeholder="Senha"
                                value={loginPassword}
                                onChange={e => setLoginPassword(e.target.value)}
                                style={{
                                    width: '100%', padding: '12px 16px', marginBottom: '16px',
                                    border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '16px'
                                }}
                                required
                            />

                            {loginError && (
                                <p style={{ color: '#ef4444', fontSize: '14px', marginBottom: '12px', textAlign: 'center' }}>
                                    {loginError}
                                </p>
                            )}

                            <button
                                type="submit"
                                disabled={isLoggingIn}
                                style={{
                                    width: '100%', padding: '12px', background: '#6366f1',
                                    color: '#fff', border: 'none', borderRadius: '8px',
                                    fontSize: '16px', fontWeight: '500', cursor: 'pointer',
                                    marginBottom: '12px'
                                }}
                            >
                                {isLoggingIn ? 'Entrando...' : 'Entrar'}
                            </button>

                            <button
                                type="button"
                                onClick={handleSignUp}
                                disabled={isLoggingIn}
                                style={{
                                    width: '100%', padding: '12px', background: 'transparent',
                                    color: '#6366f1', border: '1px solid #6366f1', borderRadius: '8px',
                                    fontSize: '16px', fontWeight: '500', cursor: 'pointer'
                                }}
                            >
                                Criar Conta
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Publicação (Admin) */}
            {showPublishModal && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200
                }} onClick={() => setShowPublishModal(false)}>
                    <div style={{
                        background: '#fff', borderRadius: '16px', padding: '32px',
                        width: '90%', maxWidth: '500px', boxShadow: '0 25px 50px rgba(0,0,0,0.25)'
                    }} onClick={e => e.stopPropagation()}>
                        <h2 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '24px' }}>
                            Publicar Audiobook
                        </h2>

                        <input
                            type="text"
                            placeholder="Título do Audiobook"
                            value={publishTitle}
                            onChange={e => setPublishTitle(e.target.value)}
                            style={{
                                width: '100%', padding: '12px 16px', marginBottom: '12px',
                                border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '16px'
                            }}
                        />

                        <textarea
                            placeholder="Descrição (opcional)"
                            value={publishDescription}
                            onChange={e => setPublishDescription(e.target.value)}
                            rows={3}
                            style={{
                                width: '100%', padding: '12px 16px', marginBottom: '12px',
                                border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '16px',
                                resize: 'vertical'
                            }}
                        />

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#64748b' }}>
                                Capa (opcional)
                            </label>
                            <input
                                ref={coverInputRef}
                                type="file"
                                accept="image/*"
                                onChange={e => setPublishCover(e.target.files?.[0] || null)}
                                style={{ fontSize: '14px' }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                onClick={() => setShowPublishModal(false)}
                                style={{
                                    flex: 1, padding: '12px', background: '#f1f5f9',
                                    color: '#475569', border: 'none', borderRadius: '8px',
                                    fontSize: '16px', cursor: 'pointer'
                                }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handlePublish}
                                disabled={isPublishing || !publishTitle.trim()}
                                style={{
                                    flex: 1, padding: '12px', background: '#6366f1',
                                    color: '#fff', border: 'none', borderRadius: '8px',
                                    fontSize: '16px', fontWeight: '500', cursor: 'pointer'
                                }}
                            >
                                {isPublishing ? 'Publicando...' : 'Publicar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        textarea::placeholder { color: rgba(30,41,59,0.4); }
        audio { border-radius: 8px; }
        audio::-webkit-media-controls-panel { background: #f8fafc; }
      `}</style>
        </div>
    )
}
