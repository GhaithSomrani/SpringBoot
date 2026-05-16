package com.xbc.backend.dto.file;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FileUploadResponse {
    private String fileId;
    private String originalFilename;
    private String contentType;
    private long size;
}
