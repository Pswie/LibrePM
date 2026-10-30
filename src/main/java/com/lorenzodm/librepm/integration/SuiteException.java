package com.lorenzodm.librepm.integration;

public class SuiteException extends RuntimeException {
    private final int status;
    private final String code;
    public SuiteException(int status, String code, String message) {
        super(message); this.status = status; this.code = code;
    }
    public int status() { return status; }
    public String code() { return code; }
    public static SuiteException invalid(String message) { return new SuiteException(400, "SUITE_INVALID_INPUT", message); }
    public static SuiteException unavailable(String message) { return new SuiteException(503, "SUITE_UNAVAILABLE", message); }
}
