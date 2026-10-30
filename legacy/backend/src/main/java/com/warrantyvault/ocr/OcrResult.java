package com.warrantyvault.ocr;

import java.time.LocalDate;
import java.math.BigDecimal;

public record OcrResult(String text, String productName, String brand, String category, String merchant,
                        LocalDate purchaseDate, BigDecimal purchasePrice, Integer warrantyMonths) {}
