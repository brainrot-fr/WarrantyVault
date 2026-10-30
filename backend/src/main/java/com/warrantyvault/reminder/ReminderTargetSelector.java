package com.warrantyvault.reminder;

import com.warrantyvault.household.HouseholdMember;
import com.warrantyvault.user.User;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

@Component
public class ReminderTargetSelector {
    public List<User> select(List<HouseholdMember> members, List<User> users, Set<String> alreadyNotified) {
        Set<String> memberIds = members.stream().map(member -> member.getId().getUserId()).collect(Collectors.toSet());
        return users.stream()
            .filter(user -> memberIds.contains(user.getId()))
            .filter(user -> user.getEmail() != null && !user.getEmail().isBlank())
            .filter(user -> !alreadyNotified.contains(user.getId()))
            .toList();
    }
    public boolean isReminderDate(LocalDate today, LocalDate expiryDate) {
        if (expiryDate == null) return false;
        long days = java.time.temporal.ChronoUnit.DAYS.between(today, expiryDate);
        return days == 30 || days == 7;
    }
}
