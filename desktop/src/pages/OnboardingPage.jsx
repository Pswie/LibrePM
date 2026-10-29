import { useState, useEffect } from "react";
import { librepm } from "@api/librepm.js";
import Logo from "../assets/icon.png";
import { useTranslation } from 'react-i18next';
import { useModal } from '../hooks/useModal';

/**
 * OnboardingPage - Schermata di profilazione al primo avvio
 *
 * Stati gestiti:
 * - LOADING: Caricamento dati bootstrap
 * - NO_PROFILES: Nessun profilo, mostra form creazione
 * - PROFILES_LIST: Lista profili esistenti + opzione crea nuovo
 * - ERROR: Errore di connessione/rete
 *
 * @author Lorenzo DM
 * @since 0.3.0
 * @version 0.1.0
 */
export default function OnboardingPage({ onProfileSelected, bootstrapData, onRetry }) {
    const { t, i18n } = useTranslation();
    const modal = useModal();
    // ========================================
    // State
    // ========================================

    const [view, setView] = useState("list"); // "list" | "create" | "workspace"
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [localUsers, setLocalUsers] = useState(bootstrapData?.users || []);
    const [pendingUser, setPendingUser] = useState(null); // user waiting for workspace selection
    const [wsProfiles, setWsProfiles] = useState([]);

    // Form creazione profilo
    const [formData, setFormData] = useState({
        username: "",
        displayName: "",
        email: "",
        password: "",
    });
    const [formErrors, setFormErrors] = useState({});

    // Login state
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [loginPassword, setLoginPassword] = useState("");
    const [resetPasswordUserId, setResetPasswordUserId] = useState(null);
    const [resetPasswordData, setResetPasswordData] = useState({
        usernameConfirmation: "",
        newPassword: "",
        confirmPassword: "",
    });
    const [visiblePasswords, setVisiblePasswords] = useState({});

    // Preferenze
    const [autologinEnabled, setAutologinEnabled] = useState(
        bootstrapData?.preferences?.autologinEnabled || false
    );

    // ========================================
    // Computed
    // ========================================

    const hasProfiles = localUsers.length > 0;
    const lastUserId = bootstrapData?.preferences?.lastUserId;

    const togglePasswordVisibility = (key) => {
        setVisiblePasswords(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const renderPasswordInput = ({
        id,
        visibilityKey,
        className = "form-control",
        placeholder,
        value,
        onChange,
        onKeyPress,
        disabled,
        autoFocus,
        invalid,
    }) => {
        const visible = !!visiblePasswords[visibilityKey];
        return (
            <div className="input-group">
                <input
                    type={visible ? "text" : "password"}
                    className={`${className} ${invalid ? "is-invalid" : ""}`}
                    id={id}
                    placeholder={placeholder}
                    value={value}
                    onChange={onChange}
                    onKeyPress={onKeyPress}
                    disabled={disabled}
                    autoFocus={autoFocus}
                />
                <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => togglePasswordVisibility(visibilityKey)}
                    disabled={disabled}
                    title={visible ? t("Hide password") : t("Show password")}
                    aria-label={visible ? t("Hide password") : t("Show password")}
                >
                    <i className={`bi ${visible ? "bi-eye-slash" : "bi-eye"}`}></i>
                </button>
            </div>
        );
    };

    // ========================================
    // Effects
    // ========================================

    useEffect(() => {
        // If there are no profiles, show the creation form directly
        if (!hasProfiles && view !== "create") {
            setView("create");
            // Reset form data to avoid leftovers
            setFormData({ username: "", displayName: "", email: "", password: "" });
        }
    }, [hasProfiles, view]);

    useEffect(() => {
        // Aggiorna localUsers solo se bootstrapData cambia e abbiamo utenti
        // Questo evita di sovrascrivere l'eliminazione locale se il parent non ha ancora ricaricato
        if (bootstrapData?.users && bootstrapData.users.length !== localUsers.length) {
             // Logica opzionale: potremmo voler sincronizzare sempre, ma per ora fidiamoci dell'azione locale
             // setLocalUsers(bootstrapData.users);
        }
    }, [bootstrapData]);

    // ========================================
    // Handlers
    // ========================================

    const handleLogin = async (userId) => {
        if (!loginPassword) {
            setError(t("Password is required"));
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const user = await librepm.bootstrapLogin(userId, loginPassword);

            if (autologinEnabled) {
                await librepm.bootstrapUpdatePreferences({
                    lastUserId: userId,
                    autologinEnabled: true,
                });
                librepm.setLocalPreferences({ autologinEnabled: true, lastUserId: userId });
            }

            onProfileSelected(user);
        } catch (e) {
            console.error("[Onboarding] Login error:", e);
            setError(t("Invalid password. Please try again."));
            setLoading(false);
        }
    };

    const handleResetPassword = async (user) => {
        const usernameConfirmation = resetPasswordData.usernameConfirmation.trim();
        const newPassword = resetPasswordData.newPassword;

        if (!usernameConfirmation) {
            setError(t("Username confirmation is required"));
            return;
        }
        if (usernameConfirmation.toLowerCase() !== user.username.toLowerCase()) {
            setError(t("Username confirmation does not match"));
            return;
        }
        if (newPassword.length < 8) {
            setError(t("Password must be at least 8 characters"));
            return;
        }
        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^a-zA-Z0-9])/.test(newPassword)) {
            setError(t("Password must contain uppercase, lowercase, number and special char"));
            return;
        }
        if (newPassword !== resetPasswordData.confirmPassword) {
            setError(t("Passwords do not match"));
            return;
        }

        setLoading(true);
        setError(null);

        try {
            await librepm.usersResetPassword(user.id, usernameConfirmation, newPassword);
            const loggedInUser = await librepm.bootstrapLogin(user.id, newPassword);

            if (autologinEnabled) {
                await librepm.bootstrapUpdatePreferences({
                    lastUserId: user.id,
                    autologinEnabled: true,
                });
                librepm.setLocalPreferences({ autologinEnabled: true, lastUserId: user.id });
            }

            onProfileSelected(loggedInUser);
        } catch (e) {
            console.error("[Onboarding] Password reset error:", e);
            setError(e.message || t("Unable to reset password. Please try again."));
            setLoading(false);
        }
    };

    /**
     * Elimina un profilo esistente
     */
    const handleDeleteProfile = async (e, userId, userName) => {
        e.stopPropagation(); // Evita selezione profilo
        
        const confirmed = await modal.confirm({
            title: t('Conferma eliminazione'),
            message: `${t("Are you sure you want to delete profile")} "${userName}"? ${t("This action cannot be undone.")}`
        });

        if (!confirmed) {
            return;
        }

        setLoading(true);
        setError(null);

        try {
            await librepm.bootstrapDeleteProfile(userId);
            
            // Update local list
            const updatedUsers = localUsers.filter(u => u.id !== userId);
            setLocalUsers(updatedUsers);
            
            // If there are no more users, go to create
            if (updatedUsers.length === 0) {
                setFormData({ username: "", displayName: "", email: "", password: "" });
                setView("create");
            }
        } catch (e) {
            console.error("[Onboarding] Error deleting profile:", e);
            setError(t("Unable to delete profile. Please try again."));
            // Restore state in case of error
            if (bootstrapData?.users) {
                setLocalUsers(bootstrapData.users);
            }
        } finally {
            setLoading(false);
        }
    };

    /**
     * Crea un nuovo profilo
     */
    const handleCreateProfile = async (e) => {
        e.preventDefault();

        // Validazione client-side
        const errors = {};
        if (!formData.username.trim()) {
            errors.username = t("Username is required");
        } else if (formData.username.length < 3) {
            errors.username = t("Username must be at least 3 characters");
        }
        if (!formData.displayName.trim()) {
            errors.displayName = t("Display name is required");
        }
        if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            errors.email = t("Invalid email");
        }
        
        // Password validation
        if (!formData.password) {
            errors.password = t("Password is required");
        } else {
            if (formData.password.length < 8) {
                errors.password = t("Password must be at least 8 characters");
            } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^a-zA-Z0-9])/.test(formData.password)) {
                errors.password = t("Password must contain uppercase, lowercase, number and special char");
            }
        }

        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            return;
        }

        setLoading(true);
        setError(null);
        setFormErrors({});

        try {
            // Crea profilo nel backend
            const newUser = await librepm.bootstrapCreateProfile({
                username: formData.username.trim(),
                displayName: formData.displayName.trim(),
                email: formData.email.trim() || null,
                password: formData.password,
            });

            // Aggiorna la lista locale per evitare che l'effect forzi view="create"
            setLocalUsers(prev => [...prev, newUser]);

            // Seleziona automaticamente il nuovo profilo
            librepm.setCurrentUser(newUser.id);

            // Aggiorna preferenze
            await librepm.bootstrapUpdatePreferences({
                lastUserId: newUser.id,
                autologinEnabled: autologinEnabled,
            });
            librepm.setLocalPreferences({
                autologinEnabled: autologinEnabled,
                lastUserId: newUser.id
            });

            // Load workspace profiles for selection step
            try {
                const profiles = await librepm.workspaceProfilesList();
                if (profiles && profiles.length > 1) {
                    setWsProfiles(profiles);
                    setPendingUser(newUser);
                    setView("workspace");
                    setLoading(false);
                    return;
                }
            } catch (wpErr) {
                console.warn("[Onboarding] Could not load workspace profiles:", wpErr.message);
            }

            // Notifica il parent
            onProfileSelected(newUser);
        } catch (e) {
            console.error("[Onboarding] Errore creazione profilo:", e);
            if (e.status === 409) {
                setFormErrors({ username: t("Username already exists") });
            } else {
                setError(e.message || t("Unable to create profile. Please try again."));
            }
            setLoading(false);
        }
    };

    /**
     * Toggle autologin preference
     */
    const handleAutologinChange = (e) => {
        setAutologinEnabled(e.target.checked);
    };

    const changeLanguage = (lng) => {
        i18n.changeLanguage(lng);
        librepm.setLocalPreferences({ language: lng });
    };

    const handleSelectWorkspaceProfile = async (profileId) => {
        try {
            setLoading(true);
            await librepm.workspaceProfileAssign(pendingUser.id, profileId);
            onProfileSelected(pendingUser);
        } catch (e) {
            console.warn("[Onboarding] Failed to assign workspace profile:", e.message);
            // Proceed anyway — the default is already set
            onProfileSelected(pendingUser);
        }
    };

    // ========================================
    // Render - Workspace Profile Selection
    // ========================================

    const renderWorkspaceSelection = () => (
        <div className="onboarding-workspace">
            <h4 className="mb-3">
                <i className="bi bi-layout-sidebar me-2"></i>
                {t("Choose your workspace")}
            </h4>
            <p className="text-muted mb-4 small">
                {t("Select a workspace profile that matches how you work. You can change this later in Settings.")}
            </p>

            <div className="d-flex flex-column gap-2 mb-4">
                {wsProfiles.map(profile => {
                    let modules = {};
                    try {
                        modules = typeof profile.modulesJson === 'string'
                            ? JSON.parse(profile.modulesJson)
                            : (profile.modulesJson || {});
                    } catch { /* ignore */ }
                    const enabledModules = Object.entries(modules)
                        .filter(([, v]) => v === true)
                        .map(([k]) => k);

                    return (
                        <div
                            key={profile.id}
                            className="profile-card"
                            onClick={() => handleSelectWorkspaceProfile(profile.id)}
                            role="button"
                            tabIndex={0}
                            onKeyPress={(e) => e.key === "Enter" && handleSelectWorkspaceProfile(profile.id)}
                        >
                            <div className="profile-avatar">
                                <i className="bi bi-grid-3x3-gap" style={{ color: 'white', fontSize: '1.2rem' }}></i>
                            </div>
                            <div className="profile-info">
                                <div className="profile-name">{t(`workspace.${profile.name}`, profile.name)}</div>
                                {profile.description && (
                                    <div className="profile-username text-muted small">{t(`workspace.${profile.name}.desc`, profile.description)}</div>
                                )}
                                {enabledModules.length > 0 && (
                                    <div className="d-flex flex-wrap gap-1 mt-1">
                                        {enabledModules.map(mod => (
                                            <span key={mod} className="badge bg-primary-subtle text-primary" style={{ fontSize: '0.65rem' }}>
                                                {mod}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="profile-actions">
                                <div className="profile-select-icon">
                                    <i className="bi bi-chevron-right"></i>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="text-center">
                <button
                    className="btn btn-link btn-sm text-muted"
                    onClick={() => onProfileSelected(pendingUser)}
                >
                    {t("Skip for now")}
                </button>
            </div>
        </div>
    );

    // ========================================
    // Render - Lista Profili
    // ========================================

    const renderProfilesList = () => (
        <div className="onboarding-profiles">
            <h4 className="mb-4">
                <i className="bi bi-person-circle me-2"></i>
                {t("Select a profile")}
            </h4>

            <div className="profiles-grid mb-4">
                {localUsers.map((user) => (
                    <div
                        key={user.id}
                        className={`profile-card ${user.id === lastUserId ? "last-used" : ""} ${selectedUserId === user.id ? "selected" : ""}`}
                        onClick={() => {
                            if (selectedUserId === user.id) return;
                            setSelectedUserId(user.id);
                            setResetPasswordUserId(null);
                            setLoginPassword("");
                            setResetPasswordData({
                                usernameConfirmation: "",
                                newPassword: "",
                                confirmPassword: "",
                            });
                            setError(null);
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyPress={(e) => e.key === "Enter" && setSelectedUserId(user.id)}
                    >
                        <div className="profile-avatar">
                            {user.avatarPath ? (
                                <img src={user.avatarPath} alt={user.displayName} />
                            ) : (
                                <span className="avatar-initials">
                                    {(user.displayName || user.username || "?")
                                        .substring(0, 2)
                                        .toUpperCase()}
                                </span>
                            )}
                        </div>
                        <div className="profile-info">
                            <div className="profile-name">
                                {user.displayName || user.username}
                            </div>
                            <div className="profile-username text-muted small">
                                @{user.username}
                            </div>
                            {user.id === lastUserId && (
                                <span className="badge bg-primary-subtle text-primary mt-1">
                                    {t("Last used")}
                                </span>
                            )}
                        </div>
                        
                        <div className="profile-actions">
                            <button 
                                className="btn btn-sm btn-link text-danger delete-btn"
                                onClick={(e) => handleDeleteProfile(e, user.id, user.displayName || user.username)}
                                title={t("Delete profile")}
                            >
                                <i className="bi bi-trash"></i>
                            </button>
                            <div className="profile-select-icon">
                                <i className="bi bi-chevron-right"></i>
                            </div>
                        </div>

                        {selectedUserId === user.id && (
                            <div className="profile-login-form" onClick={e => e.stopPropagation()}>
                                {resetPasswordUserId === user.id ? (
                                    <>
                                        <input
                                            type="text"
                                            className="form-control form-control-sm mb-2"
                                            placeholder={t("Confirm username")}
                                            value={resetPasswordData.usernameConfirmation}
                                            onChange={e => setResetPasswordData({
                                                ...resetPasswordData,
                                                usernameConfirmation: e.target.value,
                                            })}
                                            autoFocus
                                        />
                                        <div className="mb-2">
                                            {renderPasswordInput({
                                                visibilityKey: "reset-new",
                                                className: "form-control form-control-sm",
                                                placeholder: t("New password"),
                                                value: resetPasswordData.newPassword,
                                                onChange: e => setResetPasswordData({
                                                    ...resetPasswordData,
                                                    newPassword: e.target.value,
                                                }),
                                            })}
                                        </div>
                                        <div className="mb-2">
                                            {renderPasswordInput({
                                                visibilityKey: "reset-confirm",
                                                className: "form-control form-control-sm",
                                                placeholder: t("Confirm new password"),
                                                value: resetPasswordData.confirmPassword,
                                                onChange: e => setResetPasswordData({
                                                    ...resetPasswordData,
                                                    confirmPassword: e.target.value,
                                                }),
                                                onKeyPress: e => e.key === 'Enter' && handleResetPassword(user),
                                            })}
                                        </div>
                                        <div className="d-flex gap-2">
                                            <button
                                                className="btn btn-sm btn-primary flex-grow-1"
                                                onClick={() => handleResetPassword(user)}
                                                disabled={loading}
                                            >
                                                {loading ? <span className="spinner-border spinner-border-sm"></span> : t("Reset password")}
                                            </button>
                                            <button
                                                className="btn btn-sm btn-outline-secondary"
                                                onClick={() => {
                                                    setResetPasswordUserId(null);
                                                    setResetPasswordData({
                                                        usernameConfirmation: "",
                                                        newPassword: "",
                                                        confirmPassword: "",
                                                    });
                                                    setError(null);
                                                }}
                                                disabled={loading}
                                            >
                                                {t("Cancel")}
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="mb-2">
                                            {renderPasswordInput({
                                                visibilityKey: "login",
                                                className: "form-control form-control-sm",
                                                placeholder: t("Password"),
                                                value: loginPassword,
                                                onChange: e => setLoginPassword(e.target.value),
                                                onKeyPress: e => e.key === 'Enter' && handleLogin(user.id),
                                                autoFocus: true,
                                            })}
                                        </div>
                                        <div className="d-flex gap-2">
                                            <button
                                                className="btn btn-sm btn-primary flex-grow-1"
                                                onClick={() => handleLogin(user.id)}
                                                disabled={loading}
                                            >
                                                {loading ? <span className="spinner-border spinner-border-sm"></span> : t("Login")}
                                            </button>
                                            <button
                                                className="btn btn-sm btn-outline-secondary"
                                                onClick={() => setSelectedUserId(null)}
                                                disabled={loading}
                                            >
                                                {t("Cancel")}
                                            </button>
                                        </div>
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-link px-0 mt-1"
                                            onClick={() => {
                                                setResetPasswordUserId(user.id);
                                                setLoginPassword("");
                                                setError(null);
                                            }}
                                            disabled={loading}
                                        >
                                            {t("Forgot password?")}
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Opzione crea nuovo */}
            <div className="text-center">
                <button
                    className="btn btn-outline-primary"
                    onClick={() => setView("create")}
                >
                    <i className="bi bi-plus-circle me-2"></i>
                    {t("Create new profile")}
                </button>
            </div>

            {/* Checkbox autologin */}
            <div className="form-check mt-4 text-center">
                <input
                    type="checkbox"
                    className="form-check-input"
                    id="autologinCheck"
                    checked={autologinEnabled}
                    onChange={handleAutologinChange}
                />
                <label className="form-check-label" htmlFor="autologinCheck">
                    {t("Automatically login with last used profile")}
                </label>
            </div>
        </div>
    );

    // ========================================
    // Render - Form Creazione
    // ========================================

    const renderCreateForm = () => (
        <div className="onboarding-create">
            <h4 className="mb-4">
                <i className="bi bi-person-plus me-2"></i>
                {hasProfiles ? t("Create new profile") : t("Create your profile")}
            </h4>

            {!hasProfiles && (
                <p className="text-muted mb-4">
                    {t("To get started, create your user profile.")}
                </p>
            )}

            <form onSubmit={handleCreateProfile}>
                {/* Username */}
                <div className="mb-3">
                    <label htmlFor="username" className="form-label">
                        {t("Username")} <span className="text-danger">*</span>
                    </label>
                    <input
                        type="text"
                        className={`form-control ${formErrors.username ? "is-invalid" : ""}`}
                        id="username"
                        placeholder="es. mario.rossi"
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        disabled={loading}
                        autoFocus
                    />
                    {formErrors.username && (
                        <div className="invalid-feedback">{formErrors.username}</div>
                    )}
                    <div className="form-text">
                        {t("Unique identifier (min. 3 chars)")}
                    </div>
                </div>

                {/* Display Name */}
                <div className="mb-3">
                    <label htmlFor="displayName" className="form-label">
                        {t("Display Name")} <span className="text-danger">*</span>
                    </label>
                    <input
                        type="text"
                        className={`form-control ${formErrors.displayName ? "is-invalid" : ""}`}
                        id="displayName"
                        placeholder="es. Mario Rossi"
                        value={formData.displayName}
                        onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                        disabled={loading}
                    />
                    {formErrors.displayName && (
                        <div className="invalid-feedback">{formErrors.displayName}</div>
                    )}
                    <div className="form-text">
                        {t("How you want to be called")}
                    </div>
                </div>

                {/* Email */}
                <div className="mb-3">
                    <label htmlFor="email" className="form-label">
                        {t("Email")}
                    </label>
                    <input
                        type="email"
                        className={`form-control ${formErrors.email ? "is-invalid" : ""}`}
                        id="email"
                        placeholder="es. mario@esempio.it"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        disabled={loading}
                    />
                    {formErrors.email && (
                        <div className="invalid-feedback">{formErrors.email}</div>
                    )}
                    <div className="form-text">
                        {t("For future sync/cloud features")}
                    </div>
                </div>

                {/* Password */}
                <div className="mb-4">
                    <label htmlFor="password" className="form-label">
                        {t("Password")} <span className="text-danger">*</span>
                    </label>
                    {renderPasswordInput({
                        id: "password",
                        visibilityKey: "create-password",
                        placeholder: t("Min. 8 chars, A-Z, a-z, 0-9, !@#"),
                        value: formData.password,
                        onChange: (e) => setFormData({ ...formData, password: e.target.value }),
                        disabled: loading,
                        invalid: formErrors.password,
                    })}
                    {formErrors.password && (
                        <div className="invalid-feedback">{formErrors.password}</div>
                    )}
                </div>

                {/* Checkbox autologin */}
                <div className="form-check mb-4">
                    <input
                        type="checkbox"
                        className="form-check-input"
                        id="autologinCheckCreate"
                        checked={autologinEnabled}
                        onChange={handleAutologinChange}
                        disabled={loading}
                    />
                    <label className="form-check-label" htmlFor="autologinCheckCreate">
                        {t("Automatically login on next startup")}
                    </label>
                </div>

                {/* Bottoni */}
                <div className="d-flex gap-2">
                    {hasProfiles && (
                        <button
                            type="button"
                            className="btn btn-outline-secondary"
                            onClick={() => setView("list")}
                            disabled={loading}
                        >
                            <i className="bi bi-arrow-left me-2"></i>
                            {t("Back")}
                        </button>
                    )}
                    <button
                        type="submit"
                        className="btn btn-primary flex-grow-1"
                        disabled={loading}
                    >
                        {loading ? (
                            <>
                                <span className="spinner-border spinner-border-sm me-2"></span>
                                {t("Creating...")}
                            </>
                        ) : (
                            <>
                                <i className="bi bi-check-lg me-2"></i>
                                {t("Create profile and start")}
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );

    // ========================================
    // Render - Main
    // ========================================

    return (
        <div className="onboarding-page">
            <div className="onboarding-container">
                {/* Language Switcher */}
                <div className="position-absolute top-0 end-0 p-3">
                    <div className="btn-group btn-group-sm" role="group">
                        <button 
                            type="button" 
                            className={`btn ${i18n.language === 'it' ? 'btn-primary' : 'btn-outline-primary'}`}
                            onClick={() => changeLanguage('it')}
                        >
                            IT
                        </button>
                        <button 
                            type="button" 
                            className={`btn ${i18n.language === 'en' ? 'btn-primary' : 'btn-outline-primary'}`}
                            onClick={() => changeLanguage('en')}
                        >
                            EN
                        </button>
                    </div>
                </div>

                {/* Header */}
                <div className="onboarding-header text-center mb-4">
                    <div className="onboarding-logo mb-3">
                        <img 
                            src={Logo} 
                            alt="LibrePM Logo" 
                            style={{ 
                                width: "80px", 
                                height: "80px",
                                backgroundColor: "#fff",
                                borderRadius: "16px", // Smussamento angoli
                                boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
                            }} 
                        />
                    </div>
                    <h2 className="fw-bold">LibrePM</h2>
                    <p className="text-muted">{t("Project Management Suite")}</p>
                </div>

                {/* Error Alert */}
                {error && (
                    <div className="alert alert-danger d-flex align-items-center mb-4">
                        <i className="bi bi-exclamation-triangle-fill me-2"></i>
                        <div className="flex-grow-1">{error}</div>
                        <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => setError(null)}
                        >
.
                            {t("Close")}
                        </button>
                    </div>
                )}

                {/* Content */}
                <div className="onboarding-content">
                    {loading && view === "list" && !selectedUserId ? (
                        <div className="text-center py-4">
                            <div className="spinner-border text-primary mb-3"></div>
                            <p className="text-muted">{t("Processing...")}</p>
                        </div>
                    ) : view === "workspace" ? (
                        renderWorkspaceSelection()
                    ) : view === "create" ? (
                        renderCreateForm()
                    ) : (
                        renderProfilesList()
                    )}
                </div>

                {/* Footer */}

            </div>

            {/* Stili inline per questa pagina */}
            <style>{`
                html, body, #root {
                    overflow: auto !important;
                    height: auto !important;
                }

                .onboarding-page {
                    min-height: 100vh;
                    display: flex;
                    align-items: flex-start;
                    justify-content: center;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    padding: 20px;
                    position: relative;
                    z-index: 1;
                    overflow-y: auto;
                }

                .onboarding-container {
                    background: white;
                    border-radius: 16px;
                    padding: 40px;
                    max-width: 480px;
                    width: 100%;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                    position: relative;
                    z-index: 2;
                    margin: auto 0;
                }
                
                .profiles-grid {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                
                .profile-card {
                    display: flex;
                    flex-wrap: wrap;
                    align-items: center;
                    gap: 16px;
                    padding: 16px;
                    border: 2px solid #e9ecef;
                    border-radius: 12px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    position: relative;
                }
                
                .profile-card:hover {
                    border-color: #667eea;
                    background: #f8f9fa;
                }
                
                .profile-card.selected {
                    border-color: #667eea;
                    background: #f8f9fa;
                    cursor: default;
                }

                .profile-card.last-used {
                    border-color: #667eea;
                    background: linear-gradient(135deg, rgba(102,126,234,0.05) 0%, rgba(118,75,162,0.05) 100%);
                }
                
                .profile-avatar {
                    width: 48px;
                    height: 48px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }
                
                .profile-avatar img {
                    width: 100%;
                    height: 100%;
                    border-radius: 50%;
                    object-fit: cover;
                }
                
                .avatar-initials {
                    color: white;
                    font-weight: 600;
                    font-size: 16px;
                }
                
                .profile-info {
                    flex-grow: 1;
                    min-width: 0;
                }
                
                .profile-name {
                    font-weight: 600;
                    color: #212529;
                }
                
                .profile-actions {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-left: auto;
                }
                
                .delete-btn {
                    opacity: 0;
                    transition: opacity 0.2s ease;
                    padding: 4px 8px;
                }
                
                .profile-card:hover .delete-btn {
                    opacity: 1;
                }
                
                .profile-select-icon {
                    color: #adb5bd;
                    transition: transform 0.2s ease;
                }
                
                .profile-card:hover .profile-select-icon {
                    transform: translateX(4px);
                    color: #667eea;
                }

                .profile-login-form {
                    width: 100%;
                    margin-top: 12px;
                    padding-top: 12px;
                    border-top: 1px solid #e9ecef;
                }
                
                @media (max-width: 480px) {
                    .onboarding-container {
                        padding: 24px;
                    }
                }
            `}</style>
        </div>
    );
}
