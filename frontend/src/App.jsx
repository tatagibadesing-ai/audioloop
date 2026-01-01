import { useState, useRef, useEffect } from "react"
import { createClient } from '@supabase/supabase-js'
import { motion, AnimatePresence } from "framer-motion"
import AudioPlayer from 'react-h5-audio-player'
import 'react-h5-audio-player/lib/styles.css'
import {
    CaretDown,
    CaretUp,
    Paperclip,
    ArrowUp,
    DownloadSimple,
    Clock,
    PencilSimple,
    Trash,
    X,
    Play,
    Pause,
    SignOut,
    House,
    Layout,
    UserCircle,
    MagnifyingGlass,
    SquaresFour,
    Star,
    Users,
    Compass,
    Cube,
    BookOpen,
    Gear,
    Plus,
    Gift,
    CheckCircle,
    SpeakerHigh,
    SpeakerSlash,
    CircleNotch
} from "@phosphor-icons/react"

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
    { value: 'pt-BR-AntonioNeural', label: 'Antonio BR', provider: 'edge' },
    { value: 'pt-BR-Neural2-B', label: 'Bruno BR', provider: 'google' },
    { value: 'pt-BR-FranciscaNeural', label: 'Francisca BR', provider: 'edge' },
    { value: 'pt-BR-ThalitaMultilingualNeural', label: 'Thalita BR', provider: 'edge' },
    { value: 'pt-BR-Wavenet-C', label: 'Fernanda BR', provider: 'google' },
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
        <div style={{ display: 'flex', minHeight: '100vh', background: '#e9e9e9' }}>
            <Sidebar user={user} isAdmin={isAdmin} setShowLoginModal={setShowLoginModal} />

            <main style={{ marginLeft: '260px', flex: 1, position: 'relative', width: 'calc(100% - 260px)' }}>
                {page === 'admin' ? (
                    <AdminPage user={user} isAdmin={isAdmin} setShowLoginModal={setShowLoginModal} />
                ) : (
                    <HomePage user={user} />
                )}
            </main>

            <AnimatePresence>
                {showLoginModal && (
                    <LoginModal onClose={() => setShowLoginModal(false)} />
                )}
            </AnimatePresence>
        </div>
    )
}

// ==================== SIDEBAR ====================
function Sidebar({ user, isAdmin, setShowLoginModal }) {
    const handleLogout = async () => {
        if (supabase) await supabase.auth.signOut()
    }

    const MenuItem = ({ icon: Icon, label, isActive, onClick, isComingSoon }) => (
        <button
            onClick={onClick}
            style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '8px 12px',
                background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                border: 'none',
                borderRadius: '8px',
                color: isActive ? '#fff' : '#888',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'all 0.2s',
                marginBottom: '2px',
                position: 'relative'
            }}
            onMouseEnter={e => {
                if (!isActive) {
                    e.currentTarget.style.color = '#fff';
                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                }
            }}
            onMouseLeave={e => {
                if (!isActive) {
                    e.currentTarget.style.color = '#888';
                    e.currentTarget.style.background = 'transparent';
                }
            }}
        >
            <Icon size={18} weight={isActive ? "fill" : "regular"} />
            {label}
            {isComingSoon && (
                <span style={{ fontSize: '10px', background: '#333', padding: '2px 6px', borderRadius: '4px', marginLeft: 'auto', color: '#888' }}>
                    Em breve
                </span>
            )}
        </button>
    );

    const SectionTitle = ({ label }) => (
        <div style={{
            fontSize: '12px',
            fontWeight: '600',
            color: '#444',
            marginTop: '24px',
            marginBottom: '8px',
            paddingLeft: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
        }}>
            {label}
        </div>
    );

    return (
        <aside style={{
            width: '260px',
            height: '100vh',
            background: '#0a0a0a',
            borderRight: '1px solid #222',
            display: 'flex',
            flexDirection: 'column',
            padding: '24px 16px',
            boxSizing: 'border-box',
            position: 'fixed',
            left: 0,
            top: 0,
            zIndex: 1000,
            color: '#fff'
        }}>
            {/* Logo Area */}
            <div style={{ marginBottom: '24px', paddingLeft: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <img
                    src="https://rlbaboiwngviskgsaomb.supabase.co/storage/v1/object/sign/imagens/audiolooplogo.webp?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8zMGJmN2E4Ny00MDc3LTQ5ZWItYjc1Ni1lNDk2M2Y5MmMzMTciLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJpbWFnZW5zL2F1ZGlvbG9vcGxvZ28ud2VicCIsImlhdCI6MTc2NzI5NzAwMywiZXhwIjoyNTczMzIyNjAzfQ.VQQrRWT3AqlUcUaWXToP7ZoGSvnKIqr3l-Q9HZp-FdI"
                    alt="AudioLoop"
                    style={{ width: '32px', height: '32px', borderRadius: '8px', objectFit: 'contain' }}
                />
                <span style={{ fontWeight: '600', fontSize: '16px' }}>AudioLoop</span>
            </div>

            {/* Workspace Selector Mockup */}
            <div style={{
                marginBottom: '24px',
                background: '#161616',
                border: '1px solid #2a2a2a',
                borderRadius: '8px',
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '20px', height: '20px', background: '#333', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>W</div>
                    <span style={{ fontSize: '13px', fontWeight: '500' }}>Workspace</span>
                </div>
                <CaretDown size={12} color="#666" />
            </div>

            {/* Main Menu */}
            <nav style={{ flex: 1, overflowY: 'auto' }}>
                <MenuItem icon={House} label="Início" isActive={true} onClick={() => window.location.hash = '#'} />
                <MenuItem icon={MagnifyingGlass} label="Buscar" isComingSoon />

                <SectionTitle label="Projetos" />
                <MenuItem icon={SquaresFour} label="Todos os projetos" />
                <MenuItem icon={Star} label="Favoritos" />
                <MenuItem icon={Users} label="Compartilhados" />

                <SectionTitle label="Recursos" />
                <MenuItem icon={Compass} label="Descobrir" isComingSoon />
                <MenuItem icon={Layout} label="Modelos" isComingSoon />
                <MenuItem icon={BookOpen} label="Aprender" isComingSoon />

                {isAdmin && (
                    <>
                        <SectionTitle label="Admin" />
                        <MenuItem icon={Gear} label="Painel Admin" onClick={() => window.location.hash = '#admin'} />
                    </>
                )}
            </nav>

            {/* Footer */}
            <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid #222' }}>
                <MenuItem icon={Gift} label="Compartilhar" />

                <div style={{
                    marginTop: '12px',
                    background: '#161616',
                    padding: '12px',
                    borderRadius: '12px',
                    border: '1px solid #222',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                }}>
                    {user ? (
                        <>
                            <div style={{
                                width: '36px', height: '36px',
                                background: '#333', borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: '#aaa'
                            }}>
                                <UserCircle size={24} />
                            </div>
                            <div style={{ flex: 1, overflow: 'hidden' }}>
                                <div style={{ fontSize: '13px', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {user.email?.split('@')[0]}
                                </div>
                                <div style={{ fontSize: '11px', color: '#666' }}>{isAdmin ? 'Plano Admin' : 'Plano Grátis'}</div>
                            </div>
                            <button onClick={handleLogout} title="Sair" style={{ background: 'transparent', border: 'none', color: '#666', cursor: 'pointer' }}>
                                <SignOut size={16} />
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={() => setShowLoginModal(true)}
                            style={{
                                width: '100%',
                                background: '#fff',
                                color: '#000',
                                border: 'none',
                                padding: '8px',
                                borderRadius: '6px',
                                fontWeight: '600',
                                fontSize: '13px',
                                cursor: 'pointer'
                            }}
                        >
                            Log in / Sign up
                        </button>
                    )}
                </div>
            </div>
        </aside>
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
    const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false)
    const [previewVoice, setPreviewVoice] = useState(null) // Voz sendo tocada
    const [preloadedPreviews, setPreloadedPreviews] = useState({}) // Cache de URLs das prévias
    const [isPlaying, setIsPlaying] = useState(false) // Estado do player
    const [isPlayerMinimized, setIsPlayerMinimized] = useState(false) // Estado minimizado do player
    const voiceSelectRef = useRef(null)
    const previewAudioRef = useRef(new Audio())
    const playerRef = useRef(null)


    // Pré-carrega as vozes para que o clique seja instantâneo
    useEffect(() => {
        const preloadVoices = async () => {
            const cache = {}
            for (const v of VOICES) {
                try {
                    const isEnglish = v.value.startsWith('en-US')
                    // Texto alterado para evitar problemas fonéticos com "esta"
                    const previewText = isEnglish
                        ? "Hello! This is a sample of my voice."
                        : "Olá! Ouça como soa a minha voz no AudioLoop."

                    const response = await fetch(`${API_URL}/api/generate`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text: previewText, voice: v.value })
                    })

                    if (response.ok) {
                        const blob = await response.blob()
                        cache[v.value] = URL.createObjectURL(blob)
                    }
                } catch (e) {
                    console.error(`Erro ao pré-carregar ${v.value}:`, e)
                }
            }
            setPreloadedPreviews(cache)
        }
        preloadVoices()
    }, [])

    const playVoicePreview = (voiceId) => {
        const cachedUrl = preloadedPreviews[voiceId]
        if (!cachedUrl) return

        if (previewAudioRef.current) {
            // Se já estiver tocando, para antes de começar de novo
            previewAudioRef.current.pause()
            previewAudioRef.current.currentTime = 0

            setPreviewVoice(voiceId)
            previewAudioRef.current.src = cachedUrl
            previewAudioRef.current.onended = () => setPreviewVoice(null)
            previewAudioRef.current.play()
        }
    }

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (voiceSelectRef.current && !voiceSelectRef.current.contains(event.target)) {
                setIsVoiceModalOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])
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
                                    background: 'transparent', border: '1px solid #333332',
                                    borderRadius: '20px', color: '#91918E', cursor: 'pointer', fontSize: '14px', fontWeight: '600',
                                    fontFamily: "'Figtree', sans-serif", transition: 'all 0.2s'
                                }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.borderColor = '#40403F';
                                    e.currentTarget.style.color = '#FCFBF8';
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.borderColor = '#333332';
                                    e.currentTarget.style.color = '#91918E';
                                    e.currentTarget.style.background = 'transparent';
                                }}
                            >
                                <Paperclip size={18} weight="bold" />
                                Anexar
                            </button>

                            <div style={{ position: 'relative' }} ref={voiceSelectRef}>
                                <button
                                    onClick={() => setIsVoiceModalOpen(!isVoiceModalOpen)}
                                    disabled={isLoading}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px',
                                        background: 'transparent',
                                        border: `1px solid ${isVoiceModalOpen ? '#40403F' : '#333332'}`,
                                        borderRadius: '20px',
                                        color: isVoiceModalOpen ? '#FCFBF8' : '#91918E',
                                        fontSize: '14px', fontWeight: '600',
                                        cursor: 'pointer', fontFamily: "'Figtree', sans-serif", transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.borderColor = '#40403F';
                                        e.currentTarget.style.color = '#FCFBF8';
                                        const arrow = e.currentTarget.querySelector('.select-arrow');
                                        if (arrow) arrow.style.color = '#FCFBF8';
                                    }}
                                    onMouseLeave={e => {
                                        if (!isVoiceModalOpen) {
                                            e.currentTarget.style.borderColor = '#333332';
                                            e.currentTarget.style.color = '#91918E';
                                            const arrow = e.currentTarget.querySelector('.select-arrow');
                                            if (arrow) arrow.style.color = '#91918E';
                                        }
                                    }}
                                >
                                    {VOICES.find(v => v.value === voice)?.label}
                                    <CaretDown
                                        size={14} weight="bold"
                                        style={{
                                            color: isVoiceModalOpen ? '#FCFBF8' : '#91918E',
                                            transition: 'transform 0.3s, color 0.2s',
                                            transform: isVoiceModalOpen ? 'rotate(180deg)' : 'rotate(0)'
                                        }}
                                        className="select-arrow"
                                    />
                                </button>

                                <AnimatePresence>
                                    {isVoiceModalOpen && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                            transition={{ duration: 0.2, ease: "easeOut" }}
                                            style={{
                                                position: 'absolute', top: 'calc(100% + 12px)', left: 0,
                                                minWidth: '220px', background: '#1a1a1a',
                                                border: '1px solid #333332', borderRadius: '16px',
                                                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)',
                                                padding: '8px', zIndex: 1000, overflow: 'hidden'
                                            }}
                                        >
                                            <div style={{ padding: '8px 12px 12px', fontSize: '12px', color: '#91918E', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                Selecione a Voz
                                            </div>
                                            {VOICES.map((v) => (
                                                <motion.div
                                                    key={v.value}
                                                    whileHover={{ background: 'rgba(252, 251, 248, 0.05)' }}
                                                    onClick={() => {
                                                        setVoice(v.value);
                                                        playVoicePreview(v.value);
                                                    }}
                                                    style={{
                                                        padding: '10px 12px', borderRadius: '10px',
                                                        color: voice === v.value ? '#FCFBF8' : '#91918E',
                                                        fontSize: '14px', fontWeight: '500', cursor: 'pointer',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                        transition: 'color 0.2s'
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        {v.label}
                                                        {previewVoice === v.value ? (
                                                            <motion.div
                                                                animate={{ scale: [1, 1.2, 1] }}
                                                                transition={{ repeat: Infinity, duration: 1 }}
                                                            >
                                                                <SpeakerHigh size={14} color="#FCFBF8" />
                                                            </motion.div>
                                                        ) : (
                                                            <SpeakerHigh size={14} style={{ opacity: preloadedPreviews[v.value] ? 0.4 : 0.1 }} />
                                                        )}
                                                    </div>
                                                    {voice === v.value && <CheckCircle size={18} weight="fill" color="#FCFBF8" />}
                                                </motion.div>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
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
                                    <ArrowUp size={24} weight="bold" />
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Player - Menu Inferior Fixo */}
                <AnimatePresence>
                    {audioUrl && (
                        <motion.div
                            initial={{ opacity: 0, y: 100 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 100 }}
                            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                            onClick={isPlayerMinimized ? () => setIsPlayerMinimized(false) : undefined}
                            style={{
                                position: 'fixed',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                background: '#0a0a0a',
                                boxShadow: '0 -10px 40px rgba(0,0,0,0.6)',
                                padding: isPlayerMinimized ? '8px 32px' : '16px 32px',
                                zIndex: 1000,
                                boxSizing: 'border-box',
                                transition: 'padding 0.3s ease',
                                cursor: isPlayerMinimized ? 'pointer' : 'default'
                            }}
                        >
                            {/* Minimized View - Only Progress Bar */}
                            <div style={{
                                maxWidth: '400px', // Largura BEM MENOR
                                width: '100%',
                                margin: '0 auto',
                                display: isPlayerMinimized ? 'flex' : 'none',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <div
                                    style={{
                                        width: '100%', height: '4px', background: '#333',
                                        borderRadius: '2px', overflow: 'hidden', cursor: 'pointer'
                                    }}
                                >
                                    <div
                                        className="minimized-progress"
                                        style={{
                                            width: '0%', height: '100%',
                                            background: '#FCFBF8',
                                            borderRadius: '2px'
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Full View with react-h5-audio-player - Mantido no DOM para não pausar */}
                            <div style={{
                                maxWidth: '1200px',
                                width: '100%',
                                margin: '0 auto',
                                display: !isPlayerMinimized ? 'flex' : 'none',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '16px'
                            }}>
                                {/* Left: Voice Info - Largura Ajustada para 180px */}
                                <div style={{ width: '180px', display: 'flex', flexDirection: 'column', gap: '2px', flexShrink: 0 }}>
                                    <span style={{ fontSize: '13px', color: '#FCFBF8', fontWeight: '500' }}>
                                        {VOICES.find(v => v.value === voice)?.label || 'Audio'}
                                    </span>
                                    <span style={{ fontSize: '11px', color: '#666' }}>
                                        Áudio gerado
                                    </span>
                                </div>

                                {/* Center: Audio Player - Centralizado */}
                                <div style={{ flex: 1, maxWidth: '800px', width: '100%' }}>
                                    <AudioPlayer
                                        ref={playerRef}
                                        src={audioUrl}
                                        showJumpControls={false}
                                        showDownloadProgress={false}
                                        showFilledProgress={true}
                                        showFilledVolume={true}
                                        hasDefaultKeyBindings={false}
                                        autoPlayAfterSrcChange={false}
                                        layout="horizontal"
                                        customProgressBarSection={['CURRENT_TIME', 'PROGRESS_BAR', 'DURATION']}
                                        customControlsSection={['MAIN_CONTROLS']}
                                        customVolumeControls={[]}
                                        customIcons={{
                                            play: <Play size={16} weight="fill" color="#0a0a0a" />,
                                            pause: <Pause size={16} weight="fill" color="#0a0a0a" />
                                        }}
                                        onPlay={() => setIsPlaying(true)}
                                        onPause={() => setIsPlaying(false)}
                                        onEnded={() => setIsPlaying(false)}
                                        onListen={(e) => {
                                            // Update minimized progress bar
                                            const minProgress = document.querySelector('.minimized-progress');
                                            if (minProgress && e.target.duration) {
                                                minProgress.style.width = `${(e.target.currentTime / e.target.duration) * 100}%`;
                                            }
                                        }}
                                    />
                                </div>

                                {/* Right: Download + Minimize Buttons - Largura Ajustada para 230px para ajuste fino */}
                                <div style={{ width: '230px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', flexShrink: 0 }}>
                                    <motion.button
                                        whileHover={{ scale: 1.1, color: '#FCFBF8' }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={handleDownload}
                                        title="Baixar MP3"
                                        style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            background: 'transparent', border: 'none',
                                            color: '#666', cursor: 'pointer', padding: '6px',
                                            transition: 'color 0.2s'
                                        }}
                                    >
                                        <DownloadSimple size={18} weight="bold" />
                                    </motion.button>

                                    <motion.button
                                        whileHover={{ scale: 1.1, color: '#FCFBF8' }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => setIsPlayerMinimized(true)}
                                        title="Minimizar player"
                                        style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            background: 'transparent', border: 'none',
                                            color: '#666', cursor: 'pointer', padding: '6px',
                                            transition: 'color 0.2s'
                                        }}
                                    >
                                        <CaretDown size={18} weight="bold" />
                                    </motion.button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

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
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'rgba(255,255,255,0.7)', fontWeight: '500' }}>
                                                    <Clock size={16} weight="bold" />
                                                    {formatTime(book.duration_seconds || 0)}
                                                </div>
                                            ) : <span />}
                                            {book.audio_url && (
                                                <button onClick={() => window.open(book.audio_url, '_blank')}
                                                    style={{
                                                        background: '#2546C7', color: '#fff', border: 'none', padding: '8px 16px',
                                                        borderRadius: '8px', fontSize: '14px', fontWeight: '500', cursor: 'pointer',
                                                        display: 'flex', alignItems: 'center', gap: '6px'
                                                    }}>
                                                    <Play size={16} weight="fill" /> Ouvir
                                                </button>
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
                                    padding: '8px 16px', borderRadius: '6px', fontSize: '14px', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: '4px'
                                }}>
                                    <PencilSimple size={14} /> Editar
                                </button>
                                <button onClick={() => handleDelete(book.id)} style={{
                                    background: '#fee2e2', color: '#dc2626', border: 'none',
                                    padding: '8px 16px', borderRadius: '6px', fontSize: '14px', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: '4px'
                                }}>
                                    <Trash size={14} /> Excluir
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
