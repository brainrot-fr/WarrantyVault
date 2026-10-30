package com.warrantyvault.item;

import com.warrantyvault.item.WarrantyItem;
import com.warrantyvault.ocr.OcrResult;
import com.warrantyvault.ocr.OcrService;
import com.warrantyvault.item.WarrantyItemRepository;
import com.warrantyvault.storage.SupabaseStorageClient;
import com.warrantyvault.household.HouseholdService;
import java.math.BigDecimal;
import java.net.URI;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class WarrantyItemService {
    private final WarrantyItemRepository items;
    private final HouseholdService households;
    private final BillService billFiles;
    private final SupabaseStorageClient storage;
    private final OcrService ocr;

    public WarrantyItemService(WarrantyItemRepository items, HouseholdService households, BillService billFiles,
                               SupabaseStorageClient storage, OcrService ocr) {
        this.items = items;
        this.households = households;
        this.billFiles = billFiles;
        this.storage = storage;
        this.ocr = ocr;
    }

    @Transactional(readOnly = true)
    public List<WarrantyItem> list(String userId) {
        return items.findByHouseholdIdIn(households.listFor(userId).stream().map(h -> h.getId()).toList());
    }

    @Transactional
    public WarrantyItem create(ItemData data, String userId, Upload upload) {
        households.requireMember(data.householdId(), userId);
        String path = upload == null ? null : billFiles.store(data.householdId(), upload.filename(), upload.contentType(), upload.bytes());
        return items.save(new WarrantyItem(data.name(), data.brand(), data.category(), data.purchaseDate(),
            data.purchasePrice(), data.warrantyMonths(), path, data.notes(), data.householdId(), userId));
    }

    @Transactional
    public WarrantyItem update(UUID id, ItemData data, String userId) {
        WarrantyItem item = get(id, userId);
        if (data.householdId() != null && !data.householdId().equals(item.getHouseholdId())) {
            households.requireMember(data.householdId(), userId);
            item.setHouseholdId(data.householdId());
        }
        item.update(data.name(), data.brand(), data.category(), data.purchaseDate(), data.purchasePrice(),
            data.warrantyMonths(), data.notes());
        return items.save(item);
    }

    @Transactional
    public WarrantyItem uploadBill(UUID id, String userId, Upload upload) {
        WarrantyItem item = get(id, userId);
        String replacement = billFiles.store(item.getHouseholdId(), upload.filename(), upload.contentType(), upload.bytes());
        String previous = item.getBillPath();
        item.updateBillPath(replacement);
        WarrantyItem saved = items.save(item);
        if (previous != null) storage.delete(previous);
        return saved;
    }

    @Transactional
    public void delete(UUID id, String userId) {
        WarrantyItem item = get(id, userId);
        items.delete(item);
        if (item.getBillPath() != null) storage.delete(item.getBillPath());
    }

    @Transactional(readOnly = true)
    public WarrantyItem get(UUID id, String userId) {
        List<UUID> householdIds = households.listFor(userId).stream().map(h -> h.getId()).toList();
        return items.findByIdAndHouseholdIdIn(id, householdIds)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Item not found"));
    }

    @Transactional(readOnly = true)
    public URI billUrl(UUID id, String userId) {
        WarrantyItem item = get(id, userId);
        if (item.getBillPath() == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Item has no bill");
        return storage.signedUrl(item.getBillPath());
    }

    public OcrResult recognize(UUID householdId, String userId, Upload upload) {
        households.requireMember(householdId, userId);
        billFiles.validate(upload.filename(), upload.contentType(), upload.bytes());
        return ocr.process(upload.bytes(), upload.contentType());
    }

    public OcrResult recognizeForAuthenticatedUser(Upload upload) {
        billFiles.validate(upload.filename(), upload.contentType(), upload.bytes());
        return ocr.process(upload.bytes(), upload.contentType());
    }

    @Transactional(readOnly = true)
    public Dashboard dashboard(String userId) {
        List<WarrantyItem> owned = list(userId);
        LocalDate today = LocalDate.now();
        long expired = owned.stream().filter(item -> item.getExpiryDate() != null && item.getExpiryDate().isBefore(today)).count();
        long expiringSoon = owned.stream().filter(item -> item.getExpiryDate() != null
            && !item.getExpiryDate().isBefore(today) && !item.getExpiryDate().isAfter(today.plusDays(30))).count();
        long active = owned.stream().filter(item -> item.getExpiryDate() == null || !item.getExpiryDate().isBefore(today)).count();
        return new Dashboard(owned.size(), active, expiringSoon, expired, owned);
    }

    public record ItemData(String name, String brand, String category, LocalDate purchaseDate, BigDecimal purchasePrice,
                           Integer warrantyMonths, String notes, UUID householdId) {}
    public record Upload(String filename, String contentType, byte[] bytes) {}
    public record Dashboard(long totalItems, long activeWarranties, long expiringSoon, long expiredWarranties,
                            List<WarrantyItem> items) {}
}
