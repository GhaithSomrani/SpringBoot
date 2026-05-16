package com.xbc.backend.dto.invitation;

import com.xbc.backend.model.Group.Permission;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class CreateInvitationRequest {

    @NotBlank
    @Email
    private String email;

    @NotNull
    private Permission permission;
}
