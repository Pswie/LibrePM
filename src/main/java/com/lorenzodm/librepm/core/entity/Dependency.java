package com.lorenzodm.librepm.core.entity;

import jakarta.persistence.*;

/**
 * Represents a dependency between two tasks, forming the basis of the advanced planning model.
 *
 * @author Lorenzo DM
 * @since 1.0.0
 * @version 1.0.0
 */
@Entity
@Table(name = "dependencies", indexes = {
    @Index(name = "idx_dependency_predecessor", columnList = "predecessor_id"),
    @Index(name = "idx_dependency_successor", columnList = "successor_id")
})
public class Dependency extends BaseSyncEntity {

    public enum DependencyType {
        FINISH_TO_START,
        START_TO_START,
        FINISH_TO_FINISH,
        START_TO_FINISH
    }

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "predecessor_id", nullable = false)
    private Task predecessor;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "successor_id", nullable = false)
    private Task successor;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DependencyType type;

    // `lag` e `lead` sono parole riservate di MySQL 8 (sono funzioni finestra):
    // senza virgolette il CREATE TABLE è un errore di sintassi. Gli apici inversi
    // dicono a Hibernate «identificatore quotato» e ogni dialetto ci mette le
    // proprie virgolette. Il nome fisico non cambia, quindi i database SQLite già
    // in uso e la migrazione V22 restano validi.
    @Column(name = "`lag`")
    private Integer lag; // In minutes (positive = delay successor)

    @Column(name = "`lead`")
    private Integer lead; // In minutes (positive = overlap/advance successor)

    public Dependency() {
        super();
    }

    // Getters and Setters
    public Task getPredecessor() { return predecessor; }
    public void setPredecessor(Task predecessor) { this.predecessor = predecessor; }
    public Task getSuccessor() { return successor; }
    public void setSuccessor(Task successor) { this.successor = successor; }
    public DependencyType getType() { return type; }
    public void setType(DependencyType type) { this.type = type; }
    public Integer getLag() { return lag; }
    public void setLag(Integer lag) { this.lag = lag; }
    public Integer getLead() { return lead; }
    public void setLead(Integer lead) { this.lead = lead; }
}
