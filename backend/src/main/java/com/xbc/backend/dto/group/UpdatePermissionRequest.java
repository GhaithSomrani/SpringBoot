package com.xbc.backend.dto.group;

import com.xbc.backend.model.Group.Permission;
import jakarta.validation.constraints.NotNull;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class UpdatePermissionRequest {

    @NotNull
    private Permission permission;
}
