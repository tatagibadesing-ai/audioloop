import { useEffect, useMemo, useRef, useState, memo, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Play, Pause, SkipBack, SkipForward } from "@phosphor-icons/react"
import { resolveImageUrl } from "../constants"

/**
 * ReaderView — leitura sincronizada com áudio (palavra por palavra).
 * Usa janela virtual de parágrafos para manter DOM pequeno mesmo em livros grandes.
 * RAF no lugar de setInterval para timing frame-accurate sem drift.
 */

const LOOK_BEHIND = 5   // parágrafos antes do ativo que ficam no DOM
const LOOK_AHEAD  = 30  // parágrafos depois do ativo que ficam no DOM

const Paragraph = memo(({ p, index, subscribeToParagraph, getLatestParagraphIdx, subscribeToWord, getLatestWordIdx, useReal, jumpToWord, wordRefs, onMeasure }) => {
    const startIdx = p.words[0]?.wIdx ?? 0
    const divRef = useRef(null)

    // Todos os hooks antes de qualquer early return (regras do React)
    const [paragraphState, setParagraphState] = useState(() => {
        const activePIdx = getLatestParagraphIdx()
        return { isActive: index === activePIdx, isPast: index < activePIdx }
    })
    const [activeWordIdx, setActiveWordIdx] = useState(-1)

    // Mede a altura real do parágrafo para o cálculo dos spacers virtuais
    useEffect(() => {
        if (divRef.current) onMeasure(index, divRef.current.offsetHeight)
    }, [index, onMeasure])

    useEffect(() => {
        return subscribeToParagraph((activePIdx) => {
            setParagraphState({ isActive: index === activePIdx, isPast: index < activePIdx })
        })
    }, [index, subscribeToParagraph])

    useEffect(() => {
        if (!paragraphState.isActive) return
        setActiveWordIdx(getLatestWordIdx())
        return subscribeToWord((wIdx) => setActiveWordIdx(wIdx))
    }, [paragraphState.isActive, subscribeToWord, getLatestWordIdx])

    if (p.isEmpty || !p.words.length) {
        return <div ref={divRef} style={{ minHeight: '1.8em' }} />
    }

    const { isActive, isPast } = paragraphState

    if (isActive) {
        return (
            <div ref={divRef} style={{ minHeight: 'auto' }}>
                {p.words.map((w) => {
                    const isWordActive = w.wIdx === activeWordIdx
                    const isPastWord   = w.wIdx < activeWordIdx
                    const style = useReal ? {
                        color: isWordActive ? '#0a0a0a' : isPastWord ? '#666' : '#aaa',
                        background: isWordActive ? '#FCFBF8' : 'transparent',
                        padding: '2px 4px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'background 0.12s, color 0.12s',
                        fontWeight: isWordActive ? 600 : 400,
                        display: 'inline-block',
                        marginRight: '4px',
                        marginBottom: '2px',
                    } : {
                        color: isPastWord ? '#3a3a3a' : '#FCFBF8',
                        cursor: 'pointer',
                        transition: 'color 0.4s ease',
                        padding: '2px 4px',
                        display: 'inline-block',
                        marginRight: '4px',
                        marginBottom: '2px',
                    }
                    return (
                        <span
                            key={w.wIdx}
                            ref={el => { if (wordRefs?.current) wordRefs.current[w.wIdx] = el }}
                            onClick={() => jumpToWord(w.wIdx)}
                            style={style}
                        >
                            {w.text}
                        </span>
                    )
                })}
            </div>
        )
    }

    const color = useReal
        ? (isPast ? '#666' : '#aaa')
        : (isPast ? '#3a3a3a' : '#FCFBF8')

    return (
        <div
            ref={divRef}
            style={{ color, cursor: 'pointer', padding: '2px 4px', display: 'block', transition: 'color 0.2s ease', marginBottom: '2px' }}
            onClick={() => jumpToWord(startIdx)}
        >
            {p.words.map(w => w.text).join(' ')}
        </div>
    )
})


export default function ReaderView({
    open,
    onClose,
    title,
    text,
    audioRef,
    coverUrl,
    wordTimings,
}) {
    const currentWordIdxRef    = useRef(0)
    const activeParagraphIdxRef = useRef(0)
    const listenersRef          = useRef(new Set())
    const paragraphListenersRef = useRef(new Set())
    const wordRefs              = useRef([])
    const [fontSize, setFontSize] = useState(22)
    const [isPlaying, setIsPlaying] = useState(false)

    // Estado da janela virtual
    const paragraphHeightsRef = useRef({})   // { pIdx -> px }
    const windowStartRef      = useRef(0)
    const [windowStart, setWindowStart] = useState(0)

    const subscribeToWord = useCallback((listener) => {
        listenersRef.current.add(listener)
        return () => listenersRef.current.delete(listener)
    }, [])

    const getLatestWordIdx = useCallback(() => currentWordIdxRef.current, [])

    const subscribeToParagraph = useCallback((listener) => {
        paragraphListenersRef.current.add(listener)
        return () => paragraphListenersRef.current.delete(listener)
    }, [])

    const getLatestParagraphIdx = useCallback(() => activeParagraphIdxRef.current, [])

    const resolvedCoverUrl = useMemo(() => resolveImageUrl(coverUrl), [coverUrl])

    const paragraphs = useMemo(() => {
        if (!text) return []
        const paras = []
        let wIdx = 0
        text.replace(/\r\n/g, '\n').split('\n').forEach((line) => {
            const words = line.trim().split(/\s+/).filter(Boolean)
            paras.push({ words: words.map(w => ({ text: w, wIdx: wIdx++ })), isEmpty: words.length === 0 })
        })
        return paras
    }, [text])

    const wordParagraphIndices = useMemo(() => {
        const map = []
        paragraphs.forEach((p, pIdx) => p.words.forEach(w => { map[w.wIdx] = pIdx }))
        return map
    }, [paragraphs])

    // wordOffsets é calculado no Web Worker para não bloquear a UI em livros grandes
    const [wordOffsets, setWordOffsets] = useState([])

    useEffect(() => {
        const wordsOnly = []
        paragraphs.forEach(p => wordsOnly.push(...p.words))
        if (wordsOnly.length === 0) { setWordOffsets([]); return }

        const worker = new Worker(
            new URL('../workers/wordOffsetsWorker.js', import.meta.url)
        )
        worker.onmessage = ({ data }) => {
            setWordOffsets(data)
            worker.terminate()
        }
        // Passa só os textos (strings puras) — transferência mais leve que objetos completos
        worker.postMessage({ texts: wordsOnly.map(w => w.text), wordTimings })

        return () => worker.terminate()
    }, [paragraphs, wordTimings])

    // Limpa cache de alturas quando o tamanho da fonte muda
    useEffect(() => { paragraphHeightsRef.current = {} }, [fontSize])

    // Reset ao fechar
    useEffect(() => {
        if (!open) {
            activeParagraphIdxRef.current = 0
            currentWordIdxRef.current = 0
            windowStartRef.current = 0
            setWindowStart(0)
        }
    }, [open])

    // Desloca a janela virtual quando o parágrafo ativo se aproxima da borda
    const updateWindowForParagraph = useCallback((pIdx) => {
        const desired = Math.max(0, pIdx - LOOK_BEHIND)
        if (desired !== windowStartRef.current) {
            windowStartRef.current = desired
            setWindowStart(desired)
        }
    }, [])

    // Sincroniza palavra ativa com audio.currentTime via RAF (frame-accurate, sem drift)
    useEffect(() => {
        if (!open || wordOffsets.length === 0) return
        const audio = audioRef?.current
        if (!audio) return

        const updateWordHighlight = () => {
            const useReal = wordOffsets[0]?.useRealTimings
            let found = 0

            if (useReal) {
                // Antecipa 150ms para compensar latência de render
                const t = audio.currentTime + 0.15
                let lo = 0, hi = wordOffsets.length - 1
                while (lo <= hi) {
                    const mid = (lo + hi) >> 1
                    if (wordOffsets[mid].startSec <= t) { found = mid; lo = mid + 1 }
                    else hi = mid - 1
                }
            } else if (audio.duration) {
                const ratio = Math.max(0, audio.currentTime - 0.7) / audio.duration
                let lo = 0, hi = wordOffsets.length - 1
                while (lo <= hi) {
                    const mid = (lo + hi) >> 1
                    if (ratio >= wordOffsets[mid].startRatio && ratio < wordOffsets[mid].endRatio) {
                        found = mid; break
                    } else if (ratio < wordOffsets[mid].startRatio) hi = mid - 1
                    else { found = mid; lo = mid + 1 }
                }
            }

            if (currentWordIdxRef.current !== found) {
                currentWordIdxRef.current = found
                listenersRef.current.forEach(l => l(found))
            }

            const pIdx = wordParagraphIndices[found] ?? 0
            if (activeParagraphIdxRef.current !== pIdx) {
                activeParagraphIdxRef.current = pIdx
                paragraphListenersRef.current.forEach(l => l(pIdx))
                updateWindowForParagraph(pIdx)
            }
        }

        updateWordHighlight()
        audio.addEventListener('timeupdate', updateWordHighlight)

        let rafId = null
        const rafLoop = () => { updateWordHighlight(); rafId = requestAnimationFrame(rafLoop) }

        const handlePlayState = () => {
            setIsPlaying(!audio.paused)
            if (!audio.paused) {
                if (rafId === null) rafId = requestAnimationFrame(rafLoop)
            } else {
                if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null }
            }
        }

        handlePlayState()
        audio.addEventListener('play', handlePlayState)
        audio.addEventListener('pause', handlePlayState)
        audio.addEventListener('ended', handlePlayState)

        return () => {
            audio.removeEventListener('timeupdate', updateWordHighlight)
            audio.removeEventListener('play', handlePlayState)
            audio.removeEventListener('pause', handlePlayState)
            audio.removeEventListener('ended', handlePlayState)
            if (rafId !== null) cancelAnimationFrame(rafId)
        }
    }, [open, wordOffsets, audioRef, wordParagraphIndices, updateWindowForParagraph])

    // Auto-scroll suave até a palavra ativa
    useEffect(() => {
        if (!open) return
        let rafId

        const scrollTo = (el, container) => {
            let top = el.offsetTop
            let parent = el.offsetParent
            while (parent && parent !== container) { top += parent.offsetTop; parent = parent.offsetParent }
            const target = top - container.clientHeight * 0.35
            if (rafId) cancelAnimationFrame(rafId)
            const animate = () => {
                const diff = target - container.scrollTop
                if (Math.abs(diff) > 1) { container.scrollTop += diff * 0.1; rafId = requestAnimationFrame(animate) }
            }
            rafId = requestAnimationFrame(animate)
        }

        const handleWordChange = (wIdx) => {
            let el = wordRefs.current[wIdx]
            const container = document.querySelector('.reader-scroll')
            if (!container) return
            if (!el) {
                rafId = requestAnimationFrame(() => {
                    el = wordRefs.current[wIdx]
                    if (el) scrollTo(el, container)
                })
                return
            }
            scrollTo(el, container)
        }

        handleWordChange(currentWordIdxRef.current)
        return subscribeToWord(handleWordChange)
    }, [open, subscribeToWord])

    const jumpToWord = useCallback((wIdx) => {
        const audio = audioRef?.current
        if (!audio) return
        const w = wordOffsets[wIdx]
        if (!w) return
        if (w.useRealTimings) audio.currentTime = Math.max(0, w.startSec - 0.05)
        else if (audio.duration) audio.currentTime = w.startRatio * audio.duration
        else return
        if (audio.paused) audio.play()
    }, [wordOffsets, audioRef])

    // Callback para os parágrafos reportarem suas alturas reais
    const onMeasure = useCallback((pIdx, height) => {
        paragraphHeightsRef.current[pIdx] = height
    }, [])

    // Calcula a altura do spacer somando alturas medidas (ou estimativa para não-medidos)
    const getSpacerHeight = (fromIdx, toIdx) => {
        if (fromIdx >= toIdx) return 0
        const h = paragraphHeightsRef.current
        const vals = Object.values(h)
        const avg = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 160
        let total = 0
        for (let i = fromIdx; i < toIdx; i++) total += h[i] ?? avg
        return total
    }

    const togglePlay = () => {
        const audio = audioRef?.current
        if (!audio) return
        audio.paused ? audio.play() : audio.pause()
    }

    const skip = (s) => {
        const audio = audioRef?.current
        if (!audio) return
        audio.currentTime = Math.max(0, Math.min(audio.duration || 0, audio.currentTime + s))
    }

    if (!open) return null

    const windowEnd          = Math.min(paragraphs.length - 1, windowStart + LOOK_BEHIND + LOOK_AHEAD)
    const topSpacerHeight    = getSpacerHeight(0, windowStart)
    const bottomSpacerHeight = getSpacerHeight(windowEnd + 1, paragraphs.length)
    const useReal            = wordOffsets[0]?.useRealTimings

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ position: 'fixed', inset: 0, zIndex: 3000, background: '#0a0a0a', display: 'flex', flexDirection: 'column' }}
            >
                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '16px 20px',
                    borderBottom: '1px solid #1a1a1a',
                    flexShrink: 0,
                    paddingTop: 'calc(16px + env(safe-area-inset-top))'
                }}>
                    {resolvedCoverUrl && <img src={resolvedCoverUrl} alt="" style={{ width: '36px', height: '36px', borderRadius: '8px', objectFit: 'cover' }} />}
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

                {/* Texto com janela virtual */}
                <div className="reader-scroll" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '40px 24px 60vh', maxWidth: '720px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
                    {paragraphs.length === 0 ? (
                        <div style={{ color: '#555', fontSize: '15px', textAlign: 'center', padding: '40px 0' }}>
                            Texto indisponível para este audiobook.
                        </div>
                    ) : (
                        <div style={{ fontSize: `${fontSize}px`, lineHeight: 1.8, fontFamily: "'Figtree', sans-serif" }}>
                            {/* Spacer superior: ocupa o espaço dos parágrafos não renderizados acima */}
                            {topSpacerHeight > 0 && <div style={{ height: `${topSpacerHeight}px` }} aria-hidden="true" />}

                            {paragraphs.slice(windowStart, windowEnd + 1).map((p, i) => {
                                const globalIdx = windowStart + i
                                return (
                                    <Paragraph
                                        key={globalIdx}
                                        p={p}
                                        index={globalIdx}
                                        subscribeToParagraph={subscribeToParagraph}
                                        getLatestParagraphIdx={getLatestParagraphIdx}
                                        subscribeToWord={subscribeToWord}
                                        getLatestWordIdx={getLatestWordIdx}
                                        useReal={useReal}
                                        jumpToWord={jumpToWord}
                                        wordRefs={wordRefs}
                                        onMeasure={onMeasure}
                                    />
                                )
                            })}

                            {/* Spacer inferior: ocupa o espaço dos parágrafos não renderizados abaixo */}
                            {bottomSpacerHeight > 0 && <div style={{ height: `${bottomSpacerHeight}px` }} aria-hidden="true" />}
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
