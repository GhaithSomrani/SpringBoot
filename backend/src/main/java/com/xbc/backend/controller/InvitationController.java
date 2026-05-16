package com.xbc.backend.controller;

import com.xbc.backend.dto.ApiResponse;
import com.xbc.backend.dto.invitation.CreateInvitationRequest;
import com.xbc.backend.dto.invitation.InvitationDto;
import com.xbc.backend.dto.invitation.InvitationResponse;
import com.xbc.backend.service.InvitationService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
public class InvitationController {

    private final InvitationService invitationService;

    public InvitationController(InvitationService invitationService) {
        this.invitationService = invitationService;
    }

    @PostMapping("/api/groups/{groupId}/invitations")
    public ResponseEntity<ApiResponse<InvitationResponse>> send(
            @PathVariable String groupId,
            @Valid @RequestBody CreateInvitationRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Invitation sent",
                        invitationService.sendInvitation(groupId, request)));
    }

    @GetMapping("/api/invitations/accept")
    public ResponseEntity<ApiResponse<Void>> accept(@RequestParam String token) {
        invitationService.acceptInvitation(token);
        return ResponseEntity.ok(ApiResponse.success("Invitation accepted — you have joined the group", null));
    }

    @GetMapping("/api/groups/{groupId}/invitations")
    public ResponseEntity<ApiResponse<List<InvitationDto>>> list(@PathVariable String groupId) {
        return ResponseEntity.ok(ApiResponse.success(invitationService.listPending(groupId)));
    }

    @DeleteMapping("/api/groups/{groupId}/invitations/{id}")
    public ResponseEntity<ApiResponse<Void>> cancel(
            @PathVariable String groupId,
            @PathVariable String id) {
        invitationService.cancelInvitation(groupId, id);
        return ResponseEntity.ok(ApiResponse.success("Invitation cancelled", null));
    }
}
