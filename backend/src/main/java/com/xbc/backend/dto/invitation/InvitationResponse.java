package com.xbc.backend.dto.invitation;

import com.xbc.backend.model.Group.Permission;
import com.xbc.backend.model.Invitation.Status;
import lombok.*;

import java.time.Instant;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InvitationResponse {
    private String id;
    private String groupId;
    private String groupName;
    private String invitedEmail;
    private String invitedBy;
    private String invitedByName;
    private Permission permission;
    private Status status;
    private Instant expiresAt;
    private Instant createdAt;
    private Instant respondedAt;
    private String acceptUrl;
}
