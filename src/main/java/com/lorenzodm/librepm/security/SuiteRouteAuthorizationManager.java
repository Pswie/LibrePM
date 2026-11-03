package com.lorenzodm.librepm.security;

import com.lorenzodm.librepm.core.entity.User;
import com.lorenzodm.librepm.repository.ProjectMemberRepository;
import com.lorenzodm.librepm.repository.ProjectRepository;
import org.springframework.security.authorization.AuthorizationDecision;
import org.springframework.security.authorization.AuthorizationManager;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.access.intercept.RequestAuthorizationContext;
import java.util.Map;
import java.util.Set;
import java.util.function.Supplier;
import java.util.regex.Pattern;

/** Finite route capabilities plus existing identity and project membership restrictions. */
final class SuiteRouteAuthorizationManager implements AuthorizationManager<RequestAuthorizationContext> {
    static final String CALLER = "librepm.cloud.caller";
    private final ProjectRepository projects;
    private final ProjectMemberRepository members;
    private static final Pattern USER = Pattern.compile("^/api/users/([^/]+)(?:/|$)");
    private static final Pattern PROJECT = Pattern.compile("(?:^/api|^/api/users/[^/]+)/projects/([^/]+)(?:/|$)");
    SuiteRouteAuthorizationManager(ProjectRepository projects, ProjectMemberRepository members) { this.projects = projects; this.members = members; }
    @Override public AuthorizationDecision check(Supplier<Authentication> authentication, RequestAuthorizationContext context) {
        var request = context.getRequest();
        var current = authentication.get();
        if (current == null || !current.isAuthenticated() || !(request.getAttribute(SuiteAccessService.ATTRIBUTE) instanceof SuiteAccessService.AccessView view)) return new AuthorizationDecision(false);
        if (!"active".equals(view.status()) || !view.appEnabled()) return new AuthorizationDecision(false);
        String path = request.getRequestURI().substring(request.getContextPath().length());
        boolean write = !Set.of("GET", "HEAD", "OPTIONS").contains(request.getMethod());
        if (path.equals("/api/me/projects")) return new AuthorizationDecision(!write && view.permissions().stream().anyMatch(permission -> permission.startsWith("librepm.") && permission.endsWith(".read") && !Set.of("librepm.settings.read", "librepm.guides.read").contains(permission)));
        String module = module(path);
        if (module == null) return new AuthorizationDecision(view.owner());
        boolean moduleAllowed = view.allows(module, write);
        if (module.equals("planner") && path.matches(".*/projects/[^/]+/tasks(?:/.*)?")) {
            moduleAllowed = Set.of("planner", "kanban", "gantt", "calendar").stream().anyMatch(candidate -> view.allows(candidate, write));
        }
        if (!moduleAllowed) return new AuthorizationDecision(false);
        if (path.startsWith("/api/search") && !(view.allows("notes", false) && view.allows("planner", false))) return new AuthorizationDecision(false);
        if (view.owner()) return new AuthorizationDecision(true);
        if (!(request.getAttribute(CALLER) instanceof User caller) || !caller.isActive() || caller.isGhost()) return new AuthorizationDecision(false);
        var user = USER.matcher(path);
        if (user.find() && !user.group(1).equals(caller.getId())) return new AuthorizationDecision(false);
        var project = PROJECT.matcher(path);
        if (project.find() && !projects.existsByIdAndOwnerId(project.group(1), caller.getId()) && !members.existsByProjectIdAndUserId(project.group(1), caller.getId())) return new AuthorizationDecision(false);
        return new AuthorizationDecision(true);
    }
    static String module(String path) {
        String relative = path.replaceFirst("^/api/users/[^/]+", "").replaceFirst("^/api", "");
        if (relative.matches("/projects/[^/]+/.*")) {
            String section = relative.split("/")[3];
            return switch (section) {
                case "finance", "budget", "costs", "forecast" -> "finance";
                case "grants" -> "grants";
                case "charter", "okrs", "risks" -> "charter";
                case "members" -> "team";
                case "tasks" -> "planner";
                case "wbs", "dependencies", "baselines" -> "gantt";
                case "deliverables", "resources" -> "resources";
                case "stakeholders" -> "stakeholders";
                case "changes" -> "change-control";
                case "report", "evidence-packs", "status-reviews" -> "analytics";
                case "dashboard" -> "dashboard";
                case "phases" -> "planner";
                case "export", "import", "archived", "favorite" -> "projects";
                default -> null;
            };
        }
        String head = relative.split("/", -1).length > 1 ? relative.split("/", -1)[1] : "";
        return switch (head) {
            case "projects" -> "projects";
            case "inbox", "notifications", "notification-preferences" -> "inbox";
            case "settings" -> "settings";
            case "notes", "note-links" -> "notes";
            case "connections", "external-contributors", "identities" -> "connections";
            case "teams" -> "team";
            case "calendar", "calendars" -> "calendar";
            case "capacity", "assignments", "effort-estimates" -> "resources";
            case "focus-sessions", "time-entries" -> "time-tracking";
            case "programmes" -> "portfolio";
            case "rate-cards" -> "finance";
            case "templates" -> "templates";
            case "tags", "task-statuses", "task-priorities", "views", "search", "events" -> "planner";
            case "integrations" -> "integrations";
            case "asset-links" -> "resources";
            default -> null;
        };
    }
}
