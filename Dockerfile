# =============================================================================
# LibrePM — backend cloud (Spring Boot) — immagine Docker per Cloud Run
#
# È la sezione bandi di Angeli del Futuro: stesso servizio MySQL del gestionale,
# database separato, stessa istanza Clerk per l'identità.
#
# Build multi-stage: compila il jar eseguibile e lo esegue su una JRE snella.
# Il profilo attivo è "cloud": DataSource MySQL da variabili d'ambiente.
#
# Variabili richieste a runtime. Le prime cinque sono obbligatorie: senza, il
# profilo cloud rifiuta di avviarsi, ed è voluto — un backend pubblico che parte
# con default permissivi è una fuga di dati, non un inconveniente.
#
#   SPRING_DATASOURCE_URL       jdbc:mysql://<host>:<porta>/librepm?sslMode=REQUIRED
#   SPRING_DATASOURCE_USERNAME
#   SPRING_DATASOURCE_PASSWORD  da Secret Manager, mai nell'immagine
#   CLERK_ISSUER_URI            https://<istanza>.clerk.accounts.dev
#   CORS_ALLOWED_ORIGINS        origine esatta della SPA, mai "*"
#
#   CLERK_AUDIENCE              (opzionale) audience attesa nel token
#   PORT                        (opzionale) iniettata da Cloud Run
#   LIBREPM_DATA_PATH           (opzionale) default /tmp/librepm, vedi sotto
#
# librepm.auth.enabled non è configurabile nel profilo cloud: sul web l'unica
# modalità ammessa è quella autenticata.
# =============================================================================

# ---- Stage 1: build ---------------------------------------------------------
FROM eclipse-temurin:21-jdk AS build
WORKDIR /app

# Wrapper e script di build prima del sorgente, per sfruttare la cache dei layer
COPY gradlew ./
COPY gradle ./gradle
COPY settings.gradle build.gradle ./
RUN chmod +x gradlew

COPY src ./src

# Solo il jar eseguibile: i test hanno bisogno di Docker (Testcontainers) e non
# girano dentro un'immagine. Si eseguono prima, in locale o in CI.
RUN ./gradlew --no-daemon clean bootJar \
 && cp "$(ls build/libs/*.jar | grep -v -- '-plain' | head -n 1)" /app/app.jar

# ---- Stage 2: runtime -------------------------------------------------------
FROM eclipse-temurin:21-jre
WORKDIR /app

# Utente non-root
RUN useradd -r -u 1001 -m librepm
USER librepm

COPY --from=build /app/app.jar app.jar

ENV SPRING_PROFILES_ACTIVE=cloud

# La cartella dati sta sotto /tmp perché su Cloud Run il filesystem
# dell'immagine è di sola lettura. Attenzione: /tmp è un tmpfs, cioè memoria —
# per questo il profilo cloud non ci scrive i log, che vanno su stdout dove
# Cloud Logging li raccoglie.
ENV LIBREPM_DATA_PATH=/tmp/librepm

ENV JAVA_OPTS="-XX:MaxRAMPercentage=75 -Djava.security.egd=file:/dev/./urandom"

EXPOSE 8080

# Cloud Run inietta $PORT; il profilo cloud la legge (server.port=${PORT:8080})
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
