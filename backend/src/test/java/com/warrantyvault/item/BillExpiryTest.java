package com.warrantyvault.item;

import static org.junit.jupiter.api.Assertions.assertEquals;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class BillExpiryTest {
    @Test
    void calculatesExpiryUsingCalendarMonths() {
        assertEquals(LocalDate.of(2025, 2, 28), Bill.WarrantyDates.expiry(LocalDate.of(2024, 2, 29), 12));
        assertEquals(LocalDate.of(2025, 8, 31), Bill.WarrantyDates.expiry(LocalDate.of(2025, 5, 31), 3));
    }
}
