import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { X, Warning, CheckCircle, Info } from '@phosphor-icons/react';

const PremiumToast = ({ t, message, type = 'success' }) => {
    const icons = {
        success: <CheckCircle size={20} weight="fill" color="#10b981" />,
        error: <Warning size={20} weight="fill" color="#ef4444" />,
        info: <Info size={20} weight="fill" color="#3b82f6" />,
        warning: <Warning size={20} weight="fill" color="#f59e0b" />,
    };

    const colors = {
        success: 'rgba(16, 185, 129, 0.1)',
        error: 'rgba(239, 68, 68, 0.1)',
        info: 'rgba(59, 130, 246, 0.1)',
        warning: 'rgba(245, 158, 11, 0.1)',
    };

    const borderColors = {
        success: 'rgba(16, 185, 129, 0.2)',
        error: 'rgba(239, 68, 68, 0.2)',
        info: 'rgba(59, 130, 246, 0.2)',
        warning: 'rgba(245, 158, 11, 0.2)',
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: 20, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.9 }}
            style={{
                background: '#1a1a1a',
                border: `1px solid ${borderColors[type]}`,
                borderRadius: '16px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                backdropFilter: 'blur(12px)',
                minWidth: '300px',
                maxWidth: '450px',
                position: 'relative',
                overflow: 'hidden'
            }}
        >
            {/* Background Accent */}
            <div style={{
                position: 'absolute',
                inset: 0,
                background: colors[type],
                zIndex: -1
            }} />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {icons[type]}
            </div>

            <div style={{ flex: 1, color: '#FCFBF8', fontSize: '14px', fontWeight: '500' }}>
                {message}
            </div>

            <button
                onClick={() => toast.dismiss(t.id)}
                style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#666',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '4px',
                    borderRadius: '50%',
                    transition: 'all 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                onMouseLeave={e => e.currentTarget.style.color = '#666'}
            >
                <X size={16} weight="bold" />
            </button>

            {/* Time progress bar */}
            {t.duration && (
                <motion.div
                    initial={{ width: '100%' }}
                    animate={{ width: 0 }}
                    transition={{ duration: t.duration / 1000, ease: 'linear' }}
                    style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        height: '2px',
                        background: type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6',
                        opacity: 0.5
                    }}
                />
            )}
        </motion.div>
    );
};

export const showToast = {
    success: (msg) => toast.custom((t) => <PremiumToast t={t} message={msg} type="success" />),
    error: (msg) => toast.custom((t) => <PremiumToast t={t} message={msg} type="error" />),
    info: (msg) => toast.custom((t) => <PremiumToast t={t} message={msg} type="info" />),
    warning: (msg) => toast.custom((t) => <PremiumToast t={t} message={msg} type="warning" />),
};
