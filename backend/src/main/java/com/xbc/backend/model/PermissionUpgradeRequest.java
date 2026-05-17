package com.xbc.backend.model;

import com.xbc.backend.model.Group.Permission;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "permission_upgrade_requests")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PermissionUpgradeRequest extends BaseEntity {

    @Indexed
    private String groupId;

    private String groupName;

    @Indexed
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
    private Instant reviewedAt;

    public enum UpgradePermission {
        VIEW,
        EDIT,
        ADMIN
    }

    public enum Status {
        PENDING,
        APPROVED,
        DENIED
    }
}
