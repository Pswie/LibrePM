package com.lorenzodm.librepm.api.controller;

import com.lorenzodm.librepm.api.exception.BadRequestException;
import com.lorenzodm.librepm.service.ForecastService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Map;

@RestController
@RequestMapping("/api/projects/{projectId}/forecast")
public class ForecastController {

    private final ForecastService forecastService;

    public ForecastController(ForecastService forecastService) {
        this.forecastService = forecastService;
    }

    @GetMapping("/earned-value")
    public ResponseEntity<Map<String, Object>> getEarnedValueMetrics(
            @PathVariable String projectId,
            @RequestParam(required = false) String asOfDate) {
        LocalDate date = asOfDate != null ? parseDate(asOfDate) : LocalDate.now();
        return ResponseEntity.ok(forecastService.computeEarnedValueMetrics(projectId, date));
    }

    @GetMapping("/resource-issues")
    public ResponseEntity<Map<String, Object>> getResourceIssues(
            @PathVariable String projectId,
            @RequestParam String from, @RequestParam String to) {
        return ResponseEntity.ok(
                forecastService.detectResourceIssues(projectId, parseDate(from), parseDate(to))
        );
    }

    private LocalDate parseDate(String value) {
        try {
            return LocalDate.parse(value);
        } catch (DateTimeParseException e) {
            throw new BadRequestException("Data non valida: usare il formato YYYY-MM-DD.");
        }
    }
}
