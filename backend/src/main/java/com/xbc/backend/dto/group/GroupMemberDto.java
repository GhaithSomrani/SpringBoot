package com.xbc.backend.dto.group;

import com.xbc.backend.model.Group.Permission;
import lombok.*;

import java.time.Instant;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GroupMemberDto {
    private String userId;
    private String email;
    private Permission permission;
    private Instant joinedAt;
}
