import { useState, useRef, useEffect } from "react";

/**
 * ProfileMenu - User profile dropdown menu
 *
 * Features:
 * - Avatar with initials
 * - Dropdown menu with custom actions
 * - Separators
 *
 * @author Lorenzo DM
 * @since 0.2.0
 */
export default function ProfileMenu({ initials = "U", title, subtitle, items = [] }) {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef(null);

    // Close menu when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleItemClick = (item) => {
        if (item.onClick) {
            item.onClick();
        }
        setIsOpen(false);
    };

    return (
        <div className="profile-menu" ref={menuRef}>
            {/* Avatar Button */}
            <button
                className="profile-avatar"
                onClick={() => setIsOpen(!isOpen)}
                title={title}
            >
                {initials}
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="profile-dropdown">
                    {/* Header */}
                    <div className="profile-dropdown-header">
                        <div className="profile-dropdown-avatar">{initials}</div>
                        <div className="profile-dropdown-info">
                            <div className="profile-dropdown-title">{title}</div>
                            {subtitle && <div className="profile-dropdown-subtitle">{subtitle}</div>}
                        </div>
                    </div>

                    <hr className="dropdown-divider" />

                    {/* Items */}
                    <div className="profile-dropdown-items">
                        {items.map((item, index) => {
                            if (item.type === "sep") {
                                return <hr key={index} className="dropdown-divider" />;
                            }

                            return (
                                <button
                                    key={item.id || index}
                                    className="profile-dropdown-item"
                                    onClick={() => handleItemClick(item)}
                                >
                                    {item.icon && <i className={`bi ${item.icon} me-2`}></i>}
                                    {item.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            <style>{`
                .profile-menu {
                    position: relative;
                }
                
                .profile-avatar {
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    background: var(--adf-avatar-bg, linear-gradient(135deg, #4fc3f7 0%, #0288d1 100%));
                    color: white;
                    border: none;
                    font-weight: 600;
                    font-size: 0.9rem;
                    cursor: pointer;
                    transition: transform 0.15s, box-shadow 0.15s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                .profile-avatar:hover {
                    transform: scale(1.05);
                    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                }
                
                .profile-dropdown {
                    position: absolute;
                    top: 100%;
                    right: 0;
                    margin-top: 0.5rem;
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 4px 16px rgba(0,0,0,0.15);
                    min-width: 220px;
                    z-index: 1000;
                    animation: fadeIn 0.15s ease;
                }
                
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(-8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                
                .profile-dropdown-header {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.75rem 1rem;
                }
                
                .profile-dropdown-avatar {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    background: var(--adf-avatar-bg, linear-gradient(135deg, #4fc3f7 0%, #0288d1 100%));
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 600;
                }
                
                .profile-dropdown-info {
                    flex: 1;
                }
                
                .profile-dropdown-title {
                    font-weight: 600;
                    font-size: 0.9rem;
                }
                
                .profile-dropdown-subtitle {
                    font-size: 0.75rem;
                    color: var(--adf-panel-muted, #6c757d);
                }
                
                .profile-dropdown-items {
                    padding: 0.25rem 0;
                }
                
                .profile-dropdown-item {
                    display: flex;
                    align-items: center;
                    width: 100%;
                    padding: 0.5rem 1rem;
                    border: none;
                    background: none;
                    text-align: left;
                    font-size: 0.875rem;
                    color: var(--adf-panel-text, #495057);
                    cursor: pointer;
                    transition: background 0.1s;
                }
                
                .profile-dropdown-item:hover {
                    background: var(--adf-panel-hover, #f8f9fa);
                }
                
                .dropdown-divider {
                    margin: 0.25rem 0;
                    border-top: 1px solid var(--adf-panel-border, #e9ecef);
                }
            `}</style>
        </div>
    );
}
