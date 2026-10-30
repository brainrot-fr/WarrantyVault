package com.warrantyvault.storage;

import java.net.URI;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class SupabaseStorageClient {
    private final String baseUrl;
    private final String key;
    private final String bucket;
    private final int signedUrlSeconds;
    private final RestClient client;

    public SupabaseStorageClient(@Value("${app.storage.base-url:}") String baseUrl,
                                 @Value("${app.storage.service-role-key:}") String key,
                                 @Value("${app.storage.bucket:bills}") String bucket,
                                 @Value("${app.storage.signed-url-seconds:600}") int signedUrlSeconds,
                                 RestClient.Builder builder) {
        this.baseUrl = baseUrl == null ? "" : baseUrl.replaceAll("/+$", "");
        this.key = key == null ? "" : key;
        this.bucket = bucket;
        this.signedUrlSeconds = signedUrlSeconds;
        this.client = builder.build();
    }

    public void upload(String path, byte[] contents, String contentType) {
        requireConfigured();
        client.put().uri(baseUrl + "/storage/v1/object/" + bucket + "/" + path)
            .header("apikey", key).header("Authorization", "Bearer " + key)
            .header("x-upsert", "false").contentType(MediaType.parseMediaType(contentType))
            .body(contents).retrieve().toBodilessEntity();
    }

    public URI signedUrl(String path) {
        requireConfigured();
        String signed = client.post().uri(baseUrl + "/storage/v1/object/sign/" + bucket + "/" + path)
            .header("apikey", key).header("Authorization", "Bearer " + key)
            .contentType(MediaType.APPLICATION_JSON)
            .body(java.util.Map.of("expiresIn", signedUrlSeconds)).retrieve()
            .body(SignedUrlResponse.class).signedURL();
        String absolute = signed.startsWith("http") ? signed : baseUrl + (signed.startsWith("/") ? "" : "/") + signed;
        return URI.create(absolute);
    }

    public void delete(String path) {
        requireConfigured();
        client.delete().uri(baseUrl + "/storage/v1/object/" + bucket + "/" + path)
            .header("apikey", key).header("Authorization", "Bearer " + key)
            .retrieve().toBodilessEntity();
    }

    private void requireConfigured() {
        if (baseUrl.isBlank() || key.isBlank()) throw new IllegalStateException("Supabase Storage is not configured");
    }

    private record SignedUrlResponse(String signedURL) {}
}
