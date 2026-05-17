package com.xbc.backend.dto.invitation;

import com.xbc.backend.model.Group.Permission;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InvitationAcceptResponse {
    private String groupId;
    private String groupName;
    private boolean requiresAuth;
    private String invitedEmail;
    private Permission permission;
}
