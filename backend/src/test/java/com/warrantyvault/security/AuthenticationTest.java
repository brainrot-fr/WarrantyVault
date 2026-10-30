package com.warrantyvault.security;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.context.ApplicationContext;
import org.springframework.scheduling.annotation.ScheduledAnnotationBeanPostProcessor;

@SpringBootTest
@AutoConfigureMockMvc
class AuthenticationTest {
    @Autowired private MockMvc mockMvc;
    @Autowired private ApplicationContext applicationContext;

    @Test
    void schedulingIsDisabledByDefaultProfile() {
        org.junit.jupiter.api.Assertions.assertTrue(
            applicationContext.getBeansOfType(ScheduledAnnotationBeanPostProcessor.class).isEmpty());
    }
    @Test
    void protectedApiRejectsRequestsWithoutBearerToken() throws Exception {
        mockMvc.perform(get("/api/households")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/items")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/items/dashboard")).andExpect(status().isUnauthorized());
    }

    @Test
    void healthEndpointIsPublicAndReturnsUp() throws Exception {
        mockMvc.perform(get("/api/health"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    void reminderTriggerUsesCronSecretAtSpecifiedPath() throws Exception {
        mockMvc.perform(post("/api/internal/run-reminders").header("X-Cron-Secret", "invalid"))
            .andExpect(status().isUnauthorized());
    }
}
