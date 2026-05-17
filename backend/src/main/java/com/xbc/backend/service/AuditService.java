package com.xbc.backend.service;

import com.xbc.backend.dto.audit.AuditFilter;
import com.xbc.backend.dto.audit.AuditLogDto;
import com.xbc.backend.dto.expense.PagedResponse;
import com.xbc.backend.exception.ForbiddenException;
import com.xbc.backend.exception.ResourceNotFoundException;
import com.xbc.backend.model.AuditLog;
import com.xbc.backend.repository.AuditLogRepository;
import com.xbc.backend.repository.GroupRepository;
import org.springframework.data.domain.*;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class AuditService {

    private final AuditLogRepository auditLogRepository;
    private final GroupRepository groupRepository;
    private final GroupSecurityService groupSecurityService;
    private final MongoTemplate mongoTemplate;

    public AuditService(AuditLogRepository auditLogRepository,
                        GroupRepository groupRepository,
                        GroupSecurityService groupSecurityService,
                        MongoTemplate mongoTemplate) {
        this.auditLogRepository = auditLogRepository;
        this.groupRepository = groupRepository;
        this.groupSecurityService = groupSecurityService;
        this.mongoTemplate = mongoTemplate;
    }

    public PagedResponse<AuditLogDto> getLogs(String groupId, AuditFilter filter, int page, int size) {
        groupRepository.findById(groupId)
                .orElseThrow(() -> new ResourceNotFoundException("Group", "id", groupId));

        if (!isAdminOrOwner(groupId)) {
            throw new ForbiddenException("Only the group owner or an admin can view audit logs");
        }

        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "performedAt"));
        Criteria combined = buildCriteria(groupId, filter);

        long total = mongoTemplate.count(new Query(combined), AuditLog.class);
        List<AuditLogDto> content = mongoTemplate
                .find(new Query(combined).with(pageable), AuditLog.class)
                .stream().map(this::toDto).collect(Collectors.toList());

        return PagedResponse.from(new PageImpl<>(content, pageable, total));
    }

    /**
     * Direct (non-AOP) audit logging for operations that don't fit the annotation model,
     * such as JOINED (invitation acceptance), where the performer is already resolved by the caller.
     */
    public void log(String groupId,
                    AuditLog.Action action,
                    AuditLog.EntityType entityType,
                    String entityId,
                    AuditLog.Performer performer,
                    String beforeSnapshot) {
        try {
            auditLogRepository.save(AuditLog.builder()
                    .groupId(groupId)
                    .action(action)
                    .entityType(entityType)
                    .entityId(entityId)
                    .entitySnapshot(beforeSnapshot)
                    .performedBy(performer)
                    .performedAt(Instant.now())
                    .build());
        } catch (Exception ignored) {
            // Audit failure must not break the caller
        }
    }

    // --- private helpers ---

    private boolean isAdminOrOwner(String groupId) {
        boolean isAdmin = SecurityContextHolder.getContext().getAuthentication()
                .getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        return isAdmin || groupSecurityService.isOwner(groupId);
    }

    private Criteria buildCriteria(String groupId, AuditFilter f) {
        List<Criteria> list = new ArrayList<>();
        list.add(Criteria.where("groupId").is(groupId));
        if (f.entityType() != null) list.add(Criteria.where("entityType").is(f.entityType()));
        if (f.action()     != null) list.add(Criteria.where("action").is(f.action()));
        if (f.userId()     != null) list.add(Criteria.where("performedBy.userId").is(f.userId()));
        if (f.dateFrom()   != null) list.add(Criteria.where("performedAt").gte(f.dateFrom()));
        if (f.dateTo()     != null) list.add(Criteria.where("performedAt").lte(f.dateTo()));
        return list.size() == 1
                ? list.get(0)
                : new Criteria().andOperator(list.toArray(new Criteria[0]));
    }

    private AuditLogDto toDto(AuditLog log) {
        return AuditLogDto.builder()
                .id(log.getId())
                .groupId(log.getGroupId())
                .action(log.getAction())
                .entityType(log.getEntityType())
                .entityId(log.getEntityId())
                .entitySnapshot(log.getEntitySnapshot())
                .performedBy(log.getPerformedBy())
                .performedAt(log.getPerformedAt())
                .build();
    }
}
