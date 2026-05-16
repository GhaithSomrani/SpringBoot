package com.xbc.backend.controller;

import com.xbc.backend.dto.ApiResponse;
import com.xbc.backend.dto.category.*;
import com.xbc.backend.service.CategoryService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/groups/{groupId}/categories")
public class CategoryController {

    private final CategoryService categoryService;

    public CategoryController(CategoryService categoryService) {
        this.categoryService = categoryService;
    }

    @PostMapping
    public ResponseEntity<ApiResponse<CategoryDto>> create(
            @PathVariable String groupId,
            @Valid @RequestBody CreateCategoryRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Category created",
                        categoryService.createCategory(groupId, request)));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<CategoryDto>>> getAll(@PathVariable String groupId) {
        return ResponseEntity.ok(ApiResponse.success(categoryService.getCategories(groupId)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<CategoryDto>> update(
            @PathVariable String groupId,
            @PathVariable String id,
            @Valid @RequestBody UpdateCategoryRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Category updated",
                categoryService.updateCategory(groupId, id, request)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(
            @PathVariable String groupId,
            @PathVariable String id) {
        categoryService.deleteCategory(groupId, id);
        return ResponseEntity.ok(ApiResponse.success("Category deleted", null));
    }

    @PostMapping("/{id}/subcategories")
    public ResponseEntity<ApiResponse<CategoryDto>> addSubcategory(
            @PathVariable String groupId,
            @PathVariable String id,
            @Valid @RequestBody CreateSubcategoryRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Subcategory added",
                        categoryService.addSubcategory(groupId, id, request)));
    }

    @PutMapping("/{catId}/subcategories/{subId}")
    public ResponseEntity<ApiResponse<CategoryDto>> updateSubcategory(
            @PathVariable String groupId,
            @PathVariable String catId,
            @PathVariable String subId,
            @Valid @RequestBody UpdateSubcategoryRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Subcategory updated",
                categoryService.updateSubcategory(groupId, catId, subId, request)));
    }

    @DeleteMapping("/{catId}/subcategories/{subId}")
    public ResponseEntity<ApiResponse<CategoryDto>> deleteSubcategory(
            @PathVariable String groupId,
            @PathVariable String catId,
            @PathVariable String subId) {
        return ResponseEntity.ok(ApiResponse.success("Subcategory deleted",
                categoryService.deleteSubcategory(groupId, catId, subId)));
    }
}
