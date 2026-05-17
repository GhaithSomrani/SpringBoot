package com.xbc.backend.service;

import com.xbc.backend.dto.upgrade.CreateUpgradeRequest;
import com.xbc.backend.dto.upgrade.ReviewUpgradeRequest;
import com.xbc.backend.dto.upgrade.UpgradePendingCountDto;
import com.xbc.backend.dto.upgrade.UpgradeRequestDto;
import com.xbc.backend.exception.AlreadyHasPermissionException;
import com.xbc.backend.exception.DuplicatePendingRequestException;
import com.xbc.backend.exception.ForbiddenException;
import com.xbc.backend.exception.ResourceNotFoundException;
import com.xbc.backend.exception.ValidationException;
import com.xbc.backend.model.AuditLog;
import com.xbc.backend.model.Group;
import com.xbc.backend.model.Notification;
import com.xbc.backend.model.PermissionUpgradeRequest;
import com.xbc.backend.model.User;
import com.xbc.backend.repository.GroupRepository;
import com.xbc.backend.repository.PermissionUpgradeRequestRepository;
import com.xbc.backend.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
public class PermissionUpgradeRequestService {

    private final PermissionUpgradeRequestRepository permissionUpgradeRequestRepository;
    private final GroupRepository groupRepository;
    private final UserRepository userRepository;
    private final GroupSecurityService groupSecurityService;
    private final NotificationService notificationService;
    private final AuditService auditService;

    public PermissionUpgradeRequestService(PermissionUpgradeRequestRepository permissionUpgradeRequestRepository,
                                           GroupRepository groupRepository,
                                           UserRepository userRepository,
                                           GroupSecurityService groupSecurityService,
                                           NotificationService notificationService,
                                           AuditService auditService) {
        this.permissionUpgradeRequestRepository = permissionUpgradeRequestRepository;
        this.groupRepository = groupRepository;
        this.userRepository = userRepository;
        this.groupSecurityService = groupSecurityService;
        this.notificationService = notificationService;
        this.auditService = auditService;
    }

    public UpgradeRequestDto create(String groupId, CreateUpgradeRequest request) {
        Group group = findGroup(groupId);
        User currentUser = findCurrentUser();
        Group.GroupMember member = findMember(group, currentUser.getId());

        Group.Permission currentPermission = member.getPermission();
        Group.Permission requestedAsGroupPermission = toGroupPermission(request.getRequestedPermission());
        if (currentPermission == requestedAsGroupPermission) {
            throw new AlreadyHasPermissionException("You already have the requested permission");
        }
        if (permissionRank(requestedAsGroupPermission) < permissionRank(currentPermission)) {
            throw new ValidationException("Requested permission must be higher than your current permission");
        }

        boolean hasPending = permissionUpgradeRequestRepository.findPendingByGroupId(groupId).stream()
                .anyMatch(r -> r.getRequestedBy().equals(currentUser.getId()));
        if (hasPending) {
            throw new DuplicatePendingRequestException("A pending upgrade request already exists for this group");
        }

        PermissionUpgradeRequest saved = permissionUpgradeRequestRepository.save(
                PermissionUpgradeRequest.builder()
                        .groupId(groupId)
                        .groupName(group.getName())
                        .requestedBy(currentUser.getId())
                        .requestedByName(currentUser.getUsername())
                        .requestedByEmail(currentUser.getEmail())
                        .currentPermission(currentPermission)
                        .requestedPermission(request.getRequestedPermission())
                        .reason(blankToNull(request.getReason()))
                        .status(PermissionUpgradeRequest.Status.PENDING)
                        .build()
        );

        notifyAdminsAndOwner(group, currentUser.getId(),
                Notification.Type.UPGRADE_REQUEST_RECEIVED,
                currentUser.getUsername() + " requested " + request.getRequestedPermission() + " access in " + group.getName(),
                saved.getId());

        return toDto(saved);
    }

    public List<UpgradeRequestDto> listForGroup(String groupId, PermissionUpgradeRequest.Status status) {
        findGroup(groupId);
        requireOwnerOrAdmin(groupId);
        List<PermissionUpgradeRequest> requests = status == null
                ? permissionUpgradeRequestRepository.findByGroupIdOrderByCreatedAtDesc(groupId)
                : permissionUpgradeRequestRepository.findByGroupIdAndStatus(groupId, status);
        return requests.stream().map(this::toDto).collect(Collectors.toList());
    }

    public UpgradePendingCountDto pendingCount(String groupId) {
        findGroup(groupId);
        requireOwnerOrAdmin(groupId);
        long count = permissionUpgradeRequestRepository.findPendingByGroupId(groupId).size();
        return UpgradePendingCountDto.builder().count(count).build();
    }

    public List<UpgradeRequestDto> listMine() {
        String userId = groupSecurityService.getCurrentUserId();
        return permissionUpgradeRequestRepository.findByRequestedByOrderByCreatedAtDesc(userId)
                .stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    public UpgradeRequestDto approve(String groupId, String requestId, ReviewUpgradeRequest request) {
        requireOwnerOrAdmin(groupId);
        PermissionUpgradeRequest upgradeRequest = findRequest(groupId, requestId);
        ensurePending(upgradeRequest);

        User reviewer = findCurrentUser();
        Group group = findGroup(groupId);
        Group.GroupMember member = findMember(group, upgradeRequest.getRequestedBy());

        Group.Permission newPermission = toGroupPermission(upgradeRequest.getRequestedPermission());
        member.setPermission(newPermission);
        groupRepository.save(group);

        upgradeRequest.setStatus(PermissionUpgradeRequest.Status.APPROVED);
        upgradeRequest.setReviewedBy(reviewer.getId());
        upgradeRequest.setReviewedByName(reviewer.getUsername());
        upgradeRequest.setReviewNote(request == null ? null : blankToNull(request.getReviewNote()));
        upgradeRequest.setReviewedAt(java.time.Instant.now());
        PermissionUpgradeRequest saved = permissionUpgradeRequestRepository.save(upgradeRequest);

        notificationService.send(
                upgradeRequest.getRequestedBy(),
                Notification.Type.UPGRADE_REQUEST_APPROVED,
                groupId,
                "Your request for " + upgradeRequest.getRequestedPermission() + " access was approved"
                        + buildReviewSuffix(saved.getReviewNote()),
                saved.getId());

        auditService.log(
                groupId,
                AuditLog.Action.PERMISSION_CHANGED,
                AuditLog.EntityType.MEMBER,
                upgradeRequest.getRequestedBy(),
                new AuditLog.Performer(reviewer.getId(), reviewer.getEmail()),
                null);

        return toDto(saved);
    }

    public UpgradeRequestDto deny(String groupId, String requestId, ReviewUpgradeRequest request) {
        requireOwnerOrAdmin(groupId);
        PermissionUpgradeRequest upgradeRequest = findRequest(groupId, requestId);
        ensurePending(upgradeRequest);

        String note = request == null ? null : blankToNull(request.getReviewNote());
        if (note == null) {
            throw new ValidationException("reviewNote is required when denying an upgrade request");
        }

        User reviewer = findCurrentUser();
        upgradeRequest.setStatus(PermissionUpgradeRequest.Status.DENIED);
        upgradeRequest.setReviewedBy(reviewer.getId());
        upgradeRequest.setReviewedByName(reviewer.getUsername());
        upgradeRequest.setReviewNote(note);
        upgradeRequest.setReviewedAt(java.time.Instant.now());
        PermissionUpgradeRequest saved = permissionUpgradeRequestRepository.save(upgradeRequest);

        notificationService.send(
                upgradeRequest.getRequestedBy(),
                Notification.Type.UPGRADE_REQUEST_DENIED,
                groupId,
                "Your upgrade request was denied. Reason: " + note,
                saved.getId());

        auditService.log(
                groupId,
                AuditLog.Action.PERMISSION_CHANGED,
                AuditLog.EntityType.MEMBER,
                upgradeRequest.getRequestedBy(),
                new AuditLog.Performer(reviewer.getId(), reviewer.getEmail()),
                null);

        return toDto(saved);
    }

    private void notifyAdminsAndOwner(Group group, String actorUserId, Notification.Type type, String message, String referenceId) {
        Stream<String> owner = Stream.of(group.getOwnerId());
        Stream<String> admins = group.getMembers() == null ? Stream.empty() :
                group.getMembers().stream()
                        .filter(m -> m.getPermission() == Group.Permission.ADMIN)
                        .map(Group.GroupMember::getUserId);

        Stream.concat(owner, admins)
                .filter(Objects::nonNull)
                .distinct()
                .filter(userId -> !userId.equals(actorUserId))
                .forEach(userId -> notificationService.send(userId, type, group.getId(), message, referenceId));
    }

    private void requireOwnerOrAdmin(String groupId) {
        if (!groupSecurityService.hasAdminAccess(groupId)) {
            throw new ForbiddenException("Only the group owner or a group admin can manage upgrade requests");
        }
    }

    private Group findGroup(String groupId) {
        return groupRepository.findById(groupId)
                .orElseThrow(() -> new ResourceNotFoundException("Group", "id", groupId));
    }

    private PermissionUpgradeRequest findRequest(String groupId, String requestId) {
        PermissionUpgradeRequest request = permissionUpgradeRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("PermissionUpgradeRequest", "id", requestId));
        if (!groupId.equals(request.getGroupId())) {
            throw new ResourceNotFoundException("PermissionUpgradeRequest", "id", requestId);
        }
        return request;
    }

    private User findCurrentUser() {
        return userRepository.findById(groupSecurityService.getCurrentUserId())
                .orElseThrow(() -> new IllegalStateException("Authenticated user not found"));
    }

    private Group.GroupMember findMember(Group group, String userId) {
        if (group.getMembers() == null) {
            throw new ForbiddenException("You are not a member of this group");
        }
        return group.getMembers().stream()
                .filter(m -> userId.equals(m.getUserId()))
                .findFirst()
                .orElseThrow(() -> new ForbiddenException("You are not a member of this group"));
    }

    private void ensurePending(PermissionUpgradeRequest request) {
        if (request.getStatus() != PermissionUpgradeRequest.Status.PENDING) {
            throw new IllegalArgumentException("Only pending upgrade requests can be reviewed");
        }
    }

    private Group.Permission toGroupPermission(PermissionUpgradeRequest.UpgradePermission permission) {
        return switch (permission) {
            case VIEW -> Group.Permission.VIEW;
            case EDIT -> Group.Permission.EDIT;
            case ADMIN -> Group.Permission.ADMIN;
        };
    }

    private String blankToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String buildReviewSuffix(String note) {
        return note == null ? "" : ". Note: " + note;
    }

    private int permissionRank(Group.Permission permission) {
        return switch (permission) {
            case VIEW -> 1;
            case EDIT -> 2;
            case ADMIN -> 3;
        };
    }

    private UpgradeRequestDto toDto(PermissionUpgradeRequest request) {
        return UpgradeRequestDto.builder()
                .id(request.getId())
                .groupId(request.getGroupId())
                .groupName(request.getGroupName())
                .requestedBy(request.getRequestedBy())
                .requestedByName(request.getRequestedByName())
                .requestedByEmail(request.getRequestedByEmail())
                .currentPermission(request.getCurrentPermission())
                .requestedPermission(request.getRequestedPermission())
                .reason(request.getReason())
                .status(request.getStatus())
                .reviewedBy(request.getReviewedBy())
                .reviewedByName(request.getReviewedByName())
                .reviewNote(request.getReviewNote())
                .createdAt(request.getCreatedAt())
                .reviewedAt(request.getReviewedAt())
                .build();
    }
}
