/**
 * LibrePM API Client v0.1.0
 *
 * This module handles all communication with the Java backend.
 * It works in both Electron (desktop) and browser (web) modes.
 *
 * Features:
 * - Auto-discovery of backend port
 * - Centralized error handling
 * - Support for all v0.2.0 APIs (tags, markdown notes, reminders, assets)
 * - Fallback to Electron IPC for desktop-specific functions
 * - API paths aligned with RESTful backend (/api/users/{userId}/...)
 * - Bootstrap API for onboarding (v0.3.0)
 * - Local preference management (v0.3.0)
 * - Focus Timer API (v0.4.1)
 * - Checklist API (v0.4.3)
 * - Notes API (v0.7.1 - Refactored)
 * - Team API (v0.5.0)
 * - Analytics API (v0.5.0)
 * - Connections API (v0.6.0)
 * - Resource API (v0.6.0)
 * - Notifications API (v0.7.0)
 * - Project Charter & Executive Dashboard API (v0.8.0)
 * - Project Templates API (v0.1.0)
 * - Calendar Integrations API (v0.1.0)
 *
 * @module librepm
 * @author Lorenzo DM
 * @since 0.2.0
 * @updated 0.10.0 - Added Calendar/ICS API
 */

// ========================================
// Configuration
// ========================================

let API_BASE_URL = null;
let CURRENT_USER_ID = null;
let CURRENT_PROJECT_ID = null;

// Default port if config file cannot be read
const DEFAULT_PORT = 8080;

// Keys for localStorage (client-side preferences)
const STORAGE_KEY_AUTOLOGIN = 'librepm_autologin_enabled';
const STORAGE_KEY_LAST_USER = 'librepm_last_user_id';
const STORAGE_KEY_LANGUAGE = 'librepm_language';

/**
 * URL del backend nel profilo web, fissato in fase di build.
 * Su Vercel vale per esempio https://<servizio>.a.run.app/api
 */
const CONFIGURED_BASE_URL = import.meta.env?.VITE_API_BASE_URL || null;

/**
 * True quando si gira dentro Electron: il ponte `window.librepm` esiste solo là.
 * Sul web cercare il backend su localhost non ha senso.
 * @returns {boolean}
 */
function isDesktopRuntime() {
    return typeof window !== 'undefined' && !!window.librepm;
}

/**
 * Fornitore del token di sessione, registrato dal guscio web (Clerk).
 * Resta nullo nel desktop, dove non c'è nessun identity provider.
 */
let tokenProvider = null;

/**
 * Registra la funzione che restituisce il token di sessione corrente.
 *
 * Va chiamata dal guscio web prima di qualunque richiesta. Il token si richiede
 * a ogni chiamata e non si conserva: Clerk lo ruota, e una copia tenuta da parte
 * scadrebbe senza che il client se ne accorga.
 *
 * @param {null | (() => Promise<string|null>)} provider
 */
function setTokenProvider(provider) {
    tokenProvider = provider;
}

/**
 * @returns {Promise<string|null>} il token corrente, null nel desktop.
 */
async function currentToken() {
    if (!tokenProvider) return null;
    try {
        return await tokenProvider();
    } catch (e) {
        console.warn('[LibrePM API] Token di sessione non disponibile:', e);
        return null;
    }
}

/**
 * Aggiunge l'intestazione Authorization se c'è un token da mandare.
 * @param {Object} headers
 * @returns {Promise<Object>}
 */
async function withAuthorization(headers) {
    const token = await currentToken();
    if (!token) return headers;
    return { ...headers, Authorization: `Bearer ${token}` };
}

/**
 * Initializes the API client.
 * Reads the port from the config file or uses the default.
 * @returns {Promise<string>} The base API URL.
 */
async function initializeApi() {
    if (API_BASE_URL) return API_BASE_URL;

    // Profilo web: l'indirizzo è deciso in fase di build e non si cerca nulla.
    if (CONFIGURED_BASE_URL) {
        API_BASE_URL = CONFIGURED_BASE_URL.replace(/\/+$/, '');
        console.log('[LibrePM API] Backend configurato:', API_BASE_URL);
        return API_BASE_URL;
    }

    // Sul web senza VITE_API_BASE_URL si fallisce subito e a voce alta. Il
    // ripiego su localhost esiste per il desktop; in un browser produrrebbe una
    // sfilza di errori di rete oscuri, oppure — peggio — la connessione al
    // backend di sviluppo di chi sta guardando la pagina.
    if (!isDesktopRuntime()) {
        throw new Error(
            '[LibrePM API] VITE_API_BASE_URL non impostata: la build web non sa '
            + 'a quale backend parlare.'
        );
    }

    try {
        // In Electron, try reading port from config file via IPC
        if (window.librepm && window.librepm.getBackendPort) {
            const port = await window.librepm.getBackendPort();
            if (port) {
                API_BASE_URL = `http://localhost:${port}/api`;
                console.log('[LibrePM API] Backend su porta:', port);
                return API_BASE_URL;
            }
        }
    } catch (e) {
        console.warn('[LibrePM API] Impossibile leggere porta da config:', e);
    }

    // Try common ports
    const portsToTry = [8080, 45499, 3000];
    for (const port of portsToTry) {
        try {
            const testUrl = `http://localhost:${port}/api/health`;
            const response = await fetch(testUrl, { method: 'GET', signal: AbortSignal.timeout(2000) });
            if (response.ok) {
                API_BASE_URL = `http://localhost:${port}/api`;
                console.log('[LibrePM API] Backend trovato su porta:', port);
                return API_BASE_URL;
            }
        } catch (e) {
            // Ignore, try next port
        }
    }

    // Fallback
    API_BASE_URL = `http://localhost:${DEFAULT_PORT}/api`;
    console.log('[LibrePM API] Usando porta default:', DEFAULT_PORT);
    return API_BASE_URL;
}

/**
 * Gets the base API URL (initializes if necessary).
 * @returns {Promise<string>} The base API URL.
 */
async function getApiUrl() {
    if (!API_BASE_URL) {
        await initializeApi();
    }
    return API_BASE_URL;
}

/**
 * Helper: constructs the base path for the current user.
 * @throws {Error} If CURRENT_USER_ID is not set.
 * @returns {string} The user base path (e.g., /users/123).
 */
function getUserBasePath() {
    if (!CURRENT_USER_ID) {
        throw new Error('[LibrePM API] Utente non impostato. Chiamare setCurrentUser() o bootstrap.selectProfile() prima.');
    }
    return `/users/${CURRENT_USER_ID}`;
}

/**
 * Helper: checks if a user is set (without throwing).
 * @returns {boolean} True if a user is set.
 */
function hasCurrentUser() {
    return CURRENT_USER_ID !== null && CURRENT_USER_ID !== undefined;
}

// ========================================
// HTTP Helpers
// ========================================

/**
 * Performs an HTTP request to the backend.
 * @param {string} endpoint - The API endpoint (e.g., /users).
 * @param {Object} options - Fetch options (method, body, headers).
 * @returns {Promise<any>} The JSON response or null.
 * @throws {ApiError} If the request fails.
 */
async function apiRequest(endpoint, options = {}) {
    const baseUrl = await getApiUrl();
    const url = `${baseUrl}${endpoint}`;

    const defaultHeaders = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    };

    // Add header to identify user (for controllers using @CurrentUser)
    if (CURRENT_USER_ID) {
        defaultHeaders['X-User-Id'] = CURRENT_USER_ID;
    }

    const config = {
        ...options,
        headers: await withAuthorization({
            ...defaultHeaders,
            ...options.headers,
        }),
    };

    if (options.body && typeof options.body === 'object') {
        config.body = JSON.stringify(options.body);
    }

    try {
        const response = await fetch(url, config);

        // Handle HTTP errors
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new ApiError(
                errorData.message || `HTTP ${response.status}: ${response.statusText}`,
                response.status,
                errorData
            );
        }

        // If response is empty (204 No Content)
        if (response.status === 204) {
            return null;
        }

        // Handle empty responses with status 200
        const text = await response.text();
        if (!text) {
            return null;
        }

        try {
            return JSON.parse(text);
        } catch (e) {
            // If not valid JSON but not empty, might be an error or plain text
            console.warn('[LibrePM API] Risposta non JSON:', text);
            return text;
        }
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }

        // Network error
        console.error('[LibrePM API] Errore di rete:', error);
        throw new ApiError(
            'Impossibile contattare il server. Verifica che il backend sia avviato.',
            0,
            { originalError: error.message }
        );
    }
}

/**
 * Custom Error class for API errors.
 */
class ApiError extends Error {
    constructor(message, status, data) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.data = data;
    }
}

// ========================================
// Local Preferences Helper
// ========================================

/**
 * Saves a preference to localStorage (fallback for web).
 * In Electron, uses electron-store if available.
 * @param {string} key - The preference key.
 * @param {any} value - The value to save.
 */
function saveLocalPreference(key, value) {
    try {
        if (window.librepm?.setPreference) {
            window.librepm.setPreference(key, value);
        } else {
            localStorage.setItem(key, JSON.stringify(value));
        }
    } catch (e) {
        console.warn('[LibrePM API] Errore salvataggio preferenza:', e);
    }
}

/**
 * Reads a preference from localStorage (fallback for web).
 * @param {string} key - The preference key.
 * @param {any} defaultValue - Default value if not found.
 * @returns {any} The preference value.
 */
function loadLocalPreference(key, defaultValue = null) {
    try {
        if (window.librepm?.getPreference) {
            return window.librepm.getPreference(key) ?? defaultValue;
        }
        const stored = localStorage.getItem(key);
        // Fix: Handle non-JSON strings (like "it") gracefully
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch (e) {
                // If parsing fails, return the raw string (e.g. "it")
                return stored;
            }
        }
        return defaultValue;
    } catch (e) {
        console.warn('[LibrePM API] Errore lettura preferenza:', e);
        return defaultValue;
    }
}

// ========================================
// API Export - Main Object
// ========================================

export const librepm = {
    // ========================================
    // Logging (to console and/or Electron main process)
    // ========================================
    log: (...args) => {
        console.log('[LibrePM]', ...args);
        if (window.librepm?.log) window.librepm.log(...args);
    },
    warn: (...args) => {
        console.warn('[LibrePM]', ...args);
        if (window.librepm?.warn) window.librepm.warn(...args);
    },
    error: (...args) => {
        console.error('[LibrePM]', ...args);
        if (window.librepm?.error) window.librepm.error(...args);
    },

    // ========================================
    // Initialization and Auth
    // ========================================

    /**
     * Initializes the API client.
     */
    init: async () => {
        await initializeApi();
        return { baseUrl: API_BASE_URL };
    },
    
    getApiUrl: () => API_BASE_URL, // Expose helper directly for getting URL synchronously (if initialized)

    /**
     * Registra il fornitore del token di sessione (solo profilo web).
     * Vedi setTokenProvider.
     */
    setTokenProvider,

    /**
     * Chi sono io, secondo il backend.
     *
     * Sostituisce la sequenza di bootstrap nel profilo web, dove
     * `/api/bootstrap/**` è negato: l'utente non lo si sceglie da un elenco, lo
     * dichiara il token Clerk. Restituisce anche i ruoli applicativi, che
     * servono al menù per non mostrare sezioni che il backend rifiuterebbe.
     *
     * @returns {Promise<{id: string, username: string, displayName: string,
     *   email: string, workspaceProfileId: string, roles: string[]}>}
     */
    me: () => apiRequest('/me'),

    /**
     * Sets the current user ID.
     * @param {string} userId - The user ID.
     */
    setCurrentUser: (userId) => {
        CURRENT_USER_ID = userId;
        console.log('[LibrePM API] Utente corrente impostato:', userId);
    },

    /**
     * Sets the current project ID.
     * @param {string} projectId - The project ID.
     */
    setCurrentProject: (projectId) => {
        CURRENT_PROJECT_ID = projectId;
    },

    /**
     * Gets the current user ID.
     * @returns {string|null} The user ID.
     */
    getCurrentUser: () => CURRENT_USER_ID,

    /**
     * Gets the current project ID.
     * @returns {string|null} The project ID.
     */
    getCurrentProject: () => CURRENT_PROJECT_ID,

    /**
     * Checks if a user is set.
     * @returns {boolean} True if set.
     */
    hasCurrentUser: () => hasCurrentUser(),

    // ========================================
    // Bootstrap API (v0.3.0)
    // Endpoint: /api/bootstrap
    // ========================================

    /**
     * Gets bootstrap data (users, preferences, system info).
     * ALWAYS call this at application startup.
     */
    bootstrapGet: () => apiRequest('/bootstrap'),

    /**
     * Creates a new local profile (no password).
     * @param {Object} data - { username, displayName, email?, avatarPath?, password? }
     */
    bootstrapCreateProfile: (data) => apiRequest('/bootstrap/profiles', {
        method: 'POST',
        body: data,
    }),

    /**
     * Selects a profile as active (updates lastLoginAt).
     * Automatically sets CURRENT_USER_ID.
     * @param {string} userId - ID of the profile to select.
     */
    bootstrapSelectProfile: async (userId) => {
        const user = await apiRequest(`/bootstrap/select/${userId}`, {
            method: 'POST',
        });
        CURRENT_USER_ID = user.id;
        // Save locally for autologin
        saveLocalPreference(STORAGE_KEY_LAST_USER, userId);
        console.log('[LibrePM API] Profilo selezionato:', user.displayName || user.username);
        return user;
    },

    /**
     * Authenticates a user with password and selects the profile.
     * @param {string} userId - The user ID.
     * @param {string} password - The password.
     */
    bootstrapLogin: async (userId, password) => {
        const user = await apiRequest('/bootstrap/login', {
            method: 'POST',
            body: { userId, password },
        });
        CURRENT_USER_ID = user.id;
        // Save locally for autologin
        saveLocalPreference(STORAGE_KEY_LAST_USER, userId);
        console.log('[LibrePM API] Login riuscito:', user.displayName || user.username);
        return user;
    },

    /**
     * Deletes (deactivates) a local profile.
     * @param {string} userId - ID of the profile to delete.
     */
    bootstrapDeleteProfile: (userId) => apiRequest(`/bootstrap/profiles/${userId}`, {
        method: 'DELETE',
    }),

    /**
     * Gets global preferences from backend.
     */
    bootstrapGetPreferences: () => apiRequest('/bootstrap/preferences'),

    /**
     * Updates global preferences.
     * @param {Object} data - { lastUserId?, autologinEnabled? }
     */
    bootstrapUpdatePreferences: (data) => apiRequest('/bootstrap/preferences', {
        method: 'PUT',
        body: data,
    }),

    /**
     * Validates if a userId is valid for autologin.
     * @param {string} userId - ID to validate.
     */
    bootstrapValidateUser: (userId) => apiRequest(`/bootstrap/validate/${userId}`),

    /**
     * Gets local preferences (localStorage/electron-store).
     * Useful for quick bootstrap before backend is ready.
     */
    getLocalPreferences: () => ({
        autologinEnabled: loadLocalPreference(STORAGE_KEY_AUTOLOGIN, false),
        lastUserId: loadLocalPreference(STORAGE_KEY_LAST_USER, null),
        language: loadLocalPreference(STORAGE_KEY_LANGUAGE, 'it'),
    }),

    /**
     * Saves local preferences.
     * @param {Object} prefs - { autologinEnabled?, lastUserId?, language? }
     */
    setLocalPreferences: (prefs) => {
        if (prefs.autologinEnabled !== undefined) {
            saveLocalPreference(STORAGE_KEY_AUTOLOGIN, prefs.autologinEnabled);
        }
        if (prefs.lastUserId !== undefined) {
            saveLocalPreference(STORAGE_KEY_LAST_USER, prefs.lastUserId);
        }
        if (prefs.language !== undefined) {
            saveLocalPreference(STORAGE_KEY_LANGUAGE, prefs.language);
        }
    },

    // ========================================
    // Health Check
    // ========================================

    /**
     * Checks if the backend is active.
     */
    healthCheck: async () => {
        try {
            const result = await apiRequest('/health');
            return { ok: true, ...result };
        } catch (e) {
            return { ok: false, error: e.message };
        }
    },

    // ========================================
    // Users API
    // Endpoint: /api/users (does not require userId in path)
    // ========================================

    /**
     * Gets all users.
     */
    usersList: (onlyActive = true) => apiRequest(`/users?onlyActive=${onlyActive}`),

    /**
     * Searches users by name, username, or email.
     */
    usersSearch: (query) => apiRequest(`/users/search?q=${encodeURIComponent(query)}`),

    /**
     * Gets a specific user.
     */
    usersGet: (userId) => apiRequest(`/users/${userId}`),

    /**
     * Creates a new user.
     */
    usersCreate: (data) => apiRequest('/users', {
        method: 'POST',
        body: data,
    }),

    /**
     * Updates a user.
     */
    usersUpdate: (userId, data) => apiRequest(`/users/${userId}`, {
        method: 'PUT',
        body: data,
    }),

    /**
     * Changes user password.
     */
    usersChangePassword: (userId, oldPassword, newPassword) => apiRequest(`/users/${userId}/change-password`, {
        method: 'PUT',
        body: { oldPassword, newPassword },
    }),

    /**
     * Resets user password after local username confirmation.
     */
    usersResetPassword: (userId, usernameConfirmation, newPassword) => apiRequest(`/users/${userId}/reset-password`, {
        method: 'PUT',
        body: { usernameConfirmation, newPassword },
    }),

    /**
     * Removes user password (no-password mode).
     */
    usersRemovePassword: (userId, currentPassword) => apiRequest(`/users/${userId}/remove-password`, {
        method: 'PUT',
        body: { currentPassword },
    }),

    /**
     * Lists remote identities for a user (OIDC/OAuth2 bindings).
     */
    remoteIdentitiesList: (userId) => apiRequest(`/users/${userId}/identities`),

    /**
     * Unbinds a remote identity.
     */
    remoteIdentitiesUnbind: (userId, identityId) => apiRequest(`/users/${userId}/identities/${identityId}`, {
        method: 'DELETE',
    }),

    /**
     * Sets user active/inactive.
     */
    usersSetActive: (userId, active) => apiRequest(`/users/${userId}/active?active=${active}`, {
        method: 'PATCH',
    }),

    // ========================================
    // Connections API (v0.6.0)
    // Endpoint: /api/connections (userId from header)
    // ========================================

    /**
     * Gets the list of friends (Contacts).
     */
    connectionsList: () => {
        return apiRequest(`/connections`);
    },

    /**
     * Searches among friends.
     */
    connectionsSearch: (query) => {
        return apiRequest(`/connections/search?q=${encodeURIComponent(query)}`);
    },

    /**
     * Sends a connection request.
     */
    connectionsRequest: (targetId) => {
        return apiRequest(`/connections/request/${targetId}`, { method: 'POST' });
    },

    /**
     * Accepts a connection request.
     */
    connectionsAccept: (connectionId) => {
        return apiRequest(`/connections/${connectionId}/accept`, { method: 'POST' });
    },

    /**
     * Rejects a connection request.
     */
    connectionsReject: (connectionId) => {
        return apiRequest(`/connections/${connectionId}/reject`, { method: 'DELETE' });
    },

    /**
     * Removes a connection.
     */
    connectionsRemove: (targetId) => {
        return apiRequest(`/connections/remove/${targetId}`, { method: 'DELETE' });
    },

    /**
     * Lists all ghost (virtual) users created by the current user.
     */
    ghostsList: () => {
        return apiRequest(`/connections/ghosts`);
    },

    /**
     * Creates a global ghost user (not tied to any project).
     */
    ghostsCreate: (username, displayName) => {
        return apiRequest(`/connections/ghosts`, {
            method: 'POST',
            body: { username, displayName },
        });
    },

    /**
     * Updates a ghost user's name/username.
     */
    ghostsUpdate: (ghostId, { username, displayName }) => {
        return apiRequest(`/connections/ghosts/${ghostId}`, {
            method: 'PUT',
            body: { username, displayName },
        });
    },

    /**
     * Deletes (soft-delete) a ghost user.
     */
    ghostsDelete: (ghostId) => {
        return apiRequest(`/connections/ghosts/${ghostId}`, {
            method: 'DELETE',
        });
    },

    /**
     * Gets incoming pending requests.
     */
    connectionsPendingIncoming: () => {
        return apiRequest(`/connections/pending/incoming`);
    },

    /**
     * Gets outgoing pending requests.
     */
    connectionsPendingOutgoing: () => {
        return apiRequest(`/connections/pending/outgoing`);
    },

    // ========================================
    // Projects API
    // Endpoint: /api/users/{userId}/projects
    // ========================================

    /**
     * Gets all projects for the current user.
     */
    projectsList: (options = {}) => {
        const basePath = getUserBasePath();
        const params = new URLSearchParams();
        if (options.archived !== undefined) params.append('archived', options.archived.toString());
        if (options.favorite !== undefined) params.append('favorite', options.favorite.toString());
        if (options.search) params.append('search', options.search);

        const queryString = params.toString();
        return apiRequest(`${basePath}/projects${queryString ? '?' + queryString : ''}`);
    },

    /**
     * Gets a specific project.
     */
    projectsGet: (projectId) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/projects/${projectId}`);
    },

    /**
     * Creates a new project.
     */
    projectsCreate: (name, description = '', color = null, icon = null) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/projects`, {
            method: 'POST',
            body: { name, description, color, icon },
        });
    },

    /**
     * Updates a project.
     */
    projectsUpdate: (projectId, data) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/projects/${projectId}`, {
            method: 'PUT',
            body: data,
        });
    },

    /**
     * Archives/Unarchives a project.
     */
    projectsSetArchived: (projectId, archived) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/projects/${projectId}/archived?archived=${archived}`, {
            method: 'PATCH',
        });
    },

    /**
     * Deletes a project (soft delete via archived).
     */
    projectsDelete: (projectId) => {
        // For now, we use archived=true as soft delete
        return librepm.projectsSetArchived(projectId, true);
    },

    // ========================================
    // Project Templates API (v0.1.0)
    // Endpoint: /api/templates
    // ========================================

    /**
     * Gets all available templates.
     */
    templatesList: () => {
        return apiRequest('/templates');
    },

    /**
     * Gets a specific template.
     */
    templatesGet: (templateId) => {
        return apiRequest(`/templates/${templateId}`);
    },

    /**
     * Instantiates a new project from a template.
     * @param {string} templateId - The ID of the template.
     * @param {Object} data - { name, description, ... }
     */
    templatesInstantiate: (templateId, data) => {
        const basePath = getUserBasePath(); 
        return apiRequest(`${basePath}/projects/from-template/${templateId}`, {
            method: 'POST',
            body: data,
        });
    },

    // ========================================
    // Project Charter & Executive Dashboard API (v0.8.0)
    // Endpoint: /api/users/{userId}/projects/{projectId}/...
    // ========================================

    /**
     * Gets the Project Charter data.
     */
    projectCharterGet: (projectId) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/projects/${projectId}/charter`);
    },

    /**
     * Updates (upsert) the Project Charter data.
     */
    projectCharterUpdate: (projectId, data) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/projects/${projectId}/charter`, {
            method: 'PUT',
            body: data,
        });
    },

    /**
     * Gets Key Deliverables for a project.
     */
    projectDeliverablesList: (projectId) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/projects/${projectId}/deliverables`);
    },

    /**
     * Creates a new Key Deliverable.
     */
    projectDeliverablesCreate: (projectId, data) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/projects/${projectId}/deliverables`, {
            method: 'POST',
            body: data,
        });
    },

    /**
     * Updates a Key Deliverable.
     */
    projectDeliverablesUpdate: (projectId, deliverableId, data) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/projects/${projectId}/deliverables/${deliverableId}`, {
            method: 'PUT',
            body: data,
        });
    },

    /**
     * Deletes a Key Deliverable.
     */
    projectDeliverablesDelete: (projectId, deliverableId) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/projects/${projectId}/deliverables/${deliverableId}`, {
            method: 'DELETE',
        });
    },

    /**
     * Gets Project Risks.
     */
    projectRisksList: (projectId) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/projects/${projectId}/risks`);
    },

    /**
     * Creates a new Project Risk.
     */
    projectRisksCreate: (projectId, data) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/projects/${projectId}/risks`, {
            method: 'POST',
            body: data,
        });
    },

    /**
     * Updates a Project Risk.
     */
    projectRisksUpdate: (projectId, riskId, data) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/projects/${projectId}/risks/${riskId}`, {
            method: 'PUT',
            body: data,
        });
    },

    /**
     * Deletes a Project Risk.
     */
    projectRisksDelete: (projectId, riskId) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/projects/${projectId}/risks/${riskId}`, {
            method: 'DELETE',
        });
    },

    // ========================================
    // OKR API (v0.8.0)
    // Endpoint: /api/users/{userId}/projects/{projectId}/okrs
    // ========================================

    /**
     * Lists all OKRs for a project.
     */
    okrsList: (projectId) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/projects/${projectId}/okrs`);
    },

    /**
     * Creates a new OKR.
     */
    okrsCreate: (projectId, data) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/projects/${projectId}/okrs`, {
            method: 'POST',
            body: data,
        });
    },

    /**
     * Deletes an OKR.
     */
    okrsDelete: (projectId, okrId) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/projects/${projectId}/okrs/${okrId}`, {
            method: 'DELETE',
        });
    },

    /**
     * Adds a key result to an OKR.
     */
    okrsAddKeyResult: (projectId, okrId, data) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/projects/${projectId}/okrs/${okrId}/key-results`, {
            method: 'POST',
            body: data,
        });
    },

    /**
     * Updates a key result.
     */
    okrsUpdateKeyResult: (projectId, okrId, metricId, data) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/projects/${projectId}/okrs/${okrId}/key-results/${metricId}`, {
            method: 'PUT',
            body: data,
        });
    },

    /**
     * Deletes a key result.
     */
    okrsDeleteKeyResult: (projectId, okrId, metricId) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/projects/${projectId}/okrs/${okrId}/key-results/${metricId}`, {
            method: 'DELETE',
        });
    },

    /**
     * Records an achievement for a key result.
     */
    okrsRecordAchievement: (projectId, okrId, metricId, data) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/projects/${projectId}/okrs/${okrId}/key-results/${metricId}/achievements`, {
            method: 'POST',
            body: data,
        });
    },

    // ========================================
    // Baseline API (v0.8.0)
    // Endpoint: /api/users/{userId}/projects/{projectId}/baselines
    // ========================================

    /**
     * Lists all baselines for a project.
     */
    baselinesList: (projectId) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/projects/${projectId}/baselines`);
    },

    /**
     * Creates a new baseline (snapshot of current task state).
     */
    baselinesCreate: (projectId, data) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/projects/${projectId}/baselines`, {
            method: 'POST',
            body: data,
        });
    },

    /**
     * Deletes a baseline.
     */
    baselinesDelete: (projectId, baselineId) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/projects/${projectId}/baselines/${baselineId}`, {
            method: 'DELETE',
        });
    },

    /**
     * Gets variance analysis for a specific baseline.
     */
    baselinesVariance: (projectId, baselineId) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/projects/${projectId}/baselines/${baselineId}/variance`);
    },

    /**
     * Gets variance analysis from the latest baseline.
     */
    baselinesLatestVariance: (projectId) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/projects/${projectId}/baselines/latest/variance`);
    },

    // ========================================
    // Executive Dashboard API (v0.8.0)
    // Endpoint: /api/users/{userId}/projects/{projectId}/dashboard
    // ========================================

    /**
     * Gets the aggregated executive dashboard data.
     */
    executiveDashboard: (projectId) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/projects/${projectId}/dashboard`);
    },

    // ========================================
    // Tasks API
    // Endpoint: /api/users/{userId}/projects/{projectId}/tasks
    // ========================================

    /**
     * Gets all tasks for a project.
     */
    tasksList: (projectId, options = {}) => {
        const basePath = getUserBasePath();
        const params = new URLSearchParams();
        if (options.status) params.append('status', options.status);
        if (options.priority) params.append('priority', options.priority);
        if (options.search) params.append('search', options.search);
        if (options.includeArchived) params.append('includeArchived', 'true');

        const queryString = params.toString();
        return apiRequest(`${basePath}/projects/${projectId}/tasks${queryString ? '?' + queryString : ''}`);
    },

    /**
     * Gets a specific task.
     */
    tasksGet: (projectId, taskId) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/projects/${projectId}/tasks/${taskId}`);
    },

    /**
     * Creates a new task.
     */
    tasksCreate: (projectId, data) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/projects/${projectId}/tasks`, {
            method: 'POST',
            body: data,
        });
    },

    /**
     * Updates a task.
     */
    tasksUpdate: (projectId, taskId, data) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/projects/${projectId}/tasks/${taskId}`, {
            method: 'PUT',
            body: data,
        });
    },

    /**
     * Updates only the status of a task.
     */
    tasksUpdateStatus: (projectId, taskId, statusId) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/projects/${projectId}/tasks/${taskId}/status`, {
            method: 'PATCH',
            body: { statusId },
        });
    },

    /**
     * Requests a review for a task.
     */
    tasksRequestReview: (projectId, taskId, reviewerId) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/projects/${projectId}/tasks/${taskId}/request-review`, {
            method: 'POST',
            body: { reviewerId },
        });
    },

    /**
     * Archives/Unarchives a task.
     */
    tasksSetArchived: (projectId, taskId, archived) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/projects/${projectId}/tasks/${taskId}/archived?archived=${archived}`, {
            method: 'PATCH',
        });
    },

    /**
     * Deletes a task (soft delete via archived).
     */
    tasksDelete: (projectId, taskId) => {
        return librepm.tasksSetArchived(projectId, taskId, true);
    },

    /**
     * Reorders tasks.
     */
    tasksReorder: (projectId, orderedTaskIds) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/projects/${projectId}/tasks/reorder`, {
            method: 'PUT',
            body: orderedTaskIds,
        });
    },

    /**
     * Gets Gantt/Timeline data for a project.
     * Returns tasks with dependencies, critical path, WBS codes.
     */
    tasksGantt: (projectId) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/projects/${projectId}/tasks/gantt`);
    },

    /**
     * Gets status change history for a task (PRD-01-FR-008).
     */
    tasksHistory: (projectId, taskId) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/projects/${projectId}/tasks/${taskId}/history`);
    },

    // ========================================
    // Inbox API (PRD-01-FR-004)
    // Endpoint: /api/users/{userId}/inbox
    // ========================================

    /**
     * Lists inbox tasks for the current user.
     */
    inboxList: () => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/inbox`);
    },

    /**
     * Creates a new inbox task.
     */
    inboxCreate: (data) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/inbox`, {
            method: 'POST',
            body: data,
        });
    },

    /**
     * Gets inbox task count.
     */
    inboxCount: () => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/inbox/count`);
    },

    /**
     * Moves an inbox task to a project.
     */
    inboxMoveToProject: (taskId, projectId) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/inbox/${taskId}/move-to-project`, {
            method: 'PUT',
            body: { projectId },
        });
    },

    // ========================================
    // ========================================
    // Search API (PRD-02-FR-004)
    // Endpoint: /api/search
    // ========================================

    /**
     * Full-text search across notes and tasks.
     */
    globalSearch: (query, types, projectId, limit = 20) => {
        const params = new URLSearchParams({ q: query, limit: String(limit) });
        if (types) params.append('types', types.join(','));
        if (projectId) params.append('projectId', projectId);
        return apiRequest(`/search?${params.toString()}`);
    },

    // ========================================
    // Time Entries API (PRD-03)
    // Endpoint: /api/time-entries
    // ========================================

    timeEntriesCreate: (data) => {
        return apiRequest('/time-entries', { method: 'POST', body: JSON.stringify(data) });
    },

    timeEntriesUpdate: (id, data) => {
        return apiRequest(`/time-entries/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },

    timeEntriesDelete: (id) => {
        return apiRequest(`/time-entries/${id}`, { method: 'DELETE' });
    },

    timeEntriesByTask: (taskId) => {
        return apiRequest(`/time-entries/task/${taskId}`);
    },

    timeEntriesByUser: (userId) => {
        return apiRequest(`/time-entries/user/${userId}`);
    },

    timeEntriesByProject: (projectId) => {
        return apiRequest(`/time-entries/project/${projectId}`);
    },

    timeEntriesTotalByTask: (taskId) => {
        return apiRequest(`/time-entries/task/${taskId}/total`);
    },

    timeEntriesDeviation: (taskId) => {
        return apiRequest(`/time-entries/task/${taskId}/deviation`);
    },

    timeEntriesProjectVariance: (projectId) => {
        return apiRequest(`/time-entries/project/${projectId}/variance`);
    },

    effortEstimatesByProject: (projectId) => {
        return apiRequest(`/effort-estimates/project/${projectId}`);
    },

    effortEstimatesCreate: (data) => {
        return apiRequest('/effort-estimates', { method: 'POST', body: JSON.stringify(data) });
    },

    // Saved Views API (PRD-01-FR-007, PRD-10-FR-003)
    // Endpoint: /api/users/{userId}/views
    // ========================================

    savedViewsList: () => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/views`);
    },

    savedViewsListByProject: (projectId) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/views/project/${projectId}`);
    },

    savedViewsCreate: (data) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/views`, { method: 'POST', body: data });
    },

    savedViewsUpdate: (viewId, data) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/views/${viewId}`, { method: 'PUT', body: data });
    },

    savedViewsDelete: (viewId) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/views/${viewId}`, { method: 'DELETE' });
    },

    // ========================================
    // Task Statuses & Priorities API
    // Endpoint: /api/task-statuses, /api/task-priorities
    // ========================================

    /**
     * Lists all task statuses.
     */
    taskStatusesList: () => apiRequest('/task-statuses'),

    /**
     * Lists all task priorities.
     */
    taskPrioritiesList: () => apiRequest('/task-priorities'),

    // ========================================
    // Dependencies API (PRD-08)
    // Endpoint: /api/users/{userId}/projects/{projectId}/dependencies
    // ========================================

    /**
     * Lists all dependencies for a project.
     */
    dependenciesList: (projectId) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/projects/${projectId}/dependencies`);
    },

    /**
     * Creates a new dependency between tasks.
     */
    dependenciesCreate: (projectId, data) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/projects/${projectId}/dependencies`, {
            method: 'POST',
            body: data,
        });
    },

    /**
     * Deletes a dependency.
     */
    dependenciesDelete: (projectId, dependencyId) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/projects/${projectId}/dependencies/${dependencyId}`, {
            method: 'DELETE',
        });
    },

    // ========================================
    // Checklist API (v0.4.3)
    // Endpoint: /api/users/{userId}/projects/{projectId}/tasks/{taskId}/checklist
    // ========================================

    /**
     * Creates a new item in the checklist.
     */
    checklistCreate: (projectId, taskId, text) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/projects/${projectId}/tasks/${taskId}/checklist`, {
            method: 'POST',
            body: { text },
        });
    },

    /**
     * Updates a checklist item.
     */
    checklistUpdate: (projectId, taskId, itemId, data) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/projects/${projectId}/tasks/${taskId}/checklist/${itemId}`, {
            method: 'PUT',
            body: data,
        });
    },

    /**
     * Deletes a checklist item.
     */
    checklistDelete: (projectId, taskId, itemId) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/projects/${projectId}/tasks/${taskId}/checklist/${itemId}`, {
            method: 'DELETE',
        });
    },

    // ========================================
    // Notes API (v0.7.1)
    // Endpoint: /api/notes
    // ========================================

    /**
     * Gets the list of notes for a Task.
     */
    notesListTask: (taskId) => {
        return apiRequest(`/tasks/${taskId}/notes`);
    },

    /**
     * Creates a note for a Task.
     */
    notesCreateTask: (taskId, data) => {
        return apiRequest(`/tasks/${taskId}/notes`, {
            method: 'POST',
            body: data,
        });
    },

    /**
     * Gets the list of notes for a Project.
     */
    notesListProject: (projectId) => {
        return apiRequest(`/projects/${projectId}/notes`);
    },

    /**
     * Creates a note for a Project.
     */
    notesCreateProject: (projectId, data) => {
        return apiRequest(`/projects/${projectId}/notes`, {
            method: 'POST',
            body: data,
        });
    },

    /**
     * Gets the list of notes (Legacy/Search).
     */
    notesList: (parentType = null, parentId = null, search = null) => {
        const params = new URLSearchParams();
        if (parentType) params.append('parentType', parentType);
        if (parentId) params.append('parentId', parentId);
        if (search) params.append('search', search);

        const queryString = params.toString();
        return apiRequest(`/notes${queryString ? '?' + queryString : ''}`);
    },
    
    /**
     * Gets the notes feed (Inbox, Sent, All).
     */
    notesFeed: (scope = 'ALL') => {
        return apiRequest(`/notes/feed?scope=${scope}`);
    },

    /**
     * Creates a new note (Legacy).
     * @param {Object} data - { title, content, parentType, parentId, tagIds }
     */
    notesCreate: (data) => {
        const params = new URLSearchParams();
        params.append('parentType', data.parentType);
        params.append('parentId', data.parentId);
        
        // Remove parentType/parentId from body as they are now query params
        const { parentType, parentId, ...body } = data;
        
        return apiRequest(`/notes?${params.toString()}`, {
            method: 'POST',
            body: body,
        });
    },

    /**
     * Updates a note.
     */
    notesUpdate: (noteId, data) => {
        return apiRequest(`/notes/${noteId}`, {
            method: 'PUT',
            body: data,
        });
    },

    /**
     * Deletes a note.
     */
    notesDelete: (noteId) => {
        return apiRequest(`/notes/${noteId}`, {
            method: 'DELETE',
        });
    },

    /**
     * Gets a specific note.
     */
    notesGet: (noteId) => {
        return apiRequest(`/notes/${noteId}`);
    },

    /**
     * Gets revision history for a note (PRD-02-FR-006).
     */
    notesRevisions: (noteId) => {
        return apiRequest(`/notes/${noteId}/revisions`);
    },

    /**
     * Gets backlinks - notes linked to a given entity (PRD-02-FR-005).
     */
    notesBacklinks: (entityType, entityId) => {
        return apiRequest(`/notes/backlinks?entityType=${entityType}&entityId=${entityId}`);
    },

    // ========================================
    // Team API (v0.5.0)
    // Endpoint: /api/users/{userId}/projects/{projectId}/members
    // ========================================

    /**
     * Gets the list of project members.
     */
    projectMembersList: (projectId) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/projects/${projectId}/members`);
    },

    /**
     * Adds a member to the project.
     */
    projectMembersAdd: (projectId, userId, role) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/projects/${projectId}/members`, {
            method: 'POST',
            body: { userId, role },
        });
    },

    /**
     * Removes a member from the project.
     */
    projectMembersRemove: (projectId, memberId) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/projects/${projectId}/members/${memberId}`, {
            method: 'DELETE',
        });
    },

    /**
     * Creates a Ghost user for the project.
     */
    projectMembersCreateGhost: (projectId, username, displayName) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/projects/${projectId}/members/ghosts`, {
            method: 'POST',
            body: { username, displayName },
        });
    },

    /**
     * Updates a member's role in a project.
     */
    projectMembersUpdateRole: (projectId, memberId, role, systemRoleId) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/projects/${projectId}/members/${memberId}/role`, {
            method: 'PATCH',
            body: { role, systemRoleId: systemRoleId || null },
        });
    },

    // ========================================
    // Roles API (v0.9.1)
    // Endpoint: /api/roles
    // ========================================

    /**
     * Lists all system roles.
     */
    rolesList: () => {
        return apiRequest('/roles');
    },

    // ========================================
    // Approvals API (v0.9.1)
    // ========================================

    approvalsCreate: (data) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/approvals`, {
            method: 'POST',
            body: data,
        });
    },

    approvalsPending: () => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/approvals/pending`);
    },

    approvalsPendingCount: () => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/approvals/pending/count`);
    },

    approvalsResolve: (approvalId, status, comment) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/approvals/${approvalId}`, {
            method: 'PATCH',
            body: { status, comment: comment || null },
        });
    },

    // ========================================
    // Notification Preferences API (v0.9.1)
    // ========================================

    notificationPreferencesList: () => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/notification-preferences`);
    },

    notificationPreferencesUpsert: (data) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/notification-preferences`, {
            method: 'PUT',
            body: data,
        });
    },

    // ========================================
    // External Contributors API (v0.9.1)
    // ========================================

    externalContributorsList: () => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/external-contributors`);
    },

    externalContributorsCreate: (data) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/external-contributors`, {
            method: 'POST',
            body: data,
        });
    },

    externalContributorsRevoke: (contributorId) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/external-contributors/${contributorId}`, {
            method: 'DELETE',
        });
    },

    // ========================================
    // Resource API (v0.6.0)
    // Endpoint: /api/projects/{projectId}/resources
    // ========================================

    /**
     * Gets resource allocation for a project.
     */
    resourceAllocation: (projectId, startDate, endDate) => {
        return apiRequest(`/projects/${projectId}/resources?startDate=${startDate}&endDate=${endDate}`);
    },

    // ========================================
    // Analytics API (v0.5.0)
    // Endpoint: /api/users/{userId}/analytics
    // ========================================

    /**
     * Gets analytics on estimates.
     */
    analyticsEstimates: (projectId = null) => {
        const basePath = getUserBasePath();
        const params = projectId ? `?projectId=${projectId}` : '';
        return apiRequest(`${basePath}/analytics/estimates${params}`);
    },

    /**
     * Gets focus heatmap.
     */
    analyticsFocusHeatmap: (projectId = null, range = 365) => {
        const basePath = getUserBasePath();
        const params = new URLSearchParams();
        if (projectId) params.append('projectId', projectId);
        params.append('range', range.toString());
        
        const queryString = params.toString();
        return apiRequest(`${basePath}/analytics/focus-heatmap${queryString ? '?' + queryString : ''}`);
    },

    /**
     * Focus statistics by period.
     */
    focusStats: (period = 'week') => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/analytics/focus-stats?period=${period}`);
    },

    // ========================================
    // Notifications API (v0.7.0)
    // Endpoint: /api/notifications
    // ========================================

    /**
     * Gets unread notifications.
     */
    notificationsUnread: () => {
        return apiRequest(`/notifications/unread`);
    },

    /**
     * Counts unread notifications.
     */
    notificationsCount: () => {
        return apiRequest(`/notifications/count`);
    },

    /**
     * Marks a notification as read.
     */
    notificationsMarkRead: (notificationId) => {
        return apiRequest(`/notifications/${notificationId}/read`, { method: 'POST' });
    },

    /**
     * Marks all notifications as read.
     */
    notificationsMarkAllRead: () => {
        return apiRequest(`/notifications/read-all`, { method: 'POST' });
    },

    // ========================================
    // Tags API (v0.2.0)
    // Endpoint: /api/tags (uses @CurrentUser from X-User-Id header)
    // ========================================

    /**
     * Gets all user tags.
     */
    tagsList: () => apiRequest('/tags'),

    /**
     * Gets a specific tag.
     */
    tagsGet: (tagId) => apiRequest(`/tags/${tagId}`),

    /**
     * Creates a new tag.
     */
    tagsCreate: (name, color = '#3498db') => apiRequest('/tags', {
        method: 'POST',
        body: { name, color },
    }),

    /**
     * Updates a tag.
     */
    tagsUpdate: (tagId, data) => apiRequest(`/tags/${tagId}`, {
        method: 'PUT',
        body: data,
    }),

    /**
     * Deletes a tag.
     */
    tagsDelete: (tagId) => apiRequest(`/tags/${tagId}`, {
        method: 'DELETE',
    }),

    /**
     * Searches tags by name.
     */
    tagsSearch: (query) => apiRequest(`/tags/search?q=${encodeURIComponent(query)}`),

    /**
     * Tag statistics (most used, unused).
     */
    tagsStats: () => apiRequest('/tags/stats'),

    // ========================================
    // Focus Sessions API
    // Endpoint: /api/users/{userId}/focus-sessions
    // ========================================

    /**
     * Starts a focus session.
     */
    focusStart: (taskId, options = {}) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/focus-sessions/tasks/${taskId}/start`, {
            method: 'POST',
            body: options,
        });
    },

    /**
     * Stops the current focus session.
     */
    focusStop: (sessionId = null, options = {}) => {
        const basePath = getUserBasePath();
        // If sessionId is not provided, try to stop the current one
        const endpoint = sessionId 
            ? `${basePath}/focus-sessions/${sessionId}/stop`
            : `${basePath}/focus-sessions/current/stop`;
            
        return apiRequest(endpoint, {
            method: 'POST',
            body: options,
        });
    },

    /**
     * Gets the current focus session (if active).
     */
    focusRunning: () => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/focus-sessions/current`);
    },

    /**
     * Gets all running focus sessions (multi-timer).
     */
    focusRunningAll: () => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/focus-sessions/running`);
    },

    /**
     * Gets focus sessions (optionally filtered by taskId).
     */
    focusList: (taskId = null) => {
        const basePath = getUserBasePath();
        const params = taskId ? `?taskId=${taskId}` : '';
        return apiRequest(`${basePath}/focus-sessions${params}`);
    },

    /**
     * Session history for a task.
     */
    focusHistory: (taskId) => librepm.focusList(taskId),

    /**
     * History of all sessions.
     */
    focusHistoryAll: (options = {}) => {
        const basePath = getUserBasePath();
        const params = new URLSearchParams();
        if (options.taskId) params.append('taskId', options.taskId);

        const queryString = params.toString();
        return apiRequest(`${basePath}/focus-sessions${queryString ? '?' + queryString : ''}`);
    },

    // ========================================
    // User Settings API (v0.2.0)
    // Endpoint: /api/settings (uses @CurrentUser from X-User-Id header)
    // ========================================

    /**
     * Gets user settings.
     */
    settingsGet: () => apiRequest('/settings'),

    /**
     * Updates user settings.
     */
    settingsUpdate: (data) => apiRequest('/settings', {
        method: 'PUT',
        body: data,
    }),

    /**
     * Resets settings to default values.
     */
    settingsReset: () => apiRequest('/settings/reset', {
        method: 'POST',
    }),

    // ========================================
    // Assets API (v0.2.0)
    // Endpoint: /api/users/{userId}/assets
    // ========================================

    /**
     * Gets all user assets.
     */
    assetsList: (includeDeleted = false) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/assets?includeDeleted=${includeDeleted}`);
    },

    /**
     * Gets a specific asset.
     */
    assetsGet: (assetId) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/assets/${assetId}`);
    },

    /**
     * Uploads an asset.
     */
    assetsUpload: async (file, description = null, taskId = null) => {
        const baseUrl = await getApiUrl();
        const basePath = getUserBasePath();
        const formData = new FormData();
        formData.append('file', file);
        if (description) {
            formData.append('description', description);
        }
        if (taskId) {
            formData.append('taskId', taskId);
        }

        const response = await fetch(`${baseUrl}${basePath}/assets/upload`, {
            method: 'POST',
            body: formData,
            // Niente Content-Type: con FormData lo imposta il browser, che deve
            // aggiungerci il boundary.
            headers: await withAuthorization(
                CURRENT_USER_ID ? { 'X-User-Id': CURRENT_USER_ID } : {}
            ),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new ApiError(
                errorData.message || 'Errore upload asset',
                response.status,
                errorData
            );
        }

        return response.json();
    },

    /**
     * Multiple asset upload.
     */
    assetsUploadMultiple: async (files, description = null, taskId = null) => {
        const results = [];
        for (const file of files) {
            try {
                const result = await librepm.assetsUpload(file, description, taskId);
                results.push(result);
            } catch (e) {
                console.error('[LibrePM API] Errore upload file:', file.name, e);
            }
        }
        return results;
    },

    /**
     * Updates asset metadata.
     */
    assetsUpdate: (assetId, data) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/assets/${assetId}`, {
            method: 'PUT',
            body: data,
        });
    },

    /**
     * Deletes an asset (soft delete).
     */
    assetsDelete: (assetId) => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/assets/${assetId}/deleted?deleted=true`, {
            method: 'PATCH',
        });
    },

    /**
     * Downloads an asset.
     */
    assetsDownload: async (assetId) => {
        const baseUrl = await getApiUrl();
        const basePath = getUserBasePath();
        const url = `${baseUrl}${basePath}/assets/${assetId}/download`;
        
        // Trigger download in browser
        window.open(url, '_blank');
    },

    // ========================================
    // Reminders API (v0.2.0)
    // TODO: Implement backend controller
    // ========================================

    /**
     * Gets all active reminders.
     */
    remindersList: () => {
        console.warn('[LibrePM API] remindersList: endpoint non ancora implementato');
        return Promise.resolve([]);
    },

    /**
     * Checks due reminders.
     */
    remindersCheckDue: () => {
        console.warn('[LibrePM API] remindersCheckDue: endpoint non ancora implementato');
        return Promise.resolve([]);
    },

    /**
     * Marks a reminder as notified.
     */
    reminderMarkNotified: (taskId) => {
        console.warn('[LibrePM API] reminderMarkNotified: endpoint non ancora implementato');
        return Promise.resolve({ taskId, notified: true });
    },

    // ========================================
    // Calendar Integrations (v0.10.0)
    // ========================================

    /**
     * Gets the current ICS token for the user.
     */
    getCalendarToken: () => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/calendar/token`);
    },

    /**
     * Regenerates the ICS token for the user.
     */
    regenerateCalendarToken: () => {
        const basePath = getUserBasePath();
        return apiRequest(`${basePath}/calendar/token`, { method: 'POST' });
    },

    // ========================================
    // Database Export/Import
    // Endpoint: /api/db
    // ========================================

    /**
     * Exports database as file.
     */
    exportDatabase: async (format = 'db', includeAssets = false) => {
        const baseUrl = await getApiUrl();
        const response = await fetch(
            `${baseUrl}/db/export?format=${format}&includeAssets=${includeAssets}`,
            {
                headers: await withAuthorization(
                    CURRENT_USER_ID ? { 'X-User-Id': CURRENT_USER_ID } : {}
                ),
            }
        );

        if (!response.ok) {
            throw new ApiError('Errore export database', response.status);
        }

        return response.blob();
    },

    /**
     * Imports database from file.
     */
    importDatabase: async (file) => {
        const baseUrl = await getApiUrl();
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${baseUrl}/db/import`, {
            method: 'POST',
            body: formData,
            headers: await withAuthorization(
                CURRENT_USER_ID ? { 'X-User-Id': CURRENT_USER_ID } : {}
            ),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new ApiError(
                errorData.message || 'Errore import database',
                response.status,
                errorData
            );
        }

        return response.json();
    },

    /**
     * Database status.
     */
    databaseStatus: () => apiRequest('/db/status'),

    /**
     * Get backup manifest info (entity counts, migration version, checksum).
     */
    dbBackupInfo: () => apiRequest('/db/backup-info'),

    /**
     * Query recent event journal entries.
     */
    eventJournalRecent: (limit = 100) => apiRequest(`/events/recent?limit=${limit}`),

    // Asset Versions
    assetVersionsList: (projectId, assetId) => apiRequest(`/projects/${projectId}/assets/${assetId}/versions`),

    // Evidence Packs
    evidencePacksList: (projectId) => apiRequest(`/projects/${projectId}/evidence-packs`),
    evidencePacksCreate: (projectId, data) => apiRequest(`/projects/${projectId}/evidence-packs`, { method: 'POST', body: data }),
    evidencePacksFinalize: (projectId, packId) => apiRequest(`/projects/${projectId}/evidence-packs/${packId}/finalize`, { method: 'PATCH' }),
    evidencePacksItems: (projectId, packId) => apiRequest(`/projects/${projectId}/evidence-packs/${packId}/items`),
    evidencePacksAddItem: (projectId, packId, data) => apiRequest(`/projects/${projectId}/evidence-packs/${packId}/items`, { method: 'POST', body: data }),
    evidencePacksRemoveItem: (projectId, packId, itemId) => apiRequest(`/projects/${projectId}/evidence-packs/${packId}/items/${itemId}`, { method: 'DELETE' }),
    evidencePacksDelete: (projectId, packId) => apiRequest(`/projects/${projectId}/evidence-packs/${packId}`, { method: 'DELETE' }),

    // Asset Links
    assetLinksListByEntity: (entityType, entityId) => apiRequest(`/asset-links?entityType=${entityType}&entityId=${entityId}`),
    assetLinksCreate: (assetId, entityType, entityId) => apiRequest('/asset-links', { method: 'POST', body: { assetId, entityType, entityId } }),
    assetLinksDelete: (linkId) => apiRequest(`/asset-links/${linkId}`, { method: 'DELETE' }),

    // Phases
    phasesList: (projectId) => apiRequest(`/projects/${projectId}/phases`),
    phasesCreate: (projectId, data) => apiRequest(`/projects/${projectId}/phases`, { method: 'POST', body: data }),
    phasesUpdate: (projectId, phaseId, data) => apiRequest(`/projects/${projectId}/phases/${phaseId}`, { method: 'PUT', body: data }),
    phasesDelete: (projectId, phaseId) => apiRequest(`/projects/${projectId}/phases/${phaseId}`, { method: 'DELETE' }),

    /**
     * Generate diagnostics bundle (ZIP download).
     */
    diagnosticsGenerate: async () => {
        const baseUrl = await getApiUrl();
        // CURRENT_USER_ID e non currentUserId: quest'ultimo non è mai stato
        // dichiarato, quindi in un modulo ES la riga lanciava ReferenceException
        // e la generazione della diagnostica falliva sempre.
        const headers = { 'Content-Type': 'application/json' };
        if (CURRENT_USER_ID) headers['X-User-Id'] = CURRENT_USER_ID;
        const response = await fetch(`${baseUrl}/diagnostics/generate`, {
            method: 'POST',
            headers: await withAuthorization(headers),
        });
        if (!response.ok) throw new Error(`Diagnostics generation failed: ${response.status}`);
        return response.blob();
    },

    /**
     * Export database encrypted with passphrase.
     */
    dbExportEncrypted: (passphrase) => apiRequest('/db/export-encrypted', {
        method: 'POST',
        body: { passphrase },
    }),

    /**
     * Import encrypted database with passphrase.
     */
    dbImportEncrypted: (ciphertext, salt, iv, passphrase) => apiRequest('/db/import-encrypted', {
        method: 'POST',
        body: { ciphertext, salt, iv, passphrase },
    }),

    // Capacity Profiles & Leave
    capacityProfilesList: (userId) => apiRequest(`/users/${userId}/capacity/profiles`),
    capacityProfilesCreate: (userId, data) => apiRequest(`/users/${userId}/capacity/profiles`, { method: 'POST', body: data }),
    capacityProfilesDelete: (userId, profileId) => apiRequest(`/users/${userId}/capacity/profiles/${profileId}`, { method: 'DELETE' }),
    leaveList: (userId, from, to) => {
        let url = `/users/${userId}/capacity/leave`;
        if (from && to) url += `?from=${from}&to=${to}`;
        return apiRequest(url);
    },
    leaveCreate: (userId, data) => apiRequest(`/users/${userId}/capacity/leave`, { method: 'POST', body: data }),
    leaveDelete: (userId, leaveId) => apiRequest(`/users/${userId}/capacity/leave/${leaveId}`, { method: 'DELETE' }),
    capacityAvailable: (userId, from, to) => apiRequest(`/users/${userId}/capacity/available?from=${from}&to=${to}`),

    // Status Reviews
    statusReviewsList: (projectId) => apiRequest(`/projects/${projectId}/status-reviews`),
    statusReviewsLatest: (projectId) => apiRequest(`/projects/${projectId}/status-reviews/latest`),
    statusReviewsCreate: (projectId, data) => apiRequest(`/projects/${projectId}/status-reviews`, { method: 'POST', body: data }),
    statusReviewsUpdate: (projectId, reviewId, data) => apiRequest(`/projects/${projectId}/status-reviews/${reviewId}`, { method: 'PUT', body: data }),
    statusReviewsDelete: (projectId, reviewId) => apiRequest(`/projects/${projectId}/status-reviews/${reviewId}`, { method: 'DELETE' }),

    // Rate Cards
    rateCardsList: (scope, entityId) => apiRequest(`/rate-cards?scope=${scope}&entityId=${entityId}`),
    rateCardsCreate: (data) => apiRequest('/rate-cards', { method: 'POST', body: data }),
    rateCardsUpdate: (id, data) => apiRequest(`/rate-cards/${id}`, { method: 'PUT', body: data }),
    rateCardsDelete: (id) => apiRequest(`/rate-cards/${id}`, { method: 'DELETE' }),
    rateCardsResolve: (userId, projectId, roleId, date) => {
        let url = `/rate-cards/resolve?userId=${userId}&date=${date}`;
        if (projectId) url += `&projectId=${projectId}`;
        if (roleId) url += `&roleId=${roleId}`;
        return apiRequest(url);
    },

    // Import Mapping Profiles
    importMappingProfilesList: (entityType) => {
        let url = '/import-mapping-profiles';
        if (entityType) url += `?entityType=${entityType}`;
        return apiRequest(url);
    },
    importMappingProfilesCreate: (data) => apiRequest('/import-mapping-profiles', { method: 'POST', body: data }),
    importMappingProfilesUpdate: (id, data) => apiRequest(`/import-mapping-profiles/${id}`, { method: 'PUT', body: data }),
    importMappingProfilesDelete: (id) => apiRequest(`/import-mapping-profiles/${id}`, { method: 'DELETE' }),

    // Forecast & Earned Value
    forecastEarnedValue: (projectId, asOfDate) => {
        let url = `/projects/${projectId}/forecast/earned-value`;
        if (asOfDate) url += `?asOfDate=${asOfDate}`;
        return apiRequest(url);
    },
    forecastResourceIssues: (projectId, from, to) =>
        apiRequest(`/projects/${projectId}/forecast/resource-issues?from=${from}&to=${to}`),

    // Schedule Recalculation
    scheduleRecalculate: (projectId) => apiRequest(`/projects/${projectId}/phases/recalculate`, { method: 'POST' }),

    // Sync Conflicts
    syncConflictsList: () => apiRequest('/sync/conflicts'),
    syncConflictsCount: () => apiRequest('/sync/conflicts/count'),
    syncConflictResolve: (conflictId, resolution) => apiRequest(`/sync/conflicts/${conflictId}/resolve`, { method: 'POST', body: resolution }),

    // Baseline Compare
    baselineCompare: (userId, projectId, baselineId) => apiRequest(`/users/${userId}/projects/${projectId}/baselines/${baselineId}/compare`),

    // Workspace Profiles
    workspaceProfilesList: () => apiRequest('/workspace-profiles'),
    workspaceProfileGet: (id) => apiRequest(`/workspace-profiles/${id}`),
    workspaceProfileAssign: (userId, profileId) => apiRequest(`/workspace-profiles/users/${userId}/profile`, { method: 'PUT', body: { profileId } }),

    // ========================================
    // Finance API (Phase 18)
    // ========================================

    financeBudgetsList: (projectId) => apiRequest(`/projects/${projectId}/finance/budgets`),
    financeBudgetCreate: (projectId, data) => apiRequest(`/projects/${projectId}/finance/budgets`, { method: 'POST', body: data }),
    financeBudgetUpdate: (projectId, budgetId, data) => apiRequest(`/projects/${projectId}/finance/budgets/${budgetId}`, { method: 'PUT', body: data }),
    financeBudgetApprove: (projectId, budgetId, approvedBy) => apiRequest(`/projects/${projectId}/finance/budgets/${budgetId}/approve`, { method: 'POST', body: { approvedBy } }),
    financeBudgetNewVersion: (projectId, budgetId) => apiRequest(`/projects/${projectId}/finance/budgets/${budgetId}/new-version`, { method: 'POST' }),
    financeBudgetDelete: (projectId, budgetId) => apiRequest(`/projects/${projectId}/finance/budgets/${budgetId}`, { method: 'DELETE' }),

    financeLinesList: (projectId, budgetId) => apiRequest(`/projects/${projectId}/finance/budgets/${budgetId}/lines`),
    financeLineCreate: (projectId, budgetId, data) => apiRequest(`/projects/${projectId}/finance/budgets/${budgetId}/lines`, { method: 'POST', body: data }),
    financeLineUpdate: (projectId, lineId, data) => apiRequest(`/projects/${projectId}/finance/lines/${lineId}`, { method: 'PUT', body: data }),
    financeLineDelete: (projectId, lineId) => apiRequest(`/projects/${projectId}/finance/lines/${lineId}`, { method: 'DELETE' }),

    financeFundingList: (projectId) => apiRequest(`/projects/${projectId}/finance/funding`),
    financeFundingCreate: (projectId, data) => apiRequest(`/projects/${projectId}/finance/funding`, { method: 'POST', body: data }),
    financeFundingUpdate: (projectId, fundId, data) => apiRequest(`/projects/${projectId}/finance/funding/${fundId}`, { method: 'PUT', body: data }),
    financeFundingDelete: (projectId, fundId) => apiRequest(`/projects/${projectId}/finance/funding/${fundId}`, { method: 'DELETE' }),

    financeAllocationCreate: (projectId, data) => apiRequest(`/projects/${projectId}/finance/allocations`, { method: 'POST', body: data }),
    financeAllocationDelete: (projectId, allocId) => apiRequest(`/projects/${projectId}/finance/allocations/${allocId}`, { method: 'DELETE' }),

    financeCostsList: (projectId, budgetLineId) => apiRequest(`/projects/${projectId}/finance/costs?budgetLineId=${budgetLineId}`),
    financeCostRecord: (projectId, data) => apiRequest(`/projects/${projectId}/finance/costs`, { method: 'POST', body: data }),
    financeCostDelete: (projectId, costId) => apiRequest(`/projects/${projectId}/finance/costs/${costId}`, { method: 'DELETE' }),

    financeAnalytics: (projectId) => apiRequest(`/projects/${projectId}/finance/analytics`),

    // ========================================
    // Grants API (Phase 19)
    // ========================================

    grantCallsList: (projectId) => apiRequest(`/projects/${projectId}/grants/calls`),
    grantCallCreate: (projectId, data) => apiRequest(`/projects/${projectId}/grants/calls`, { method: 'POST', body: JSON.stringify(data) }),
    grantCallUpdate: (projectId, callId, data) => apiRequest(`/projects/${projectId}/grants/calls/${callId}`, { method: 'PUT', body: JSON.stringify(data) }),
    grantCallDelete: (projectId, callId) => apiRequest(`/projects/${projectId}/grants/calls/${callId}`, { method: 'DELETE' }),

    grantRequirementsList: (projectId, callId) => apiRequest(`/projects/${projectId}/grants/calls/${callId}/requirements`),
    grantRequirementCreate: (projectId, callId, data) => apiRequest(`/projects/${projectId}/grants/calls/${callId}/requirements`, { method: 'POST', body: JSON.stringify(data) }),
    grantRequirementUpdate: (projectId, callId, reqId, data) => apiRequest(`/projects/${projectId}/grants/calls/${callId}/requirements/${reqId}`, { method: 'PUT', body: JSON.stringify(data) }),
    grantRequirementDelete: (projectId, callId, reqId) => apiRequest(`/projects/${projectId}/grants/calls/${callId}/requirements/${reqId}`, { method: 'DELETE' }),

    grantSubmissionsList: (projectId, callId) => apiRequest(`/projects/${projectId}/grants/calls/${callId}/submissions`),
    grantSubmissionCreate: (projectId, callId, data) => apiRequest(`/projects/${projectId}/grants/calls/${callId}/submissions`, { method: 'POST', body: JSON.stringify(data) }),
    grantSubmissionUpdate: (projectId, callId, subId, data) => apiRequest(`/projects/${projectId}/grants/calls/${callId}/submissions/${subId}`, { method: 'PUT', body: JSON.stringify(data) }),

    grantObligationsList: (projectId) => apiRequest(`/projects/${projectId}/grants/obligations`),
    grantObligationCreate: (projectId, data) => apiRequest(`/projects/${projectId}/grants/obligations`, { method: 'POST', body: JSON.stringify(data) }),
    grantObligationUpdate: (projectId, oblId, data) => apiRequest(`/projects/${projectId}/grants/obligations/${oblId}`, { method: 'PUT', body: JSON.stringify(data) }),
    grantObligationDelete: (projectId, oblId) => apiRequest(`/projects/${projectId}/grants/obligations/${oblId}`, { method: 'DELETE' }),

    grantReportingPeriodsList: (projectId) => apiRequest(`/projects/${projectId}/grants/reporting-periods`),
    grantReportingPeriodCreate: (projectId, data) => apiRequest(`/projects/${projectId}/grants/reporting-periods`, { method: 'POST', body: JSON.stringify(data) }),
    grantReportingPeriodUpdate: (projectId, rpId, data) => apiRequest(`/projects/${projectId}/grants/reporting-periods/${rpId}`, { method: 'PUT', body: JSON.stringify(data) }),
    grantReportingPeriodDelete: (projectId, rpId) => apiRequest(`/projects/${projectId}/grants/reporting-periods/${rpId}`, { method: 'DELETE' }),

    // ========================================
    // Stakeholder API (Phase 19)
    // ========================================

    stakeholdersList: (projectId) => apiRequest(`/projects/${projectId}/stakeholders`),
    stakeholderCreate: (projectId, data) => apiRequest(`/projects/${projectId}/stakeholders`, { method: 'POST', body: JSON.stringify(data) }),
    stakeholderUpdate: (projectId, id, data) => apiRequest(`/projects/${projectId}/stakeholders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    stakeholderDelete: (projectId, id) => apiRequest(`/projects/${projectId}/stakeholders/${id}`, { method: 'DELETE' }),

    sponsorsList: (projectId) => apiRequest(`/projects/${projectId}/stakeholders/sponsors`),
    sponsorCreate: (projectId, data) => apiRequest(`/projects/${projectId}/stakeholders/sponsors`, { method: 'POST', body: JSON.stringify(data) }),
    sponsorUpdate: (projectId, sponsorId, data) => apiRequest(`/projects/${projectId}/stakeholders/sponsors/${sponsorId}`, { method: 'PUT', body: JSON.stringify(data) }),
    sponsorDelete: (projectId, sponsorId) => apiRequest(`/projects/${projectId}/stakeholders/sponsors/${sponsorId}`, { method: 'DELETE' }),

    sponsorCommitmentsList: (projectId) => apiRequest(`/projects/${projectId}/stakeholders/commitments`),
    sponsorCommitmentCreate: (projectId, data) => apiRequest(`/projects/${projectId}/stakeholders/commitments`, { method: 'POST', body: JSON.stringify(data) }),
    sponsorCommitmentUpdate: (projectId, commitId, data) => apiRequest(`/projects/${projectId}/stakeholders/commitments/${commitId}`, { method: 'PUT', body: JSON.stringify(data) }),
    sponsorCommitmentDelete: (projectId, commitId) => apiRequest(`/projects/${projectId}/stakeholders/commitments/${commitId}`, { method: 'DELETE' }),

    donorsList: (projectId) => apiRequest(`/projects/${projectId}/stakeholders/donors`),
    donorCreate: (projectId, data) => apiRequest(`/projects/${projectId}/stakeholders/donors`, { method: 'POST', body: JSON.stringify(data) }),
    donorUpdate: (projectId, donorId, data) => apiRequest(`/projects/${projectId}/stakeholders/donors/${donorId}`, { method: 'PUT', body: JSON.stringify(data) }),
    donorDelete: (projectId, donorId) => apiRequest(`/projects/${projectId}/stakeholders/donors/${donorId}`, { method: 'DELETE' }),

    donationsList: (projectId) => apiRequest(`/projects/${projectId}/stakeholders/donations`),
    donationCreate: (projectId, data) => apiRequest(`/projects/${projectId}/stakeholders/donations`, { method: 'POST', body: JSON.stringify(data) }),
    donationUpdate: (projectId, donationId, data) => apiRequest(`/projects/${projectId}/stakeholders/donations/${donationId}`, { method: 'PUT', body: JSON.stringify(data) }),
    donationDelete: (projectId, donationId) => apiRequest(`/projects/${projectId}/stakeholders/donations/${donationId}`, { method: 'DELETE' }),

    partnersList: (projectId) => apiRequest(`/projects/${projectId}/stakeholders/partners`),
    partnerCreate: (projectId, data) => apiRequest(`/projects/${projectId}/stakeholders/partners`, { method: 'POST', body: JSON.stringify(data) }),
    partnerUpdate: (projectId, partnerId, data) => apiRequest(`/projects/${projectId}/stakeholders/partners/${partnerId}`, { method: 'PUT', body: JSON.stringify(data) }),
    partnerDelete: (projectId, partnerId) => apiRequest(`/projects/${projectId}/stakeholders/partners/${partnerId}`, { method: 'DELETE' }),

    // ========================================
    // Change Control API (Phase 20)
    // ========================================

    changeRequestsList: (projectId) => apiRequest(`/projects/${projectId}/changes/requests`),
    changeRequestCreate: (projectId, data) => apiRequest(`/projects/${projectId}/changes/requests`, { method: 'POST', body: JSON.stringify(data) }),
    changeRequestUpdate: (projectId, crId, data) => apiRequest(`/projects/${projectId}/changes/requests/${crId}`, { method: 'PUT', body: JSON.stringify(data) }),
    changeRequestDelete: (projectId, crId) => apiRequest(`/projects/${projectId}/changes/requests/${crId}`, { method: 'DELETE' }),

    branchesList: (projectId) => apiRequest(`/projects/${projectId}/changes/branches`),
    branchCreate: (projectId, data) => apiRequest(`/projects/${projectId}/changes/branches`, { method: 'POST', body: JSON.stringify(data) }),
    branchUpdate: (projectId, branchId, data) => apiRequest(`/projects/${projectId}/changes/branches/${branchId}`, { method: 'PUT', body: JSON.stringify(data) }),
    branchDelete: (projectId, branchId) => apiRequest(`/projects/${projectId}/changes/branches/${branchId}`, { method: 'DELETE' }),

    branchModificationsList: (projectId, branchId) => apiRequest(`/projects/${projectId}/changes/branches/${branchId}/modifications`),
    branchModificationCreate: (projectId, branchId, data) => apiRequest(`/projects/${projectId}/changes/branches/${branchId}/modifications`, { method: 'POST', body: JSON.stringify(data) }),
    branchModificationDelete: (projectId, branchId, modId) => apiRequest(`/projects/${projectId}/changes/branches/${branchId}/modifications/${modId}`, { method: 'DELETE' }),

    decisionLogList: (projectId) => apiRequest(`/projects/${projectId}/changes/decisions`),
    decisionLogCreate: (projectId, data) => apiRequest(`/projects/${projectId}/changes/decisions`, { method: 'POST', body: JSON.stringify(data) }),
    decisionLogUpdate: (projectId, decisionId, data) => apiRequest(`/projects/${projectId}/changes/decisions/${decisionId}`, { method: 'PUT', body: JSON.stringify(data) }),
    decisionLogDelete: (projectId, decisionId) => apiRequest(`/projects/${projectId}/changes/decisions/${decisionId}`, { method: 'DELETE' }),

    // ========================================
    // Compliance API (Phase 21)
    // ========================================

    complianceCategoriesList: () => apiRequest('/compliance/data-categories'),
    complianceCategoryUpdate: (catId, data) => apiRequest(`/compliance/data-categories/${catId}`, { method: 'PUT', body: JSON.stringify(data) }),

    complianceRetentionList: () => apiRequest('/compliance/retention-policies'),
    complianceRetentionCreate: (data) => apiRequest('/compliance/retention-policies', { method: 'POST', body: JSON.stringify(data) }),
    complianceRetentionUpdate: (rpId, data) => apiRequest(`/compliance/retention-policies/${rpId}`, { method: 'PUT', body: JSON.stringify(data) }),
    complianceRetentionDelete: (rpId) => apiRequest(`/compliance/retention-policies/${rpId}`, { method: 'DELETE' }),

    complianceDsrList: (userId) => apiRequest(`/compliance/dsr-requests${userId ? '?userId=' + userId : ''}`),
    complianceDsrCreate: (data) => apiRequest('/compliance/dsr-requests', { method: 'POST', body: JSON.stringify(data) }),
    complianceDsrUpdate: (dsrId, data) => apiRequest(`/compliance/dsr-requests/${dsrId}`, { method: 'PUT', body: JSON.stringify(data) }),

    complianceProfilesList: () => apiRequest('/compliance/profiles'),
    complianceProfileCreate: (data) => apiRequest('/compliance/profiles', { method: 'POST', body: JSON.stringify(data) }),
    complianceProfileUpdate: (profileId, data) => apiRequest(`/compliance/profiles/${profileId}`, { method: 'PUT', body: JSON.stringify(data) }),

    // ========================================
    // Portfolio API (Phase 22)
    // ========================================

    programmesList: () => apiRequest('/programmes'),
    programmeCreate: (data) => apiRequest('/programmes', { method: 'POST', body: JSON.stringify(data) }),
    programmeUpdate: (progId, data) => apiRequest(`/programmes/${progId}`, { method: 'PUT', body: JSON.stringify(data) }),
    programmeDelete: (progId) => apiRequest(`/programmes/${progId}`, { method: 'DELETE' }),

    programmeProjectsList: (progId) => apiRequest(`/programmes/${progId}/projects`),
    programmeProjectAdd: (progId, data) => apiRequest(`/programmes/${progId}/projects`, { method: 'POST', body: JSON.stringify(data) }),
    programmeProjectRemove: (progId, membershipId) => apiRequest(`/programmes/${progId}/projects/${membershipId}`, { method: 'DELETE' }),

    programmeMilestonesList: (progId) => apiRequest(`/programmes/${progId}/milestones`),
    programmeMilestoneCreate: (progId, data) => apiRequest(`/programmes/${progId}/milestones`, { method: 'POST', body: JSON.stringify(data) }),
    programmeMilestoneUpdate: (progId, msId, data) => apiRequest(`/programmes/${progId}/milestones/${msId}`, { method: 'PUT', body: JSON.stringify(data) }),
    programmeMilestoneDelete: (progId, msId) => apiRequest(`/programmes/${progId}/milestones/${msId}`, { method: 'DELETE' }),

    programmeOverview: (progId) => apiRequest(`/programmes/${progId}/overview`),

    // PDF Report Generation
    reportGenerate: async (projectId, type = 'EXECUTIVE_SUMMARY') => {
        const baseUrl = await getApiUrl();
        // Stessa correzione: currentUserId non esiste, era CURRENT_USER_ID.
        const headers = {};
        if (CURRENT_USER_ID) headers['X-User-Id'] = CURRENT_USER_ID;
        const response = await fetch(`${baseUrl}/projects/${projectId}/report?type=${type}`, {
            headers: await withAuthorization(headers),
        });
        if (!response.ok) throw new Error(`Report generation failed: ${response.status}`);
        return response.blob();
    },

    // ========================================
    // Electron IPC Fallback (desktop only)
    // ========================================

    /**
     * Export JSON with native dialog.
     */
    exportJsonDialog: () => {
        if (window.librepm?.exportJsonDialog) {
            return window.librepm.exportJsonDialog();
        }
        throw new Error('Funzione disponibile solo in Electron');
    },

    /**
     * Export CSV with native dialog.
     */
    exportCsvDialog: (projectId) => {
        if (window.librepm?.exportCsvDialog) {
            return window.librepm.exportCsvDialog(projectId);
        }
        throw new Error('Funzione disponibile solo in Electron');
    },

    /**
     * Import JSON with native dialog.
     */
    importJsonDialog: () => {
        if (window.librepm?.importJsonDialog) {
            return window.librepm.importJsonDialog();
        }
        throw new Error('Funzione disponibile solo in Electron');
    },

    /**
     * Gets local data path.
     */
    getLocalDataPath: () => {
        if (window.librepm?.getLocalDataPath) {
            return window.librepm.getLocalDataPath();
        }
        return null;
    },

    // ========================================
    // Utilities
    // ========================================

    /**
     * Checks if running in Electron.
     */
    isElectron: () => {
        return typeof window !== 'undefined' && window.librepm !== undefined;
    },

    /**
     * API Error Class.
     */
    ApiError,
};

// ========================================
// Auto-init when module is loaded
// ========================================

// Initialize automatically
initializeApi().catch(console.error);

export default librepm;
