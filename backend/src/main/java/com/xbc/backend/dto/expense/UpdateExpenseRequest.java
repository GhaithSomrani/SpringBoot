package com.xbc.backend.dto.expense;

import jakarta.validation.constraints.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class UpdateExpenseRequest {

    @Size(min = 1, max = 200)
    private String title;

    @DecimalMin(value = "0.01", message = "Amount must be greater than zero")
    @Digits(integer = 12, fraction = 2, message = "Amount must have at most 12 integer digits and 2 decimal places")
    private BigDecimal amount;

    @Size(min = 3, max = 3, message = "Currency must be a 3-letter ISO code")
    private String currency;

    private String categoryId;
    private String subcategoryId;
    private LocalDate date;

    @Size(max = 1000)
    private String description;

    private List<String> attachments;
}
