package com.warrantyvault.reminder;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "reminder_log")
public class ReminderLog {
    @Id private UUID id;
    @Column(name = "bill_id") private UUID billId;
    @Column(name = "item_id") private UUID itemId;
    @Column(name = "user_id", nullable = false, length = 128) private String userId;
    @Column(name = "reminder_date", nullable = false) private LocalDate reminderDate;
    @Column(name = "sent_at", nullable = false) private Instant sentAt;
    protected ReminderLog() {}
    public ReminderLog(UUID itemId, String userId, LocalDate reminderDate) {
        this.id = UUID.randomUUID(); this.itemId = itemId; this.userId = userId;
        this.reminderDate = reminderDate; this.sentAt = Instant.now();
    }
    public UUID getItemId() { return itemId; }
    public String getUserId() { return userId; }
    public LocalDate getReminderDate() { return reminderDate; }
}
