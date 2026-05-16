package com.xbc.backend.controller;

import com.xbc.backend.dto.ApiResponse;
import com.xbc.backend.dto.event.CreateEventRequest;
import com.xbc.backend.dto.event.EventDto;
import com.xbc.backend.dto.event.UpdateEventRequest;
import com.xbc.backend.service.EventService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/groups/{groupId}/events")
public class EventController {

    private final EventService eventService;

    public EventController(EventService eventService) {
        this.eventService = eventService;
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('MANAGER', 'ADMIN')")
    public ResponseEntity<ApiResponse<EventDto>> create(
            @PathVariable String groupId,
            @Valid @RequestBody CreateEventRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Event created",
                        eventService.createEvent(groupId, request)));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<EventDto>>> getAll(@PathVariable String groupId) {
        return ResponseEntity.ok(ApiResponse.success(eventService.getEvents(groupId)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<EventDto>> getOne(
            @PathVariable String groupId,
            @PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.success(eventService.getEvent(groupId, id)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<EventDto>> update(
            @PathVariable String groupId,
            @PathVariable String id,
            @Valid @RequestBody UpdateEventRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Event updated",
                eventService.updateEvent(groupId, id, request)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(
            @PathVariable String groupId,
            @PathVariable String id) {
        eventService.deleteEvent(groupId, id);
        return ResponseEntity.ok(ApiResponse.success("Event deleted", null));
    }
}
