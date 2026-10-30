package com.lorenzodm.librepm.integration;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;

/** Wire contract shared with AssociaGo and Bandi; no personal records cross this boundary. */
public final class SuiteModels {
    private SuiteModels() {}
    public record Money(String amount, String currency) {}
    public record Source(String system, String entity, String localId, String revision) {}
    public record Seed(Integer schemaVersion, String organizationId, Source source, String title,
                       String description, Money plannedBudget, String projectDeadline, String actorSubject) {}
    public record Links(String librepm, String associago, String bandi) {}
    public record Instance(String system, String entity, String localId) {}
    public record PeerState(String system, String status, String lastSuccessAt, String errorCode, String errorMessage) {}
    public record Projection(int schemaVersion, String organizationId, String suiteProjectId, long sourceVersion,
                             String title, String description, Money plannedBudget, String projectDeadline,
                             String targetLocalId, Links links) {}
    public record Snapshot(Integer schemaVersion, String organizationId, String suiteProjectId, String system,
                           String localId, Long sourceVersion, JsonNode financial, JsonNode workforce, JsonNode preparation) {}
    public record Context(int schemaVersion, String organizationId, String suiteProjectId, String title,
                          String description, long version, List<Instance> instances, Links links,
                          List<PeerState> sync, JsonNode financial, JsonNode workforce, JsonNode preparation) {}
    public record Registration(String librepmProjectId) {}
    public record Selection(String suiteProjectId) {}
}
