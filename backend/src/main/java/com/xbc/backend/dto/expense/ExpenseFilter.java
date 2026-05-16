package com.xbc.backend.dto.expense;

import java.math.BigDecimal;
import java.time.LocalDate;

public record ExpenseFilter(
        String categoryId,
        String subcategoryId,
        LocalDate dateFrom,
        LocalDate dateTo,
        BigDecimal minAmount,
        BigDecimal maxAmount,
        String addedBy,
        String eventId
) {}
