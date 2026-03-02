mod printer;
mod system_print;

use printer::{list_printers, print_escpos, test_printer, open_cash_drawer, PrinterInfo, PrintResult};
use system_print::print_to_system_printer;

#[tauri::command]
fn get_printers() -> Result<Vec<PrinterInfo>, String> {
    list_printers()
}

#[tauri::command]
fn print_escpos_cmd(data: Vec<u8>) -> Result<PrintResult, String> {
    print_escpos(data)
}

#[tauri::command]
fn test_printer_cmd() -> Result<PrintResult, String> {
    test_printer()
}

#[tauri::command]
fn open_cash_drawer_cmd() -> Result<PrintResult, String> {
    open_cash_drawer()
}

#[tauri::command]
fn print_text_silent(text: String) -> Result<PrintResult, String> {
    print_to_system_printer(&text)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_sql::Builder::default()
            .add_migrations("sqlite:orders.db", vec![
                tauri_plugin_sql::Migration {
                    version: 1,
                    description: "Create order queue tables",
                    sql: "CREATE TABLE IF NOT EXISTS order_queue (
                        id TEXT PRIMARY KEY,
                        order_data TEXT NOT NULL,
                        status TEXT NOT NULL DEFAULT 'pending',
                        attempts INTEGER NOT NULL DEFAULT 0,
                        last_attempt INTEGER,
                        created_at INTEGER NOT NULL,
                        synced_at INTEGER,
                        error_message TEXT
                    );
                    CREATE INDEX IF NOT EXISTS idx_order_queue_status ON order_queue(status);
                    CREATE INDEX IF NOT EXISTS idx_order_queue_created ON order_queue(created_at);",
                    kind: tauri_plugin_sql::MigrationKind::Up,
                },
                tauri_plugin_sql::Migration {
                    version: 2,
                    description: "Create special order queue table",
                    sql: "CREATE TABLE IF NOT EXISTS special_order_queue (
                        id TEXT PRIMARY KEY,
                        order_data TEXT NOT NULL,
                        status TEXT NOT NULL DEFAULT 'pending',
                        attempts INTEGER NOT NULL DEFAULT 0,
                        last_attempt INTEGER,
                        created_at INTEGER NOT NULL,
                        synced_at INTEGER,
                        error_message TEXT
                    );
                    CREATE INDEX IF NOT EXISTS idx_special_order_queue_status ON special_order_queue(status);",
                    kind: tauri_plugin_sql::MigrationKind::Up,
                },
            ])
            .build())
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
        .invoke_handler(tauri::generate_handler![
            get_printers,
            print_escpos_cmd,
            test_printer_cmd,
            open_cash_drawer_cmd,
            print_text_silent
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
