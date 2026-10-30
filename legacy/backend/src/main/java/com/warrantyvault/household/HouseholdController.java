package com.warrantyvault.household;

import com.warrantyvault.item.Bill;
import com.warrantyvault.household.Household;
import com.warrantyvault.item.BillService;
import com.warrantyvault.household.HouseholdService;
import com.warrantyvault.reminder.ReminderService;
import com.warrantyvault.claim.ClaimPackService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api")
@Validated
public class HouseholdController {
    private final HouseholdService households;
    private final BillService bills;
    private final ReminderService reminders;
    private final ClaimPackService claims;
    public HouseholdController(HouseholdService households, BillService bills, ReminderService reminders, ClaimPackService claims) {
        this.households = households; this.bills = bills; this.reminders = reminders; this.claims = claims;
    }
    @PostMapping("/households")
    public Household createHousehold(@Valid @RequestBody HouseholdRequest body, @AuthenticationPrincipal Jwt jwt) {
        return households.create(body.name(), jwt.getSubject());
    }
    @GetMapping("/households")
    public List<Household> listHouseholds(@AuthenticationPrincipal Jwt jwt) { return households.listFor(jwt.getSubject()); }
    @GetMapping("/households/{id}/members")
    public List<HouseholdService.MemberView> listHouseholdMembers(@PathVariable UUID id,
                                                                 @AuthenticationPrincipal Jwt jwt) {
        return households.listMembers(id, jwt.getSubject());
    }
    @PostMapping("/households/{id}/invites")
    public HouseholdService.InviteResult invite(@PathVariable UUID id, @Valid @RequestBody InviteRequest body, @AuthenticationPrincipal Jwt jwt) {
        return households.invite(id, body.email(), jwt.getSubject());
    }
    @PostMapping("/households/invites/accept")
    public Household acceptInvite(@Valid @RequestBody AcceptInviteRequest body, @AuthenticationPrincipal Jwt jwt) {
        return households.accept(body.token(), jwt.getSubject());
    }
    @GetMapping("/bills")
    public List<Bill> listBills(@AuthenticationPrincipal Jwt jwt) { return bills.list(jwt.getSubject()); }
    @PostMapping(value = "/households/{householdId}/bills", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Bill upload(@PathVariable UUID householdId, @RequestPart("file") MultipartFile file, @AuthenticationPrincipal Jwt jwt) throws java.io.IOException {
        return bills.upload(householdId, jwt.getSubject(), file.getOriginalFilename(), file.getContentType(), file.getBytes());
    }
    @GetMapping("/bills/{id}")
    public Bill getBill(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) { return bills.get(id, jwt.getSubject()); }
    @GetMapping("/bills/{id}/signed-url")
    public Map<String, URI> signedUrl(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        return Map.of("url", bills.signedUrl(id, jwt.getSubject()));
    }
    @GetMapping("/bills/{id}/claim-pack")
    public ResponseEntity<byte[]> claimPack(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        byte[] pdf = claims.generate(bills.get(id, jwt.getSubject()));
        return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"warranty-claim-" + id + ".pdf\"")
            .contentType(MediaType.APPLICATION_PDF).body(pdf);
    }
    @PostMapping("/internal/run-reminders")
    public Map<String, Integer> runReminders(@RequestHeader("X-Cron-Secret") String secret) {
        return Map.of("sent", reminders.runManually(secret));
    }
    public record HouseholdRequest(@NotBlank String name) {}
    public record InviteRequest(@Email @NotBlank String email) {}
    public record AcceptInviteRequest(@NotBlank String token) {}
}
