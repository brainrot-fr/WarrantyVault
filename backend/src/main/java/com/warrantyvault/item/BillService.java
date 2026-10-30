package com.warrantyvault.item;

import com.warrantyvault.item.Bill;
import com.warrantyvault.ocr.OcrResult;
import com.warrantyvault.ocr.OcrService;
import com.warrantyvault.item.BillRepository;
import com.warrantyvault.storage.SupabaseStorageClient;
import com.warrantyvault.household.HouseholdService;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class BillService {
    public static final long MAX_UPLOAD_BYTES = 5L * 1024 * 1024;
    private static final Pattern SAFE_NAME = Pattern.compile("[^A-Za-z0-9._-]");
    private final BillRepository bills;
    private final HouseholdService households;
    private final SupabaseStorageClient storage;
    private final OcrService ocr;
    public BillService(BillRepository bills, HouseholdService households, SupabaseStorageClient storage, OcrService ocr) {
        this.bills = bills; this.households = households; this.storage = storage; this.ocr = ocr;
    }
    @Transactional(readOnly = true)
    public List<Bill> list(String userId) {
        return bills.findByHouseholdIdIn(households.listFor(userId).stream().map(h -> h.getId()).toList());
    }
    @Transactional
    public Bill upload(UUID householdId, String userId, String filename, String contentType, byte[] bytes) {
        households.requireMember(householdId, userId);
        String path = store(householdId, filename, contentType, bytes);
        String safeName = safeFilename(filename);
        OcrResult result = ocr.process(bytes, contentType);
        Bill bill = new Bill(householdId, userId, path, contentType, safeName);
        bill.updateOcr(result.text(), result.productName(), result.merchant(), result.purchaseDate(), result.warrantyMonths());
        return bills.save(bill);
    }
    public String store(UUID householdId, String filename, String contentType, byte[] bytes) {
        validate(filename, contentType, bytes);
        String safeName = safeFilename(filename);
        String path = householdId + "/" + UUID.randomUUID() + "-" + safeName;
        storage.upload(path, bytes, contentType);
        return path;
    }
    public void validate(String filename, String contentType, byte[] bytes) {
        if (bytes == null || bytes.length == 0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Empty file");
        if (bytes.length > MAX_UPLOAD_BYTES) throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "File exceeds 5 MB");
        if (filename == null || filename.isBlank() || filename.length() > 255)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid filename");
        boolean valid = switch (contentType == null ? "" : contentType.toLowerCase(java.util.Locale.ROOT)) {
            case "application/pdf" -> bytes.length >= 5 && bytes[0] == '%' && bytes[1] == 'P' && bytes[2] == 'D' && bytes[3] == 'F' && bytes[4] == '-';
            case "image/jpeg" -> bytes.length >= 3 && (bytes[0] & 255) == 0xff && (bytes[1] & 255) == 0xd8 && (bytes[2] & 255) == 0xff;
            case "image/png" -> bytes.length >= 8 && (bytes[0] & 255) == 0x89 && bytes[1] == 'P' && bytes[2] == 'N' && bytes[3] == 'G';
            default -> false;
        };
        if (!valid) throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Only valid PDF, JPEG, and PNG files are accepted");
    }
    private String safeFilename(String filename) {
        return SAFE_NAME.matcher(filename.substring(filename.lastIndexOf('/') + 1)).replaceAll("_");
    }
    @Transactional(readOnly = true)
    public Bill get(UUID billId, String userId) {
        List<UUID> ids = households.listFor(userId).stream().map(h -> h.getId()).toList();
        return bills.findByIdAndHouseholdIdIn(billId, ids)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Bill not found"));
    }
    public java.net.URI signedUrl(UUID billId, String userId) { return storage.signedUrl(get(billId, userId).getStoragePath()); }
}
