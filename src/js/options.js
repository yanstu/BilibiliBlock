/**
 * BilibiliBlock 选项页面脚本
 * 处理用户设置的保存和加载
 */

document.addEventListener('DOMContentLoaded', function() {
  // 获取DOM元素
  const enableExtCheckbox = document.getElementById('enableExt');
  const autoHideBlockedCheckbox = document.getElementById('autoHideBlocked');
  const buttonTextInput = document.getElementById('buttonText');
  const confirmBlockCheckbox = document.getElementById('confirmBlock');
  const debugModeCheckbox = document.getElementById('debugMode');
  const scanIntervalInput = document.getElementById('scanInterval');
  
  // 获取按钮元素
  const saveBtn = document.getElementById('saveBtn');
  const resetBtn = document.getElementById('resetBtn');
  const exportBtn = document.getElementById('exportBtn');
  const saveSuccess = document.getElementById('saveSuccess');
  
  // 检查必需的元素是否存在
  const requiredElements = {
    'enableExt': enableExtCheckbox,
    'autoHideBlocked': autoHideBlockedCheckbox,
    'buttonText': buttonTextInput,
    'confirmBlock': confirmBlockCheckbox,
    'debugMode': debugModeCheckbox,
    'scanInterval': scanIntervalInput,
    'saveBtn': saveBtn,
    'resetBtn': resetBtn,
    'exportBtn': exportBtn
  };
  
  // 检查是否有缺失的元素
  const missingElements = Object.entries(requiredElements)
    .filter(([id, element]) => !element)
    .map(([id]) => id);
  
  if (missingElements.length > 0) {
    console.error('无法找到以下DOM元素:', missingElements.join(', '));
    // 如果有缺失元素，显示错误提示
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = `页面加载错误：无法找到必要的DOM元素。请刷新页面或联系开发者。`;
    document.body.insertBefore(errorDiv, document.body.firstChild);
    return; // 中止初始化
  }
  
  /**
   * 默认设置
   */
  const defaultSettings = {
    'bilibiliBlock.enabled': true,
    'bilibiliBlock.autoHideBlocked': true,
    'bilibiliBlock.buttonText': '拉黑',
    'bilibiliBlock.confirmBlock': false,
    'bilibiliBlock.debugMode': false,
    'bilibiliBlock.scanInterval': 4000
  };
  
  /**
   * 安全地设置DOM元素的值
   * @param {HTMLElement} element DOM元素
   * @param {string} property 要设置的属性
   * @param {any} value 属性值
   */
  function safeSetElementValue(element, property, value) {
    if (element && property in element) {
      element[property] = value;
    }
  }
  
  /**
   * 安全地获取DOM元素的值
   * @param {HTMLElement} element DOM元素
   * @param {string} property 要获取的属性
   * @param {any} defaultValue 默认值
   * @returns {any} 属性值或默认值
   */
  function safeGetElementValue(element, property, defaultValue) {
    if (element && property in element) {
      return element[property];
    }
    return defaultValue;
  }
  
  /**
   * 加载保存的设置
   */
  function loadSettings() {
    chrome.storage.local.get(Object.keys(defaultSettings), function(items) {
      // 如果设置项不存在，使用默认值
      const settings = { ...defaultSettings, ...items };
      
      // 设置表单值，使用安全设置函数
      safeSetElementValue(enableExtCheckbox, 'checked', settings['bilibiliBlock.enabled']);
      safeSetElementValue(autoHideBlockedCheckbox, 'checked', settings['bilibiliBlock.autoHideBlocked']);
      safeSetElementValue(buttonTextInput, 'value', settings['bilibiliBlock.buttonText']);
      safeSetElementValue(confirmBlockCheckbox, 'checked', settings['bilibiliBlock.confirmBlock']);
      safeSetElementValue(debugModeCheckbox, 'checked', settings['bilibiliBlock.debugMode']);
      safeSetElementValue(scanIntervalInput, 'value', settings['bilibiliBlock.scanInterval']);
    });
  }
  
  /**
   * 保存设置
   */
  function saveSettings() {
    // 获取表单值，使用安全获取函数
    const settings = {
      'bilibiliBlock.enabled': safeGetElementValue(enableExtCheckbox, 'checked', defaultSettings['bilibiliBlock.enabled']),
      'bilibiliBlock.autoHideBlocked': safeGetElementValue(autoHideBlockedCheckbox, 'checked', defaultSettings['bilibiliBlock.autoHideBlocked']),
      'bilibiliBlock.buttonText': safeGetElementValue(buttonTextInput, 'value', defaultSettings['bilibiliBlock.buttonText']),
      'bilibiliBlock.confirmBlock': safeGetElementValue(confirmBlockCheckbox, 'checked', defaultSettings['bilibiliBlock.confirmBlock']),
      'bilibiliBlock.debugMode': safeGetElementValue(debugModeCheckbox, 'checked', defaultSettings['bilibiliBlock.debugMode']),
      'bilibiliBlock.scanInterval': parseInt(safeGetElementValue(scanIntervalInput, 'value', defaultSettings['bilibiliBlock.scanInterval']), 10)
    };
    
    // 保存到存储中
    chrome.storage.local.set(settings, function() {
      // 显示保存成功提示
      showSaveSuccess();
    });
  }
  
  /**
   * 重置为默认设置
   */
  function resetSettings() {
    if (confirm('确定要恢复默认设置吗？这将覆盖您的所有自定义设置。')) {
      chrome.storage.local.set(defaultSettings, function() {
        loadSettings();
        showSaveSuccess('已恢复默认设置');
      });
    }
  }
  
  /**
   * 导出黑名单
   */
  function exportBlockList() {
    chrome.storage.local.get('bilibiliBlock.blockedUsers', function(data) {
      const blockedUsers = data['bilibiliBlock.blockedUsers'] || [];
      
      // 创建导出数据
      const exportData = {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        blockedUsers: blockedUsers
      };
      
      // 转换为JSON字符串
      const jsonString = JSON.stringify(exportData, null, 2);
      
      // 创建下载链接
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      // 创建下载链接并点击
      const a = document.createElement('a');
      a.href = url;
      a.download = `bilibili_blocklist_${formatDate(new Date())}.json`;
      document.body.appendChild(a);
      a.click();
      
      // 清理
      setTimeout(function() {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 0);
    });
  }
  
  /**
   * 显示保存成功提示
   * @param {string} message 提示消息
   */
  function showSaveSuccess(message = '设置已保存') {
    if (saveSuccess) {
      saveSuccess.textContent = message;
      saveSuccess.classList.add('show');
      
      setTimeout(() => {
        saveSuccess.classList.remove('show');
      }, 2000);
    } else {
      // 如果找不到提示元素，使用alert
      alert(message);
    }
  }
  
  /**
   * 格式化日期为文件名
   * @param {Date} date 日期对象
   * @returns {string} 格式化的日期字符串
   */
  function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }
  
  // 绑定事件监听
  if (saveBtn) saveBtn.addEventListener('click', saveSettings);
  if (resetBtn) resetBtn.addEventListener('click', resetSettings);
  if (exportBtn) exportBtn.addEventListener('click', exportBlockList);
  
  // 加载设置
  loadSettings();
}); 