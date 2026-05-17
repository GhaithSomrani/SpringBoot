package com.xbc.backend.dto.audit;

import com.xbc.backend.model.AuditLog;

import java.time.Instant;

public record AuditFilter(
        AuditLog.EntityType entityType,
        AuditLog.Action action,
        String userId,
        Instant dateFrom,
        Instant dateTo
) {}
