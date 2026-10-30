package com.warrantyvault.user;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "app_user")
public class User {
    @Id
    @Column(length = 128)
    private String id;
    @Column(nullable = false, length = 320)
    private String email;
    @Column(name = "display_name", length = 200)
    private String displayName;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected User() {}
    public User(String id, String email, String displayName) {
        this.id = id;
        this.email = email;
        this.displayName = displayName;
        this.createdAt = Instant.now();
        this.updatedAt = this.createdAt;
    }
    public void updateProfile(String email, String displayName) {
        if (email != null && !email.isBlank()) this.email = email;
        if (displayName != null && !displayName.isBlank()) this.displayName = displayName;
        this.updatedAt = Instant.now();
    }
    public String getId() { return id; }
    public String getEmail() { return email; }
    public String getDisplayName() { return displayName; }
}
