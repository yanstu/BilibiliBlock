/**
 * BilibiliBlock 弹出窗口脚本
 * 处理扩展弹出窗口中的交互和黑名单显示
 */

document.addEventListener('DOMContentLoaded', function() {
  // 获取DOM元素
  const blocklistContainer = document.getElementById('blocklist');
  const blocklistCount = document.getElementById('blocklist-count');
  
  /**
   * 加载黑名单列表
   */
  async function loadBlockedUsers() {
    try {
      // 从存储中获取黑名单
      chrome.storage.local.get('bilibiliBlock.blockedUsers', function(data) {
        const blockedUsers = data['bilibiliBlock.blockedUsers'] || [];
        
        // 更新黑名单数量
        blocklistCount.textContent = `共 ${blockedUsers.length} 人`;
        
        // 更新黑名单列表
        renderBlockedUsers(blockedUsers);
      });
    } catch (error) {
      console.error('加载黑名单失败:', error);
      blocklistContainer.innerHTML = '<div class="blocklist-empty">加载黑名单时出错</div>';
    }
  }
  
  /**
   * 渲染黑名单用户列表
   * @param {Array} users 黑名单用户列表
   */
  function renderBlockedUsers(users) {
    // 清空容器
    blocklistContainer.innerHTML = '';
    
    // 检查是否有黑名单用户
    if (users.length === 0) {
      blocklistContainer.innerHTML = '<div class="blocklist-empty">黑名单为空，去B站给那些烦人的UP主一键拉黑吧！</div>';
      return;
    }
    
    // 按加入黑名单的时间倒序排列
    users.sort((a, b) => new Date(b.blockTime) - new Date(a.blockTime));
    
    // 渲染每个用户
    users.forEach(user => {
      const userItem = document.createElement('div');
      userItem.className = 'blocklist-item';
      
      // 格式化日期
      const blockDate = user.blockTime ? formatDate(new Date(user.blockTime)) : '未知时间';
      
      // 设置用户信息HTML
      userItem.innerHTML = `
        <div class="user-info">
          <span class="user-name">${user.username || '未知用户'}</span>
          <span class="user-uid">UID: ${user.uid}</span>
        </div>
      `;
      
      // 添加到容器
      blocklistContainer.appendChild(userItem);
    });
  }
  
  /**
   * 格式化日期
   * @param {Date} date 日期对象
   * @returns {string} 格式化后的日期字符串
   */
  function formatDate(date) {
    if (!(date instanceof Date) || isNaN(date)) {
      return '未知时间';
    }
    
    const now = new Date();
    const diff = now - date;
    
    // 1分钟内
    if (diff < 60 * 1000) {
      return '刚刚';
    }
    
    // 1小时内
    if (diff < 60 * 60 * 1000) {
      return `${Math.floor(diff / (60 * 1000))}分钟前`;
    }
    
    // 24小时内
    if (diff < 24 * 60 * 60 * 1000) {
      return `${Math.floor(diff / (60 * 60 * 1000))}小时前`;
    }
    
    // 30天内
    if (diff < 30 * 24 * 60 * 60 * 1000) {
      return `${Math.floor(diff / (24 * 60 * 60 * 1000))}天前`;
    }
    
    // 超过30天
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  }
  
  // 加载黑名单
  loadBlockedUsers();
}); 