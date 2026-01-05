import { useState } from "react"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"

// Componentes
import Sidebar from './components/layout/Sidebar'
import LoginModal from './components/modals/LoginModal'
import { Toaster } from 'react-hot-toast'

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
        <div style={{ display: 'flex', minHeight: '100vh', background: '#0a0a0a' }}>

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
            <Toaster
                position="top-right"
                toastOptions={{
                    duration: 4000,
                    style: {
                        background: '#1a1a1a',
                        color: '#FCFBF8',
                        borderRadius: '16px',
                        border: '1px solid rgba(255,255,255,0.05)',
                        backdropFilter: 'blur(10px)',
                        padding: '16px',
                        fontSize: '14px',
                        fontWeight: '500',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                    },
                    success: {
                        iconTheme: {
                            primary: '#10b981',
                            secondary: '#fff',
                        },
                        style: {
                            border: '1px solid rgba(16, 185, 129, 0.2)',
                        }
                    },
                    error: {
                        iconTheme: {
                            primary: '#ef4444',
                            secondary: '#fff',
                        },
                        style: {
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                        }
                    }
                }}
            />
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
