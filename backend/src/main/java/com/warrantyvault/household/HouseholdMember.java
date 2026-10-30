package com.warrantyvault.household;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "household_member")
public class HouseholdMember {
    @EmbeddedId
    private HouseholdMemberId id;
    @Column(nullable = false, length = 20)
    private String role;
    @Column(name = "joined_at", nullable = false)
    private Instant joinedAt;
    protected HouseholdMember() {}
    public HouseholdMember(UUID householdId, String userId, String role) {
        this.id = new HouseholdMemberId(householdId, userId);
        this.role = role;
        this.joinedAt = Instant.now();
    }
    public HouseholdMemberId getId() { return id; }
    public String getRole() { return role; }
    public Instant getJoinedAt() { return joinedAt; }

    @jakarta.persistence.Embeddable
    public static class HouseholdMemberId implements Serializable {
        @Column(name = "household_id")
        private UUID householdId;
        @Column(name = "user_id", length = 128)
        private String userId;
        protected HouseholdMemberId() {}
        public HouseholdMemberId(UUID householdId, String userId) { this.householdId = householdId; this.userId = userId; }
        public UUID getHouseholdId() { return householdId; }
        public String getUserId() { return userId; }
        @Override public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof HouseholdMemberId that)) return false;
            return Objects.equals(householdId, that.householdId) && Objects.equals(userId, that.userId);
        }
        @Override public int hashCode() { return Objects.hash(householdId, userId); }
    }
}
