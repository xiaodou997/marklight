use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::Emitter;

pub fn setup_menu(app: &tauri::AppHandle) -> Result<(), String> {
    let handle = app;

    // 应用菜单 (MarkLight)
    let app_menu = Submenu::with_items(
        handle,
        "MarkLight",
        true,
        &[
            &MenuItem::with_id(handle, "about", "关于 MarkLight", true, None::<&str>)?,
            &PredefinedMenuItem::separator(handle)?,
            &MenuItem::with_id(handle, "settings", "设置...", true, Some("CmdOrCtrl+,"))?,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::services(handle, Some("服务"))?,
            &PredefinedMenuItem::separator(handle)?,
            &MenuItem::with_id(handle, "hide", "隐藏 MarkLight", true, Some("CmdOrCtrl+H"))?,
            &MenuItem::with_id(handle, "hide_others", "隐藏其他", true, Some("CmdOrCtrl+Alt+H"))?,
            &MenuItem::with_id(handle, "show_all", "显示全部", true, None::<&str>)?,
            &PredefinedMenuItem::separator(handle)?,
            &MenuItem::with_id(handle, "quit", "退出 MarkLight", true, Some("CmdOrCtrl+Q"))?,
        ],
    )?;

    // 文件菜单
    let file_menu = Submenu::with_items(
        handle,
        "文件",
        true,
        &[
            &MenuItem::with_id(handle, "new", "新建", true, Some("CmdOrCtrl+N"))?,
            &MenuItem::with_id(handle, "new_window", "新建窗口", true, Some("CmdOrCtrl+Alt+N"))?,
            &MenuItem::with_id(handle, "open", "打开...", true, Some("CmdOrCtrl+O"))?,
            &MenuItem::with_id(handle, "open_folder", "打开文件夹...", true, None::<&str>)?,
            &PredefinedMenuItem::separator(handle)?,
            &MenuItem::with_id(handle, "save", "保存", true, Some("CmdOrCtrl+S"))?,
            &MenuItem::with_id(handle, "save_as", "另存为...", true, Some("CmdOrCtrl+Shift+S"))?,
            &PredefinedMenuItem::separator(handle)?,
            &MenuItem::with_id(handle, "export_html", "导出为 HTML", true, None::<&str>)?,
            &MenuItem::with_id(handle, "export_pdf", "导出为 PDF...", true, Some("CmdOrCtrl+Shift+P"))?,
            &MenuItem::with_id(handle, "export_wechat", "微信导出", true, Some("CmdOrCtrl+E"))?,
        ],
    )?;

    // 编辑菜单
    let edit_menu = Submenu::with_items(
        handle,
        "编辑",
        true,
        &[
            &PredefinedMenuItem::undo(handle, Some("撤销"))?,
            &PredefinedMenuItem::redo(handle, Some("重做"))?,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::cut(handle, Some("剪切"))?,
            &PredefinedMenuItem::copy(handle, Some("复制"))?,
            &PredefinedMenuItem::paste(handle, Some("粘贴"))?,
            &PredefinedMenuItem::select_all(handle, Some("全选"))?,
            &PredefinedMenuItem::separator(handle)?,
            &MenuItem::with_id(handle, "find", "查找", true, Some("CmdOrCtrl+F"))?,
            &MenuItem::with_id(handle, "replace", "替换", true, Some("CmdOrCtrl+H"))?,
            &PredefinedMenuItem::separator(handle)?,
            &MenuItem::with_id(handle, "command_palette", "命令面板", true, Some("CmdOrCtrl+K"))?,
        ],
    )?;

    // 视图菜单
    let view_menu = Submenu::with_items(
        handle,
        "视图",
        true,
        &[
            &CheckMenuItem::with_id(handle, "toggle_sidebar", "侧边栏", true, true, Some("CmdOrCtrl+\\"))?,
            &MenuItem::with_id(handle, "sidebar_outline", "  └ 大纲", true, Some("CmdOrCtrl+1"))?,
            &MenuItem::with_id(handle, "sidebar_files", "  └ 文件树", true, Some("CmdOrCtrl+2"))?,
            &PredefinedMenuItem::separator(handle)?,
            &CheckMenuItem::with_id(handle, "toggle_source", "源码模式", true, false, Some("CmdOrCtrl+/"))?,
            &MenuItem::with_id(handle, "focus_mode", "焦点模式", true, Some("CmdOrCtrl+Shift+F"))?,
            &PredefinedMenuItem::separator(handle)?,
            &MenuItem::with_id(handle, "fullscreen", "全屏", true, Some("CmdOrCtrl+Ctrl+F"))?,
        ],
    )?;

    // 帮助菜单
    let help_menu = Submenu::with_items(
        handle,
        "帮助",
        true,
        &[
            &MenuItem::with_id(handle, "shortcuts", "快捷键", true, Some("CmdOrCtrl+K CmdOrCtrl+S"))?,
            &PredefinedMenuItem::separator(handle)?,
            &MenuItem::with_id(handle, "github", "项目主页 (GitHub)", true, None::<&str>)?,
            &MenuItem::with_id(handle, "gitee", "项目主页 (Gitee)", true, None::<&str>)?,
            &MenuItem::with_id(handle, "issues", "报告问题", true, None::<&str>)?,
            &PredefinedMenuItem::separator(handle)?,
            &MenuItem::with_id(handle, "check_updates", "检查更新...", true, None::<&str>)?,
        ],
    )?;

    let menu = Menu::with_items(handle, &[&app_menu, &file_menu, &edit_menu, &view_menu, &help_menu])?;
    app.set_menu(menu)?;

    app.on_menu_event(move |app, event| match event.id().as_ref() {
        "shortcuts" => {
            let _ = app.emit("menu-event", "shortcuts");
        }
        "github" => {
            let _ = app.emit("menu-event", "github");
        }
        "gitee" => {
            let _ = app.emit("menu-event", "gitee");
        }
        "issues" => {
            let _ = app.emit("menu-event", "issues");
        }
        "check_updates" => {
            let _ = app.emit("menu-event", "check_updates");
        }
        "about" => {
            let _ = app.emit("menu-event", "about");
        }
        "settings" => {
            let _ = app.emit("menu-event", "settings");
        }
        "quit" => {
            let _ = app.emit("menu-event", "quit");
        }
        "new" => {
            let _ = app.emit("menu-event", "new");
        }
        "new_window" => {
            let _ = app.emit("menu-event", "new_window");
        }
        "open" => {
            let _ = app.emit("menu-event", "open");
        }
        "open_folder" => {
            let _ = app.emit("menu-event", "open_folder");
        }
        "save" => {
            let _ = app.emit("menu-event", "save");
        }
        "save_as" => {
            let _ = app.emit("menu-event", "save_as");
        }
        "export_html" => {
            let _ = app.emit("menu-event", "export_html");
        }
        "export_pdf" => {
            let _ = app.emit("menu-event", "export_pdf");
        }
        "export_wechat" => {
            let _ = app.emit("menu-event", "export_wechat");
        }
        "undo" => {
            let _ = app.emit("menu-event", "undo");
        }
        "redo" => {
            let _ = app.emit("menu-event", "redo");
        }
        "cut" => {
            let _ = app.emit("menu-event", "cut");
        }
        "copy" => {
            let _ = app.emit("menu-event", "copy");
        }
        "paste" => {
            let _ = app.emit("menu-event", "paste");
        }
        "select_all" => {
            let _ = app.emit("menu-event", "select_all");
        }
        "find" => {
            let _ = app.emit("menu-event", "find");
        }
        "replace" => {
            let _ = app.emit("menu-event", "replace");
        }
        "toggle_sidebar" => {
            let _ = app.emit("menu-event", "toggle_sidebar");
        }
        "sidebar_outline" => {
            let _ = app.emit("menu-event", "sidebar_outline");
        }
        "sidebar_files" => {
            let _ = app.emit("menu-event", "sidebar_files");
        }
        "toggle_source" => {
            let _ = app.emit("menu-event", "toggle_source");
        }
        "focus_mode" => {
            let _ = app.emit("menu-event", "focus_mode");
        }
        "fullscreen" => {
            let _ = app.emit("menu-event", "fullscreen");
        }
        _ => {}
    });

    Ok(())
}
