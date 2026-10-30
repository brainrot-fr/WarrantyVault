package com.warrantyvault.user;
import com.warrantyvault.user.User;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
public interface UserRepository extends JpaRepository<User, String> {
    List<User> findByIdIn(Collection<String> ids);
}
