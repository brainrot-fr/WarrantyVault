package com.warrantyvault.ocr;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class WarrantyTextParserTest {
    private final WarrantyTextParser parser = new WarrantyTextParser();
    @Test
    void parsesReceiptFieldsFromRecognizedText() {
        OcrResult result = parser.parse("""
            ACME STORE
            Item: Smart Kettle 2000
            Merchant: Acme Home
            Purchase Date: 06/12/2024
            Total: $1,299.99
            2 year limited warranty
            """);
        assertEquals("Smart Kettle 2000", result.productName());
        assertEquals("Acme Home", result.merchant());
        assertEquals(LocalDate.of(2024, 6, 12), result.purchaseDate());
        assertEquals(new BigDecimal("1299.99"), result.purchasePrice());
        assertEquals(24, result.warrantyMonths());
    }

    @Test
    void parsesLabeledCurrencyPriceAndReturnsNullWhenMissing() {
        assertEquals(new BigDecimal("1234.50"), parser.parse("Amount paid: EUR 1.234,50").purchasePrice());
        assertNull(parser.parse("Item: Desk\nWarranty: 1 year").purchasePrice());
    }

    @Test
    void parsesDayFirstBillOfSupplyDateAndDescriptionFields() {
        OcrResult result = parser.parse("""
            Bill of Supply
            Billed From

            Example Appliances Private Limited
            GSTIN: 00AAAAA0000A0AA
            of Supply Date : 25-09-2025
            Description of Gty Gross Weight of Value of goods
            Goods Consignment
            Godrej 244 L Frost Free Fridge 10 500000 grams, 216660
            Double Door 4 Star Convertible Refrigerator
            With 6-in-1 Convertible Freezer
            Food Surface Disinfection (1)
            """);

        assertEquals(LocalDate.of(2025, 9, 25), result.purchaseDate());
        assertEquals("Example Appliances Private Limited", result.merchant());
        assertEquals("Godrej 244 L Frost Free Fridge Double Door 4 Star Convertible Refrigerator With 6-in-1 Convertible Freezer Food Surface Disinfection", result.productName());
        assertEquals("Godrej", result.brand());
    }
}
