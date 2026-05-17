package com.xbc.backend.aop;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.xbc.backend.model.AuditLog.EntityType;
import com.xbc.backend.repository.*;
import org.springframework.stereotype.Component;

/**
 * Fetches the current persisted state of an entity and serialises it to JSON.
 * Called by AuditAspect before a mutating operation so the before-state is captured.
 */
@Component
public class EntitySnapshotService {

    private final ExpenseRepository expenseRepository;
    private final CategoryRepository categoryRepository;
    private final EventRepository eventRepository;
    private final GroupRepository groupRepository;
    private final ObjectMapper objectMapper;

    public EntitySnapshotService(ExpenseRepository expenseRepository,
                                 CategoryRepository categoryRepository,
                                 EventRepository eventRepository,
                                 GroupRepository groupRepository,
                                 ObjectMapper objectMapper) {
        this.expenseRepository = expenseRepository;
        this.categoryRepository = categoryRepository;
        this.eventRepository = eventRepository;
        this.groupRepository = groupRepository;
        this.objectMapper = objectMapper;
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
            return entity == null ? null : objectMapper.writeValueAsString(entity);
        } catch (Exception e) {
            return null;
        }
    }
}
