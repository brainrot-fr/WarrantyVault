package com.warrantyvault.security;

import com.warrantyvault.user.CurrentUserService;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.AnonymousAuthenticationFilter;

@Configuration
public class SecurityConfig {
    @Bean
    JwtDecoder jwtDecoder(@Value("${app.auth.project-ref:}") String projectRef,
                          @Value("${app.storage.base-url:}") String supabaseUrl,
                          @Value("${app.auth.jwk-set-uri:}") String configuredJwkSetUri,
                          @Value("${app.auth.legacy-hs256-secret:}") String secret) {
        String issuer = expectedIssuer(projectRef, supabaseUrl);
        String explicitJwks = configuredJwkSetUri == null ? "" : configuredJwkSetUri.trim();
        if (!explicitJwks.isBlank()) {
            NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(explicitJwks).jwsAlgorithms(algorithms -> {
                algorithms.add(SignatureAlgorithm.RS256);
                algorithms.add(SignatureAlgorithm.ES256);
            }).build();
            decoder.setJwtValidator(issuer.isBlank()
                ? JwtValidators.createDefault()
                : JwtValidators.createDefaultWithIssuer(issuer));
            return decoder;
        }
        if (secret != null && !secret.isBlank()) {
            byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
            if (keyBytes.length < 32) throw new IllegalStateException("Legacy HS256 secret must be at least 32 bytes");
            SecretKey key = new SecretKeySpec(keyBytes, "HmacSHA256");
            NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(key)
                .macAlgorithm(org.springframework.security.oauth2.jose.jws.MacAlgorithm.HS256).build();
            decoder.setJwtValidator(issuer.isBlank()
                ? JwtValidators.createDefault()
                : JwtValidators.createDefaultWithIssuer(issuer));
            return decoder;
        }
        if (!issuer.isBlank()) {
            String jwkSetUri = issuer + "/.well-known/jwks.json";
            NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(jwkSetUri).jwsAlgorithms(algorithms -> {
                algorithms.add(SignatureAlgorithm.RS256);
                algorithms.add(SignatureAlgorithm.ES256);
            }).build();
            decoder.setJwtValidator(JwtValidators.createDefaultWithIssuer(issuer));
            return decoder;
        }
        return token -> { throw new BadCredentialsException("JWT issuer/JWKS is not configured"); };
    }

    private String expectedIssuer(String projectRef, String supabaseUrl) {
        if (supabaseUrl != null && !supabaseUrl.isBlank()) {
            return supabaseUrl.trim().replaceAll("/+$", "") + "/auth/v1";
        }
        if (projectRef != null && !projectRef.isBlank()) {
            return "https://" + projectRef.trim() + ".supabase.co/auth/v1";
        }
        return "";
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource(@Value("${app.cors.allowed-origins:http://localhost:5173}") String allowedOrigins) {
        CorsConfiguration configuration = new CorsConfiguration();
        List<String> origins = Arrays.stream(allowedOrigins.split(",")).map(String::trim).filter(origin -> !origin.isEmpty()).toList();
        configuration.setAllowedOrigins(origins);
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("Authorization", "Content-Type", "X-Cron-Secret"));
        configuration.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, JwtDecoder decoder, CurrentUserService currentUsers) throws Exception {
        http.csrf(csrf -> csrf.disable())
            .cors(cors -> {})
            .authorizeHttpRequests(auth -> auth.requestMatchers(
                "/actuator/health", "/api/health", "/api/internal/run-reminders").permitAll().anyRequest().authenticated())
            .oauth2ResourceServer(oauth -> oauth.jwt(jwt -> jwt.decoder(decoder)))
            .addFilterAfter(new UserProvisioningFilter(currentUsers), AnonymousAuthenticationFilter.class);
        return http.build();
    }
}
