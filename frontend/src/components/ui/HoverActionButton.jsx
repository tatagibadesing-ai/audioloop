import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

// Componente de Botão com Tooltip Animado
export default function HoverActionButton({ icon: Icon, label, onClick }) {
    const [isHovered, setIsHovered] = useState(false)

    return (
        <div
            style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <AnimatePresence>
                {isHovered && (
                    <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        style={{
                            position: 'absolute',
                            bottom: '100%',
                            marginBottom: '12px',
                            background: '#FCFBF8',
                            color: '#0a0a0a',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '500',
                            whiteSpace: 'nowrap',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                            pointerEvents: 'none',
                            zIndex: 100,
                            letterSpacing: '0.01em',
                            fontFamily: "'Inter', sans-serif"
                        }}
                    >
                        {label}
                        {/* Triângulo (Seta) */}
                        <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            width: 0,
                            height: 0,
                            borderLeft: '5px solid transparent',
                            borderRight: '5px solid transparent',
                            borderTop: '5px solid #FCFBF8',
                        }} />
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.button
                onClick={onClick}
                whileHover={{ scale: 1.1, color: '#FCFBF8' }}
                whileTap={{ scale: 0.9 }}
                style={{
                    background: 'transparent',
                    border: 'none',
                    color: isHovered ? '#FCFBF8' : '#666',
                    cursor: 'pointer',
                    padding: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'color 0.2s ease',
                    borderRadius: '50%'
                }}
            >
                <Icon size={20} weight="bold" />
            </motion.button>
        </div>
    )
}
