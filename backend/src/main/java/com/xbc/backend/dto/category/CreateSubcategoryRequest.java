package com.xbc.backend.dto.category;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class CreateSubcategoryRequest {

    @NotBlank
    @Size(min = 1, max = 100)
    private String name;
}
