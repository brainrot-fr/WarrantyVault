package com.warrantyvault.user;

import com.warrantyvault.user.User;
import com.warrantyvault.user.UserRepository;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CurrentUserService {
    private final UserRepository users;
    public CurrentUserService(UserRepository users) { this.users = users; }

    @Transactional
    public User upsert(Jwt jwt) {
        String id = jwt.getSubject();
        if (id == null || id.isBlank()) throw new IllegalArgumentException("JWT subject is required");
        String email = jwt.getClaimAsString("email");
        if (email == null || email.isBlank()) email = id + "@supabase.invalid";
        String name = jwt.getClaimAsString("user_name");
        if (name == null) name = jwt.getClaimAsString("name");
        String normalizedEmail = email;
        String normalizedName = name;
        User user = users.findById(id).orElseGet(() -> new User(id, normalizedEmail, normalizedName));
        user.updateProfile(normalizedEmail, normalizedName);
        return users.save(user);
    }
}
