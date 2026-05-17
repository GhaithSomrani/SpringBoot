package com.xbc.backend.model;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "audit_logs")
@CompoundIndex(name = "group_performed_at", def = "{'groupId': 1, 'performedAt': -1}")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuditLog {

    @Id
    private String id;

    @Indexed
    private String groupId;

    private Action action;

    @Indexed
    private EntityType entityType;

    private String entityId;

    /** JSON snapshot of the entity's state before the change; null for CREATED actions. */
    private String entitySnapshot;

    private Performer performedBy;

    @Indexed
    private Instant performedAt;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class Performer {
        private String userId;
        private String email;
    }

    public enum Action {
        CREATED, UPDATED, DELETED, JOINED, LEFT, PERMISSION_CHANGED
    }

    public enum EntityType {
        EXPENSE, CATEGORY, EVENT, GROUP, MEMBER
    }
}
