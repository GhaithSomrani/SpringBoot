package com.xbc.backend.controller;

import com.xbc.backend.dto.ApiResponse;
import com.xbc.backend.dto.group.*;
import com.xbc.backend.service.GroupService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/groups")
public class GroupController {

    private final GroupService groupService;

    public GroupController(GroupService groupService) {
        this.groupService = groupService;
    }

    @PostMapping
    public ResponseEntity<ApiResponse<GroupDto>> create(@Valid @RequestBody CreateGroupRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Group created", groupService.createGroup(request)));
    }

    @GetMapping("/my")
    public ResponseEntity<ApiResponse<List<GroupDto>>> getMyGroups() {
        return ResponseEntity.ok(ApiResponse.success(groupService.getMyGroups()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<GroupDto>> getGroup(@PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.success(groupService.getGroup(id)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<GroupDto>> updateGroup(
            @PathVariable String id,
            @Valid @RequestBody UpdateGroupRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Group updated", groupService.updateGroup(id, request)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteGroup(@PathVariable String id) {
        groupService.deleteGroup(id);
        return ResponseEntity.ok(ApiResponse.success("Group deleted", null));
    }

    @PutMapping("/{id}/members/{userId}/permission")
    public ResponseEntity<ApiResponse<GroupDto>> updateMemberPermission(
            @PathVariable String id,
            @PathVariable String userId,
            @Valid @RequestBody UpdatePermissionRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Permission updated",
                groupService.updateMemberPermission(id, userId, request)));
    }

    @DeleteMapping("/{id}/members/{userId}")
    public ResponseEntity<ApiResponse<GroupDto>> removeMember(
            @PathVariable String id,
            @PathVariable String userId) {
        return ResponseEntity.ok(ApiResponse.success("Member removed",
                groupService.removeMember(id, userId)));
    }
}
