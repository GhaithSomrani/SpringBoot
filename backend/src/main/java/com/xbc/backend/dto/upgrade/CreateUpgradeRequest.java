package com.xbc.backend.dto.upgrade;

import com.xbc.backend.model.PermissionUpgradeRequest.UpgradePermission;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class CreateUpgradeRequest {

    @NotNull
    private UpgradePermission requestedPermission;

    private String reason;
}
