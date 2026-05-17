package com.xbc.backend.controller;

import com.xbc.backend.dto.ApiResponse;
import com.xbc.backend.dto.audit.AuditFilter;
import com.xbc.backend.dto.audit.AuditLogDto;
import com.xbc.backend.dto.expense.PagedResponse;
import com.xbc.backend.model.AuditLog;
import com.xbc.backend.service.AuditService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;

@RestController
@RequestMapping("/api/groups/{groupId}/audit-logs")
public class AuditController {

    private final AuditService auditService;

    public AuditController(AuditService auditService) {
        this.auditService = auditService;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<PagedResponse<AuditLogDto>>> getLogs(
            @PathVariable String groupId,
            @RequestParam(required = false) AuditLog.EntityType entityType,
            @RequestParam(required = false) AuditLog.Action action,
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant dateFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant dateTo,
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "20") int size) {
        AuditFilter filter = new AuditFilter(entityType, action, userId, dateFrom, dateTo);
        return ResponseEntity.ok(ApiResponse.success(
                auditService.getLogs(groupId, filter, page, size)));
    }
}
