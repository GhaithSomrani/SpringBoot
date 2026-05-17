package com.xbc.backend.repository;

import com.xbc.backend.model.Invitation;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface InvitationRepository extends MongoRepository<Invitation, String> {

    Optional<Invitation> findByToken(String token);

    List<Invitation> findByGroupIdOrderByCreatedAtDesc(String groupId);

    List<Invitation> findByGroupIdAndStatus(String groupId, Invitation.Status status);

    List<Invitation> findByInvitedEmailOrderByCreatedAtDesc(String invitedEmail);

    List<Invitation> findByInvitedEmailAndStatus(String invitedEmail, Invitation.Status status);

    @Query("{ 'expiresAt': { $lt: ?0 }, 'status': 'PENDING' }")
    List<Invitation> findExpiredInvitations(Instant now);

    boolean existsByGroupIdAndInvitedEmailAndStatus(String groupId, String invitedEmail, Invitation.Status status);
}
