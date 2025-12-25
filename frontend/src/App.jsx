import { useState, useRef, useEffect } from "react"

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
    const [text, setText] = useState("")
    const [voice, setVoice] = useState("pt-BR-AntonioNeural")
    const [isLoading, setIsLoading] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [audioUrl, setAudioUrl] = useState(null)

    // Estados para o progresso
    const [totalEstimatedSeconds, setTotalEstimatedSeconds] = useState(0)
    const [secondsLeft, setSecondsLeft] = useState(0)

    const fileInputRef = useRef(null)

    // Timer de Countdown (Regressivo)
    useEffect(() => {
        if (!isLoading || secondsLeft <= 0) return

        const timer = setInterval(() => {
            setSecondsLeft(prev => {
                if (prev <= 1) return 1 // Mantém em "1s" se demorar mais que o previsto
                return prev - 1
            })
        }, 1000)

        return () => clearInterval(timer)
    }, [isLoading, secondsLeft])

    // Calcula porcentagem baseada no tempo decorrido
    const progressPercent = totalEstimatedSeconds > 0
        ? Math.min(99, Math.max(0, ((totalEstimatedSeconds - secondsLeft) / totalEstimatedSeconds) * 100))
        : 0

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

    const handleGenerate = async () => {
        if (!text.trim()) return
        setIsLoading(true)
        setAudioUrl(null)

        // Nova Estimativa:
        // 150 palavras = 1 min de áudio
        // Processamento + Download = ~10-15s por minuto de áudio (conservador)
        const words = text.trim().split(/\s+/).length
        const audioMinutes = words / 150
        const estSecs = Math.max(5, Math.ceil(audioMinutes * 8)) // 8 segundos de processamento por minuto de áudio

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

    const handleDownload = () => {
        if (!audioUrl) return
        const a = document.createElement('a')
        a.href = audioUrl
        a.download = `audiobook-${Date.now()}.mp3`
        a.click()
    }

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>

            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '48px', maxWidth: '900px' }}>
                <h1 style={{ fontSize: '48px', fontWeight: '600', marginBottom: '16px', lineHeight: '1.2', color: '#0f172a' }}>
                    Gerador de Audiobook Profissional
                </h1>
                <p style={{ fontSize: '18px', color: 'rgba(15,23,42,0.7)' }}>
                    Transforme qualquer texto em um audiobook profissional usando vozes neurais da Microsoft.
                </p>
            </div>

            {/* Card Principal */}
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

                    {/* Botões à direita do textarea */}
                    <div style={{ position: 'absolute', right: '24px', top: '24px', display: 'flex', flexDirection: 'row', gap: '8px' }}>
                        {/* Upload */}
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

                        {/* Gerar */}
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

                {/* Barra de Progresso Realista (Countdown) */}
                {isLoading && (
                    <div style={{ padding: '0 24px 16px 24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', color: '#6366f1' }}>
                            <span>
                                {progressPercent >= 99 ? "Finalizando e baixando... (quase pronto!)" : "Gerando áudio..."}
                            </span>
                            <span>
                                {Math.round(progressPercent)}% • Restam approx. {formatTime(secondsLeft)}
                            </span>
                        </div>
                        <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{
                                width: `${progressPercent}%`,
                                height: '100%',
                                background: '#6366f1',
                                transition: 'width 1s linear' // Transição linear de 1s para o countdown ficar suave
                            }} />
                        </div>
                    </div>
                )}

                {/* Barra de Controles - Voice Select */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
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

                    {/* Botão Download */}
                    <button
                        onClick={handleDownload}
                        title="Baixar MP3"
                        style={{
                            width: '40px',
                            height: '40px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: '#f1f5f9',
                            border: '1px solid #e2e8f0',
                            borderRadius: '50%',
                            color: '#64748b',
                            cursor: 'pointer',
                            flexShrink: 0
                        }}
                    >
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
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        textarea::placeholder {
          color: rgba(30,41,59,0.4);
        }
        audio {
          border-radius: 8px;
        }
        audio::-webkit-media-controls-panel {
          background: #f8fafc;
        }
      `}</style>
        </div>
    )
}
