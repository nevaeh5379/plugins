import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Settings, Trash2, X, Plus, Send, Copy } from 'lucide-react'
import './styles/plugin.css'

interface OocThread {
  id: string
  title: string
  timestamp: number
}

interface OocMessage {
  id: string
  role: 'user' | 'ai' | 'system'
  content: string
  timestamp: number
}

interface PluginConfig {
  provider: 'risu' | 'custom'
  customApiUrl: string
  customApiKey: string
  customModel: string
  customModelMode: 'model' | 'otherAx'
  systemPrompt: string
  contextDepth: 'none' | '1' | '5' | '10' | 'full'
  includeLore: boolean
}

const DEFAULT_CONFIG: PluginConfig = {
  provider: 'risu',
  customApiUrl: 'https://api.openai.com/v1',
  customApiKey: '',
  customModel: 'gpt-4o-mini',
  customModelMode: 'model',
  systemPrompt: 'You are a BTW (Out-of-Character) Assistant. Answer the user\'s questions about the story, character, or world settings. Answer concisely as an assistant, not in roleplay.',
  contextDepth: '5',
  includeLore: true
}

const api = typeof Risuai !== 'undefined' ? Risuai : (typeof risuai !== 'undefined' ? risuai : null);

export const App: React.FC = () => {
  const [config, setConfig] = useState<PluginConfig>(DEFAULT_CONFIG)
  
  // Multi-thread states
  const [threads, setThreads] = useState<OocThread[]>([])
  const [activeThreadId, setActiveThreadId] = useState<string>('')
  const [messages, setMessages] = useState<OocMessage[]>([])
  
  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  
  // Context states
  const [characterId, setCharacterId] = useState<string>('default')
  const [characterName, setCharacterName] = useState<string>('Character')
  const [chatIndex, setChatIndex] = useState<number>(0)
  
  const [toastMessage, setToastMessage] = useState('')
  const [showToast, setShowToast] = useState(false)

  const chatLogRef = useRef<HTMLDivElement>(null)
  const isMounted = useRef(true)

  // Trigger toast notifications
  const triggerToast = useCallback((msg: string) => {
    setToastMessage(msg)
    setShowToast(true)
    setTimeout(() => {
      if (isMounted.current) setShowToast(false)
    }, 2000)
  }, [])

  // Load message logs for a specific thread
  const loadThreadMessages = async (threadId: string) => {
    if (!api || !threadId) return []
    try {
      const storage = await api.getLocalPluginStorage()
      const oocKey = `btw_messages_${threadId}`
      const savedMessages = await storage.getItem<OocMessage[]>(oocKey)
      return savedMessages || []
    } catch (e) {
      console.error('[BTW Plugin] Load thread messages error:', e)
      return []
    }
  }

  // Load configuration, threads, and current BTW session messages
  const loadData = useCallback(async () => {
    if (!api) return

    try {
      const storage = await api.getLocalPluginStorage()
      
      // 1. Load general configuration
      const savedConfig = await storage.getItem<PluginConfig>('btw_plugin_config')
      if (savedConfig) {
        setConfig(prev => ({ ...prev, ...savedConfig }))
      }

      // 2. Load active character details
      const char = await api.getCharacter()
      const activeChatIndex = await api.getCurrentChatIndex()

      if (char) {
        const charId = char.chaId || 'default'
        setCharacterId(charId)
        setCharacterName(char.name || 'Character')
        setChatIndex(activeChatIndex)

        // 3. Load thread list for this character/chat
        const threadsKey = `btw_threads_${charId}_${activeChatIndex}`
        let savedThreads = await storage.getItem<OocThread[]>(threadsKey) || []
        
        // 4. Create default thread if list is empty
        if (savedThreads.length === 0) {
          const defaultThreadId = `default_${charId}_${activeChatIndex}_${Date.now()}`
          const defaultThread: OocThread = {
            id: defaultThreadId,
            title: '기본 대화',
            timestamp: Date.now()
          }
          savedThreads = [defaultThread]
          await storage.setItem(threadsKey, savedThreads)
        }
        setThreads(savedThreads)

        // 5. Load active thread ID selection
        const activeThreadKey = `btw_active_thread_${charId}_${activeChatIndex}`
        let activeId = await storage.getItem<string>(activeThreadKey)
        
        // Validate activeId is in the list
        if (!activeId || !savedThreads.some(t => t.id === activeId)) {
          activeId = savedThreads[0].id
          await storage.setItem(activeThreadKey, activeId)
        }
        setActiveThreadId(activeId)

        // 6. Load messages of the active BTW thread
        const activeMessages = await loadThreadMessages(activeId)
        setMessages(activeMessages)
      }
    } catch (e) {
      console.error('[BTW Plugin] Load data error:', e)
    }
  }, [])

  // Save config settings
  const saveConfig = async (newConfig: PluginConfig) => {
    if (!api) return
    try {
      const storage = await api.getLocalPluginStorage()
      await storage.setItem('btw_plugin_config', newConfig)
      setConfig(newConfig)
      triggerToast('설정이 저장되었습니다.')
    } catch (e) {
      console.error('[BTW Plugin] Save config error:', e)
    }
  }

  // Switch to a different thread
  const handleSelectThread = async (threadId: string) => {
    if (!api || !threadId) return
    try {
      const storage = await api.getLocalPluginStorage()
      const activeThreadKey = `btw_active_thread_${characterId}_${chatIndex}`
      await storage.setItem(activeThreadKey, threadId)
      setActiveThreadId(threadId)
      
      const threadMsgs = await loadThreadMessages(threadId)
      setMessages(threadMsgs)
    } catch (e) {
      console.error('[BTW Plugin] Select thread error:', e)
    }
  }

  // Create a brand new BTW thread
  const handleCreateNewThread = useCallback(async (initialQuery = '') => {
    if (!api) return ''
    try {
      const storage = await api.getLocalPluginStorage()
      const newThreadId = `thread_${characterId}_${chatIndex}_${Math.random().toString(36).substring(2)}_${Date.now()}`
      
      const title = initialQuery 
        ? (initialQuery.length > 20 ? initialQuery.slice(0, 20) + '...' : initialQuery)
        : '새 대화'

      const newThread: OocThread = {
        id: newThreadId,
        title,
        timestamp: Date.now()
      }

      const updatedThreads = [newThread, ...threads]
      
      const threadsKey = `btw_threads_${characterId}_${chatIndex}`
      await storage.setItem(threadsKey, updatedThreads)
      setThreads(updatedThreads)

      const activeThreadKey = `btw_active_thread_${characterId}_${chatIndex}`
      await storage.setItem(activeThreadKey, newThreadId)
      setActiveThreadId(newThreadId)
      setMessages([])

      return newThreadId
    } catch (e) {
      console.error('[BTW Plugin] Create new thread error:', e)
      return ''
    }
  }, [characterId, chatIndex, threads])

  // Delete current BTW thread
  const handleDeleteThread = async () => {
    if (!api || threads.length <= 1) {
      triggerToast('최소 한 개의 대화방은 유지되어야 합니다.')
      return
    }

    try {
      const storage = await api.getLocalPluginStorage()
      
      const oocKey = `btw_messages_${activeThreadId}`
      await storage.removeItem(oocKey)

      const remainingThreads = threads.filter(t => t.id !== activeThreadId)
      const nextActiveId = remainingThreads[0].id

      const threadsKey = `btw_threads_${characterId}_${chatIndex}`
      await storage.setItem(threadsKey, remainingThreads)
      setThreads(remainingThreads)

      const activeThreadKey = `btw_active_thread_${characterId}_${chatIndex}`
      await storage.setItem(activeThreadKey, nextActiveId)
      setActiveThreadId(nextActiveId)

      const nextMsgs = await loadThreadMessages(nextActiveId)
      setMessages(nextMsgs)

      triggerToast('대화방이 삭제되었습니다.')
    } catch (e) {
      console.error('[BTW Plugin] Delete thread error:', e)
    }
  }

  // Save thread messages
  const saveThreadMessages = async (threadId: string, msgs: OocMessage[]) => {
    if (!api || !threadId) return
    try {
      const storage = await api.getLocalPluginStorage()
      const oocKey = `btw_messages_${threadId}`
      await storage.setItem(oocKey, msgs)
    } catch (e) {
      console.error('[BTW Plugin] Save thread messages error:', e)
    }
  }

  // Assemble roleplay context
  const assembleContext = async () => {
    if (!api) return { systemPromptContent: config.systemPrompt, historyContext: '' }

    let systemPromptContent = config.systemPrompt
    let historyContext = ''

    try {
      const char = await api.getCharacter()
      
      if (config.includeLore && char) {
        const loreEntries = await api.getCurrentLorebookEntries()
        const loreText = loreEntries && loreEntries.length > 0 
          ? loreEntries.map((e, i) => `[Lore Entry #${i+1}]\nKeys: ${e.key || ''}\nContent: ${e.content || ''}`).join('\n\n')
          : 'None'

        systemPromptContent += `\n\n[Active Character Context]
Character Name: ${char.name || 'Unknown'}
Description: ${char.description || 'None'}
Personality: ${char.personality || 'None'}

[Active World Lorebook]
${loreText}`
      }

      if (config.contextDepth !== 'none') {
        const charIndex = await api.getCurrentCharacterIndex()
        const activeChatIndex = await api.getCurrentChatIndex()
        const chat = await api.getChatFromIndex(charIndex, activeChatIndex)
        
        if (chat && chat.message && chat.message.length > 0) {
          let targetMessages = chat.message;
          if (config.contextDepth === '1') {
            targetMessages = chat.message.slice(-1)
          } else if (config.contextDepth === '5') {
            targetMessages = chat.message.slice(-5)
          } else if (config.contextDepth === '10') {
            targetMessages = chat.message.slice(-10)
          }
          
          const formattedHistory = targetMessages.map((m: any) => {
            const sender = m.name || (m.role === 'user' ? 'User' : char.name || 'Char');
            return `[${sender}]: ${m.data || ''}`
          }).join('\n')

          historyContext = `[Current Main Roleplay Conversation History]\n(Use the following roleplay messages strictly as reference context to answer the user's OOC side questions)\n${formattedHistory}`
        }
      }
    } catch (e) {
      console.error('[BTW Plugin] Context assembly error:', e)
    }

    return { systemPromptContent, historyContext }
  }

  // Trigger Send Message
  const triggerSend = async (queryText: string, targetThreadId?: string) => {
    const activeId = targetThreadId || activeThreadId
    if (!queryText.trim() || loading || !api || !activeId) return

    setLoading(true)

    // Add user message to state
    const userMsg: OocMessage = {
      id: Math.random().toString(36).substring(2),
      role: 'user',
      content: queryText,
      timestamp: Date.now()
    }

    let currentThreadMsgs: OocMessage[] = []
    if (targetThreadId && targetThreadId !== activeThreadId) {
      currentThreadMsgs = [userMsg]
    } else {
      currentThreadMsgs = [...messages, userMsg]
    }
    setMessages(currentThreadMsgs)
    setInputText('')
    await saveThreadMessages(activeId, currentThreadMsgs)

    // Automatically update OOC thread title if it's currently generic
    const currentThread = threads.find(t => t.id === activeId)
    if (currentThread && (currentThread.title === '새 대화' || currentThread.title === '기본 대화' || currentThread.title === 'OOC 질문' || currentThread.title === '새 대화방')) {
      try {
        const storage = await api.getLocalPluginStorage()
        const newTitle = queryText.length > 20 ? queryText.slice(0, 20) + '...' : queryText
        
        const updatedThreads = threads.map(t => t.id === activeId ? { ...t, title: newTitle } : t)
        
        const threadsKey = `btw_threads_${characterId}_${chatIndex}`
        await storage.setItem(threadsKey, updatedThreads)
        setThreads(updatedThreads)
      } catch (e) {
        console.error('[BTW Plugin] Title update error:', e)
      }
    }

    // Placeholder BTW message for AI response
    const aiMsgId = Math.random().toString(36).substring(2)
    let aiContent = ''
    
    setMessages(prev => [...prev, {
      id: aiMsgId,
      role: 'ai',
      content: '',
      timestamp: Date.now()
    }])

    try {
      const { systemPromptContent, historyContext } = await assembleContext()

      const messagesToSend = [
        { role: 'system', content: systemPromptContent }
      ]

      if (historyContext) {
        messagesToSend.push({ role: 'system', content: historyContext })
      }

      currentThreadMsgs.forEach(m => {
        messagesToSend.push({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content
        })
      })

      if (config.provider === 'risu') {
        // --- Option 1: RisuAI Built-in LLM Model ---
        const response = await api.runLLMModel({
          messages: messagesToSend as any[],
          mode: config.customModelMode,
          allowPlugins: true
        })

        if (!response) {
          throw new Error('RisuAI LLM 모델로부터 응답을 받지 못했습니다.')
        }

        if (response.type === 'success' && typeof response.result === 'string') {
          aiContent = response.result
          updateAiMessage(aiMsgId, aiContent, currentThreadMsgs, activeId)
        } else if (response.type === 'streaming') {
          const reader = response.result.getReader()
          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              if (value && typeof value['0'] === 'string') {
                aiContent = value['0']
                updateAiMessage(aiMsgId, aiContent, currentThreadMsgs, activeId, false)
              }
            }
            updateAiMessage(aiMsgId, aiContent, currentThreadMsgs, activeId, true)
          } finally {
            reader.releaseLock()
          }
        } else {
          throw new Error('지원하지 않는 RisuAI 응답 형식입니다.')
        }

      } else {
        // --- Option 2: Custom OpenAI Compatible API ---
        if (!config.customApiUrl) {
          throw new Error('외부 API Base URL이 구성되지 않았습니다.')
        }

        const headers: Record<string, any> = {
          'Content-Type': 'application/json'
        }

        if (config.customApiKey) {
          await api.saveSecretHeader('btw_custom_auth', 'Bearer ', config.customApiKey)
          headers['Authorization'] = { secretHeader: 'btw_custom_auth' }
        }

        const fetchUrl = `${config.customApiUrl.replace(/\/$/, '')}/chat/completions`
        const body = {
          model: config.customModel,
          messages: messagesToSend,
          stream: true
        }

        const res = await api.nativeFetch(fetchUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(body)
        })

        if (!res.ok) {
          const errText = await res.text()
          throw new Error(`API 오류 (${res.status}): ${errText || res.statusText}`)
        }

        const reader = res.body?.getReader()
        if (!reader) {
          throw new Error('응답 스트림을 읽을 수 없습니다.')
        }

        const decoder = new TextDecoder()
        let buffer = ''
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              const trimmed = line.trim()
              if (trimmed.startsWith('data: ')) {
                const dataStr = trimmed.slice(6)
                if (dataStr === '[DONE]') break
                try {
                  const json = JSON.parse(dataStr)
                  const chunkText = json.choices?.[0]?.delta?.content || ''
                  if (chunkText) {
                    aiContent += chunkText
                    updateAiMessage(aiMsgId, aiContent, currentThreadMsgs, activeId, false)
                  }
                } catch (e) {
                  // ignore JSON parse error
                }
              }
            }
          }
          updateAiMessage(aiMsgId, aiContent, currentThreadMsgs, activeId, true)
        } finally {
          reader.releaseLock()
        }
      }

    } catch (e: any) {
      console.error('[BTW Plugin] Generation error:', e)
      aiContent = `⚠️ 오류가 발생했습니다: ${e.message || e}`
      updateAiMessage(aiMsgId, aiContent, currentThreadMsgs, activeId)
    } finally {
      setLoading(false)
    }
  }

  // Update AI response message state and storage
  const updateAiMessage = (msgId: string, content: string, previousMsgs: OocMessage[], threadId: string, save = true) => {
    setMessages(prev => {
      const updated = prev.map(m => m.id === msgId ? { ...m, content } : m)
      if (save) {
        const fullMsgs = previousMsgs.map(pm => pm.id === msgId ? { ...pm, content } : pm)
        const exists = fullMsgs.some(fm => fm.id === msgId)
        const finalMsgs = exists ? fullMsgs : [...previousMsgs, { id: msgId, role: 'ai' as const, content, timestamp: Date.now() }]
        saveThreadMessages(threadId, finalMsgs)
      }
      return updated
    })
  }

  // Set up listeners for the reload and new thread events
  useEffect(() => {
    isMounted.current = true
    loadData()

    const handleReload = () => {
      loadData()
    }

    const handleNewThreadWithQuery = async (e: Event) => {
      const customEvent = e as CustomEvent<{ query: string }>
      const query = customEvent.detail?.query || ''
      if (query) {
        const newId = await handleCreateNewThread(query)
        if (newId) {
          setTimeout(() => {
            triggerSend(query, newId)
          }, 150)
        }
      }
    }

    window.addEventListener('risu-editor:reload', handleReload)
    window.addEventListener('btw-plugin:new-thread-with-query', handleNewThreadWithQuery)

    return () => {
      isMounted.current = false
      window.removeEventListener('risu-editor:reload', handleReload)
      window.removeEventListener('btw-plugin:new-thread-with-query', handleNewThreadWithQuery)
    }
  }, [loadData, handleCreateNewThread])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    triggerSend(inputText)
  }

  const handleClose = async () => {
    if (api) {
      await api.hideContainer()
    }
  }

  return (
    <div className="btw-overlay" onClick={handleClose}>
      <div className="btw-sidebar" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="btw-header">
          <h2>BTW - {characterName}</h2>
          <div className="btw-header-actions">
            <button 
              className="icon-only" 
              onClick={() => setShowSettings(!showSettings)}
              title="설정"
            >
              <Settings size={16} />
            </button>
            <button 
              className="icon-only" 
              onClick={handleClose}
              title="닫기"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Thread Session Selector Bar */}
        <div className="btw-thread-bar">
          <select
            value={activeThreadId}
            onChange={(e) => handleSelectThread(e.target.value)}
            title="대화방 선택"
            className="btw-thread-select"
            disabled={loading}
          >
            {threads.map(t => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>
          <button 
            onClick={() => handleCreateNewThread()}
            disabled={loading}
            title="새 대화방 개설"
          >
            <Plus size={14} /> 새 대화
          </button>
          <button 
            className="danger icon-only"
            onClick={handleDeleteThread}
            disabled={loading || threads.length <= 1}
            title="현재 대화방 삭제"
          >
            <Trash2 size={14} />
          </button>
        </div>

        {/* Configuration settings panel */}
        {showSettings && (
          <div className="btw-settings-panel">
            <h3>설정</h3>

            <div className="btw-form-group">
              <label>모델 제공자</label>
              <select 
                value={config.provider}
                onChange={(e) => saveConfig({ ...config, provider: e.target.value as any })}
              >
                <option value="risu">RisuAI 모델 (추천)</option>
                <option value="custom">외부 OpenAI 호환 API</option>
              </select>
            </div>

            {config.provider === 'risu' ? (
              <div className="btw-form-group">
                <label>RisuAI 모델 모드</label>
                <select 
                  value={config.customModelMode}
                  onChange={(e) => saveConfig({ ...config, customModelMode: e.target.value as any })}
                >
                  <option value="model">채팅방 메인 모델</option>
                  <option value="otherAx">보조 모델 (Other Ax)</option>
                </select>
              </div>
            ) : (
              <>
                <div className="btw-form-group">
                  <label>API Base URL</label>
                  <input 
                    type="text" 
                    value={config.customApiUrl}
                    onChange={(e) => setConfig({ ...config, customApiUrl: e.target.value })}
                    onBlur={() => saveConfig(config)}
                    placeholder="https://api.openai.com/v1"
                  />
                </div>
                <div className="btw-form-group">
                  <label>API Key</label>
                  <input 
                    type="password" 
                    value={config.customApiKey}
                    onChange={(e) => setConfig({ ...config, customApiKey: e.target.value })}
                    onBlur={() => saveConfig(config)}
                    placeholder="sk-..."
                  />
                </div>
                <div className="btw-form-group">
                  <label>모델명</label>
                  <input 
                    type="text" 
                    value={config.customModel}
                    onChange={(e) => setConfig({ ...config, customModel: e.target.value })}
                    onBlur={() => saveConfig(config)}
                    placeholder="gpt-4o-mini"
                  />
                </div>
              </>
            )}

            <div className="btw-form-group">
              <label>BTW 시스템 프롬프트</label>
              <textarea 
                value={config.systemPrompt}
                rows={4}
                onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
                onBlur={() => saveConfig(config)}
                placeholder="시스템 지침을 입력하세요..."
              />
              <span className="hint">LLM이 역할극 외(OOC) 답변을 하도록 유도하는 지침입니다.</span>
            </div>

            <button onClick={() => setShowSettings(false)} className="primary">확인</button>
          </div>
        )}

        {/* Global Controls */}
        <div className="btw-controls">
          <div className="btw-control-row">
            <label htmlFor="context-depth">메인 대화 깊이</label>
            <select
              id="context-depth"
              value={config.contextDepth}
              style={{ width: 'auto' }}
              onChange={(e) => saveConfig({ ...config, contextDepth: e.target.value as any })}
            >
              <option value="none">역할극 기록 미포함</option>
              <option value="1">직전 1개 대화 포함</option>
              <option value="5">최근 5개 대화 포함</option>
              <option value="10">최근 10개 대화 포함</option>
              <option value="full">전체 대화 역사 포함</option>
            </select>
          </div>
          <div className="btw-control-row">
            <label htmlFor="include-lore" style={{ cursor: 'pointer' }}>로어북 및 캐릭터 정보 포함</label>
            <input 
              type="checkbox"
              id="include-lore"
              style={{ width: 'auto', cursor: 'pointer' }}
              checked={config.includeLore}
              onChange={(e) => saveConfig({ ...config, includeLore: e.target.checked })}
            />
          </div>
        </div>

        {/* Message Log */}
        <div className="btw-chat-log" ref={chatLogRef}>
          {messages.length === 0 ? (
            <div className="btw-empty">
              <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>💬</div>
              <strong>BTW 채널에 오신 것을 환영합니다!</strong>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem' }}>
                여기서 나누는 대화는 캐릭터와의 메인 역할극 대화 기록에 저장되지 않아 토큰이 낭비되거나 캐릭터 페르소나가 망가지는 것을 막아줍니다.
              </p>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.78rem', color: 'var(--btw-fg-muted)' }}>
                메인 채팅창에서 <code style={{fontFamily: 'monospace'}}>/btw 질문내용</code>을 입력하면 **자동으로 새 대화방을 열어** 바로 답변해 줍니다.
              </p>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`btw-msg-row ${m.role}`}>
                <div className="btw-msg-meta">
                  {m.role === 'user' ? '나' : `${characterName}`}
                </div>
                <div className="btw-msg-content">
                  {m.content}
                  {m.role === 'ai' && m.content && !m.content.startsWith('⚠️') && (
                    <div style={{ marginTop: '0.35rem', textAlign: 'right' }}>
                      <button 
                        style={{ fontSize: '0.72rem', padding: '0.2rem 0.4rem', gap: '0.2rem' }} 
                        onClick={() => copyToClipboard(m.content)}
                      >
                        <Copy size={12} /> 복사
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {/* Typing Loading Indicator */}
          {loading && (
            <div className="btw-typing">
              <span>답변 작성 중</span>
              <div className="btw-typing-dot"></div>
              <div className="btw-typing-dot"></div>
              <div className="btw-typing-dot"></div>
            </div>
          )}
        </div>

        {/* Footer Input */}
        <form onSubmit={handleSubmit} className="btw-footer">
          <div className="btw-input-wrap">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="질문을 입력하세요..."
              disabled={loading}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  triggerSend(inputText)
                }
              }}
            />
            <button 
              type="submit" 
              className="primary" 
              disabled={loading || !inputText.trim()}
            >
              <Send size={14} />
            </button>
          </div>
        </form>

        {/* Toast Notification */}
        <div className={`btw-toast ${showToast ? 'show' : ''}`}>
          {toastMessage}
        </div>
      </div>
    </div>
  )
}
