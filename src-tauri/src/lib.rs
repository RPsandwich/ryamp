use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![Migration {
        version: 1,
        description: "create_initial_tables",
        sql: "
            CREATE TABLE tracks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filepath TEXT NOT NULL UNIQUE,
                title TEXT,
                artist TEXT,
                album TEXT,
                duration REAL,
                track_number INTEGER,
                genre TEXT,
                art_path TEXT,
                date_added TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE playlists (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE playlist_tracks (
                playlist_id INTEGER NOT NULL,
                track_id INTEGER NOT NULL,
                position INTEGER NOT NULL,
                FOREIGN KEY (playlist_id) REFERENCES playlists(id),
                FOREIGN KEY (track_id) REFERENCES tracks(id)
            );
        ",
        kind: MigrationKind::Up,
    }, Migration {
        // Intentionally version 3, not 2 -- a different, incompatible
        // "version 2" migration (a `themes` table with a generic
        // light-mode color scheme) may already be recorded as applied
        // in some environments. Using 3 guarantees this one actually
        // runs regardless, rather than silently being skipped as
        // "already applied" if a version-2 record already exists.
        version: 3,
        description: "create_custom_themes_table",
        sql: "
            CREATE TABLE custom_themes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                accent_magenta TEXT NOT NULL,
                accent_cyan TEXT NOT NULL,
                accent_violet TEXT NOT NULL,
                border_violet TEXT NOT NULL,
                bg_void TEXT NOT NULL,
                bg_panel TEXT NOT NULL,
                bg_panel_raised TEXT NOT NULL,
                bg_screen TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
        ",
        kind: MigrationKind::Up,
    }];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:ryamp.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
