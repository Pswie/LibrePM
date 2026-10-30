-- PostgreSQL baseline, separate from the immutable MySQL/SQLite histories.
-- Application tables live only in the Flyway default schema `librepm`.
-- IDs, dates and JSON keep their existing string representations.
-- Foreign keys are installed after all tables and are deferrable for controlled imports.

REVOKE ALL ON SCHEMA librepm FROM PUBLIC;

CREATE TABLE "actual_cost_records" (
    "amount" double precision DEFAULT NULL,
    "budget_line_id" varchar(255) NOT NULL,
    "cost_date" varchar(255) NOT NULL,
    "created_at" varchar(255) DEFAULT NULL,
    "currency" varchar(255) DEFAULT NULL,
    "description" varchar(255) NOT NULL,
    "evidence_asset_id" varchar(255) DEFAULT NULL,
    "id" varchar(255) NOT NULL,
    "recorded_by" varchar(255) DEFAULT NULL,
    PRIMARY KEY ("id")
);

CREATE TABLE "app_preferences" (
    "key" varchar(100) NOT NULL,
    "value" varchar(500) NOT NULL,
    "updated_at" varchar(255) NOT NULL,
    PRIMARY KEY ("key")
);

CREATE TABLE "approval_requests" (
    "approver_id" varchar(36) NOT NULL,
    "entity_id" varchar(36) NOT NULL,
    "id" varchar(36) NOT NULL,
    "project_id" varchar(36) DEFAULT NULL,
    "requested_by" varchar(36) NOT NULL,
    "entity_type" varchar(64) NOT NULL,
    "comment" text,
    "created_at" varchar(255) NOT NULL,
    "deleted_at" varchar(255) DEFAULT NULL,
    "last_synced_at" varchar(255) DEFAULT NULL,
    "requested_at" varchar(255) DEFAULT NULL,
    "resolved_at" varchar(255) DEFAULT NULL,
    "updated_at" varchar(255) NOT NULL,
    "status" varchar(20) NOT NULL CHECK ("status" IN ('APPROVED','PENDING','REJECTED','WITHDRAWN')),
    "sync_status" varchar(20) DEFAULT NULL CHECK ("sync_status" IN ('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED')),
    PRIMARY KEY ("id")
);

CREATE TABLE "asset_links" (
    "asset_id" varchar(36) NOT NULL,
    "id" varchar(36) NOT NULL,
    "linked_entity_id" varchar(36) NOT NULL,
    "linked_entity_type" varchar(64) NOT NULL,
    "created_at" varchar(255) DEFAULT NULL,
    PRIMARY KEY ("id")
);

CREATE TABLE "asset_versions" (
    "version_number" int NOT NULL,
    "file_size" bigint DEFAULT NULL,
    "asset_id" varchar(36) NOT NULL,
    "id" varchar(36) NOT NULL,
    "uploaded_by" varchar(36) DEFAULT NULL,
    "checksum" varchar(128) DEFAULT NULL,
    "file_path" varchar(512) NOT NULL,
    "comment" text,
    "uploaded_at" varchar(255) DEFAULT NULL,
    PRIMARY KEY ("id")
);

CREATE TABLE "assets" (
    "size_bytes" bigint NOT NULL,
    "id" varchar(36) NOT NULL,
    "owner_id" varchar(36) NOT NULL,
    "task_id" varchar(36) DEFAULT NULL,
    "checksum" varchar(64) DEFAULT NULL,
    "mime_type" varchar(100) DEFAULT NULL,
    "cloud_url" varchar(500) DEFAULT NULL,
    "description" varchar(500) DEFAULT NULL,
    "file_name" varchar(500) NOT NULL,
    "file_path" varchar(768) NOT NULL,
    "thumbnail_path" varchar(1000) DEFAULT NULL,
    "created_at" varchar(255) NOT NULL,
    "deleted_at" varchar(255) DEFAULT NULL,
    "last_accessed_at" varchar(255) DEFAULT NULL,
    "last_synced_at" varchar(255) DEFAULT NULL,
    "updated_at" varchar(255) NOT NULL,
    "sync_status" varchar(20) DEFAULT NULL CHECK ("sync_status" IN ('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED')),
    PRIMARY KEY ("id"),
    CONSTRAINT "assets__UKihvp53lkel78qrol6ci3dup78" UNIQUE ("file_path")
);

CREATE TABLE "assignments" (
    "estimated_effort" int DEFAULT NULL,
    "id" varchar(36) NOT NULL,
    "role_id" varchar(36) DEFAULT NULL,
    "task_id" varchar(36) NOT NULL,
    "user_id" varchar(36) NOT NULL,
    "assigned_at" varchar(255) NOT NULL,
    "created_at" varchar(255) NOT NULL,
    "deleted_at" varchar(255) DEFAULT NULL,
    "last_synced_at" varchar(255) DEFAULT NULL,
    "updated_at" varchar(255) NOT NULL,
    "sync_status" varchar(20) DEFAULT NULL CHECK ("sync_status" IN ('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED')),
    PRIMARY KEY ("id")
);

CREATE TABLE "audit_events" (
    "entity_id" varchar(36) NOT NULL,
    "id" varchar(36) NOT NULL,
    "user_id" varchar(36) DEFAULT NULL,
    "entity_type" varchar(100) NOT NULL,
    "created_at" varchar(255) NOT NULL,
    "deleted_at" varchar(255) DEFAULT NULL,
    "details" text,
    "event_timestamp" varchar(255) NOT NULL,
    "last_synced_at" varchar(255) DEFAULT NULL,
    "updated_at" varchar(255) NOT NULL,
    "action" varchar(20) NOT NULL CHECK ("action" IN ('APPROVAL_GRANTED','APPROVAL_REJECTED','APPROVAL_REQUESTED','ARCHIVED','BASELINE_CREATED','CONFLICT_DETECTED','CONFLICT_RESOLVED','CREATED','DELETED','EXPORTED','IMPORTED','LOGIN','MERGED','PASSWORD_MIGRATED','PLAN_RECALCULATED','RESTORED','STATUS_CHANGED','SYNCED','UPDATED')),
    "sync_status" varchar(20) DEFAULT NULL CHECK ("sync_status" IN ('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED')),
    PRIMARY KEY ("id")
);

CREATE TABLE "baseline_task_snapshots" (
    "estimated_effort" int DEFAULT NULL,
    "baseline_id" varchar(36) NOT NULL,
    "id" varchar(36) NOT NULL,
    "task_id" varchar(36) NOT NULL,
    "created_at" varchar(255) NOT NULL,
    "deleted_at" varchar(255) DEFAULT NULL,
    "last_synced_at" varchar(255) DEFAULT NULL,
    "planned_finish" varchar(255) DEFAULT NULL,
    "planned_start" varchar(255) DEFAULT NULL,
    "updated_at" varchar(255) NOT NULL,
    "sync_status" varchar(20) DEFAULT NULL CHECK ("sync_status" IN ('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED')),
    PRIMARY KEY ("id")
);

CREATE TABLE "baselines" (
    "is_frozen" boolean DEFAULT NULL,
    "id" varchar(36) NOT NULL,
    "project_id" varchar(36) NOT NULL,
    "budget_snapshot" text,
    "created_at" varchar(255) NOT NULL,
    "deleted_at" varchar(255) DEFAULT NULL,
    "deliverable_snapshot" text,
    "last_synced_at" varchar(255) DEFAULT NULL,
    "name" varchar(255) NOT NULL,
    "snapshot_date" varchar(255) NOT NULL,
    "updated_at" varchar(255) NOT NULL,
    "sync_status" varchar(20) DEFAULT NULL CHECK ("sync_status" IN ('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED')),
    PRIMARY KEY ("id")
);

CREATE TABLE "branch_modifications" (
    "branch_id" varchar(255) DEFAULT NULL,
    "entity_id" varchar(255) DEFAULT NULL,
    "entity_type" varchar(255) DEFAULT NULL,
    "id" varchar(255) NOT NULL,
    "modification_type" varchar(255) DEFAULT NULL,
    "modified_at" varchar(255) DEFAULT NULL,
    "new_value_json" text,
    "old_value_json" text,
    PRIMARY KEY ("id")
);

CREATE TABLE "budget_lines" (
    "actual_amount" double precision DEFAULT NULL,
    "committed_amount" double precision DEFAULT NULL,
    "forecast_amount" double precision DEFAULT NULL,
    "planned_amount" double precision DEFAULT NULL,
    "reserved_amount" double precision DEFAULT NULL,
    "sort_order" int DEFAULT NULL,
    "budget_id" varchar(255) NOT NULL,
    "category" varchar(255) NOT NULL,
    "currency" varchar(255) DEFAULT NULL,
    "deliverable_id" varchar(255) DEFAULT NULL,
    "description" varchar(255) DEFAULT NULL,
    "id" varchar(255) NOT NULL,
    "name" varchar(255) NOT NULL,
    "phase_id" varchar(255) DEFAULT NULL,
    PRIMARY KEY ("id")
);

CREATE TABLE "calendar_exceptions" (
    "is_working_day" boolean NOT NULL,
    "calendar_id" varchar(36) NOT NULL,
    "id" varchar(36) NOT NULL,
    "created_at" varchar(255) NOT NULL,
    "deleted_at" varchar(255) DEFAULT NULL,
    "description" varchar(255) DEFAULT NULL,
    "exception_date" varchar(255) NOT NULL,
    "last_synced_at" varchar(255) DEFAULT NULL,
    "updated_at" varchar(255) NOT NULL,
    "sync_status" varchar(20) DEFAULT NULL CHECK ("sync_status" IN ('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED')),
    PRIMARY KEY ("id")
);

CREATE TABLE "calendar_feed_tokens" (
    "id" varchar(36) NOT NULL,
    "user_id" varchar(36) NOT NULL,
    "token" varchar(64) NOT NULL,
    "description" varchar(100) DEFAULT NULL,
    "included_entity_types" varchar(200) DEFAULT NULL,
    "created_at" varchar(255) NOT NULL,
    "deleted_at" varchar(255) DEFAULT NULL,
    "last_accessed_at" varchar(255) DEFAULT NULL,
    "last_synced_at" varchar(255) DEFAULT NULL,
    "updated_at" varchar(255) NOT NULL,
    "sync_status" varchar(20) DEFAULT NULL CHECK ("sync_status" IN ('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED')),
    PRIMARY KEY ("id"),
    CONSTRAINT "calendar_feed_tokens__UKl5enblvvkpeacjhd2x9owxxcp" UNIQUE ("user_id"),
    CONSTRAINT "calendar_feed_tokens__UKojp9ltu0j5qmubltv1nxfmq57" UNIQUE ("token")
);

CREATE TABLE "call_requirements" (
    "is_met" boolean DEFAULT NULL,
    "sort_order" int DEFAULT NULL,
    "call_id" varchar(255) DEFAULT NULL,
    "description" varchar(255) DEFAULT NULL,
    "evidence_note" varchar(255) DEFAULT NULL,
    "id" varchar(255) NOT NULL,
    "requirement_type" varchar(255) DEFAULT NULL,
    PRIMARY KEY ("id")
);

CREATE TABLE "capacity_profiles" (
    "hours_per_day" double precision DEFAULT NULL,
    "calendar_id" varchar(36) DEFAULT NULL,
    "id" varchar(36) NOT NULL,
    "user_id" varchar(36) NOT NULL,
    "effective_from" varchar(255) NOT NULL,
    "effective_to" varchar(255) DEFAULT NULL,
    PRIMARY KEY ("id")
);

CREATE TABLE "change_requests" (
    "approved_by" varchar(255) DEFAULT NULL,
    "description" varchar(255) DEFAULT NULL,
    "expected_impact" varchar(255) DEFAULT NULL,
    "id" varchar(255) NOT NULL,
    "motivation" varchar(255) DEFAULT NULL,
    "priority" varchar(255) DEFAULT NULL,
    "project_id" varchar(255) DEFAULT NULL,
    "requested_at" varchar(255) DEFAULT NULL,
    "requested_by" varchar(255) DEFAULT NULL,
    "resolved_at" varchar(255) DEFAULT NULL,
    "scope" varchar(255) DEFAULT NULL,
    "status" varchar(255) DEFAULT NULL,
    "title" varchar(255) DEFAULT NULL,
    PRIMARY KEY ("id")
);

CREATE TABLE "compliance_profiles" (
    "is_system" boolean DEFAULT NULL,
    "description" text,
    "id" varchar(255) NOT NULL,
    "name" varchar(255) NOT NULL,
    "settings_json" text,
    PRIMARY KEY ("id")
);

CREATE TABLE "conflict_records" (
    "resolved" boolean NOT NULL,
    "resolution" varchar(20) DEFAULT NULL,
    "policy_used" varchar(30) DEFAULT NULL,
    "entity_id" varchar(36) NOT NULL,
    "id" varchar(36) NOT NULL,
    "resolved_by" varchar(36) DEFAULT NULL,
    "entity_type" varchar(100) NOT NULL,
    "field_name" varchar(200) DEFAULT NULL,
    "created_at" varchar(255) NOT NULL,
    "deleted_at" varchar(255) DEFAULT NULL,
    "detected_at" varchar(255) NOT NULL,
    "last_synced_at" varchar(255) DEFAULT NULL,
    "local_state" text,
    "remote_state" text,
    "resolved_at" varchar(255) DEFAULT NULL,
    "updated_at" varchar(255) NOT NULL,
    "sync_status" varchar(20) DEFAULT NULL CHECK ("sync_status" IN ('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED')),
    PRIMARY KEY ("id")
);

CREATE TABLE "currency_rates" (
    "rate" double precision DEFAULT NULL,
    "created_at" varchar(255) DEFAULT NULL,
    "effective_date" varchar(255) NOT NULL,
    "from_currency" varchar(255) NOT NULL,
    "id" varchar(255) NOT NULL,
    "source" varchar(255) DEFAULT NULL,
    "to_currency" varchar(255) NOT NULL,
    PRIMARY KEY ("id")
);

CREATE TABLE "data_categories" (
    "default_retention_days" int DEFAULT NULL,
    "description" text,
    "id" varchar(255) NOT NULL,
    "name" varchar(255) NOT NULL,
    "processing_purposes" text,
    "sensitivity_level" varchar(255) DEFAULT NULL,
    PRIMARY KEY ("id")
);

CREATE TABLE "decision_log" (
    "branch_id" varchar(255) DEFAULT NULL,
    "change_request_id" varchar(255) DEFAULT NULL,
    "decided_at" varchar(255) DEFAULT NULL,
    "decided_by" varchar(255) DEFAULT NULL,
    "decision" text,
    "id" varchar(255) NOT NULL,
    "impact_summary" text,
    "project_id" varchar(255) DEFAULT NULL,
    "rationale" text,
    "title" varchar(255) DEFAULT NULL,
    PRIMARY KEY ("id")
);

CREATE TABLE "deliverables" (
    "progress" int NOT NULL,
    "id" varchar(36) NOT NULL,
    "project_id" varchar(36) NOT NULL,
    "description" varchar(1000) DEFAULT NULL,
    "completed_at" varchar(255) DEFAULT NULL,
    "created_at" varchar(255) NOT NULL,
    "deleted_at" varchar(255) DEFAULT NULL,
    "due_date" varchar(255) DEFAULT NULL,
    "last_synced_at" varchar(255) DEFAULT NULL,
    "name" varchar(255) NOT NULL,
    "updated_at" varchar(255) NOT NULL,
    "risk_status" varchar(20) DEFAULT NULL CHECK ("risk_status" IN ('AT_RISK','BLOCKED','OK')),
    "sync_status" varchar(20) DEFAULT NULL CHECK ("sync_status" IN ('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED')),
    PRIMARY KEY ("id")
);

CREATE TABLE "dependencies" (
    "lag" int DEFAULT NULL,
    "lead" int DEFAULT NULL,
    "id" varchar(36) NOT NULL,
    "predecessor_id" varchar(36) NOT NULL,
    "successor_id" varchar(36) NOT NULL,
    "created_at" varchar(255) NOT NULL,
    "deleted_at" varchar(255) DEFAULT NULL,
    "last_synced_at" varchar(255) DEFAULT NULL,
    "updated_at" varchar(255) NOT NULL,
    "sync_status" varchar(20) DEFAULT NULL CHECK ("sync_status" IN ('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED')),
    "type" varchar(20) NOT NULL CHECK ("type" IN ('FINISH_TO_FINISH','FINISH_TO_START','START_TO_FINISH','START_TO_START')),
    PRIMARY KEY ("id")
);

CREATE TABLE "donations" (
    "amount" double precision DEFAULT NULL,
    "is_restricted" boolean DEFAULT NULL,
    "created_at" varchar(255) DEFAULT NULL,
    "currency" varchar(255) DEFAULT NULL,
    "donation_date" varchar(255) DEFAULT NULL,
    "donor_id" varchar(255) DEFAULT NULL,
    "id" varchar(255) NOT NULL,
    "notes" varchar(255) DEFAULT NULL,
    "project_id" varchar(255) DEFAULT NULL,
    "receipt_asset_id" varchar(255) DEFAULT NULL,
    "restriction_description" varchar(255) DEFAULT NULL,
    PRIMARY KEY ("id")
);

CREATE TABLE "donors" (
    "created_at" varchar(255) DEFAULT NULL,
    "email" varchar(255) DEFAULT NULL,
    "id" varchar(255) NOT NULL,
    "name" varchar(255) NOT NULL,
    "notes" varchar(255) DEFAULT NULL,
    "organization" varchar(255) DEFAULT NULL,
    "phone" varchar(255) DEFAULT NULL,
    "type" varchar(255) DEFAULT NULL,
    PRIMARY KEY ("id")
);

CREATE TABLE "dsr_requests" (
    "completed_at" varchar(255) DEFAULT NULL,
    "description" text,
    "id" varchar(255) NOT NULL,
    "request_type" varchar(255) DEFAULT NULL,
    "requested_at" varchar(255) DEFAULT NULL,
    "result_notes" text,
    "status" varchar(255) DEFAULT NULL,
    "user_id" varchar(255) DEFAULT NULL,
    PRIMARY KEY ("id")
);

CREATE TABLE "effort_estimates" (
    "estimated_minutes" int NOT NULL,
    "revision_number" int DEFAULT NULL,
    "estimator_id" varchar(36) DEFAULT NULL,
    "id" varchar(36) NOT NULL,
    "previous_estimate_id" varchar(36) DEFAULT NULL,
    "task_id" varchar(36) NOT NULL,
    "rationale" varchar(500) DEFAULT NULL,
    "created_at" varchar(255) NOT NULL,
    "deleted_at" varchar(255) DEFAULT NULL,
    "estimation_date" varchar(255) NOT NULL,
    "last_synced_at" varchar(255) DEFAULT NULL,
    "updated_at" varchar(255) NOT NULL,
    "sync_status" varchar(20) DEFAULT NULL CHECK ("sync_status" IN ('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED')),
    PRIMARY KEY ("id")
);

CREATE TABLE "event_journal" (
    "id" bigint NOT NULL GENERATED BY DEFAULT AS IDENTITY,
    "entity_id" varchar(36) DEFAULT NULL,
    "user_id" varchar(36) DEFAULT NULL,
    "entity_type" varchar(64) DEFAULT NULL,
    "event_type" varchar(64) NOT NULL,
    "payload" text,
    "timestamp" varchar(255) NOT NULL,
    PRIMARY KEY ("id")
);

CREATE TABLE "evidence_pack_items" (
    "item_order" int DEFAULT NULL,
    "asset_id" varchar(36) DEFAULT NULL,
    "id" varchar(36) NOT NULL,
    "note_id" varchar(36) DEFAULT NULL,
    "pack_id" varchar(36) NOT NULL,
    PRIMARY KEY ("id")
);

CREATE TABLE "evidence_packs" (
    "created_by" varchar(36) DEFAULT NULL,
    "id" varchar(36) NOT NULL,
    "project_id" varchar(36) DEFAULT NULL,
    "created_at" varchar(255) DEFAULT NULL,
    "deleted_at" varchar(255) DEFAULT NULL,
    "description" text,
    "finalized_at" varchar(255) DEFAULT NULL,
    "name" varchar(255) NOT NULL,
    "pack_type" varchar(20) DEFAULT NULL CHECK ("pack_type" IN ('AUDIT','REPORT','SPONSOR_REVIEW','SUBMISSION')),
    "status" varchar(20) DEFAULT NULL CHECK ("status" IN ('DRAFT','EXPORTED','FINALIZED')),
    PRIMARY KEY ("id")
);

CREATE TABLE "external_contributors" (
    "created_by" varchar(36) DEFAULT NULL,
    "id" varchar(36) NOT NULL,
    "role_id" varchar(36) DEFAULT NULL,
    "scope_entity_id" varchar(36) DEFAULT NULL,
    "access_token_hash" varchar(128) DEFAULT NULL,
    "display_name" varchar(128) NOT NULL,
    "access_expires_at" varchar(255) DEFAULT NULL,
    "created_at" varchar(255) NOT NULL,
    "deleted_at" varchar(255) DEFAULT NULL,
    "email" varchar(255) DEFAULT NULL,
    "last_synced_at" varchar(255) DEFAULT NULL,
    "organization" varchar(255) DEFAULT NULL,
    "updated_at" varchar(255) NOT NULL,
    "scope" varchar(20) NOT NULL CHECK ("scope" IN ('DELIVERABLE','PROJECT','REVIEW')),
    "sync_status" varchar(20) DEFAULT NULL CHECK ("sync_status" IN ('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED')),
    PRIMARY KEY ("id")
);

CREATE TABLE "financial_baselines" (
    "budget_id" varchar(255) NOT NULL,
    "created_at" varchar(255) DEFAULT NULL,
    "created_by" varchar(255) DEFAULT NULL,
    "id" varchar(255) NOT NULL,
    "name" varchar(255) NOT NULL,
    "snapshot_json" text NOT NULL,
    PRIMARY KEY ("id")
);

CREATE TABLE "focus_sessions" (
    "duration_ms" bigint NOT NULL,
    "sync_status" varchar(20) DEFAULT NULL,
    "id" varchar(36) NOT NULL,
    "task_id" varchar(36) NOT NULL,
    "user_id" varchar(36) NOT NULL,
    "session_type" varchar(50) DEFAULT NULL,
    "notes" varchar(1000) DEFAULT NULL,
    "created_at" varchar(255) NOT NULL,
    "ended_at" varchar(255) DEFAULT NULL,
    "last_synced_at" varchar(255) DEFAULT NULL,
    "started_at" varchar(255) NOT NULL,
    PRIMARY KEY ("id")
);

CREATE TABLE "fund_allocations" (
    "allocated_amount" double precision DEFAULT NULL,
    "allocation_date" varchar(255) DEFAULT NULL,
    "budget_line_id" varchar(255) NOT NULL,
    "funding_source_id" varchar(255) NOT NULL,
    "id" varchar(255) NOT NULL,
    "notes" varchar(255) DEFAULT NULL,
    PRIMARY KEY ("id")
);

CREATE TABLE "funding_sources" (
    "is_restricted" boolean DEFAULT NULL,
    "total_amount" double precision DEFAULT NULL,
    "contact_email" varchar(255) DEFAULT NULL,
    "contact_name" varchar(255) DEFAULT NULL,
    "created_at" varchar(255) DEFAULT NULL,
    "currency" varchar(255) DEFAULT NULL,
    "id" varchar(255) NOT NULL,
    "name" varchar(255) NOT NULL,
    "project_id" varchar(255) NOT NULL,
    "restriction_description" varchar(255) DEFAULT NULL,
    "status" varchar(255) DEFAULT NULL,
    "type" varchar(255) NOT NULL,
    PRIMARY KEY ("id")
);

CREATE TABLE "grant_calls" (
    "budget_available" double precision DEFAULT NULL,
    "created_at" varchar(255) DEFAULT NULL,
    "currency" varchar(255) DEFAULT NULL,
    "deadline" varchar(255) DEFAULT NULL,
    "description" varchar(255) DEFAULT NULL,
    "id" varchar(255) NOT NULL,
    "issuer" varchar(255) DEFAULT NULL,
    "notes" varchar(255) DEFAULT NULL,
    "project_id" varchar(255) DEFAULT NULL,
    "reference_code" varchar(255) DEFAULT NULL,
    "status" varchar(255) DEFAULT NULL,
    "title" varchar(255) NOT NULL,
    "updated_at" varchar(255) DEFAULT NULL,
    "url" varchar(255) DEFAULT NULL,
    PRIMARY KEY ("id")
);

CREATE TABLE "import_export_jobs" (
    "record_count" int DEFAULT NULL,
    "id" varchar(36) NOT NULL,
    "project_id" varchar(36) DEFAULT NULL,
    "user_id" varchar(36) NOT NULL,
    "completed_at" varchar(255) DEFAULT NULL,
    "created_at" varchar(255) NOT NULL,
    "deleted_at" varchar(255) DEFAULT NULL,
    "error_message" text,
    "last_synced_at" varchar(255) DEFAULT NULL,
    "result_payload" text,
    "updated_at" varchar(255) NOT NULL,
    "job_type" varchar(20) NOT NULL CHECK ("job_type" IN ('EXPORT_CHARTER_JSON','EXPORT_CSV','EXPORT_ICS_SNAPSHOT','EXPORT_JSON','IMPORT_CSV_TASKS')),
    "status" varchar(20) NOT NULL CHECK ("status" IN ('COMPLETED','FAILED','PENDING','PROCESSING')),
    "sync_status" varchar(20) DEFAULT NULL CHECK ("sync_status" IN ('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED')),
    PRIMARY KEY ("id")
);

CREATE TABLE "import_mapping_profiles" (
    "created_by" varchar(36) DEFAULT NULL,
    "id" varchar(36) NOT NULL,
    "entity_type" varchar(64) NOT NULL,
    "name" varchar(128) NOT NULL,
    "created_at" varchar(255) DEFAULT NULL,
    "mapping_json" text NOT NULL,
    PRIMARY KEY ("id")
);

CREATE TABLE "leave_records" (
    "hours" double precision DEFAULT NULL,
    "id" varchar(36) NOT NULL,
    "user_id" varchar(36) NOT NULL,
    "description" text,
    "leave_date" varchar(255) NOT NULL,
    "leave_type" varchar(20) DEFAULT NULL CHECK ("leave_type" IN ('PERSONAL','SICK','TRAINING','VACATION')),
    PRIMARY KEY ("id"),
    CONSTRAINT "leave_records__UKkyqrkmtamyct8n6jfdjlm0jr1" UNIQUE ("user_id","leave_date")
);

CREATE TABLE "merge_policies" (
    "auto_resolvable" boolean NOT NULL,
    "id" varchar(36) NOT NULL,
    "entity_type" varchar(100) NOT NULL,
    "field_scope" varchar(500) DEFAULT NULL,
    "created_at" varchar(255) NOT NULL,
    "deleted_at" varchar(255) DEFAULT NULL,
    "description" text,
    "last_synced_at" varchar(255) DEFAULT NULL,
    "updated_at" varchar(255) NOT NULL,
    "policy" varchar(20) NOT NULL CHECK ("policy" IN ('APPEND_ONLY','GRAPH_MERGE','IMMUTABLE_SNAPSHOT','LAST_WRITE_WINS','LIST_MERGE','MANUAL','UNION')),
    "sync_status" varchar(20) DEFAULT NULL CHECK ("sync_status" IN ('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED')),
    PRIMARY KEY ("id"),
    CONSTRAINT "merge_policies__UK36drgshc11xaouv1kyh0mucb7" UNIQUE ("entity_type")
);

CREATE TABLE "note_links" (
    "id" varchar(36) NOT NULL,
    "linked_entity_id" varchar(36) NOT NULL,
    "note_id" varchar(36) NOT NULL,
    "created_at" varchar(255) NOT NULL,
    "deleted_at" varchar(255) DEFAULT NULL,
    "last_synced_at" varchar(255) DEFAULT NULL,
    "updated_at" varchar(255) NOT NULL,
    "linked_entity_type" varchar(20) NOT NULL CHECK ("linked_entity_type" IN ('DELIVERABLE','OKR','PROJECT','RISK','TASK','TEAM','USER')),
    "sync_status" varchar(20) DEFAULT NULL CHECK ("sync_status" IN ('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED')),
    PRIMARY KEY ("id")
);

CREATE TABLE "note_revisions" (
    "revision_number" int NOT NULL,
    "author_id" varchar(36) DEFAULT NULL,
    "id" varchar(36) NOT NULL,
    "note_id" varchar(36) NOT NULL,
    "content" text,
    "created_at" varchar(255) DEFAULT NULL,
    "title" varchar(255) DEFAULT NULL,
    PRIMARY KEY ("id")
);

CREATE TABLE "note_tags" (
    "note_id" varchar(36) NOT NULL,
    "tag_id" varchar(36) NOT NULL,
    PRIMARY KEY ("note_id","tag_id")
);

CREATE TABLE "notes" (
    "is_evidence" boolean DEFAULT NULL,
    "is_frozen" boolean DEFAULT NULL,
    "version" bigint DEFAULT NULL,
    "id" varchar(36) NOT NULL,
    "owner_id" varchar(36) NOT NULL,
    "parent_id" varchar(36) DEFAULT NULL,
    "project_id" varchar(36) DEFAULT NULL,
    "title" varchar(200) DEFAULT NULL,
    "content" text,
    "created_at" varchar(255) NOT NULL,
    "deleted_at" varchar(255) DEFAULT NULL,
    "frozen_at" varchar(255) DEFAULT NULL,
    "last_synced_at" varchar(255) DEFAULT NULL,
    "restricted_roles" text,
    "updated_at" varchar(255) NOT NULL,
    "note_type" varchar(20) DEFAULT NULL CHECK ("note_type" IN ('AUDIT_NOTE','BRIEF','DECISION','GRANT_NOTE','MEETING_NOTE','MEMO','RATIONALE','RISK_NOTE','SPONSOR_NOTE')),
    "parent_type" varchar(20) DEFAULT NULL CHECK ("parent_type" IN ('PROJECT','TASK')),
    "sync_status" varchar(20) DEFAULT NULL CHECK ("sync_status" IN ('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED')),
    "visibility" varchar(20) DEFAULT NULL CHECK ("visibility" IN ('ALL','PROJECT_MEMBERS','ROLE_RESTRICTED')),
    PRIMARY KEY ("id")
);

CREATE TABLE "notification_preferences" (
    "enabled" boolean NOT NULL,
    "user_id" varchar(36) NOT NULL,
    "event_type" varchar(64) NOT NULL,
    "created_at" varchar(255) NOT NULL,
    "id" varchar(255) NOT NULL,
    "updated_at" varchar(255) NOT NULL,
    "channel" varchar(20) NOT NULL CHECK ("channel" IN ('DESKTOP','IN_APP')),
    "severity_threshold" varchar(20) DEFAULT NULL CHECK ("severity_threshold" IN ('CRITICAL','INFO','WARNING')),
    PRIMARY KEY ("id"),
    CONSTRAINT "notification_preferences__UK3pop5qo1k8bvbsxxrhwvcopy5" UNIQUE ("user_id","event_type","channel")
);

CREATE TABLE "notifications" (
    "is_read" boolean NOT NULL,
    "recipient_id" varchar(36) NOT NULL,
    "sender_id" varchar(36) DEFAULT NULL,
    "created_at" varchar(255) NOT NULL,
    "id" varchar(255) NOT NULL,
    "message" varchar(255) NOT NULL,
    "reference_id" varchar(255) DEFAULT NULL,
    "reference_type" varchar(255) DEFAULT NULL,
    "type" varchar(20) NOT NULL CHECK ("type" IN ('APPROVAL_REQUESTED','APPROVAL_RESOLVED','BUDGET_THRESHOLD','CONNECTION_ACCEPTED','CONNECTION_REQUEST','DEADLINE_APPROACHING','MENTION','NEW_NOTE','REVIEW_REQUESTED','TASK_ASSIGNED','TASK_STATUS_CHANGED')),
    PRIMARY KEY ("id")
);

CREATE TABLE "obligation_records" (
    "created_at" varchar(255) DEFAULT NULL,
    "deadline" varchar(255) DEFAULT NULL,
    "description" varchar(255) DEFAULT NULL,
    "id" varchar(255) NOT NULL,
    "linked_budget_line_id" varchar(255) DEFAULT NULL,
    "linked_deliverable_id" varchar(255) DEFAULT NULL,
    "notes" varchar(255) DEFAULT NULL,
    "project_id" varchar(255) DEFAULT NULL,
    "responsible_user_id" varchar(255) DEFAULT NULL,
    "status" varchar(255) DEFAULT NULL,
    "title" varchar(255) NOT NULL,
    "type" varchar(255) DEFAULT NULL,
    PRIMARY KEY ("id")
);

CREATE TABLE "okrs" (
    "id" varchar(36) NOT NULL,
    "project_id" varchar(36) NOT NULL,
    "created_at" varchar(255) NOT NULL,
    "deleted_at" varchar(255) DEFAULT NULL,
    "last_synced_at" varchar(255) DEFAULT NULL,
    "objective" varchar(255) NOT NULL,
    "updated_at" varchar(255) NOT NULL,
    "sync_status" varchar(20) DEFAULT NULL CHECK ("sync_status" IN ('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED')),
    PRIMARY KEY ("id")
);

CREATE TABLE "partner_organisations" (
    "budget_share" double precision DEFAULT NULL,
    "contact_email" varchar(255) DEFAULT NULL,
    "contact_person" varchar(255) DEFAULT NULL,
    "country" varchar(255) DEFAULT NULL,
    "created_at" varchar(255) DEFAULT NULL,
    "id" varchar(255) NOT NULL,
    "name" varchar(255) NOT NULL,
    "notes" varchar(255) DEFAULT NULL,
    "project_id" varchar(255) DEFAULT NULL,
    "role_in_project" varchar(255) DEFAULT NULL,
    PRIMARY KEY ("id")
);

CREATE TABLE "permission_policies" (
    "id" varchar(36) NOT NULL,
    "role_id" varchar(36) NOT NULL,
    "permission" varchar(100) NOT NULL,
    "created_at" varchar(255) NOT NULL,
    "deleted_at" varchar(255) DEFAULT NULL,
    "last_synced_at" varchar(255) DEFAULT NULL,
    "updated_at" varchar(255) NOT NULL,
    "sync_status" varchar(20) DEFAULT NULL CHECK ("sync_status" IN ('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED')),
    PRIMARY KEY ("id"),
    CONSTRAINT "permission_policies__UKqupqxs7f9xwgc0qwcbhyy51tl" UNIQUE ("role_id","permission")
);

CREATE TABLE "phases" (
    "sort_order" int DEFAULT NULL,
    "color" varchar(7) DEFAULT NULL,
    "id" varchar(36) NOT NULL,
    "project_id" varchar(36) NOT NULL,
    "actual_end" varchar(255) DEFAULT NULL,
    "actual_start" varchar(255) DEFAULT NULL,
    "created_at" varchar(255) DEFAULT NULL,
    "deleted_at" varchar(255) DEFAULT NULL,
    "description" text,
    "name" varchar(255) NOT NULL,
    "planned_end" varchar(255) DEFAULT NULL,
    "planned_start" varchar(255) DEFAULT NULL,
    "status" varchar(20) DEFAULT NULL CHECK ("status" IN ('COMPLETED','IN_PROGRESS','NOT_STARTED','ON_HOLD')),
    PRIMARY KEY ("id")
);

CREATE TABLE "programme_memberships" (
    "sort_order" int DEFAULT NULL,
    "id" varchar(255) NOT NULL,
    "programme_id" varchar(255) DEFAULT NULL,
    "project_id" varchar(255) DEFAULT NULL,
    PRIMARY KEY ("id")
);

CREATE TABLE "programme_milestones" (
    "id" varchar(255) NOT NULL,
    "linked_project_id" varchar(255) DEFAULT NULL,
    "name" varchar(255) NOT NULL,
    "programme_id" varchar(255) DEFAULT NULL,
    "status" varchar(255) DEFAULT NULL,
    "target_date" varchar(255) DEFAULT NULL,
    "description" text,
    PRIMARY KEY ("id")
);

CREATE TABLE "programmes" (
    "created_at" varchar(255) DEFAULT NULL,
    "id" varchar(255) NOT NULL,
    "name" varchar(255) NOT NULL,
    "owner_id" varchar(255) DEFAULT NULL,
    "status" varchar(255) DEFAULT NULL,
    "description" text,
    PRIMARY KEY ("id")
);

CREATE TABLE "project_branches" (
    "branch_type" varchar(255) DEFAULT NULL,
    "change_request_id" varchar(255) DEFAULT NULL,
    "created_at" varchar(255) DEFAULT NULL,
    "created_by" varchar(255) DEFAULT NULL,
    "description" varchar(255) DEFAULT NULL,
    "id" varchar(255) NOT NULL,
    "merged_at" varchar(255) DEFAULT NULL,
    "name" varchar(255) DEFAULT NULL,
    "snapshot_json" text,
    "source_project_id" varchar(255) DEFAULT NULL,
    "status" varchar(255) DEFAULT NULL,
    PRIMARY KEY ("id")
);

CREATE TABLE "project_budgets" (
    "total_amount" double precision DEFAULT NULL,
    "version" int DEFAULT NULL,
    "approved_at" varchar(255) DEFAULT NULL,
    "approved_by" varchar(255) DEFAULT NULL,
    "created_at" varchar(255) DEFAULT NULL,
    "currency" varchar(255) DEFAULT NULL,
    "id" varchar(255) NOT NULL,
    "name" varchar(255) NOT NULL,
    "previous_version_id" varchar(255) DEFAULT NULL,
    "project_id" varchar(255) DEFAULT NULL,
    "status" varchar(255) DEFAULT NULL,
    "updated_at" varchar(255) DEFAULT NULL,
    PRIMARY KEY ("id")
);

CREATE TABLE "project_charters" (
    "id" varchar(36) NOT NULL,
    "project_id" varchar(36) NOT NULL,
    "business_case" text,
    "created_at" varchar(255) NOT NULL,
    "deleted_at" varchar(255) DEFAULT NULL,
    "last_synced_at" varchar(255) DEFAULT NULL,
    "objectives" text,
    "problem_statement" text,
    "project_manager" varchar(255) DEFAULT NULL,
    "sponsor" varchar(255) DEFAULT NULL,
    "updated_at" varchar(255) NOT NULL,
    "sync_status" varchar(20) DEFAULT NULL CHECK ("sync_status" IN ('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED')),
    PRIMARY KEY ("id"),
    CONSTRAINT "project_charters__UKbfi85f0k6lp141bubmp9was9s" UNIQUE ("project_id")
);

CREATE TABLE "project_members" (
    "system_role_id" varchar(36) DEFAULT NULL,
    "created_at" varchar(255) NOT NULL,
    "project_id" varchar(255) NOT NULL,
    "updated_at" varchar(255) NOT NULL,
    "user_id" varchar(255) NOT NULL,
    "role" varchar(20) NOT NULL CHECK ("role" IN ('ADMIN','EDITOR','OWNER','VIEWER')),
    PRIMARY KEY ("project_id","user_id")
);

CREATE TABLE "project_templates" (
    "requires_planning_engine" boolean NOT NULL,
    "complexity_level" varchar(16) DEFAULT NULL,
    "version" varchar(20) NOT NULL,
    "id" varchar(36) NOT NULL,
    "previous_version_id" varchar(36) DEFAULT NULL,
    "category" varchar(50) DEFAULT NULL,
    "name" varchar(100) NOT NULL,
    "description" varchar(500) DEFAULT NULL,
    "capability_profile" text,
    "created_at" varchar(255) NOT NULL,
    "deleted_at" varchar(255) DEFAULT NULL,
    "last_synced_at" varchar(255) DEFAULT NULL,
    "prerequisites" text,
    "structure_json" text,
    "updated_at" varchar(255) NOT NULL,
    "use_cases" text,
    "sync_status" varchar(20) DEFAULT NULL CHECK ("sync_status" IN ('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED')),
    "template_scope" varchar(20) NOT NULL CHECK ("template_scope" IN ('SYSTEM','USER','WORKSPACE')),
    PRIMARY KEY ("id"),
    CONSTRAINT "project_templates__UKj428ws7r0mvg06aclkkvg80is" UNIQUE ("name")
);

CREATE TABLE "projects" (
    "archived" boolean NOT NULL,
    "favorite" boolean NOT NULL,
    "finance_enabled" boolean NOT NULL,
    "grants_enabled" boolean NOT NULL,
    "overdue_count" int NOT NULL,
    "overdue_warning_threshold" int NOT NULL,
    "planning_enabled" boolean NOT NULL,
    "time_tracking_enabled" boolean NOT NULL,
    "color" varchar(7) DEFAULT NULL,
    "version" bigint DEFAULT NULL,
    "id" varchar(36) NOT NULL,
    "owner_id" varchar(36) NOT NULL,
    "team_id" varchar(36) DEFAULT NULL,
    "icon" varchar(50) DEFAULT NULL,
    "name" varchar(200) NOT NULL,
    "description" varchar(2000) DEFAULT NULL,
    "created_at" varchar(255) NOT NULL,
    "deleted_at" varchar(255) DEFAULT NULL,
    "last_synced_at" varchar(255) DEFAULT NULL,
    "updated_at" varchar(255) NOT NULL,
    "health_status" varchar(20) NOT NULL CHECK ("health_status" IN ('CRITICAL','OK','WARNING')),
    "sync_status" varchar(20) DEFAULT NULL CHECK ("sync_status" IN ('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED')),
    "visibility" varchar(20) NOT NULL CHECK ("visibility" IN ('PERSONAL','SHARED','TEAM')),
    PRIMARY KEY ("id")
);

CREATE TABLE "rate_cards" (
    "currency" varchar(3) DEFAULT NULL,
    "daily_rate" double precision DEFAULT NULL,
    "hourly_rate" double precision NOT NULL,
    "id" varchar(36) NOT NULL,
    "scope_entity_id" varchar(36) NOT NULL,
    "created_at" varchar(255) DEFAULT NULL,
    "effective_from" varchar(255) NOT NULL,
    "effective_to" varchar(255) DEFAULT NULL,
    "scope" varchar(20) NOT NULL CHECK ("scope" IN ('PROJECT','ROLE','USER')),
    PRIMARY KEY ("id")
);

CREATE TABLE "remote_identities" (
    "deleted" boolean NOT NULL,
    "id" varchar(36) NOT NULL,
    "user_id" varchar(36) NOT NULL,
    "bound_at" varchar(255) DEFAULT NULL,
    "created_at" varchar(255) NOT NULL,
    "deleted_at" varchar(255) DEFAULT NULL,
    "email" varchar(255) DEFAULT NULL,
    "last_synced_at" varchar(255) DEFAULT NULL,
    "provider_user_id" varchar(255) NOT NULL,
    "revoked_at" varchar(255) DEFAULT NULL,
    "updated_at" varchar(255) NOT NULL,
    "provider" varchar(20) NOT NULL CHECK ("provider" IN ('GENERIC_OIDC','GOOGLE','KEYCLOAK','MICROSOFT')),
    "sync_status" varchar(20) DEFAULT NULL CHECK ("sync_status" IN ('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED')),
    PRIMARY KEY ("id"),
    CONSTRAINT "remote_identities__UKlxuo8kp93bgf7c6vb26oggk6f" UNIQUE ("provider","provider_user_id")
);

CREATE TABLE "reporting_periods" (
    "due_date" varchar(255) DEFAULT NULL,
    "id" varchar(255) NOT NULL,
    "name" varchar(255) DEFAULT NULL,
    "notes" varchar(255) DEFAULT NULL,
    "period_end" varchar(255) DEFAULT NULL,
    "period_start" varchar(255) DEFAULT NULL,
    "project_id" varchar(255) DEFAULT NULL,
    "status" varchar(255) DEFAULT NULL,
    "submission_asset_id" varchar(255) DEFAULT NULL,
    PRIMARY KEY ("id")
);

CREATE TABLE "resource_allocations" (
    "percentage" int NOT NULL,
    "id" varchar(36) NOT NULL,
    "project_id" varchar(36) DEFAULT NULL,
    "user_id" varchar(36) NOT NULL,
    "created_at" varchar(255) NOT NULL,
    "deleted_at" varchar(255) DEFAULT NULL,
    "end_date" varchar(255) NOT NULL,
    "last_synced_at" varchar(255) DEFAULT NULL,
    "start_date" varchar(255) NOT NULL,
    "updated_at" varchar(255) NOT NULL,
    "sync_status" varchar(20) DEFAULT NULL CHECK ("sync_status" IN ('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED')),
    PRIMARY KEY ("id")
);

CREATE TABLE "retention_policies" (
    "is_active" boolean DEFAULT NULL,
    "retention_days" int DEFAULT NULL,
    "action_on_expiry" varchar(255) DEFAULT NULL,
    "data_category_id" varchar(255) DEFAULT NULL,
    "id" varchar(255) NOT NULL,
    "scope" varchar(255) DEFAULT NULL,
    "scope_entity_id" varchar(255) DEFAULT NULL,
    PRIMARY KEY ("id")
);

CREATE TABLE "risk_register_entries" (
    "id" varchar(36) NOT NULL,
    "project_id" varchar(36) NOT NULL,
    "created_at" varchar(255) NOT NULL,
    "deleted_at" varchar(255) DEFAULT NULL,
    "description" varchar(255) NOT NULL,
    "last_synced_at" varchar(255) DEFAULT NULL,
    "mitigation_strategy" text,
    "updated_at" varchar(255) NOT NULL,
    "impact" varchar(20) NOT NULL CHECK ("impact" IN ('CRITICAL','HIGH','LOW','MEDIUM')),
    "probability" varchar(20) NOT NULL CHECK ("probability" IN ('CRITICAL','HIGH','LOW','MEDIUM')),
    "sync_status" varchar(20) DEFAULT NULL CHECK ("sync_status" IN ('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED')),
    PRIMARY KEY ("id")
);

CREATE TABLE "roles" (
    "id" varchar(36) NOT NULL,
    "name" varchar(50) NOT NULL,
    "created_at" varchar(255) NOT NULL,
    "deleted_at" varchar(255) DEFAULT NULL,
    "description" varchar(255) DEFAULT NULL,
    "last_synced_at" varchar(255) DEFAULT NULL,
    "updated_at" varchar(255) NOT NULL,
    "sync_status" varchar(20) DEFAULT NULL CHECK ("sync_status" IN ('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED')),
    PRIMARY KEY ("id"),
    CONSTRAINT "roles__UKofx66keruapi6vyqpv6f2or37" UNIQUE ("name")
);

CREATE TABLE "saved_views" (
    "is_default" boolean NOT NULL,
    "is_shared" boolean NOT NULL,
    "id" varchar(36) NOT NULL,
    "project_id" varchar(36) DEFAULT NULL,
    "user_id" varchar(36) NOT NULL,
    "name" varchar(128) NOT NULL,
    "columns_json" text,
    "created_at" varchar(255) NOT NULL,
    "deleted_at" varchar(255) DEFAULT NULL,
    "description" text,
    "filters_json" text,
    "grouping_json" text,
    "last_synced_at" varchar(255) DEFAULT NULL,
    "sort_json" text,
    "updated_at" varchar(255) NOT NULL,
    "sync_status" varchar(20) DEFAULT NULL CHECK ("sync_status" IN ('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED')),
    "view_type" varchar(20) NOT NULL CHECK ("view_type" IN ('BOARD','CALENDAR','GANTT','LIST','WORKLOAD')),
    PRIMARY KEY ("id")
);

CREATE TABLE "sponsor_commitments" (
    "committed_amount" double precision DEFAULT NULL,
    "agreement_asset_id" varchar(255) DEFAULT NULL,
    "agreement_date" varchar(255) DEFAULT NULL,
    "currency" varchar(255) DEFAULT NULL,
    "description" varchar(255) DEFAULT NULL,
    "id" varchar(255) NOT NULL,
    "project_id" varchar(255) DEFAULT NULL,
    "sponsor_id" varchar(255) DEFAULT NULL,
    "status" varchar(255) DEFAULT NULL,
    PRIMARY KEY ("id")
);

CREATE TABLE "sponsors" (
    "contact_person" varchar(255) DEFAULT NULL,
    "created_at" varchar(255) DEFAULT NULL,
    "email" varchar(255) DEFAULT NULL,
    "id" varchar(255) NOT NULL,
    "name" varchar(255) NOT NULL,
    "notes" varchar(255) DEFAULT NULL,
    "organization" varchar(255) DEFAULT NULL,
    "type" varchar(255) DEFAULT NULL,
    PRIMARY KEY ("id")
);

CREATE TABLE "stakeholders" (
    "channel" varchar(255) DEFAULT NULL,
    "created_at" varchar(255) DEFAULT NULL,
    "engagement_strategy" varchar(255) DEFAULT NULL,
    "id" varchar(255) NOT NULL,
    "influence_level" varchar(255) DEFAULT NULL,
    "interest_level" varchar(255) DEFAULT NULL,
    "name" varchar(255) NOT NULL,
    "notes" varchar(255) DEFAULT NULL,
    "organization" varchar(255) DEFAULT NULL,
    "project_id" varchar(255) DEFAULT NULL,
    "role_description" varchar(255) DEFAULT NULL,
    PRIMARY KEY ("id")
);

CREATE TABLE "status_reviews" (
    "id" varchar(36) NOT NULL,
    "project_id" varchar(36) NOT NULL,
    "reviewer_id" varchar(36) NOT NULL,
    "achievements" text,
    "blockers" text,
    "created_at" varchar(255) DEFAULT NULL,
    "next_actions" text,
    "review_date" varchar(255) NOT NULL,
    "summary" text,
    "budget_status" varchar(20) DEFAULT NULL CHECK ("budget_status" IN ('GREEN','RED','YELLOW')),
    "overall_status" varchar(20) NOT NULL CHECK ("overall_status" IN ('GREEN','RED','YELLOW')),
    "risk_status" varchar(20) DEFAULT NULL CHECK ("risk_status" IN ('GREEN','RED','YELLOW')),
    "schedule_status" varchar(20) DEFAULT NULL CHECK ("schedule_status" IN ('GREEN','RED','YELLOW')),
    PRIMARY KEY ("id")
);

CREATE TABLE "submission_packages" (
    "call_id" varchar(255) DEFAULT NULL,
    "created_at" varchar(255) DEFAULT NULL,
    "id" varchar(255) NOT NULL,
    "notes" varchar(255) DEFAULT NULL,
    "status" varchar(255) DEFAULT NULL,
    "submitted_at" varchar(255) DEFAULT NULL,
    "submitted_by" varchar(255) DEFAULT NULL,
    PRIMARY KEY ("id")
);

CREATE TABLE "success_metrics" (
    "current_value" double precision NOT NULL,
    "target_value" double precision NOT NULL,
    "id" varchar(36) NOT NULL,
    "okr_id" varchar(36) NOT NULL,
    "unit" varchar(50) DEFAULT NULL,
    "created_at" varchar(255) NOT NULL,
    "deleted_at" varchar(255) DEFAULT NULL,
    "last_synced_at" varchar(255) DEFAULT NULL,
    "name" varchar(255) NOT NULL,
    "updated_at" varchar(255) NOT NULL,
    "sync_status" varchar(20) DEFAULT NULL CHECK ("sync_status" IN ('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED')),
    PRIMARY KEY ("id")
);

CREATE TABLE "tags" (
    "color" varchar(7) DEFAULT NULL,
    "id" varchar(36) NOT NULL,
    "owner_id" varchar(36) NOT NULL,
    "name" varchar(50) NOT NULL,
    "created_at" varchar(255) NOT NULL,
    "deleted_at" varchar(255) DEFAULT NULL,
    "last_synced_at" varchar(255) DEFAULT NULL,
    "updated_at" varchar(255) NOT NULL,
    "sync_status" varchar(20) DEFAULT NULL CHECK ("sync_status" IN ('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED')),
    PRIMARY KEY ("id"),
    CONSTRAINT "tags__UKt48xdq560gs3gap9g7jg36kgc" UNIQUE ("name")
);

CREATE TABLE "target_achieved_records" (
    "achieved_value" double precision NOT NULL,
    "id" varchar(36) NOT NULL,
    "metric_id" varchar(36) NOT NULL,
    "created_at" varchar(255) NOT NULL,
    "deleted_at" varchar(255) DEFAULT NULL,
    "last_synced_at" varchar(255) DEFAULT NULL,
    "note" varchar(255) DEFAULT NULL,
    "record_date" varchar(255) NOT NULL,
    "updated_at" varchar(255) NOT NULL,
    "sync_status" varchar(20) DEFAULT NULL CHECK ("sync_status" IN ('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED')),
    PRIMARY KEY ("id")
);

CREATE TABLE "task_checklist_items" (
    "done" boolean NOT NULL,
    "sort_order" int NOT NULL,
    "id" varchar(36) NOT NULL,
    "task_id" varchar(36) NOT NULL,
    "text" varchar(1000) NOT NULL,
    "created_at" varchar(255) NOT NULL,
    "updated_at" varchar(255) NOT NULL,
    PRIMARY KEY ("id")
);

CREATE TABLE "task_dependencies" (
    "blocked_task_id" varchar(36) NOT NULL,
    "blocker_task_id" varchar(36) NOT NULL,
    PRIMARY KEY ("blocked_task_id","blocker_task_id")
);

CREATE TABLE "task_priorities" (
    "level" int NOT NULL,
    "color" varchar(7) DEFAULT NULL,
    "id" varchar(36) NOT NULL,
    "name" varchar(50) NOT NULL,
    "created_at" varchar(255) NOT NULL,
    "deleted_at" varchar(255) DEFAULT NULL,
    "last_synced_at" varchar(255) DEFAULT NULL,
    "updated_at" varchar(255) NOT NULL,
    "sync_status" varchar(20) DEFAULT NULL CHECK ("sync_status" IN ('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED')),
    PRIMARY KEY ("id"),
    CONSTRAINT "task_priorities__UKpr39i0fxyhh18hgobprwpbmhm" UNIQUE ("name")
);

CREATE TABLE "task_status_history" (
    "changed_by" varchar(36) DEFAULT NULL,
    "id" varchar(36) NOT NULL,
    "task_id" varchar(36) NOT NULL,
    "new_status" varchar(64) NOT NULL,
    "old_status" varchar(64) DEFAULT NULL,
    "changed_at" varchar(255) NOT NULL,
    "comment" text,
    PRIMARY KEY ("id")
);

CREATE TABLE "task_statuses" (
    "color" varchar(7) DEFAULT NULL,
    "id" varchar(36) NOT NULL,
    "name" varchar(50) NOT NULL,
    "created_at" varchar(255) NOT NULL,
    "deleted_at" varchar(255) DEFAULT NULL,
    "description" varchar(255) DEFAULT NULL,
    "last_synced_at" varchar(255) DEFAULT NULL,
    "updated_at" varchar(255) NOT NULL,
    "category" varchar(20) NOT NULL CHECK ("category" IN ('ARCHIVED','BLOCKED','DONE','IN_PROGRESS','TODO')),
    "sync_status" varchar(20) DEFAULT NULL CHECK ("sync_status" IN ('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED')),
    PRIMARY KEY ("id"),
    CONSTRAINT "task_statuses__UKdhogqjhrcydo4g6hpr4yue0u" UNIQUE ("name")
);

CREATE TABLE "task_tags" (
    "tag_id" varchar(36) NOT NULL,
    "task_id" varchar(36) NOT NULL,
    PRIMARY KEY ("tag_id","task_id")
);

CREATE TABLE "tasks" (
    "actual_effort" int NOT NULL,
    "actual_effort_hours" double precision DEFAULT NULL,
    "archived" boolean NOT NULL,
    "estimated_effort" int DEFAULT NULL,
    "estimated_effort_hours" double precision DEFAULT NULL,
    "finance_enabled" boolean NOT NULL,
    "inbox" boolean NOT NULL,
    "is_critical" boolean DEFAULT NULL,
    "notification_sent" boolean NOT NULL,
    "planning_enabled" boolean NOT NULL,
    "reminder_enabled" boolean NOT NULL,
    "sort_order" int NOT NULL,
    "total_float" int DEFAULT NULL,
    "asset_size_bytes" bigint DEFAULT NULL,
    "version" bigint DEFAULT NULL,
    "constraint_type" varchar(32) DEFAULT NULL,
    "assigned_to_id" varchar(36) DEFAULT NULL,
    "deliverable_id" varchar(36) DEFAULT NULL,
    "id" varchar(36) NOT NULL,
    "parent_task_id" varchar(36) DEFAULT NULL,
    "phase_id" varchar(36) DEFAULT NULL,
    "priority_id" varchar(36) DEFAULT NULL,
    "project_id" varchar(36) NOT NULL,
    "stakeholder_id" varchar(36) DEFAULT NULL,
    "status_id" varchar(36) DEFAULT NULL,
    "asset_mime_type" varchar(50) DEFAULT NULL,
    "asset_file_name" varchar(100) DEFAULT NULL,
    "owner" varchar(200) DEFAULT NULL,
    "asset_path" varchar(500) DEFAULT NULL,
    "title" varchar(500) NOT NULL,
    "notes" varchar(2000) DEFAULT NULL,
    "description" varchar(5000) DEFAULT NULL,
    "actual_end" varchar(255) DEFAULT NULL,
    "actual_start" varchar(255) DEFAULT NULL,
    "constraint_date" varchar(255) DEFAULT NULL,
    "created_at" varchar(255) NOT NULL,
    "deadline" varchar(255) DEFAULT NULL,
    "deleted_at" varchar(255) DEFAULT NULL,
    "early_finish" varchar(255) DEFAULT NULL,
    "early_start" varchar(255) DEFAULT NULL,
    "funding_context" text,
    "last_synced_at" varchar(255) DEFAULT NULL,
    "late_finish" varchar(255) DEFAULT NULL,
    "late_start" varchar(255) DEFAULT NULL,
    "markdown_notes" text,
    "planned_finish" varchar(255) DEFAULT NULL,
    "planned_start" varchar(255) DEFAULT NULL,
    "reminder_date" varchar(255) DEFAULT NULL,
    "updated_at" varchar(255) NOT NULL,
    "duration_unit" varchar(20) DEFAULT NULL CHECK ("duration_unit" IN ('DAYS','HOURS','MINUTES','MONTHS','WEEKS')),
    "sync_status" varchar(20) DEFAULT NULL CHECK ("sync_status" IN ('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED')),
    "type" varchar(20) NOT NULL CHECK ("type" IN ('APPOINTMENT','CALL','DEADLINE','DELIVERABLE_TASK','FINANCE_TASK','MEETING','MILESTONE','REMINDER','REVIEW_TASK','SUMMARY_TASK','TASK','TASK_BLOCK')),
    PRIMARY KEY ("id")
);

CREATE TABLE "team_members" (
    "created_at" varchar(255) NOT NULL,
    "team_id" varchar(255) NOT NULL,
    "updated_at" varchar(255) NOT NULL,
    "user_id" varchar(255) NOT NULL,
    "role" varchar(20) NOT NULL CHECK ("role" IN ('TEAM_ADMIN','TEAM_MEMBER','TEAM_OWNER')),
    PRIMARY KEY ("team_id","user_id")
);

CREATE TABLE "teams" (
    "id" varchar(36) NOT NULL,
    "owner_id" varchar(36) NOT NULL,
    "name" varchar(100) NOT NULL,
    "description" varchar(500) DEFAULT NULL,
    "created_at" varchar(255) NOT NULL,
    "updated_at" varchar(255) NOT NULL,
    PRIMARY KEY ("id")
);

CREATE TABLE "time_entries" (
    "duration_minutes" int NOT NULL,
    "id" varchar(36) NOT NULL,
    "task_id" varchar(36) NOT NULL,
    "user_id" varchar(36) DEFAULT NULL,
    "description" varchar(500) DEFAULT NULL,
    "created_at" varchar(255) NOT NULL,
    "deleted_at" varchar(255) DEFAULT NULL,
    "entry_date" varchar(255) NOT NULL,
    "last_synced_at" varchar(255) DEFAULT NULL,
    "updated_at" varchar(255) NOT NULL,
    "sync_status" varchar(20) DEFAULT NULL CHECK ("sync_status" IN ('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED')),
    "type" varchar(20) NOT NULL CHECK ("type" IN ('MANUAL','TIMER')),
    PRIMARY KEY ("id")
);

CREATE TABLE "user_connections" (
    "requester_id" varchar(36) NOT NULL,
    "target_id" varchar(36) NOT NULL,
    "created_at" varchar(255) NOT NULL,
    "id" varchar(255) NOT NULL,
    "updated_at" varchar(255) DEFAULT NULL,
    "status" varchar(20) NOT NULL CHECK ("status" IN ('ACCEPTED','PENDING','REJECTED')),
    PRIMARY KEY ("id"),
    CONSTRAINT "user_connections__UKd77f8kqaq6plktip02u56us08" UNIQUE ("requester_id","target_id")
);

CREATE TABLE "user_settings" (
    "auto_backup_enabled" boolean NOT NULL,
    "daily_work_capacity_minutes" int NOT NULL,
    "focus_timer_default_minutes" int NOT NULL,
    "notifications_enabled" boolean NOT NULL,
    "language" varchar(10) NOT NULL,
    "theme" varchar(20) NOT NULL,
    "user_id" varchar(36) NOT NULL,
    "calendar_token" varchar(64) DEFAULT NULL,
    "created_at" varchar(255) NOT NULL,
    "last_backup_at" varchar(255) DEFAULT NULL,
    "updated_at" varchar(255) NOT NULL,
    PRIMARY KEY ("user_id")
);

CREATE TABLE "users" (
    "active" boolean NOT NULL,
    "is_ghost" boolean NOT NULL,
    "created_by_id" varchar(36) DEFAULT NULL,
    "id" varchar(36) NOT NULL,
    "workspace_profile_id" varchar(36) DEFAULT NULL,
    "username" varchar(50) NOT NULL,
    "display_name" varchar(100) DEFAULT NULL,
    "email" varchar(100) DEFAULT NULL,
    "avatar_path" varchar(255) DEFAULT NULL,
    "clerk_user_id" varchar(255) DEFAULT NULL,
    "created_at" varchar(255) NOT NULL,
    "deleted_at" varchar(255) DEFAULT NULL,
    "last_login_at" varchar(255) DEFAULT NULL,
    "last_synced_at" varchar(255) DEFAULT NULL,
    "password_hash" varchar(255) NOT NULL,
    "updated_at" varchar(255) NOT NULL,
    "sync_status" varchar(20) DEFAULT NULL CHECK ("sync_status" IN ('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED')),
    PRIMARY KEY ("id"),
    CONSTRAINT "users__idx_username" UNIQUE ("username"),
    CONSTRAINT "users__idx_email" UNIQUE ("email"),
    CONSTRAINT "users__ux_users_clerk_user_id" UNIQUE ("clerk_user_id")
);

CREATE TABLE "wbs_nodes" (
    "sort_order" int NOT NULL,
    "id" varchar(36) NOT NULL,
    "parent_id" varchar(36) DEFAULT NULL,
    "project_id" varchar(36) NOT NULL,
    "task_id" varchar(36) DEFAULT NULL,
    "name" varchar(100) NOT NULL,
    "created_at" varchar(255) NOT NULL,
    "deleted_at" varchar(255) DEFAULT NULL,
    "last_synced_at" varchar(255) DEFAULT NULL,
    "updated_at" varchar(255) NOT NULL,
    "wbs_code" varchar(255) NOT NULL,
    "sync_status" varchar(20) DEFAULT NULL CHECK ("sync_status" IN ('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED')),
    PRIMARY KEY ("id"),
    CONSTRAINT "wbs_nodes__UK6rqfkbm4w5jtdxkkfoyugh9e" UNIQUE ("task_id")
);

CREATE TABLE "work_calendars" (
    "scope" varchar(32) DEFAULT NULL,
    "id" varchar(36) NOT NULL,
    "scope_entity_id" varchar(36) DEFAULT NULL,
    "name" varchar(100) NOT NULL,
    "created_at" varchar(255) NOT NULL,
    "deleted_at" varchar(255) DEFAULT NULL,
    "description" varchar(255) DEFAULT NULL,
    "last_synced_at" varchar(255) DEFAULT NULL,
    "updated_at" varchar(255) NOT NULL,
    "sync_status" varchar(20) DEFAULT NULL CHECK ("sync_status" IN ('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED')),
    PRIMARY KEY ("id"),
    CONSTRAINT "work_calendars__UKo3fvjph3vkrqe02dr910nkjkh" UNIQUE ("name")
);

CREATE TABLE "work_day_rules" (
    "is_working_day" boolean NOT NULL,
    "calendar_id" varchar(36) NOT NULL,
    "id" varchar(36) NOT NULL,
    "break_end_time" varchar(255) DEFAULT NULL,
    "break_start_time" varchar(255) DEFAULT NULL,
    "created_at" varchar(255) NOT NULL,
    "deleted_at" varchar(255) DEFAULT NULL,
    "end_time" varchar(255) DEFAULT NULL,
    "last_synced_at" varchar(255) DEFAULT NULL,
    "start_time" varchar(255) DEFAULT NULL,
    "updated_at" varchar(255) NOT NULL,
    "day_of_week" varchar(20) NOT NULL CHECK ("day_of_week" IN ('FRIDAY','MONDAY','SATURDAY','SUNDAY','THURSDAY','TUESDAY','WEDNESDAY')),
    "sync_status" varchar(20) DEFAULT NULL CHECK ("sync_status" IN ('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED')),
    PRIMARY KEY ("id"),
    CONSTRAINT "work_day_rules__UKehm55fppjsovygr4yp2j2m778" UNIQUE ("calendar_id","day_of_week")
);

CREATE TABLE "workspace_profiles" (
    "is_system" boolean DEFAULT NULL,
    "id" varchar(36) NOT NULL,
    "name" varchar(64) NOT NULL,
    "created_at" varchar(255) DEFAULT NULL,
    "description" text,
    "modules_json" text NOT NULL,
    "nav_items_json" text,
    PRIMARY KEY ("id")
);

CREATE INDEX "approval_requests__FK17n9buj32k7a73mda3ldf0hb" ON "approval_requests" ("approver_id");
CREATE INDEX "approval_requests__FK1hpi518c4adapwvv02rgijqwk" ON "approval_requests" ("project_id");
CREATE INDEX "approval_requests__FK5po777y579fbsn91cyyxiy3rt" ON "approval_requests" ("requested_by");
CREATE INDEX "asset_links__FK1oxbevwfi6sgamx0lp3kiylfc" ON "asset_links" ("asset_id");
CREATE INDEX "asset_versions__FKeojhm0n81wc17ek4day820x35" ON "asset_versions" ("asset_id");
CREATE INDEX "asset_versions__FKpehq6b3bt9c6qc5p36emy5cdj" ON "asset_versions" ("uploaded_by");
CREATE INDEX "assets__idx_asset_owner" ON "assets" ("owner_id");
CREATE INDEX "assets__idx_asset_created" ON "assets" ("created_at");
CREATE INDEX "assets__idx_asset_type" ON "assets" ("mime_type");
CREATE INDEX "assets__FK43q62w7ma6pqi2yynfa52bx98" ON "assets" ("task_id");
CREATE INDEX "assignments__idx_assignment_task" ON "assignments" ("task_id");
CREATE INDEX "assignments__idx_assignment_user" ON "assignments" ("user_id");
CREATE INDEX "assignments__FKkyafu0ie5ap4y4pj7kwspqdi8" ON "assignments" ("role_id");
CREATE INDEX "audit_events__idx_audit_entity" ON "audit_events" ("entity_type","entity_id");
CREATE INDEX "audit_events__idx_audit_user" ON "audit_events" ("user_id");
CREATE INDEX "audit_events__idx_audit_ts" ON "audit_events" ("event_timestamp");
CREATE INDEX "baseline_task_snapshots__idx_snapshot_baseline" ON "baseline_task_snapshots" ("baseline_id");
CREATE INDEX "baseline_task_snapshots__idx_snapshot_task" ON "baseline_task_snapshots" ("task_id");
CREATE INDEX "baselines__idx_baseline_project" ON "baselines" ("project_id");
CREATE INDEX "calendar_exceptions__idx_exception_calendar" ON "calendar_exceptions" ("calendar_id");
CREATE INDEX "calendar_exceptions__idx_exception_date" ON "calendar_exceptions" ("exception_date");
CREATE INDEX "calendar_feed_tokens__idx_cft_user" ON "calendar_feed_tokens" ("user_id");
CREATE INDEX "calendar_feed_tokens__idx_cft_token" ON "calendar_feed_tokens" ("token");
CREATE INDEX "capacity_profiles__FKf3a5ysgbu1hsmodfwwilxva0y" ON "capacity_profiles" ("calendar_id");
CREATE INDEX "capacity_profiles__FK7k17sr93il15cxdvckegspoo3" ON "capacity_profiles" ("user_id");
CREATE INDEX "conflict_records__idx_conflict_entity" ON "conflict_records" ("entity_type","entity_id");
CREATE INDEX "deliverables__idx_deliverable_project" ON "deliverables" ("project_id");
CREATE INDEX "dependencies__idx_dependency_predecessor" ON "dependencies" ("predecessor_id");
CREATE INDEX "dependencies__idx_dependency_successor" ON "dependencies" ("successor_id");
CREATE INDEX "effort_estimates__idx_estimate_task" ON "effort_estimates" ("task_id");
CREATE INDEX "effort_estimates__idx_estimate_date" ON "effort_estimates" ("estimation_date");
CREATE INDEX "effort_estimates__FKkbeyvw5hpf68nuawh3oeo5r78" ON "effort_estimates" ("estimator_id");
CREATE INDEX "evidence_pack_items__FKj0o4g7oi78a29i240hs8f2dq" ON "evidence_pack_items" ("asset_id");
CREATE INDEX "evidence_pack_items__FK136r9sk7j67tpxrba4uo3ungv" ON "evidence_pack_items" ("note_id");
CREATE INDEX "evidence_pack_items__FKmg2vyk1n29bc4qrlyv9tbc90j" ON "evidence_pack_items" ("pack_id");
CREATE INDEX "evidence_packs__FKo4wnqg58q2drao3r66obmdkv7" ON "evidence_packs" ("created_by");
CREATE INDEX "evidence_packs__FK4t8gqyynt33na80c0rilvxgd1" ON "evidence_packs" ("project_id");
CREATE INDEX "external_contributors__FKfmv1vw93ivctcm59f1oxk579c" ON "external_contributors" ("created_by");
CREATE INDEX "external_contributors__FK76i3ydknrumwoyt0379aw2fyi" ON "external_contributors" ("role_id");
CREATE INDEX "focus_sessions__idx_focus_task" ON "focus_sessions" ("task_id");
CREATE INDEX "focus_sessions__idx_focus_user" ON "focus_sessions" ("user_id");
CREATE INDEX "focus_sessions__idx_focus_started" ON "focus_sessions" ("started_at");
CREATE INDEX "focus_sessions__idx_focus_ended" ON "focus_sessions" ("ended_at");
CREATE INDEX "import_export_jobs__idx_job_user" ON "import_export_jobs" ("user_id");
CREATE INDEX "import_export_jobs__idx_job_project" ON "import_export_jobs" ("project_id");
CREATE INDEX "import_export_jobs__idx_job_status" ON "import_export_jobs" ("status");
CREATE INDEX "merge_policies__idx_mp_entity_type" ON "merge_policies" ("entity_type");
CREATE INDEX "note_links__idx_notelink_note" ON "note_links" ("note_id");
CREATE INDEX "note_links__idx_notelink_linked_entity" ON "note_links" ("linked_entity_type","linked_entity_id");
CREATE INDEX "note_revisions__idx_note_revisions" ON "note_revisions" ("note_id","revision_number");
CREATE INDEX "note_tags__FK8babdwu6uqiu4rdkeuy8dkna0" ON "note_tags" ("tag_id");
CREATE INDEX "notes__idx_note_owner" ON "notes" ("owner_id");
CREATE INDEX "notes__idx_note_project_updated" ON "notes" ("project_id","updated_at");
CREATE INDEX "notes__idx_note_parent" ON "notes" ("parent_type","parent_id");
CREATE INDEX "notifications__FKqqnsjxlwleyjbxlmm213jaj3f" ON "notifications" ("recipient_id");
CREATE INDEX "notifications__FK13vcnq3ukas06ho1yrbc5lrb5" ON "notifications" ("sender_id");
CREATE INDEX "okrs__idx_okr_project" ON "okrs" ("project_id");
CREATE INDEX "phases__FKp0vs31guyj5itugskrstnrm4y" ON "phases" ("project_id");
CREATE INDEX "project_members__FKgul2el0qjk5lsvig3wgajwm77" ON "project_members" ("user_id");
CREATE INDEX "project_templates__idx_template_scope" ON "project_templates" ("template_scope");
CREATE INDEX "project_templates__idx_template_category" ON "project_templates" ("category");
CREATE INDEX "projects__idx_project_owner" ON "projects" ("owner_id");
CREATE INDEX "projects__idx_project_team" ON "projects" ("team_id");
CREATE INDEX "projects__idx_project_archived" ON "projects" ("archived");
CREATE INDEX "projects__idx_project_created" ON "projects" ("created_at");
CREATE INDEX "remote_identities__FK9fsq5857ltq9e3qefsjnd0ufl" ON "remote_identities" ("user_id");
CREATE INDEX "resource_allocations__idx_allocation_user" ON "resource_allocations" ("user_id");
CREATE INDEX "resource_allocations__idx_allocation_project" ON "resource_allocations" ("project_id");
CREATE INDEX "resource_allocations__idx_allocation_period" ON "resource_allocations" ("start_date","end_date");
CREATE INDEX "risk_register_entries__idx_risk_project" ON "risk_register_entries" ("project_id");
CREATE INDEX "saved_views__idx_saved_views_user" ON "saved_views" ("user_id");
CREATE INDEX "saved_views__idx_saved_views_project" ON "saved_views" ("project_id");
CREATE INDEX "saved_views__idx_saved_views_type" ON "saved_views" ("view_type");
CREATE INDEX "status_reviews__FKksxq1vspt0um4h1mwitx3bowd" ON "status_reviews" ("project_id");
CREATE INDEX "status_reviews__FKfd3w78574l74o9un9km3lfo21" ON "status_reviews" ("reviewer_id");
CREATE INDEX "success_metrics__idx_successmetric_okr" ON "success_metrics" ("okr_id");
CREATE INDEX "tags__idx_tag_name" ON "tags" ("name");
CREATE INDEX "tags__idx_tag_owner" ON "tags" ("owner_id");
CREATE INDEX "target_achieved_records__idx_targetrecord_metric" ON "target_achieved_records" ("metric_id");
CREATE INDEX "target_achieved_records__idx_targetrecord_date" ON "target_achieved_records" ("record_date");
CREATE INDEX "task_checklist_items__idx_checklist_item_task" ON "task_checklist_items" ("task_id");
CREATE INDEX "task_dependencies__FKfunguagqo0rtn07bg91cvhtmt" ON "task_dependencies" ("blocker_task_id");
CREATE INDEX "task_status_history__idx_task_status_history" ON "task_status_history" ("task_id","changed_at");
CREATE INDEX "task_status_history__idx_task_status_history_user" ON "task_status_history" ("changed_by");
CREATE INDEX "task_tags__FK7xi1reghkj37gqwlr1ujxrxll" ON "task_tags" ("task_id");
CREATE INDEX "tasks__idx_task_project" ON "tasks" ("project_id");
CREATE INDEX "tasks__idx_task_assigned" ON "tasks" ("assigned_to_id");
CREATE INDEX "tasks__idx_task_status" ON "tasks" ("status_id");
CREATE INDEX "tasks__idx_task_priority" ON "tasks" ("priority_id");
CREATE INDEX "tasks__idx_task_deadline" ON "tasks" ("deadline");
CREATE INDEX "tasks__idx_task_created" ON "tasks" ("created_at");
CREATE INDEX "tasks__idx_task_parent" ON "tasks" ("parent_task_id");
CREATE INDEX "team_members__FKee8x7x5026imwmma9kndkxs36" ON "team_members" ("user_id");
CREATE INDEX "teams__idx_team_owner" ON "teams" ("owner_id");
CREATE INDEX "time_entries__idx_timeentry_task" ON "time_entries" ("task_id");
CREATE INDEX "time_entries__idx_timeentry_user" ON "time_entries" ("user_id");
CREATE INDEX "time_entries__idx_timeentry_date" ON "time_entries" ("entry_date");
CREATE INDEX "user_connections__FKfc2ojy6pxa9fgqu5d0uvnah83" ON "user_connections" ("target_id");
CREATE INDEX "users__FK8nakkftyppd62ke6tv7oo5a92" ON "users" ("created_by_id");
CREATE INDEX "wbs_nodes__idx_wbs_project" ON "wbs_nodes" ("project_id");
CREATE INDEX "wbs_nodes__idx_wbs_parent" ON "wbs_nodes" ("parent_id");

ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests__FK17n9buj32k7a73mda3ldf0hb" FOREIGN KEY ("approver_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests__FK1hpi518c4adapwvv02rgijqwk" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests__FK5po777y579fbsn91cyyxiy3rt" FOREIGN KEY ("requested_by") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "asset_links" ADD CONSTRAINT "asset_links__FK1oxbevwfi6sgamx0lp3kiylfc" FOREIGN KEY ("asset_id") REFERENCES "assets" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "asset_versions" ADD CONSTRAINT "asset_versions__FKeojhm0n81wc17ek4day820x35" FOREIGN KEY ("asset_id") REFERENCES "assets" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "asset_versions" ADD CONSTRAINT "asset_versions__FKpehq6b3bt9c6qc5p36emy5cdj" FOREIGN KEY ("uploaded_by") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "assets" ADD CONSTRAINT "assets__FK43q62w7ma6pqi2yynfa52bx98" FOREIGN KEY ("task_id") REFERENCES "tasks" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "assets" ADD CONSTRAINT "assets__FKecqhtybnkgvj8x5xo6jnkydct" FOREIGN KEY ("owner_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "assignments" ADD CONSTRAINT "assignments__FK8iy60sfbpptmtm10f4al96qvq" FOREIGN KEY ("user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "assignments" ADD CONSTRAINT "assignments__FKedsmfsq5iq0j8a74fpkgleyn4" FOREIGN KEY ("task_id") REFERENCES "tasks" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "assignments" ADD CONSTRAINT "assignments__FKkyafu0ie5ap4y4pj7kwspqdi8" FOREIGN KEY ("role_id") REFERENCES "roles" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "baseline_task_snapshots" ADD CONSTRAINT "baseline_task_snapshots__FKfvdvkkemmrdw5fs970b17jy1g" FOREIGN KEY ("task_id") REFERENCES "tasks" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "baseline_task_snapshots" ADD CONSTRAINT "baseline_task_snapshots__FKgjn6jl9ehrg84a6vlvts0995f" FOREIGN KEY ("baseline_id") REFERENCES "baselines" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "baselines" ADD CONSTRAINT "baselines__FKaw009di7fvl2uk4nb43qsb1jr" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "calendar_exceptions" ADD CONSTRAINT "calendar_exceptions__FK8m00l058x3m5yev1nxinyef44" FOREIGN KEY ("calendar_id") REFERENCES "work_calendars" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "calendar_feed_tokens" ADD CONSTRAINT "calendar_feed_tokens__FK38c77murtsaoilpn49i0i95so" FOREIGN KEY ("user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "capacity_profiles" ADD CONSTRAINT "capacity_profiles__FK7k17sr93il15cxdvckegspoo3" FOREIGN KEY ("user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "capacity_profiles" ADD CONSTRAINT "capacity_profiles__FKf3a5ysgbu1hsmodfwwilxva0y" FOREIGN KEY ("calendar_id") REFERENCES "work_calendars" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables__FKcwoiqr4ahk3emorindc94a0eu" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "dependencies" ADD CONSTRAINT "dependencies__FKontm3a90n9vb3t0xx9usj8psh" FOREIGN KEY ("predecessor_id") REFERENCES "tasks" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "dependencies" ADD CONSTRAINT "dependencies__FKq69bbfjnl20go773qthbmte0j" FOREIGN KEY ("successor_id") REFERENCES "tasks" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "effort_estimates" ADD CONSTRAINT "effort_estimates__FKb27dok6rt7995yf09b5mx910t" FOREIGN KEY ("task_id") REFERENCES "tasks" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "effort_estimates" ADD CONSTRAINT "effort_estimates__FKkbeyvw5hpf68nuawh3oeo5r78" FOREIGN KEY ("estimator_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "evidence_pack_items" ADD CONSTRAINT "evidence_pack_items__FK136r9sk7j67tpxrba4uo3ungv" FOREIGN KEY ("note_id") REFERENCES "notes" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "evidence_pack_items" ADD CONSTRAINT "evidence_pack_items__FKj0o4g7oi78a29i240hs8f2dq" FOREIGN KEY ("asset_id") REFERENCES "assets" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "evidence_pack_items" ADD CONSTRAINT "evidence_pack_items__FKmg2vyk1n29bc4qrlyv9tbc90j" FOREIGN KEY ("pack_id") REFERENCES "evidence_packs" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "evidence_packs" ADD CONSTRAINT "evidence_packs__FK4t8gqyynt33na80c0rilvxgd1" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "evidence_packs" ADD CONSTRAINT "evidence_packs__FKo4wnqg58q2drao3r66obmdkv7" FOREIGN KEY ("created_by") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "external_contributors" ADD CONSTRAINT "external_contributors__FK76i3ydknrumwoyt0379aw2fyi" FOREIGN KEY ("role_id") REFERENCES "roles" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "external_contributors" ADD CONSTRAINT "external_contributors__FKfmv1vw93ivctcm59f1oxk579c" FOREIGN KEY ("created_by") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "focus_sessions" ADD CONSTRAINT "focus_sessions__FKcjt1qit8ck1qmkfpjiocf322d" FOREIGN KEY ("user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "focus_sessions" ADD CONSTRAINT "focus_sessions__FKrotfj11uou8tcka4c6o838ux" FOREIGN KEY ("task_id") REFERENCES "tasks" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "leave_records" ADD CONSTRAINT "leave_records__FKseov39eh0ahtvh2c0yrkatiqi" FOREIGN KEY ("user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "note_links" ADD CONSTRAINT "note_links__FKtoi7r918i28pjjnp2x7j4bvi7" FOREIGN KEY ("note_id") REFERENCES "notes" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "note_tags" ADD CONSTRAINT "note_tags__FK8babdwu6uqiu4rdkeuy8dkna0" FOREIGN KEY ("tag_id") REFERENCES "tags" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "note_tags" ADD CONSTRAINT "note_tags__FKb15yxop81senc5xs5tjrsy4k4" FOREIGN KEY ("note_id") REFERENCES "notes" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "notes" ADD CONSTRAINT "notes__FK5n5jgcd6tqt248r97q0yrt3xp" FOREIGN KEY ("owner_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications__FK13vcnq3ukas06ho1yrbc5lrb5" FOREIGN KEY ("sender_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications__FKqqnsjxlwleyjbxlmm213jaj3f" FOREIGN KEY ("recipient_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "okrs" ADD CONSTRAINT "okrs__FKc5cqp1krrn6uvmqftnmqk8su4" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "permission_policies" ADD CONSTRAINT "permission_policies__FK9ouowq688u88wm5ivtb0iqokq" FOREIGN KEY ("role_id") REFERENCES "roles" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "phases" ADD CONSTRAINT "phases__FKp0vs31guyj5itugskrstnrm4y" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "project_charters" ADD CONSTRAINT "project_charters__FK67sad3dooqvhl0s4mhuaf7rho" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "project_members" ADD CONSTRAINT "project_members__FKdki1sp2homqsdcvqm9yrix31g" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "project_members" ADD CONSTRAINT "project_members__FKgul2el0qjk5lsvig3wgajwm77" FOREIGN KEY ("user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "projects" ADD CONSTRAINT "projects__FKmqih0928bq6r3gbuh47giq8w" FOREIGN KEY ("team_id") REFERENCES "teams" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "projects" ADD CONSTRAINT "projects__FKmueqy6cpcwpfl8gnnag4idjt9" FOREIGN KEY ("owner_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "remote_identities" ADD CONSTRAINT "remote_identities__FK9fsq5857ltq9e3qefsjnd0ufl" FOREIGN KEY ("user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "resource_allocations" ADD CONSTRAINT "resource_allocations__FK91tespeeicmqnkx1wn6gkimbo" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "resource_allocations" ADD CONSTRAINT "resource_allocations__FKlguxdf9dnj21jofewdbmqr0k0" FOREIGN KEY ("user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "risk_register_entries" ADD CONSTRAINT "risk_register_entries__FKa2urd9vs0lqej4x8sweg6usr7" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "status_reviews" ADD CONSTRAINT "status_reviews__FKfd3w78574l74o9un9km3lfo21" FOREIGN KEY ("reviewer_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "status_reviews" ADD CONSTRAINT "status_reviews__FKksxq1vspt0um4h1mwitx3bowd" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "success_metrics" ADD CONSTRAINT "success_metrics__FK7v6sp2vm7vplxma8tugie7jsa" FOREIGN KEY ("okr_id") REFERENCES "okrs" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "tags" ADD CONSTRAINT "tags__FKx0nceen1ii190w7et5r042qt" FOREIGN KEY ("owner_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "target_achieved_records" ADD CONSTRAINT "target_achieved_records__FKtc699bw85g1ie32rql89kdtea" FOREIGN KEY ("metric_id") REFERENCES "success_metrics" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "task_checklist_items" ADD CONSTRAINT "task_checklist_items__FKdss8rgar5gq2b5vjnjbapn4cu" FOREIGN KEY ("task_id") REFERENCES "tasks" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies__FK5wj5oe4ht9t44ksdhnnfykf0t" FOREIGN KEY ("blocked_task_id") REFERENCES "tasks" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies__FKfunguagqo0rtn07bg91cvhtmt" FOREIGN KEY ("blocker_task_id") REFERENCES "tasks" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "task_tags" ADD CONSTRAINT "task_tags__FK7xi1reghkj37gqwlr1ujxrxll" FOREIGN KEY ("task_id") REFERENCES "tasks" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "task_tags" ADD CONSTRAINT "task_tags__FKeiqe3k9ent7icelm1cihqn164" FOREIGN KEY ("tag_id") REFERENCES "tags" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks__FK4516wfa828r15k9u3iw5er4vi" FOREIGN KEY ("assigned_to_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks__FK76tiq4q248au3u79a8nkexoth" FOREIGN KEY ("parent_task_id") REFERENCES "tasks" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks__FK9or72b0xffyc2ynghmn48hel3" FOREIGN KEY ("priority_id") REFERENCES "task_priorities" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks__FKa0dcdc9qxbpoes4a1p4i0f9y3" FOREIGN KEY ("status_id") REFERENCES "task_statuses" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks__FKsfhn82y57i3k9uxww1s007acc" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "team_members" ADD CONSTRAINT "team_members__FKee8x7x5026imwmma9kndkxs36" FOREIGN KEY ("user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "team_members" ADD CONSTRAINT "team_members__FKtgca08el3ofisywcf11f0f76t" FOREIGN KEY ("team_id") REFERENCES "teams" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "teams" ADD CONSTRAINT "teams__FKde03in0noals71lom04bmfgit" FOREIGN KEY ("owner_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries__FK5oy4d9re28blktipmwp24smmu" FOREIGN KEY ("user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries__FKfohb8frbtyjjx7ebqujd0v9tq" FOREIGN KEY ("task_id") REFERENCES "tasks" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "user_connections" ADD CONSTRAINT "user_connections__FK87a2325ovm813njp71xwmk6yt" FOREIGN KEY ("requester_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "user_connections" ADD CONSTRAINT "user_connections__FKfc2ojy6pxa9fgqu5d0uvnah83" FOREIGN KEY ("target_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings__FK8v82nj88rmai0nyck19f873dw" FOREIGN KEY ("user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "users" ADD CONSTRAINT "users__FK8nakkftyppd62ke6tv7oo5a92" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "wbs_nodes" ADD CONSTRAINT "wbs_nodes__FKb1jtaaqduh7w5ry1i4jpou0te" FOREIGN KEY ("task_id") REFERENCES "tasks" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "wbs_nodes" ADD CONSTRAINT "wbs_nodes__FKhsvu3q7b8qpdvhrxgop5mfac" FOREIGN KEY ("parent_id") REFERENCES "wbs_nodes" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "wbs_nodes" ADD CONSTRAINT "wbs_nodes__FKowtk9fj83ayo7yh9dlh2oe9m3" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "work_day_rules" ADD CONSTRAINT "work_day_rules__FK2x85xao54gv1b3u93sgns5lim" FOREIGN KEY ("calendar_id") REFERENCES "work_calendars" ("id") DEFERRABLE INITIALLY IMMEDIATE;

-- Preserve case-insensitive identity semantics independently from database collation.
CREATE UNIQUE INDEX ux_users_username_ci ON users (lower(username));
CREATE UNIQUE INDEX ux_users_email_ci ON users (lower(email)) WHERE email IS NOT NULL;
