package com.xbc.backend.service;

import com.xbc.backend.model.Group;
import com.xbc.backend.model.User;
import com.xbc.backend.repository.GroupRepository;
import com.xbc.backend.repository.UserRepository;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

@Service("groupSecurityService")
public class GroupSecurityService {

    private final GroupRepository groupRepository;
    private final UserRepository userRepository;

    public GroupSecurityService(GroupRepository groupRepository, UserRepository userRepository) {
        this.groupRepository = groupRepository;
        this.userRepository = userRepository;
    }

    /** True if the current user is the owner or any member of the group. */
    public boolean hasViewAccess(String groupId) {
        String userId = getCurrentUserId();
        return groupRepository.findById(groupId)
                .map(g -> g.getOwnerId().equals(userId) ||
                        g.getMembers().stream().anyMatch(m -> m.getUserId().equals(userId)))
                .orElse(false);
    }

    /** True if the current user is the owner or a member with EDIT permission. */
    public boolean hasEditAccess(String groupId) {
        String userId = getCurrentUserId();
        return groupRepository.findById(groupId)
                .map(g -> g.getOwnerId().equals(userId) ||
                        g.getMembers().stream().anyMatch(m ->
                                m.getUserId().equals(userId) &&
                                m.getPermission() == Group.Permission.EDIT))
                .orElse(false);
    }

    /** True if the current user is the owner of the group. */
    public boolean isOwner(String groupId) {
        String userId = getCurrentUserId();
        return groupRepository.findById(groupId)
                .map(g -> g.getOwnerId().equals(userId))
                .orElse(false);
    }

    public String getCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return userRepository.findByUsername(auth.getName())
                .map(User::getId)
                .orElseThrow(() -> new IllegalStateException("Authenticated user not found in database"));
    }
}
