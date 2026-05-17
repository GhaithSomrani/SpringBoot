package com.xbc.backend.service;

import com.xbc.backend.dto.notification.NotificationDto;
import com.xbc.backend.exception.ForbiddenException;
import com.xbc.backend.exception.ResourceNotFoundException;
import com.xbc.backend.model.Group;
import com.xbc.backend.model.Notification;
import com.xbc.backend.repository.GroupRepository;
import com.xbc.backend.repository.NotificationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    private final NotificationRepository notificationRepository;
    private final GroupRepository groupRepository;
    private final GroupSecurityService groupSecurityService;
    private final SimpMessagingTemplate messagingTemplate;
    private final MongoTemplate mongoTemplate;

    public NotificationService(NotificationRepository notificationRepository,
                               GroupRepository groupRepository,
                               GroupSecurityService groupSecurityService,
                               SimpMessagingTemplate messagingTemplate,
                               MongoTemplate mongoTemplate) {
        this.notificationRepository = notificationRepository;
        this.groupRepository = groupRepository;
        this.groupSecurityService = groupSecurityService;
        this.messagingTemplate = messagingTemplate;
        this.mongoTemplate = mongoTemplate;
    }

    /**
     * Persists a notification for the given user and pushes it over WebSocket.
     * Failures are swallowed — notification delivery is best-effort.
     */
    public void send(String userId, Notification.Type type,
                     String groupId, String message, String referenceId) {
        try {
            Notification notification = Notification.builder()
                    .userId(userId)
                    .groupId(groupId)
                    .type(type)
                    .message(message)
                    .referenceId(referenceId)
                    .read(false)
                    .createdAt(Instant.now())
                    .build();

            notificationRepository.save(notification);

            // Principal name on the WebSocket session is the MongoDB userId (set by WebSocketAuthInterceptor)
            messagingTemplate.convertAndSendToUser(userId, "/queue/notifications", toDto(notification));
        } catch (Exception e) {
            log.warn("Failed to send notification to user {}: {}", userId, e.getMessage());
        }
    }

    /**
     * Fan-out: sends a notification to every group member and the owner,
     * excluding the actor who triggered the event.
     */
    public void notifyGroupMembers(String groupId, String actorUserId,
                                   Notification.Type type, String message, String referenceId) {
        groupRepository.findById(groupId).ifPresent(group ->
                Stream.concat(
                        Stream.of(group.getOwnerId()),
                        group.getMembers() == null ? Stream.empty() :
                                group.getMembers().stream().map(Group.GroupMember::getUserId)
                )
                .distinct()
                .filter(uid -> !uid.equals(actorUserId))
                .forEach(uid -> send(uid, type, groupId, message, referenceId))
        );
    }

    // --- Controller-facing methods (current user resolved from SecurityContext) ---

    public List<NotificationDto> getMyNotifications() {
        String userId = groupSecurityService.getCurrentUserId();
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream().map(this::toDto).collect(Collectors.toList());
    }

    public NotificationDto markRead(String notificationId) {
        String userId = groupSecurityService.getCurrentUserId();
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new ResourceNotFoundException("Notification", "id", notificationId));
        if (!notification.getUserId().equals(userId)) {
            throw new ForbiddenException("This notification does not belong to you");
        }
        notification.setRead(true);
        return toDto(notificationRepository.save(notification));
    }

    public void markAllRead() {
        String userId = groupSecurityService.getCurrentUserId();
        mongoTemplate.updateMulti(
                new Query(Criteria.where("userId").is(userId).and("read").is(false)),
                new Update().set("read", true),
                Notification.class);
    }

    // ---

    private NotificationDto toDto(Notification n) {
        return NotificationDto.builder()
                .id(n.getId())
                .userId(n.getUserId())
                .groupId(n.getGroupId())
                .type(n.getType())
                .message(n.getMessage())
                .referenceId(n.getReferenceId())
                .read(n.isRead())
                .createdAt(n.getCreatedAt())
                .build();
    }
}
