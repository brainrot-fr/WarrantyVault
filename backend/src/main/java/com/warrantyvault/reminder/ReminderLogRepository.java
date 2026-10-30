package com.warrantyvault.reminder;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
public interface ReminderLogRepository extends JpaRepository<ReminderLog, UUID> {
    boolean existsByItemIdAndUserIdAndReminderDate(UUID itemId, String userId, LocalDate reminderDate);
}
