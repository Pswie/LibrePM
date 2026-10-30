-- Additive registry: operational plans, accounting and candidatures keep their own authority.
CREATE TABLE suite_projects (
    organization_id VARCHAR(36) NOT NULL,
    project_id VARCHAR(36) NOT NULL,
    source_version BIGINT NOT NULL DEFAULT 1,
    fingerprint VARCHAR(64) NOT NULL DEFAULT '',
    seed_budget TEXT,
    project_deadline VARCHAR(10),
    sync_lock_token VARCHAR(36),
    sync_lock_until BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (organization_id,project_id),
    FOREIGN KEY (project_id) REFERENCES projects(id) DEFERRABLE INITIALLY IMMEDIATE
);
CREATE TABLE suite_instances (
    organization_id VARCHAR(36) NOT NULL,
    project_id VARCHAR(36) NOT NULL,
    system_name VARCHAR(16) NOT NULL,
    entity_name VARCHAR(20) NOT NULL,
    local_id VARCHAR(128) NOT NULL,
    source_revision VARCHAR(255),
    PRIMARY KEY (organization_id,system_name,entity_name,local_id),
    UNIQUE (organization_id,project_id,system_name),
    FOREIGN KEY (organization_id,project_id) REFERENCES suite_projects(organization_id,project_id) DEFERRABLE INITIALLY IMMEDIATE
);
CREATE TABLE suite_peer_state (
    organization_id VARCHAR(36) NOT NULL,
    project_id VARCHAR(36) NOT NULL,
    system_name VARCHAR(16) NOT NULL,
    status VARCHAR(16) NOT NULL,
    last_success_at VARCHAR(40),
    error_code VARCHAR(80),
    error_message VARCHAR(500),
    snapshot_json TEXT,
    PRIMARY KEY (organization_id,project_id,system_name),
    FOREIGN KEY (organization_id,project_id) REFERENCES suite_projects(organization_id,project_id) DEFERRABLE INITIALLY IMMEDIATE
);
CREATE TABLE suite_instance_revisions (
    organization_id VARCHAR(36) NOT NULL,
    project_id VARCHAR(36) NOT NULL,
    system_name VARCHAR(16) NOT NULL,
    entity_name VARCHAR(20) NOT NULL,
    local_id VARCHAR(128) NOT NULL,
    source_revision VARCHAR(255) NOT NULL,
    observed_at VARCHAR(40) NOT NULL,
    PRIMARY KEY (organization_id,system_name,entity_name,local_id,source_revision),
    FOREIGN KEY (organization_id,project_id) REFERENCES suite_projects(organization_id,project_id) DEFERRABLE INITIALLY IMMEDIATE
);
CREATE TABLE suite_selections (
    organization_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    project_id VARCHAR(36) NOT NULL,
    PRIMARY KEY (organization_id,user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,
    FOREIGN KEY (organization_id,project_id) REFERENCES suite_projects(organization_id,project_id) DEFERRABLE INITIALLY IMMEDIATE
);
