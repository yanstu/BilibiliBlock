/**
 * BilibiliBlock 内容脚本
 * 负责在B站页面上添加拉黑按钮并处理拉黑操作
 */

// 使用IIFE隔离变量作用域
(function() {
  // 存储已添加按钮的视频卡片，避免重复添加
  const processedCards = new Set();
  
  // 存储已拉黑的用户ID集合，用于快速查询
  let blockedUserIds = new Set();
  
  // 用户设置
  let userSettings = {
    enabled: true,
    autoHideBlocked: true,
    buttonPosition: 'right',
    buttonText: '拉黑',
    confirmBlock: false,
    debugMode: false,
    scanInterval: 5000
  };
  
  // 配置选项
  const config = {
    // 拉黑按钮的样式
    blockButtonClass: 'bilibili-block-button',
    // 选择器配置
    selectors: {
      // 首页Feed流视频卡片
      feedCard: '.feed-card',
      videoCard: '.bili-video-card',
      infoBottom: '.bili-video-card__info--bottom',
      ownerInfo: '.bili-video-card__info--owner',
      
      // 视频详情页推荐视频
      videoDetailCard: '.video-page-card-small',
      videoDetailInfo: '.info',
      videoDetailOwner: '.upname a, .upname',
      
      // 美化扩展样式1 (data-v-89bbbbc2)
      beautifyCard1: '[data-v-89bbbbc2].video-card',
      beautifyInfo1: '[data-v-89bbbbc2] .channel-name',
      
      // 美化扩展样式2 (feed-card with different structure)
      beautifyCard2: '.feed-card .bili-video-card.is-rcmd'
    }
  };
  
  /**
   * 调试日志函数
   * @param {...any} args 日志参数
   */
  function debugLog(...args) {
    if (userSettings.debugMode) {
      console.log('[BilibiliBlock]', ...args);
    }
  }
  
  /**
   * 检查当前是否在UP主的个人空间页面
   * @returns {boolean} 是否在UP主个人空间页面
   */
  function isInUpSpace() {
    return window.location.href.includes('space.bilibili.com');
  }
  
  /**
   * 检查用户是否已登录B站
   * @returns {boolean} 是否已登录
   */
  function isLoggedIn() {
    // 通过检查cookie中是否包含DedeUserID和bili_jct来判断是否登录
    return document.cookie.includes('DedeUserID=') && document.cookie.includes('bili_jct=');
  }
  
  /**
   * 检查用户是否已被拉黑
   * @param {string} uid 用户ID
   * @returns {boolean} 是否已拉黑
   */
  function isUserBlocked(uid) {
    return blockedUserIds.has(uid);
  }
  
  /**
   * 从href中提取用户ID
   * @param {string} href 用户链接
   * @returns {string|null} 用户ID
   */
  function extractUidFromHref(href) {
    if (!href) return null;
    
    // 处理不同格式的用户链接
    const patterns = [
      /\/\/space\.bilibili\.com\/(\d+)/,  // 标准格式
      /https?:\/\/space\.bilibili\.com\/(\d+)/,  // 完整URL
      /\/\/www\.bilibili\.com\/(\d+)/,  // 简短格式
      /biliscope-userid="(\d+)"/,  // 属性格式
      /space\.bilibili\.com\/(\d+)\?/  // 带查询参数的链接
    ];
    
    for (const pattern of patterns) {
      const match = href.match(pattern);
      if (match && match[1]) {
        debugLog('从链接中提取到用户ID:', match[1], '链接:', href);
        return match[1];
      }
    }
    
    // 检查是否有data-attribute
    if (href.includes('biliscope-userid=')) {
      const match = href.match(/biliscope-userid="(\d+)"/);
      debugLog('从属性中提取到用户ID:', match ? match[1] : null);
      return match ? match[1] : null;
    }
    
    debugLog('无法从链接中提取用户ID:', href);
    return null;
  }
  
  /**
   * 加载用户设置
   */
  function loadSettings() {
    chrome.storage.local.get([
      'bilibiliBlock.enabled',
      'bilibiliBlock.autoHideBlocked',
      'bilibiliBlock.buttonPosition',
      'bilibiliBlock.buttonText',
      'bilibiliBlock.confirmBlock',
      'bilibiliBlock.debugMode',
      'bilibiliBlock.scanInterval'
    ], function(items) {
      userSettings = {
        enabled: items['bilibiliBlock.enabled'] !== undefined ? items['bilibiliBlock.enabled'] : true,
        autoHideBlocked: items['bilibiliBlock.autoHideBlocked'] !== undefined ? items['bilibiliBlock.autoHideBlocked'] : true,
        buttonPosition: items['bilibiliBlock.buttonPosition'] || 'right',
        buttonText: items['bilibiliBlock.buttonText'] || '拉黑',
        confirmBlock: items['bilibiliBlock.confirmBlock'] !== undefined ? items['bilibiliBlock.confirmBlock'] : false,
        debugMode: items['bilibiliBlock.debugMode'] !== undefined ? items['bilibiliBlock.debugMode'] : false,
        scanInterval: items['bilibiliBlock.scanInterval'] || 5000
      };
      
      debugLog('已加载用户设置:', userSettings);
    });
  }
  
  /**
   * 加载已拉黑用户列表
   */
  function loadBlockedUsers() {
    chrome.storage.local.get('bilibiliBlock.blockedUsers', function(data) {
      const blockedUsers = data['bilibiliBlock.blockedUsers'] || [];
      
      // 更新缓存的黑名单ID集合
      blockedUserIds = new Set(blockedUsers.map(user => user.uid));
      
      debugLog('已加载黑名单用户:', blockedUsers.length, '个');
      
      // 重新扫描页面，更新已拉黑用户的按钮状态
      scanPage();
    });
  }
  
  /**
   * 创建拉黑按钮元素
   * @param {string} uid 用户ID
   * @param {string} username 用户名
   * @returns {HTMLElement} 拉黑按钮元素
   */
  function createBlockButton(uid, username) {
    const isBlocked = isUserBlocked(uid);
    
    const blockButton = window.bilibiliBlockUtils.createElement('a', {
      class: `${config.blockButtonClass}${isBlocked ? ' blocked' : ''}`,
      'data-uid': uid,
      'data-username': username,
      title: isBlocked ? `已拉黑用户：${username}` : `拉黑用户：${username}`
    }, isBlocked ? '已拉黑' : userSettings.buttonText || '拉黑');
    
    // 如果已经拉黑，禁用点击事件
    if (!isBlocked) {
      // 添加点击事件
      blockButton.addEventListener('click', async function(event) {
        event.preventDefault();
        event.stopPropagation();
        
        // 检查是否已登录
        if (!isLoggedIn()) {
          window.bilibiliBlockUtils.showToast('请先登录哔哩哔哩账号后再使用拉黑功能', 'error', 3000);
          return;
        }
        
        // 获取用户信息
        const targetUid = this.getAttribute('data-uid');
        const targetUsername = this.getAttribute('data-username');
        
        if (!targetUid) {
          window.bilibiliBlockUtils.showToast('无法获取用户ID', 'error');
          return;
        }
        
        // 拉黑前确认
        if (userSettings.confirmBlock) {
          if (!confirm(`确定要拉黑 "${targetUsername}" 吗？`)) {
            return;
          }
        }
        
        try {
          // 修改按钮状态
          this.classList.add('loading');
          this.textContent = '处理中...';
          
          debugLog('开始拉黑用户:', targetUsername, '(UID:', targetUid, ')');
          
          // 调用API拉黑用户
          await window.bilibiliBlockApi.blockUser(targetUid);
          
          // 更新按钮状态
          this.classList.remove('loading');
          this.classList.add('blocked');
          this.textContent = '已拉黑';
          this.title = `已拉黑用户：${targetUsername}`;
          
          // 禁用点击事件
          this.removeEventListener('click', arguments.callee);
          
          // 将用户ID添加到黑名单缓存
          blockedUserIds.add(targetUid);
          
          // 显示成功提示
          window.bilibiliBlockUtils.showToast(`已成功拉黑用户：${targetUsername}`, 'success');
          
          debugLog('成功拉黑用户:', targetUsername, '(UID:', targetUid, ')');
          
          // 发送消息给后台脚本，记录拉黑用户
          chrome.runtime.sendMessage({
            type: 'BLOCK_USER',
            uid: targetUid,
            username: targetUsername
          });
          
          // 可选：隐藏被拉黑用户的视频卡片
          if (userSettings.autoHideBlocked) {
            const videoCard = findParentCard(this);
            if (videoCard) {
              // 添加淡出动画
              videoCard.style.transition = 'opacity 0.5s ease';
              videoCard.style.opacity = '0.5';
              
              debugLog('已淡化视频卡片:', videoCard);
            }
          }
        } catch (error) {
          // 恢复按钮状态
          this.classList.remove('loading');
          this.textContent = userSettings.buttonText || '拉黑';
          
          debugLog('拉黑失败:', error.message);
          
          // 处理特定错误
          if (error.message.includes('账号未登录')) {
            window.bilibiliBlockUtils.showToast('请先登录哔哩哔哩账号后再使用拉黑功能', 'error', 3000);
          } else {
            // 显示一般错误提示
            window.bilibiliBlockUtils.showToast(`拉黑失败：${error.message}`, 'error');
          }
        }
      });
    }
    
    return blockButton;
  }
  
  /**
   * 查找按钮所在的视频卡片元素
   * @param {HTMLElement} element 拉黑按钮元素
   * @returns {HTMLElement|null} 视频卡片元素
   */
  function findParentCard(element) {
    // 尝试查找各种可能的父卡片
    const selectors = [
      config.selectors.videoCard,
      config.selectors.feedCard,
      config.selectors.videoDetailCard,
      config.selectors.beautifyCard1,
      config.selectors.beautifyCard2
    ];
    
    for (const selector of selectors) {
      const card = element.closest(selector);
      if (card) return card;
    }
    
    return null;
  }
  
  /**
   * 处理首页Feed流视频卡片
   * @param {HTMLElement} card 视频卡片元素
   */
  function processFeedCard(card) {
    // 检查是否已处理过该卡片
    if (processedCards.has(card)) {
      return;
    }
    
    // 避免重复处理
    if (card.querySelector(`.${config.blockButtonClass}`)) {
      processedCards.add(card);
      return;
    }
    
    // 查找视频作者信息元素
    const infoBottom = card.querySelector(config.selectors.infoBottom);
    const ownerInfo = infoBottom?.querySelector(config.selectors.ownerInfo);
    
    if (!infoBottom || !ownerInfo) {
      debugLog('无法在Feed卡片中找到作者信息元素:', card);
      return;
    }
    
    // 提取用户ID和用户名
    const userHref = ownerInfo.getAttribute('href') || ownerInfo.outerHTML;
    const uid = window.bilibiliBlockUtils.extractUidFromUrl(userHref) || extractUidFromHref(userHref);
    const usernameElement = ownerInfo.querySelector('.bili-video-card__info--author');
    const username = usernameElement?.getAttribute('title') || usernameElement?.textContent || ownerInfo.textContent.split('·')[0].trim() || '未知用户';
    
    if (!uid) {
      debugLog('无法从Feed卡片中提取用户ID:', ownerInfo);
      return;
    }
    
    debugLog('处理Feed卡片:', username, '(UID:', uid, ')');
    
    // 创建拉黑按钮
    const blockButton = createBlockButton(uid, username);
    
    // 添加到页面
    infoBottom.appendChild(blockButton);
    
    // 标记为已处理
    processedCards.add(card);
  }
  
  /**
   * 处理视频详情页的推荐视频
   * @param {HTMLElement} card 视频卡片元素
   */
  function processVideoDetailCard(card) {
    // 检查是否已处理过该卡片
    if (processedCards.has(card)) {
      return;
    }
    
    // 避免重复处理
    if (card.querySelector(`.${config.blockButtonClass}`)) {
      processedCards.add(card);
      return;
    }
    
    debugLog('处理视频详情页推荐卡片:', card);
    
    // 查找视频作者信息元素
    const upnameDiv = card.querySelector('.upname');
    if (!upnameDiv) {
      debugLog('推荐卡片中未找到upname区域');
      return;
    }
    
    // 尝试获取作者链接和名称
    const upnameLink = upnameDiv.querySelector('a');
    if (!upnameLink) {
      debugLog('未找到UP主链接元素');
      return;
    }
    
    // 提取用户ID
    let uid = null;
    
    // 先尝试从属性获取
    if (upnameLink.hasAttribute('biliscope-userid')) {
      uid = upnameLink.getAttribute('biliscope-userid');
    }
    
    // 再尝试从href获取
    if (!uid) {
      const href = upnameLink.getAttribute('href') || '';
      uid = extractUidFromHref(href);
    }
    
    if (!uid) {
      debugLog('未能提取到UP主UID');
      return;
    }
    
    // 提取用户名
    const nameSpan = upnameLink.querySelector('.name');
    let username = nameSpan ? nameSpan.textContent.trim() : upnameLink.textContent.trim();
    username = username || '未知用户';
    
    debugLog('找到UP主信息:', username, '(UID:', uid, ')');
    
    // 创建拉黑按钮
    const blockButton = createBlockButton(uid, username);
    
    // 设置按钮样式 - 修改宽度和字体颜色
    blockButton.style.marginLeft = '5px';
    blockButton.style.fontSize = '12px';
    blockButton.style.display = 'inline-block';
    blockButton.style.verticalAlign = 'middle';
    blockButton.style.padding = '0 4px';
    blockButton.style.color = '#fff';
    blockButton.style.width = 'auto';
    blockButton.style.minWidth = 'unset';
    
    // 插入到名称后面
    if (nameSpan) {
      nameSpan.insertAdjacentElement('afterend', blockButton);
    } else {
      upnameLink.insertAdjacentElement('afterend', blockButton);
    }
    
    // 标记为已处理
    processedCards.add(card);
  }
  
  /**
   * 处理美化扩展样式1的视频卡片
   * @param {HTMLElement} card 视频卡片元素
   */
  function processBeautifyCard1(card) {
    // 检查是否已处理过该卡片
    if (processedCards.has(card)) {
      return;
    }
    
    // 避免重复处理
    if (card.querySelector(`.${config.blockButtonClass}`)) {
      processedCards.add(card);
      return;
    }
    
    debugLog('处理美化扩展样式1视频卡片:', card);
    
    // 查找视频作者信息元素 - data-v-89bbbbc2 样式
    const channelName = card.querySelector('.channel-name');
    
    if (!channelName) {
      debugLog('未找到频道名称元素');
      return;
    }
    
    // 提取用户ID和用户名
    const userHref = channelName.getAttribute('href') || '';
    let uid = extractUidFromHref(userHref);
    
    // 如果userHref没有提取到ID，尝试从父元素或整个卡片中提取
    if (!uid) {
      const cardHTML = card.outerHTML;
      const uidMatch = cardHTML.match(/biliscope-userid="(\d+)"|\/\/space\.bilibili\.com\/(\d+)/);
      if (uidMatch) {
        uid = uidMatch[1] || uidMatch[2];
      }
    }
    
    const username = channelName.textContent.trim() || '未知用户';
    
    if (!uid) {
      debugLog('未能提取到UP主UID');
      return;
    }
    
    debugLog('找到UP主信息:', username, '(UID:', uid, ')');
    
    // 创建拉黑按钮
    const blockButton = createBlockButton(uid, username);
    
    // 设置按钮样式以适应美化样式
    blockButton.style.marginLeft = '8px';
    blockButton.style.marginTop = '0';
    blockButton.style.verticalAlign = 'middle';
    
    // 添加到页面
    channelName.insertAdjacentElement('afterend', blockButton);
    
    // 标记为已处理
    processedCards.add(card);
  }
  
  /**
   * 处理美化扩展样式2的视频卡片
   * @param {HTMLElement} card 视频卡片元素
   */
  function processBeautifyCard2(card) {
    // 检查是否已处理过该卡片
    if (processedCards.has(card)) {
      return;
    }
    
    // 避免重复处理
    if (card.querySelector(`.${config.blockButtonClass}`)) {
      processedCards.add(card);
      return;
    }
    
    debugLog('处理美化扩展样式2视频卡片');
    
    // 处理 feed-card 内部的 bili-video-card.is-rcmd
    if (card.classList.contains('bili-video-card') && card.classList.contains('is-rcmd')) {
      // 查找作者信息
      const infoBottom = card.querySelector('.bili-video-card__info--bottom');
      if (!infoBottom) {
        debugLog('未找到底部信息区域');
        return;
      }
      
      const ownerInfo = infoBottom.querySelector('.bili-video-card__info--owner');
      if (!ownerInfo) {
        debugLog('未找到UP主信息元素');
        return;
      }
      
      // 提取用户ID和用户名
      const userHref = ownerInfo.getAttribute('href') || ownerInfo.outerHTML;
      const uid = window.bilibiliBlockUtils.extractUidFromUrl(userHref) || extractUidFromHref(userHref);
      const authorElement = ownerInfo.querySelector('.bili-video-card__info--author');
      const username = authorElement?.getAttribute('title') || authorElement?.textContent || ownerInfo.textContent.split('·')[0].trim() || '未知用户';
      
      if (!uid) {
        debugLog('未能提取到UP主UID');
        return;
      }
      
      debugLog('找到UP主信息:', username, '(UID:', uid, ')');
      
      // 创建拉黑按钮
      const blockButton = createBlockButton(uid, username);
      
      // 添加到页面
      infoBottom.appendChild(blockButton);
      
      // 标记为已处理
      processedCards.add(card);
    } else {
      // 尝试处理其他类型的美化样式
      // 查找可能的UP主链接
      let authorLink = null;
      
      // 首先查找带有space.bilibili.com的链接
      const links = card.querySelectorAll('a[href*="space.bilibili.com"]');
      for (const link of links) {
        if (link.textContent.trim()) {
          authorLink = link;
          break;
        }
      }
      
      if (!authorLink) {
        // 尝试其他可能的选择器
        const possibleLinks = card.querySelectorAll('a[biliscope-userid], a.up-name, a.up, .up-name a');
        for (const link of possibleLinks) {
          if (link.textContent.trim()) {
            authorLink = link;
            break;
          }
        }
      }
      
      if (!authorLink) {
        debugLog('未找到可用的UP主链接元素');
        return;
      }
      
      // 提取用户ID
      let uid = null;
      if (authorLink.hasAttribute('biliscope-userid')) {
        uid = authorLink.getAttribute('biliscope-userid');
      } else {
        const href = authorLink.getAttribute('href') || '';
        uid = extractUidFromHref(href);
        
        if (!uid) {
          const html = authorLink.outerHTML;
          uid = extractUidFromHref(html);
        }
      }
      
      if (!uid) {
        debugLog('无法提取UP主UID');
        return;
      }
      
      // 提取用户名
      const username = authorLink.textContent.trim() || '未知用户';
      
      debugLog('找到UP主信息:', username, '(UID:', uid, ')');
      
      // 创建拉黑按钮
      const blockButton = createBlockButton(uid, username);
      
      // 设置按钮样式
      blockButton.style.marginLeft = '5px';
      blockButton.style.verticalAlign = 'middle';
      
      // 添加到页面
      authorLink.insertAdjacentElement('afterend', blockButton);
      
      // 标记为已处理
      processedCards.add(card);
    }
  }
  
  /**
   * 扫描页面上的所有视频卡片，添加拉黑按钮
   */
  function scanPage() {
    if (!userSettings.enabled) {
      debugLog('扩展已禁用，不扫描页面');
      return;
    }
    
    // 如果在UP主个人空间，不添加拉黑按钮
    if (isInUpSpace()) {
      debugLog('在UP主个人空间页面，不添加拉黑按钮');
      return;
    }
    
    debugLog('开始扫描页面');
    
    // 处理首页Feed流视频卡片
    document.querySelectorAll(config.selectors.videoCard).forEach(card => {
      processFeedCard(card);
    });
    
    // 处理视频详情页的推荐视频
    document.querySelectorAll(config.selectors.videoDetailCard).forEach(card => {
      processVideoDetailCard(card);
    });
    
    // 处理美化扩展样式1的视频卡片
    document.querySelectorAll(config.selectors.beautifyCard1).forEach(card => {
      processBeautifyCard1(card);
    });
    
    // 处理美化扩展样式2的视频卡片和其他可能的美化样式
    document.querySelectorAll('.feed-card .bili-video-card.is-rcmd').forEach(card => {
      processBeautifyCard2(card);
    });
    
    // 处理其他美化样式的视频卡片
    document.querySelectorAll('[data-v-89bbbbc2].video-card').forEach(card => {
      if (!processedCards.has(card)) {
        processBeautifyCard1(card);
      }
    });
    
    // 处理可能的第三方美化样式
    document.querySelectorAll('.feed-card:not(.bili-video-card)').forEach(card => {
      if (!processedCards.has(card) && !card.querySelector(`.${config.blockButtonClass}`)) {
        processBeautifyCard2(card);
      }
    });
    
    // 处理所有带有space.bilibili.com链接的卡片（通用处理）
    document.querySelectorAll('a[href*="space.bilibili.com"]').forEach(link => {
      // 排除已处理的卡片
      const card = findParentCard(link);
      if (card && !processedCards.has(card) && !card.querySelector(`.${config.blockButtonClass}`)) {
        const uid = extractUidFromHref(link.getAttribute('href') || '');
        if (uid) {
          const username = link.textContent.trim() || '未知用户';
          debugLog('通用处理找到UP主链接:', username, '(UID:', uid, ')');
          
          // 创建拉黑按钮
          const blockButton = createBlockButton(uid, username);
          blockButton.style.marginLeft = '5px';
          blockButton.style.verticalAlign = 'middle';
          
          // 添加到页面
          link.insertAdjacentElement('afterend', blockButton);
          
          // 标记父卡片为已处理
          if (card) {
            processedCards.add(card);
          }
        }
      }
    });
    
    // 尝试处理其他未识别的美化布局
    processBeautifiedLayouts();
    
    debugLog('页面扫描完成');
  }
  
  /**
   * 处理各种美化布局
   */
  function processBeautifiedLayouts() {
    // 查找所有可能的视频卡片容器，这些是一些常见的类名模式
    const possibleCardSelectors = [
      '.video-card', 
      '.rcmd-card',
      '.card-list > .card',
      '.video-page-card',
      '.card-box',
      '[class*="video"][class*="card"]',
      '[class*="Card"]',
      '.bili-video-card',
      '.feed-card',
      '[class*="video-"][class*="-card"]'
    ];
    
    // 尝试所有可能的选择器
    possibleCardSelectors.forEach(selector => {
      try {
        document.querySelectorAll(selector).forEach(card => {
          // 检查卡片是否已处理
          if (processedCards.has(card) || card.querySelector(`.${config.blockButtonClass}`)) {
            return;
          }
          
          // 尝试找到UP主链接
          const links = card.querySelectorAll('a');
          let authorLink = null;
          
          // 查找所有链接，检查是否为UP主链接
          for (const link of links) {
            const href = link.getAttribute('href') || '';
            if (href.includes('space.bilibili.com') || link.hasAttribute('biliscope-userid')) {
              // 确保链接有文本内容
              if (link.textContent.trim()) {
                authorLink = link;
                break;
              }
            }
          }
          
          if (!authorLink) {
            return;
          }
          
          // 提取用户ID
          let uid = null;
          if (authorLink.hasAttribute('biliscope-userid')) {
            uid = authorLink.getAttribute('biliscope-userid');
          } else {
            const href = authorLink.getAttribute('href') || '';
            uid = extractUidFromHref(href);
          }
          
          if (!uid) {
            return;
          }
          
          // 提取用户名
          const username = authorLink.textContent.trim() || '未知用户';
          
          debugLog('美化布局处理找到UP主:', username, '(UID:', uid, ')');
          
          // 创建拉黑按钮
          const blockButton = createBlockButton(uid, username);
          
          // 设置按钮样式
          blockButton.style.marginLeft = '5px';
          blockButton.style.verticalAlign = 'middle';
          blockButton.style.fontSize = '12px';
          
          // 添加到页面
          authorLink.insertAdjacentElement('afterend', blockButton);
          
          // 标记为已处理
          processedCards.add(card);
        });
      } catch (error) {
        // 忽略选择器错误
        debugLog('处理美化布局错误:', error.message);
      }
    });
  }
  
  /**
   * 使用MutationObserver监听页面变化，处理动态加载的内容
   */
  function observePage() {
    debugLog('开始监听页面变化');
    
    // 创建观察器实例
    const observer = new MutationObserver((mutations) => {
      let shouldScan = false;
      
      mutations.forEach(mutation => {
        // 检查是否有新增节点
        if (mutation.addedNodes.length > 0) {
          shouldScan = true;
        }
      });
      
      // 如果有变化，重新扫描页面
      if (shouldScan) {
        debugLog('检测到页面变化，重新扫描');
        scanPage();
      }
    });
    
    // 配置观察选项
    const configOptions = { childList: true, subtree: true };
    
    // 开始观察整个文档
    observer.observe(document.body, configOptions);
    
    return observer;
  }
  
  /**
   * 初始化扩展功能
   */
  function init() {
    console.log('BilibiliBlock 扩展已加载');
    
    // 加载用户设置
    loadSettings();
    
    // 加载已拉黑用户列表
    loadBlockedUsers();
    
    // 初始扫描页面
    scanPage();
    
    // 监听页面变化
    const observer = observePage();
    
    // 每5秒钟重新扫描一次页面，以防漏掉一些卡片
    const intervalId = setInterval(() => {
      if (userSettings.enabled) {
        debugLog('定时扫描页面');
        scanPage();
      }
    }, userSettings.scanInterval);
    
    // 监听设置变化
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local') {
        if (changes['bilibiliBlock.blockedUsers']) {
          debugLog('黑名单已更新，重新加载');
          loadBlockedUsers();
        }
        
        // 更新设置
        const settingsKeys = [
          'bilibiliBlock.enabled',
          'bilibiliBlock.autoHideBlocked',
          'bilibiliBlock.buttonPosition',
          'bilibiliBlock.buttonText',
          'bilibiliBlock.confirmBlock',
          'bilibiliBlock.debugMode',
          'bilibiliBlock.scanInterval'
        ];
        
        let settingsChanged = false;
        
        for (const key of settingsKeys) {
          if (changes[key]) {
            settingsChanged = true;
            break;
          }
        }
        
        if (settingsChanged) {
          debugLog('设置已更新，重新加载');
          loadSettings();
        }
      }
    });
    
    // 清理函数，在扩展卸载时调用
    function cleanup() {
      observer.disconnect();
      clearInterval(intervalId);
    }
    
    // 返回清理函数，供后续使用
    return cleanup;
  }
  
  // 初始化扩展
  const cleanup = init();
  
  // 将清理函数暴露给全局，便于可能的手动清理
  window.bilibiliBlockCleanup = cleanup;
})(); 