-- ==============================================================================
-- LibrePM — baseline MySQL (profilo cloud, sezione bandi di Angeli del Futuro)
--
-- Generata da Hibernate dalle entity JPA con dialetto MySQL 8 e verificata su
-- MySQL 8.0: 94 tabelle. Rappresenta l'intero schema usato
-- dall'applicazione nel profilo `cloud`.
--
-- Le migrazioni in classpath:db/migration restano quelle SQLite del desktop e
-- non si applicano qui. Ogni modifica futura allo schema cloud va aggiunta come
-- nuova migrazione V2, V3, ... in questa cartella: questo file non si rigenera.
--
-- I tipi riflettono le entity, non i tipi nativi di MySQL. LibrePM nasce su
-- SQLite e tiene identificativi, date e orari come stringhe: cambiarli qui
-- spezzerebbe la corrispondenza con le entity e il build desktop.
--
-- Modifiche fatte a mano dopo la generazione:
--
--   * `users.clerk_user_id` — il ponte fra l'identità Clerk e l'utente interno.
--     Nel profilo cloud l'autenticazione la fa Clerk, che conosce la persona con
--     il claim `sub` del JWT; LibrePM la conosce con la riga in `users`, che è la
--     proprietaria dei progetti. Senza questo legame non si può rispondere alla
--     domanda su cui si regge ogni autorizzazione: «i progetti di chi sta
--     chiamando quali sono?». È univoco ma nullable, perché gli utenti creati dal
--     desktop non hanno un corrispettivo Clerk; l'indice impedisce che due righe
--     finiscano legate alla stessa identità. La gemella per SQLite è
--     db/migration/V63__clerk_user_link.sql.
--   * Il vincolo di unicità su quella colonna è stato rinominato da
--     `UK57vrrk8f99m307cjtiyqcprhw` a `ux_users_clerk_user_id`: Hibernate genera
--     un hash, e un nome illeggibile in un messaggio d'errore costa tempo. Il
--     nome degli indici non è verificato da `ddl-auto=validate`, quindi la
--     corrispondenza con le entity resta intatta.
-- ==============================================================================

-- Le tabelle arrivano in ordine alfabetico e le chiavi esterne fanno
-- riferimento anche a tabelle definite più in basso.
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE `actual_cost_records` (
  `amount` double DEFAULT NULL,
  `budget_line_id` varchar(255) NOT NULL,
  `cost_date` varchar(255) NOT NULL,
  `created_at` varchar(255) DEFAULT NULL,
  `currency` varchar(255) DEFAULT NULL,
  `description` varchar(255) NOT NULL,
  `evidence_asset_id` varchar(255) DEFAULT NULL,
  `id` varchar(255) NOT NULL,
  `recorded_by` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `app_preferences` (
  `key` varchar(100) NOT NULL,
  `value` varchar(500) NOT NULL,
  `updated_at` varchar(255) NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `approval_requests` (
  `approver_id` varchar(36) NOT NULL,
  `entity_id` varchar(36) NOT NULL,
  `id` varchar(36) NOT NULL,
  `project_id` varchar(36) DEFAULT NULL,
  `requested_by` varchar(36) NOT NULL,
  `entity_type` varchar(64) NOT NULL,
  `comment` text,
  `created_at` varchar(255) NOT NULL,
  `deleted_at` varchar(255) DEFAULT NULL,
  `last_synced_at` varchar(255) DEFAULT NULL,
  `requested_at` varchar(255) DEFAULT NULL,
  `resolved_at` varchar(255) DEFAULT NULL,
  `updated_at` varchar(255) NOT NULL,
  `status` enum('APPROVED','PENDING','REJECTED','WITHDRAWN') NOT NULL,
  `sync_status` enum('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED') DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FK17n9buj32k7a73mda3ldf0hb` (`approver_id`),
  KEY `FK1hpi518c4adapwvv02rgijqwk` (`project_id`),
  KEY `FK5po777y579fbsn91cyyxiy3rt` (`requested_by`),
  CONSTRAINT `FK17n9buj32k7a73mda3ldf0hb` FOREIGN KEY (`approver_id`) REFERENCES `users` (`id`),
  CONSTRAINT `FK1hpi518c4adapwvv02rgijqwk` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `FK5po777y579fbsn91cyyxiy3rt` FOREIGN KEY (`requested_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `asset_links` (
  `asset_id` varchar(36) NOT NULL,
  `id` varchar(36) NOT NULL,
  `linked_entity_id` varchar(36) NOT NULL,
  `linked_entity_type` varchar(64) NOT NULL,
  `created_at` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FK1oxbevwfi6sgamx0lp3kiylfc` (`asset_id`),
  CONSTRAINT `FK1oxbevwfi6sgamx0lp3kiylfc` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `asset_versions` (
  `version_number` int NOT NULL,
  `file_size` bigint DEFAULT NULL,
  `asset_id` varchar(36) NOT NULL,
  `id` varchar(36) NOT NULL,
  `uploaded_by` varchar(36) DEFAULT NULL,
  `checksum` varchar(128) DEFAULT NULL,
  `file_path` varchar(512) NOT NULL,
  `comment` text,
  `uploaded_at` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FKeojhm0n81wc17ek4day820x35` (`asset_id`),
  KEY `FKpehq6b3bt9c6qc5p36emy5cdj` (`uploaded_by`),
  CONSTRAINT `FKeojhm0n81wc17ek4day820x35` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`),
  CONSTRAINT `FKpehq6b3bt9c6qc5p36emy5cdj` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `assets` (
  `size_bytes` bigint NOT NULL,
  `id` varchar(36) NOT NULL,
  `owner_id` varchar(36) NOT NULL,
  `task_id` varchar(36) DEFAULT NULL,
  `checksum` varchar(64) DEFAULT NULL,
  `mime_type` varchar(100) DEFAULT NULL,
  `cloud_url` varchar(500) DEFAULT NULL,
  `description` varchar(500) DEFAULT NULL,
  `file_name` varchar(500) NOT NULL,
  `file_path` varchar(768) NOT NULL,
  `thumbnail_path` varchar(1000) DEFAULT NULL,
  `created_at` varchar(255) NOT NULL,
  `deleted_at` varchar(255) DEFAULT NULL,
  `last_accessed_at` varchar(255) DEFAULT NULL,
  `last_synced_at` varchar(255) DEFAULT NULL,
  `updated_at` varchar(255) NOT NULL,
  `sync_status` enum('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED') DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UKihvp53lkel78qrol6ci3dup78` (`file_path`),
  KEY `idx_asset_owner` (`owner_id`),
  KEY `idx_asset_created` (`created_at`),
  KEY `idx_asset_type` (`mime_type`),
  KEY `FK43q62w7ma6pqi2yynfa52bx98` (`task_id`),
  CONSTRAINT `FK43q62w7ma6pqi2yynfa52bx98` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`),
  CONSTRAINT `FKecqhtybnkgvj8x5xo6jnkydct` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `assignments` (
  `estimated_effort` int DEFAULT NULL,
  `id` varchar(36) NOT NULL,
  `role_id` varchar(36) DEFAULT NULL,
  `task_id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `assigned_at` varchar(255) NOT NULL,
  `created_at` varchar(255) NOT NULL,
  `deleted_at` varchar(255) DEFAULT NULL,
  `last_synced_at` varchar(255) DEFAULT NULL,
  `updated_at` varchar(255) NOT NULL,
  `sync_status` enum('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED') DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_assignment_task` (`task_id`),
  KEY `idx_assignment_user` (`user_id`),
  KEY `FKkyafu0ie5ap4y4pj7kwspqdi8` (`role_id`),
  CONSTRAINT `FK8iy60sfbpptmtm10f4al96qvq` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `FKedsmfsq5iq0j8a74fpkgleyn4` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`),
  CONSTRAINT `FKkyafu0ie5ap4y4pj7kwspqdi8` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `audit_events` (
  `entity_id` varchar(36) NOT NULL,
  `id` varchar(36) NOT NULL,
  `user_id` varchar(36) DEFAULT NULL,
  `entity_type` varchar(100) NOT NULL,
  `created_at` varchar(255) NOT NULL,
  `deleted_at` varchar(255) DEFAULT NULL,
  `details` text,
  `event_timestamp` varchar(255) NOT NULL,
  `last_synced_at` varchar(255) DEFAULT NULL,
  `updated_at` varchar(255) NOT NULL,
  `action` enum('APPROVAL_GRANTED','APPROVAL_REJECTED','APPROVAL_REQUESTED','ARCHIVED','BASELINE_CREATED','CONFLICT_DETECTED','CONFLICT_RESOLVED','CREATED','DELETED','EXPORTED','IMPORTED','LOGIN','MERGED','PASSWORD_MIGRATED','PLAN_RECALCULATED','RESTORED','STATUS_CHANGED','SYNCED','UPDATED') NOT NULL,
  `sync_status` enum('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED') DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_audit_entity` (`entity_type`,`entity_id`),
  KEY `idx_audit_user` (`user_id`),
  KEY `idx_audit_ts` (`event_timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `baseline_task_snapshots` (
  `estimated_effort` int DEFAULT NULL,
  `baseline_id` varchar(36) NOT NULL,
  `id` varchar(36) NOT NULL,
  `task_id` varchar(36) NOT NULL,
  `created_at` varchar(255) NOT NULL,
  `deleted_at` varchar(255) DEFAULT NULL,
  `last_synced_at` varchar(255) DEFAULT NULL,
  `planned_finish` varchar(255) DEFAULT NULL,
  `planned_start` varchar(255) DEFAULT NULL,
  `updated_at` varchar(255) NOT NULL,
  `sync_status` enum('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED') DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_snapshot_baseline` (`baseline_id`),
  KEY `idx_snapshot_task` (`task_id`),
  CONSTRAINT `FKfvdvkkemmrdw5fs970b17jy1g` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`),
  CONSTRAINT `FKgjn6jl9ehrg84a6vlvts0995f` FOREIGN KEY (`baseline_id`) REFERENCES `baselines` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `baselines` (
  `is_frozen` bit(1) DEFAULT NULL,
  `id` varchar(36) NOT NULL,
  `project_id` varchar(36) NOT NULL,
  `budget_snapshot` text,
  `created_at` varchar(255) NOT NULL,
  `deleted_at` varchar(255) DEFAULT NULL,
  `deliverable_snapshot` text,
  `last_synced_at` varchar(255) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `snapshot_date` varchar(255) NOT NULL,
  `updated_at` varchar(255) NOT NULL,
  `sync_status` enum('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED') DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_baseline_project` (`project_id`),
  CONSTRAINT `FKaw009di7fvl2uk4nb43qsb1jr` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `branch_modifications` (
  `branch_id` varchar(255) DEFAULT NULL,
  `entity_id` varchar(255) DEFAULT NULL,
  `entity_type` varchar(255) DEFAULT NULL,
  `id` varchar(255) NOT NULL,
  `modification_type` varchar(255) DEFAULT NULL,
  `modified_at` varchar(255) DEFAULT NULL,
  `new_value_json` text,
  `old_value_json` text,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `budget_lines` (
  `actual_amount` double DEFAULT NULL,
  `committed_amount` double DEFAULT NULL,
  `forecast_amount` double DEFAULT NULL,
  `planned_amount` double DEFAULT NULL,
  `reserved_amount` double DEFAULT NULL,
  `sort_order` int DEFAULT NULL,
  `budget_id` varchar(255) NOT NULL,
  `category` varchar(255) NOT NULL,
  `currency` varchar(255) DEFAULT NULL,
  `deliverable_id` varchar(255) DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL,
  `id` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `phase_id` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `calendar_exceptions` (
  `is_working_day` bit(1) NOT NULL,
  `calendar_id` varchar(36) NOT NULL,
  `id` varchar(36) NOT NULL,
  `created_at` varchar(255) NOT NULL,
  `deleted_at` varchar(255) DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL,
  `exception_date` varchar(255) NOT NULL,
  `last_synced_at` varchar(255) DEFAULT NULL,
  `updated_at` varchar(255) NOT NULL,
  `sync_status` enum('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED') DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_exception_calendar` (`calendar_id`),
  KEY `idx_exception_date` (`exception_date`),
  CONSTRAINT `FK8m00l058x3m5yev1nxinyef44` FOREIGN KEY (`calendar_id`) REFERENCES `work_calendars` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `calendar_feed_tokens` (
  `id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `token` varchar(64) NOT NULL,
  `description` varchar(100) DEFAULT NULL,
  `included_entity_types` varchar(200) DEFAULT NULL,
  `created_at` varchar(255) NOT NULL,
  `deleted_at` varchar(255) DEFAULT NULL,
  `last_accessed_at` varchar(255) DEFAULT NULL,
  `last_synced_at` varchar(255) DEFAULT NULL,
  `updated_at` varchar(255) NOT NULL,
  `sync_status` enum('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED') DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UKl5enblvvkpeacjhd2x9owxxcp` (`user_id`),
  UNIQUE KEY `UKojp9ltu0j5qmubltv1nxfmq57` (`token`),
  KEY `idx_cft_user` (`user_id`),
  KEY `idx_cft_token` (`token`),
  CONSTRAINT `FK38c77murtsaoilpn49i0i95so` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `call_requirements` (
  `is_met` bit(1) DEFAULT NULL,
  `sort_order` int DEFAULT NULL,
  `call_id` varchar(255) DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL,
  `evidence_note` varchar(255) DEFAULT NULL,
  `id` varchar(255) NOT NULL,
  `requirement_type` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `capacity_profiles` (
  `hours_per_day` double DEFAULT NULL,
  `calendar_id` varchar(36) DEFAULT NULL,
  `id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `effective_from` varchar(255) NOT NULL,
  `effective_to` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FKf3a5ysgbu1hsmodfwwilxva0y` (`calendar_id`),
  KEY `FK7k17sr93il15cxdvckegspoo3` (`user_id`),
  CONSTRAINT `FK7k17sr93il15cxdvckegspoo3` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `FKf3a5ysgbu1hsmodfwwilxva0y` FOREIGN KEY (`calendar_id`) REFERENCES `work_calendars` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `change_requests` (
  `approved_by` varchar(255) DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL,
  `expected_impact` varchar(255) DEFAULT NULL,
  `id` varchar(255) NOT NULL,
  `motivation` varchar(255) DEFAULT NULL,
  `priority` varchar(255) DEFAULT NULL,
  `project_id` varchar(255) DEFAULT NULL,
  `requested_at` varchar(255) DEFAULT NULL,
  `requested_by` varchar(255) DEFAULT NULL,
  `resolved_at` varchar(255) DEFAULT NULL,
  `scope` varchar(255) DEFAULT NULL,
  `status` varchar(255) DEFAULT NULL,
  `title` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `compliance_profiles` (
  `is_system` bit(1) DEFAULT NULL,
  `description` text,
  `id` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `settings_json` text,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `conflict_records` (
  `resolved` bit(1) NOT NULL,
  `resolution` varchar(20) DEFAULT NULL,
  `policy_used` varchar(30) DEFAULT NULL,
  `entity_id` varchar(36) NOT NULL,
  `id` varchar(36) NOT NULL,
  `resolved_by` varchar(36) DEFAULT NULL,
  `entity_type` varchar(100) NOT NULL,
  `field_name` varchar(200) DEFAULT NULL,
  `created_at` varchar(255) NOT NULL,
  `deleted_at` varchar(255) DEFAULT NULL,
  `detected_at` varchar(255) NOT NULL,
  `last_synced_at` varchar(255) DEFAULT NULL,
  `local_state` text,
  `remote_state` text,
  `resolved_at` varchar(255) DEFAULT NULL,
  `updated_at` varchar(255) NOT NULL,
  `sync_status` enum('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED') DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_conflict_entity` (`entity_type`,`entity_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `currency_rates` (
  `rate` double DEFAULT NULL,
  `created_at` varchar(255) DEFAULT NULL,
  `effective_date` varchar(255) NOT NULL,
  `from_currency` varchar(255) NOT NULL,
  `id` varchar(255) NOT NULL,
  `source` varchar(255) DEFAULT NULL,
  `to_currency` varchar(255) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `data_categories` (
  `default_retention_days` int DEFAULT NULL,
  `description` text,
  `id` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `processing_purposes` text,
  `sensitivity_level` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `decision_log` (
  `branch_id` varchar(255) DEFAULT NULL,
  `change_request_id` varchar(255) DEFAULT NULL,
  `decided_at` varchar(255) DEFAULT NULL,
  `decided_by` varchar(255) DEFAULT NULL,
  `decision` text,
  `id` varchar(255) NOT NULL,
  `impact_summary` text,
  `project_id` varchar(255) DEFAULT NULL,
  `rationale` text,
  `title` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `deliverables` (
  `progress` int NOT NULL,
  `id` varchar(36) NOT NULL,
  `project_id` varchar(36) NOT NULL,
  `description` varchar(1000) DEFAULT NULL,
  `completed_at` varchar(255) DEFAULT NULL,
  `created_at` varchar(255) NOT NULL,
  `deleted_at` varchar(255) DEFAULT NULL,
  `due_date` varchar(255) DEFAULT NULL,
  `last_synced_at` varchar(255) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `updated_at` varchar(255) NOT NULL,
  `risk_status` enum('AT_RISK','BLOCKED','OK') DEFAULT NULL,
  `sync_status` enum('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED') DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_deliverable_project` (`project_id`),
  CONSTRAINT `FKcwoiqr4ahk3emorindc94a0eu` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `dependencies` (
  `lag` int DEFAULT NULL,
  `lead` int DEFAULT NULL,
  `id` varchar(36) NOT NULL,
  `predecessor_id` varchar(36) NOT NULL,
  `successor_id` varchar(36) NOT NULL,
  `created_at` varchar(255) NOT NULL,
  `deleted_at` varchar(255) DEFAULT NULL,
  `last_synced_at` varchar(255) DEFAULT NULL,
  `updated_at` varchar(255) NOT NULL,
  `sync_status` enum('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED') DEFAULT NULL,
  `type` enum('FINISH_TO_FINISH','FINISH_TO_START','START_TO_FINISH','START_TO_START') NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_dependency_predecessor` (`predecessor_id`),
  KEY `idx_dependency_successor` (`successor_id`),
  CONSTRAINT `FKontm3a90n9vb3t0xx9usj8psh` FOREIGN KEY (`predecessor_id`) REFERENCES `tasks` (`id`),
  CONSTRAINT `FKq69bbfjnl20go773qthbmte0j` FOREIGN KEY (`successor_id`) REFERENCES `tasks` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `donations` (
  `amount` double DEFAULT NULL,
  `is_restricted` bit(1) DEFAULT NULL,
  `created_at` varchar(255) DEFAULT NULL,
  `currency` varchar(255) DEFAULT NULL,
  `donation_date` varchar(255) DEFAULT NULL,
  `donor_id` varchar(255) DEFAULT NULL,
  `id` varchar(255) NOT NULL,
  `notes` varchar(255) DEFAULT NULL,
  `project_id` varchar(255) DEFAULT NULL,
  `receipt_asset_id` varchar(255) DEFAULT NULL,
  `restriction_description` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `donors` (
  `created_at` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `id` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `notes` varchar(255) DEFAULT NULL,
  `organization` varchar(255) DEFAULT NULL,
  `phone` varchar(255) DEFAULT NULL,
  `type` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `dsr_requests` (
  `completed_at` varchar(255) DEFAULT NULL,
  `description` text,
  `id` varchar(255) NOT NULL,
  `request_type` varchar(255) DEFAULT NULL,
  `requested_at` varchar(255) DEFAULT NULL,
  `result_notes` text,
  `status` varchar(255) DEFAULT NULL,
  `user_id` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `effort_estimates` (
  `estimated_minutes` int NOT NULL,
  `revision_number` int DEFAULT NULL,
  `estimator_id` varchar(36) DEFAULT NULL,
  `id` varchar(36) NOT NULL,
  `previous_estimate_id` varchar(36) DEFAULT NULL,
  `task_id` varchar(36) NOT NULL,
  `rationale` varchar(500) DEFAULT NULL,
  `created_at` varchar(255) NOT NULL,
  `deleted_at` varchar(255) DEFAULT NULL,
  `estimation_date` varchar(255) NOT NULL,
  `last_synced_at` varchar(255) DEFAULT NULL,
  `updated_at` varchar(255) NOT NULL,
  `sync_status` enum('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED') DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_estimate_task` (`task_id`),
  KEY `idx_estimate_date` (`estimation_date`),
  KEY `FKkbeyvw5hpf68nuawh3oeo5r78` (`estimator_id`),
  CONSTRAINT `FKb27dok6rt7995yf09b5mx910t` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`),
  CONSTRAINT `FKkbeyvw5hpf68nuawh3oeo5r78` FOREIGN KEY (`estimator_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `event_journal` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `entity_id` varchar(36) DEFAULT NULL,
  `user_id` varchar(36) DEFAULT NULL,
  `entity_type` varchar(64) DEFAULT NULL,
  `event_type` varchar(64) NOT NULL,
  `payload` text,
  `timestamp` varchar(255) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `evidence_pack_items` (
  `item_order` int DEFAULT NULL,
  `asset_id` varchar(36) DEFAULT NULL,
  `id` varchar(36) NOT NULL,
  `note_id` varchar(36) DEFAULT NULL,
  `pack_id` varchar(36) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FKj0o4g7oi78a29i240hs8f2dq` (`asset_id`),
  KEY `FK136r9sk7j67tpxrba4uo3ungv` (`note_id`),
  KEY `FKmg2vyk1n29bc4qrlyv9tbc90j` (`pack_id`),
  CONSTRAINT `FK136r9sk7j67tpxrba4uo3ungv` FOREIGN KEY (`note_id`) REFERENCES `notes` (`id`),
  CONSTRAINT `FKj0o4g7oi78a29i240hs8f2dq` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`),
  CONSTRAINT `FKmg2vyk1n29bc4qrlyv9tbc90j` FOREIGN KEY (`pack_id`) REFERENCES `evidence_packs` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `evidence_packs` (
  `created_by` varchar(36) DEFAULT NULL,
  `id` varchar(36) NOT NULL,
  `project_id` varchar(36) DEFAULT NULL,
  `created_at` varchar(255) DEFAULT NULL,
  `deleted_at` varchar(255) DEFAULT NULL,
  `description` text,
  `finalized_at` varchar(255) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `pack_type` enum('AUDIT','REPORT','SPONSOR_REVIEW','SUBMISSION') DEFAULT NULL,
  `status` enum('DRAFT','EXPORTED','FINALIZED') DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FKo4wnqg58q2drao3r66obmdkv7` (`created_by`),
  KEY `FK4t8gqyynt33na80c0rilvxgd1` (`project_id`),
  CONSTRAINT `FK4t8gqyynt33na80c0rilvxgd1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `FKo4wnqg58q2drao3r66obmdkv7` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `external_contributors` (
  `created_by` varchar(36) DEFAULT NULL,
  `id` varchar(36) NOT NULL,
  `role_id` varchar(36) DEFAULT NULL,
  `scope_entity_id` varchar(36) DEFAULT NULL,
  `access_token_hash` varchar(128) DEFAULT NULL,
  `display_name` varchar(128) NOT NULL,
  `access_expires_at` varchar(255) DEFAULT NULL,
  `created_at` varchar(255) NOT NULL,
  `deleted_at` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `last_synced_at` varchar(255) DEFAULT NULL,
  `organization` varchar(255) DEFAULT NULL,
  `updated_at` varchar(255) NOT NULL,
  `scope` enum('DELIVERABLE','PROJECT','REVIEW') NOT NULL,
  `sync_status` enum('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED') DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FKfmv1vw93ivctcm59f1oxk579c` (`created_by`),
  KEY `FK76i3ydknrumwoyt0379aw2fyi` (`role_id`),
  CONSTRAINT `FK76i3ydknrumwoyt0379aw2fyi` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`),
  CONSTRAINT `FKfmv1vw93ivctcm59f1oxk579c` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `financial_baselines` (
  `budget_id` varchar(255) NOT NULL,
  `created_at` varchar(255) DEFAULT NULL,
  `created_by` varchar(255) DEFAULT NULL,
  `id` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `snapshot_json` text NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `focus_sessions` (
  `duration_ms` bigint NOT NULL,
  `sync_status` varchar(20) DEFAULT NULL,
  `id` varchar(36) NOT NULL,
  `task_id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `session_type` varchar(50) DEFAULT NULL,
  `notes` varchar(1000) DEFAULT NULL,
  `created_at` varchar(255) NOT NULL,
  `ended_at` varchar(255) DEFAULT NULL,
  `last_synced_at` varchar(255) DEFAULT NULL,
  `started_at` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_focus_task` (`task_id`),
  KEY `idx_focus_user` (`user_id`),
  KEY `idx_focus_started` (`started_at`),
  KEY `idx_focus_ended` (`ended_at`),
  CONSTRAINT `FKcjt1qit8ck1qmkfpjiocf322d` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `FKrotfj11uou8tcka4c6o838ux` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `fund_allocations` (
  `allocated_amount` double DEFAULT NULL,
  `allocation_date` varchar(255) DEFAULT NULL,
  `budget_line_id` varchar(255) NOT NULL,
  `funding_source_id` varchar(255) NOT NULL,
  `id` varchar(255) NOT NULL,
  `notes` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `funding_sources` (
  `is_restricted` bit(1) DEFAULT NULL,
  `total_amount` double DEFAULT NULL,
  `contact_email` varchar(255) DEFAULT NULL,
  `contact_name` varchar(255) DEFAULT NULL,
  `created_at` varchar(255) DEFAULT NULL,
  `currency` varchar(255) DEFAULT NULL,
  `id` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `project_id` varchar(255) NOT NULL,
  `restriction_description` varchar(255) DEFAULT NULL,
  `status` varchar(255) DEFAULT NULL,
  `type` varchar(255) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `grant_calls` (
  `budget_available` double DEFAULT NULL,
  `created_at` varchar(255) DEFAULT NULL,
  `currency` varchar(255) DEFAULT NULL,
  `deadline` varchar(255) DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL,
  `id` varchar(255) NOT NULL,
  `issuer` varchar(255) DEFAULT NULL,
  `notes` varchar(255) DEFAULT NULL,
  `project_id` varchar(255) DEFAULT NULL,
  `reference_code` varchar(255) DEFAULT NULL,
  `status` varchar(255) DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `updated_at` varchar(255) DEFAULT NULL,
  `url` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `import_export_jobs` (
  `record_count` int DEFAULT NULL,
  `id` varchar(36) NOT NULL,
  `project_id` varchar(36) DEFAULT NULL,
  `user_id` varchar(36) NOT NULL,
  `completed_at` varchar(255) DEFAULT NULL,
  `created_at` varchar(255) NOT NULL,
  `deleted_at` varchar(255) DEFAULT NULL,
  `error_message` text,
  `last_synced_at` varchar(255) DEFAULT NULL,
  `result_payload` text,
  `updated_at` varchar(255) NOT NULL,
  `job_type` enum('EXPORT_CHARTER_JSON','EXPORT_CSV','EXPORT_ICS_SNAPSHOT','EXPORT_JSON','IMPORT_CSV_TASKS') NOT NULL,
  `status` enum('COMPLETED','FAILED','PENDING','PROCESSING') NOT NULL,
  `sync_status` enum('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED') DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_job_user` (`user_id`),
  KEY `idx_job_project` (`project_id`),
  KEY `idx_job_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `import_mapping_profiles` (
  `created_by` varchar(36) DEFAULT NULL,
  `id` varchar(36) NOT NULL,
  `entity_type` varchar(64) NOT NULL,
  `name` varchar(128) NOT NULL,
  `created_at` varchar(255) DEFAULT NULL,
  `mapping_json` text NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `leave_records` (
  `hours` double DEFAULT NULL,
  `id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `description` text,
  `leave_date` varchar(255) NOT NULL,
  `leave_type` enum('PERSONAL','SICK','TRAINING','VACATION') DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UKkyqrkmtamyct8n6jfdjlm0jr1` (`user_id`,`leave_date`),
  CONSTRAINT `FKseov39eh0ahtvh2c0yrkatiqi` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `merge_policies` (
  `auto_resolvable` bit(1) NOT NULL,
  `id` varchar(36) NOT NULL,
  `entity_type` varchar(100) NOT NULL,
  `field_scope` varchar(500) DEFAULT NULL,
  `created_at` varchar(255) NOT NULL,
  `deleted_at` varchar(255) DEFAULT NULL,
  `description` text,
  `last_synced_at` varchar(255) DEFAULT NULL,
  `updated_at` varchar(255) NOT NULL,
  `policy` enum('APPEND_ONLY','GRAPH_MERGE','IMMUTABLE_SNAPSHOT','LAST_WRITE_WINS','LIST_MERGE','MANUAL','UNION') NOT NULL,
  `sync_status` enum('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED') DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK36drgshc11xaouv1kyh0mucb7` (`entity_type`),
  KEY `idx_mp_entity_type` (`entity_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `note_links` (
  `id` varchar(36) NOT NULL,
  `linked_entity_id` varchar(36) NOT NULL,
  `note_id` varchar(36) NOT NULL,
  `created_at` varchar(255) NOT NULL,
  `deleted_at` varchar(255) DEFAULT NULL,
  `last_synced_at` varchar(255) DEFAULT NULL,
  `updated_at` varchar(255) NOT NULL,
  `linked_entity_type` enum('DELIVERABLE','OKR','PROJECT','RISK','TASK','TEAM','USER') NOT NULL,
  `sync_status` enum('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED') DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_notelink_note` (`note_id`),
  KEY `idx_notelink_linked_entity` (`linked_entity_type`,`linked_entity_id`),
  CONSTRAINT `FKtoi7r918i28pjjnp2x7j4bvi7` FOREIGN KEY (`note_id`) REFERENCES `notes` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `note_revisions` (
  `revision_number` int NOT NULL,
  `author_id` varchar(36) DEFAULT NULL,
  `id` varchar(36) NOT NULL,
  `note_id` varchar(36) NOT NULL,
  `content` text,
  `created_at` varchar(255) DEFAULT NULL,
  `title` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_note_revisions` (`note_id`,`revision_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `note_tags` (
  `note_id` varchar(36) NOT NULL,
  `tag_id` varchar(36) NOT NULL,
  PRIMARY KEY (`note_id`,`tag_id`),
  KEY `FK8babdwu6uqiu4rdkeuy8dkna0` (`tag_id`),
  CONSTRAINT `FK8babdwu6uqiu4rdkeuy8dkna0` FOREIGN KEY (`tag_id`) REFERENCES `tags` (`id`),
  CONSTRAINT `FKb15yxop81senc5xs5tjrsy4k4` FOREIGN KEY (`note_id`) REFERENCES `notes` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `notes` (
  `is_evidence` bit(1) DEFAULT NULL,
  `is_frozen` bit(1) DEFAULT NULL,
  `version` bigint DEFAULT NULL,
  `id` varchar(36) NOT NULL,
  `owner_id` varchar(36) NOT NULL,
  `parent_id` varchar(36) DEFAULT NULL,
  `project_id` varchar(36) DEFAULT NULL,
  `title` varchar(200) DEFAULT NULL,
  `content` text,
  `created_at` varchar(255) NOT NULL,
  `deleted_at` varchar(255) DEFAULT NULL,
  `frozen_at` varchar(255) DEFAULT NULL,
  `last_synced_at` varchar(255) DEFAULT NULL,
  `restricted_roles` text,
  `updated_at` varchar(255) NOT NULL,
  `note_type` enum('AUDIT_NOTE','BRIEF','DECISION','GRANT_NOTE','MEETING_NOTE','MEMO','RATIONALE','RISK_NOTE','SPONSOR_NOTE') DEFAULT NULL,
  `parent_type` enum('PROJECT','TASK') DEFAULT NULL,
  `sync_status` enum('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED') DEFAULT NULL,
  `visibility` enum('ALL','PROJECT_MEMBERS','ROLE_RESTRICTED') DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_note_owner` (`owner_id`),
  KEY `idx_note_project_updated` (`project_id`,`updated_at`),
  KEY `idx_note_parent` (`parent_type`,`parent_id`),
  CONSTRAINT `FK5n5jgcd6tqt248r97q0yrt3xp` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `notification_preferences` (
  `enabled` bit(1) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `event_type` varchar(64) NOT NULL,
  `created_at` varchar(255) NOT NULL,
  `id` varchar(255) NOT NULL,
  `updated_at` varchar(255) NOT NULL,
  `channel` enum('DESKTOP','IN_APP') NOT NULL,
  `severity_threshold` enum('CRITICAL','INFO','WARNING') DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK3pop5qo1k8bvbsxxrhwvcopy5` (`user_id`,`event_type`,`channel`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `notifications` (
  `is_read` bit(1) NOT NULL,
  `recipient_id` varchar(36) NOT NULL,
  `sender_id` varchar(36) DEFAULT NULL,
  `created_at` varchar(255) NOT NULL,
  `id` varchar(255) NOT NULL,
  `message` varchar(255) NOT NULL,
  `reference_id` varchar(255) DEFAULT NULL,
  `reference_type` varchar(255) DEFAULT NULL,
  `type` enum('APPROVAL_REQUESTED','APPROVAL_RESOLVED','BUDGET_THRESHOLD','CONNECTION_ACCEPTED','CONNECTION_REQUEST','DEADLINE_APPROACHING','MENTION','NEW_NOTE','REVIEW_REQUESTED','TASK_ASSIGNED','TASK_STATUS_CHANGED') NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FKqqnsjxlwleyjbxlmm213jaj3f` (`recipient_id`),
  KEY `FK13vcnq3ukas06ho1yrbc5lrb5` (`sender_id`),
  CONSTRAINT `FK13vcnq3ukas06ho1yrbc5lrb5` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`),
  CONSTRAINT `FKqqnsjxlwleyjbxlmm213jaj3f` FOREIGN KEY (`recipient_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `obligation_records` (
  `created_at` varchar(255) DEFAULT NULL,
  `deadline` varchar(255) DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL,
  `id` varchar(255) NOT NULL,
  `linked_budget_line_id` varchar(255) DEFAULT NULL,
  `linked_deliverable_id` varchar(255) DEFAULT NULL,
  `notes` varchar(255) DEFAULT NULL,
  `project_id` varchar(255) DEFAULT NULL,
  `responsible_user_id` varchar(255) DEFAULT NULL,
  `status` varchar(255) DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `type` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `okrs` (
  `id` varchar(36) NOT NULL,
  `project_id` varchar(36) NOT NULL,
  `created_at` varchar(255) NOT NULL,
  `deleted_at` varchar(255) DEFAULT NULL,
  `last_synced_at` varchar(255) DEFAULT NULL,
  `objective` varchar(255) NOT NULL,
  `updated_at` varchar(255) NOT NULL,
  `sync_status` enum('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED') DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_okr_project` (`project_id`),
  CONSTRAINT `FKc5cqp1krrn6uvmqftnmqk8su4` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `partner_organisations` (
  `budget_share` double DEFAULT NULL,
  `contact_email` varchar(255) DEFAULT NULL,
  `contact_person` varchar(255) DEFAULT NULL,
  `country` varchar(255) DEFAULT NULL,
  `created_at` varchar(255) DEFAULT NULL,
  `id` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `notes` varchar(255) DEFAULT NULL,
  `project_id` varchar(255) DEFAULT NULL,
  `role_in_project` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `permission_policies` (
  `id` varchar(36) NOT NULL,
  `role_id` varchar(36) NOT NULL,
  `permission` varchar(100) NOT NULL,
  `created_at` varchar(255) NOT NULL,
  `deleted_at` varchar(255) DEFAULT NULL,
  `last_synced_at` varchar(255) DEFAULT NULL,
  `updated_at` varchar(255) NOT NULL,
  `sync_status` enum('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED') DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UKqupqxs7f9xwgc0qwcbhyy51tl` (`role_id`,`permission`),
  CONSTRAINT `FK9ouowq688u88wm5ivtb0iqokq` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `phases` (
  `sort_order` int DEFAULT NULL,
  `color` varchar(7) DEFAULT NULL,
  `id` varchar(36) NOT NULL,
  `project_id` varchar(36) NOT NULL,
  `actual_end` varchar(255) DEFAULT NULL,
  `actual_start` varchar(255) DEFAULT NULL,
  `created_at` varchar(255) DEFAULT NULL,
  `deleted_at` varchar(255) DEFAULT NULL,
  `description` text,
  `name` varchar(255) NOT NULL,
  `planned_end` varchar(255) DEFAULT NULL,
  `planned_start` varchar(255) DEFAULT NULL,
  `status` enum('COMPLETED','IN_PROGRESS','NOT_STARTED','ON_HOLD') DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FKp0vs31guyj5itugskrstnrm4y` (`project_id`),
  CONSTRAINT `FKp0vs31guyj5itugskrstnrm4y` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `programme_memberships` (
  `sort_order` int DEFAULT NULL,
  `id` varchar(255) NOT NULL,
  `programme_id` varchar(255) DEFAULT NULL,
  `project_id` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `programme_milestones` (
  `id` varchar(255) NOT NULL,
  `linked_project_id` varchar(255) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `programme_id` varchar(255) DEFAULT NULL,
  `status` varchar(255) DEFAULT NULL,
  `target_date` varchar(255) DEFAULT NULL,
  `description` text,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `programmes` (
  `created_at` varchar(255) DEFAULT NULL,
  `id` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `owner_id` varchar(255) DEFAULT NULL,
  `status` varchar(255) DEFAULT NULL,
  `description` text,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `project_branches` (
  `branch_type` varchar(255) DEFAULT NULL,
  `change_request_id` varchar(255) DEFAULT NULL,
  `created_at` varchar(255) DEFAULT NULL,
  `created_by` varchar(255) DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL,
  `id` varchar(255) NOT NULL,
  `merged_at` varchar(255) DEFAULT NULL,
  `name` varchar(255) DEFAULT NULL,
  `snapshot_json` text,
  `source_project_id` varchar(255) DEFAULT NULL,
  `status` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `project_budgets` (
  `total_amount` double DEFAULT NULL,
  `version` int DEFAULT NULL,
  `approved_at` varchar(255) DEFAULT NULL,
  `approved_by` varchar(255) DEFAULT NULL,
  `created_at` varchar(255) DEFAULT NULL,
  `currency` varchar(255) DEFAULT NULL,
  `id` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `previous_version_id` varchar(255) DEFAULT NULL,
  `project_id` varchar(255) DEFAULT NULL,
  `status` varchar(255) DEFAULT NULL,
  `updated_at` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `project_charters` (
  `id` varchar(36) NOT NULL,
  `project_id` varchar(36) NOT NULL,
  `business_case` text,
  `created_at` varchar(255) NOT NULL,
  `deleted_at` varchar(255) DEFAULT NULL,
  `last_synced_at` varchar(255) DEFAULT NULL,
  `objectives` text,
  `problem_statement` text,
  `project_manager` varchar(255) DEFAULT NULL,
  `sponsor` varchar(255) DEFAULT NULL,
  `updated_at` varchar(255) NOT NULL,
  `sync_status` enum('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED') DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UKbfi85f0k6lp141bubmp9was9s` (`project_id`),
  CONSTRAINT `FK67sad3dooqvhl0s4mhuaf7rho` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `project_members` (
  `system_role_id` varchar(36) DEFAULT NULL,
  `created_at` varchar(255) NOT NULL,
  `project_id` varchar(255) NOT NULL,
  `updated_at` varchar(255) NOT NULL,
  `user_id` varchar(255) NOT NULL,
  `role` enum('ADMIN','EDITOR','OWNER','VIEWER') NOT NULL,
  PRIMARY KEY (`project_id`,`user_id`),
  KEY `FKgul2el0qjk5lsvig3wgajwm77` (`user_id`),
  CONSTRAINT `FKdki1sp2homqsdcvqm9yrix31g` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `FKgul2el0qjk5lsvig3wgajwm77` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `project_templates` (
  `requires_planning_engine` bit(1) NOT NULL,
  `complexity_level` varchar(16) DEFAULT NULL,
  `version` varchar(20) NOT NULL,
  `id` varchar(36) NOT NULL,
  `previous_version_id` varchar(36) DEFAULT NULL,
  `category` varchar(50) DEFAULT NULL,
  `name` varchar(100) NOT NULL,
  `description` varchar(500) DEFAULT NULL,
  `capability_profile` text,
  `created_at` varchar(255) NOT NULL,
  `deleted_at` varchar(255) DEFAULT NULL,
  `last_synced_at` varchar(255) DEFAULT NULL,
  `prerequisites` text,
  `structure_json` text,
  `updated_at` varchar(255) NOT NULL,
  `use_cases` text,
  `sync_status` enum('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED') DEFAULT NULL,
  `template_scope` enum('SYSTEM','USER','WORKSPACE') NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UKj428ws7r0mvg06aclkkvg80is` (`name`),
  KEY `idx_template_scope` (`template_scope`),
  KEY `idx_template_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `projects` (
  `archived` bit(1) NOT NULL,
  `favorite` bit(1) NOT NULL,
  `finance_enabled` bit(1) NOT NULL,
  `grants_enabled` bit(1) NOT NULL,
  `overdue_count` int NOT NULL,
  `overdue_warning_threshold` int NOT NULL,
  `planning_enabled` bit(1) NOT NULL,
  `time_tracking_enabled` bit(1) NOT NULL,
  `color` varchar(7) DEFAULT NULL,
  `version` bigint DEFAULT NULL,
  `id` varchar(36) NOT NULL,
  `owner_id` varchar(36) NOT NULL,
  `team_id` varchar(36) DEFAULT NULL,
  `icon` varchar(50) DEFAULT NULL,
  `name` varchar(200) NOT NULL,
  `description` varchar(2000) DEFAULT NULL,
  `created_at` varchar(255) NOT NULL,
  `deleted_at` varchar(255) DEFAULT NULL,
  `last_synced_at` varchar(255) DEFAULT NULL,
  `updated_at` varchar(255) NOT NULL,
  `health_status` enum('CRITICAL','OK','WARNING') NOT NULL,
  `sync_status` enum('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED') DEFAULT NULL,
  `visibility` enum('PERSONAL','SHARED','TEAM') NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_project_owner` (`owner_id`),
  KEY `idx_project_team` (`team_id`),
  KEY `idx_project_archived` (`archived`),
  KEY `idx_project_created` (`created_at`),
  CONSTRAINT `FKmqih0928bq6r3gbuh47giq8w` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`),
  CONSTRAINT `FKmueqy6cpcwpfl8gnnag4idjt9` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `rate_cards` (
  `currency` varchar(3) DEFAULT NULL,
  `daily_rate` double DEFAULT NULL,
  `hourly_rate` double NOT NULL,
  `id` varchar(36) NOT NULL,
  `scope_entity_id` varchar(36) NOT NULL,
  `created_at` varchar(255) DEFAULT NULL,
  `effective_from` varchar(255) NOT NULL,
  `effective_to` varchar(255) DEFAULT NULL,
  `scope` enum('PROJECT','ROLE','USER') NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `remote_identities` (
  `deleted` bit(1) NOT NULL,
  `id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `bound_at` varchar(255) DEFAULT NULL,
  `created_at` varchar(255) NOT NULL,
  `deleted_at` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `last_synced_at` varchar(255) DEFAULT NULL,
  `provider_user_id` varchar(255) NOT NULL,
  `revoked_at` varchar(255) DEFAULT NULL,
  `updated_at` varchar(255) NOT NULL,
  `provider` enum('GENERIC_OIDC','GOOGLE','KEYCLOAK','MICROSOFT') NOT NULL,
  `sync_status` enum('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED') DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UKlxuo8kp93bgf7c6vb26oggk6f` (`provider`,`provider_user_id`),
  KEY `FK9fsq5857ltq9e3qefsjnd0ufl` (`user_id`),
  CONSTRAINT `FK9fsq5857ltq9e3qefsjnd0ufl` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `reporting_periods` (
  `due_date` varchar(255) DEFAULT NULL,
  `id` varchar(255) NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `notes` varchar(255) DEFAULT NULL,
  `period_end` varchar(255) DEFAULT NULL,
  `period_start` varchar(255) DEFAULT NULL,
  `project_id` varchar(255) DEFAULT NULL,
  `status` varchar(255) DEFAULT NULL,
  `submission_asset_id` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `resource_allocations` (
  `percentage` int NOT NULL,
  `id` varchar(36) NOT NULL,
  `project_id` varchar(36) DEFAULT NULL,
  `user_id` varchar(36) NOT NULL,
  `created_at` varchar(255) NOT NULL,
  `deleted_at` varchar(255) DEFAULT NULL,
  `end_date` varchar(255) NOT NULL,
  `last_synced_at` varchar(255) DEFAULT NULL,
  `start_date` varchar(255) NOT NULL,
  `updated_at` varchar(255) NOT NULL,
  `sync_status` enum('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED') DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_allocation_user` (`user_id`),
  KEY `idx_allocation_project` (`project_id`),
  KEY `idx_allocation_period` (`start_date`,`end_date`),
  CONSTRAINT `FK91tespeeicmqnkx1wn6gkimbo` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `FKlguxdf9dnj21jofewdbmqr0k0` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `retention_policies` (
  `is_active` bit(1) DEFAULT NULL,
  `retention_days` int DEFAULT NULL,
  `action_on_expiry` varchar(255) DEFAULT NULL,
  `data_category_id` varchar(255) DEFAULT NULL,
  `id` varchar(255) NOT NULL,
  `scope` varchar(255) DEFAULT NULL,
  `scope_entity_id` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `risk_register_entries` (
  `id` varchar(36) NOT NULL,
  `project_id` varchar(36) NOT NULL,
  `created_at` varchar(255) NOT NULL,
  `deleted_at` varchar(255) DEFAULT NULL,
  `description` varchar(255) NOT NULL,
  `last_synced_at` varchar(255) DEFAULT NULL,
  `mitigation_strategy` text,
  `updated_at` varchar(255) NOT NULL,
  `impact` enum('CRITICAL','HIGH','LOW','MEDIUM') NOT NULL,
  `probability` enum('CRITICAL','HIGH','LOW','MEDIUM') NOT NULL,
  `sync_status` enum('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED') DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_risk_project` (`project_id`),
  CONSTRAINT `FKa2urd9vs0lqej4x8sweg6usr7` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `roles` (
  `id` varchar(36) NOT NULL,
  `name` varchar(50) NOT NULL,
  `created_at` varchar(255) NOT NULL,
  `deleted_at` varchar(255) DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL,
  `last_synced_at` varchar(255) DEFAULT NULL,
  `updated_at` varchar(255) NOT NULL,
  `sync_status` enum('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED') DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UKofx66keruapi6vyqpv6f2or37` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `saved_views` (
  `is_default` bit(1) NOT NULL,
  `is_shared` bit(1) NOT NULL,
  `id` varchar(36) NOT NULL,
  `project_id` varchar(36) DEFAULT NULL,
  `user_id` varchar(36) NOT NULL,
  `name` varchar(128) NOT NULL,
  `columns_json` text,
  `created_at` varchar(255) NOT NULL,
  `deleted_at` varchar(255) DEFAULT NULL,
  `description` text,
  `filters_json` text,
  `grouping_json` text,
  `last_synced_at` varchar(255) DEFAULT NULL,
  `sort_json` text,
  `updated_at` varchar(255) NOT NULL,
  `sync_status` enum('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED') DEFAULT NULL,
  `view_type` enum('BOARD','CALENDAR','GANTT','LIST','WORKLOAD') NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_saved_views_user` (`user_id`),
  KEY `idx_saved_views_project` (`project_id`),
  KEY `idx_saved_views_type` (`view_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `sponsor_commitments` (
  `committed_amount` double DEFAULT NULL,
  `agreement_asset_id` varchar(255) DEFAULT NULL,
  `agreement_date` varchar(255) DEFAULT NULL,
  `currency` varchar(255) DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL,
  `id` varchar(255) NOT NULL,
  `project_id` varchar(255) DEFAULT NULL,
  `sponsor_id` varchar(255) DEFAULT NULL,
  `status` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `sponsors` (
  `contact_person` varchar(255) DEFAULT NULL,
  `created_at` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `id` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `notes` varchar(255) DEFAULT NULL,
  `organization` varchar(255) DEFAULT NULL,
  `type` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `stakeholders` (
  `channel` varchar(255) DEFAULT NULL,
  `created_at` varchar(255) DEFAULT NULL,
  `engagement_strategy` varchar(255) DEFAULT NULL,
  `id` varchar(255) NOT NULL,
  `influence_level` varchar(255) DEFAULT NULL,
  `interest_level` varchar(255) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `notes` varchar(255) DEFAULT NULL,
  `organization` varchar(255) DEFAULT NULL,
  `project_id` varchar(255) DEFAULT NULL,
  `role_description` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `status_reviews` (
  `id` varchar(36) NOT NULL,
  `project_id` varchar(36) NOT NULL,
  `reviewer_id` varchar(36) NOT NULL,
  `achievements` text,
  `blockers` text,
  `created_at` varchar(255) DEFAULT NULL,
  `next_actions` text,
  `review_date` varchar(255) NOT NULL,
  `summary` text,
  `budget_status` enum('GREEN','RED','YELLOW') DEFAULT NULL,
  `overall_status` enum('GREEN','RED','YELLOW') NOT NULL,
  `risk_status` enum('GREEN','RED','YELLOW') DEFAULT NULL,
  `schedule_status` enum('GREEN','RED','YELLOW') DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FKksxq1vspt0um4h1mwitx3bowd` (`project_id`),
  KEY `FKfd3w78574l74o9un9km3lfo21` (`reviewer_id`),
  CONSTRAINT `FKfd3w78574l74o9un9km3lfo21` FOREIGN KEY (`reviewer_id`) REFERENCES `users` (`id`),
  CONSTRAINT `FKksxq1vspt0um4h1mwitx3bowd` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `submission_packages` (
  `call_id` varchar(255) DEFAULT NULL,
  `created_at` varchar(255) DEFAULT NULL,
  `id` varchar(255) NOT NULL,
  `notes` varchar(255) DEFAULT NULL,
  `status` varchar(255) DEFAULT NULL,
  `submitted_at` varchar(255) DEFAULT NULL,
  `submitted_by` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `success_metrics` (
  `current_value` double NOT NULL,
  `target_value` double NOT NULL,
  `id` varchar(36) NOT NULL,
  `okr_id` varchar(36) NOT NULL,
  `unit` varchar(50) DEFAULT NULL,
  `created_at` varchar(255) NOT NULL,
  `deleted_at` varchar(255) DEFAULT NULL,
  `last_synced_at` varchar(255) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `updated_at` varchar(255) NOT NULL,
  `sync_status` enum('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED') DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_successmetric_okr` (`okr_id`),
  CONSTRAINT `FK7v6sp2vm7vplxma8tugie7jsa` FOREIGN KEY (`okr_id`) REFERENCES `okrs` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `tags` (
  `color` varchar(7) DEFAULT NULL,
  `id` varchar(36) NOT NULL,
  `owner_id` varchar(36) NOT NULL,
  `name` varchar(50) NOT NULL,
  `created_at` varchar(255) NOT NULL,
  `deleted_at` varchar(255) DEFAULT NULL,
  `last_synced_at` varchar(255) DEFAULT NULL,
  `updated_at` varchar(255) NOT NULL,
  `sync_status` enum('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED') DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UKt48xdq560gs3gap9g7jg36kgc` (`name`),
  KEY `idx_tag_name` (`name`),
  KEY `idx_tag_owner` (`owner_id`),
  CONSTRAINT `FKx0nceen1ii190w7et5r042qt` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `target_achieved_records` (
  `achieved_value` double NOT NULL,
  `id` varchar(36) NOT NULL,
  `metric_id` varchar(36) NOT NULL,
  `created_at` varchar(255) NOT NULL,
  `deleted_at` varchar(255) DEFAULT NULL,
  `last_synced_at` varchar(255) DEFAULT NULL,
  `note` varchar(255) DEFAULT NULL,
  `record_date` varchar(255) NOT NULL,
  `updated_at` varchar(255) NOT NULL,
  `sync_status` enum('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED') DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_targetrecord_metric` (`metric_id`),
  KEY `idx_targetrecord_date` (`record_date`),
  CONSTRAINT `FKtc699bw85g1ie32rql89kdtea` FOREIGN KEY (`metric_id`) REFERENCES `success_metrics` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `task_checklist_items` (
  `done` bit(1) NOT NULL,
  `sort_order` int NOT NULL,
  `id` varchar(36) NOT NULL,
  `task_id` varchar(36) NOT NULL,
  `text` varchar(1000) NOT NULL,
  `created_at` varchar(255) NOT NULL,
  `updated_at` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_checklist_item_task` (`task_id`),
  CONSTRAINT `FKdss8rgar5gq2b5vjnjbapn4cu` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `task_dependencies` (
  `blocked_task_id` varchar(36) NOT NULL,
  `blocker_task_id` varchar(36) NOT NULL,
  PRIMARY KEY (`blocked_task_id`,`blocker_task_id`),
  KEY `FKfunguagqo0rtn07bg91cvhtmt` (`blocker_task_id`),
  CONSTRAINT `FK5wj5oe4ht9t44ksdhnnfykf0t` FOREIGN KEY (`blocked_task_id`) REFERENCES `tasks` (`id`),
  CONSTRAINT `FKfunguagqo0rtn07bg91cvhtmt` FOREIGN KEY (`blocker_task_id`) REFERENCES `tasks` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `task_priorities` (
  `level` int NOT NULL,
  `color` varchar(7) DEFAULT NULL,
  `id` varchar(36) NOT NULL,
  `name` varchar(50) NOT NULL,
  `created_at` varchar(255) NOT NULL,
  `deleted_at` varchar(255) DEFAULT NULL,
  `last_synced_at` varchar(255) DEFAULT NULL,
  `updated_at` varchar(255) NOT NULL,
  `sync_status` enum('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED') DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UKpr39i0fxyhh18hgobprwpbmhm` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `task_status_history` (
  `changed_by` varchar(36) DEFAULT NULL,
  `id` varchar(36) NOT NULL,
  `task_id` varchar(36) NOT NULL,
  `new_status` varchar(64) NOT NULL,
  `old_status` varchar(64) DEFAULT NULL,
  `changed_at` varchar(255) NOT NULL,
  `comment` text,
  PRIMARY KEY (`id`),
  KEY `idx_task_status_history` (`task_id`,`changed_at`),
  KEY `idx_task_status_history_user` (`changed_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `task_statuses` (
  `color` varchar(7) DEFAULT NULL,
  `id` varchar(36) NOT NULL,
  `name` varchar(50) NOT NULL,
  `created_at` varchar(255) NOT NULL,
  `deleted_at` varchar(255) DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL,
  `last_synced_at` varchar(255) DEFAULT NULL,
  `updated_at` varchar(255) NOT NULL,
  `category` enum('ARCHIVED','BLOCKED','DONE','IN_PROGRESS','TODO') NOT NULL,
  `sync_status` enum('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED') DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UKdhogqjhrcydo4g6hpr4yue0u` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `task_tags` (
  `tag_id` varchar(36) NOT NULL,
  `task_id` varchar(36) NOT NULL,
  PRIMARY KEY (`tag_id`,`task_id`),
  KEY `FK7xi1reghkj37gqwlr1ujxrxll` (`task_id`),
  CONSTRAINT `FK7xi1reghkj37gqwlr1ujxrxll` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`),
  CONSTRAINT `FKeiqe3k9ent7icelm1cihqn164` FOREIGN KEY (`tag_id`) REFERENCES `tags` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `tasks` (
  `actual_effort` int NOT NULL,
  `actual_effort_hours` double DEFAULT NULL,
  `archived` bit(1) NOT NULL,
  `estimated_effort` int DEFAULT NULL,
  `estimated_effort_hours` double DEFAULT NULL,
  `finance_enabled` bit(1) NOT NULL,
  `inbox` bit(1) NOT NULL,
  `is_critical` bit(1) DEFAULT NULL,
  `notification_sent` bit(1) NOT NULL,
  `planning_enabled` bit(1) NOT NULL,
  `reminder_enabled` bit(1) NOT NULL,
  `sort_order` int NOT NULL,
  `total_float` int DEFAULT NULL,
  `asset_size_bytes` bigint DEFAULT NULL,
  `version` bigint DEFAULT NULL,
  `constraint_type` varchar(32) DEFAULT NULL,
  `assigned_to_id` varchar(36) DEFAULT NULL,
  `deliverable_id` varchar(36) DEFAULT NULL,
  `id` varchar(36) NOT NULL,
  `parent_task_id` varchar(36) DEFAULT NULL,
  `phase_id` varchar(36) DEFAULT NULL,
  `priority_id` varchar(36) DEFAULT NULL,
  `project_id` varchar(36) NOT NULL,
  `stakeholder_id` varchar(36) DEFAULT NULL,
  `status_id` varchar(36) DEFAULT NULL,
  `asset_mime_type` varchar(50) DEFAULT NULL,
  `asset_file_name` varchar(100) DEFAULT NULL,
  `owner` varchar(200) DEFAULT NULL,
  `asset_path` varchar(500) DEFAULT NULL,
  `title` varchar(500) NOT NULL,
  `notes` varchar(2000) DEFAULT NULL,
  `description` varchar(5000) DEFAULT NULL,
  `actual_end` varchar(255) DEFAULT NULL,
  `actual_start` varchar(255) DEFAULT NULL,
  `constraint_date` varchar(255) DEFAULT NULL,
  `created_at` varchar(255) NOT NULL,
  `deadline` varchar(255) DEFAULT NULL,
  `deleted_at` varchar(255) DEFAULT NULL,
  `early_finish` varchar(255) DEFAULT NULL,
  `early_start` varchar(255) DEFAULT NULL,
  `funding_context` text,
  `last_synced_at` varchar(255) DEFAULT NULL,
  `late_finish` varchar(255) DEFAULT NULL,
  `late_start` varchar(255) DEFAULT NULL,
  `markdown_notes` text,
  `planned_finish` varchar(255) DEFAULT NULL,
  `planned_start` varchar(255) DEFAULT NULL,
  `reminder_date` varchar(255) DEFAULT NULL,
  `updated_at` varchar(255) NOT NULL,
  `duration_unit` enum('DAYS','HOURS','MINUTES','MONTHS','WEEKS') DEFAULT NULL,
  `sync_status` enum('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED') DEFAULT NULL,
  `type` enum('APPOINTMENT','CALL','DEADLINE','DELIVERABLE_TASK','FINANCE_TASK','MEETING','MILESTONE','REMINDER','REVIEW_TASK','SUMMARY_TASK','TASK','TASK_BLOCK') NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_task_project` (`project_id`),
  KEY `idx_task_assigned` (`assigned_to_id`),
  KEY `idx_task_status` (`status_id`),
  KEY `idx_task_priority` (`priority_id`),
  KEY `idx_task_deadline` (`deadline`),
  KEY `idx_task_created` (`created_at`),
  KEY `idx_task_parent` (`parent_task_id`),
  CONSTRAINT `FK4516wfa828r15k9u3iw5er4vi` FOREIGN KEY (`assigned_to_id`) REFERENCES `users` (`id`),
  CONSTRAINT `FK76tiq4q248au3u79a8nkexoth` FOREIGN KEY (`parent_task_id`) REFERENCES `tasks` (`id`),
  CONSTRAINT `FK9or72b0xffyc2ynghmn48hel3` FOREIGN KEY (`priority_id`) REFERENCES `task_priorities` (`id`),
  CONSTRAINT `FKa0dcdc9qxbpoes4a1p4i0f9y3` FOREIGN KEY (`status_id`) REFERENCES `task_statuses` (`id`),
  CONSTRAINT `FKsfhn82y57i3k9uxww1s007acc` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `team_members` (
  `created_at` varchar(255) NOT NULL,
  `team_id` varchar(255) NOT NULL,
  `updated_at` varchar(255) NOT NULL,
  `user_id` varchar(255) NOT NULL,
  `role` enum('TEAM_ADMIN','TEAM_MEMBER','TEAM_OWNER') NOT NULL,
  PRIMARY KEY (`team_id`,`user_id`),
  KEY `FKee8x7x5026imwmma9kndkxs36` (`user_id`),
  CONSTRAINT `FKee8x7x5026imwmma9kndkxs36` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `FKtgca08el3ofisywcf11f0f76t` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `teams` (
  `id` varchar(36) NOT NULL,
  `owner_id` varchar(36) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` varchar(500) DEFAULT NULL,
  `created_at` varchar(255) NOT NULL,
  `updated_at` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_team_owner` (`owner_id`),
  CONSTRAINT `FKde03in0noals71lom04bmfgit` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `time_entries` (
  `duration_minutes` int NOT NULL,
  `id` varchar(36) NOT NULL,
  `task_id` varchar(36) NOT NULL,
  `user_id` varchar(36) DEFAULT NULL,
  `description` varchar(500) DEFAULT NULL,
  `created_at` varchar(255) NOT NULL,
  `deleted_at` varchar(255) DEFAULT NULL,
  `entry_date` varchar(255) NOT NULL,
  `last_synced_at` varchar(255) DEFAULT NULL,
  `updated_at` varchar(255) NOT NULL,
  `sync_status` enum('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED') DEFAULT NULL,
  `type` enum('MANUAL','TIMER') NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_timeentry_task` (`task_id`),
  KEY `idx_timeentry_user` (`user_id`),
  KEY `idx_timeentry_date` (`entry_date`),
  CONSTRAINT `FK5oy4d9re28blktipmwp24smmu` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `FKfohb8frbtyjjx7ebqujd0v9tq` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `user_connections` (
  `requester_id` varchar(36) NOT NULL,
  `target_id` varchar(36) NOT NULL,
  `created_at` varchar(255) NOT NULL,
  `id` varchar(255) NOT NULL,
  `updated_at` varchar(255) DEFAULT NULL,
  `status` enum('ACCEPTED','PENDING','REJECTED') NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UKd77f8kqaq6plktip02u56us08` (`requester_id`,`target_id`),
  KEY `FKfc2ojy6pxa9fgqu5d0uvnah83` (`target_id`),
  CONSTRAINT `FK87a2325ovm813njp71xwmk6yt` FOREIGN KEY (`requester_id`) REFERENCES `users` (`id`),
  CONSTRAINT `FKfc2ojy6pxa9fgqu5d0uvnah83` FOREIGN KEY (`target_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `user_settings` (
  `auto_backup_enabled` bit(1) NOT NULL,
  `daily_work_capacity_minutes` int NOT NULL,
  `focus_timer_default_minutes` int NOT NULL,
  `notifications_enabled` bit(1) NOT NULL,
  `language` varchar(10) NOT NULL,
  `theme` varchar(20) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `calendar_token` varchar(64) DEFAULT NULL,
  `created_at` varchar(255) NOT NULL,
  `last_backup_at` varchar(255) DEFAULT NULL,
  `updated_at` varchar(255) NOT NULL,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `FK8v82nj88rmai0nyck19f873dw` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `users` (
  `active` bit(1) NOT NULL,
  `is_ghost` bit(1) NOT NULL,
  `created_by_id` varchar(36) DEFAULT NULL,
  `id` varchar(36) NOT NULL,
  `workspace_profile_id` varchar(36) DEFAULT NULL,
  `username` varchar(50) NOT NULL,
  `display_name` varchar(100) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `avatar_path` varchar(255) DEFAULT NULL,
  `clerk_user_id` varchar(255) DEFAULT NULL,
  `created_at` varchar(255) NOT NULL,
  `deleted_at` varchar(255) DEFAULT NULL,
  `last_login_at` varchar(255) DEFAULT NULL,
  `last_synced_at` varchar(255) DEFAULT NULL,
  `password_hash` varchar(255) NOT NULL,
  `updated_at` varchar(255) NOT NULL,
  `sync_status` enum('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED') DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_username` (`username`),
  UNIQUE KEY `idx_email` (`email`),
  UNIQUE KEY `ux_users_clerk_user_id` (`clerk_user_id`),
  KEY `FK8nakkftyppd62ke6tv7oo5a92` (`created_by_id`),
  CONSTRAINT `FK8nakkftyppd62ke6tv7oo5a92` FOREIGN KEY (`created_by_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `wbs_nodes` (
  `sort_order` int NOT NULL,
  `id` varchar(36) NOT NULL,
  `parent_id` varchar(36) DEFAULT NULL,
  `project_id` varchar(36) NOT NULL,
  `task_id` varchar(36) DEFAULT NULL,
  `name` varchar(100) NOT NULL,
  `created_at` varchar(255) NOT NULL,
  `deleted_at` varchar(255) DEFAULT NULL,
  `last_synced_at` varchar(255) DEFAULT NULL,
  `updated_at` varchar(255) NOT NULL,
  `wbs_code` varchar(255) NOT NULL,
  `sync_status` enum('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED') DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK6rqfkbm4w5jtdxkkfoyugh9e` (`task_id`),
  KEY `idx_wbs_project` (`project_id`),
  KEY `idx_wbs_parent` (`parent_id`),
  CONSTRAINT `FKb1jtaaqduh7w5ry1i4jpou0te` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`),
  CONSTRAINT `FKhsvu3q7b8qpdvhrxgop5mfac` FOREIGN KEY (`parent_id`) REFERENCES `wbs_nodes` (`id`),
  CONSTRAINT `FKowtk9fj83ayo7yh9dlh2oe9m3` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `work_calendars` (
  `scope` varchar(32) DEFAULT NULL,
  `id` varchar(36) NOT NULL,
  `scope_entity_id` varchar(36) DEFAULT NULL,
  `name` varchar(100) NOT NULL,
  `created_at` varchar(255) NOT NULL,
  `deleted_at` varchar(255) DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL,
  `last_synced_at` varchar(255) DEFAULT NULL,
  `updated_at` varchar(255) NOT NULL,
  `sync_status` enum('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED') DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UKo3fvjph3vkrqe02dr910nkjkh` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `work_day_rules` (
  `is_working_day` bit(1) NOT NULL,
  `calendar_id` varchar(36) NOT NULL,
  `id` varchar(36) NOT NULL,
  `break_end_time` varchar(255) DEFAULT NULL,
  `break_start_time` varchar(255) DEFAULT NULL,
  `created_at` varchar(255) NOT NULL,
  `deleted_at` varchar(255) DEFAULT NULL,
  `end_time` varchar(255) DEFAULT NULL,
  `last_synced_at` varchar(255) DEFAULT NULL,
  `start_time` varchar(255) DEFAULT NULL,
  `updated_at` varchar(255) NOT NULL,
  `day_of_week` enum('FRIDAY','MONDAY','SATURDAY','SUNDAY','THURSDAY','TUESDAY','WEDNESDAY') NOT NULL,
  `sync_status` enum('CONFLICT','LOCAL_ONLY','PENDING_SYNC','SOFT_DELETED','SYNCED') DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UKehm55fppjsovygr4yp2j2m778` (`calendar_id`,`day_of_week`),
  CONSTRAINT `FK2x85xao54gv1b3u93sgns5lim` FOREIGN KEY (`calendar_id`) REFERENCES `work_calendars` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `workspace_profiles` (
  `is_system` bit(1) DEFAULT NULL,
  `id` varchar(36) NOT NULL,
  `name` varchar(64) NOT NULL,
  `created_at` varchar(255) DEFAULT NULL,
  `description` text,
  `modules_json` text NOT NULL,
  `nav_items_json` text,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

SET FOREIGN_KEY_CHECKS = 1;
