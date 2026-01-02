import { useState } from "react"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import { AnimatePresence } from "framer-motion"

// Componentes
import Sidebar from './components/layout/Sidebar'
import LoginModal from './components/modals/LoginModal'

// Páginas
import HomePage from './pages/HomePage'
import AdminPage from './pages/AdminPage'

// Hooks
import { useAuth } from './hooks/useAuth'

// ==================== LAYOUT PRINCIPAL ====================
function AppLayout({ children }) {
    const [showLoginModal, setShowLoginModal] = useState(false)
    const { user, isAdmin, supabase } = useAuth()

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: '#e9e9e9' }}>
            <Sidebar user={user} isAdmin={isAdmin} setShowLoginModal={setShowLoginModal} supabase={supabase} />

            <main style={{ marginLeft: '260px', flex: 1, position: 'relative', width: 'calc(100% - 260px)' }}>
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
