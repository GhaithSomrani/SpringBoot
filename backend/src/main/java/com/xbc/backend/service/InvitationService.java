package com.xbc.backend.service;

import com.xbc.backend.dto.invitation.CreateInvitationRequest;
import com.xbc.backend.dto.invitation.InvitationDto;
import com.xbc.backend.dto.invitation.InvitationResponse;
import com.xbc.backend.exception.ForbiddenException;
import com.xbc.backend.exception.ResourceNotFoundException;
import com.xbc.backend.model.Group;
import com.xbc.backend.model.Invitation;
import com.xbc.backend.model.User;
import com.xbc.backend.repository.GroupRepository;
import com.xbc.backend.repository.InvitationRepository;
import com.xbc.backend.repository.UserRepository;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
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

    @Value("${app.base-url}")
    private String baseUrl;

    @Value("${spring.mail.username}")
    private String fromEmail;

    public InvitationService(InvitationRepository invitationRepository,
                             GroupRepository groupRepository,
                             UserRepository userRepository,
                             GroupSecurityService groupSecurityService,
                             JavaMailSender mailSender,
                             TemplateEngine templateEngine) {
        this.invitationRepository = invitationRepository;
        this.groupRepository = groupRepository;
        this.userRepository = userRepository;
        this.groupSecurityService = groupSecurityService;
        this.mailSender = mailSender;
        this.templateEngine = templateEngine;
    }

    public InvitationResponse sendInvitation(String groupId, CreateInvitationRequest req) {
        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new ResourceNotFoundException("Group", "id", groupId));

        if (!groupSecurityService.hasEditAccess(groupId)) {
            throw new ForbiddenException("You need edit access to invite members");
        }

        if (invitationRepository.existsByGroupIdAndInvitedEmailAndStatus(
                groupId, req.getEmail(), Invitation.Status.PENDING)) {
            throw new IllegalArgumentException("A pending invitation already exists for this email");
        }

        String inviterId = groupSecurityService.getCurrentUserId();
        String token = UUID.randomUUID().toString();
        Instant expiresAt = Instant.now().plus(EXPIRY_HOURS, ChronoUnit.HOURS);

        Invitation invitation = Invitation.builder()
                .groupId(groupId)
                .invitedEmail(req.getEmail())
                .invitedBy(inviterId)
                .token(token)
                .permission(req.getPermission())
                .status(Invitation.Status.PENDING)
                .expiresAt(expiresAt)
                .build();

        Invitation saved = invitationRepository.save(invitation);
        String acceptUrl = baseUrl + "/api/invitations/accept?token=" + token;

        try {
            sendEmail(req.getEmail(), group.getName(), acceptUrl);
        } catch (Exception e) {
            // Email failure should not roll back the invitation record
        }

        return toResponse(saved, acceptUrl);
    }

    public void acceptInvitation(String token) {
        Invitation invitation = invitationRepository.findByToken(token)
                .orElseThrow(() -> new ResourceNotFoundException("Invitation", "token", token));

        if (invitation.getStatus() != Invitation.Status.PENDING) {
            throw new IllegalArgumentException("Invitation is no longer valid");
        }

        if (Instant.now().isAfter(invitation.getExpiresAt())) {
            invitation.setStatus(Invitation.Status.EXPIRED);
            invitationRepository.save(invitation);
            throw new IllegalArgumentException("Invitation has expired");
        }

        String currentUserId = groupSecurityService.getCurrentUserId();
        User currentUser = userRepository.findById(currentUserId)
                .orElseThrow(() -> new IllegalStateException("Authenticated user not found"));

        if (!currentUser.getEmail().equalsIgnoreCase(invitation.getInvitedEmail())) {
            throw new ForbiddenException("This invitation was sent to a different email address");
        }

        Group group = groupRepository.findById(invitation.getGroupId())
                .orElseThrow(() -> new ResourceNotFoundException("Group", "id", invitation.getGroupId()));

        boolean alreadyMember = group.getMembers() != null && group.getMembers().stream()
                .anyMatch(m -> m.getUserId().equals(currentUserId));

        if (!alreadyMember) {
            Group.GroupMember newMember = Group.GroupMember.builder()
                    .userId(currentUserId)
                    .email(currentUser.getEmail())
                    .permission(invitation.getPermission())
                    .joinedAt(Instant.now())
                    .build();

            if (group.getMembers() == null) {
                group.setMembers(new java.util.ArrayList<>());
            }
            group.getMembers().add(newMember);
            groupRepository.save(group);
        }

        invitation.setStatus(Invitation.Status.ACCEPTED);
        invitationRepository.save(invitation);
    }

    public List<InvitationDto> listPending(String groupId) {
        groupRepository.findById(groupId)
                .orElseThrow(() -> new ResourceNotFoundException("Group", "id", groupId));

        if (!groupSecurityService.hasEditAccess(groupId)) {
            throw new ForbiddenException("You need edit access to view invitations");
        }

        return invitationRepository.findByGroupIdAndStatus(groupId, Invitation.Status.PENDING)
                .stream().map(this::toDto).collect(Collectors.toList());
    }

    public void cancelInvitation(String groupId, String invitationId) {
        groupRepository.findById(groupId)
                .orElseThrow(() -> new ResourceNotFoundException("Group", "id", groupId));

        if (!groupSecurityService.hasEditAccess(groupId)) {
            throw new ForbiddenException("You need edit access to cancel invitations");
        }

        Invitation invitation = invitationRepository.findById(invitationId)
                .orElseThrow(() -> new ResourceNotFoundException("Invitation", "id", invitationId));

        if (!invitation.getGroupId().equals(groupId)) {
            throw new ResourceNotFoundException("Invitation", "id", invitationId);
        }

        if (invitation.getStatus() != Invitation.Status.PENDING) {
            throw new IllegalArgumentException("Only pending invitations can be cancelled");
        }

        invitationRepository.deleteById(invitationId);
    }

    // --- helpers ---

    private void sendEmail(String to, String groupName, String acceptUrl) throws MessagingException {
        Context ctx = new Context();
        ctx.setVariable("groupName", groupName);
        ctx.setVariable("acceptUrl", acceptUrl);
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

    private InvitationDto toDto(Invitation inv) {
        return InvitationDto.builder()
                .id(inv.getId())
                .groupId(inv.getGroupId())
                .invitedEmail(inv.getInvitedEmail())
                .invitedBy(inv.getInvitedBy())
                .permission(inv.getPermission())
                .status(inv.getStatus())
                .expiresAt(inv.getExpiresAt())
                .createdAt(inv.getCreatedAt())
                .build();
    }

    private InvitationResponse toResponse(Invitation inv, String acceptUrl) {
        return InvitationResponse.builder()
                .id(inv.getId())
                .groupId(inv.getGroupId())
                .invitedEmail(inv.getInvitedEmail())
                .invitedBy(inv.getInvitedBy())
                .permission(inv.getPermission())
                .status(inv.getStatus())
                .expiresAt(inv.getExpiresAt())
                .createdAt(inv.getCreatedAt())
                .acceptUrl(acceptUrl)
                .build();
    }
}
