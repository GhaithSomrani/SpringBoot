package com.xbc.backend.exception;

public class AlreadyHasPermissionException extends RuntimeException {
    public AlreadyHasPermissionException(String message) {
        super(message);
    }
}
