import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { API_URL } from '../constants'
import { useAuth } from '../hooks/useAuth'
import { getLibrary, checkLibrary } from '../services/api'

/**
 * Cache global de dados do app — evita refetch a cada navegação.
 * - audiobooks: lista pública (cacheada por 5min, refetch em background)
 * - library:    biblioteca pessoal (carregada uma vez por sessão de login)
 * - categories: categorias (cacheadas por sessão, mudam pouco)
 *
 * Cada lista tem `loaded` (true após primeira carga) e `refresh()` manual.
 */

const DataContext = createContext(null)

const STALE_MS = 5 * 60 * 1000  // 5min

export function DataProvider({ children }) {
    const { user, getToken } = useAuth()

    const [audiobooks, setAudiobooks] = useState([])
    const [audiobooksLoaded, setAudiobooksLoaded] = useState(false)
    const [categories, setCategories] = useState([])
    const [savedBooks, setSavedBooks] = useState({})  // { id: true }
    const [library, setLibrary] = useState([])
    const [libraryLoaded, setLibraryLoaded] = useState(false)

    const lastFetchRef = useRef({ audiobooks: 0, library: 0, categories: 0 })
    const inflightRef = useRef({})

    const fetchAudiobooks = useCallback(async ({ force = false } = {}) => {
        const now = Date.now()
        if (!force && audiobooksLoaded && now - lastFetchRef.current.audiobooks < STALE_MS) return
        if (inflightRef.current.audiobooks) return inflightRef.current.audiobooks

        const p = (async () => {
            try {
                const res = await fetch(`${API_URL}/api/audiobooks`)
                if (!res.ok) return
                const data = await res.json()
                const books = data.audiobooks || []
                setAudiobooks(books)
                setAudiobooksLoaded(true)
                lastFetchRef.current.audiobooks = Date.now()

                // Checa quais estão salvos (em background, sem bloquear)
                if (user && books.length > 0) {
                    try {
                        const token = await getToken()
                        const check = await checkLibrary(books.map(b => b.id), token)
                        const map = {}
                        check.saved.forEach(s => { map[s.audiobook_id] = true })
                        setSavedBooks(map)
                    } catch { /* ignora */ }
                }
            } finally {
                inflightRef.current.audiobooks = null
            }
        })()
        inflightRef.current.audiobooks = p
        return p
    }, [user, getToken, audiobooksLoaded])

    const fetchCategories = useCallback(async ({ force = false } = {}) => {
        const now = Date.now()
        if (!force && categories.length > 0 && now - lastFetchRef.current.categories < STALE_MS) return
        if (inflightRef.current.categories) return inflightRef.current.categories
        const p = (async () => {
            try {
                const res = await fetch(`${API_URL}/api/categories`)
                if (!res.ok) return
                const data = await res.json()
                setCategories(data.categories || [])
                lastFetchRef.current.categories = Date.now()
            } finally {
                inflightRef.current.categories = null
            }
        })()
        inflightRef.current.categories = p
        return p
    }, [categories.length])

    const fetchLibrary = useCallback(async ({ force = false } = {}) => {
        if (!user) { setLibrary([]); setLibraryLoaded(false); return }
        const now = Date.now()
        if (!force && libraryLoaded && now - lastFetchRef.current.library < STALE_MS) return
        if (inflightRef.current.library) return inflightRef.current.library
        const p = (async () => {
            try {
                const token = await getToken()
                const data = await getLibrary(token)
                setLibrary(data.library || [])
                setLibraryLoaded(true)
                lastFetchRef.current.library = Date.now()
            } catch { /* silencioso */ }
            finally {
                inflightRef.current.library = null
            }
        })()
        inflightRef.current.library = p
        return p
    }, [user, getToken, libraryLoaded])

    // Carga inicial: audiobooks + categorias (paralelo)
    useEffect(() => {
        fetchAudiobooks()
        fetchCategories()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Quando usuário loga/desloga: refaz a checagem de salvos + library
    useEffect(() => {
        if (user) {
            fetchAudiobooks({ force: true })
            fetchLibrary({ force: true })
        } else {
            setSavedBooks({})
            setLibrary([])
            setLibraryLoaded(false)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id])

    // Mutators expostos pra atualização otimista
    const markSaved = useCallback((bookId, saved) => {
        setSavedBooks(prev => ({ ...prev, [bookId]: saved }))
    }, [])

    const updateLibraryProgress = useCallback((audiobookId, progressSeconds) => {
        setLibrary(prev => prev.map(b =>
            b.audiobook_id === audiobookId ? { ...b, progress_seconds: progressSeconds } : b
        ))
    }, [])

    const removeFromLocalLibrary = useCallback((audiobookId) => {
        setLibrary(prev => prev.filter(b => b.audiobook_id !== audiobookId))
        setSavedBooks(prev => ({ ...prev, [audiobookId]: false }))
    }, [])

    const value = {
        audiobooks, audiobooksLoaded, refetchAudiobooks: () => fetchAudiobooks({ force: true }),
        categories, refetchCategories: () => fetchCategories({ force: true }),
        savedBooks, markSaved,
        library, libraryLoaded, refetchLibrary: () => fetchLibrary({ force: true }),
        updateLibraryProgress, removeFromLocalLibrary,
    }

    return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
    const ctx = useContext(DataContext)
    if (!ctx) throw new Error('useData precisa estar dentro de <DataProvider>')
    return ctx
}
