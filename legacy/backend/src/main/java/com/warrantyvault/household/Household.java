package com.warrantyvault.household;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "household")
public class Household {
    @Id
    private UUID id;
    @Column(nullable = false, length = 160)
    private String name;
    @Column(name = "created_by", nullable = false, length = 128)
    private String createdBy;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
    protected Household() {}
    public Household(String name, String createdBy) {
        this.id = UUID.randomUUID();
        this.name = name;
        this.createdBy = createdBy;
        this.createdAt = Instant.now();
    }
    public UUID getId() { return id; }
    public String getName() { return name; }
    public String getCreatedBy() { return createdBy; }
}
