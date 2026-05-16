package com.xbc.backend.dto.expense;

import lombok.*;

import java.math.BigDecimal;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ExpenseSummaryDto {

    private BigDecimal totalAmount;
    private List<CategorySummary> byCategory;
    private List<MonthlySummary> byMonth;

    public record CategorySummary(String categoryId, String categoryName, BigDecimal total) {}
    public record MonthlySummary(String month, BigDecimal total) {}
}
