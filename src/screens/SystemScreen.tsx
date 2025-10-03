import React, { useState, useEffect, useRef, useCallback } from 'react';

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
Bar
} from 'recharts';

import {
Activity,
Thermometer,
Gauge,
Power,
Clock,
CheckCircle,
RefreshCw,
Wifi,
WifiOff,
AlertCircle,
PlayCircle,
Database,
Settings,
Zap,
Upload,
Code,
Send,
FileText,
CloudUpload,
X
} from 'lucide-react';

// Interfaces atualizadas
interface SensorData {
timestamp: number;
time: string;
temperatura: number;
tempoComutacao: number;
pressaoEntrada: number;
pressaoSaida1: number;
pressaoSaida2: number;
situacaoAtuador: string;
bobinaUtilizada: string;
status: string;
}

interface DebugInfo {
timestamp: string;
type: 'CONNECTION' | 'MESSAGE' | 'DATA' | 'ERROR' | 'CHART' | 'MANUAL' | 'FILE';
message: string;
data?: any;
}

interface UploadedFile {
name: string;
size: number;
content: string;
processedAt: string;
recordCount: number;
}

const SystemScreen: React.FC = (): React.JSX.Element => {
  // Estados
  const [sensorData, setSensorData] = useState<SensorData[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isReceivingRealData, setIsReceivingRealData] = useState(false);
  const [lastRawMessage, setLastRawMessage] = useState<string>('');
  const [debugLog, setDebugLog] = useState<DebugInfo[]>([]);
  const [forceRender, setForceRender] = useState(0);
  const [manualJsonInput, setManualJsonInput] = useState<string>('');
  const [jsonInputError, setJsonInputError] = useState<string>('');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  
  // Refs
  const sensorDataRef = useRef<SensorData[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  const messageCountRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Função de debug
  const addDebugLog = useCallback((type: DebugInfo['type'], message: string, data?: any) => {
    const debugEntry: DebugInfo = {
      timestamp: new Date().toLocaleTimeString('pt-BR'),
      type,
      message,
      data
    };
    
    console.log(`🔍 [${type}] ${message}`, data);
    setDebugLog(prev => [debugEntry, ...prev.slice(0, 29)]);
  }, []);

  // Função para processar dados do Arduino/JSON
  const processArduinoData = useCallback((rawMessage: string, isManual: boolean = false, isFile: boolean = false): SensorData | null => {
    try {
      const logType = isFile ? 'FILE' : (isManual ? 'MANUAL' : 'MESSAGE');
      addDebugLog(logType, `Processando: ${rawMessage.substring(0, 100)}...`);
      
      const parsed = JSON.parse(rawMessage);
      addDebugLog('DATA', 'JSON parseado:', parsed);
      
      let data = parsed;
      if (parsed.payload) {
        data = parsed.payload;
        addDebugLog('DATA', 'Usando payload:', data);
      }
      
      const timestamp = data.timestamp || Date.now();
      
      const sensorReal: SensorData = {
        timestamp,
        time: new Date(timestamp).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }),
        temperatura: Number(data.temperatura || data.Temperatura || data.temp || data.temperature) || (20 + Math.random() * 15),
        tempoComutacao: Number(data.tempoComutacao || data.switchTime || data.comutacao_time || data.tempo_comutacao) || (5 + Math.random() * 20),
        pressaoEntrada: Number(data.pressaoEntrada || data.pressure_in || data.entrada || data.pressao_entrada) || (1.0 + Math.random() * 2.0),
        pressaoSaida1: Number(data.pressaoSaida1 || data.pressure_out1 || data.saida1 || data.pressao_saida1) || (0.5 + Math.random() * 1.5),
        pressaoSaida2: Number(data.pressaoSaida2 || data.pressure_out2 || data.saida2 || data.pressao_saida2) || (0.3 + Math.random() * 1.2),
        situacaoAtuador: data.situacaoAtuador || data.atuador || data.actuator_status || data.situacao_atuador || (Math.random() > 0.7 ? 'Avançado' : 'Recuado'),
        bobinaUtilizada: data.bobinaUtilizada || data.bobina || data.coil || data.bobina_utilizada || (Math.random() > 0.5 ? 'Direita' : 'Esquerda'),
        status: data.status || 'normal'
      };

      addDebugLog('DATA', `Sensor processado: T=${sensorReal.temperatura}°C`, sensorReal);
      return sensorReal;
      
    } catch (error) {
      addDebugLog('ERROR', `Erro ao processar: ${error}`, { rawMessage, error });
      return null;
    }
  }, [addDebugLog]);

  // Função para atualizar dados
  const updateSensorData = useCallback((newSensor: SensorData) => {
    setSensorData(prevData => {
      const updatedData = [...prevData, newSensor];
      const limitedData = updatedData.slice(-100); // Aumentado para 100 registros
      
      sensorDataRef.current = limitedData;
      
      addDebugLog('CHART', `Dados atualizados: ${limitedData.length} registros`, {
        latest: newSensor,
        totalRecords: limitedData.length
      });
      
      setForceRender(prev => prev + 1);
      return limitedData;
    });
    
    if (!isReceivingRealData) {
      setIsReceivingRealData(true);
      addDebugLog('DATA', 'Primeira recepção de dados reais!');
    }
  }, [isReceivingRealData, addDebugLog]);

  // Função para processar arquivo JSON
  const processJsonFile = useCallback(async (file: File): Promise<void> => {
    setIsProcessingFile(true);
    
    try {
      addDebugLog('FILE', `Iniciando processamento do arquivo: ${file.name} (${(file.size / 1024).toFixed(2)}KB)`);
      
      const fileContent = await file.text();
      const parsed = JSON.parse(fileContent);
      
      // Verifica se é um array de dados ou um único objeto
      let dataArray: any[] = [];
      
      if (Array.isArray(parsed)) {
        dataArray = parsed;
      } else if (parsed.data && Array.isArray(parsed.data)) {
        dataArray = parsed.data;
      } else if (parsed.sensores && Array.isArray(parsed.sensores)) {
        dataArray = parsed.sensores;
      } else if (parsed.registros && Array.isArray(parsed.registros)) {
        dataArray = parsed.registros;
      } else {
        // Se for um único objeto, transforma em array
        dataArray = [parsed];
      }
      
      addDebugLog('FILE', `Arquivo contém ${dataArray.length} registro(s)`);
      
      // Processa cada registro
      let processedCount = 0;
      let failedCount = 0;
      
      for (const record of dataArray) {
        const recordJson = JSON.stringify(record);
        const sensorData = processArduinoData(recordJson, false, true);
        
        if (sensorData) {
          updateSensorData(sensorData);
          processedCount++;
          
          // Adiciona um pequeno delay para não sobrecarregar a interface
          await new Promise(resolve => setTimeout(resolve, 50));
        } else {
          failedCount++;
        }
      }
      
      // Registra o arquivo processado
      const uploadedFile: UploadedFile = {
        name: file.name,
        size: file.size,
        content: fileContent.substring(0, 200) + (fileContent.length > 200 ? '...' : ''),
        processedAt: new Date().toLocaleTimeString('pt-BR'),
        recordCount: processedCount
      };
      
      setUploadedFiles(prev => [uploadedFile, ...prev.slice(0, 4)]); // Mantém últimos 5 arquivos
      
      addDebugLog('FILE', `✅ Arquivo processado: ${processedCount} sucessos, ${failedCount} falhas`, {
        fileName: file.name,
        processed: processedCount,
        failed: failedCount
      });
      
    } catch (error) {
      addDebugLog('ERROR', `Erro ao processar arquivo ${file.name}: ${error}`, { error, fileName: file.name });
      setJsonInputError(`Erro ao processar arquivo: ${error}`);
    } finally {
      setIsProcessingFile(false);
    }
  }, [processArduinoData, updateSensorData, addDebugLog]);

  // Handlers para drag & drop
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setJsonInputError('');
    
    const files = Array.from(e.dataTransfer.files);
    const jsonFiles = files.filter(file => file.name.toLowerCase().endsWith('.json'));
    
    if (jsonFiles.length === 0) {
      setJsonInputError('Por favor, solte apenas arquivos .json');
      return;
    }
    
    // Processa cada arquivo JSON
    jsonFiles.forEach(processJsonFile);
  }, [processJsonFile]);

  // Handler para input de arquivo
  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const jsonFiles = files.filter(file => file.name.toLowerCase().endsWith('.json'));
    
    if (jsonFiles.length === 0) {
      setJsonInputError('Por favor, selecione apenas arquivos .json');
      return;
    }
    
    setJsonInputError('');
    jsonFiles.forEach(processJsonFile);
    
    // Limpa o input para permitir o mesmo arquivo novamente
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [processJsonFile]);

  // Conexão WebSocket (mantida igual)
  const connectWebSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
    }

    const wsUrl = 'ws://192.168.15.4:1880/ws/dados';
    addDebugLog('CONNECTION', `Conectando: ${wsUrl}`);
    
    try {
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      const connectTimeout = setTimeout(() => {
        if (socket.readyState === WebSocket.CONNECTING) {
          addDebugLog('ERROR', 'TIMEOUT: Conexão demorou mais que 10s');
          socket.close();
        }
      }, 10000);

      socket.onopen = () => {
        clearTimeout(connectTimeout);
        setIsConnected(true);
        messageCountRef.current = 0;
        addDebugLog('CONNECTION', '✅ WebSocket CONECTADO! Aguardando dados...');
      };

      socket.onmessage = (event) => {
        messageCountRef.current++;
        setLastRawMessage(event.data);
        
        addDebugLog('MESSAGE', `Mensagem #${messageCountRef.current} recebida (${event.data.length} chars)`);
        
        const sensorData = processArduinoData(event.data, false, false);
        
        if (sensorData) {
          addDebugLog('DATA', 'Dados válidos processados, atualizando gráficos...', sensorData);
          updateSensorData(sensorData);
        } else {
          addDebugLog('ERROR', 'Dados inválidos ou sem campos de sensores');
        }
      };

      socket.onerror = (error) => {
        clearTimeout(connectTimeout);
        addDebugLog('ERROR', `Erro WebSocket: ${error}`);
        setIsConnected(false);
      };

      socket.onclose = (event) => {
        clearTimeout(connectTimeout);
        setIsConnected(false);
        addDebugLog('CONNECTION', `Desconectado - Code: ${event.code}, Razão: ${event.reason || 'Desconhecida'}`);
        
        reconnectTimeout.current = setTimeout(() => {
          addDebugLog('CONNECTION', 'Tentando reconexão...');
          connectWebSocket();
        }, 3000);
      };

    } catch (error) {
      addDebugLog('ERROR', `Erro ao criar WebSocket: ${error}`);
      setIsConnected(false);
    }
  }, [processArduinoData, updateSensorData, addDebugLog]);

  // Inicialização
  useEffect(() => {
    addDebugLog('CONNECTION', '🚀 Iniciando sistema...');
    connectWebSocket();

    return () => {
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
      addDebugLog('CONNECTION', '🔌 Sistema desconectado');
    };
  }, []);

  // Funções de controle (mantidas iguais)
  const handleForceReconnect = useCallback(() => {
    addDebugLog('CONNECTION', '🔄 Reconexão manual iniciada');
    connectWebSocket();
  }, [connectWebSocket]);

  const handleClearData = useCallback(() => {
    setSensorData([]);
    sensorDataRef.current = [];
    setIsReceivingRealData(false);
    setForceRender(prev => prev + 1);
    addDebugLog('DATA', '🗑️ Dados limpos');
  }, [addDebugLog]);

  const handleTestData = useCallback(() => {
    const testSensor: SensorData = {
      timestamp: Date.now(),
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      temperatura: 25 + Math.random() * 10,
      tempoComutacao: 5 + Math.random() * 20,
      pressaoEntrada: 1.5 + Math.random() * 1.5,
      pressaoSaida1: 0.8 + Math.random() * 1.2,
      pressaoSaida2: 0.6 + Math.random() * 1.0,
      situacaoAtuador: Math.random() > 0.5 ? 'Avançado' : 'Recuado',
      bobinaUtilizada: Math.random() > 0.5 ? 'Direita' : 'Esquerda',
      status: 'normal'
    };
    
    addDebugLog('DATA', '🧪 Dados de teste adicionados', testSensor);
    updateSensorData(testSensor);
  }, [updateSensorData, addDebugLog]);

  // Função para processar JSON manual
  const handleManualJsonSubmit = useCallback(() => {
    if (!manualJsonInput.trim()) {
      setJsonInputError('Por favor, insira um JSON válido');
      return;
    }

    try {
      setJsonInputError('');
      const sensorData = processArduinoData(manualJsonInput, true, false);
      
      if (sensorData) {
        addDebugLog('MANUAL', '📝 Dados JSON manuais processados com sucesso', sensorData);
        updateSensorData(sensorData);
        setManualJsonInput('');
      } else {
        setJsonInputError('Dados JSON não contêm campos de sensores válidos');
      }
    } catch (error) {
      setJsonInputError(`Erro ao processar JSON: ${error}`);
      addDebugLog('ERROR', 'Erro no JSON manual', { error, input: manualJsonInput });
    }
  }, [manualJsonInput, processArduinoData, updateSensorData, addDebugLog]);

  // Função para preencher exemplo JSON
  const handleFillExampleJson = useCallback(() => {
    const exampleJson = {
      timestamp: Date.now(),
      temperatura: 28.5,
      tempoComutacao: 12.3,
      pressaoEntrada: 2.1,
      pressaoSaida1: 1.4,
      pressaoSaida2: 0.9,
      situacaoAtuador: "Avançado",
      bobinaUtilizada: "Direita"
    };
    
    setManualJsonInput(JSON.stringify(exampleJson, null, 2));
    setJsonInputError('');
  }, []);

  // Estilos atualizados com componentes de upload
  const styles = `
:root {
--bg: #0a0a0b;
--panel: #111115;
--card: #1a1a1f;
--muted: #8b8b95;
--accent: #00d4ff;
--success: #00ff88;
--warning: #ffaa00;
--danger: #ff4444;
--card-border: rgba(255,255,255,0.08);
--text: #ffffff;
--debug: #f59e0b;
}

* { box-sizing: border-box; }

html, body {
margin: 0;
padding: 0;
height: 100%;
font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
background: var(--bg);
color: var(--text);
overflow-x: hidden;
overflow-y: auto;
}

#root {
min-height: 100vh;
width: 100%;
}

.page { 
min-height: 100vh; 
width: 100%;
background: linear-gradient(135deg, var(--bg) 0%, #0f0f14 100%); 
overflow-x: hidden;
}

/* Scroll personalizado */
::-webkit-scrollbar {
width: 8px;
height: 8px;
}

::-webkit-scrollbar-track {
background: var(--bg);
}

::-webkit-scrollbar-thumb {
background: var(--accent);
border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
background: #0099cc;
}

* {
scrollbar-width: thin;
scrollbar-color: var(--accent) var(--bg);
}

.header { 
background: rgba(10,10,11,0.95); 
backdrop-filter: blur(20px);
position: sticky; 
top: 0; 
z-index: 60; 
border-bottom: 1px solid rgba(0,212,255,0.2);
box-shadow: 0 8px 32px rgba(0,0,0,0.4);
}

.header-inner { 
max-width: 1600px; 
margin: 0 auto; 
padding: 20px; 
display:flex; 
align-items:center; 
justify-content:space-between; 
gap:16px; 
flex-wrap: wrap;
}

.brand { display:flex; gap:16px; align-items:center; }
.brand h1 { margin:0; font-size: 1.5rem; color: var(--text); font-weight: 700; }
.brand p { margin:0; color: var(--muted); font-size: 0.9rem; }

.container { 
max-width: 1600px; 
margin: 20px auto; 
padding: 0 20px 40px; 
width: 100%;
}

.panel-highlight { 
background: var(--panel); 
border: 1px solid var(--card-border); 
border-radius: 16px; 
padding: 24px; 
margin-bottom: 24px;
box-shadow: 0 16px 48px rgba(0,0,0,0.3);
width: 100%;
}

.panel-title { 
color: var(--accent); 
font-weight: 700; 
font-size: 1.1rem;
margin-bottom: 16px; 
display:flex; 
align-items:center; 
gap:12px; 
}

/* Upload de Arquivo */
.upload-section {
display: flex;
gap: 20px;
margin-bottom: 20px;
}

.file-upload-area {
flex: 1;
border: 2px dashed var(--card-border);
border-radius: 12px;
padding: 30px;
text-align: center;
cursor: pointer;
transition: all 0.3s ease;
background: var(--card);
position: relative;
}

.file-upload-area:hover,
.file-upload-area.dragging {
border-color: var(--accent);
background: rgba(0, 212, 255, 0.05);
transform: translateY(-2px);
}

.file-upload-area.processing {
border-color: var(--warning);
background: rgba(255, 170, 0, 0.05);
}

.upload-icon {
margin-bottom: 12px;
opacity: 0.7;
}

.upload-text {
margin-bottom: 8px;
}

.upload-text h3 {
margin: 0 0 8px 0;
color: var(--text);
}

.upload-text p {
margin: 0;
color: var(--muted);
font-size: 0.9rem;
}

.file-input {
position: absolute;
width: 100%;
height: 100%;
opacity: 0;
cursor: pointer;
}

.uploaded-files {
flex: 1;
min-width: 300px;
}

.uploaded-files h4 {
margin: 0 0 12px 0;
color: var(--muted);
font-size: 0.9rem;
display: flex;
align-items: center;
gap: 8px;
}

.file-list {
max-height: 200px;
overflow-y: auto;
}

.file-item {
background: var(--bg);
border: 1px solid var(--card-border);
border-radius: 8px;
padding: 12px;
margin-bottom: 8px;
font-size: 0.85rem;
}

.file-item-header {
display: flex;
justify-content: between;
align-items: center;
margin-bottom: 4px;
}

.file-name {
font-weight: 600;
color: var(--accent);
}

.file-stats {
color: var(--muted);
font-size: 0.8rem;
}

.processing-indicator {
display: flex;
align-items: center;
gap: 8px;
color: var(--warning);
font-size: 0.9rem;
margin-top: 10px;
}

.processing-spinner {
width: 16px;
height: 16px;
border: 2px solid var(--card-border);
border-top: 2px solid var(--warning);
border-radius: 50%;
animation: spin 1s linear infinite;
}

@keyframes spin {
0% { transform: rotate(0deg); }
100% { transform: rotate(360deg); }
}

/* JSON Input Panel */
.json-input-panel {
background: var(--card);
border: 1px solid var(--card-border);
border-radius: 12px;
padding: 20px;
margin-bottom: 16px;
}

.json-input-header {
display: flex;
justify-content: space-between;
align-items: center;
margin-bottom: 16px;
flex-wrap: wrap;
gap: 12px;
}

.json-input-title {
display: flex;
align-items: center;
gap: 8px;
font-weight: 700;
color: var(--accent);
}

.json-buttons {
display: flex;
gap: 8px;
flex-wrap: wrap;
}

.json-textarea {
width: 100%;
min-height: 120px;
background: var(--bg);
border: 1px solid var(--card-border);
border-radius: 8px;
padding: 12px;
color: var(--text);
font-family: 'JetBrains Mono', 'Consolas', monospace;
font-size: 13px;
resize: vertical;
}

.json-textarea:focus {
outline: none;
border-color: var(--accent);
box-shadow: 0 0 0 2px rgba(0, 212, 255, 0.1);
}

.json-error {
color: var(--danger);
font-size: 0.9rem;
margin-top: 8px;
padding: 8px;
background: rgba(255, 68, 68, 0.1);
border-radius: 4px;
border-left: 3px solid var(--danger);
}

/* Status Cards */
.status-grid { 
display: grid; 
gap: 16px; 
grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
margin-bottom: 24px;
}

.status-card {
background: var(--card);
border-radius: 12px;
padding: 20px;
border: 1px solid var(--card-border);
display: flex;
align-items: center;
gap: 16px;
transition: all 0.3s ease;
}

.status-card:hover {
transform: translateY(-2px);
box-shadow: 0 8px 24px rgba(0,212,255,0.1);
}

.status-icon {
width: 48px;
height: 48px;
border-radius: 12px;
display: flex;
align-items: center;
justify-content: center;
}

.status-icon.atuador-avancado { background: linear-gradient(135deg, var(--success), #00cc77); }
.status-icon.atuador-recuado { background: linear-gradient(135deg, var(--warning), #cc8800); }
.status-icon.bobina-direita { background: linear-gradient(135deg, var(--accent), #0099cc); }
.status-icon.bobina-esquerda { background: linear-gradient(135deg, var(--danger), #cc3333); }

.status-info h3 { 
margin: 0 0 4px 0; 
font-size: 0.9rem; 
color: var(--muted); 
font-weight: 500;
}

.status-info p { 
margin: 0; 
font-size: 1.2rem; 
font-weight: 700; 
}

.status-info .avancado { color: var(--success); }
.status-info .recuado { color: var(--warning); }
.status-info .direita { color: var(--accent); }
.status-info .esquerda { color: var(--danger); }

/* Métricas */
.metrics-grid { 
display:grid; 
gap:16px; 
grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
margin-bottom: 24px;
}

.metric-card { 
background: var(--card); 
border-radius: 12px; 
padding: 20px; 
border: 1px solid var(--card-border);
transition: all 0.3s ease;
}

.metric-card:hover {
transform: translateY(-2px);
box-shadow: 0 8px 24px rgba(0,0,0,0.2);
}

.metric-top { 
display:flex; 
justify-content:space-between; 
align-items:center; 
margin-bottom:12px; 
}

.metric-left { display:flex; align-items:center; gap:12px; }

.metric-title { 
margin:0; 
color:var(--muted); 
font-weight:600; 
font-size: 0.9rem; 
}

.metric-value { 
font-size:1.8rem; 
font-weight:800; 
color: var(--accent); 
}

.metric-unit { 
color:var(--muted); 
font-size:1rem; 
margin-left: 6px; 
}

.icon-wrap { 
display:inline-flex; 
padding:10px; 
border-radius:10px; 
background: rgba(0,212,255,0.1); 
}

/* Gráficos */
.charts-grid { 
display: grid; 
gap: 20px; 
grid-template-columns: repeat(auto-fit, minmax(480px, 1fr));
}

.chart-panel { 
background: var(--card);
padding: 20px; 
border-radius: 12px; 
border: 1px solid var(--card-border);
}

.chart-header { 
display:flex; 
justify-content:space-between; 
align-items:center; 
margin-bottom:16px; 
}

.chart-title { 
display: flex; 
align-items: center; 
gap: 8px; 
font-weight: 700;
font-size: 1rem;
}

.chart-box { width:100%; height:320px; }

/* Controles */
.controls { 
display: flex; 
gap: 12px; 
align-items: center; 
flex-wrap: wrap;
}

.btn { 
display:inline-flex; 
gap:8px; 
align-items:center; 
background:var(--accent); 
color:#001122; 
padding:10px 16px; 
border-radius:8px; 
border:none; 
cursor:pointer; 
font-weight:600;
font-size: 0.9rem;
transition: all 0.2s ease;
white-space: nowrap;
}

.btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,212,255,0.3); }
.btn-danger { background: var(--danger); color: white; }
.btn-warning { background: var(--warning); color: #001122; }
.btn-success { background: var(--success); color: #001122; }
.btn:disabled { opacity:0.5; cursor:not-allowed; transform: none; }

.status-indicator {
padding: 8px 16px;
border-radius: 20px;
display: flex;
align-items: center;
gap: 8px;
font-weight: 600;
font-size: 0.9rem;
white-space: nowrap;
}

.status-connected { background: rgba(0, 255, 136, 0.2); color: var(--success); border: 1px solid var(--success); }
.status-disconnected { background: rgba(136, 136, 136, 0.2); color: #888; border: 1px solid #666; }
.status-receiving { 
background: linear-gradient(45deg, rgba(0, 212, 255, 0.2), rgba(0, 255, 136, 0.2)); 
color: var(--accent); 
border: 1px solid var(--accent); 
animation: pulse 2s infinite; 
}

@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }

.debug-console { 
background: rgba(17,17,21,0.8); 
border: 1px solid var(--card-border); 
border-radius: 8px; 
padding: 16px; 
margin: 10px 0;
font-family: 'JetBrains Mono', 'Consolas', monospace;
font-size: 11px;
max-height: 300px;
overflow-y: auto;
}

.debug-entry {
margin-bottom: 8px;
padding: 8px;
border-radius: 6px;
background: rgba(255,255,255,0.02);
}

.debug-type-CONNECTION { border-left: 3px solid var(--success); }
.debug-type-MESSAGE { border-left: 3px solid var(--accent); }
.debug-type-DATA { border-left: 3px solid #8b5cf6; }
.debug-type-ERROR { border-left: 3px solid var(--danger); }
.debug-type-CHART { border-left: 3px solid var(--warning); }
.debug-type-MANUAL { border-left: 3px solid #ff6b6b; }
.debug-type-FILE { border-left: 3px solid #00ff88; }

.no-data-message {
display: flex;
flex-direction: column;
align-items: center;
justify-content: center;
height: 200px;
color: var(--muted);
background: rgba(26,26,31,0.5);
border-radius: 12px;
border: 2px dashed var(--card-border);
margin: 20px 0;
text-align: center;
}

/* Responsividade */
@media(max-width: 1024px) {
.charts-grid { grid-template-columns: 1fr; }
.upload-section { flex-direction: column; }
.json-input-header { flex-direction: column; align-items: flex-start; }
}

@media(max-width: 768px) {
.metrics-grid { grid-template-columns: 1fr; }
.header-inner { flex-direction: column; gap: 12px; }
.controls { justify-content: center; }
.status-grid { grid-template-columns: 1fr; }
.container { padding: 0 16px 40px; }
.panel-highlight { padding: 16px; }
.upload-section { gap: 16px; }
}

@media(max-width: 480px) {
.charts-grid { grid-template-columns: 1fr; }
.chart-box { height: 280px; }
.btn { padding: 8px 12px; font-size: 0.8rem; }
.file-upload-area { padding: 20px; }
}
`;

  // Dados atuais
  const currentData: SensorData = sensorData[sensorData.length - 1] || {
    timestamp: 0,
    time: '--:--:--',
    temperatura: 0,
    tempoComutacao: 0,
    pressaoEntrada: 0,
    pressaoSaida1: 0,
    pressaoSaida2: 0,
    situacaoAtuador: 'Desconhecido',
    bobinaUtilizada: 'Nenhuma',
    status: 'normal'
  };

  // Componente de métrica
  const MetricCard: React.FC<{
    title: string;
    value: number | string;
    unit: string;
    icon: React.ComponentType<any>;
    color?: string;
  }> = ({ title, value, unit, icon: Icon, color = "#00d4ff" }) => (
    <div className="metric-card">
      <div className="metric-top">
        <div className="metric-left">
          <div className="icon-wrap">
            <Icon size={18} color={color} />
          </div>
          <div className="metric-title">{title}</div>
        </div>
      </div>
      <div className="metric-value">
        {typeof value === 'number' ? value.toFixed(2) : String(value)}
        <span className="metric-unit">{unit}</span>
      </div>
    </div>
  );

  // Tooltip customizado
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ 
          background: 'rgba(17,17,21,0.95)', 
          padding: 16, 
          borderRadius: 10, 
          border: '1px solid #00d4ff', 
          color: '#fff',
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
        }}>
          <div style={{ fontWeight: 700, marginBottom: 8, color: '#00d4ff' }}>{label}</div>
          {payload.map((entry: any, i: number) => (
            <div key={i} style={{ color: entry.color, fontSize: 13, marginBottom: 4 }}>
              {`${entry.name || entry.dataKey}: ${entry.value?.toFixed(2) || '0.00'}`}
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  // Status da conexão
  const getStatus = () => {
    if (isReceivingRealData && sensorData.length > 0) {
      return { class: 'status-receiving', text: `📊 DADOS REAIS (${sensorData.length})`, icon: PlayCircle };
    } else if (isConnected) {
      return { class: 'status-connected', text: '🔗 Conectado', icon: Wifi };
    } else {
      return { class: 'status-disconnected', text: '❌ Desconectado', icon: WifiOff };
    }
  };

  const status = getStatus();

  return (
    <div className="page">
      <style>{styles}</style>
      
      <div className="header">
        <div className="header-inner">
          <div className="brand">
            <div className="icon-wrap">
              <Settings size={24} color="#00d4ff" />
            </div>
            <div>
              <h1>Sistema de Monitoramento Industrial</h1>
              <p>Controle de Atuadores e Sensores em Tempo Real</p>
            </div>
          </div>
          
          <div className="controls">
            <div className={`status-indicator ${status.class}`}>
              <status.icon size={14} />
              {status.text}
            </div>
            
            <button onClick={handleTestData} className="btn btn-warning">
              <Database size={14} />
              Simular
            </button>
            
            <button onClick={handleForceReconnect} className="btn" disabled={isConnected}>
              <RefreshCw size={14} />
              Reconectar
            </button>
            
            <button onClick={handleClearData} className="btn btn-danger">
              <AlertCircle size={14} />
              Limpar
            </button>
          </div>
        </div>
      </div>

      <div className="container">
        {/* UPLOAD DE ARQUIVO JSON */}
        <div className="panel-highlight">
          <div className="panel-title">
            <CloudUpload size={20} />
            Upload de Arquivo JSON
          </div>
          
          <div className="upload-section">
            <div 
              className={`file-upload-area ${isDragging ? 'dragging' : ''} ${isProcessingFile ? 'processing' : ''}`}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                multiple
                onChange={handleFileInput}
                className="file-input"
              />
              
              <div className="upload-icon">
                {isProcessingFile ? (
                  <div className="processing-spinner"></div>
                ) : (
                  <Upload size={48} color={isDragging ? "#00d4ff" : "#8b8b95"} />
                )}
              </div>
              
              <div className="upload-text">
                <h3>
                  {isProcessingFile ? 'Processando Arquivo...' : 
                   isDragging ? 'Solte o arquivo aqui' : 
                   'Clique ou arraste arquivos JSON'}
                </h3>
                <p>
                  {isProcessingFile ? 'Analisando dados em tempo real' :
                   'Suporte a arrays e objetos únicos'}
                </p>
              </div>
              
              {isProcessingFile && (
                <div className="processing-indicator">
                  <div className="processing-spinner"></div>
                  Processando dados...
                </div>
              )}
            </div>

            <div className="uploaded-files">
              <h4>
                <FileText size={16} />
                Arquivos Processados ({uploadedFiles.length})
              </h4>
              
              <div className="file-list">
                {uploadedFiles.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#8b8b95', padding: '20px' }}>
                    Nenhum arquivo processado ainda
                  </div>
                ) : (
                  uploadedFiles.map((file, index) => (
                    <div key={index} className="file-item">
                      <div className="file-item-header">
                        <div className="file-name">{file.name}</div>
                      </div>
                      <div className="file-stats">
                        📊 {file.recordCount} registros • 
                        📁 {(file.size / 1024).toFixed(2)}KB • 
                        ⏰ {file.processedAt}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* CAMPO PARA INSERÇÃO MANUAL DE JSON */}
        <div className="panel-highlight">
          <div className="panel-title">
            <Code size={20} />
            Inserção Manual de Dados JSON
          </div>
          
          <div className="json-input-panel">
            <div className="json-input-header">
              <div className="json-input-title">
                <Upload size={16} />
                Dados dos Sensores
              </div>
              <div className="json-buttons">
                <button onClick={handleFillExampleJson} className="btn btn-warning">
                  <Code size={14} />
                  Exemplo JSON
                </button>
                <button 
                  onClick={handleManualJsonSubmit} 
                  className="btn btn-success"
                  disabled={!manualJsonInput.trim()}
                >
                  <Send size={14} />
                  Processar JSON
                </button>
              </div>
            </div>
            
            <textarea
              className="json-textarea"
              value={manualJsonInput}
              onChange={(e) => {
                setManualJsonInput(e.target.value);
                setJsonInputError('');
              }}
              placeholder={`Insira um JSON com dados dos sensores. Exemplo:
{
  "temperatura": 28.5,
  "tempoComutacao": 12.3,
  "pressaoEntrada": 2.1,
  "pressaoSaida1": 1.4,
  "pressaoSaida2": 0.9,
  "situacaoAtuador": "Avançado",
  "bobinaUtilizada": "Direita"
}`}
            />
            
            {jsonInputError && (
              <div className="json-error">
                ⚠️ {jsonInputError}
              </div>
            )}
          </div>
        </div>

        {/* STATUS DO SISTEMA */}
        <div className="panel-highlight">
          <div className="panel-title">
            <Activity size={20} />
            Status do Sistema
          </div>
          
          <div className="status-grid">
            <div className="status-card">
              <div className={`status-icon ${currentData.situacaoAtuador === 'Avançado' ? 'atuador-avancado' : 'atuador-recuado'}`}>
                <Power size={24} color="white" />
              </div>
              <div className="status-info">
                <h3>Situação do Atuador</h3>
                <p className={currentData.situacaoAtuador === 'Avançado' ? 'avancado' : 'recuado'}>
                  {currentData.situacaoAtuador}
                </p>
              </div>
            </div>

            <div className="status-card">
              <div className={`status-icon ${currentData.bobinaUtilizada === 'Direita' ? 'bobina-direita' : 'bobina-esquerda'}`}>
                <Zap size={24} color="white" />
              </div>
              <div className="status-info">
                <h3>Bobina Utilizada</h3>
                <p className={currentData.bobinaUtilizada === 'Direita' ? 'direita' : 'esquerda'}>
                  {currentData.bobinaUtilizada}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* MÉTRICAS DOS SENSORES */}
        <div className="panel-highlight">
          <div className="panel-title">
            <Thermometer size={20} />
            Sensores e Medições
          </div>

          <div className="metrics-grid">
            <MetricCard 
              title="Temperatura" 
              value={currentData.temperatura} 
              unit="°C" 
              icon={Thermometer}
              color="#ff6b6b"
            />
            <MetricCard 
              title="Tempo de Comutação" 
              value={currentData.tempoComutacao} 
              unit="ms" 
              icon={Clock}
              color="#4ecdc4"
            />
            <MetricCard 
              title="Pressão de Entrada" 
              value={currentData.pressaoEntrada} 
              unit="bar" 
              icon={Gauge}
              color="#45b7d1"
            />
            <MetricCard 
              title="Pressão Saída 1" 
              value={currentData.pressaoSaida1} 
              unit="bar" 
              icon={Gauge}
              color="#96ceb4"
            />
            <MetricCard 
              title="Pressão Saída 2" 
              value={currentData.pressaoSaida2} 
              unit="bar" 
              icon={Gauge}
              color="#feca57"
            />
          </div>
        </div>

        {/* GRÁFICOS */}
        <div className="panel-highlight">
          <div className="panel-title">
            <Activity size={20} />
            Gráficos de Monitoramento - {sensorData.length} registros
          </div>

          {sensorData.length === 0 ? (
            <div className="no-data-message">
              <AlertCircle size={48} color="#666" />
              <h3>Nenhum Dado Disponível</h3>
              <p>Aguardando WebSocket, faça upload de JSON ou clique em "Simular"</p>
              <p style={{ fontSize: '0.8rem', marginTop: 8 }}>
                Estado: {isConnected ? '🟢 Conectado' : '🔴 Desconectado'} | 
                Mensagens: {messageCountRef.current} | 
                Arquivos: {uploadedFiles.length}
              </p>
            </div>
          ) : (
            <div className="charts-grid">
              {/* Tempo de Comutação */}
              <div className="chart-panel">
                <div className="chart-header">
                  <div className="chart-title">
                    <Clock size={18} color="#4ecdc4" />
                    Tempo de Comutação
                  </div>
                  <span style={{ color: '#8b8b95', fontSize: '0.9rem' }}>ms</span>
                </div>
                <div className="chart-box">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={sensorData} key={`tempo-${forceRender}`}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="time" stroke="#8b8b95" fontSize={10} />
                      <YAxis stroke="#8b8b95" fontSize={10} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line 
                        type="monotone" 
                        dataKey="tempoComutacao" 
                        stroke="#4ecdc4" 
                        strokeWidth={3} 
                        dot={{ r: 4, fill: "#4ecdc4" }}
                        name="Tempo Comutação"
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Temperatura */}
              <div className="chart-panel">
                <div className="chart-header">
                  <div className="chart-title">
                    <Thermometer size={18} color="#ff6b6b" />
                    Temperatura
                  </div>
                  <span style={{ color: '#8b8b95', fontSize: '0.9rem' }}>°C</span>
                </div>
                <div className="chart-box">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={sensorData} key={`temp-${forceRender}`}>
                      <defs>
                        <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ff6b6b" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#ff6b6b" stopOpacity={0.1} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="time" stroke="#8b8b95" fontSize={10} />
                      <YAxis stroke="#8b8b95" fontSize={10} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area 
                        type="monotone" 
                        dataKey="temperatura" 
                        stroke="#ff6b6b" 
                        strokeWidth={3} 
                        fill="url(#tempGrad)" 
                        name="Temperatura"
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Pressão de Entrada */}
              <div className="chart-panel">
                <div className="chart-header">
                  <div className="chart-title">
                    <Gauge size={18} color="#45b7d1" />
                    Pressão de Entrada
                  </div>
                  <span style={{ color: '#8b8b95', fontSize: '0.9rem' }}>bar</span>
                </div>
                <div className="chart-box">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={sensorData} key={`entrada-${forceRender}`}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="time" stroke="#8b8b95" fontSize={10} />
                      <YAxis stroke="#8b8b95" fontSize={10} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line 
                        type="monotone" 
                        dataKey="pressaoEntrada" 
                        stroke="#45b7d1" 
                        strokeWidth={3} 
                        dot={{ r: 3, fill: "#45b7d1" }}
                        name="Pressão Entrada"
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Pressão Saída 1 */}
              <div className="chart-panel">
                <div className="chart-header">
                  <div className="chart-title">
                    <Gauge size={18} color="#96ceb4" />
                    Pressão Saída 1
                  </div>
                  <span style={{ color: '#8b8b95', fontSize: '0.9rem' }}>bar</span>
                </div>
                <div className="chart-box">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={sensorData} key={`saida1-${forceRender}`}>
                      <defs>
                        <linearGradient id="saida1Grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#96ceb4" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#96ceb4" stopOpacity={0.1} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="time" stroke="#8b8b95" fontSize={10} />
                      <YAxis stroke="#8b8b95" fontSize={10} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area 
                        type="monotone" 
                        dataKey="pressaoSaida1" 
                        stroke="#96ceb4" 
                        strokeWidth={3} 
                        fill="url(#saida1Grad)" 
                        name="Pressão Saída 1"
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Pressão Saída 2 */}
              <div className="chart-panel">
                <div className="chart-header">
                  <div className="chart-title">
                    <Gauge size={18} color="#feca57" />
                    Pressão Saída 2
                  </div>
                  <span style={{ color: '#8b8b95', fontSize: '0.9rem' }}>bar</span>
                </div>
                <div className="chart-box">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={sensorData} key={`saida2-${forceRender}`}>
                      <defs>
                        <linearGradient id="saida2Grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#feca57" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#feca57" stopOpacity={0.1} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="time" stroke="#8b8b95" fontSize={10} />
                      <YAxis stroke="#8b8b95" fontSize={10} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area 
                        type="monotone" 
                        dataKey="pressaoSaida2" 
                        stroke="#feca57" 
                        strokeWidth={3} 
                        fill="url(#saida2Grad)" 
                        name="Pressão Saída 2"
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* DEBUG CONSOLE (Minimizado) */}
        {debugLog.length > 0 && (
          <div className="panel-highlight">
            <div className="panel-title">
              <AlertCircle size={18} color="#f59e0b" />
              Console de Debug ({debugLog.length} entradas)
            </div>
            <div className="debug-console">
              {debugLog.slice(0, 8).map((log, i) => (
                <div key={i} className={`debug-entry debug-type-${log.type}`}>
                  <strong>[{log.timestamp}] {log.type}:</strong> {log.message}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SystemScreen;
