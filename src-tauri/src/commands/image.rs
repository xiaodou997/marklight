use base64::{engine::general_purpose, Engine as _};
use std::fs;
use std::path::Path;

/// 保存图片到指定目录的 assets 子目录中
#[tauri::command]
pub fn save_image(dir: String, filename: String, data: Vec<u8>) -> Result<String, String> {
    println!(
        "[save_image] dir={} filename={} bytes={}",
        dir,
        filename,
        data.len()
    );
    let assets_dir = Path::new(&dir).join("assets");
    if !assets_dir.exists() {
        fs::create_dir_all(&assets_dir).map_err(|e| format!("创建 assets 目录失败: {}", e))?;
    }
    let file_path = assets_dir.join(&filename);
    fs::write(&file_path, data).map_err(|e| format!("保存图片失败: {}", e))?;
    Ok(format!("assets/{}", filename))
}

/// 获取文件的绝对路径
#[tauri::command]
pub fn resolve_image_path(file_dir: String, relative_path: String) -> Result<String, String> {
    let absolute_path = Path::new(&file_dir).join(&relative_path);
    absolute_path
        .to_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "无法解析图片路径".to_string())
}

/// 异步获取网络图片并返回 base64 数据 URL
#[tauri::command]
pub async fn fetch_remote_image(url: String) -> Result<String, String> {
    println!("[fetch_image] Fetching: {}", url);

    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("创建客户端失败: {}", e))?;

    let response = client
        .get(&url)
        .header("Referer", &url)
        .header(
            "Accept",
            "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        )
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    let status = response.status();
    if !status.is_success() {
        return Err(format!("HTTP 错误: {}", status));
    }

    let content_type = response
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("image/png")
        .to_string();

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("读取响应失败: {}", e))?;

    // 转换为 base64 data URL
    let base64_data = general_purpose::STANDARD.encode(&bytes);
    let data_url = format!("data:{};base64,{}", content_type, base64_data);

    println!("[fetch_image] Success! Size: {} bytes", bytes.len());
    Ok(data_url)
}
