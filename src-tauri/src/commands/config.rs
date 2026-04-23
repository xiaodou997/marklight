use std::fs;
use std::io::Write;
use std::time::SystemTime;
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

    atomic_write(&config_path, content.as_bytes())
        .map_err(|e| format!("写入配置文件失败: {}", e))?;

    Ok(())
}

fn atomic_write(path: &std::path::Path, content: &[u8]) -> Result<(), String> {
    let parent = path.parent().ok_or("无法获取配置目录")?;
    if !parent.exists() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let millis = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0);
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("settings.json");
    let temp_path = path.with_file_name(format!(".{}.{}.tmp", file_name, millis));

    {
        let mut file = fs::File::create(&temp_path).map_err(|e| e.to_string())?;
        file.write_all(content).map_err(|e| e.to_string())?;
        file.sync_all().map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "windows")]
    if path.exists() {
        fs::remove_file(path).map_err(|e| e.to_string())?;
    }

    fs::rename(temp_path, path).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::atomic_write;
    use std::fs;
    use std::path::PathBuf;
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::time::{SystemTime, UNIX_EPOCH};

    static TEST_COUNTER: AtomicU64 = AtomicU64::new(1);

    fn test_dir() -> PathBuf {
        let millis = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_millis())
            .unwrap_or(0);
        let seq = TEST_COUNTER.fetch_add(1, Ordering::Relaxed);
        let dir = std::env::temp_dir().join(format!("marklight-config-test-{}-{}", millis, seq));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn atomic_write_replaces_existing_config_content() {
        let dir = test_dir();
        let file = dir.join("settings.json");

        atomic_write(&file, br#"{"theme":"light"}"#).unwrap();
        atomic_write(&file, br#"{"theme":"dark"}"#).unwrap();

        let saved = fs::read_to_string(&file).unwrap();
        assert_eq!(saved, r#"{"theme":"dark"}"#);

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn atomic_write_creates_parent_directory() {
        let dir = test_dir();
        let nested = dir.join("nested").join("settings.json");

        atomic_write(&nested, br#"{"autoSave":true}"#).unwrap();

        let saved = fs::read_to_string(&nested).unwrap();
        assert_eq!(saved, r#"{"autoSave":true}"#);

        let _ = fs::remove_dir_all(dir);
    }
}
