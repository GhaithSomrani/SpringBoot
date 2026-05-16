package com.xbc.backend.dto.event;

import com.xbc.backend.model.Event.Status;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EventDto {
    private String id;
    private String groupId;
    private String title;
    private String description;
    private LocalDate startDate;
    private LocalDate endDate;
    private String creatorId;
    private List<String> categories;
    private Status status;
    private BigDecimal expenseTotal;
    private Instant createdAt;
    private Instant updatedAt;
}
