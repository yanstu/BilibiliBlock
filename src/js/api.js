/**
 * BilibiliBlock API模块
 * 处理所有与B站API交互的功能
 */

// 使用IIFE保护作用域
(function() {
  /**
   * 解析Cookie字符串为对象
   * @param {string} cookie Cookie字符串
   * @returns {Object} Cookie键值对对象
   */
  function parseCookie(cookie) {
    let ret = {};
    for (let line of cookie.split(";")) {
      let parts = line.split("=");
      if (parts.length >= 2) {
        let key = parts[0].trim();
        let value = parts.slice(1).join('=').trim();
        ret[key] = value;
      }
    }
    return ret;
  }
  
  /**
   * 发送B站POST请求
   * @param {string} url 请求URL
   * @param {Object} params 请求参数
   * @returns {Promise<Object>} 返回响应数据
   */
  async function biliPost(url, params) {
    // 获取CSRF令牌
    let cookieData = parseCookie(document.cookie);
    let csrf = cookieData["bili_jct"];
    
    if (!csrf) {
      throw new Error('未获取到CSRF令牌，请确保已登录B站');
    }
    
    // 构建参数字符串
    let keys = Object.keys(params).sort();
    let paramsStr = keys.map((key) => `${key}=${params[key]}`).join("&");
    let fullUrl = `${url}?${paramsStr}&csrf=${csrf}`;
    
    // 发送请求
    const response = await fetch(fullUrl, {
      "method": "POST", 
      "credentials": "include", 
      "mode": "cors"
    });
    
    // 解析响应
    const data = await response.json();
    
    // 检查响应结果
    if (data.code !== 0) {
      throw new Error(`拉黑失败: ${data.message || '未知错误'}`);
    }
    
    return data;
  }
  
  /**
   * 拉黑指定用户
   * @param {string} uid 要拉黑的用户ID
   * @returns {Promise<Object>} 返回API响应结果
   */
  async function blockUser(uid) {
    if (!uid) {
      throw new Error('无效的用户ID');
    }
    
    try {
      // 构建请求参数
      const params = {
        'fid': uid,
        'act': 5, // 5代表拉黑
        're_src': 11
      };
      
      // 发送拉黑请求
      return await biliPost("https://api.bilibili.com/x/relation/modify", params);
    } catch (error) {
      console.error('拉黑用户时出错:', error);
      throw error;
    }
  }
  
  /**
   * 批量拉黑用户
   * @param {Array<string>} uidList 要拉黑的用户ID列表
   * @param {number} interval 请求间隔时间（毫秒）
   * @param {Function} onProgress 进度回调函数
   * @returns {Promise<Array>} 返回所有拉黑操作的结果
   */
  async function batchBlockUsers(uidList, interval = 1000, onProgress = null) {
    const results = [];
    
    for (let i = 0; i < uidList.length; i++) {
      try {
        // 随机化请求间隔，避免被检测为机器行为
        const randomInterval = interval + Math.random() * 500;
        
        // 添加延迟
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, randomInterval));
        }
        
        const result = await blockUser(uidList[i]);
        results.push({ uid: uidList[i], success: true, data: result });
        
        // 回调进度
        if (onProgress) {
          onProgress(i + 1, uidList.length, { uid: uidList[i], success: true });
        }
      } catch (error) {
        results.push({ uid: uidList[i], success: false, error: error.message });
        
        // 回调进度
        if (onProgress) {
          onProgress(i + 1, uidList.length, { uid: uidList[i], success: false, error: error.message });
        }
      }
    }
    
    return results;
  }
  
  // 将API功能暴露给全局对象
  window.bilibiliBlockApi = {
    blockUser,
    batchBlockUsers
  };
})(); 