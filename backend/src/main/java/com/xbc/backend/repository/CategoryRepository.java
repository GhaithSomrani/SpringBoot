package com.xbc.backend.repository;

import com.xbc.backend.model.Category;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface CategoryRepository extends MongoRepository<Category, String> {
    List<Category> findByGroupId(String groupId);
    boolean existsByGroupIdAndName(String groupId, String name);
}
