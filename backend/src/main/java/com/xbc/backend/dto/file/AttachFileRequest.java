package com.xbc.backend.dto.file;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class AttachFileRequest {

    @NotBlank
    private String fileId;
}
