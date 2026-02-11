/**
 * YouTube字幕翻译 - 内容脚本
 * 参考: bugushi/youtube-translator 项目
 */

(function() {
  'use strict';
  
  // 状态
  let isEnabled = false;
  let toLang = 'zh-CN';
  let isTranslating = false;
  let videoElement = null;
  let wrapperElement = null;
  
  // 初始化
  function init() {
    console.log('🎬 字幕翻译插件加载');
    
    // 获取视频元素
    updateVideoElement();
    
    // 监听事件
    if (videoElement) {
      videoElement.addEventListener('pause', onPause);
      videoElement.addEventListener('play', onPlay);
    }
    
    // 监听URL变化
    chrome.runtime.onMessage.addListener(handleMessage);
  }
  
  // 更新视频元素引用
  function updateVideoElement() {
    videoElement = document.querySelector('video');
    if (videoElement) {
      videoElement.removeEventListener('pause', onPause);
      videoElement.removeEventListener('play', onPlay);
      videoElement.addEventListener('pause', onPause);
      videoElement.addEventListener('play', onPlay);
    }
  }
  
  // 处理来自popup的消息
  function handleMessage(request, sender, sendResponse) {
    if (request.action === 'start') {
      isEnabled = true;
      toLang = request.lang || 'zh-CN';
      console.log('✅ 翻译已开启');
      sendResponse({ success: true });
    } else if (request.action === 'stop') {
      isEnabled = false;
      removeTranslationWrapper();
      console.log('⏹️ 翻译已关闭');
      sendResponse({ success: true });
    } else if (request.action === 'checkUrl') {
      sendResponse({ 
        success: true, 
        isYouTube: window.location.href.includes('youtube.com') 
      });
    }
    return true;
  }
  
  // 暂停事件 - 触发翻译
  function onPause() {
    if (!isEnabled || isTranslating) return;
    
    isTranslating = true;
    console.log('⏸️ 暂停，触发翻译');
    
    // 延迟一点让字幕完全加载
    setTimeout(() => {
      translateCurrentSubtitles();
    }, 100);
    
    // 重置翻译状态
    setTimeout(() => {
      isTranslating = false;
    }, 200);
  }
  
  // 播放事件 - 移除翻译
  function onPlay() {
    removeTranslationWrapper();
  }
  
  // 获取当前字幕
  function getCaptionText() {
    const captions = document.querySelectorAll('.ytp-caption-segment');
    if (!captions || captions.length === 0) return null;
    
    const texts = Array.from(captions).map(el => el.textContent).filter(t => t.trim());
    return texts.length > 0 ? texts.join('\n') : null;
  }
  
  // 翻译当前字幕
  async function translateCurrentSubtitles() {
    const text = getCaptionText();
    if (!text) {
      console.log('❌ 未检测到字幕');
      return;
    }
    
    console.log('📝 翻译中:', text.substring(0, 50) + '...');
    
    try {
      const translated = await googleTranslate(text);
      if (translated) {
        showTranslation(translated);
      }
    } catch (error) {
      console.error('翻译失败:', error);
    }
  }
  
  // Google翻译
  async function googleTranslate(text) {
    const encoded = encodeURIComponent(text);
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${toLang}&dt=t&q=${encoded}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data && data[0]) {
      const translated = data[0]
        .filter(item => item[0])
        .map(item => item[0])
        .join('');
      return translated;
    }
    return null;
  }
  
  // 显示翻译结果
  function showTranslation(translated) {
    // 移除旧的
    removeTranslationWrapper();
    
    // 创建新wrapper
    wrapperElement = document.createElement('div');
    wrapperElement.className = 'youtube-translator-wrapper';
    
    // 获取播放器容器
    const playerContainer = document.querySelector('#ytd-player');
    if (playerContainer) {
      playerContainer.appendChild(wrapperElement);
    } else {
      document.body.appendChild(wrapperElement);
    }
    
    // 创建翻译文本元素
    const translationLine = document.createElement('div');
    translationLine.className = 'youtube-translator-text';
    translationLine.textContent = translated;
    
    wrapperElement.appendChild(translationLine);
    
    // 自动消失（5秒后）
    setTimeout(() => {
      if (wrapperElement) {
        wrapperElement.style.opacity = '0';
        wrapperElement.style.transition = 'opacity 0.5s';
        setTimeout(removeTranslationWrapper, 500);
      }
    }, 5000);
  }
  
  // 移除翻译wrapper
  function removeTranslationWrapper() {
    const wrappers = document.querySelectorAll('.youtube-translator-wrapper');
    wrappers.forEach(w => w.remove());
    wrapperElement = null;
  }
  
  // 页面变化检测（单页应用）
  let lastUrl = location.href;
  const observer = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      console.log('🔄 页面变化');
      updateVideoElement();
      removeTranslationWrapper();
    }
  });
  
  observer.observe(document, { subtree: true, childList: true });
  
  // 启动
  init();
})();
