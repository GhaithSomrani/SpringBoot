package com.xbc.backend.service;

import com.xbc.backend.dto.group.*;
import com.xbc.backend.exception.ForbiddenException;
import com.xbc.backend.exception.ResourceNotFoundException;
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

    public GroupService(GroupRepository groupRepository, GroupSecurityService groupSecurityService) {
        this.groupRepository = groupRepository;
        this.groupSecurityService = groupSecurityService;
    }

    public GroupDto createGroup(CreateGroupRequest request) {
        String userId = groupSecurityService.getCurrentUserId();
        Group group = Group.builder()
                .name(request.getName())
                .description(request.getDescription())
                .ownerId(userId)
                .members(new ArrayList<>())
                .build();
        return toDto(groupRepository.save(group));
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

    public void deleteGroup(String groupId) {
        if (!groupSecurityService.isOwner(groupId)) {
            throw new ForbiddenException("Only the owner can delete this group");
        }
        findOrThrow(groupId);
        groupRepository.deleteById(groupId);
    }

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
