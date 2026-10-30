package com.warrantyvault.ocr;

import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import javax.imageio.ImageIO;
import net.sourceforge.tess4j.Tesseract;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class Tess4jOcrService implements OcrService {
    private final boolean enabled;
    private final String tessdataPath;
    private final WarrantyTextParser parser;
    public Tess4jOcrService(@Value("${app.ocr.enabled:false}") boolean enabled,
                            @Value("${app.ocr.tessdata-path:}") String tessdataPath,
                            WarrantyTextParser parser) {
        this.enabled = enabled; this.tessdataPath = tessdataPath; this.parser = parser;
    }
    @Override
    public OcrResult process(byte[] contents, String contentType) {
        if (!enabled) return new OcrResult("", null, null, null, null, null, null, null);
        try {
            String text;
            if ("application/pdf".equals(contentType)) text = processPdf(contents);
            else text = recognize(ImageIO.read(new ByteArrayInputStream(contents)));
            return parser.parse(text);
        } catch (IOException | net.sourceforge.tess4j.TesseractException ex) {
            throw new IllegalArgumentException("Could not read uploaded bill", ex);
        }
    }
    private String processPdf(byte[] contents) throws IOException, net.sourceforge.tess4j.TesseractException {
        try (PDDocument pdf = Loader.loadPDF(contents)) {
            if (pdf.getNumberOfPages() == 0) return "";
            PDFTextStripper stripper = new PDFTextStripper();
            stripper.setStartPage(1);
            stripper.setEndPage(1);
            String text = stripper.getText(pdf);
            if (text != null && text.replaceAll("\\s", "").length() > 20) return text;
            BufferedImage firstPage = new PDFRenderer(pdf).renderImageWithDPI(0, 250);
            return recognize(firstPage);
        }
    }
    private String recognize(BufferedImage image) throws net.sourceforge.tess4j.TesseractException {
        if (image == null) throw new IllegalArgumentException("Unsupported or corrupt image");
        Tesseract tesseract = new Tesseract();
        if (tessdataPath != null && !tessdataPath.isBlank()) tesseract.setDatapath(tessdataPath);
        tesseract.setLanguage("eng");
        return tesseract.doOCR(image);
    }
}
