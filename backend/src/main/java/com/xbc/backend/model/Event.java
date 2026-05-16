package com.xbc.backend.model;

import lombok.*;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDate;
import java.util.List;

@Document(collection = "events")
@CompoundIndex(name = "group_status", def = "{'groupId': 1, 'status': 1}")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Event extends BaseEntity {

    @Indexed
    private String groupId;

    private String title;
    private String description;

    private LocalDate startDate;
    private LocalDate endDate;

    /** userId of the member who created this event. Distinct from BaseEntity.createdBy (username). */
    private String creatorId;

    private List<String> categories;

    private Status status;

    public enum Status {
        UPCOMING, ACTIVE, CLOSED
    }
}
