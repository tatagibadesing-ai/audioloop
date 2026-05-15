import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Sempre que a rota muda, rola pro topo (window e qualquer .main-content).
 * Mantém scroll independente entre páginas.
 */
export function useScrollToTopOnRoute() {
    const { pathname } = useLocation()
    useEffect(() => {
        window.scrollTo(0, 0)
        const main = document.querySelector('.main-content')
        if (main) main.scrollTop = 0
    }, [pathname])
}
