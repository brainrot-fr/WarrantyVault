package com.warrantyvault.household;
import com.warrantyvault.household.Household;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
public interface HouseholdRepository extends JpaRepository<Household, UUID> {}
