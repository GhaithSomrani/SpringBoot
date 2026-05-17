package com.xbc.backend.dto.notification;

import com.xbc.backend.model.Notification.Type;
import lombok.*;

import java.time.Instant;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NotificationDto {
    private String id;
    private String userId;
    private String groupId;
    private Type type;
    private String message;
    private String referenceId;
    private boolean read;
    private Instant createdAt;
}
