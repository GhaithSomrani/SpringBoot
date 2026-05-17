package com.xbc.backend.service;

import com.xbc.backend.dto.invitation.CreateInvitationRequest;
import com.xbc.backend.dto.invitation.InvitationAcceptResponse;
import com.xbc.backend.dto.invitation.InvitationDeclineResponse;
import com.xbc.backend.dto.invitation.InvitationDto;
import com.xbc.backend.exception.AlreadyMemberException;
import com.xbc.backend.exception.DuplicateInvitationException;
import com.xbc.backend.exception.ForbiddenException;
import com.xbc.backend.exception.ResourceNotFoundException;
import com.xbc.backend.model.AuditLog;
import com.xbc.backend.model.Group;
import com.xbc.backend.model.Invitation;
import com.xbc.backend.model.Notification;
import com.xbc.backend.model.User;
import com.xbc.backend.repository.GroupRepository;
import com.xbc.backend.repository.InvitationRepository;
import com.xbc.backend.repository.UserRepository;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class InvitationService {

    private static final long EXPIRY_HOURS = 48;

    private final InvitationRepository invitationRepository;
    private final GroupRepository groupRepository;
    private final UserRepository userRepository;
    private final GroupSecurityService groupSecurityService;
    private final JavaMailSender mailSender;
    private final TemplateEngine templateEngine;
    private final AuditService auditService;
    private final NotificationService notificationService;

    @Value("${frontend.url}")
    private String frontendUrl;

    @Value("${spring.mail.username}")
    private String fromEmail;

    public InvitationService(InvitationRepository invitationRepository,
                             GroupRepository groupRepository,
                             UserRepository userRepository,
                             GroupSecurityService groupSecurityService,
                             JavaMailSender mailSender,
                             TemplateEngine templateEngine,
                             AuditService auditService,
                             NotificationService notificationService) {
        this.invitationRepository = invitationRepository;
        this.groupRepository = groupRepository;
        this.userRepository = userRepository;
        this.groupSecurityService = groupSecurityService;
        this.mailSender = mailSender;
        this.templateEngine = templateEngine;
        this.auditService = auditService;
        this.notificationService = notificationService;
    }

    public InvitationDto sendInvitation(String groupId, CreateInvitationRequest req) {
        Group group = findGroup(groupId);
        requireEditAccess(groupId);

        String normalizedEmail = req.getEmail().trim().toLowerCase();
        assertNotMember(group, normalizedEmail);
        assertNoPendingInvite(groupId, normalizedEmail);

        User inviter = findUser(groupSecurityService.getCurrentUserId());
        Invitation saved = createAndDispatchInvitation(group, inviter, normalizedEmail, req.getPermission());

        userRepository.findByEmail(normalizedEmail).ifPresent(invitedUser ->
                notificationService.send(
                        invitedUser.getId(),
                        Notification.Type.INVITE_RECEIVED,
                        groupId,
                        "You've been invited to join " + group.getName(),
                        saved.getId()));

        return toDto(saved);
    }

    public InvitationAcceptResponse acceptInvitation(String token) {
        Invitation invitation = findByToken(token);
        validateInvitationForAction(invitation);

        User currentUser = getAuthenticatedUserOrNull();
        if (currentUser == null) {
            return InvitationAcceptResponse.builder()
                    .groupId(invitation.getGroupId())
                    .groupName(invitation.getGroupName())
                    .requiresAuth(true)
                    .invitedEmail(invitation.getInvitedEmail())
                    .permission(invitation.getPermission())
                    .build();
        }

        if (!currentUser.getEmail().equalsIgnoreCase(invitation.getInvitedEmail())) {
            throw new ForbiddenException("This invitation was sent to a different email address");
        }

        Group group = findGroup(invitation.getGroupId());
        if (isMember(group, currentUser.getId(), currentUser.getEmail())) {
            throw new AlreadyMemberException("This user is already a member of the group");
        }

        Group.GroupMember newMember = Group.GroupMember.builder()
                .userId(currentUser.getId())
                .email(currentUser.getEmail())
                .permission(invitation.getPermission())
                .joinedAt(Instant.now())
                .build();

        if (group.getMembers() == null) {
            group.setMembers(new ArrayList<>());
        }
        group.getMembers().add(newMember);
        groupRepository.save(group);

        invitation.setStatus(Invitation.Status.ACCEPTED);
        invitation.setRespondedAt(Instant.now());
        invitationRepository.save(invitation);

        notificationService.send(
                group.getOwnerId(),
                Notification.Type.INVITATION_ACCEPTED,
                invitation.getGroupId(),
                currentUser.getUsername() + " accepted the invitation to join " + invitation.getGroupName(),
                invitation.getId());

        auditService.log(
                invitation.getGroupId(),
                AuditLog.Action.JOINED,
                AuditLog.EntityType.MEMBER,
                currentUser.getId(),
                new AuditLog.Performer(currentUser.getId(), currentUser.getEmail()),
                null);

        return InvitationAcceptResponse.builder()
                .groupId(invitation.getGroupId())
                .groupName(invitation.getGroupName())
                .requiresAuth(false)
                .invitedEmail(invitation.getInvitedEmail())
                .permission(invitation.getPermission())
                .build();
    }

    public InvitationDeclineResponse declineInvitation(String token) {
        Invitation invitation = findByToken(token);
        validateInvitationForAction(invitation);

        invitation.setStatus(Invitation.Status.DECLINED);
        invitation.setRespondedAt(Instant.now());
        invitationRepository.save(invitation);

        notificationService.send(
                invitation.getInvitedBy(),
                Notification.Type.INVITATION_DECLINED,
                invitation.getGroupId(),
                invitation.getInvitedEmail() + " declined the invitation to join " + invitation.getGroupName(),
                invitation.getId());

        return InvitationDeclineResponse.builder()
                .groupName(invitation.getGroupName())
                .build();
    }

    public void cancelInvitation(String groupId, String invitationId) {
        findGroup(groupId);
        requireEditAccess(groupId);

        Invitation invitation = findInvitationInGroup(groupId, invitationId);
        if (invitation.getStatus() != Invitation.Status.PENDING) {
            throw new IllegalArgumentException("Only pending invitations can be cancelled");
        }

        invitation.setStatus(Invitation.Status.CANCELLED);
        invitation.setRespondedAt(Instant.now());
        invitationRepository.save(invitation);
    }

    public InvitationDto resendInvitation(String groupId, String invitationId) {
        Group group = findGroup(groupId);
        requireEditAccess(groupId);

        Invitation existing = findInvitationInGroup(groupId, invitationId);
        if (existing.getStatus() != Invitation.Status.EXPIRED && existing.getStatus() != Invitation.Status.CANCELLED) {
            throw new IllegalArgumentException("Only expired or cancelled invitations can be resent");
        }

        assertNotMember(group, existing.getInvitedEmail());
        assertNoPendingInvite(groupId, existing.getInvitedEmail());

        User inviter = findUser(groupSecurityService.getCurrentUserId());
        Invitation resent = createAndDispatchInvitation(group, inviter, existing.getInvitedEmail(), existing.getPermission());
        return toDto(resent);
    }

    public List<InvitationDto> listInvitations(String groupId, Invitation.Status status) {
        findGroup(groupId);
        requireEditAccess(groupId);

        List<Invitation> invitations = status == null
                ? invitationRepository.findByGroupIdOrderByCreatedAtDesc(groupId)
                : invitationRepository.findByGroupIdAndStatus(groupId, status);

        return invitations.stream().map(this::toDto).collect(Collectors.toList());
    }

    public List<InvitationDto> listMyInvitations() {
        User currentUser = findUser(groupSecurityService.getCurrentUserId());
        return invitationRepository.findByInvitedEmailOrderByCreatedAtDesc(currentUser.getEmail())
                .stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Scheduled(cron = "0 0 * * * *")
    public void expirePendingInvitations() {
        Instant now = Instant.now();
        List<Invitation> expiredInvitations = invitationRepository.findExpiredInvitations(now);
        if (expiredInvitations.isEmpty()) {
            return;
        }

        expiredInvitations.forEach(invitation -> {
            invitation.setStatus(Invitation.Status.EXPIRED);
            invitation.setRespondedAt(now);
        });
        invitationRepository.saveAll(expiredInvitations);
    }

    private Group findGroup(String groupId) {
        return groupRepository.findById(groupId)
                .orElseThrow(() -> new ResourceNotFoundException("Group", "id", groupId));
    }

    private User findUser(String userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new IllegalStateException("Authenticated user not found"));
    }

    private Invitation findByToken(String token) {
        return invitationRepository.findByToken(token)
                .orElseThrow(() -> new ResourceNotFoundException("Invitation", "token", token));
    }

    private Invitation findInvitationInGroup(String groupId, String invitationId) {
        Invitation invitation = invitationRepository.findById(invitationId)
                .orElseThrow(() -> new ResourceNotFoundException("Invitation", "id", invitationId));
        if (!invitation.getGroupId().equals(groupId)) {
            throw new ResourceNotFoundException("Invitation", "id", invitationId);
        }
        return invitation;
    }

    private void requireEditAccess(String groupId) {
        if (!groupSecurityService.hasEditAccess(groupId)) {
            throw new ForbiddenException("You need edit access to manage invitations");
        }
    }

    private boolean isMember(Group group, String userId, String email) {
        if (group.getOwnerId().equals(userId)) {
            return true;
        }
        return group.getMembers() != null && group.getMembers().stream()
                .anyMatch(m -> userId.equals(m.getUserId()) ||
                        (m.getEmail() != null && m.getEmail().equalsIgnoreCase(email)));
    }

    private void assertNotMember(Group group, String email) {
        boolean owner = userRepository.findById(group.getOwnerId())
                .map(User::getEmail)
                .map(ownerEmail -> ownerEmail.equalsIgnoreCase(email))
                .orElse(false);
        boolean member = group.getMembers() != null && group.getMembers().stream()
                .anyMatch(m -> m.getEmail() != null && m.getEmail().equalsIgnoreCase(email));
        if (owner || member) {
            throw new AlreadyMemberException("A user with this email is already a member of the group");
        }
    }

    private void assertNoPendingInvite(String groupId, String email) {
        if (invitationRepository.existsByGroupIdAndInvitedEmailAndStatus(groupId, email, Invitation.Status.PENDING)) {
            throw new DuplicateInvitationException("A pending invitation already exists for this email in this group");
        }
    }

    private void validateInvitationForAction(Invitation invitation) {
        if (invitation.getStatus() == Invitation.Status.ACCEPTED) {
            throw new IllegalArgumentException("Invitation has already been accepted");
        }
        if (invitation.getStatus() == Invitation.Status.DECLINED) {
            throw new IllegalArgumentException("Invitation has already been declined");
        }
        if (invitation.getStatus() == Invitation.Status.CANCELLED) {
            throw new IllegalArgumentException("Invitation has been cancelled");
        }
        if (invitation.getStatus() == Invitation.Status.EXPIRED || Instant.now().isAfter(invitation.getExpiresAt())) {
            invitation.setStatus(Invitation.Status.EXPIRED);
            invitation.setRespondedAt(Instant.now());
            invitationRepository.save(invitation);
            throw new IllegalArgumentException("Invitation has expired");
        }
        if (invitation.getStatus() != Invitation.Status.PENDING) {
            throw new IllegalArgumentException("Invitation is no longer valid");
        }
    }

    private User getAuthenticatedUserOrNull() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth instanceof AnonymousAuthenticationToken) {
            return null;
        }
        return userRepository.findByUsername(auth.getName()).orElse(null);
    }

    private Invitation createAndDispatchInvitation(Group group, User inviter, String email, Group.Permission permission) {
        String token = UUID.randomUUID().toString();
        Instant expiresAt = Instant.now().plus(EXPIRY_HOURS, ChronoUnit.HOURS);

        Invitation invitation = Invitation.builder()
                .groupId(group.getId())
                .groupName(group.getName())
                .invitedEmail(email)
                .invitedBy(inviter.getId())
                .invitedByName(inviter.getUsername())
                .token(token)
                .permission(permission)
                .status(Invitation.Status.PENDING)
                .expiresAt(expiresAt)
                .build();

        Invitation saved = invitationRepository.save(invitation);

        try {
            sendEmail(
                    email,
                    group.getName(),
                    inviter.getUsername(),
                    permission.name(),
                    buildAcceptUrl(token),
                    buildDeclineUrl(token));
        } catch (Exception e) {
            // Email failure should not roll back the invitation record
        }

        return saved;
    }

    private void sendEmail(String to, String groupName, String invitedByName,
                           String permission, String acceptUrl, String declineUrl) throws MessagingException {
        Context ctx = new Context();
        ctx.setVariable("groupName", groupName);
        ctx.setVariable("invitedByName", invitedByName);
        ctx.setVariable("permission", permission);
        ctx.setVariable("acceptUrl", acceptUrl);
        ctx.setVariable("declineUrl", declineUrl);
        ctx.setVariable("expiryHours", EXPIRY_HOURS);

        String html = templateEngine.process("invitation-email", ctx);

        MimeMessage message = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
        helper.setFrom(fromEmail);
        helper.setTo(to);
        helper.setSubject("You've been invited to join " + groupName);
        helper.setText(html, true);
        mailSender.send(message);
    }

    private String buildAcceptUrl(String token) {
        return frontendUrl + "/invite/accept?token=" + token;
    }

    private String buildDeclineUrl(String token) {
        return frontendUrl + "/invite/decline?token=" + token;
    }

    private InvitationDto toDto(Invitation inv) {
        return InvitationDto.builder()
                .id(inv.getId())
                .groupId(inv.getGroupId())
                .groupName(inv.getGroupName())
                .invitedEmail(inv.getInvitedEmail())
                .invitedBy(inv.getInvitedBy())
                .invitedByName(inv.getInvitedByName())
                .permission(inv.getPermission())
                .status(inv.getStatus())
                .expiresAt(inv.getExpiresAt())
                .createdAt(inv.getCreatedAt())
                .respondedAt(inv.getRespondedAt())
                .directLink(buildAcceptUrl(inv.getToken()))
                .acceptUrl(buildAcceptUrl(inv.getToken()))
                .declineUrl(buildDeclineUrl(inv.getToken()))
                .build();
    }
}
