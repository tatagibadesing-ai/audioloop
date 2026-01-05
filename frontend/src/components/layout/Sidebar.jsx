import { useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { motion } from "framer-motion"
import {
    CaretDown,
    UserCircle,
    SignOut,
    House,
    MagicWand,
    Books,
    Playlist,
    Microphone,
    BookOpen,
    Gear,
    Gift
} from "@phosphor-icons/react"

export default function Sidebar({ user, isAdmin, setShowLoginModal, supabase }) {
    const navigate = useNavigate()
    const location = useLocation()

    const handleLogout = async () => {
        if (supabase) await supabase.auth.signOut()
    }

    const MenuItem = ({ icon: Icon, label, isActive, onClick, isComingSoon }) => (
        <button
            onClick={onClick}
            style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '8px 12px',
                background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                border: 'none',
                borderRadius: '8px',
                color: isActive ? '#fff' : '#888',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'all 0.2s',
                marginBottom: '2px',
                position: 'relative'
            }}
            onMouseEnter={e => {
                if (!isActive) {
                    e.currentTarget.style.color = '#fff';
                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                }
            }}
            onMouseLeave={e => {
                if (!isActive) {
                    e.currentTarget.style.color = '#888';
                    e.currentTarget.style.background = 'transparent';
                }
            }}
        >
            <Icon size={18} weight={isActive ? "fill" : "regular"} />
            {label}
            {isComingSoon && (
                <span style={{ fontSize: '10px', background: '#333', padding: '2px 6px', borderRadius: '4px', marginLeft: 'auto', color: '#888' }}>
                    Em breve
                </span>
            )}
        </button>
    );

    const SectionTitle = ({ label }) => (
        <div style={{
            fontSize: '12px',
            fontWeight: '600',
            color: '#444',
            marginTop: '24px',
            marginBottom: '8px',
            paddingLeft: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
        }}>
            {label}
        </div>
    );

    return (
        <aside style={{
            width: '260px',
            height: window.innerWidth < 1024 ? '100dvh' : '100vh',
            background: '#0a0a0a',
            borderRight: '1px solid #222',
            display: 'flex',
            flexDirection: 'column',
            padding: window.innerWidth < 1024 ? '12px 12px 24px' : '24px 16px',
            boxSizing: 'border-box',
            position: 'fixed',
            left: 0,
            top: 0,
            zIndex: 1000,
            color: '#fff',
            overflowY: 'auto'
        }}>
            {/* Logo Area */}
            <div style={{ marginBottom: '24px', paddingLeft: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <img
                    src="https://rlbaboiwngviskgsaomb.supabase.co/storage/v1/object/sign/imagens/audiolooplogo.webp?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8zMGJmN2E4Ny00MDc3LTQ5ZWItYjc1Ni1lNDk2M2Y5MmMzMTciLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJpbWFnZW5zL2F1ZGlvbG9vcGxvZ28ud2VicCIsImlhdCI6MTc2NzI5NzAwMywiZXhwIjoyNTczMzIyNjAzfQ.VQQrRWT3AqlUcUaWXToP7ZoGSvnKIqr3l-Q9HZp-FdI"
                    alt="AudioLoop"
                    style={{ width: '32px', height: '32px', borderRadius: '8px', objectFit: 'contain' }}
                />
                <span style={{ fontWeight: '600', fontSize: '16px' }}>AudioLoop</span>
            </div>

            {/* Workspace Selector Mockup */}
            <div style={{
                marginBottom: '24px',
                background: '#161616',
                border: '1px solid #2a2a2a',
                borderRadius: '8px',
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '20px', height: '20px', background: '#333', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>W</div>
                    <span style={{ fontSize: '13px', fontWeight: '500' }}>Workspace</span>
                </div>
                <CaretDown size={12} color="#666" />
            </div>

            {/* Main Menu */}
            <nav style={{ flex: 1, overflowY: 'auto' }}>
                <SectionTitle label="Estúdio" />
                <MenuItem icon={House} label="Gerar Áudio" isActive={location.pathname === '/'} onClick={() => navigate('/')} />
                <MenuItem icon={MagicWand} label="Modelo IA" isComingSoon />

                <SectionTitle label="Biblioteca" />
                <MenuItem icon={Books} label="Meus Livros" />
                <MenuItem icon={Playlist} label="Playlists" />

                <SectionTitle label="Explorar" />
                <MenuItem icon={Microphone} label="Vozes" />
                <MenuItem icon={BookOpen} label="Audiobooks" />

                {isAdmin && (
                    <>
                        <SectionTitle label="Admin" />
                        <MenuItem icon={Gear} label="Painel Admin" isActive={location.pathname === '/admin'} onClick={() => navigate('/admin')} />
                    </>
                )}
            </nav>

            {/* Footer */}
            <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid #222' }}>
                <MenuItem icon={Gift} label="Compartilhar" />

                <div style={{
                    marginTop: '12px',
                    background: '#161616',
                    padding: '12px',
                    borderRadius: '12px',
                    border: '1px solid #222',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                }}>
                    {user ? (
                        <>
                            <div style={{
                                width: '36px', height: '36px',
                                background: '#333', borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: '#aaa'
                            }}>
                                <UserCircle size={24} />
                            </div>
                            <div style={{ flex: 1, overflow: 'hidden' }}>
                                <div style={{ fontSize: '13px', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {user.email?.split('@')[0]}
                                </div>
                                <div style={{ fontSize: '11px', color: '#666' }}>{isAdmin ? 'Plano Admin' : 'Plano Grátis'}</div>
                            </div>
                            <button onClick={handleLogout} title="Sair" style={{ background: 'transparent', border: 'none', color: '#666', cursor: 'pointer' }}>
                                <SignOut size={16} />
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={() => setShowLoginModal(true)}
                            style={{
                                width: '100%',
                                background: '#fff',
                                color: '#000',
                                border: 'none',
                                padding: '8px',
                                borderRadius: '6px',
                                fontWeight: '600',
                                fontSize: '13px',
                                cursor: 'pointer'
                            }}
                        >
                            Log in / Sign up
                        </button>
                    )}
                </div>
            </div>
        </aside>
    )
}
