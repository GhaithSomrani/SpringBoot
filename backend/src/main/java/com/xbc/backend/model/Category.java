package com.xbc.backend.model;

import lombok.*;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.List;

@Document(collection = "categories")
@CompoundIndex(name = "group_name", def = "{'groupId': 1, 'name': 1}", unique = true)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Category extends BaseEntity {

    private String groupId;
    private String name;
    private String color;
    private String icon;
    private List<Subcategory> subcategories;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class Subcategory {
        private String id;
        private String name;
    }
}
