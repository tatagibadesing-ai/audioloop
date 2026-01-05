import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { TypeAnimation } from 'react-type-animation'
import AudioPlayer from 'react-h5-audio-player'
import 'react-h5-audio-player/lib/styles.css'
import { useDropzone } from 'react-dropzone'

// Componentes
import HoverActionButton from '../components/ui/HoverActionButton'

// Serviços e constantes
import { supabase } from '../services/supabase'
import { API_URL, VOICES, formatTime, estimateAudioDuration } from '../constants'

// Ícones
import {
    CaretDown,
    Paperclip,
    ArrowUp,
    DownloadSimple,
    Clock,
    PencilSimple,
    X,
    Play,
    Pause,
    UploadSimple,
    CheckCircle,
    Plus,
    CircleNotch
} from "@phosphor-icons/react"

export default function HomePage({ user, isAdmin }) {
    const [text, setText] = useState("")
    const [voice, setVoice] = useState("pt-BR-AntonioNeural")
    const [isLoading, setIsLoading] = useState(false)
    const [audioUrl, setAudioUrl] = useState(null)
    const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false)
    const [previewVoice, setPreviewVoice] = useState(null)
    const [preloadedPreviews, setPreloadedPreviews] = useState({})
    const [isPlaying, setIsPlaying] = useState(false)
    const [isPlayerMinimized, setIsPlayerMinimized] = useState(false)
    const [generationProgress, setGenerationProgress] = useState(0)
    const [timeLeft, setTimeLeft] = useState(0)

    // Estados para publicação
    const [isPublishModalOpen, setIsPublishModalOpen] = useState(false)
    const [publishTitle, setPublishTitle] = useState('')
    const [publishDesc, setPublishDesc] = useState('')
    const [publishCover, setPublishCover] = useState(null)
    const [isPublishing, setIsPublishing] = useState(false)
    const [isPlayerHovered, setIsPlayerHovered] = useState(false)
    const [playerProgress, setPlayerProgress] = useState(0)
    const [isReadingFile, setIsReadingFile] = useState(false)

    // Sincronização ultra-suave do player (60 FPS reais via RAF)
    useEffect(() => {
        let rafId
        const update = () => {
            if (isPlaying && playerRef.current?.audio?.current) {
                const audio = playerRef.current.audio.current
                if (!audio.paused && audio.duration) {
                    const progress = (audio.currentTime / audio.duration) * 100
                    setPlayerProgress(progress)

                    // FORÇA a barra do player principal a atualizar instantaneamente (Bypass React/Library lag)
                    const mainProgressBar = document.querySelector('.rhap_progress-filled')
                    if (mainProgressBar) {
                        mainProgressBar.style.width = `${progress}%`
                    }
                    const indicator = document.querySelector('.rhap_progress-indicator')
                    if (indicator) {
                        indicator.style.left = `${progress}%`
                    }
                }
            }
            rafId = requestAnimationFrame(update)
        }
        rafId = requestAnimationFrame(update)
        return () => cancelAnimationFrame(rafId)
    }, [isPlaying])

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        accept: { 'image/*': [] },
        maxFiles: 1,
        onDrop: acceptedFiles => {
            setPublishCover(acceptedFiles[0])
        }
    })

    const handlePublish = async () => {
        if (!publishTitle.trim()) return alert('Digite um título')
        if (!audioUrl) return alert('Nenhum áudio para publicar')

        setIsPublishing(true)
        try {
            const sessionData = await supabase.auth.getSession()
            const token = sessionData.data.session?.access_token
            if (!token) throw new Error("Não autenticado")

            const audioBlob = await fetch(audioUrl).then(r => r.blob())
            const audioFile = new File([audioBlob], `audiobook-${Date.now()}.mp3`, { type: 'audio/mpeg' })

            const audioFormData = new FormData()
            audioFormData.append('file', audioFile)

            const audioRes = await fetch(`${API_URL}/api/upload/audio`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: audioFormData
            })

            if (!audioRes.ok) {
                const err = await audioRes.json()
                throw new Error(err.error || 'Falha no upload do áudio')
            }
            const audioData = await audioRes.json()

            // Corrige URL se for relativa
            let finalAudioUrl = audioData.url
            if (finalAudioUrl.startsWith('/')) {
                finalAudioUrl = `${API_URL}${finalAudioUrl}`
            }

            let coverUrl = ''
            if (publishCover) {
                const coverFormData = new FormData()
                coverFormData.append('file', publishCover)
                const coverRes = await fetch(`${API_URL}/api/upload/cover`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: coverFormData
                })
                if (coverRes.ok) {
                    const coverData = await coverRes.json()
                    coverUrl = coverData.url
                    if (coverUrl.startsWith('/')) {
                        coverUrl = `${API_URL}${coverUrl}`
                    }
                }
            }

            const createRes = await fetch(`${API_URL}/api/audiobooks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    title: publishTitle,
                    description: publishDesc,
                    audio_url: finalAudioUrl,
                    cover_url: coverUrl,
                    duration_seconds: playerRef.current?.audio?.current?.duration || 0
                })
            })

            if (!createRes.ok) throw new Error('Falha ao criar registro')

            alert('Audiobook publicado com sucesso!')
            setIsPublishModalOpen(false)
            setPublishTitle('')
            setPublishDesc('')
            setPublishCover(null)
            loadAudiobooks()

        } catch (e) {
            alert(`Erro ao publicar: ${e.message}`)
        } finally {
            setIsPublishing(false)
        }
    }

    const voiceSelectRef = useRef(null)
    const previewAudioRef = useRef(new Audio())
    const playerRef = useRef(null)

    useEffect(() => {
        const preloadVoices = async () => {
            const cache = {}
            for (const v of VOICES) {
                try {
                    const isEnglish = v.value.startsWith('en-US')
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

        setIsReadingFile(true)
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
            setIsReadingFile(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const handleGenerate = async () => {
        if (!text.trim()) return
        setIsLoading(true)
        setAudioUrl(null)
        setGenerationProgress(0)

        try {
            // 1. Inicia o Job
            const startRes = await fetch(`${API_URL}/api/generate/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, voice })
            })

            if (!startRes.ok) {
                const err = await startRes.json()
                throw new Error(err.error || 'Erro ao iniciar geração')
            }

            const { job_id } = await startRes.json()

            // Estimativa inicial mais agressiva (aproximadamente 0.01s por caractere)
            const initialEstimation = Math.max(5, text.length * 0.01)
            setTimeLeft(initialEstimation)

            // 2. Polling de Status
            const startTime = Date.now()
            let estimatedTotalSeconds = initialEstimation

            // Timer visual ultra-suave (100 FPS) - Atualiza a cada 10ms
            const visualTimer = setInterval(() => {
                const elapsedSeconds = (Date.now() - startTime) / 1000

                // Calcula o tempo restante baseado no total estimado que temos
                const remaining = Math.max(0.1, estimatedTotalSeconds - elapsedSeconds)
                setTimeLeft(remaining)

                // Calcula o progresso visual suave (0-99.9)
                setGenerationProgress(prev => {
                    const visualProg = (elapsedSeconds / estimatedTotalSeconds) * 100
                    if (visualProg >= 99.9) return 99.9
                    // Garante que a barra nunca volte para trás
                    return Math.max(prev, visualProg)
                })
            }, 10)

            const pollInterval = setInterval(async () => {
                try {
                    const statusRes = await fetch(`${API_URL.replace(/\/$/, '')}/api/generate/status/${job_id}`)

                    if (statusRes.status === 404) {
                        clearInterval(pollInterval)
                        clearInterval(visualTimer)
                        setIsLoading(false)
                        return
                    }

                    const statusData = await statusRes.json()
                    const backendProgress = statusData.progress || 0

                    if (statusData.status === 'done') {
                        clearInterval(pollInterval)
                        clearInterval(visualTimer)
                        setGenerationProgress(100)
                        setTimeLeft(0)

                        const downloadUrl = `${API_URL.replace(/\/$/, '')}/api/generate/download/${job_id}`
                        const audioBlob = await fetch(downloadUrl).then(r => r.blob())
                        const url = URL.createObjectURL(audioBlob)
                        setAudioUrl(url)
                        setIsLoading(false)
                    } else if (statusData.status === 'error') {
                        clearInterval(pollInterval)
                        clearInterval(visualTimer)
                        setIsLoading(false)
                        alert(`Erro na geração: ${statusData.error}`)
                    } else if (backendProgress > 5) {
                        // RECALCULA A ESTIMATIVA REAL BASEADA NA VELOCIDADE DO BACKEND
                        const elapsedMs = Date.now() - startTime
                        const currentEstimatedTotalMs = (elapsedMs / backendProgress) * 100

                        // Atualiza a variável que o visualTimer usa para calcular os frames
                        estimatedTotalSeconds = currentEstimatedTotalMs / 1000
                    }
                } catch (e) {
                    console.error("Erro no polling:", e)
                }
            }, 3000)

        } catch (e) {
            setIsLoading(false)
            alert(e.message)
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
            <div
                className="hero-container"
                style={{
                    minHeight: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundImage: "url('/background.jpg')",
                    backgroundSize: 'cover',
                    backgroundPosition: 'bottom',
                    boxSizing: 'border-box'
                }}
            >
                {/* Título */}
                <div className="hero-header" style={{ textAlign: 'center', marginBottom: '48px', maxWidth: '900px', width: '100%', margin: '0 auto 48px' }}>
                    <h1 className="hero-title">
                        Gerador de Audiobook Profissional
                    </h1>
                    <p className="hero-subtitle">
                        Transforme qualquer texto em audiobook de forma ilimitada e gratuita.
                    </p>
                </div>

                {/* Card Gerador */}
                <div
                    className="generator-card"
                    style={{
                        maxWidth: '850px', width: '100%', margin: '0 auto 24px',
                        background: '#1a1a1a', borderRadius: '32px',
                        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                        padding: '12px', boxSizing: 'border-box'
                    }}
                >
                    <div className="generator-input-wrapper" style={{ padding: '16px 20px 8px', position: 'relative' }}>
                        {!text && (
                            <div style={{
                                position: 'absolute',
                                top: '16px',
                                left: '20px',
                                pointerEvents: 'none',
                                fontSize: window.innerWidth < 1024 ? '14px' : '18px',
                                lineHeight: '1.6',
                                color: '#666',
                                fontFamily: "'Figtree', sans-serif"
                            }} className="generator-textarea">
                                <TypeAnimation
                                    sequence={[
                                        'Peça para gerar um audiobook de seu Texto...',
                                        2000,
                                        'Peça para gerar um audiobook de seu PDF...',
                                        2000,
                                        'Peça para gerar um audiobook de seu Artigo...',
                                        2000,
                                        'Peça para gerar um audiobook de sua Ideia...',
                                        2000
                                    ]}
                                    wrapper="span"
                                    speed={50}
                                    repeat={Infinity}
                                    cursor={true}
                                />
                            </div>
                        )}
                        <textarea
                            value={text}
                            onChange={(e) => {
                                setText(e.target.value)
                                setAudioUrl(null)
                                e.target.style.height = 'auto'
                                e.target.style.height = `${e.target.scrollHeight}px`
                            }}
                            rows={1}
                            placeholder=""
                            disabled={isLoading}
                            className="generator-textarea"
                            style={{
                                width: '100%', minHeight: window.innerWidth < 1024 ? '60px' : '120px', maxHeight: '480px',
                                background: 'transparent', border: 'none',
                                outline: 'none', resize: 'none', fontSize: '18px', lineHeight: '1.6', color: '#FCFBF8',
                                fontFamily: "'Figtree', sans-serif", boxSizing: 'border-box',
                                position: 'relative', zIndex: 1, overflowY: 'auto'
                            }}
                        />
                    </div>

                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 12px', gap: '8px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt" onChange={handleFileUpload} style={{ display: 'none' }} />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isLoading}
                                className="generator-badge"
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px',
                                    background: 'transparent', border: '1px solid #333332',
                                    borderRadius: '20px', color: '#91918E', cursor: 'pointer', fontSize: '14px', fontWeight: '600',
                                    fontFamily: "'Figtree', sans-serif", transition: 'all 0.2s'
                                }}
                            >
                                <Paperclip size={18} weight="bold" />
                                Anexar
                            </button>

                            <div style={{ position: 'relative' }} ref={voiceSelectRef}>
                                <button
                                    onClick={() => setIsVoiceModalOpen(!isVoiceModalOpen)}
                                    disabled={isLoading}
                                    className="generator-badge"
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px',
                                        background: 'transparent',
                                        border: `1px solid ${isVoiceModalOpen ? '#40403F' : '#333332'}`,
                                        borderRadius: '20px',
                                        color: isVoiceModalOpen ? '#FCFBF8' : '#91918E',
                                        fontSize: '14px', fontWeight: '600',
                                        cursor: 'pointer', fontFamily: "'Figtree', sans-serif", transition: 'all 0.2s'
                                    }}
                                >
                                    {(() => {
                                        const selected = VOICES.find(v => v.value === voice)
                                        return (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                {selected?.image && (
                                                    <img
                                                        src={selected.image}
                                                        alt=""
                                                        style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover' }}
                                                    />
                                                )}
                                                {selected?.label.split(' ')[0]}
                                                <CaretDown size={14} weight="bold" color="#666" />
                                            </div>
                                        )
                                    })()}

                                </button>

                                <AnimatePresence>
                                    {isVoiceModalOpen && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                            transition={{ duration: 0.2, ease: "easeOut" }}
                                            className="voice-modal"
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
                                                        setVoice(v.value)
                                                        playVoicePreview(v.value)
                                                    }}
                                                    className="voice-item"
                                                    style={{
                                                        padding: '10px 12px', borderRadius: '10px',
                                                        color: voice === v.value ? '#FCFBF8' : '#91918E',
                                                        fontSize: '14px', fontWeight: '500', cursor: 'pointer',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                        transition: 'color 0.2s'
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        {v.image && (
                                                            <img
                                                                src={v.image}
                                                                alt=""
                                                                style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }}
                                                            />
                                                        )}
                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                                            <span>{v.label}</span>
                                                            <span className="voice-item-provider" style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>
                                                                {v.provider === 'google' ? 'Google Cloud' : 'Microsoft Azure'}
                                                            </span>
                                                        </div>
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

                            <button
                                onClick={handleGenerate}
                                disabled={isLoading || !text.trim()}
                                className="generator-button"
                                style={{
                                    width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    background: isLoading || !text.trim() ? '#91918e' : '#FCFBF8',
                                    border: 'none', borderRadius: '50%',
                                    color: '#03030D',
                                    cursor: isLoading || !text.trim() ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.2s',
                                }}
                            >
                                {isLoading ? (
                                    <CircleNotch size={20} weight="bold" className="animate-spin" />
                                ) : (
                                    <ArrowUp size={22} weight="bold" />
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Loading Overlay para Leitura de Arquivos */}
                <AnimatePresence>
                    {isReadingFile && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            style={{
                                position: 'fixed', inset: 0,
                                background: 'rgba(3, 3, 13, 0.85)',
                                backdropFilter: 'blur(10px)',
                                zIndex: 9999,
                                display: 'flex', flexDirection: 'column',
                                alignItems: 'center', justifyContent: 'center',
                                gap: '24px'
                            }}
                        >
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                                style={{
                                    width: '64px', height: '64px',
                                    border: '3px solid rgba(252, 251, 248, 0.1)',
                                    borderTop: '3px solid #FCFBF8',
                                    borderRadius: '50%'
                                }}
                            />
                            <div style={{ textAlign: 'center' }}>
                                <motion.h3
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    style={{ color: '#FCFBF8', fontSize: '20px', fontWeight: '600', marginBottom: '8px' }}
                                >
                                    Lendo seu arquivo...
                                </motion.h3>
                                <motion.p
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.2 }}
                                    style={{ color: '#91918E', fontSize: '14px' }}
                                >
                                    Extraindo o melhor do seu conteúdo para o audiobook.
                                </motion.p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Modal de Publicação */}
                <AnimatePresence>
                    {isPublishModalOpen && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            style={{
                                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000,
                                backdropFilter: 'blur(10px)'
                            }}
                            onClick={() => setIsPublishModalOpen(false)}
                        >
                            <motion.div
                                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                                onClick={e => e.stopPropagation()}
                                style={{
                                    width: '100%', maxWidth: '640px', background: '#0a0a0a',
                                    borderRadius: '28px', padding: '40px', border: 'none',
                                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                                    <div>
                                        <h2 style={{ fontSize: '28px', fontWeight: '700', color: '#FCFBF8', margin: 0, letterSpacing: '-0.02em' }}>Publicar Audiobook</h2>
                                        <p style={{ color: '#666', fontSize: '14px', marginTop: '4px' }}>Configure os detalhes do seu novo conteúdo</p>
                                    </div>
                                    <button
                                        onClick={() => setIsPublishModalOpen(false)}
                                        style={{
                                            background: 'rgba(255,255,255,0.05)', border: 'none', color: '#666',
                                            cursor: 'pointer', width: '40px', height: '40px', borderRadius: '50%',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <X size={20} />
                                    </button>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: '24px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <label style={{ color: '#888', fontSize: '13px', fontWeight: '500', marginLeft: '4px' }}>Título</label>
                                            <input
                                                type="text" placeholder="Dê um nome ao seu audiobook"
                                                value={publishTitle} onChange={e => setPublishTitle(e.target.value)}
                                                style={{
                                                    width: '100%', padding: '16px', background: 'rgba(255,255,255,0.03)',
                                                    border: 'none', borderRadius: '16px', color: '#FCFBF8',
                                                    fontSize: '15px', boxSizing: 'border-box', outline: 'none',
                                                    transition: 'background 0.2s'
                                                }}
                                            />
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <label style={{ color: '#888', fontSize: '13px', fontWeight: '500', marginLeft: '4px' }}>Descrição</label>
                                            <textarea
                                                placeholder="O que os ouvintes devem saber?" rows={5}
                                                value={publishDesc} onChange={e => setPublishDesc(e.target.value)}
                                                style={{
                                                    width: '100%', padding: '16px', background: 'rgba(255,255,255,0.03)',
                                                    border: 'none', borderRadius: '16px', color: '#FCFBF8',
                                                    fontSize: '15px', resize: 'none', boxSizing: 'border-box', outline: 'none',
                                                    transition: 'background 0.2s'
                                                }}
                                            />
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <label style={{ color: '#888', fontSize: '13px', fontWeight: '500', marginLeft: '4px' }}>Capa</label>
                                        <div
                                            {...getRootProps()}
                                            style={{
                                                width: '200px', height: '266px', background: 'rgba(255,255,255,0.03)',
                                                borderRadius: '16px', border: isDragActive ? '2px dashed #FCFBF8' : '2px dashed rgba(255,255,255,0.1)',
                                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                                cursor: 'pointer', overflow: 'hidden', position: 'relative',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            <input {...getInputProps()} />
                                            {publishCover ? (
                                                <>
                                                    <img
                                                        src={URL.createObjectURL(publishCover)}
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                        alt="Preview"
                                                    />
                                                    <div style={{
                                                        position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        opacity: 0, transition: 'opacity 0.2s'
                                                    }}
                                                        onMouseEnter={e => e.currentTarget.style.opacity = 1}
                                                        onMouseLeave={e => e.currentTarget.style.opacity = 0}
                                                    >
                                                        <PencilSimple size={24} color="#fff" />
                                                    </div>
                                                </>
                                            ) : (
                                                <div style={{ textAlign: 'center', padding: '20px' }}>
                                                    <Plus size={32} color="#444" style={{ marginBottom: '12px' }} />
                                                    <p style={{ color: '#444', fontSize: '12px', margin: 0, lineHeight: '1.4' }}>Arraste aqui ou clique para selecionar</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={handlePublish} disabled={isPublishing}
                                    style={{
                                        width: '100%', padding: '18px', marginTop: '32px',
                                        background: isPublishing ? '#333' : '#FCFBF8',
                                        color: isPublishing ? '#999' : '#0a0a0a',
                                        border: 'none', borderRadius: '18px', fontSize: '16px',
                                        fontWeight: '700', cursor: isPublishing ? 'not-allowed' : 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {isPublishing ? (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                                            <CircleNotch size={20} style={{ animation: 'spin 1s linear infinite' }} />
                                            Publicando...
                                        </div>
                                    ) : 'Publicar Agora'}
                                </button>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Player de Áudio */}
                <AnimatePresence>
                    {(audioUrl || isLoading) && (
                        <motion.div
                            initial={{ opacity: 0, y: 100 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 100 }}
                            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                            onMouseEnter={() => isPlayerMinimized && !isLoading && setIsPlayerHovered(true)}
                            onMouseLeave={() => setIsPlayerHovered(false)}
                            onClick={isPlayerMinimized && !isLoading ? () => { setIsPlayerMinimized(false); setIsPlayerHovered(false) } : undefined}
                            style={{
                                position: 'fixed', bottom: 0, left: window.innerWidth < 1024 ? 0 : '260px', right: 0,
                                background: '#0a0a0a', boxShadow: '0 -10px 40px rgba(0,0,0,0.6)',
                                padding: window.innerWidth < 768 ? '8px 12px' : (isPlayerMinimized && !isLoading ? '8px 32px' : '16px 32px'),
                                zIndex: 1000, boxSizing: 'border-box',
                                transition: 'padding 0.3s ease, left 0.3s ease',
                                cursor: isPlayerMinimized && !isLoading ? 'pointer' : 'default'
                            }}
                        >
                            {isLoading ? (
                                <div style={{ maxWidth: '1200px', width: '100%', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                                    <div style={{ width: '230px', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                                        {(() => {
                                            const selected = VOICES.find(v => v.value === voice)
                                            return selected?.image && (
                                                <img src={selected.image} alt="" style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #1a1a1a', opacity: 0.7 }} />
                                            )
                                        })()}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                            <span style={{ fontSize: '14px', color: '#FCFBF8', fontWeight: '500' }}>Gerando Áudio...</span>
                                            <span style={{ fontSize: '11px', color: '#666' }}>Aguarde um momento</span>
                                        </div>
                                    </div>
                                    <div style={{ flex: 1, maxWidth: '600px', margin: '0 24px' }}>
                                        <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${generationProgress}%` }}
                                                transition={{ ease: 'linear', duration: 0.1 }}
                                                style={{ height: '100%', background: '#FCFBF8' }}
                                            />
                                        </div>
                                    </div>
                                    <div style={{ width: '230px', textAlign: 'right', fontSize: '13px', color: '#666', fontVariantNumeric: 'tabular-nums' }}>
                                        ~{formatTime(timeLeft)} restantes
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* Minimized View */}
                                    <div style={{
                                        maxWidth: '400px', width: '100%', margin: '0 auto',
                                        display: isPlayerMinimized ? 'flex' : 'none',
                                        alignItems: 'center', justifyContent: 'center',
                                        position: 'relative'
                                    }}>
                                        <AnimatePresence>
                                            {isPlayerHovered && isPlayerMinimized && !isLoading && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                                                    transition={{ duration: 0.2, ease: "easeOut" }}
                                                    style={{
                                                        position: 'absolute',
                                                        bottom: '100%',
                                                        left: 0,
                                                        right: 0,
                                                        margin: '0 auto',
                                                        width: 'max-content',
                                                        marginBottom: '16px',
                                                        background: '#FCFBF8',
                                                        color: '#0a0a0a',
                                                        padding: '4px 10px',
                                                        borderRadius: '6px',
                                                        fontSize: '11px',
                                                        fontWeight: '500',
                                                        whiteSpace: 'nowrap',
                                                        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                                                        pointerEvents: 'none',
                                                        zIndex: 10001
                                                    }}
                                                >
                                                    Expandir Player
                                                    <div style={{
                                                        position: 'absolute',
                                                        top: '100%',
                                                        left: '50%',
                                                        transform: 'translateX(-50%)',
                                                        width: 0,
                                                        height: 0,
                                                        borderLeft: '5px solid transparent',
                                                        borderRight: '5px solid transparent',
                                                        borderTop: '5px solid #FCFBF8',
                                                    }} />
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                        <div style={{ width: '100%', height: '4px', background: '#333', borderRadius: '2px', overflow: 'hidden' }}>
                                            <motion.div
                                                animate={{ width: `${playerProgress}%` }}
                                                transition={{ ease: 'linear', duration: 0.1 }}
                                                style={{ height: '100%', background: '#FCFBF8', borderRadius: '2px' }}
                                            />
                                        </div>
                                    </div>

                                    {/* Full View */}
                                    <div style={{
                                        maxWidth: '1200px', width: '100%', margin: '0 auto',
                                        display: !isPlayerMinimized ? 'flex' : 'none',
                                        flexDirection: 'row',
                                        alignItems: 'center', justifyContent: 'space-between', gap: '16px'
                                    }}>
                                        <div style={{
                                            width: 'auto',
                                            display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0
                                        }}>
                                            {(() => {
                                                const selected = VOICES.find(v => v.value === voice)
                                                return (
                                                    <>
                                                        {selected?.image && (
                                                            <img
                                                                src={selected.image} alt=""
                                                                style={{
                                                                    width: window.innerWidth < 768 ? '32px' : '38px',
                                                                    height: window.innerWidth < 768 ? '32px' : '38px',
                                                                    borderRadius: '50%', objectFit: 'cover', border: '2px solid #1a1a1a'
                                                                }}
                                                            />
                                                        )}
                                                        <div className="mobile-hide-text" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                            <span style={{ fontSize: '15px', color: '#FCFBF8', fontWeight: '400' }}>
                                                                {selected?.label || 'Audio'}
                                                            </span>
                                                            <span style={{ fontSize: '11px', color: '#666' }}>
                                                                Áudio gerado
                                                            </span>
                                                        </div>
                                                    </>
                                                )
                                            })()}
                                        </div>

                                        <div style={{ flex: 1, maxWidth: '800px', width: '100%' }}>
                                            <AudioPlayer
                                                ref={playerRef} src={audioUrl}
                                                showJumpControls={false} showDownloadProgress={false}
                                                showFilledProgress={true} showFilledVolume={true}
                                                hasDefaultKeyBindings={false} autoPlayAfterSrcChange={false}
                                                progressUpdateInterval={10}
                                                layout="horizontal"
                                                customProgressBarSection={['CURRENT_TIME', 'PROGRESS_BAR', 'DURATION']}
                                                customControlsSection={['MAIN_CONTROLS']}
                                                customVolumeControls={[]}
                                                customIcons={{
                                                    play: <Play size={window.innerWidth < 768 ? 14 : 16} weight="fill" color="#0a0a0a" />,
                                                    pause: <Pause size={window.innerWidth < 768 ? 14 : 16} weight="fill" color="#0a0a0a" />
                                                }}
                                                onPlay={() => setIsPlaying(true)}
                                                onPause={() => setIsPlaying(false)}
                                                onEnded={() => setIsPlaying(false)}
                                            />
                                        </div>

                                        <div style={{
                                            width: 'auto',
                                            display: 'flex', alignItems: 'center',
                                            justifyContent: 'flex-end',
                                            gap: '4px', flexShrink: 0
                                        }}>
                                            {isAdmin && (
                                                <HoverActionButton
                                                    icon={UploadSimple}
                                                    label="Publicar"
                                                    size={window.innerWidth < 768 ? 20 : 24}
                                                    onClick={() => setIsPublishModalOpen(true)}
                                                />
                                            )}
                                            <HoverActionButton
                                                icon={DownloadSimple}
                                                label="Baixar"
                                                size={window.innerWidth < 768 ? 20 : 24}
                                                onClick={handleDownload}
                                            />
                                            <HoverActionButton
                                                icon={CaretDown}
                                                label="Minimizar"
                                                size={window.innerWidth < 768 ? 20 : 24}
                                                onClick={() => setIsPlayerMinimized(true)}
                                            />
                                        </div>
                                    </div>
                                </>
                            )}
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

            {/* Seção Audiobooks */}
            <div
                className="section-container audiobooks-section-mobile"
                style={{
                    width: '100%',
                    background: '#03030D',
                    padding: window.innerWidth < 768 ? '40px 16px' : '64px 24px'
                }}
            >
                <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
                    <h2 className="section-title">
                        Audiobooks Disponíveis
                    </h2>

                    {loadingBooks ? (
                        <p style={{ color: 'rgba(255,255,255,0.5)' }}>Carregando...</p>
                    ) : audiobooks.length === 0 ? (
                        <p style={{ color: 'rgba(255,255,255,0.5)' }}>Nenhum audiobook publicado ainda.</p>
                    ) : (
                        <div className="audiobooks-grid">
                            {audiobooks.map((book) => (
                                <div key={book.id} style={{
                                    background: 'rgba(255,255,255,0.03)',
                                    borderRadius: '16px',
                                    border: 'none',
                                    overflow: 'hidden',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                                    transition: 'transform 0.2s, box-shadow 0.2s, background 0.2s',
                                    cursor: book.audio_url ? 'pointer' : 'default'
                                }}
                                    onClick={() => book.audio_url && window.open(book.audio_url, '_blank')}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.transform = 'translateY(-6px)'
                                        e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.5)'
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.transform = 'translateY(0)'
                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)'
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                                    }}
                                >
                                    {book.cover_url ? (
                                        <img src={book.cover_url} alt={book.title} style={{ width: '100%', height: 'auto', display: 'block' }} />
                                    ) : (
                                        <div style={{ width: '100%', height: '200px', background: 'linear-gradient(135deg, #2546C7 0%, #1a3399 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <span style={{ fontSize: '48px' }}>🎧</span>
                                        </div>
                                    )}
                                    <div className="audiobook-card-content" style={{ padding: '24px' }}>
                                        <h3 className="audiobook-card-title" style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px', color: '#ffffff' }}>{book.title}</h3>
                                        {book.description && (
                                            <p className="audiobook-card-desc" style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', marginBottom: '20px', lineHeight: '1.6' }}>
                                                {book.description.slice(0, 100)}{book.description.length > 100 ? '...' : ''}
                                            </p>
                                        )}
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <span />
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
