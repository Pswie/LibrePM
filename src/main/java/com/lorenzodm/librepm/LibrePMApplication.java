package com.lorenzodm.librepm;

import com.lorenzodm.librepm.util.PortManager;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.ApplicationListener;
import org.springframework.context.annotation.Bean;
import org.springframework.core.env.Environment;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * LibrePM Backend Application
 *
 * Architettura:
 * - Offline-first: funziona embedded in Electron
 * - Cloud-ready: stesso codice per servizio web futuro
 * - Porta dinamica: trova porta libera e la salva su file per Electron
 * - Cross-platform: dati salvati in user.home/.librepm
 *
 * Modalità operative:
 * - desktop: embedded in Electron, porta dinamica, SQLite locale
 * - web: standalone server, porta fissa, PostgreSQL (futuro)
 *CD DESKTOP
 *
 *
 * @author Lorenzo DM
 * @since 0.0.0
 */
@SpringBootApplication
@org.springframework.scheduling.annotation.EnableScheduling
public class LibrePMApplication {

	private static final Logger log = LoggerFactory.getLogger(LibrePMApplication.class);

	public static void main(String[] args) {
		// 1. Configura Data Path Cross-Platform
		String dataPath = setupDataPath();
		
		// Imposta property per Spring (usata in application.yml)
		System.setProperty("librepm.data.path", dataPath);
		
		// Banner custom
		System.setProperty("spring.banner.location", "classpath:banner.txt");

		SpringApplication.run(LibrePMApplication.class, args);
	}

	/**
	 * Calcola e prepara la cartella dati dell'applicazione.
	 * Usa ~/.librepm su Linux/Mac e C:\Users\User\.librepm su Windows.
	 *
	 * <p>{@code LIBREPM_DATA_PATH} ha la precedenza. Serve nel profilo
	 * {@code cloud}: in container la home può non essere scrivibile, e questa
	 * property viene impostata come system property, che in Spring vince su
	 * qualunque valore scritto in {@code application.yml}. Senza questa lettura
	 * il profilo cloud non riuscirebbe a spostare la cartella dati.
	 */
	private static String setupDataPath() {
		String configured = System.getenv("LIBREPM_DATA_PATH");
		if (configured != null && !configured.isBlank()) {
			return prepareDirectory(configured.trim());
		}

		String userHome = System.getProperty("user.home");
		String appFolderName = ".librepm";

		// Su Windows potremmo voler usare AppData, ma .librepm in user home è standard e sicuro
		return prepareDirectory(userHome + File.separator + appFolderName);
	}

	/** Crea la cartella dati se manca, con ripiego su {@code ./data}. */
	private static String prepareDirectory(String appPath) {
		File appDir = new File(appPath);
		if (!appDir.exists()) {
			boolean created = appDir.mkdirs();
			if (created) {
				System.out.println("✅ Creata cartella dati: " + appPath);
			} else {
				System.err.println("❌ Errore creazione cartella dati: " + appPath);
				// Fallback alla directory corrente in caso di disastro
				return "./data";
			}
		}
		
		return appPath;
	}

	/**
	 * Listener per evento ApplicationReady
	 * Scrive la porta dinamica su file per comunicazione con Electron
	 */
	@Bean
	ApplicationListener<ApplicationReadyEvent> applicationReadyListener(
			Environment environment,
			PortManager portManager) {

		return event -> {
			try {
				// Leggi porta effettiva assegnata
				String port = environment.getProperty("local.server.port");
				String mode = environment.getProperty("librepm.mode", "desktop");
				String dataPath = environment.getProperty("librepm.data.path");

				log.info("🚀 LibrePM Backend avviato!");
				log.info("📡 Modalità: {}", mode);
				log.info("🔌 Porta: {}", port);
				log.info("💾 Data path: {}", dataPath);

				// Assicurati che le sottodirectory esistano
				ensureDirectories(dataPath);

				// Se modalità desktop, salva porta su file
				if ("desktop".equals(mode)) {
					portManager.savePortToFile(Integer.parseInt(port));
					log.info("✅ Porta salvata su file config per Electron");
				}

				log.info("✨ LibrePM Backend pronto!");
				log.info("📚 API disponibili su: http://localhost:{}/api", port);

			} catch (Exception e) {
				log.error("❌ Errore durante inizializzazione", e);
			}
		};
	}

	/**
	 * Crea directory necessarie se non esistono
	 */
	private void ensureDirectories(String dataPath) {
		try {
			Path root = Paths.get(dataPath);
			Path config = root.resolve("config");
			Path assets = root.resolve("assets");
			Path logs = root.resolve("logs");

			Files.createDirectories(config);
			Files.createDirectories(assets);
			Files.createDirectories(logs);

			log.debug("✅ Directory verificate: config, assets, logs");

		} catch (Exception e) {
			log.error("❌ Errore creazione directory", e);
		}
	}
}
