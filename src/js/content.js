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
    buttonText: '拉黑',
    confirmBlock: false,
    debugMode: false,
    scanInterval: 4000
  };
  
  // 配置选项
  const config = {
    // 拉黑按钮的样式
    blockButtonClass: 'bilibili-block-button',
    // 选择器配置
    selectors: {
      // 首页Feed流视频卡片
      videoCard: '.bili-video-card',
      infoBottom: '.bili-video-card__info--bottom',
      ownerInfo: '.bili-video-card__info--owner',
      
      // 视频详情页推荐视频
      videoDetailCard: '.video-page-card-small',
      videoDetailInfo: '.info',
      videoDetailOwner: '.upname',
      
      // 视频详情页主页面相关
      videoMainInfo: '.video-info-container, .video-info-detail, [class*=info] > h1, .v-title',
      videoMainUpLink: '.up-name, .name a[href*="space.bilibili.com"], .username a[href*="space.bilibili.com"], a.up-name',
      
      // 美化扩展样式
      beautifyCard1: '.bili-card, .bili-video-card',
      beautifyCard2: '[class*=card][class*=rcmd], [class*=card][class*=recommend]'
    }
  };
  
  /**
   * 调试日志模块
   */
  const Logger = {
    /**
     * 输出调试日志
     * @param {...any} args 日志参数
     */
    debug: function(...args) {
      if (userSettings.debugMode) {
        console.log('[BilibiliBlock]', ...args);
      }
    },
    
    /**
     * 输出错误日志
     * @param {...any} args 错误信息
     */
    error: function(...args) {
      console.error('[BilibiliBlock]', ...args);
    },
    
    /**
     * 输出信息日志（不受调试模式影响）
     * @param {...any} args 日志参数
     */
    info: function(...args) {
      console.info('[BilibiliBlock]', ...args);
    }
  };
  
  /**
   * 黑名单管理模块
   */
  const BlacklistManager = {
    /**
     * 检查用户是否已被拉黑
     * @param {string} uid 用户ID
     * @returns {boolean} 是否已拉黑
     */
    isUserBlocked: function(uid) {
      return blockedUserIds.has(uid);
    },
    
    /**
     * 加载已拉黑用户列表
     */
    loadBlockedUsers: function() {
      chrome.storage.local.get('bilibiliBlock.blockedUsers', function(data) {
        const blockedUsers = data['bilibiliBlock.blockedUsers'] || [];
        
        // 更新缓存的黑名单ID集合
        blockedUserIds = new Set(blockedUsers.map(user => user.uid));
        
        Logger.debug('已加载黑名单用户:', blockedUsers.length, '个');
        
        // 重新扫描页面，更新已拉黑用户的按钮状态
        PageProcessor.scanPage();
      });
    },
    
    /**
     * 将用户添加到黑名单缓存
     * @param {string} uid 用户ID
     */
    addToBlockedCache: function(uid) {
      blockedUserIds.add(uid);
    }
  };
  
  /**
   * 按钮管理模块
   */
  const ButtonManager = {
    /**
     * 创建拉黑按钮元素
     * @param {string} uid 用户ID
     * @param {string} username 用户名
     * @returns {HTMLElement} 拉黑按钮元素
     */
    createBlockButton: function(uid, username) {
      const isBlocked = BlacklistManager.isUserBlocked(uid);
      
      // 获取配置的按钮文本，确保有默认值
      const buttonText = userSettings.buttonText || '拉黑';
      
      // 创建按钮元素
      const blockButton = window.bilibiliBlockUtils.createElement('a', {
        class: `${config.blockButtonClass}${isBlocked ? ' blocked' : ''}`,
        'data-uid': uid,
        'data-username': username,
        title: isBlocked ? `已拉黑用户：${username}` : `拉黑用户：${username}`
      });
      
      // 单独设置按钮文本内容，确保完整显示
      blockButton.innerHTML = isBlocked ? '已拉黑' : buttonText;
      
      // 基础样式设置，确保文字完整显示
      blockButton.style.width = 'auto';
      blockButton.style.overflow = 'visible';
      blockButton.style.whiteSpace = 'nowrap';
      
      // 如果已经拉黑，禁用点击事件
      if (!isBlocked) {
        // 添加点击事件
        blockButton.addEventListener('click', async function(event) {
          event.preventDefault();
          event.stopPropagation();
          
          // 检查是否已登录
          if (!window.bilibiliBlockUtils.isUserLoggedIn()) {
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
            this.innerHTML = '处理中...';
            
            Logger.debug('开始拉黑用户:', targetUsername, '(UID:', targetUid, ')');
            
            // 调用API拉黑用户
            await window.bilibiliBlockApi.blockUser(targetUid);
            
            // 更新按钮状态
            this.classList.remove('loading');
            this.classList.add('blocked');
            this.innerHTML = '已拉黑';
            this.title = `已拉黑用户：${targetUsername}`;
            
            // 禁用点击事件
            this.removeEventListener('click', arguments.callee);
            
            // 将用户ID添加到黑名单缓存
            BlacklistManager.addToBlockedCache(targetUid);
            
            // 显示成功提示
            window.bilibiliBlockUtils.showToast(`已成功拉黑用户：${targetUsername}`, 'success');
            
            Logger.debug('成功拉黑用户:', targetUsername, '(UID:', targetUid, ')');
            
            // 发送消息给后台脚本，记录拉黑用户
            chrome.runtime.sendMessage({
              type: 'BLOCK_USER',
              uid: targetUid,
              username: targetUsername
            });
            
            // 可选：隐藏被拉黑用户的视频卡片
            if (userSettings.autoHideBlocked) {
              const videoCard = ButtonManager.findParentCard(this);
              if (videoCard) {
                // 添加淡出动画
                videoCard.style.transition = 'opacity 0.5s ease';
                videoCard.style.opacity = '0.5';
                
                Logger.debug('已淡化视频卡片:', videoCard);
              }
            }
          } catch (error) {
            // 恢复按钮状态
            this.classList.remove('loading');
            // 确保使用配置中的按钮文本
            this.innerHTML = userSettings.buttonText || '拉黑';
            
            Logger.debug('拉黑失败:', error.message);
            
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
    },
    
    /**
     * 更新页面上所有拉黑按钮的文本
     * 当设置更改时调用此函数
     */
    updateAllButtonTexts: function() {
      try {
        // 获取所有未拉黑的按钮
        const buttons = document.querySelectorAll(`.${config.blockButtonClass}:not(.blocked)`);
        
        // 获取设置的文本
        const buttonText = userSettings.buttonText || '拉黑';
        
        // 更新每个按钮的文本
        buttons.forEach(button => {
          button.innerHTML = buttonText;
          
          // 确保样式正确
          button.style.width = 'auto';
          button.style.overflow = 'visible';
          button.style.whiteSpace = 'nowrap';
          
          // 如果是视频详情页的主按钮，添加额外样式
          if (button.getAttribute('data-type') === 'main-video') {
            button.style.minWidth = '40px';
            button.style.padding = '0 6px';
          }
        });
        
        Logger.debug(`已更新所有拉黑按钮文本为: ${buttonText}`);
      } catch (error) {
        Logger.error('更新按钮文本出错:', error);
      }
    },
    
    /**
     * 查找按钮所在的视频卡片元素
     * @param {HTMLElement} buttonElement 拉黑按钮元素
     * @returns {HTMLElement|null} 视频卡片元素
     */
    findParentCard: function(buttonElement) {
      // 尝试查找各种可能的父卡片
      const selectors = [
        config.selectors.videoCard,
        config.selectors.infoBottom,
        config.selectors.ownerInfo,
        config.selectors.videoDetailCard,
        config.selectors.beautifyCard1,
        config.selectors.beautifyCard2
      ];
      
      for (const selector of selectors) {
        const card = buttonElement.closest(selector);
        if (card) return card;
      }
      
      return null;
    }
  };
  
  /**
   * 页面处理模块
   */
  const PageProcessor = {
    /**
     * 安全地获取DOM元素
     * @param {string} selector 选择器
     * @param {HTMLElement} parent 父元素，默认为document
     * @returns {HTMLElement|null} 找到的元素或null
     */
    safeQuerySelector: function(selector, parent = document) {
      try {
        if (!parent) return null;
        return parent.querySelector(selector);
      } catch (error) {
        Logger.error('DOM查询错误:', error, selector);
        return null;
      }
    },
    
    /**
     * 安全地获取DOM元素集合
     * @param {string} selector 选择器
     * @param {HTMLElement} parent 父元素，默认为document
     * @returns {NodeList|Array} 找到的元素集合或空数组
     */
    safeQuerySelectorAll: function(selector, parent = document) {
      try {
        if (!parent) return [];
        return parent.querySelectorAll(selector);
      } catch (error) {
        Logger.error('DOM查询错误:', error, selector);
        return [];
      }
    },
    
    /**
     * 安全地添加或移除元素
     * @param {function} operation DOM操作函数
     * @param {string} description 操作描述，用于日志
     */
    safeDOMOperation: function(operation, description) {
      try {
        operation();
      } catch (error) {
        Logger.error(`DOM操作错误(${description}):`, error);
      }
    },
    
    /**
     * 处理首页Feed流视频卡片
     * @param {HTMLElement} card 视频卡片元素
     */
    processFeedCard: function(card) {
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
        Logger.debug('无法在Feed卡片中找到作者信息元素:', card);
        return;
      }
      
      // 提取用户ID和用户名
      const userHref = ownerInfo.getAttribute('href') || ownerInfo.outerHTML;
      const uid = window.bilibiliBlockUtils.extractUidFromUrl(userHref) || window.bilibiliBlockUtils.extractUidFromHref(userHref);
      const usernameElement = ownerInfo.querySelector('.bili-video-card__info--author');
      const username = usernameElement?.getAttribute('title') || usernameElement?.textContent || ownerInfo.textContent.split('·')[0].trim() || '未知用户';
      
      if (!uid) {
        Logger.debug('无法从Feed卡片中提取用户ID:', ownerInfo);
        return;
      }
      
      Logger.debug('处理Feed卡片:', username, '(UID:', uid, ')');
      
      // 创建拉黑按钮
      const blockButton = ButtonManager.createBlockButton(uid, username);
      
      // 添加到页面
      infoBottom.appendChild(blockButton);
      
      // 标记为已处理
      processedCards.add(card);
    },
    
    /**
     * 处理视频详情页的推荐视频
     * @param {HTMLElement} card 视频卡片元素
     */
    processVideoDetailCard: function(card) {
      // 检查是否已处理过该卡片
      if (processedCards.has(card)) {
        return;
      }
      
      // 避免重复处理
      if (card.querySelector(`.${config.blockButtonClass}`)) {
        processedCards.add(card);
        return;
      }
      
      Logger.debug('处理视频详情页推荐卡片:', card);
      
      // 查找视频作者信息元素
      const upnameDiv = card.querySelector('.upname');
      if (!upnameDiv) {
        Logger.debug('推荐卡片中未找到upname区域');
        return;
      }
      
      // 尝试获取作者链接和名称
      const upnameLink = upnameDiv.querySelector('a');
      if (!upnameLink) {
        Logger.debug('未找到UP主链接元素');
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
        uid = window.bilibiliBlockUtils.extractUidFromHref(href);
      }
      
      if (!uid) {
        Logger.debug('未能提取到UP主UID');
        return;
      }
      
      // 提取用户名
      const nameSpan = upnameLink.querySelector('.name');
      let username = nameSpan ? nameSpan.textContent.trim() : upnameLink.textContent.trim();
      username = username || '未知用户';
      
      Logger.debug('找到UP主信息:', username, '(UID:', uid, ')');
      
      // 创建拉黑按钮
      const blockButton = ButtonManager.createBlockButton(uid, username);
      
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
    },
    
    /**
     * 处理视频详情页的主页面（添加拉黑按钮在视频信息区域）
     */
    processVideoDetailMain: function() {
      // 检查是否为视频详情页
      if (!window.bilibiliBlockUtils.isInPageType('video')) {
        return;
      }
      
      // 避免重复添加
      if (this.safeQuerySelector(`.${config.blockButtonClass}[data-type="main-video"]`)) {
        return;
      }
      
      Logger.debug('处理视频详情页主信息区域');
      
      // 延迟处理，等待B站页面完全加载
      setTimeout(() => {
        this.tryProcessVideoDetailMain();
      }, 2000); 
    },
    
    /**
     * 尝试处理视频详情页，多次尝试确保成功
     * @param {number} attempts 剩余尝试次数
     */
    tryProcessVideoDetailMain: function(attempts = 3) {
      try {
        // 查找UP主信息容器
        const upInfoLink = this.safeQuerySelector(config.selectors.videoMainUpLink);
        if (!upInfoLink) {
          Logger.debug('未找到UP主信息区域，剩余尝试次数:', attempts - 1);
          if (attempts > 1) {
            // 继续尝试
            setTimeout(() => {
              this.tryProcessVideoDetailMain(attempts - 1);
            }, 1000);
          }
          return;
        }
        
        // 提取UP主ID
        const href = upInfoLink.getAttribute('href') || '';
        const uid = window.bilibiliBlockUtils.extractUidFromUrl(href) || window.bilibiliBlockUtils.extractUidFromHref(href);
        const username = upInfoLink.textContent.trim() || '未知用户';
        
        if (!uid) {
          Logger.debug('未能提取到UP主UID，剩余尝试次数:', attempts - 1);
          if (attempts > 1) {
            setTimeout(() => {
              this.tryProcessVideoDetailMain(attempts - 1);
            }, 1000);
          }
          return;
        }
        
        Logger.debug('找到视频详情页UP主:', username, '(UID:', uid, ')');
        
        // 创建拉黑按钮
        const blockButton = ButtonManager.createBlockButton(uid, username);
        
        // 设置拉黑按钮样式
        blockButton.style.fontSize = '12px';
        blockButton.style.margin = '10px 0 0 0';
        blockButton.style.display = 'inline-block';
        blockButton.style.width = 'auto'; // 确保宽度根据内容自适应
        blockButton.style.minWidth = '40px'; // 设置最小宽度
        blockButton.style.padding = '0 6px'; // 增加左右内边距确保文字有足够空间
        
        // 标记按钮为主视频按钮
        blockButton.setAttribute('data-type', 'main-video');
        
        // 安全地插入按钮，先查找视频信息区域
        const videoInfoContainer = this.safeQuerySelector(config.selectors.videoMainInfo);
        if (!videoInfoContainer) {
          Logger.debug('未找到视频信息容器，剩余尝试次数:', attempts - 1);
          if (attempts > 1) {
            setTimeout(() => {
              this.tryProcessVideoDetailMain(attempts - 1);
            }, 1000);
          }
          return;
        }
        
        // 首先查找标题元素，用于对齐
        const videoTitle = this.safeQuerySelector('h1', videoInfoContainer);
        if (!videoTitle) {
          Logger.debug('未找到视频标题，剩余尝试次数:', attempts - 1);
          if (attempts > 1) {
            setTimeout(() => {
              this.tryProcessVideoDetailMain(attempts - 1);
            }, 1000);
          }
          return;
        }
        
        // 获取标题的左边距或padding，用于对齐按钮
        let titlePadding = 0;
        try {
          const titleStyles = window.getComputedStyle(videoTitle);
          titlePadding = parseInt(titleStyles.paddingLeft || '0', 10);
        } catch (error) {
          Logger.debug('获取标题样式失败:', error);
        }
        
        // 创建按钮容器，确保按钮和标题左对齐
        const buttonContainer = document.createElement('div');
        buttonContainer.style.marginTop = '10px';
        buttonContainer.style.paddingLeft = titlePadding + 'px';
        buttonContainer.style.display = 'flex';
        buttonContainer.style.alignItems = 'center';
        buttonContainer.style.position = 'relative';
        buttonContainer.style.zIndex = '100';
        buttonContainer.style.width = '100%'; // 确保容器宽度足够
        buttonContainer.style.overflow = 'visible'; // 允许内容溢出显示
        buttonContainer.appendChild(blockButton);
        
        this.safeDOMOperation(() => {
          // 插入到playinfo后面
          if (playinfo.parentNode) {
            if (playinfo.nextSibling) {
              playinfo.parentNode.insertBefore(buttonContainer, playinfo.nextSibling);
            } else {
              playinfo.parentNode.appendChild(buttonContainer);
            }
            
            // 额外检查：确保按钮与标题左对齐
            try {
              // 获取标题和按钮容器的位置
              const titleRect = videoTitle.getBoundingClientRect();
              const containerRect = buttonContainer.getBoundingClientRect();
              
              // 如果左边距不一致，调整按钮容器的左边距
              if (Math.abs(titleRect.left - containerRect.left) > 5) {
                // 计算需要的左边距
                const leftDiff = titleRect.left - containerRect.left;
                const currentPadding = parseInt(buttonContainer.style.paddingLeft || '0', 10);
                buttonContainer.style.paddingLeft = (currentPadding + leftDiff) + 'px';
              }
            } catch (e) {
              Logger.debug('对齐调整失败:', e);
            }
            
            Logger.debug('成功添加视频详情页拉黑按钮');
          } else {
            // 备选方案：如果找不到playinfo的父元素，放在标题后面
            videoTitle.insertAdjacentElement('afterend', buttonContainer);
            Logger.debug('使用备选方案添加视频详情页拉黑按钮');
          }
        }, '插入视频详情页按钮');
        
      } catch (error) {
        Logger.error('处理视频详情页出错:', error);
        if (attempts > 1) {
          setTimeout(() => {
            this.tryProcessVideoDetailMain(attempts - 1);
          }, 1000);
        }
      }
    },
    
    /**
     * 处理美化扩展样式1的视频卡片
     * @param {HTMLElement} card 视频卡片元素
     */
    processBeautifyCard1: function(card) {
      if (processedCards.has(card)) {
        return;
      }
      
      try {
        // 查找UP主链接
        const authorLink = this.safeQuerySelector('a[href*="space.bilibili.com"]', card);
        if (!authorLink) {
          return;
        }
        
        // 提取用户ID和用户名
        const href = authorLink.getAttribute('href') || '';
        const uid = window.bilibiliBlockUtils.extractUidFromUrl(href) || window.bilibiliBlockUtils.extractUidFromHref(href);
        const username = authorLink.textContent.trim() || '未知用户';
        
        if (!uid) {
          return;
        }
        
        Logger.debug('处理美化样式1卡片:', username, '(UID:', uid, ')');
        
        // 创建拉黑按钮
        const blockButton = ButtonManager.createBlockButton(uid, username);
        blockButton.style.marginLeft = '5px';
        blockButton.style.verticalAlign = 'middle';
        
        // 添加到页面
        this.safeDOMOperation(() => {
          authorLink.insertAdjacentElement('afterend', blockButton);
        }, '插入美化样式1拉黑按钮');
        
        // 标记为已处理
        processedCards.add(card);
      } catch (error) {
        Logger.error('处理美化样式1卡片出错:', error);
      }
    },
    
    /**
     * 处理美化扩展样式2的视频卡片
     * @param {HTMLElement} card 视频卡片元素
     */
    processBeautifyCard2: function(card) {
      if (processedCards.has(card)) {
        return;
      }
      
      try {
        // 查找UP主链接
        const authorLink = this.safeQuerySelector('a[href*="space.bilibili.com"]', card);
        if (!authorLink) {
          return;
        }
        
        // 提取用户ID和用户名
        const href = authorLink.getAttribute('href') || '';
        const uid = window.bilibiliBlockUtils.extractUidFromUrl(href) || window.bilibiliBlockUtils.extractUidFromHref(href);
        const username = authorLink.textContent.trim() || '未知用户';
        
        if (!uid) {
          return;
        }
        
        Logger.debug('处理美化样式2卡片:', username, '(UID:', uid, ')');
        
        // 创建拉黑按钮
        const blockButton = ButtonManager.createBlockButton(uid, username);
        blockButton.style.marginLeft = '5px';
        blockButton.style.verticalAlign = 'middle';
        
        // 添加到页面
        this.safeDOMOperation(() => {
          authorLink.insertAdjacentElement('afterend', blockButton);
        }, '插入美化样式2拉黑按钮');
        
        // 标记为已处理
        processedCards.add(card);
      } catch (error) {
        Logger.error('处理美化样式2卡片出错:', error);
      }
    },
    
    /**
     * 扫描页面上的所有视频卡片，添加拉黑按钮
     */
    scanPage: function() {
      if (!userSettings.enabled) {
        Logger.debug('扩展已禁用，不扫描页面');
        return;
      }
      
      // 如果在UP主个人空间，不添加拉黑按钮
      if (window.bilibiliBlockUtils.isInPageType('space')) {
        Logger.debug('在UP主个人空间页面，不添加拉黑按钮');
        return;
      }
      
      Logger.debug('开始扫描页面');
      
      try {
        // 检查页面类型
        const isVideoDetailPage = window.bilibiliBlockUtils.isInPageType('video');
        
        // 视频详情页需要特殊处理，避免干扰B站原有脚本
        if (isVideoDetailPage) {
          // 处理视频详情页的主页面UP主信息（使用延迟处理）
          this.processVideoDetailMain();
          
          // 视频详情页的推荐视频也延迟处理
          setTimeout(() => {
            try {
              // 处理视频详情页的推荐视频
              this.safeQuerySelectorAll(config.selectors.videoDetailCard).forEach(card => {
                this.processVideoDetailCard(card);
              });
            } catch (error) {
              Logger.error('处理视频详情页推荐视频出错:', error);
            }
          }, 2000); // 延迟2秒处理推荐视频
          
          return; // 视频详情页单独处理，不执行后面的通用处理
        }
        
        // 非视频详情页的通用处理
        
        // 处理首页Feed流视频卡片
        this.safeQuerySelectorAll(config.selectors.videoCard).forEach(card => {
          this.processFeedCard(card);
        });
        
        // 处理美化扩展样式1的视频卡片
        this.safeQuerySelectorAll(config.selectors.beautifyCard1).forEach(card => {
          if (!processedCards.has(card)) {
            this.processBeautifyCard1(card);
          }
        });
        
        // 处理美化扩展样式2的视频卡片
        this.safeQuerySelectorAll(config.selectors.beautifyCard2).forEach(card => {
          if (!processedCards.has(card)) {
            this.processBeautifyCard2(card);
          }
        });
        
        // 处理所有带有space.bilibili.com链接的卡片（通用处理）
        this.safeQuerySelectorAll('a[href*="space.bilibili.com"]').forEach(link => {
          // 排除已处理的卡片
          const card = ButtonManager.findParentCard(link);
          if (card && !processedCards.has(card) && !this.safeQuerySelector(`.${config.blockButtonClass}`, card)) {
            const uid = window.bilibiliBlockUtils.extractUidFromHref(link.getAttribute('href') || '');
            if (uid) {
              const username = link.textContent.trim() || '未知用户';
              Logger.debug('通用处理找到UP主链接:', username, '(UID:', uid, ')');
              
              // 创建拉黑按钮
              const blockButton = ButtonManager.createBlockButton(uid, username);
              blockButton.style.marginLeft = '5px';
              blockButton.style.verticalAlign = 'middle';
              
              // 添加到页面
              this.safeDOMOperation(() => {
                link.insertAdjacentElement('afterend', blockButton);
              }, '插入通用拉黑按钮');
              
              // 标记父卡片为已处理
              if (card) {
                processedCards.add(card);
              }
            }
          }
        });
        
        Logger.debug('页面扫描完成');
      } catch (error) {
        Logger.error('扫描页面时出错:', error);
      }
    }
  };
  
  /**
   * 设置管理模块
   */
  const SettingsManager = {
    /**
     * 加载用户设置
     */
    loadSettings: function() {
      chrome.storage.local.get([
        'bilibiliBlock.enabled',
        'bilibiliBlock.autoHideBlocked',
        'bilibiliBlock.buttonText',
        'bilibiliBlock.confirmBlock',
        'bilibiliBlock.debugMode',
        'bilibiliBlock.scanInterval'
      ], function(items) {
        const oldButtonText = userSettings.buttonText;
        
        userSettings = {
          enabled: items['bilibiliBlock.enabled'] !== undefined ? items['bilibiliBlock.enabled'] : true,
          autoHideBlocked: items['bilibiliBlock.autoHideBlocked'] !== undefined ? items['bilibiliBlock.autoHideBlocked'] : true,
          buttonText: items['bilibiliBlock.buttonText'] || '拉黑',
          confirmBlock: items['bilibiliBlock.confirmBlock'] !== undefined ? items['bilibiliBlock.confirmBlock'] : false,
          debugMode: items['bilibiliBlock.debugMode'] !== undefined ? items['bilibiliBlock.debugMode'] : false,
          scanInterval: items['bilibiliBlock.scanInterval'] || 5000
        };
        
        Logger.debug('已加载用户设置:', userSettings);
        
        // 如果按钮文本发生变化，更新所有按钮
        if (oldButtonText !== userSettings.buttonText) {
          ButtonManager.updateAllButtonTexts();
        }
      });
    },
    
    /**
     * 监听设置变化
     */
    watchSettings: function() {
      chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local') {
          // 监听黑名单变化
          if (changes['bilibiliBlock.blockedUsers']) {
            Logger.debug('黑名单已更新，重新加载');
            BlacklistManager.loadBlockedUsers();
          }
          
          // 监听设置变化
          const settingsKeys = [
            'bilibiliBlock.enabled',
            'bilibiliBlock.autoHideBlocked',
            'bilibiliBlock.buttonText',
            'bilibiliBlock.confirmBlock',
            'bilibiliBlock.debugMode',
            'bilibiliBlock.scanInterval'
          ];
          
          let hasSettingChanged = false;
          let hasButtonTextChanged = false;
          
          settingsKeys.forEach(key => {
            if (changes[key]) {
              // 检查是否为按钮文本变更
              if (key === 'bilibiliBlock.buttonText') {
                hasButtonTextChanged = true;
              }
              
              const shortKey = key.replace('bilibiliBlock.', '');
              userSettings[shortKey] = changes[key].newValue;
              hasSettingChanged = true;
            }
          });
          
          // 如果设置有变化，记录日志
          if (hasSettingChanged) {
            Logger.debug('用户设置已更新:', userSettings);
          }
          
          // 如果按钮文本发生变化，更新所有按钮
          if (hasButtonTextChanged) {
            ButtonManager.updateAllButtonTexts();
          }
        }
      });
    }
  };
  
  /**
   * 添加扩展所需的样式
   */
  function addStyles() {
    const style = document.createElement('style');
    style.textContent = `
      /* 拉黑按钮样式的内联定义 - 用于确保样式立即生效 */
      .${config.blockButtonClass} {
        white-space: nowrap;
        overflow: visible;
        min-width: 40px;
        width: auto !important;
      }
    `;
    document.head.appendChild(style);
  }
  
  /**
   * 页面观察模块
   */
  const PageObserver = {
    // 节流标志
    throttled: false
  };
  
  /**
   * 初始化函数
   */
  function init() {
    // 加载用户设置
    SettingsManager.loadSettings();
    
    // 监听设置变化
    SettingsManager.watchSettings();
    
    // 加载黑名单
    BlacklistManager.loadBlockedUsers();
    
    // 添加样式
    addStyles();
    
    // 判断页面类型
    const isVideoDetailPage = window.bilibiliBlockUtils.isInPageType('video');
    
    // 视频详情页需要特殊处理，延迟初始化
    if (isVideoDetailPage) {
      // 确保页面完全加载后再初始化
      if (document.readyState === 'complete') {
        // 如果页面已经加载完成，延迟一段时间再初始化，避免干扰B站脚本
        setTimeout(() => {
          initPageObserver();
        }, 2000);
      } else {
        // 如果页面还在加载，等待加载完成后再初始化
        window.addEventListener('load', () => {
          setTimeout(() => {
            initPageObserver();
          }, 2000);
        });
      }
    } else {
      // 非视频详情页，正常初始化
      initPageObserver();
    }
  }
  
  /**
   * 初始化页面观察器
   */
  function initPageObserver() {
    // 首次扫描页面
    PageProcessor.scanPage();
    
    // 创建MutationObserver监听DOM变化
    const observer = new MutationObserver(function(mutations) {
      // 防止频繁触发，使用节流函数
      if (PageObserver.throttled) return;
      
      PageObserver.throttled = true;
      setTimeout(() => {
        PageProcessor.scanPage();
        PageObserver.throttled = false;
      }, userSettings.scanInterval);
    });
    
    // 开始观察
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    Logger.debug('页面观察器已初始化');
  }
  
  // 初始化扩展
  init();
})(); 