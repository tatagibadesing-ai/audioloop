import { useEffect, useRef } from 'react';

/**
 * Barra de progresso ultra-suave que manipula o DOM diretamente via requestAnimationFrame
 * para garantir 60FPS sem overhead do React.
 */
export default function SmoothProgressBar({ playerRef, isPlaying }) {
    const barRef = useRef(null);

    useEffect(() => {
        let rafId;

        const update = () => {
            // Acessa o elemento de áudio nativo HTML5 de dentro da ref do react-h5-audio-player
            const audio = playerRef.current?.audio?.current;
            const bar = barRef.current;

            if (audio && bar) {
                const duration = audio.duration;
                const currentTime = audio.currentTime;

                if (!Number.isNaN(duration) && duration > 0) {
                    const percentage = (currentTime / duration) * 100;
                    // Atualização direta do DOM para máxima performance
                    bar.style.width = `${percentage}%`;
                }
            }

            if (isPlaying) {
                rafId = requestAnimationFrame(update);
            }
        };

        if (isPlaying) {
            update();
        } else {
            // Garante uma atualização final ao pausar
            update();
        }

        return () => {
            if (rafId) cancelAnimationFrame(rafId);
        };
    }, [isPlaying, playerRef]);

    return (
        <div style={{ width: '100%', height: '4px', background: '#333', borderRadius: '2px', overflow: 'hidden', transform: 'translateZ(0)' }}>
            <div
                ref={barRef}
                style={{
                    width: '0%',
                    height: '100%',
                    background: '#FCFBF8',
                    borderRadius: '2px',
                    // Importante: SEM transition CSS aqui, pois o update é frame-a-frame
                    transition: 'none',
                    willChange: 'width' // Dica para o navegador otimizar a renderização
                }}
            />
        </div>
    );
}
