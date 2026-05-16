package com.xbc.backend.dto.event;

import com.xbc.backend.model.Event.Status;
import jakarta.validation.constraints.Size;
import lombok.*;

import java.time.LocalDate;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class UpdateEventRequest {

    @Size(min = 1, max = 200)
    private String title;

    @Size(max = 1000)
    private String description;

    private LocalDate startDate;
    private LocalDate endDate;
    private List<String> categories;
    private Status status;
}
