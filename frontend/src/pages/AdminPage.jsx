import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"

// Serviços e constantes
import { supabase } from '../services/supabase'
import { API_URL, formatTime } from '../constants'

// Ícones
import {
    PencilSimple,
    Trash,
    UploadSimple,
    X,
    CheckCircle,
    Plus,
    MusicNotes,
    Image as ImageIcon,
    CaretLeft,
    CircleNotch,
    FileAudio,
    Monitor,
    Play,
    Pause
} from "@phosphor-icons/react"

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
    const [isFormVisible, setIsFormVisible] = useState(false)
    const [isPreviewPlaying, setIsPreviewPlaying] = useState(false)

    const audioInputRef = useRef(null)
    const coverInputRef = useRef(null)

    useEffect(() => {
        if (isAdmin) loadAudiobooks()
    }, [isAdmin])

    const loadAudiobooks = async () => {
        setLoading(true)
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
        if (!editingId && !audioFile) return alert('O arquivo de áudio é obrigatório')

        setSaving(true)
        try {
            const session = await supabase.auth.getSession()
            const token = session.data.session?.access_token
            if (!token) throw new Error('Não autenticado')

            let audioUrl = existingAudioUrl
            let coverUrl = existingCoverUrl

            // 1. Upload do áudio
            if (audioFile) {
                const audioFormData = new FormData()
                audioFormData.append('file', audioFile)
                const audioRes = await fetch(`${API_URL}/api/upload/audio`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: audioFormData
                })
                if (!audioRes.ok) throw new Error('Falha no upload do áudio')
                const audioData = await audioRes.json()
                audioUrl = audioData.url
                if (audioUrl.startsWith('/')) audioUrl = `${API_URL}${audioUrl}`
            }

            // 2. Upload da capa
            if (coverFile) {
                const coverFormData = new FormData()
                coverFormData.append('file', coverFile)
                const coverRes = await fetch(`${API_URL}/api/upload/cover`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: coverFormData
                })
                if (coverRes.ok) {
                    const coverData = await coverRes.json()
                    coverUrl = coverData.url
                    if (coverUrl.startsWith('/')) coverUrl = `${API_URL}${coverUrl}`
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
            setIsFormVisible(false)
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
        setIsFormVisible(true)
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

    // Auth barriers
    if (!user) {
        return (
            <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ textAlign: 'center', maxWidth: '400px' }}
                >
                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                        <Monitor size={40} color="#FCFBF8" />
                    </div>
                    <h1 style={{ fontSize: '32px', color: '#FCFBF8', marginBottom: '16px', fontWeight: '700' }}>Área Restrita</h1>
                    <p style={{ color: '#91918E', marginBottom: '32px', lineHeight: '1.6' }}>O acesso a esta página é limitado apenas aos administradores da plataforma.</p>
                    <button
                        onClick={() => setShowLoginModal(true)}
                        style={{
                            background: '#FCFBF8', color: '#0a0a0a', padding: '16px 32px',
                            border: 'none', borderRadius: '16px', fontSize: '16px', cursor: 'pointer',
                            fontWeight: '600', width: '100%', transition: 'all 0.2s'
                        }}
                    >
                        Entrar como Admin
                    </button>
                    <button
                        onClick={() => navigate('/')}
                        style={{ background: 'none', border: 'none', color: '#91918E', marginTop: '20px', cursor: 'pointer' }}
                    >
                        Voltar para o site
                    </button>
                </motion.div>
            </div>
        )
    }

    if (!isAdmin) {
        return (
            <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ textAlign: 'center' }}
                >
                    <h1 style={{ fontSize: '32px', color: '#FCFBF8', marginBottom: '16px' }}>Sem Permissão</h1>
                    <p style={{ color: '#91918E', marginBottom: '24px' }}>Você não possui os privilégios necessários para ver esta página.</p>
                    <button onClick={() => navigate('/')} style={{ color: '#FCFBF8', background: 'rgba(255,255,255,0.05)', border: 'none', padding: '12px 24px', borderRadius: '12px', cursor: 'pointer' }}>
                        Voltar para Home
                    </button>
                </motion.div>
            </div>
        )
    }

    return (
        <div style={{
            minHeight: '100vh',
            background: '#0a0a0a',
            color: '#FCFBF8',
            padding: '120px 24px 60px',
            fontFamily: "'Figtree', sans-serif"
        }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

                {/* Header do Painel */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '48px',
                    flexWrap: 'wrap',
                    gap: '24px'
                }}>
                    <div>
                        <motion.h1
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            style={{ fontSize: '40px', fontWeight: '700', letterSpacing: '-0.02em', margin: 0 }}
                        >
                            Painel de Controle
                        </motion.h1>
                        <motion.p
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.1 }}
                            style={{ color: '#91918E', marginTop: '8px', fontSize: '18px' }}
                        >
                            Gerencie todos os audiobooks da plataforma.
                        </motion.p>
                    </div>

                    <motion.button
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                            resetForm()
                            setIsFormVisible(!isFormVisible)
                        }}
                        style={{
                            background: isFormVisible ? 'rgba(255,255,255,0.05)' : '#FCFBF8',
                            color: isFormVisible ? '#FCFBF8' : '#0a0a0a',
                            padding: '16px 28px',
                            borderRadius: '16px',
                            border: 'none',
                            fontWeight: '600',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        {isFormVisible ? <X size={20} weight="bold" /> : <Plus size={20} weight="bold" />}
                        {isFormVisible ? 'Fechar Formulário' : 'Novo Audiobook'}
                    </motion.button>
                </div>

                {/* Formulário Expansível */}
                <AnimatePresence>
                    {isFormVisible && (
                        <motion.div
                            initial={{ height: 0, opacity: 0, marginBottom: 0 }}
                            animate={{ height: 'auto', opacity: 1, marginBottom: 60 }}
                            exit={{ height: 0, opacity: 0, marginBottom: 0 }}
                            style={{ overflow: 'hidden' }}
                        >
                            <div style={{
                                background: '#1a1a1a',
                                borderRadius: '32px',
                                padding: '40px',
                                border: '1px solid rgba(255,255,255,0.05)',
                                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                            }}>
                                <h2 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '32px' }}>
                                    {editingId ? 'Editar Detalhes' : 'Cadastrar Audiobook'}
                                </h2>

                                <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                                    {/* Esquerda: Textos */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <label style={{ color: '#91918E', fontSize: '14px', fontWeight: '500' }}>Título do Audiobook</label>
                                            <input
                                                type="text"
                                                value={title}
                                                onChange={e => setTitle(e.target.value)}
                                                placeholder="Ex: O Poder da Mente"
                                                style={{
                                                    background: 'rgba(255,255,255,0.03)',
                                                    border: '1px solid rgba(255,255,255,0.05)',
                                                    borderRadius: '16px',
                                                    padding: '16px',
                                                    color: '#FCFBF8',
                                                    fontSize: '16px',
                                                    outline: 'none'
                                                }}
                                            />
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <label style={{ color: '#91918E', fontSize: '14px', fontWeight: '500' }}>Descrição</label>
                                            <textarea
                                                value={description}
                                                onChange={e => setDescription(e.target.value)}
                                                placeholder="Breve resumo para os ouvintes..."
                                                rows={5}
                                                style={{
                                                    background: 'rgba(255,255,255,0.03)',
                                                    border: '1px solid rgba(255,255,255,0.05)',
                                                    borderRadius: '16px',
                                                    padding: '16px',
                                                    color: '#FCFBF8',
                                                    fontSize: '16px',
                                                    outline: 'none',
                                                    resize: 'none'
                                                }}
                                            />
                                        </div>
                                    </div>

                                    {/* Direita: Arquivos e Submit */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                <label style={{ color: '#91918E', fontSize: '14px', fontWeight: '500' }}>Áudio (MP3)</label>
                                                <div
                                                    onClick={() => audioInputRef.current.click()}
                                                    style={{
                                                        height: '100px',
                                                        background: audioFile ? 'rgba(252, 251, 248, 0.05)' : 'rgba(255,255,255,0.02)',
                                                        border: `1px dashed ${audioFile ? '#FCFBF8' : 'rgba(255,255,255,0.1)'}`,
                                                        borderRadius: '16px',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s'
                                                    }}
                                                >
                                                    <input
                                                        type="file"
                                                        ref={audioInputRef}
                                                        onChange={e => setAudioFile(e.target.files[0])}
                                                        accept="audio/*"
                                                        style={{ display: 'none' }}
                                                    />
                                                    {audioFile ? (
                                                        <>
                                                            <CheckCircle size={24} color="#FCFBF8" weight="fill" />
                                                            <span style={{ fontSize: '10px', marginTop: '4px', color: '#FCFBF8', maxWidth: '80%', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                {audioFile.name}
                                                            </span>
                                                        </>
                                                    ) : editingId && existingAudioUrl ? (
                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                                            <div
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const audio = document.getElementById('preview-audio-element');
                                                                    if (isPreviewPlaying) audio.pause();
                                                                    else audio.play();
                                                                    setIsPreviewPlaying(!isPreviewPlaying);
                                                                }}
                                                                style={{ background: 'rgba(252, 251, 248, 0.1)', padding: '8px', borderRadius: '50%', color: '#FCFBF8' }}
                                                            >
                                                                {isPreviewPlaying ? <Pause size={20} weight="fill" /> : <Play size={20} weight="fill" />}
                                                            </div>
                                                            <span style={{ fontSize: '10px', color: '#91918E' }}>Áudio atual detectado</span>
                                                            <audio
                                                                id="preview-audio-element"
                                                                src={existingAudioUrl}
                                                                onEnded={() => setIsPreviewPlaying(false)}
                                                                style={{ display: 'none' }}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <MusicNotes size={24} color="#91918E" />
                                                            <span style={{ fontSize: '12px', marginTop: '4px', color: '#91918E' }}>Escolher Áudio</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                <label style={{ color: '#91918E', fontSize: '14px', fontWeight: '500' }}>Capa (PNG/JPG)</label>
                                                <div
                                                    onClick={() => coverInputRef.current.click()}
                                                    style={{
                                                        height: '100px',
                                                        background: coverFile ? 'rgba(252, 251, 248, 0.05)' : 'rgba(255,255,255,0.02)',
                                                        border: `1px dashed ${coverFile ? '#FCFBF8' : 'rgba(255,255,255,0.1)'}`,
                                                        borderRadius: '16px',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s'
                                                    }}
                                                >
                                                    <input
                                                        type="file"
                                                        ref={coverInputRef}
                                                        onChange={e => setCoverFile(e.target.files[0])}
                                                        accept="image/*"
                                                        style={{ display: 'none' }}
                                                    />
                                                    {coverFile ? (
                                                        <>
                                                            <img
                                                                src={URL.createObjectURL(coverFile)}
                                                                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.3 }}
                                                                alt=""
                                                            />
                                                            <CheckCircle size={24} color="#FCFBF8" weight="fill" style={{ position: 'relative' }} />
                                                            <span style={{ fontSize: '12px', marginTop: '4px', color: '#FCFBF8', position: 'relative' }}>Nova capa</span>
                                                        </>
                                                    ) : editingId && existingCoverUrl ? (
                                                        <>
                                                            <img
                                                                src={existingCoverUrl}
                                                                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.4 }}
                                                                alt=""
                                                            />
                                                            <ImageIcon size={24} color="#FCFBF8" style={{ position: 'relative' }} />
                                                            <span style={{ fontSize: '10px', marginTop: '4px', color: '#FCFBF8', position: 'relative' }}>Capa atual</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <ImageIcon size={24} color="#91918E" />
                                                            <span style={{ fontSize: '12px', marginTop: '4px', color: '#91918E' }}>Escolher Capa</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: '16px' }}>
                                            <button
                                                type="submit"
                                                disabled={saving}
                                                style={{
                                                    flex: 1,
                                                    background: '#FCFBF8',
                                                    color: '#0a0a0a',
                                                    padding: '18px',
                                                    borderRadius: '18px',
                                                    border: 'none',
                                                    fontSize: '18px',
                                                    fontWeight: '700',
                                                    cursor: saving ? 'not-allowed' : 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '12px',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                {saving ? <CircleNotch size={24} className="animate-spin" /> : <UploadSimple size={24} weight="bold" />}
                                                {editingId ? 'Atualizar Audiobook' : 'Publicar Agora'}
                                            </button>

                                            {editingId && (
                                                <button
                                                    type="button"
                                                    onClick={resetForm}
                                                    style={{
                                                        padding: '18px',
                                                        background: 'rgba(255,255,255,0.05)',
                                                        color: '#FCFBF8',
                                                        border: 'none',
                                                        borderRadius: '18px',
                                                        fontWeight: '600',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    Cancelar
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </form>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Grid de Conteúdo */}
                <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <h2 style={{ fontSize: '28px', fontWeight: '600' }}>Biblioteca Publicada</h2>
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '4px 12px', borderRadius: '100px', fontSize: '14px', color: '#91918E' }}>
                        {audiobooks.length} Itens
                    </div>
                </div>

                {loading ? (
                    <div style={{ padding: '100px 0', textAlign: 'center' }}>
                        <CircleNotch size={48} className="animate-spin" color="#91918E" />
                    </div>
                ) : (
                    <div className="admin-grid" style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                        gap: '24px'
                    }}>
                        {audiobooks.map((book, idx) => (
                            <motion.div
                                key={book.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                style={{
                                    background: '#1a1a1a',
                                    borderRadius: '24px',
                                    padding: '20px',
                                    border: '1px solid rgba(255,255,255,0.05)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '20px',
                                    position: 'relative',
                                    overflow: 'hidden'
                                }}
                            >
                                <div style={{ display: 'flex', gap: '16px' }}>
                                    <div style={{
                                        width: '100px',
                                        height: '100px',
                                        borderRadius: '16px',
                                        background: 'rgba(255,255,255,0.03)',
                                        flexShrink: 0,
                                        overflow: 'hidden'
                                    }}>
                                        {book.cover_url ? (
                                            <img src={book.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <FileAudio size={40} color="rgba(255,255,255,0.1)" />
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <h3 style={{
                                            fontSize: '18px',
                                            fontWeight: '600',
                                            marginBottom: '8px',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis'
                                        }}>
                                            {book.title}
                                        </h3>
                                        <p style={{
                                            fontSize: '14px',
                                            color: '#91918E',
                                            lineHeight: '1.5',
                                            display: '-webkit-box',
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: 'vertical',
                                            overflow: 'hidden'
                                        }}>
                                            {book.description || 'Sem descrição cadastrada.'}
                                        </p>
                                    </div>
                                </div>

                                <div style={{
                                    display: 'flex',
                                    gap: '12px',
                                    paddingTop: '12px',
                                    borderTop: '1px solid rgba(255,255,255,0.05)'
                                }}>
                                    <button
                                        onClick={() => startEdit(book)}
                                        style={{
                                            flex: 1,
                                            background: 'rgba(255,255,255,0.03)',
                                            color: '#FCFBF8',
                                            border: 'none',
                                            padding: '12px',
                                            borderRadius: '12px',
                                            fontSize: '14px',
                                            fontWeight: '600',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <PencilSimple size={18} />
                                        Editar
                                    </button>
                                    <button
                                        onClick={() => handleDelete(book.id)}
                                        style={{
                                            background: 'rgba(255, 68, 68, 0.1)',
                                            color: '#ff4444',
                                            border: 'none',
                                            padding: '12px',
                                            borderRadius: '12px',
                                            fontSize: '14px',
                                            fontWeight: '600',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <Trash size={18} />
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}

                {/* Empty State */}
                {!loading && audiobooks.length === 0 && (
                    <div style={{
                        padding: '120px 0',
                        textAlign: 'center',
                        background: 'rgba(255,255,255,0.01)',
                        borderRadius: '32px',
                        border: '1px dashed rgba(255,255,255,0.1)'
                    }}>
                        <MusicNotes size={64} color="rgba(255,255,255,0.05)" style={{ marginBottom: '24px' }} />
                        <h3 style={{ fontSize: '20px', color: '#FCFBF8', marginBottom: '8px' }}>Nenhum audiobook encontrado</h3>
                        <p style={{ color: '#91918E' }}>Comece criando seu primeiro conteúdo no botão acima.</p>
                    </div>
                )}
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .animate-spin {
                    animation: spin 1s linear infinite;
                }
                @media (max-width: 768px) {
                    .admin-grid {
                        grid-template-columns: 1fr !important;
                    }
                    form {
                        grid-template-columns: 1fr !important;
                    }
                    h1 {
                        font-size: 32px !important;
                    }
                }
            `}} />
        </div>
    )
}
