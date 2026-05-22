import { UserCircle } from "@phosphor-icons/react"
import { useAuth } from "../../hooks/useAuth"
import { resolveImageUrl } from "../../constants"

/**
 * Header compartilhado entre páginas no mobile.
 * Some no desktop (lá tem o sidebar).
 * Mostra avatar do usuário no canto direito (ou ícone se não logado/sem foto).
 */
export default function MobileHeader({ title, onAvatarClick }) {
    const { user } = useAuth()
    const rawAvatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture
    const avatarUrl = resolveImageUrl(rawAvatarUrl) || rawAvatarUrl

    return (
        <header className="mobile-header">
            <h1 className="mobile-header-title">{title}</h1>
            <button
                onClick={onAvatarClick}
                className="mobile-header-avatar"
                aria-label="Perfil"
            >
                {avatarUrl ? (
                    <img src={avatarUrl} alt="" />
                ) : (
                    <UserCircle size={32} weight="fill" />
                )}
            </button>
        </header>
    )
}
