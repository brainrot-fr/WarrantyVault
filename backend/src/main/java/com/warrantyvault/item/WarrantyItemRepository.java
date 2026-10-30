package com.warrantyvault.item;

import com.warrantyvault.item.WarrantyItem;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.time.LocalDate;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WarrantyItemRepository extends JpaRepository<WarrantyItem, UUID> {
    List<WarrantyItem> findByHouseholdIdIn(List<UUID> householdIds);
    Optional<WarrantyItem> findByIdAndHouseholdIdIn(UUID id, List<UUID> householdIds);
    List<WarrantyItem> findByExpiryDateBetween(LocalDate from, LocalDate to);
}
