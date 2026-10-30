package com.warrantyvault.item;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "warranty_item")
public class WarrantyItem {
    @Id
    private UUID id;
    @Column(nullable = false, length = 240)
    private String name;
    @Column(length = 200)
    private String brand;
    @Column(length = 120)
    private String category;
    @Column(name = "purchase_date")
    private LocalDate purchaseDate;
    @Column(name = "purchase_price", precision = 12, scale = 2)
    private BigDecimal purchasePrice;
    @Column(name = "warranty_months")
    private Integer warrantyMonths;
    @Column(name = "expiry_date")
    private LocalDate expiryDate;
    @Column(name = "bill_path", length = 700)
    private String billPath;
    @Column(columnDefinition = "text")
    private String notes;
    @Column(name = "household_id", nullable = false)
    private UUID householdId;
    @Column(name = "created_by", nullable = false, length = 128)
    private String createdBy;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected WarrantyItem() {}

    public WarrantyItem(String name, String brand, String category, LocalDate purchaseDate, BigDecimal purchasePrice,
                        Integer warrantyMonths, String billPath, String notes, UUID householdId, String createdBy) {
        this.id = UUID.randomUUID();
        this.name = name;
        this.brand = brand;
        this.category = category;
        this.purchaseDate = purchaseDate;
        this.purchasePrice = purchasePrice;
        this.warrantyMonths = warrantyMonths;
        this.billPath = billPath;
        this.notes = notes;
        this.householdId = householdId;
        this.createdBy = createdBy;
        this.createdAt = Instant.now();
        this.updatedAt = createdAt;
        recalculateExpiry();
    }

    public void update(String name, String brand, String category, LocalDate purchaseDate, BigDecimal purchasePrice,
                       Integer warrantyMonths, String notes) {
        this.name = name;
        this.brand = brand;
        this.category = category;
        this.purchaseDate = purchaseDate;
        this.purchasePrice = purchasePrice;
        this.warrantyMonths = warrantyMonths;
        this.notes = notes;
        this.updatedAt = Instant.now();
        recalculateExpiry();
    }

    public void setBillPath(String billPath) {
        this.billPath = billPath;
        this.updatedAt = Instant.now();
    }

    public void setHouseholdId(UUID householdId) {
        this.householdId = householdId;
        this.updatedAt = Instant.now();
    }

    public void updateBillPath(String billPath) {
        this.billPath = billPath;
        this.updatedAt = Instant.now();
    }

    @PrePersist
    @PreUpdate
    private void recalculateExpiry() {
        expiryDate = purchaseDate == null || warrantyMonths == null ? null : purchaseDate.plusMonths(warrantyMonths);
    }

    public UUID getId() { return id; }
    public String getName() { return name; }
    public String getBrand() { return brand; }
    public String getCategory() { return category; }
    public LocalDate getPurchaseDate() { return purchaseDate; }
    public BigDecimal getPurchasePrice() { return purchasePrice; }
    public Integer getWarrantyMonths() { return warrantyMonths; }
    public LocalDate getExpiryDate() { return expiryDate; }
    public String getBillPath() { return billPath; }
    public String getNotes() { return notes; }
    public UUID getHouseholdId() { return householdId; }
    public String getCreatedBy() { return createdBy; }
}
