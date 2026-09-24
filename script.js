document.addEventListener('DOMContentLoaded', () => {
    // --- 0. Inicialização do Supabase ---
    const SUPABASE_URL = "https://ajsvnehgdhuphqkqccke.supabase.co";
    const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqc3ZuZWhnZGh1cGhxa3FjY2tlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5MDMzNTIsImV4cCI6MjEwNTQ3OTM1Mn0._P7ST8QPv4f-tkZ7sbEv871Yfcqy2jDTLl1WCl2Ktec";
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // --- 1. Atualização da Data no Header ---
    const dateDisplay = document.getElementById('current-date');
    if (dateDisplay) {
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        const today = new Date();
        dateDisplay.textContent = today.toLocaleDateString('pt-BR', options);
    }

    // --- 2. Elementos DOM para Visualização 3D/Bússola ---
    const solarPanel = document.getElementById('solar-panel');
    const basePointer = document.getElementById('base-pointer');
    
    // Inputs de Teste Manual e Botão
    const manualDirection = document.getElementById('manual-direction');
    const manualElevation = document.getElementById('manual-elevation');
    const btnApply = document.getElementById('btn-apply');
    const cardinalText = document.getElementById('cardinal-text');
    const elevationText = document.getElementById('elevation-text');

    // Cards de Telemetria
    const valAxisX = document.getElementById('val-axis-x');
    const valAxisY = document.getElementById('val-axis-y');

    // Variáveis de Estado Aplicado
    let currentAppliedDirection = 180;
    let currentAppliedElevation = 45;
    let hasAppliedPosition = false; // Controle de validação de relatório

    // --- 3. Função Principal de Atualização Visual ---
    function updateVisuals(direction, elevation) {
        currentAppliedDirection = direction;
        currentAppliedElevation = elevation;
        
        // Garantir que a direção esteja no formato correto (0-360)
        const azimute = direction % 360;

        // Atualiza a Bússola Base (aponta para a direção)
        basePointer.style.transform = `rotateZ(${azimute}deg)`;

        // Atualiza o Painel 3D
        solarPanel.style.transform = `rotateZ(${azimute}deg) rotateX(${elevation}deg)`;

        // Atualiza os Valores na Tela
        valAxisX.innerHTML = `${azimute.toFixed(1)} <small>°</small>`;
        valAxisY.innerHTML = `${elevation.toFixed(1)} <small>°</small>`;
        cardinalText.textContent = `${getCardinalDirection(azimute)} (${azimute}°)`;
        elevationText.textContent = `${getElevationName(elevation)} (${elevation}°)`;
        
        // Efeito de "piscar" para simular a chegada de novos dados (wow factor)
        flashTelemetry([valAxisX, valAxisY]);
    }

    function getCardinalDirection(angle) {
        const directions = ["Norte", "Nordeste", "Leste", "Sudeste", "Sul", "Sudoeste", "Oeste", "Noroeste", "Norte"];
        const index = Math.round(angle / 45);
        return directions[index % 8];
    }

    function getElevationName(angle) {
        const absAngle = Math.abs(angle);
        let prefix = angle < 0 ? "Invertida " : "";
        if (absAngle <= 5) return "Horizontal (Plano)";
        if (absAngle <= 20) return prefix + "Baixa Inclinação";
        if (absAngle <= 50) return prefix + "Inclinação Moderada";
        if (absAngle <= 85) return prefix + "Alta Inclinação";
        return prefix + "Quase Vertical";
    }

    // Função para piscar os cards de telemetria
    function flashTelemetry(elements) {
        elements.forEach(el => {
            if (el) {
                el.classList.add('flash');
                setTimeout(() => {
                    el.classList.remove('flash');
                }, 300);
            }
        });
    }

    // --- 4. Offsets Globais e Listeners ---
    let offsetDir = parseFloat(manualDirection.value) || 0;
    let offsetEle = parseFloat(manualElevation.value) || 0;

    btnApply.addEventListener('click', () => {
        offsetDir = parseFloat(manualDirection.value) || 0;
        offsetEle = parseFloat(manualElevation.value) || 0;
        
        hasAppliedPosition = true; // Marca que o usuário já enviou dados ao menos uma vez
        carregarTelemetria(); // Atualiza tela com os novos offsets aplicados ao dado mais recente
    });

    // --- 5. Módulo de Logs e Tabela ---
    const logsTableBody = document.getElementById('logs-table-body');
    const fixedLocation = "UNICID";

    let logHistory = [];

    // --- 5.1 Integração com Supabase ---
    async function carregarTelemetria() {
        try {
            const { data, error } = await supabase
                .from('leituras_sdr')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(10);

            if (error) {
                console.error("Erro na leitura do Supabase:", error.message);
                return;
            }

            if (!data || data.length === 0) {
                console.warn("Nenhum dado encontrado na tabela.");
                return;
            }

            const leituraAtual = data[0];

            // Atualiza Visão 3D e Cards Principais SOMANDO os Offsets Manuais
            const dirX = parseFloat(leituraAtual.eixo_x) + offsetDir;
            const eleY = parseFloat(leituraAtual.eixo_y) + offsetEle;
            updateVisuals(dirX, eleY);
            hasAppliedPosition = true;

            // Atualiza Hora
            const elemHora = document.getElementById("data-hora");
            if (elemHora) {
                const horaFormatada = new Date(leituraAtual.created_at).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                });
                elemHora.innerText = `(Última sync: ${horaFormatada})`;
            }

            // Atualiza Histórico SOMANDO os Offsets Manuais
            logHistory = data.map((item, index) => {
                const logTime = new Date(item.created_at);
                const itemX = (parseFloat(item.eixo_x) + offsetDir).toFixed(1);
                const itemY = (parseFloat(item.eixo_y) + offsetEle).toFixed(1);
                return {
                    id: item.id || (data.length - index),
                    location: item.dispositivo || fixedLocation,
                    timestamp: formatLogDate(logTime),
                    dirX: itemX,
                    eleY: itemY,
                    status: index === 0 ? "Atual (Sincronizado)" : "Registrado"
                };
            });
            renderLogsTable();

        } catch (err) {
            console.error("Falha geral na requisição:", err);
        }
    }

    function formatLogDate(dateObj) {
        const d = String(dateObj.getDate()).padStart(2, '0');
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const y = dateObj.getFullYear();
        const hh = String(dateObj.getHours()).padStart(2, '0');
        const mm = String(dateObj.getMinutes()).padStart(2, '0');
        const ss = String(dateObj.getSeconds()).padStart(2, '0');
        return `${d}/${m}/${y} ${hh}:${mm}:${ss}`;
    }

    function renderLogsTable() {
        if (!logsTableBody) return;
        logsTableBody.innerHTML = logHistory.map((log) => `
            <tr>
                <td><strong>#${log.id}</strong></td>
                <td><span class="badge-tag"><i class="ph-fill ph-map-pin"></i> ${log.location}</span></td>
                <td><i class="ph ph-clock"></i> ${log.timestamp}</td>
                <td><span class="highlight-val">${log.dirX}°</span></td>
                <td><span class="highlight-val">${log.eleY}°</span></td>
                <td><span class="status-pill ${log.status.includes('Atual') || log.status.includes('Enviado') ? 'status-active' : 'status-ok'}">${log.status}</span></td>
            </tr>
        `).join('');
    }



    // --- 6. Módulo de Relatórios (5 Tipos Dinâmicos) ---
    const btnGenerateReport = document.getElementById('btn-generate-report');
    const reportContainer = document.getElementById('report-results-container');
    const dynamicContent = document.getElementById('report-dynamic-content');
    const reportTypeSelect = document.getElementById('report-type');
    const reportTimeSelect = document.getElementById('report-time');

    btnGenerateReport.addEventListener('click', () => {
        if (!hasAppliedPosition) {
            alert("⚠️ Por favor, informe e aplique a posição física do módulo (Eixo X e Y) pelo menos uma vez antes de gerar um relatório.");
            return;
        }

        const reportType = reportTypeSelect.value;
        const selectedTimeText = reportTimeSelect.value || '12:00';
        
        let htmlContent = '';

        // Valores Base (Média Ponderada Simulada)
        let baseDir = currentAppliedDirection + (Math.random() * 4 - 2);
        let baseEle = currentAppliedElevation + (Math.random() * 4 - 2);
        
        // Garante angulos limpos
        let finalDir = (baseDir % 360).toFixed(1);
        let finalEle = baseEle.toFixed(1);
        let cardinalDir = getCardinalDirection(finalDir);

        switch(reportType) {
            case 'snapshot':
                htmlContent = `
                    <h4 style="color: var(--primary-dark); margin-bottom: 1rem; font-size: 1.1rem;"><i class="ph-bold ph-camera"></i> Resultado: Snapshot Médio por Horário</h4>
                    <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">Pergunta respondida: "Onde o sol bate, em média, no horário selecionado?"</p>
                    <div style="background: white; padding: 1.5rem; border-radius: var(--radius-md); border: 1px solid var(--border); box-shadow: var(--shadow-sm); margin-bottom: 1.5rem;">
                        <span style="display: block; font-size: 0.8rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 600;">Direção e Inclinação no horário (${selectedTimeText})</span>
                        <strong style="font-size: 1.5rem; color: var(--primary); display: block; margin-top: 0.5rem;">Direção: ${cardinalDir} (${finalDir}°)</strong>
                        <strong style="font-size: 1.5rem; color: var(--primary); display: block; margin-top: 0.5rem;">Inclinação: ${finalEle}°</strong>
                    </div>
                    <div style="background: #eff6ff; padding: 1.25rem; border-radius: var(--radius-md); border-left: 4px solid var(--primary);">
                        <strong style="color: #1e3a8a; display: block; margin-bottom: 0.5rem; font-size: 1.05rem;">Valor de Negócio:</strong>
                        <p style="color: #1e40af; margin: 0; font-size: 1rem; line-height: 1.6;">O painel no horário <strong>${selectedTimeText}</strong> começa a render de forma ideal quando apontado para <strong>${cardinalDir} (${finalDir}°)</strong> com inclinação de <strong>${finalEle}°</strong>. Ajuda a planejar o consumo matutino/vespertino no local avaliado.</p>
                    </div>
                `;
                break;
                
            case 'consolidation':
                // Breakdown mockado de % das direções
                const breakdownHtml = `
                    <div style="display: flex; gap: 1rem; margin-top: 1rem; font-size: 0.85rem;">
                        <span class="badge-tag" style="background: #e2e8f0; color: #334155;">${cardinalDir}: 65%</span>
                        <span class="badge-tag" style="background: #e2e8f0; color: #334155;">${getCardinalDirection(Number(finalDir) + 45)}: 25%</span>
                        <span class="badge-tag" style="background: #e2e8f0; color: #334155;">Outros: 10%</span>
                    </div>
                `;
                htmlContent = `
                    <h4 style="color: var(--primary-dark); margin-bottom: 1rem; font-size: 1.1rem;"><i class="ph-bold ph-calendar-check"></i> Resultado: Consolidação por Período</h4>
                    <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">Pergunta respondida: "Qual a melhor inclinação e direção média considerando as medições do período?"</p>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
                        <div style="background: white; padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border); box-shadow: var(--shadow-sm);">
                            <span style="display: block; font-size: 0.8rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 600;">Azimute Consolidado</span>
                            <strong style="font-size: 1.5rem; color: var(--primary);">${cardinalDir} (${finalDir}°)</strong>
                        </div>
                        <div style="background: white; padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border); box-shadow: var(--shadow-sm);">
                            <span style="display: block; font-size: 0.8rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 600;">Inclinação Consolidada</span>
                            <strong style="font-size: 1.5rem; color: var(--primary);">${finalEle}°</strong>
                        </div>
                    </div>
                    <div style="background: #eff6ff; padding: 1.25rem; border-radius: var(--radius-md); border-left: 4px solid var(--primary);">
                        <strong style="color: #1e3a8a; display: block; margin-bottom: 0.5rem; font-size: 1.05rem;">Veredito Unificado (Média Ponderada):</strong>
                        <p style="color: #1e40af; margin: 0; font-size: 1rem; line-height: 1.6;">Para o período selecionado, a configuração ideal e estática recomendada é apontar o painel para <strong>${cardinalDir} (${finalDir}°)</strong> e Inclinação de <strong>${finalEle}°</strong>. Ideal para validações sazonais.</p>
                        ${breakdownHtml}
                    </div>
                `;
                break;
        }

        dynamicContent.innerHTML = htmlContent;
        reportContainer.style.display = 'block';
        reportContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    // --- 7. Inicialização ---
    carregarTelemetria();
    setInterval(carregarTelemetria, 5000);

    // --- 8. Simulação de Micro-movimentos em Tempo Real (Visual apenas) ---
    setInterval(() => {
        const slightJitterDir = currentAppliedDirection + (Math.random() - 0.5) * 0.8;
        const slightJitterEle = currentAppliedElevation + (Math.random() - 0.5) * 0.4;
        
        basePointer.style.transform = `rotateZ(${slightJitterDir}deg)`;
        solarPanel.style.transform = `rotateZ(${slightJitterDir}deg) rotateX(${slightJitterEle}deg)`;
    }, 2500);
});
