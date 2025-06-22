/**
 * BilibiliBlock 工具函数
 * 提供扩展所需的通用工具函数
 */

// 工具模块封装
const BilibiliBlockUtils = (function() {
  /**
   * 获取用户的CSRF令牌（bili_jct）
   * @returns {string|null} CSRF令牌，如果未找到则返回null
   */
  function getCsrfToken() {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.indexOf('bili_jct=') === 0) {
        return cookie.substring('bili_jct='.length, cookie.length);
      }
    }
    return null;
  }

  /**
   * 编码表单数据为URL编码格式
   * @param {Object} data 需要编码的数据对象
   * @returns {string} 编码后的URL参数字符串
   */
  function encodeFormData(data) {
    return Object.keys(data)
      .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(data[key]))
      .join('&');
  }

  /**
   * 格式化用户ID
   * @param {string} href 用户空间链接
   * @returns {string|null} 用户ID，如果无法提取则返回null
   */
  function extractUidFromUrl(href) {
    const match = href.match(/\/\/space\.bilibili\.com\/(\d+)/);
    return match ? match[1] : null;
  }

  /**
   * 提取用户ID更全面的方法，支持多种格式
   * @param {string} href 用户空间链接或HTML文本
   * @returns {string|null} 用户ID，如果无法提取则返回null
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
        return match[1];
      }
    }
    
    // 检查是否有data-attribute
    if (href.includes('biliscope-userid=')) {
      const match = href.match(/biliscope-userid="(\d+)"/);
      return match ? match[1] : null;
    }
    
    return null;
  }

  /**
   * 创建元素并设置属性
   * @param {string} tag 元素标签名
   * @param {Object} attributes 元素的属性对象
   * @param {string|HTMLElement} content 元素的内容（文本或其他HTML元素）
   * @returns {HTMLElement} 创建的元素
   */
  function createElement(tag, attributes = {}, content = '') {
    const element = document.createElement(tag);
    
    // 设置属性
    Object.keys(attributes).forEach(key => {
      if (key === 'style' && typeof attributes[key] === 'object') {
        Object.assign(element.style, attributes[key]);
      } else {
        element.setAttribute(key, attributes[key]);
      }
    });
    
    // 设置内容
    if (typeof content === 'string') {
      element.innerHTML = content;
    } else if (content instanceof HTMLElement) {
      element.appendChild(content);
    }
    
    return element;
  }

  /**
   * 显示提示信息
   * @param {string} message 提示信息
   * @param {string} type 提示类型（'success'、'error'等）
   * @param {number} duration 显示时长（毫秒）
   */
  function showToast(message, type = 'info', duration = 2000) {
    // 防止创建多个toast
    const existingToast = document.querySelector('.bilibili-block-toast');
    if (existingToast) {
      existingToast.remove();
    }
    
    const toast = createElement('div', {
      class: `bilibili-block-toast bilibili-block-toast-${type}`
    }, message);
    
    document.body.appendChild(toast);
    
    // 显示动画
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);
    
    // 自动关闭
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  /**
   * 检查用户是否已登录B站
   * @returns {boolean} 是否已登录
   */
  function isUserLoggedIn() {
    return document.cookie.includes('DedeUserID=') && document.cookie.includes('bili_jct=');
  }

  /**
   * 检查当前是否在特定页面类型
   * @param {string} pageType 页面类型（'video', 'space', 等）
   * @returns {boolean} 是否在指定页面类型
   */
  function isInPageType(pageType) {
    const url = window.location.href;
    
    switch (pageType) {
      case 'video':
        return url.includes('bilibili.com/video/') || 
               document.querySelector('.video-container') !== null ||
               document.querySelector('.bpx-player-container') !== null;
      case 'space':
        return url.includes('space.bilibili.com');
      case 'home':
        return (url === 'https://www.bilibili.com/' || 
                url === 'https://www.bilibili.com' || 
                url.includes('bilibili.com/?')) && 
               !url.includes('/video/') && 
               !url.includes('space.bilibili.com');
      case 'search':
        return url.includes('search.bilibili.com') || 
               url.includes('bilibili.com/search');
      case 'live':
        return url.includes('live.bilibili.com');
      case 'read':
        return url.includes('bilibili.com/read/');
      default:
        return false;
    }
  }
  
  /**
   * 检查页面是否已完全加载
   * @returns {boolean} 页面是否已完全加载
   */
  function isPageFullyLoaded() {
    return document.readyState === 'complete';
  }

  // 导出公共API
  return {
    getCsrfToken,
    encodeFormData,
    extractUidFromUrl,
    extractUidFromHref,
    createElement,
    showToast,
    isUserLoggedIn,
    isInPageType,
    isPageFullyLoaded
  };
})();

// 导出工具函数，使其可以在其他模块中使用
window.bilibiliBlockUtils = BilibiliBlockUtils; 