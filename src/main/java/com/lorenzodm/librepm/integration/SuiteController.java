package com.lorenzodm.librepm.integration;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.converter.HttpMessageNotReadableException;
import java.util.List;
import java.util.Map;
import static com.lorenzodm.librepm.integration.SuiteModels.*;

@RestController
@RequestMapping("/api/integrations/v1")
public class SuiteController {
    private final SuiteService service;
    private final SuiteActorResolver actors;
    SuiteController(SuiteService service,SuiteActorResolver actors) { this.service=service; this.actors=actors; }
    @GetMapping("/projects") List<Context> list(HttpServletRequest req) { return service.list(actors.resolve(req)); }
    @PostMapping("/projects") Context register(@RequestBody Registration registration,HttpServletRequest req) {
        if (registration==null) throw SuiteException.invalid("Progetto richiesto.");
        return service.register(registration.librepmProjectId(),actors.resolve(req));
    }
    @GetMapping("/projects/{id}") Context get(@PathVariable String id,HttpServletRequest req) { return service.get(id,actors.resolve(req)); }
    @PostMapping("/projects/{id}/sync") Context sync(@PathVariable String id,HttpServletRequest req) { return service.sync(id,actors.resolve(req)); }
    @GetMapping("/selection") Selection selection(HttpServletRequest req) { return service.selection(actors.resolve(req)); }
    @PutMapping("/selection") Selection select(@RequestBody Selection selection,HttpServletRequest req) {
        if (selection==null) throw SuiteException.invalid("Progetto richiesto.");
        return service.select(selection.suiteProjectId(),actors.resolve(req));
    }
    @GetMapping("/peer/projects") List<Context> peerList() { return service.list(null); }
    @GetMapping("/peer/projects/{id}") Context peerGet(@PathVariable String id) { return service.get(id,null); }
    @PostMapping("/peer/projects") Context peerImport(@RequestBody Seed seed,HttpServletRequest req) { return service.importSeed(seed,(String) req.getAttribute("suite.peer")); }
    @PostMapping("/peer/projects/{id}/sync") Context peerSync(@PathVariable String id) { return service.sync(id,null); }
    @PostMapping("/peer/projects/{id}/instances") Context peerLink(@PathVariable String id,@RequestBody Source source,HttpServletRequest req) { return service.link(id,source,(String) req.getAttribute("suite.peer")); }
}

@RestControllerAdvice(assignableTypes=SuiteController.class)
@org.springframework.core.annotation.Order(org.springframework.core.Ordered.HIGHEST_PRECEDENCE)
class SuiteErrors {
    @ExceptionHandler(SuiteException.class)
    ResponseEntity<Map<String,String>> handle(SuiteException e) { return ResponseEntity.status(e.status()).body(Map.of("code",e.code(),"message",e.getMessage())); }
    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<Map<String,String>> malformed() { return ResponseEntity.badRequest().body(Map.of("code","SUITE_INVALID_INPUT","message","Richiesta non valida.")); }
}
