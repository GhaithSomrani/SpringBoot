package com.xbc.backend.aop;

import com.xbc.backend.annotation.Auditable;
import com.xbc.backend.model.AuditLog;
import com.xbc.backend.model.User;
import com.xbc.backend.repository.AuditLogRepository;
import com.xbc.backend.repository.UserRepository;
import com.xbc.backend.service.GroupSecurityService;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.Instant;

@Aspect
@Component
public class AuditAspect {

    private static final Logger log = LoggerFactory.getLogger(AuditAspect.class);

    private final AuditLogRepository auditLogRepository;
    private final GroupSecurityService groupSecurityService;
    private final UserRepository userRepository;
    private final EntitySnapshotService snapshotService;

    public AuditAspect(AuditLogRepository auditLogRepository,
                       GroupSecurityService groupSecurityService,
                       UserRepository userRepository,
                       EntitySnapshotService snapshotService) {
        this.auditLogRepository = auditLogRepository;
        this.groupSecurityService = groupSecurityService;
        this.userRepository = userRepository;
        this.snapshotService = snapshotService;
    }

    @Around("@annotation(auditable)")
    public Object audit(ProceedingJoinPoint pjp, Auditable auditable) throws Throwable {
        Object[] args = pjp.getArgs();

        // Capture before-state only when the entity already exists (non-CREATE)
        String entityIdBefore = null;
        String groupIdBefore  = null;
        String beforeSnapshot = null;

        if (auditable.entityIdIndex() >= 0) {
            entityIdBefore = (String) args[auditable.entityIdIndex()];
            groupIdBefore  = auditable.groupIdIndex() >= 0
                    ? (String) args[auditable.groupIdIndex()]
                    : entityIdBefore;
            beforeSnapshot = snapshotService.capture(auditable.entityType(), entityIdBefore, groupIdBefore);
        }

        // Execute the target method — if it throws, the exception propagates and no log is saved
        Object result = pjp.proceed();

        // After successful execution, derive IDs and persist the audit entry
        try {
            String entityId;
            String groupId;

            if (auditable.entityIdIndex() < 0) {
                // CREATE: entity ID lives in the return value
                entityId = extractId(result);
                groupId  = auditable.groupIdIndex() < 0
                        ? entityId   // GROUP CREATED — groupId == entityId
                        : (String) args[auditable.groupIdIndex()];
            } else {
                entityId = entityIdBefore;
                groupId  = groupIdBefore;
            }

            AuditLog.Performer performer = resolvePerformer();

            auditLogRepository.save(AuditLog.builder()
                    .groupId(groupId)
                    .action(auditable.action())
                    .entityType(auditable.entityType())
                    .entityId(entityId)
                    .entitySnapshot(beforeSnapshot)
                    .performedBy(performer)
                    .performedAt(Instant.now())
                    .build());
        } catch (Exception e) {
            // Audit failure must never break the actual operation
            log.error("Failed to persist audit log for {}.{}: {}",
                    pjp.getTarget().getClass().getSimpleName(),
                    pjp.getSignature().getName(),
                    e.getMessage());
        }

        return result;
    }

    /** Reflectively calls getId() on a DTO return value. */
    private String extractId(Object result) {
        if (result == null) return null;
        try {
            return (String) result.getClass().getMethod("getId").invoke(result);
        } catch (Exception e) {
            log.warn("Could not extract id from return value of type {}", result.getClass().getSimpleName());
            return null;
        }
    }

    private AuditLog.Performer resolvePerformer() {
        try {
            String userId = groupSecurityService.getCurrentUserId();
            String email  = userRepository.findById(userId)
                    .map(User::getEmail)
                    .orElse("unknown");
            return new AuditLog.Performer(userId, email);
        } catch (Exception e) {
            return new AuditLog.Performer("system", "system");
        }
    }
}
