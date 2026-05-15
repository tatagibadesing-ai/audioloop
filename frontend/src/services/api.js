import { API_URL } from '../constants'

/**
 * Serviço de API centralizado
 * Todas as chamadas HTTP para o backend passam por aqui
 */

// Helper para fazer requisições autenticadas
async function authFetch(endpoint, options = {}, token) {
    const headers = {
        ...options.headers,
    }

    if (token) {
        headers['Authorization'] = `Bearer ${token}`
    }

    if (options.body && !(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json'
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers
    })

    return response
}

// ==================== ÁUDIO ====================

export async function generateAudio(text, voice, token) {
    const response = await authFetch('/api/generate', {
        method: 'POST',
        body: JSON.stringify({ text, voice })
    }, token)

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao gerar áudio')
    }

    return response.blob()
}

export async function uploadAudio(file, token) {
    const formData = new FormData()
    formData.append('file', file)

    const response = await authFetch('/api/upload/audio', {
        method: 'POST',
        body: formData
    }, token)

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Falha no upload do áudio')
    }

    return response.json()
}

export async function uploadCover(file, token) {
    const formData = new FormData()
    formData.append('file', file)

    const response = await authFetch('/api/upload/cover', {
        method: 'POST',
        body: formData
    }, token)

    if (!response.ok) {
        return null
    }

    return response.json()
}

// ==================== AUDIOBOOKS ====================

export async function getAudiobooks() {
    const response = await fetch(`${API_URL}/api/audiobooks`)
    if (!response.ok) throw new Error('Erro ao carregar audiobooks')
    return response.json()
}

export async function createAudiobook(data, token) {
    const response = await authFetch('/api/audiobooks', {
        method: 'POST',
        body: JSON.stringify(data)
    }, token)

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Falha ao criar audiobook')
    }

    return response.json()
}

export async function updateAudiobook(id, data, token) {
    const response = await authFetch(`/api/audiobooks/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    }, token)

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Falha ao atualizar audiobook')
    }

    return response.json()
}

export async function deleteAudiobook(id, token) {
    const response = await authFetch(`/api/audiobooks/${id}`, {
        method: 'DELETE'
    }, token)

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Falha ao excluir audiobook')
    }

    return true
}

// ==================== VOZES ====================

export async function getVoicePreview(voiceId) {
    const response = await fetch(`${API_URL}/api/preview/${voiceId}`)
    if (!response.ok) return null
    return response.blob()
}

// ==================== BIBLIOTECA PESSOAL ====================

export async function getLibrary(token) {
    const response = await authFetch('/api/library', {}, token)
    if (!response.ok) throw new Error('Erro ao carregar biblioteca')
    return response.json()
}

export async function addToLibrary(audiobookId, trackId, token) {
    const response = await authFetch('/api/library', {
        method: 'POST',
        body: JSON.stringify({ audiobook_id: audiobookId, track_id: trackId })
    }, token)
    if (!response.ok) throw new Error('Erro ao salvar')
    return response.json()
}

export async function removeFromLibrary(audiobookId, token) {
    const response = await authFetch(`/api/library/${audiobookId}`, { method: 'DELETE' }, token)
    if (!response.ok) throw new Error('Erro ao remover')
    return response.json()
}

export async function updateProgress(audiobookId, trackId, progressSeconds, token) {
    const response = await authFetch(`/api/library/${audiobookId}/progress`, {
        method: 'PUT',
        body: JSON.stringify({ track_id: trackId, progress_seconds: progressSeconds })
    }, token)
    if (!response.ok) return null
    return response.json()
}

export async function checkLibrary(audiobookIds, token) {
    const response = await authFetch('/api/library/check', {
        method: 'POST',
        body: JSON.stringify({ audiobook_ids: audiobookIds })
    }, token)
    if (!response.ok) return { saved: [] }
    return response.json()
}
