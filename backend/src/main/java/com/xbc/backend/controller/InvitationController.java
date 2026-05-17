package com.xbc.backend.controller;

import com.xbc.backend.dto.ApiResponse;
import com.xbc.backend.dto.invitation.CreateInvitationRequest;
import com.xbc.backend.dto.invitation.InvitationAcceptResponse;
import com.xbc.backend.dto.invitation.InvitationDeclineResponse;
import com.xbc.backend.dto.invitation.InvitationDto;
import com.xbc.backend.model.Invitation;
import com.xbc.backend.service.InvitationService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class InvitationController {

    private final InvitationService invitationService;

    public InvitationController(InvitationService invitationService) {
        this.invitationService = invitationService;
    }

    @PostMapping("/api/groups/{groupId}/invitations")
    public ResponseEntity<ApiResponse<InvitationDto>> send(
            @PathVariable String groupId,
            @Valid @RequestBody CreateInvitationRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Invitation sent",
                        invitationService.sendInvitation(groupId, request)));
    }

    @GetMapping("/api/invitations/accept")
    public ResponseEntity<ApiResponse<InvitationAcceptResponse>> accept(@RequestParam String token) {
        InvitationAcceptResponse response = invitationService.acceptInvitation(token);
        String message = response.isRequiresAuth()
                ? "Authentication required to complete this invitation"
                : "Invitation accepted";
        return ResponseEntity.ok(ApiResponse.success(message, response));
    }

    @GetMapping("/api/invitations/decline")
    public ResponseEntity<ApiResponse<InvitationDeclineResponse>> decline(@RequestParam String token) {
        return ResponseEntity.ok(ApiResponse.success(
                "Invitation declined",
                invitationService.declineInvitation(token)));
    }

    @DeleteMapping("/api/groups/{groupId}/invitations/{id}")
    public ResponseEntity<ApiResponse<Void>> cancel(
            @PathVariable String groupId,
            @PathVariable String id) {
        invitationService.cancelInvitation(groupId, id);
        return ResponseEntity.ok(ApiResponse.success("Invitation cancelled", null));
    }

    @PostMapping("/api/groups/{groupId}/invitations/{id}/resend")
    public ResponseEntity<ApiResponse<InvitationDto>> resend(
            @PathVariable String groupId,
            @PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.success(
                "Invitation resent",
                invitationService.resendInvitation(groupId, id)));
    }

    @GetMapping("/api/groups/{groupId}/invitations")
    public ResponseEntity<ApiResponse<List<InvitationDto>>> list(
            @PathVariable String groupId,
            @RequestParam(required = false) Invitation.Status status) {
        return ResponseEntity.ok(ApiResponse.success(invitationService.listInvitations(groupId, status)));
    }

    @GetMapping("/api/users/me/invitations")
    public ResponseEntity<ApiResponse<List<InvitationDto>>> listMyInvitations() {
        return ResponseEntity.ok(ApiResponse.success(invitationService.listMyInvitations()));
    }
}
