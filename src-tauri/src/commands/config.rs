use std::fs;
use serde_json::Value;
use tauri::Manager;

/// 获取配置文件路径
fn get_config_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let config_dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("获取配置目录失败: {}", e))?;

    // 确保配置目录存在
    if !config_dir.exists() {
        fs::create_dir_all(&config_dir).map_err(|e| format!("创建配置目录失败: {}", e))?;
    }

    Ok(config_dir.join("settings.json"))
}

/// 读取配置文件
#[tauri::command]
pub fn read_config(app: tauri::AppHandle) -> Result<Value, String> {
    let config_path = get_config_path(&app)?;

    if !config_path.exists() {
        return Ok(serde_json::json!({}));
    }

    let content = fs::read_to_string(&config_path).map_err(|e| format!("读取配置文件失败: {}", e))?;

    let config: Value =
        serde_json::from_str(&content).map_err(|e| format!("解析配置文件失败: {}", e))?;

    Ok(config)
}

/// 写入配置文件
#[tauri::command]
pub fn write_config(app: tauri::AppHandle, config: Value) -> Result<(), String> {
    let config_path = get_config_path(&app)?;

    let content =
        serde_json::to_string_pretty(&config).map_err(|e| format!("序列化配置失败: {}", e))?;

    fs::write(&config_path, content).map_err(|e| format!("写入配置文件失败: {}", e))?;

    Ok(())
}
