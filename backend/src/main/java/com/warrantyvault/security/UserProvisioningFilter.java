package com.warrantyvault.security;

import com.warrantyvault.user.CurrentUserService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.filter.OncePerRequestFilter;

public class UserProvisioningFilter extends OncePerRequestFilter {
    private final CurrentUserService currentUsers;
    public UserProvisioningFilter(CurrentUserService currentUsers) { this.currentUsers = currentUsers; }
    @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
        throws ServletException, IOException {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication instanceof JwtAuthenticationToken jwtAuth && authentication.isAuthenticated()) {
            currentUsers.upsert(jwtAuth.getToken());
        }
        chain.doFilter(request, response);
    }
}
