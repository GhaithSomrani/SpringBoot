package com.xbc.backend.dto.group;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class CreateGroupRequest {

    @NotBlank
    @Size(min = 1, max = 100)
    private String name;

    @Size(max = 500)
    private String description;
}
