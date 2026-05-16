package com.xbc.backend.model;

import lombok.*;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;

@Document(collection = "groups")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Group extends BaseEntity {

    private String name;
    private String description;
    private String ownerId;
    private List<GroupMember> members;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class GroupMember {
        private String userId;
        private String email;
        private Permission permission;
        private Instant joinedAt;
    }

    public enum Permission {
        VIEW, EDIT
    }
}
