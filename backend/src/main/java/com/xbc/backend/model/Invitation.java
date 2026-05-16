package com.xbc.backend.model;

import com.xbc.backend.model.Group.Permission;
import lombok.*;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "invitations")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Invitation extends BaseEntity {

    private String groupId;
    private String invitedEmail;
    private String invitedBy;

    @Indexed(unique = true)
    private String token;

    private Permission permission;
    private Status status;
    private Instant expiresAt;

    public enum Status { PENDING, ACCEPTED, EXPIRED }
}
