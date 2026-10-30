package com.warrantyvault.household;
import com.warrantyvault.household.HouseholdInvite;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
public interface HouseholdInviteRepository extends JpaRepository<HouseholdInvite, UUID> {
    Optional<HouseholdInvite> findByTokenHash(String tokenHash);
}
