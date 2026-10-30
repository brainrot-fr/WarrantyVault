package com.warrantyvault.household;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "household_invite")
public class HouseholdInvite {
    @Id private UUID id;
    @Column(name = "household_id", nullable = false) private UUID householdId;
    @Column(nullable = false, length = 320) private String email;
    @Column(name = "token_hash", nullable = false, unique = true, length = 128) private String tokenHash;
    @Column(name = "invited_by", nullable = false, length = 128) private String invitedBy;
    @Column(name = "expires_at", nullable = false) private Instant expiresAt;
    @Column(name = "accepted_at") private Instant acceptedAt;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    protected HouseholdInvite() {}
    public HouseholdInvite(UUID householdId, String email, String tokenHash, String invitedBy, Instant expiresAt) {
        this.id = UUID.randomUUID(); this.householdId = householdId; this.email = email.toLowerCase(java.util.Locale.ROOT);
        this.tokenHash = tokenHash; this.invitedBy = invitedBy; this.expiresAt = expiresAt; this.createdAt = Instant.now();
    }
    public boolean isAcceptable(String email, Instant now) {
        return acceptedAt == null && expiresAt.isAfter(now) && this.email.equalsIgnoreCase(email);
    }
    public void accept() { acceptedAt = Instant.now(); }
    public UUID getHouseholdId() { return householdId; }
    public String getEmail() { return email; }
}
