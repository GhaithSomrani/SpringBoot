package com.xbc.backend.dto.category;

import lombok.*;

import java.time.Instant;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CategoryDto {
    private String id;
    private String groupId;
    private String name;
    private String color;
    private String icon;
    private List<SubcategoryDto> subcategories;
    private Instant createdAt;
    private Instant updatedAt;
}
