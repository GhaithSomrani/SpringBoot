package com.xbc.backend.service;

import com.xbc.backend.annotation.Auditable;
import com.xbc.backend.dto.group.*;
import com.xbc.backend.exception.ForbiddenException;
import com.xbc.backend.exception.ResourceNotFoundException;
import com.xbc.backend.model.AuditLog;
import com.xbc.backend.model.Group;
import com.xbc.backend.model.Group.GroupMember;
import com.xbc.backend.repository.GroupRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
public class GroupService {

    private final GroupRepository groupRepository;
    private final GroupSecurityService groupSecurityService;
    private final CategoryService categoryService;

    public GroupService(GroupRepository groupRepository,
                        GroupSecurityService groupSecurityService,
                        CategoryService categoryService) {
        this.groupRepository = groupRepository;
        this.groupSecurityService = groupSecurityService;
        this.categoryService = categoryService;
    }

    @Auditable(action = AuditLog.Action.CREATED, entityType = AuditLog.EntityType.GROUP,
               groupIdIndex = -1, entityIdIndex = -1)
    public GroupDto createGroup(CreateGroupRequest request) {
        String userId = groupSecurityService.getCurrentUserId();
        Group group = Group.builder()
                .name(request.getName())
                .description(request.getDescription())
                .ownerId(userId)
                .members(new ArrayList<>())
                .build();
        Group saved = groupRepository.save(group);
        categoryService.seedDefaultCategories(saved.getId());
        return toDto(saved);
    }

    public List<GroupDto> getMyGroups() {
        String userId = groupSecurityService.getCurrentUserId();
        List<Group> owned = groupRepository.findByOwnerId(userId);
        List<Group> memberOf = groupRepository.findByMembersUserId(userId);
        return Stream.concat(owned.stream(), memberOf.stream())
                .distinct()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    public GroupDto getGroup(String groupId) {
        if (!groupSecurityService.hasViewAccess(groupId)) {
            throw new ForbiddenException("You do not have access to this group");
        }
        return toDto(findOrThrow(groupId));
    }

    @Auditable(action = AuditLog.Action.UPDATED, entityType = AuditLog.EntityType.GROUP,
               groupIdIndex = 0, entityIdIndex = 0)
    public GroupDto updateGroup(String groupId, UpdateGroupRequest request) {
        if (!groupSecurityService.isOwner(groupId)) {
            throw new ForbiddenException("Only the owner can update this group");
        }
        Group group = findOrThrow(groupId);
        if (request.getName() != null) {
            group.setName(request.getName());
        }
        if (request.getDescription() != null) {
            group.setDescription(request.getDescription());
        }
        return toDto(groupRepository.save(group));
    }

    @Auditable(action = AuditLog.Action.DELETED, entityType = AuditLog.EntityType.GROUP,
               groupIdIndex = 0, entityIdIndex = 0)
    public void deleteGroup(String groupId) {
        if (!groupSecurityService.isOwner(groupId)) {
            throw new ForbiddenException("Only the owner can delete this group");
        }
        findOrThrow(groupId);
        groupRepository.deleteById(groupId);
    }

    @Auditable(action = AuditLog.Action.PERMISSION_CHANGED, entityType = AuditLog.EntityType.MEMBER,
               groupIdIndex = 0, entityIdIndex = 1)
    public GroupDto updateMemberPermission(String groupId, String targetUserId, UpdatePermissionRequest request) {
        if (!groupSecurityService.hasEditAccess(groupId)) {
            throw new ForbiddenException("Only the owner or editors can change member permissions");
        }
        Group group = findOrThrow(groupId);
        GroupMember member = group.getMembers().stream()
                .filter(m -> m.getUserId().equals(targetUserId))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Member", "userId", targetUserId));
        member.setPermission(request.getPermission());
        return toDto(groupRepository.save(group));
    }

    @Auditable(action = AuditLog.Action.LEFT, entityType = AuditLog.EntityType.MEMBER,
               groupIdIndex = 0, entityIdIndex = 1)
    public GroupDto removeMember(String groupId, String targetUserId) {
        if (!groupSecurityService.hasEditAccess(groupId)) {
            throw new ForbiddenException("Only the owner or editors can remove members");
        }
        Group group = findOrThrow(groupId);
        boolean removed = group.getMembers().removeIf(m -> m.getUserId().equals(targetUserId));
        if (!removed) {
            throw new ResourceNotFoundException("Member", "userId", targetUserId);
        }
        return toDto(groupRepository.save(group));
    }

    private Group findOrThrow(String groupId) {
        return groupRepository.findById(groupId)
                .orElseThrow(() -> new ResourceNotFoundException("Group", "id", groupId));
    }

    private GroupDto toDto(Group group) {
        List<GroupMemberDto> memberDtos = group.getMembers() == null ? List.of() :
                group.getMembers().stream()
                        .map(m -> GroupMemberDto.builder()
                                .userId(m.getUserId())
                                .email(m.getEmail())
                                .permission(m.getPermission())
                                .joinedAt(m.getJoinedAt())
                                .build())
                        .collect(Collectors.toList());
        return GroupDto.builder()
                .id(group.getId())
                .name(group.getName())
                .description(group.getDescription())
                .ownerId(group.getOwnerId())
                .members(memberDtos)
                .createdAt(group.getCreatedAt())
                .updatedAt(group.getUpdatedAt())
                .build();
    }
}
