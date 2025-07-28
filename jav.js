class SistemaVendas {
    constructor() {
        this.vendas = [];
        this.despesas = [];
        this.saldoEmMaos = 0;
        this.saldoEmContas = 0;
        this.urlBase = 'http://localhost:3000'; // URL base para o json-server

        this.chartPagamento = null;
        this.chartVendasDiarias = null;
        this.chartDespesasCategoria = null;
        this.chartDespesasMensal = null;

        this.inicializar();
    }

    // --- FUNÇÕES PARA INTERAGIR COM A API ---

    async getDados(endpoint) {
        try {
            const response = await fetch(`${this.urlBase}/${endpoint}`);
            if (!response.ok) {
                throw new Error(`Erro ao carregar dados do endpoint ${endpoint}: ${response.statusText}`);
            }
            const data = await response.json();
            console.log(`Dados carregados de ${endpoint}:`, data);
            return data;
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
            this.mostrarMensagem(`Erro ao carregar ${endpoint}. Verifique o servidor.`, 'error');
            return [];
        }
    }

    async postDados(endpoint, dado) {
        try {
            const method = (endpoint === 'saldo' && dado.id) ? 'PUT' : 'POST';
            const url = (endpoint === 'saldo' && dado.id) ? `${this.urlBase}/${endpoint}/${dado.id}` : `${this.urlBase}/${endpoint}`;

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

    async deleteDados(endpoint, id) {
        try {
            const response = await fetch(`${this.urlBase}/${endpoint}/${id}`, {
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

    inicializar() {
        this.carregarDadosIniciais();
        this.configurarNavegacao();
        this.configurarFormularios();
        this.configurarEventos();
        this.definirDataAtual();
        this.preencherFiltroMesAtual(); // <-- Adicione aqui também, se quiser
    }

    async carregarDadosIniciais() {
        this.vendas = await this.getDados('vendas') || [];
        this.despesas = await this.getDados('despesas') || [];

        const saldos = await this.getDados('saldo');
        if (saldos && saldos.length > 0) {
            const saldoObj = saldos[0];
            this.saldoEmMaos = parseFloat(saldoObj.emMaos) || 0;
            this.saldoEmContas = parseFloat(saldoObj.emContas) || 0;
        } else {
            // Se não houver dados de saldo, inicializa com 0 e cria o registro no db.json
            this.saldoEmMaos = 0;
            this.saldoEmContas = 0;
            // O id '1' é crucial para que o json-server trate isso como um PUT subsequente
            await this.postDados('saldo', { emMaos: 0, emContas: 0, id: '1' });
        }

        this.atualizarInterface();
    }

    atualizarDisplaySaldo() {
        const saldoTotal = this.saldoEmMaos + this.saldoEmContas;

        const displaySaldoTotal = document.getElementById('displaySaldoTotal');
        const displaySaldoEmMaos = document.getElementById('displaySaldoEmMaos');
        const displaySaldoEmContas = document.getElementById('displaySaldoEmContas');

        if (displaySaldoTotal) {
            displaySaldoTotal.textContent = `R$ ${saldoTotal.toFixed(2).replace('.', ',')}`;
            displaySaldoTotal.style.color = saldoTotal < 0 ? 'red' : 'green';
        }
        if (displaySaldoEmMaos) {
            displaySaldoEmMaos.textContent = `R$ ${this.saldoEmMaos.toFixed(2).replace('.', ',')}`;
        }
        if (displaySaldoEmContas) {
            displaySaldoEmContas.textContent = `R$ ${this.saldoEmContas.toFixed(2).replace('.', ',')}`;
        }

        // Atualiza os reports do dashboard com totais (opcional, mas bom para consistência)
        document.getElementById('totalVendasDashboard').textContent = `R$ ${this.calcularTotalVendas().toFixed(2).replace('.', ',')}`;
        document.getElementById('totalFiadoDashboard').textContent = `R$ ${this.calcularTotalFiado().toFixed(2).replace('.', ',')}`;
        document.getElementById('totalDespesasDashboard').textContent = `R$ ${this.calcularTotalDespesas().toFixed(2).replace('.', ',')}`;
    }

    // Novos cálculos para o dashboard
    calcularTotalVendas() {
        return this.vendas.reduce((sum, venda) => sum + venda.valor, 0);
    }

    calcularTotalFiado() {
        return this.vendas.filter(venda => venda.formaPagamento === 'Fiado')
                         .reduce((sum, venda) => sum + venda.valor, 0);
    }

    calcularTotalDespesas() {
        return this.despesas.reduce((sum, despesa) => sum + despesa.valor, 0);
    }

    atualizarInterface() {
        this.atualizarTabelaVendas();
        this.atualizarTabelaDespesas();
        this.atualizarDisplaySaldo(); // Chamado aqui também para atualizar ao carregar

        const tabAtiva = document.querySelector('.tab-content.active');
        if (tabAtiva) { // Garante que a atualização de gráficos ocorra na aba ativa
            if (tabAtiva.id === 'relatorios') {
                setTimeout(() => this.atualizarRelatorios(), 50);
            } else if (tabAtiva.id === 'despesas') {
                setTimeout(() => this.atualizarGraficosDespesas(), 50);
            }
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

                // Garante que os gráficos sejam renderizados apenas quando a aba é ativada
                if (tabId === 'relatorios') {
                    this.preencherFiltroMesAtual(); // <-- Adicione esta linha
                    this.atualizarRelatorios();
                } else if (tabId === 'despesas') {
                    this.atualizarGraficosDespesas();
                }
                // Limpa mensagens ao trocar de aba
                this.limparMensagens();
            });
        });
    }

    configurarFormularios() {
        document.getElementById('vendaForm').addEventListener('submit', async (e) => { // Added async
            e.preventDefault();
            await this.registrarVenda(); // Added await
        });

        document.getElementById('despesaForm').addEventListener('submit', async (e) => { // Added async
            e.preventDefault();
            await this.registrarDespesa(); // Added await
        });
    }

    configurarEventos() {
        document.getElementById('formaPagamento').addEventListener('change', (e) => {
            const clienteFiadoGroup = document.getElementById('clienteFiadoGroup');
            if (e.target.value === 'Fiado') {
                clienteFiadoGroup.style.display = 'block';
            } else {
                clienteFiadoGroup.style.display = 'none';
            }
        });

        document.getElementById('filtrarRelatorio').addEventListener('click', () => {
            this.atualizarRelatorios();
        });

        document.getElementById('btnAjustarSaldo').addEventListener('click', () => {
            this.ajustarSaldoManualmente();
        });
    }

    definirDataAtual() {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
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

    async registrarVenda() {
        const data = document.getElementById('dataVenda').value;
        const hora = document.getElementById('horaVenda').value;
        const descricao = document.getElementById('descricaoVenda').value;
        const valor = parseFloat(document.getElementById('valorVenda').value);
        const formaPagamento = document.getElementById('formaPagamento').value;
        const clienteFiado = document.getElementById('clienteFiado').value;

        if (!descricao || descricao.trim() === "") {
            this.mostrarMensagem('Por favor, insira a descrição da venda.', 'error');
            return;
        }
        if (isNaN(valor) || valor <= 0) {
            this.mostrarMensagem('Por favor, insira um valor de venda válido (maior que zero).', 'error');
            return;
        }

        let tipoSaldo = null;
        if (formaPagamento === 'Dinheiro') {
            tipoSaldo = 'maos';
        } else if (
            formaPagamento === 'Débito' ||
            formaPagamento === 'Crédito' ||
            formaPagamento === 'Pix'
        ) {
            tipoSaldo = 'contas';
        }
        // Fiado não afeta saldo imediatamente

        const novaVenda = {
            data,
            hora,
            descricao,
            valor,
            formaPagamento,
            clienteFiado: formaPagamento === 'Fiado' ? clienteFiado : '',
            tipoSaldoAfetado: tipoSaldo,
            timestamp: new Date(`${data}T${hora}`).getTime()
        };

        const vendaSalva = await this.postDados('vendas', novaVenda);
        if (vendaSalva) {
            this.vendas.unshift(vendaSalva);
            this.mostrarMensagem('Venda registrada com sucesso!', 'success');
            this.limparFormulario('vendaForm');
            this.definirDataAtual();

            if (vendaSalva.tipoSaldoAfetado === 'maos') {
                this.saldoEmMaos += vendaSalva.valor;
            } else if (vendaSalva.tipoSaldoAfetado === 'contas') {
                this.saldoEmContas += vendaSalva.valor;
            }

            await this.postDados('saldo', { emMaos: this.saldoEmMaos, emContas: this.saldoEmContas, id: '1' });
            this.atualizarInterface(); // Atualiza tudo após a persistência
        }
    }

    async registrarDespesa() {
        const data = document.getElementById('dataDespesa').value;
        const descricao = document.getElementById('descricaoDespesa').value;
        const valor = parseFloat(document.getElementById('valorDespesa').value);
        const categoria = document.getElementById('categoriaDespesa').value;

        if (!descricao || descricao.trim() === "") {
            this.mostrarMensagem('Por favor, insira a descrição da despesa.', 'error');
            return;
        }
        if (isNaN(valor) || valor <= 0) {
            this.mostrarMensagem('Por favor, insira um valor de despesa válido (maior que zero).', 'error');
            return;
        }

        let tipoSaldo = null;
        if (categoria === 'Dinheiro') {
            tipoSaldo = 'maos';
        } else if (
            categoria === 'Débito' ||
            categoria === 'Crédito' ||
            categoria === 'Pix' ||
            categoria === 'Transferência' // caso você tenha outras categorias
        ) {
            while (tipoSaldo !== 'maos' && tipoSaldo !== 'contas') {
                const escolha = prompt("Despesa saiu de Dinheiro em Mãos (digite 'maos') ou de Conta (digite 'contas')?").toLowerCase();
                if (escolha === 'maos' || escolha === 'contas') {
                    tipoSaldo = escolha;
                } else if (escolha === null) {
                    this.mostrarMensagem("Registro de despesa cancelado.", "info");
                    return;
                } else {
                    alert("Opção inválida. Por favor, digite 'maos' ou 'contas'.");
                }
            }
        }

        const novaDespesa = {
            data,
            descricao,
            valor,
            categoria,
            tipoSaldoAfetado: tipoSaldo,
            timestamp: new Date(data).getTime()
        };

        const despesaSalva = await this.postDados('despesas', novaDespesa);
        if (despesaSalva) {
            this.despesas.unshift(despesaSalva);
            this.mostrarMensagem('Despesa registrada com sucesso!', 'success');
            this.limparFormulario('despesaForm');
            this.definirDataAtual();

            if (despesaSalva.tipoSaldoAfetado === 'maos') {
                this.saldoEmMaos -= despesaSalva.valor;
            } else if (despesaSalva.tipoSaldoAfetado === 'contas') {
                this.saldoEmContas -= despesaSalva.valor;
            }

            await this.postDados('saldo', { emMaos: this.saldoEmMaos, emContas: this.saldoEmContas, id: '1' });
            this.atualizarInterface(); // Atualiza tudo após a persistência
        }
    }

    // FUNÇÃO AJUSTADA: Ajustar Saldo Manualmente
    async ajustarSaldoManualmente() {
        let tipoSaldoAjustar = null;
        while (tipoSaldoAjustar !== 'maos' && tipoSaldoAjustar !== 'contas' && tipoSaldoAjustar !== 'total') {
            const escolha = prompt("Qual saldo deseja ajustar? Dinheiro (digite 'maos'), Contas (digite 'contas') ou Saldo Total (digite 'total')?").toLowerCase();
            if (escolha === 'maos' || escolha === 'contas' || escolha === 'total') {
                tipoSaldoAjustar = escolha;
            } else if (escolha === null) {
                this.mostrarMensagem("Ajuste de saldo cancelado.", "info");
                return;
            } else {
                alert("Opção inválida. Por favor, digite 'maos', 'contas' ou 'total'.");
            }
        }

        const novoValorStr = prompt(`Por favor, insira o NOVO valor para o saldo ${tipoSaldoAjustar === 'maos' ? 'em Mãos' : tipoSaldoAjustar === 'contas' ? 'em Contas' : 'Total'} (ex: 1500,00):`);
        if (novoValorStr === null || novoValorStr.trim() === "") {
            this.mostrarMensagem("Ajuste de saldo cancelado.", "info");
            return;
        }

        const novoValor = parseFloat(novoValorStr.replace(',', '.'));

        if (isNaN(novoValor)) {
            this.mostrarMensagem("Valor inválido. Por favor, insira um número.", "error");
            return;
        }

        if (tipoSaldoAjustar === 'maos') {
            this.saldoEmMaos = novoValor;
        } else if (tipoSaldoAjustar === 'contas') {
            this.saldoEmContas = novoValor;
        } else if (tipoSaldoAjustar === 'total') {
            // Se ajustar o total, pedimos como distribuir
            const distribuiStr = prompt(`Você quer distribuir R$ ${novoValor.toFixed(2).replace('.', ',')} para 'Dinheiro em Mãos' ou 'Dinheiro em Contas'? (digite 'maos' ou 'contas')`);
            if (distribuiStr === null || (distribuiStr !== 'maos' && distribuiStr !== 'contas')) {
                this.mostrarMensagem("Distribuição de saldo total cancelada ou inválida. Ajuste de saldo cancelado.", "info");
                return;
            }
            if (distribuiStr === 'maos') {
                this.saldoEmMaos = novoValor;
                this.saldoEmContas = 0; // Zera o outro para o ajuste total se concentrar aqui
                this.mostrarMensagem("Saldo total ajustado para 'Dinheiro em Mãos'. Saldo 'em Contas' foi zerado.", "info");
            } else { // distribuiStr === 'contas'
                this.saldoEmContas = novoValor;
                this.saldoEmMaos = 0; // Zera o outro para o ajuste total se concentrar aqui
                this.mostrarMensagem("Saldo total ajustado para 'Dinheiro em Contas'. Saldo 'em Mãos' foi zerado.", "info");
            }
        }

        const sucesso = await this.postDados('saldo', { emMaos: this.saldoEmMaos, emContas: this.saldoEmContas, id: '1' });

        if (sucesso) {
            this.atualizarDisplaySaldo();
            this.mostrarMensagem(`Saldo ${tipoSaldoAjustar === 'maos' ? 'em Mãos' : tipoSaldoAjustar === 'contas' ? 'em Contas' : 'Total'} ajustado para R$ ${novoValor.toFixed(2).replace('.', ',')} com sucesso!`, "success");
        } else {
            this.mostrarMensagem("Erro ao ajustar o saldo. Tente novamente.", "error");
        }
    }

    async removerVenda(id) {
        if (confirm('Tem certeza que deseja remover esta venda?')) {
            const vendaRemovida = this.vendas.find(v => v.id === id);

            const sucesso = await this.deleteDados('vendas', id);
            if (sucesso) {
                this.vendas = this.vendas.filter(venda => venda.id !== id);
                this.mostrarMensagem('Venda removida com sucesso!', 'success');

                if (vendaRemovida && vendaRemovida.tipoSaldoAfetado) {
                    if (vendaRemovida.tipoSaldoAfetado === 'maos') {
                        this.saldoEmMaos -= vendaRemovida.valor;
                    } else if (vendaRemovida.tipoSaldoAfetado === 'contas') {
                        this.saldoEmContas -= vendaRemovida.valor;
                    }
                    await this.postDados('saldo', { emMaos: this.saldoEmMaos, emContas: this.saldoEmContas, id: '1' });
                } else if (vendaRemovida) {
                    // Fallback para vendas antigas sem tipoSaldoAfetado: assume que afetou 'maos'
                    this.saldoEmMaos -= vendaRemovida.valor;
                    await this.postDados('saldo', { emMaos: this.saldoEmMaos, emContas: this.saldoEmContas, id: '1' });
                    this.mostrarMensagem("Venda removida de um registro antigo, saldo em mãos ajustado.", "info");
                }
                this.atualizarInterface(); // Atualiza tudo após a remoção e ajuste
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

                if (despesaRemovida && despesaRemovida.tipoSaldoAfetado) {
                    if (despesaRemovida.tipoSaldoAfetado === 'maos') {
                        this.saldoEmMaos += despesaRemovida.valor;
                    } else if (despesaRemovida.tipoSaldoAfetado === 'contas') {
                        this.saldoEmContas += despesaRemovida.valor;
                    }
                    await this.postDados('saldo', { emMaos: this.saldoEmMaos, emContas: this.saldoEmContas, id: '1' });
                } else if (despesaRemovida) {
                    // Fallback para despesas antigas sem tipoSaldoAfetado: assume que afetou 'maos'
                    this.saldoEmMaos += despesaRemovida.valor;
                    await this.postDados('saldo', { emMaos: this.saldoEmMaos, emContas: this.saldoEmContas, id: '1' });
                    this.mostrarMensagem("Despesa removida de um registro antigo, saldo em mãos ajustado.", "info");
                }
                this.atualizarInterface(); // Atualiza tudo após a remoção e ajuste
            }
        }
    }

    atualizarTabelaVendas() {
        const tabelaBody = document.querySelector('#tabelaVendas tbody');
        if (!tabelaBody) return;

        tabelaBody.innerHTML = '';

        const vendasOrdenadas = [...this.vendas].sort((a, b) => b.timestamp - a.timestamp);

        vendasOrdenadas.slice(0, 10).forEach(venda => {
            const row = tabelaBody.insertRow();
            row.insertCell(0).textContent = `${venda.data} ${venda.hora}`;
            row.insertCell(1).textContent = venda.descricao;
            row.insertCell(2).textContent = `R$ ${venda.valor.toFixed(2).replace('.', ',')}`;
            row.insertCell(3).textContent = venda.formaPagamento;
            row.insertCell(4).textContent = venda.clienteFiado || '-';
            row.insertCell(5).textContent = venda.tipoSaldoAfetado ? (venda.tipoSaldoAfetado === 'maos' ? 'Mãos' : 'Contas') : 'Desconhecido';

            const acoesCell = row.insertCell(6);
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

        const despesasOrdenadas = [...this.despesas].sort((a, b) => b.timestamp - a.timestamp);

        despesasOrdenadas.slice(0, 10).forEach(despesa => {
            const row = tabelaBody.insertRow();
            row.insertCell(0).textContent = despesa.data;
            row.insertCell(1).textContent = despesa.descricao;
            row.insertCell(2).textContent = `R$ ${despesa.valor.toFixed(2).replace('.', ',')}`;
            row.insertCell(3).textContent = despesa.categoria;
            row.insertCell(4).textContent = despesa.tipoSaldoAfetado ? (despesa.tipoSaldoAfetado === 'maos' ? 'Mãos' : 'Contas') : 'Desconhecido';

            const acoesCell = row.insertCell(5);
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
        let despesasFiltradas = this.despesas;

        if (dataInicioStr && dataFimStr) {
            const dataInicio = new Date(dataInicioStr + 'T00:00:00').getTime();
            const dataFim = new Date(dataFimStr + 'T23:59:59').getTime();
            vendasFiltradas = this.vendas.filter(venda => {
                return venda.timestamp >= dataInicio && venda.timestamp <= dataFim;
            });
            despesasFiltradas = this.despesas.filter(despesa => {
                return despesa.timestamp >= dataInicio && despesa.timestamp <= dataFim;
            });
        }

        const totalVendas = vendasFiltradas.reduce((sum, venda) => sum + venda.valor, 0);
        const totalFiado = vendasFiltradas.filter(venda => venda.formaPagamento === 'Fiado')
                                      .reduce((sum, venda) => sum + venda.valor, 0);
        const totalDespesas = despesasFiltradas.reduce((sum, despesa) => sum + despesa.valor, 0);

        document.getElementById('totalVendas').textContent = `R$ ${totalVendas.toFixed(2).replace('.', ',')}`;
        document.getElementById('totalFiado').textContent = `R$ ${totalFiado.toFixed(2).replace('.', ',')}`;
        document.getElementById('totalDespesasRelatorio').textContent = `R$ ${totalDespesas.toFixed(2).replace('.', ',')}`;

        this.renderizarChartPagamento(vendasFiltradas);
        this.renderizarChartVendasDiarias(vendasFiltradas);

        // Preencher a tabela de despesas do relatório
        const tabelaBody = document.querySelector('#tabelaDespesasRelatorio tbody');
        if (tabelaBody) {
            tabelaBody.innerHTML = '';
            despesasFiltradas.forEach(despesa => {
                const row = tabelaBody.insertRow();
                row.insertCell(0).textContent = despesa.data;
                row.insertCell(1).textContent = despesa.descricao;
                row.insertCell(2).textContent = despesa.categoria;
                row.insertCell(3).textContent = `R$ ${despesa.valor.toFixed(2).replace('.', ',')}`;
            });
        }
    }

    renderizarChartPagamento(vendas) {
        const ctx = document.getElementById('chartPagamento');
        if (!ctx) return; // Garante que o canvas existe

        const context = ctx.getContext('2d');

        if (this.chartPagamento) {
            this.chartPagamento.destroy();
        }

        const dadosPagamento = vendas.reduce((acc, venda) => {
            acc[venda.formaPagamento] = (acc[venda.formaPagamento] || 0) + venda.valor;
            return acc;
        }, {});

        const labels = Object.keys(dadosPagamento);
        const data = Object.values(dadosPagamento);

        this.chartPagamento = new Chart(context, {
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
        const ctx = document.getElementById('chartVendasDiarias');
        if (!ctx) return; // Garante que o canvas existe

        const context = ctx.getContext('2d');

        if (this.chartVendasDiarias) {
            this.chartVendasDiarias.destroy();
        }

        const vendasPorDia = vendas.reduce((acc, venda) => {
            const data = venda.data;
            acc[data] = (acc[data] || 0) + venda.valor;
            return acc;
        }, {});

        const labels = Object.keys(vendasPorDia).sort();
        const data = labels.map(label => vendasPorDia[label]);

        this.chartVendasDiarias = new Chart(context, {
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
        const ctx = document.getElementById('chartDespesasCategoria');
        if (!ctx) return; // Garante que o canvas existe
        const context = ctx.getContext('2d');

        if (this.chartDespesasCategoria) {
            this.chartDespesasCategoria.destroy();
        }

        const despesasPorCategoria = this.despesas.reduce((acc, despesa) => {
            acc[despesa.categoria] = (acc[despesa.categoria] || 0) + despesa.valor;
            return acc;
        }, {});

        const labels = Object.keys(despesasPorCategoria);
        const data = Object.values(despesasPorCategoria);

        this.chartDespesasCategoria = new Chart(context, {
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
        const ctx = document.getElementById('chartDespesasMensal');
        if (!ctx) return; // Garante que o canvas existe
        const context = ctx.getContext('2d');

        if (this.chartDespesasMensal) {
            this.chartDespesasMensal.destroy();
        }

        const despesasPorMes = this.despesas.reduce((acc, despesa) => {
            const [ano, mes] = despesa.data.split('-');
            const chaveMes = `${ano}-${mes}`;
            acc[chaveMes] = (acc[chaveMes] || 0) + despesa.valor;
            return acc;
        }, {});

        const labels = Object.keys(despesasPorMes).sort();
        const data = labels.map(label => despesasPorMes[label]);

        this.chartDespesasMensal = new Chart(context, {
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

    preencherFiltroMesAtual() {
        const hoje = new Date();
        const ano = hoje.getFullYear();
        const mes = hoje.getMonth();

        // Primeiro dia do mês
        const primeiroDia = new Date(ano, mes, 1);
        // Último dia do mês
        const ultimoDia = new Date(ano, mes + 1, 0);

        // Formatar para yyyy-mm-dd
        const formatar = d => d.toISOString().slice(0, 10);

        const dataInicioInput = document.getElementById('dataInicio');
        const dataFimInput = document.getElementById('dataFim');

        if (dataInicioInput && dataFimInput) {
            dataInicioInput.value = formatar(primeiroDia);
            dataFimInput.value = formatar(ultimoDia);
        }
    }

    // --- FUNÇÕES DE UTILIDADE ---

    limparFormulario(formId) {
        document.getElementById(formId).reset();
        if (formId === 'vendaForm') {
            document.getElementById('clienteFiadoGroup').style.display = 'none';
        }
    }

    mostrarMensagem(mensagem, tipo = 'info') {
        const container = document.getElementById('messageContainer');
        if (!container) {
            console.warn('Elemento #messageContainer não encontrado para exibir mensagem:', mensagem);
            alert(mensagem); // Fallback para alert
            return;
        }

        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', tipo);
        messageDiv.textContent = mensagem;

        // Adiciona a mensagem e a remove após um tempo
        container.innerHTML = ''; // Limpa mensagens anteriores
        container.appendChild(messageDiv);

        setTimeout(() => {
            messageDiv.remove();
        }, 5000); // Remove a mensagem após 5 segundos
    }

    limparMensagens() {
        const container = document.getElementById('messageContainer');
        if (container) {
            container.innerHTML = '';
        }
    }
}

// Inicializa o sistema
document.addEventListener('DOMContentLoaded', () => {
    window.sistemaVendas = new SistemaVendas();
});