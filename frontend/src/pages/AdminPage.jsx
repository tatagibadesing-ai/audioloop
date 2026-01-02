import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"

// Serviços e constantes
import { supabase, SUPABASE_URL } from '../services/supabase'
import { API_URL } from '../constants'

// Ícones
import { PencilSimple, Trash } from "@phosphor-icons/react"

export default function AdminPage({ user, isAdmin, setShowLoginModal }) {
    const navigate = useNavigate()
    const [audiobooks, setAudiobooks] = useState([])
    const [loading, setLoading] = useState(true)

    // Form
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [audioFile, setAudioFile] = useState(null)
    const [coverFile, setCoverFile] = useState(null)
    const [saving, setSaving] = useState(false)
    const [editingId, setEditingId] = useState(null)
    const [existingAudioUrl, setExistingAudioUrl] = useState('')
    const [existingCoverUrl, setExistingCoverUrl] = useState('')

    useEffect(() => {
        if (isAdmin) loadAudiobooks()
    }, [isAdmin])

    const loadAudiobooks = async () => {
        try {
            const res = await fetch(`${API_URL}/api/audiobooks`)
            const data = await res.json()
            setAudiobooks(data.audiobooks || [])
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!title) return alert('Título é obrigatório')
        if (!editingId && !audioFile) return alert('O arquivo de áudio é obrigatório para novos audiobooks')

        setSaving(true)
        try {
            const session = await supabase.auth.getSession()
            const token = session.data.session?.access_token
            if (!token) throw new Error('Não autenticado')

            let audioUrl = existingAudioUrl
            let coverUrl = existingCoverUrl

            // Upload do áudio se um novo arquivo for selecionado
            if (audioFile) {
                const audioName = `${Date.now()}-${audioFile.name}`
                const { error: audioError } = await supabase.storage.from('audios').upload(audioName, audioFile, { upsert: true })
                if (audioError) throw audioError
                audioUrl = `${SUPABASE_URL}/storage/v1/object/public/audios/${audioName}`
            }

            // Upload da capa se um novo arquivo for selecionado
            if (coverFile) {
                const coverName = `${Date.now()}-${coverFile.name}`
                const { error: coverError } = await supabase.storage.from('covers').upload(coverName, coverFile, { upsert: true })
                if (!coverError) {
                    coverUrl = `${SUPABASE_URL}/storage/v1/object/public/covers/${coverName}`
                }
            }

            const body = { title, description, audio_url: audioUrl, cover_url: coverUrl }

            const res = await fetch(`${API_URL}/api/audiobooks${editingId ? `/${editingId}` : ''}`, {
                method: editingId ? 'PUT' : 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            })

            if (!res.ok) throw new Error((await res.json()).error || 'Erro ao salvar')

            alert(editingId ? 'Audiobook atualizado!' : 'Audiobook publicado!')
            resetForm()
            loadAudiobooks()
        } catch (e) {
            alert(`Erro: ${e.message}`)
        } finally {
            setSaving(false)
        }
    }

    const resetForm = () => {
        setTitle('')
        setDescription('')
        setAudioFile(null)
        setCoverFile(null)
        setEditingId(null)
        setExistingAudioUrl('')
        setExistingCoverUrl('')
    }

    const startEdit = (book) => {
        setTitle(book.title)
        setDescription(book.description || '')
        setEditingId(book.id)
        setExistingAudioUrl(book.audio_url)
        setExistingCoverUrl(book.cover_url || '')
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const handleDelete = async (id) => {
        if (!confirm('Deletar este audiobook?')) return
        try {
            const session = await supabase.auth.getSession()
            const token = session.data.session?.access_token
            await fetch(`${API_URL}/api/audiobooks/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            })
            loadAudiobooks()
        } catch (e) {
            alert('Erro ao deletar')
        }
    }

    // Não logado
    if (!user) {
        return (
            <div style={{ paddingTop: '100px', textAlign: 'center' }}>
                <h1 style={{ fontSize: '32px', marginBottom: '16px' }}>Área Restrita</h1>
                <p style={{ color: '#64748b', marginBottom: '24px' }}>Faça login para acessar o painel admin.</p>
                <button onClick={() => setShowLoginModal(true)} style={{
                    background: '#2546C7', color: '#fff', padding: '12px 24px',
                    border: 'none', borderRadius: '8px', fontSize: '16px', cursor: 'pointer'
                }}>
                    Fazer Login
                </button>
            </div>
        )
    }

    // Não é admin
    if (!isAdmin) {
        return (
            <div style={{ paddingTop: '100px', textAlign: 'center' }}>
                <h1 style={{ fontSize: '32px', marginBottom: '16px' }}>Acesso Negado</h1>
                <p style={{ color: '#64748b' }}>Você não tem permissão para acessar esta página.</p>
                <button onClick={() => navigate('/')} style={{ color: '#2546C7', marginTop: '16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}>
                    Voltar para Home
                </button>
            </div>
        )
    }

    // Admin Panel
    return (
        <div style={{ paddingTop: '80px', padding: '80px 24px 48px', maxWidth: '1000px', margin: '0 auto' }}>
            <h1 style={{ fontSize: '32px', fontWeight: '600', marginBottom: '32px' }}>
                🎛️ Painel Admin
            </h1>

            {/* Formulário de Novo Audiobook */}
            <div style={{
                background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0',
                padding: '24px', marginBottom: '48px'
            }}>
                <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '24px' }}>
                    {editingId ? 'Editar Audiobook' : 'Publicar Novo Audiobook'}
                </h2>

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }}>
                            Título *
                        </label>
                        <input
                            type="text" value={title} onChange={e => setTitle(e.target.value)} required
                            style={{
                                width: '100%', padding: '12px', border: '1px solid #e2e8f0',
                                borderRadius: '8px', fontSize: '16px', boxSizing: 'border-box'
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }}>
                            Descrição
                        </label>
                        <textarea
                            value={description} onChange={e => setDescription(e.target.value)} rows={3}
                            style={{
                                width: '100%', padding: '12px', border: '1px solid #e2e8f0',
                                borderRadius: '8px', fontSize: '16px', resize: 'vertical', boxSizing: 'border-box'
                            }}
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }}>
                                Arquivo de Áudio (MP3) *
                            </label>
                            <input
                                type="file" accept="audio/*" onChange={e => setAudioFile(e.target.files?.[0])} required={!editingId}
                                style={{ fontSize: '14px' }}
                            />
                            {editingId && <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Deixe vazio para manter o atual</p>}
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }}>
                                Capa (opcional)
                            </label>
                            <input
                                type="file" accept="image/*" onChange={e => setCoverFile(e.target.files?.[0])}
                                style={{ fontSize: '14px' }}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button type="submit" disabled={saving} style={{
                            background: '#2546C7', color: '#fff', padding: '12px 24px',
                            border: 'none', borderRadius: '8px', fontSize: '16px',
                            fontWeight: '500', cursor: saving ? 'not-allowed' : 'pointer'
                        }}>
                            {saving ? 'Salvando...' : (editingId ? 'Salvar Alterações' : 'Publicar Audiobook')}
                        </button>

                        {editingId && (
                            <button type="button" onClick={resetForm} style={{
                                background: 'transparent', color: '#64748b', padding: '12px 24px',
                                border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '16px',
                                cursor: 'pointer'
                            }}>
                                Cancelar
                            </button>
                        )}
                    </div>
                </form>
            </div>

            {/* Lista de Audiobooks */}
            <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px' }}>
                Audiobooks Publicados ({audiobooks.length})
            </h2>

            {loading ? (
                <p>Carregando...</p>
            ) : audiobooks.length === 0 ? (
                <p style={{ color: '#64748b' }}>Nenhum audiobook publicado.</p>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {audiobooks.map((book) => (
                        <div key={book.id} style={{
                            display: 'flex', alignItems: 'center', gap: '16px',
                            background: '#fff', padding: '16px', borderRadius: '12px',
                            border: '1px solid #e2e8f0'
                        }}>
                            {book.cover_url && (
                                <img src={book.cover_url} alt="" style={{
                                    width: '60px', height: '60px',
                                    objectFit: 'contain', borderRadius: '8px', background: '#f8fafc'
                                }} />
                            )}
                            <div style={{ flex: 1 }}>
                                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>{book.title}</h3>
                                <p style={{ fontSize: '13px', color: '#64748b' }}>
                                    {book.description?.slice(0, 80) || 'Sem descrição'}
                                </p>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => startEdit(book)} style={{
                                    background: '#f1f5f9', color: '#475569', border: 'none',
                                    padding: '8px 16px', borderRadius: '6px', fontSize: '14px', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: '4px'
                                }}>
                                    <PencilSimple size={14} /> Editar
                                </button>
                                <button onClick={() => handleDelete(book.id)} style={{
                                    background: '#fee2e2', color: '#dc2626', border: 'none',
                                    padding: '8px 16px', borderRadius: '6px', fontSize: '14px', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: '4px'
                                }}>
                                    <Trash size={14} /> Excluir
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
