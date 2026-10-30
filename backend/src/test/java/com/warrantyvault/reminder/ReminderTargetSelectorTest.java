package com.warrantyvault.reminder;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import com.warrantyvault.household.HouseholdMember;
import com.warrantyvault.user.User;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ReminderTargetSelectorTest {
    private final ReminderTargetSelector selector = new ReminderTargetSelector();
    @Test
    void selectsOnlyHouseholdUsersWithoutExistingReminder() {
        UUID household = UUID.randomUUID();
        var members = List.of(new HouseholdMember(household, "user-1", "OWNER"),
                              new HouseholdMember(household, "user-2", "MEMBER"));
        var users = List.of(new User("user-1", "one@example.com", null),
                            new User("user-2", "two@example.com", null),
                            new User("user-3", "other@example.com", null));
        assertEquals(List.of("user-2"), selector.select(members, users, Set.of("user-1")).stream().map(User::getId).toList());
        assertTrue(selector.isReminderDate(LocalDate.of(2025, 1, 1), LocalDate.of(2025, 1, 8)));
        assertTrue(!selector.isReminderDate(LocalDate.of(2025, 1, 1), LocalDate.of(2025, 1, 6)));
    }
}
