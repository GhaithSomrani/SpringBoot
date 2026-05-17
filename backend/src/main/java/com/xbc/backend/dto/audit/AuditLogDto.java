package com.xbc.backend.dto.audit;

import com.xbc.backend.model.AuditLog;
import lombok.*;

import java.time.Instant;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuditLogDto {
    private String id;
    private String groupId;
    private AuditLog.Action action;
    private AuditLog.EntityType entityType;
    private String entityId;
    private String entitySnapshot;
    private AuditLog.Performer performedBy;
    private Instant performedAt;
}
