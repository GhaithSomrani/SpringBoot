package com.xbc.backend.model;

import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.*;

import java.time.Instant;

@Getter
@Setter
public abstract class BaseEntity {

    @Id
    private String id;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;

    @CreatedBy
    private String createdBy;

    @LastModifiedBy
    private String lastModifiedBy;
}
