package com.xbc.backend.service;

import com.xbc.backend.dto.event.CreateEventRequest;
import com.xbc.backend.dto.event.EventDto;
import com.xbc.backend.dto.event.UpdateEventRequest;
import com.xbc.backend.exception.ForbiddenException;
import com.xbc.backend.exception.ResourceNotFoundException;
import com.xbc.backend.model.Event;
import com.xbc.backend.model.Expense;
import com.xbc.backend.repository.EventRepository;
import com.xbc.backend.repository.GroupRepository;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class EventService {

    private final EventRepository eventRepository;
    private final GroupRepository groupRepository;
    private final GroupSecurityService groupSecurityService;
    private final MongoTemplate mongoTemplate;

    public EventService(EventRepository eventRepository,
                        GroupRepository groupRepository,
                        GroupSecurityService groupSecurityService,
                        MongoTemplate mongoTemplate) {
        this.eventRepository = eventRepository;
        this.groupRepository = groupRepository;
        this.groupSecurityService = groupSecurityService;
        this.mongoTemplate = mongoTemplate;
    }

    public EventDto createEvent(String groupId, CreateEventRequest req) {
        verifyGroupExists(groupId);
        requireViewAccess(groupId);  // must be a group member in addition to MANAGER/ADMIN role
        String userId = groupSecurityService.getCurrentUserId();
        Event event = Event.builder()
                .groupId(groupId)
                .title(req.getTitle())
                .description(req.getDescription())
                .startDate(req.getStartDate())
                .endDate(req.getEndDate())
                .creatorId(userId)
                .categories(req.getCategories() != null ? req.getCategories() : new ArrayList<>())
                .status(req.getStatus() != null ? req.getStatus() : Event.Status.UPCOMING)
                .build();
        return toDto(eventRepository.save(event), BigDecimal.ZERO);
    }

    public List<EventDto> getEvents(String groupId) {
        verifyGroupExists(groupId);
        requireViewAccess(groupId);
        List<Event> events = eventRepository.findByGroupId(groupId);
        if (events.isEmpty()) return List.of();

        List<String> eventIds = events.stream().map(Event::getId).collect(Collectors.toList());
        Map<String, BigDecimal> totals = fetchExpenseTotals(eventIds);
        return events.stream()
                .map(e -> toDto(e, totals.getOrDefault(e.getId(), BigDecimal.ZERO)))
                .collect(Collectors.toList());
    }

    public EventDto getEvent(String groupId, String eventId) {
        verifyGroupExists(groupId);
        requireViewAccess(groupId);
        Event event = findInGroup(groupId, eventId);
        return toDto(event, fetchExpenseTotal(eventId));
    }

    public EventDto updateEvent(String groupId, String eventId, UpdateEventRequest req) {
        verifyGroupExists(groupId);
        requireViewAccess(groupId);
        Event event = findInGroup(groupId, eventId);
        requireCreatorOrAdmin(event);

        if (req.getTitle()       != null) event.setTitle(req.getTitle());
        if (req.getDescription() != null) event.setDescription(req.getDescription());
        if (req.getStartDate()   != null) event.setStartDate(req.getStartDate());
        if (req.getEndDate()     != null) event.setEndDate(req.getEndDate());
        if (req.getCategories()  != null) event.setCategories(req.getCategories());
        if (req.getStatus()      != null) event.setStatus(req.getStatus());

        return toDto(eventRepository.save(event), fetchExpenseTotal(eventId));
    }

    public void deleteEvent(String groupId, String eventId) {
        verifyGroupExists(groupId);
        requireViewAccess(groupId);
        Event event = findInGroup(groupId, eventId);
        requireCreatorOrAdmin(event);
        eventRepository.deleteById(eventId);
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

    private void requireCreatorOrAdmin(Event event) {
        String currentUserId = groupSecurityService.getCurrentUserId();
        boolean isCreator = currentUserId.equals(event.getCreatorId());
        boolean isAdmin = SecurityContextHolder.getContext().getAuthentication()
                .getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        if (!isCreator && !isAdmin) {
            throw new ForbiddenException("Only the event creator or an admin can perform this action");
        }
    }

    private Event findInGroup(String groupId, String eventId) {
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> new ResourceNotFoundException("Event", "id", eventId));
        if (!event.getGroupId().equals(groupId)) {
            throw new ResourceNotFoundException("Event", "id", eventId);
        }
        return event;
    }

    /** Single-event expense total — used for get/update where we already have the event. */
    private BigDecimal fetchExpenseTotal(String eventId) {
        return mongoTemplate.find(
                new Query(Criteria.where("eventId").is(eventId)), Expense.class
        ).stream()
                .map(e -> e.getAmount() != null ? e.getAmount() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /** Bulk expense totals — one query for many events (used by list endpoint). */
    private Map<String, BigDecimal> fetchExpenseTotals(List<String> eventIds) {
        List<Expense> expenses = mongoTemplate.find(
                new Query(Criteria.where("eventId").in(eventIds)), Expense.class);
        return expenses.stream()
                .filter(e -> e.getEventId() != null)
                .collect(Collectors.groupingBy(
                        Expense::getEventId,
                        Collectors.reducing(
                                BigDecimal.ZERO,
                                e -> e.getAmount() != null ? e.getAmount() : BigDecimal.ZERO,
                                BigDecimal::add)));
    }

    private EventDto toDto(Event e, BigDecimal expenseTotal) {
        return EventDto.builder()
                .id(e.getId())
                .groupId(e.getGroupId())
                .title(e.getTitle())
                .description(e.getDescription())
                .startDate(e.getStartDate())
                .endDate(e.getEndDate())
                .creatorId(e.getCreatorId())
                .categories(e.getCategories())
                .status(e.getStatus())
                .expenseTotal(expenseTotal)
                .createdAt(e.getCreatedAt())
                .updatedAt(e.getUpdatedAt())
                .build();
    }
}
