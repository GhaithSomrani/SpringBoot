package com.xbc.backend.controller;

import com.xbc.backend.dto.ApiResponse;
import com.xbc.backend.dto.notification.NotificationDto;
import com.xbc.backend.service.NotificationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<NotificationDto>>> getMyNotifications() {
        return ResponseEntity.ok(ApiResponse.success(notificationService.getMyNotifications()));
    }

    // declared before /{id}/read so Spring MVC resolves the literal "read-all" first
    @PutMapping("/read-all")
    public ResponseEntity<ApiResponse<Void>> markAllRead() {
        notificationService.markAllRead();
        return ResponseEntity.ok(ApiResponse.success("All notifications marked as read", null));
    }

    @PutMapping("/{id}/read")
    public ResponseEntity<ApiResponse<NotificationDto>> markRead(@PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.success("Notification marked as read",
                notificationService.markRead(id)));
    }
}
