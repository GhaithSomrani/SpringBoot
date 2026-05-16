package com.xbc.backend.controller;

import com.xbc.backend.dto.ApiResponse;
import com.xbc.backend.dto.expense.*;
import com.xbc.backend.service.ExpenseService;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/groups/{groupId}/expenses")
public class ExpenseController {

    private final ExpenseService expenseService;

    public ExpenseController(ExpenseService expenseService) {
        this.expenseService = expenseService;
    }

    @PostMapping
    public ResponseEntity<ApiResponse<ExpenseDto>> create(
            @PathVariable String groupId,
            @Valid @RequestBody CreateExpenseRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Expense created",
                        expenseService.createExpense(groupId, request)));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<PagedResponse<ExpenseDto>>> getAll(
            @PathVariable String groupId,
            @RequestParam(required = false) String categoryId,
            @RequestParam(required = false) String subcategoryId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateTo,
            @RequestParam(required = false) BigDecimal minAmount,
            @RequestParam(required = false) BigDecimal maxAmount,
            @RequestParam(required = false) String addedBy,
            @RequestParam(defaultValue = "0")    int page,
            @RequestParam(defaultValue = "20")   int size,
            @RequestParam(defaultValue = "date") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir) {
        ExpenseFilter filter = new ExpenseFilter(
                categoryId, subcategoryId, dateFrom, dateTo, minAmount, maxAmount, addedBy);
        return ResponseEntity.ok(ApiResponse.success(
                expenseService.getExpenses(groupId, filter, page, size, sortBy, sortDir)));
    }

    // declared before /{id} so Spring MVC resolves the literal segment first
    @GetMapping("/summary")
    public ResponseEntity<ApiResponse<ExpenseSummaryDto>> getSummary(
            @PathVariable String groupId) {
        return ResponseEntity.ok(ApiResponse.success(expenseService.getSummary(groupId)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ExpenseDto>> getOne(
            @PathVariable String groupId,
            @PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.success(expenseService.getExpense(groupId, id)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<ExpenseDto>> update(
            @PathVariable String groupId,
            @PathVariable String id,
            @Valid @RequestBody UpdateExpenseRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Expense updated",
                expenseService.updateExpense(groupId, id, request)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(
            @PathVariable String groupId,
            @PathVariable String id) {
        expenseService.deleteExpense(groupId, id);
        return ResponseEntity.ok(ApiResponse.success("Expense deleted", null));
    }
}
