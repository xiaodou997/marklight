mod commands;
mod error;
mod events;
mod menu;
mod models;
mod state;

use commands::*;
use events::emit_app_open_paths;
use models::{AppOpenPathsPayload, AppOpenSource};
use state::{LoadedWindows, StartupOpenRequests, WindowOpenRequests, WorkspaceWatcherState};
use std::collections::HashMap;
use tauri::Manager;
use tauri_plugin_window_state::StateFlags;

#[tauri::command]
fn consume_startup_open_request(
    state: tauri::State<'_, StartupOpenRequests>,
) -> Result<Option<AppOpenPathsPayload>, error::AppError> {
    state.take()
}

#[tauri::command]
fn refresh_native_menu_shortcuts(
    app: tauri::AppHandle,
    shortcuts: HashMap<String, String>,
) -> Result<(), error::AppError> {
    menu::setup_menu(&app, &shortcuts).map_err(error::AppError::from)
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_cli::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(
                    StateFlags::SIZE
                        | StateFlags::POSITION
                        | StateFlags::MAXIMIZED
                        | StateFlags::FULLSCREEN,
                )
                .map_label(|label| {
                    if label.starts_with("main-") {
                        "secondary"
                    } else {
                        label
                    }
                })
                .build(),
        )
        .on_page_load(|webview, payload| {
            use tauri::webview::PageLoadEvent;
            if payload.event() == PageLoadEvent::Finished {
                if let Some(state) = webview.app_handle().try_state::<LoadedWindows>() {
                    let _ = state.mark_loaded(webview.label().to_string());
                }
            }
        })
        .setup(|app| {
            app.manage(StartupOpenRequests::default());
            app.manage(WindowOpenRequests::default());
            app.manage(LoadedWindows::default());
            app.manage(WorkspaceWatcherState::new(&app.handle())?);

            {
                use tauri_plugin_cli::CliExt;
                if let Ok(matches) = app.cli().matches() {
                    if let Some(file_arg) = matches.args.get("file") {
                        if let Some(file_path) = file_arg.value.as_str() {
                            if let Some(state) = app.try_state::<StartupOpenRequests>() {
                                let _ = state.replace(AppOpenPathsPayload {
                                    paths: vec![file_path.to_string()],
                                    source: AppOpenSource::Cli,
                                });
                            }
                        }
                    }
                }
            }

            menu::setup_menu(&app.handle(), &HashMap::new()).map_err(error::AppError::from)?;
            menu::attach_menu_events(&app.handle());

            if let Some(main_window) = app.get_webview_window("main") {
                #[cfg(any(target_os = "windows", target_os = "linux"))]
                main_window
                    .set_decorations(false)
                    .map_err(error::AppError::from)?;

                #[cfg(target_os = "macos")]
                apply_macos_window_background(&main_window, "#ffffff")?;

                attach_close_interceptor(&main_window);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            open_document,
            save_document,
            list_workspace_entries,
            create_workspace_entry,
            rename_workspace_entry,
            trash_workspace_entry,
            watch_workspace,
            unwatch_workspace,
            import_document_image,
            resolve_document_image_path,
            fetch_remote_image,
            open_editor_window,
            consume_window_open_request,
            consume_startup_open_request,
            refresh_native_menu_shortcuts,
            print_document,
            reveal_in_finder,
            set_window_background_color
        ])
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app_handle, event| {
            #[cfg(any(target_os = "macos", target_os = "ios"))]
            if let tauri::RunEvent::Opened { urls } = &event {
                let paths = urls
                    .iter()
                    .filter_map(|url| url.to_file_path().ok())
                    .filter_map(|path| path.to_str().map(|value| value.to_string()))
                    .collect::<Vec<_>>();

                if !paths.is_empty() {
                    let has_loaded_window = app_handle
                        .try_state::<LoadedWindows>()
                        .and_then(|state| state.has_loaded_window().ok())
                        .unwrap_or(false);

                    if has_loaded_window {
                        emit_app_open_paths(
                            app_handle,
                            AppOpenPathsPayload {
                                paths,
                                source: AppOpenSource::OsOpen,
                            },
                        );
                    } else if let Some(state) = app_handle.try_state::<StartupOpenRequests>() {
                        let _ = state.replace(AppOpenPathsPayload {
                            paths,
                            source: AppOpenSource::Startup,
                        });
                    }
                }
            }
        });
}
