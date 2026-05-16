package com.xbc.backend.dto.expense;

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
public class ExpenseDto {
    private String id;
    private String groupId;
    private String title;
    private BigDecimal amount;
    private String currency;
    private String categoryId;
    private String subcategoryId;
    private LocalDate date;
    private String description;
    private List<String> attachments;
    private String addedBy;
    private Instant createdAt;
    private Instant updatedAt;
}
