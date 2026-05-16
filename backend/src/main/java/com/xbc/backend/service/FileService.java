package com.xbc.backend.service;

import com.xbc.backend.dto.file.FileUploadResponse;
import com.xbc.backend.exception.ForbiddenException;
import com.xbc.backend.exception.ResourceNotFoundException;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.gridfs.GridFsResource;
import org.springframework.data.mongodb.gridfs.GridFsTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.mongodb.client.gridfs.model.GridFSFile;

import java.io.IOException;
import java.util.List;
import java.util.Set;

@Service
public class FileService {

    private static final long MAX_SIZE_BYTES = 10L * 1024 * 1024;

    private static final Set<String> ALLOWED_TYPES = Set.of(
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-powerpoint",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "text/plain",
            "text/csv"
    );

    private final GridFsTemplate gridFsTemplate;
    private final GroupSecurityService groupSecurityService;

    public FileService(GridFsTemplate gridFsTemplate, GroupSecurityService groupSecurityService) {
        this.gridFsTemplate = gridFsTemplate;
        this.groupSecurityService = groupSecurityService;
    }

    public FileUploadResponse upload(MultipartFile file, String groupId) throws IOException {
        if (!groupSecurityService.hasEditAccess(groupId)) {
            throw new ForbiddenException("You need edit access to upload files to this group");
        }
        String contentType = validateFile(file);
        String userId = groupSecurityService.getCurrentUserId();

        Document metadata = new Document()
                .append("uploadedBy", userId)
                .append("groupId", groupId)
                .append("originalFilename", file.getOriginalFilename());

        ObjectId fileId = gridFsTemplate.store(
                file.getInputStream(),
                file.getOriginalFilename(),
                contentType,
                metadata
        );

        return FileUploadResponse.builder()
                .fileId(fileId.toHexString())
                .originalFilename(file.getOriginalFilename())
                .contentType(contentType)
                .size(file.getSize())
                .build();
    }

    public GridFsResource getResource(String fileId) {
        GridFSFile gridFSFile = findOrThrow(fileId);
        String groupId = metadataString(gridFSFile, "groupId");
        if (!groupSecurityService.hasViewAccess(groupId)) {
            throw new ForbiddenException("You do not have access to this file");
        }
        return gridFsTemplate.getResource(gridFSFile);
    }

    public void delete(String fileId) {
        GridFSFile gridFSFile = findOrThrow(fileId);
        String groupId    = metadataString(gridFSFile, "groupId");
        String uploadedBy = metadataString(gridFSFile, "uploadedBy");
        String currentUserId = groupSecurityService.getCurrentUserId();
        if (!currentUserId.equals(uploadedBy) && !groupSecurityService.hasEditAccess(groupId)) {
            throw new ForbiddenException("You can only delete files you uploaded, or you need edit access");
        }
        gridFsTemplate.delete(queryById(fileId));
    }

    /** Internal use only — called when an expense is deleted. No auth check. */
    public void deleteAll(List<String> fileIds) {
        if (fileIds == null || fileIds.isEmpty()) return;
        for (String fileId : fileIds) {
            try {
                gridFsTemplate.delete(queryById(fileId));
            } catch (Exception ignored) {
                // best-effort: don't let a missing file block expense deletion
            }
        }
    }

    // --- helpers ---

    private String validateFile(MultipartFile file) {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("Uploaded file is empty");
        }
        if (file.getSize() > MAX_SIZE_BYTES) {
            throw new IllegalArgumentException("File size exceeds the maximum allowed limit of 10MB");
        }
        String contentType = file.getContentType();
        if (contentType == null
                || (!contentType.startsWith("image/") && !ALLOWED_TYPES.contains(contentType))) {
            throw new IllegalArgumentException(
                    "File type not allowed: " + contentType +
                    ". Accepted: images, PDF, Word, Excel, PowerPoint, plain text, CSV");
        }
        return contentType;
    }

    private GridFSFile findOrThrow(String fileId) {
        GridFSFile file = gridFsTemplate.findOne(queryById(fileId));
        if (file == null) {
            throw new ResourceNotFoundException("File", "id", fileId);
        }
        return file;
    }

    private Query queryById(String fileId) {
        ObjectId objectId;
        try {
            objectId = new ObjectId(fileId);
        } catch (IllegalArgumentException e) {
            throw new ResourceNotFoundException("File", "id", fileId);
        }
        return new Query(Criteria.where("_id").is(objectId));
    }

    private String metadataString(GridFSFile file, String key) {
        Document meta = file.getMetadata();
        return meta != null ? meta.getString(key) : null;
    }
}
