package com.xbc.backend.dto.upgrade;

import com.xbc.backend.model.Group.Permission;
import com.xbc.backend.model.PermissionUpgradeRequest.Status;
import com.xbc.backend.model.PermissionUpgradeRequest.UpgradePermission;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UpgradeRequestDto {
    private String id;
    private String groupId;
    private String groupName;
    private String requestedBy;
    private String requestedByName;
    private String requestedByEmail;
    private Permission currentPermission;
    private UpgradePermission requestedPermission;
    private String reason;
    private Status status;
    private String reviewedBy;
    private String reviewedByName;
    private String reviewNote;
    private Instant createdAt;
    private Instant reviewedAt;
}
