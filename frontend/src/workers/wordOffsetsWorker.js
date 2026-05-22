/**
 * Web Worker: calcula o mapeamento palavra→timestamp fora da main thread.
 * Para livros grandes (~50k palavras) o fuzzy match pode levar 200-500ms —
 * aqui roda em paralelo sem travar a UI.
 *
 * Recebe: { texts: string[], wordTimings: {text, start}[] | null }
 * Envia:  { startSec, useRealTimings }[] | { startRatio, endRatio, useRealTimings }[]
 */
self.onmessage = ({ data: { texts, wordTimings } }) => {
    if (!texts || texts.length === 0) {
        self.postMessage([])
        return
    }

    let offsets

    if (wordTimings && wordTimings.length > 0) {
        const clean = (str) =>
            str ? str.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()?"'']/g, '').trim() : ''

        const mapped = []
        let tIdx = 0

        for (let i = 0; i < texts.length; i++) {
            const cleanW = clean(texts[i])
            let bestIdx = -1

            for (let off = 0; off < 15; off++) {
                const ci = tIdx + off
                if (ci >= wordTimings.length) break
                const ct = clean(wordTimings[ci].text)
                if (ct === cleanW || ct.includes(cleanW) || cleanW.includes(ct)) {
                    bestIdx = ci
                    break
                }
            }

            if (bestIdx !== -1) tIdx = bestIdx
            const t = wordTimings[tIdx]
            mapped.push({
                startSec: t ? t.start : (mapped[i - 1]?.startSec ?? 0),
                useRealTimings: true,
            })
            tIdx++
        }

        offsets = mapped
    } else {
        const total = texts.reduce((s, w) => s + Math.max(w.length, 1), 0) || 1
        let acc = 0
        offsets = texts.map((w) => {
            const startRatio = acc / total
            acc += Math.max(w.length, 1)
            return { startRatio, endRatio: acc / total, useRealTimings: false }
        })
    }

    self.postMessage(offsets)
}
