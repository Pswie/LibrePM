import { useTranslation } from 'react-i18next';

/**
 * TopHeader - Barra superiore dell'applicazione
 *
 * Features:
 * - Titolo pagina dinamico
 * - Slot per azioni custom
 * - Responsive
 *
 * @author Lorenzo DM
 * @since 0.2.0
 *
 * @param {function} [props.onMenuToggle] - Apre/chiude il cassetto di
 *   navigazione. Assente sopra i 992px, dove il binario laterale è in vista.
 * @param {boolean} [props.navOpen] - Stato del cassetto, per `aria-expanded`.
 */
export default function TopHeader({ title, actions, onMenuToggle, navOpen = false }) {
    const { t } = useTranslation();

    return (
        <header className="jl-header">
            {/* Il pulsante viene prima del titolo nell'ordine di lettura: è il
                primo comando che serve arrivando da telefono. */}
            {onMenuToggle && (
                <button
                    type="button"
                    className="jl-header-burger"
                    onClick={onMenuToggle}
                    aria-label={t("Navigation")}
                    aria-expanded={navOpen}
                    aria-controls="jl-primary-nav"
                >
                    <i className="bi bi-list"></i>
                </button>
            )}

            <div className="jl-header-title">
                <h1>{title}</h1>
            </div>

            <div className="jl-header-actions">
                {actions}
            </div>

            <style>{`
                .jl-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.75rem 1.5rem;
                    background: var(--jl-bg-secondary);
                    border-bottom: 1px solid var(--jl-border-color);
                    min-height: 60px;
                    color: var(--jl-text-primary);
                    transition: background-color 0.3s ease, border-color 0.3s ease;
                }

                .jl-header-title {
                    /* Senza min-width:0 il titolo non si lascia troncare e
                       spinge le azioni fuori dallo schermo. */
                    min-width: 0;
                    flex: 1;
                }

                .jl-header-title h1 {
                    margin: 0;
                    font-size: 1.25rem;
                    font-weight: 600;
                    color: var(--jl-text-primary);
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .jl-header-actions {
                    display: flex;
                    align-items: center;
                    flex-wrap: wrap;
                    justify-content: flex-end;
                    gap: 0.75rem;
                    min-width: 0;
                    max-width: 75%;
                }

                .jl-header-burger {
                    display: none;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                    width: 44px;
                    height: 44px;
                    margin-left: -0.35rem;
                    border: 0;
                    border-radius: 8px;
                    background: transparent;
                    color: var(--jl-text-primary);
                    font-size: 1.35rem;
                    cursor: pointer;
                    transition: background-color 0.2s ease;
                }

                .jl-header-burger:hover,
                .jl-header-burger:focus-visible {
                    background: var(--jl-border-color);
                }

                .jl-header-burger:active {
                    transform: scale(0.94);
                }

                @media (max-width: 991.98px) {
                    .jl-header-burger {
                        display: flex;
                    }
                }

                @media (max-width: 768px) {
                    .jl-header {
                        height: auto;
                        flex-shrink: 0;
                        flex-wrap: wrap;
                        row-gap: 0.35rem;
                        padding: 0.5rem 1rem;
                        /* L'intaglio della fotocamera sui telefoni recenti mangia
                           la fascia superiore: senza questo il titolo ci finisce
                           sotto in orizzontale. */
                        padding-top: max(0.5rem, env(safe-area-inset-top));
                        padding-left: max(1rem, env(safe-area-inset-left));
                        padding-right: max(1rem, env(safe-area-inset-right));
                    }

                    .jl-header-title h1 {
                        font-size: 1rem;
                    }

                    .jl-header-actions {
                        gap: 0.35rem;
                        flex-basis: 100%;
                        max-width: none;
                    }

                    .jl-header-actions > .d-flex {
                        flex-wrap: wrap;
                        justify-content: flex-end;
                    }

                    .jl-header-actions .btn,
                    .jl-header-actions .form-check-label {
                        white-space: nowrap;
                    }
                }
            `}</style>
        </header>
    );
}
