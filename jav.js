class SistemaVendas {
    constructor() {
        this.vendas = [];
        this.despesas = [];
        this.saldoAtual = 0; // NOVO: Inicialize o saldo

        // Referências para os gráficos para poderem ser destruídos e recriados
        this.chartPagamento = null;
        this.chartVendasDiarias = null;
        this.chartDespesasCategoria = null;
        this.chartDespesasMensal = null;

        this.inicializar();
    }

    // --- NOVAS FUNÇÕES PARA INTERAGIR COM A API ---

    // Função para fazer requisições GET
    async getDados(endpoint) {
        try {
            const response = await fetch(`http://localhost:3000/${endpoint}`);
            if (!response.ok) {
                throw new Error(`Erro ao carregar dados do endpoint ${endpoint}: ${response.statusText}`);
            }
            const data = await response.json();
            console.log(`Dados carregados de ${endpoint}:`, data);
            return data;
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
            this.mostrarMensagem(`Erro ao carregar ${endpoint}. Verifique o servidor.`, 'error');
            return []; // Retorna um array vazio em caso de erro
        }
    }

    // Função para fazer requisições POST (usado para criar e "atualizar" o saldo)
    async postDados(endpoint, dado) {
        try {
            // Se o endpoint for 'saldo' e já tivermos um ID, usamos PUT para atualizar
            // JSON Server trata POST com ID como PUT/PATCH se o recurso já existe
            const method = (endpoint === 'saldo' && dado.id) ? 'PUT' : 'POST'; 
            const url = (endpoint === 'saldo' && dado.id) ? `http://localhost:3000/${endpoint}/${dado.id}` : `http://localhost:3000/${endpoint}`;

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(dado),
            });
            if (!response.ok) {
                throw new Error(`Erro ao salvar dado em ${endpoint}: ${response.statusText}`);
            }
            const novoDado = await response.json();
            console.log(`Dado salvo em ${endpoint}:`, novoDado);
            return novoDado;
        } catch (error) {
            console.error('Erro ao salvar dado:', error);
            this.mostrarMensagem(`Erro ao salvar ${endpoint}.`, 'error');
            return null;
        }
    }

    // Função para fazer requisições DELETE
    async deleteDados(endpoint, id) {
        try {
            const response = await fetch(`http://localhost:3000/${endpoint}/${id}`, {
                method: 'DELETE',
            });
            if (!response.ok) {
                throw new Error(`Erro ao remover dado de ${endpoint}/${id}: ${response.statusText}`);
            }
            console.log(`Dado removido de ${endpoint}/${id}`);
            return true;
        } catch (error) {
            console.error('Erro ao remover dado:', error);
            this.mostrarMensagem(`Erro ao remover ${endpoint}.`, 'error');
            return false;
        }
    }

    // --- FIM DAS NOVAS FUNÇÕES ---

    inicializar() {
        this.carregarDadosIniciais(); // Chamada para carregar os dados da API
        this.configurarNavegacao();
        this.configurarFormularios();
        this.configurarEventos();
        this.definirDataAtual();
    }

    // NOVA FUNÇÃO para carregar dados ao iniciar
    async carregarDadosIniciais() {
        this.vendas = await this.getDados('vendas');
        this.despesas = await this.getDados('despesas');

        // NOVO: Carrega o saldo
        const saldos = await this.getDados('saldo'); // Retorna um array do JSON Server
        if (saldos && saldos.length > 0 && saldos[0].valor !== undefined) {
            this.saldoAtual = saldos[0].valor; // Pega o primeiro (e único) item do array
        } else {
            // Se o saldo não existir, inicializa ou define um padrão e cria no DB
            this.saldoAtual = 0; 
            await this.postDados('saldo', { valor: this.saldoAtual, id: '1' }); // Cria o saldo com ID fixo
        }
        
        this.atualizarInterface(); // Atualiza a interface DEPOIS que os dados forem carregados
    }

    // NOVO: Função para atualizar a exibição do saldo na UI
    atualizarDisplaySaldo() {
        const saldoDisplayElement = document.getElementById('saldoAtualDisplay');
        if (saldoDisplayElement) {
            saldoDisplayElement.textContent = `R$ ${this.saldoAtual.toFixed(2).replace('.', ',')}`;
        }
    }

    // Atualiza todas as partes da interface
    atualizarInterface() {
        this.atualizarTabelaVendas();
        this.atualizarTabelaDespesas();
        this.atualizarDisplaySaldo(); // NOVO: Atualiza o display do saldo

        const tabAtiva = document.querySelector('.tab-content.active');
        if (tabAtiva && tabAtiva.id === 'relatorios') {
            setTimeout(() => this.atualizarRelatorios(), 50);
        } else if (tabAtiva && tabAtiva.id === 'despesas') {
            setTimeout(() => this.atualizarGraficosDespesas(), 50);
        }
    }

    configurarNavegacao() {
        document.querySelectorAll('.nav-btn').forEach(button => {
            button.addEventListener('click', () => {
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                document.querySelectorAll('.nav-btn').forEach(btn => {
                    btn.classList.remove('active');
                });

                const tabId = button.dataset.tab;
                document.getElementById(tabId).classList.add('active');
                button.classList.add('active');

                // Atualiza os relatórios/gráficos ao mudar de aba
                if (tabId === 'relatorios') {
                    this.atualizarRelatorios();
                } else if (tabId === 'despesas') {
                    this.atualizarGraficosDespesas();
                }
            });
        });
    }

    configurarFormularios() {
        document.getElementById('vendaForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.registrarVenda();
        });

        document.getElementById('despesaForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.registrarDespesa();
        });
    }

    configurarEventos() {
        // Evento para mostrar/esconder campo de cliente fiado
        document.getElementById('formaPagamento').addEventListener('change', (e) => {
            const clienteFiadoGroup = document.getElementById('clienteFiadoGroup');
            if (e.target.value === 'Fiado') {
                clienteFiadoGroup.style.display = 'block';
            } else {
                clienteFiadoGroup.style.display = 'none';
            }
        });

        // Evento para filtrar relatórios
        document.getElementById('filtrarRelatorio').addEventListener('click', () => {
            this.atualizarRelatorios();
        });

        // NOVO: Evento para o botão de ajustar saldo (ainda não implementado)
        document.getElementById('btnAjustarSaldo').addEventListener('click', () => {
            this.mostrarMensagem('Funcionalidade de ajuste manual de saldo ainda não implementada.', 'info');
            // Futuramente, aqui você poderia abrir um modal para o usuário inserir um valor
        });
    }

    definirDataAtual() {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0'); // Months start at 0!
        const dd = String(today.getDate()).padStart(2, '0');
        const hh = String(today.getHours()).padStart(2, '0');
        const min = String(today.getMinutes()).padStart(2, '0');

        const formattedDate = `${yyyy}-${mm}-${dd}`;
        const formattedTime = `${hh}:${min}`;

        const dataVendaInput = document.getElementById('dataVenda');
        const horaVendaInput = document.getElementById('horaVenda');
        const dataDespesaInput = document.getElementById('dataDespesa');

        if (dataVendaInput) dataVendaInput.value = formattedDate;
        if (horaVendaInput) horaVendaInput.value = formattedTime;
        if (dataDespesaInput) dataDespesaInput.value = formattedDate;
    }

    async registrarVenda() { // Torne a função assíncrona
        const data = document.getElementById('dataVenda').value;
        const hora = document.getElementById('horaVenda').value;
        const descricao = document.getElementById('descricaoVenda').value;
        const valor = parseFloat(document.getElementById('valorVenda').value);
        const formaPagamento = document.getElementById('formaPagamento').value;
        const clienteFiado = document.getElementById('clienteFiado').value;

        if (isNaN(valor) || valor <= 0) {
            this.mostrarMensagem('Por favor, insira um valor de venda válido.', 'error');
            return;
        }

        const novaVenda = { 
            data,
            hora,
            descricao,
            valor,
            formaPagamento,
            clienteFiado: formaPagamento === 'Fiado' ? clienteFiado : '',
            timestamp: new Date(`${data}T${hora}`).getTime()
        };

        const vendaSalva = await this.postDados('vendas', novaVenda); 
        if (vendaSalva) { 
            this.vendas.unshift(vendaSalva); 
            this.mostrarMensagem('Venda registrada com sucesso!', 'success');
            this.limparFormulario('vendaForm');
            this.definirDataAtual();

            // NOVO: Adiciona o valor da venda ao saldo
            this.saldoAtual += vendaSalva.valor;
            await this.postDados('saldo', { valor: this.saldoAtual, id: '1' }); 
            this.atualizarDisplaySaldo(); 

            this.atualizarTabelaVendas();
            const tabAtiva = document.querySelector('.tab-content.active');
            if (tabAtiva && tabAtiva.id === 'relatorios') {
                this.atualizarRelatorios();
            }
        }
    }

    async registrarDespesa() { // Torne a função assíncrona
        const data = document.getElementById('dataDespesa').value;
        const descricao = document.getElementById('descricaoDespesa').value;
        const valor = parseFloat(document.getElementById('valorDespesa').value);
        const categoria = document.getElementById('categoriaDespesa').value;

        if (isNaN(valor) || valor <= 0) {
            this.mostrarMensagem('Por favor, insira um valor de despesa válido.', 'error');
            return;
        }

        const novaDespesa = { 
            data,
            descricao,
            valor,
            categoria,
            timestamp: new Date(data).getTime()
        };

        const despesaSalva = await this.postDados('despesas', novaDespesa); 
        if (despesaSalva) { 
            this.despesas.unshift(despesaSalva); 
            this.mostrarMensagem('Despesa registrada com sucesso!', 'success');
            this.limparFormulario('despesaForm');
            this.definirDataAtual();

            // NOVO: Subtrai o valor da despesa do saldo
            this.saldoAtual -= despesaSalva.valor;
            await this.postDados('saldo', { valor: this.saldoAtual, id: '1' }); 
            this.atualizarDisplaySaldo(); 

            this.atualizarTabelaDespesas();
            const tabAtiva = document.querySelector('.tab-content.active');
            if (tabAtiva && tabAtiva.id === 'despesas') {
                this.atualizarGraficosDespesas();
            }
        }
    }

    async removerVenda(id) { 
        if (confirm('Tem certeza que deseja remover esta venda?')) {
            const vendaRemovida = this.vendas.find(v => v.id === id);
            
            const sucesso = await this.deleteDados('vendas', id);
            if (sucesso) {
                this.vendas = this.vendas.filter(venda => venda.id !== id);
                this.mostrarMensagem('Venda removida com sucesso!', 'success');
                this.atualizarTabelaVendas();
                
                // NOVO: Subtrai o valor da venda do saldo (se a venda foi encontrada)
                if (vendaRemovida) {
                    this.saldoAtual -= vendaRemovida.valor;
                    await this.postDados('saldo', { valor: this.saldoAtual, id: '1' }); 
                    this.atualizarDisplaySaldo(); 
                }

                const tabAtiva = document.querySelector('.tab-content.active');
                if (tabAtiva && tabAtiva.id === 'relatorios') {
                    this.atualizarRelatorios();
                }
            }
        }
    }

    async removerDespesa(id) { 
        if (confirm('Tem certeza que deseja remover esta despesa?')) {
            const despesaRemovida = this.despesas.find(d => d.id === id);

            const sucesso = await this.deleteDados('despesas', id);
            if (sucesso) {
                this.despesas = this.despesas.filter(despesa => despesa.id !== id);
                this.mostrarMensagem('Despesa removida com sucesso!', 'success');
                this.atualizarTabelaDespesas();
                
                // NOVO: Adiciona o valor da despesa de volta ao saldo (se a despesa foi encontrada)
                if (despesaRemovida) {
                    this.saldoAtual += despesaRemovida.valor;
                    await this.postDados('saldo', { valor: this.saldoAtual, id: '1' }); 
                    this.atualizarDisplaySaldo(); 
                }

                const tabAtiva = document.querySelector('.tab-content.active');
                if (tabAtiva && tabAtiva.id === 'despesas') {
                    this.atualizarGraficosDespesas();
                }
            }
        }
    }

    atualizarTabelaVendas() {
        const tabelaBody = document.querySelector('#tabelaVendas tbody');
        if (!tabelaBody) return; // Garante que o elemento existe

        tabelaBody.innerHTML = ''; // Limpa a tabela antes de preencher

        // Ordena as vendas pela data/hora mais recente
        const vendasOrdenadas = [...this.vendas].sort((a, b) => b.timestamp - a.timestamp);

        vendasOrdenadas.slice(0, 10).forEach(venda => {
            const row = tabelaBody.insertRow();
            row.insertCell(0).textContent = `${venda.data} ${venda.hora}`;
            row.insertCell(1).textContent = venda.descricao;
            row.insertCell(2).textContent = `R$ ${venda.valor.toFixed(2).replace('.', ',')}`;
            row.insertCell(3).textContent = venda.formaPagamento;
            row.insertCell(4).textContent = venda.clienteFiado || '-';

            const acoesCell = row.insertCell(5);
            const removeBtn = document.createElement('button');
            removeBtn.innerHTML = '🗑️';
            removeBtn.classList.add('btn-delete');
            removeBtn.title = 'Remover Venda';
            removeBtn.addEventListener('click', () => this.removerVenda(venda.id));
            acoesCell.appendChild(removeBtn);
        });
    }

    atualizarTabelaDespesas() {
        const tabelaBody = document.querySelector('#tabelaDespesas tbody');
        if (!tabelaBody) return;

        tabelaBody.innerHTML = '';

        // Ordena as despesas pela data mais recente
        const despesasOrdenadas = [...this.despesas].sort((a, b) => b.timestamp - a.timestamp);

        despesasOrdenadas.slice(0, 10).forEach(despesa => {
            const row = tabelaBody.insertRow();
            row.insertCell(0).textContent = despesa.data;
            row.insertCell(1).textContent = despesa.descricao;
            row.insertCell(2).textContent = `R$ ${despesa.valor.toFixed(2).replace('.', ',')}`;
            row.insertCell(3).textContent = despesa.categoria;

            const acoesCell = row.insertCell(4);
            const removeBtn = document.createElement('button');
            removeBtn.innerHTML = '🗑️';
            removeBtn.classList.add('btn-delete');
            removeBtn.title = 'Remover Despesa';
            removeBtn.addEventListener('click', () => this.removerDespesa(despesa.id));
            acoesCell.appendChild(removeBtn);
        });
    }

    atualizarRelatorios() {
        const dataInicioStr = document.getElementById('dataInicio').value;
        const dataFimStr = document.getElementById('dataFim').value;

        let vendasFiltradas = this.vendas;

        if (dataInicioStr && dataFimStr) {
            const dataInicio = new Date(dataInicioStr + 'T00:00:00').getTime();
            const dataFim = new Date(dataFimStr + 'T23:59:59').getTime();
            vendasFiltradas = this.vendas.filter(venda => {
                return venda.timestamp >= dataInicio && venda.timestamp <= dataFim;
            });
        }

        const totalVendas = vendasFiltradas.reduce((sum, venda) => sum + venda.valor, 0);
        const totalFiado = vendasFiltradas.filter(venda => venda.formaPagamento === 'Fiado')
                                         .reduce((sum, venda) => sum + venda.valor, 0);

        document.getElementById('totalVendas').textContent = `R$ ${totalVendas.toFixed(2).replace('.', ',')}`;
        document.getElementById('totalFiado').textContent = `R$ ${totalFiado.toFixed(2).replace('.', ',')}`;

        this.renderizarChartPagamento(vendasFiltradas);
        this.renderizarChartVendasDiarias(vendasFiltradas);
    }

    renderizarChartPagamento(vendas) {
        const ctx = document.getElementById('chartPagamento').getContext('2d');

        // Destruir o gráfico anterior se existir
        if (this.chartPagamento) {
            this.chartPagamento.destroy();
        }

        const dadosPagamento = vendas.reduce((acc, venda) => {
            acc[venda.formaPagamento] = (acc[venda.formaPagamento] || 0) + venda.valor;
            return acc;
        }, {});

        const labels = Object.keys(dadosPagamento);
        const data = Object.values(dadosPagamento);

        this.chartPagamento = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.8)', // Dinheiro
                        'rgba(54, 162, 235, 0.8)', // Débito
                        'rgba(255, 206, 86, 0.8)', // Crédito
                        'rgba(75, 192, 192, 0.8)', // Pix
                        'rgba(153, 102, 255, 0.8)'  // Fiado
                    ],
                    borderColor: [
                        'rgba(255, 99, 132, 1)',
                        'rgba(54, 162, 235, 1)',
                        'rgba(255, 206, 86, 1)',
                        'rgba(75, 192, 192, 1)',
                        'rgba(153, 102, 255, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: false,
                        text: 'Vendas por Forma de Pagamento'
                    }
                }
            }
        });
    }

    renderizarChartVendasDiarias(vendas) {
        const ctx = document.getElementById('chartVendasDiarias').getContext('2d');

        if (this.chartVendasDiarias) {
            this.chartVendasDiarias.destroy();
        }

        const vendasPorDia = vendas.reduce((acc, venda) => {
            const data = venda.data; // Formato YYYY-MM-DD
            acc[data] = (acc[data] || 0) + venda.valor;
            return acc;
        }, {});

        const labels = Object.keys(vendasPorDia).sort();
        const data = labels.map(label => vendasPorDia[label]);

        this.chartVendasDiarias = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Vendas Diárias (R$)',
                    data: data,
                    backgroundColor: 'rgba(54, 162, 235, 0.6)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    title: {
                        display: false,
                        text: 'Vendas Diárias'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    atualizarGraficosDespesas() {
        this.renderizarChartDespesasCategoria();
        this.renderizarChartDespesasMensal();
    }

    renderizarChartDespesasCategoria() {
        const ctx = document.getElementById('chartDespesasCategoria').getContext('2d');

        if (this.chartDespesasCategoria) {
            this.chartDespesasCategoria.destroy();
        }

        const despesasPorCategoria = this.despesas.reduce((acc, despesa) => {
            acc[despesa.categoria] = (acc[despesa.categoria] || 0) + despesa.valor;
            return acc;
        }, {});

        const labels = Object.keys(despesasPorCategoria);
        const data = Object.values(despesasPorCategoria);

        this.chartDespesasCategoria = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: [
                        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#E7E9ED'
                    ],
                    hoverBackgroundColor: [
                        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#E7E9ED'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: false,
                        text: 'Despesas por Categoria'
                    }
                }
            }
        });
    }

    renderizarChartDespesasMensal() {
        const ctx = document.getElementById('chartDespesasMensal').getContext('2d');

        if (this.chartDespesasMensal) {
            this.chartDespesasMensal.destroy();
        }

        const despesasPorMes = this.despesas.reduce((acc, despesa) => {
            const [ano, mes] = despesa.data.split('-');
            const chaveMes = `${ano}-${mes}`; // Ex: "2023-10"
            acc[chaveMes] = (acc[chaveMes] || 0) + despesa.valor;
            return acc;
        }, {});

        const labels = Object.keys(despesasPorMes).sort();
        const data = labels.map(label => despesasPorMes[label]);

        this.chartDespesasMensal = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Despesas Mensais (R$)',
                    data: data,
                    borderColor: 'rgba(255, 99, 132, 1)',
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    fill: true,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    title: {
                        display: false,
                        text: 'Resumo Mensal de Despesas'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    mostrarMensagem(mensagem, tipo) {
        const mainElement = document.querySelector('main');
        const existingMessage = document.querySelector('.message');
        if (existingMessage) {
            existingMessage.remove();
        }

        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', tipo);
        messageDiv.textContent = mensagem;
        mainElement.prepend(messageDiv);

        setTimeout(() => {
            messageDiv.remove();
        }, 5000); // Remove a mensagem após 5 segundos
    }

    limparFormulario(formId) {
        document.getElementById(formId).reset();
        // Esconder o campo de cliente fiado novamente
        if (formId === 'vendaForm') {
            document.getElementById('clienteFiadoGroup').style.display = 'none';
        }
    }
}

// Inicializa o sistema quando o DOM estiver completamente carregado
document.addEventListener('DOMContentLoaded', () => {
    new SistemaVendas();
});