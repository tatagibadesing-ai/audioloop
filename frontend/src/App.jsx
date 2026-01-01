import { useState, useRef, useEffect, useCallback } from "react"
import { createClient } from '@supabase/supabase-js'
import { motion, AnimatePresence } from "framer-motion"
import WaveSurfer from 'wavesurfer.js'
import {
    CaretDown,
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
    CheckCircle,
    SpeakerHigh,
    CircleNotch,
    Broadcast
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

const ADMIN_EMAIL = '2closett@gmail.com'

const VOICES = [
    { value: 'pt-BR-AntonioNeural', label: 'Antonio BR', provider: 'edge' },
    { value: 'pt-BR-Neural2-B', label: 'Bruno BR', provider: 'google' },
    { value: 'pt-BR-FranciscaNeural', label: 'Francisca BR', provider: 'edge' },
    { value: 'pt-BR-ThalitaMultilingualNeural', label: 'Thalita BR', provider: 'edge' },
    { value: 'pt-BR-Wavenet-C', label: 'Fernanda BR', provider: 'google' },
    // Ocultos mas não excluídos (não aparecem no seletor principal)
    { value: 'pt-BR-Neural2-A', label: 'Julia BR', provider: 'google', hidden: true },
    { value: 'pt-PT-DuarteNeural', label: 'Duarte PT', provider: 'edge', hidden: true },
    { value: 'pt-PT-RaquelNeural', label: 'Raquel PT', provider: 'edge', hidden: true },
    { value: 'en-US-GuyNeural', label: 'Guy EN', provider: 'edge', hidden: true },
    { value: 'en-US-JennyNeural', label: 'Jenny EN', provider: 'edge', hidden: true },
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

// ==================== COMPONENTE WAVEFORM PLAYER ====================
function AudioWavePlayer({ url, onDownload }) {
    const waveformRef = useRef(null)
    const wavesurferRef = useRef(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration] = useState(0)

    useEffect(() => {
        if (!waveformRef.current) return

        wavesurferRef.current = WaveSurfer.create({
            container: waveformRef.current,
            waveColor: 'rgba(255, 255, 255, 0.2)',
            progressColor: '#6366f1',
            cursorColor: '#6366f1',
            barWidth: 2,
            barRadius: 3,
            responsive: true,
            height: 48,
            normalize: true,
            partialRender: true
        })

        wavesurferRef.current.load(url)

        wavesurferRef.current.on('ready', () => {
            setDuration(wavesurferRef.current.getDuration())
        })

        wavesurferRef.current.on('audioprocess', () => {
            setCurrentTime(wavesurferRef.current.getCurrentTime())
        })

        wavesurferRef.current.on('play', () => setIsPlaying(true))
        wavesurferRef.current.on('pause', () => setIsPlaying(false))
        wavesurferRef.current.on('finish', () => setIsPlaying(false))

        return () => wavesurferRef.current.destroy()
    }, [url])

    const togglePlay = () => {
        wavesurferRef.current?.playPause()
    }

    const formatTimer = (time) => {
        const m = Math.floor(time / 60)
        const s = Math.floor(time % 60)
        return `${m}:${s.toString().padStart(2, '0')}`
    }

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass p-6 rounded-[40px] w-full max-w-[850px] flex items-center gap-6"
        >
            <button
                onClick={togglePlay}
                className="w-12 h-12 flex items-center justify-center rounded-full bg-white text-slate-950 hover:scale-105 transition-transform shrink-0"
            >
                {isPlaying ? <Pause size={24} weight="fill" /> : <Play size={24} weight="fill" />}
            </button>

            <div className="flex-1 min-w-0">
                <div ref={waveformRef} className="w-full mb-1" />
                <div className="flex justify-between text-[11px] font-medium text-slate-400 font-mono tracking-tighter">
                    <span>{formatTimer(currentTime)}</span>
                    <span>{formatTimer(duration)}</span>
                </div>
            </div>

            <button
                onClick={onDownload}
                className="w-10 h-10 flex items-center justify-center rounded-full border border-slate-700 text-slate-300 hover:bg-white/5 hover:text-white transition-all shrink-0"
            >
                <DownloadSimple size={20} weight="bold" />
            </button>
        </motion.div>
    )
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
        <div className="min-h-screen">
            <Header user={user} isAdmin={isAdmin} setShowLoginModal={setShowLoginModal} />

            <main className="pt-20">
                <AnimatePresence mode="wait">
                    {page === 'admin' ? (
                        <motion.div
                            key="admin"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                        >
                            <AdminPage user={user} isAdmin={isAdmin} setShowLoginModal={setShowLoginModal} />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="home"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                        >
                            <HomePage user={user} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            <AnimatePresence>
                {showLoginModal && (
                    <LoginModal onClose={() => setShowLoginModal(false)} />
                )}
            </AnimatePresence>
        </div>
    )
}

// ==================== HEADER ====================
function Header({ user, isAdmin, setShowLoginModal }) {
    const handleLogout = async () => {
        if (supabase) await supabase.auth.signOut()
    }

    return (
        <header className="fixed top-0 left-0 right-0 h-16 glass z-[100] px-6 flex items-center justify-between border-b border-white/5">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                    <Broadcast size={20} color="white" weight="bold" />
                </div>
                <span className="text-xl font-bold tracking-tight text-white">
                    AudioLoop
                </span>
            </div>

            <div className="flex items-center gap-1">
                {isAdmin && (
                    <button
                        onClick={() => window.location.hash = '#admin'}
                        className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors flex items-center gap-2"
                    >
                        <Layout size={18} /> Admin
                    </button>
                )}
                <button
                    onClick={() => window.location.hash = '#'}
                    className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors flex items-center gap-2"
                >
                    <House size={18} /> Home
                </button>

                <div className="w-px h-6 bg-white/10 mx-2" />

                {user ? (
                    <div className="flex items-center gap-4 ml-2">
                        <div className="flex items-center gap-2 text-sm text-slate-300 font-medium bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
                            <UserCircle size={20} className="text-indigo-400" />
                            {user.email?.split('@')[0]}
                        </div>
                        <button onClick={handleLogout} className="text-sm font-medium text-rose-400 hover:text-rose-300 transition-colors flex items-center gap-1.5">
                            <SignOut size={18} /> Sair
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => setShowLoginModal(true)}
                        className="px-6 py-2 bg-white text-slate-950 rounded-full text-sm font-bold hover:scale-105 transition-transform"
                    >
                        Login
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
    const [mode, setMode] = useState('login')

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
                setError('Verifique seu email!')
            }
        } catch (e) {
            setError(e.message || 'Erro')
        } finally {
            setLoading(false)
        }
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="w-full max-w-sm glass bg-slate-900/90 rounded-[32px] p-8 shadow-2xl relative"
                onClick={e => e.stopPropagation()}
            >
                <button onClick={onClose} className="absolute top-6 right-6 text-slate-400 hover:text-white">
                    <X size={24} weight="bold" />
                </button>

                <h2 className="text-2xl font-bold text-white mb-2 text-center">
                    {mode === 'login' ? 'Bem-vindo de volta' : 'Crie sua conta'}
                </h2>
                <p className="text-slate-400 text-sm mb-8 text-center px-4">
                    {mode === 'login' ? 'Entre com seus dados para acessar sua conta.' : 'Junte-se a nós para gerar áudios incríveis.'}
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 ml-1 uppercase tracking-wider">Email</label>
                        <input
                            type="email" placeholder="nome@exemplo.com" value={email}
                            onChange={e => setEmail(e.target.value)} required
                            className="w-full h-12 glass-input rounded-2xl px-4 text-white"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 ml-1 uppercase tracking-wider">Senha</label>
                        <input
                            type="password" placeholder="••••••••" value={password}
                            onChange={e => setPassword(e.target.value)} required minLength={6}
                            className="w-full h-12 glass-input rounded-2xl px-4 text-white"
                        />
                    </div>

                    {error && <p className={`text-sm text-center font-medium ${error.includes('Verifique') ? 'text-emerald-400' : 'text-rose-400'}`}>{error}</p>}

                    <button type="submit" disabled={loading} className="w-full h-12 bg-white text-slate-950 font-bold rounded-2xl hover:scale-[1.02] transition-transform disabled:opacity-50">
                        {loading ? <CircleNotch className="animate-spin mx-auto" size={20} /> : (mode === 'login' ? 'Entrar' : 'Cadastrar')}
                    </button>

                    <button
                        type="button"
                        onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                        className="w-full pt-2 text-sm text-slate-400 hover:text-white font-medium"
                    >
                        {mode === 'login' ? 'Ainda não tem conta? Clique aqui' : 'Já tem uma conta? Clique aqui'}
                    </button>
                </form>
            </motion.div>
        </motion.div>
    )
}

// ==================== PÁGINA HOME (Gerador) ====================
function HomePage({ user }) {
    const [text, setText] = useState("")
    const [voice, setVoice] = useState("pt-BR-AntonioNeural")
    const [isLoading, setIsLoading] = useState(false)
    const [audioUrl, setAudioUrl] = useState(null)
    const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false)
    const [previewVoice, setPreviewVoice] = useState(null)
    const [preloadedPreviews, setPreloadedPreviews] = useState({})
    const voiceSelectRef = useRef(null)
    const previewAudioRef = useRef(new Audio())
    const [audiobooks, setAudiobooks] = useState([])
    const [loadingBooks, setLoadingBooks] = useState(true)
    const fileInputRef = useRef(null)

    useEffect(() => {
        const preloadVoices = async () => {
            const cache = {}
            for (const v of VOICES) {
                try {
                    const isEnglish = v.value.startsWith('en-US')
                    const previewText = isEnglish ? "Sample voice." : "Olá! Esta é a minha voz."
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
        setIsLoading(true)
        try {
            const formData = new FormData()
            formData.append('file', file)
            const res = await fetch(`${API_URL}/api/extract`, { method: 'POST', body: formData })
            if (!res.ok) throw new Error((await res.json()).error || 'Erro')
            const data = await res.json()
            setText(data.text)
        } catch (e) {
            alert(`Erro: ${e.message}`)
        } finally {
            setIsLoading(false)
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
        <div className="max-w-[1100px] mx-auto px-6 py-12">
            {/* Título Hero */}
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center mb-16"
            >
                <motion.h1
                    className="text-5xl md:text-7xl font-black mb-6 animate-glow tracking-tight text-gradient"
                >
                    AudioLoop
                </motion.h1>
                <p className="text-xl md:text-2xl text-slate-400 font-medium max-w-2xl mx-auto leading-relaxed">
                    Transforme textos em experiências sonoras imersivas com inteligência artificial.
                </p>
            </motion.div>

            {/* Gerador de Áudio */}
            <div className="flex flex-col items-center gap-8 mb-24">
                <motion.div
                    layout
                    className="glass rounded-[40px] p-6 w-full max-w-[850px] relative transition-shadow hover:shadow-indigo-500/5"
                >
                    <textarea
                        value={text} onChange={(e) => { setText(e.target.value); setAudioUrl(null); }}
                        placeholder="Peça para gerar um audiobook de..."
                        disabled={isLoading}
                        className="w-full min-h-[140px] bg-transparent border-none outline-none resize-none text-xl leading-relaxed text-white placeholder:text-slate-600 px-4 pt-2"
                    />

                    <div className="flex flex-wrap items-center justify-between gap-4 px-2 pb-2">
                        <div className="flex items-center gap-3">
                            <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt" onChange={handleFileUpload} className="hidden" />
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isLoading}
                                className="flex items-center gap-2 h-11 px-5 glass-input rounded-full text-slate-400 hover:text-white font-semibold text-sm transition-colors"
                            >
                                <Paperclip size={20} weight="bold" />
                                <span className="hidden sm:inline">Anexar</span>
                            </motion.button>

                            <div className="relative" ref={voiceSelectRef}>
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => setIsVoiceModalOpen(!isVoiceModalOpen)}
                                    disabled={isLoading}
                                    className={`flex items-center gap-2 h-11 px-5 rounded-full font-semibold text-sm transition-all ${isVoiceModalOpen ? 'bg-white text-slate-950 shadow-xl' : 'glass-input text-slate-400 hover:text-white'}`}
                                >
                                    <SpeakerHigh size={20} weight="bold" />
                                    {VOICES.find(v => v.value === voice)?.label}
                                    <CaretDown size={14} weight="bold" className={`transition-transform duration-300 ${isVoiceModalOpen ? 'rotate-180' : ''}`} />
                                </motion.button>

                                <AnimatePresence>
                                    {isVoiceModalOpen && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.9, y: 10 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.9, y: 10 }}
                                            className="absolute top-full mt-4 left-0 glass bg-slate-900/95 rounded-[32px] p-4 min-w-[240px] shadow-2xl z-50 border border-white/10"
                                        >
                                            <div className="text-[10px] uppercase tracking-widest font-black text-slate-500 px-4 mb-2">Vozes Disponíveis</div>
                                            {VOICES.filter(v => !v.hidden).map((v) => (
                                                <button
                                                    key={v.value}
                                                    onClick={() => {
                                                        setVoice(v.value);
                                                        playVoicePreview(v.value);
                                                    }}
                                                    className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all ${voice === v.value ? 'bg-indigo-500/10 text-indigo-400' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                                                >
                                                    <span className="font-bold text-sm">{v.label}</span>
                                                    {previewVoice === v.value ? (
                                                        <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity }}>
                                                            <SpeakerHigh size={18} weight="fill" />
                                                        </motion.div>
                                                    ) : (voice === v.value && <CheckCircle size={18} weight="fill" />)}
                                                </button>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            {text && (
                                <div className="hidden sm:flex items-center gap-1.5 text-xs font-black text-slate-500 uppercase tracking-tighter">
                                    <Clock size={16} weight="bold" />
                                    ~{estimateAudioDuration(text)}
                                </div>
                            )}

                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={handleGenerate}
                                disabled={isLoading || !text.trim()}
                                className={`w-14 h-14 flex items-center justify-center rounded-full transition-all shadow-xl disabled:opacity-50 ${isLoading || !text.trim() ? 'bg-slate-800 text-slate-500' : 'premium-gradient text-white shadow-indigo-500/20'}`}
                            >
                                {isLoading ? <CircleNotch size={28} weight="bold" className="animate-spin" /> : <ArrowUp size={28} weight="bold" />}
                            </motion.button>
                        </div>
                    </div>
                </motion.div>

                {/* Player Result com o mesmo estilo */}
                <AnimatePresence mode="wait">
                    {audioUrl && (
                        <AudioWavePlayer
                            key={audioUrl}
                            url={audioUrl}
                            onDownload={handleDownload}
                        />
                    )}
                </AnimatePresence>
            </div>

            {/* SEÇÃO AUDIOBOOKS */}
            <div className="mt-12">
                <div className="flex items-center justify-between mb-10">
                    <h2 className="text-3xl font-black text-white tracking-tight">Audiobooks Publicados</h2>
                    <div className="h-px flex-1 bg-white/5 mx-8" />
                </div>

                {loadingBooks ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3].map(i => <div key={i} className="h-64 glass rounded-[32px] animate-pulse" />)}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {audiobooks.map((book) => (
                            <motion.div
                                key={book.id}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                whileHover={{ y: -8 }}
                                className="glass rounded-[32px] overflow-hidden flex flex-col group h-full"
                            >
                                <div className="aspect-[4/3] relative overflow-hidden bg-slate-800">
                                    {book.cover_url ? (
                                        <img src={book.cover_url} alt={book.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                                    ) : (
                                        <div className="w-full h-full premium-gradient flex items-center justify-center">
                                            <SpeakerHigh size={64} color="white" weight="duotone" className="opacity-40" />
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent group-hover:from-indigo-950/80 transition-colors" />
                                </div>

                                <div className="p-8 flex flex-col flex-1">
                                    <h3 className="text-xl font-bold text-white mb-3 tracking-tight group-hover:text-indigo-300 transition-colors">{book.title}</h3>
                                    <p className="text-slate-400 text-sm leading-relaxed mb-6 flex-1 line-clamp-3">
                                        {book.description || "Nenhuma descrição disponível."}
                                    </p>

                                    <div className="flex items-center justify-between pt-4 border-t border-white/5">
                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
                                            <Clock size={16} />
                                            {formatTime(book.duration_seconds || 0)}
                                        </div>
                                        <motion.button
                                            whileHover={{ scale: 1.1 }}
                                            whileTap={{ scale: 0.9 }}
                                            onClick={() => window.open(book.audio_url, '_blank')}
                                            className="w-10 h-10 flex items-center justify-center rounded-full bg-white text-slate-950 shadow-lg"
                                        >
                                            <Play size={20} weight="fill" />
                                        </motion.button>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

// ==================== PÁGINA ADMIN ====================
function AdminPage({ user, isAdmin, setShowLoginModal }) {
    const [audiobooks, setAudiobooks] = useState([])
    const [loading, setLoading] = useState(true)
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
        if (!editingId && !audioFile) return alert('O arquivo de áudio é obrigatório')
        setSaving(true)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            const token = session?.access_token
            if (!token) throw new Error('Não autenticado')

            let audioUrl = existingAudioUrl
            let coverUrl = existingCoverUrl

            if (audioFile) {
                const audioName = `${Date.now()}-${audioFile.name}`
                const { error } = await supabase.storage.from('audios').upload(audioName, audioFile)
                if (error) throw error
                audioUrl = `${SUPABASE_URL}/storage/v1/object/public/audios/${audioName}`
            }

            if (coverFile) {
                const coverName = `${Date.now()}-${coverFile.name}`
                const { error } = await supabase.storage.from('covers').upload(coverName, coverFile)
                if (!error) coverUrl = `${SUPABASE_URL}/storage/v1/object/public/covers/${coverName}`
            }

            const body = { title, description, audio_url: audioUrl, cover_url: coverUrl }
            const res = await fetch(`${API_URL}/api/audiobooks${editingId ? `/${editingId}` : ''}`, {
                method: editingId ? 'PUT' : 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            })
            if (!res.ok) throw new Error('Erro ao salvar')
            alert('Salvo com sucesso!')
            resetForm()
            loadAudiobooks()
        } catch (e) {
            alert(`Erro: ${e.message}`)
        } finally {
            setSaving(false)
        }
    }

    const resetForm = () => {
        setTitle(''); setDescription(''); setAudioFile(null); setCoverFile(null); setEditingId(null); setExistingAudioUrl(''); setExistingCoverUrl('')
    }

    const handleDelete = async (id) => {
        if (!confirm('Excluir este audiobook?')) return
        try {
            const { data: { session } } = await supabase.auth.getSession()
            const token = session?.access_token
            const res = await fetch(`${API_URL}/api/audiobooks/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            })
            if (res.ok) loadAudiobooks()
        } catch (e) {
            console.error(e)
        }
    }

    if (!user || user.email !== ADMIN_EMAIL) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
                <div className="w-20 h-20 bg-rose-500/10 rounded-full flex items-center justify-center mb-6">
                    <X size={40} className="text-rose-500" />
                </div>
                <h2 className="text-3xl font-black text-white mb-2">Acesso Negado</h2>
                <p className="text-slate-400 max-w-sm mb-8">Esta página é exclusiva para administradores. Por favor, faça login com a conta correta.</p>
                <button onClick={() => setShowLoginModal(true)} className="px-8 py-3 bg-white text-slate-950 font-bold rounded-2xl hover:scale-105 transition-transform">
                    Ir para Login
                </button>
            </div>
        )
    }

    return (
        <div className="max-w-[1100px] mx-auto px-6 py-12">
            <h1 className="text-4xl font-black text-white mb-10 tracking-tight">Painel Administrativo</h1>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr,1.5fr] gap-12">
                {/* FORMULÁRIO */}
                <div className="glass rounded-[32px] p-8 h-fit sticky top-24">
                    <h2 className="text-xl font-bold text-white mb-6 underline decoration-indigo-500 decoration-4 underline-offset-8">
                        {editingId ? "Editar Audiobook" : "Publicar Audiobook"}
                    </h2>
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Título</label>
                            <input type="text" value={title} onChange={e => setTitle(e.target.value)} required className="w-full h-12 glass-input rounded-2xl px-4 text-white" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Descrição</label>
                            <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full h-32 glass-input rounded-2xl p-4 text-white resize-none" />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Áudio</label>
                                <input type="file" accept="audio/*" onChange={e => setAudioFile(e.target.files[0])} className="text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-300 hover:file:bg-slate-700" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Capa</label>
                                <input type="file" accept="image/*" onChange={e => setCoverFile(e.target.files[0])} className="text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-300 hover:file:bg-slate-700" />
                            </div>
                        </div>
                        <div className="flex gap-3 pt-4">
                            <button type="submit" disabled={saving} className="flex-1 h-12 bg-white text-slate-950 font-bold rounded-2xl hover:scale-[1.02] transition-transform">
                                {saving ? <CircleNotch className="animate-spin mx-auto" /> : "Salvar"}
                            </button>
                            {editingId && (
                                <button type="button" onClick={resetForm} className="px-6 glass-input text-slate-400 rounded-2xl font-bold">Cancelar</button>
                            )}
                        </div>
                    </form>
                </div>

                {/* LISTAGEM */}
                <div className="space-y-4">
                    <h2 className="text-xl font-bold text-white mb-6">Seus Áudios</h2>
                    {loading ? <p className="text-slate-500">Carregando...</p> : audiobooks.map(book => (
                        <div key={book.id} className="glass rounded-2xl p-4 flex items-center gap-4 group">
                            <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-slate-800">
                                {book.cover_url ? <img src={book.cover_url} className="w-full h-full object-cover" /> : <SpeakerHigh size={32} className="m-auto h-full opacity-20" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-white font-bold truncate">{book.title}</h3>
                                <p className="text-slate-500 text-xs font-medium uppercase tracking-tighter">{formatTime(book.duration_seconds || 0)}</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => { setTitle(book.title); setDescription(book.description || ''); setEditingId(book.id); setExistingAudioUrl(book.audio_url); setExistingCoverUrl(book.cover_url); }} className="p-3 text-slate-400 hover:text-white glass-input rounded-xl"><PencilSimple size={18} /></button>
                                <button onClick={() => handleDelete(book.id)} className="p-3 text-slate-400 hover:text-rose-500 glass-input rounded-xl"><Trash size={18} /></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
