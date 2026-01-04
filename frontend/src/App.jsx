import { useState } from "react"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"

// Componentes
import Sidebar from './components/layout/Sidebar'
import LoginModal from './components/modals/LoginModal'

// Páginas
import HomePage from './pages/HomePage'
import AdminPage from './pages/AdminPage'

// Hooks
import { useAuth } from './hooks/useAuth'

// ==================== LAYOUT PRINCIPAL ====================
import { List, X } from "@phosphor-icons/react"

function AppLayout({ children }) {
    const [showLoginModal, setShowLoginModal] = useState(false)
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const { user, isAdmin, supabase } = useAuth()

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: '#e9e9e9' }}>
            {/* Overlay para fechar o menu no mobile */}
            <div
                className={`overlay ${isSidebarOpen ? 'show' : ''}`}
                onClick={() => setIsSidebarOpen(false)}
            />

            {/* Sidebar com classes de responsividade */}
            <div className={`sidebar-desktop`}>
                <Sidebar user={user} isAdmin={isAdmin} setShowLoginModal={setShowLoginModal} supabase={supabase} />
            </div>

            <div className={`sidebar-mobile ${isSidebarOpen ? 'open' : ''}`}>
                <Sidebar user={user} isAdmin={isAdmin} setShowLoginModal={setShowLoginModal} supabase={supabase} />
            </div>

            {/* Botão de Menu Mobile - Minimalista com Framer Motion */}
            {!isSidebarOpen && (
                <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setIsSidebarOpen(true)}
                    className="mobile-nav-toggle"
                    style={{
                        position: 'absolute', // Não fica fixo atrapalhando o scroll
                        top: '20px',
                        left: '20px',
                        zIndex: 1001,
                        background: 'transparent',
                        color: '#333',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer'
                    }}
                >
                    <List size={26} weight="bold" />
                </motion.button>
            )}

            <main className="main-content" style={{ flex: 1, position: 'relative' }}>
                {children({ user, isAdmin, setShowLoginModal })}
            </main>



            <AnimatePresence>
                {showLoginModal && (
                    <LoginModal onClose={() => setShowLoginModal(false)} supabase={supabase} />
                )}
            </AnimatePresence>
        </div>
    )
}


// ==================== COMPONENTE PRINCIPAL ====================
export default function App() {
    return (
        <BrowserRouter>
            <AppLayout>
                {({ user, isAdmin, setShowLoginModal }) => (
                    <Routes>
                        <Route path="/" element={<HomePage user={user} isAdmin={isAdmin} />} />
                        <Route path="/admin" element={<AdminPage user={user} isAdmin={isAdmin} setShowLoginModal={setShowLoginModal} />} />
                    </Routes>
                )}
            </AppLayout>
        </BrowserRouter>
    )
}
