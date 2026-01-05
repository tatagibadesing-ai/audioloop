// API URL - VPS Vultr com timeout ilimitado
export const API_URL = import.meta.env.VITE_API_URL ||
    (window.location.hostname === 'localhost' ? 'http://localhost:5000' :
        'https://api.audioloop.com.br')

// Email do admin (hardcoded para segurança - verificação dupla no backend)
export const ADMIN_EMAIL = '2closett@gmail.com'

// Vozes disponíveis
export const VOICES = [
    { value: 'pt-BR-AntonioNeural', label: 'Antonio BR', provider: 'edge', image: '/masculino1.webp' },
    { value: 'pt-BR-Neural2-B', label: 'Bruno BR', provider: 'google', image: '/masculino2.webp' },
    { value: 'pt-BR-FranciscaNeural', label: 'Francisca BR', provider: 'edge', image: '/feminino1.webp' },
    { value: 'pt-BR-ThalitaMultilingualNeural', label: 'Thalita BR', provider: 'edge', image: '/femino2.webp' },
    { value: 'pt-BR-Wavenet-C', label: 'Fernanda BR', provider: 'google', image: '/feminino 3.webp' },
]

// Helpers de formatação
export const formatTime = (seconds) => {
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

export const estimateAudioDuration = (text) => {
    const words = text.trim().split(/\s+/).length
    const seconds = Math.ceil(words / 150 * 60)
    return formatTime(seconds)
}
