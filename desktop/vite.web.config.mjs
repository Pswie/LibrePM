import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));
const appVersion = packageJson.version;

/**
 * Build web di LibrePM — sezione bandi di Angeli del Futuro.
 *
 * Separata da vite.config.js, che resta quella di Electron. Le differenze non
 * sono cosmetiche:
 *
 *  - `base` assoluta invece di `./`: la SPA è servita da un dominio, non da file
 *    locali, e i percorsi relativi si rompono appena si ricarica una route
 *    profonda;
 *  - entry `index.web.html`, che monta main.web.jsx con Clerk;
 *  - nessuna sourcemap: sarebbe il sorgente completo pubblicato su un URL;
 *  - la CSP di index.web.html viene completata qui con gli host veri.
 *
 * @author Angeli del Futuro (fork di LibrePM)
 * @since 0.2.0
 */
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');

    const apiBaseUrl = env.VITE_API_BASE_URL || '';
    const publishableKey = env.VITE_CLERK_PUBLISHABLE_KEY || '';

    return {
        plugins: [
            react(),
            {
                // I segnaposto della CSP li riempie la build: scriverli a mano in
                // index.web.html vorrebbe dire tenerli allineati con le variabili
                // d'ambiente a memoria, e una CSP disallineata si manifesta come
                // «l'applicazione non carica» senza dire perché.
                name: 'librepm-csp-placeholders',
                transformIndexHtml(html) {
                    return html
                        .replace(/%API_ORIGIN%/g, originOf(apiBaseUrl))
                        .replace(/%CLERK_HOSTS%/g, clerkHosts(publishableKey));
                },
            },
        ],

        define: {
            '__APP_VERSION__': JSON.stringify(appVersion),
        },

        base: env.VITE_BASE_PATH || '/',

        build: {
            outDir: 'dist-web',
            emptyOutDir: true,
            sourcemap: false,
            rollupOptions: {
                input: path.resolve(__dirname, 'index.web.html'),
                output: {
                    manualChunks: {
                        'react-vendor': ['react', 'react-dom'],
                        'clerk-vendor': ['@clerk/clerk-react'],
                        'ui-vendor': ['bootstrap', 'react-toastify'],
                        'calendar-vendor': ['react-big-calendar', 'date-fns'],
                        'editor-vendor': ['@uiw/react-md-editor'],
                    },
                },
            },
        },

        resolve: {
            alias: {
                '@': path.resolve(__dirname, './src'),
                '@components': path.resolve(__dirname, './src/components'),
                '@pages': path.resolve(__dirname, './src/pages'),
                '@api': path.resolve(__dirname, './src/api'),
                '@styles': path.resolve(__dirname, './src/styles'),
                '@layout': path.resolve(__dirname, './src/layout'),
            },
        },
    };
});

/** Da `https://host/api` a `https://host`: nella CSP va l'origine, non il percorso. */
function originOf(url) {
    if (!url) return '';
    try {
        return new URL(url).origin;
    } catch {
        return '';
    }
}

/**
 * Host che Clerk deve poter contattare.
 *
 * La chiave pubblicabile è l'host della Frontend API codificato in base64 con una
 * `$` finale: `pk_test_<base64>`. Ricavarlo da lì evita di dover configurare due
 * volte la stessa informazione. In più serve `*.clerk.com`, da cui Clerk carica
 * il proprio script.
 */
function clerkHosts(publishableKey) {
    const fallback = 'https://*.clerk.accounts.dev https://*.clerk.com';
    const encoded = publishableKey.replace(/^pk_(test|live)_/, '');
    if (!encoded) return fallback;

    try {
        const decoded = Buffer.from(encoded, 'base64').toString('utf8').replace(/\$$/, '');
        if (!decoded) return fallback;
        return `https://${decoded} https://*.clerk.com`;
    } catch {
        return fallback;
    }
}
