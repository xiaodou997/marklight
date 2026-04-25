use crate::error::AppError;
use base64::{engine::general_purpose, Engine as _};
use std::sync::OnceLock;

const MAX_REMOTE_IMAGE_BYTES: usize = 10 * 1024 * 1024;
static IMAGE_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

fn image_client() -> Result<reqwest::Client, AppError> {
    if let Some(client) = IMAGE_CLIENT.get() {
        return Ok(client.clone());
    }

    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|error| AppError::Network(format!("创建客户端失败: {}", error)))?;

    let _ = IMAGE_CLIENT.set(client);
    IMAGE_CLIENT
        .get()
        .cloned()
        .ok_or_else(|| AppError::Network("图片客户端初始化失败".to_string()))
}

/// 异步获取网络图片并返回 base64 数据 URL
#[tauri::command]
pub async fn fetch_remote_image(url: String) -> Result<String, AppError> {
    println!("[fetch_image] Fetching: {}", url);

    let client = image_client()?;
    let mut response = client
        .get(&url)
        .header("Referer", &url)
        .header(
            "Accept",
            "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        )
        .send()
        .await
        .map_err(|error| AppError::Network(format!("请求失败: {}", error)))?;

    let status = response.status();
    if !status.is_success() {
        return Err(AppError::Network(format!("HTTP 错误: {}", status)));
    }

    if let Some(content_length) = response.content_length() {
        if content_length > MAX_REMOTE_IMAGE_BYTES as u64 {
            return Err(AppError::Network(format!(
                "图片过大: {} bytes，最大支持 {} bytes",
                content_length, MAX_REMOTE_IMAGE_BYTES
            )));
        }
    }

    let content_type = response
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("image/png")
        .to_string();

    let mut bytes = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|error| AppError::Network(format!("读取响应失败: {}", error)))?
    {
        if bytes.len() + chunk.len() > MAX_REMOTE_IMAGE_BYTES {
            return Err(AppError::Network(format!(
                "图片过大: 超过 {} bytes",
                MAX_REMOTE_IMAGE_BYTES
            )));
        }
        bytes.extend_from_slice(&chunk);
    }

    // 转换为 base64 data URL
    let base64_data = general_purpose::STANDARD.encode(&bytes);
    let data_url = format!("data:{};base64,{}", content_type, base64_data);

    println!("[fetch_image] Success! Size: {} bytes", bytes.len());
    Ok(data_url)
}
