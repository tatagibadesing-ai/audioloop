import { useEffect, useMemo, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Play, Pause, SkipBack, SkipForward } from "@phosphor-icons/react"

/**
 * ReaderView — leitura sincronizada com áudio (palavra por palavra).
 * Estima o timing de cada palavra proporcional ao tamanho (chars).
 */
export default function ReaderView({
    open,
    onClose,
    title,
    text,
    audioRef,
    coverUrl,
    wordTimings, // [{text, start}] em segundos (Edge-TTS WordBoundary)
}) {
    const [currentWordIdx, setCurrentWordIdx] = useState(0)
    const [fontSize, setFontSize] = useState(22)
    const [isPlaying, setIsPlaying] = useState(false)
    const wordRefs = useRef([])
    const lastScrollIdx = useRef(-1)

    // Quebra em "tokens" preservando quebras de linha. Cada token = palavra ou \n.
    const tokens = useMemo(() => {
        if (!text) return []
        const result = []
        const lines = text.replace(/\r\n/g, '\n').split('\n')
        lines.forEach((line, lineIdx) => {
            const words = line.trim().split(/\s+/).filter(Boolean)
            words.forEach(w => result.push({ type: 'word', text: w }))
            if (lineIdx < lines.length - 1) result.push({ type: 'br' })
        })
        return result
    }, [text])

    // Offsets de cada palavra. Usa timings reais (Edge-TTS) se disponíveis,
    // senão estima por proporção de chars.
    const wordOffsets = useMemo(() => {
        const wordsOnly = tokens.filter(t => t.type === 'word')

        // Se temos timings reais, mapeia 1:1 (Edge-TTS retorna 1 por palavra)
        if (wordTimings && wordTimings.length > 0) {
            return wordsOnly.map((w, i) => {
                const t = wordTimings[i]
                return { startSec: t ? t.start : 0, useRealTimings: true }
            })
        }

        // Fallback: estimativa por proporção
        const total = wordsOnly.reduce((s, w) => s + Math.max(w.text.length, 1), 0) || 1
        let acc = 0
        return wordsOnly.map(w => {
            const startRatio = acc / total
            acc += Math.max(w.text.length, 1)
            return { startRatio, endRatio: acc / total, useRealTimings: false }
        })
    }, [tokens, wordTimings])

    // Mapeia índice no array `tokens` para índice no array `wordOffsets`
    const tokenToWordIdx = useMemo(() => {
        const map = []
        let wIdx = 0
        tokens.forEach(t => {
            if (t.type === 'word') { map.push(wIdx); wIdx++ }
            else { map.push(-1) }
        })
        return map
    }, [tokens])

    // Acompanha o tempo do áudio
    useEffect(() => {
        if (!open) return
        let rafId
        const useReal = wordOffsets[0]?.useRealTimings
        const tick = () => {
            const audio = audioRef?.current
            if (audio && wordOffsets.length > 0) {
                let found = 0
                if (useReal) {
                    // Antecipa 300ms pra destacar a palavra um pouco antes de ser falada
                    const t = audio.currentTime + 0.3
                    let lo = 0, hi = wordOffsets.length - 1
                    while (lo <= hi) {
                        const mid = (lo + hi) >> 1
                        if (wordOffsets[mid].startSec <= t) {
                            found = mid; lo = mid + 1
                        } else {
                            hi = mid - 1
                        }
                    }
                } else if (audio.duration) {
                    // Google (estimado): atrasa 700ms pra não marcar como passado o que ainda está sendo dito
                    const adjusted = Math.max(0, audio.currentTime - 0.7)
                    const ratio = adjusted / audio.duration
                    let lo = 0, hi = wordOffsets.length - 1
                    while (lo <= hi) {
                        const mid = (lo + hi) >> 1
                        if (ratio >= wordOffsets[mid].startRatio && ratio < wordOffsets[mid].endRatio) {
                            found = mid; break
                        } else if (ratio < wordOffsets[mid].startRatio) {
                            hi = mid - 1
                        } else {
                            found = mid; lo = mid + 1
                        }
                    }
                }
                setCurrentWordIdx(found)
                setIsPlaying(!audio.paused)
            }
            rafId = requestAnimationFrame(tick)
        }
        rafId = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(rafId)
    }, [open, wordOffsets, audioRef])

    // Auto-scroll linear contínuo: a cada frame, move o scroll
    // gradualmente em direção ao alvo (palavra ativa a 35% do topo).
    // Sem scrollTo({behavior:'smooth'}) — o easing manual evita os "tilts".
    useEffect(() => {
        if (!open) return
        let rafId
        const animate = () => {
            const el = wordRefs.current[currentWordIdx]
            const container = el?.closest('.reader-scroll')
            if (el && container) {
                const elRect = el.getBoundingClientRect()
                const cRect = container.getBoundingClientRect()
                const elTopInContainer = elRect.top - cRect.top + container.scrollTop
                const target = elTopInContainer - (cRect.height * 0.35)
                const current = container.scrollTop
                const diff = target - current
                // Easing linear leve: move 4% da distância por frame (~60fps)
                if (Math.abs(diff) > 0.5) {
                    container.scrollTop = current + diff * 0.04
                }
            }
            rafId = requestAnimationFrame(animate)
        }
        rafId = requestAnimationFrame(animate)
        return () => cancelAnimationFrame(rafId)
    }, [open, currentWordIdx])

    const jumpToWord = (wIdx) => {
        const audio = audioRef?.current
        if (!audio) return
        const w = wordOffsets[wIdx]
        if (w.useRealTimings) {
            audio.currentTime = Math.max(0, w.startSec - 0.05)
        } else if (audio.duration) {
            audio.currentTime = w.startRatio * audio.duration
        } else return
        if (audio.paused) audio.play()
    }

    const togglePlay = () => {
        const audio = audioRef?.current
        if (!audio) return
        if (audio.paused) audio.play(); else audio.pause()
    }

    const skip = (s) => {
        const audio = audioRef?.current
        if (!audio) return
        audio.currentTime = Math.max(0, Math.min(audio.duration || 0, audio.currentTime + s))
    }

    if (!open) return null

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                    position: 'fixed', inset: 0, zIndex: 3000,
                    background: '#0a0a0a',
                    display: 'flex', flexDirection: 'column'
                }}
            >
                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '16px 20px',
                    borderBottom: '1px solid #1a1a1a',
                    flexShrink: 0,
                    paddingTop: 'calc(16px + env(safe-area-inset-top))'
                }}>
                    {coverUrl && <img src={coverUrl} alt="" style={{ width: '36px', height: '36px', borderRadius: '8px', objectFit: 'cover' }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: '#FCFBF8', fontSize: '14px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
                        <div style={{ color: '#666', fontSize: '11px', marginTop: '2px' }}>Lendo junto</div>
                    </div>
                    <button onClick={() => setFontSize(s => Math.max(14, s - 2))} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', padding: '6px 8px', fontSize: '12px', fontWeight: '700' }}>A-</button>
                    <button onClick={() => setFontSize(s => Math.min(34, s + 2))} style={{ background: 'transparent', border: 'none', color: '#FCFBF8', cursor: 'pointer', padding: '6px 8px', fontSize: '16px', fontWeight: '700' }}>A+</button>
                    <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#FCFBF8', cursor: 'pointer', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <X size={18} weight="bold" />
                    </button>
                </div>

                {/* Texto */}
                <div className="reader-scroll" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '40px 24px 60vh', maxWidth: '720px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
                    {tokens.length === 0 ? (
                        <div style={{ color: '#555', fontSize: '15px', textAlign: 'center', padding: '40px 0' }}>
                            Texto indisponível para este audiobook.
                        </div>
                    ) : (
                        <div style={{ fontSize: `${fontSize}px`, lineHeight: 1.8, fontFamily: "'Figtree', sans-serif" }}>
                            {(() => {
                                const useReal = wordOffsets[0]?.useRealTimings
                                return tokens.map((tok, i) => {
                                if (tok.type === 'br') return <br key={i} />
                                const wIdx = tokenToWordIdx[i]
                                const isActive = wIdx === currentWordIdx
                                const isPast = wIdx < currentWordIdx
                                // Edge (timing real) → destaque palavra-por-palavra com fundo branco
                                // Google (estimado) → dimming (passado apaga, futuro claro)
                                const style = useReal ? {
                                    color: isActive ? '#0a0a0a' : isPast ? '#666' : '#aaa',
                                    background: isActive ? '#FCFBF8' : 'transparent',
                                    padding: '2px 4px',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    transition: 'background 0.12s, color 0.12s',
                                    fontWeight: isActive ? 600 : 400,
                                    display: 'inline-block',
                                    marginRight: '4px',
                                    marginBottom: '2px',
                                } : {
                                    color: isPast ? '#3a3a3a' : '#FCFBF8',
                                    cursor: 'pointer',
                                    transition: 'color 0.4s ease',
                                    padding: '2px 4px',
                                    display: 'inline-block',
                                    marginRight: '4px',
                                    marginBottom: '2px',
                                }
                                return (
                                    <span
                                        key={i}
                                        ref={el => (wordRefs.current[wIdx] = el)}
                                        onClick={() => jumpToWord(wIdx)}
                                        style={style}
                                    >
                                        {tok.text}
                                    </span>
                                )
                                })
                            })()}
                        </div>
                    )}
                </div>

                {/* Mini controles */}
                <div style={{
                    position: 'fixed', bottom: 0, left: 0, right: 0,
                    padding: '14px 20px calc(14px + env(safe-area-inset-bottom))',
                    background: 'linear-gradient(to top, #0a0a0a 70%, transparent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px',
                }}>
                    <button onClick={() => skip(-15)} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', width: '44px', height: '44px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FCFBF8', cursor: 'pointer' }}>
                        <SkipBack size={18} weight="fill" />
                    </button>
                    <button onClick={togglePlay} style={{ background: '#FCFBF8', border: 'none', width: '56px', height: '56px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0a0a0a', cursor: 'pointer' }}>
                        {isPlaying ? <Pause size={22} weight="fill" /> : <Play size={22} weight="fill" />}
                    </button>
                    <button onClick={() => skip(15)} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', width: '44px', height: '44px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FCFBF8', cursor: 'pointer' }}>
                        <SkipForward size={18} weight="fill" />
                    </button>
                </div>
            </motion.div>
        </AnimatePresence>
    )
}
