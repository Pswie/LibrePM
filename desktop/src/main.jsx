import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./i18n"; // Import i18n configuration
import { ModalProvider } from './context/ModalContext'; // Import ModalProvider

/**
 * LibrePM Frontend Entry Point
 * 
 * @author Lorenzo DM
 * @since 0.2.0
 */

// Import Bootstrap CSS
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";

// Import Bootstrap JS
import "bootstrap/dist/js/bootstrap.bundle.min.js";

// Comportamento del layout su finestra stretta. Vale per entrambi i target,
// desktop e web — a differenza del tema, qui non c'è nulla di estetico da
// tenere separato. L'applicazione a finestra piena non incontra mai queste
// regole; se qualcuno stringe la finestra, ne guadagna.
import "./styles/mobile.css";

// Mount React app
const container = document.getElementById("root");
const root = createRoot(container);

root.render(
    <StrictMode>
        <ModalProvider>
            <App />
        </ModalProvider>
    </StrictMode>
);
