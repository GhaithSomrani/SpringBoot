package com.xbc.backend.repository;

import com.xbc.backend.model.Event;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface EventRepository extends MongoRepository<Event, String> {
    List<Event> findByGroupId(String groupId);
    List<Event> findByGroupIdAndStatus(String groupId, Event.Status status);
}
