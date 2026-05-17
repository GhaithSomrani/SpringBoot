package com.xbc.backend.exception;

public class DuplicatePendingRequestException extends RuntimeException {
    public DuplicatePendingRequestException(String message) {
        super(message);
    }
}
