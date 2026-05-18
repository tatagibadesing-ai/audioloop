import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Play, Pause, DownloadSimple, Trash, BookBookmark, X, CircleNotch, TextAa } from "@phosphor-icons/react"
import AudioPlayer from 'react-h5-audio-player'
import 'react-h5-audio-player/lib/styles.css'
import { removeFromLibrary, updateProgress } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { useData } from '../contexts/DataContext'
import { formatTime } from '../constants'
import ReaderView from '../components/ReaderView'
import MobileHeader from '../components/layout/MobileHeader'

export default function MyBooksPage({ setShowLoginModal }) {
    const { user, getToken, loading: authLoading } = useAuth()
    const { library, libraryLoaded, updateLibraryProgress, removeFromLocalLibrary } = useData()
    const loading = !libraryLoaded
    const [selectedItem, setSelectedItem] = useState(null)
    const [audioUrl, setAudioUrl] = useState(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [playerProgress, setPlayerProgress] = useState(0)
    const [readerOpen, setReaderOpen] = useState(false)
    const playerRef = useRef(null)
    const progressSaveRef = useRef(null)
    const currentItemRef = useRef(null)

    // Salva progresso a cada 5s enquanto toca
    useEffect(() => {
        if (!isPlaying || !currentItemRef.current) return
        progressSaveRef.current = setInterval(() => saveProgress(), 5000)
        return () => clearInterval(progressSaveRef.current)
    }, [isPlaying])

    // Salva progresso ao sair
    useEffect(() => {
        return () => { saveProgress() }
    }, [])

    const saveProgress = async () => {
        const item = currentItemRef.current
        if (!item || !playerRef.current?.audio?.current) return
        const t = playerRef.current.audio.current.currentTime
        if (!t || t < 1) return
        try {
            const token = await getToken()
            await updateProgress(item.audiobook_id, item.track_id, t, token)
            updateLibraryProgress(item.audiobook_id, t)
        } catch (e) { /* silencioso */ }
    }

    const handlePlay = (item) => {
        // Salva progresso do anterior antes de trocar
        saveProgress()
        currentItemRef.current = item
        setSelectedItem(item)
        setAudioUrl(item.audio_url)
        setIsPlaying(false)
        // Retoma do progresso salvo
        setTimeout(() => {
            if (playerRef.current?.audio?.current && item.progress_seconds > 5) {
                playerRef.current.audio.current.currentTime = item.progress_seconds
            }
            playerRef.current?.audio?.current?.play()
        }, 300)
    }

    const handleRemove = async (item) => {
        try {
            const token = await getToken()
            await removeFromLibrary(item.audiobook_id, token)
            removeFromLocalLibrary(item.audiobook_id)
            if (currentItemRef.current?.audiobook_id === item.audiobook_id) {
                setAudioUrl(null)
                setSelectedItem(null)
                currentItemRef.current = null
            }
        } catch (e) { }
    }

    const handleDownload = async (item) => {
        try {
            const res = await fetch(item.audio_url)
            const blob = await res.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${item.title}.mp3`
            a.click()
            window.URL.revokeObjectURL(url)
        } catch (e) { }
    }

    // RAF para atualizar barra de progresso
    useEffect(() => {
        let rafId
        const update = () => {
            if (playerRef.current?.audio?.current) {
                const audio = playerRef.current.audio.current
                if (audio.duration) {
                    setPlayerProgress((audio.currentTime / audio.duration) * 100)
                }
            }
            rafId = requestAnimationFrame(update)
        }
        rafId = requestAnimationFrame(update)
        return () => cancelAnimationFrame(rafId)
    }, [])

    // Enquanto a sessão do Supabase carrega, não decide nada — só fundo preto.
    // Evita o flash da tela "Faça login" antes de descobrir que o user existe.
    if (authLoading) {
        return <div style={{ minHeight: '100vh', background: '#090909' }}><MobileHeader title="Meus Livros" /></div>
    }

    // --- Não logado ---
    if (!user) {
        return (
            <div style={{
                minHeight: '100vh', background: '#090909',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                padding: '24px', textAlign: 'center'
            }}>
                <BookBookmark size={56} color="#333" weight="fill" style={{ marginBottom: '24px' }} />
                <h2 style={{ color: '#FCFBF8', fontSize: '22px', fontWeight: '700', marginBottom: '12px' }}>
                    Seus livros ficam aqui
                </h2>
                <p style={{ color: '#666', fontSize: '15px', marginBottom: '32px', maxWidth: '280px', lineHeight: 1.6 }}>
                    Faça login para salvar audiobooks e continuar de onde parou.
                </p>
                <button
                    onClick={() => setShowLoginModal(true)}
                    style={{
                        background: '#FCFBF8', color: '#0a0a0a', border: 'none',
                        padding: '14px 32px', borderRadius: '14px',
                        fontWeight: '700', fontSize: '15px', cursor: 'pointer',
                        fontFamily: 'Figtree, sans-serif'
                    }}
                >
                    Entrar
                </button>
            </div>
        )
    }

    return (
        <div style={{ minHeight: '100vh', background: '#090909', paddingBottom: audioUrl ? '140px' : '80px' }}>
            <MobileHeader title="Meus Livros" />

            {/* Lista */}
            <div style={{ padding: '8px 20px 0' }}>
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '120px 0 60px' }}>
                        <motion.svg
                            width="40" height="40" viewBox="0 0 40 40"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        >
                            <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(252,251,248,0.1)" strokeWidth="5" />
                            <circle cx="20" cy="20" r="16" fill="none" stroke="#FCFBF8" strokeWidth="5" strokeLinecap="round" strokeDasharray="30 100" />
                        </motion.svg>
                    </div>
                ) : library.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px 0' }}>
                        <BookBookmark size={48} color="#222" weight="fill" style={{ marginBottom: '16px' }} />
                        <p style={{ color: '#555', fontSize: '15px' }}>
                            Nenhum audiobook salvo ainda.
                        </p>
                        <p style={{ color: '#444', fontSize: '13px', marginTop: '8px' }}>
                            Toque no ícone 🔖 em qualquer audiobook para salvar.
                        </p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {library.map(item => {
                            const isActive = selectedItem?.audiobook_id === item.audiobook_id
                            const progressPct = item.duration_seconds > 0
                                ? Math.min((item.progress_seconds / item.duration_seconds) * 100, 100)
                                : 0

                            return (
                                <motion.div
                                    key={item.audiobook_id}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    style={{
                                        background: isActive ? '#161616' : 'transparent',
                                        borderRadius: '16px',
                                        border: 'none',
                                        overflow: 'hidden',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px' }}>
                                        {/* Capa */}
                                        <div style={{ position: 'relative', flexShrink: 0 }}>
                                            {item.cover_url ? (
                                                <img
                                                    src={item.cover_url} alt={item.title}
                                                    style={{ width: '56px', height: '56px', borderRadius: '10px', objectFit: 'cover' }}
                                                />
                                            ) : (
                                                <div style={{ width: '56px', height: '56px', borderRadius: '10px', background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>🎧</div>
                                            )}
                                        </div>

                                        {/* Info */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ color: '#FCFBF8', fontSize: '15px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {item.title}
                                            </div>
                                            <div style={{ color: '#666', fontSize: '12px', marginTop: '2px' }}>
                                                {item.track_label || 'Versão Original'}
                                            </div>

                                            {/* Status de progresso */}
                                            {item.progress_seconds > 5 ? (
                                                <div style={{ marginTop: '8px' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                        <span style={{ color: '#FCFBF8', fontSize: '11px', fontWeight: '600' }}>
                                                            ▶ Continuar em {formatTime(item.progress_seconds)}
                                                        </span>
                                                        {item.duration_seconds > 0 && (
                                                            <span style={{ color: '#444', fontSize: '11px' }}>
                                                                {Math.round(progressPct)}%
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div style={{ height: '3px', background: '#222', borderRadius: '2px', overflow: 'hidden' }}>
                                                        <div style={{ width: `${progressPct}%`, height: '100%', background: isActive ? '#FCFBF8' : '#888', borderRadius: '2px', transition: 'width 0.3s' }} />
                                                    </div>
                                                </div>
                                            ) : (
                                                item.duration_seconds > 0 && (
                                                    <div style={{ color: '#444', fontSize: '11px', marginTop: '4px' }}>
                                                        Não iniciado · {formatTime(item.duration_seconds)}
                                                    </div>
                                                )
                                            )}
                                        </div>

                                        {/* Ações */}
                                        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                            <button
                                                onClick={() => handlePlay(item)}
                                                style={{ width: '36px', height: '36px', borderRadius: '50%', background: isActive ? '#FCFBF8' : 'rgba(255,255,255,0.06)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: isActive ? '#0a0a0a' : '#FCFBF8' }}
                                            >
                                                <Play size={16} weight="fill" />
                                            </button>
                                            <button
                                                onClick={() => handleDownload(item)}
                                                style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#666' }}
                                            >
                                                <DownloadSimple size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleRemove(item)}
                                                style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#555' }}
                                            >
                                                <Trash size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Player fixo */}
            <AnimatePresence>
                {audioUrl && selectedItem && (
                    <motion.div
                        initial={{ opacity: 0, y: 80 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 80 }}
                        className="audio-player-fixed"
                        style={{
                            position: 'fixed', bottom: 0, left: 0, right: 0,
                            background: '#0a0a0a', borderTop: '1px solid #1a1a1a',
                            boxShadow: '0 -10px 40px rgba(0,0,0,0.6)',
                            padding: '10px 16px', zIndex: 1000, boxSizing: 'border-box'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {selectedItem.cover_url && (
                                <img src={selectedItem.cover_url} alt="" style={{ width: '36px', height: '36px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }} />
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ color: '#FCFBF8', fontSize: '13px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {selectedItem.title}
                                </div>
                                <AudioPlayer
                                    ref={playerRef}
                                    src={audioUrl}
                                    showJumpControls={false}
                                    showDownloadProgress={false}
                                    showFilledProgress={true}
                                    showFilledVolume={false}
                                    hasDefaultKeyBindings={false}
                                    autoPlayAfterSrcChange={false}
                                    progressUpdateInterval={10}
                                    layout="horizontal"
                                    customProgressBarSection={['CURRENT_TIME', 'PROGRESS_BAR', 'DURATION']}
                                    customControlsSection={['MAIN_CONTROLS']}
                                    customVolumeControls={[]}
                                    customIcons={{
                                        play: <Play size={14} weight="fill" color="#0a0a0a" />,
                                        pause: <Pause size={14} weight="fill" color="#0a0a0a" />
                                    }}
                                    onPlay={() => setIsPlaying(true)}
                                    onPause={() => { setIsPlaying(false); saveProgress() }}
                                    onEnded={() => { setIsPlaying(false); saveProgress() }}
                                />
                            </div>
                            {selectedItem.source_text && (
                                <button
                                    onClick={() => setReaderOpen(true)}
                                    title="Ler junto"
                                    style={{ background: 'rgba(252,251,248,0.08)', border: 'none', color: '#FCFBF8', cursor: 'pointer', flexShrink: 0, width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                    <TextAa size={16} weight="bold" />
                                </button>
                            )}
                            <button
                                onClick={() => { saveProgress(); setAudioUrl(null); setSelectedItem(null); currentItemRef.current = null }}
                                style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', flexShrink: 0 }}
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <ReaderView
                open={readerOpen}
                onClose={() => setReaderOpen(false)}
                title={selectedItem?.title}
                text={selectedItem?.source_text}
                coverUrl={selectedItem?.cover_url}
                audioRef={{ current: playerRef.current?.audio?.current }}
                wordTimings={(() => {
                    try { return selectedItem?.word_timings ? JSON.parse(selectedItem.word_timings) : null }
                    catch { return null }
                })()}
            />
        </div>
    )
}
