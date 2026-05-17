package com.xbc.backend.model;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "notifications")
@CompoundIndex(name = "user_created", def = "{'userId': 1, 'createdAt': -1}")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Notification {

    @Id
    private String id;

    @Indexed
    private String userId;

    private String groupId;

    private Type type;
    private String message;

    /** ID of the related entity (expense id, invitation id, userId, etc.) */
    private String referenceId;

    private boolean read;
    private Instant createdAt;

    public enum Type {
        EXPENSE_ADDED, EXPENSE_UPDATED,
        MEMBER_JOINED, INVITE_RECEIVED, PERMISSION_CHANGED,
        INVITATION_ACCEPTED, INVITATION_DECLINED
    }
}
