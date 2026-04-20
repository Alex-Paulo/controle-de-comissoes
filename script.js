const banco = supabase.createClient(supabaseUrl, supabaseKey);

let paginaAtual = 1;
const itensPorPagina = 10;
let comissoes = [];
let comissoesFiltradas = []; 
let editandoId = null; 

// NOVAS VARIÁVEIS DE CONTROLE
let perfilUsuario = 'leitura'; // Padrão é leitura para proteger o sistema
let filtroRapidoAtual = 'todos'; 

async function verificarSessao() {
    const { data: { session } } = await banco.auth.getSession();
    if (session) {
        await carregarPerfil(session.user.email);
        document.getElementById("loginScreen").style.display = "none";
        document.getElementById("appContent").style.display = "block";
        carregarComissoes(); 
    }
}
verificarSessao();

async function fazerLogin() {
    let emailDigitado = document.getElementById("emailLogin").value;
    let senhaDigitada = document.getElementById("senhaLogin").value;
    let erro = document.getElementById("erroLogin");
    let btnEntrar = document.getElementById("btnEntrar");

    btnEntrar.innerText = "Verificando...";
    const { data, error } = await banco.auth.signInWithPassword({ email: emailDigitado, password: senhaDigitada });
    btnEntrar.innerText = "Entrar"; 

    if (error) {
        erro.style.display = "block";
    } else {
        erro.style.display = "none";
        await carregarPerfil(emailDigitado); // Busca se ele é admin ou não
        document.getElementById("loginScreen").style.display = "none";
        document.getElementById("appContent").style.display = "block";
        carregarComissoes(); 
    }
}

async function fazerLogout() {
    await banco.auth.signOut();
    document.getElementById("appContent").style.display = "none";
    document.getElementById("loginScreen").style.display = "flex";
    document.getElementById("emailLogin").value = "";
    document.getElementById("senhaLogin").value = "";
}

document.getElementById("emailLogin").addEventListener("keypress", function(e) { if (e.key === "Enter") fazerLogin(); });
document.getElementById("senhaLogin").addEventListener("keypress", function(e) { if (e.key === "Enter") fazerLogin(); });

// --- LÓGICA DE NÍVEL DE ACESSO ---
async function carregarPerfil(email) {
    const { data, error } = await banco.from('permissoes').select('perfil').eq('email', email).single();
    
    if (data && data.perfil) {
        perfilUsuario = data.perfil;
    } else {
        perfilUsuario = 'leitura'; // Se não achar na tabela, vira leitura por segurança
    }

    aplicarRegrasDeTela();
}

function aplicarRegrasDeTela() {
    // A div que engloba os "cards" e o formulário precisa de um ID ou pegamos pela classe. 
    // Como o form-grid tá dentro de uma div com bg white, vamos esconder o pai se for leitura
    const formContainer = document.querySelector('.form-grid').parentElement;
    
    if (perfilUsuario === 'leitura') {
        formContainer.style.display = 'none'; // Esconde formulário de cadastro
    } else {
        formContainer.style.display = 'block'; // Mostra para admin
    }
}


// --- RESTANTE DO SISTEMA ---
async function carregarComissoes() {
    const { data, error } = await banco.from('comissoes').select('*').order('id', { ascending: false });
    if (error) { console.error("Erro:", error); return; }
    
    comissoes = data || [];
    aplicarFiltrosCombinados(); // Já aplica os filtros caso haja algum
    atualizarDashboard();
}

// ... AS FUNÇÕES DE SALVAR, BAIXAR PORTARIA, EXCLUIR, GERAR BADGES CONTINUAM IGUAIS ...
// (Mantenha as suas funções salvarComissao, baixarPortaria, excluir, adicionarMembro, gerarBadges exatamente como estão)

async function salvarComissao() {
    let btnSalvar = document.querySelector('button[onclick="salvarComissao()"]');
    btnSalvar.innerText = "Salvando..."; 

    let nome = document.getElementById("nomeComissao").value;
    let fiscal = document.getElementById("fiscal").value;
    let fiscalSiafi = document.getElementById("fiscalSiafi").checked;
    let fiscalCurso = document.getElementById("fiscalCurso").checked;
    let fiscalSubstituto = document.getElementById("fiscalSubstituto").value;
    let substitutoSiafi = document.getElementById("substitutoSiafi").checked;
    let substitutoCurso = document.getElementById("substitutoCurso").checked;
    let obs = document.getElementById("observacao").value;
    let portaria = document.getElementById("portaria").value;
    let boletim = document.getElementById("boletim").value;
    let sigad = document.getElementById("sigad").value;

    let inputArquivo = document.getElementById("arquivoPortaria");
    let arquivo = inputArquivo.files[0];
    let caminhoNoStorage = null;

    if (arquivo) {
        const nomeLimpo = arquivo.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9.-]/g, "_"); 
        const nomeArquivoUnico = `${Date.now()}_${nomeLimpo}`;
        const { data, error } = await banco.storage.from('portarias').upload(nomeArquivoUnico, arquivo);
        
        if (error) {
            alert("Erro ao enviar o arquivo PDF: " + error.message);
            btnSalvar.innerText = "Salvar Comissão no Sistema";
            return; 
        }
        caminhoNoStorage = data.path; 
    }

    let membrosGroups = document.querySelectorAll(".membro-group");
    let membros = [];
    membrosGroups.forEach(group => {
        let nomeMembro = group.querySelector(".membro-nome").value;
        let siafi = group.querySelector(".membro-siafi").checked;
        let curso = group.querySelector(".membro-curso").checked;
        if(nomeMembro.trim() !== "") {
            membros.push({ nome: nomeMembro, siafi_siasg: siafi, curso: curso });
        }
    });

    let dadosComissao = {
        nome: nome, fiscal: fiscal, fiscal_siafi: fiscalSiafi, fiscal_curso: fiscalCurso,
        fiscal_substituto: fiscalSubstituto, substituto_siafi: substitutoSiafi, substituto_curso: substitutoCurso,
        membros: membros, observacao: obs, portaria: portaria, boletim: boletim, sigad: sigad
    };

    if (caminhoNoStorage) dadosComissao.portaria_path = caminhoNoStorage;

    if(editandoId !== null) {
        await banco.from('comissoes').update(dadosComissao).eq('id', editandoId);
        editandoId = null;
    } else {
        await banco.from('comissoes').insert([dadosComissao]);
    }

    limparCampos();
    await carregarComissoes(); 
    btnSalvar.innerText = "Salvar Comissão no Sistema"; 
}

async function baixarPortaria(path) {
    const { data, error } = await banco.storage.from('portarias').createSignedUrl(path, 60);
    if (error) alert("Erro ao abrir o arquivo: " + error.message);
    else window.open(data.signedUrl, '_blank'); 
}

async function excluir(id) {
    if(confirm("Deseja excluir esta comissão definitivamente?")) {
        await banco.from('comissoes').delete().eq('id', id);
        await carregarComissoes();
    }
}

function adicionarMembro() {
    let container = document.getElementById("membrosContainer");
    let div = document.createElement("div");
    div.className = "militar-row membro-group"; 
    div.innerHTML = `
        <input type="text" class="membro-nome" placeholder="Nome do Membro">
        <div class="checkbox-group">
            <label><input type="checkbox" class="membro-siafi"> SIAFI</label>
            <label><input type="checkbox" class="membro-curso"> CURSO</label>
        </div>
    `;
    container.appendChild(div);
}

function gerarBadges(temSiafi, temCurso) {
    let badgeSiafi = temSiafi ? '<span class="badge sim">SIAFI</span>' : '<span class="badge nao">SIAFI</span>';
    let badgeCurso = temCurso ? '<span class="badge sim">CURSO</span>' : '<span class="badge nao">CURSO</span>';
    return `<div class="badges-container">${badgeSiafi}${badgeCurso}</div>`;
}

// --- PAGINAÇÃO E TABELA ---
function mudarPagina(novaPagina) {
    let totalPaginas = Math.ceil(comissoesFiltradas.length / itensPorPagina);
    if (novaPagina < 1 || novaPagina > totalPaginas) return;
    paginaAtual = novaPagina;
    atualizarTabela();
}

function renderizarPaginacao(totalItens) {
    let divPaginacao = document.getElementById("paginacao");
    let divInfo = document.getElementById("infoPaginacao");
    let totalPaginas = Math.ceil(totalItens / itensPorPagina);
    
    divPaginacao.innerHTML = "";
    if (totalItens === 0) {
        divInfo.innerHTML = "Nenhuma comissão encontrada.";
        return;
    }

    let inicio = ((paginaAtual - 1) * itensPorPagina) + 1;
    let fim = Math.min(paginaAtual * itensPorPagina, totalItens);
    divInfo.innerHTML = `Mostrando ${inicio} até ${fim} de ${totalItens} comissões`;

    if (totalPaginas <= 1) return; 

    let html = `<button onclick="mudarPagina(${paginaAtual - 1})" ${paginaAtual === 1 ? 'disabled' : ''}>&laquo; Anterior</button>`;
    for (let i = 1; i <= totalPaginas; i++) {
        html += `<button onclick="mudarPagina(${i})" class="${paginaAtual === i ? 'ativo' : ''}">${i}</button>`;
    }
    html += `<button onclick="mudarPagina(${paginaAtual + 1})" ${paginaAtual === totalPaginas ? 'disabled' : ''}>Próxima &raquo;</button>`;
    
    divPaginacao.innerHTML = html;
}

function atualizarTabela() {
    let tabela = document.getElementById("listaComissoes");
    tabela.innerHTML = "";

    let inicioSlice = (paginaAtual - 1) * itensPorPagina;
    let fimSlice = inicioSlice + itensPorPagina;
    let itensDaPagina = comissoesFiltradas.slice(inicioSlice, fimSlice);

    itensDaPagina.forEach((c) => {
        let indexReal = comissoes.findIndex(item => item.id === c.id);

        let fiscalExibicao = `<div class="militar-container"><span class="militar-nome">${c.fiscal}</span>${gerarBadges(c.fiscal_siafi, c.fiscal_curso)}</div>`;
        let substitutoExibicao = c.fiscal_substituto ? `<div class="militar-container"><span class="militar-nome">${c.fiscal_substituto}</span>${gerarBadges(c.substituto_siafi, c.substituto_curso)}</div>` : "-";
        
        let membrosExibicao = "-";
        if (c.membros && c.membros.length > 0) {
            let lista = c.membros.map(m => `<div class="militar-container"><span class="militar-nome">${m.nome}</span>${gerarBadges(m.siafi_siasg, m.curso)}</div>`).join("");
            membrosExibicao = `<div class="membros-lista" style="max-height: 80px; overflow-y: auto;">${lista}</div>`;
        }

        let boletimExibicao = c.boletim;
        if (!c.boletim || c.boletim.trim() === "") {
            if (c.created_at) {
                let diffDias = Math.floor((new Date() - new Date(c.created_at)) / (1000 * 60 * 60 * 24));
                boletimExibicao = diffDias >= 3 
                    // Adicionado white-space: nowrap e display: inline-block para não quebrar a linha
                    ? `<span style="background: #dc3545; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8em; font-weight: bold; white-space: nowrap; display: inline-block;">🚨 ATRASADO</span>`
                    : `<span style="background: #ffc107; color: black; padding: 4px 8px; border-radius: 4px; font-size: 0.8em; font-weight: bold; white-space: nowrap; display: inline-block;">⏳ Pendente</span>`;
            } else {
                boletimExibicao = `<span style="background: #ffc107; color: black; padding: 4px 8px; border-radius: 4px; font-size: 0.8em; font-weight: bold; white-space: nowrap; display: inline-block;">⏳ Pendente</span>`;
            }
        }

        let portariaExibicao = c.portaria || "-";
        
        // BOTÕES DE AÇÃO ALINHADOS
        let botaoBaixar = c.portaria_path ? `<button onclick="baixarPortaria('${c.portaria_path}')" style="background-color: #198754; width: 100%; margin-bottom: 5px; font-size: 0.85em; padding: 6px;">Baixar PDF</button>` : "";
        let botoesEdicao = "";
        
        if (perfilUsuario === 'admin') {
            botoesEdicao = `
                <div style="display: flex; gap: 4px; width: 100%;">
                    <button class="btn-editar" onclick="editar(${indexReal})" style="flex: 1; margin: 0; font-size: 0.8em;">Editar</button>
                    <button class="btn-excluir" onclick="excluir(${c.id})" style="flex: 1; margin: 0; font-size: 0.8em;">Excluir</button>
                </div>
            `;
        }

        let linha = `
        <tr>
            <td style="vertical-align: top;"><strong>${c.nome}</strong></td>
            <td style="vertical-align: top;">${fiscalExibicao}</td>
            <td style="vertical-align: top;">${substitutoExibicao}</td>
            <td style="vertical-align: top;">${membrosExibicao}</td>
            <td style="vertical-align: top;">${portariaExibicao}</td>
            <td style="vertical-align: top;">${boletimExibicao}</td>
            <td style="vertical-align: top;">${c.sigad || "-"}</td>
            <td style="vertical-align: top;">${c.observacao || "-"}</td>
            <td class="acoes" style="vertical-align: top;">
                <div style="display: flex; flex-direction: column; width: 100%;">
                    ${botaoBaixar}
                    ${botoesEdicao}
                </div>
            </td>
        </tr>`;
        tabela.innerHTML += linha;
    });

    renderizarPaginacao(comissoesFiltradas.length);
}

// --- SISTEMA DE FILTROS (Misto: Busca + Botões Rápidos) ---
function aplicarFiltroRapido(tipo) {
    filtroRapidoAtual = tipo;
    
    // Atualiza a cor dos botões (CSS)
    document.querySelectorAll('.btn-filtro').forEach(btn => btn.classList.remove('ativo'));
    if(tipo === 'todos') document.getElementById('btnFiltroTodos').classList.add('ativo');
    if(tipo === 'atrasados') document.getElementById('btnFiltroAtrasados').classList.add('ativo');
    if(tipo === 'sem_portaria') document.getElementById('btnFiltroPortaria').classList.add('ativo');
    if(tipo === 'pendentes') document.getElementById('btnFiltroPendentes').classList.add('ativo');
    
    aplicarFiltrosCombinados();
}

function filtrar() {
    aplicarFiltrosCombinados();
}

function aplicarFiltrosCombinados() {
    let textoBusca = document.getElementById("filtro").value.toLowerCase();
    paginaAtual = 1; 

    comissoesFiltradas = comissoes.filter(c => {
        // 1. Checa o texto da barra de pesquisa
        let atendeBusca = 
            c.nome.toLowerCase().includes(textoBusca) ||
            c.fiscal.toLowerCase().includes(textoBusca) ||
            (c.fiscal_substituto && c.fiscal_substituto.toLowerCase().includes(textoBusca)) ||
            (c.membros && c.membros.some(m => m.nome.toLowerCase().includes(textoBusca))) ||
            (c.portaria && c.portaria.toLowerCase().includes(textoBusca)) ||
            (c.boletim && c.boletim.toLowerCase().includes(textoBusca)) ||
            (c.sigad && c.sigad.toLowerCase().includes(textoBusca));

        // 2. Checa o botão de filtro rápido pressionado
        let atendeRapido = true;
        
        let diffDias = c.created_at ? Math.floor((new Date() - new Date(c.created_at)) / (1000 * 60 * 60 * 24)) : 0;
        let estaSemBoletim = (!c.boletim || c.boletim.trim() === "");

        if (filtroRapidoAtual === 'atrasados') {
            atendeRapido = (estaSemBoletim && diffDias >= 3);
        } else if (filtroRapidoAtual === 'sem_portaria') {
            atendeRapido = (!c.portaria_path || c.portaria_path === null);
        } else if (filtroRapidoAtual === 'pendentes') {
            atendeRapido = (estaSemBoletim && diffDias < 3);
        }

        return atendeBusca && atendeRapido;
    });

    atualizarTabela();
}

// ... DEMAIS FUNÇÕES DE LIMPAR, EDITAR, EXPORTAR EXCEL MANTIDAS IGUAIS ...
function editar(indexReal) {
    let c = comissoes[indexReal];
    document.getElementById("nomeComissao").value = c.nome;
    document.getElementById("fiscal").value = c.fiscal;
    document.getElementById("fiscalSiafi").checked = c.fiscal_siafi;
    document.getElementById("fiscalCurso").checked = c.fiscal_curso;
    document.getElementById("fiscalSubstituto").value = c.fiscal_substituto || "";
    document.getElementById("substitutoSiafi").checked = c.substituto_siafi;
    document.getElementById("substitutoCurso").checked = c.substituto_curso;
    document.getElementById("portaria").value = c.portaria || "";
    document.getElementById("boletim").value = c.boletim || "";
    document.getElementById("sigad").value = c.sigad || "";
    document.getElementById("observacao").value = c.observacao || "";
    document.getElementById("arquivoPortaria").value = ""; 

    let container = document.getElementById("membrosContainer");
    container.innerHTML = ""; 

    if (c.membros && c.membros.length > 0) {
        c.membros.forEach(m => {
            let div = document.createElement("div");
            div.className = "militar-row membro-group";
            div.innerHTML = `
                <input type="text" class="membro-nome" value="${m.nome}">
                <div class="checkbox-group">
                    <label><input type="checkbox" class="membro-siafi" ${m.siafi_siasg ? 'checked' : ''}> SIAFI</label>
                    <label><input type="checkbox" class="membro-curso" ${m.curso ? 'checked' : ''}> CURSO</label>
                </div>
            `;
            container.appendChild(div);
        });
    } else { adicionarMembro(); }
    editandoId = c.id; 
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
}

function limparCampos() {
    document.getElementById("nomeComissao").value = "";
    document.getElementById("fiscal").value = "";
    document.getElementById("fiscalSiafi").checked = false;
    document.getElementById("fiscalCurso").checked = false;
    document.getElementById("fiscalSubstituto").value = "";
    document.getElementById("substitutoSiafi").checked = false;
    document.getElementById("substitutoCurso").checked = false;
    document.getElementById("portaria").value = "";
    document.getElementById("boletim").value = "";
    document.getElementById("sigad").value = "";
    document.getElementById("observacao").value = "";
    document.getElementById("arquivoPortaria").value = ""; 
    
    let container = document.getElementById("membrosContainer");
    container.innerHTML = "";
    adicionarMembro();
}

function exportarExcel() {
    let dados = "Comissão;Fiscal;Substituto;Membros;Portaria;Boletim;SIGAD;Observação\n";
    comissoes.forEach(c => {
        let qualFiscal = `(SIAFI: ${c.fiscal_siafi ? 'Sim' : 'Nao'} | Curso: ${c.fiscal_curso ? 'Sim' : 'Nao'})`;
        let subExp = c.fiscal_substituto ? `${c.fiscal_substituto} (SIAFI: ${c.substituto_siafi ? 'Sim' : 'Nao'} | Curso: ${c.substituto_curso ? 'Sim' : 'Nao'})` : "";
        let membrosExp = c.membros ? c.membros.map(m => `${m.nome} (SIAFI: ${m.siafi_siasg ? 'Sim' : 'Nao'} | Curso: ${m.curso ? 'Sim' : 'Nao'})`).join(" - ") : "";
        dados += `"${c.nome}";"${c.fiscal} ${qualFiscal}";"${subExp}";"${membrosExp}";"${c.portaria || ""}";"${c.boletim || "Pendente"}";"${c.sigad || ""}";"${c.observacao || ""}"\n`;
    });
    let blob = new Blob(["\ufeff" + dados], { type: "text/csv;charset=utf-8;" });
    let link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "comissoes.csv";
    link.click();
}

function atualizarDashboard() {
    document.getElementById("totalComissoes").innerText = comissoes.length;
    let fiscais = new Set();
    let membrosCount = 0;
    comissoes.forEach(c => {
        if(c.fiscal) fiscais.add(c.fiscal);
        if(c.membros) membrosCount += c.membros.length;
    });
    document.getElementById("totalFiscais").innerText = fiscais.size;
    document.getElementById("totalMembros").innerText = membrosCount;
}

document.addEventListener('input', function(e) {
    if (e.target.tagName === 'INPUT' && e.target.type === 'text' && e.target.id !== 'filtro') {
        let inicio = e.target.selectionStart;
        let fim = e.target.selectionEnd;
        e.target.value = e.target.value.toUpperCase();
        e.target.setSelectionRange(inicio, fim);
    }
});