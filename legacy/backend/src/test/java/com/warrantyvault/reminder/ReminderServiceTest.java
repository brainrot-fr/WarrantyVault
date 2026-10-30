package com.warrantyvault.reminder;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.warrantyvault.household.HouseholdMember;
import com.warrantyvault.household.HouseholdMemberRepository;
import com.warrantyvault.item.WarrantyItem;
import com.warrantyvault.item.WarrantyItemRepository;
import com.warrantyvault.user.User;
import com.warrantyvault.user.UserRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

class ReminderServiceTest {
    @Test
    void sendsOnlyThirtyAndSevenDayItemRemindersAndDeduplicatesPerItemAndUser() {
        WarrantyItemRepository items = org.mockito.Mockito.mock(WarrantyItemRepository.class);
        HouseholdMemberRepository members = org.mockito.Mockito.mock(HouseholdMemberRepository.class);
        ReminderLogRepository logs = org.mockito.Mockito.mock(ReminderLogRepository.class);
        UserRepository users = org.mockito.Mockito.mock(UserRepository.class);
        JavaMailSender mail = org.mockito.Mockito.mock(JavaMailSender.class);
        ReminderTargetSelector selector = new ReminderTargetSelector();
        LocalDate today = LocalDate.now();
        UUID householdId = UUID.randomUUID();
        WarrantyItem thirtyDayItem = item(householdId, "Coffee maker", today.plusDays(30));
        WarrantyItem sevenDayItem = item(householdId, "Vacuum", today.plusDays(7));
        WarrantyItem notDueItem = item(householdId, "Lamp", today.plusDays(14));
        when(items.findByExpiryDateBetween(today, today.plusDays(30)))
            .thenReturn(List.of(thirtyDayItem, sevenDayItem, notDueItem));

        List<HouseholdMember> householdMembers = List.of(
            new HouseholdMember(householdId, "owner", "OWNER"),
            new HouseholdMember(householdId, "member", "MEMBER"));
        List<User> householdUsers = List.of(
            new User("owner", "owner@example.com", "Owner"),
            new User("member", "member@example.com", "Member"));
        when(members.findByIdHouseholdId(householdId)).thenReturn(householdMembers);
        when(users.findAllById(List.of("owner", "member"))).thenReturn(householdUsers);
        when(logs.existsByItemIdAndUserIdAndReminderDate(thirtyDayItem.getId(), "owner", today)).thenReturn(true);
        when(logs.save(any(ReminderLog.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ReminderService service = new ReminderService(items, members, logs, users, selector, mail,
            "", "https://app.example", "");
        assertEquals(3, service.sendDueReminders());

        ArgumentCaptor<SimpleMailMessage> messages = ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(mail, org.mockito.Mockito.times(3)).send(messages.capture());
        assertEquals(List.of("member@example.com", "owner@example.com", "member@example.com"),
            messages.getAllValues().stream().map(message -> message.getTo()[0]).toList());
        ArgumentCaptor<ReminderLog> savedLogs = ArgumentCaptor.forClass(ReminderLog.class);
        verify(logs, org.mockito.Mockito.times(3)).save(savedLogs.capture());
        assertEquals(List.of(thirtyDayItem.getId(), sevenDayItem.getId(), sevenDayItem.getId()),
            savedLogs.getAllValues().stream().map(ReminderLog::getItemId).toList());
    }

    private WarrantyItem item(UUID householdId, String name, LocalDate expiryDate) {
        return new WarrantyItem(name, null, null, expiryDate.minusMonths(12), null, 12,
            null, null, householdId, "owner");
    }
}
