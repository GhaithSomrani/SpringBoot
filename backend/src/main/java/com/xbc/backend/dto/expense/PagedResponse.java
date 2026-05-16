package com.xbc.backend.dto.expense;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.domain.Page;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
public class PagedResponse<T> {
    private List<T> content;
    private int page;
    private int size;
    private long totalElements;
    private int totalPages;
    private boolean last;

    public static <T> PagedResponse<T> from(Page<T> source) {
        PagedResponse<T> r = new PagedResponse<>();
        r.setContent(source.getContent());
        r.setPage(source.getNumber());
        r.setSize(source.getSize());
        r.setTotalElements(source.getTotalElements());
        r.setTotalPages(source.getTotalPages());
        r.setLast(source.isLast());
        return r;
    }
}
