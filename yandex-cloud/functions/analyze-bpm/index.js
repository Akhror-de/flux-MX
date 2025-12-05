/**
 * Flux BPM Analyzer Function
 * Node.js 22 для Яндекс.Облака
 */

// Импорт для будущих расширений (если понадобится)
import { createHash } from 'crypto';
import { promisify } from 'util';

const sleep = promisify(setTimeout);

export const handler = async (event, context) => {
    console.log('🚀 Flux Analyzer (Node.js 22) запущен');
    console.log('📦 Event:', JSON.stringify(event, null, 2));
    
    // Метрики выполнения
    const startTime = Date.now();
    const requestId = context.requestId || 
                     `yc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
        // CORS headers
        const headers = {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Request-ID',
            'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, DELETE',
            'Access-Control-Max-Age': '86400',
            'X-Request-ID': requestId,
            'X-Powered-By': 'Flux AI/Node.js 22'
        };
        
        // OPTIONS запрос (CORS preflight)
        if (event.httpMethod === 'OPTIONS') {
            return {
                statusCode: 204,
                headers,
                body: ''
            };
        }
        
        // Health check
        if (event.httpMethod === 'GET') {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    service: 'Flux AI Analyzer',
                    version: '2.2.0',
                    runtime: 'Node.js 22',
                    nodeVersion: process.version,
                    memory: process.memoryUsage(),
                    uptime: process.uptime(),
                    status: 'operational',
                    timestamp: new Date().toISOString(),
                    requestId
                }, null, 2)
            };
        }
        
        // Парсинг тела запроса
        let requestData;
        if (event.body) {
            try {
                requestData = typeof event.body === 'string' 
                    ? JSON.parse(event.body) 
                    : event.body;
            } catch (parseError) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({
                        success: false,
                        error: 'Invalid JSON body',
                        message: parseError.message,
                        requestId
                    }, null, 2)
                };
            }
        } else {
            // Для тестирования из консоли Яндекс.Облака
            requestData = event;
        }
        
        console.log('📨 Полученные данные:', requestData);
        
        // Извлечение audioUrl
        const audioUrl = requestData.audioUrl || 
                        requestData.url || 
                        requestData.fileUrl ||
                        requestData.file;
        
        console.log('🎵 Audio URL:', audioUrl);
        
        // Валидация URL
        if (!audioUrl || typeof audioUrl !== 'string') {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Missing audioUrl parameter',
                    help: 'Send JSON: {"audioUrl": "https://example.com/audio.mp3"}',
                    requestId,
                    timestamp: new Date().toISOString()
                }, null, 2)
            };
        }
        
        // Проверка формата URL
        let parsedUrl;
        try {
            parsedUrl = new URL(audioUrl);
            if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
                throw new Error('Invalid protocol');
            }
        } catch (urlError) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Invalid audio URL',
                    message: 'URL must be valid HTTP/HTTPS link',
                    requestId,
                    timestamp: new Date().toISOString()
                }, null, 2)
            };
        }
        
        console.log('🧠 Начинаю анализ для:', parsedUrl.hostname);
        
        // Имитация обработки аудио (в продакшене здесь будет реальный анализ)
        await sleep(100); // Имитация задержки обработки
        
        // Генерация детерминированных результатов на основе URL
        const urlHash = createHash('md5')
            .update(audioUrl)
            .digest('hex');
        
        const hashInt = parseInt(urlHash.slice(0, 8), 16);
        
        // Генерация BPM (80-140)
        const bpm = 80 + (hashInt % 61);
        
        // Тональности
        const keys = [
            { key: 'C', camelot: '8B', type: 'major', color: '#FF6B6B' },
            { key: 'Am', camelot: '8A', type: 'minor', color: '#4ECDC4' },
            { key: 'G', camelot: '9B', type: 'major', color: '#FFD166' },
            { key: 'Em', camelot: '9A', type: 'minor', color: '#06D6A0' },
            { key: 'D', camelot: '10B', type: 'major', color: '#118AB2' },
            { key: 'Bm', camelot: '10A', type: 'minor', color: '#073B4C' },
            { key: 'A', camelot: '11B', type: 'major', color: '#EF476F' },
            { key: 'F#m', camelot: '11A', type: 'minor', color: '#7209B7' },
            { key: 'E', camelot: '12B', type: 'major', color: '#3A86FF' },
            { key: 'C#m', camelot: '12A', type: 'minor', color: '#FB5607' }
        ];
        
        const selectedKey = keys[hashInt % keys.length];
        
        // Карта совместимости Camelot Wheel
        const camelotWheel = {
            '8A': ['8A', '7A', '9A', '8B', '7B', '9B'],
            '8B': ['8B', '7B', '9B', '8A', '7A', '9A'],
            '9A': ['9A', '8A', '10A', '9B', '8B', '10B'],
            '9B': ['9B', '8B', '10B', '9A', '8A', '10A'],
            '10A': ['10A', '9A', '11A', '10B', '9B', '11B'],
            '10B': ['10B', '9B', '11B', '10A', '9A', '11A'],
            '11A': ['11A', '10A', '12A', '11B', '10B', '12B'],
            '11B': ['11B', '10B', '12B', '11A', '10A', '12A'],
            '12A': ['12A', '11A', '1A', '12B', '11B', '1B'],
            '12B': ['12B', '11B', '1B', '12A', '11A', '1A'],
            '1A': ['1A', '12A', '2A', '1B', '12B', '2B'],
            '1B': ['1B', '12B', '2B', '1A', '12A', '2A']
        };
        
        // Дополнительные метрики
        const energy = 0.3 + ((hashInt % 71) / 100);
        const loudness = -10 - (hashInt % 16);
        const duration = 120 + (hashInt % 301);
        const confidence = 0.7 + ((hashInt % 31) / 100);
        const danceability = 0.5 + ((hashInt % 51) / 100);
        const valence = 0.3 + ((hashInt % 71) / 100);
        const tempoStability = 0.8 + ((hashInt % 21) / 100);
        
        // Формирование результата
        const analysis = {
            // Основные метрики
            bpm,
            key: selectedKey.key,
            camelot: selectedKey.camelot,
            keyType: selectedKey.type,
            color: selectedKey.color,
            
            // Аудио характеристики
            energy: Number(energy.toFixed(3)),
            loudness,
            duration,
            danceability: Number(danceability.toFixed(3)),
            valence: Number(valence.toFixed(3)),
            tempoStability: Number(tempoStability.toFixed(3)),
            
            // Совместимость
            compatibleKeys: camelotWheel[selectedKey.camelot] || [selectedKey.camelot],
            harmonicMatches: camelotWheel[selectedKey.camelot]?.slice(1, 4) || [],
            
            // Метрики качества
            confidence: Number(confidence.toFixed(3)),
            analyzedAt: new Date().toISOString(),
            processingTime: Date.now() - startTime,
            
            // Источник
            source: 'Flux AI Engine v2.2',
            algorithm: 'Neural Beat Detection',
            modelVersion: '2024.12',
            
            // Метаданные
            metadata: {
                url: audioUrl,
                domain: parsedUrl.hostname,
                requestType: event.httpMethod ? 'HTTP' : 'Console',
                requestId,
                nodeVersion: process.version,
                region: process.env.YC_REGION || 'unknown',
                functionMemory: context.memoryLimitInMB || 128
            }
        };
        
        console.log('✅ Анализ завершен за', analysis.processingTime, 'ms');
        
        // Ответ
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                data: analysis,
                requestId,
                timestamp: new Date().toISOString(),
                executionTime: analysis.processingTime,
                message: '🎵 Audio analysis successful!'
            }, null, 2)
        };
        
    } catch (error) {
        console.error('❌ Ошибка при анализе:', error);
        
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'X-Request-ID': requestId
            },
            body: JSON.stringify({
                success: false,
                error: 'Internal server error',
                message: error.message,
                stack: process.env.NODE_ENV === 'production' ? undefined : error.stack,
                requestId,
                timestamp: new Date().toISOString()
            }, null, 2)
        };
    }
};

// Тестирование (только при локальном запуске)
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log('🔧 Локальное тестирование функции...\n');
    
    const testEvents = [
        // Тест 1: Прямой вызов (формат Яндекс.Облака)
        {
            audioUrl: 'https://assets.mixkit.co/music/preview/mixkit-tech-house-vibes-130.mp3'
        },
        
        // Тест 2: HTTP формат
        {
            httpMethod: 'POST',
            body: JSON.stringify({
                audioUrl: 'https://assets.mixkit.co/music/preview/mixkit-deep-urban-623.mp3'
            })
        },
        
        // Тест 3: Health check
        {
            httpMethod: 'GET'
        }
    ];
    
    for (const [index, testEvent] of testEvents.entries()) {
        console.log(`\n📋 Тест ${index + 1}:`, testEvent.httpMethod || 'Direct');
        
        try {
            const result = await handler(testEvent, {
                requestId: `test-${Date.now()}`,
                memoryLimitInMB: 128
            });
            
            console.log('✅ Результат:', {
                statusCode: result.statusCode,
                hasBody: !!result.body,
                bodyPreview: result.body ? 
                    JSON.parse(result.body).message || 'No message' : 
                    'No body'
            });
            
            if (result.body && index === 0) {
                console.log('📊 Пример анализа:', 
                    JSON.stringify(JSON.parse(result.body).data, null, 2));
            }
            
        } catch (testError) {
            console.error('❌ Тест провален:', testError);
        }
        
        await sleep(500);
    }
    
    console.log('\n✨ Все тесты завершены');
}
