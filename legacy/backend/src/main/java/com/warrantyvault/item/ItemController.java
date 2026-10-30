package com.warrantyvault.item;

import com.warrantyvault.item.WarrantyItem;
import com.warrantyvault.ocr.OcrResult;
import com.warrantyvault.claim.ClaimPackService;
import com.warrantyvault.item.WarrantyItemService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import java.io.IOException;
import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/items")
@Validated
public class ItemController {
    private final WarrantyItemService items;
    private final ClaimPackService claims;

    public ItemController(WarrantyItemService items, ClaimPackService claims) {
        this.items = items;
        this.claims = claims;
    }

    @GetMapping
    public List<WarrantyItem> list(@AuthenticationPrincipal Jwt jwt) {
        return items.list(jwt.getSubject());
    }

    @GetMapping("/{id}")
    public WarrantyItem get(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        return items.get(id, jwt.getSubject());
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public WarrantyItem create(@Valid @RequestBody ItemRequest request, @AuthenticationPrincipal Jwt jwt) {
        return items.create(request.toData(), jwt.getSubject(), null);
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public WarrantyItem createWithBill(@Valid @RequestPart("item") ItemRequest request,
                                       @RequestPart("bill") MultipartFile file,
                                       @AuthenticationPrincipal Jwt jwt) throws IOException {
        return items.create(request.toData(), jwt.getSubject(), upload(file));
    }

    @PutMapping("/{id}")
    public WarrantyItem update(@PathVariable UUID id, @Valid @RequestBody ItemRequest request,
                               @AuthenticationPrincipal Jwt jwt) {
        return items.update(id, request.toData(), jwt.getSubject());
    }

    @PostMapping(value = "/{id}/bill", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public WarrantyItem uploadBill(@PathVariable UUID id, @RequestPart("file") MultipartFile file,
                                   @AuthenticationPrincipal Jwt jwt) throws IOException {
        return items.uploadBill(id, jwt.getSubject(), upload(file));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        items.delete(id, jwt.getSubject());
    }

    @GetMapping("/dashboard")
    public WarrantyItemService.Dashboard dashboard(@AuthenticationPrincipal Jwt jwt) {
        return items.dashboard(jwt.getSubject());
    }

    @PostMapping(value = "/ocr", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public OcrResult recognize(@RequestPart(value = "file", required = false) MultipartFile file,
                               @RequestPart(value = "bill", required = false) MultipartFile bill,
                               @RequestParam(required = false) UUID householdId,
                               @AuthenticationPrincipal Jwt jwt) throws IOException {
        MultipartFile input = file != null ? file : bill;
        if (input == null || input.isEmpty())
            throw new org.springframework.web.server.ResponseStatusException(HttpStatus.BAD_REQUEST, "A receipt file is required");
        WarrantyItemService.Upload upload = upload(input);
        return householdId == null
            ? items.recognizeForAuthenticatedUser(upload)
            : items.recognize(householdId, jwt.getSubject(), upload);
    }

    @GetMapping("/{id}/bill-url")
    public Map<String, URI> billUrl(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        return Map.of("url", items.billUrl(id, jwt.getSubject()));
    }

    @GetMapping("/{id}/claim-pack")
    public ResponseEntity<byte[]> claimPack(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        WarrantyItem item = items.get(id, jwt.getSubject());
        byte[] pdf = claims.generate(item);
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"warranty-claim-" + id + ".pdf\"")
            .contentType(MediaType.APPLICATION_PDF)
            .body(pdf);
    }

    private WarrantyItemService.Upload upload(MultipartFile file) throws IOException {
        return new WarrantyItemService.Upload(file.getOriginalFilename(), file.getContentType(), file.getBytes());
    }

    public record ItemRequest(@NotBlank String name, String brand, String category, java.time.LocalDate purchaseDate,
                              @PositiveOrZero java.math.BigDecimal purchasePrice,
                              @PositiveOrZero Integer warrantyMonths, String notes, @NotNull UUID householdId) {
        WarrantyItemService.ItemData toData() {
            return new WarrantyItemService.ItemData(name, brand, category, purchaseDate, purchasePrice,
                warrantyMonths, notes, householdId);
        }
    }
}
