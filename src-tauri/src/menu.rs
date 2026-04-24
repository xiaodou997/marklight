use crate::events::emit_menu_event;
use std::collections::HashMap;
use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};

fn accelerator(
    shortcuts: &HashMap<String, String>,
    command_id: &str,
    default: Option<&str>,
) -> Option<String> {
    shortcuts
        .get(command_id)
        .cloned()
        .or_else(|| default.map(str::to_string))
}

fn build_menu(
    app: &tauri::AppHandle,
    shortcuts: &HashMap<String, String>,
) -> Result<Menu<tauri::Wry>, tauri::Error> {
    let about_accel = accelerator(shortcuts, "help.about", None);
    let settings_accel = accelerator(shortcuts, "settings.open", Some("CmdOrCtrl+,"));
    let quit_accel = accelerator(shortcuts, "app.quit", Some("CmdOrCtrl+Q"));

    let new_accel = accelerator(shortcuts, "file.new", Some("CmdOrCtrl+N"));
    let new_window_accel = accelerator(shortcuts, "file.newWindow", Some("CmdOrCtrl+Alt+N"));
    let open_accel = accelerator(shortcuts, "file.open", Some("CmdOrCtrl+O"));
    let save_accel = accelerator(shortcuts, "file.save", Some("CmdOrCtrl+S"));
    let save_as_accel = accelerator(shortcuts, "file.saveAs", Some("CmdOrCtrl+Shift+S"));
    let export_html_accel = accelerator(shortcuts, "export.html", None);
    let export_pdf_accel = accelerator(shortcuts, "export.pdf", Some("CmdOrCtrl+Shift+P"));
    let export_wechat_accel = accelerator(shortcuts, "export.wechat", Some("CmdOrCtrl+E"));

    let undo_accel = accelerator(shortcuts, "editor.undo", Some("CmdOrCtrl+Z"));
    let redo_accel = accelerator(shortcuts, "editor.redo", Some("CmdOrCtrl+Shift+Z"));
    let find_accel = accelerator(shortcuts, "edit.find", Some("CmdOrCtrl+F"));
    let replace_accel = accelerator(shortcuts, "edit.replace", Some("CmdOrCtrl+H"));
    let palette_accel = accelerator(shortcuts, "edit.commandPalette", Some("CmdOrCtrl+K"));

    let toggle_sidebar_accel = accelerator(shortcuts, "view.toggleSidebar", Some("CmdOrCtrl+\\"));
    let show_outline_accel = accelerator(shortcuts, "view.showOutline", Some("CmdOrCtrl+Alt+1"));
    let show_files_accel = accelerator(shortcuts, "view.showFiles", Some("CmdOrCtrl+Alt+2"));
    let toggle_source_accel = accelerator(shortcuts, "view.toggleSourceMode", Some("CmdOrCtrl+/"));
    let focus_mode_accel = accelerator(shortcuts, "view.focusMode", Some("CmdOrCtrl+Shift+F"));
    let fullscreen_accel = accelerator(shortcuts, "view.fullscreen", Some("CmdOrCtrl+Ctrl+F"));

    let shortcuts_accel = accelerator(shortcuts, "help.shortcuts", Some("CmdOrCtrl+Shift+K"));

    let app_menu = Submenu::with_items(
        app,
        "MarkLight",
        true,
        &[
            &MenuItem::with_id(
                app,
                "help.about",
                "关于 MarkLight",
                true,
                about_accel.as_deref(),
            )?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(
                app,
                "settings.open",
                "设置...",
                true,
                settings_accel.as_deref(),
            )?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::services(app, Some("服务"))?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "app.hide", "隐藏 MarkLight", true, Some("CmdOrCtrl+H"))?,
            &MenuItem::with_id(
                app,
                "app.hideOthers",
                "隐藏其他",
                true,
                Some("CmdOrCtrl+Alt+H"),
            )?,
            &MenuItem::with_id(app, "app.showAll", "显示全部", true, None::<&str>)?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(
                app,
                "app.quit",
                "退出 MarkLight",
                true,
                quit_accel.as_deref(),
            )?,
        ],
    )?;

    let file_menu = Submenu::with_items(
        app,
        "文件",
        true,
        &[
            &MenuItem::with_id(app, "file.new", "新建", true, new_accel.as_deref())?,
            &MenuItem::with_id(
                app,
                "file.newWindow",
                "新建窗口",
                true,
                new_window_accel.as_deref(),
            )?,
            &MenuItem::with_id(app, "file.open", "打开...", true, open_accel.as_deref())?,
            &MenuItem::with_id(app, "file.openFolder", "打开文件夹...", true, None::<&str>)?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "file.save", "保存", true, save_accel.as_deref())?,
            &MenuItem::with_id(
                app,
                "file.saveAs",
                "另存为...",
                true,
                save_as_accel.as_deref(),
            )?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(
                app,
                "export.html",
                "导出为 HTML",
                true,
                export_html_accel.as_deref(),
            )?,
            &MenuItem::with_id(
                app,
                "export.pdf",
                "导出为 PDF...",
                true,
                export_pdf_accel.as_deref(),
            )?,
            &MenuItem::with_id(
                app,
                "export.wechat",
                "微信导出",
                true,
                export_wechat_accel.as_deref(),
            )?,
        ],
    )?;

    let edit_menu = Submenu::with_items(
        app,
        "编辑",
        true,
        &[
            &MenuItem::with_id(app, "editor.undo", "撤销", true, undo_accel.as_deref())?,
            &MenuItem::with_id(app, "editor.redo", "重做", true, redo_accel.as_deref())?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::cut(app, Some("剪切"))?,
            &PredefinedMenuItem::copy(app, Some("复制"))?,
            &PredefinedMenuItem::paste(app, Some("粘贴"))?,
            &PredefinedMenuItem::select_all(app, Some("全选"))?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "edit.find", "查找", true, find_accel.as_deref())?,
            &MenuItem::with_id(app, "edit.replace", "替换", true, replace_accel.as_deref())?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(
                app,
                "edit.commandPalette",
                "命令面板",
                true,
                palette_accel.as_deref(),
            )?,
        ],
    )?;

    let view_menu = Submenu::with_items(
        app,
        "视图",
        true,
        &[
            &CheckMenuItem::with_id(
                app,
                "view.toggleSidebar",
                "侧边栏",
                true,
                true,
                toggle_sidebar_accel.as_deref(),
            )?,
            &MenuItem::with_id(
                app,
                "view.showOutline",
                "  └ 大纲",
                true,
                show_outline_accel.as_deref(),
            )?,
            &MenuItem::with_id(
                app,
                "view.showFiles",
                "  └ 文件树",
                true,
                show_files_accel.as_deref(),
            )?,
            &PredefinedMenuItem::separator(app)?,
            &CheckMenuItem::with_id(
                app,
                "view.toggleSourceMode",
                "源码模式",
                true,
                false,
                toggle_source_accel.as_deref(),
            )?,
            &MenuItem::with_id(
                app,
                "view.focusMode",
                "焦点模式",
                true,
                focus_mode_accel.as_deref(),
            )?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(
                app,
                "view.fullscreen",
                "全屏",
                true,
                fullscreen_accel.as_deref(),
            )?,
        ],
    )?;

    let help_menu = Submenu::with_items(
        app,
        "帮助",
        true,
        &[
            &MenuItem::with_id(
                app,
                "help.shortcuts",
                "快捷键",
                true,
                shortcuts_accel.as_deref(),
            )?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "help.github", "项目主页 (GitHub)", true, None::<&str>)?,
            &MenuItem::with_id(app, "help.gitee", "项目主页 (Gitee)", true, None::<&str>)?,
            &MenuItem::with_id(app, "help.issues", "报告问题", true, None::<&str>)?,
        ],
    )?;

    Menu::with_items(
        app,
        &[&app_menu, &file_menu, &edit_menu, &view_menu, &help_menu],
    )
}

pub fn setup_menu(
    app: &tauri::AppHandle,
    shortcuts: &HashMap<String, String>,
) -> Result<(), tauri::Error> {
    let menu = build_menu(app, shortcuts)?;
    app.set_menu(menu)?;
    Ok(())
}

pub fn attach_menu_events(app: &tauri::AppHandle) {
    app.on_menu_event(move |app, event| {
        let menu_id = event.id().as_ref().to_string();
        match menu_id {
            ref id if id == "app.hide" || id == "app.hideOthers" || id == "app.showAll" => {}
            _ => {
                emit_menu_event(app, menu_id);
            }
        }
    });
}
