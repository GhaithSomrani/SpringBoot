package com.xbc.backend.dto.group;

import lombok.*;

import java.time.Instant;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GroupDto {
    private String id;
    private String name;
    private String description;
    private String ownerId;
    private List<GroupMemberDto> members;
    private Instant createdAt;
    private Instant updatedAt;
}
