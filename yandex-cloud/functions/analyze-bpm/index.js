exports.handler = async (event) => {
    try {
        const { audioUrl } = JSON.parse(event.body || '{}');
        
        if (!audioUrl) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'audioUrl is required' })
            };
        }
        
        // Здесь будет логика анализа BPM
        // Пока заглушка
        const bpm = Math.floor(Math.random() * 60) + 80; // 80-140 BPM
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                bpm,
                key: 'C',
                energy: 0.7,
                analysisTime: new Date().toISOString()
            })
        };
    } catch (error) {
        console.error('Error in analyze-bpm:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};
