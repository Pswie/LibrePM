import { useState, useEffect, useCallback } from "react";
import { librepm } from "@api/librepm.js";
import { toast } from "react-toastify";
import { useTranslation } from 'react-i18next';
import { useModal } from "../hooks/useModal.js";
import NotificationPreferencesPanel from "../components/NotificationPreferencesPanel.jsx";
import SuiteAccessPanel from "../components/SuiteAccessPanel.jsx";

const DONATION_URL = "https://www.paypal.com/paypalme/lorenzodemarco92";

/**
 * SettingsPage - Pagina impostazioni utente
 *
 * Features:
 * - Tema (chiaro/scuro) con applicazione immediata
 * - Lingua
 * - Notifiche
 * - Focus Timer defaults
 * - Backup automatico
 * - Import/Export database (PRD-01)
 * - iCal Export (PRD-15)
 * - Connessione DB Esterno (PRD-01)
 *
 * @author Lorenzo DM
 * @since 0.5.2
 * @updated 0.5.3 - Aggiunta UI iCal e DB Esterno
 */
export default function SettingsPage({ shell }) {
    const { t, i18n } = useTranslation();
    const modal = useModal();
    const currentUser = shell?.currentUser;
    const canWrite = shell?.canWrite?.('settings') ?? true;

    // ========================================
    // State
    // ========================================

    const [settings, setSettings] = useState({
        theme: "dark",
        language: "it",
        notificationsEnabled: true,
        focusTimerDefaultMinutes: 25,
        autoBackupEnabled: true,
        backupIntervalDays: 7,
        calendarToken: "", // PRD-15
    });

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [icalUrl, setIcalUrl] = useState("");
    const [visiblePasswords, setVisiblePasswords] = useState({});

    // Workspace Profiles
    const [wsProfiles, setWsProfiles] = useState([]);
    const [currentWsProfileId, setCurrentWsProfileId] = useState(
        shell?.currentUser?.workspaceProfileId || 'wp-personal'
    );

    // ========================================
    // Effects
    // ========================================

    useEffect(() => {
        shell?.setTitle?.(t("Settings"));
        shell?.setHeaderActions?.(null);
        shell?.setRightPanel?.(null);

        return () => {
            shell?.setHeaderActions?.(null);
        };
    }, [shell, t]);

    // Carica impostazioni (solo al mount)
    useEffect(() => {
        async function loadSettings() {
            try {
                setLoading(true);
                const data = await librepm.settingsGet();
                if (data) {
                    setSettings(prev => ({
                        ...prev,
                        ...data,
                        backupIntervalDays: data.backupIntervalDays || 7,
                    }));

                    // Imposta la lingua in i18next
                    if (data.language) {
                        i18n.changeLanguage(data.language);
                    }

                    // Genera URL iCal se token presente
                    if (data.calendarToken) {
                        const baseUrl = await librepm.init().then(r => r.baseUrl);
                        const userId = librepm.getCurrentUser();
                        setIcalUrl(`${baseUrl}/calendar/${userId}/feed.ics?token=${data.calendarToken}`);
                    }
                }
                // Load workspace profiles
                try {
                    const profiles = await librepm.workspaceProfilesList();
                    setWsProfiles(profiles || []);
                } catch (wpErr) {
                    console.warn("[SettingsPage] Could not load workspace profiles:", wpErr.message);
                }
            } catch (e) {
                console.error("[SettingsPage] Errore caricamento:", e);
            } finally {
                setLoading(false);
            }
        }
        loadSettings();

    }, []);

    // ========================================
    // Handlers
    // ========================================

    const handleChange = (key, value) => {
        setSettings((prev) => ({ ...prev, [key]: value }));
        setHasChanges(true);

        if (key === "theme") {
            applyThemePreview(value);
        }

        if (key === "language") {
            i18n.changeLanguage(value);
        }
    };

    const togglePasswordVisibility = (key) => {
        setVisiblePasswords(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const PasswordInput = ({ id, visibilityKey, placeholder, width }) => {
        const visible = !!visiblePasswords[visibilityKey];
        return (
            <div className="input-group input-group-sm" style={width ? { width } : undefined}>
                <input
                    type={visible ? "text" : "password"}
                    className="form-control"
                    placeholder={placeholder}
                    id={id}
                />
                <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => togglePasswordVisibility(visibilityKey)}
                    title={visible ? t("Hide password") : t("Show password")}
                    aria-label={visible ? t("Hide password") : t("Show password")}
                >
                    <i className={`bi ${visible ? "bi-eye-slash" : "bi-eye"}`}></i>
                </button>
            </div>
        );
    };

    const applyThemePreview = (theme) => {
        document.documentElement.setAttribute('data-theme', theme);
        document.body.setAttribute('data-theme', theme);

        if (theme === 'dark') {
            document.documentElement.setAttribute('data-bs-theme', 'dark');
        } else {
            document.documentElement.removeAttribute('data-bs-theme');
        }

        if (shell?.setTheme) {
            shell.setTheme(theme);
        }
    };

    const handleSave = async () => {
        if (!canWrite) return;
        try {
            setSaving(true);
            await librepm.settingsUpdate(settings);
            setHasChanges(false);

            if (shell?.setTheme) {
                shell.setTheme(settings.theme);
            }

            toast.success(t("Saved"));
        } catch (e) {
            console.error("[SettingsPage] Errore salvataggio:", e);
            toast.error(t("Error saving settings") + ": " + e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleReset = async () => {
        const confirmed = await modal.confirm({ title: t("Are you sure you want to restore default settings?") });
        if (!confirmed) {
            return;
        }

        try {
            const defaults = await librepm.settingsReset();
            setSettings(prev => ({
                ...prev,
                ...defaults,
                backupIntervalDays: 7,
            }));
            setHasChanges(false);
            applyThemePreview(defaults.theme || "dark");
            if (defaults.language) {
                i18n.changeLanguage(defaults.language);
            }
            toast.success(t("Settings restored"));
        } catch (e) {
            console.error("[SettingsPage] Errore reset:", e);
            toast.error(t("Error resetting settings") + ": " + e.message);
        }
    };

    const handleExportDb = async () => {
        try {
            if (librepm.isElectron()) {
                const result = await window.librepm.ipc.invoke('db:export');
                if (result.success) {
                    toast.success(`${t("Database exported to")}: ${result.path}`);
                } else if (result.error) {
                    toast.error(t("Export error") + ": " + result.error);
                }
            } else {
                try {
                    const blob = await librepm.exportDatabase();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `librepm-backup-${new Date().toISOString().split("T")[0]}.db`;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast.success(t("Database downloaded"));
                } catch (e) {
                    await librepm.exportJsonDialog();
                    toast.success(t("Database exported (JSON)"));
                }
            }
        } catch (e) {
            console.error("[SettingsPage] Errore export:", e);
            toast.error(t("Export error") + ": " + e.message);
        }
    };

    const handleImportDb = async () => {
        const confirmed = await modal.confirm({ title: t("WARNING: Importing will overwrite ALL current data. Do you want to continue?") });
        if (!confirmed) {
            return;
        }

        try {
            if (librepm.isElectron()) {
                const result = await window.librepm.ipc.invoke('db:import');
                if (result.success) {
                    toast.success(t("Database imported. Restarting application..."));
                    setTimeout(() => window.location.reload(), 2000);
                } else if (result.error) {
                    toast.error(t("Import error") + ": " + result.error);
                }
            } else {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = ".db,.sqlite";
                input.onchange = async (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        try {
                            await librepm.importDatabase(file);
                            toast.success(t("Database imported. Reload the page."));
                            setTimeout(() => window.location.reload(), 2000);
                        } catch (err) {
                            toast.error(t("Import error") + ": " + err.message);
                        }
                    }
                };
                input.click();
            }
        } catch (e) {
            console.error("[SettingsPage] Errore import:", e);
            toast.error(t("Import error") + ": " + e.message);
        }
    };

    const handleRotateCalendarToken = async () => {
        const confirmed = await modal.confirm({ title: t("Regenerating the token will require updating the link on all your external calendars. Continue?") });
        if (!confirmed) return;

        try {
            const userId = librepm.getCurrentUser();
            const response = await fetch(`${await librepm.init().then(r => r.baseUrl)}/calendar/${userId}/rotate-token`, {
                method: 'POST',
                headers: { 'X-User-Id': userId }
            });

            if (response.ok) {
                const data = await response.json();
                const baseUrl = await librepm.init().then(r => r.baseUrl);
                setIcalUrl(`${baseUrl}/calendar/${userId}/feed.ics?token=${data.token}`);
                toast.success(t("Token regenerated"));
            }
        } catch (e) {
            toast.error(t("Error rotating token"));
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        toast.success(t("Copied to clipboard"));
    };

    const handleChangeWorkspaceProfile = async (profileId) => {
        try {
            const userId = librepm.getCurrentUser();
            await librepm.workspaceProfileAssign(userId, profileId);
            setCurrentWsProfileId(profileId);

            // Update workspace modules in AppShell
            const profile = wsProfiles.find(p => p.id === profileId);
            if (profile?.modulesJson && shell?.setWorkspaceModules) {
                const modules = typeof profile.modulesJson === 'string'
                    ? JSON.parse(profile.modulesJson)
                    : profile.modulesJson;
                shell.setWorkspaceModules(modules);
            }

            toast.success(t("Workspace profile updated"));
        } catch (e) {
            console.error("[SettingsPage] Error changing workspace profile:", e);
            toast.error(t("Error") + ": " + e.message);
        }
    };

    const handleBugReport = () => {
        window.librepm?.reportBug?.("settings");
    };

    if (loading) {
        return (
            <div className="d-flex justify-content-center align-items-center py-5">
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">{t("Loading...")}</span>
                </div>
            </div>
        );
    }

    return (
        <div className="settings-page container-fluid py-3" style={{ maxWidth: 800 }}>
            <SuiteAccessPanel user={currentUser} />
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h4 className="mb-0">
                    <i className="bi bi-gear me-2"></i>
                    {t("Settings")}
                </h4>

                <div className="d-flex gap-2">
                    <button
                        className="btn btn-outline-secondary btn-sm"
                        onClick={handleReset}
                        disabled={!canWrite}
                    >
                        <i className="bi bi-arrow-counterclockwise me-1"></i>
                        {t("Restore Defaults")}
                    </button>

                    <button
                        className={`btn btn-sm ${hasChanges ? "btn-success" : "btn-outline-secondary"}`}
                        onClick={handleSave}
                        disabled={!hasChanges || saving || !canWrite}
                    >
                        {saving ? (
                            <span className="spinner-border spinner-border-sm me-1"></span>
                        ) : (
                            <i className="bi bi-check-lg me-1"></i>
                        )}
                        {saving ? t("Saving...") : t("Save Changes")}
                    </button>
                </div>
            </div>

            {/* Aspetto */}
            <div className="card mb-4">
                <div className="card-header">
                    <i className="bi bi-palette me-2"></i>
                    {t("Appearance")}
                </div>
                <div className="card-body">
                    <div className="row mb-3">
                        <label className="col-sm-4 col-form-label">{t("Theme")}</label>
                        <div className="col-sm-8">
                            <select
                                className="form-select"
                                value={settings.theme}
                                onChange={(e) => handleChange("theme", e.target.value)}
                            >
                                <option value="light">{t("Light")}</option>
                                <option value="dark">{t("Dark")}</option>
                            </select>
                        </div>
                    </div>

                    <div className="row">
                        <label className="col-sm-4 col-form-label">{t("Language")}</label>
                        <div className="col-sm-8">
                            <select
                                className="form-select"
                                value={settings.language}
                                onChange={(e) => handleChange("language", e.target.value)}
                            >
                                <option value="it">{t("Italian")}</option>
                                <option value="en">{t("English")}</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Workspace Profile */}
            <div className="card mb-4">
                <div className="card-header">
                    <i className="bi bi-layout-sidebar me-2"></i>
                    {t("Workspace Profile")}
                </div>
                <div className="card-body">
                    <p className="small text-muted mb-3">
                        {t("Choose a workspace profile to customize which modules and navigation items are visible.")}
                    </p>
                    <div className="row g-2">
                        {wsProfiles.map(profile => {
                            const isActive = profile.id === currentWsProfileId;
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
                                <div key={profile.id} className="col-md-6 col-lg-4">
                                    <div
                                        className={`card h-100 cursor-pointer ${isActive ? 'border-primary' : ''}`}
                                        style={{ cursor: 'pointer', transition: 'border-color 0.2s' }}
                                        onClick={() => handleChangeWorkspaceProfile(profile.id)}
                                    >
                                        <div className="card-body p-3">
                                            <div className="d-flex align-items-center mb-2">
                                                <strong className="flex-grow-1">{t(`workspace.${profile.name}`, profile.name)}</strong>
                                                {isActive && (
                                                    <span className="badge bg-primary">
                                                        <i className="bi bi-check-lg"></i>
                                                    </span>
                                                )}
                                            </div>
                                            {profile.description && (
                                                <p className="small text-muted mb-2">{t(`workspace.${profile.name}.desc`, profile.description)}</p>
                                            )}
                                            <div className="d-flex flex-wrap gap-1">
                                                {enabledModules.map(mod => (
                                                    <span key={mod} className="badge bg-secondary-subtle text-secondary" style={{ fontSize: '0.7rem' }}>
                                                        {t(`module.${mod}`, mod)}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Security */}
            <div className="card mb-4">
                <div className="card-header">
                    <i className="bi bi-shield-lock me-2"></i>
                    {t("Security")}
                </div>
                <div className="card-body">
                    <h6 className="mb-3">{t("Change Password")}</h6>
                    <div className="row g-2 mb-3">
                        <div className="col-md-4">
                            <PasswordInput
                                id="sec-old-pw"
                                visibilityKey="sec-old-pw"
                                placeholder={t("Current Password")}
                            />
                        </div>
                        <div className="col-md-4">
                            <PasswordInput
                                id="sec-new-pw"
                                visibilityKey="sec-new-pw"
                                placeholder={t("New Password")}
                            />
                        </div>
                        <div className="col-md-4">
                            <PasswordInput
                                id="sec-confirm-pw"
                                visibilityKey="sec-confirm-pw"
                                placeholder={t("Confirm Password")}
                            />
                        </div>
                    </div>
                    <div className="d-flex gap-2">
                        <button
                            className="btn btn-primary btn-sm"
                            onClick={async () => {
                                const oldPw = document.getElementById('sec-old-pw').value;
                                const newPw = document.getElementById('sec-new-pw').value;
                                const confirmPw = document.getElementById('sec-confirm-pw').value;
                                if (newPw !== confirmPw) { toast.error(t("Passwords do not match")); return; }
                                if (newPw.length < 4) { toast.error(t("Password must be at least 4 characters")); return; }
                                try {
                                    await librepm.usersChangePassword(librepm.getCurrentUser(), oldPw, newPw);
                                    toast.success(t("Password changed"));
                                    document.getElementById('sec-old-pw').value = '';
                                    document.getElementById('sec-new-pw').value = '';
                                    document.getElementById('sec-confirm-pw').value = '';
                                } catch (e) {
                                    toast.error(t("Error") + ": " + e.message);
                                }
                            }}
                        >
                            {t("Change Password")}
                        </button>
                        <button
                            className="btn btn-outline-warning btn-sm"
                            onClick={async () => {
                                const oldPw = document.getElementById('sec-old-pw').value;
                                try {
                                    await librepm.usersRemovePassword(librepm.getCurrentUser(), oldPw);
                                    toast.success(t("Password removed"));
                                    document.getElementById('sec-old-pw').value = '';
                                } catch (e) {
                                    toast.error(t("Error") + ": " + e.message);
                                }
                            }}
                        >
                            {t("Remove Password")}
                        </button>
                    </div>
                </div>
            </div>

            {/* Linked Identities (OIDC/OAuth2 — prepared for future) */}
            <div className="card mb-4">
                <div className="card-header">
                    <i className="bi bi-person-badge me-2"></i>
                    {t("Linked Identities")}
                </div>
                <div className="card-body">
                    <p className="small text-muted mb-3">
                        {t("Connect external accounts to sign in with Google, Microsoft or other providers.")}
                    </p>
                    <div className="d-flex flex-wrap gap-2">
                        {["Google", "Microsoft", "Keycloak"].map((provider) => (
                            <button key={provider} className="btn btn-outline-secondary" disabled
                                    title={t("Available in a future version")}>
                                <i className={`bi bi-${provider === "Google" ? "google" : provider === "Microsoft" ? "microsoft" : "key"} me-1`}></i>
                                {t("Link")} {provider}
                            </button>
                        ))}
                    </div>
                    <small className="text-muted d-block mt-2">
                        <i className="bi bi-info-circle me-1"></i>
                        {t("Available in a future version")}
                    </small>
                </div>
            </div>

            {/* Calendario Esterno (iCal) */}
            <div className="card mb-4">
                <div className="card-header">
                    <i className="bi bi-calendar-check me-2"></i>
                    {t("External Calendar (iCal)")}
                </div>
                <div className="card-body">
                    <p className="small text-muted">
                        {t("Use this link to sync your tasks with Google Calendar, Outlook or Apple Calendar.")}
                    </p>
                    <div className="input-group mb-3">
                        <input 
                            type="text" 
                            className="form-control" 
                            value={icalUrl} 
                            readOnly 
                            onClick={(e) => e.target.select()}
                        />
                        <button className="btn btn-outline-secondary" onClick={() => copyToClipboard(icalUrl)}>
                            <i className="bi bi-clipboard"></i> {t("Copy")}
                        </button>
                    </div>
                    <button className="btn btn-sm btn-outline-danger" onClick={handleRotateCalendarToken}>
                        <i className="bi bi-arrow-repeat me-1"></i> {t("Regenerate Token")}
                    </button>
                </div>
            </div>

            {/* Database Esterno (Placeholder UI) */}
            <div className="card mb-4">
                <div className="card-header">
                    <i className="bi bi-database me-2"></i>
                    {t("External Database")}
                </div>
                <div className="card-body">
                    <div className="alert alert-info small">
                        <i className="bi bi-info-circle me-2"></i>
                        {t("You are currently using the local SQLite database.")}
                    </div>
                    <div className="row g-3">
                        <div className="col-md-6">
                            <label className="form-label">{t("Database Type")}</label>
                            <select className="form-select" disabled>
                                <option>{t("SQLite (Local)")}</option>
                                <option>{t("PostgreSQL (Coming Soon)")}</option>
                                <option>{t("MySQL (Coming Soon)")}</option>
                            </select>
                        </div>
                        <div className="col-md-6">
                            <label className="form-label">{t("Host")}</label>
                            <input type="text" className="form-control" placeholder="localhost" disabled />
                        </div>
                        <div className="col-12">
                            <button className="btn btn-primary btn-sm" disabled>
                                {t("Connect to External DB")}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Backup */}
            <div className="card mb-4">
                <div className="card-header">
                    <i className="bi bi-cloud-download me-2"></i>
                    {t("Backup and Synchronization")}
                </div>
                <div className="card-body">
                    <div className="form-check form-switch mb-3">
                        <input
                            className="form-check-input"
                            type="checkbox"
                            id="autoBackupEnabled"
                            checked={settings.autoBackupEnabled}
                            onChange={(e) => handleChange("autoBackupEnabled", e.target.checked)}
                        />
                        <label className="form-check-label" htmlFor="autoBackupEnabled">
                            {t("Automatic Backup")}
                        </label>
                    </div>

                    <div className="d-flex gap-2 flex-wrap">
                        <button className="btn btn-outline-primary" onClick={handleExportDb}>
                            <i className="bi bi-box-arrow-up me-2"></i>
                            {t("Export Database (.db)")}
                        </button>

                        <button className="btn btn-outline-danger" onClick={handleImportDb}>
                            <i className="bi bi-box-arrow-in-down me-2"></i>
                            {t("Import Database (.db)")}
                        </button>
                    </div>

                    <hr />
                    <h6 className="mb-3"><i className="bi bi-shield-lock me-2"></i>{t("Encrypted Export")}</h6>
                    <div className="row g-2 align-items-end">
                        <div className="col-auto">
                            <PasswordInput
                                id="encryptPassphrase"
                                visibilityKey="encrypt-passphrase"
                                placeholder={t("Passphrase")}
                                width={220}
                            />
                        </div>
                        <div className="col-auto">
                            <button className="btn btn-outline-warning btn-sm" onClick={async () => {
                                const passphrase = document.getElementById("encryptPassphrase").value;
                                if (!passphrase || passphrase.length < 4) {
                                    toast.error(t("Passphrase must be at least 4 characters"));
                                    return;
                                }
                                try {
                                    const result = await librepm.dbExportEncrypted(passphrase);
                                    const blob = new Blob([JSON.stringify(result)], { type: "application/json" });
                                    const a = document.createElement("a");
                                    a.href = URL.createObjectURL(blob);
                                    a.download = `librepm-encrypted-${new Date().toISOString().split("T")[0]}.enc.json`;
                                    a.click();
                                    URL.revokeObjectURL(a.href);
                                    toast.success(t("Encrypted export completed"));
                                } catch (e) {
                                    toast.error(t("Export error") + ": " + e.message);
                                }
                            }}>
                                <i className="bi bi-lock me-1"></i>
                                {t("Export Encrypted")}
                            </button>
                        </div>
                    </div>
                    <small className="text-muted d-block mt-1">
                        {t("The export will be encrypted with AES-256-GCM. Keep the passphrase safe.")}
                    </small>
                </div>
            </div>

            {/* Notification Preferences */}
            <div className="card mb-4">
                <div className="card-header">
                    <i className="bi bi-bell me-2"></i>
                    {t("Notification Preferences")}
                </div>
                <div className="card-body">
                    <NotificationPreferencesPanel />
                </div>
            </div>

            {/* Diagnostics */}
            <div className="card mb-4">
                <div className="card-header">
                    <i className="bi bi-clipboard2-pulse me-2"></i>
                    {t("Diagnostics")}
                </div>
                <div className="card-body">
                    <p className="card-text small text-muted">
                        {t("Generate a diagnostic bundle for troubleshooting. This package does NOT contain personal data or project contents.")}
                    </p>
                    <button className="btn btn-outline-info" onClick={async () => {
                        try {
                            const blob = await librepm.diagnosticsGenerate();
                            const a = document.createElement("a");
                            a.href = URL.createObjectURL(blob);
                            a.download = `librepm-diagnostics-${new Date().toISOString().split("T")[0]}.zip`;
                            a.click();
                            URL.revokeObjectURL(a.href);
                            toast.success(t("Diagnostics bundle generated"));
                        } catch (e) {
                            toast.error(t("Error") + ": " + e.message);
                        }
                    }}>
                        <i className="bi bi-download me-2"></i>
                        {t("Generate Diagnostics Bundle")}
                    </button>
                </div>
            </div>

            {/* Bug Report */}
            <div className="card mb-4">
                <div className="card-header">
                    <i className="bi bi-bug me-2"></i>
                    {t("Bug Report")}
                </div>
                <div className="card-body">
                    <p className="card-text small text-muted">
                        {t("Found a bug? Help us improve LibrePM by reporting it!")}
                    </p>
                    <button className="btn btn-warning" onClick={handleBugReport}>
                        <i className="bi bi-envelope me-2"></i>
                        {t("Report a Bug")}
                    </button>
                </div>
            </div>

            {/* Info */}
            <div className="card mb-4">
                <div className="card-header d-flex align-items-center justify-content-between gap-2">
                    <div>
                        <i className="bi bi-info-circle me-2"></i>
                        {t("Information")}
                    </div>
                    <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
                        v{__APP_VERSION__}
                    </span>
                </div>
                <div className="card-body">
                    <div className="d-grid gap-2">
                        <div className="d-flex justify-content-between gap-3">
                            <span className="text-muted">{t("Version")}</span>
                            <span className="fw-semibold text-end">LibrePM v{__APP_VERSION__}</span>
                        </div>
                        <div className="d-flex justify-content-between gap-3">
                            <span className="text-muted">{t("Copyright")}</span>
                            <span className="text-end">© Lorenzo DM 2026</span>
                        </div>
                        <div className="d-flex justify-content-between gap-3">
                            <span className="text-muted">{t("License")}</span>
                            <span className="text-end">AGPLv3</span>
                        </div>
                        <div className="d-flex justify-content-between gap-3">
                            <span className="text-muted">{t("Website")}</span>
                            <a className="text-end" href="https://www.lorenzodm.it" target="_blank" rel="noopener noreferrer">
                                https://www.lorenzodm.it
                            </a>
                        </div>
                        <div className="d-flex justify-content-between gap-3">
                            <span className="text-muted">{t("Support")}</span>
                            <span className="text-end">{t("If you like LibrePM, please consider supporting its development!")}</span>
                        </div>
                        <div className="d-flex justify-content-between gap-3">
                            <span className="text-muted">{t("Platform")}</span>
                            <span className="text-end">{librepm.isElectron() ? t("Desktop (Electron)") : t("Web")}</span>
                        </div>
                        <a
                            className="btn btn-outline-primary btn-sm align-self-start mt-2"
                            href={DONATION_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <i className="bi bi-heart me-1"></i>
                            {t("Donations")}
                        </a>
                    </div>
                </div>
            </div>

            {/* Your Data / Privacy */}
            <div className="card">
                <div className="card-header">
                    <h6 className="mb-0"><i className="bi bi-shield-lock me-2"></i>{t("Your Data")}</h6>
                </div>
                <div className="card-body">
                    <p className="text-muted small mb-3">{t("Manage your personal data and privacy preferences.")}</p>
                    <div className="d-flex gap-2 flex-wrap">
                        <button className="btn btn-outline-primary btn-sm"
                            onClick={async () => {
                                try {
                                    await librepm.complianceDsrCreate({ userId: currentUser?.id, requestType: 'EXPORT', description: 'User data export request' });
                                    toast.success(t("Data export requested"));
                                } catch (e) { toast.error(t("Error") + ': ' + e.message); }
                            }}>
                            <i className="bi bi-download me-1"></i>{t("Export My Data")}
                        </button>
                        <button className="btn btn-outline-warning btn-sm"
                            onClick={async () => {
                                if (!window.confirm(t("Are you sure you want to request data deletion? This action cannot be undone."))) return;
                                try {
                                    await librepm.complianceDsrCreate({ userId: currentUser?.id, requestType: 'DELETE', description: 'User data deletion request' });
                                    toast.success(t("Deletion request submitted"));
                                } catch (e) { toast.error(t("Error") + ': ' + e.message); }
                            }}>
                            <i className="bi bi-trash me-1"></i>{t("Request Data Deletion")}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
