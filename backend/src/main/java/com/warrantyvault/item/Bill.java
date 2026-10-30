package com.warrantyvault.item;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "bill")
public class Bill {
    @Id private UUID id;
    @Column(name = "household_id", nullable = false) private UUID householdId;
    @Column(name = "uploaded_by", nullable = false, length = 128) private String uploadedBy;
    @Column(name = "product_name", length = 240) private String productName;
    @Column(length = 240) private String merchant;
    @Column(name = "purchase_date") private LocalDate purchaseDate;
    @Column(name = "warranty_months") private Integer warrantyMonths;
    @Column(name = "warranty_expires_at") private LocalDate warrantyExpiresAt;
    @Column(name = "storage_path", nullable = false, length = 700) private String storagePath;
    @Column(name = "content_type", nullable = false, length = 100) private String contentType;
    @Column(name = "original_filename", nullable = false, length = 255) private String originalFilename;
    @Column(name = "ocr_text", columnDefinition = "text") private String ocrText;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;
    protected Bill() {}
    public Bill(UUID householdId, String uploadedBy, String storagePath, String contentType, String originalFilename) {
        this.id = UUID.randomUUID(); this.householdId = householdId; this.uploadedBy = uploadedBy;
        this.storagePath = storagePath; this.contentType = contentType; this.originalFilename = originalFilename;
        this.createdAt = Instant.now(); this.updatedAt = this.createdAt;
    }
    public void updateOcr(String text, String productName, String merchant, LocalDate purchaseDate, Integer warrantyMonths) {
        this.ocrText = text;
        if (productName != null) this.productName = productName;
        if (merchant != null) this.merchant = merchant;
        if (purchaseDate != null) this.purchaseDate = purchaseDate;
        if (warrantyMonths != null) {
            this.warrantyMonths = warrantyMonths;
            this.warrantyExpiresAt = purchaseDate == null ? null : WarrantyDates.expiry(purchaseDate, warrantyMonths);
        }
        this.updatedAt = Instant.now();
    }
    public UUID getId() { return id; }
    public UUID getHouseholdId() { return householdId; }
    public String getProductName() { return productName; }
    public String getMerchant() { return merchant; }
    public LocalDate getPurchaseDate() { return purchaseDate; }
    public Integer getWarrantyMonths() { return warrantyMonths; }
    public LocalDate getWarrantyExpiresAt() { return warrantyExpiresAt; }
    public String getStoragePath() { return storagePath; }
    public String getContentType() { return contentType; }
    public String getOriginalFilename() { return originalFilename; }
    public String getOcrText() { return ocrText; }

    public static class WarrantyDates {
        private WarrantyDates() {}
        public static LocalDate expiry(LocalDate purchaseDate, int warrantyMonths) {
            return purchaseDate.plusMonths(warrantyMonths);
        }
    }
}
