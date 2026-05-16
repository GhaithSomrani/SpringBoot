package com.xbc.backend.service;

import com.xbc.backend.dto.expense.*;
import com.xbc.backend.exception.ForbiddenException;
import com.xbc.backend.exception.ResourceNotFoundException;
import com.xbc.backend.model.Category;
import com.xbc.backend.model.Expense;
import com.xbc.backend.repository.CategoryRepository;
import com.xbc.backend.repository.ExpenseRepository;
import com.xbc.backend.repository.GroupRepository;
import org.springframework.data.domain.*;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class ExpenseService {

    private static final Set<String> SORTABLE_FIELDS =
            Set.of("date", "amount", "title", "createdAt");

    private final ExpenseRepository expenseRepository;
    private final GroupRepository groupRepository;
    private final CategoryRepository categoryRepository;
    private final GroupSecurityService groupSecurityService;
    private final MongoTemplate mongoTemplate;

    public ExpenseService(ExpenseRepository expenseRepository,
                          GroupRepository groupRepository,
                          CategoryRepository categoryRepository,
                          GroupSecurityService groupSecurityService,
                          MongoTemplate mongoTemplate) {
        this.expenseRepository = expenseRepository;
        this.groupRepository = groupRepository;
        this.categoryRepository = categoryRepository;
        this.groupSecurityService = groupSecurityService;
        this.mongoTemplate = mongoTemplate;
    }

    public ExpenseDto createExpense(String groupId, CreateExpenseRequest req) {
        verifyGroupExists(groupId);
        requireEditAccess(groupId);
        String userId = groupSecurityService.getCurrentUserId();
        Expense expense = Expense.builder()
                .groupId(groupId)
                .title(req.getTitle())
                .amount(req.getAmount())
                .currency(req.getCurrency() != null ? req.getCurrency() : "USD")
                .categoryId(req.getCategoryId())
                .subcategoryId(req.getSubcategoryId())
                .date(req.getDate())
                .description(req.getDescription())
                .attachments(req.getAttachments() != null ? req.getAttachments() : new ArrayList<>())
                .addedBy(userId)
                .build();
        return toDto(expenseRepository.save(expense));
    }

    public PagedResponse<ExpenseDto> getExpenses(String groupId, ExpenseFilter filter,
                                                  int page, int size,
                                                  String sortBy, String sortDir) {
        verifyGroupExists(groupId);
        requireViewAccess(groupId);

        String field = SORTABLE_FIELDS.contains(sortBy) ? sortBy : "date";
        Sort.Direction dir = "asc".equalsIgnoreCase(sortDir) ? Sort.Direction.ASC : Sort.Direction.DESC;
        Pageable pageable = PageRequest.of(page, size, Sort.by(dir, field));

        Criteria combined = combinedCriteria(groupId, filter);

        long total = mongoTemplate.count(new Query(combined), Expense.class);
        List<ExpenseDto> content = mongoTemplate
                .find(new Query(combined).with(pageable), Expense.class)
                .stream().map(this::toDto).collect(Collectors.toList());

        return PagedResponse.from(new PageImpl<>(content, pageable, total));
    }

    public ExpenseDto getExpense(String groupId, String expenseId) {
        verifyGroupExists(groupId);
        requireViewAccess(groupId);
        return toDto(findInGroup(groupId, expenseId));
    }

    public ExpenseDto updateExpense(String groupId, String expenseId, UpdateExpenseRequest req) {
        verifyGroupExists(groupId);
        requireViewAccess(groupId);
        Expense expense = findInGroup(groupId, expenseId);
        requireAdderOrEdit(expense, groupId);

        if (req.getTitle()         != null) expense.setTitle(req.getTitle());
        if (req.getAmount()        != null) expense.setAmount(req.getAmount());
        if (req.getCurrency()      != null) expense.setCurrency(req.getCurrency());
        if (req.getCategoryId()    != null) expense.setCategoryId(req.getCategoryId());
        if (req.getSubcategoryId() != null) expense.setSubcategoryId(req.getSubcategoryId());
        if (req.getDate()          != null) expense.setDate(req.getDate());
        if (req.getDescription()   != null) expense.setDescription(req.getDescription());
        if (req.getAttachments()   != null) expense.setAttachments(req.getAttachments());

        return toDto(expenseRepository.save(expense));
    }

    public void deleteExpense(String groupId, String expenseId) {
        verifyGroupExists(groupId);
        requireViewAccess(groupId);
        Expense expense = findInGroup(groupId, expenseId);
        requireAdderOrEdit(expense, groupId);
        expenseRepository.deleteById(expenseId);
    }

    public ExpenseSummaryDto getSummary(String groupId) {
        verifyGroupExists(groupId);
        requireViewAccess(groupId);

        List<Expense> all = mongoTemplate.find(
                new Query(Criteria.where("groupId").is(groupId)), Expense.class);

        BigDecimal totalAmount = all.stream()
                .map(e -> e.getAmount() != null ? e.getAmount() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // category names keyed by id for the join
        Map<String, String> catNames = categoryRepository.findByGroupId(groupId).stream()
                .collect(Collectors.toMap(Category::getId, Category::getName));

        List<ExpenseSummaryDto.CategorySummary> byCategory = all.stream()
                .filter(e -> e.getCategoryId() != null)
                .collect(Collectors.groupingBy(
                        Expense::getCategoryId,
                        Collectors.reducing(BigDecimal.ZERO, Expense::getAmount, BigDecimal::add)))
                .entrySet().stream()
                .map(e -> new ExpenseSummaryDto.CategorySummary(
                        e.getKey(),
                        catNames.getOrDefault(e.getKey(), "Unknown"),
                        e.getValue()))
                .sorted(Comparator.comparing(ExpenseSummaryDto.CategorySummary::total).reversed())
                .collect(Collectors.toList());

        List<ExpenseSummaryDto.MonthlySummary> byMonth = all.stream()
                .filter(e -> e.getDate() != null)
                .collect(Collectors.groupingBy(
                        e -> String.format("%d-%02d",
                                e.getDate().getYear(), e.getDate().getMonthValue()),
                        Collectors.reducing(BigDecimal.ZERO, Expense::getAmount, BigDecimal::add)))
                .entrySet().stream()
                .map(e -> new ExpenseSummaryDto.MonthlySummary(e.getKey(), e.getValue()))
                .sorted(Comparator.comparing(ExpenseSummaryDto.MonthlySummary::month))
                .collect(Collectors.toList());

        return ExpenseSummaryDto.builder()
                .totalAmount(totalAmount)
                .byCategory(byCategory)
                .byMonth(byMonth)
                .build();
    }

    // --- private helpers ---

    private Criteria combinedCriteria(String groupId, ExpenseFilter f) {
        List<Criteria> list = new ArrayList<>();
        list.add(Criteria.where("groupId").is(groupId));
        if (f.categoryId()    != null) list.add(Criteria.where("categoryId").is(f.categoryId()));
        if (f.subcategoryId() != null) list.add(Criteria.where("subcategoryId").is(f.subcategoryId()));
        if (f.dateFrom()      != null) list.add(Criteria.where("date").gte(f.dateFrom()));
        if (f.dateTo()        != null) list.add(Criteria.where("date").lte(f.dateTo()));
        if (f.minAmount()     != null) list.add(Criteria.where("amount").gte(f.minAmount()));
        if (f.maxAmount()     != null) list.add(Criteria.where("amount").lte(f.maxAmount()));
        if (f.addedBy()       != null) list.add(Criteria.where("addedBy").is(f.addedBy()));
        return list.size() == 1
                ? list.get(0)
                : new Criteria().andOperator(list.toArray(new Criteria[0]));
    }

    private void verifyGroupExists(String groupId) {
        if (!groupRepository.existsById(groupId)) {
            throw new ResourceNotFoundException("Group", "id", groupId);
        }
    }

    private void requireViewAccess(String groupId) {
        if (!groupSecurityService.hasViewAccess(groupId)) {
            throw new ForbiddenException("You do not have access to this group");
        }
    }

    private void requireEditAccess(String groupId) {
        if (!groupSecurityService.hasEditAccess(groupId)) {
            throw new ForbiddenException("You need edit access to perform this action");
        }
    }

    private void requireAdderOrEdit(Expense expense, String groupId) {
        String currentUserId = groupSecurityService.getCurrentUserId();
        if (!currentUserId.equals(expense.getAddedBy())
                && !groupSecurityService.hasEditAccess(groupId)) {
            throw new ForbiddenException(
                    "You can only modify expenses you added, or you need edit access");
        }
    }

    private Expense findInGroup(String groupId, String expenseId) {
        Expense expense = expenseRepository.findById(expenseId)
                .orElseThrow(() -> new ResourceNotFoundException("Expense", "id", expenseId));
        if (!expense.getGroupId().equals(groupId)) {
            throw new ResourceNotFoundException("Expense", "id", expenseId);
        }
        return expense;
    }

    private ExpenseDto toDto(Expense e) {
        return ExpenseDto.builder()
                .id(e.getId())
                .groupId(e.getGroupId())
                .title(e.getTitle())
                .amount(e.getAmount())
                .currency(e.getCurrency())
                .categoryId(e.getCategoryId())
                .subcategoryId(e.getSubcategoryId())
                .date(e.getDate())
                .description(e.getDescription())
                .attachments(e.getAttachments())
                .addedBy(e.getAddedBy())
                .createdAt(e.getCreatedAt())
                .updatedAt(e.getUpdatedAt())
                .build();
    }
}
