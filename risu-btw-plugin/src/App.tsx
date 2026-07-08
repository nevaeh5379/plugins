import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Settings, Trash2, X, Plus, Send, Copy, RotateCw, Edit, Brain, ChevronDown, ChevronUp, ChevronRight, Search } from 'lucide-react'
import './styles/plugin.css'
import { marked } from 'marked'

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
  model?: string
}

interface CustomEndpoint {
  id: string
  name: string
  apiUrl: string
  apiKey: string
  model: string
}

interface PluginConfig {
  provider: 'risu' | 'custom'
  customEndpoints: CustomEndpoint[]
  activeEndpointId: string
  customModelMode: 'model' | 'otherAx'
  systemPrompt: string
  contextDepth: 'none' | '1' | '5' | '10' | 'full'
  includeLore: boolean
  includeCharDesc: boolean
  includeLorebook: boolean
  includeUserPersona: boolean
  disabledLorebookIds: string[]
  forceEnabledLorebookIds: string[]
  renderMarkdown: boolean
  streamResponse: boolean

  // Legacy configuration parameters
  customApiUrl?: string
  customApiKey?: string
  customModel?: string
}

const DEFAULT_ENDPOINTS: CustomEndpoint[] = [
  {
    id: 'openai-default',
    name: 'OpenAI (Default)',
    apiUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-4o-mini'
  }
]

const DEFAULT_CONFIG: PluginConfig = {
  provider: 'risu',
  customEndpoints: DEFAULT_ENDPOINTS,
  activeEndpointId: 'openai-default',
  customModelMode: 'model',
  systemPrompt: 'You are a BTW (Out-of-Character) Assistant. Answer the user\'s questions about the story, character, or world settings. Answer concisely as an assistant, not in roleplay.',
  contextDepth: '5',
  includeLore: true,
  includeCharDesc: true,
  includeLorebook: true,
  includeUserPersona: true,
  disabledLorebookIds: [],
  forceEnabledLorebookIds: [],
  renderMarkdown: true,
  streamResponse: true
}

const api = typeof Risuai !== 'undefined' ? Risuai : (typeof risuai !== 'undefined' ? risuai : null);

const normalizeApiKey = (apiKey: string) => apiKey.trim().replace(/^Bearer\s+/i, '')

const applyAuthHeader = async (headers: Record<string, any>, apiKey: string) => {
  const normalizedKey = normalizeApiKey(apiKey)
  if (!api || !normalizedKey) return

  await api.saveSecretHeader('Authorization', 'Bearer ', normalizedKey)
  headers['Authorization'] = { secretHeader: 'Authorization' }
}

const parseApiErrorMessage = async (res: Response) => {
  const errText = await res.text()
  let detail = errText || res.statusText

  try {
    const json = JSON.parse(errText)
    detail = json?.error?.message || json?.detail || detail
  } catch {
    // Keep the plain response text when the API does not return JSON.
  }

  const authHint = res.status === 401 || res.status === 403
    ? ' API Key와 Base URL이 현재 선택한 제공자와 맞는지 확인해주세요.'
    : ''

  return `API 오류 (${res.status}): ${detail}${authHint}`
}

const isLorebookTriggered = (entry: any, messages: any[], depth: number, isFullWord: boolean) => {
  if (entry.alwaysActive) return true;
  const keys = (entry.key || '').split(',').map((k: string) => k.trim()).filter(Boolean);
  if (keys.length === 0) return false;

  const sliced = messages.slice(Math.max(0, messages.length - depth));
  const mList = sliced.map((msg: any) => {
    const data = msg.data || '';
    const cleanData = data.toLowerCase().replace(/\{\{\/\/(.+?)\}\}/g, '').replace(/\{\{comment:(.+?)\}\}/g, '');
    return { data: cleanData };
  });

  const checkMatch = (keyList: string[], useRegex: boolean) => {
    if (useRegex) {
      for (const mText of mList) {
        for (const regexString of keyList) {
          if (!regexString.startsWith('/')) continue;
          const parts = regexString.split('/');
          const flags = parts.pop() || '';
          const pattern = parts.slice(1).join('/');
          try {
            const rx = new RegExp(pattern, flags);
            if (rx.test(mText.data)) return true;
          } catch (e) {
            // ignore regexp errors
          }
        }
      }
      return false;
    }

    for (const m of mList) {
      let mText = m.data;
      if (isFullWord) {
        const words = mText.split(' ');
        for (const key of keyList) {
          if (words.includes(key.toLowerCase())) return true;
        }
      } else {
        const cleanMText = mText.replace(/ /g, '');
        for (const key of keyList) {
          const cleanKey = key.toLowerCase().replace(/ /g, '');
          if (cleanKey && cleanMText.includes(cleanKey)) return true;
        }
      }
    }
    return false;
  };

  const firstMatch = checkMatch(keys, !!entry.useRegex);
  if (entry.selective && entry.secondkey) {
    const secondKeys = entry.secondkey.split(',').map((k: string) => k.trim()).filter(Boolean);
    if (secondKeys.length > 0) {
      return firstMatch && checkMatch(secondKeys, !!entry.useRegex);
    }
  }
  return firstMatch;
};

const RenderedMessage: React.FC<{ content: string; enabled: boolean }> = ({ content, enabled }) => {
  if (!enabled) {
    return <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{content}</div>
  }

  try {
    const html = marked.parse(content, { async: false, breaks: true }) as string
    return (
      <div 
        className="btw-markdown-content" 
        dangerouslySetInnerHTML={{ __html: html }} 
      />
    )
  } catch (e) {
    console.error('Markdown parse error:', e)
    return <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{content}</div>
  }
}

interface ParsedMessage {
  reasoning: string
  cleanContent: string
  hasOpenThink: boolean
}

const parseMessage = (text: string): ParsedMessage => {
  if (!text) {
    return { reasoning: '', cleanContent: '', hasOpenThink: false }
  }

  let reasoning = ''
  let cleanContent = text
  let hasOpenThink = false

  // 1. Check for complete <think>...</think> or <thought>...</thought> tags
  const thinkRegex = /<(think|thought)>([\s\S]*?)<\/\1>/gi
  const reasonings: string[] = []
  
  cleanContent = text.replace(thinkRegex, (match, tag, innerText) => {
    reasonings.push(innerText.trim())
    return ''
  })

  // 2. Check for open-ended <think> or <thought> tags (typically when streaming)
  const openTagMatch = /<(think|thought)>([\s\S]*)$/i.exec(cleanContent)
  if (openTagMatch) {
    reasonings.push(openTagMatch[2].trim())
    cleanContent = cleanContent.slice(0, openTagMatch.index)
    hasOpenThink = true
  }

  reasoning = reasonings.join('\n\n').trim()
  cleanContent = cleanContent.trim()

  return { reasoning, cleanContent, hasOpenThink }
}

const CollapsibleReasoning: React.FC<{ content: string; enabled: boolean; isStreaming: boolean }> = ({ content, enabled, isStreaming }) => {
  const [isOpen, setIsOpen] = useState(isStreaming)

  useEffect(() => {
    if (isStreaming) {
      setIsOpen(true)
    }
  }, [isStreaming])

  if (!content) return null

  return (
    <div className="btw-reasoning-container">
      <div 
        className="btw-reasoning-header" 
        onClick={() => setIsOpen(!isOpen)}
        style={{ cursor: 'pointer' }}
      >
        <Brain size={14} className="btw-reasoning-icon" />
        <span className="btw-reasoning-title">
          {isStreaming ? '추론 중...' : '추론 과정'}
        </span>
        <span className="btw-reasoning-toggle">
          {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </div>
      {isOpen && (
        <div className="btw-reasoning-body">
          <RenderedMessage content={content} enabled={enabled} />
        </div>
      )}
    </div>
  )
}

const TriStateCheckbox: React.FC<{
  state: 'force-on' | 'auto' | 'force-off' | 'mixed';
  onChange: (nextState: 'force-on' | 'auto' | 'force-off') => void;
}> = ({ state, onChange }) => {
  const handleClick = () => {
    if (state === 'force-off' || state === 'mixed') {
      onChange('auto');
    } else if (state === 'auto') {
      onChange('force-on');
    } else {
      onChange('force-off');
    }
  };

  let bg = 'transparent';
  let borderColor = 'var(--btw-border)';
  let checkColor = 'transparent';
  let showCheck = false;
  let showDash = false;

  if (state === 'force-on') {
    bg = '#10b981';
    borderColor = '#10b981';
    checkColor = '#ffffff';
    showCheck = true;
  } else if (state === 'auto') {
    bg = 'var(--btw-bg-msg-user)';
    borderColor = 'var(--btw-border)';
    checkColor = 'var(--btw-fg-muted)';
    showCheck = true;
  } else if (state === 'mixed') {
    bg = 'var(--btw-bg-msg-user)';
    borderColor = 'var(--btw-border)';
    checkColor = 'var(--btw-fg-muted)';
    showDash = true;
  }

  return (
    <div 
      onClick={handleClick}
      style={{
        width: '1.1rem',
        height: '1.1rem',
        border: `1px solid ${borderColor}`,
        backgroundColor: bg,
        borderRadius: '3px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        userSelect: 'none',
        flexShrink: 0
      }}
      title={
        state === 'force-on' ? '항상 활성화 (항상 켬)' : 
        state === 'auto' ? '자동 활성화 (키워드 감지)' : 
        state === 'mixed' ? '일부 활성화 (다양함)' : 
        '비활성화 (항상 끔)'
      }
    >
      {showCheck && (
        <svg 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke={checkColor} 
          strokeWidth="4" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          style={{ width: '0.75rem', height: '0.75rem' }}
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
      {showDash && (
        <div style={{ width: '0.5rem', height: '2px', backgroundColor: checkColor }} />
      )}
    </div>
  );
};

export const App: React.FC = () => {
  const [config, setConfig] = useState<PluginConfig>(DEFAULT_CONFIG)
  
  // Multi-thread states
  const [threads, setThreads] = useState<OocThread[]>([])
  const [activeThreadId, setActiveThreadId] = useState<string>('')
  const [messages, setMessages] = useState<OocMessage[]>([])
  
  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(false)
  const isLoadingRef = useRef(false)
  const updateLoading = (val: boolean) => {
    setLoading(val)
    isLoadingRef.current = val
  }
  const [activeTab, setActiveTab] = useState<'chat' | 'settings'>('chat')
  const [activeSettingsTab, setActiveSettingsTab] = useState<'connection' | 'prompt' | 'context'>('connection')
  const [loadingSettings, setLoadingSettings] = useState(false)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  
  // Model fetching states
  const [fetchedModels, setFetchedModels] = useState<Record<string, string[]>>({})
  const [fetchingModels, setFetchingModels] = useState<Record<string, boolean>>({})
  const [customInputMode, setCustomInputMode] = useState<Record<string, boolean>>({})
  
  // Context states
  const [characterId, setCharacterId] = useState<string>('default')
  const [characterName, setCharacterName] = useState<string>('Character')
  const [chatIndex, setChatIndex] = useState<number>(0)
  const [availableLoreEntries, setAvailableLoreEntries] = useState<any[]>([])
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({})
  const [loreSearchTerm, setLoreSearchTerm] = useState('')
  const [chatMessages, setChatMessages] = useState<any[]>([])
  const [loreDepth, setLoreDepth] = useState<number>(10)
  const [fullWordMatching, setFullWordMatching] = useState<boolean>(false)
  
  const [toastMessage, setToastMessage] = useState('')
  const [showToast, setShowToast] = useState(false)

  const chatLogRef = useRef<HTMLDivElement>(null)
  const isMounted = useRef(true)
  const activeThreadIdRef = useRef('')
  const configRef = useRef(config)
  configRef.current = config

  // Trigger toast notifications
  const triggerToast = useCallback((msg: string) => {
    setToastMessage(msg)
    setShowToast(true)
    setTimeout(() => {
      if (isMounted.current) setShowToast(false)
    }, 2000)
  }, [])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      triggerToast('클립보드에 복사되었습니다.')
    }).catch(err => {
      console.error('[BTW Plugin] Clipboard copy failed:', err)
      triggerToast('복사에 실패했습니다.')
    })
  }

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

      // 2. Load active character details
      const char = await api.getCharacter()
      const activeChatIndex = await api.getCurrentChatIndex()

      if (char) {
        const charId = char.chaId || 'default'
        
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

        // 5. Load active thread ID selection
        const activeThreadKey = `btw_active_thread_${charId}_${activeChatIndex}`
        let activeId = await storage.getItem<string>(activeThreadKey)
        
        // Validate activeId is in the list
        if (!activeId || !savedThreads.some(t => t.id === activeId)) {
          activeId = savedThreads[0].id
          await storage.setItem(activeThreadKey, activeId)
        }

        // 6. Load messages of the active BTW thread
        const activeMessages = await loadThreadMessages(activeId)

        // --- SAFE GLOBAL STATE UPDATES ---
        if (savedConfig) {
          let migratedEndpoints = savedConfig.customEndpoints || []
          let activeEpId = savedConfig.activeEndpointId || ''

          if (migratedEndpoints.length === 0) {
            if (savedConfig.customApiUrl) {
              const legacyEp: CustomEndpoint = {
                id: 'legacy-migrated',
                name: '기존 설정',
                apiUrl: savedConfig.customApiUrl,
                apiKey: savedConfig.customApiKey || '',
                model: savedConfig.customModel || 'gpt-4o-mini'
              }
              migratedEndpoints = [legacyEp]
              activeEpId = 'legacy-migrated'
            } else {
              migratedEndpoints = [...DEFAULT_ENDPOINTS]
              activeEpId = DEFAULT_ENDPOINTS[0].id
            }
          }

          setConfig(prev => ({
            ...prev,
            ...savedConfig,
            customEndpoints: migratedEndpoints,
            activeEndpointId: activeEpId,
            includeCharDesc: savedConfig.includeCharDesc !== undefined ? savedConfig.includeCharDesc : (savedConfig.includeLore ?? true),
            includeLorebook: savedConfig.includeLorebook !== undefined ? savedConfig.includeLorebook : (savedConfig.includeLore ?? true),
            includeUserPersona: savedConfig.includeUserPersona !== undefined ? savedConfig.includeUserPersona : false,
            disabledLorebookIds: savedConfig.disabledLorebookIds || [],
            forceEnabledLorebookIds: savedConfig.forceEnabledLorebookIds || []
          }))
        }
        setCharacterId(charId)
        setCharacterName(char.name || 'Character')
        setChatIndex(activeChatIndex)

        // --- CHECKPOINT: Prevent race conditions & state overwrites during generation/thread actions ---
        if (isLoadingRef.current) {
          return
        }
        if (activeThreadIdRef.current && activeId !== activeThreadIdRef.current) {
          return
        }

        // --- SAFE THREAD-SPECIFIC STATE UPDATES ---
        setThreads(savedThreads)

        // Initialize activeThreadIdRef if it was empty
        if (!activeThreadIdRef.current) {
          activeThreadIdRef.current = activeId
        }

        setActiveThreadId(activeId)
        setMessages(activeMessages)
      }
    } catch (e) {
      console.error('[BTW Plugin] Load data error:', e)
      triggerToast('데이터를 불러오지 못했습니다.')
    }
  }, [triggerToast])

  // Load settings data on demand to prevent iframe mount freeze
  const handleOpenSettings = async () => {
    setActiveTab('settings')
    setLoadingSettings(true)
    try {
      if (api) {
        const char = await api.getCharacter()
        const activeChatIndex = await api.getCurrentChatIndex()
        if (char) {
          const charIndex = await api.getCurrentCharacterIndex()
          const chat = await api.getChatFromIndex(charIndex, activeChatIndex)
          const characterLore = char.globalLore ?? []
          const chatLore = chat?.localLore ?? []
          const mappedCharLore = characterLore.map((e: any, idx: number) => ({
            ...e,
            isCharLore: true,
            id: e.id || `char_${idx}_${e.key || ''}_${e.comment || ''}`
          }))
          const mappedChatLore = chatLore.map((e: any, idx: number) => ({
            ...e,
            isCharLore: false,
            id: e.id || `chat_${idx}_${e.key || ''}_${e.comment || ''}`
          }))
          setAvailableLoreEntries(mappedCharLore.concat(mappedChatLore))
          
          const db = await api.getDatabase()
          setChatMessages(chat?.message || [])
          setLoreDepth(char?.loreSettings?.scanDepth ?? db?.loreBookDepth ?? 10)
          setFullWordMatching(db?.fullWordMatching ?? false)
        }
      }
    } catch (e) {
      console.error('[BTW Settings] Lazy load error:', e)
      triggerToast('설정 데이터를 불러오는 데 실패했습니다.')
    } finally {
      setLoadingSettings(false)
    }
  }

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
      triggerToast('설정 저장에 실패했습니다.')
    }
  }

  // Manage multiple custom endpoints
  const handleAddEndpoint = () => {
    const newEp: CustomEndpoint = {
      id: `ep_${Date.now()}`,
      name: `새 API 설정 ${(config.customEndpoints || []).length + 1}`,
      apiUrl: 'https://api.openai.com/v1',
      apiKey: '',
      model: 'gpt-4o-mini'
    }
    const updated = [...(config.customEndpoints || []), newEp]
    saveConfig({
      ...config,
      customEndpoints: updated,
      activeEndpointId: newEp.id
    })
  }

  const handleDeleteEndpoint = (epId: string) => {
    if ((config.customEndpoints || []).length <= 1) {
      triggerToast('최소 한 개의 API 설정은 유지되어야 합니다.')
      return
    }
    const updated = (config.customEndpoints || []).filter(e => e.id !== epId)
    const nextActiveId = updated[0].id
    saveConfig({
      ...config,
      customEndpoints: updated,
      activeEndpointId: nextActiveId
    })
  }

  const handleUpdateActiveEndpoint = (fields: Partial<CustomEndpoint>) => {
    const updated = (config.customEndpoints || []).map(e => 
      e.id === config.activeEndpointId ? { ...e, ...fields } : e
    )
    setConfig({
      ...config,
      customEndpoints: updated
    })
  }

  // Fetch available models list from API endpoint
  const handleFetchModels = async (endpoint: CustomEndpoint) => {
    if (!endpoint.apiUrl) {
      triggerToast('API Base URL을 입력해주세요.')
      return
    }
    setFetchingModels(prev => ({ ...prev, [endpoint.id]: true }))
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      const normalizedKey = normalizeApiKey(endpoint.apiKey)
      if (normalizedKey) {
        headers['Authorization'] = `Bearer ${normalizedKey}`
      }
      const fetchUrl = `${endpoint.apiUrl.replace(/\/$/, '')}/models`
      const res = await api.nativeFetch(fetchUrl, { method: 'GET', headers })
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      const json = await res.json()
      const models: string[] = json.data?.map((m: any) => m.id) || []
      if (models.length === 0) {
        triggerToast('불러온 모델 목록이 비어있습니다.')
      } else {
        setFetchedModels(prev => ({ ...prev, [endpoint.id]: models }))
        setCustomInputMode(prev => ({ ...prev, [endpoint.id]: false }))
        triggerToast(`${models.length}개의 모델을 불러왔습니다.`)
      }
    } catch (e: any) {
      console.error('[BTW Plugin] Fetch models error:', e)
      triggerToast(`모델 목록 로드 실패: ${e.message || e}`)
    } finally {
      setFetchingModels(prev => ({ ...prev, [endpoint.id]: false }))
    }
  }

  // Switch to a different thread
  const handleSelectThread = async (threadId: string) => {
    if (!api || !threadId) return
    try {
      activeThreadIdRef.current = threadId
      const storage = await api.getLocalPluginStorage()
      const activeThreadKey = `btw_active_thread_${characterId}_${chatIndex}`
      await storage.setItem(activeThreadKey, threadId)
      setActiveThreadId(threadId)
      
      const threadMsgs = await loadThreadMessages(threadId)
      if (activeThreadIdRef.current !== threadId) return
      setMessages(threadMsgs)
    } catch (e) {
      console.error('[BTW Plugin] Select thread error:', e)
      triggerToast('대화방 전환에 실패했습니다.')
    }
  }

  // Create a brand new BTW thread
  const handleCreateNewThread = useCallback(async (initialQuery = '') => {
    if (!api) return ''
    try {
      const storage = await api.getLocalPluginStorage()
      const newThreadId = `thread_${characterId}_${chatIndex}_${Math.random().toString(36).substring(2)}_${Date.now()}`
      activeThreadIdRef.current = newThreadId
      
      const title = initialQuery 
        ? (initialQuery.length > 20 ? initialQuery.slice(0, 20) + '...' : initialQuery)
        : '새 대화'

      const newThread: OocThread = {
        id: newThreadId,
        title,
        timestamp: Date.now()
      }

      const threadsKey = `btw_threads_${characterId}_${chatIndex}`
      const currentThreads = await storage.getItem<OocThread[]>(threadsKey) || []
      const updatedThreads = [newThread, ...currentThreads]
      
      await storage.setItem(threadsKey, updatedThreads)
      setThreads(updatedThreads)

      const activeThreadKey = `btw_active_thread_${characterId}_${chatIndex}`
      await storage.setItem(activeThreadKey, newThreadId)
      setActiveThreadId(newThreadId)
      setMessages([])

      return newThreadId
    } catch (e) {
      console.error('[BTW Plugin] Create new thread error:', e)
      triggerToast('새 대화방 생성에 실패했습니다.')
      return ''
    }
  }, [characterId, chatIndex, triggerToast])

  // Keep a ref to the latest handleCreateNewThread to avoid re-triggering useEffect
  const handleCreateNewThreadRef = useRef(handleCreateNewThread)
  handleCreateNewThreadRef.current = handleCreateNewThread

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
      activeThreadIdRef.current = nextActiveId

      const threadsKey = `btw_threads_${characterId}_${chatIndex}`
      await storage.setItem(threadsKey, remainingThreads)
      setThreads(remainingThreads)

      const activeThreadKey = `btw_active_thread_${characterId}_${chatIndex}`
      await storage.setItem(activeThreadKey, nextActiveId)
      setActiveThreadId(nextActiveId)

      const nextMsgs = await loadThreadMessages(nextActiveId)
      if (activeThreadIdRef.current !== nextActiveId) return
      setMessages(nextMsgs)

      triggerToast('대화방이 삭제되었습니다.')
    } catch (e) {
      console.error('[BTW Plugin] Delete thread error:', e)
      triggerToast('대화방 삭제에 실패했습니다.')
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
      triggerToast('대화 저장에 실패했습니다.')
    }
  }

  // Parse key-value strings (e.g. defaultVariables)
  const parseKeyValue = (str: string): { [key: string]: string } => {
    if (!str) return {}
    const res: { [key: string]: string } = {}
    str.split('\n').forEach(line => {
      const idx = line.indexOf('=')
      if (idx === -1) {
        res[line.trim()] = ''
      } else {
        res[line.substring(0, idx).trim()] = line.substring(idx + 1).trim()
      }
    })
    return res
  }

  // Tokenize and build AST from CBS syntax
  interface ASTNode {
    type: 'text' | 'macro' | 'block'
    raw: string
    name?: string
    args?: string[]
    content?: ASTNode[]
    elseContent?: ASTNode[]
  }

  const parseCBS = (text: string): ASTNode[] => {
    const nodes: ASTNode[] = []
    let cursor = 0
    const len = text.length
    const stack: { node: ASTNode; isElse: boolean }[] = []

    while (cursor < len) {
      const top = stack.length > 0 ? stack[stack.length - 1] : null
      const isPureActive = top && (top.node.name === 'puredisplay' || top.node.name === 'pure_display' || top.node.name === 'pure' || top.node.name === 'escape')

      const nextTagIdx = text.indexOf('{{', cursor)
      if (nextTagIdx === -1) {
        const rest = text.substring(cursor)
        if (rest) {
          const targetList = top ? (top.isElse ? top.node.elseContent! : top.node.content!) : nodes
          targetList.push({ type: 'text', raw: rest })
        }
        break
      }

      if (nextTagIdx > cursor) {
        const plainText = text.substring(cursor, nextTagIdx)
        const targetList = top ? (top.isElse ? top.node.elseContent! : top.node.content!) : nodes
        targetList.push({ type: 'text', raw: plainText })
      }

      const endTagIdx = text.indexOf('}}', nextTagIdx + 2)
      if (endTagIdx === -1) {
        const broken = text.substring(nextTagIdx)
        const targetList = top ? (top.isElse ? top.node.elseContent! : top.node.content!) : nodes
        targetList.push({ type: 'text', raw: broken })
        break
      }

      const tagContent = text.substring(nextTagIdx + 2, endTagIdx).trim()
      cursor = endTagIdx + 2

      // If a pure block is active, ignore all tags except the closing tag for this pure block
      if (isPureActive) {
        const isCloseTagForPure = tagContent.startsWith('/') && (tagContent.substring(1).toLowerCase() === top.node.name)
        if (isCloseTagForPure) {
          const finished = stack.pop()!.node
          const parent = stack.length > 0 ? stack[stack.length - 1] : null
          const targetList = parent ? (parent.isElse ? parent.node.elseContent! : parent.node.content!) : nodes
          targetList.push(finished)
        } else {
          const rawTagText = `{{${tagContent}}}`
          const targetList = top ? (top.isElse ? top.node.elseContent! : top.node.content!) : nodes
          targetList.push({ type: 'text', raw: rawTagText })
        }
        continue
      }

      // Filter out comment tags
      if (tagContent.startsWith('//')) {
        continue
      }

      if (tagContent === ':else') {
        if (top && top.node.type === 'block') {
          top.isElse = true
        } else {
          nodes.push({ type: 'text', raw: '{{:else}}' })
        }
      } else if (tagContent.startsWith('#')) {
        const fullTag = tagContent.substring(1)
        const parts = fullTag.split('::')
        const name = parts[0]
        const args = parts.slice(1)
        const blockNode: ASTNode = {
          type: 'block',
          raw: `{{${tagContent}}}`,
          name,
          args,
          content: [],
          elseContent: []
        }
        stack.push({ node: blockNode, isElse: false })
      } else if (tagContent.startsWith('/')) {
        const closeTagName = tagContent.substring(1).toLowerCase()
        let foundIdx = -1
        for (let i = stack.length - 1; i >= 0; i--) {
          if (stack[i].node.name?.toLowerCase() === closeTagName) {
            foundIdx = i
            break
          }
        }

        if (foundIdx !== -1) {
          while (stack.length > foundIdx) {
            const finished = stack.pop()!.node
            const parent = stack.length > 0 ? stack[stack.length - 1] : null
            const targetList = parent ? (parent.isElse ? parent.node.elseContent! : parent.node.content!) : nodes
            targetList.push(finished)
          }
        } else {
          const targetList = top ? (top.isElse ? top.node.elseContent! : top.node.content!) : nodes
          targetList.push({ type: 'text', raw: `{{${tagContent}}}` })
        }
      } else {
        // Single macro tag
        const parts = tagContent.split('::')
        const name = parts[0]
        const args = parts.slice(1)
        const macroNode: ASTNode = {
          type: 'macro',
          raw: `{{${tagContent}}}`,
          name,
          args
        }
        const targetList = top ? (top.isElse ? top.node.elseContent! : top.node.content!) : nodes
        targetList.push(macroNode)
      }
    }

    while (stack.length > 0) {
      const unfinished = stack.pop()!.node
      nodes.push(unfinished)
    }

    return nodes
  }

  // Stack-based condition evaluation for #when blocks
  const evaluateWhen = (
    args: string[], 
    context: { charName: string; userName: string; userPersona: string; chatVars: { [key: string]: string } }
  ): boolean => {
    if (args.length === 0) return false
    if (args.length === 1) {
      return args[0] === 'true' || args[0] === '1'
    }

    const statement = [...args]
    const isTruthy = (s: string) => s === 'true' || s === '1'

    while (statement.length > 1) {
      const condition = statement.pop() || ''
      const operator = statement.pop() || ''

      switch (operator) {
        case 'not':
          statement.push(isTruthy(condition) ? '0' : '1')
          break
        case 'keep':
        case 'legacy':
          statement.push(condition)
          break
        case 'and': {
          const condition2 = statement.pop() || ''
          statement.push((isTruthy(condition) && isTruthy(condition2)) ? '1' : '0')
          break
        }
        case 'or': {
          const condition2 = statement.pop() || ''
          statement.push((isTruthy(condition) || isTruthy(condition2)) ? '1' : '0')
          break
        }
        case 'is': {
          const condition2 = statement.pop() || ''
          statement.push(condition === condition2 ? '1' : '0')
          break
        }
        case 'isnot': {
          const condition2 = statement.pop() || ''
          statement.push(condition !== condition2 ? '1' : '0')
          break
        }
        case 'var': {
          const val = context.chatVars[condition] || 'null'
          statement.push(isTruthy(val) ? '1' : '0')
          break
        }
        case 'toggle': {
          statement.push('0') // default fallback
          break
        }
        case 'vis': {
          const varName = statement.pop() || ''
          const val = context.chatVars[varName] || 'null'
          statement.push(val === condition ? '1' : '0')
          break
        }
        case 'visnot': {
          const varName = statement.pop() || ''
          const val = context.chatVars[varName] || 'null'
          statement.push(val !== condition ? '1' : '0')
          break
        }
        case '>': {
          const condition2 = statement.pop() || ''
          statement.push(parseFloat(condition2) > parseFloat(condition) ? '1' : '0')
          break
        }
        case '<': {
          const condition2 = statement.pop() || ''
          statement.push(parseFloat(condition2) < parseFloat(condition) ? '1' : '0')
          break
        }
        case '>=': {
          const condition2 = statement.pop() || ''
          statement.push(parseFloat(condition2) >= parseFloat(condition) ? '1' : '0')
          break
        }
        case '<=': {
          const condition2 = statement.pop() || ''
          statement.push(parseFloat(condition2) <= parseFloat(condition) ? '1' : '0')
          break
        }
        default:
          statement.push(isTruthy(condition) ? '1' : '0')
          break
      }
    }

    return isTruthy(statement[0])
  }

  // Resolve single macro evaluation
  const evaluateMacro = (
    name: string, 
    args: string[], 
    context: { charName: string; userName: string; userPersona: string; chatVars: { [key: string]: string } }
  ): string => {
    if (name.startsWith('slot::')) {
      return context.chatVars[name] !== undefined ? context.chatVars[name] : 'null'
    }

    const macroMap: { [key: string]: string } = {
      'char': context.charName,
      'bot': context.charName,
      'user': context.userName,
      'persona': context.userPersona,
      'userpersona': context.userPersona,
      'description': context.chatVars['__description__'] || '',
      'chardesc': context.chatVars['__description__'] || '',
      'personality': context.chatVars['__personality__'] || '',
      'charpersona': context.chatVars['__personality__'] || '',
      'scenario': context.chatVars['__scenario__'] || '',
      'exampledialogue': context.chatVars['__exampleDialogue__'] || '',
      'examplemessage': context.chatVars['__exampleDialogue__'] || '',
      'example_dialogue': context.chatVars['__exampleDialogue__'] || '',
      'mainprompt': context.chatVars['__mainPrompt__'] || '',
      'systemprompt': context.chatVars['__mainPrompt__'] || '',
      'main_prompt': context.chatVars['__mainPrompt__'] || '',
      'jb': context.chatVars['__jailbreak__'] || '',
      'jailbreak': context.chatVars['__jailbreak__'] || '',
      'globalnote': context.chatVars['__globalNote__'] || '',
      'systemnote': context.chatVars['__globalNote__'] || '',
      'ujb': context.chatVars['__globalNote__'] || '',
      'authornote': context.chatVars['__authorNote__'] || '',
      'author_note': context.chatVars['__authorNote__'] || '',
      'lastmessage': context.chatVars['__lastMessage__'] || '',
      'lastmessageid': context.chatVars['__lastMessageId__'] || '0',
      'lastmessageindex': context.chatVars['__lastMessageId__'] || '0',
      'previouscharchat': context.chatVars['__previousCharChat__'] || '',
      'lastcharmessage': context.chatVars['__previousCharChat__'] || '',
      'previoususerchat': context.chatVars['__previousUserChat__'] || '',
      'lastusermessage': context.chatVars['__previousUserChat__'] || '',
      'chatindex': context.chatVars['__chatIndex__'] || '0',
      'chat_index': context.chatVars['__chatIndex__'] || '0',
      'isfirstmsg': '0',
      'isfirstmessage': '0',
      'role': 'user',
      'br': '\n',
      'newline': '\n',
      'blank': '',
      'none': '',
      // Literal Escapes
      'decbo': '{',
      'displayescapedcurlybracketopen': '{',
      'decbc': '}',
      'displayescapedcurlybracketclose': '}',
      'bo': '{{',
      'ddecbo': '{{',
      'doubledisplayescapedcurlybracketopen': '{{',
      'bc': '}}',
      'ddecbc': '}}',
      'doubledisplayescapedcurlybracketclose': '}}',
      'displayescapedbracketopen': '(',
      'debo': '(',
      '(': '(',
      'displayescapedbracketclose': ')',
      'debc': ')',
      ')': ')',
      'displayescapedanglebracketopen': '<',
      'deabo': '<',
      '<': '<',
      'displayescapedanglebracketclose': '>',
      'deabc': '>',
      '>': '>',
      'displayescapedcolon': ':',
      'dec': ':',
      ':': ':',
      'displayescapedsemicolon': ';',
      ';': ';',
    }

    if (macroMap[name] !== undefined) {
      return macroMap[name]
    }

    // 1. Variable control
    if (name === 'getvar') {
      const key = args[0]
      return context.chatVars[key] !== undefined ? context.chatVars[key] : 'null'
    }
    if (name === 'tempvar' || name === 'gettempvar') {
      const key = args[0]
      return context.chatVars[`temp::${key}`] !== undefined ? context.chatVars[`temp::${key}`] : 'null'
    }
    if (name === 'setvar' || name === 'settempvar') {
      const key = args[0]
      const val = args[1] || ''
      const prefix = name === 'settempvar' ? 'temp::' : ''
      context.chatVars[prefix + key] = val
      return ''
    }
    if (name === 'setdefaultvar') {
      const key = args[0]
      const val = args[1] || ''
      if (context.chatVars[key] === undefined || context.chatVars[key] === 'null' || context.chatVars[key] === '') {
        context.chatVars[key] = val
      }
      return ''
    }
    if (name === 'addvar') {
      const key = args[0]
      const val = parseFloat(args[1] || '0')
      const cur = parseFloat(context.chatVars[key] || '0')
      context.chatVars[key] = String(cur + val)
      return ''
    }

    // 2. Chat Log specific index query (previouschatlog::index)
    if (name === 'previouschatlog' || name === 'previous_chat_log') {
      const idx = parseInt(args[0] || '-1')
      const logStr = context.chatVars[`__chatlog::${idx}__`]
      return logStr !== undefined ? logStr : 'Out of range'
    }

    // 3. String Operations
    if (name === 'startswith') {
      return (args[0] || '').startsWith(args[1] || '') ? '1' : '0'
    }
    if (name === 'endswith') {
      return (args[0] || '').endsWith(args[1] || '') ? '1' : '0'
    }
    if (name === 'contains') {
      return (args[0] || '').includes(args[1] || '') ? '1' : '0'
    }
    if (name === 'replace') {
      const s = args[0] || ''
      const oldVal = args[1] || ''
      const newVal = args[2] || ''
      return s.split(oldVal).join(newVal)
    }
    if (name === 'lower') {
      return (args[0] || '').toLowerCase()
    }
    if (name === 'upper') {
      return (args[0] || '').toUpperCase()
    }
    if (name === 'trim') {
      return (args[0] || '').trim()
    }
    if (name === 'length') {
      return String((args[0] || '').length)
    }

    // 4. Date & Time
    if (name === 'time') {
      const date = new Date()
      return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`
    }
    if (name === 'date' || name === 'datetimeformat') {
      const date = new Date()
      return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
    }
    if (name === 'unixtime') {
      return String(Math.floor(Date.now() / 1000))
    }
    if (name === 'isodate') {
      const date = new Date()
      return `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}`
    }
    if (name === 'isotime') {
      const date = new Date()
      return `${date.getUTCHours()}:${String(date.getUTCMinutes()).padStart(2, '0')}:${String(date.getUTCSeconds()).padStart(2, '0')}`
    }

    // 5. Math & calc
    if (name === 'calc') {
      try {
        const expr = args[0] || '0'
        const sanitized = expr.replace(/[^0-9+\-*/().\s]/g, '')
        const evaluated = Function(`"use strict"; return (${sanitized})`)()
        return String(evaluated)
      } catch (e) {
        return '0'
      }
    }
    if (name === 'round') return String(Math.round(parseFloat(args[0] || '0')))
    if (name === 'floor') return String(Math.floor(parseFloat(args[0] || '0')))
    if (name === 'ceil') return String(Math.ceil(parseFloat(args[0] || '0')))
    if (name === 'abs') return String(Math.abs(parseFloat(args[0] || '0')))

    // 6. Array & Object Operations
    if (name === 'makearray' || name === 'array' || name === 'a') {
      return JSON.stringify(args)
    }
    if (name === 'arraylength') {
      try {
        const arr = JSON.parse(args[0] || '[]')
        return String(Array.isArray(arr) ? arr.length : 0)
      } catch (e) {
        console.warn(`[BTW Plugin] CBS macro 'arraylength' JSON parse failed:`, e, 'Input:', args[0])
        return '0'
      }
    }
    if (name === 'arrayelement') {
      try {
        const arr = JSON.parse(args[0] || '[]')
        const idx = parseInt(args[1] || '0')
        if (Array.isArray(arr)) {
          const val = idx < 0 ? arr[arr.length + idx] : arr[idx]
          return val !== undefined ? (typeof val === 'object' ? JSON.stringify(val) : String(val)) : 'null'
        }
        return 'null'
      } catch (e) {
        console.warn(`[BTW Plugin] CBS macro 'arrayelement' JSON parse failed:`, e, 'Input:', args[0])
        return 'null'
      }
    }
    if (name === 'makedict' || name === 'dict' || name === 'd' || name === 'object' || name === 'o' || name === 'makeobject') {
      const obj: { [key: string]: string } = {}
      args.forEach(arg => {
        const idx = arg.indexOf('=')
        if (idx !== -1) {
          obj[arg.substring(0, idx).trim()] = arg.substring(idx + 1).trim()
        }
      })
      return JSON.stringify(obj)
    }
    if (name === 'dictelement' || name === 'objectelement') {
      try {
        const obj = JSON.parse(args[0] || '{}')
        const key = args[1] || ''
        const val = obj[key]
        return val !== undefined ? (typeof val === 'object' ? JSON.stringify(val) : String(val)) : 'null'
      } catch (e) {
        console.warn(`[BTW Plugin] CBS macro 'dictelement' JSON parse failed:`, e, 'Input:', args[0])
        return 'null'
      }
    }

    // 7. Logic variadic operators (all, any)
    if (name === 'all') {
      const isTruthy = (s: string) => s === 'true' || s === '1'
      const res = args.every(isTruthy)
      return res ? '1' : '0'
    }
    if (name === 'any') {
      const isTruthy = (s: string) => s === 'true' || s === '1'
      const res = args.some(isTruthy)
      return res ? '1' : '0'
    }
    
    // 8. Randomization & dice
    if (name === 'randint') {
      const min = parseInt(args[0] || '0')
      const max = parseInt(args[1] || '0')
      return String(Math.floor(Math.random() * (max - min + 1)) + min)
    }
    if (name === 'roll') {
      const notation = args[0] || '1d6'
      const match = notation.match(/^(\d+)[dD](\d+)$/)
      if (match) {
        const X = parseInt(match[1])
        const Y = parseInt(match[2])
        let sum = 0
        for (let i = 0; i < X; i++) {
          sum += Math.floor(Math.random() * Y) + 1
        }
        return String(sum)
      }
      const sides = parseInt(notation)
      if (!isNaN(sides)) {
        return String(Math.floor(Math.random() * sides) + 1)
      }
      return '1'
    }
    if (name === 'rollp' || name === 'rollpick') {
      const notation = args[0] || '1d6'
      const sides = parseInt(notation.replace(/^\d+[dD]/, '')) || 6
      return String((Math.floor(Math.random() * sides) + 1))
    }

    // 9. Caesar & XOR Cryptography
    if (name === 'crypt' || name === 'caesar' || name === 'encrypt' || name === 'decrypt') {
      const s = args[0] || ''
      const shift = parseInt(args[1] || '32768')
      return s.split('').map(c => String.fromCharCode((c.charCodeAt(0) + shift) % 65536)).join('')
    }
    if (name === 'xor' || name === 'xorencrypt' || name === 'xorencode' || name === 'xore') {
      const s = args[0] || ''
      const xored = s.split('').map(c => String.fromCharCode(c.charCodeAt(0) ^ 0xFF)).join('')
      return btoa(unescape(encodeURIComponent(xored)))
    }
    if (name === 'xordecrypt' || name === 'xordecode' || name === 'xord') {
      try {
        const b64 = args[0] || ''
        const decoded = decodeURIComponent(escape(atob(b64)))
        return decoded.split('').map(c => String.fromCharCode(c.charCodeAt(0) ^ 0xFF)).join('')
      } catch {
        return 'Error: Invalid base64 for xordecrypt'
      }
    }

    // 10. Lorebook / worldinfo
    if (name === 'lorebook' || name === 'worldinfo') {
      return context.chatVars['__lorebook__'] || '[]'
    }

    const argString = args.length > 0 ? '::' + args.join('::') : ''
    return `{{${name}${argString}}}`
  }

  // AST tree recursive evaluator
  const evaluateCBS = (
    nodes: ASTNode[], 
    context: { charName: string; userName: string; userPersona: string; chatVars: { [key: string]: string } }
  ): string => {
    let result = ''

    for (const node of nodes) {
      if (node.type === 'text') {
        result += node.raw
      } else if (node.type === 'macro') {
        const evaluatedArgs = node.args ? node.args.map(arg => evaluateCBS(parseCBS(arg), context)) : []
        const evaluatedName = node.name ? node.name.toLowerCase() : ''
        result += evaluateMacro(evaluatedName, evaluatedArgs, context)
      } else if (node.type === 'block') {
        const evaluatedArgs = node.args ? node.args.map(arg => evaluateCBS(parseCBS(arg), context)) : []
        const evaluatedName = node.name ? node.name.toLowerCase() : ''

        if (evaluatedName === 'when' || evaluatedName === 'if' || evaluatedName === 'if_pure') {
          const conditionResult = evaluateWhen(evaluatedArgs, context)
          if (conditionResult) {
            result += evaluateCBS(node.content || [], context)
          } else {
            result += evaluateCBS(node.elseContent || [], context)
          }
        } else if (evaluatedName === 'each') {
          const lastArg = evaluatedArgs[evaluatedArgs.length - 1] || ''
          const asIdx = lastArg.lastIndexOf(' as ')
          let varName = 'V'
          let arrayJson = '[]'

          if (asIdx !== -1) {
            varName = lastArg.substring(asIdx + 4).trim()
            const firstPart = lastArg.substring(0, asIdx).trim()
            const prevParts = evaluatedArgs.slice(0, -1)
            arrayJson = prevParts.concat(firstPart).join('::')
          } else {
            arrayJson = evaluatedArgs.join('::')
          }

          try {
            const arr = JSON.parse(arrayJson)
            if (Array.isArray(arr)) {
              arr.forEach(item => {
                const itemStr = typeof item === 'object' ? JSON.stringify(item) : String(item)
                const newContext = {
                  ...context,
                  chatVars: {
                    ...context.chatVars,
                    [`slot::${varName}`]: itemStr
                  }
                }
                result += evaluateCBS(node.content || [], newContext)
              })
            }
          } catch (e) {
            console.error('[BTW Plugin] Failed to parse array in #each:', e)
          }
        } else if (evaluatedName === 'puredisplay' || evaluatedName === 'pure_display' || evaluatedName === 'pure' || evaluatedName === 'escape') {
          const getRawChildrenText = (childs: ASTNode[]): string => {
            return childs.map(c => {
              if (c.type === 'text') return c.raw
              if (c.type === 'macro') return c.raw
              if (c.type === 'block') {
                const inner = getRawChildrenText(c.content || [])
                const elseInner = c.elseContent && c.elseContent.length > 0 ? '{{:else}}' + getRawChildrenText(c.elseContent) : ''
                const closeName = c.name || ''
                return `${c.raw}${inner}${elseInner}{{/${closeName}}}`
              }
              return ''
            }).join('')
          }
          result += getRawChildrenText(node.content || [])
        } else {
          result += evaluateCBS(node.content || [], context)
        }
      }
    }

    return result
  }

  // Assemble roleplay context
  const assembleContext = async () => {
    if (!api) return { systemPromptContent: configRef.current.systemPrompt, historyContextMsgs: [] as { role: 'user' | 'assistant'; content: string }[] }

    let systemPromptContent = configRef.current.systemPrompt
    let historyContextMsgs: { role: 'user' | 'assistant'; content: string }[] = []

    try {
      const char = await api.getCharacter()
      
      const charName = char ? (char.nickname || char.name || 'Character') : 'Character'
      let userName = 'User'
      let userPersona = ''
      let chatVars: { [key: string]: string } = {}

      try {
        const db = await api.getDatabase()
        if (db) {
          const personas = db.personas || []
          
          const charIndex = await api.getCurrentCharacterIndex()
          const activeChatIndex = await api.getCurrentChatIndex()
          const chat = await api.getChatFromIndex(charIndex, activeChatIndex)
          
          let activePersona = null
          
          // First try to find binded persona for the current chat room
          const bindedPersonaId = chat?.bindedPersona
          if (bindedPersonaId) {
            activePersona = personas.find((p: any) => p.id === bindedPersonaId)
          }
          
          // Fallback to globally selected persona (which is an index number in db.selectedPersona)
          if (!activePersona) {
            const selectedIdx = typeof (db as any).selectedPersona === 'number' ? (db as any).selectedPersona : 0
            activePersona = personas[selectedIdx] || personas[0]
          }

          if (activePersona) {
            userName = activePersona.name || 'User'
            userPersona = activePersona.personaPrompt || ''
          }

          // Populate core metadata fields for CBS macro expansions
          chatVars['__description__'] = char?.desc || char?.description || ''
          chatVars['__personality__'] = char?.personality || ''
          chatVars['__scenario__'] = char?.scenario || ''
          chatVars['__exampleDialogue__'] = char?.exampleMessage || ''
          chatVars['__mainPrompt__'] = char?.systemPrompt || ''
          chatVars['__jailbreak__'] = (db as any).jailbreak || ''
          chatVars['__globalNote__'] = (db as any).globalNote || ''
          chatVars['__authorNote__'] = chat?.note || ''

          if (chat && chat.message) {
            chatVars['__chatIndex__'] = chat.message.length.toString()
            chatVars['__lastMessageId__'] = (chat.message.length - 1).toString()
            
            const lastMsgObj = chat.message[chat.message.length - 1]
            chatVars['__lastMessage__'] = lastMsgObj ? (lastMsgObj.data || '') : ''

            let prevCharMsg = ''
            for (let i = chat.message.length - 1; i >= 0; i--) {
              if (chat.message[i].role === 'char') {
                prevCharMsg = chat.message[i].data || ''
                break
              }
            }
            chatVars['__previousCharChat__'] = prevCharMsg

            let prevUserMsg = ''
            for (let i = chat.message.length - 1; i >= 0; i--) {
              if (chat.message[i].role === 'user') {
                prevUserMsg = chat.message[i].data || ''
                break
              }
            }
            chatVars['__previousUserChat__'] = prevUserMsg

            chat.message.forEach((msg: any, idx: number) => {
              chatVars[`__chatlog::${idx}__`] = msg.data || ''
            })
          } else {
            chatVars['__chatIndex__'] = '0'
            chatVars['__lastMessageId__'] = '0'
            chatVars['__lastMessage__'] = ''
            chatVars['__previousCharChat__'] = ''
            chatVars['__previousUserChat__'] = ''
          }

          // Parse Default Variables
          const defaultVars = parseKeyValue(char?.defaultVariables || '')
          
          // Parse Script Variables from the active Chat
          const scriptstate = chat?.scriptstate || {}

          // Merge: default variables are overwritten by active chat variables
          Object.keys(defaultVars).forEach(k => {
            chatVars[k] = defaultVars[k]
          })
          Object.keys(scriptstate).forEach(k => {
            if (k.startsWith('$')) {
              const varName = k.substring(1)
              chatVars[varName] = String(scriptstate[k])
            }
          })

          const characterLore = char.globalLore ?? []
          const chatLore = chat?.localLore ?? []
          const mappedCharLore = characterLore.map((e: any, idx: number) => ({
            ...e,
            isCharLore: true,
            id: e.id || `char_${idx}_${e.key || ''}_${e.comment || ''}`
          }))
          const mappedChatLore = chatLore.map((e: any, idx: number) => ({
            ...e,
            isCharLore: false,
            id: e.id || `chat_${idx}_${e.key || ''}_${e.comment || ''}`
          }))
          const rawLoreEntries = mappedCharLore.concat(mappedChatLore)
          chatVars['__lorebook__'] = JSON.stringify(rawLoreEntries)
        }
      } catch (e) {
        console.error('[BTW Plugin] Failed to load user persona or variables:', e)
      }

      const contextData = { charName, userName, userPersona, chatVars }

      // Also render the system prompt itself, in case it contains macros like {{char}} or {{user}}
      systemPromptContent = evaluateCBS(parseCBS(systemPromptContent), contextData)
      
      const hasActiveContext = 
        configRef.current.includeCharDesc || 
        configRef.current.includeLorebook || 
        configRef.current.includeUserPersona;

      if (hasActiveContext && char) {
        let contextBlock = `\n\n[Active Character Context]\nCharacter Name: ${charName}`

        if (configRef.current.includeCharDesc) {
          const renderedDesc = evaluateCBS(parseCBS(char.desc || char.description || ''), contextData)
          contextBlock += `\nDescription: ${renderedDesc}`
        }
        if (configRef.current.includeUserPersona) {
          contextBlock += `\nUser Name: ${userName}`
          if (userPersona) {
            contextBlock += `\nUser Persona: ${userPersona}`
          }
        }

        if (configRef.current.includeLorebook) {
          // Exclude module lorebooks by fetching globalLore and chat localLore directly
          const charIndex = await api.getCurrentCharacterIndex()
          const activeChatIndex = await api.getCurrentChatIndex()
          const chat = await api.getChatFromIndex(charIndex, activeChatIndex)
          const characterLore = char.globalLore ?? []
          const chatLore = chat?.localLore ?? []
          const mappedCharLore = characterLore.map((e: any, idx: number) => ({
            ...e,
            isCharLore: true,
            id: e.id || `char_${idx}_${e.key || ''}_${e.comment || ''}`
          }))
          const mappedChatLore = chatLore.map((e: any, idx: number) => ({
            ...e,
            isCharLore: false,
            id: e.id || `chat_${idx}_${e.key || ''}_${e.comment || ''}`
          }))
          const rawLoreEntries = mappedCharLore.concat(mappedChatLore)

          const disabledIds = configRef.current.disabledLorebookIds || []
          const forceEnabledIds = configRef.current.forceEnabledLorebookIds || []
          const db = await api.getDatabase()
          const scanDepthVal = char?.loreSettings?.scanDepth ?? db?.loreBookDepth ?? 10
          const isFullWordVal = db?.fullWordMatching ?? false
          const chatMsgs = chat?.message || []

          const activeLoreEntries = rawLoreEntries.filter((e: any) => {
            if (e.mode === 'folder') return false;
            if (disabledIds.includes(e.id)) return false;
            if (forceEnabledIds.includes(e.id)) return true;
            return isLorebookTriggered(e, chatMsgs, scanDepthVal, isFullWordVal);
          })

          const loreText = activeLoreEntries && activeLoreEntries.length > 0 
            ? activeLoreEntries.map((e: any, i: number) => {
                const renderedKey = evaluateCBS(parseCBS(e.key || ''), contextData)
                const renderedContent = evaluateCBS(parseCBS(e.content || ''), contextData)
                return `[Lore Entry #${i+1}]\nKeys: ${renderedKey}\nContent: ${renderedContent}`
              }).join('\n\n')
            : 'None'

          contextBlock += `\n\n[Active World Lorebook]\n${loreText}`
        }

        systemPromptContent += contextBlock
      }

      if (configRef.current.contextDepth !== 'none') {
        const charIndex = await api.getCurrentCharacterIndex()
        const activeChatIndex = await api.getCurrentChatIndex()
        const chat = await api.getChatFromIndex(charIndex, activeChatIndex)
        
        if (chat && chat.message && chat.message.length > 0) {
          let targetMessages = chat.message;
          if (configRef.current.contextDepth === '1') {
            targetMessages = chat.message.slice(-1)
          } else if (configRef.current.contextDepth === '5') {
            targetMessages = chat.message.slice(-5)
          } else if (configRef.current.contextDepth === '10') {
            targetMessages = chat.message.slice(-10)
          }
          
          historyContextMsgs = targetMessages.map((m: any) => {
            const sender = m.name || (m.role === 'user' ? userName : charName);
            const renderedData = evaluateCBS(parseCBS(m.data || ''), contextData);
            return {
              role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
              content: `[Roleplay] (${sender}): ${renderedData}`
            }
          })
        }
      }
    } catch (e) {
      console.error('[BTW Plugin] Context assembly error:', e)
    }

    return { systemPromptContent, historyContextMsgs }
  }

  // Trigger Send Message
  const triggerSend = async (queryText: string, targetThreadId?: string) => {
    const activeId = targetThreadId || activeThreadId
    if (!queryText.trim() || loading || !api || !activeId) return

    updateLoading(true)

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
    
    setMessages(prev => [...prev, {
      id: aiMsgId,
      role: 'ai',
      content: '',
      timestamp: Date.now()
    }])

    await executeLLMCall(aiMsgId, currentThreadMsgs, activeId)
  }

  const triggerSendRef = useRef(triggerSend)
  triggerSendRef.current = triggerSend

  // Helper to execute LLM API call and update state/storage
  const executeLLMCall = async (aiMsgId: string, currentThreadMsgs: OocMessage[], activeId: string) => {
    let aiContent = ''
    let modelName = ''

    if (configRef.current.provider === 'risu') {
      const mode = configRef.current.customModelMode === 'otherAx' ? '보조 모델' : '메인 모델'
      modelName = `RisuAI (${mode})`
    } else {
      const activeEp = configRef.current.customEndpoints?.find(e => e.id === configRef.current.activeEndpointId)
      if (activeEp) {
        modelName = `${activeEp.name} (${activeEp.model})`
      } else {
        modelName = configRef.current.customModel || 'Custom API'
      }
    }

    try {
      const { systemPromptContent, historyContextMsgs } = await assembleContext()

      const rawMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
        { role: 'system', content: systemPromptContent }
      ]

      if (historyContextMsgs && historyContextMsgs.length > 0) {
        rawMessages.push({ role: 'system', content: '[Main Roleplay History - For reference context]' })
        historyContextMsgs.forEach(m => {
          rawMessages.push({ role: m.role, content: m.content })
        })
        rawMessages.push({ role: 'system', content: '[End of Main Roleplay History. The following is the active OOC thread.]' })
      }

      currentThreadMsgs.forEach(m => {
        rawMessages.push({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: `[OOC] ${m.content}`
        })
      })

      // Merge consecutive user/assistant messages to avoid validation errors on APIs (e.g. Anthropic)
      const messagesToSend: { role: 'system' | 'user' | 'assistant'; content: string }[] = []
      let lastActiveRole: 'user' | 'assistant' | null = null
      let lastActiveIndex = -1

      rawMessages.forEach(m => {
        if (m.role === 'system') {
          messagesToSend.push({ role: 'system', content: m.content })
        } else {
          if (lastActiveRole === m.role && lastActiveIndex !== -1) {
            messagesToSend[lastActiveIndex].content += '\n' + m.content
          } else {
            messagesToSend.push({ role: m.role, content: m.content })
            lastActiveRole = m.role
            lastActiveIndex = messagesToSend.length - 1
          }
        }
      })

      if (configRef.current.provider === 'risu') {
        // --- Option 1: RisuAI Built-in LLM Model ---
        const response = await api.runLLMModel({
          messages: messagesToSend as any[],
          mode: configRef.current.customModelMode,
          allowPlugins: true
        })

        if (!response) {
          throw new Error('RisuAI LLM 모델로부터 응답을 받지 못했습니다.')
        }

        if (response.type === 'success' && typeof response.result === 'string') {
          aiContent = response.result
          updateAiMessage(aiMsgId, aiContent, currentThreadMsgs, activeId, true, modelName)
        } else if (response.type === 'streaming') {
          const reader = response.result.getReader()
          const streamEnabled = configRef.current.streamResponse ?? true
          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              if (value && typeof value['0'] === 'string') {
                aiContent = value['0']
                if (streamEnabled) {
                  updateAiMessage(aiMsgId, aiContent, currentThreadMsgs, activeId, false, modelName)
                }
              }
            }
            updateAiMessage(aiMsgId, aiContent, currentThreadMsgs, activeId, true, modelName)
          } finally {
            reader.releaseLock()
          }
        } else {
          throw new Error('지원하지 않는 RisuAI 응답 형식입니다.')
        }

      } else {
        // --- Option 2: Custom OpenAI Compatible API ---
        const activeEp = configRef.current.customEndpoints?.find(e => e.id === configRef.current.activeEndpointId)
        if (!activeEp) {
          throw new Error('활성화된 외부 API 설정이 없습니다.')
        }

        if (!activeEp.apiUrl) {
          throw new Error('외부 API Base URL이 구성되지 않았습니다.')
        }

        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        }

        if (activeEp.apiKey) {
          const normalizedKey = normalizeApiKey(activeEp.apiKey)
          if (normalizedKey) {
            headers['Authorization'] = `Bearer ${normalizedKey}`
          }
        }

        const fetchUrl = `${activeEp.apiUrl.replace(/\/$/, '')}/chat/completions`
        const streamEnabled = configRef.current.streamResponse ?? true

        const body = {
          model: activeEp.model,
          messages: messagesToSend,
          stream: streamEnabled
        }

        const res = await api.nativeFetch(fetchUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(body)
        })

        if (!res.ok) {
          throw new Error(await parseApiErrorMessage(res))
        }

        if (streamEnabled) {
          const reader = res.body?.getReader()
          if (!reader) {
            throw new Error('응답 스트림을 읽을 수 없습니다.')
          }

          const decoder = new TextDecoder()
          let buffer = ''
          let aiReasoning = ''
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
                     const delta = json.choices?.[0]?.delta
                     const chunkText = delta?.content || ''
                     const reasoningText = delta?.reasoning_content || ''

                     if (reasoningText) {
                       aiReasoning += reasoningText
                       const formattedContent = `<think>${aiReasoning}`
                       updateAiMessage(aiMsgId, formattedContent, currentThreadMsgs, activeId, false, modelName)
                     } else if (chunkText) {
                       aiContent += chunkText
                       const formattedContent = aiReasoning
                         ? `<think>${aiReasoning}</think>\n${aiContent}`
                         : aiContent
                       updateAiMessage(aiMsgId, formattedContent, currentThreadMsgs, activeId, false, modelName)
                     }
                  } catch (e) {
                    // ignore JSON parse error
                  }
                }
              }
            }
            const finalContent = aiReasoning
              ? `<think>${aiReasoning}</think>\n${aiContent}`
              : aiContent
            updateAiMessage(aiMsgId, finalContent, currentThreadMsgs, activeId, true, modelName)
          } finally {
            reader.releaseLock()
          }
        } else {
          const json = await res.json()
          const content = json.choices?.[0]?.message?.content || ''
          const reasoning = json.choices?.[0]?.message?.reasoning_content || ''
          if (!content && !reasoning) {
            throw new Error('API로부터 응답 내용을 받지 못했습니다.')
          }
          aiContent = reasoning ? `<think>${reasoning}</think>\n${content}` : content
          updateAiMessage(aiMsgId, aiContent, currentThreadMsgs, activeId, true, modelName)
        }
      }

    } catch (e: any) {
      console.error('[BTW Plugin] Generation error:', e)
      aiContent = `⚠️ 오류가 발생했습니다: ${e.message || e}`
      updateAiMessage(aiMsgId, aiContent, currentThreadMsgs, activeId, true, modelName)
    } finally {
      updateLoading(false)
    }
  }

  // Reroll last AI response
  const handleReroll = async () => {
    if (loading || !api || !activeThreadId || messages.length === 0) return

    const lastMsg = messages[messages.length - 1]
    if (lastMsg.role !== 'ai') return

    updateLoading(true)

    const currentThreadMsgs = messages.slice(0, -1)
    setMessages(currentThreadMsgs)
    await saveThreadMessages(activeThreadId, currentThreadMsgs)

    const aiMsgId = Math.random().toString(36).substring(2)
    setMessages(prev => [...prev, {
      id: aiMsgId,
      role: 'ai',
      content: '',
      timestamp: Date.now()
    }])

    await executeLLMCall(aiMsgId, currentThreadMsgs, activeThreadId)
  }

  // Start editing a user message
  const handleStartEdit = (msgId: string, content: string) => {
    setEditingMessageId(msgId)
    setEditingText(content)
  }

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingMessageId(null)
    setEditingText('')
  }

  // Save the edited user message, truncate subsequent messages, and regenerate response
  const handleSaveEdit = async (msgId: string) => {
    if (loading || !api || !activeThreadId || !editingText.trim()) return

    const msgIndex = messages.findIndex(m => m.id === msgId)
    if (msgIndex === -1) return

    updateLoading(true)

    // Truncate messages after the edited message, and update the edited message's content
    const truncatedMsgs = messages.slice(0, msgIndex + 1).map((m, idx) => {
      if (idx === msgIndex) {
        return { ...m, content: editingText }
      }
      return m
    })

    setMessages(truncatedMsgs)
    await saveThreadMessages(activeThreadId, truncatedMsgs)

    // Reset editing state
    setEditingMessageId(null)
    setEditingText('')

    // Insert new placeholder message for the AI response
    const aiMsgId = Math.random().toString(36).substring(2)
    setMessages(prev => [...prev, {
      id: aiMsgId,
      role: 'ai',
      content: '',
      timestamp: Date.now()
    }])

    // Trigger the LLM call using the truncated message list
    await executeLLMCall(aiMsgId, truncatedMsgs, activeThreadId)
  }

  // Update AI response message state and storage
  const updateAiMessage = (msgId: string, content: string, previousMsgs: OocMessage[], threadId: string, save = true, modelName?: string) => {
    setMessages(prev => {
      const updated = prev.map(m => m.id === msgId ? { ...m, content, model: modelName || m.model } : m)
      if (save) {
        const fullMsgs = previousMsgs.map(pm => pm.id === msgId ? { ...pm, content, model: modelName || pm.model } : pm)
        const exists = fullMsgs.some(fm => fm.id === msgId)
        const finalMsgs = exists ? fullMsgs : [...previousMsgs, { id: msgId, role: 'ai' as const, content, timestamp: Date.now(), model: modelName }]
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
        const newId = await handleCreateNewThreadRef.current(query)
        if (newId) {
          setTimeout(() => {
            triggerSendRef.current(query, newId)
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
  }, [loadData])



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
              className={`icon-only ${activeTab === 'settings' ? 'primary' : ''}`}
              onClick={() => {
                if (activeTab === 'chat') {
                  handleOpenSettings()
                } else {
                  setActiveTab('chat')
                }
              }}
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


        {activeTab === 'chat' ? (
          <>
            {/* Thread Selector Bar */}
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
                <Plus size={14} /> 
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

            {/* Message Log */}
            <div className="btw-chat-log" ref={chatLogRef}>
              {messages.length === 0 ? (
                <div className="btw-empty">
                  <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>💬</div>
                  <strong>/btw 플러그인에 오신 걸 환영합니다.</strong>
                  <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem' }}>
                    쿰질하다가 문득 적을 인풋이 떠오르지 못해서 물어보거나, 대화 주제를 조언을 구할 때 등등 하는 곳입니다.
                  </p>
                </div>
              ) : (
                messages.map((m, idx) => {
                  if (m.role === 'ai' && !m.content && loading) {
                    return null
                  }
                  return (
                    <div key={m.id} className={`btw-msg-row ${m.role}`}>
                      <div className="btw-msg-meta">
                        {m.role === 'user' ? '나' : `${characterName}`}
                        {m.role === 'ai' && m.model && (
                          <span className="btw-msg-model-badge">
                            {m.model}
                          </span>
                        )}
                      </div>
                      {editingMessageId === m.id ? (
                        <div className="btw-msg-content">
                          <textarea
                            style={{
                              width: '100%',
                              background: 'var(--btw-bg-input)',
                              color: 'var(--btw-fg)',
                              border: 'var(--btw-border)',
                              borderRadius: '4px',
                              padding: '0.4rem',
                              fontSize: '0.85rem',
                              fontFamily: 'inherit',
                              resize: 'vertical',
                              outline: 'none'
                            }}
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            rows={Math.max(2, editingText.split('\n').length)}
                          />
                          <div style={{ marginTop: '0.35rem', display: 'flex', gap: '0.35rem' }}>
                            <button 
                              className="btw-btn-sm primary" 
                              onClick={() => handleSaveEdit(m.id)}
                              disabled={loading}
                            >
                              저장 후 재생성
                            </button>
                            <button 
                              className="btw-btn-sm"
                              onClick={handleCancelEdit}
                            >
                              취소
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="btw-msg-content">
                          {m.role === 'ai' ? (
                            (() => {
                              const { reasoning, cleanContent, hasOpenThink } = parseMessage(m.content)
                              return (
                                <>
                                  {reasoning && (
                                    <CollapsibleReasoning 
                                      content={reasoning} 
                                      enabled={config.renderMarkdown ?? true} 
                                      isStreaming={loading && idx === messages.length - 1 && hasOpenThink} 
                                    />
                                  )}
                                  {cleanContent && (
                                    <RenderedMessage content={cleanContent} enabled={config.renderMarkdown ?? true} />
                                  )}
                                  {!cleanContent && !reasoning && m.content && (
                                    <RenderedMessage content={m.content} enabled={config.renderMarkdown ?? true} />
                                  )}
                                </>
                              )
                            })()
                          ) : (
                            <RenderedMessage content={m.content} enabled={config.renderMarkdown ?? true} />
                          )}
                          <div style={{ marginTop: '0.35rem', display: 'flex', justifyContent: 'flex-end', gap: '0.35rem' }}>
                            {m.role === 'user' && !loading && (
                              <button 
                                className="btw-btn-sm"
                                onClick={() => handleStartEdit(m.id, m.content)}
                              >
                                <Edit size={12} />
                              </button>
                            )}
                            {m.role === 'ai' && m.content && !m.content.startsWith('⚠️') && (
                              <>
                                <button 
                                  className="btw-btn-sm"
                                  onClick={() => copyToClipboard(m.content)}
                                >
                                  <Copy size={12} />
                                </button>
                                {idx === messages.length - 1 && (
                                  <button 
                                    className="btw-btn-sm"
                                    onClick={handleReroll}
                                    disabled={loading}
                                  >
                                    <RotateCw size={12} className={loading ? 'spin' : ''} />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })
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

            {/* Chat Footer Input */}
            <div className="btw-footer">
              <div className="btw-input-wrap">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="입력..."
                  disabled={loading}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      triggerSend(inputText)
                    }
                  }}
                />
                <button 
                  type="button" 
                  className="primary" 
                  disabled={loading || !inputText.trim()}
                  onClick={() => triggerSend(inputText)}
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="btw-settings-panel" style={{ flex: 1, maxHeight: 'none', borderTop: 'none', borderBottom: 'none', display: 'flex', flexDirection: 'column' }}>
            {/* Settings Sub-tabs */}
            <div className="btw-settings-subtabs">
              <button 
                type="button"
                className={`btw-subtab-button ${activeSettingsTab === 'connection' ? 'active' : ''}`}
                onClick={() => setActiveSettingsTab('connection')}
              >
                연동 설정
              </button>
              <button 
                type="button"
                className={`btw-subtab-button ${activeSettingsTab === 'prompt' ? 'active' : ''}`}
                onClick={() => setActiveSettingsTab('prompt')}
              >
                프롬프트
              </button>
              <button 
                type="button"
                className={`btw-subtab-button ${activeSettingsTab === 'context' ? 'active' : ''}`}
                onClick={() => setActiveSettingsTab('context')}
              >
                컨텍스트
              </button>
            </div>

            {loadingSettings ? (
              <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--btw-fg-muted)', fontSize: '0.85rem', gap: '0.4rem', flexDirection: 'column' }}>
                <div style={{ display: 'flex', gap: '0.2rem' }}>
                  <div className="btw-typing-dot"></div>
                  <div className="btw-typing-dot"></div>
                  <div className="btw-typing-dot"></div>
                </div>
                <span>설정 데이터를 불러오는 중...</span>
              </div>
            ) : (
              <div className="btw-settings-content" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem', overflowY: 'auto', flex: 1, paddingRight: '0.2rem' }}>
                {activeSettingsTab === 'connection' && (
                  <>
                    <div className="btw-form-group">
                      <label>모델 프로바이더</label>
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
                          <label>외부 API 설정 선택</label>
                          <div className="btw-endpoint-selector-row">
                            <select
                              value={config.activeEndpointId}
                              onChange={(e) => saveConfig({ ...config, activeEndpointId: e.target.value })}
                            >
                              {(config.customEndpoints || []).map(ep => (
                                <option key={ep.id} value={ep.id}>{ep.name}</option>
                              ))}
                            </select>
                            <button 
                              onClick={handleAddEndpoint}
                              title="API 설정 추가"
                              type="button"
                            >
                              <Plus size={14} />
                            </button>
                            <button 
                              className="danger"
                              onClick={() => handleDeleteEndpoint(config.activeEndpointId)}
                              disabled={(config.customEndpoints || []).length <= 1}
                              title="API 설정 삭제"
                              type="button"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        {(() => {
                          const activeEp = (config.customEndpoints || []).find(e => e.id === config.activeEndpointId)
                          if (!activeEp) return null
                          return (
                            <>
                              <div className="btw-form-group">
                                <label>설정 이름</label>
                                <input 
                                  type="text" 
                                  value={activeEp.name}
                                  onChange={(e) => handleUpdateActiveEndpoint({ name: e.target.value })}
                                  onBlur={() => saveConfig(config)}
                                  placeholder="예: OpenAI, OpenRouter 등"
                                />
                              </div>
                              <div className="btw-form-group">
                                <label>API Base URL</label>
                                <input 
                                  type="text" 
                                  value={activeEp.apiUrl}
                                  onChange={(e) => handleUpdateActiveEndpoint({ apiUrl: e.target.value })}
                                  onBlur={() => saveConfig(config)}
                                  placeholder="https://api.openai.com/v1"
                                />
                              </div>
                              <div className="btw-form-group">
                                <label>API Key</label>
                                <input 
                                  type="password" 
                                  value={activeEp.apiKey}
                                  onChange={(e) => handleUpdateActiveEndpoint({ apiKey: e.target.value })}
                                  onBlur={() => saveConfig(config)}
                                  placeholder="sk-..."
                                />
                              </div>
                              <div className="btw-form-group">
                                {((fetchedModels[activeEp.id] || []).length > 0 && !customInputMode[activeEp.id]) ? (
                                  <>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                                      <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>모델명</span>
                                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                                        <button
                                          type="button"
                                          className="btw-btn-sm"
                                          style={{ height: '1.25rem', padding: '0 0.35rem', fontSize: '0.7rem' }}
                                          onClick={() => handleFetchModels(activeEp)}
                                          disabled={fetchingModels[activeEp.id]}
                                        >
                                          {fetchingModels[activeEp.id] ? '불러오는 중...' : '다시 가져오기'}
                                        </button>
                                        <button
                                          type="button"
                                          className="btw-btn-sm"
                                          style={{ height: '1.25rem', padding: '0 0.35rem', fontSize: '0.7rem' }}
                                          onClick={() => setCustomInputMode(prev => ({ ...prev, [activeEp.id]: true }))}
                                        >
                                          직접 입력
                                        </button>
                                      </div>
                                    </div>
                                    <select
                                      value={activeEp.model}
                                      onChange={(e) => {
                                        if (e.target.value === '__custom__') {
                                          setCustomInputMode(prev => ({ ...prev, [activeEp.id]: true }))
                                        } else {
                                          handleUpdateActiveEndpoint({ model: e.target.value })
                                          const updatedEndpoints = (config.customEndpoints || []).map(ep =>
                                            ep.id === activeEp.id ? { ...ep, model: e.target.value } : ep
                                          )
                                          saveConfig({ ...config, customEndpoints: updatedEndpoints })
                                        }
                                      }}
                                    >
                                      {!(fetchedModels[activeEp.id] || []).includes(activeEp.model) && activeEp.model && (
                                        <option value={activeEp.model}>{activeEp.model} (현재 선택)</option>
                                      )}
                                      {(fetchedModels[activeEp.id] || []).map(m => (
                                        <option key={m} value={m}>{m}</option>
                                      ))}
                                      <option value="__custom__">[ 직접 입력... ]</option>
                                    </select>
                                  </>
                                ) : (
                                  <>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                                      <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>모델명</span>
                                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                                        {(fetchedModels[activeEp.id] || []).length > 0 ? (
                                          <button
                                            type="button"
                                            className="btw-btn-sm"
                                            style={{ height: '1.25rem', padding: '0 0.35rem', fontSize: '0.7rem' }}
                                            onClick={() => setCustomInputMode(prev => ({ ...prev, [activeEp.id]: false }))}
                                          >
                                            목록에서 선택
                                          </button>
                                        ) : (
                                          <button
                                            type="button"
                                            className="btw-btn-sm"
                                            style={{ height: '1.25rem', padding: '0 0.35rem', fontSize: '0.7rem' }}
                                            onClick={() => handleFetchModels(activeEp)}
                                            disabled={fetchingModels[activeEp.id]}
                                          >
                                            {fetchingModels[activeEp.id] ? '불러오는 중...' : '목록 가져오기'}
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                    <input 
                                      type="text" 
                                      value={activeEp.model}
                                      onChange={(e) => handleUpdateActiveEndpoint({ model: e.target.value })}
                                      onBlur={() => saveConfig(config)}
                                      placeholder="gpt-4o-mini"
                                    />
                                  </>
                                )}
                              </div>
                            </>
                          )
                        })()}
                      </>
                    )}

                    <hr style={{ border: 'none', borderTop: 'var(--btw-border)', margin: '0.5rem 0' }} />

                    <div className="btw-control-row">
                      <label htmlFor="render-markdown" style={{ cursor: 'pointer' }}>마크다운 렌더링 활성화</label>
                      <input 
                        type="checkbox"
                        id="render-markdown"
                        style={{ width: 'auto', cursor: 'pointer' }}
                        checked={config.renderMarkdown}
                        onChange={(e) => saveConfig({ ...config, renderMarkdown: e.target.checked })}
                      />
                    </div>

                    <div className="btw-control-row">
                      <label htmlFor="stream-response" style={{ cursor: 'pointer' }}>실시간 스트리밍 활성화</label>
                      <input 
                        type="checkbox"
                        id="stream-response"
                        style={{ width: 'auto', cursor: 'pointer' }}
                        checked={config.streamResponse ?? true}
                        onChange={(e) => saveConfig({ ...config, streamResponse: e.target.checked })}
                      />
                    </div>
                  </>
                )}

                {activeSettingsTab === 'prompt' && (
                  <div className="btw-form-group" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <label>시스템 프롬프트</label>
                    <textarea 
                      value={config.systemPrompt}
                      style={{ flex: 1, minHeight: '300px', resize: 'none' }}
                      onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
                      onBlur={() => saveConfig(config)}
                      placeholder="시스템 지침을 입력하세요..."
                    />
                  </div>
                )}

                {activeSettingsTab === 'context' && (
                  <>
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
                      <label htmlFor="include-char-desc" style={{ cursor: 'pointer' }}>캐릭터 설명(Description) 포함</label>
                      <input 
                        type="checkbox"
                        id="include-char-desc"
                        style={{ width: 'auto', cursor: 'pointer' }}
                        checked={config.includeCharDesc}
                        onChange={(e) => saveConfig({ ...config, includeCharDesc: e.target.checked })}
                      />
                    </div>

                    <div className="btw-control-row">
                      <label htmlFor="include-lorebook" style={{ cursor: 'pointer' }}>세계관 및 로어북 정보 포함</label>
                      <input 
                        type="checkbox"
                        id="include-lorebook"
                        style={{ width: 'auto', cursor: 'pointer' }}
                        checked={config.includeLorebook}
                        onChange={(e) => saveConfig({ ...config, includeLorebook: e.target.checked })}
                      />
                    </div>
                    <div className="btw-control-row">
                      <label htmlFor="include-user-persona" style={{ cursor: 'pointer' }}>유저 정보 및 페르소나 포함</label>
                      <input 
                        type="checkbox"
                        id="include-user-persona"
                        style={{ width: 'auto', cursor: 'pointer' }}
                        checked={config.includeUserPersona}
                        onChange={(e) => saveConfig({ ...config, includeUserPersona: e.target.checked })}
                      />
                    </div>
                    {config.includeLorebook && availableLoreEntries.length > 0 && (() => {
                      const searchLower = loreSearchTerm.toLowerCase().trim();
                      const matchesSearch = (e: any) => {
                        if (!searchLower) return true;
                        const label = (e.comment || '').toLowerCase();
                        const key = (e.key || '').toLowerCase();
                        const content = (e.content || '').toLowerCase();
                        return label.includes(searchLower) || key.includes(searchLower) || content.includes(searchLower);
                      };

                      const folders = availableLoreEntries.filter((e: any) => e.mode === 'folder');
                      
                      const getFolderChildren = (folderKey: string, isCharLore: boolean) => {
                        return availableLoreEntries.filter((e: any) => 
                          e.mode !== 'folder' && 
                          e.folder === folderKey && 
                          e.isCharLore === isCharLore &&
                          matchesSearch(e)
                        );
                      };

                      const rootItems = availableLoreEntries.filter((e: any) => {
                        if (e.mode === 'folder') return false;
                        if (!matchesSearch(e)) return false;
                        if (!e.folder) return true;
                        return !folders.some((f: any) => f.key === e.folder && f.isCharLore === e.isCharLore);
                      });

                      const renderLoreItem = (entry: any, hasSpacer = true) => {
                        const id = entry.id;
                        const label = entry.comment || entry.key || '이름 없는 로어북';
                        const typeLabel = entry.isCharLore ? '[캐릭터]' : '[채팅]';
                        
                        let loreState: 'force-on' | 'force-off' | 'auto' = 'auto';
                        if ((config.disabledLorebookIds || []).includes(id)) {
                          loreState = 'force-off';
                        } else if ((config.forceEnabledLorebookIds || []).includes(id)) {
                          loreState = 'force-on';
                        }

                        let isTriggered = false;
                        if (loreState === 'force-on') {
                          isTriggered = true;
                        } else if (loreState === 'force-off') {
                          isTriggered = false;
                        } else {
                          isTriggered = isLorebookTriggered(entry, chatMessages, loreDepth, fullWordMatching);
                        }

                        const statusLabel = isTriggered ? ' (활성화됨)' : ' (비활성화됨)';
                        const statusColor = isTriggered ? '#10b981' : '#6b7280';
                        
                        let activationDetail = '';
                        if (loreState === 'force-on') {
                          activationDetail = ' [항상 켬]';
                        } else if (loreState === 'force-off') {
                          activationDetail = ' [항상 끔]';
                        } else {
                          activationDetail = entry.alwaysActive ? ' [자동: 항상]' : ` [자동: 키: ${entry.key || ''}]`;
                        }

                        return (
                          <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            {hasSpacer && <div style={{ width: '1.25rem', height: '1.25rem' }} />}
                            <TriStateCheckbox 
                              state={loreState}
                              onChange={(nextState) => {
                                const disabledList = config.disabledLorebookIds || [];
                                const forceEnabledList = config.forceEnabledLorebookIds || [];
                                
                                let updatedDisabled = disabledList.filter(item => item !== id);
                                let updatedForceEnabled = forceEnabledList.filter(item => item !== id);
                                
                                if (nextState === 'force-off') {
                                  updatedDisabled = [...updatedDisabled, id];
                                } else if (nextState === 'force-on') {
                                  updatedForceEnabled = [...updatedForceEnabled, id];
                                }
                                
                                saveConfig({
                                  ...config,
                                  disabledLorebookIds: updatedDisabled,
                                  forceEnabledLorebookIds: updatedForceEnabled
                                });
                              }}
                            />
                            <label style={{ fontSize: '0.75rem', cursor: 'pointer', display: 'flex', gap: '0.25rem', alignItems: 'center', fontWeight: 'normal', flexWrap: 'wrap', userSelect: 'none' }}>
                              <span style={{ color: 'var(--btw-fg-muted)', fontSize: '0.68rem' }}>{typeLabel}</span>
                              <span style={{ fontWeight: 'bold' }}>{label}</span>
                              <span style={{ color: 'var(--btw-fg-muted)', fontSize: '0.68rem' }}>{activationDetail}</span>
                              <span style={{ color: statusColor, fontSize: '0.68rem', fontWeight: 'bold' }}>{statusLabel}</span>
                            </label>
                          </div>
                        );
                      };

                      return (
                        <div className="btw-lore-selective-list" style={{ marginLeft: '1rem', paddingLeft: '0.5rem', borderLeft: '2px solid var(--btw-border)', display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '-0.25rem', marginBottom: '0.25rem' }}>
                          <span style={{ fontSize: '0.72rem', color: 'var(--btw-fg-muted)', fontWeight: 'bold', marginBottom: '0.1rem' }}>포함할 로어북 항목 선택:</span>
                          
                          {/* Search Input */}
                          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginBottom: '0.15rem', maxWidth: '300px' }}>
                            <Search size={12} style={{ position: 'absolute', left: '0.45rem', color: 'var(--btw-fg-muted)', pointerEvents: 'none' }} />
                            <input 
                              type="text"
                              value={loreSearchTerm}
                              placeholder="로어북 이름, 키워드, 내용 검색..."
                              onChange={(e) => setLoreSearchTerm(e.target.value)}
                              style={{ 
                                height: '1.65rem', 
                                paddingLeft: '1.5rem', 
                                paddingRight: '1.4rem', 
                                fontSize: '0.75rem', 
                                borderRadius: '3px',
                                border: 'var(--btw-border)',
                                background: 'var(--btw-bg-input)',
                                color: 'var(--btw-fg)',
                                width: '100%'
                              }}
                            />
                            {loreSearchTerm && (
                              <button 
                                type="button"
                                onClick={() => setLoreSearchTerm('')}
                                style={{ 
                                  position: 'absolute', 
                                  right: '0.25rem', 
                                  background: 'none', 
                                  border: 'none', 
                                  cursor: 'pointer', 
                                  color: 'var(--btw-fg-muted)', 
                                  padding: 0,
                                  height: '1.1rem',
                                  width: '1.1rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                              >
                                <X size={10} />
                              </button>
                            )}
                          </div>

                          {/* Folders */}
                          {folders.map((folder: any) => {
                            const children = getFolderChildren(folder.key, folder.isCharLore);
                            if (children.length === 0) return null;

                            const folderId = `${folder.key || 'default'}_${folder.isCharLore ? 'char' : 'chat'}`;
                            const folderLabel = folder.comment || folder.key || '이름 없는 폴더';
                            const isCollapsed = loreSearchTerm.trim() !== '' ? false : !!collapsedFolders[folderId];
                            
                            const disabledList = config.disabledLorebookIds || [];
                            const forceEnabledList = config.forceEnabledLorebookIds || [];

                            const getChildState = (child: any) => {
                              if (disabledList.includes(child.id)) return 'force-off';
                              if (forceEnabledList.includes(child.id)) return 'force-on';
                              return 'auto';
                            };
                            
                            const childrenStates = children.map(getChildState);
                            const isAllForceOn = childrenStates.every(s => s === 'force-on');
                            const isAllForceOff = childrenStates.every(s => s === 'force-off');
                            const isAllAuto = childrenStates.every(s => s === 'auto');
                            const folderState = isAllForceOn ? 'force-on' : (isAllForceOff ? 'force-off' : (isAllAuto ? 'auto' : 'mixed'));

                            const typeLabel = folder.isCharLore ? '[캐릭터]' : '[채팅]';

                            return (
                              <div key={folderId} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                  <button
                                    type="button"
                                    onClick={() => setCollapsedFolders(prev => ({ ...prev, [folderId]: !prev[folderId] }))}
                                    style={{ background: 'none', border: 'none', padding: '0 0.15rem', color: 'var(--btw-fg-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '1.25rem', height: '1.25rem' }}
                                  >
                                    {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                                  </button>
                                  
                                  <TriStateCheckbox 
                                    state={folderState}
                                    onChange={(nextState) => {
                                      const childIds = children.map(c => c.id);
                                      let updatedDisabled = (config.disabledLorebookIds || []).filter(item => !childIds.includes(item));
                                      let updatedForceEnabled = (config.forceEnabledLorebookIds || []).filter(item => !childIds.includes(item));
                                      
                                      if (nextState === 'force-off') {
                                        childIds.forEach(cid => {
                                          if (!updatedDisabled.includes(cid)) updatedDisabled.push(cid);
                                        });
                                      } else if (nextState === 'force-on') {
                                        childIds.forEach(cid => {
                                          if (!updatedForceEnabled.includes(cid)) updatedForceEnabled.push(cid);
                                        });
                                      }
                                      
                                      saveConfig({
                                        ...config,
                                        disabledLorebookIds: updatedDisabled,
                                        forceEnabledLorebookIds: updatedForceEnabled
                                      });
                                    }}
                                  />
                                  
                                  <label style={{ fontSize: '0.78rem', cursor: 'pointer', display: 'flex', gap: '0.25rem', alignItems: 'center', fontWeight: 'bold', userSelect: 'none' }} onClick={() => setCollapsedFolders(prev => ({ ...prev, [folderId]: !prev[folderId] }))}>
                                    <span style={{ color: 'var(--btw-fg-muted)', fontSize: '0.68rem' }}>{typeLabel} 📁</span>
                                    <span>{folderLabel}</span>
                                  </label>
                                </div>
                                
                                {!isCollapsed && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', paddingLeft: '1.5rem' }}>
                                    {children.map(c => renderLoreItem(c, false))}
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {/* Root-level items */}
                          {rootItems.map(item => renderLoreItem(item, true))}
                        </div>
                      );
                    })()}

                    
                  </>
                )}
              </div>
            )}

            <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end', paddingTop: '0.5rem', borderTop: 'var(--btw-border)' }}>
              <button onClick={() => setActiveTab('chat')} className="primary">대화창으로 돌아가기</button>
            </div>
          </div>
        )}
        {/* Toast Notification */}
        <div className={`btw-toast ${showToast ? 'show' : ''}`}>
          {toastMessage}
        </div>
      </div>
    </div>
  )
}
