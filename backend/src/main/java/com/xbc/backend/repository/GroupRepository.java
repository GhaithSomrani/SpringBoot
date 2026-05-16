package com.xbc.backend.repository;

import com.xbc.backend.model.Group;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface GroupRepository extends MongoRepository<Group, String> {
    List<Group> findByOwnerId(String ownerId);
    List<Group> findByMembersUserId(String userId);
}
