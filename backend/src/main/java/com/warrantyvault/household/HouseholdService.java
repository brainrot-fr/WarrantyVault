package com.warrantyvault.household;

import com.warrantyvault.household.Household;
import com.warrantyvault.household.HouseholdInvite;
import com.warrantyvault.household.HouseholdMember;
import com.warrantyvault.user.User;
import com.warrantyvault.household.HouseholdInviteRepository;
import com.warrantyvault.household.HouseholdMemberRepository;
import com.warrantyvault.household.HouseholdRepository;
import com.warrantyvault.user.UserRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.Map;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class HouseholdService {
    private static final Logger log = LoggerFactory.getLogger(HouseholdService.class);
    private final HouseholdRepository households;
    private final HouseholdMemberRepository members;
    private final HouseholdInviteRepository invites;
    private final UserRepository users;
    private final int inviteExpiryDays;
    private final JavaMailSender mailSender;
    private final String frontendUrl;
    private final String mailFrom;
    private final SecureRandom random = new SecureRandom();

    public HouseholdService(HouseholdRepository households, HouseholdMemberRepository members,
                            HouseholdInviteRepository invites, UserRepository users,
                            JavaMailSender mailSender,
                            @Value("${app.frontend-url:http://localhost:5173}") String frontendUrl,
                            @Value("${app.mail.from:}") String mailFrom,
                            @Value("${app.invite-expiry-days:7}") int inviteExpiryDays) {
        this.households = households; this.members = members; this.invites = invites;
        this.users = users; this.mailSender = mailSender; this.frontendUrl = frontendUrl.replaceAll("/+$", "");
        this.mailFrom = mailFrom;
        this.inviteExpiryDays = inviteExpiryDays;
    }

    @Transactional
    public Household create(String name, String userId) {
        Household household = households.save(new Household(name.trim(), userId));
        members.save(new HouseholdMember(household.getId(), userId, "OWNER"));
        return household;
    }
    @Transactional(readOnly = true)
    public List<Household> listFor(String userId) {
        return members.findHouseholdIds(userId).stream().map(households::findById).flatMap(java.util.Optional::stream).toList();
    }
    @Transactional(readOnly = true)
    public void requireMember(UUID householdId, String userId) {
        if (!members.existsByIdHouseholdIdAndIdUserId(householdId, userId))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Household access denied");
    }
    @Transactional(readOnly = true)
    public List<MemberView> listMembers(UUID householdId, String userId) {
        requireMember(householdId, userId);
        List<HouseholdMember> householdMembers = members.findByIdHouseholdId(householdId);
        Map<String, User> usersById = users.findByIdIn(
            householdMembers.stream().map(member -> member.getId().getUserId()).toList())
            .stream().collect(java.util.stream.Collectors.toMap(User::getId, user -> user));
        return householdMembers.stream()
            .map(member -> {
                User memberUser = usersById.get(member.getId().getUserId());
                if (memberUser == null) return null;
                return new MemberView(memberUser.getId(), memberUser.getEmail(), memberUser.getDisplayName(),
                    member.getRole(), member.getJoinedAt());
            })
            .filter(java.util.Objects::nonNull)
            .sorted(java.util.Comparator.comparing((MemberView member) -> !member.role().equals("OWNER"))
                .thenComparing(MemberView::email, String.CASE_INSENSITIVE_ORDER))
            .toList();
    }
    @Transactional
    public InviteResult invite(UUID householdId, String email, String userId) {
        requireMember(householdId, userId);
        byte[] bytes = new byte[32]; random.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        HouseholdInvite invite = invites.save(new HouseholdInvite(householdId, email, hash(token), userId,
            Instant.now().plus(inviteExpiryDays, ChronoUnit.DAYS)));
        String inviteUrl = frontendUrl + "/accept-invite?token=" + token;
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setTo(invite.getEmail());
            if (!mailFrom.isBlank()) message.setFrom(mailFrom);
            message.setSubject("You have been invited to a WarrantyVault household");
            message.setText("Accept your WarrantyVault household invitation within " + inviteExpiryDays
                + " days: " + inviteUrl);
            mailSender.send(message);
        } catch (RuntimeException ex) {
            log.error("Could not send household invitation to {}", invite.getEmail(), ex);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Could not send household invitation email", ex);
        }
        return new InviteResult(invite.getEmail(), token, inviteUrl, invite.getHouseholdId(), inviteExpiryDays);
    }
    @Transactional
    public Household accept(String token, String userId) {
        User user = users.findById(userId).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        HouseholdInvite invite = invites.findByTokenHash(hash(token))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Invalid invite"));
        if (!invite.isAcceptable(user.getEmail(), Instant.now()))
            throw new ResponseStatusException(HttpStatus.GONE, "Invite is expired, used, or belongs to another email");
        invite.accept();
        members.save(new HouseholdMember(invite.getHouseholdId(), userId, "MEMBER"));
        return households.findById(invite.getHouseholdId()).orElseThrow();
    }
    private String hash(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException impossible) { throw new IllegalStateException(impossible); }
    }
    public record MemberView(String userId, String email, String displayName, String role, Instant joinedAt) {}
    public record InviteResult(String email, String token, String inviteUrl, UUID householdId, int expiresInDays) {}
}
