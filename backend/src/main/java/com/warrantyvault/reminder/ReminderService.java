package com.warrantyvault.reminder;

import com.warrantyvault.item.WarrantyItem;
import com.warrantyvault.household.HouseholdMember;
import com.warrantyvault.reminder.ReminderLog;
import com.warrantyvault.user.User;
import com.warrantyvault.item.WarrantyItemRepository;
import com.warrantyvault.household.HouseholdMemberRepository;
import com.warrantyvault.reminder.ReminderLogRepository;
import com.warrantyvault.user.UserRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

@Service
public class ReminderService {
    private static final Logger log = LoggerFactory.getLogger(ReminderService.class);
    private final WarrantyItemRepository items;
    private final HouseholdMemberRepository members;
    private final ReminderLogRepository logs;
    private final UserRepository users;
    private final ReminderTargetSelector selector;
    private final JavaMailSender mailSender;
    private final String secret;
    private final String frontendUrl;
    private final String mailFrom;
    public ReminderService(WarrantyItemRepository items, HouseholdMemberRepository members, ReminderLogRepository logs,
                           UserRepository users, ReminderTargetSelector selector, JavaMailSender mailSender,
                           @Value("${app.reminders.secret:}") String secret,
                           @Value("${app.frontend-url:http://localhost:5173}") String frontendUrl,
                           @Value("${app.mail.from:}") String mailFrom) {
        this.items = items; this.members = members; this.logs = logs; this.users = users;
        this.selector = selector; this.mailSender = mailSender; this.secret = secret; this.frontendUrl = frontendUrl;
        this.mailFrom = mailFrom;
    }
    @Scheduled(cron = "${app.reminders.cron:0 0 9 * * *}")
    public void scheduledRun() {
        sendDueReminders();
    }
    public int runManually(String suppliedSecret) {
        if (!StringUtils.hasText(secret) || suppliedSecret == null || !MessageDigest.isEqual(
            secret.getBytes(StandardCharsets.UTF_8), suppliedSecret.getBytes(StandardCharsets.UTF_8)))
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid cron secret");
        return sendDueReminders();
    }
    @Transactional
    public int sendDueReminders() {
        LocalDate today = LocalDate.now();
        List<WarrantyItem> due = items.findByExpiryDateBetween(today, today.plusDays(30));
        int sent = 0;
        for (WarrantyItem item : due) {
            if (!selector.isReminderDate(today, item.getExpiryDate())) continue;
            List<HouseholdMember> householdMembers = members.findByIdHouseholdId(item.getHouseholdId());
            List<String> ids = householdMembers.stream().map(m -> m.getId().getUserId()).toList();
            List<User> householdUsers = users.findAllById(ids);
            Set<String> already = new HashSet<>();
            for (User user : householdUsers) {
                if (logs.existsByItemIdAndUserIdAndReminderDate(item.getId(), user.getId(), today)) already.add(user.getId());
            }
            List<User> targets = selector.select(householdMembers, householdUsers, already);
            for (User user : targets) {
                try {
                    SimpleMailMessage message = new SimpleMailMessage();
                    message.setTo(user.getEmail());
                    if (!mailFrom.isBlank()) message.setFrom(mailFrom);
                    message.setSubject("Warranty ending soon: " + item.getName());
                    message.setText("Warranty for " + item.getName() + " expires on " + item.getExpiryDate()
                        + ". Review the item in WarrantyVault: " + frontendUrl);
                    mailSender.send(message);
                    logs.save(new ReminderLog(item.getId(), user.getId(), today));
                    sent++;
                } catch (RuntimeException ex) {
                    log.error("Could not send warranty reminder for item {} to user {}", item.getId(), user.getId(), ex);
                }
            }
        }
        return sent;
    }
}
