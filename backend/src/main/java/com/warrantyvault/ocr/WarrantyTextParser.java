package com.warrantyvault.ocr;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.math.BigDecimal;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

@Component
public class WarrantyTextParser {
    private static final Pattern DURATION = Pattern.compile("(?i)(\\d{1,2})\\s*[- ]?(year|yr|month|mo)s?\\s+(?:limited\\s+)?warrant(?:y|ee)");
    private static final Pattern DATE = Pattern.compile("\\b(\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4}|\\d{4}-\\d{2}-\\d{2})\\b");
    private static final Pattern PRICE = Pattern.compile(
        "(?i)\\b(?:grand\\s+total|total(?:\\s+paid|\\s+amount)?|amount\\s+paid|purchase\\s+price|price)\\b\\s*[:#=\\-]?\\s*(?:(?:USD|CAD|AUD|EUR|GBP|INR)\\s*)?(?:[$€£₹]\\s*)?([0-9][0-9.,]*)(?:\\s*(?:USD|CAD|AUD|EUR|GBP|INR))?");
    private static final List<DateTimeFormatter> FORMATS = List.of(
        DateTimeFormatter.ofPattern("M/d/uuuu"), DateTimeFormatter.ofPattern("M-d-uuuu"),
        DateTimeFormatter.ISO_LOCAL_DATE);
    public OcrResult parse(String text) {
        String clean = text == null ? "" : text;
        Integer months = null;
        Matcher duration = DURATION.matcher(clean);
        if (duration.find()) {
            int value = Integer.parseInt(duration.group(1));
            months = duration.group(2).toLowerCase(Locale.ROOT).startsWith("year") ||
                duration.group(2).toLowerCase(Locale.ROOT).startsWith("yr") ? value * 12 : value;
        } else if (Pattern.compile("(?i)warrant(?:y|ee)\\s*[:\\-]?\\s*(\\d{1,2})\\s*(?:yr|year)s?").matcher(clean).find()) {
            Matcher m = Pattern.compile("(?i)warrant(?:y|ee)\\s*[:\\-]?\\s*(\\d{1,2})\\s*(?:yr|year)s?").matcher(clean);
            if (m.find()) months = Integer.parseInt(m.group(1)) * 12;
        }
        LocalDate purchaseDate = null;
        Matcher dates = DATE.matcher(clean);
        while (dates.find() && purchaseDate == null) {
            purchaseDate = parseDate(dates.group(1));
        }
        String product = firstMatchingLine(clean, "(?i)(?:item|product|model)\\s*[:#-]\\s*(.+)");
        if (product == null) product = productFromDescription(clean);
        String brand = firstMatchingLine(clean, "(?i)brand\\s*[:#-]\\s*(.+)");
        if (brand == null && product != null) {
            Matcher firstWord = Pattern.compile("^([\\p{L}][\\p{L}'&-]{2,})\\b").matcher(product);
            if (firstWord.find()) brand = firstWord.group(1);
        }
        String category = firstMatchingLine(clean, "(?i)category\\s*[:#-]\\s*(.+)");
        String merchant = firstMatchingLine(clean, "(?i)(?:merchant|store|sold by)\\s*[:#-]\\s*(.+)");
        if (merchant == null) merchant = firstLineAfter(clean, "(?i)^billed\\s+from\\s*$");
        BigDecimal purchasePrice = parsePrice(clean);
        return new OcrResult(clean, product, brand, category, merchant, purchaseDate, purchasePrice, months);
    }

    private LocalDate parseDate(String candidate) {
        if (candidate.matches("\\d{4}-\\d{1,2}-\\d{1,2}")) {
            try { return LocalDate.parse(candidate, DateTimeFormatter.ISO_LOCAL_DATE); }
            catch (DateTimeParseException ignored) { return null; }
        }
        String[] parts = candidate.split("[/-]");
        if (parts.length != 3) return null;
        try {
            int first = Integer.parseInt(parts[0]);
            int second = Integer.parseInt(parts[1]);
            int year = Integer.parseInt(parts[2]);
            if (year < 100) year += 2000;
            int month;
            int day;
            if (first > 12) {
                day = first;
                month = second;
            } else if (second > 12) {
                month = first;
                day = second;
            } else {
                month = first;
                day = second;
            }
            return LocalDate.of(year, month, day);
        } catch (NumberFormatException | java.time.DateTimeException ignored) {
            return null;
        }
    }

    private String productFromDescription(String text) {
        String[] lines = text.split("\\R");
        int start = -1;
        for (int i = 0; i < lines.length; i++) {
            if (Pattern.compile("(?i)description\\s*of\\s*(?:goods?|gty|products?)").matcher(lines[i]).find()) {
                start = i + 1;
                break;
            }
        }
        if (start < 0) return null;

        StringBuilder description = new StringBuilder();
        int collected = 0;
        for (int i = start; i < lines.length && i < start + 14; i++) {
            String line = lines[i].trim();
            if (line.isEmpty()) {
                if (collected > 0) break;
                continue;
            }
            if (line.matches("(?i)^\\(?\\d+\\)?\\s*(?:of\\s+\\d+)?$") ||
                line.matches("(?i)^(?:total|amount|details of goods|gst|cgst|sgst|igst)\\b.*")) break;
            if (line.matches("(?i).*(?:gross weight|value of goods|goods? consignment|description of|particulars|hsn|sac).*")) continue;

            if (collected == 0) {
                line = line.replaceFirst("(?i)\\s+\\d{1,5}\\s+\\d{3,8}\\s*(?:grams?|g|kg)\\b.*$", "")
                    .replaceFirst("\\s+\\d+(?:[.,]\\d+)?\\s*$", "");
            }
            line = line.replaceFirst("\\s*\\(\\d+\\)\\s*$", "");
            if (line.isBlank()) continue;
            if (description.length() > 0) description.append(' ');
            description.append(line);
            collected++;
            if (line.matches(".*[.!?]$")) break;
        }
        String result = description.toString().replaceAll("\\s+", " ").trim();
        if (result.isBlank()) return null;
        return result.length() > 240 ? result.substring(0, 240).trim() : result;
    }

    private String firstLineAfter(String text, String headingExpression) {
        String[] lines = text.split("\\R");
        Pattern heading = Pattern.compile(headingExpression);
        for (int i = 0; i < lines.length - 1; i++) {
            if (!heading.matcher(lines[i].trim()).matches()) continue;
            for (int j = i + 1; j < lines.length; j++) {
                String candidate = lines[j].trim();
                if (candidate.isEmpty()) continue;
                if (candidate.matches("(?i)^(?:gstin|pan|state|place of supply)\\s*:.*")) break;
                return candidate;
            }
        }
        return null;
    }

    private BigDecimal parsePrice(String text) {
        for (String line : text.split("\\R")) {
            Matcher matcher = PRICE.matcher(line.trim());
            if (!matcher.find()) continue;
            String value = matcher.group(1);
            int comma = value.lastIndexOf(',');
            int dot = value.lastIndexOf('.');
            if (comma >= 0 && dot >= 0) {
                char decimalSeparator = comma > dot ? ',' : '.';
                value = value.replace(decimalSeparator == ',' ? "." : ",", "");
                if (decimalSeparator == ',') value = value.replace(',', '.');
            } else if (comma >= 0) {
                int decimals = value.length() - comma - 1;
                value = decimals == 1 || decimals == 2 ? value.replace(',', '.') : value.replace(",", "");
            } else if (dot >= 0) {
                int decimals = value.length() - dot - 1;
                if (decimals > 2) value = value.replace(".", "");
            }
            try {
                return new BigDecimal(value);
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }
    private String firstMatchingLine(String text, String expression) {
        for (String line : text.split("\\R")) {
            Matcher matcher = Pattern.compile(expression).matcher(line.trim());
            if (matcher.find()) return matcher.group(1).trim();
        }
        return null;
    }
}
