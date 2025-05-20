/**
 * BilibiliBlock 选项页面脚本
 * 处理用户设置的保存和加载
 */

document.addEventListener('DOMContentLoaded', function() {
  // 获取DOM元素
  const enableExtCheckbox = document.getElementById('enableExt');
  const autoHideBlockedCheckbox = document.getElementById('autoHideBlocked');
  const buttonPositionSelect = document.getElementById('buttonPosition');
  const buttonTextInput = document.getElementById('buttonText');
  const confirmBlockCheckbox = document.getElementById('confirmBlock');
  const debugModeCheckbox = document.getElementById('debugMode');
  const scanIntervalInput = document.getElementById('scanInterval');
  
  // 获取按钮元素
  const saveBtn = document.getElementById('saveBtn');
  const resetBtn = document.getElementById('resetBtn');
  const exportBtn = document.getElementById('exportBtn');
  const saveSuccess = document.getElementById('saveSuccess');
  
  /**
   * 默认设置
   */
  const defaultSettings = {
    'bilibiliBlock.enabled': true,
    'bilibiliBlock.autoHideBlocked': true,
    'bilibiliBlock.buttonPosition': 'right',
    'bilibiliBlock.buttonText': '拉黑',
    'bilibiliBlock.confirmBlock': false,
    'bilibiliBlock.debugMode': false,
    'bilibiliBlock.scanInterval': 5000
  };
  
  /**
   * 加载保存的设置
   */
  function loadSettings() {
    chrome.storage.local.get(Object.keys(defaultSettings), function(items) {
      // 如果设置项不存在，使用默认值
      const settings = { ...defaultSettings, ...items };
      
      // 设置表单值
      enableExtCheckbox.checked = settings['bilibiliBlock.enabled'];
      autoHideBlockedCheckbox.checked = settings['bilibiliBlock.autoHideBlocked'];
      buttonPositionSelect.value = settings['bilibiliBlock.buttonPosition'];
      buttonTextInput.value = settings['bilibiliBlock.buttonText'];
      confirmBlockCheckbox.checked = settings['bilibiliBlock.confirmBlock'];
      debugModeCheckbox.checked = settings['bilibiliBlock.debugMode'];
      scanIntervalInput.value = settings['bilibiliBlock.scanInterval'];
    });
  }
  
  /**
   * 保存设置
   */
  function saveSettings() {
    // 获取表单值
    const settings = {
      'bilibiliBlock.enabled': enableExtCheckbox.checked,
      'bilibiliBlock.autoHideBlocked': autoHideBlockedCheckbox.checked,
      'bilibiliBlock.buttonPosition': buttonPositionSelect.value,
      'bilibiliBlock.buttonText': buttonTextInput.value,
      'bilibiliBlock.confirmBlock': confirmBlockCheckbox.checked,
      'bilibiliBlock.debugMode': debugModeCheckbox.checked,
      'bilibiliBlock.scanInterval': parseInt(scanIntervalInput.value, 10)
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
    saveSuccess.textContent = message;
    saveSuccess.classList.add('show');
    
    setTimeout(() => {
      saveSuccess.classList.remove('show');
    }, 2000);
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
  saveBtn.addEventListener('click', saveSettings);
  resetBtn.addEventListener('click', resetSettings);
  exportBtn.addEventListener('click', exportBlockList);
  
  // 加载设置
  loadSettings();
}); 