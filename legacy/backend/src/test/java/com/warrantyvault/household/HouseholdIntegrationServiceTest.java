package com.warrantyvault.household;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.warrantyvault.household.HouseholdInvite;
import com.warrantyvault.household.HouseholdMember;
import com.warrantyvault.user.User;
import com.warrantyvault.household.HouseholdInviteRepository;
import com.warrantyvault.household.HouseholdMemberRepository;
import com.warrantyvault.household.HouseholdRepository;
import com.warrantyvault.user.UserRepository;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import org.mockito.ArgumentCaptor;

class HouseholdIntegrationServiceTest {
    private final HouseholdRepository households = org.mockito.Mockito.mock(HouseholdRepository.class);
    private final HouseholdMemberRepository members = org.mockito.Mockito.mock(HouseholdMemberRepository.class);
    private final HouseholdInviteRepository invites = org.mockito.Mockito.mock(HouseholdInviteRepository.class);
    private final UserRepository users = org.mockito.Mockito.mock(UserRepository.class);
    private final JavaMailSender mail = org.mockito.Mockito.mock(JavaMailSender.class);
    private final HouseholdService service = new HouseholdService(
        households, members, invites, users, mail, "https://warranty.example/", "noreply@example.com", 7);

    @Test
    void listsMembersOnlyForAuthorizedHouseholdUserIncludingRoles() {
        UUID householdId = UUID.randomUUID();
        when(members.existsByIdHouseholdIdAndIdUserId(householdId, "owner")).thenReturn(true);
        when(members.findByIdHouseholdId(householdId)).thenReturn(List.of(
            new HouseholdMember(householdId, "owner", "OWNER"),
            new HouseholdMember(householdId, "member", "MEMBER")));
        when(users.findByIdIn(List.of("owner", "member"))).thenReturn(List.of(
            new User("owner", "owner@example.com", "Owner"),
            new User("member", "member@example.com", "Member")));

        List<HouseholdService.MemberView> result = service.listMembers(householdId, "owner");

        assertEquals(List.of("OWNER", "MEMBER"), result.stream().map(HouseholdService.MemberView::role).toList());
        assertEquals(List.of("owner@example.com", "member@example.com"),
            result.stream().map(HouseholdService.MemberView::email).toList());

        when(members.existsByIdHouseholdIdAndIdUserId(householdId, "outsider")).thenReturn(false);
        org.junit.jupiter.api.Assertions.assertThrows(ResponseStatusException.class,
            () -> service.listMembers(householdId, "outsider"));
    }

    @Test
    void emailsFrontendAcceptInviteLinkAndReturnsSameSingleUseToken() {
        UUID householdId = UUID.randomUUID();
        when(members.existsByIdHouseholdIdAndIdUserId(householdId, "owner")).thenReturn(true);
        when(invites.save(any(HouseholdInvite.class))).thenAnswer(invocation -> invocation.getArgument(0));

        HouseholdService.InviteResult result = service.invite(householdId, "guest@example.com", "owner");

        assertTrue(result.inviteUrl().startsWith("https://warranty.example/accept-invite?token="));
        String urlToken = result.inviteUrl().substring(result.inviteUrl().indexOf("token=") + "token=".length());
        assertEquals(result.token(), urlToken);
        ArgumentCaptor<SimpleMailMessage> message = ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(mail).send(message.capture());
        assertEquals("guest@example.com", message.getValue().getTo()[0]);
        assertTrue(message.getValue().getText().contains(result.inviteUrl()));
    }

    @Test
    void reportsInviteFailureWhenEmailCannotBeSent() {
        UUID householdId = UUID.randomUUID();
        when(members.existsByIdHouseholdIdAndIdUserId(householdId, "owner")).thenReturn(true);
        when(invites.save(any(HouseholdInvite.class))).thenAnswer(invocation -> invocation.getArgument(0));
        org.mockito.Mockito.doThrow(new IllegalStateException("SMTP unavailable"))
            .when(mail).send(any(SimpleMailMessage.class));

        ResponseStatusException error = org.junit.jupiter.api.Assertions.assertThrows(ResponseStatusException.class,
            () -> service.invite(householdId, "guest@example.com", "owner"));

        assertEquals(HttpStatus.BAD_GATEWAY, error.getStatusCode());
    }
}
