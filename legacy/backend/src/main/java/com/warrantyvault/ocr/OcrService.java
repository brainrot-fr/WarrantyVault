package com.warrantyvault.ocr;
public interface OcrService {
    OcrResult process(byte[] contents, String contentType);
}
