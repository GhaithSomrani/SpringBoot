package com.xbc.backend.annotation;

import com.xbc.backend.model.AuditLog;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Marks a service method for automatic audit logging.
 *
 * groupIdIndex  — index of the groupId argument; -1 means derive from return value (GROUP CREATED).
 * entityIdIndex — index of the entityId argument; -1 means derive from return value (CREATE actions).
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Auditable {
    AuditLog.Action action();
    AuditLog.EntityType entityType();
    int groupIdIndex() default 0;
    int entityIdIndex() default 1;
}
