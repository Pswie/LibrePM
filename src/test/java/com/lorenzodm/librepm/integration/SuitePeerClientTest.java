package com.lorenzodm.librepm.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.time.Duration;
import static com.lorenzodm.librepm.integration.SuiteModels.*;
import static org.junit.jupiter.api.Assertions.*;

class SuitePeerClientTest {
    @Test @org.junit.jupiter.api.Timeout(20)
    void absoluteDeadlineIncludesAStalledBodyAfterSuccessfulHeaders() throws Exception {
        HttpServer remote=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        CountDownLatch release=new CountDownLatch(1);
        remote.createContext("/",exchange -> {
            exchange.getRequestBody().readAllBytes(); exchange.sendResponseHeaders(200,100);
            exchange.getResponseBody().write('{'); exchange.getResponseBody().flush();
            try { release.await(18,TimeUnit.SECONDS); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            finally { exchange.close(); }
        });
        remote.start();
        try {
            String org="11111111-1111-1111-1111-111111111111";
            MockEnvironment env=new MockEnvironment().withProperty("SUITE_ENABLED","true").withProperty("SUITE_ORGANIZATION_ID",org)
                    .withProperty("SUITE_ASSOCIAGO_KEY","test-key-at-least-thirty-two-characters")
                    .withProperty("SUITE_ASSOCIAGO_API_URL","http://127.0.0.1:"+remote.getAddress().getPort());
            SuitePeerClient client=new SuitePeerClient(new SuiteConfig(env),new ObjectMapper());
            long started=System.nanoTime();
            SuiteException error=assertThrows(SuiteException.class,() -> client.publish("associago",new Projection(1,org,"22222222-2222-2222-2222-222222222222",1,"Project",null,null,null,null,new Links(null,null,null))));
            assertEquals("SUITE_PEER_TIMEOUT",error.code()); assertTrue(Duration.ofNanos(System.nanoTime()-started).toSeconds()<15);
        } finally { release.countDown(); remote.stop(0); }
    }
    @Test void realHttpUsesServerOnlyHeadersAndDoesNotFollowRedirects() throws Exception {
        HttpServer remote=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        AtomicInteger puts=new AtomicInteger(),gets=new AtomicInteger(),redirects=new AtomicInteger();
        ObjectMapper json=new ObjectMapper();
        String org="11111111-1111-1111-1111-111111111111",id="22222222-2222-2222-2222-222222222222";
        remote.createContext("/api/integrations/v1/peer/projects/",exchange -> {
            assertNull(exchange.getRequestHeaders().getFirst("Upgrade"),"Do not send h2c upgrade to the FastAPI peer");
            assertEquals("HTTP/1.1",exchange.getProtocol());
            assertEquals("librepm",exchange.getRequestHeaders().getFirst("X-Suite-Peer"));
            assertEquals("test-key-at-least-thirty-two-characters",exchange.getRequestHeaders().getFirst("X-Suite-Key"));
            assertEquals(org,exchange.getRequestHeaders().getFirst("X-Suite-Organization"));
            if (exchange.getRequestMethod().equals("PUT")) puts.incrementAndGet(); else gets.incrementAndGet();
            byte[] bytes=json.writeValueAsBytes(new Snapshot(1,org,id,"associago","9",1L,null,null,null));
            exchange.getRequestBody().readAllBytes(); exchange.sendResponseHeaders(200,bytes.length); exchange.getResponseBody().write(bytes); exchange.close();
        });
        remote.createContext("/redirect-target",exchange -> { redirects.incrementAndGet(); exchange.sendResponseHeaders(200,0); exchange.close(); });
        remote.start();
        try {
            MockEnvironment env=new MockEnvironment().withProperty("SUITE_ENABLED","true").withProperty("SUITE_ORGANIZATION_ID",org)
                    .withProperty("SUITE_ASSOCIAGO_KEY","test-key-at-least-thirty-two-characters")
                    .withProperty("SUITE_ASSOCIAGO_API_URL","http://127.0.0.1:"+remote.getAddress().getPort());
            SuitePeerClient client=new SuitePeerClient(new SuiteConfig(env),json);
            Projection projection=new Projection(1,org,id,1,"Project",null,null,null,null,new Links(null,null,null));
            assertEquals("9",client.publish("associago",projection).localId()); assertEquals(1,puts.get()); assertEquals(1,gets.get());
            remote.removeContext("/api/integrations/v1/peer/projects/");
            remote.createContext("/api/integrations/v1/peer/projects/",exchange -> { exchange.getResponseHeaders().set("Location","/redirect-target"); exchange.sendResponseHeaders(302,-1); exchange.close(); });
            assertEquals("SUITE_PEER_HTTP_302",assertThrows(SuiteException.class,() -> client.publish("associago",projection)).code()); assertEquals(0,redirects.get());
            remote.removeContext("/api/integrations/v1/peer/projects/");
            remote.createContext("/api/integrations/v1/peer/projects/",exchange -> {
                byte[] bytes="x".repeat(70000).getBytes(StandardCharsets.UTF_8); exchange.sendResponseHeaders(200,bytes.length);
                try { exchange.getResponseBody().write(bytes); } finally { exchange.close(); }
            });
            assertEquals(503,assertThrows(SuiteException.class,() -> client.publish("associago",projection)).status());
        } finally { remote.stop(0); }
    }
}
