package com.warrantyvault.item;
import com.warrantyvault.item.Bill;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
public interface BillRepository extends JpaRepository<Bill, UUID> {
    List<Bill> findByHouseholdIdIn(List<UUID> householdIds);
    Optional<Bill> findByIdAndHouseholdIdIn(UUID id, List<UUID> householdIds);
    List<Bill> findByWarrantyExpiresAtBetween(LocalDate from, LocalDate to);
}
