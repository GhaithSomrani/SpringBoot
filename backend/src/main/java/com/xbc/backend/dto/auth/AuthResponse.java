package com.xbc.backend.dto.auth;

import com.xbc.backend.dto.UserDto;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuthResponse {
    private String token;
    private String type;
    private UserDto user;
}
