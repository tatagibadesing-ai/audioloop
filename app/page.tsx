"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"

const VOICES = [
  { value: "pt-BR-AntonioNeural", label: "Antônio (PT-BR)" },
  { value: "pt-BR-FranciscaNeural", label: "Francisca (PT-BR)" },
  { value: "pt-BR-ThalitaNeural", label: "Thalita (PT-BR)" },
  { value: "en-US-GuyNeural", label: "Guy (EN-US)" },
  { value: "en-US-JennyNeural", label: "Jenny (EN-US)" },
]

// Formata segundos em texto (1h 20m 30s)
const formatTime = (seconds: number) => {
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
const estimateAudioDuration = (text: string) => {
  const words = text.trim().split(/\s+/).length
  const seconds = Math.ceil((words / 150) * 60)
  return formatTime(seconds)
}

export default function Home() {
  const [text, setText] = useState("")
  const [voice, setVoice] = useState("pt-BR-AntonioNeural")
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [apiUrl, setApiUrl] = useState("")

  // Estados para o progresso
  const [totalEstimatedSeconds, setTotalEstimatedSeconds] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(0)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Set API URL on client side
  useEffect(() => {
    const url =
      process.env.NEXT_PUBLIC_API_URL ||
      (window.location.hostname === "localhost"
        ? "http://localhost:5000"
        : window.location.origin.replace(":3000", ":5000"))
    setApiUrl(url)
  }, [])

  // Timer de Countdown (Regressivo)
  useEffect(() => {
    if (!isLoading || secondsLeft <= 0) return

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) return 1
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [isLoading, secondsLeft])

  // Calcula porcentagem baseada no tempo decorrido
  const progressPercent =
    totalEstimatedSeconds > 0
      ? Math.min(99, Math.max(0, ((totalEstimatedSeconds - secondsLeft) / totalEstimatedSeconds) * 100))
      : 0

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploading(true)
    setAudioUrl(null)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch(`${apiUrl}/api/extract`, { method: "POST", body: formData })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || res.statusText)
      }
      const data = await res.json()
      setText(data.text)
    } catch (err) {
      console.error(err)
      alert(`Erro ao ler arquivo: ${err instanceof Error ? err.message : "Unknown error"}`)
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

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
      const res = await fetch(`${apiUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice }),
      })
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      setAudioUrl(url)
    } catch {
      alert("Erro ao gerar áudio. O texto pode ser muito longo para o servidor gratuito.")
    } finally {
      setIsLoading(false)
      setSecondsLeft(0)
    }
  }

  const handleDownload = () => {
    if (!audioUrl) return
    const a = document.createElement("a")
    a.href = audioUrl
    a.download = `audiobook-${Date.now()}.mp3`
    a.click()
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="text-center mb-12 max-w-[900px]">
        <h1 className="text-4xl md:text-5xl font-semibold mb-4 leading-tight text-slate-900">
          Gerador de Audiobook Profissional
        </h1>
        <p className="text-lg text-slate-600">
          Transforme qualquer texto em um audiobook profissional usando vozes neurais da Microsoft.
        </p>
      </div>

      {/* Card Principal */}
      <div className="w-full max-w-[900px] bg-white/85 backdrop-blur-xl rounded-2xl border border-white/50 shadow-2xl overflow-hidden">
        {/* Textarea */}
        <div className="p-6 relative">
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setAudioUrl(null)
            }}
            placeholder="Cole ou digite seu texto aqui..."
            disabled={isLoading || isUploading}
            className="w-full min-h-[180px] bg-transparent border-none outline-none resize-none text-base leading-relaxed text-slate-800 pr-28 placeholder:text-slate-400"
          />

          {/* Botões à direita do textarea */}
          <div className="absolute right-6 top-6 flex gap-2">
            {/* Upload */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || isLoading}
              title="Upload arquivo"
              className="w-10 h-10 flex items-center justify-center bg-slate-100 border-none rounded-full text-slate-500 cursor-pointer hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
            </button>

            {/* Gerar */}
            <button
              onClick={handleGenerate}
              disabled={isLoading || !text.trim()}
              title="Gerar áudio"
              className={`w-10 h-10 flex items-center justify-center border-none rounded-full text-white cursor-pointer transition-colors ${
                isLoading || !text.trim() ? "bg-slate-400 cursor-not-allowed" : "bg-indigo-500 hover:bg-indigo-600"
              }`}
            >
              {isLoading ? (
                <svg className="animate-spin" width="18" height="18" fill="none" viewBox="0 0 24 24">
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
          <div className="px-6 pb-4">
            <div className="flex justify-between mb-2 text-sm text-indigo-500">
              <span>{progressPercent >= 99 ? "Finalizando e baixando... (quase pronto!)" : "Gerando áudio..."}</span>
              <span>
                {Math.round(progressPercent)}% • Restam approx. {formatTime(secondsLeft)}
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 transition-all duration-1000 ease-linear"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Barra de Controles - Voice Select */}
        <div className="flex items-center gap-4 px-6 py-3 border-t border-slate-200/50 bg-slate-50/90">
          <span className="text-sm text-slate-500 font-medium">Voz:</span>
          <select
            value={voice}
            onChange={(e) => setVoice(e.target.value)}
            disabled={isLoading}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-600 text-sm font-medium cursor-pointer outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          >
            {VOICES.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>

          {text && (
            <span className="text-sm text-slate-400 ml-auto">~{estimateAudioDuration(text)} de áudio total</span>
          )}
        </div>
      </div>

      {/* Preview do Áudio */}
      {audioUrl && (
        <div className="w-full max-w-[900px] mt-4 bg-white/85 backdrop-blur-xl rounded-xl border border-white/50 shadow-lg p-4 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <audio controls src={audioUrl} className="flex-1 h-10 rounded-lg" />

          {/* Botão Download */}
          <button
            onClick={handleDownload}
            title="Baixar MP3"
            className="w-10 h-10 flex items-center justify-center bg-slate-100 border border-slate-200 rounded-full text-slate-500 cursor-pointer hover:bg-slate-200 transition-colors flex-shrink-0"
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
