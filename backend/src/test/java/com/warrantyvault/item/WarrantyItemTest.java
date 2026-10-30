package com.warrantyvault.item;

import static org.junit.jupiter.api.Assertions.assertEquals;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class WarrantyItemTest {
    @Test
    void computesExpiryFromPurchaseDateAndWarrantyDuration() {
        WarrantyItem item = new WarrantyItem("Laptop", "Maker", "Electronics",
            LocalDate.of(2024, 2, 29), null, 12, null, null, UUID.randomUUID(), "user-id");
        assertEquals(LocalDate.of(2025, 2, 28), item.getExpiryDate());
    }
}
