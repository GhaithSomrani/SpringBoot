package com.xbc.backend.repository;

import com.xbc.backend.model.PermissionUpgradeRequest;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.util.List;

public interface PermissionUpgradeRequestRepository extends MongoRepository<PermissionUpgradeRequest, String> {

    List<PermissionUpgradeRequest> findByGroupIdOrderByCreatedAtDesc(String groupId);

    List<PermissionUpgradeRequest> findByGroupIdAndStatus(String groupId, PermissionUpgradeRequest.Status status);

    List<PermissionUpgradeRequest> findByRequestedByAndGroupId(String requestedBy, String groupId);

    List<PermissionUpgradeRequest> findByRequestedByOrderByCreatedAtDesc(String requestedBy);

    @Query("{ 'groupId': ?0, 'status': 'PENDING' }")
    List<PermissionUpgradeRequest> findPendingByGroupId(String groupId);
}
