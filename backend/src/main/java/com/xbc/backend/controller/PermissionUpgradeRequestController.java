package com.xbc.backend.controller;

import com.xbc.backend.dto.ApiResponse;
import com.xbc.backend.dto.upgrade.CreateUpgradeRequest;
import com.xbc.backend.dto.upgrade.ReviewUpgradeRequest;
import com.xbc.backend.dto.upgrade.UpgradePendingCountDto;
import com.xbc.backend.dto.upgrade.UpgradeRequestDto;
import com.xbc.backend.model.PermissionUpgradeRequest;
import com.xbc.backend.service.PermissionUpgradeRequestService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api")
public class PermissionUpgradeRequestController {

    private final PermissionUpgradeRequestService permissionUpgradeRequestService;

    public PermissionUpgradeRequestController(PermissionUpgradeRequestService permissionUpgradeRequestService) {
        this.permissionUpgradeRequestService = permissionUpgradeRequestService;
    }

    @PostMapping("/groups/{groupId}/upgrade-requests")
    public ResponseEntity<ApiResponse<UpgradeRequestDto>> create(
            @PathVariable String groupId,
            @Valid @RequestBody CreateUpgradeRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(
                        "Upgrade request submitted",
                        permissionUpgradeRequestService.create(groupId, request)));
    }

    @GetMapping("/groups/{groupId}/upgrade-requests")
    public ResponseEntity<ApiResponse<List<UpgradeRequestDto>>> listForGroup(
            @PathVariable String groupId,
            @RequestParam(required = false) PermissionUpgradeRequest.Status status) {
        return ResponseEntity.ok(ApiResponse.success(
                permissionUpgradeRequestService.listForGroup(groupId, status)));
    }

    @GetMapping("/groups/{groupId}/upgrade-requests/pending-count")
    public ResponseEntity<ApiResponse<UpgradePendingCountDto>> pendingCount(@PathVariable String groupId) {
        return ResponseEntity.ok(ApiResponse.success(
                permissionUpgradeRequestService.pendingCount(groupId)));
    }

    @GetMapping("/users/me/upgrade-requests")
    public ResponseEntity<ApiResponse<List<UpgradeRequestDto>>> listMine() {
        return ResponseEntity.ok(ApiResponse.success(permissionUpgradeRequestService.listMine()));
    }

    @PostMapping("/groups/{groupId}/upgrade-requests/{requestId}/approve")
    public ResponseEntity<ApiResponse<UpgradeRequestDto>> approve(
            @PathVariable String groupId,
            @PathVariable String requestId,
            @RequestBody(required = false) ReviewUpgradeRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                "Upgrade request approved",
                permissionUpgradeRequestService.approve(groupId, requestId, request)));
    }

    @PostMapping("/groups/{groupId}/upgrade-requests/{requestId}/deny")
    public ResponseEntity<ApiResponse<UpgradeRequestDto>> deny(
            @PathVariable String groupId,
            @PathVariable String requestId,
            @RequestBody(required = false) ReviewUpgradeRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                "Upgrade request denied",
                permissionUpgradeRequestService.deny(groupId, requestId, request)));
    }
}
