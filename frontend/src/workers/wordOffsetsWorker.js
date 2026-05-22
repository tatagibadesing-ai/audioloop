/**
 * Web Worker: mapeia palavra do texto → timestamp do áudio.
 *
 * Estratégia: mapeamento proporcional com interpolação linear.
 * O fuzzy match por texto causa drift progressivo em livros grandes (50k+ palavras)
 * porque qualquer falha de alinhamento se propaga para todas as palavras seguintes.
 * Mapeamento proporcional garante timestamps monotonicamente crescentes e sem drift.
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
        const n = texts.length
        const m = wordTimings.length
        const mapped = new Array(n)

        for (let i = 0; i < n; i++) {
            // Posição proporcional exata dentro de wordTimings
            const exactIdx = i * (m - 1) / Math.max(n - 1, 1)
            const lo = Math.floor(exactIdx)
            const hi = Math.min(lo + 1, m - 1)
            const frac = exactIdx - lo

            // Interpolação linear entre os dois timestamps adjacentes
            // Garante timestamps únicos e crescentes para cada palavra
            const startSec = wordTimings[lo].start * (1 - frac) + wordTimings[hi].start * frac

            mapped[i] = { startSec, useRealTimings: true }
        }

        offsets = mapped
    } else {
        // Fallback sem wordTimings: estimativa por proporção de caracteres
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
