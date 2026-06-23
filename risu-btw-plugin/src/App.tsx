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
      return ''
    }
  }, [characterId, chatIndex])

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
      } catch {
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
      } catch {
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
      } catch {
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
    if (!api) return { systemPromptContent: config.systemPrompt, historyContext: '' }

    let systemPromptContent = config.systemPrompt
    let historyContext = ''

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

          // Populate Lorebook for World Info mapping
          const characterLore = char.globalLore ?? []
          const chatLore = chat?.localLore ?? []
          const rawLoreEntries = characterLore.concat(chatLore)
          chatVars['__lorebook__'] = JSON.stringify(rawLoreEntries)
        }
      } catch (e) {
        console.error('[BTW Plugin] Failed to load user persona or variables:', e)
      }

      const contextData = { charName, userName, userPersona, chatVars }

      // Also render the system prompt itself, in case it contains macros like {{char}} or {{user}}
      systemPromptContent = evaluateCBS(parseCBS(systemPromptContent), contextData)
      
      if (config.includeLore && char) {
        // Exclude module lorebooks by fetching globalLore and chat localLore directly
        const charIndex = await api.getCurrentCharacterIndex()
        const activeChatIndex = await api.getCurrentChatIndex()
        const chat = await api.getChatFromIndex(charIndex, activeChatIndex)
        
        const characterLore = char.globalLore ?? []
        const chatLore = chat?.localLore ?? []
        const rawLoreEntries = characterLore.concat(chatLore)

        const loreText = rawLoreEntries && rawLoreEntries.length > 0 
          ? rawLoreEntries.map((e: any, i: number) => {
              const renderedKey = evaluateCBS(parseCBS(e.key || ''), contextData)
              const renderedContent = evaluateCBS(parseCBS(e.content || ''), contextData)
              return `[Lore Entry #${i+1}]\nKeys: ${renderedKey}\nContent: ${renderedContent}`
            }).join('\n\n')
          : 'None'

        const renderedDesc = evaluateCBS(parseCBS(char.desc || char.description || ''), contextData)
        const renderedPers = evaluateCBS(parseCBS(char.personality || ''), contextData)

        systemPromptContent += `\n\n[Active Character Context]
Character Name: ${charName}
Description: ${renderedDesc}
Personality: ${renderedPers}

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
            const sender = m.name || (m.role === 'user' ? userName : charName);
            const renderedData = evaluateCBS(parseCBS(m.data || ''), contextData)
            return `[${sender}]: ${renderedData}`
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
        const newId = await handleCreateNewThreadRef.current(query)
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
  }, [loadData])

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
