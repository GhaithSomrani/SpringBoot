package com.xbc.backend.repository;

import com.xbc.backend.model.Invitation;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface InvitationRepository extends MongoRepository<Invitation, String> {

    Optional<Invitation> findByToken(String token);

    List<Invitation> findByGroupIdAndStatus(String groupId, Invitation.Status status);

    boolean existsByGroupIdAndInvitedEmailAndStatus(String groupId, String invitedEmail, Invitation.Status status);
}
