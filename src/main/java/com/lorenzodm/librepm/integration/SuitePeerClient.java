package com.lorenzodm.librepm.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.Flow;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import static com.lorenzodm.librepm.integration.SuiteModels.*;

@Component
class SuitePeerClient {
    private final SuiteConfig config;
    private final ObjectMapper json;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(4))
            .version(HttpClient.Version.HTTP_1_1)
            .followRedirects(HttpClient.Redirect.NEVER).build();
    SuitePeerClient(SuiteConfig config, ObjectMapper json) { this.config=config; this.json=json; }
    Snapshot publish(String peer, Projection projection) {
        request(peer, projection, true);
        return request(peer, projection, false);
    }
    private Snapshot request(String peer, Projection projection, boolean put) {
        try {
            HttpRequest.Builder builder = HttpRequest.newBuilder(config.api(peer).resolve("/api/integrations/v1/peer/projects/" + projection.suiteProjectId()))
                    .timeout(Duration.ofSeconds(12)).header("Accept","application/json")
                    .header("X-Suite-Peer","librepm").header("X-Suite-Key",config.key(peer))
                    .header("X-Suite-Organization",config.organization());
            if (put) builder.header("Content-Type","application/json").PUT(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(projection)));
            else builder.GET();
            CompletableFuture<HttpResponse<byte[]>> pending=http.sendAsync(builder.build(), info -> new BoundedBody());
            HttpResponse<byte[]> response;
            try { response=pending.get(12,TimeUnit.SECONDS); }
            catch (TimeoutException e) {
                pending.cancel(true);
                throw new SuiteException(503,"SUITE_PEER_TIMEOUT",peer + " non ha completato la risposta entro il tempo previsto.");
            } catch (InterruptedException e) { pending.cancel(true); throw e; }
            if (response.statusCode() < 200 || response.statusCode() >= 300)
                throw new SuiteException(503,"SUITE_PEER_HTTP_" + response.statusCode(),peer + " ha rifiutato l'allineamento (HTTP " + response.statusCode() + ").");
            return json.readValue(new String(response.body(), StandardCharsets.UTF_8),Snapshot.class);
        } catch (SuiteException e) { throw e;
        } catch (InterruptedException e) { Thread.currentThread().interrupt(); throw SuiteException.unavailable("Allineamento interrotto.");
        } catch (Exception e) { throw new SuiteException(503,"SUITE_PEER_UNREACHABLE",peer + " non raggiungibile o risposta non valida. Riprova più tardi."); }
    }
    /** The future completes only after the whole bounded body; its absolute wait also covers stalled bodies. */
    private static final class BoundedBody implements HttpResponse.BodySubscriber<byte[]> {
        private final CompletableFuture<byte[]> result=new CompletableFuture<>();
        private final ByteArrayOutputStream data=new ByteArrayOutputStream();
        private Flow.Subscription subscription;
        public CompletionStage<byte[]> getBody() { return result; }
        public void onSubscribe(Flow.Subscription subscription) { this.subscription=subscription; subscription.request(Long.MAX_VALUE); }
        public void onNext(List<ByteBuffer> buffers) {
            for (ByteBuffer buffer:buffers) {
                if (data.size()+buffer.remaining()>65536) {
                    subscription.cancel(); result.completeExceptionally(SuiteException.unavailable("Risposta remota troppo grande.")); return;
                }
                byte[] bytes=new byte[buffer.remaining()]; buffer.get(bytes); data.writeBytes(bytes);
            }
        }
        public void onError(Throwable error) { result.completeExceptionally(error); }
        public void onComplete() { result.complete(data.toByteArray()); }
    }
}
