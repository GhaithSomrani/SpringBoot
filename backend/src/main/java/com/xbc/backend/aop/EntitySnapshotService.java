package com.xbc.backend.aop;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.xbc.backend.model.AuditLog.EntityType;
import com.xbc.backend.repository.*;
import org.springframework.stereotype.Component;

/**
 * Fetches the current persisted state of an entity and serialises it to JSON.
 * Called by AuditAspect before a mutating operation so the before-state is captured.
 */
@Component
public class EntitySnapshotService {

    // ObjectMapper is thread-safe after construction; no need to inject the Spring-managed bean.
    private static final ObjectMapper MAPPER = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    private final ExpenseRepository expenseRepository;
    private final CategoryRepository categoryRepository;
    private final EventRepository eventRepository;
    private final GroupRepository groupRepository;

    public EntitySnapshotService(ExpenseRepository expenseRepository,
                                 CategoryRepository categoryRepository,
                                 EventRepository eventRepository,
                                 GroupRepository groupRepository) {
        this.expenseRepository = expenseRepository;
        this.categoryRepository = categoryRepository;
        this.eventRepository = eventRepository;
        this.groupRepository = groupRepository;
    }

    /**
     * Returns a JSON string of the entity's current state, or null if not found.
     *
     * For MEMBER type, entityId is the target userId and groupId is used to locate
     * the embedded GroupMember within the Group document.
     */
    public String capture(EntityType type, String entityId, String groupId) {
        try {
            Object entity = switch (type) {
                case EXPENSE  -> expenseRepository.findById(entityId).orElse(null);
                case CATEGORY -> categoryRepository.findById(entityId).orElse(null);
                case EVENT    -> eventRepository.findById(entityId).orElse(null);
                case GROUP    -> groupRepository.findById(entityId).orElse(null);
                case MEMBER   -> groupRepository.findById(groupId)
                        .map(g -> g.getMembers() == null ? null :
                                g.getMembers().stream()
                                        .filter(m -> m.getUserId().equals(entityId))
                                        .findFirst()
                                        .orElse(null))
                        .orElse(null);
            };
            return entity == null ? null : MAPPER.writeValueAsString(entity);
        } catch (Exception e) {
            return null;
        }
    }
}
