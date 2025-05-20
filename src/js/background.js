/**
 * BilibiliBlock 后台脚本
 * 管理扩展的生命周期和状态
 */

// 扩展安装或更新时的处理
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // 首次安装
    console.log('BilibiliBlock 扩展已安装');
    
    // 设置默认配置
    chrome.storage.local.set({
      'bilibiliBlock.enabled': true,
      'bilibiliBlock.autoHideBlocked': true,
      'bilibiliBlock.blockedUsers': []
    });
    
    // 打开欢迎页
    chrome.tabs.create({
      url: chrome.runtime.getURL('public/welcome.html')
    });
  } else if (details.reason === 'update') {
    // 扩展更新
    console.log(`BilibiliBlock 扩展已更新到 ${chrome.runtime.getManifest().version} 版本`);
  }
});

// 监听来自内容脚本的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'BLOCK_USER') {
    // 记录被拉黑的用户
    chrome.storage.local.get('bilibiliBlock.blockedUsers', (data) => {
      const blockedUsers = data['bilibiliBlock.blockedUsers'] || [];
      
      // 检查是否已经在黑名单中
      if (!blockedUsers.some(user => user.uid === message.uid)) {
        blockedUsers.push({
          uid: message.uid,
          username: message.username,
          blockTime: new Date().toISOString()
        });
        
        // 保存更新后的黑名单
        chrome.storage.local.set({ 'bilibiliBlock.blockedUsers': blockedUsers }, () => {
          sendResponse({ success: true });
        });
      } else {
        sendResponse({ success: true, alreadyBlocked: true });
      }
    });
    
    // 异步响应
    return true;
  }
  
  if (message.type === 'GET_BLOCKED_USERS') {
    // 获取黑名单
    chrome.storage.local.get('bilibiliBlock.blockedUsers', (data) => {
      sendResponse({ 
        success: true, 
        blockedUsers: data['bilibiliBlock.blockedUsers'] || [] 
      });
    });
    
    // 异步响应
    return true;
  }
  
  if (message.type === 'REMOVE_BLOCKED_USER') {
    // 从黑名单中移除用户
    chrome.storage.local.get('bilibiliBlock.blockedUsers', (data) => {
      let blockedUsers = data['bilibiliBlock.blockedUsers'] || [];
      
      // 过滤掉要移除的用户
      blockedUsers = blockedUsers.filter(user => user.uid !== message.uid);
      
      // 保存更新后的黑名单
      chrome.storage.local.set({ 'bilibiliBlock.blockedUsers': blockedUsers }, () => {
        sendResponse({ success: true });
      });
    });
    
    // 异步响应
    return true;
  }
});

// 扩展图标点击事件
chrome.action.onClicked.addListener((tab) => {
  // 检查当前标签页是否为哔哩哔哩网站
  if (tab.url.includes('bilibili.com')) {
    // 打开弹出窗口
    chrome.action.openPopup();
  } else {
    // 打开选项页
    chrome.runtime.openOptionsPage();
  }
}); 