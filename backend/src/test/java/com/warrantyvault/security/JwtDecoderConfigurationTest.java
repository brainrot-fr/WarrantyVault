package com.warrantyvault.security;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import java.time.Instant;
import java.util.Date;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;

class JwtDecoderConfigurationTest {
    private final SecurityConfig config = new SecurityConfig();

    @Test
    void legacyHs256FallbackStillValidatesKnownSupabaseIssuer() throws Exception {
        String secret = "a-32-character-minimum-secret-key";
        JwtDecoder decoder = config.jwtDecoder("project-ref", "https://project-ref.supabase.co",
            "", secret);

        assertDoesNotThrow(() -> decoder.decode(token(secret, "https://project-ref.supabase.co/auth/v1")));
        assertThrows(JwtException.class,
            () -> decoder.decode(token(secret, "https://attacker.example/auth/v1")));
    }

    @Test
    void explicitJwksTakesPrecedenceOverLegacySecret() {
        assertDoesNotThrow(() -> config.jwtDecoder("project-ref", "https://project-ref.supabase.co",
            "https://keys.example/jwks", "short"));
    }

    private String token(String secret, String issuer) throws Exception {
        SignedJWT jwt = new SignedJWT(new JWSHeader(JWSAlgorithm.HS256), new JWTClaimsSet.Builder()
            .issuer(issuer)
            .subject("user-123")
            .issueTime(Date.from(Instant.now()))
            .expirationTime(Date.from(Instant.now().plusSeconds(300)))
            .build());
        jwt.sign(new MACSigner(secret.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        return jwt.serialize();
    }
}
