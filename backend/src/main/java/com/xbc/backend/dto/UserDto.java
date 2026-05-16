package com.xbc.backend.dto;

import com.xbc.backend.model.User.Role;
import lombok.*;

import java.time.Instant;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserDto {
    private String id;
    private String username;
    private String email;
    private Role role;
    private Instant createdAt;
}
