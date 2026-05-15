import { useNavigate, useLocation } from "react-router-dom"
import { House, BookBookmark, Gear } from "@phosphor-icons/react"

export default function BottomTabBar({ isAdmin, setShowLoginModal, user }) {
    const navigate = useNavigate()
    const location = useLocation()

    const tabs = [
        { icon: House, label: "Início", path: "/" },
        { icon: BookBookmark, label: "Meus Livros", path: "/meus-livros" },
        ...(isAdmin ? [{ icon: Gear, label: "Admin", path: "/admin" }] : []),
    ]

    const handleTab = (tab) => {
        if (tab.path === "/meus-livros" && !user) {
            setShowLoginModal(true)
            return
        }
        navigate(tab.path)
    }

    const isActive = (tab) => location.pathname === tab.path

    return (
        <nav className="bottom-tab-bar">
            {tabs.map((tab) => {
                const active = isActive(tab)
                return (
                    <button
                        key={tab.label}
                        onClick={() => handleTab(tab)}
                        className={`bottom-tab-item ${active ? "active" : ""}`}
                    >
                        <tab.icon size={28} weight="fill" />
                        <span>{tab.label}</span>
                    </button>
                )
            })}
        </nav>
    )
}
