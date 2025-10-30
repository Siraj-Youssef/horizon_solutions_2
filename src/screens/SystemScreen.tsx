// ==================== ENTERPRISE IOT DASHBOARD - ESTRUTURA DE DADOS ATUALIZADA ====================
// Versão: 2.2 | Ajustado para estrutura flat Node-RED | Data: 2025-10-18

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  ReferenceLine
} from 'recharts';

import {
  Activity,
  Thermometer,
  Wind,
  Gauge,
  Power,
  CheckCircle,
  Upload,
  RefreshCw,
  Wifi,
  WifiOff,
  AlertCircle,
  PlayCircle,
  Database,
  Bug,
  TrendingUp,
  Clock,
  Zap,
  Settings,
  Shield,
  Monitor,
  Globe,
  Volume2,
  VolumeX,
  Sun,
  Moon,
  Type,
  Plus,
  Minus,
} from 'lucide-react';

// ==================== INTERFACES & TYPES ====================
// SUBSTITUIR (linhas 21-29)
interface SensorData {
  timestamp: number;
  time: string;
  temperatura: number;
  pressaoEntrada: number;
  pressaoSaida1: number;
  pressaoSaida2: number;
  comutacaoValvula: number;
  bobinaUtilizada: string;
  situacaoAtuador: string;
  tempoComutacao: number;  // ✅ ADICIONAR ESTA LINHA
  status: 'normal' | 'warning' | 'error';
}


interface ExternalMessageFormat {
  parsed: {
    payload: string;
    _msgid: string;
  };
  fields: string[];
  hasDebug: boolean;
}


interface WebSocketMessage {
  type: 'ping' | 'pong' | 'data' | 'heartbeat' | 'command';
  timestamp: number;
  payload?: any;
}

interface DebugInfo {
  id: string;
  timestamp: string;
  type: 'CONNECTION' | 'MESSAGE' | 'DATA' | 'ERROR' | 'PERFORMANCE' | 'HEARTBEAT' | 'SECURITY' | 'CONFIG';
  message: string;
  data?: any;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

interface ConnectionMetrics {
  totalMessages: number;
  reconnectAttempts: number;
  uptime: number;
  lastMessageTime: number;
  avgLatency: number;
  messageRate: number;
  memoryUsage: number;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'critical';
  currentUrl: string;
}

interface WebSocketConfig {
  urls: string[];
  currentUrlIndex: number;
  maxDataPoints: number;
  batchIntervalMs: number;
  reconnectBaseDelayMs: number;
  reconnectMaxDelayMs: number;
  reconnectMaxAttempts: number;
  connectionTimeoutMs: number;
  heartbeatIntervalMs: number;
  messageQueueSize: number;
  performanceThrottleMs: number;
  validationEnabled: boolean;
  securityEnabled: boolean;
  urlSwitchEnabled: boolean;
}

interface AlertThresholds {
  temperatura: { min: number; max: number; critical: number };
  fluxoAr: { min: number; max: number; critical: number };
  pressaoValvula: { min: number; max: number; critical: number };
}

// Interface específica para dados Node-RED com estrutura flat
interface NodeRedPayload {
  temperatura: number;
  pressaoEntrada: number;
  pressaoSaida1: number;
  pressaoSaida2: number;
  situacaoAtuador: string;
  bobinaUtilizada: string;
  tempoComutacao: number;
  timestamp: number;
  deviceId: string;
  qualidade: string;
  debug: {
    cycle: number;
    eventFactor: number;
    tempVariation: number;
    pressureVariation: number;
  };
}

// ==================== CONFIGURAÇÃO DINÂMICA ROBUSTA ====================
const createDynamicWebSocketConfig = (): WebSocketConfig => {
  const possibleUrls = [
    'ws://127.0.0.1:1880/ws/dados',     // URL CORRETA PRIORITÁRIA
    'ws://192.168.15.4:1880/ws/dados',    // URL secundária (caso a rede mude)
    'ws://localhost:1880/ws/dados',       // Localhost fallback
    'ws://127.0.0.1:1880/ws/dados'        // IP local fallback
  ];

  const getEnvironmentUrl = (): string => {
    if (typeof window !== 'undefined') {
      // @ts-ignore
      const envUrl = process.env.REACT_APP_WEBSOCKET_URL || 
                     // @ts-ignore
                     window.ENV_WEBSOCKET_URL ||
                     localStorage.getItem('websocket_url');
      
      if (envUrl) {
        console.log('🌍 Using environment WebSocket URL:', envUrl);
        return envUrl;
      }
    }
    return possibleUrls[0];
  };

  const finalUrls = [
    getEnvironmentUrl(),
    ...possibleUrls.filter(url => url !== getEnvironmentUrl())
  ];

  return {
    urls: finalUrls,
    currentUrlIndex: 0,
    maxDataPoints: 150,
    batchIntervalMs: 75,
    reconnectBaseDelayMs: 1000,
    reconnectMaxDelayMs: 30000,
    reconnectMaxAttempts: 20,
    connectionTimeoutMs: 15000,
    heartbeatIntervalMs: 18000,
    messageQueueSize: 1000,
    performanceThrottleMs: 100,
    validationEnabled: true,
    securityEnabled: true,
    urlSwitchEnabled: true
  };
};

const WS_CONFIG = createDynamicWebSocketConfig();

console.log('🔧 WebSocket Configuration Initialized:', {
  primaryUrl: WS_CONFIG.urls[0],
  fallbackUrls: WS_CONFIG.urls.slice(1),
  urlSwitchEnabled: WS_CONFIG.urlSwitchEnabled
});

const ALERT_THRESHOLDS: AlertThresholds = {
  temperatura: { min: -10, max: 45, critical: 50 },
  fluxoAr: { min: 0.1, max: 12, critical: 15 },
  pressaoValvula: { min: 0.5, max: 18, critical: 22 }
};

const SENSOR_VALIDATION_SCHEMA = {
  temperatura: { min: -50, max: 100, required: true, type: 'number' },
  pressaoEntrada: { min: 0, max: 50, required: true, type: 'number' },      // ✅ CORRIGIDO (era fluxoAr)
  pressaoSaida1: { min: 0, max: 30, required: true, type: 'number' },       // ✅ NOVO
  pressaoSaida2: { min: 0, max: 30, required: false, type: 'number' },      // ✅ NOVO (opcional)
  comutacaoValvula: { min: 0, max: 1, required: false, type: 'number' }
};

// ==================== COMPONENTE PRINCIPAL ====================
const EnterpriseIoTDashboard: React.FC = (): React.JSX.Element => {
  // ========== ESTADOS PRINCIPAIS ==========
  const [sensorData, setSensorData] = useState<SensorData[]>([]);
  const [debugLogs, setDebugLogs] = useState<DebugInfo[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isReceivingData, setIsReceivingData] = useState(false);
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [autoReconnect, setAutoReconnect] = useState(true);
  const [performanceMode, setPerformanceMode] = useState(true);
  const [showUrlConfig, setShowUrlConfig] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  // modificacao
  const [currentBobinaState, setCurrentBobinaState] = useState({
  bobinaUtilizada: 'esquerda',
  situacaoAtuador: 'retraído',
  lastUpdateTime: Date.now()
  });
  //const [bobinaDelayActive, setBobinaDelayActive] = useState(false);
  // modificacao

  const [wsConfig, setWsConfig] = useState(WS_CONFIG);

  const [connectionMetrics, setConnectionMetrics] = useState<ConnectionMetrics>({
    totalMessages: 0,
    reconnectAttempts: 0,
    uptime: 0,
    lastMessageTime: 0,
    avgLatency: 0,
    messageRate: 0,
    memoryUsage: 0,
    connectionQuality: 'excellent',
    currentUrl: wsConfig.urls[0]
  });

  // ========== REFS PARA OTIMIZAÇÃO ==========
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const uptimeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const performanceMonitorRef = useRef<NodeJS.Timeout | null>(null);
  const batchTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Buffers e filas
  const messageQueueRef = useRef<SensorData[]>([]);
  const latencyBufferRef = useRef<number[]>([]);
  const messageRateBufferRef = useRef<{ timestamp: number; count: number }[]>([]);
  const dataBufferRef = useRef<SensorData[]>([]);
  const alertTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // modificacao
  //const bobinaDelayTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // modificacao

  // Contadores e métricas
  const reconnectAttemptsRef = useRef(0);
  const connectionStartTimeRef = useRef(0);
  const lastPingTimeRef = useRef(0);
  const chartUpdateCountRef = useRef(0);
  const securityViolationsRef = useRef(0);
  const urlFailuresRef = useRef<{[url: string]: number}>({});

  // ========== UTILITY FUNCTIONS ==========
  const generateDebugId = useCallback(() => 
    `${Date.now()}-${Math.random().toString(36).substr(2, 12)}`, []);
  
  const addDebugLog = useCallback((
    type: DebugInfo['type'], 
    message: string, 
    data?: any, 
    severity: DebugInfo['severity'] = 'info'
  ) => {
    const debugEntry: DebugInfo = {
      id: generateDebugId(),
      timestamp: new Date().toISOString(),
      type,
      message,
      data,
      severity
    };
    console.log(`🔍 [${type}][${severity.toUpperCase()}] ${message}`, data || '');
    
    setDebugLogs(prev => {
      const newLogs = [debugEntry, ...prev.slice(0, 99)];
      return newLogs;
    });
  }, [generateDebugId]);
      const handleBobinaUpdate = useCallback((newBobina: string, newSituacao: string) => {
      const currentTime = Date.now();
      
      // Verifica se houve mudança na bobina ou situação
      const hasChanged = 
        currentBobinaState.bobinaUtilizada !== newBobina || 
        currentBobinaState.situacaoAtuador !== newSituacao;
      
      if (hasChanged) {
        // ✅ ATUALIZAÇÃO IMEDIATA - SEM DELAY
        setCurrentBobinaState({
          bobinaUtilizada: newBobina,
          situacaoAtuador: newSituacao,
          lastUpdateTime: currentTime
        });
        
        addDebugLog('DATA', 
          `🔄 Bobina atualizada IMEDIATAMENTE: ${newBobina}`,
          { 
            oldBobina: currentBobinaState.bobinaUtilizada,
            newBobina,
            oldSituacao: currentBobinaState.situacaoAtuador,
            newSituacao,
            updateTime: currentTime,
            delayRemoved: true
          }
        );
      } else {
        // Atualiza apenas o timestamp se não houve mudança
        setCurrentBobinaState(prev => ({
          ...prev,
          lastUpdateTime: currentTime
        }));
      }
    }, [currentBobinaState, addDebugLog]);
  // ========== URL MANAGEMENT ==========
  const getCurrentWebSocketUrl = useCallback((): string => {
    const currentUrl = wsConfig.urls[wsConfig.currentUrlIndex];
    updateConnectionMetrics({ currentUrl });
    return currentUrl;
  }, [wsConfig.urls, wsConfig.currentUrlIndex]);

  const switchToNextUrl = useCallback(() => {
    if (!wsConfig.urlSwitchEnabled || wsConfig.urls.length <= 1) return false;

    const currentUrl = wsConfig.urls[wsConfig.currentUrlIndex];
    urlFailuresRef.current[currentUrl] = (urlFailuresRef.current[currentUrl] || 0) + 1;

    const nextIndex = (wsConfig.currentUrlIndex + 1) % wsConfig.urls.length;
    
    setWsConfig(prev => ({
      ...prev,
      currentUrlIndex: nextIndex
    }));

    const nextUrl = wsConfig.urls[nextIndex];
    
    addDebugLog('CONFIG', 
      `🔄 Switching WebSocket URL: ${currentUrl} → ${nextUrl}`,
      { 
        currentUrl, 
        nextUrl, 
        failures: urlFailuresRef.current[currentUrl],
        urlIndex: nextIndex
      },
      'warning'
    );

    updateConnectionMetrics({ currentUrl: nextUrl });
    return true;
  }, [wsConfig, addDebugLog]);
  
  const addCustomUrl = useCallback((newUrl: string) => {
    if (!newUrl.trim() || !newUrl.startsWith('ws://') && !newUrl.startsWith('wss://')) {
      addDebugLog('ERROR', 'Invalid WebSocket URL format', { url: newUrl }, 'error');
      return false;
    }

    if (wsConfig.urls.includes(newUrl)) {
      addDebugLog('CONFIG', 'URL already exists in configuration', { url: newUrl }, 'warning');
      return false;
    }

    setWsConfig(prev => ({
      ...prev,
      urls: [newUrl, ...prev.urls],
      currentUrlIndex: 0
    }));

    addDebugLog('CONFIG', `✅ Added custom WebSocket URL: ${newUrl}`, { url: newUrl });
    
    localStorage.setItem('websocket_url', newUrl);
    
    return true;
  }, [wsConfig.urls, addDebugLog]);
  function parseIncomingData(externalMsg: unknown): NodeRedPayload | null {
    // Zero-cost type guard. Otimizado para falhar rapidamente.
    if (typeof externalMsg !== 'object' || externalMsg === null) {
      addDebugLog("ERROR", "Mensagem recebida não é um objeto, descartando.", { type: typeof externalMsg }, "warning");
      return null;
    }
    
    // ==================== INÍCIO DA MODIFICAÇÃO ====================
    // NOVO CENÁRIO (ALTA PRIORIDADE): Payload é uma string na raiz
    // Trata a estrutura vinda do Node-RED: { payload: "...", _msgid: "..." }
    const rootPayload = (externalMsg as any).payload;
    if (typeof rootPayload === 'string') {
      try {
        // Operação crítica de parsing. Executada apenas uma vez.
        const flatPayload = JSON.parse(rootPayload);
        
        // Validação de sanidade pós-parsing para garantir a estrutura mínima.
        if (typeof flatPayload === 'object' && flatPayload !== null && 'temperatura' in flatPayload) {
          addDebugLog("DATA", "📥 Parsed inner payload from root 'payload' wrapper", flatPayload);
          // 2. Retorna o JSON "flat" (formato %%%%)
          return flatPayload as NodeRedPayload;
        } else {
           addDebugLog("ERROR", "Payload interno do wrapper 'payload' raiz é inválido", { payload: flatPayload }, "error");
           return null;
        }
      } catch (err) {
        addDebugLog("ERROR", "JSON inválido no campo 'payload' raiz", { payload: rootPayload, error: err }, "error");
        return null;
      }
    }
    // ===================== FIM DA MODIFICAÇÃO ======================
    // ==================== SPEECH SYNTHESIS HOOK ====================
const useSpeechSynthesis = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isEnabled, setIsEnabled] = useState(true);
  const speechQueueRef = useRef<string[]>([]);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  
  const createUtterance = useCallback((text: string): SpeechSynthesisUtterance => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 0.8;
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      currentUtteranceRef.current = null;
      processNextInQueue();
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      currentUtteranceRef.current = null;
      processNextInQueue();
    };
    
    return utterance;
  }, []);
  
  const processNextInQueue = useCallback(() => {
    if (speechQueueRef.current.length > 0 && !currentUtteranceRef.current) {
      const nextText = speechQueueRef.current.shift();
      if (nextText && window.speechSynthesis && isEnabled) {
        const utterance = createUtterance(nextText);
        currentUtteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
      }
    }
  }, [createUtterance, isEnabled]);
  
  const speak = useCallback((text: string) => {
    if (!window.speechSynthesis || !isEnabled) return;
    
    if (currentUtteranceRef.current) {
      window.speechSynthesis.cancel();
      currentUtteranceRef.current = null;
      speechQueueRef.current = [];
    }
    
    speechQueueRef.current.push(text);
    processNextInQueue();
  }, [processNextInQueue, isEnabled]);
  
  const stopSpeaking = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      speechQueueRef.current = [];
      currentUtteranceRef.current = null;
      setIsSpeaking(false);
    }
  }, []);
  
  const toggleEnabled = useCallback(() => {
    setIsEnabled(prev => {
      if (prev && isSpeaking) stopSpeaking();
      return !prev;
    });
  }, [isSpeaking, stopSpeaking]);
  
  return { speak, stopSpeaking, isSpeaking, isEnabled, toggleEnabled };
};

    // Cenário 1: Formato legado (Node-RED com wrapper "parsed.payload")
    // (Mantendo por robustez, caso o formato mude)
    const parsedProperty = (externalMsg as any).parsed;
    if (parsedProperty && typeof parsedProperty.payload === 'string') {
      try {
        const innerPayload = JSON.parse(parsedProperty.payload);
        if (innerPayload && typeof innerPayload === 'object' && 'temperatura' in innerPayload) {
          addDebugLog("DATA", "📥 Parsed inner payload from 'parsed.payload' wrapper", innerPayload);
          return innerPayload as NodeRedPayload;
        } else {
          addDebugLog("ERROR", "Inner payload from 'parsed.payload' wrapper is invalid", innerPayload, "error");
          return null;
        }
      } catch (err) {
        addDebugLog("ERROR", "JSON inválido no campo parsed.payload", { payload: parsedProperty.payload, error: err }, "error");
        return null;
      }
    }
    
    // Cenário 2: Retrocompatibilidade (se já vier no formato flat %%%%)
    if ("temperatura" in externalMsg && "pressaoEntrada" in externalMsg) {
      addDebugLog("DATA", "📥 Parsed direct flat payload (retro-compatibility)", externalMsg);
      return externalMsg as NodeRedPayload;
    }
  
    // Se nenhum formato for reconhecido
    addDebugLog("ERROR", "Unknown data structure received, discarding.", { 
      message: "Message does not match 'payload' string, 'parsed.payload' string, or flat structure.", // Mensagem de log atualizada
      data: externalMsg
    }, "warning");
    return null;
  }

  // ========== PERFORMANCE MONITORING ==========
  const updateConnectionMetrics = useCallback((updates: Partial<ConnectionMetrics>) => {
    setConnectionMetrics(prev => {
      const newMetrics = { ...prev, ...updates };
      
      let quality: ConnectionMetrics['connectionQuality'] = 'excellent';
      if (newMetrics.avgLatency > 200) quality = 'poor';
      else if (newMetrics.avgLatency > 100) quality = 'good';
      if (newMetrics.reconnectAttempts > 5) quality = 'critical';
      
      return { ...newMetrics, connectionQuality: quality };
    });
  }, []);

  const recordLatency = useCallback((latency: number) => {
    latencyBufferRef.current.push(latency);
    if (latencyBufferRef.current.length > 50) {
      latencyBufferRef.current.shift();
    }
    
    const avgLatency = latencyBufferRef.current.reduce((a, b) => a + b, 0) / latencyBufferRef.current.length;
    updateConnectionMetrics({ avgLatency: Math.round(avgLatency) });
  }, [updateConnectionMetrics]);

  const recordMessageRate = useCallback(() => {
    const now = Date.now();
    messageRateBufferRef.current.push({ timestamp: now, count: 1 });
    
    messageRateBufferRef.current = messageRateBufferRef.current.filter(
      entry => now - entry.timestamp <= 10000
    );
    
    const totalMessages = messageRateBufferRef.current.reduce((sum, entry) => sum + entry.count, 0);
    const messageRate = totalMessages / 10;
    
    updateConnectionMetrics({ messageRate: Math.round(messageRate * 100) / 100 });
  }, [updateConnectionMetrics]);

  const startPerformanceMonitoring = useCallback(() => {
    if (performanceMonitorRef.current) {
      clearInterval(performanceMonitorRef.current);
    }

    performanceMonitorRef.current = setInterval(() => {
      if (connectionStartTimeRef.current) {
        const uptime = Math.round((Date.now() - connectionStartTimeRef.current) / 1000);
        updateConnectionMetrics({ uptime });
      }

      if ((performance as any).memory && performanceMode) {
        const memInfo = (performance as any).memory;
        const memoryUsage = Math.round(memInfo.usedJSHeapSize / 1024 / 1024);
        updateConnectionMetrics({ memoryUsage });
        
        if (memoryUsage > 100) {
          addDebugLog('PERFORMANCE', 
            `⚠️ High memory usage: ${memoryUsage}MB | Queue: ${messageQueueRef.current.length}`,
            { memoryUsage, queueSize: messageQueueRef.current.length },
            'warning'
          );
        }
      }

      if (messageQueueRef.current.length > wsConfig.messageQueueSize * 0.8) {
        addDebugLog('PERFORMANCE', 
          '🚨 Queue approaching limit, forcing batch processing',
          { queueSize: messageQueueRef.current.length },
          'warning'
        );
        processBatch();
      }
    }, wsConfig.performanceThrottleMs);
  }, [updateConnectionMetrics, addDebugLog, performanceMode, wsConfig.performanceThrottleMs, wsConfig.messageQueueSize]);

  // ========== DATA VALIDATION & SECURITY ==========
  const validateSensorData = useCallback((data: any): boolean => {
    if (!wsConfig.validationEnabled) return true;
    
    try {
      if (typeof data !== 'object' || data === null) {
        addDebugLog('SECURITY', 'Invalid data type received', data, 'warning');
        return false;
      }

      for (const [field, rules] of Object.entries(SENSOR_VALIDATION_SCHEMA)) {
        const value = data[field];
        
        if (rules.required && (value === undefined || value === null)) {
          addDebugLog('ERROR', `Required field missing: ${field}`, data, 'error');
          return false;
        }
        
        if (value !== undefined && value !== null) {
          const numValue = Number(value);
          
          if (rules.type === 'number' && isNaN(numValue)) {
            addDebugLog('SECURITY', `Invalid number for field: ${field}`, data, 'warning');
            return false;
          }
          
          if (!isNaN(numValue) && (numValue < rules.min || numValue > rules.max)) {
            addDebugLog('SECURITY', 
              `Value out of bounds for ${field}: ${numValue} (${rules.min}-${rules.max})`,
              data, 
              'warning'
            );
            return false;
          }
        }
      }

      if (wsConfig.securityEnabled) {
        const dataString = JSON.stringify(data);
        
        const suspiciousPatterns = [
          /<script/i,
          /javascript:/i,
          /eval\(/i,
          /function\s*\(/i,
          /alert\(/i
        ];
        
        for (const pattern of suspiciousPatterns) {
          if (pattern.test(dataString)) {
            securityViolationsRef.current++;
            addDebugLog('SECURITY', 
              '🚨 Security violation detected in data',
              { pattern: pattern.source, violations: securityViolationsRef.current },
              'critical'
            );
            return false;
          }
        }
      }

      return true;
    } catch (error) {
      addDebugLog('ERROR', `Validation error: ${error}`, data, 'error');
      return false;
    }
  }, [addDebugLog, wsConfig.validationEnabled, wsConfig.securityEnabled]);

  // ========== PROCESSAMENTO DE DADOS NODE-RED COM ESTRUTURA FLAT ==========
  // [MODIFICADO] A função agora aceita o objeto NodeRedPayload diretamente
  const processArduinoMessage = useCallback((parsed: NodeRedPayload): SensorData | null => {
    const startTime = performance.now();
    
    try {
      
      addDebugLog('DATA', '📥 Node-RED flat structure received', { 
        parsed,
        fields: Object.keys(parsed),
        deviceId: parsed.deviceId,
        qualidade: parsed.qualidade,
        hasDebug: !!parsed.debug
      });

      // Validação de campos essenciais
      if (parsed.temperatura === undefined || parsed.pressaoEntrada === undefined) {
        addDebugLog('ERROR', 
          'Essential sensor fields missing in flat structure',
          { received: Object.keys(parsed), expected: ['temperatura', 'pressaoEntrada'] },
          'warning'
        );
        return null;
      }

      // ========== EXTRAÇÃO E NORMALIZAÇÃO DOS DADOS FLAT ==========
      // SUBSTITUIR (aproximadamente linha 648-681)
      const normalizedData = {
        temperatura: Number(parsed.temperatura) || 0,
        pressaoEntrada: Number(parsed.pressaoEntrada) || 0,    // NOVO
        pressaoSaida1: Number(parsed.pressaoSaida1) || 0,      // NOVO
        pressaoSaida2: Number(parsed.pressaoSaida2) || 0,      // NOVO
        comutacaoValvula: (() => {
          const bobinaUtilizada = String(parsed.bobinaUtilizada || '').toLowerCase();
          const situacaoAtuador = String(parsed.situacaoAtuador || '').toLowerCase();
          
          if (bobinaUtilizada === 'direita' || bobinaUtilizada === 'esquerda') return 1;
          if (situacaoAtuador === 'avançado' || situacaoAtuador === 'ativo') return 1;
          if (parsed.tempoComutacao && parsed.tempoComutacao > 0) return 1;
          
          return 0;
        })(),
        bobinaUtilizada: String(parsed.bobinaUtilizada || 'Nenhuma'),    // NOVO
        situacaoAtuador: String(parsed.situacaoAtuador || 'Desconhecido'), // NOVO
        qualidade: String(parsed.qualidade || 'unknown'),
        tempoComutacao: Number(parsed.tempoComutacao) || 0,
        deviceId: String(parsed.deviceId || 'unknown'),
        timestamp: Number(parsed.timestamp) || Date.now(),
        debug: parsed.debug || null
      };

      addDebugLog('DATA', '🔄 Flat data normalized successfully', {
        original: {
          temperatura: parsed.temperatura,
          pressaoEntrada: parsed.pressaoEntrada,
          pressaoSaida1: parsed.pressaoSaida1,
          situacaoAtuador: parsed.situacaoAtuador,
          bobinaUtilizada: parsed.bobinaUtilizada,
          deviceId: parsed.deviceId
        },
        normalized: normalizedData,
        processingTime: `${(performance.now() - startTime).toFixed(2)}ms`
      });

      // Aplicar validação de segurança
      if (!validateSensorData(normalizedData)) {
        return null;
      }

      // SUBSTITUIR (aproximadamente linha 715-730)
      const sensorData: SensorData = {
  timestamp: normalizedData.timestamp,
  time: new Date(normalizedData.timestamp).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }),
  temperatura: normalizedData.temperatura,
  pressaoEntrada: normalizedData.pressaoEntrada,
  pressaoSaida1: normalizedData.pressaoSaida1,
  pressaoSaida2: normalizedData.pressaoSaida2,
  comutacaoValvula: normalizedData.comutacaoValvula,
  
  // ✅ USAR OS DADOS ATUALIZADOS (não os fixos do currentBobinaState)
  bobinaUtilizada: normalizedData.bobinaUtilizada,
  situacaoAtuador: normalizedData.situacaoAtuador,
  tempoComutacao: normalizedData.tempoComutacao || 0,  // ✅ ADICIONAR ESTA LINHA
  
  status: (() => {
    const qualidade = normalizedData.qualidade.toLowerCase();
    const situacao = normalizedData.situacaoAtuador.toLowerCase();
    
    if (qualidade === 'normal' && situacao.includes('avançado')) return 'normal';
    if (qualidade === 'warning' || situacao.includes('alerta')) return 'warning';
    if (qualidade === 'error' || situacao.includes('erro') || situacao.includes('falha')) return 'error';
    
    return normalizedData.qualidade === 'normal' ? 'normal' : 'warning';
  })()
};

// ✅ ATUALIZAR ESTADO DA BOBINA COM DADOS RECEBIDOS
handleBobinaUpdate(normalizedData.bobinaUtilizada, normalizedData.situacaoAtuador);
      // Performance tracking
      const processingTime = performance.now() - startTime;
      if (processingTime > 20) {
        addDebugLog('PERFORMANCE', 
          `⚡ Slow flat structure processing: ${processingTime.toFixed(2)}ms`,
          { parsedPayload: parsed, Error, stack: Error instanceof Error ? Error.stack : undefined },
          'warning'
        );
      }

      // Record message rate
      recordMessageRate();

      addDebugLog('DATA', 
        '✅ Sensor data processed successfully from flat structure',
        { 
          sensorData,
          additionalInfo: {
            deviceId: normalizedData.deviceId,
            bobinaUtilizada: normalizedData.bobinaUtilizada,
            tempoComutacao: normalizedData.tempoComutacao,
            situacaoAtuador: normalizedData.situacaoAtuador,
            qualidade: normalizedData.qualidade,
            debugInfo: normalizedData.debug
          }
        }
      );

      return sensorData;

    } catch (error) {
      addDebugLog('ERROR', 
        `Node-RED flat structure processing error: ${error}`,
        // [CORRIGIDO] Alterado 'rawMessage' para 'parsed'
        { parsedPayload: parsed, error, stack: error instanceof Error ? error.stack : undefined }, 
        'error'
      );
      return null;
    }
  }, [validateSensorData, addDebugLog, recordMessageRate]);

  // ========== EXPONENTIAL BACKOFF WITH FULL JITTER ==========
  const calculateBackoffDelay = useCallback((attempt: number): number => {
    const baseDelay = wsConfig.reconnectBaseDelayMs;
    const maxDelay = wsConfig.reconnectMaxDelayMs;
    
    let delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    const jitter = Math.random() * delay;
    
    return Math.max(jitter, baseDelay);
  }, [wsConfig.reconnectBaseDelayMs, wsConfig.reconnectMaxDelayMs]);

  // ========== ALERT SYSTEM ==========
  // SUBSTITUIR (linhas aproximadas 944-985)
  const checkCriticalAlerts = useCallback((data: SensorData) => {
    if (!alertsEnabled) return;

    const alerts: string[] = [];
    
    // Alerta de Temperatura
    if (data.temperatura > ALERT_THRESHOLDS.temperatura.critical) {
      alerts.push(`🌡️ TEMPERATURA CRÍTICA: ${data.temperatura}°C`);
    } else if (data.temperatura > ALERT_THRESHOLDS.temperatura.max) {
      alerts.push(`⚠️ Temperatura alta: ${data.temperatura}°C`);
    } else if (data.temperatura < ALERT_THRESHOLDS.temperatura.min) {
      alerts.push(`❄️ Temperatura baixa: ${data.temperatura}°C`);
    }
    
    // Alerta de Pressão de Entrada (era fluxoAr)
    if (data.pressaoEntrada > ALERT_THRESHOLDS.fluxoAr.critical) {  // ✅ CORRIGIDO
      alerts.push(`💨 PRESSÃO ENTRADA CRÍTICA: ${data.pressaoEntrada} bar`);
    } else if (data.pressaoEntrada > ALERT_THRESHOLDS.fluxoAr.max) {
      alerts.push(`⚠️ Pressão entrada alta: ${data.pressaoEntrada} bar`);
    }
    
    // Alerta de Pressão Saída 1
    if (data.pressaoSaida1 > ALERT_THRESHOLDS.pressaoValvula.critical) {  // ✅ CORRIGIDO
      alerts.push(`🔧 PRESSÃO SAÍDA 1 CRÍTICA: ${data.pressaoSaida1} bar`);
    } else if (data.pressaoSaida1 > ALERT_THRESHOLDS.pressaoValvula.max) {
      alerts.push(`⚠️ Pressão saída 1 alta: ${data.pressaoSaida1} bar`);
    }
    
    // Alerta de Pressão Saída 2 (NOVO)
    if (data.pressaoSaida2 > ALERT_THRESHOLDS.pressaoValvula.critical) {  // ✅ NOVO
      alerts.push(`🔧 PRESSÃO SAÍDA 2 CRÍTICA: ${data.pressaoSaida2} bar`);
    } else if (data.pressaoSaida2 > ALERT_THRESHOLDS.pressaoValvula.max) {
      alerts.push(`⚠️ Pressão saída 2 alta: ${data.pressaoSaida2} bar`);
    }
    
    if (alerts.length > 0) {
      const severity = alerts.some(alert => alert.includes('CRÍTICA')) ? 'critical' : 'warning';
      
      addDebugLog('ERROR', 
        `🚨 ALERTAS DETECTADOS: ${alerts.join(' | ')}`,
        { 
          alerts, 
          sensorData: data,
          thresholds: ALERT_THRESHOLDS 
        },
        severity
      );
      
      if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current);
      alertTimeoutRef.current = setTimeout(() => {
        console.warn('🚨 Alert system triggered:', alerts);
      }, 10000);
    }
  }, [alertsEnabled, addDebugLog]);

  // ========== HEARTBEAT SYSTEM ==========
  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }

    heartbeatIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        try {
          lastPingTimeRef.current = performance.now();
          const heartbeatMessage: WebSocketMessage = {
            type: 'ping',
            timestamp: Date.now()
          };
          
          wsRef.current.send(JSON.stringify(heartbeatMessage));
          addDebugLog('HEARTBEAT', '💓 Heartbeat ping sent');
        } catch (error) {
          addDebugLog('ERROR', `Heartbeat error: ${error}`, error, 'error');
        }
      }
    }, wsConfig.heartbeatIntervalMs);
  }, [addDebugLog, wsConfig.heartbeatIntervalMs]);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  // ========== BATCH PROCESSING ==========
  const processBatch = useCallback(() => {
    if (messageQueueRef.current.length === 0) return;

    const batchSize = messageQueueRef.current.length;
    const batchData = [...messageQueueRef.current];
    messageQueueRef.current = [];

    addDebugLog('PERFORMANCE', `⚡ Processing Node-RED flat batch: ${batchSize} messages`);
    
    setSensorData(prevData => {
      const updatedData = [...prevData, ...batchData];
      const limitedData = updatedData.slice(-wsConfig.maxDataPoints);
      
      dataBufferRef.current = limitedData;
      chartUpdateCountRef.current++;
      
      if (!isReceivingData && limitedData.length > 0) {
        setIsReceivingData(true);
        addDebugLog('DATA', '📊 Real-time Node-RED flat data reception started!', null, 'info');
      }
      
      return limitedData;
    });

    batchData.forEach(checkCriticalAlerts);

    updateConnectionMetrics({ 
      totalMessages: connectionMetrics.totalMessages + batchSize,
      lastMessageTime: Date.now()
    });
  }, [isReceivingData, addDebugLog, checkCriticalAlerts, updateConnectionMetrics, connectionMetrics.totalMessages, wsConfig.maxDataPoints]);

  // ========== WEBSOCKET CONNECTION MANAGEMENT ==========
  const connectWebSocket = useCallback(() => {
    if (reconnectAttemptsRef.current >= wsConfig.reconnectMaxAttempts) {
      addDebugLog('ERROR', 
        `❌ Maximum reconnection attempts reached: ${wsConfig.reconnectMaxAttempts}`,
        { 
          attempts: reconnectAttemptsRef.current,
          maxAttempts: wsConfig.reconnectMaxAttempts,
          urlFailures: urlFailuresRef.current
        },
        'critical'
      );
      
      if (switchToNextUrl()) {
        reconnectAttemptsRef.current = 0;
        setTimeout(() => connectWebSocket(), 2000);
        return;
      }
      return;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    stopHeartbeat();

    const currentUrl = getCurrentWebSocketUrl();
    
    addDebugLog('CONNECTION', 
      `🔌 Connecting to Node-RED WebSocket (${reconnectAttemptsRef.current + 1}/${wsConfig.reconnectMaxAttempts})`,
      { 
        url: currentUrl,
        urlIndex: wsConfig.currentUrlIndex,
        attempt: reconnectAttemptsRef.current + 1,
        maxAttempts: wsConfig.reconnectMaxAttempts,
        expectedDataFormat: 'Node-RED flat JSON structure'
      }
    );

    try {
      const socket = new WebSocket(currentUrl);
      wsRef.current = socket;

      const connectTimeout = setTimeout(() => {
        if (socket.readyState === WebSocket.CONNECTING) {
          addDebugLog('ERROR', 
            `⏱️ Connection timeout: ${wsConfig.connectionTimeoutMs / 1000}s exceeded`,
            { url: currentUrl, timeout: wsConfig.connectionTimeoutMs },
            'error'
          );
          socket.close();
        }
      }, wsConfig.connectionTimeoutMs);

      socket.onopen = () => {
        clearTimeout(connectTimeout);
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
        connectionStartTimeRef.current = Date.now();
        
        urlFailuresRef.current[currentUrl] = 0;
        
        updateConnectionMetrics({ 
          reconnectAttempts: 0,
          uptime: 0,
          connectionQuality: 'excellent',
          currentUrl
        });

        addDebugLog('CONNECTION', 
          '✅ WebSocket connected to Node-RED successfully!',
          { 
            url: currentUrl,
            urlIndex: wsConfig.currentUrlIndex,
            timestamp: new Date().toISOString(),
            ready: 'Awaiting Node-RED data with flat JSON structure',
            expectedFields: ['temperatura', 'pressaoEntrada', 'pressaoSaida1', 'situacaoAtuador', 'bobinaUtilizada']
          }
        );
        
        startHeartbeat();
        startPerformanceMonitoring();
      };

      socket.onmessage = (event) => {
        try {
          // [MODIFICADO] Etapa 1: Parseia o JSON *uma única vez*
          let parsedEventData: any;
          try {
            parsedEventData = JSON.parse(event.data);
          } catch (e) {
            addDebugLog('ERROR', 'Received non-JSON WebSocket message', { rawData: event.data, error: e }, 'warning');
            return; // Ignora se não for JSON
          }

          // [MODIFICADO] Etapa 2: Trata Heartbeat
          if (parsedEventData && parsedEventData.type === 'pong' && lastPingTimeRef.current) {
            const latency = performance.now() - lastPingTimeRef.current;
            recordLatency(latency);
            addDebugLog('HEARTBEAT', `💓 Pong received (${latency.toFixed(2)}ms latency)`);
            return;
          }

          // [MODIFICADO] Etapa 3: Normaliza o payload (trata o wrapper **** ou o flat)
          // A função 'parseIncomingData' já está correta e retorna o objeto NodeRedPayload
          const normalizedPayload = parseIncomingData(parsedEventData); // Retorna NodeRedPayload | null

          if (normalizedPayload) {
            // [CORRIGIDO] Etapa 4: Passa o *OBJETO* (NodeRedPayload) diretamente
            const processedData = processArduinoMessage(normalizedPayload); // Sem JSON.stringify

            // Etapa 5: Adiciona à fila de batch
            if (processedData) {
              messageQueueRef.current.push(processedData);
              
              if (messageQueueRef.current.length >= wsConfig.messageQueueSize * 0.8) {
                processBatch();
              }
            }
          }
          // Se normalizedPayload ou processedData forem nulos, as próprias funções já logaram o erro.
  
        } catch (error) {
          addDebugLog('ERROR', `Node-RED message processing pipeline error: ${error}`, { error, rawData: event.data }, 'error');
        }
      };

      socket.onerror = (error) => {
        clearTimeout(connectTimeout);
        addDebugLog('ERROR', 
          `Node-RED WebSocket error occurred`,
          { error, url: currentUrl, urlIndex: wsConfig.currentUrlIndex },
          'error'
        );
        setIsConnected(false);
      };

      socket.onclose = (event) => {
        clearTimeout(connectTimeout);
        setIsConnected(false);
        stopHeartbeat();
        
        if (performanceMonitorRef.current) {
          clearInterval(performanceMonitorRef.current);
        }

        addDebugLog('CONNECTION', 
          `🔌 Node-RED WebSocket disconnected`,
          { 
            code: event.code,
            reason: event.reason || 'Unknown',
            url: currentUrl,
            urlIndex: wsConfig.currentUrlIndex
          }
        );

        if (messageQueueRef.current.length > 0) {
          processBatch();
        }

        if (autoReconnect && reconnectAttemptsRef.current < wsConfig.reconnectMaxAttempts) {
          const delay = calculateBackoffDelay(reconnectAttemptsRef.current);
          reconnectAttemptsRef.current++;
          
          updateConnectionMetrics({ 
            reconnectAttempts: reconnectAttemptsRef.current,
            connectionQuality: reconnectAttemptsRef.current > 5 ? 'critical' : 'poor'
          });

          addDebugLog('CONNECTION', 
            `🔄 Auto-reconnecting to Node-RED in ${(delay / 1000).toFixed(1)}s (attempt ${reconnectAttemptsRef.current})`,
            { delay, attempt: reconnectAttemptsRef.current, url: currentUrl }
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocket();
          }, delay);
        } else if (!autoReconnect) {
          addDebugLog('CONNECTION', '⏸️ Auto-reconnect disabled');
        } else {
          addDebugLog('ERROR', 
            '❌ All reconnection attempts exhausted for current URL',
            { url: currentUrl, attempts: reconnectAttemptsRef.current },
            'critical'
          );
          
          if (switchToNextUrl()) {
            reconnectAttemptsRef.current = 0;
            setTimeout(() => connectWebSocket(), 5000);
          }
        }
      };

    } catch (error) {
      addDebugLog('ERROR', 
        `Node-RED WebSocket creation error: ${error}`,
        { error, url: currentUrl },
        'error'
      );
      setIsConnected(false);
    }
  }, [
    addDebugLog, 
    processArduinoMessage, 
    calculateBackoffDelay, 
    startHeartbeat, 
    stopHeartbeat,
    startPerformanceMonitoring,
    updateConnectionMetrics,
    processBatch,
    recordLatency,
    autoReconnect,
    getCurrentWebSocketUrl,
    switchToNextUrl,
    wsConfig
  ]);
  // ==================== SPEECH SYNTHESIS HOOK ====================
const useSpeechSynthesis = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isEnabled, setIsEnabled] = useState(true);
  const speechQueueRef = useRef<string[]>([]);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  
  const createUtterance = useCallback((text: string): SpeechSynthesisUtterance => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 0.8;
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      currentUtteranceRef.current = null;
      processNextInQueue();
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      currentUtteranceRef.current = null;
      processNextInQueue();
    };
    
    return utterance;
  }, []);
  
  const processNextInQueue = useCallback(() => {
    if (speechQueueRef.current.length > 0 && !currentUtteranceRef.current) {
      const nextText = speechQueueRef.current.shift();
      if (nextText && window.speechSynthesis && isEnabled) {
        const utterance = createUtterance(nextText);
        currentUtteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
      }
    }
  }, [createUtterance, isEnabled]);
  
  const speak = useCallback((text: string) => {
    if (!window.speechSynthesis || !isEnabled) return;
    
    if (currentUtteranceRef.current) {
      window.speechSynthesis.cancel();
      currentUtteranceRef.current = null;
      speechQueueRef.current = [];
    }
    
    speechQueueRef.current.push(text);
    processNextInQueue();
  }, [processNextInQueue, isEnabled]);
  
  const stopSpeaking = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      speechQueueRef.current = [];
      currentUtteranceRef.current = null;
      setIsSpeaking(false);
    }
  }, []);
  
  const toggleEnabled = useCallback(() => {
    setIsEnabled(prev => {
      if (prev && isSpeaking) stopSpeaking();
      return !prev;
    });
  }, [isSpeaking, stopSpeaking]);
  
  return { speak, stopSpeaking, isSpeaking, isEnabled, toggleEnabled };
};
// ========== INTEGRAÇÃO NO COMPONENTE ==========
const { speak, stopSpeaking, isSpeaking, isEnabled: speechEnabled, toggleEnabled: toggleSpeechEnabled } = useSpeechSynthesis();

const announceMetricCards = useCallback((currentData: SensorData, dataStatistics: any) => {
  if (!currentData || !speechEnabled) return;
  
  const announcements: string[] = [];
  
  announcements.push(`Temperatura: ${currentData.temperatura.toFixed(1)} graus Celsius`);
  if (dataStatistics?.avgTemp) {
    announcements.push(`Média: ${dataStatistics.avgTemp} graus`);
  }
  
  announcements.push(`Pressão de Entrada: ${currentData.pressaoEntrada.toFixed(2)} bar`);
  if (dataStatistics?.avgPressaoEntrada) {
    announcements.push(`Média: ${dataStatistics.avgPressaoEntrada} bar`);
  }
  
  announcements.push(`Pressão Saída Um: ${currentData.pressaoSaida1.toFixed(2)} bar`);
  announcements.push(`Pressão Saída Dois: ${currentData.pressaoSaida2.toFixed(2)} bar`);
  announcements.push(`Bobina da Válvula: ${currentData.bobinaUtilizada}`);
  announcements.push(`Situação: ${currentData.situacaoAtuador}`);
  announcements.push(`Tempo de Comutação: ${currentData.comutacaoValvula || 0} milissegundos`);
  
  const fullAnnouncement = announcements.join('. ');
  speak(fullAnnouncement);
  
  addDebugLog('DATA', '🔊 Anunciando métricas dos cards', { totalCards: 6 });
}, [speak, speechEnabled, addDebugLog]);

  // ========== PUBLIC METHODS ==========
  const reconnectManual = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    updateConnectionMetrics({ reconnectAttempts: 0 });
    addDebugLog('CONNECTION', 
      '🔄 Manual reconnection to Node-RED initiated',
      { url: getCurrentWebSocketUrl() }
    );
    connectWebSocket();
  }, [connectWebSocket, addDebugLog, updateConnectionMetrics, getCurrentWebSocketUrl]);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify(message));
        addDebugLog('MESSAGE', '📤 Message sent to Node-RED server', message);
        return true;
      } catch (error) {
        addDebugLog('ERROR', `Send message error: ${error}`, { message, error }, 'error');
        return false;
      }
    }
    addDebugLog('ERROR', 
      'Cannot send message: WebSocket not connected',
      { message, currentState: wsRef.current?.readyState },
      'warning'
    );
    return false;
  }, [addDebugLog]);

  const closeConnection = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect');
      wsRef.current = null;
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    stopHeartbeat();
    
    if (performanceMonitorRef.current) {
      clearInterval(performanceMonitorRef.current);
    }

    addDebugLog('CONNECTION', '🔌 Node-RED connection closed manually');
  }, [addDebugLog, stopHeartbeat]);

  // ========== CONTROL FUNCTIONS ==========
  const handleClearData = useCallback(() => {
    setSensorData([]);
    dataBufferRef.current = [];
    messageQueueRef.current = [];
    setIsReceivingData(false);
    chartUpdateCountRef.current = 0;
    
    addDebugLog('DATA', '🗑️ All Node-RED sensor data cleared by user');
  }, [addDebugLog]);

  // SUBSTITUIR (linhas 1262-1293)
const handleTestData = useCallback(() => {
  // ✅ DADOS MOCKADOS DINÂMICOS
  const randomBobina = Math.random() > 0.5 ? "Direita" : "Esquerda";
  const randomSituacao = Math.random() > 0.5 ? "Avançado" : "Retraído";
  
  const testPayload: NodeRedPayload = {
    temperatura: 15 + Math.random() * 15,
    pressaoEntrada: 2.5 + Math.random() * 2.0,
    pressaoSaida1: 2.0 + Math.random() * 2.5,
    pressaoSaida2: 1.0 + Math.random() * 1.5,
    
    // ✅ VALORES DINÂMICOS (não fixos)
    situacaoAtuador: randomSituacao,
    bobinaUtilizada: randomBobina,
    
    tempoComutacao: Math.floor(Math.random() * 100),
    timestamp: Date.now(),
    deviceId: 'simulator-test',
    qualidade: Math.random() > 0.85 ? 'warning' : 'normal',
    debug: {
      cycle: 0,
      eventFactor: 1,
      tempVariation: 0,
      pressureVariation: 0
    }
  };

  console.log("🧪 TESTE - Enviando dados:", {
    bobinaUtilizada: testPayload.bobinaUtilizada,
    situacaoAtuador: testPayload.situacaoAtuador
  });

  const testData = processArduinoMessage(testPayload);
  if (testData) {
    messageQueueRef.current.push(testData);
    processBatch();
    addDebugLog('DATA', `🧪 Test data: ${randomBobina}/${randomSituacao}`, testData);
  }
}, [processArduinoMessage, processBatch, addDebugLog]);


  const handleClearLogs = useCallback(() => {
    setDebugLogs([]);
    addDebugLog('DATA', '🗑️ Debug logs cleared');
  }, [addDebugLog]);

  const handleAddCustomUrl = useCallback(() => {
    if (customUrl.trim() && addCustomUrl(customUrl)) {
      setCustomUrl('');
      setShowUrlConfig(false);
      
      closeConnection();
      setTimeout(connectWebSocket, 1000);
    }
  }, [customUrl, addCustomUrl, closeConnection, connectWebSocket]);

  const handleSwitchUrl = useCallback(() => {
    if (switchToNextUrl()) {
      closeConnection();
      setTimeout(connectWebSocket, 1000);
    }
  }, [switchToNextUrl, closeConnection, connectWebSocket]);

  // ========== COMPUTED VALUES ==========
  // SUBSTITUIR (linhas 1447-1456)
  const currentData: SensorData = useMemo(() => 
    sensorData[sensorData.length - 1] || {
      timestamp: 0,
      time: '--:--:--',
      temperatura: 0,
      pressaoEntrada: 0,      // NOVO
      pressaoSaida1: 0,       // NOVO
      pressaoSaida2: 0,       // NOVO
      comutacaoValvula: 0,
      bobinaUtilizada: 'Nenhuma',  // NOVO
      situacaoAtuador: 'Desconhecido', // NOVO
      status: 'Normal'
    }, [sensorData]);

  const connectionStatus = useMemo(() => {
    if (isReceivingData && sensorData.length > 0) {
      return {
        class: 'status-receiving',
        text: `📊 Recebendo dados do Node-Red(${sensorData.length})`,
        icon: PlayCircle,
        color: '#8b5cf6'
      };
    } else if (isConnected) {
      return {
        class: 'status-connected',
        text: '🟢 Node-Red Conectado',
        icon: Wifi,
        color: '#22c55e'
      };
    } else {
      return {
        class: 'status-disconnected',
        text: `🔴 Node-RED Desconectado (${connectionMetrics.reconnectAttempts}/${wsConfig.reconnectMaxAttempts})`,
        icon: WifiOff,
        color: '#ef4444'
      };
    }
  }, [isReceivingData, sensorData.length, isConnected, connectionMetrics.reconnectAttempts, wsConfig.reconnectMaxAttempts]);

  // SUBSTITUIR (linhas aproximadas 1475-1490)
  const dataStatistics = useMemo(() => {
    if (sensorData.length < 3) return null;
    
    const recent = sensorData.slice(-20);
    const avgTemp = recent.reduce((sum, d) => sum + d.temperatura, 0) / recent.length;
    const avgPressaoEntrada = recent.reduce((sum, d) => sum + d.pressaoEntrada, 0) / recent.length;  // ✅ CORRIGIDO
    const avgPressaoSaida1 = recent.reduce((sum, d) => sum + d.pressaoSaida1, 0) / recent.length;    // ✅ NOVO
    const avgPressaoSaida2 = recent.reduce((sum, d) => sum + d.pressaoSaida2, 0) / recent.length;    // ✅ NOVO
    const avgTempoComutacao = recent.reduce((sum, d) => sum + (d.comutacaoValvula || 0), 0) / recent.length;

    const alertCount = recent.filter(d => d.status !== 'normal').length;
    
    return {
      avgTemp: avgTemp.toFixed(1),
      avgPressaoEntrada: avgPressaoEntrada.toFixed(2),  // ✅ CORRIGIDO
      avgPressaoSaida1: avgPressaoSaida1.toFixed(2),    // ✅ NOVO
      avgPressaoSaida2: avgPressaoSaida2.toFixed(2),    // ✅ NOVO
      avgTempoComutacao: avgTempoComutacao.toFixed(0),
      alertCount,
      healthScore: Math.round(((recent.length - alertCount) / recent.length) * 100)
    };
  }, [sensorData]);

  // ========== INITIALIZATION & CLEANUP ==========
  useEffect(() => {
    connectWebSocket();

    const batchTimer = setInterval(processBatch, wsConfig.batchIntervalMs);

    return () => {
      clearInterval(batchTimer);
      closeConnection();
      
      if (batchTimerRef.current) clearTimeout(batchTimerRef.current);
      if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current);
      //if (bobinaDelayTimeoutRef.current) clearTimeout(bobinaDelayTimeoutRef.current);
    };
  }, [connectWebSocket, processBatch, closeConnection, wsConfig.batchIntervalMs]);
  const [fontSize, setFontSize] = useState(16);
  useEffect(() => {
    addDebugLog('CONFIG', 
      `🔧 Node-RED WebSocket configuration updated`,
      { 
        currentUrl: wsConfig.urls[wsConfig.currentUrlIndex],
        urlIndex: wsConfig.currentUrlIndex,
        totalUrls: wsConfig.urls.length,
        urlSwitchEnabled: wsConfig.urlSwitchEnabled,
        expectedFormat: 'Node-RED flat JSON: {temperatura, pressaoEntrada, pressaoSaida1, situacaoAtuador, bobinaUtilizada, ...}'
      }
    );
  }, [wsConfig, addDebugLog]);

  // ========== STYLES ==========
  const styles = `
    :root {
    --base-font-size: ${fontSize}px;
    --bg: ${darkMode ? '#000000' : '#ffffff'};
    --panel: ${darkMode ? '#0a0a0a' : '#f8fafc'};
    --card: ${darkMode ? '#1a1a1a' : '#ffffff'};
    --text: ${darkMode ? '#ffffff' : '#1f2937'};
    --muted: ${darkMode ? '#9ca3af' : '#6b7280'};
    --accent: #14b8a6;
    --success: #22c55e;
    --warning: #f59e0b;
    --danger: #ef4444;
    --info: #3b82f6;
    --border: ${darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'};
    --shadow: ${darkMode ? '0 4px 20px rgba(0,0,0,0.8)' : '0 4px 20px rgba(0,0,0,0.1)'};
    --gradient: ${darkMode ? 
    'linear-gradient(135deg, #000000 0%, #1a1a1a 100%)' : 
    'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)'};

    * { 
      box-sizing: border-box; 
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    html {
        font-size: var(--base-font-size);
      }
    body, #root { 
      font-size: 1rem; /* Agora relativo ao --base-font-size */
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
      background: var(--bg);
      color: var(--text);
      margin: 0;
      padding: 0;
      height: 100%;
      transition: all 0.3s ease;
    }
    h1, h2, h3, h4, h5, h6, p, span, div, button, input {
    font-size: inherit; /* Herda o font-size do pai */
    }
      /* ========== CONTROLES DE TEMA E FONTE ========== */
    .theme-font-controls {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 12px;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      box-shadow: var(--shadow);
    }
    .theme-toggle {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.3s ease;
      font-size: calc(1rem * 0.85); /* 0.85x o font size base */
      font-weight: 600;
      color: var(--text);
    }
    .theme-toggle:hover {
      background: var(--accent);
      color: white;
      transform: translateY(-2px);  
    }
    .font-controls {
    display: flex;
    align-items: center;
    gap: 6px;
    }
    .font-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.3s ease;
      color: var(--text);
      font-size: calc(1rem * 0.8); /* 0.8x o font size base */
    }
    .font-btn:hover:not(:disabled) {
      background: var(--accent);
      color: white;
      transform: scale(1.1);  
    } 
    .font-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    }
    .font-size-display {
      font-size: calc(1rem * 0.8); /* 0.8x o font size base */
      font-weight: 600;
      color: var(--muted);
      min-width: 30px;
      text-align: center;
      }
    .dashboard {
       min-height: 100vh;
      background: var(--gradient);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      font-size: 1rem; /* Base font size aplicado */
    }

    .header {
      background: rgba(26, 26, 26, 0.9);
      backdrop-filter: blur(20px) saturate(180%);
      border-bottom: 1px solid var(--border);
      position: relative;
      z-index: 1000;
      box-shadow: var(--shadow);
      flex-shrink: 0;
    }

    .header-inner {
      max-width: 1800px;
      margin: 0 auto;
      padding: 20px 28px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      flex-wrap: wrap;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 18px;
    }

    .brand-icon {
      background: linear-gradient(135deg, var(--accent), #0d9488);
      padding: 14px;
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 8px 25px rgba(20, 184, 166, 0.3);
    }

    .brand-text h1 {
      font-size: calc(1rem * 1.85); /* 1.85x o font size base */
      font-weight: 800;
      margin: 0;
      background: linear-gradient(135deg, var(--accent), #0d9488);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      letter-spacing: -0.02em;
    }

    .brand-text p {
      font-size: 1rem; /* Base font size */
      font-weight: 500;
      color: var(--muted);
      margin: 6px 0 0 0;
      opacity: 0.9;
    }

    .controls {
      display: flex;
      align-items: center;
      gap: 14px;
      flex-wrap: wrap;
    }

    .status-indicator {
      padding: 12px 20px;
      border-radius: 30px;
      display: flex;
      align-items: center;
      gap: 12px;
      font-weight: 700;
      font-size: calc(1rem * 0.95); /* 0.95x o font size base */
      background: var(--card);
      border: 2px solid var(--border);
      box-shadow: var(--shadow);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      overflow: hidden;
    }

    .status-indicator::after {
      content: attr(data-url);
      position: absolute;
      bottom: -20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0,0,0,0.9);
      color: white;
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 0.7rem;
      white-space: nowrap;
      opacity: 0;
      pointer-events: none;
      transition: all 0.3s ease;
      z-index: 1001;
    }

    .status-indicator:hover::after {
      opacity: 1;
      bottom: -30px;
    }

    .status-receiving {
      background: linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(34, 197, 94, 0.15));
      border-color: #8b5cf6;
      color: #8b5cf6;
      animation: pulse-glow 2s infinite ease-in-out;
    }

    .status-connected {
      background: rgba(34, 197, 94, 0.1);
      border-color: #22c55e;
      color: #22c55e;
    }

    .status-disconnected {
      background: rgba(239, 68, 68, 0.1);
      border-color: #ef4444;
      color: #ef4444;
    }

    @keyframes pulse-glow {
      0%, 100% { 
        box-shadow: 0 0 20px rgba(139, 92, 246, 0.3), 0 4px 20px rgba(0,0,0,0.1); 
        transform: scale(1);
      }
      50% { 
        box-shadow: 0 0 35px rgba(139, 92, 246, 0.5), 0 0 50px rgba(139, 92, 246, 0.2), 0 4px 25px rgba(0,0,0,0.15);
        transform: scale(1.02);
      }
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 12px 18px;
      border-radius: 12px;
      border: none;
      cursor: pointer;
      font-weight: 700;
      font-size: calc(1rem * 0.9); /* 0.9x o font size base */
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      text-decoration: none;
      background: var(--accent);
      color: white;
      box-shadow: 0 4px 12px rgba(20, 184, 166, 0.3);
    }

    .btn:hover:not(:disabled) {
      transform: translateY(-3px);
      box-shadow: 0 12px 30px rgba(20, 184, 166, 0.4);
      filter: brightness(110%);
    }

    .btn:active:not(:disabled) {
      transform: translateY(-1px);
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }

    .btn-danger {
      background: linear-gradient(135deg, #ef4444, #dc2626);
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
    }

    .btn-danger:hover:not(:disabled) {
      box-shadow: 0 12px 30px rgba(239, 68, 68, 0.4);
    }

    .btn-warning {
      background: linear-gradient(135deg, #f59e0b, #d97706);
      box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
    }

    .btn-warning:hover:not(:disabled) {
      box-shadow: 0 12px 30px rgba(245, 158, 11, 0.4);
    }

    .btn-secondary {
      background: var(--card);
      color: var(--text);
      border: 2px solid var(--border);
      box-shadow: var(--shadow);
    }

    .btn-secondary:hover:not(:disabled) {
      background: var(--panel);
      border-color: var(--accent);
      box-shadow: 0 12px 30px rgba(0,0,0,0.15);
    }

    .btn-small {
      padding: 8px 14px;
      font-size: 0.8rem;
    }

    .container {
      max-width: 1800px;
      margin: 0 auto;
      padding: 32px;
      overflow-y: auto;
      flex-grow: 1;
      -webkit-overflow-scrolling: touch;
      font-size: inherit; /* Herda o font-size global */
    }

    .url-config {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 20px;
      margin-bottom: 20px;
      box-shadow: var(--shadow);
    }

    .url-config h3 {
      margin: 0 0 16px 0;
      color: var(--text);
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .url-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 16px;
    }

    .url-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 16px;
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 8px;
      font-family: monospace;
      font-size: 0.85rem;
    }

    .url-item.active {
      border-color: var(--accent);
      background: rgba(20, 184, 166, 0.1);
    }

    .url-indicator {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--muted);
    }

    .url-indicator.active {
      background: var(--accent);
    }

    .url-text {
      flex: 1;
      color: var(--text);
    }

    .url-failures {
      color: var(--danger);
      font-size: 0.75rem;
      font-weight: 600;
    }

    .url-input-group {
      display: flex;
      gap: 8px;
      margin-top: 12px;
    }

    .url-input {
      flex: 1;
      padding: 10px 16px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--panel);
      color: var(--text);
      font-family: monospace;
      font-size: 0.9rem;
    }

    .url-input:focus {
      outline: none;
      border-color: var(--accent);
    }

    .metrics-section {
      margin-bottom: 40px;
    }

    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
      flex-wrap: wrap;
      gap: 16px;
    }

    .section-info h2 {
      font-size: calc(1rem * 1.6); /* 1.6x o font size base */
      font-weight: 800;
      color: var(--text);
      margin: 0 0 8px 0;
      letter-spacing: -0.02em;
    }

    .section-info p {
      color: var(--muted);
      font-size: 1rem; /* Base font size */
      margin: 0;
      font-weight: 500;
    }

    .section-controls {
      display: flex;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;
    }

    .toggle-container {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .toggle-switch {
      position: relative;
      width: 54px;
      height: 28px;
      background: var(--border);
      border-radius: 14px;
      cursor: pointer;
      transition: all 0.3s ease;
      border: 2px solid var(--border);
    }

    .toggle-switch.active {
      background: var(--accent);
      border-color: var(--accent);
    }

    .toggle-switch::after {
      content: '';
      position: absolute;
      top: 2px;
      left: 2px;
      width: 20px;
      height: 20px;
      background: white;
      border-radius: 50%;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }

    .toggle-switch.active::after {
      transform: translateX(26px);
    }

    .toggle-label {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--muted);
    }

    .stats-overview {
      display: grid;
      gap: 20px;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      margin-bottom: 32px;
    }

    .stat-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 20px;
      text-align: center;
      box-shadow: var(--shadow);
      transition: all 0.3s ease;
    }

    .stat-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(0,0,0,0.15);
    }

    .stat-value {
      font-size: 1.8rem;
      font-weight: 800;
      margin-bottom: 6px;
      font-feature-settings: 'tnum';
    }

    .stat-value.excellent { color: var(--success); }
    .stat-value.good { color: var(--info); }
    .stat-value.warning { color: var(--warning); }
    .stat-value.critical { color: var(--danger); }

    .stat-label {
      font-size: 0.85rem;
      color: var(--muted);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .metrics-grid {
      display: grid;
      gap: 24px;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    }

    .metric-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 28px;
      box-shadow: var(--shadow);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      overflow: hidden;
    }

    .metric-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, var(--accent), #0d9488);
    }

    .metric-card:hover {
      transform: translateY(-6px);
      box-shadow: 0 20px 50px rgba(0,0,0,0.2);
    }

    .metric-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
    }

    .metric-info {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .metric-icon {
      background: linear-gradient(135deg, var(--accent), #0d9488);
      padding: 12px;
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 8px 20px rgba(20, 184, 166, 0.3);
    }

    .metric-title {
      font-size: 1rem;
      font-weight: 700;
      color: var(--muted);
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .metric-status {
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .metric-status.normal {
      background: rgba(34, 197, 94, 0.1);
      color: var(--success);
      border: 1px solid var(--success);
    }

    .metric-status.warning {
      background: rgba(245, 158, 11, 0.1);
      color: var(--warning);
      border: 1px solid var(--warning);
    }

    .metric-status.error {
      background: rgba(239, 68, 68, 0.1);
      color: var(--danger);
      border: 1px solid var(--danger);
    }

    .metric-value {
      font-size: calc(1rem * 2.6); /* 2.6x o font size base */
      font-weight: 900;
      color: var(--text);
      margin: 12px 0;
      font-feature-settings: 'tnum';
      letter-spacing: -0.02em;
    }

    .metric-unit {
      color: var(--muted);
      font-size: calc(1rem * 1.1); /* 1.1x o font size base */
      font-weight: 700;
      margin-left: 8px;
    }

    .metric-trend {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: calc(1rem * 0.9); /* 0.9x o font size base */
      color: var(--success);
      font-weight: 600;
      margin-top: 8px;
    }

    .charts-section {
      margin-bottom: 40px;
    }

    .charts-grid {
      display: grid;
      gap: 28px;
      grid-template-columns: repeat(auto-fit, minmax(550px, 1fr));
    }

    .chart-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 28px;
      box-shadow: var(--shadow);
      transition: all 0.3s ease;
    }

    .chart-card:hover {
      transform: translateY(-3px);
      box-shadow: 0 15px 40px rgba(0,0,0,0.15);
    }

    .chart-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 2px solid var(--border);
    }

    .chart-title {
      font-size: calc(1rem * 1.2); /* 1.2x o font size base */
      font-weight: 700;
      color: var(--text);
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .chart-meta {
      color: var(--muted);
      font-size: calc(1rem * 0.9); /* 0.9x o font size base */
      font-weight: 600;
      text-align: right;
    }

    .chart-container {
      height: 350px;
      width: 100%;
    }

    .debug-section {
      margin-bottom: 40px;
    }

    .debug-console {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 20px;
      overflow: hidden;
      box-shadow: var(--shadow);
    }

    .debug-header {
      background: linear-gradient(135deg, #f59e0b, #d97706);
      padding: 20px 28px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .debug-title {
      display: flex;
      align-items: center;
      gap: 12px;
      color: white;
      font-weight: 700;
      font-size: 1.1rem;
    }

    .debug-controls {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .debug-counter {
      background: rgba(255,255,255,0.2);
      color: white;
      padding: 6px 12px;
      border-radius: 10px;
      font-size: 0.85rem;
      font-weight: 600;
    }

    .debug-clear-btn {
      background: rgba(255,255,255,0.2);
      border: none;
      color: white;
      padding: 8px 16px;
      border-radius: 10px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .debug-clear-btn:hover {
      background: rgba(255,255,255,0.3);
    }

    .debug-content {
      max-height: 450px;
      overflow-y: auto;
      font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', Consolas, monospace;
      font-size: 13px;
    }

    .debug-content::-webkit-scrollbar {
      width: 8px;
    }

    .debug-content::-webkit-scrollbar-track {
      background: var(--panel);
    }

    .debug-content::-webkit-scrollbar-thumb {
      background: var(--border);
      border-radius: 4px;
    }

    .debug-content::-webkit-scrollbar-thumb:hover {
      background: var(--muted);
    }

    .debug-entry {
      padding: 16px 28px;
      border-bottom: 1px solid var(--border);
      display: flex;
      gap: 16px;
      align-items: flex-start;
      transition: background-color 0.2s ease;
      font-size: calc(1rem * 0.9); /* 0.9x o font size base */
    }

    .debug-entry:hover {
      background: var(--panel);
    }

    .debug-entry:last-child {
      border-bottom: none;
    }

    .debug-timestamp {
      color: var(--muted);
      font-size: 11px;
      min-width: 90px;
      padding-top: 3px;
      font-weight: 500;
    }

    .debug-type {
      font-weight: 800;
      font-size: 10px;
      padding: 4px 8px;
      border-radius: 6px;
      min-width: 90px;
      text-align: center;
      letter-spacing: 0.05em;
    }

    .debug-type-CONNECTION { background: #22c55e; color: white; }
    .debug-type-MESSAGE { background: #3b82f6; color: white; }
    .debug-type-DATA { background: #8b5cf6; color: white; }
    .debug-type-ERROR { background: #ef4444; color: white; }
    .debug-type-PERFORMANCE { background: #f59e0b; color: white; }
    .debug-type-HEARTBEAT { background: #06b6d4; color: white; }
    .debug-type-SECURITY { background: #ec4899; color: white; }
    .debug-type-CONFIG { background: #16a34a; color: white; }

    .debug-message {
      flex: 1;
      color: var(--text);
      line-height: 1.5;
      font-weight: 500;
      font-size: inherit;
    }

    .debug-data {
      margin-top: 12px;
      padding: 12px;
      background: var(--panel);
      border-radius: 8px;
      border: 1px solid var(--border);
      font-size: 11px;
      color: var(--muted);
      white-space: pre-wrap;
      overflow-x: auto;
    }

    .no-data {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 80px 20px;
      text-align: center;
      color: var(--muted);
      background: var(--card);
      border: 3px dashed var(--border);
      border-radius: 20px;
      margin: 32px 0;
    }

    .no-data-icon {
      margin-bottom: 20px;
      opacity: 0.6;
    }

    .no-data h3 {
      margin: 0 0 12px 0;
      color: var(--text);
      font-size: 1.4rem;
      font-weight: 700;
    }

    .no-data p {
      margin: 0 0 8px 0;
      font-size: 1rem;
      line-height: 1.5;
    }

    .no-data-meta {
      font-size: 0.85rem;
      margin-top: 16px;
      padding: 12px 20px;
      background: var(--panel);
      border-radius: 12px;
      border: 1px solid var(--border);
      font-family: 'SF Mono', monospace;
    }

    .empty-debug {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      color: var(--muted);
    }

    .empty-debug-icon {
      margin-bottom: 20px;
      opacity: 0.5;
    }

    .empty-debug h4 {
      margin: 0 0 8px 0;
      color: var(--text);
      font-size: 1.1rem;
      font-weight: 600;
    }

    .empty-debug p {
      margin: 0;
      font-size: 0.9rem;
      opacity: 0.8;
    }

    /* Responsive Design */
    @media (max-width: 1200px) {
      .charts-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 768px) {
      .header-inner {
        padding: 16px 24px;
        flex-direction: column;
        align-items: stretch;
      }
      
      .brand {
        justify-content: center;
      }
      
      .controls {
        justify-content: center;
        flex-wrap: wrap;
      }
      
      .container {
        padding: 24px 20px;
      }
      
      .metrics-grid {
        grid-template-columns: 1fr;
      }
      
      .charts-grid {
        grid-template-columns: 1fr;
      }
      
      .chart-container {
        height: 280px;
      }
      
      .stats-overview {
        grid-template-columns: repeat(2, 1fr);
      }

      .url-input-group {
        flex-direction: column;
      }
    }

    @media (max-width: 480px) {
      .brand-text h1 {
        font-size: 1.5rem;
      }
      
      .metric-value {
        font-size: 2.2rem;
      }
      
      .stats-overview {
        grid-template-columns: 1fr;
      }
      
      .debug-entry {
        padding: 12px 20px;
        flex-direction: column;
        gap: 8px;
      }
      
      .debug-timestamp, .debug-type {
        min-width: auto;
      }

      .section-controls {
        width: 100%;
        justify-content: space-between;
      }
    }

    /* Dark/Light mode transitions */
    *, *::before, *::after {
      transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
    }

    /* Performance optimizations */
    .chart-container * {
      will-change: transform;
    }

    /* Accessibility improvements */
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    }
  `;

  // ========== COMPONENTS ==========
  const MetricCard: React.FC<{
    title: string;
    value: number | string;
    unit: string;
    icon: React.ComponentType<any>;
    status?: 'normal' | 'warning' | 'error';
    trend?: string;
  }> = React.memo(({ title, value, unit, icon: Icon, status = 'normal', trend }) => (
    <div className="metric-card">
      <div className="metric-header">
        <div className="metric-info">
          <div className="metric-icon">
            <Icon size={22} color="white" />
          </div>
          <h3 className="metric-title">{title}</h3>
        </div>
        <div className={`metric-status ${status}`}>
          {status}
        </div>
      </div>
      <div className="metric-value">
        {typeof value === 'number' ? value.toFixed(2) : String(value)}
        <span className="metric-unit">{unit}</span>
      </div>
      {trend && (
        <div className="metric-trend">
          <TrendingUp size={16} />
          {trend}
        </div>
      )}
    </div>
  ));

  const CustomTooltip = React.memo(({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: 'rgba(10, 10, 10, 0.95)',
          padding: 18,
          borderRadius: 14,
          border: '2px solid #14b8a6',
          color: '#fff',
          boxShadow: '0 10px 40px rgba(0,0,0,0.4)',
          minWidth: 200
        }}>
          <div style={{ 
            fontWeight: 800, 
            marginBottom: 12, 
            color: '#14b8a6',
            fontSize: '1rem',
            borderBottom: '1px solid #374151',
            paddingBottom: 8
          }}>
            ⏰ {label}
          </div>
          {payload.map((entry: any, i: number) => (
            <div key={i} style={{ 
              color: entry.color, 
              fontSize: '0.9rem',
              marginBottom: 4,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ fontWeight: 600 }}>
                {entry.name || entry.dataKey}:
              </span>
              <span style={{ fontWeight: 800, marginLeft: 8 }}>
                {entry.value?.toFixed(2) || '0.00'}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  });
  // Toggle Dark/Light Mode
  const toggleDarkMode = useCallback(() => {
    setDarkMode(prev => {
      const newMode = !prev;
      localStorage.setItem('dashboard-dark-mode', JSON.stringify(newMode));
      addDebugLog('CONFIG', 
        `🎨 Tema alterado para: ${newMode ? 'Dark Mode' : 'Light Mode'}`,
        { darkMode: newMode }
      );
      return newMode;
    });
  }, [addDebugLog]);

  // Controle de tamanho da fonte
  const increaseFontSize = useCallback(() => {
    setFontSize(prev => {
      const newSize = Math.min(prev + 2, 24); // Máximo 24px
      localStorage.setItem('dashboard-font-size', JSON.stringify(newSize));
      addDebugLog('CONFIG', 
        `🔤 Fonte aumentada para: ${newSize}px`,
        { fontSize: newSize }
      );
      return newSize;
    });
  }, [addDebugLog]);

  const decreaseFontSize = useCallback(() => {
    setFontSize(prev => {
      const newSize = Math.max(prev - 2, 12); // Mínimo 12px
      localStorage.setItem('dashboard-font-size', JSON.stringify(newSize));
      addDebugLog('CONFIG', 
        `🔤 Fonte diminuída para: ${newSize}px`,
        { fontSize: newSize }
      );
      return newSize;
    });
  }, [addDebugLog]);

  const resetFontSize = useCallback(() => {
    setFontSize(16);
    localStorage.setItem('dashboard-font-size', JSON.stringify(16));
    addDebugLog('CONFIG', 
      `🔤 Fonte resetada para tamanho padrão: 16px`,
      { fontSize: 16 }
    );
  }, [addDebugLog]);

  // ========== RENDER ==========
  return (
    <div className="dashboard">
      <style>{styles}</style>
    
      {/* Header */}
      <header className="header">
        <div className="header-inner">
          <div className="brand">
            <div className="brand-icon">
              <Globe size={32} color="white" />
            </div>
            <div className="brand-text">
              <h1>Horizon-Solutions</h1>
              <p>Integrantes: Antonio, Giovanna, Paolo, Rafael e Siraj</p>
            </div>
          </div>

          <div className="controls">
            <div 
              className={`status-indicator ${connectionStatus.class}`}
              data-url={connectionMetrics.currentUrl}
            >
              <connectionStatus.icon size={18} />
              {connectionStatus.text}
            </div>

            <div className="toggle-container">
              <span className="toggle-label">URL Config</span>
              <div 
                className={`toggle-switch ${showUrlConfig ? 'active' : ''}`}
                onClick={() => setShowUrlConfig(!showUrlConfig)}
              />
            </div>

            <div className="toggle-container">
              <span className="toggle-label">Alertas</span>
              <div 
                className={`toggle-switch ${alertsEnabled ? 'active' : ''}`}
                onClick={() => setAlertsEnabled(!alertsEnabled)}
              />
            </div>

            <div className="toggle-container">
              <span className="toggle-label">Auto-Reconnect</span>
              <div 
                className={`toggle-switch ${autoReconnect ? 'active' : ''}`}
                onClick={() => setAutoReconnect(!autoReconnect)}
              />
            </div>

            <button onClick={handleSwitchUrl} className="btn btn-secondary btn-small" disabled={wsConfig.urls.length <= 1}>
              <Globe size={14} />
              Troca URL
            </button>

            <button onClick={handleTestData} className="btn btn-warning">
              <Database size={16} />
              Dados Mockados
            </button>

            <button 
              onClick={reconnectManual} 
              className="btn"
              disabled={isConnected}
            >
              <RefreshCw size={16} />
              Reconecte
            </button>

            <button onClick={handleClearData} className="btn btn-danger">
              <AlertCircle size={16} />
              Limpar os Dados
            </button>
            <div className="theme-font-controls">
            {/* Toggle Dark/Light Mode */}
            <div 
              className="theme-toggle" 
              onClick={toggleDarkMode}
              title={darkMode ? 'Mudar para Light Mode' : 'Mudar para Dark Mode'}
            >
              {darkMode ? (
                <>
                  <Sun size={14} />
                  Light
                </>
              ) : (
                <>
                  <Moon size={14} />
                  Dark
                </>
              )}
            </div>

            {/* Controles de Fonte */}
            <div className="font-controls">
              <button 
                className="font-btn"
                onClick={decreaseFontSize}
                disabled={fontSize <= 12}
                title="Diminuir fonte"
              >
                <Minus size={12} />
              </button>
              
              <div className="font-size-display">
                {fontSize}
              </div>
              
              <button 
                className="font-btn"
                onClick={increaseFontSize}
                disabled={fontSize >= 24}
                title="Aumentar fonte"
              >
                <Plus size={12} />
              </button>
              
              <button 
                className="font-btn"
                onClick={resetFontSize}
                title="Reset fonte"
              >
                <Type size={12} />
              </button>
          </div>
        </div>
        </div>
        </div>
      </header>
      <div className="container">
        {/* WebSocket URL Configuration */}
        {showUrlConfig && (
          <div className="url-config">
            <h3>
              <Globe size={20} />
              Node-RED WebSocket URL Configuration
            </h3>
            
            <div className="url-list">
              {wsConfig.urls.map((url, index) => (
                <div key={url} className={`url-item ${index === wsConfig.currentUrlIndex ? 'active' : ''}`}>
                  <div className={`url-indicator ${index === wsConfig.currentUrlIndex ? 'active' : ''}`} />
                  <div className="url-text">{url}</div>
                  {urlFailuresRef.current[url] > 0 && (
                    <div className="url-failures">
                      {urlFailuresRef.current[url]} failures
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="url-input-group">
              <input
                type="text"
                className="url-input"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="ws://192.168.3.8:1880/ws/dados"
              />
              <button onClick={handleAddCustomUrl} className="btn btn-small">
                Add URL
              </button>
            </div>
          </div>
        )}
        {/* Real-time Metrics */}
        <section className="metrics-section">
          <div className="section-header">
            <div className="section-info">
              <h2>Métricas em Tempo Real</h2>
              <p>Dados obtidos através de um Arduino e coletados em tempo real pela válvula</p>
            </div>
            <div className="section-controls">
              <div className="toggle-container">
                <span className="toggle-label">Modo Performance</span>
                <div 
                  className={`toggle-switch ${performanceMode ? 'active' : ''}`}
                  onClick={() => setPerformanceMode(!performanceMode)}
                />
              </div>
            </div>
          </div>
          <div className="metrics-grid">
            {/* CONTROLES DE SPEECH SYNTHESIS */}
            <div style={{
              gridColumn: '1 / -1',
              display: 'flex',
              justifyContent: 'center',
              gap: '16px',
              marginBottom: '20px',
              padding: '16px',
              background: 'var(--card)',
              borderRadius: '16px',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow)'
            }}>
              <button 
                onClick={() => announceMetricCards(currentData, dataStatistics)}
                className="btn"
                disabled={isSpeaking || !currentData.temperatura}
                style={{
                  background: isSpeaking ? '#f59e0b' : '#14b8a6',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}
              >
                {isSpeaking ? (
                  <>
                    <VolumeX size={18} />
                    Falando...
                  </>
                ) : (
                  <>
                    <Volume2 size={18} />
                    🔊 Anunciar Métricas dos Cards
                  </>
                )}
              </button>

              <button 
                onClick={toggleSpeechEnabled}
                className={`btn ${speechEnabled ? 'btn-secondary' : 'btn-danger'}`}
              >
                {speechEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                {speechEnabled ? 'Speech ON' : 'Speech OFF'}
              </button>

              {isSpeaking && (
                <button onClick={stopSpeaking} className="btn btn-warning">
                  <VolumeX size={16} />
                  Parar
                </button>
              )}
            </div>

            {/* CARDS EXISTENTES (mantém todos como estão) */}
            <MetricCard
              title="Temperatura"
              value={currentData.temperatura}
              unit="°C"
              icon={Thermometer}
              status={
                currentData.temperatura > ALERT_THRESHOLDS.temperatura.critical ? 'error' :
                currentData.temperatura > ALERT_THRESHOLDS.temperatura.max || currentData.temperatura < ALERT_THRESHOLDS.temperatura.min ? 'warning' :
                'normal'
              }
              trend={dataStatistics ? `Média: ${dataStatistics.avgTemp}°C` : undefined}
            />
            <MetricCard
              title="Pressão de Entrada"
              value={currentData.pressaoEntrada}
              unit="bar"
              icon={Wind}
              status={
                currentData.pressaoEntrada > ALERT_THRESHOLDS.fluxoAr.critical ? 'error' :
                currentData.pressaoEntrada > ALERT_THRESHOLDS.fluxoAr.max ? 'warning' :
                'normal'
              }
              trend={dataStatistics ? `Média: ${dataStatistics.avgPressaoEntrada} bar` : undefined}
            />
            <MetricCard
              title="Pressão Saída 1"
              value={currentData.pressaoSaida1}
              unit="bar"
              icon={Gauge}
              status={
                currentData.pressaoSaida1 > ALERT_THRESHOLDS.pressaoValvula.critical ? 'error' :
                currentData.pressaoSaida1 > ALERT_THRESHOLDS.pressaoValvula.max ? 'warning' :
                'normal'
              }
              trend={dataStatistics ? `Média: ${dataStatistics.avgPressaoSaida1} bar` : undefined}
            />
            <MetricCard
              title="Pressão Saída 2"
              value={currentData.pressaoSaida2}
              unit="bar"
              icon={Gauge}
              status={
                currentData.pressaoSaida2 > ALERT_THRESHOLDS.pressaoValvula.critical ? 'error' :
                currentData.pressaoSaida2 > ALERT_THRESHOLDS.pressaoValvula.max ? 'warning' :
                'normal'
              }
              trend={dataStatistics ? `Média: ${dataStatistics.avgPressaoSaida2} bar` : undefined}
            />
            <MetricCard
              title="Bobina da Válvula"
              value={currentData.bobinaUtilizada}
              unit=""
              icon={Power}
              status={currentData.status}
              trend={`Situação: ${currentData.situacaoAtuador}`}
            />
            <MetricCard
              title="Tempo de Comutação"
              value={currentData.comutacaoValvula || 0}
              unit="ms"
              icon={Clock}
              status="normal"
              trend={dataStatistics ? `Média: ${dataStatistics.avgTempoComutacao}ms` : undefined}
            />
          </div>
          {/* Visualização Animada da Válvula */}
            <div style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: '20px',
              padding: '28px',
              marginTop: '24px',
              boxShadow: 'var(--shadow)',
              textAlign: 'center'
            }}>
              <h3 style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                marginBottom: '20px',
                fontSize: '1.2rem',
                fontWeight: 700,
                color: 'var(--text)'
              }}>
              </h3>
              
              <div style={{
                position: 'relative',
                width: '100%',
                maxWidth: '600px',
                margin: '0 auto',
                height: '400px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--panel)',
                borderRadius: '16px',
                overflow: 'hidden'
              }}>
                {/* SUBSTITUA AS URLS ABAIXO PELOS SEUS GIFS */}
                {(() => {
    // ========== DEBUG COMPLETO ==========
    const isDireita = currentData.bobinaUtilizada?.toLowerCase().includes('direita');
    const isAvancado = currentData.situacaoAtuador?.toLowerCase().includes('avançado');
    const isRecuado = currentData.situacaoAtuador?.toLowerCase().includes('recuado') || 
                      currentData.situacaoAtuador?.toLowerCase().includes('retraído');
    
    console.log("=== DEBUG VÍDEO COMPLETO ===");
    console.log("bobinaUtilizada:", currentData.bobinaUtilizada);
    console.log("situacaoAtuador:", currentData.situacaoAtuador);
    console.log("isDireita:", isDireita);
    console.log("isAvancado:", isAvancado);
    console.log("isRecuado:", isRecuado);
    // ========== PERSISTÊNCIA DE CONFIGURAÇÕES (Adicionar após linha ~1650) ==========
    useEffect(() => {
      // Carrega configurações salvas do localStorage
      const savedDarkMode = localStorage.getItem('dashboard-dark-mode');
      const savedFontSize = localStorage.getItem('dashboard-font-size');
      
      if (savedDarkMode !== null) {
        setDarkMode(JSON.parse(savedDarkMode));
      }
      
      if (savedFontSize !== null) {
        setFontSize(JSON.parse(savedFontSize));
      }
      
      addDebugLog('CONFIG', 
        '⚙️ Configurações de tema e fonte carregadas',
        { 
          darkMode: savedDarkMode ? JSON.parse(savedDarkMode) : true,
          fontSize: savedFontSize ? JSON.parse(savedFontSize) : 16
        }
      );
    }, [addDebugLog]);

    // Lógica de seleção do vídeo
    const videoName = isDireita ? "Direita" : "Esquerda";
    const statusText = `${videoName.toLowerCase()} | ${currentData.situacaoAtuador || 'retraído'}`;
    
    console.log("Vídeo selecionado:", videoName);
    console.log("Status exibido:", statusText);
    console.log("========================");
  
  return (
    <div style={{ 
      width: '100%', 
      height: '400px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      border: '2px solid #4ade80',
      borderRadius: '16px',
      backgroundColor: '#1e293b',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* TÍTULO */}
      <div style={{
        position: 'absolute',
        top: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        color: '#4ade80',
        fontSize: '18px',
        fontWeight: 'bold',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <Power size={24} />
        Estado Visual da Válvula
      </div>

      {/* ÁREA DO VÍDEO */}
      <div style={{
        width: '90%',
        height: '70%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000',
        borderRadius: '8px',
        position: 'relative'
      }}>
        <video
          key={videoName} // Force re-render quando mudar
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain'
          }}
          onError={(e) => {
            console.error(`❌ ERRO ao carregar vídeo ${videoName}:`, e);
          }}
          onLoadStart={() => {
            console.log(`🎬 Iniciando carregamento: ${videoName}.mp4`);
          }}
          onCanPlay={() => {
            console.log(`✅ Vídeo pronto: ${videoName}.mp4`);
          }}
        >
          {/* Múltiplas tentativas de caminho */}
          <source src={`/img/${videoName}.mp4`} type="video/mp4" />
          <source src={`./img/${videoName}.mp4`} type="video/mp4" />
          <source src={`/public/img/${videoName}.mp4`} type="video/mp4" />
          <source src={`./public/img/${videoName}.mp4`} type="video/mp4" />
          
          {/* FALLBACK: Simulação visual com CSS */}
          <div style={{
            width: '100%',
            height: '100%',
            background: isDireita ? 
              'linear-gradient(45deg, #dc2626, #ef4444)' : 
              'linear-gradient(45deg, #2563eb, #3b82f6)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            color: 'white',
            fontSize: '24px',
            fontWeight: 'bold',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Animação de movimento */}
            <div style={{
              width: '80px',
              height: '20px',
              backgroundColor: 'white',
              borderRadius: '10px',
              transform: isAvancado ? 'translateX(40px)' : 'translateX(-40px)',
              transition: 'transform 0.8s ease-in-out',
              marginBottom: '20px',
              boxShadow: '0 4px 8px rgba(0,0,0,0.3)'
            }} />
            
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '20px', marginBottom: '8px' }}>
                🔧 Simulação Visual
              </div>
              <div style={{ fontSize: '16px', opacity: 0.9 }}>
                Válvula: {videoName}
              </div>
              <div style={{ fontSize: '14px', opacity: 0.7, marginTop: '4px' }}>
                Estado: {currentData.situacaoAtuador || 'Retraído'}
              </div>
            </div>
            
            {/* Indicador de problema */}
            <div style={{
              position: 'absolute',
              bottom: '10px',
              right: '10px',
              fontSize: '12px',
              opacity: 0.6,
              background: 'rgba(0,0,0,0.5)',
              padding: '4px 8px',
              borderRadius: '4px'
            }}>
              ⚠️ Vídeo não encontrado
            </div>
          </div>
        </video>
      </div>

      {/* STATUS INFERIOR */}
      <div style={{
        position: 'absolute',
        bottom: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        color: '#4ade80',
        fontSize: '16px',
        fontWeight: 'bold',
        background: 'rgba(74, 222, 128, 0.1)',
        padding: '8px 16px',
        borderRadius: '20px',
        border: '1px solid #4ade80'
      }}>
        {statusText}
      </div>
    </div>
  );
})()}
              </div>
              
              <div style={{
                marginTop: '16px',
                padding: '12px 20px',
                background: currentData.comutacaoValvula === 1 
                  ? 'rgba(34, 197, 94, 0.1)' 
                  : 'rgba(239, 68, 68, 0.1)',
                borderRadius: '12px',
                border: `2px solid ${currentData.comutacaoValvula === 1 ? '#22c55e' : '#ef4444'}`,
                color: currentData.comutacaoValvula === 1 ? '#22c55e' : '#ef4444',
                fontWeight: 700,
                fontSize: '1.1rem'
              }}>
                {currentData.bobinaUtilizada} | {currentData.situacaoAtuador}
              </div>
            </div>
        </section>
        {/* Interactive Charts */}
        <section className="charts-section">
          <div className="section-header">
            <div className="section-info">
              <h2>Log de análises</h2>
              <p>Gráficos interativos com os dados recebidos em tempo real pela Dashboard</p>
            </div>
          </div>

          {sensorData.length === 0 ? (
            <div className="no-data">
              <div className="no-data-icon">
                <Monitor size={80} />
              </div>
              <h3>Waiting for Node-RED Data</h3>
              <p>Connect Arduino to Node-RED and start data transmission</p>
              <p>System expects flat JSON structure with temperature, pressaoEntrada, pressaoSaida1, etc.</p>
              <div className="no-data-meta">
                <strong>Current Connection Details:</strong><br />
                Active URL: {connectionMetrics.currentUrl}<br />
                Status: {isConnected ? '🟢 Connected to Node-RED' : '🔴 Disconnected'}<br />
                Attempts: {connectionMetrics.reconnectAttempts}/{wsConfig.reconnectMaxAttempts}<br />
                Quality: {connectionMetrics.connectionQuality}<br />
                Available URLs: {wsConfig.urls.length}<br />
                Expected Format: Flat JSON {`{temperatura: 17.78, pressaoEntrada: 3.54, ...}`}
              </div>
            </div>
          ) : (
            <div className="charts-grid">
              {/* Temperature Trend */}
              <div className="chart-card">
                <div className="chart-header">
                  <div className="chart-title">
                    <Thermometer size={20} color="#ef4444" />
                    Análises da Temperatura
                  </div>
                  <div className="chart-meta">
                    {sensorData.length} Amostras<br />
                    Variação da temperatura: {Math.min(...sensorData.map(d => d.temperatura)).toFixed(1)}°C - {Math.max(...sensorData.map(d => d.temperatura)).toFixed(1)}°C
                  </div>
                </div>
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={sensorData}>
                      <defs>
                        <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis 
                        dataKey="time" 
                        stroke="#9ca3af" 
                        fontSize={11}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis 
                        stroke="#9ca3af" 
                        fontSize={11}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <ReferenceLine y={ALERT_THRESHOLDS.temperatura.max} stroke="#f59e0b" strokeDasharray="5 5" />
                      <ReferenceLine y={ALERT_THRESHOLDS.temperatura.critical} stroke="#ef4444" strokeDasharray="5 5" />
                      <Area
                        type="monotone"
                        dataKey="temperatura"
                        stroke="#ef4444"
                        strokeWidth={3}
                        fill="url(#tempGradient)"
                        name="Temperatura em °C"
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              {/* Gráfico Pressão de Entrada */}
              <div className="chart-card">
                <div className="chart-header">
                  <div className="chart-title">
                    <Wind size={20} color="#3b82f6" />
                    Pressão de Entrada
                  </div>
                  <div className="chart-meta">
                    {sensorData.length} Amostras<br />
                    Variação: {Math.min(...sensorData.map(d => d.pressaoEntrada)).toFixed(2)} - {Math.max(...sensorData.map(d => d.pressaoEntrada)).toFixed(2)} bar
                  </div>
                </div>
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={sensorData}>
                      <defs>
                        <linearGradient id="pressaoEntradaGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis 
                        dataKey="time" 
                        stroke="#9ca3af" 
                        fontSize={11}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis 
                        stroke="#9ca3af" 
                        fontSize={11}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <ReferenceLine y={ALERT_THRESHOLDS.fluxoAr.max} stroke="#f59e0b" strokeDasharray="5 5" />
                      <Area
                        type="monotone"
                        dataKey="pressaoEntrada"
                        stroke="#3b82f6"
                        strokeWidth={3}
                        fill="url(#pressaoEntradaGradient)"
                        name="Pressão Entrada (bar)"
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              {/* Gráfico Pressão Saída 1 */}
              <div className="chart-card">
                <div className="chart-header">
                  <div className="chart-title">
                    <Gauge size={20} color="#eab308" />
                    Pressão de Saída 1
                  </div>
                  <div className="chart-meta">
                    {sensorData.length} Amostras<br />
                    Variação: {Math.min(...sensorData.map(d => d.pressaoSaida1)).toFixed(2)} - {Math.max(...sensorData.map(d => d.pressaoSaida1)).toFixed(2)} bar
                  </div>
                </div>
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={sensorData}>
                      <defs>
                        <linearGradient id="pressaoSaida1Gradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#eab308" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#eab308" stopOpacity={0.1} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis 
                        dataKey="time" 
                        stroke="#9ca3af" 
                        fontSize={11}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis 
                        stroke="#9ca3af" 
                        fontSize={11}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <ReferenceLine y={ALERT_THRESHOLDS.pressaoValvula.max} stroke="#f59e0b" strokeDasharray="5 5" />
                      <Area
                        type="monotone"
                        dataKey="pressaoSaida1"
                        stroke="#eab308"
                        strokeWidth={3}
                        fill="url(#pressaoSaida1Gradient)"
                        name="Pressão Saída 1 (bar)"
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Gráfico Pressão Saída 2 */}
              <div className="chart-card">
                <div className="chart-header">
                  <div className="chart-title">
                    <Gauge size={20} color="#10b981" />
                    Pressão de Saída 2
                  </div>
                  <div className="chart-meta">
                    {sensorData.length} Amostras<br />
                    Variação: {Math.min(...sensorData.map(d => d.pressaoSaida2)).toFixed(2)} - {Math.max(...sensorData.map(d => d.pressaoSaida2)).toFixed(2)} bar
                  </div>
                </div>
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={sensorData}>
                      <defs>
                        <linearGradient id="pressaoSaida2Gradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.1} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis 
                        dataKey="time" 
                        stroke="#9ca3af" 
                        fontSize={11}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis 
                        stroke="#9ca3af" 
                        fontSize={11}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <ReferenceLine y={ALERT_THRESHOLDS.pressaoValvula.max} stroke="#f59e0b" strokeDasharray="5 5" />
                      <Area
                        type="monotone"
                        dataKey="pressaoSaida2"
                        stroke="#10b981"
                        strokeWidth={3}
                        fill="url(#pressaoSaida2Gradient)"
                        name="Pressão Saída 2 (bar)"
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              {/* Tempo de Comutação da Válvula */}
<div className="chart-card">
  <div className="chart-header">
    <div className="chart-title">
      <Clock size={20} color="#f59e0b" />
      Tempo de Comutação da Válvula
    </div>
    <div className="chart-meta">
      {sensorData.length} Amostras<br />
      Média: {(sensorData.reduce((sum, d) => sum + d.tempoComutacao, 0) / sensorData.length).toFixed(1)}ms
    </div>
  </div>
  <div className="chart-container">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={sensorData}>
        <defs>
          <linearGradient id="comutacaoGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8} />
            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.3} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis 
          dataKey="time" 
          stroke="#9ca3af" 
          fontSize={11}
          axisLine={false}
          tickLine={false}
        />
        <YAxis 
          stroke="#9ca3af" 
          fontSize={11}
          axisLine={false}
          tickLine={false}
          label={{ value: 'Tempo (ms)', angle: -90, position: 'insideLeft' }}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine y={50} stroke="#22c55e" strokeDasharray="5 5" label="Ótimo" />
        <ReferenceLine y={100} stroke="#f59e0b" strokeDasharray="5 5" label="Limite" />
        <Bar
          dataKey="tempoComutacao"
          fill="url(#comutacaoGradient)"
          name="Tempo Comutação (ms)"
          isAnimationActive={false}
          radius={[8, 8, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  </div>
</div>

              <LineChart data={sensorData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  dataKey="time" 
                  stroke="#9ca3af" 
                  fontSize={11}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  stroke="#9ca3af" 
                  fontSize={11}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="temperatura"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={{ r: 0 }}
                  name="Temperatura (°C)"
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="pressaoEntrada"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 0 }}
                  name="Pressão Entrada (bar)"
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="pressaoSaida1"
                  stroke="#eab308"
                  strokeWidth={2}
                  dot={{ r: 0 }}
                  name="Pressão Saída 1 (bar)"
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="pressaoSaida2"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 0 }}
                  name="Pressão Saída 2 (bar)"
                  isAnimationActive={false}
                />
              </LineChart>
            </div>
          )}
        </section>
        
        {/* Debug Console */}
<section className="debug-section">
  <div className="debug-console">
    <div className="debug-header">
      <div className="debug-title">
        <Bug size={20} />
        Enterprise Debug Console & Flat JSON Processing
      </div>
      <div className="debug-controls">
        <div className="debug-counter">
          {debugLogs.length} logs • {securityViolationsRef.current} security violations • {wsConfig.urls.length} URLs
        </div>
        <button onClick={handleClearLogs} className="debug-clear-btn">
          Clear Logs
        </button>
      </div>
    </div>
          
    <div className="debug-content">
      {debugLogs.length === 0 ? (
        <div className="empty-debug">
          <div className="empty-debug-icon">
            <Clock size={40} />
          </div>
          <h4>System monitoring active</h4>
          <p>Debug information and flat JSON processing logs will appear here</p>
        </div>
      ) : (
        debugLogs.map((log, index) => (
          <div key={log.id ?? index} className="debug-entry">
            <div className="debug-timestamp">
              {new Date(log.timestamp).toLocaleTimeString('pt-BR')}
            </div>
            <div className={`debug-type debug-type-${log.type || ''}`}>
              {log.type}
            </div>
            <div className="debug-message">
              {log.message}
              {log.data && (
                <div className="debug-data">
                  {JSON.stringify(log.data, null, 2)}
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  </div>
</section>

      </div>
    </div>
  );
};

export default EnterpriseIoTDashboard;
