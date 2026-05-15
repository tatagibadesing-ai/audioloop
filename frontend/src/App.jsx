import { useState } from "react"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import { AnimatePresence } from "framer-motion"

import Sidebar from './components/layout/Sidebar'
import BottomTabBar from './components/layout/BottomTabBar'
import LoginModal from './components/modals/LoginModal'
import { Toaster } from 'react-hot-toast'

import HomePage from './pages/HomePage'
import AdminPage from './pages/AdminPage'
import MyBooksPage from './pages/MyBooksPage'

import { useAuth } from './hooks/useAuth'
import { DataProvider } from './contexts/DataContext'
import { useScrollToTopOnRoute } from './hooks/useScrollToTopOnRoute'

function AppLayout({ children }) {
    const [showLoginModal, setShowLoginModal] = useState(false)
    const { user, isAdmin, supabase } = useAuth()
    useScrollToTopOnRoute()

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: '#0a0a0a' }}>

            {/* Sidebar — só desktop */}
            <div className="sidebar-desktop">
                <Sidebar user={user} isAdmin={isAdmin} setShowLoginModal={setShowLoginModal} supabase={supabase} />
            </div>

            <main className="main-content" style={{ flex: 1, position: 'relative' }}>
                {children({ user, isAdmin, setShowLoginModal })}
            </main>

            {/* Bottom Tab Bar — só mobile */}
            <BottomTabBar
                isAdmin={isAdmin}
                user={user}
                setShowLoginModal={setShowLoginModal}
            />

            <AnimatePresence>
                {showLoginModal && (
                    <LoginModal onClose={() => setShowLoginModal(false)} supabase={supabase} />
                )}
            </AnimatePresence>
        </div>
    )
}

export default function App() {
    return (
        <BrowserRouter>
            <Toaster
                position="top-center"
                toastOptions={{
                    duration: 4000,
                    style: {
                        background: '#1a1a1a',
                        color: '#FCFBF8',
                        borderRadius: '16px',
                        border: '1px solid rgba(255,255,255,0.08)',
                        backdropFilter: 'blur(10px)',
                        padding: '14px 18px',
                        fontSize: '14px',
                        fontWeight: '500',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                    },
                    success: {
                        iconTheme: { primary: '#10b981', secondary: '#fff' },
                        style: { border: '1px solid rgba(16, 185, 129, 0.2)' }
                    },
                    error: {
                        iconTheme: { primary: '#ef4444', secondary: '#fff' },
                        style: { border: '1px solid rgba(239, 68, 68, 0.2)' }
                    }
                }}
            />
            <DataProvider>
                <AppLayout>
                    {({ user, isAdmin, setShowLoginModal }) => (
                        <Routes>
                            <Route path="/" element={<HomePage user={user} isAdmin={isAdmin} setShowLoginModal={setShowLoginModal} />} />
                            <Route path="/meus-livros" element={<MyBooksPage setShowLoginModal={setShowLoginModal} />} />
                            <Route path="/admin" element={<AdminPage user={user} isAdmin={isAdmin} setShowLoginModal={setShowLoginModal} />} />
                        </Routes>
                    )}
                </AppLayout>
            </DataProvider>
        </BrowserRouter>
    )
}
