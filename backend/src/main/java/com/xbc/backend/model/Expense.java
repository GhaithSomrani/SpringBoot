package com.xbc.backend.model;

import lombok.*;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Document(collection = "expenses")
@CompoundIndexes({
        @CompoundIndex(name = "group_date",     def = "{'groupId': 1, 'date': -1}"),
        @CompoundIndex(name = "group_category", def = "{'groupId': 1, 'categoryId': 1}"),
        @CompoundIndex(name = "group_event",    def = "{'groupId': 1, 'eventId': 1}")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Expense extends BaseEntity {

    @Indexed
    private String groupId;

    private String title;
    private BigDecimal amount;
    private String currency;

    private String categoryId;
    private String subcategoryId;

    private LocalDate date;
    private String description;
    private List<String> attachments;

    @Indexed
    private String addedBy;

    @Indexed
    private String eventId;
}
