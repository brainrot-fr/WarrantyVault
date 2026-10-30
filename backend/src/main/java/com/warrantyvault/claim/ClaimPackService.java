package com.warrantyvault.claim;

import com.lowagie.text.Document;
import com.lowagie.text.DocumentException;
import com.lowagie.text.Paragraph;
import com.lowagie.text.pdf.PdfWriter;
import com.warrantyvault.item.Bill;
import com.warrantyvault.item.WarrantyItem;
import java.io.ByteArrayOutputStream;
import org.springframework.stereotype.Service;

@Service
public class ClaimPackService {
    public byte[] generate(WarrantyItem item) {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        Document document = new Document();
        try {
            PdfWriter.getInstance(document, output);
            document.open();
            document.add(new Paragraph("Warranty Claim Pack"));
            document.add(new Paragraph("Item reference: " + item.getId()));
            add(document, "Product", item.getName());
            add(document, "Brand", item.getBrand());
            add(document, "Category", item.getCategory());
            add(document, "Purchase date", item.getPurchaseDate() == null ? null : item.getPurchaseDate().toString());
            add(document, "Purchase price", item.getPurchasePrice() == null ? null : item.getPurchasePrice().toPlainString());
            add(document, "Warranty duration", item.getWarrantyMonths() == null ? null : item.getWarrantyMonths() + " months");
            add(document, "Warranty expires", item.getExpiryDate() == null ? null : item.getExpiryDate().toString());
            add(document, "Notes", item.getNotes());
            document.add(new Paragraph("Bill file: " + (item.getBillPath() == null ? "Not attached" : item.getBillPath())));
            document.close();
            return output.toByteArray();
        } catch (DocumentException ex) {
            throw new IllegalStateException("Could not generate claim pack", ex);
        }
    }

    public byte[] generate(Bill bill) {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        Document document = new Document();
        try {
            PdfWriter.getInstance(document, output);
            document.open();
            document.add(new Paragraph("Warranty Claim Pack"));
            document.add(new Paragraph("Bill reference: " + bill.getId()));
            add(document, "Product", bill.getProductName());
            add(document, "Merchant", bill.getMerchant());
            add(document, "Purchase date", bill.getPurchaseDate() == null ? null : bill.getPurchaseDate().toString());
            add(document, "Warranty duration", bill.getWarrantyMonths() == null ? null : bill.getWarrantyMonths() + " months");
            add(document, "Warranty expires", bill.getWarrantyExpiresAt() == null ? null : bill.getWarrantyExpiresAt().toString());
            document.add(new Paragraph("Receipt file: " + bill.getOriginalFilename()));
            if (bill.getOcrText() != null && !bill.getOcrText().isBlank()) {
                document.add(new Paragraph("Receipt text"));
                document.add(new Paragraph(bill.getOcrText()));
            }
            document.close();
            return output.toByteArray();
        } catch (DocumentException ex) {
            throw new IllegalStateException("Could not generate claim pack", ex);
        }
    }
    private void add(Document document, String label, String value) throws DocumentException {
        if (value != null && !value.isBlank()) document.add(new Paragraph(label + ": " + value));
    }
}
