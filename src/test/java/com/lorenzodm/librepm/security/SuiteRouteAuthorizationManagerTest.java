package com.lorenzodm.librepm.security;

import com.lorenzodm.librepm.core.entity.User;
import com.lorenzodm.librepm.repository.ProjectRepository;
import com.lorenzodm.librepm.repository.ProjectMemberRepository;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.web.access.intercept.RequestAuthorizationContext;
import java.util.Set;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class SuiteRouteAuthorizationManagerTest {
    final ProjectRepository projects = mock(ProjectRepository.class);
    final ProjectMemberRepository members = mock(ProjectMemberRepository.class);
    final SuiteRouteAuthorizationManager manager = new SuiteRouteAuthorizationManager(projects, members);
    boolean allowed(String method, String path, Set<String> permissions, boolean owner) {
        var request = new MockHttpServletRequest(method, path);
        var user = new User(); user.setId("local-user"); user.setUsername("fixture");
        request.setAttribute(SuiteRouteAuthorizationManager.CALLER, user);
        request.setAttribute(SuiteAccessService.ATTRIBUTE, new SuiteAccessService.AccessView(null, "user_fixture", "active", owner, true, owner ? "manager" : "custom", permissions));
        return manager.check(() -> new TestingAuthenticationToken("fixture", "unused", "ROLE_PRESIDENTE"), new RequestAuthorizationContext(request)).isGranted();
    }
    @Test void viewerCanReadOwnProjectsButCannotWriteOrReadAnotherUsersPath() {
        Set<String> read = Set.of("librepm.projects.read");
        assertTrue(allowed("GET", "/api/users/local-user/projects", read, false));
        assertFalse(allowed("POST", "/api/users/local-user/projects", read, false));
        assertFalse(allowed("GET", "/api/users/another-user/projects", read, false));
    }
    @Test void nestedFinanceCannotBypassTheFinanceGrant() {
        when(members.existsByProjectIdAndUserId("project-a", "local-user")).thenReturn(true);
        Set<String> projectsOnly = Set.of("librepm.projects.read");
        assertFalse(allowed("GET", "/api/projects/project-a/finance/budgets", projectsOnly, false));
        assertFalse(allowed("GET", "/api/users/local-user/projects/project-a/finance/budgets", projectsOnly, false));
        assertTrue(allowed("GET", "/api/projects/project-a/finance/budgets", Set.of("librepm.finance.read"), false));
        assertFalse(allowed("PUT", "/api/projects/project-a/finance/budgets/budget-a", Set.of("librepm.finance.read"), false));
    }
    @Test void moduleAccessDoesNotReplaceMembership() {
        assertFalse(allowed("GET", "/api/projects/foreign/finance/budgets", Set.of("librepm.finance.read"), false));
        assertFalse(allowed("GET", "/api/users/local-user/projects/foreign/tasks", Set.of("librepm.planner.read"), false));
    }
    @Test void signedAdminRoleDoesNotMakeTheCallerOwnerForUnknownRoutes() {
        assertFalse(allowed("PUT", "/api/new-administration", Set.of("librepm.settings.read", "librepm.settings.write"), false));
        assertFalse(allowed("GET", "/api/roles", Set.of("librepm.settings.read"), false));
        assertFalse(allowed("GET", "/api/users", Set.of("librepm.team.read"), false));
        assertTrue(allowed("GET", "/api/new-administration", Set.of(), true));
    }
    @Test void globalSearchRequiresBothDataModules() {
        assertFalse(allowed("GET", "/api/search", Set.of("librepm.planner.read"), false));
        assertTrue(allowed("GET", "/api/search", Set.of("librepm.planner.read", "librepm.notes.read"), false));
    }
    @Test void aCustomPlanningViewCanSelectItsOwnProjectWithoutOpeningTheProjectsModule() {
        var kanbanOnly = Set.of("librepm.kanban.read");
        assertTrue(allowed("GET", "/api/me/projects", kanbanOnly, false));
        assertFalse(allowed("GET", "/api/users/local-user/projects", kanbanOnly, false));
        assertFalse(allowed("POST", "/api/me/projects", kanbanOnly, false));
        when(members.existsByProjectIdAndUserId("project-a", "local-user")).thenReturn(true);
        assertTrue(allowed("GET", "/api/users/local-user/projects/project-a/tasks", kanbanOnly, false));
        assertFalse(allowed("POST", "/api/users/local-user/projects/project-a/tasks", kanbanOnly, false));
    }
}
