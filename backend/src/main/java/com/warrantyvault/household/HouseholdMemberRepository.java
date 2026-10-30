package com.warrantyvault.household;
import com.warrantyvault.household.HouseholdMember;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
public interface HouseholdMemberRepository extends JpaRepository<HouseholdMember, HouseholdMember.HouseholdMemberId> {
    @Query("select m.id.householdId from HouseholdMember m where m.id.userId = :userId")
    List<UUID> findHouseholdIds(@Param("userId") String userId);
    List<HouseholdMember> findByIdHouseholdId(UUID householdId);
    boolean existsByIdHouseholdIdAndIdUserId(UUID householdId, String userId);
}
