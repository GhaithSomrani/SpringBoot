package com.xbc.backend.service;

import com.xbc.backend.annotation.Auditable;
import com.xbc.backend.dto.category.*;
import com.xbc.backend.exception.ForbiddenException;
import com.xbc.backend.exception.ResourceNotFoundException;
import com.xbc.backend.model.AuditLog;
import com.xbc.backend.model.Category;
import com.xbc.backend.model.Category.Subcategory;
import com.xbc.backend.repository.CategoryRepository;
import com.xbc.backend.repository.GroupRepository;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class CategoryService {

    private final CategoryRepository categoryRepository;
    private final GroupRepository groupRepository;
    private final GroupSecurityService groupSecurityService;

    public CategoryService(CategoryRepository categoryRepository,
                           GroupRepository groupRepository,
                           GroupSecurityService groupSecurityService) {
        this.categoryRepository = categoryRepository;
        this.groupRepository = groupRepository;
        this.groupSecurityService = groupSecurityService;
    }

    @Auditable(action = AuditLog.Action.CREATED, entityType = AuditLog.EntityType.CATEGORY,
               groupIdIndex = 0, entityIdIndex = -1)
    public CategoryDto createCategory(String groupId, CreateCategoryRequest request) {
        verifyGroupExists(groupId);
        requireEditAccess(groupId);
        Category category = Category.builder()
                .groupId(groupId)
                .name(request.getName())
                .color(request.getColor())
                .icon(request.getIcon())
                .subcategories(new ArrayList<>())
                .build();
        return toDto(categoryRepository.save(category));
    }

    public List<CategoryDto> getCategories(String groupId) {
        verifyGroupExists(groupId);
        requireViewAccess(groupId);
        return categoryRepository.findByGroupId(groupId).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Auditable(action = AuditLog.Action.UPDATED, entityType = AuditLog.EntityType.CATEGORY,
               groupIdIndex = 0, entityIdIndex = 1)
    public CategoryDto updateCategory(String groupId, String categoryId, UpdateCategoryRequest request) {
        verifyGroupExists(groupId);
        requireEditAccess(groupId);
        Category category = findCategoryInGroup(groupId, categoryId);
        if (request.getName() != null) category.setName(request.getName());
        if (request.getColor() != null) category.setColor(request.getColor());
        if (request.getIcon()  != null) category.setIcon(request.getIcon());
        return toDto(categoryRepository.save(category));
    }

    @Auditable(action = AuditLog.Action.DELETED, entityType = AuditLog.EntityType.CATEGORY,
               groupIdIndex = 0, entityIdIndex = 1)
    public void deleteCategory(String groupId, String categoryId) {
        verifyGroupExists(groupId);
        requireEditAccess(groupId);
        findCategoryInGroup(groupId, categoryId);
        categoryRepository.deleteById(categoryId);
    }

    @Auditable(action = AuditLog.Action.UPDATED, entityType = AuditLog.EntityType.CATEGORY,
               groupIdIndex = 0, entityIdIndex = 1)
    public CategoryDto addSubcategory(String groupId, String categoryId, CreateSubcategoryRequest request) {
        verifyGroupExists(groupId);
        requireEditAccess(groupId);
        Category category = findCategoryInGroup(groupId, categoryId);
        category.getSubcategories().add(
                Subcategory.builder()
                        .id(UUID.randomUUID().toString())
                        .name(request.getName())
                        .build());
        return toDto(categoryRepository.save(category));
    }

    @Auditable(action = AuditLog.Action.UPDATED, entityType = AuditLog.EntityType.CATEGORY,
               groupIdIndex = 0, entityIdIndex = 1)
    public CategoryDto updateSubcategory(String groupId, String categoryId, String subId,
                                         UpdateSubcategoryRequest request) {
        verifyGroupExists(groupId);
        requireEditAccess(groupId);
        Category category = findCategoryInGroup(groupId, categoryId);
        findSubcategory(category, subId).setName(request.getName());
        return toDto(categoryRepository.save(category));
    }

    @Auditable(action = AuditLog.Action.UPDATED, entityType = AuditLog.EntityType.CATEGORY,
               groupIdIndex = 0, entityIdIndex = 1)
    public CategoryDto deleteSubcategory(String groupId, String categoryId, String subId) {
        verifyGroupExists(groupId);
        requireEditAccess(groupId);
        Category category = findCategoryInGroup(groupId, categoryId);
        boolean removed = category.getSubcategories().removeIf(s -> s.getId().equals(subId));
        if (!removed) {
            throw new ResourceNotFoundException("Subcategory", "id", subId);
        }
        return toDto(categoryRepository.save(category));
    }

    /** Called internally after group creation — no auth check. */
    public void seedDefaultCategories(String groupId) {
        record Seed(String name, String color, String icon) {}
        List<Seed> defaults = List.of(
                new Seed("Food",          "#FF6B35", "utensils"),
                new Seed("Transport",     "#4ECDC4", "car"),
                new Seed("Housing",       "#45B7D1", "home"),
                new Seed("Health",        "#96CEB4", "heart"),
                new Seed("Entertainment", "#FFEAA7", "star")
        );
        List<Category> categories = defaults.stream()
                .map(d -> Category.builder()
                        .groupId(groupId)
                        .name(d.name())
                        .color(d.color())
                        .icon(d.icon())
                        .subcategories(new ArrayList<>())
                        .build())
                .collect(Collectors.toList());
        categoryRepository.saveAll(categories);
    }

    // --- helpers ---

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

    private Category findCategoryInGroup(String groupId, String categoryId) {
        Category category = categoryRepository.findById(categoryId)
                .orElseThrow(() -> new ResourceNotFoundException("Category", "id", categoryId));
        if (!category.getGroupId().equals(groupId)) {
            throw new ResourceNotFoundException("Category", "id", categoryId);
        }
        return category;
    }

    private Subcategory findSubcategory(Category category, String subId) {
        return category.getSubcategories().stream()
                .filter(s -> s.getId().equals(subId))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Subcategory", "id", subId));
    }

    private CategoryDto toDto(Category category) {
        List<SubcategoryDto> subDtos = category.getSubcategories() == null ? List.of() :
                category.getSubcategories().stream()
                        .map(s -> SubcategoryDto.builder()
                                .id(s.getId())
                                .name(s.getName())
                                .build())
                        .collect(Collectors.toList());
        return CategoryDto.builder()
                .id(category.getId())
                .groupId(category.getGroupId())
                .name(category.getName())
                .color(category.getColor())
                .icon(category.getIcon())
                .subcategories(subDtos)
                .createdAt(category.getCreatedAt())
                .updatedAt(category.getUpdatedAt())
                .build();
    }
}
